import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { STORAGE_QUOTA_BYTES } from '@repo/config';
import type { ActivityAction, DataroomNode, MemberRole, User } from '@repo/domain';
import { roleAtLeast } from '@repo/domain';
import type { ToggleFavoriteRequest } from '@repo/contracts';
import type {
  ActivityRecord,
  FavoriteRecord,
  MemberRecord,
  WorkspaceRepository,
} from '../domain/workspace.repository.port';
import { WORKSPACE_REPOSITORY } from '../domain/workspace.repository.port';

export interface ActivityEventInput {
  dataroomId: string;
  node: Pick<DataroomNode, 'id' | 'name' | 'type'> | null;
  action: ActivityAction;
  actorId: string;
}

@Injectable()
export class WorkspaceService {
  constructor(@Inject(WORKSPACE_REPOSITORY) private readonly repository: WorkspaceRepository) {}

  async resolveCurrentUserId(rawUserId: string | undefined): Promise<string> {
    const requested = rawUserId?.trim();
    if (requested) {
      const user = await this.repository.findUser(requested);
      if (user) return user.id;
    }
    return (await this.repository.getDefaultUser()).id;
  }

  async getCurrentUser(rawUserId: string | undefined): Promise<User> {
    const userId = await this.resolveCurrentUserId(rawUserId);
    const user = await this.repository.findUser(userId);
    if (!user) throw new BadRequestException('Current user not found');
    return user;
  }

  listUsers(): Promise<User[]> {
    return this.repository.listUsers();
  }

  userExists(id: string): Promise<boolean> {
    return this.repository.findUser(id).then((user) => Boolean(user));
  }

  /**
   * Provisions (or refreshes) the row for an authenticated user. The auth layer
   * passes the internal id it derived from the Clerk id, plus whatever profile
   * it could resolve; we fill sensible fallbacks so the NOT NULL columns hold.
   */
  provisionUser(input: {
    id: string;
    name?: string | null;
    email?: string | null;
    color: string;
  }): Promise<User> {
    const email = input.email?.trim() || `${input.id}@acme.com`;
    const name = input.name?.trim() || email.split('@')[0] || 'User';
    return this.repository.upsertUser({ id: input.id, name, email, color: input.color });
  }

  /** The caller's role in a room, or null when they are not a member. */
  getRole(dataroomId: string, userId: string): Promise<MemberRole | null> {
    return this.repository.findMemberRole(dataroomId, userId);
  }

  /**
   * Membership gate. A non-member gets a 404 (not a 403) so we never reveal that
   * a room they cannot see exists. Returns the caller's role for further checks.
   */
  async assertMember(dataroomId: string, userId: string): Promise<MemberRole> {
    const role = await this.repository.findMemberRole(dataroomId, userId);
    if (!role) throw new NotFoundException('Data room not found');
    return role;
  }

  /** Requires membership AND at least `min` privilege; a member below it gets 403. */
  async assertRole(dataroomId: string, userId: string, min: MemberRole): Promise<MemberRole> {
    const role = await this.assertMember(dataroomId, userId);
    if (!roleAtLeast(role, min)) {
      throw new ForbiddenException(`This action requires ${min} access`);
    }
    return role;
  }

  async ensureOwnerMember(dataroomId: string, userId: string): Promise<void> {
    await this.repository.addMember(dataroomId, userId, 'owner');
  }

  async listMembers(dataroomId: string, actorId: string): Promise<MemberRecord[]> {
    await this.assertMember(dataroomId, actorId);
    return this.repository.listMembers(dataroomId);
  }

  async addMember(
    dataroomId: string,
    actorId: string,
    userId: string,
    role: MemberRole,
  ): Promise<MemberRecord> {
    await this.assertRole(dataroomId, actorId, 'owner');
    await this.assertUser(userId);
    if (await this.repository.findMemberRole(dataroomId, userId)) {
      throw new ConflictException('This person is already a member');
    }
    const member = await this.repository.addMember(dataroomId, userId, role);
    await this.recordActivity({ dataroomId, node: null, action: 'member.added', actorId });
    return member;
  }

