import type { Dataroom, DataroomNode, FileNode, FolderNode } from '@repo/domain';
import type { BlobStorage, PutBlobInput, StoredBlob } from '../modules/storage/blob-storage';

interface CreateFolderInput {
  dataroomId: string;
  parentId: string | null;
  name: string;
}

interface CreateFileNodeInput extends CreateFolderInput {
  size: number;
}

/**
 * In-memory stand-ins shared by the e2e suite. They mirror the persistence
 * semantics of the real repository (unique names per level enforced upstream,
 * cascade deletes) without requiring PostgreSQL or S3.
 */
export class FakeDataroomsRepository {
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
