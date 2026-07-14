import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UPLOAD } from '@repo/config';
import type { Dataroom, DataroomNode, FileNode, FolderNode, MemberRole, User } from '@repo/domain';
import { createPdfBuffer } from '../../../shared/test-utils';
import type { BlobStorage, PutBlobInput, StoredBlob } from '../../storage/blob-storage';
import { WorkspaceService } from '../../workspace/application/workspace.service';
import type {
  ActivityRecord,
  FavoriteRecord,
  FavoriteTarget,
  MemberRecord,
  RecordActivityInput,
  WorkspaceRepository,
} from '../../workspace/domain/workspace.repository.port';
import type {
  CreateFileNodeInput,
  CreateFolderInput,
  DataroomForUser,
  DataroomMeta,
  DataroomsRepository,
  ListNodesOptions,
  MoveNodeInput,
} from '../domain/datarooms.repository.port';
import {
  FileNotFoundError,
  InvalidInputError,
  NameConflictError,
  NodeNotFoundError,
  PayloadTooLargeError,
} from '../domain/errors';
import type { PdfUploadInput } from '../domain/pdf-upload';
import { DataroomsService } from './datarooms.service';
import { NodesService } from './nodes.service';

const JANE = '00000000-0000-4000-8000-000000000001';
const MARK = '00000000-0000-4000-8000-000000000002';
const ALEX = '00000000-0000-4000-8000-000000000003';

const USERS: User[] = [
  { id: JANE, name: 'Jane Smith', email: 'jane@acme.com', color: '#5865f2' },
  { id: MARK, name: 'Mark Reynolds', email: 'mark@acme.com', color: '#35ed7e' },
  { id: ALEX, name: 'Alex Kim', email: 'alex@acme.com', color: '#a78bfa' },
];

interface MemberEntry {
  dataroomId: string;
  userId: string;
  role: MemberRole;
  addedAt: number;
}

/** Membership lives here and is shared by both fake repositories, so access
 *  checks (which read the workspace repo) and dashboard queries (which read the
 *  datarooms repo) agree, exactly like the real DB joins do. */
class Membership {
  readonly entries: MemberEntry[] = [];

  roleOf(dataroomId: string, userId: string): MemberRole | null {
    return this.entries.find((m) => m.dataroomId === dataroomId && m.userId === userId)?.role ?? null;
  }

  add(dataroomId: string, userId: string, role: MemberRole): MemberEntry {
    const existing = this.entries.find((m) => m.dataroomId === dataroomId && m.userId === userId);
    if (existing) return existing;
    const entry: MemberEntry = { dataroomId, userId, role, addedAt: this.entries.length + 1 };
    this.entries.push(entry);
    return entry;
  }
}

class FakeDataroomsRepository implements DataroomsRepository {
  readonly nodes = new Map<string, DataroomNode>();
  private readonly datarooms = new Map<string, Dataroom>();
  private seq = 0;

  constructor(private readonly membership: Membership) {}

  async lockDataroom(): Promise<void> {
    // In-memory fake: the single-threaded test runner needs no locking.
  }

  private nextId(): string {
    this.seq += 1;
    return `id-${this.seq}`;
  }

  private user(id: string): User {
    return USERS.find((u) => u.id === id) ?? USERS[0];
  }

