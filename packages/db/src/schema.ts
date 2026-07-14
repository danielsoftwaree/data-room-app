import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  customType,
  index,
  pgTable,
  primaryKey,
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

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  color: text('color').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const datarooms = pgTable(
  'datarooms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [
    // Names are unique per creator, not globally: one user's room name must not
    // block another user (who cannot even see that room) from reusing it.
    uniqueIndex('datarooms_owner_name_lower_unique').on(table.createdBy, sql`lower(${table.name})`),
  ],
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
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [
    check('nodes_type_check', sql`${table.type} IN ('folder', 'file')`),
    check(
      'nodes_size_matches_type_check',
      sql`(${table.type} = 'folder' AND ${table.size} IS NULL) OR (${table.type} = 'file' AND ${table.size} IS NOT NULL)`,
    ),
    index('nodes_dataroom_id_idx').on(table.dataroomId),
    index('nodes_parent_id_idx').on(table.parentId),
    index('nodes_deleted_idx')
      .on(table.dataroomId)
      .where(sql`${table.deletedAt} IS NOT NULL`),
    // Name uniqueness applies only to live nodes: a name freed by trashing must be
    // reusable, and two same-named files can coexist in the trash.
    uniqueIndex('nodes_root_name_unique')
      .on(table.dataroomId, sql`lower(${table.name})`)
      .where(sql`${table.parentId} IS NULL AND ${table.deletedAt} IS NULL`),
    uniqueIndex('nodes_child_name_unique')
      .on(table.dataroomId, table.parentId, sql`lower(${table.name})`)
      .where(sql`${table.parentId} IS NOT NULL AND ${table.deletedAt} IS NULL`),
  ],
);

export const fileBlobs = pgTable('file_blobs', {
  nodeId: uuid('node_id')
    .primaryKey()
    .references(() => nodes.id, { onDelete: 'cascade' }),
  content: bytea('content').notNull(),
  contentType: text('content_type').notNull(),
});

export const nodeShares = pgTable(
  'node_shares',
  {
    // One share per node (file or folder): the node id is the primary key. Cascade
    // drops the share when the node is purged; a soft-deleted (trashed) node keeps
    // its row, so the link revives on restore — the service hides it while trashed.
    nodeId: uuid('node_id')
      .primaryKey()
      .references(() => nodes.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    // Null = anyone with the link can open the share without a password.
    passwordHash: text('password_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [uniqueIndex('node_shares_slug_unique').on(table.slug)],
);

export const dataroomMembers = pgTable(
  'dataroom_members',
  {
    dataroomId: uuid('dataroom_id')
      .notNull()
      .references(() => datarooms.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['owner', 'editor', 'viewer'] }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.dataroomId, table.userId] }),
    check('dataroom_members_role_check', sql`${table.role} IN ('owner', 'editor', 'viewer')`),
    index('dataroom_members_user_id_idx').on(table.userId),
  ],
);

export const favorites = pgTable(
  'favorites',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    dataroomId: uuid('dataroom_id')
      .notNull()
      .references(() => datarooms.id, { onDelete: 'cascade' }),
    nodeId: uuid('node_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('favorites_room_unique')
      .on(table.userId, table.dataroomId)
      .where(sql`${table.nodeId} IS NULL`),
    uniqueIndex('favorites_node_unique')
      .on(table.userId, table.dataroomId, table.nodeId)
      .where(sql`${table.nodeId} IS NOT NULL`),
    index('favorites_user_id_idx').on(table.userId),
  ],
);

export const activity = pgTable(
  'activity',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dataroomId: uuid('dataroom_id')
      .notNull()
      .references(() => datarooms.id, { onDelete: 'cascade' }),
    nodeId: uuid('node_id'),
    nodeName: text('node_name'),
    nodeType: text('node_type', { enum: ['folder', 'file'] }),
    action: text('action', {
      enum: [
        'dataroom.created',
        'folder.created',
        'file.uploaded',
        'node.renamed',
        'node.moved',
        'node.deleted',
        'node.restored',
        'member.added',
        'member.updated',
        'member.removed',
        'share.created',
        'share.removed',
      ],
    }).notNull(),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'activity_node_type_check',
      sql`${table.nodeType} IS NULL OR ${table.nodeType} IN ('folder', 'file')`,
    ),
    check(
      'activity_action_check',
      sql`${table.action} IN ('dataroom.created', 'folder.created', 'file.uploaded', 'node.renamed', 'node.moved', 'node.deleted', 'node.restored', 'member.added', 'member.updated', 'member.removed', 'share.created', 'share.removed')`,
    ),
    index('activity_dataroom_created_at_idx').on(table.dataroomId, table.createdAt),
    index('activity_node_id_idx').on(table.nodeId),
  ],
);
