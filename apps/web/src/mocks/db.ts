/**
 * Stateful in-memory store backing the dev mock API (MSW).
 * It mirrors the Nest API closely enough that the app can run zero-config
 * without hand-written client branches.
 */
import { faker } from '@faker-js/faker';
import { STORAGE_QUOTA_BYTES, UPLOAD } from '@repo/config';
import type {
  DataroomDto,
  EmptyTrashResult,
  NodeShareStateDto,
  ShareDto,
  SharedChildDto,
  SharedNodeDto,
  TrashItemDto,
} from '@repo/contracts';
import type {
  ActivityAction,
  Dataroom,
  DataroomMember,
  DataroomNode,
  FileNode,
  FolderNode,
  MemberRole,
  User,
} from '@repo/domain';
import {
  collectSubtreeIds,
  isNameTaken,
  NODE_NAME_ERROR_MESSAGES,
  nextAvailableName,
  roleAtLeast,
  selectTrashRoots,
  SHARE_PASSWORD_ERROR_MESSAGES,
  sortNodes,
  validateMoveTarget,
  validateNodeName,
  validateSharePassword,
} from '@repo/domain';
import { makePdfBytes } from './pdf';
import {
  clearPersistedState,
  loadPersistedState,
  savePersistedState,
  type PersistedActivity,
  type PersistedFavorite,
  type PersistedFile,
  type PersistedMember,
  type PersistedShare,
} from './persist';

export class MockError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** Overrides the status→code default so responses match the API's error codes. */
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'MockError';
  }
}

const DEMO_USERS: User[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Jane Smith',
    email: 'jane@acme.com',
    color: '#5865f2',
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    name: 'Mark Reynolds',
    email: 'mark@acme.com',
    color: '#35ed7e',
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    name: 'Alex Kim',
    email: 'alex@acme.com',
    color: '#a78bfa',
  },
  {
    id: '00000000-0000-4000-8000-000000000004',
    name: 'Chris Lee',
    email: 'chris@acme.com',
    color: '#f6c956',
  },
  {
    id: '00000000-0000-4000-8000-000000000005',
    name: 'Priya Shah',
    email: 'priya@acme.com',
    color: '#ec48bd',
  },
  {
    id: '00000000-0000-4000-8000-000000000006',
    name: 'Noah Garcia',
    email: 'noah@acme.com',
    color: '#00b0f4',
  },
];

const datarooms: Dataroom[] = [];
const nodes: DataroomNode[] = [];
const members: PersistedMember[] = [];
const favorites: PersistedFavorite[] = [];
const activity: PersistedActivity[] = [];
const shares: PersistedShare[] = [];
const fileContents = new Map<string, PersistedFile>();

const FAKER_SEED = 20260704;
const CLOCK_START = new Date('2026-06-01T09:00:00Z').getTime();

faker.seed(FAKER_SEED);
let clock = CLOCK_START;

// While seeding, node creation skips the editor-role check: the seed represents
// historical uploads by people who had access at the time, not live requests.
let seeding = false;

function tick(): number {
  clock += faker.number.int({ min: 60_000, max: 6 * 3_600_000 });
  return clock;
}

function uid(): string {
  return crypto.randomUUID();
}

function requireName(raw: string): string {
  const result = validateNodeName(raw);
  if (!result.ok) throw new MockError(400, NODE_NAME_ERROR_MESSAGES[result.error]);
  return result.name;
}

function persist(): void {
  savePersistedState({
    datarooms,
    nodes,
    members,
    favorites,
    activity,
    shares,
    files: [...fileContents.entries()],
    clock,
  });
}

export function resolveUserId(rawUserId: string | null | undefined): string {
  const requested = rawUserId?.trim();
  return requested && DEMO_USERS.some((user) => user.id === requested)
    ? requested
    : DEMO_USERS[0].id;
}

export function getMe(rawUserId: string | null | undefined): User {
  return getUser(resolveUserId(rawUserId));
}

export function listUsers(): User[] {
  return [...DEMO_USERS].sort((a, b) => a.name.localeCompare(b.name));
}

// --- Access control (mirrors WorkspaceService.assert* on the real API) ---

function roleOf(dataroomId: string, userId: string): MemberRole | null {
  return members.find((m) => m.dataroomId === dataroomId && m.userId === userId)?.role ?? null;
}

/** A non-member gets a 404 (never a 403) so hidden rooms stay hidden. */
function requireMember(dataroomId: string, userId: string): MemberRole {
  const role = roleOf(dataroomId, userId);
  if (!role) throw new MockError(404, 'Data room not found');
  return role;
}

function requireRole(dataroomId: string, userId: string, min: MemberRole): MemberRole {
  const role = requireMember(dataroomId, userId);
  if (!roleAtLeast(role, min)) throw new MockError(403, `This action requires ${min} access`);
  return role;
}