  async listDataroomsForUser(userId: string): Promise<DataroomForUser[]> {
    return [...this.datarooms.values()]
      .map((room) => {
        const role = this.membership.roleOf(room.id, userId);
        return role ? { ...room, myRole: role } : null;
      })
      .filter((room): room is DataroomForUser => room !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async dataroomMeta(dataroomIds: readonly string[]): Promise<Map<string, DataroomMeta>> {
    const meta = new Map<string, DataroomMeta>();
    for (const id of dataroomIds) {
      const members = this.membership.entries.filter((m) => m.dataroomId === id);
      const ownerEntry = members
        .filter((m) => m.role === 'owner')
        .sort((a, b) => a.addedAt - b.addedAt)[0];
      meta.set(id, {
        memberCount: members.length,
        owner: ownerEntry ? this.user(ownerEntry.userId) : null,
      });
    }
    return meta;
  }

  async createDataroom(name: string, userId: string): Promise<Dataroom> {
    this.assertDataroomNameAvailable(name);
    const now = Date.now();
    const dataroom: Dataroom = {
      id: this.nextId(),
      name,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      updatedBy: userId,
    };
    this.datarooms.set(dataroom.id, dataroom);
    return dataroom;
  }

  async findDataroom(id: string): Promise<Dataroom | undefined> {
    return this.datarooms.get(id);
  }

  async renameDataroom(id: string, name: string, userId: string): Promise<Dataroom | undefined> {
    const existing = this.datarooms.get(id);
    if (!existing) return undefined;
    this.assertDataroomNameAvailable(name, id);
    const updated: Dataroom = { ...existing, name, updatedAt: Date.now(), updatedBy: userId };
    this.datarooms.set(id, updated);
    return updated;
  }

  async deleteDataroom(id: string): Promise<void> {
    this.datarooms.delete(id);
    for (const node of [...this.nodes.values()]) {
      if (node.dataroomId === id) this.nodes.delete(node.id);
    }
    // Membership cascades with the room, as the DB foreign key does.
    for (let i = this.membership.entries.length - 1; i >= 0; i--) {
      if (this.membership.entries[i].dataroomId === id) this.membership.entries.splice(i, 1);
    }
  }

  async listNodes(dataroomId: string, options?: ListNodesOptions): Promise<DataroomNode[]> {
    const term = options?.nameContains?.toLocaleLowerCase();
    return [...this.nodes.values()].filter(
      (node) =>
        node.dataroomId === dataroomId &&
        (options?.includeDeleted || node.deletedAt === null) &&
        (!term || node.name.toLocaleLowerCase().includes(term)),
    );
  }

  async listDeletedNodes(dataroomIds: readonly string[]): Promise<DataroomNode[]> {
    const ids = new Set(dataroomIds);
    return [...this.nodes.values()].filter(
      (node) => ids.has(node.dataroomId) && node.deletedAt !== null,
    );
  }

  async findNode(id: string): Promise<DataroomNode | undefined> {
    return this.nodes.get(id);
  }

  async createFolder(input: CreateFolderInput): Promise<FolderNode> {
    this.assertSiblingNameAvailable(input.dataroomId, input.parentId, input.name);
    const now = Date.now();
    const node: FolderNode = {
      id: this.nextId(),
      dataroomId: input.dataroomId,
      parentId: input.parentId,
      type: 'folder',
      name: input.name,
      createdAt: now,
      updatedAt: now,
      createdBy: input.userId,
      updatedBy: input.userId,
      deletedAt: null,
      deletedBy: null,
    };
    this.nodes.set(node.id, node);
    return node;
  }

  async createFileNode(input: CreateFileNodeInput): Promise<FileNode> {
    this.assertSiblingNameAvailable(input.dataroomId, input.parentId, input.name);
    const now = Date.now();
    const node: FileNode = {
      id: this.nextId(),
      dataroomId: input.dataroomId,
      parentId: input.parentId,
      type: 'file',
      name: input.name,
      size: input.size,
      createdAt: now,
      updatedAt: now,
      createdBy: input.userId,
      updatedBy: input.userId,
      deletedAt: null,
      deletedBy: null,
      shareSlug: null,
    };
    this.nodes.set(node.id, node);
    return node;
  }

  async renameNode(id: string, name: string, userId: string): Promise<DataroomNode | undefined> {
    const existing = this.nodes.get(id);
    if (!existing) return undefined;
    this.assertSiblingNameAvailable(existing.dataroomId, existing.parentId, name, id);
    const updated: DataroomNode = { ...existing, name, updatedAt: Date.now(), updatedBy: userId };
    this.nodes.set(id, updated);
    return updated;
  }

  async moveNode(input: MoveNodeInput): Promise<DataroomNode | undefined> {
    const existing = this.nodes.get(input.id);
    if (!existing) return undefined;
    this.assertSiblingNameAvailable(existing.dataroomId, input.parentId, input.name, input.id);
    const updated: DataroomNode = {
      ...existing,
      parentId: input.parentId,
      name: input.name,
      updatedAt: Date.now(),
      updatedBy: input.userId,
    };
    this.nodes.set(input.id, updated);
    return updated;
  }

  async deleteNode(id: string): Promise<void> {
    const doomed = new Set<string>([id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const node of this.nodes.values()) {
        if (node.parentId !== null && doomed.has(node.parentId) && !doomed.has(node.id)) {
          doomed.add(node.id);
          grew = true;
        }
      }
    }
    for (const nodeId of doomed) this.nodes.delete(nodeId);
  }

  async setNodesDeleted(ids: readonly string[], deletedBy: string): Promise<void> {
    const now = Date.now();
    for (const id of ids) {
      const node = this.nodes.get(id);
      if (node) this.nodes.set(id, { ...node, deletedAt: now, deletedBy });
    }
  }

  async restoreNodes(ids: readonly string[]): Promise<void> {
    for (const id of ids) {
      const node = this.nodes.get(id);
      if (node) this.nodes.set(id, { ...node, deletedAt: null, deletedBy: null });
    }
  }

  async siblingNames(
    dataroomId: string,
    parentId: string | null,
    excludeId?: string,
  ): Promise<string[]> {
    return [...this.nodes.values()]
      .filter(
        (node) =>
          node.dataroomId === dataroomId &&
          node.parentId === parentId &&
          node.deletedAt === null &&
          node.id !== excludeId,
      )
      .map((node) => node.name);
  }

  private assertDataroomNameAvailable(name: string, excludeId?: string): void {
    const taken = [...this.datarooms.values()].some(
      (dataroom) => dataroom.id !== excludeId && namesEqual(dataroom.name, name),
    );
    if (taken) throw uniqueViolation();
  }

  private assertSiblingNameAvailable(
    dataroomId: string,
    parentId: string | null,
    name: string,
    excludeId?: string,
  ): void {
    // Mirrors the DB's live-only unique index — trashed nodes never collide.
    const taken = [...this.nodes.values()].some(
      (node) =>
        node.id !== excludeId &&
        node.dataroomId === dataroomId &&
        node.parentId === parentId &&
        node.deletedAt === null &&
        namesEqual(node.name, name),
    );
    if (taken) throw uniqueViolation();
  }
}

class FakeBlobStorage implements BlobStorage {
  readonly blobs = new Map<string, StoredBlob>();
  failNextPut = false;

  async put(input: PutBlobInput): Promise<void> {
    if (this.failNextPut) {
      this.failNextPut = false;
      throw new Error('storage unavailable');
    }
    this.blobs.set(input.key, { content: input.content, contentType: input.contentType });
  }

  async get(key: string): Promise<StoredBlob | undefined> {
    return this.blobs.get(key);
  }

  async deleteMany(keys: string[]): Promise<void> {
    for (const key of keys) this.blobs.delete(key);
  }
}

class FakeWorkspaceRepository implements WorkspaceRepository {
  readonly activities: ActivityRecord[] = [];
  private readonly favorites: FavoriteRecord[] = [];
  private seq = 0;

  constructor(private readonly membership: Membership) {}

  private user(id: string): User {
    return USERS.find((u) => u.id === id) ?? USERS[0];
  }

  async listUsers() {
    return USERS;
  }

  async findUser(id: string) {
    return USERS.find((u) => u.id === id);
  }

  async getDefaultUser() {
    return USERS[0];
  }

  async dataroomExists() {
    return true;
  }

  async nodeBelongsToDataroom() {
    return true;
  }

  async listMembers(dataroomId: string): Promise<MemberRecord[]> {
    return this.membership.entries
      .filter((m) => m.dataroomId === dataroomId)
      .map((m) => ({ dataroomId, user: this.user(m.userId), role: m.role, addedAt: m.addedAt }));
  }

  async findMemberRole(dataroomId: string, userId: string) {
    return this.membership.roleOf(dataroomId, userId);
  }

  async countOwners(dataroomId: string) {
    return this.membership.entries.filter((m) => m.dataroomId === dataroomId && m.role === 'owner')
      .length;
  }

  async addMember(dataroomId: string, userId: string, role: MemberRole): Promise<MemberRecord> {
    const entry = this.membership.add(dataroomId, userId, role);
    return { dataroomId, user: this.user(userId), role: entry.role, addedAt: entry.addedAt };
  }

  async updateMemberRole(dataroomId: string, userId: string, role: MemberRole) {
    const entry = this.membership.entries.find(
      (m) => m.dataroomId === dataroomId && m.userId === userId,
    );
    if (!entry) return undefined;
    entry.role = role;
    return { dataroomId, user: this.user(userId), role, addedAt: entry.addedAt };
  }

  async removeMember(dataroomId: string, userId: string) {
    const index = this.membership.entries.findIndex(
      (m) => m.dataroomId === dataroomId && m.userId === userId,
    );
    if (index >= 0) this.membership.entries.splice(index, 1);
  }

  async listFavorites() {
    return this.favorites;
  }

  async addFavorite(_userId: string, target: FavoriteTarget) {
    const favorite: FavoriteRecord = {
      dataroomId: target.dataroomId,
      dataroomName: 'Room',
      nodeId: target.nodeId,
      nodeName: null,
      nodeType: null,
      parentId: null,
      createdAt: Date.now(),
    };
    this.favorites.push(favorite);
    return favorite;
  }

  async removeFavorite() {
    return undefined;
  }

  async removeFavoritesForNodes() {
    return undefined;
  }

  async listActivity(dataroomId: string) {
    return this.activities.filter((entry) => entry.dataroomId === dataroomId);
  }

  async recordActivity(input: RecordActivityInput) {
    this.seq += 1;
    const entry: ActivityRecord = {
      id: `activity-${this.seq}`,
      dataroomId: input.dataroomId,
      nodeId: input.nodeId,
      nodeName: input.nodeName,
      nodeType: input.nodeType,
      action: input.action,
      actor: this.user(input.actorId),
      createdAt: Date.now(),
    };
    this.activities.unshift(entry);
    return entry;
  }

  async storageUsedBytes() {
    return 0;
  }
}

function setup(): {
  dataroomsService: DataroomsService;
  nodesService: NodesService;
  repo: FakeDataroomsRepository;
  storage: FakeBlobStorage;
  workspace: WorkspaceService;
  membership: Membership;
} {
  const membership = new Membership();
  const repo = new FakeDataroomsRepository(membership);
  const storage = new FakeBlobStorage();
  const workspace = new WorkspaceService(new FakeWorkspaceRepository(membership));
  // In-memory fakes have no transactions; the runner just executes the callback.
  const tx = { run: <T>(fn: () => Promise<T>): Promise<T> => fn() };
  return {
    dataroomsService: new DataroomsService(repo, storage, workspace, tx),
    nodesService: new NodesService(repo, storage, workspace, tx),
    repo,
    storage,
    workspace,
    membership,
  };
}

function pdfUpload(name = 'report.pdf', overrides: Partial<PdfUploadInput> = {}): PdfUploadInput {
  const content = createPdfBuffer();
  return {
    originalName: name,
    contentType: 'application/pdf',
    size: content.byteLength,
    content,
    ...overrides,
  };
}

function namesEqual(left: string, right: string): boolean {
  return left.toLocaleLowerCase() === right.toLocaleLowerCase();
}

function uniqueViolation(): Error & { code: '23505' } {
  const error = new Error('unique violation') as Error & { code: '23505' };
  error.code = '23505';
  return error;
}

describe('datarooms', () => {
  test('creates and lists datarooms with owner + role enrichment', async () => {
    const { dataroomsService } = setup();
    const created = await dataroomsService.createDataroom('Deal Docs', JANE);
    expect(created.name).toBe('Deal Docs');
    expect(created.myRole).toBe('owner');
    expect(created.memberCount).toBe(1);
    expect(created.owner?.id).toBe(JANE);
    expect(await dataroomsService.listDatarooms(JANE)).toHaveLength(1);
  });

  test('lists only the rooms the caller belongs to', async () => {
    const { dataroomsService } = setup();
    await dataroomsService.createDataroom('Jane Room', JANE);
    await dataroomsService.createDataroom('Alex Room', ALEX);
    expect((await dataroomsService.listDatarooms(JANE)).map((r) => r.name)).toEqual(['Jane Room']);
    expect((await dataroomsService.listDatarooms(ALEX)).map((r) => r.name)).toEqual(['Alex Room']);
  });

  test('rejects a duplicate dataroom name case-insensitively', async () => {
    const { dataroomsService } = setup();
    await dataroomsService.createDataroom('Deal Docs', JANE);
    await expect(dataroomsService.createDataroom('deal docs', JANE)).rejects.toBeInstanceOf(
      NameConflictError,
    );
  });

  test('trims and validates the dataroom name', async () => {
    const { dataroomsService } = setup();
    await expect(dataroomsService.createDataroom('   ', JANE)).rejects.toBeInstanceOf(
      InvalidInputError,
    );
    const created = await dataroomsService.createDataroom('  Deal Docs  ', JANE);
    expect(created.name).toBe('Deal Docs');
  });

  test('getDataroom hides rooms the caller cannot access (404)', async () => {
    const { dataroomsService } = setup();
    const room = await dataroomsService.createDataroom('Deal Docs', JANE);
    await expect(dataroomsService.getDataroom('missing', JANE)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(dataroomsService.getDataroom(room.id, MARK)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  test('only an owner can rename or delete a room', async () => {
    const { dataroomsService, workspace } = setup();
    const room = await dataroomsService.createDataroom('Deal Docs', JANE);
    await workspace.addMember(room.id, JANE, MARK, 'editor');
    await expect(dataroomsService.renameDataroom(room.id, 'New', MARK)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(dataroomsService.deleteDataroom(room.id, MARK)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    const renamed = await dataroomsService.renameDataroom(room.id, 'Renamed', JANE);
    expect(renamed.name).toBe('Renamed');
  });

  test('deleting a room hard-removes its nodes and blobs, including trashed ones', async () => {
    const { dataroomsService, nodesService, storage } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', JANE);
    const folder = await nodesService.createFolder(dataroom.id, null, 'Contracts', JANE);
    const live = await nodesService.createFile(dataroom.id, folder.id, pdfUpload('a.pdf'), JANE);
    const trashed = await nodesService.createFile(dataroom.id, null, pdfUpload('b.pdf'), JANE);
    await nodesService.deleteNode(trashed.id, JANE);

    const result = await dataroomsService.deleteDataroom(dataroom.id, JANE);
    expect(result.deletedNodeIds).toHaveLength(3);
    expect(storage.blobs.has(live.id)).toBe(false);
    expect(storage.blobs.has(trashed.id)).toBe(false);
    await expect(dataroomsService.getDataroom(dataroom.id, JANE)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('folders', () => {
  test('creates folders at the root and nested', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', JANE);
    const root = await nodesService.createFolder(dataroom.id, null, 'Contracts', JANE);
    const nested = await nodesService.createFolder(dataroom.id, root.id, 'Signed', JANE);
    expect(root.parentId).toBeNull();
    expect(nested.parentId).toBe(root.id);
  });

  test('rejects a duplicate folder name in the same parent', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', JANE);
    await nodesService.createFolder(dataroom.id, null, 'Contracts', JANE);
    await expect(
      nodesService.createFolder(dataroom.id, null, 'contracts', JANE),
    ).rejects.toBeInstanceOf(NameConflictError);
  });

  test('allows the same name in different parents', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', JANE);
    const a = await nodesService.createFolder(dataroom.id, null, 'A', JANE);
    const b = await nodesService.createFolder(dataroom.id, null, 'B', JANE);
    await nodesService.createFolder(dataroom.id, a.id, 'Same', JANE);
    const second = await nodesService.createFolder(dataroom.id, b.id, 'Same', JANE);
    expect(second.name).toBe('Same');
  });

  test('rejects a missing parent, a file parent, and a parent from another dataroom', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', JANE);
    const other = await dataroomsService.createDataroom('Other', JANE);
    const file = await nodesService.createFile(dataroom.id, null, pdfUpload(), JANE);
    const otherFolder = await nodesService.createFolder(other.id, null, 'Elsewhere', JANE);

    await expect(
      nodesService.createFolder(dataroom.id, 'missing', 'X', JANE),
    ).rejects.toBeInstanceOf(NodeNotFoundError);
    await expect(nodesService.createFolder(dataroom.id, file.id, 'X', JANE)).rejects.toBeInstanceOf(
      InvalidInputError,
    );
    await expect(
      nodesService.createFolder(dataroom.id, otherFolder.id, 'X', JANE),
    ).rejects.toBeInstanceOf(NodeNotFoundError);
  });
});

describe('file upload', () => {
  test('stores a valid PDF and round-trips its content', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', JANE);
    const node = await nodesService.createFile(dataroom.id, null, pdfUpload(), JANE);
    expect(node.type).toBe('file');
    const content = await nodesService.getFileContent(node.id, JANE);
    expect(content.content.equals(createPdfBuffer())).toBe(true);
    expect(content.contentType).toBe('application/pdf');
  });

  test('auto-suffixes a duplicate file name', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', JANE);
    await nodesService.createFile(dataroom.id, null, pdfUpload('report.pdf'), JANE);
    const second = await nodesService.createFile(dataroom.id, null, pdfUpload('report.pdf'), JANE);
    expect(second.name).toBe('report (1).pdf');
  });

  test('rejects a missing or empty file', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', JANE);
    await expect(nodesService.createFile(dataroom.id, null, undefined, JANE)).rejects.toBeInstanceOf(
      InvalidInputError,
    );
    await expect(
      nodesService.createFile(dataroom.id, null, pdfUpload('report.pdf', { size: 0 }), JANE),
    ).rejects.toBeInstanceOf(InvalidInputError);
  });

  test('rejects a file over the size limit', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', JANE);
    await expect(
      nodesService.createFile(
        dataroom.id,
        null,
        pdfUpload('report.pdf', { size: UPLOAD.maxFileSizeBytes + 1 }),
        JANE,
      ),
    ).rejects.toBeInstanceOf(PayloadTooLargeError);
  });

  test('rejects wrong MIME, wrong extension, and wrong signature', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', JANE);

    await expect(
      nodesService.createFile(
        dataroom.id,
        null,
        pdfUpload('report.pdf', { contentType: 'text/plain' }),
        JANE,
      ),
    ).rejects.toBeInstanceOf(InvalidInputError);

    await expect(
      nodesService.createFile(dataroom.id, null, pdfUpload('report.txt'), JANE),
    ).rejects.toBeInstanceOf(InvalidInputError);

    const fake = Buffer.from('not a pdf at all');
    await expect(
      nodesService.createFile(
        dataroom.id,
        null,
        pdfUpload('report.pdf', { content: fake, size: fake.byteLength }),
        JANE,
      ),
    ).rejects.toBeInstanceOf(InvalidInputError);
  });

  test('rolls back the metadata row when blob storage fails', async () => {
    const { dataroomsService, nodesService, repo, storage } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', JANE);
    storage.failNextPut = true;
    await expect(nodesService.createFile(dataroom.id, null, pdfUpload(), JANE)).rejects.toThrow(
      'storage unavailable',
    );
    expect([...repo.nodes.values()]).toHaveLength(0);
    expect(storage.blobs.size).toBe(0);
  });

  test('getFileContent throws for folders and missing nodes', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', JANE);
    const folder = await nodesService.createFolder(dataroom.id, null, 'Contracts', JANE);
    await expect(nodesService.getFileContent(folder.id, JANE)).rejects.toBeInstanceOf(
      FileNotFoundError,
    );
    await expect(nodesService.getFileContent('missing', JANE)).rejects.toBeInstanceOf(
      FileNotFoundError,
    );
  });
});

describe('nodes', () => {
  test('renames a node and rejects a sibling-taken name', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', JANE);
    await nodesService.createFolder(dataroom.id, null, 'Contracts', JANE);
    const folder = await nodesService.createFolder(dataroom.id, null, 'Drafts', JANE);
    await expect(nodesService.renameNode(folder.id, 'contracts', JANE)).rejects.toBeInstanceOf(
      NameConflictError,
    );
    const renamed = await nodesService.renameNode(folder.id, 'Final Drafts', JANE);
    expect(renamed.name).toBe('Final Drafts');
  });

  test('moves a node and auto-suffixes when the target folder has the name', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', JANE);
    const source = await nodesService.createFolder(dataroom.id, null, 'Source', JANE);
    const target = await nodesService.createFolder(dataroom.id, null, 'Target', JANE);
    await nodesService.createFile(dataroom.id, target.id, pdfUpload('report.pdf'), JANE);
    const file = await nodesService.createFile(dataroom.id, source.id, pdfUpload('report.pdf'), JANE);

    const moved = await nodesService.moveNode(file.id, target.id, JANE);

    expect(moved.parentId).toBe(target.id);
    expect(moved.name).toBe('report (1).pdf');
  });

  test('rejects moving a folder into itself or its descendant', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', JANE);
    const root = await nodesService.createFolder(dataroom.id, null, 'Root', JANE);
    const child = await nodesService.createFolder(dataroom.id, root.id, 'Child', JANE);

    await expect(nodesService.moveNode(root.id, root.id, JANE)).rejects.toBeInstanceOf(
      InvalidInputError,
    );
    await expect(nodesService.moveNode(root.id, child.id, JANE)).rejects.toBeInstanceOf(
      InvalidInputError,
    );
  });

  test('listNodes returns folders first, then files, alphabetically', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', JANE);
    await nodesService.createFile(dataroom.id, null, pdfUpload('b.pdf'), JANE);
    await nodesService.createFolder(dataroom.id, null, 'Zeta', JANE);
    await nodesService.createFile(dataroom.id, null, pdfUpload('a.pdf'), JANE);
    await nodesService.createFolder(dataroom.id, null, 'Alpha', JANE);
    const names = (await nodesService.listNodes(dataroom.id, JANE)).map((node) => node.name);
    expect(names).toEqual(['Alpha', 'Zeta', 'a.pdf', 'b.pdf']);
  });

