/**
 * Stateful in-memory store backing the dev mock API (MSW).
 * It mirrors the Nest API closely enough that the app can run zero-config
 * without hand-written client branches.
 */
import { faker } from '@faker-js/faker';
import { STORAGE_QUOTA_BYTES, UPLOAD } from '@repo/config';
import type {
  ActivityAction,
  Dataroom,
  DataroomMember,
  DataroomNode,
  FileNode,
  FolderNode,
  MemberRole,
  NameValidationError,
  User,
} from '@repo/domain';
import {
  collectSubtreeIds,
  isNameTaken,
  NODE_NAME_MAX_LENGTH,
  nextAvailableName,
  sortNodes,
  validateMoveTarget,
  validateNodeName,
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
} from './persist';

export class MockError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'MockError';
  }
}

const NAME_ERROR_MESSAGES: Record<NameValidationError, string> = {
  empty: 'Name cannot be empty',
  'too-long': `Name cannot be longer than ${NODE_NAME_MAX_LENGTH} characters`,
  'invalid-chars': 'Name contains characters that are not allowed: \\ / : * ? " < > |',
};

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
const fileContents = new Map<string, PersistedFile>();

const FAKER_SEED = 20260704;
const CLOCK_START = new Date('2026-06-01T09:00:00Z').getTime();

faker.seed(FAKER_SEED);
let clock = CLOCK_START;

function tick(): number {
  clock += faker.number.int({ min: 60_000, max: 6 * 3_600_000 });
  return clock;
}

function uid(): string {
  return crypto.randomUUID();
}

function requireName(raw: string): string {
  const result = validateNodeName(raw);
  if (!result.ok) throw new MockError(400, NAME_ERROR_MESSAGES[result.error]);
  return result.name;
}

function persist(): void {
  savePersistedState({
    datarooms,
    nodes,
    members,
    favorites,
    activity,
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

export function listDatarooms(): Dataroom[] {
  return [...datarooms].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getDataroom(id: string): Dataroom {
  const dataroom = datarooms.find((d) => d.id === id);
  if (!dataroom) throw new MockError(404, 'Data room not found');
  return dataroom;
}

export function createDataroom(rawName: string, userId: string): Dataroom {
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
  return dataroom;
}

export function renameDataroom(id: string, rawName: string, userId: string): Dataroom {
  const dataroom = getDataroom(id);
  const name = requireName(rawName);
  const others = datarooms.filter((d) => d.id !== id).map((d) => d.name);
  if (isNameTaken(others, name)) {
    throw new MockError(409, `A data room named "${name}" already exists`);
  }
  dataroom.name = name;
  dataroom.updatedAt = tick();
  dataroom.updatedBy = userId;
  persist();
  return dataroom;
}

export function deleteDataroom(id: string): { deletedNodeIds: string[] } {
  getDataroom(id);
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
  options: { nameContains?: string | null } = {},
): DataroomNode[] {
  getDataroom(dataroomId);
  const term = options.nameContains?.trim().toLocaleLowerCase();
  return sortNodes(
    nodes.filter(
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
  getDataroom(dataroomId);
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
  getDataroom(dataroomId);
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
  };
  nodes.push(file);
  fileContents.set(file.id, { contentType: 'application/pdf', bytes: upload.bytes });
  touchDataroom(dataroomId, ts, userId);
  recordNodeActivity(file, 'file.uploaded', userId, ts);
  persist();
  return file;
}

export function renameNode(id: string, rawName: string, userId: string): DataroomNode {
  const node = getNode(id);
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
  const node = getNode(id);
  const dataroomNodes = nodes.filter((candidate) => candidate.dataroomId === node.dataroomId);
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

export function deleteNode(id: string, userId: string): { deletedIds: string[] } {
  const node = getNode(id);
  const deletedIds = collectSubtreeIds(
    nodes.filter((n) => n.dataroomId === node.dataroomId),
    id,
  );
  recordNodeActivity(node, 'node.deleted', userId, tick());
  removeNodes(new Set(deletedIds));
  touchDataroom(node.dataroomId, tick(), userId);
  persist();
  return { deletedIds };
}

export function getFileContent(id: string): {
  name: string;
  contentType: string;
  bytes: Uint8Array;
} {
  const node = nodes.find((n) => n.id === id);
  const stored = fileContents.get(id);
  if (!node || node.type !== 'file' || !stored) throw new MockError(404, 'File not found');
  return { name: node.name, contentType: stored.contentType, bytes: stored.bytes };
}

export function listMembers(dataroomId: string): DataroomMember[] {
  getDataroom(dataroomId);
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
  getDataroom(dataroomId);
  getUser(userId);
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

export function removeMember(dataroomId: string, userId: string, actorId: string): void {
  getDataroom(dataroomId);
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
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(toFavoriteDto);
}

export function addFavorite(userId: string, dataroomId: string, nodeId: string | null) {
  getDataroom(dataroomId);
  if (nodeId !== null) {
    const node = getNode(nodeId);
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
  options: { nodeId?: string | null; limit?: number } = {},
) {
  getDataroom(dataroomId);
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

function getNode(id: string): DataroomNode {
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
  return nodes
    .filter((n) => n.dataroomId === dataroomId && n.parentId === parentId && n.id !== exceptId)
    .map((n) => n.name);
}

function assertParentFolder(dataroomId: string, parentId: string | null): void {
  if (parentId === null) return;
  const parent = nodes.find((n) => n.id === parentId);
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
  const dataroom = getDataroom(favorite.dataroomId);
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
  const owner = DEMO_USERS[0].id;
  const titan = createDataroom('Project Titan - Due Diligence', owner);
  const financials = createFolder(titan.id, null, 'Financials', owner);
  const legal = createFolder(titan.id, null, 'Legal', DEMO_USERS[1].id);
  createFolder(titan.id, null, 'Product', DEMO_USERS[2].id);
  createFile(titan.id, null, sampleUpload('Executive Summary.pdf'), owner);

  const statements = createFolder(titan.id, financials.id, 'Statements', owner);
  createFolder(titan.id, financials.id, 'Projections', DEMO_USERS[3].id);
  createFile(titan.id, financials.id, sampleUpload('FY2025 Overview.pdf'), owner);
  createFile(titan.id, statements.id, sampleUpload('Q1 Balance Sheet.pdf'), owner);
  createFile(titan.id, statements.id, sampleUpload('Q2 Balance Sheet.pdf'), DEMO_USERS[1].id);
  createFile(titan.id, statements.id, sampleUpload('Cash Flow.pdf'), DEMO_USERS[2].id);

  const contracts = createFolder(titan.id, legal.id, 'Contracts', DEMO_USERS[1].id);
  createFile(titan.id, legal.id, sampleUpload('NDA.pdf'), DEMO_USERS[1].id);
  createFile(
    titan.id,
    contracts.id,
    sampleUpload('Master Services Agreement.pdf'),
    DEMO_USERS[4].id,
  );
  createFile(titan.id, contracts.id, sampleUpload('SOW-001.pdf'), DEMO_USERS[5].id);
  addMember(titan.id, DEMO_USERS[1].id, 'editor', owner);
  addMember(titan.id, DEMO_USERS[2].id, 'viewer', owner);
  addMember(titan.id, DEMO_USERS[3].id, 'viewer', owner);
  addFavorite(owner, titan.id, null);
  addFavorite(owner, titan.id, financials.id);

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
  fileContents.clear();
  clock = CLOCK_START;
  faker.seed(FAKER_SEED);
  seed();
  persist();
}