function countOwners(dataroomId: string): number {
  return members.filter((m) => m.dataroomId === dataroomId && m.role === 'owner').length;
}

/** Existence-only lookup for internal use (favorites, activity denormalization). */
function requireDataroom(id: string): Dataroom {
  const dataroom = datarooms.find((d) => d.id === id);
  if (!dataroom) throw new MockError(404, 'Data room not found');
  return dataroom;
}

function toDataroomDto(dataroom: Dataroom, myRole: MemberRole): DataroomDto {
  const roomMembers = members.filter((m) => m.dataroomId === dataroom.id);
  const ownerMember = roomMembers
    .filter((m) => m.role === 'owner')
    .sort((a, b) => a.createdAt - b.createdAt)[0];
  return {
    ...dataroom,
    myRole,
    memberCount: roomMembers.length,
    owner: ownerMember ? getUser(ownerMember.userId) : null,
  };
}

export function listDatarooms(userId: string): DataroomDto[] {
  return datarooms
    .map((dataroom) => {
      const role = roleOf(dataroom.id, userId);
      return role ? toDataroomDto(dataroom, role) : null;
    })
    .filter((dto): dto is DataroomDto => dto !== null)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getDataroom(id: string, userId: string): DataroomDto {
  const role = requireMember(id, userId);
  return toDataroomDto(requireDataroom(id), role);
}

export function createDataroom(rawName: string, userId: string): DataroomDto {
  const name = requireName(rawName);
  if (
    isNameTaken(
      datarooms.map((d) => d.name),
      name,
    )
  ) {
    throw new MockError(409, `A data room named "${name}" already exists`);
  }
  const ts = tick();
  const dataroom: Dataroom = {
    id: uid(),
    name,
    createdAt: ts,
    updatedAt: ts,
    createdBy: userId,
    updatedBy: userId,
  };
  datarooms.push(dataroom);
  addMemberInternal(dataroom.id, userId, 'owner', ts);
  recordActivityInternal({
    dataroomId: dataroom.id,
    nodeId: null,
    nodeName: null,
    nodeType: null,
    action: 'dataroom.created',
    actorId: userId,
    createdAt: ts,
  });
  persist();
  return toDataroomDto(dataroom, 'owner');
}

export function renameDataroom(id: string, rawName: string, userId: string): DataroomDto {
  const role = requireRole(id, userId, 'owner');
  const dataroom = requireDataroom(id);
  const name = requireName(rawName);
  const others = datarooms.filter((d) => d.id !== id).map((d) => d.name);
  if (isNameTaken(others, name)) {
    throw new MockError(409, `A data room named "${name}" already exists`);
  }
  dataroom.name = name;
  dataroom.updatedAt = tick();
  dataroom.updatedBy = userId;
  persist();
  return toDataroomDto(dataroom, role);
}

export function deleteDataroom(id: string, userId: string): { deletedNodeIds: string[] } {
  requireRole(id, userId, 'owner');
  const deletedNodeIds = nodes.filter((n) => n.dataroomId === id).map((n) => n.id);
  removeNodes(new Set(deletedNodeIds));
  removeWhere(members, (member) => member.dataroomId === id);
  removeWhere(favorites, (favorite) => favorite.dataroomId === id);
  removeWhere(activity, (entry) => entry.dataroomId === id);
  removeWhere(datarooms, (dataroom) => dataroom.id === id);
  persist();
  return { deletedNodeIds };
}

export function listNodes(
  dataroomId: string,
  userId: string,
  options: { nameContains?: string | null } = {},
): DataroomNode[] {
  requireMember(dataroomId, userId);
  const term = options.nameContains?.trim().toLocaleLowerCase();
  return sortNodes(
    liveNodes().filter(
      (n) => n.dataroomId === dataroomId && (!term || n.name.toLocaleLowerCase().includes(term)),
    ),
  );
}

export function createFolder(
  dataroomId: string,
  parentId: string | null,
  rawName: string,
  userId: string,
): FolderNode {
  if (!seeding) requireRole(dataroomId, userId, 'editor');
  assertParentFolder(dataroomId, parentId);
  const name = requireName(rawName);
  if (isNameTaken(siblingNames(dataroomId, parentId), name)) {
    throw new MockError(409, `"${name}" already exists in this folder`);
  }
  const ts = tick();
  const folder: FolderNode = {
    id: uid(),
    dataroomId,
    parentId,
    type: 'folder',
    name,
    createdAt: ts,
    updatedAt: ts,
    createdBy: userId,
    updatedBy: userId,
    deletedAt: null,
    deletedBy: null,
    shareSlug: null,
  };
  nodes.push(folder);
  touchDataroom(dataroomId, ts, userId);
  recordNodeActivity(folder, 'folder.created', userId, ts);
  persist();
  return folder;
}

export function createFile(
  dataroomId: string,
  parentId: string | null,
  upload:
    { originalName: string; size: number; contentType: string; bytes: Uint8Array } | undefined,
  userId: string,
): FileNode {
  if (!seeding) requireRole(dataroomId, userId, 'editor');
  assertParentFolder(dataroomId, parentId);
  assertPdfUpload(upload);

  const desired = requireName(upload.originalName);
  const name = nextAvailableName(siblingNames(dataroomId, parentId), desired);
  const ts = tick();
  const file: FileNode = {
    id: uid(),
    dataroomId,
    parentId,
    type: 'file',
    name,
    size: upload.size,
    createdAt: ts,
    updatedAt: ts,
    createdBy: userId,
    updatedBy: userId,
    deletedAt: null,
    deletedBy: null,
    shareSlug: null,
  };
  nodes.push(file);
  fileContents.set(file.id, { contentType: 'application/pdf', bytes: upload.bytes });
  touchDataroom(dataroomId, ts, userId);
  recordNodeActivity(file, 'file.uploaded', userId, ts);
  persist();
  return file;
}

export function renameNode(id: string, rawName: string, userId: string): DataroomNode {
  const node = getLiveNode(id);
  requireRole(node.dataroomId, userId, 'editor');
  const name = requireName(rawName);
  if (isNameTaken(siblingNames(node.dataroomId, node.parentId, node.id), name)) {
    throw new MockError(409, `"${name}" already exists in this folder`);
  }
  node.name = name;
  node.updatedAt = tick();
  node.updatedBy = userId;
  touchDataroom(node.dataroomId, node.updatedAt, userId);
  recordNodeActivity(node, 'node.renamed', userId, node.updatedAt);
  persist();
  return node;
}

export function moveNode(id: string, parentId: string | null, userId: string): DataroomNode {
  const node = getLiveNode(id);
  requireRole(node.dataroomId, userId, 'editor');
  const dataroomNodes = liveNodes().filter((candidate) => candidate.dataroomId === node.dataroomId);
  const validation = validateMoveTarget(dataroomNodes, id, parentId);
  if (!validation.ok) throw moveError(validation.error);
  node.name = nextAvailableName(siblingNames(node.dataroomId, parentId, node.id), node.name);
  node.parentId = parentId;
  node.updatedAt = tick();
  node.updatedBy = userId;
  touchDataroom(node.dataroomId, node.updatedAt, userId);
  recordNodeActivity(node, 'node.moved', userId, node.updatedAt);
  persist();
  return node;
}

/** Move a node and its subtree to the trash. Blobs and favorites are kept. */
export function deleteNode(id: string, userId: string): { deletedIds: string[] } {
  const node = getLiveNode(id);
  requireRole(node.dataroomId, userId, 'editor');
  const deletedIds = collectSubtreeIds(
    liveNodes().filter((n) => n.dataroomId === node.dataroomId),
    id,
  );
  const ts = tick();
  const deletedIdSet = new Set(deletedIds);
  for (const candidate of nodes) {
    if (deletedIdSet.has(candidate.id)) {
      candidate.deletedAt = ts;
      candidate.deletedBy = userId;
    }
  }
  recordNodeActivity(node, 'node.deleted', userId, ts);
  touchDataroom(node.dataroomId, ts, userId);
  persist();
  return { deletedIds };
}

/** Bring a trashed subtree back — to its parent, or the room root if that is gone. */
export function restoreNode(id: string, userId: string): DataroomNode {
  const node = getAnyNode(id);
  if (node.deletedAt === null) throw new MockError(404, 'Trashed item not found');
  requireRole(node.dataroomId, userId, 'editor');

  const parent = node.parentId ? nodes.find((n) => n.id === node.parentId) : null;
  const targetParentId = parent && parent.deletedAt === null ? node.parentId : null;
  const name = nextAvailableName(siblingNames(node.dataroomId, targetParentId, node.id), node.name);

  const subtreeIds = new Set(
    collectSubtreeIds(
      nodes.filter((n) => n.dataroomId === node.dataroomId && n.deletedAt !== null),
      id,
    ),
  );
  const ts = tick();
  for (const candidate of nodes) {
    if (subtreeIds.has(candidate.id)) {
      candidate.deletedAt = null;
      candidate.deletedBy = null;
    }
  }
  node.parentId = targetParentId;
  node.name = name;
  node.updatedAt = ts;
  node.updatedBy = userId;
  touchDataroom(node.dataroomId, ts, userId);
  recordNodeActivity(node, 'node.restored', userId, ts);
  persist();
  return node;
}

/** Permanently delete a trashed subtree: rows, favorites, and blobs. */
export function purgeNode(id: string, userId: string): { deletedIds: string[] } {
  const node = getAnyNode(id);
  if (node.deletedAt === null) throw new MockError(404, 'Trashed item not found');
  requireRole(node.dataroomId, userId, 'editor');
  const deletedIds = collectSubtreeIds(
    nodes.filter((n) => n.dataroomId === node.dataroomId && n.deletedAt !== null),
    id,
  );
  removeNodes(new Set(deletedIds));
  touchDataroom(node.dataroomId, tick(), userId);
  persist();
  return { deletedIds };
}

export function listTrash(userId: string): TrashItemDto[] {
  const roomRole = new Map(
    members.filter((m) => m.userId === userId).map((m) => [m.dataroomId, m.role] as const),
  );
  const deleted = nodes.filter((n) => n.deletedAt !== null && roomRole.has(n.dataroomId));
  return selectTrashRoots(deleted)
    .map((root) => {
      const room = datarooms.find((d) => d.id === root.dataroomId);
      const myRole = roomRole.get(root.dataroomId);
      if (!room || !myRole) return null;
      const itemCount = collectSubtreeIds(deleted, root.id).length - 1;
      return {
        id: root.id,
        dataroomId: root.dataroomId,
        dataroomName: room.name,
        parentId: root.parentId,
        type: root.type,
        name: root.name,
        size: root.type === 'file' ? root.size : null,
        deletedAt: root.deletedAt ?? 0,
        deletedBy: root.deletedBy ? getUser(root.deletedBy) : null,
        itemCount,
        myRole,
      } satisfies TrashItemDto;
    })
    .filter((item): item is TrashItemDto => item !== null)
    .sort((a, b) => b.deletedAt - a.deletedAt);
}

export function emptyTrash(userId: string): EmptyTrashResult {
  const editableRooms = new Set(
    members
      .filter((m) => m.userId === userId && roleAtLeast(m.role, 'editor'))
      .map((m) => m.dataroomId),
  );
  const deleted = nodes.filter((n) => n.deletedAt !== null && editableRooms.has(n.dataroomId));
  const deletedIds: string[] = [];
  for (const root of selectTrashRoots(deleted)) {
    deletedIds.push(...collectSubtreeIds(deleted, root.id));
  }
  removeNodes(new Set(deletedIds));
  persist();
  return { deletedIds };
}

export function getFileContent(
  id: string,
  userId: string,
): {
  name: string;
  contentType: string;
  bytes: Uint8Array;
} {
  const node = nodes.find((n) => n.id === id);
  const stored = fileContents.get(id);
  if (!node || node.type !== 'file' || node.deletedAt !== null || !stored) {
    throw new MockError(404, 'File not found');
  }
  requireMember(node.dataroomId, userId);
  return { name: node.name, contentType: stored.contentType, bytes: stored.bytes };
}

// --- Public share links (mirrors ShareService on the real API) ---

function shareSlug(): string {
  // URL-safe, unguessable. crypto.randomUUID is plenty of entropy for a mock.
  return crypto.randomUUID().replace(/-/g, '');
}

/** The shareable node for a management call: live (file or folder) and editor-gated. */
function requireShareableNode(nodeId: string, userId: string): DataroomNode {
  const node = getLiveNode(nodeId);
  requireRole(node.dataroomId, userId, 'editor');
  return node;
}

function toShareDto(share: PersistedShare): ShareDto {
  return { slug: share.slug, createdAt: share.createdAt, hasPassword: share.password !== null };
}

/**
 * Creates a node's public share link, or changes its password. Creating mints a
 * fresh slug; changing the password KEEPS the existing slug (and createdAt), so
 * links already handed out keep working. A null/absent password makes the link
 * open anonymously.
 */
export function upsertShare(
  nodeId: string,
  rawPassword: string | null | undefined,
  userId: string,
): ShareDto {
  const node = requireShareableNode(nodeId, userId);
  let password: string | null = null;
  if (rawPassword != null && rawPassword !== '') {
    const validation = validateSharePassword(rawPassword);
    if (!validation.ok) throw new MockError(400, SHARE_PASSWORD_ERROR_MESSAGES[validation.error]);
    password = validation.password;
  }

  const existing = shares.find((share) => share.nodeId === nodeId);
  if (existing) {
    existing.password = password;
    node.shareSlug = existing.slug;
    persist();
    return toShareDto(existing);
  }

  const ts = tick();
  const share: PersistedShare = {
    nodeId,
    slug: shareSlug(),
    password,
    createdAt: ts,
  };
  shares.push(share);
  node.shareSlug = share.slug;
  recordNodeActivity(node, 'share.created', userId, ts);
  persist();
  return toShareDto(share);
}

export function getNodeShare(nodeId: string, userId: string): NodeShareStateDto {
  const node = getLiveNode(nodeId);
  requireMember(node.dataroomId, userId);
  const share = shares.find((candidate) => candidate.nodeId === nodeId);
  return { share: share ? toShareDto(share) : null };
}

/** Removes a node's share link. Idempotent: removing an absent link is a no-op. */
export function removeShare(nodeId: string, userId: string): void {
  const node = requireShareableNode(nodeId, userId);
  const existing = shares.find((share) => share.nodeId === nodeId);
  if (!existing) return;
  removeWhere(shares, (share) => share.nodeId === nodeId);
  node.shareSlug = null;
  recordNodeActivity(node, 'share.removed', userId, tick());
  persist();
}

/**
 * Resolves a public slug to its live node. A trashed node (or an unknown slug)
 * is indistinguishable from "no such link" on purpose — the public surface
 * never reveals whether a node exists but is hidden.
 */
function requireSharedNode(slug: string): { share: PersistedShare; node: DataroomNode } {
  const share = shares.find((candidate) => candidate.slug === slug);
  const node = share ? nodes.find((candidate) => candidate.id === share.nodeId) : null;
  if (!share || !node || node.deletedAt !== null) {
    throw new MockError(404, 'Share link not found', 'SHARE_NOT_FOUND');
  }
  return { share, node };
}

// Failed-unlock throttle per slug, mirroring the API's rate limiter. In-memory
// only (real wall-clock, resets on reload) — deliberate for a dev mock.
const RATE_LIMIT_MAX_FAILURES = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const failedUnlockTimes = new Map<string, number[]>();

/**
 * 429 after too many wrong passwords, 401 on a wrong one; success clears the
 * count. A passwordless share always passes; a missing-but-required password is
 * a distinct 401 (the UI's anonymous probe) that never counts as a failure.
 */
function checkSharePassword(share: PersistedShare, password: string | null | undefined): void {
  if (share.password === null) return;
  if (password == null || password === '') {
    throw new MockError(401, 'Password required', 'SHARE_PASSWORD_REQUIRED');
  }
  const now = Date.now();
  const recent = (failedUnlockTimes.get(share.slug) ?? []).filter(
    (at) => now - at < RATE_LIMIT_WINDOW_MS,
  );
  if (recent.length >= RATE_LIMIT_MAX_FAILURES) {
    throw new MockError(429, 'Too many attempts. Try again later.', 'SHARE_RATE_LIMITED');
  }
  if (share.password !== password) {
    failedUnlockTimes.set(share.slug, [...recent, now]);
    throw new MockError(401, 'Incorrect password', 'INVALID_SHARE_PASSWORD');
  }
  failedUnlockTimes.delete(share.slug);
}

/** The live subtree under a shared folder, as public child DTOs (folders first, by name). */
function sharedSubtree(root: DataroomNode): SharedChildDto[] {
  const live = nodes.filter((n) => n.dataroomId === root.dataroomId && n.deletedAt === null);
  const build = (parentId: string): SharedChildDto[] =>
    sortNodes(live.filter((n) => n.parentId === parentId)).map((n) => {
      const base = { id: n.id, name: n.name, updatedAt: n.updatedAt };
      return n.type === 'file'
        ? { ...base, type: 'file' as const, size: n.size }
        : { ...base, type: 'folder' as const, children: build(n.id) };
    });
  return build(root.id);
}

/** Public: verify the password and return node metadata (no owner, no room info). */
export function unlockShare(slug: string, password: string | null | undefined): SharedNodeDto {
  const { share, node } = requireSharedNode(slug);
  checkSharePassword(share, password);
  if (node.type === 'file') {
    const stored = fileContents.get(node.id);
    return {
      name: node.name,
      type: 'file',
      updatedAt: node.updatedAt,
      size: node.size,
      contentType: stored?.contentType ?? 'application/pdf',
    };
  }
  return {
    name: node.name,
    type: 'folder',
    updatedAt: node.updatedAt,
    children: sharedSubtree(node),
  };
}

/**
 * Public: verify the password and return the raw file bytes for preview/download.
 * For a folder share, `fileId` picks a live file inside the shared subtree.
 */
export function getSharedContent(
  slug: string,
  password: string | null | undefined,
  fileId?: string | null,
): { name: string; contentType: string; bytes: Uint8Array } {
  const { share, node } = requireSharedNode(slug);
  checkSharePassword(share, password);
  const file = node.type === 'file' ? node : resolveSharedFile(node, fileId);
  const stored = fileContents.get(file.id);
  if (!stored) throw new MockError(404, 'Share link not found', 'SHARE_NOT_FOUND');
  return { name: file.name, contentType: stored.contentType, bytes: stored.bytes };
}

/** A live file inside the shared folder's subtree, or 404. */
function resolveSharedFile(root: DataroomNode, fileId: string | null | undefined): FileNode {
  const file = fileId ? nodes.find((n) => n.id === fileId) : null;
  if (file && file.type === 'file' && file.deletedAt === null) {
    // Walk up the parent chain: the file must live under the shared folder.
    let parentId = file.parentId;
    while (parentId !== null) {
      if (parentId === root.id) return file;
      const parent = nodes.find((n) => n.id === parentId);
      if (!parent || parent.deletedAt !== null) break;
      parentId = parent.parentId;
    }
  }
  throw new MockError(404, 'Share link not found', 'SHARE_NOT_FOUND');
}

export function listMembers(dataroomId: string, actorId: string): DataroomMember[] {
  requireMember(dataroomId, actorId);
  return members
    .filter((member) => member.dataroomId === dataroomId)
    .map(toMember)
    .sort((a, b) => a.addedAt - b.addedAt);
}

export function addMember(
  dataroomId: string,
  userId: string,
  role: MemberRole,
  actorId: string,
): DataroomMember {
  requireRole(dataroomId, actorId, 'owner');
  getUser(userId);
  if (roleOf(dataroomId, userId)) throw new MockError(409, 'This person is already a member');
  const ts = tick();
  const stored = addMemberInternal(dataroomId, userId, role, ts);
  recordActivityInternal({
    dataroomId,
    nodeId: null,
    nodeName: null,
    nodeType: null,
    action: 'member.added',
    actorId,
    createdAt: ts,
  });
  persist();
  return toMember(stored);
}

export function updateMemberRole(
  dataroomId: string,
  userId: string,
  role: MemberRole,
  actorId: string,
): DataroomMember {
  requireRole(dataroomId, actorId, 'owner');
  const current = members.find((m) => m.dataroomId === dataroomId && m.userId === userId);
  if (!current) throw new MockError(404, 'Member not found');
  if (current.role === 'owner' && role !== 'owner' && countOwners(dataroomId) <= 1) {
    throw new MockError(400, 'A data room must keep at least one owner');
  }
  current.role = role;
  recordActivityInternal({
    dataroomId,
    nodeId: null,
    nodeName: null,
    nodeType: null,
    action: 'member.updated',
    actorId,
    createdAt: tick(),
  });
  persist();
  return toMember(current);
}

export function removeMember(dataroomId: string, userId: string, actorId: string): void {
  requireRole(dataroomId, actorId, 'owner');
  const current = roleOf(dataroomId, userId);
  if (!current) return;
  if (current === 'owner' && countOwners(dataroomId) <= 1) {
    throw new MockError(400, 'A data room must keep at least one owner');
  }
  removeWhere(members, (member) => member.dataroomId === dataroomId && member.userId === userId);
  recordActivityInternal({
    dataroomId,
    nodeId: null,
    nodeName: null,
    nodeType: null,
    action: 'member.removed',
    actorId,
    createdAt: tick(),
  });
  persist();
}

export function listFavorites(userId: string) {
  return favorites
    .filter((favorite) => favorite.userId === userId)
    .filter((favorite) => roleOf(favorite.dataroomId, userId) !== null)
    .filter((favorite) => {
      if (favorite.nodeId === null) return true;
      const node = nodes.find((n) => n.id === favorite.nodeId);
      return !node || node.deletedAt === null;
    })
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(toFavoriteDto);
}

export function addFavorite(userId: string, dataroomId: string, nodeId: string | null) {
  requireMember(dataroomId, userId);
  if (nodeId !== null) {
    const node = getLiveNode(nodeId);
    if (node.dataroomId !== dataroomId) throw new MockError(404, 'Favorite target not found');
  }
  const existing = favorites.find(
    (favorite) =>
      favorite.userId === userId &&
      favorite.dataroomId === dataroomId &&
      favorite.nodeId === nodeId,
  );
  if (existing) return toFavoriteDto(existing);
  const favorite: PersistedFavorite = { userId, dataroomId, nodeId, createdAt: tick() };
  favorites.push(favorite);
  persist();
  return toFavoriteDto(favorite);
}

export function removeFavorite(userId: string, dataroomId: string, nodeId: string | null): void {
  removeWhere(
    favorites,
    (favorite) =>
      favorite.userId === userId &&
      favorite.dataroomId === dataroomId &&
      favorite.nodeId === nodeId,
  );
  persist();
}

export function listActivity(
  dataroomId: string,
  actorId: string,
  options: { nodeId?: string | null; limit?: number } = {},
) {
  requireMember(dataroomId, actorId);
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
  return activity
    .filter(
      (entry) =>
        entry.dataroomId === dataroomId && (!options.nodeId || entry.nodeId === options.nodeId),
    )
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit)
    .map(toActivityDto);
}

