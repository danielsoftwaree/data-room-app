import type { Dataroom, DataroomNode, FileNode, FolderNode } from '@repo/domain';
import type {
  CreateFileNodeInput,
  CreateFolderInput,
  DataroomsRepository,
  ListNodesOptions,
} from '../../src/modules/datarooms/domain/datarooms.repository.port';
import type { BlobStorage, PutBlobInput, StoredBlob } from '../../src/modules/storage/blob-storage';

/**
 * In-memory stand-ins shared by the integration suite. They mirror the persistence
 * semantics of the real repository (unique names per level enforced upstream,
 * cascade deletes) without requiring PostgreSQL or S3.
 */
export class FakeDataroomsRepository implements DataroomsRepository {
  private readonly datarooms = new Map<string, Dataroom>();
  private readonly nodes = new Map<string, DataroomNode>();
  private seq = 0;

  private nextId(): string {
    this.seq += 1;
    return `00000000-0000-4000-8000-${String(this.seq).padStart(12, '0')}`;
  }

  async listDatarooms(): Promise<Dataroom[]> {
    return [...this.datarooms.values()];
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

export class FakeBlobStorage implements BlobStorage {
  private readonly blobs = new Map<string, StoredBlob>();

  async put(input: PutBlobInput): Promise<void> {
    this.blobs.set(input.key, { content: input.content, contentType: input.contentType });
  }

  async get(key: string): Promise<StoredBlob | undefined> {
    return this.blobs.get(key);
  }

  async deleteMany(keys: string[]): Promise<void> {
    for (const key of keys) this.blobs.delete(key);
  }
}

function namesEqual(left: string, right: string): boolean {
  return left.toLocaleLowerCase() === right.toLocaleLowerCase();
}

function uniqueViolation(): Error & { code: '23505' } {
  const error = new Error('unique violation') as Error & { code: '23505' };
  error.code = '23505';
  return error;
}
