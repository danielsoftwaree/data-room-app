import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { NodeShareStateDto, ShareDto, SharedChildDto, SharedNodeDto } from '@repo/contracts';
import type { DataroomNode, FileNode } from '@repo/domain';
import { SHARE_PASSWORD_ERROR_MESSAGES, validateSharePassword } from '@repo/domain';
import { TRANSACTION_RUNNER } from '../../../shared/database/transaction';
import type { TransactionRunner } from '../../../shared/database/transaction';
import { isUniqueViolation } from '../../../shared/errors/database';
import { DATAROOMS_REPOSITORY } from '../../datarooms/domain/datarooms.repository.port';
import type { DataroomsRepository } from '../../datarooms/domain/datarooms.repository.port';
import {
  InvalidInputError,
  InvalidSharePasswordError,
  NodeNotFoundError,
  SharePasswordRequiredError,
  ShareNotFoundError,
} from '../../datarooms/domain/errors';
import { BLOB_STORAGE } from '../../storage/blob-storage';
import type { BlobStorage } from '../../storage/blob-storage';
import { WorkspaceService } from '../../workspace/application/workspace.service';
import { hashSharePassword, verifySharePassword } from '../domain/share-password';
import { SHARES_REPOSITORY } from '../domain/shares.repository.port';
import type { NodeShare, SharesRepository } from '../domain/shares.repository.port';
import { ShareAttemptLimiter } from './share-attempt-limiter';

/** Retries for the astronomically rare slug collision on a new share. */
const SLUG_RETRIES = 3;

/** A shared file's bytes plus the headers the controller needs to stream them. */
export interface SharedContentPayload {
  name: string;
  size: number;
  content: Uint8Array;
  contentType: string;
}

@Injectable()
export class SharesService {
  constructor(
    @Inject(SHARES_REPOSITORY) private readonly shares: SharesRepository,
    @Inject(DATAROOMS_REPOSITORY) private readonly repository: DataroomsRepository,
    @Inject(BLOB_STORAGE) private readonly storage: BlobStorage,
    @Inject(WorkspaceService) private readonly workspace: WorkspaceService,
    @Inject(TRANSACTION_RUNNER) private readonly tx: TransactionRunner,
    @Inject(ShareAttemptLimiter) private readonly limiter: ShareAttemptLimiter,
  ) {}

  /**
   * Create a node's share link, or change its password. Editor+; the slug stays
   * stable across password changes. A null/absent password makes the link open
   * anonymously for anyone who has it.
   */
  async upsertShare(
    nodeId: string,
    rawPassword: string | null | undefined,
    userId: string,
  ): Promise<ShareDto> {
    const node = await this.getLiveNode(nodeId);
    await this.workspace.assertRole(node.dataroomId, userId, 'editor');
    const passwordHash =
      rawPassword == null || rawPassword === ''
        ? null
        : await hashSharePassword(parseSharePassword(rawPassword));

    const existing = await this.shares.findByNodeId(nodeId);
    if (existing) {
      // Password change: keep the slug + created_at, swap only the hash. Records no activity.
      const updated = await this.shares.updatePasswordHash(nodeId, passwordHash);
      return toShareDto(updated ?? existing);
    }

    // A brand-new share: a fresh slug plus a 'share.created' activity, in one
    // transaction. On a slug collision the failed statement aborts the surrounding
    // Postgres transaction, so we retry the whole tx.run with a new slug.
    for (let attempt = 0; attempt < SLUG_RETRIES; attempt++) {
      const slug = generateSlug();
      try {
        return await this.tx.run(async () => {
          const share = await this.shares.insert({ nodeId, slug, passwordHash, userId });
          await this.workspace.recordActivity({
            dataroomId: node.dataroomId,
            node,
            action: 'share.created',
            actorId: userId,
          });
          return toShareDto(share);
        });
      } catch (error) {
        if (isUniqueViolation(error) && attempt < SLUG_RETRIES - 1) continue;
        throw error;
      }
    }
    // Unreachable: the loop returns or throws on its final attempt.
    throw new Error('Failed to create share link');
  }

  /** Read a node's share state. Any member may read. */
  async getShareState(nodeId: string, userId: string): Promise<NodeShareStateDto> {
    const node = await this.getLiveNode(nodeId);
    await this.workspace.assertMember(node.dataroomId, userId);
    const share = await this.shares.findByNodeId(nodeId);
    return { share: share ? toShareDto(share) : null };
  }

  /** Remove a node's share link. Editor+; idempotent (no error when none exists). */
  async removeShare(nodeId: string, userId: string): Promise<void> {
    const node = await this.getLiveNode(nodeId);
    await this.workspace.assertRole(node.dataroomId, userId, 'editor');
    await this.tx.run(async () => {
      const existed = await this.shares.delete(nodeId);
      if (existed) {
        await this.workspace.recordActivity({
          dataroomId: node.dataroomId,
          node,
          action: 'share.removed',
          actorId: userId,
        });
      }
    });
  }

