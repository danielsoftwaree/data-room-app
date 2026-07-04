import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { STORAGE_QUOTA_BYTES } from '@repo/config';
import type { ActivityAction, DataroomNode, MemberRole, User } from '@repo/domain';
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

  async ensureOwnerMember(dataroomId: string, userId: string): Promise<void> {
    await this.repository.addMember(dataroomId, userId, 'owner');
  }

  async listMembers(dataroomId: string): Promise<MemberRecord[]> {
    await this.assertDataroom(dataroomId);
    return this.repository.listMembers(dataroomId);
  }

  async addMember(
    dataroomId: string,
    actorId: string,
    userId: string,
    role: MemberRole,
  ): Promise<MemberRecord> {
    await this.assertDataroom(dataroomId);
    await this.assertUser(userId);
    const member = await this.repository.addMember(dataroomId, userId, role);
    await this.recordActivity({ dataroomId, node: null, action: 'member.added', actorId });
    return member;
  }

  async removeMember(dataroomId: string, actorId: string, userId: string): Promise<void> {
    await this.assertDataroom(dataroomId);
    await this.repository.removeMember(dataroomId, userId);
    await this.recordActivity({ dataroomId, node: null, action: 'member.removed', actorId });
  }

  async listFavorites(userId: string): Promise<FavoriteRecord[]> {
    return this.repository.listFavorites(userId);
  }

  async addFavorite(userId: string, request: ToggleFavoriteRequest): Promise<FavoriteRecord> {
    const target = normalizeFavoriteTarget(request);
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
    options?: { nodeId?: string; limit?: number },
  ): Promise<ActivityRecord[]> {
    await this.assertDataroom(dataroomId);
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
