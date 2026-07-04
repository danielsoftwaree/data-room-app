import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { verifyToken } from '@clerk/backend';
import type { Request } from 'express';
import { EnvService } from '../../config/env';
import { IS_PUBLIC_KEY } from './public.decorator';

/**
 * Verifies a Clerk session token on every request unless the handler is marked
 * @Public(). On success the verified Clerk user id is attached to the request
 * as `userId`, which the workspace layer reads for attribution. Domain code
 * stays auth-agnostic.
 */
@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(EnvService) private readonly env: EnvService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { userId?: string }>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) throw new UnauthorizedException('Missing bearer token');

    const secretKey = this.env.get('CLERK_SECRET_KEY');
    if (!secretKey) throw new UnauthorizedException('Auth is not configured');

    try {
      const payload = await verifyToken(token, { secretKey });
      request.userId = payload.sub;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired session');
    }
  }
}

function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !value) return null;
  return value.trim();
}