  /**
   * Public: open a share by slug. For a file, returns its metadata; for a
   * folder, its metadata plus the live subtree so the viewer can browse it.
   */
  async unlockShare(slug: string, rawPassword: string | null | undefined): Promise<SharedNodeDto> {
    const node = await this.openShare(slug, rawPassword);
    if (node.type === 'file') {
      return {
        name: node.name,
        type: 'file',
        updatedAt: node.updatedAt,
        size: node.size,
        contentType: 'application/pdf',
      };
    }
    return {
      name: node.name,
      type: 'folder',
      updatedAt: node.updatedAt,
      children: await this.sharedSubtree(node),
    };
  }

  /**
   * Public: return a shared file's bytes. For a folder share, `fileId` picks a
   * live file inside the shared subtree; for a file share it is ignored.
   */
  async getSharedContent(
    slug: string,
    rawPassword: string | null | undefined,
    fileId?: string | null,
  ): Promise<SharedContentPayload> {
    const shared = await this.openShare(slug, rawPassword);
    const file = shared.type === 'file' ? shared : await this.resolveSharedFile(shared, fileId);

    const blob = await this.storage.get(file.id);
    if (!blob) throw new ShareNotFoundError();
    return {
      name: file.name,
      size: file.size,
      content: blob.content,
      contentType: blob.contentType,
    };
  }

  /**
   * Shared unlock path for the public endpoints: resolve the live shared node,
   * then verify the password when the share has one. An unknown slug or a
   * trashed/missing node is a 404 before the limiter is ever touched, and a
   * missing-but-required password is a distinct 401 that never counts against
   * the attempt budget (it is the UI probing, not a guess).
   */
  private async openShare(
    slug: string,
    rawPassword: string | null | undefined,
  ): Promise<DataroomNode> {
    const { share, node } = await this.resolveActiveShare(slug);
    if (share.passwordHash === null) return node;

    if (rawPassword == null || rawPassword === '') throw new SharePasswordRequiredError();
    this.limiter.assertWithinLimit(slug);
    if (!(await verifySharePassword(rawPassword, share.passwordHash))) {
      this.limiter.recordFailure(slug);
      throw new InvalidSharePasswordError();
    }
    this.limiter.clear(slug);
    return node;
  }

  /** The live subtree under a shared folder, as public child DTOs (folders first, by name). */
  private async sharedSubtree(root: DataroomNode): Promise<SharedChildDto[]> {
    const nodes = await this.repository.listNodes(root.dataroomId);
    const live = nodes.filter((node) => node.deletedAt === null);
    const build = (parentId: string): SharedChildDto[] =>
      live
        .filter((node) => node.parentId === parentId)
        .sort(byFoldersThenName)
        .map((node) => {
          const base = { id: node.id, name: node.name, updatedAt: node.updatedAt };
          return node.type === 'file'
            ? { ...base, type: 'file' as const, size: node.size }
            : { ...base, type: 'folder' as const, children: build(node.id) };
        });
    return build(root.id);
  }

  /** A live file inside the shared folder's subtree, or SHARE_NOT_FOUND. */
  private async resolveSharedFile(
    root: DataroomNode,
    fileId: string | null | undefined,
  ): Promise<FileNode> {
    if (!fileId) throw new ShareNotFoundError();
    const file = await this.repository.findNode(fileId);
    if (!file || file.type !== 'file' || file.deletedAt !== null) throw new ShareNotFoundError();

    // Walk up the parent chain: the file must live under the shared folder.
    let parentId = file.parentId;
    while (parentId !== null) {
      if (parentId === root.id) return file;
      const parent = await this.repository.findNode(parentId);
      if (!parent || parent.deletedAt !== null) break;
      parentId = parent.parentId;
    }
    throw new ShareNotFoundError();
  }

  /** Resolve a slug to its share + a live node, or throw SHARE_NOT_FOUND. */
  private async resolveActiveShare(
    slug: string,
  ): Promise<{ share: NodeShare; node: DataroomNode }> {
    const share = await this.shares.findBySlug(slug);
    if (!share) throw new ShareNotFoundError();
    const node = await this.repository.findNode(share.nodeId);
    // A soft-deleted node keeps its share row, but the link stays dark until restore.
    if (!node || node.deletedAt !== null) throw new ShareNotFoundError();
    return { share, node };
  }

  /** A live (not trashed) node — the only valid target for share management. */
  private async getLiveNode(nodeId: string): Promise<DataroomNode> {
    const node = await this.repository.findNode(nodeId);
    if (!node || node.deletedAt !== null) throw new NodeNotFoundError();
    return node;
  }
}

function byFoldersThenName(a: DataroomNode, b: DataroomNode): number {
  if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
  return a.name.localeCompare(b.name);
}

function parseSharePassword(raw: string): string {
  const result = validateSharePassword(raw);
  if (!result.ok) throw new InvalidInputError(SHARE_PASSWORD_ERROR_MESSAGES[result.error]);
  return result.password;
}

function generateSlug(): string {
  return randomBytes(16).toString('base64url');
}

function toShareDto(share: NodeShare): ShareDto {
  return { slug: share.slug, createdAt: share.createdAt, hasPassword: share.passwordHash !== null };
}
