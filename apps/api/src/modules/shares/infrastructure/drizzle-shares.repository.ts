import { Inject, Injectable } from '@nestjs/common';
import { eq, nodeShares } from '@repo/db';
import type { Database, DatabaseExecutor } from '@repo/db';
import { DRIZZLE } from '../../../config/database/database.tokens';
import { transactionContext } from '../../../shared/database/transaction';
import type {
  InsertShareInput,
  NodeShare,
  SharesRepository,
} from '../domain/shares.repository.port';

type ShareRow = typeof nodeShares.$inferSelect;

@Injectable()
export class DrizzleSharesRepository implements SharesRepository {
  constructor(@Inject(DRIZZLE) private readonly database: Database) {}

  /** The ambient transaction when a TransactionRunner.run is active, else the pool. */
  private get db(): DatabaseExecutor {
    return transactionContext.current() ?? this.database;
  }

  async findByNodeId(nodeId: string): Promise<NodeShare | undefined> {
    const [row] = await this.db
      .select()
      .from(nodeShares)
      .where(eq(nodeShares.nodeId, nodeId))
      .limit(1);
    return row ? toShare(row) : undefined;
  }

  async findBySlug(slug: string): Promise<NodeShare | undefined> {
    const [row] = await this.db.select().from(nodeShares).where(eq(nodeShares.slug, slug)).limit(1);
    return row ? toShare(row) : undefined;
  }

  async insert(input: InsertShareInput): Promise<NodeShare> {
    const [row] = await this.db
      .insert(nodeShares)
      .values({
        nodeId: input.nodeId,
        slug: input.slug,
        passwordHash: input.passwordHash,
        createdBy: input.userId,
      })
      .returning();
    if (!row) throw new Error('Failed to create share link');
    return toShare(row);
  }

  async updatePasswordHash(
    nodeId: string,
    passwordHash: string | null,
  ): Promise<NodeShare | undefined> {
    const [row] = await this.db
      .update(nodeShares)
      .set({ passwordHash })
      .where(eq(nodeShares.nodeId, nodeId))
      .returning();
    return row ? toShare(row) : undefined;
  }

  async delete(nodeId: string): Promise<boolean> {
    const rows = await this.db
      .delete(nodeShares)
      .where(eq(nodeShares.nodeId, nodeId))
      .returning({ nodeId: nodeShares.nodeId });
    return rows.length > 0;
  }
}

function toShare(row: ShareRow): NodeShare {
  return {
    nodeId: row.nodeId,
    slug: row.slug,
    passwordHash: row.passwordHash,
    createdAt: row.createdAt.getTime(),
    createdBy: row.createdBy,
  };
}
