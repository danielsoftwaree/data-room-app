/**
 * Pure domain model for the Data Room.
 * No React, no Nest, no browser APIs, no storage clients.
 */

export type NodeType = 'folder' | 'file';

export interface Dataroom {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  color: string;
}

export type MemberRole = 'owner' | 'editor' | 'viewer';

export interface DataroomMember {
  dataroomId: string;
  user: User;
  role: MemberRole;
  addedAt: number;
}

const ROLE_RANK: Record<MemberRole, number> = { viewer: 0, editor: 1, owner: 2 };

/** True when `role` grants at least the access of `min` (viewer < editor < owner). */
export function roleAtLeast(role: MemberRole, min: MemberRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export type ActivityAction =
  | 'dataroom.created'
  | 'folder.created'
  | 'file.uploaded'
  | 'node.renamed'
  | 'node.moved'
  | 'node.deleted'
  | 'node.restored'
  | 'member.added'
  | 'member.updated'
  | 'member.removed';

export interface ActivityEntry {
  id: string;
  dataroomId: string;
  nodeId: string | null;
  nodeName: string | null;
  nodeType: NodeType | null;
  action: ActivityAction;
  actorId: string;
  createdAt: number;
}

interface BaseNode {
  id: string;
  dataroomId: string;
  /** null = direct child of the dataroom root */
  parentId: string | null;
  name: string;
  createdAt: number;
  updatedAt: number;
  createdBy: string | null;
  updatedBy: string | null;
  /** epoch ms when the node was moved to trash, or null when live */
  deletedAt: number | null;
  deletedBy: string | null;
}

export interface FolderNode extends BaseNode {
  type: 'folder';
}

export interface FileNode extends BaseNode {
  type: 'file';
  /** size in bytes */
  size: number;
}

export type DataroomNode = FolderNode | FileNode;

export const NODE_NAME_MAX_LENGTH = 255;

/** Characters not allowed in node names (mirrors common FS rules, keeps UX predictable). */
const INVALID_NAME_CHARS = /[\\/:*?"<>|]/;

export type NameValidationError = 'empty' | 'too-long' | 'invalid-chars';

export type NameValidationResult =
  { ok: true; name: string } | { ok: false; error: NameValidationError };

/** Trims and validates a folder/file name. */
export function validateNodeName(raw: string): NameValidationResult {
  const name = raw.trim();
  if (name.length === 0) return { ok: false, error: 'empty' };
  if (name.length > NODE_NAME_MAX_LENGTH) return { ok: false, error: 'too-long' };
  if (INVALID_NAME_CHARS.test(name)) return { ok: false, error: 'invalid-chars' };
  return { ok: true, name };
}

/**
 * Resolves a duplicate name against existing sibling names:
 * "file.pdf" -> "file (1).pdf" -> "file (2).pdf", case-insensitive.
 */
export function nextAvailableName(existing: readonly string[], desired: string): string {
  const taken = new Set(existing.map((n) => n.toLowerCase()));
  if (!taken.has(desired.toLowerCase())) return desired;

  const dot = desired.lastIndexOf('.');
  const stem = dot > 0 ? desired.slice(0, dot) : desired;
  const ext = dot > 0 ? desired.slice(dot) : '';

  for (let i = 1; ; i++) {
    const candidate = `${stem} (${i})${ext}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

/** Case-insensitive duplicate check within one folder. */
export function isNameTaken(existing: readonly string[], name: string): boolean {
  const target = name.trim().toLowerCase();
  return existing.some((n) => n.toLowerCase() === target);
}

/** Standard listing order: folders first, then files, each alphabetically. */
export function sortNodes<T extends { type: NodeType; name: string }>(nodes: readonly T[]): T[] {
  return [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

/**
 * Collects ids of a node and all of its descendants (for cascade delete / counts).
 * Accepts the flat node list of one dataroom.
 */
export function collectSubtreeIds(
  nodes: readonly Pick<DataroomNode, 'id' | 'parentId'>[],
  rootId: string,
): string[] {
  const childrenByParent = new Map<string | null, string[]>();
  for (const n of nodes) {
    const list = childrenByParent.get(n.parentId) ?? [];
    list.push(n.id);
    childrenByParent.set(n.parentId, list);
  }
  const result: string[] = [];
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    result.push(id);
    for (const child of childrenByParent.get(id) ?? []) stack.push(child);
  }
  return result;
}

/**
 * From a flat list of trashed nodes (one or more datarooms), returns only the
 * subtree "roots" — a trashed node whose parent is null, absent from the list,
 * or itself not trashed. This is what a Trash screen lists: one entry per
 * top-level trashed item, not every descendant that was marked alongside it.
 */
export function selectTrashRoots<
  T extends { id: string; parentId: string | null; deletedAt: number | null },
>(nodes: readonly T[]): T[] {
  const deletedIds = new Set(nodes.filter((n) => n.deletedAt !== null).map((n) => n.id));
  return nodes.filter(
    (n) => n.deletedAt !== null && (n.parentId === null || !deletedIds.has(n.parentId)),
  );
}

export type MoveValidationError =
  | 'node-not-found'
  | 'target-not-found'
  | 'target-not-folder'
  | 'target-cross-dataroom'
  | 'target-is-self'
  | 'target-is-descendant';

export type MoveValidationResult =
  { ok: true; parentId: string | null } | { ok: false; error: MoveValidationError };

/** Validates that a node can be moved to a root/folder target without creating cycles. */
export function validateMoveTarget(
  nodes: readonly DataroomNode[],
  nodeId: string,
  targetParentId: string | null,
): MoveValidationResult {
  const node = nodes.find((candidate) => candidate.id === nodeId);
  if (!node) return { ok: false, error: 'node-not-found' };
  if (targetParentId === null) return { ok: true, parentId: null };
  if (targetParentId === nodeId) return { ok: false, error: 'target-is-self' };

  const target = nodes.find((candidate) => candidate.id === targetParentId);
  if (!target) return { ok: false, error: 'target-not-found' };
  if (target.dataroomId !== node.dataroomId) return { ok: false, error: 'target-cross-dataroom' };
  if (target.type !== 'folder') return { ok: false, error: 'target-not-folder' };

  const subtree = collectSubtreeIds(nodes, nodeId);
  if (subtree.includes(targetParentId)) return { ok: false, error: 'target-is-descendant' };

  return { ok: true, parentId: targetParentId };
}