  async updateMemberRole(
    dataroomId: string,
    actorId: string,
    userId: string,
    role: MemberRole,
  ): Promise<MemberRecord> {
    await this.assertRole(dataroomId, actorId, 'owner');
    const current = await this.repository.findMemberRole(dataroomId, userId);
    if (!current) throw new NotFoundException('Member not found');
    if (
      current === 'owner' &&
      role !== 'owner' &&
      (await this.repository.countOwners(dataroomId)) <= 1
    ) {
      throw new BadRequestException('A data room must keep at least one owner');
    }
    const member = await this.repository.updateMemberRole(dataroomId, userId, role);
    if (!member) throw new NotFoundException('Member not found');
    await this.recordActivity({ dataroomId, node: null, action: 'member.updated', actorId });
    return member;
  }

  async removeMember(dataroomId: string, actorId: string, userId: string): Promise<void> {
    await this.assertRole(dataroomId, actorId, 'owner');
    const current = await this.repository.findMemberRole(dataroomId, userId);
    if (!current) return;
    if (current === 'owner' && (await this.repository.countOwners(dataroomId)) <= 1) {
      throw new BadRequestException('A data room must keep at least one owner');
    }
    await this.repository.removeMember(dataroomId, userId);
    await this.recordActivity({ dataroomId, node: null, action: 'member.removed', actorId });
  }

  async listFavorites(userId: string): Promise<FavoriteRecord[]> {
    return this.repository.listFavorites(userId);
  }

  async addFavorite(userId: string, request: ToggleFavoriteRequest): Promise<FavoriteRecord> {
    const target = normalizeFavoriteTarget(request);
    await this.assertMember(target.dataroomId, userId);
    await this.assertFavoriteTarget(target);
    return this.repository.addFavorite(userId, target);
  }

  async removeFavorite(userId: string, request: ToggleFavoriteRequest): Promise<void> {
    const target = normalizeFavoriteTarget(request);
    await this.repository.removeFavorite(userId, target);
  }

  removeFavoritesForNodes(nodeIds: readonly string[]): Promise<void> {
    return this.repository.removeFavoritesForNodes(nodeIds);
  }

  async listActivity(
    dataroomId: string,
    actorId: string,
    options?: { nodeId?: string; limit?: number },
  ): Promise<ActivityRecord[]> {
    await this.assertMember(dataroomId, actorId);
    return this.repository.listActivity(dataroomId, options);
  }

  recordActivity(input: ActivityEventInput): Promise<ActivityRecord> {
    return this.repository.recordActivity({
      dataroomId: input.dataroomId,
      nodeId: input.node?.id ?? null,
      nodeName: input.node?.name ?? null,
      nodeType: input.node?.type ?? null,
      action: input.action,
      actorId: input.actorId,
    });
  }

  async storageUsage(): Promise<{ usedBytes: number; quotaBytes: number }> {
    return {
      usedBytes: await this.repository.storageUsedBytes(),
      quotaBytes: STORAGE_QUOTA_BYTES,
    };
  }

  private async assertDataroom(dataroomId: string): Promise<void> {
    if (!(await this.repository.dataroomExists(dataroomId))) {
      throw new NotFoundException('Data room not found');
    }
  }

  private async assertUser(userId: string): Promise<void> {
    if (!(await this.repository.findUser(userId))) {
      throw new BadRequestException('User not found');
    }
  }

  private async assertFavoriteTarget(target: { dataroomId: string; nodeId: string | null }) {
    await this.assertDataroom(target.dataroomId);
    if (
      target.nodeId !== null &&
      !(await this.repository.nodeBelongsToDataroom(target.nodeId, target.dataroomId))
    ) {
      throw new NotFoundException('Favorite target not found');
    }
  }
}

function normalizeFavoriteTarget(request: ToggleFavoriteRequest): {
  dataroomId: string;
  nodeId: string | null;
} {
  if (!request.dataroomId) throw new BadRequestException('dataroomId is required');
  return { dataroomId: request.dataroomId, nodeId: request.nodeId ?? null };
}
