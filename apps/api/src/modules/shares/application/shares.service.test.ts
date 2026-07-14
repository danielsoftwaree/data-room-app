import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SHARE_PASSWORD_ERROR_MESSAGES } from '@repo/domain';
import type { Dataroom, DataroomNode, FileNode, FolderNode, MemberRole, User } from '@repo/domain';
import type {
  DataroomForUser,
  DataroomMeta,
  DataroomsRepository,
} from '../../datarooms/domain/datarooms.repository.port';
import {
  InvalidInputError,
  InvalidSharePasswordError,
  NodeNotFoundError,
  SharePasswordRequiredError,
  ShareNotFoundError,
  ShareRateLimitedError,
} from '../../datarooms/domain/errors';
import type { BlobStorage, PutBlobInput, StoredBlob } from '../../storage/blob-storage';
import { WorkspaceService } from '../../workspace/application/workspace.service';
import type {
  ActivityRecord,
  MemberRecord,
  RecordActivityInput,
  WorkspaceRepository,
} from '../../workspace/domain/workspace.repository.port';
import type {
  InsertShareInput,
  NodeShare,
  SharesRepository,
} from '../domain/shares.repository.port';
import { ShareAttemptLimiter } from './share-attempt-limiter';
import { SharesService } from './shares.service';

const JANE = '00000000-0000-4000-8000-000000000001';
const MARK = '00000000-0000-4000-8000-000000000002';
const ALEX = '00000000-0000-4000-8000-000000000003';
const STRANGER = '00000000-0000-4000-8000-000000000009';

const USERS: User[] = [
  { id: JANE, name: 'Jane Smith', email: 'jane@acme.com', color: '#5865f2' },
  { id: MARK, name: 'Mark Reynolds', email: 'mark@acme.com', color: '#35ed7e' },
  { id: ALEX, name: 'Alex Kim', email: 'alex@acme.com', color: '#a78bfa' },
];

const ROOM = 'room-1';
const PDF = Buffer.from('%PDF-1.4 shared bytes');

function notUsed(): Error {
  return new Error('not exercised by the shares service');
}

class Membership {
  private readonly roles = new Map<string, MemberRole>();

  private key(dataroomId: string, userId: string): string {
    return `${dataroomId}:${userId}`;
  }

  add(dataroomId: string, userId: string, role: MemberRole): void {
    this.roles.set(this.key(dataroomId, userId), role);
  }

  roleOf(dataroomId: string, userId: string): MemberRole | null {
    return this.roles.get(this.key(dataroomId, userId)) ?? null;
  }
}

/** In-memory share store keyed by node id (one share per file, as in the DB). */
class FakeSharesRepository implements SharesRepository {
  readonly shares = new Map<string, NodeShare>();
  private seq = 0;

  async findByNodeId(nodeId: string): Promise<NodeShare | undefined> {
    return this.shares.get(nodeId);
  }

  async findBySlug(slug: string): Promise<NodeShare | undefined> {
    return [...this.shares.values()].find((share) => share.slug === slug);
  }

  async insert(input: InsertShareInput): Promise<NodeShare> {
    const slugTaken = [...this.shares.values()].some((share) => share.slug === input.slug);
    if (slugTaken || this.shares.has(input.nodeId)) throw uniqueViolation();
    this.seq += 1;
    const share: NodeShare = {
      nodeId: input.nodeId,
      slug: input.slug,
      passwordHash: input.passwordHash,
      createdAt: 1_700_000_000_000 + this.seq,
      createdBy: input.userId,
    };
    this.shares.set(input.nodeId, share);
    return share;
  }

  async updatePasswordHash(
    nodeId: string,
    passwordHash: string | null,
  ): Promise<NodeShare | undefined> {
    const existing = this.shares.get(nodeId);
    if (!existing) return undefined;
    const updated: NodeShare = { ...existing, passwordHash };
    this.shares.set(nodeId, updated);
    return updated;
  }

  async delete(nodeId: string): Promise<boolean> {
    return this.shares.delete(nodeId);
  }
}

/** Only findNode is exercised by SharesService; the rest satisfies the port. */
class FakeDataroomsRepository implements DataroomsRepository {
  readonly nodes = new Map<string, DataroomNode>();
  private seq = 0;

