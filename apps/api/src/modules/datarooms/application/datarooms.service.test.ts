import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import { UPLOAD } from '@repo/config';
import type { Dataroom, DataroomNode, FileNode, FolderNode } from '@repo/domain';
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
  DataroomsRepository,
  ListNodesOptions,
  MoveNodeInput,
} from '../domain/datarooms.repository.port';
import {
  DataroomNotFoundError,
  FileNotFoundError,
  InvalidInputError,
  NameConflictError,
  NodeNotFoundError,
  PayloadTooLargeError,
} from '../domain/errors';
import type { PdfUploadInput } from '../domain/pdf-upload';
import { DataroomsService } from './datarooms.service';
import { NodesService } from './nodes.service';

const USER_ID = '00000000-0000-4000-8000-000000000001';

class FakeDataroomsRepository implements DataroomsRepository {
  readonly nodes = new Map<string, DataroomNode>();
  private readonly datarooms = new Map<string, Dataroom>();
  private seq = 0;

  private nextId(): string {
    this.seq += 1;
    return `id-${this.seq}`;
  }

  async listDatarooms(): Promise<Dataroom[]> {
    return [...this.datarooms.values()].sort((a, b) => a.name.localeCompare(b.name));
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
  }

  async listNodes(dataroomId: string, options?: ListNodesOptions): Promise<DataroomNode[]> {
    const term = options?.nameContains?.toLocaleLowerCase();
    return [...this.nodes.values()].filter(
      (node) =>
        node.dataroomId === dataroomId && (!term || node.name.toLocaleLowerCase().includes(term)),
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

  async siblingNames(
    dataroomId: string,
    parentId: string | null,
    excludeId?: string,
  ): Promise<string[]> {
    return [...this.nodes.values()]
      .filter(
        (node) =>
          node.dataroomId === dataroomId && node.parentId === parentId && node.id !== excludeId,
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
    const taken = [...this.nodes.values()].some(
      (node) =>
        node.id !== excludeId &&
        node.dataroomId === dataroomId &&
        node.parentId === parentId &&
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
  private readonly members: MemberRecord[] = [];
  private readonly favorites: FavoriteRecord[] = [];
  private readonly user = {
    id: USER_ID,
    name: 'Jane Smith',
    email: 'jane@example.com',
    color: '#5865f2',
  };
  private seq = 0;

  async listUsers() {
    return [this.user];
  }

  async findUser(id: string) {
    return id === this.user.id ? this.user : undefined;
  }

  async getDefaultUser() {
    return this.user;
  }

  async dataroomExists() {
    return true;
  }

  async nodeBelongsToDataroom() {
    return true;
  }

  async listMembers(dataroomId: string) {
    return this.members.filter((member) => member.dataroomId === dataroomId);
  }

  async addMember(dataroomId: string, userId: string, role: 'owner' | 'editor' | 'viewer') {
    const existing = this.members.find(
      (member) => member.dataroomId === dataroomId && member.user.id === userId,
    );
    if (existing) {
      existing.role = role;
      return existing;
    }
    const member: MemberRecord = {
      dataroomId,
      user: this.user,
      role,
      addedAt: Date.now(),
    };
    this.members.push(member);
    return member;
  }

  async removeMember(dataroomId: string, userId: string) {
    const index = this.members.findIndex(
      (member) => member.dataroomId === dataroomId && member.user.id === userId,
    );
    if (index >= 0) this.members.splice(index, 1);
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
      actor: this.user,
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
} {
  const repo = new FakeDataroomsRepository();
  const storage = new FakeBlobStorage();
  const workspace = new WorkspaceService(new FakeWorkspaceRepository());
  return {
    dataroomsService: new DataroomsService(repo, storage, workspace),
    nodesService: new NodesService(repo, storage, workspace),
    repo,
    storage,
    workspace,
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
  test('creates and lists datarooms', async () => {
    const { dataroomsService } = setup();
    const created = await dataroomsService.createDataroom('Deal Docs', USER_ID);
    expect(created.name).toBe('Deal Docs');
    expect(await dataroomsService.listDatarooms()).toHaveLength(1);
  });

  test('rejects a duplicate dataroom name case-insensitively', async () => {
    const { dataroomsService } = setup();
    await dataroomsService.createDataroom('Deal Docs', USER_ID);
    await expect(dataroomsService.createDataroom('deal docs', USER_ID)).rejects.toBeInstanceOf(
      NameConflictError,
    );
  });

  test('trims and validates the dataroom name', async () => {
    const { dataroomsService } = setup();
    await expect(dataroomsService.createDataroom('   ', USER_ID)).rejects.toBeInstanceOf(
      InvalidInputError,
    );
    const created = await dataroomsService.createDataroom('  Deal Docs  ', USER_ID);
    expect(created.name).toBe('Deal Docs');
  });

  test('getDataroom throws for a missing id', async () => {
    const { dataroomsService } = setup();
    await expect(dataroomsService.getDataroom('missing')).rejects.toBeInstanceOf(
      DataroomNotFoundError,
    );
  });

  test('rename rejects a name taken by another dataroom but allows renaming to itself', async () => {
    const { dataroomsService } = setup();
    const first = await dataroomsService.createDataroom('First', USER_ID);
    await dataroomsService.createDataroom('Second', USER_ID);
    await expect(
      dataroomsService.renameDataroom(first.id, 'second', USER_ID),
    ).rejects.toBeInstanceOf(NameConflictError);
    const renamed = await dataroomsService.renameDataroom(first.id, 'First', USER_ID);
    expect(renamed.name).toBe('First');
  });

  test('delete returns contained node ids and removes their blobs', async () => {
    const { dataroomsService, nodesService, storage } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', USER_ID);
    const folder = await nodesService.createFolder(dataroom.id, null, 'Contracts', USER_ID);
    const file = await nodesService.createFile(dataroom.id, folder.id, pdfUpload(), USER_ID);
    expect(storage.blobs.has(file.id)).toBe(true);
    const result = await dataroomsService.deleteDataroom(dataroom.id);
    expect(result.deletedNodeIds).toHaveLength(2);
    expect(storage.blobs.has(file.id)).toBe(false);
    await expect(dataroomsService.getDataroom(dataroom.id)).rejects.toBeInstanceOf(
      DataroomNotFoundError,
    );
  });
});

describe('folders', () => {
  test('creates folders at the root and nested', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', USER_ID);
    const root = await nodesService.createFolder(dataroom.id, null, 'Contracts', USER_ID);
    const nested = await nodesService.createFolder(dataroom.id, root.id, 'Signed', USER_ID);
    expect(root.parentId).toBeNull();
    expect(nested.parentId).toBe(root.id);
  });

  test('rejects a duplicate folder name in the same parent', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', USER_ID);
    await nodesService.createFolder(dataroom.id, null, 'Contracts', USER_ID);
    await expect(
      nodesService.createFolder(dataroom.id, null, 'contracts', USER_ID),
    ).rejects.toBeInstanceOf(NameConflictError);
  });

  test('allows the same name in different parents', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', USER_ID);
    const a = await nodesService.createFolder(dataroom.id, null, 'A', USER_ID);
    const b = await nodesService.createFolder(dataroom.id, null, 'B', USER_ID);
    await nodesService.createFolder(dataroom.id, a.id, 'Same', USER_ID);
    const second = await nodesService.createFolder(dataroom.id, b.id, 'Same', USER_ID);
    expect(second.name).toBe('Same');
  });

  test('rejects a missing parent, a file parent, and a parent from another dataroom', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', USER_ID);
    const other = await dataroomsService.createDataroom('Other', USER_ID);
    const file = await nodesService.createFile(dataroom.id, null, pdfUpload(), USER_ID);
    const otherFolder = await nodesService.createFolder(other.id, null, 'Elsewhere', USER_ID);

    await expect(
      nodesService.createFolder(dataroom.id, 'missing', 'X', USER_ID),
    ).rejects.toBeInstanceOf(NodeNotFoundError);
    await expect(
      nodesService.createFolder(dataroom.id, file.id, 'X', USER_ID),
    ).rejects.toBeInstanceOf(InvalidInputError);
    await expect(
      nodesService.createFolder(dataroom.id, otherFolder.id, 'X', USER_ID),
    ).rejects.toBeInstanceOf(NodeNotFoundError);
  });
});

describe('file upload', () => {
  test('stores a valid PDF and round-trips its content', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', USER_ID);
    const node = await nodesService.createFile(dataroom.id, null, pdfUpload(), USER_ID);
    expect(node.type).toBe('file');
    const content = await nodesService.getFileContent(node.id);
    expect(content.content.equals(createPdfBuffer())).toBe(true);
    expect(content.contentType).toBe('application/pdf');
  });

  test('auto-suffixes a duplicate file name', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', USER_ID);
    await nodesService.createFile(dataroom.id, null, pdfUpload('report.pdf'), USER_ID);
    const second = await nodesService.createFile(
      dataroom.id,
      null,
      pdfUpload('report.pdf'),
      USER_ID,
    );
    expect(second.name).toBe('report (1).pdf');
  });

  test('rejects a missing or empty file', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', USER_ID);
    await expect(
      nodesService.createFile(dataroom.id, null, undefined, USER_ID),
    ).rejects.toBeInstanceOf(InvalidInputError);
    await expect(
      nodesService.createFile(dataroom.id, null, pdfUpload('report.pdf', { size: 0 }), USER_ID),
    ).rejects.toBeInstanceOf(InvalidInputError);
  });

