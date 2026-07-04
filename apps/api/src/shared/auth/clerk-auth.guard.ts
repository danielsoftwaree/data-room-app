import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createClerkClient, verifyToken, type ClerkClient } from '@clerk/backend';
import { EnvService } from '../../config/env';
import { WorkspaceService } from '../../modules/workspace/application/workspace.service';
import { IS_PUBLIC_KEY } from './public.decorator';
import { clerkIdToUserId, colorForUser } from './user-id';

/**
 * Verifies a Clerk session token on every request unless the handler is marked
 * @Public(). On success the Clerk user is mapped to a stable internal user id,
 * provisioned in the database on first sight, and written to the `x-user-id`
 * request header so the existing controllers resolve the authenticated user
 * with no per-endpoint changes. Domain code stays auth-agnostic.
 *
 * When no CLERK_SECRET_KEY is configured the app runs in zero-friction demo
 * mode: the guard steps aside and controllers fall back to the demo identity.
 */
@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private clerkClient: ClerkClient | null = null;

  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(EnvService) private readonly env: EnvService,
    @Inject(WorkspaceService) private readonly workspace: WorkspaceService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const secretKey = this.env.get('CLERK_SECRET_KEY');
    // Demo mode: auth not configured, let controllers fall back to the demo user.
    if (!secretKey) return true;

    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined>; userId?: string }>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) throw new UnauthorizedException('Missing bearer token');

    let externalId: string;
    try {
      const payload = await verifyToken(token, { secretKey });
      externalId = payload.sub;
    } catch {
      throw new UnauthorizedException('Invalid or expired session');
    }

    const userId = clerkIdToUserId(externalId);
    // Provision only on first sight: one Clerk lookup per new user, then cached
    // in our own users table forever.
    if (!(await this.workspace.userExists(userId))) {
      const profile = await this.fetchClerkProfile(secretKey, externalId);
      await this.workspace.provisionUser({
        id: userId,
        name: profile.name,
        email: profile.email,
        color: colorForUser(userId),
      });
    }

    // Hand the resolved identity to the controllers via the header they already read.
    request.headers['x-user-id'] = userId;
    request.userId = userId;
    return true;
  }

  /** Best-effort profile from Clerk; failures degrade to fallbacks in the service. */
  private async fetchClerkProfile(
    secretKey: string,
    externalId: string,
  ): Promise<{ name?: string; email?: string }> {
    try {
      this.clerkClient ??= createClerkClient({ secretKey });
      const user = await this.clerkClient.users.getUser(externalId);
      const email =
        user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId)
          ?.emailAddress ?? user.emailAddresses[0]?.emailAddress;
      const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || undefined;
      return { name, email };
    } catch {
      return {};
    }
  }
}

function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !value) return null;
  return value.trim();
}
