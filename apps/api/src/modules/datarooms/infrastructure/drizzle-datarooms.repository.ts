import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  asc,
  dataroomMembers,
  datarooms,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  ne,
  nodeShares,
  nodes,
  sql,
  users,
} from '@repo/db';
import type { Database, DatabaseExecutor, SQL } from '@repo/db';
import type { Dataroom, DataroomNode, FileNode, FolderNode, User } from '@repo/domain';
import { DRIZZLE } from '../../../config/database/database.tokens';
import { transactionContext } from '../../../shared/database/transaction';
import type {
  CreateFileNodeInput,
  CreateFolderInput,
  DataroomForUser,
  DataroomMeta,
  DataroomsRepository,
  ListNodesOptions,
  MoveNodeInput,
} from '../domain/datarooms.repository.port';

type DataroomRow = typeof datarooms.$inferSelect;
type NodeRow = typeof nodes.$inferSelect;
type UserRow = typeof users.$inferSelect;

/** Metadata persistence only - file bytes live behind BlobStorage. */
@Injectable()
export class DrizzleDataroomsRepository implements DataroomsRepository {
  constructor(@Inject(DRIZZLE) private readonly database: Database) {}

  /** The ambient transaction when a TransactionRunner.run is active, else the pool. */
  private get db(): DatabaseExecutor {
    return transactionContext.current() ?? this.database;
  }

