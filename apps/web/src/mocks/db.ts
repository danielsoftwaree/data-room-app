/**
 * Stateful in-memory store backing the dev mock API (MSW).
 *
 * The point of "stateful" (vs vanilla orval/faker random mocks) is that the
 * product flows - create a data room, see it in the list, navigate folders,
 * cascade-delete with an accurate count - stay coherent across calls.
 *
 * Crucially, business behavior is NOT re-invented here: name validation,
 * duplicate handling, auto-suffixing and cascade collection all come from
 * @repo/domain - the very same pure rules the real NestJS service uses. So the
 * mock mirrors real backend edge cases (SPEC 4.5) without touching the backend.
 *
 * State is persisted to IndexedDB (see ./persist) so uploads survive page
 * reloads; without it the module-scope store re-seeds on every reload and
 * previously uploaded PDFs 404 on open.
 */
import { faker } from '@faker-js/faker';
import { UPLOAD } from '@repo/config';
import type {
  Dataroom,
  DataroomNode,
  FileNode,
  FolderNode,
  NameValidationError,
} from '@repo/domain';
import {
  collectSubtreeIds,
  isNameTaken,
  NODE_NAME_MAX_LENGTH,
  nextAvailableName,
  sortNodes,
  validateNodeName,
} from '@repo/domain';
import { makePdfBytes } from './pdf';
import { clearPersistedState, loadPersistedState, savePersistedState } from './persist';

/** Error carrying an HTTP status, translated to a Nest-shaped JSON body by handlers. */
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

interface StoredFile {
  contentType: string;
  bytes: Uint8Array;
}

const datarooms: Dataroom[] = [];
const nodes: DataroomNode[] = [];
/** nodeId -> file bytes (files only). */
const fileContents = new Map<string, StoredFile>();

const FAKER_SEED = 20260704;
const CLOCK_START = new Date('2026-06-01T09:00:00Z').getTime();

faker.seed(FAKER_SEED);
let clock = CLOCK_START;
/** Monotonic, deterministic timestamps so ordering is stable in dev. */
function tick(): number {
  clock += faker.number.int({ min: 60_000, max: 6 * 3_600_000 });
  return clock;
}

function uid(): string {
  // crypto.randomUUID instead of faker: after hydration from IndexedDB the
  // faker sequence restarts, so replayed uuids would collide with persisted ids.
  return crypto.randomUUID();
}

function requireName(raw: string): string {
  const result = validateNodeName(raw);
  if (!result.ok) throw new MockError(400, NAME_ERROR_MESSAGES[result.error]);
  return result.name;
}

/** Snapshot the whole store into IndexedDB (fire-and-forget, coalesced). */
function persist(): void {
  savePersistedState({
    datarooms,
    nodes,
    files: [...fileContents.entries()],
    clock,
  });
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

// ---------------------------------------------------------------------------
// Datarooms
// ---------------------------------------------------------------------------

export function listDatarooms(): Dataroom[] {
  return [...datarooms].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getDataroom(id: string): Dataroom {
  const dataroom = datarooms.find((d) => d.id === id);
  if (!dataroom) throw new MockError(404, 'Data room not found');
  return dataroom;
}

export function createDataroom(rawName: string): Dataroom {
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
  const dataroom: Dataroom = { id: uid(), name, createdAt: ts, updatedAt: ts };
  datarooms.push(dataroom);
  persist();
  return dataroom;
}

export function renameDataroom(id: string, rawName: string): Dataroom {
  const dataroom = getDataroom(id);
  const name = requireName(rawName);
  const others = datarooms.filter((d) => d.id !== id).map((d) => d.name);
  if (isNameTaken(others, name)) {
    throw new MockError(409, `A data room named "${name}" already exists`);
  }
  dataroom.name = name;
  dataroom.updatedAt = tick();
  persist();
  return dataroom;
}

export function deleteDataroom(id: string): { deletedNodeIds: string[] } {
  getDataroom(id);
  const deletedNodeIds = nodes.filter((n) => n.dataroomId === id).map((n) => n.id);
  removeNodes(new Set(deletedNodeIds));
  const index = datarooms.findIndex((d) => d.id === id);
  if (index >= 0) datarooms.splice(index, 1);
  persist();
  return { deletedNodeIds };
}

// ---------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------

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
  };
  nodes.push(folder);
  touchDataroom(dataroomId, ts);
  persist();
  return folder;
}

export function createFile(
  dataroomId: string,
  parentId: string | null,
  upload:
    { originalName: string; size: number; contentType: string; bytes: Uint8Array } | undefined,
): FileNode {
  getDataroom(dataroomId);
  assertParentFolder(dataroomId, parentId);

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
    upload.bytes[3] === 0x46; // %PDF
  if (!okExt || !okMime || !okSignature) {
    throw new MockError(400, 'Only PDF files are allowed');
  }

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
  };
  nodes.push(file);
  fileContents.set(file.id, { contentType: 'application/pdf', bytes: upload.bytes });
  touchDataroom(dataroomId, ts);
  persist();
  return file;
}