  test('listNodes filters by case-insensitive name substring', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', JANE);
    const folder = await nodesService.createFolder(dataroom.id, null, 'Financials', JANE);
    await nodesService.createFile(dataroom.id, folder.id, pdfUpload('Q1 Balance Sheet.pdf'), JANE);
    await nodesService.createFile(dataroom.id, null, pdfUpload('Legal Summary.pdf'), JANE);

    const matches = await nodesService.listNodes(dataroom.id, JANE, { nameContains: 'balance' });
    expect(matches.map((node) => node.name)).toEqual(['Q1 Balance Sheet.pdf']);

    const empty = await nodesService.listNodes(dataroom.id, JANE, { nameContains: 'missing' });
    expect(empty).toEqual([]);
  });

  test('a viewer cannot mutate; an editor can', async () => {
    const { dataroomsService, nodesService, workspace } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', JANE);
    await workspace.addMember(dataroom.id, JANE, MARK, 'viewer');
    await expect(
      nodesService.createFolder(dataroom.id, null, 'Blocked', MARK),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await workspace.updateMemberRole(dataroom.id, JANE, MARK, 'editor');
    const folder = await nodesService.createFolder(dataroom.id, null, 'Allowed', MARK);
    expect(folder.name).toBe('Allowed');
  });

  test('a non-member cannot list nodes', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', JANE);
    await expect(nodesService.listNodes(dataroom.id, MARK)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('trash', () => {
  test('delete moves the subtree to trash, keeping blobs and hiding it from listings', async () => {
    const { dataroomsService, nodesService, storage } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', JANE);
    const root = await nodesService.createFolder(dataroom.id, null, 'Contracts', JANE);
    const nested = await nodesService.createFolder(dataroom.id, root.id, 'Signed', JANE);
    const file = await nodesService.createFile(dataroom.id, nested.id, pdfUpload(), JANE);

    const result = await nodesService.deleteNode(root.id, JANE);
    expect([...result.deletedIds].sort()).toEqual([file.id, root.id, nested.id].sort());
    // Blob is retained (only purge frees it) and the file can no longer be opened.
    expect(storage.blobs.has(file.id)).toBe(true);
    await expect(nodesService.getFileContent(file.id, JANE)).rejects.toBeInstanceOf(
      FileNotFoundError,
    );
    expect(await nodesService.listNodes(dataroom.id, JANE)).toHaveLength(0);
  });

  test('listTrash returns only subtree roots with their item counts', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', JANE);
    const root = await nodesService.createFolder(dataroom.id, null, 'Contracts', JANE);
    const nested = await nodesService.createFolder(dataroom.id, root.id, 'Signed', JANE);
    await nodesService.createFile(dataroom.id, nested.id, pdfUpload(), JANE);
    await nodesService.deleteNode(root.id, JANE);

    const trash = await nodesService.listTrash(JANE);
    expect(trash).toHaveLength(1);
    expect(trash[0].id).toBe(root.id);
    expect(trash[0].itemCount).toBe(2);
    expect(trash[0].dataroomName).toBe('Deal Docs');
    expect(trash[0].deletedBy?.id).toBe(JANE);
  });

  test('restore returns an item to its original parent', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', JANE);
    const folder = await nodesService.createFolder(dataroom.id, null, 'Contracts', JANE);
    const file = await nodesService.createFile(dataroom.id, folder.id, pdfUpload(), JANE);
    await nodesService.deleteNode(file.id, JANE);

    const restored = await nodesService.restoreNode(file.id, JANE);
    expect(restored.parentId).toBe(folder.id);
    expect(restored.deletedAt).toBeNull();
    expect((await nodesService.listNodes(dataroom.id, JANE)).map((n) => n.id)).toContain(file.id);
  });

  test('restore falls back to the room root when the original parent is gone', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', JANE);
    const parent = await nodesService.createFolder(dataroom.id, null, 'Parent', JANE);
    const child = await nodesService.createFolder(dataroom.id, parent.id, 'Child', JANE);
    await nodesService.deleteNode(parent.id, JANE); // trashes parent + child together

    const restored = await nodesService.restoreNode(child.id, JANE);
    expect(restored.parentId).toBeNull();
    expect(restored.deletedAt).toBeNull();
  });

  test('restore resolves a name clash with a live sibling', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', JANE);
    const first = await nodesService.createFile(dataroom.id, null, pdfUpload('report.pdf'), JANE);
    await nodesService.deleteNode(first.id, JANE);
    // Same name is free again while the first is trashed.
    await nodesService.createFile(dataroom.id, null, pdfUpload('report.pdf'), JANE);

    const restored = await nodesService.restoreNode(first.id, JANE);
    expect(restored.name).toBe('report (1).pdf');
  });

  test('purge permanently deletes rows and blobs', async () => {
    const { dataroomsService, nodesService, storage } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', JANE);
    const file = await nodesService.createFile(dataroom.id, null, pdfUpload(), JANE);
    await nodesService.deleteNode(file.id, JANE);

    const result = await nodesService.purgeNode(file.id, JANE);
    expect(result.deletedIds).toEqual([file.id]);
    expect(storage.blobs.has(file.id)).toBe(false);
    await expect(nodesService.restoreNode(file.id, JANE)).rejects.toBeInstanceOf(NodeNotFoundError);
  });

  test('restore and purge reject a node that is not in the trash', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', JANE);
    const file = await nodesService.createFile(dataroom.id, null, pdfUpload(), JANE);
    await expect(nodesService.restoreNode(file.id, JANE)).rejects.toBeInstanceOf(NodeNotFoundError);
    await expect(nodesService.purgeNode(file.id, JANE)).rejects.toBeInstanceOf(NodeNotFoundError);
  });

  test('emptyTrash purges every trashed root the caller can delete', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', JANE);
    const a = await nodesService.createFile(dataroom.id, null, pdfUpload('a.pdf'), JANE);
    const b = await nodesService.createFile(dataroom.id, null, pdfUpload('b.pdf'), JANE);
    await nodesService.deleteNode(a.id, JANE);
    await nodesService.deleteNode(b.id, JANE);

    const result = await nodesService.emptyTrash(JANE);
    expect([...result.deletedIds].sort()).toEqual([a.id, b.id].sort());
    expect(await nodesService.listTrash(JANE)).toHaveLength(0);
  });
});