  seedFile(dataroomId: string, overrides: Partial<FileNode> = {}): FileNode {
    this.seq += 1;
    const node: FileNode = {
      id: `file-${this.seq}`,
      dataroomId,
      parentId: null,
      type: 'file',
      name: `file-${this.seq}.pdf`,
      size: PDF.byteLength,
      createdAt: 1,
      updatedAt: 1,
      createdBy: null,
      updatedBy: null,
      deletedAt: null,
      deletedBy: null,
      shareSlug: null,
      ...overrides,
    };
    this.nodes.set(node.id, node);
    return node;
  }

  seedFolder(dataroomId: string, overrides: Partial<FolderNode> = {}): FolderNode {
    this.seq += 1;
    const node: FolderNode = {
      id: `folder-${this.seq}`,
      dataroomId,
      parentId: null,
      type: 'folder',
      name: `folder-${this.seq}`,
      createdAt: 1,
      updatedAt: 1,
      createdBy: null,
      updatedBy: null,
      deletedAt: null,
      deletedBy: null,
      shareSlug: null,
      ...overrides,
    };
    this.nodes.set(node.id, node);
    return node;
  }

  trash(id: string): void {
    const node = this.nodes.get(id);
    if (node) this.nodes.set(id, { ...node, deletedAt: Date.now(), deletedBy: JANE });
  }

  restore(id: string): void {
    const node = this.nodes.get(id);
    if (node) this.nodes.set(id, { ...node, deletedAt: null, deletedBy: null });
  }

  async findNode(id: string): Promise<DataroomNode | undefined> {
    return this.nodes.get(id);
  }

  async lockDataroom(): Promise<void> {}
  async listDataroomsForUser(): Promise<DataroomForUser[]> {
    throw notUsed();
  }
  async dataroomMeta(): Promise<Map<string, DataroomMeta>> {
    throw notUsed();
  }
  async createDataroom(): Promise<Dataroom> {
    throw notUsed();
  }
  async findDataroom(): Promise<Dataroom | undefined> {
    throw notUsed();
  }
  async renameDataroom(): Promise<Dataroom | undefined> {
    throw notUsed();
  }
  async deleteDataroom(): Promise<void> {
    throw notUsed();
  }
  async listNodes(dataroomId: string): Promise<DataroomNode[]> {
    return [...this.nodes.values()].filter((node) => node.dataroomId === dataroomId);
  }
  async listDeletedNodes(): Promise<DataroomNode[]> {
    throw notUsed();
  }
  async createFolder(): Promise<FolderNode> {
    throw notUsed();
  }
  async createFileNode(): Promise<FileNode> {
    throw notUsed();
  }
  async renameNode(): Promise<DataroomNode | undefined> {
    throw notUsed();
  }
  async moveNode(): Promise<DataroomNode | undefined> {
    throw notUsed();
  }
  async deleteNode(): Promise<void> {
    throw notUsed();
  }
  async setNodesDeleted(): Promise<void> {
    throw notUsed();
  }
  async restoreNodes(): Promise<void> {
    throw notUsed();
  }
  async siblingNames(): Promise<string[]> {
    throw notUsed();
  }
}

class FakeBlobStorage implements BlobStorage {
  readonly blobs = new Map<string, StoredBlob>();

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

/** Only membership + activity are exercised; the rest satisfies the port. */
class FakeWorkspaceRepository implements WorkspaceRepository {
  readonly activities: RecordActivityInput[] = [];

  constructor(private readonly membership: Membership) {}

  async findMemberRole(dataroomId: string, userId: string): Promise<MemberRole | null> {
    return this.membership.roleOf(dataroomId, userId);
  }

  async recordActivity(input: RecordActivityInput): Promise<ActivityRecord> {
    this.activities.unshift(input);
    return {
      id: `activity-${this.activities.length}`,
      dataroomId: input.dataroomId,
      nodeId: input.nodeId,
      nodeName: input.nodeName,
      nodeType: input.nodeType,
      action: input.action,
      actor: USERS.find((user) => user.id === input.actorId) ?? USERS[0],
      createdAt: Date.now(),
    };
  }

  actions(): string[] {
    return this.activities.map((entry) => entry.action);
  }

