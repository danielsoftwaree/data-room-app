import type { ActivityAction, MemberRole, NodeType, User } from '@repo/domain';

export interface FavoriteRecord {
  dataroomId: string;
  dataroomName: string;
  nodeId: string | null;
  nodeName: string | null;
  nodeType: NodeType | null;
  parentId: string | null;
  createdAt: number;
}

export interface MemberRecord {
  dataroomId: string;
  user: User;
  role: MemberRole;
  addedAt: number;
}

export interface ActivityRecord {
  id: string;
  dataroomId: string;
  nodeId: string | null;
  nodeName: string | null;
  nodeType: NodeType | null;
  action: ActivityAction;
  actor: User;
  createdAt: number;
}

export interface RecordActivityInput {
  dataroomId: string;
  nodeId: string | null;
  nodeName: string | null;
  nodeType: NodeType | null;
  action: ActivityAction;
  actorId: string;
}

export interface FavoriteTarget {
  dataroomId: string;
  nodeId: string | null;
}

export interface WorkspaceRepository {
  listUsers(): Promise<User[]>;
  findUser(id: string): Promise<User | undefined>;
  getDefaultUser(): Promise<User>;
  dataroomExists(id: string): Promise<boolean>;
  nodeBelongsToDataroom(nodeId: string, dataroomId: string): Promise<boolean>;
  listMembers(dataroomId: string): Promise<MemberRecord[]>;
  findMemberRole(dataroomId: string, userId: string): Promise<MemberRole | null>;
  countOwners(dataroomId: string): Promise<number>;
  /** Plain insert — the service rejects duplicates before calling. */
  addMember(dataroomId: string, userId: string, role: MemberRole): Promise<MemberRecord>;
  updateMemberRole(
    dataroomId: string,
    userId: string,
    role: MemberRole,
  ): Promise<MemberRecord | undefined>;
  removeMember(dataroomId: string, userId: string): Promise<void>;
  listFavorites(userId: string): Promise<FavoriteRecord[]>;
  addFavorite(userId: string, target: FavoriteTarget): Promise<FavoriteRecord>;
  removeFavorite(userId: string, target: FavoriteTarget): Promise<void>;
  removeFavoritesForNodes(nodeIds: readonly string[]): Promise<void>;
  listActivity(
    dataroomId: string,
    options?: { nodeId?: string; limit?: number },
  ): Promise<ActivityRecord[]>;
  recordActivity(input: RecordActivityInput): Promise<ActivityRecord>;
  storageUsedBytes(): Promise<number>;
}

export const WORKSPACE_REPOSITORY = Symbol('WORKSPACE_REPOSITORY');
