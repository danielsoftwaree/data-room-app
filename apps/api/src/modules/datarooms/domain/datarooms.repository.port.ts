import type { Dataroom, DataroomNode, FileNode, FolderNode, MemberRole, User } from '@repo/domain';

export interface CreateFolderInput {
  dataroomId: string;
  parentId: string | null;
  name: string;
  userId: string;
}

export interface CreateFileNodeInput extends CreateFolderInput {
  size: number;
}

export interface MoveNodeInput {
  id: string;
  parentId: string | null;
  name: string;
  userId: string;
}

export interface ListNodesOptions {
  nameContains?: string;
  /** Include trashed nodes. Off by default — every normal listing hides trash. */
  includeDeleted?: boolean;
}

/** A data room the caller belongs to, tagged with their role in it. */
export interface DataroomForUser extends Dataroom {
  myRole: MemberRole;
}

/** Per-room aggregates for the dashboard, resolved without a query per room. */
export interface DataroomMeta {
  memberCount: number;
  owner: User | null;
}

export interface DataroomsRepository {
  /**
   * Takes a per-room mutual-exclusion lock for the rest of the current
   * transaction, serializing structural mutations (move/trash/restore) so
   * read-then-write subtree logic cannot interleave. No-op outside PostgreSQL.
   */
  lockDataroom(dataroomId: string): Promise<void>;
  listDataroomsForUser(userId: string): Promise<DataroomForUser[]>;
  dataroomMeta(dataroomIds: readonly string[]): Promise<Map<string, DataroomMeta>>;
  createDataroom(name: string, userId: string): Promise<Dataroom>;
  findDataroom(id: string): Promise<Dataroom | undefined>;
  renameDataroom(id: string, name: string, userId: string): Promise<Dataroom | undefined>;
  deleteDataroom(id: string): Promise<void>;
  listNodes(dataroomId: string, options?: ListNodesOptions): Promise<DataroomNode[]>;
  /** Trashed nodes across the given rooms (for the global trash view). */
  listDeletedNodes(dataroomIds: readonly string[]): Promise<DataroomNode[]>;
  findNode(id: string): Promise<DataroomNode | undefined>;
  createFolder(input: CreateFolderInput): Promise<FolderNode>;
  createFileNode(input: CreateFileNodeInput): Promise<FileNode>;
  renameNode(id: string, name: string, userId: string): Promise<DataroomNode | undefined>;
  moveNode(input: MoveNodeInput): Promise<DataroomNode | undefined>;
  /** Hard delete a node and its descendants (DB cascade). Used to purge from trash. */
  deleteNode(id: string): Promise<void>;
  /** Soft delete: stamp deleted_at/deleted_by on the given ids. */
  setNodesDeleted(ids: readonly string[], deletedBy: string): Promise<void>;
  /** Clear deleted_at/deleted_by on the given ids. */
  restoreNodes(ids: readonly string[]): Promise<void>;
  siblingNames(dataroomId: string, parentId: string | null, excludeId?: string): Promise<string[]>;
}

export const DATAROOMS_REPOSITORY = Symbol('DATAROOMS_REPOSITORY');