  test('rejects a file over the size limit', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', USER_ID);
    await expect(
      nodesService.createFile(
        dataroom.id,
        null,
        pdfUpload('report.pdf', { size: UPLOAD.maxFileSizeBytes + 1 }),
        USER_ID,
      ),
    ).rejects.toBeInstanceOf(PayloadTooLargeError);
  });

  test('rejects wrong MIME, wrong extension, and wrong signature', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', USER_ID);

    await expect(
      nodesService.createFile(
        dataroom.id,
        null,
        pdfUpload('report.pdf', { contentType: 'text/plain' }),
        USER_ID,
      ),
    ).rejects.toBeInstanceOf(InvalidInputError);

    await expect(
      nodesService.createFile(dataroom.id, null, pdfUpload('report.txt'), USER_ID),
    ).rejects.toBeInstanceOf(InvalidInputError);

    const fake = Buffer.from('not a pdf at all');
    await expect(
      nodesService.createFile(
        dataroom.id,
        null,
        pdfUpload('report.pdf', { content: fake, size: fake.byteLength }),
        USER_ID,
      ),
    ).rejects.toBeInstanceOf(InvalidInputError);
  });

  test('rolls back the metadata row when blob storage fails', async () => {
    const { dataroomsService, nodesService, repo, storage } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', USER_ID);
    storage.failNextPut = true;
    await expect(nodesService.createFile(dataroom.id, null, pdfUpload(), USER_ID)).rejects.toThrow(
      'storage unavailable',
    );
    expect([...repo.nodes.values()]).toHaveLength(0);
    expect(storage.blobs.size).toBe(0);
  });

  test('getFileContent throws for folders and missing nodes', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', USER_ID);
    const folder = await nodesService.createFolder(dataroom.id, null, 'Contracts', USER_ID);
    await expect(nodesService.getFileContent(folder.id)).rejects.toBeInstanceOf(FileNotFoundError);
    await expect(nodesService.getFileContent('missing')).rejects.toBeInstanceOf(FileNotFoundError);
  });
});