describe('members', () => {
  test('adding an existing member is a conflict', async () => {
    const { dataroomsService, workspace } = setup();
    const room = await dataroomsService.createDataroom('Deal Docs', JANE);
    await workspace.addMember(room.id, JANE, MARK, 'editor');
    await expect(workspace.addMember(room.id, JANE, MARK, 'viewer')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  test('the last owner cannot be removed or demoted', async () => {
    const { dataroomsService, workspace } = setup();
    const room = await dataroomsService.createDataroom('Deal Docs', JANE);
    await expect(workspace.removeMember(room.id, JANE, JANE)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(workspace.updateMemberRole(room.id, JANE, JANE, 'editor')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  test('an owner can be demoted once a second owner exists', async () => {
    const { dataroomsService, workspace } = setup();
    const room = await dataroomsService.createDataroom('Deal Docs', JANE);
    await workspace.addMember(room.id, JANE, MARK, 'owner');
    const updated = await workspace.updateMemberRole(room.id, JANE, JANE, 'editor');
    expect(updated.role).toBe('editor');
  });

  test('only an owner can manage members', async () => {
    const { dataroomsService, workspace } = setup();
    const room = await dataroomsService.createDataroom('Deal Docs', JANE);
    await workspace.addMember(room.id, JANE, MARK, 'editor');
    await expect(workspace.addMember(room.id, MARK, ALEX, 'viewer')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