export function getStorageUsage(): { usedBytes: number; quotaBytes: number } {
  return {
    usedBytes: nodes.reduce((sum, node) => (node.type === 'file' ? sum + node.size : sum), 0),
    quotaBytes: STORAGE_QUOTA_BYTES,
  };
}

function assertPdfUpload(
  upload:
    { originalName: string; size: number; contentType: string; bytes: Uint8Array } | undefined,
): asserts upload is {
  originalName: string;
  size: number;
  contentType: string;
  bytes: Uint8Array;
} {
  if (!upload) throw new MockError(400, 'A PDF file is required');
  if (upload.size <= 0) throw new MockError(400, 'Uploaded file cannot be empty');
  if (upload.size > UPLOAD.maxFileSizeBytes) {
    throw new MockError(413, `File cannot be larger than ${UPLOAD.maxFileSizeBytes} bytes`);
  }
  const lower = upload.originalName.toLowerCase();
  const okExt = UPLOAD.acceptedExtensions.some((ext) => lower.endsWith(ext));
  const okMime = (UPLOAD.acceptedMimeTypes as readonly string[]).includes(upload.contentType);
  const okSignature =
    upload.bytes.length >= 5 &&
    upload.bytes[0] === 0x25 &&
    upload.bytes[1] === 0x50 &&
    upload.bytes[2] === 0x44 &&
    upload.bytes[3] === 0x46;
  if (!okExt || !okMime || !okSignature) throw new MockError(400, 'Only PDF files are allowed');
}

