import type { Dataroom, DataroomNode, FileNode, FolderNode, User } from '@repo/domain';
import type {
  CreateFileNodeInput,
  CreateFolderInput,
  DataroomsRepository,
  ListNodesOptions,
  MoveNodeInput,
} from '../../src/modules/datarooms/domain/datarooms.repository.port';
import type { BlobStorage, PutBlobInput, StoredBlob } from '../../src/modules/storage/blob-storage';
import type {
  ActivityRecord,
  FavoriteRecord,
  FavoriteTarget,
  MemberRecord,
  RecordActivityInput,
  WorkspaceRepository,
} from '../../src/modules/workspace/domain/workspace.repository.port';

export const DEMO_USERS: User[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Jane Smith',
    email: 'jane@example.com',
    color: '#5865f2',
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    name: 'Mark Reynolds',
    email: 'mark@example.com',
    color: '#35ed7e',
  },
];

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

  hasDataroom(id: string): boolean {
    return this.datarooms.has(id);
  }

  dataroomName(id: string): string {
    return this.datarooms.get(id)?.name ?? 'Data room';
  }

  nodeBelongsToDataroom(nodeId: string, dataroomId: string): boolean {
    return this.nodes.get(nodeId)?.dataroomId === dataroomId;
  }

  findNodeForWorkspace(nodeId: string): DataroomNode | undefined {
    return this.nodes.get(nodeId);
  }

  usedBytes(): number {
    return [...this.nodes.values()].reduce(
      (sum, node) => (node.type === 'file' ? sum + node.size : sum),
      0,
    );
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

export class FakeWorkspaceRepository implements WorkspaceRepository {
  private readonly members: MemberRecord[] = [];
  private readonly favorites: { userId: string; target: FavoriteTarget; createdAt: number }[] = [];
  private readonly activities: ActivityRecord[] = [];
  private seq = 0;

  constructor(private readonly datarooms: FakeDataroomsRepository) {}

  async listUsers(): Promise<User[]> {
    return DEMO_USERS;
  }

  async findUser(id: string): Promise<User | undefined> {
    return DEMO_USERS.find((user) => user.id === id);
  }

  async getDefaultUser(): Promise<User> {
    return DEMO_USERS[0];
  }

  async dataroomExists(id: string): Promise<boolean> {
    return this.datarooms.hasDataroom(id);
  }

  async nodeBelongsToDataroom(nodeId: string, dataroomId: string): Promise<boolean> {
    return this.datarooms.nodeBelongsToDataroom(nodeId, dataroomId);
  }

  async listMembers(dataroomId: string): Promise<MemberRecord[]> {
    return this.members.filter((member) => member.dataroomId === dataroomId);
  }

  async addMember(
    dataroomId: string,
    userId: string,
    role: 'owner' | 'editor' | 'viewer',
  ): Promise<MemberRecord> {
    const user = await this.findUser(userId);
    if (!user) throw new Error('User not found');
    const existing = this.members.find(
      (member) => member.dataroomId === dataroomId && member.user.id === userId,
    );
    if (existing) {
      existing.role = role;
      return existing;
    }
    const member: MemberRecord = { dataroomId, user, role, addedAt: Date.now() };
    this.members.push(member);
    return member;
  }

  async removeMember(dataroomId: string, userId: string): Promise<void> {
    const index = this.members.findIndex(
      (member) => member.dataroomId === dataroomId && member.user.id === userId,
    );
    if (index >= 0) this.members.splice(index, 1);
  }

  async listFavorites(userId: string): Promise<FavoriteRecord[]> {
    return this.favorites
      .filter((favorite) => favorite.userId === userId)
      .map((favorite) => this.toFavoriteRecord(favorite.target, favorite.createdAt));
  }

  async addFavorite(userId: string, target: FavoriteTarget): Promise<FavoriteRecord> {
    const existing = this.favorites.find(
      (favorite) =>
        favorite.userId === userId &&
        favorite.target.dataroomId === target.dataroomId &&
        favorite.target.nodeId === target.nodeId,
    );
    if (!existing) this.favorites.push({ userId, target, createdAt: Date.now() });
    return this.toFavoriteRecord(target, existing?.createdAt ?? Date.now());
  }

  async removeFavorite(userId: string, target: FavoriteTarget): Promise<void> {
    const index = this.favorites.findIndex(
      (favorite) =>
        favorite.userId === userId &&
        favorite.target.dataroomId === target.dataroomId &&
        favorite.target.nodeId === target.nodeId,
    );
    if (index >= 0) this.favorites.splice(index, 1);
  }

  async removeFavoritesForNodes(nodeIds: readonly string[]): Promise<void> {
    const ids = new Set(nodeIds);
    for (let i = this.favorites.length - 1; i >= 0; i--) {
      const nodeId = this.favorites[i].target.nodeId;
      if (nodeId && ids.has(nodeId)) this.favorites.splice(i, 1);
    }
  }

  async listActivity(
    dataroomId: string,
    options?: { nodeId?: string; limit?: number },
  ): Promise<ActivityRecord[]> {
    return this.activities
      .filter(
        (entry) =>
          entry.dataroomId === dataroomId && (!options?.nodeId || entry.nodeId === options.nodeId),
      )
      .slice(0, options?.limit ?? 25);
  }

  async recordActivity(input: RecordActivityInput): Promise<ActivityRecord> {
    this.seq += 1;
    const actor = (await this.findUser(input.actorId)) ?? DEMO_USERS[0];
    const entry: ActivityRecord = {
      id: `activity-${this.seq}`,
      dataroomId: input.dataroomId,
      nodeId: input.nodeId,
      nodeName: input.nodeName,
      nodeType: input.nodeType,
      action: input.action,
      actor,
      createdAt: Date.now(),
    };
    this.activities.unshift(entry);
    return entry;
  }

  async storageUsedBytes(): Promise<number> {
    return this.datarooms.usedBytes();
  }

  private toFavoriteRecord(target: FavoriteTarget, createdAt: number): FavoriteRecord {
    const node = target.nodeId ? this.datarooms.findNodeForWorkspace(target.nodeId) : undefined;
    return {
      dataroomId: target.dataroomId,
      dataroomName: this.datarooms.dataroomName(target.dataroomId),
      nodeId: target.nodeId,
      nodeName: node?.name ?? null,
      nodeType: node?.type ?? null,
      parentId: node?.parentId ?? null,
      createdAt,
    };
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