  async listUsers(): Promise<User[]> {
    return USERS;
  }
  async findUser(id: string): Promise<User | undefined> {
    return USERS.find((user) => user.id === id);
  }
  async getDefaultUser(): Promise<User> {
    return USERS[0];
  }
  async upsertUser(): Promise<User> {
    throw notUsed();
  }
  async dataroomExists(): Promise<boolean> {
    throw notUsed();
  }
  async nodeBelongsToDataroom(): Promise<boolean> {
    throw notUsed();
  }
  async listMembers(): Promise<MemberRecord[]> {
    throw notUsed();
  }
  async countOwners(): Promise<number> {
    throw notUsed();
  }
  async addMember(): Promise<MemberRecord> {
    throw notUsed();
  }
  async updateMemberRole(): Promise<MemberRecord | undefined> {
    throw notUsed();
  }
  async removeMember(): Promise<void> {
    throw notUsed();
  }
  async listFavorites(): Promise<never> {
    throw notUsed();
  }
  async addFavorite(): Promise<never> {
    throw notUsed();
  }
  async removeFavorite(): Promise<void> {
    throw notUsed();
  }
  async removeFavoritesForNodes(): Promise<void> {
    throw notUsed();
  }
  async listActivity(): Promise<ActivityRecord[]> {
    throw notUsed();
  }
  async storageUsedBytes(): Promise<number> {
    throw notUsed();
  }
}

function uniqueViolation(): Error & { code: '23505' } {
  const error = new Error('unique violation') as Error & { code: '23505' };
  error.code = '23505';
  return error;
}

interface Harness {
  service: SharesService;
  shares: FakeSharesRepository;
  repo: FakeDataroomsRepository;
  storage: FakeBlobStorage;
  workspaceRepo: FakeWorkspaceRepository;
  membership: Membership;
  clock: { now: number };
}

function setup(): Harness {
  const membership = new Membership();
  membership.add(ROOM, JANE, 'owner');
  const shares = new FakeSharesRepository();
  const repo = new FakeDataroomsRepository();
  const storage = new FakeBlobStorage();
  const workspaceRepo = new FakeWorkspaceRepository(membership);
  const workspace = new WorkspaceService(workspaceRepo);
  const tx = { run: <T>(fn: () => Promise<T>): Promise<T> => fn() };
  const clock = { now: 1_000_000 };
  const limiter = new ShareAttemptLimiter(() => clock.now);
  const service = new SharesService(shares, repo, storage, workspace, tx, limiter);
  return { service, shares, repo, storage, workspaceRepo, membership, clock };
}

/** Seed a live, shareable PDF owned by ROOM and its blob. */
async function seedSharedFile(h: Harness, name = 'report.pdf'): Promise<FileNode> {
  const file = h.repo.seedFile(ROOM, { name });
  await h.storage.put({ key: file.id, content: PDF, contentType: 'application/pdf' });
  return file;
}

describe('shares service', () => {
  test('create → unlock → content happy path', async () => {
    const h = setup();
    const file = await seedSharedFile(h);

    const share = await h.service.upsertShare(file.id, 'secret1', JANE);
    expect(share.slug).toBeTruthy();

    const meta = await h.service.unlockShare(share.slug, 'secret1');
    expect(meta).toEqual({
      name: 'report.pdf',
      type: 'file',
      size: PDF.byteLength,
      contentType: 'application/pdf',
    });

    const content = await h.service.getSharedContent(share.slug, 'secret1');
    expect(content.content.equals(PDF)).toBe(true);
    expect(content.contentType).toBe('application/pdf');
  });

  test('keeps the slug (and createdAt) stable across a password rotation', async () => {
    const h = setup();
    const file = await seedSharedFile(h);

    const first = await h.service.upsertShare(file.id, 'secret1', JANE);
    const rotated = await h.service.upsertShare(file.id, 'secret2', JANE);
    expect(rotated.slug).toBe(first.slug);
    expect(rotated.createdAt).toBe(first.createdAt);

    // The new password works; the old one no longer does.
    expect((await h.service.unlockShare(first.slug, 'secret2')).name).toBe('report.pdf');
    await expect(h.service.unlockShare(first.slug, 'secret1')).rejects.toBeInstanceOf(
      InvalidSharePasswordError,
    );
  });

  test('generates a fresh slug after remove + recreate', async () => {
    const h = setup();
    const file = await seedSharedFile(h);

    const first = await h.service.upsertShare(file.id, 'secret1', JANE);
    await h.service.removeShare(file.id, JANE);
    const second = await h.service.upsertShare(file.id, 'secret1', JANE);
    expect(second.slug).not.toBe(first.slug);
    await expect(h.service.unlockShare(first.slug, 'secret1')).rejects.toBeInstanceOf(
      ShareNotFoundError,
    );
  });

  test('rejects a too-short password', async () => {
    const h = setup();
    const file = await seedSharedFile(h);
    const error = await h.service.upsertShare(file.id, 'abc', JANE).catch((e) => e);
    expect(error).toBeInstanceOf(InvalidInputError);
    expect((error as Error).message).toBe(SHARE_PASSWORD_ERROR_MESSAGES['too-short']);
  });

  test('a passwordless share opens anonymously; a protected one demands a password', async () => {
    const h = setup();
    const file = await seedSharedFile(h);

    const open = await h.service.upsertShare(file.id, null, JANE);
    expect(open.hasPassword).toBe(false);
    expect((await h.service.unlockShare(open.slug, null)).name).toBe('report.pdf');

    const locked = await h.service.upsertShare(file.id, 'secret1', JANE);
    expect(locked.hasPassword).toBe(true);
    await expect(h.service.unlockShare(locked.slug, null)).rejects.toBeInstanceOf(
      SharePasswordRequiredError,
    );
    // Removing the password again re-opens the link.
    await h.service.upsertShare(file.id, null, JANE);
    expect((await h.service.unlockShare(locked.slug, null)).name).toBe('report.pdf');
  });

  test('a shared folder unlocks to its live subtree and serves nested file content', async () => {
    const h = setup();
    const folder = h.repo.seedFolder(ROOM, { name: 'Legal' });
    const sub = h.repo.seedFolder(ROOM, { name: 'Contracts', parentId: folder.id });
    const inner = h.repo.seedFile(ROOM, { name: 'nda.pdf', parentId: sub.id });
    await h.storage.put({ key: inner.id, content: PDF, contentType: 'application/pdf' });
    const outside = await seedSharedFile(h, 'outside.pdf');

    const share = await h.service.upsertShare(folder.id, null, JANE);
    const meta = await h.service.unlockShare(share.slug, null);
    expect(meta.type).toBe('folder');
    expect(meta.children).toEqual([
      {
        id: sub.id,
        name: 'Contracts',
        type: 'folder',
        children: [{ id: inner.id, name: 'nda.pdf', type: 'file', size: PDF.byteLength }],
      },
    ]);

    const content = await h.service.getSharedContent(share.slug, null, inner.id);
    expect(content.name).toBe('nda.pdf');

    // A file outside the shared subtree (or no fileId at all) is a 404.
    await expect(h.service.getSharedContent(share.slug, null, outside.id)).rejects.toBeInstanceOf(
      ShareNotFoundError,
    );
    await expect(h.service.getSharedContent(share.slug, null)).rejects.toBeInstanceOf(
      ShareNotFoundError,
    );
  });

  test('unlock/content of a trashed file is SHARE_NOT_FOUND; restore revives the link', async () => {
    const h = setup();
    const file = await seedSharedFile(h);
    const share = await h.service.upsertShare(file.id, 'secret1', JANE);

    h.repo.trash(file.id);
    await expect(h.service.unlockShare(share.slug, 'secret1')).rejects.toBeInstanceOf(
      ShareNotFoundError,
    );
    await expect(h.service.getSharedContent(share.slug, 'secret1')).rejects.toBeInstanceOf(
      ShareNotFoundError,
    );

    h.repo.restore(file.id);
    expect((await h.service.unlockShare(share.slug, 'secret1')).name).toBe('report.pdf');
  });

  test('unknown slug is SHARE_NOT_FOUND and does not count against the rate limit', async () => {
    const h = setup();
    for (let i = 0; i < 20; i++) {
      await expect(h.service.unlockShare('does-not-exist', 'secret1')).rejects.toBeInstanceOf(
        ShareNotFoundError,
      );
    }
  });

  test('a wrong password is INVALID_SHARE_PASSWORD', async () => {
    const h = setup();
    const file = await seedSharedFile(h);
    const share = await h.service.upsertShare(file.id, 'secret1', JANE);
    await expect(h.service.unlockShare(share.slug, 'nope')).rejects.toBeInstanceOf(
      InvalidSharePasswordError,
    );
  });

  test('rate-limits after 10 failures, and a success clears the counter', async () => {
    const h = setup();
    const file = await seedSharedFile(h);
    const share = await h.service.upsertShare(file.id, 'secret1', JANE);

    for (let i = 0; i < 10; i++) {
      await expect(h.service.unlockShare(share.slug, 'wrong')).rejects.toBeInstanceOf(
        InvalidSharePasswordError,
      );
    }
    // The 11th rapid attempt is blocked, even with the correct password.
    await expect(h.service.unlockShare(share.slug, 'secret1')).rejects.toBeInstanceOf(
      ShareRateLimitedError,
    );
  });

  test('a successful unlock resets the failure counter', async () => {
    const h = setup();
    const file = await seedSharedFile(h);
    const share = await h.service.upsertShare(file.id, 'secret1', JANE);

    for (let i = 0; i < 8; i++) {
      await expect(h.service.unlockShare(share.slug, 'wrong')).rejects.toBeInstanceOf(
        InvalidSharePasswordError,
      );
    }
    await h.service.unlockShare(share.slug, 'secret1'); // clears the counter

    // 8 more failures would have tripped the limit (16 > 10) had it not reset.
    for (let i = 0; i < 8; i++) {
      await expect(h.service.unlockShare(share.slug, 'wrong')).rejects.toBeInstanceOf(
        InvalidSharePasswordError,
      );
    }
  });

  test('a stale window is discarded so attempts resume after 60s', async () => {
    const h = setup();
    const file = await seedSharedFile(h);
    const share = await h.service.upsertShare(file.id, 'secret1', JANE);

    for (let i = 0; i < 10; i++) {
      await h.service.unlockShare(share.slug, 'wrong').catch(() => undefined);
    }
    await expect(h.service.unlockShare(share.slug, 'secret1')).rejects.toBeInstanceOf(
      ShareRateLimitedError,
    );

    h.clock.now += 60_000; // window elapsed
    expect((await h.service.unlockShare(share.slug, 'secret1')).name).toBe('report.pdf');
  });

  test('viewers cannot mutate, editors can, and any member can read state', async () => {
    const h = setup();
    h.membership.add(ROOM, MARK, 'viewer');
    h.membership.add(ROOM, ALEX, 'editor');
    const file = await seedSharedFile(h);

    await expect(h.service.upsertShare(file.id, 'secret1', MARK)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(h.service.removeShare(file.id, MARK)).rejects.toBeInstanceOf(ForbiddenException);

    const share = await h.service.upsertShare(file.id, 'secret1', ALEX);
    const viewerState = await h.service.getShareState(file.id, MARK);
    expect(viewerState.share?.slug).toBe(share.slug);

    await expect(h.service.getShareState(file.id, STRANGER)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  test('getShareState returns null when there is no share', async () => {
    const h = setup();
    const file = await seedSharedFile(h);
    expect(await h.service.getShareState(file.id, JANE)).toEqual({ share: null });
  });

  test('remove is idempotent and 404s a missing node', async () => {
    const h = setup();
    const file = await seedSharedFile(h);
    await expect(h.service.removeShare(file.id, JANE)).resolves.toBeUndefined();
    await expect(h.service.removeShare('missing', JANE)).rejects.toBeInstanceOf(NodeNotFoundError);
  });

  test('records share.created on create, nothing on rotation, share.removed on delete', async () => {
    const h = setup();
    const file = await seedSharedFile(h);

    await h.service.upsertShare(file.id, 'secret1', JANE);
    expect(h.workspaceRepo.actions()).toEqual(['share.created']);

    await h.service.upsertShare(file.id, 'secret2', JANE); // rotation records nothing
    expect(h.workspaceRepo.actions()).toEqual(['share.created']);

    await h.service.removeShare(file.id, JANE);
    expect(h.workspaceRepo.actions().filter((a) => a.startsWith('share.'))).toEqual([
      'share.removed',
      'share.created',
    ]);

    // A no-op remove records nothing further.
    await h.service.removeShare(file.id, JANE);
    expect(h.workspaceRepo.actions().filter((a) => a === 'share.removed')).toHaveLength(1);
  });
});
