import { Inject, Injectable } from '@nestjs/common';
import {
  activity,
  and,
  asc,
  dataroomMembers,
  datarooms,
  desc,
  eq,
  favorites,
  inArray,
  isNull,
  nodes,
  or,
  sql,
  users,
} from '@repo/db';
import type { Database, DatabaseExecutor, SQL } from '@repo/db';
import type { MemberRole, NodeType, User } from '@repo/domain';
import { DRIZZLE } from '../../../config/database/database.tokens';
import { transactionContext } from '../../../shared/database/transaction';
import type {
  ActivityRecord,
  FavoriteRecord,
  FavoriteTarget,
  MemberRecord,
  RecordActivityInput,
  WorkspaceRepository,
} from '../domain/workspace.repository.port';

type UserRow = typeof users.$inferSelect;

/** Stable identity used when auth is not configured (mirrors the MSW mock's demo user). */
const DEMO_USER = {
  id: '6e5e44cc-0000-4000-8000-000000000001',
  name: 'Jane Smith',
  email: 'jane@acme.com',
  color: '#6366f1',
} as const;

@Injectable()
export class DrizzleWorkspaceRepository implements WorkspaceRepository {
  constructor(@Inject(DRIZZLE) private readonly database: Database) {}

  /** The ambient transaction when a TransactionRunner.run is active, else the pool. */
  private get db(): DatabaseExecutor {
    return transactionContext.current() ?? this.database;
  }

  async listUsers(): Promise<User[]> {
    const rows = await this.db.select().from(users).orderBy(asc(users.name));
    return rows.map(toUser);
  }

  async findUser(id: string): Promise<User | undefined> {
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return row ? toUser(row) : undefined;
  }

  async getDefaultUser(): Promise<User> {
    const [row] = await this.db.select().from(users).orderBy(asc(users.createdAt)).limit(1);
    if (row) return toUser(row);
    // Demo mode against an empty database (migrations wipe the seeds):
    // provision the demo identity on first use instead of failing every request.
    return this.upsertUser(DEMO_USER);
  }

  async upsertUser(input: {
    id: string;
    name: string;
    email: string;
    color: string;
  }): Promise<User> {
    const [row] = await this.db
      .insert(users)
      .values(input)
      .onConflictDoUpdate({
        target: users.id,
        set: { name: input.name, email: input.email },
      })
      .returning();
    return toUser(row);
  }