/** Live (non-trashed) nodes — every normal listing hides the trash. */
function liveNodes(): DataroomNode[] {
  return nodes.filter((n) => n.deletedAt === null);
}

function getLiveNode(id: string): DataroomNode {
  const node = nodes.find((n) => n.id === id && n.deletedAt === null);
  if (!node) throw new MockError(404, 'Node not found');
  return node;
}

/** Includes trashed nodes — for restore/purge which operate on the trash. */
function getAnyNode(id: string): DataroomNode {
  const node = nodes.find((n) => n.id === id);
  if (!node) throw new MockError(404, 'Node not found');
  return node;
}

function getUser(id: string): User {
  const user = DEMO_USERS.find((candidate) => candidate.id === id);
  if (!user) throw new MockError(400, 'User not found');
  return user;
}

function siblingNames(dataroomId: string, parentId: string | null, exceptId?: string): string[] {
  // Trashed siblings never collide — the DB unique index is live-only.
  return nodes
    .filter(
      (n) =>
        n.dataroomId === dataroomId &&
        n.parentId === parentId &&
        n.deletedAt === null &&
        n.id !== exceptId,
    )
    .map((n) => n.name);
}

function assertParentFolder(dataroomId: string, parentId: string | null): void {
  if (parentId === null) return;
  const parent = nodes.find((n) => n.id === parentId && n.deletedAt === null);
  if (!parent || parent.dataroomId !== dataroomId) {
    throw new MockError(404, 'Parent folder not found');
  }
  if (parent.type !== 'folder') throw new MockError(400, 'Parent must be a folder');
}

