import { Inject, Injectable } from '@nestjs/common';
import { and, asc, datarooms, eq, ilike, isNull, ne, nodes, sql } from '@repo/db';
import type { Database, SQL } from '@repo/db';
import type { Dataroom, DataroomNode, FileNode, FolderNode } from '@repo/domain';
import { DRIZZLE } from '../../../config/database/database.tokens';
import type {
  CreateFileNodeInput,
  CreateFolderInput,
  DataroomsRepository,
  ListNodesOptions,
} from '../domain/datarooms.repository.port';

type DataroomRow = typeof datarooms.$inferSelect;
type NodeRow = typeof nodes.$inferSelect;

/** Metadata persistence only - file bytes live behind BlobStorage. */
@Injectable()
export class DrizzleDataroomsRepository implements DataroomsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async listDatarooms(): Promise<Dataroom[]> {
    const rows = await this.db
      .select()
      .from(datarooms)
      .orderBy(asc(sql`lower(${datarooms.name})`));
    return rows.map(toDataroom);
  }

  async createDataroom(name: string): Promise<Dataroom> {
    const [row] = await this.db.insert(datarooms).values({ name }).returning();
    return toDataroom(expectRow(row, 'Failed to create data room'));
  }

  async findDataroom(id: string): Promise<Dataroom | undefined> {
    const [row] = await this.db.select().from(datarooms).where(eq(datarooms.id, id)).limit(1);
    return row ? toDataroom(row) : undefined;
  }

  async renameDataroom(id: string, name: string): Promise<Dataroom | undefined> {
    const [row] = await this.db
      .update(datarooms)
      .set({ name, updatedAt: new Date() })
      .where(eq(datarooms.id, id))
      .returning();
    return row ? toDataroom(row) : undefined;
  }

  async deleteDataroom(id: string): Promise<void> {
    await this.db.delete(datarooms).where(eq(datarooms.id, id));
  }

  async listNodes(dataroomId: string, options?: ListNodesOptions): Promise<DataroomNode[]> {
    const conditions: SQL[] = [eq(nodes.dataroomId, dataroomId)];
    if (options?.nameContains) {
      conditions.push(ilike(nodes.name, `%${options.nameContains}%`));
    }

    const rows = await this.db
      .select()
      .from(nodes)
      .where(and(...conditions));
    return rows.map(toNode);
  }

  async findNode(id: string): Promise<DataroomNode | undefined> {
    const [row] = await this.db.select().from(nodes).where(eq(nodes.id, id)).limit(1);
    return row ? toNode(row) : undefined;
  }

  async createFolder(input: CreateFolderInput): Promise<FolderNode> {
    const [row] = await this.db
      .insert(nodes)
      .values({
        dataroomId: input.dataroomId,
        parentId: input.parentId,
        type: 'folder',
        name: input.name,
      })
      .returning();
    const node = toNode(expectRow(row, 'Failed to create folder'));
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
      })
      .returning();
    const node = toNode(expectRow(row, 'Failed to create file node'));
    if (node.type !== 'file') throw new Error('Created node is not a file');
    return node;
  }

  async renameNode(id: string, name: string): Promise<DataroomNode | undefined> {
    const [row] = await this.db
      .update(nodes)
      .set({ name, updatedAt: new Date() })
      .where(eq(nodes.id, id))
      .returning();
    return row ? toNode(row) : undefined;
  }

  async deleteNode(id: string): Promise<void> {
    await this.db.delete(nodes).where(eq(nodes.id, id));
  }

  async siblingNames(
    dataroomId: string,
    parentId: string | null,
    excludeId?: string,
  ): Promise<string[]> {
    const conditions: SQL[] = [
      eq(nodes.dataroomId, dataroomId),
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
  };
}

function toNode(row: NodeRow): DataroomNode {
  const base = {
    id: row.id,
    dataroomId: row.dataroomId,
    parentId: row.parentId,
    name: row.name,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };

  if (row.type === 'folder') return { ...base, type: 'folder' };
  if (row.size === null) throw new Error(`File node ${row.id} is missing size`);
  return { ...base, type: 'file', size: row.size };
}

function expectRow<T>(row: T | undefined, message: string): T {
  if (!row) throw new Error(message);
  return row;
}