  async lockDataroom(dataroomId: string): Promise<void> {
    // Serializes structural mutations (move/trash/restore) per room so
    // read-then-write subtree logic cannot interleave. Transaction-scoped:
    // released automatically on commit/rollback.
    await this.db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${dataroomId}, 0))`);
  }

  async listDataroomsForUser(userId: string): Promise<DataroomForUser[]> {
    const rows = await this.db
      .select({ dataroom: datarooms, role: dataroomMembers.role })
      .from(datarooms)
      .innerJoin(dataroomMembers, eq(dataroomMembers.dataroomId, datarooms.id))
      .where(eq(dataroomMembers.userId, userId))
      .orderBy(asc(sql`lower(${datarooms.name})`));
    return rows.map((row) => ({ ...toDataroom(row.dataroom), myRole: row.role }));
  }

  async dataroomMeta(dataroomIds: readonly string[]): Promise<Map<string, DataroomMeta>> {
    const meta = new Map<string, DataroomMeta>();
    if (dataroomIds.length === 0) return meta;
    const ids = [...dataroomIds];
    for (const id of ids) meta.set(id, { memberCount: 0, owner: null });

    const counts = await this.db
      .select({
        dataroomId: dataroomMembers.dataroomId,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(dataroomMembers)
      .where(inArray(dataroomMembers.dataroomId, ids))
      .groupBy(dataroomMembers.dataroomId);
    for (const row of counts) {
      const entry = meta.get(row.dataroomId);
      if (entry) entry.memberCount = row.count;
    }

    // Earliest-added owner represents the room. Ordered ascending so the first
    // row per dataroom wins.
    const owners = await this.db
      .select({ dataroomId: dataroomMembers.dataroomId, user: users })
      .from(dataroomMembers)
      .innerJoin(users, eq(dataroomMembers.userId, users.id))
      .where(and(inArray(dataroomMembers.dataroomId, ids), eq(dataroomMembers.role, 'owner')))
      .orderBy(asc(dataroomMembers.createdAt));
    for (const row of owners) {
      const entry = meta.get(row.dataroomId);
      if (entry && !entry.owner) entry.owner = toUser(row.user);
    }

    return meta;
  }

  async createDataroom(name: string, userId: string): Promise<Dataroom> {
    const [row] = await this.db
      .insert(datarooms)
      .values({ name, createdBy: userId, updatedBy: userId })
      .returning();
    return toDataroom(expectRow(row, 'Failed to create data room'));
  }

  async findDataroom(id: string): Promise<Dataroom | undefined> {
    const [row] = await this.db.select().from(datarooms).where(eq(datarooms.id, id)).limit(1);
    return row ? toDataroom(row) : undefined;
  }

  async renameDataroom(id: string, name: string, userId: string): Promise<Dataroom | undefined> {
    const [row] = await this.db
      .update(datarooms)
      .set({ name, updatedAt: new Date(), updatedBy: userId })
      .where(eq(datarooms.id, id))
      .returning();
    return row ? toDataroom(row) : undefined;
  }

  async deleteDataroom(id: string): Promise<void> {
    await this.db.delete(datarooms).where(eq(datarooms.id, id));
  }

  async listNodes(dataroomId: string, options?: ListNodesOptions): Promise<DataroomNode[]> {
    const conditions: SQL[] = [eq(nodes.dataroomId, dataroomId)];
    if (!options?.includeDeleted) conditions.push(isNull(nodes.deletedAt));
    if (options?.nameContains) {
      conditions.push(ilike(nodes.name, `%${escapeLikePattern(options.nameContains)}%`));
    }

    const rows = await this.db
      .select({ node: nodes, shareSlug: nodeShares.slug })
      .from(nodes)
      .leftJoin(nodeShares, eq(nodeShares.nodeId, nodes.id))
      .where(and(...conditions));
    return rows.map((row) => toNode(row.node, row.shareSlug));
  }

  async listDeletedNodes(dataroomIds: readonly string[]): Promise<DataroomNode[]> {
    if (dataroomIds.length === 0) return [];
    const rows = await this.db
      .select({ node: nodes, shareSlug: nodeShares.slug })
      .from(nodes)
      .leftJoin(nodeShares, eq(nodeShares.nodeId, nodes.id))
      .where(and(inArray(nodes.dataroomId, [...dataroomIds]), isNotNull(nodes.deletedAt)));
    return rows.map((row) => toNode(row.node, row.shareSlug));
  }

  async findNode(id: string): Promise<DataroomNode | undefined> {
    const [row] = await this.db
      .select({ node: nodes, shareSlug: nodeShares.slug })
      .from(nodes)
      .leftJoin(nodeShares, eq(nodeShares.nodeId, nodes.id))
      .where(eq(nodes.id, id))
      .limit(1);
    return row ? toNode(row.node, row.shareSlug) : undefined;
  }

  async createFolder(input: CreateFolderInput): Promise<FolderNode> {
    const [row] = await this.db
      .insert(nodes)
      .values({
        dataroomId: input.dataroomId,
        parentId: input.parentId,
        type: 'folder',
        name: input.name,
        createdBy: input.userId,
        updatedBy: input.userId,
      })
      .returning();
    const node = toNode(expectRow(row, 'Failed to create folder'), null);
    if (node.type !== 'folder') throw new Error('Created node is not a folder');
    return node;
  }

  async createFileNode(input: CreateFileNodeInput): Promise<FileNode> {
    const [row] = await this.db
      .insert(nodes)
      .values({
        dataroomId: input.dataroomId,
        parentId: input.parentId,
        type: 'file',
        name: input.name,
        size: input.size,
        createdBy: input.userId,
        updatedBy: input.userId,
      })
      .returning();
    // A freshly created file has no share yet, so its slug is trivially null.
    const node = toNode(expectRow(row, 'Failed to create file node'), null);
    if (node.type !== 'file') throw new Error('Created node is not a file');
    return node;
  }

  async renameNode(id: string, name: string, userId: string): Promise<DataroomNode | undefined> {
    const [row] = await this.db
      .update(nodes)
      .set({ name, updatedAt: new Date(), updatedBy: userId })
      .where(eq(nodes.id, id))
      .returning();
    return row ? toNode(row, await this.shareSlugForRow(row)) : undefined;
  }

  async moveNode(input: MoveNodeInput): Promise<DataroomNode | undefined> {
    const [row] = await this.db
      .update(nodes)
      .set({
        parentId: input.parentId,
        name: input.name,
        updatedAt: new Date(),
        updatedBy: input.userId,
      })
      .where(eq(nodes.id, input.id))
      .returning();
    return row ? toNode(row, await this.shareSlugForRow(row)) : undefined;
  }

  /** The share slug for a node row — looked up only for files, which alone can be shared. */
  private async shareSlugForRow(row: NodeRow): Promise<string | null> {
    if (row.type !== 'file') return null;
    const [share] = await this.db
      .select({ slug: nodeShares.slug })
      .from(nodeShares)
      .where(eq(nodeShares.nodeId, row.id))
      .limit(1);
    return share?.slug ?? null;
  }

  async deleteNode(id: string): Promise<void> {
    await this.db.delete(nodes).where(eq(nodes.id, id));
  }

  async setNodesDeleted(ids: readonly string[], deletedBy: string): Promise<void> {
    if (ids.length === 0) return;
    await this.db
      .update(nodes)
      .set({ deletedAt: new Date(), deletedBy })
      .where(inArray(nodes.id, [...ids]));
  }

  async restoreNodes(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db
      .update(nodes)
      .set({ deletedAt: null, deletedBy: null })
      .where(inArray(nodes.id, [...ids]));
  }

  async siblingNames(
    dataroomId: string,
    parentId: string | null,
    excludeId?: string,
  ): Promise<string[]> {
    const conditions: SQL[] = [
      eq(nodes.dataroomId, dataroomId),
      isNull(nodes.deletedAt),
      parentId === null ? isNull(nodes.parentId) : eq(nodes.parentId, parentId),
    ];
    if (excludeId) conditions.push(ne(nodes.id, excludeId));

    const rows = await this.db
      .select({ name: nodes.name })
      .from(nodes)
      .where(and(...conditions));
    return rows.map((row) => row.name);
  }
}

function toDataroom(row: DataroomRow): Dataroom {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
  };
}

function toNode(row: NodeRow, shareSlug: string | null): DataroomNode {
  const base = {
    id: row.id,
    dataroomId: row.dataroomId,
    parentId: row.parentId,
    name: row.name,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    deletedAt: row.deletedAt ? row.deletedAt.getTime() : null,
    deletedBy: row.deletedBy,
    shareSlug,
  };

  if (row.type === 'folder') return { ...base, type: 'folder' };
  if (row.size === null) throw new Error(`File node ${row.id} is missing size`);
  return { ...base, type: 'file', size: row.size };
}

function toUser(row: UserRow): User {
  return { id: row.id, name: row.name, email: row.email, color: row.color };
}

function expectRow<T>(row: T | undefined, message: string): T {
  if (!row) throw new Error(message);
  return row;
}

/** Escape LIKE wildcards so a search for "100%" or "_draft" matches literally. */
function escapeLikePattern(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}
