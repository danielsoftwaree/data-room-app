import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import { UPLOAD } from '@repo/config';
import type { Dataroom, DataroomNode, FileNode, FolderNode } from '@repo/domain';
import { createPdfBuffer } from '../../../shared/test-utils';
import type { BlobStorage, PutBlobInput, StoredBlob } from '../../storage/blob-storage';
import type {
  CreateFileNodeInput,
  CreateFolderInput,
  DataroomsRepository,
  ListNodesOptions,
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

  async createDataroom(name: string): Promise<Dataroom> {
    this.assertDataroomNameAvailable(name);
    const now = Date.now();
    const dataroom: Dataroom = { id: this.nextId(), name, createdAt: now, updatedAt: now };
    this.datarooms.set(dataroom.id, dataroom);
    return dataroom;
  }

  async findDataroom(id: string): Promise<Dataroom | undefined> {
    return this.datarooms.get(id);
  }

  async renameDataroom(id: string, name: string): Promise<Dataroom | undefined> {
    const existing = this.datarooms.get(id);
    if (!existing) return undefined;
    this.assertDataroomNameAvailable(name, id);
    const updated: Dataroom = { ...existing, name, updatedAt: Date.now() };
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
    };
    this.nodes.set(node.id, node);
    return node;
  }

  async renameNode(id: string, name: string): Promise<DataroomNode | undefined> {
    const existing = this.nodes.get(id);
    if (!existing) return undefined;
    this.assertSiblingNameAvailable(existing.dataroomId, existing.parentId, name, id);
    const updated: DataroomNode = { ...existing, name, updatedAt: Date.now() };
    this.nodes.set(id, updated);
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

function setup(): {
  dataroomsService: DataroomsService;
  nodesService: NodesService;
  repo: FakeDataroomsRepository;
  storage: FakeBlobStorage;
} {
  const repo = new FakeDataroomsRepository();
  const storage = new FakeBlobStorage();
  return {
    dataroomsService: new DataroomsService(repo, storage),
    nodesService: new NodesService(repo, storage),
    repo,
    storage,
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
    const created = await dataroomsService.createDataroom('Deal Docs');
    expect(created.name).toBe('Deal Docs');
    expect(await dataroomsService.listDatarooms()).toHaveLength(1);
  });

  test('rejects a duplicate dataroom name case-insensitively', async () => {
    const { dataroomsService } = setup();
    await dataroomsService.createDataroom('Deal Docs');
    await expect(dataroomsService.createDataroom('deal docs')).rejects.toBeInstanceOf(
      NameConflictError,
    );
  });

  test('trims and validates the dataroom name', async () => {
    const { dataroomsService } = setup();
    await expect(dataroomsService.createDataroom('   ')).rejects.toBeInstanceOf(InvalidInputError);
    const created = await dataroomsService.createDataroom('  Deal Docs  ');
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
    const first = await dataroomsService.createDataroom('First');
    await dataroomsService.createDataroom('Second');
    await expect(dataroomsService.renameDataroom(first.id, 'second')).rejects.toBeInstanceOf(
      NameConflictError,
    );
    const renamed = await dataroomsService.renameDataroom(first.id, 'First');
    expect(renamed.name).toBe('First');
  });

  test('delete returns contained node ids and removes their blobs', async () => {
    const { dataroomsService, nodesService, storage } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs');
    const folder = await nodesService.createFolder(dataroom.id, null, 'Contracts');
    const file = await nodesService.createFile(dataroom.id, folder.id, pdfUpload());
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
    const dataroom = await dataroomsService.createDataroom('Deal Docs');
    const root = await nodesService.createFolder(dataroom.id, null, 'Contracts');
    const nested = await nodesService.createFolder(dataroom.id, root.id, 'Signed');
    expect(root.parentId).toBeNull();
    expect(nested.parentId).toBe(root.id);
  });

  test('rejects a duplicate folder name in the same parent', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs');
    await nodesService.createFolder(dataroom.id, null, 'Contracts');
    await expect(nodesService.createFolder(dataroom.id, null, 'contracts')).rejects.toBeInstanceOf(
      NameConflictError,
    );
  });

  test('allows the same name in different parents', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs');
    const a = await nodesService.createFolder(dataroom.id, null, 'A');
    const b = await nodesService.createFolder(dataroom.id, null, 'B');
    await nodesService.createFolder(dataroom.id, a.id, 'Same');
    const second = await nodesService.createFolder(dataroom.id, b.id, 'Same');
    expect(second.name).toBe('Same');
  });

  test('rejects a missing parent, a file parent, and a parent from another dataroom', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs');
    const other = await dataroomsService.createDataroom('Other');
    const file = await nodesService.createFile(dataroom.id, null, pdfUpload());
    const otherFolder = await nodesService.createFolder(other.id, null, 'Elsewhere');

    await expect(nodesService.createFolder(dataroom.id, 'missing', 'X')).rejects.toBeInstanceOf(
      NodeNotFoundError,
    );
    await expect(nodesService.createFolder(dataroom.id, file.id, 'X')).rejects.toBeInstanceOf(
      InvalidInputError,
    );
    await expect(
      nodesService.createFolder(dataroom.id, otherFolder.id, 'X'),
    ).rejects.toBeInstanceOf(NodeNotFoundError);
  });
});