  async dataroomExists(id: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: datarooms.id })
      .from(datarooms)
      .where(eq(datarooms.id, id))
      .limit(1);
    return Boolean(row);
  }

  async nodeBelongsToDataroom(nodeId: string, dataroomId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: nodes.id })
      .from(nodes)
      .where(and(eq(nodes.id, nodeId), eq(nodes.dataroomId, dataroomId), isNull(nodes.deletedAt)))
      .limit(1);
    return Boolean(row);
  }

  async listMembers(dataroomId: string): Promise<MemberRecord[]> {
    const rows = await this.db
      .select({
        dataroomId: dataroomMembers.dataroomId,
        role: dataroomMembers.role,
        addedAt: dataroomMembers.createdAt,
        user: users,
      })
      .from(dataroomMembers)
      .innerJoin(users, eq(dataroomMembers.userId, users.id))
      .where(eq(dataroomMembers.dataroomId, dataroomId))
      .orderBy(asc(dataroomMembers.createdAt));
    return rows.map((row) => ({
      dataroomId: row.dataroomId,
      user: toUser(row.user),
      role: row.role,
      addedAt: row.addedAt.getTime(),
    }));
  }

  async findMemberRole(dataroomId: string, userId: string): Promise<MemberRole | null> {
    const [row] = await this.db
      .select({ role: dataroomMembers.role })
      .from(dataroomMembers)
      .where(and(eq(dataroomMembers.dataroomId, dataroomId), eq(dataroomMembers.userId, userId)))
      .limit(1);
    return row ? row.role : null;
  }

  async countOwners(dataroomId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(dataroomMembers)
      .where(and(eq(dataroomMembers.dataroomId, dataroomId), eq(dataroomMembers.role, 'owner')));
    return row?.count ?? 0;
  }

  async addMember(dataroomId: string, userId: string, role: MemberRole): Promise<MemberRecord> {
    await this.db
      .insert(dataroomMembers)
      .values({ dataroomId, userId, role })
      .onConflictDoNothing({ target: [dataroomMembers.dataroomId, dataroomMembers.userId] });
    const member = (await this.listMembers(dataroomId)).find((row) => row.user.id === userId);
    if (!member) throw new Error('Failed to add member');
    return member;
  }

  async updateMemberRole(
    dataroomId: string,
    userId: string,
    role: MemberRole,
  ): Promise<MemberRecord | undefined> {
    await this.db
      .update(dataroomMembers)
      .set({ role })
      .where(and(eq(dataroomMembers.dataroomId, dataroomId), eq(dataroomMembers.userId, userId)));
    return (await this.listMembers(dataroomId)).find((row) => row.user.id === userId);
  }

  async removeMember(dataroomId: string, userId: string): Promise<void> {
    await this.db
      .delete(dataroomMembers)
      .where(and(eq(dataroomMembers.dataroomId, dataroomId), eq(dataroomMembers.userId, userId)));
  }

  async listFavorites(userId: string): Promise<FavoriteRecord[]> {
    // Only surface favorites the user can still reach: rooms they belong to, and
    // node favorites whose node is still live. Rows for trashed nodes are kept in
    // the table (they return on restore) but hidden here.
    const rows = await this.db
      .select({
        dataroomId: favorites.dataroomId,
        dataroomName: datarooms.name,
        nodeId: favorites.nodeId,
        nodeName: nodes.name,
        nodeType: nodes.type,
        parentId: nodes.parentId,
        createdAt: favorites.createdAt,
      })
      .from(favorites)
      .innerJoin(datarooms, eq(favorites.dataroomId, datarooms.id))
      .innerJoin(
        dataroomMembers,
        and(
          eq(dataroomMembers.dataroomId, favorites.dataroomId),
          eq(dataroomMembers.userId, userId),
        ),
      )
      .leftJoin(nodes, eq(favorites.nodeId, nodes.id))
      .where(
        and(eq(favorites.userId, userId), or(isNull(favorites.nodeId), isNull(nodes.deletedAt))),
      )
      .orderBy(desc(favorites.createdAt));
    return rows.map((row) => ({
      dataroomId: row.dataroomId,
      dataroomName: row.dataroomName,
      nodeId: row.nodeId,
      nodeName: row.nodeName,
      nodeType: row.nodeType as NodeType | null,
      parentId: row.parentId,
      createdAt: row.createdAt.getTime(),
    }));
  }

  async addFavorite(userId: string, target: FavoriteTarget): Promise<FavoriteRecord> {
    await this.db
      .insert(favorites)
      .values({ userId, ...target })
      .onConflictDoNothing();
    const favorite = await this.findFavorite(userId, target);
    if (!favorite) throw new Error('Failed to add favorite');
    return favorite;
  }

  async removeFavorite(userId: string, target: FavoriteTarget): Promise<void> {
    await this.db.delete(favorites).where(favoriteWhere(userId, target));
  }

  async removeFavoritesForNodes(nodeIds: readonly string[]): Promise<void> {
    if (nodeIds.length === 0) return;
    await this.db.delete(favorites).where(inArray(favorites.nodeId, [...nodeIds]));
  }

  async listActivity(
    dataroomId: string,
    options?: { nodeId?: string; limit?: number },
  ): Promise<ActivityRecord[]> {
    const conditions: SQL[] = [eq(activity.dataroomId, dataroomId)];
    if (options?.nodeId) conditions.push(eq(activity.nodeId, options.nodeId));
    const limit = Math.min(Math.max(options?.limit ?? 25, 1), 100);

    const rows = await this.db
      .select({
        id: activity.id,
        dataroomId: activity.dataroomId,
        nodeId: activity.nodeId,
        nodeName: activity.nodeName,
        nodeType: activity.nodeType,
        action: activity.action,
        createdAt: activity.createdAt,
        actor: users,
      })
      .from(activity)
      .innerJoin(users, eq(activity.actorId, users.id))
      .where(and(...conditions))
      .orderBy(desc(activity.createdAt))
      .limit(limit);
    return rows.map((row) => ({
      id: row.id,
      dataroomId: row.dataroomId,
      nodeId: row.nodeId,
      nodeName: row.nodeName,
      nodeType: row.nodeType as NodeType | null,
      action: row.action,
      actor: toUser(row.actor),
      createdAt: row.createdAt.getTime(),
    }));
  }

  async recordActivity(input: RecordActivityInput): Promise<ActivityRecord> {
    const [row] = await this.db.insert(activity).values(input).returning({ id: activity.id });
    const [record] = await this.listActivity(input.dataroomId, { limit: 1 });
    if (!row || !record) throw new Error('Failed to record activity');
    return record;
  }

  async storageUsedBytes(): Promise<number> {
    const [row] = await this.db
      .select({
        usedBytes: sql<number>`coalesce(sum(${nodes.size}), 0)`.mapWith(Number),
      })
      .from(nodes)
      .where(eq(nodes.type, 'file'));
    return row?.usedBytes ?? 0;
  }

  private async findFavorite(
    userId: string,
    target: FavoriteTarget,
  ): Promise<FavoriteRecord | undefined> {
    const favoritesForUser = await this.listFavorites(userId);
    return favoritesForUser.find(
      (favorite) => favorite.dataroomId === target.dataroomId && favorite.nodeId === target.nodeId,
    );
  }
}

function favoriteWhere(userId: string, target: FavoriteTarget): SQL {
  return and(
    eq(favorites.userId, userId),
    eq(favorites.dataroomId, target.dataroomId),
    target.nodeId === null ? isNull(favorites.nodeId) : eq(favorites.nodeId, target.nodeId),
  ) as SQL;
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    color: row.color,
  };
}
