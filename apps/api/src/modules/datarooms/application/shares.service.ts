import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { NodeShareStateDto, ShareDto, SharedFileDto } from '@repo/contracts';
import type { FileNode } from '@repo/domain';
import { SHARE_PASSWORD_ERROR_MESSAGES, validateSharePassword } from '@repo/domain';
import { TRANSACTION_RUNNER } from '../../../shared/database/transaction';
import type { TransactionRunner } from '../../../shared/database/transaction';
import { isUniqueViolation } from '../../../shared/errors/database';
import { BLOB_STORAGE } from '../../storage/blob-storage';
import type { BlobStorage } from '../../storage/blob-storage';
import { WorkspaceService } from '../../workspace/application/workspace.service';
import { DATAROOMS_REPOSITORY } from '../domain/datarooms.repository.port';
import type { DataroomsRepository } from '../domain/datarooms.repository.port';
import {
  InvalidInputError,
  InvalidSharePasswordError,
  NodeNotFoundError,
  ShareNotFoundError,
} from '../domain/errors';
import { hashSharePassword, verifySharePassword } from '../domain/share-password';
import { SHARES_REPOSITORY } from '../domain/shares.repository.port';
import type { NodeShare, SharesRepository } from '../domain/shares.repository.port';
import type { FileContentPayload } from './nodes.service';
import { ShareAttemptLimiter } from './share-attempt-limiter';

/** Retries for the astronomically rare slug collision on a new share. */
const SLUG_RETRIES = 3;

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

  /** Set or rotate a file's share-link password. Editor+; the slug stays stable. */
  async upsertShare(nodeId: string, rawPassword: string, userId: string): Promise<ShareDto> {
    const node = await this.getLiveFileNode(nodeId);
    await this.workspace.assertRole(node.dataroomId, userId, 'editor');
    const password = parseSharePassword(rawPassword);
    const passwordHash = await hashSharePassword(password);

    const existing = await this.shares.findByNodeId(nodeId);
    if (existing) {
      // Rotation: keep the slug + created_at, swap only the hash. Records no activity.
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

  /** Read a file's share state. Any member may read. */
  async getShareState(nodeId: string, userId: string): Promise<NodeShareStateDto> {
    const node = await this.getLiveFileNode(nodeId);
    await this.workspace.assertMember(node.dataroomId, userId);
    const share = await this.shares.findByNodeId(nodeId);
    return { share: share ? toShareDto(share) : null };
  }

  /** Remove a file's share link. Editor+; idempotent (no error when none exists). */
  async removeShare(nodeId: string, userId: string): Promise<void> {
    const node = await this.getLiveFileNode(nodeId);
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

  /** Public: verify a slug's password and return the shared file's metadata. */
  async unlockShare(slug: string, rawPassword: string): Promise<SharedFileDto> {
    const file = await this.openSharedFile(slug, rawPassword);
    return { name: file.name, size: file.size, contentType: file.contentType };
  }

  /** Public: verify a slug's password and return the shared file's bytes. */
  getSharedContent(slug: string, rawPassword: string): Promise<FileContentPayload> {
    return this.openSharedFile(slug, rawPassword);
  }

  /**
   * Shared unlock path for both public endpoints: resolve the live shared file,
   * enforce the rate limit, verify the password, then load the blob. An unknown
   * slug or a trashed/missing node is a 404 before the limiter is ever touched,
   * so those never count against the attempt budget.
   */
  private async openSharedFile(slug: string, rawPassword: string): Promise<FileContentPayload> {
    const { share, node } = await this.resolveActiveShare(slug);

    this.limiter.assertWithinLimit(slug);
    if (!(await verifySharePassword(rawPassword, share.passwordHash))) {
      this.limiter.recordFailure(slug);
      throw new InvalidSharePasswordError();
    }
    this.limiter.clear(slug);

    const blob = await this.storage.get(node.id);
    if (!blob) throw new ShareNotFoundError();
    return {
      name: node.name,
      size: node.size,
      content: blob.content,
      contentType: blob.contentType,
    };
  }

  /** Resolve a slug to its share + a live file node, or throw SHARE_NOT_FOUND. */
  private async resolveActiveShare(slug: string): Promise<{ share: NodeShare; node: FileNode }> {
    const share = await this.shares.findBySlug(slug);
    if (!share) throw new ShareNotFoundError();
    const node = await this.repository.findNode(share.nodeId);
    // A soft-deleted file keeps its share row, but the link stays dark until restore.
    if (!node || node.type !== 'file' || node.deletedAt !== null) throw new ShareNotFoundError();
    return { share, node };
  }

  /** A live (not trashed) file node — the only valid target for share management. */
  private async getLiveFileNode(nodeId: string): Promise<FileNode> {
    const node = await this.repository.findNode(nodeId);
    if (!node || node.deletedAt !== null) throw new NodeNotFoundError();
    if (node.type !== 'file') throw new InvalidInputError('Only files can be shared');
    return node;
  }
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
  return { slug: share.slug, createdAt: share.createdAt };
}