function addMemberInternal(
  dataroomId: string,
  userId: string,
  role: MemberRole,
  createdAt: number,
): PersistedMember {
  const existing = members.find(
    (member) => member.dataroomId === dataroomId && member.userId === userId,
  );
  if (existing) {
    existing.role = role;
    return existing;
  }
  const member: PersistedMember = { dataroomId, userId, role, createdAt };
  members.push(member);
  return member;
}

function toMember(member: PersistedMember): DataroomMember {
  return {
    dataroomId: member.dataroomId,
    user: getUser(member.userId),
    role: member.role,
    addedAt: member.createdAt,
  };
}

function recordNodeActivity(
  node: DataroomNode,
  action: ActivityAction,
  actorId: string,
  createdAt: number,
): void {
  recordActivityInternal({
    dataroomId: node.dataroomId,
    nodeId: node.id,
    nodeName: node.name,
    nodeType: node.type,
    action,
    actorId,
    createdAt,
  });
}

function recordActivityInternal(input: Omit<PersistedActivity, 'id'>): void {
  activity.unshift({ ...input, id: uid() });
}

function toFavoriteDto(favorite: PersistedFavorite) {
  const dataroom = requireDataroom(favorite.dataroomId);
  const node = favorite.nodeId ? nodes.find((candidate) => candidate.id === favorite.nodeId) : null;
  return {
    dataroomId: dataroom.id,
    dataroomName: dataroom.name,
    nodeId: favorite.nodeId,
    nodeName: node?.name ?? null,
    nodeType: node?.type ?? null,
    parentId: node?.parentId ?? null,
    createdAt: favorite.createdAt,
  };
}

