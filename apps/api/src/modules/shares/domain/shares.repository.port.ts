/** A public share link on a node (file or folder). One row per node (node id is the PK). */
export interface NodeShare {
  nodeId: string;
  slug: string;
  /** Null = the link opens without a password. */
  passwordHash: string | null;
  /** epoch ms */
  createdAt: number;
  createdBy: string | null;
}

export interface InsertShareInput {
  nodeId: string;
  slug: string;
  passwordHash: string | null;
  userId: string;
}

export interface SharesRepository {
  findByNodeId(nodeId: string): Promise<NodeShare | undefined>;
  findBySlug(slug: string): Promise<NodeShare | undefined>;
  /** Create a new share row. Throws a unique violation on a slug/node-id clash. */
  insert(input: InsertShareInput): Promise<NodeShare>;
  /** Change the password of an existing share (null removes it), keeping its slug and created_at. */
  updatePasswordHash(nodeId: string, passwordHash: string | null): Promise<NodeShare | undefined>;
  /** Delete the share for a node. Returns whether a row existed (for idempotent 204). */
  delete(nodeId: string): Promise<boolean>;
}

export const SHARES_REPOSITORY = Symbol('SHARES_REPOSITORY');