describe('nodes', () => {
  test('renames a node and rejects a sibling-taken name', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', USER_ID);
    await nodesService.createFolder(dataroom.id, null, 'Contracts', USER_ID);
    const folder = await nodesService.createFolder(dataroom.id, null, 'Drafts', USER_ID);
    await expect(nodesService.renameNode(folder.id, 'contracts', USER_ID)).rejects.toBeInstanceOf(
      NameConflictError,
    );
    const renamed = await nodesService.renameNode(folder.id, 'Final Drafts', USER_ID);
    expect(renamed.name).toBe('Final Drafts');
  });

  test('moves a node and auto-suffixes when the target folder has the name', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', USER_ID);
    const source = await nodesService.createFolder(dataroom.id, null, 'Source', USER_ID);
    const target = await nodesService.createFolder(dataroom.id, null, 'Target', USER_ID);
    await nodesService.createFile(dataroom.id, target.id, pdfUpload('report.pdf'), USER_ID);
    const file = await nodesService.createFile(
      dataroom.id,
      source.id,
      pdfUpload('report.pdf'),
      USER_ID,
    );

    const moved = await nodesService.moveNode(file.id, target.id, USER_ID);

    expect(moved.parentId).toBe(target.id);
    expect(moved.name).toBe('report (1).pdf');
  });

  test('rejects moving a folder into itself or its descendant', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', USER_ID);
    const root = await nodesService.createFolder(dataroom.id, null, 'Root', USER_ID);
    const child = await nodesService.createFolder(dataroom.id, root.id, 'Child', USER_ID);

    await expect(nodesService.moveNode(root.id, root.id, USER_ID)).rejects.toBeInstanceOf(
      InvalidInputError,
    );
    await expect(nodesService.moveNode(root.id, child.id, USER_ID)).rejects.toBeInstanceOf(
      InvalidInputError,
    );
  });

  test('delete returns the whole subtree ids and removes file blobs', async () => {
    const { dataroomsService, nodesService, storage } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', USER_ID);
    const root = await nodesService.createFolder(dataroom.id, null, 'Contracts', USER_ID);
    const nested = await nodesService.createFolder(dataroom.id, root.id, 'Signed', USER_ID);
    const file = await nodesService.createFile(dataroom.id, nested.id, pdfUpload(), USER_ID);
    const result = await nodesService.deleteNode(root.id, USER_ID);
    expect([...result.deletedIds].sort()).toEqual([file.id, root.id, nested.id].sort());
    expect(storage.blobs.has(file.id)).toBe(false);
    await expect(nodesService.getFileContent(file.id)).rejects.toBeInstanceOf(FileNotFoundError);
  });

  test('listNodes returns folders first, then files, alphabetically', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', USER_ID);
    await nodesService.createFile(dataroom.id, null, pdfUpload('b.pdf'), USER_ID);
    await nodesService.createFolder(dataroom.id, null, 'Zeta', USER_ID);
    await nodesService.createFile(dataroom.id, null, pdfUpload('a.pdf'), USER_ID);
    await nodesService.createFolder(dataroom.id, null, 'Alpha', USER_ID);
    const names = (await nodesService.listNodes(dataroom.id)).map((node) => node.name);
    expect(names).toEqual(['Alpha', 'Zeta', 'a.pdf', 'b.pdf']);
  });

  test('listNodes filters by case-insensitive name substring', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs', USER_ID);
    const folder = await nodesService.createFolder(dataroom.id, null, 'Financials', USER_ID);
    await nodesService.createFile(
      dataroom.id,
      folder.id,
      pdfUpload('Q1 Balance Sheet.pdf'),
      USER_ID,
    );
    await nodesService.createFile(dataroom.id, null, pdfUpload('Legal Summary.pdf'), USER_ID);

    const matches = await nodesService.listNodes(dataroom.id, { nameContains: 'balance' });
    expect(matches.map((node) => node.name)).toEqual(['Q1 Balance Sheet.pdf']);

    const empty = await nodesService.listNodes(dataroom.id, { nameContains: 'missing' });
    expect(empty).toEqual([]);
  });
});
