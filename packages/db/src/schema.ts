import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  customType,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

export const datarooms = pgTable(
  'datarooms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('datarooms_name_lower_unique').on(sql`lower(${table.name})`)],
);

export const nodes = pgTable(
  'nodes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dataroomId: uuid('dataroom_id')
      .notNull()
      .references(() => datarooms.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id').references((): AnyPgColumn => nodes.id, {
      onDelete: 'cascade',
    }),
    type: text('type', { enum: ['folder', 'file'] }).notNull(),
    name: text('name').notNull(),
    size: bigint('size', { mode: 'number' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('nodes_type_check', sql`${table.type} IN ('folder', 'file')`),
    check(
      'nodes_size_matches_type_check',
      sql`(${table.type} = 'folder' AND ${table.size} IS NULL) OR (${table.type} = 'file' AND ${table.size} IS NOT NULL)`,
    ),
    index('nodes_dataroom_id_idx').on(table.dataroomId),
    index('nodes_parent_id_idx').on(table.parentId),
    uniqueIndex('nodes_root_name_unique')
      .on(table.dataroomId, sql`lower(${table.name})`)
      .where(sql`${table.parentId} IS NULL`),
    uniqueIndex('nodes_child_name_unique')
      .on(table.dataroomId, table.parentId, sql`lower(${table.name})`)
      .where(sql`${table.parentId} IS NOT NULL`),
  ],
);

export const fileBlobs = pgTable('file_blobs', {
  nodeId: uuid('node_id')
    .primaryKey()
    .references(() => nodes.id, { onDelete: 'cascade' }),
  content: bytea('content').notNull(),
  contentType: text('content_type').notNull(),
});
