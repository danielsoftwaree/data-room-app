import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { UPLOAD } from '@repo/config';
import type { Dataroom, DataroomNode, FileNode, FolderNode } from '@repo/domain';
import { createPdfBuffer } from '../../shared/test-utils';
import type { BlobStorage, PutBlobInput, StoredBlob } from '../storage/blob-storage';
import type { DataroomsRepository } from './datarooms.repository';
import { DataroomsService } from './datarooms.service';
import type { UploadedFilePayload } from './file-upload';

interface CreateFolderInput {
  dataroomId: string;
  parentId: string | null;
  name: string;
}

interface CreateFileNodeInput extends CreateFolderInput {
  size: number;
}

/**
 * In-memory stand-ins for DataroomsRepository and BlobStorage. They mirror
 * persistence semantics (cascade delete, sibling lookups) without touching
 * PostgreSQL or S3, so the service's business rules run in milliseconds.
 */
class FakeDataroomsRepository {
  readonly nodes = new Map<string, DataroomNode>();
  private readonly datarooms = new Map<string, Dataroom>();
  private seq = 0;

  private nextId(): string {
    this.seq += 1;
    return `id-${this.seq}`;
  }

  async listDatarooms(): Promise<Dataroom[]> {
    return [...this.datarooms.values()];
  }