function toActivityDto(entry: PersistedActivity) {
  return {
    id: entry.id,
    dataroomId: entry.dataroomId,
    nodeId: entry.nodeId,
    nodeName: entry.nodeName,
    nodeType: entry.nodeType,
    action: entry.action,
    actor: getUser(entry.actorId),
    createdAt: entry.createdAt,
  };
}

function moveError(error: string): MockError {
  if (error === 'node-not-found' || error === 'target-not-found') {
    return new MockError(404, 'Node not found');
  }
  if (error === 'target-cross-dataroom') return new MockError(404, 'Target folder not found');
  if (error === 'target-not-folder') return new MockError(400, 'Move target must be a folder');
  if (error === 'target-is-self') return new MockError(400, 'Cannot move a folder into itself');
  return new MockError(400, 'Cannot move a folder into one of its descendants');
}

function removeNodes(ids: Set<string>): void {
  for (let i = nodes.length - 1; i >= 0; i--) {
    if (ids.has(nodes[i].id)) {
      fileContents.delete(nodes[i].id);
      nodes.splice(i, 1);
    }
  }
  removeWhere(favorites, (favorite) => favorite.nodeId !== null && ids.has(favorite.nodeId));
  removeWhere(shares, (share) => ids.has(share.nodeId));
}

function touchDataroom(dataroomId: string, ts: number, userId: string): void {
  const dataroom = datarooms.find((d) => d.id === dataroomId);
  if (dataroom) {
    dataroom.updatedAt = ts;
    dataroom.updatedBy = userId;
  }
}