export function renameNode(id: string, rawName: string): DataroomNode {
  const node = nodes.find((n) => n.id === id);
  if (!node) throw new MockError(404, 'Node not found');
  const name = requireName(rawName);
  if (isNameTaken(siblingNames(node.dataroomId, node.parentId, node.id), name)) {
    throw new MockError(409, `"${name}" already exists in this folder`);
  }
  node.name = name;
  node.updatedAt = tick();
  touchDataroom(node.dataroomId, node.updatedAt);
  persist();
  return node;
}

export function deleteNode(id: string): { deletedIds: string[] } {
  const node = nodes.find((n) => n.id === id);
  if (!node) throw new MockError(404, 'Node not found');
  const deletedIds = collectSubtreeIds(
    nodes.filter((n) => n.dataroomId === node.dataroomId),
    id,
  );
  removeNodes(new Set(deletedIds));
  touchDataroom(node.dataroomId, tick());
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

// ---------------------------------------------------------------------------
// internal helpers
// ---------------------------------------------------------------------------

function removeNodes(ids: Set<string>): void {
  for (let i = nodes.length - 1; i >= 0; i--) {
    if (ids.has(nodes[i].id)) {
      fileContents.delete(nodes[i].id);
      nodes.splice(i, 1);
    }
  }
}

function touchDataroom(dataroomId: string, ts: number): void {
  const dataroom = datarooms.find((d) => d.id === dataroomId);
  if (dataroom) dataroom.updatedAt = ts;
}

// ---------------------------------------------------------------------------
// Seed data (deterministic) - gives the UI something real to render on load,
// including one empty data room to exercise the empty state.
// ---------------------------------------------------------------------------

function seedFolder(dataroomId: string, parentId: string | null, name: string): FolderNode {
  const ts = tick();
  const folder: FolderNode = {
    id: uid(),
    dataroomId,
    parentId,
    type: 'folder',
    name,
    createdAt: ts,
    updatedAt: ts,
  };
  nodes.push(folder);
  return folder;
}

function seedFile(dataroomId: string, parentId: string | null, name: string): FileNode {
  const ts = tick();
  const bytes = makePdfBytes(name);
  const file: FileNode = {
    id: uid(),
    dataroomId,
    parentId,
    type: 'file',
    name,
    size: faker.number.int({ min: 40 * 1024, max: 8 * 1024 * 1024 }),
    createdAt: ts,
    updatedAt: ts,
  };
  nodes.push(file);
  fileContents.set(file.id, { contentType: 'application/pdf', bytes });
  return file;
}

function seed(): void {
  // 1) Richly populated data room.
  const titan = createDataroom('Project Titan — Due Diligence');
  const financials = seedFolder(titan.id, null, 'Financials');
  const legal = seedFolder(titan.id, null, 'Legal');
  seedFolder(titan.id, null, 'Product');
  seedFile(titan.id, null, 'Executive Summary.pdf');

  const statements = seedFolder(titan.id, financials.id, 'Statements');
  seedFolder(titan.id, financials.id, 'Projections');
  seedFile(titan.id, financials.id, 'FY2025 Overview.pdf');
  seedFile(titan.id, statements.id, 'Q1 Balance Sheet.pdf');
  seedFile(titan.id, statements.id, 'Q2 Balance Sheet.pdf');
  seedFile(titan.id, statements.id, 'Cash Flow.pdf');

  const contracts = seedFolder(titan.id, legal.id, 'Contracts');
  seedFile(titan.id, legal.id, 'NDA.pdf');
  seedFile(titan.id, contracts.id, 'Master Services Agreement.pdf');
  seedFile(titan.id, contracts.id, 'SOW-001.pdf');

  // 2) Lightly populated data room.
  const acme = createDataroom('Acme Acquisition');
  seedFolder(acme.id, null, 'Diligence');
  seedFile(acme.id, null, 'Teaser.pdf');

  // 3) Empty data room (exercises the empty state).
  createDataroom('Northwind — New Deal');
}

/**
 * Hydrate the store from IndexedDB, or seed deterministically on first run.
 * Called (and awaited) by enableMocking() before the app renders.
 */
export async function initStore(): Promise<void> {
  const persisted = await loadPersistedState();
  if (persisted) {
    datarooms.push(...persisted.datarooms);
    nodes.push(...persisted.nodes);
    for (const [id, file] of persisted.files) fileContents.set(id, file);
    clock = persisted.clock;
    return;
  }
  seed();
  persist();
}

/**
 * Wipe persisted state and restore the pristine seeds (tester/e2e helper,
 * exposed as window.__dataroomMocks.reset() - reload the page afterwards).
 */
export async function resetStore(): Promise<void> {
  await clearPersistedState();
  datarooms.length = 0;
  nodes.length = 0;
  fileContents.clear();
  clock = CLOCK_START;
  faker.seed(FAKER_SEED);
  seed();
  persist();
}