  async createDataroom(name: string): Promise<Dataroom> {
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

  async listNodes(dataroomId: string): Promise<DataroomNode[]> {
    return [...this.nodes.values()].filter((node) => node.dataroomId === dataroomId);
  }

  async findNode(id: string): Promise<DataroomNode | undefined> {
    return this.nodes.get(id);
  }

  async createFolder(input: CreateFolderInput): Promise<FolderNode> {
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
  service: DataroomsService;
  repo: FakeDataroomsRepository;
  storage: FakeBlobStorage;
} {
  const repo = new FakeDataroomsRepository();
  const storage = new FakeBlobStorage();
  const service = new DataroomsService(repo as unknown as DataroomsRepository, storage);
  return { service, repo, storage };
}

function pdfUpload(
  name = 'report.pdf',
  overrides: Partial<UploadedFilePayload> = {},
): UploadedFilePayload {
  const buffer = createPdfBuffer();
  return {
    originalname: name,
    mimetype: 'application/pdf',
    size: buffer.byteLength,
    buffer,
    ...overrides,
  };
}

describe('datarooms', () => {
  test('creates and lists datarooms', async () => {
    const { service } = setup();
    const created = await service.createDataroom('Deal Docs');
    expect(created.name).toBe('Deal Docs');
    expect(await service.listDatarooms()).toHaveLength(1);
  });

  test('rejects a duplicate dataroom name case-insensitively', async () => {
    const { service } = setup();
    await service.createDataroom('Deal Docs');
    await expect(service.createDataroom('deal docs')).rejects.toBeInstanceOf(ConflictException);
  });

  test('trims and validates the dataroom name', async () => {
    const { service } = setup();
    await expect(service.createDataroom('   ')).rejects.toBeInstanceOf(BadRequestException);
    const created = await service.createDataroom('  Deal Docs  ');
    expect(created.name).toBe('Deal Docs');
  });

  test('getDataroom throws 404 for a missing id', async () => {
    const { service } = setup();
    await expect(service.getDataroom('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  test('rename rejects a name taken by another dataroom but allows renaming to itself', async () => {
    const { service } = setup();
    const first = await service.createDataroom('First');
    await service.createDataroom('Second');
    await expect(service.renameDataroom(first.id, 'second')).rejects.toBeInstanceOf(
      ConflictException,
    );
    const renamed = await service.renameDataroom(first.id, 'First');
    expect(renamed.name).toBe('First');
  });

  test('delete returns contained node ids and removes their blobs', async () => {
    const { service, storage } = setup();
    const dataroom = await service.createDataroom('Deal Docs');
    const folder = await service.createFolder(dataroom.id, null, 'Contracts');
    const file = await service.createFile(dataroom.id, folder.id, pdfUpload());
    expect(storage.blobs.has(file.id)).toBe(true);
    const result = await service.deleteDataroom(dataroom.id);
    expect(result.deletedNodeIds).toHaveLength(2);
    expect(storage.blobs.has(file.id)).toBe(false);
    await expect(service.getDataroom(dataroom.id)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('folders', () => {
  test('creates folders at the root and nested', async () => {
    const { service } = setup();
    const dataroom = await service.createDataroom('Deal Docs');
    const root = await service.createFolder(dataroom.id, null, 'Contracts');
    const nested = await service.createFolder(dataroom.id, root.id, 'Signed');
    expect(root.parentId).toBeNull();
    expect(nested.parentId).toBe(root.id);
  });

  test('rejects a duplicate folder name in the same parent', async () => {
    const { service } = setup();
    const dataroom = await service.createDataroom('Deal Docs');
    await service.createFolder(dataroom.id, null, 'Contracts');
    await expect(service.createFolder(dataroom.id, null, 'contracts')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  test('allows the same name in different parents', async () => {
    const { service } = setup();
    const dataroom = await service.createDataroom('Deal Docs');
    const a = await service.createFolder(dataroom.id, null, 'A');
    const b = await service.createFolder(dataroom.id, null, 'B');
    await service.createFolder(dataroom.id, a.id, 'Same');
    const second = await service.createFolder(dataroom.id, b.id, 'Same');
    expect(second.name).toBe('Same');
  });

  test('rejects a missing parent, a file parent, and a parent from another dataroom', async () => {
    const { service } = setup();
    const dataroom = await service.createDataroom('Deal Docs');
    const other = await service.createDataroom('Other');
    const file = await service.createFile(dataroom.id, null, pdfUpload());
    const otherFolder = await service.createFolder(other.id, null, 'Elsewhere');

    await expect(service.createFolder(dataroom.id, 'missing', 'X')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.createFolder(dataroom.id, file.id, 'X')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.createFolder(dataroom.id, otherFolder.id, 'X')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('file upload', () => {
  test('stores a valid PDF and round-trips its content', async () => {
    const { service } = setup();
    const dataroom = await service.createDataroom('Deal Docs');
    const node = await service.createFile(dataroom.id, null, pdfUpload());
    expect(node.type).toBe('file');
    const content = await service.getFileContent(node.id);
    expect(content.content.equals(createPdfBuffer())).toBe(true);
    expect(content.contentType).toBe('application/pdf');
  });

  test('auto-suffixes a duplicate file name', async () => {
    const { service } = setup();
    const dataroom = await service.createDataroom('Deal Docs');
    await service.createFile(dataroom.id, null, pdfUpload('report.pdf'));
    const second = await service.createFile(dataroom.id, null, pdfUpload('report.pdf'));
    expect(second.name).toBe('report (1).pdf');
  });

  test('rejects a missing or empty file', async () => {
    const { service } = setup();
    const dataroom = await service.createDataroom('Deal Docs');
    await expect(service.createFile(dataroom.id, null, undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.createFile(dataroom.id, null, pdfUpload('report.pdf', { size: 0 })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  test('rejects a file over the size limit with 413', async () => {
    const { service } = setup();
    const dataroom = await service.createDataroom('Deal Docs');
    await expect(
      service.createFile(
        dataroom.id,
        null,
        pdfUpload('report.pdf', { size: UPLOAD.maxFileSizeBytes + 1 }),
      ),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
  });

  test('rejects wrong MIME, wrong extension, and wrong signature', async () => {
    const { service } = setup();
    const dataroom = await service.createDataroom('Deal Docs');

    await expect(
      service.createFile(dataroom.id, null, pdfUpload('report.pdf', { mimetype: 'text/plain' })),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.createFile(dataroom.id, null, pdfUpload('report.txt')),
    ).rejects.toBeInstanceOf(BadRequestException);

    const fake = Buffer.from('not a pdf at all');
    await expect(
      service.createFile(
        dataroom.id,
        null,
        pdfUpload('report.pdf', { buffer: fake, size: fake.byteLength }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  test('rolls back the metadata row when blob storage fails', async () => {
    const { service, repo, storage } = setup();
    const dataroom = await service.createDataroom('Deal Docs');
    storage.failNextPut = true;
    await expect(service.createFile(dataroom.id, null, pdfUpload())).rejects.toThrow(
      'storage unavailable',
    );
    expect([...repo.nodes.values()]).toHaveLength(0);
    expect(storage.blobs.size).toBe(0);
  });

  test('getFileContent throws 404 for folders and missing nodes', async () => {
    const { service } = setup();
    const dataroom = await service.createDataroom('Deal Docs');
    const folder = await service.createFolder(dataroom.id, null, 'Contracts');
    await expect(service.getFileContent(folder.id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getFileContent('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('nodes', () => {
  test('renames a node and rejects a sibling-taken name', async () => {
    const { service } = setup();
    const dataroom = await service.createDataroom('Deal Docs');
    await service.createFolder(dataroom.id, null, 'Contracts');
    const folder = await service.createFolder(dataroom.id, null, 'Drafts');
    await expect(service.renameNode(folder.id, 'contracts')).rejects.toBeInstanceOf(
      ConflictException,
    );
    const renamed = await service.renameNode(folder.id, 'Final Drafts');
    expect(renamed.name).toBe('Final Drafts');
  });

  test('delete returns the whole subtree ids and removes file blobs', async () => {
    const { service, storage } = setup();
    const dataroom = await service.createDataroom('Deal Docs');
    const root = await service.createFolder(dataroom.id, null, 'Contracts');
    const nested = await service.createFolder(dataroom.id, root.id, 'Signed');
    const file = await service.createFile(dataroom.id, nested.id, pdfUpload());
    const result = await service.deleteNode(root.id);
    expect([...result.deletedIds].sort()).toEqual([file.id, root.id, nested.id].sort());
    expect(storage.blobs.has(file.id)).toBe(false);
    await expect(service.getFileContent(file.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  test('listNodes returns folders first, then files, alphabetically', async () => {
    const { service } = setup();
    const dataroom = await service.createDataroom('Deal Docs');
    await service.createFile(dataroom.id, null, pdfUpload('b.pdf'));
    await service.createFolder(dataroom.id, null, 'Zeta');
    await service.createFile(dataroom.id, null, pdfUpload('a.pdf'));
    await service.createFolder(dataroom.id, null, 'Alpha');
    const names = (await service.listNodes(dataroom.id)).map((node) => node.name);
    expect(names).toEqual(['Alpha', 'Zeta', 'a.pdf', 'b.pdf']);
  });
});