function removeWhere<T>(items: T[], predicate: (item: T) => boolean): void {
  for (let i = items.length - 1; i >= 0; i--) {
    if (predicate(items[i])) items.splice(i, 1);
  }
}

function seed(): void {
  seeding = true;
  try {
    seedData();
  } finally {
    seeding = false;
  }
}

function seedData(): void {
  const owner = DEMO_USERS[0].id;
  const titan = createDataroom('Project Titan - Due Diligence', owner);
  // Members added up front so historical uploads can be attributed to them.
  addMember(titan.id, DEMO_USERS[1].id, 'editor', owner);
  addMember(titan.id, DEMO_USERS[2].id, 'viewer', owner);
  addMember(titan.id, DEMO_USERS[3].id, 'viewer', owner);

  const financials = createFolder(titan.id, null, 'Financials', owner);
  const legal = createFolder(titan.id, null, 'Legal', DEMO_USERS[1].id);
  createFolder(titan.id, null, 'Product', DEMO_USERS[2].id);
  createFile(titan.id, null, sampleUpload('Executive Summary.pdf'), owner);

  const statements = createFolder(titan.id, financials.id, 'Statements', owner);
  createFolder(titan.id, financials.id, 'Projections', DEMO_USERS[3].id);
  createFile(titan.id, financials.id, sampleUpload('FY2025 Overview.pdf'), owner);
  createFile(titan.id, statements.id, sampleUpload('Q1 Balance Sheet.pdf'), owner);
  createFile(titan.id, statements.id, sampleUpload('Q2 Balance Sheet.pdf'), DEMO_USERS[1].id);
  const cashFlow = createFile(titan.id, statements.id, sampleUpload('Cash Flow.pdf'), owner);

  const contracts = createFolder(titan.id, legal.id, 'Contracts', DEMO_USERS[1].id);
  createFile(titan.id, legal.id, sampleUpload('NDA.pdf'), DEMO_USERS[1].id);
  createFile(
    titan.id,
    contracts.id,
    sampleUpload('Master Services Agreement.pdf'),
    DEMO_USERS[4].id,
  );
  createFile(titan.id, contracts.id, sampleUpload('SOW-001.pdf'), DEMO_USERS[5].id);
  addFavorite(owner, titan.id, null);
  addFavorite(owner, titan.id, financials.id);
  // One item already in the trash so the Trash view is not empty on first run.
  deleteNode(cashFlow.id, owner);

  const acme = createDataroom('Acme Acquisition', DEMO_USERS[1].id);
  createFolder(acme.id, null, 'Diligence', DEMO_USERS[1].id);
  createFile(acme.id, null, sampleUpload('Teaser.pdf'), DEMO_USERS[1].id);
  addMember(acme.id, owner, 'viewer', DEMO_USERS[1].id);

  createDataroom('Northwind - New Deal', DEMO_USERS[2].id);
}

function sampleUpload(name: string): {
  originalName: string;
  size: number;
  contentType: string;
  bytes: Uint8Array;
} {
  const bytes = makePdfBytes(name);
  return {
    originalName: name,
    size: faker.number.int({ min: 40 * 1024, max: 8 * 1024 * 1024 }),
    contentType: 'application/pdf',
    bytes,
  };
}

export async function initStore(): Promise<void> {
  const persisted = await loadPersistedState();
  if (persisted) {
    datarooms.push(...persisted.datarooms);
    nodes.push(...persisted.nodes);
    members.push(...persisted.members);
    favorites.push(...persisted.favorites);
    activity.push(...persisted.activity);
    if (persisted.shares) shares.push(...persisted.shares);
    for (const [id, file] of persisted.files) fileContents.set(id, file);
    clock = persisted.clock;
    return;
  }
  seed();
  persist();
}

export async function resetStore(): Promise<void> {
  await clearPersistedState();
  datarooms.length = 0;
  nodes.length = 0;
  members.length = 0;
  favorites.length = 0;
  activity.length = 0;
  shares.length = 0;
  fileContents.clear();
  clock = CLOCK_START;
  faker.seed(FAKER_SEED);
  seed();
  persist();
}
