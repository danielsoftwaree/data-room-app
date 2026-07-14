/** A public share link on a file node. One row per file (node id is the PK). */
export interface NodeShare {
  nodeId: string;
  slug: string;
  passwordHash: string;
  /** epoch ms */
  createdAt: number;
  createdBy: string | null;
}

export interface InsertShareInput {
  nodeId: string;
  slug: string;
  passwordHash: string;
  userId: string;
}

export interface SharesRepository {
  findByNodeId(nodeId: string): Promise<NodeShare | undefined>;
  findBySlug(slug: string): Promise<NodeShare | undefined>;
  /** Create a new share row. Throws a unique violation on a slug/node-id clash. */
  insert(input: InsertShareInput): Promise<NodeShare>;
  /** Rotate the password of an existing share, keeping its slug and created_at. */
  updatePasswordHash(nodeId: string, passwordHash: string): Promise<NodeShare | undefined>;
  /** Delete the share for a node. Returns whether a row existed (for idempotent 204). */
  delete(nodeId: string): Promise<boolean>;
}

export const SHARES_REPOSITORY = Symbol('SHARES_REPOSITORY');