describe('file upload', () => {
  test('stores a valid PDF and round-trips its content', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs');
    const node = await nodesService.createFile(dataroom.id, null, pdfUpload());
    expect(node.type).toBe('file');
    const content = await nodesService.getFileContent(node.id);
    expect(content.content.equals(createPdfBuffer())).toBe(true);
    expect(content.contentType).toBe('application/pdf');
  });

  test('auto-suffixes a duplicate file name', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs');
    await nodesService.createFile(dataroom.id, null, pdfUpload('report.pdf'));
    const second = await nodesService.createFile(dataroom.id, null, pdfUpload('report.pdf'));
    expect(second.name).toBe('report (1).pdf');
  });

  test('rejects a missing or empty file', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs');
    await expect(nodesService.createFile(dataroom.id, null, undefined)).rejects.toBeInstanceOf(
      InvalidInputError,
    );
    await expect(
      nodesService.createFile(dataroom.id, null, pdfUpload('report.pdf', { size: 0 })),
    ).rejects.toBeInstanceOf(InvalidInputError);
  });

  test('rejects a file over the size limit', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs');
    await expect(
      nodesService.createFile(
        dataroom.id,
        null,
        pdfUpload('report.pdf', { size: UPLOAD.maxFileSizeBytes + 1 }),
      ),
    ).rejects.toBeInstanceOf(PayloadTooLargeError);
  });

  test('rejects wrong MIME, wrong extension, and wrong signature', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs');

    await expect(
      nodesService.createFile(
        dataroom.id,
        null,
        pdfUpload('report.pdf', { contentType: 'text/plain' }),
      ),
    ).rejects.toBeInstanceOf(InvalidInputError);

    await expect(
      nodesService.createFile(dataroom.id, null, pdfUpload('report.txt')),
    ).rejects.toBeInstanceOf(InvalidInputError);

    const fake = Buffer.from('not a pdf at all');
    await expect(
      nodesService.createFile(
        dataroom.id,
        null,
        pdfUpload('report.pdf', { content: fake, size: fake.byteLength }),
      ),
    ).rejects.toBeInstanceOf(InvalidInputError);
  });

  test('rolls back the metadata row when blob storage fails', async () => {
    const { dataroomsService, nodesService, repo, storage } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs');
    storage.failNextPut = true;
    await expect(nodesService.createFile(dataroom.id, null, pdfUpload())).rejects.toThrow(
      'storage unavailable',
    );
    expect([...repo.nodes.values()]).toHaveLength(0);
    expect(storage.blobs.size).toBe(0);
  });

  test('getFileContent throws for folders and missing nodes', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs');
    const folder = await nodesService.createFolder(dataroom.id, null, 'Contracts');
    await expect(nodesService.getFileContent(folder.id)).rejects.toBeInstanceOf(FileNotFoundError);
    await expect(nodesService.getFileContent('missing')).rejects.toBeInstanceOf(FileNotFoundError);
  });
});

describe('nodes', () => {
  test('renames a node and rejects a sibling-taken name', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs');
    await nodesService.createFolder(dataroom.id, null, 'Contracts');
    const folder = await nodesService.createFolder(dataroom.id, null, 'Drafts');
    await expect(nodesService.renameNode(folder.id, 'contracts')).rejects.toBeInstanceOf(
      NameConflictError,
    );
    const renamed = await nodesService.renameNode(folder.id, 'Final Drafts');
    expect(renamed.name).toBe('Final Drafts');
  });

  test('delete returns the whole subtree ids and removes file blobs', async () => {
    const { dataroomsService, nodesService, storage } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs');
    const root = await nodesService.createFolder(dataroom.id, null, 'Contracts');
    const nested = await nodesService.createFolder(dataroom.id, root.id, 'Signed');
    const file = await nodesService.createFile(dataroom.id, nested.id, pdfUpload());
    const result = await nodesService.deleteNode(root.id);
    expect([...result.deletedIds].sort()).toEqual([file.id, root.id, nested.id].sort());
    expect(storage.blobs.has(file.id)).toBe(false);
    await expect(nodesService.getFileContent(file.id)).rejects.toBeInstanceOf(FileNotFoundError);
  });

  test('listNodes returns folders first, then files, alphabetically', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs');
    await nodesService.createFile(dataroom.id, null, pdfUpload('b.pdf'));
    await nodesService.createFolder(dataroom.id, null, 'Zeta');
    await nodesService.createFile(dataroom.id, null, pdfUpload('a.pdf'));
    await nodesService.createFolder(dataroom.id, null, 'Alpha');
    const names = (await nodesService.listNodes(dataroom.id)).map((node) => node.name);
    expect(names).toEqual(['Alpha', 'Zeta', 'a.pdf', 'b.pdf']);
  });

  test('listNodes filters by case-insensitive name substring', async () => {
    const { dataroomsService, nodesService } = setup();
    const dataroom = await dataroomsService.createDataroom('Deal Docs');
    const folder = await nodesService.createFolder(dataroom.id, null, 'Financials');
    await nodesService.createFile(dataroom.id, folder.id, pdfUpload('Q1 Balance Sheet.pdf'));
    await nodesService.createFile(dataroom.id, null, pdfUpload('Legal Summary.pdf'));

    const matches = await nodesService.listNodes(dataroom.id, { nameContains: 'balance' });
    expect(matches.map((node) => node.name)).toEqual(['Q1 Balance Sheet.pdf']);

    const empty = await nodesService.listNodes(dataroom.id, { nameContains: 'missing' });
    expect(empty).toEqual([]);
  });
});
