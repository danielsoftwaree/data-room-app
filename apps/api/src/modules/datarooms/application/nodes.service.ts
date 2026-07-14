import { Inject, Injectable } from '@nestjs/common';
import { UPLOAD } from '@repo/config';
import type { EmptyTrashResult, TrashItemDto } from '@repo/contracts';
import type { DataroomNode, FileNode, FolderNode } from '@repo/domain';
import {
  collectSubtreeIds,
  nextAvailableName,
  roleAtLeast,
  selectTrashRoots,
  sortNodes,
  validateMoveTarget,
} from '@repo/domain';
import { TRANSACTION_RUNNER } from '../../../shared/database/transaction';
import type { TransactionRunner } from '../../../shared/database/transaction';
import { isUniqueViolation } from '../../../shared/errors/database';
import { BLOB_STORAGE } from '../../storage/blob-storage';
import type { BlobStorage } from '../../storage/blob-storage';
import { WorkspaceService } from '../../workspace/application/workspace.service';
import type { DataroomsRepository, ListNodesOptions } from '../domain/datarooms.repository.port';
import { DATAROOMS_REPOSITORY } from '../domain/datarooms.repository.port';
import {
  FileNotFoundError,
  InvalidInputError,
  NameConflictError,
  NodeNotFoundError,
  PayloadTooLargeError,
} from '../domain/errors';
import { parseNodeName } from '../domain/node-name';
import { PdfUpload } from '../domain/pdf-upload';
import type { PdfUploadInput } from '../domain/pdf-upload';

export interface FileContentPayload {
  name: string;
  size: number;
  content: Buffer;
  contentType: string;
}

@Injectable()
export class NodesService {
  constructor(
    @Inject(DATAROOMS_REPOSITORY) private readonly repository: DataroomsRepository,
    @Inject(BLOB_STORAGE) private readonly storage: BlobStorage,
    @Inject(WorkspaceService) private readonly workspace: WorkspaceService,
    @Inject(TRANSACTION_RUNNER) private readonly tx: TransactionRunner,
  ) {}

  async listNodes(
    dataroomId: string,
    userId: string,
    options?: ListNodesOptions,
  ): Promise<DataroomNode[]> {
    await this.workspace.assertMember(dataroomId, userId);
    return sortNodes(
      await this.repository.listNodes(dataroomId, normalizeListNodesOptions(options)),
    );
  }

  async createFolder(
    dataroomId: string,
    parentId: string | null,
    rawName: string,
    userId: string,
  ): Promise<FolderNode> {
    await this.workspace.assertRole(dataroomId, userId, 'editor');
    await this.assertParentFolder(dataroomId, parentId);
    const name = parseNodeName(rawName);
    try {
      return await this.tx.run(async () => {
        const node = await this.repository.createFolder({ dataroomId, parentId, name, userId });
        await this.workspace.recordActivity({
          dataroomId,
          node,
          action: 'folder.created',
          actorId: userId,
        });
        return node;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new NameConflictError(`"${name}" already exists in this folder`);
      }
      throw error;
    }
  }

  async createFile(
    dataroomId: string,
    parentId: string | null,
    file: PdfUploadInput | undefined,
    userId: string,
  ): Promise<FileNode> {
    await this.workspace.assertRole(dataroomId, userId, 'editor');
    await this.assertParentFolder(dataroomId, parentId);

    const upload = parsePdfUpload(file);
    const desiredName = parseNodeName(upload.originalName);

    for (let attempt = 0; attempt < 5; attempt++) {
      const name = nextAvailableName(
        await this.repository.siblingNames(dataroomId, parentId),
        desiredName,
      );
      let node: FileNode;
      try {
        node = await this.repository.createFileNode({
          dataroomId,
          parentId,
          name,
          size: upload.size,
          userId,
        });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        continue;
      }

      try {
        await this.storage.put({
          key: node.id,
          content: Buffer.from(upload.content),
          contentType: upload.contentType,
        });
      } catch (error) {
        await this.repository.deleteNode(node.id).catch(() => undefined);
        throw error;
      }
      await this.workspace.recordActivity({
        dataroomId,
        node,
        action: 'file.uploaded',
        actorId: userId,
      });
      return node;
    }

    throw new NameConflictError(`"${desiredName}" already exists in this folder`);
  }

  async renameNode(nodeId: string, rawName: string, userId: string): Promise<DataroomNode> {
    const node = await this.getLiveNode(nodeId);
    await this.workspace.assertRole(node.dataroomId, userId, 'editor');
    const name = parseNodeName(rawName);
    try {
      return await this.tx.run(async () => {
        const updated = await this.repository.renameNode(nodeId, name, userId);
        if (!updated) throw new NodeNotFoundError();
        await this.workspace.recordActivity({
          dataroomId: updated.dataroomId,
          node: updated,
          action: 'node.renamed',
          actorId: userId,
        });
        return updated;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new NameConflictError(`"${name}" already exists in this folder`);
      }
      throw error;
    }
  }

  async moveNode(nodeId: string, parentId: string | null, userId: string): Promise<DataroomNode> {
    const node = await this.getLiveNode(nodeId);
    await this.workspace.assertRole(node.dataroomId, userId, 'editor');
    // Locked transaction: cycle validation reads the tree, so a concurrent
    // move must not change it between the check and the write.
    return this.tx.run(async () => {
      await this.repository.lockDataroom(node.dataroomId);
      const dataroomNodes = await this.repository.listNodes(node.dataroomId);
      const validation = validateMoveTarget(dataroomNodes, nodeId, parentId);
      if (!validation.ok) throw moveValidationError(validation.error);

      const name = nextAvailableName(
        await this.repository.siblingNames(node.dataroomId, parentId, node.id),
        node.name,
      );
      const updated = await this.repository.moveNode({ id: nodeId, parentId, name, userId });
      if (!updated) throw new NodeNotFoundError();
      await this.workspace.recordActivity({
        dataroomId: updated.dataroomId,
        node: updated,
        action: 'node.moved',
        actorId: userId,
      });
      return updated;
    });
  }

  /** Move a node and its subtree to the trash. Blobs and favorites are preserved. */
  async deleteNode(nodeId: string, userId: string): Promise<{ deletedIds: string[] }> {
    const node = await this.getLiveNode(nodeId);
    await this.workspace.assertRole(node.dataroomId, userId, 'editor');
    // Locked transaction: the subtree is collected in memory, so a child
    // created mid-delete must not survive under a trashed parent.
    return this.tx.run(async () => {
      await this.repository.lockDataroom(node.dataroomId);
      const dataroomNodes = await this.repository.listNodes(node.dataroomId);
      const deletedIds = collectSubtreeIds(dataroomNodes, nodeId);
      await this.repository.setNodesDeleted(deletedIds, userId);
      await this.workspace.recordActivity({
        dataroomId: node.dataroomId,
        node,
        action: 'node.deleted',
        actorId: userId,
      });
      return { deletedIds };
    });
  }

  /** Bring a trashed subtree back. Lands at the original parent, or the room root
   *  if that parent is gone, resolving any name clash with a numeric suffix. */
  async restoreNode(nodeId: string, userId: string): Promise<DataroomNode> {
    const node = await this.repository.findNode(nodeId);
    if (!node || node.deletedAt === null) throw new NodeNotFoundError('Trashed item not found');
    await this.workspace.assertRole(node.dataroomId, userId, 'editor');

    // Locked transaction: the target parent, the free name, and the trashed
    // subtree are all read before writing — none may shift mid-restore.
    return this.tx.run(async () => {
      await this.repository.lockDataroom(node.dataroomId);
      const targetParentId = await this.resolveRestoreParent(node);
      const name = nextAvailableName(
        await this.repository.siblingNames(node.dataroomId, targetParentId, node.id),
        node.name,
      );

      const deletedNodes = await this.repository.listDeletedNodes([node.dataroomId]);
      const subtreeIds = collectSubtreeIds(deletedNodes, nodeId);

      // Reparent/rename the root while it is still trashed (the live-name unique
      // index ignores it), then clear the trash flag on the whole subtree.
      if (targetParentId !== node.parentId || name !== node.name) {
        await this.repository.moveNode({ id: nodeId, parentId: targetParentId, name, userId });
      }
      await this.repository.restoreNodes(subtreeIds);

      const restored = await this.repository.findNode(nodeId);
      if (!restored) throw new NodeNotFoundError();
      await this.workspace.recordActivity({
        dataroomId: node.dataroomId,
        node: restored,
        action: 'node.restored',
        actorId: userId,
      });
      return restored;
    });
  }

  /** Permanently delete a trashed subtree: rows (cascade), favorites, and blobs. */
  async purgeNode(nodeId: string, userId: string): Promise<{ deletedIds: string[] }> {
    const node = await this.repository.findNode(nodeId);
    if (!node || node.deletedAt === null) throw new NodeNotFoundError('Trashed item not found');
    await this.workspace.assertRole(node.dataroomId, userId, 'editor');
    // One transaction for rows + favorites; blob cleanup is best-effort after commit.
    const { deletedIds, fileIds } = await this.tx.run(async () => {
      const deletedNodes = await this.repository.listDeletedNodes([node.dataroomId]);
      const ids = collectSubtreeIds(deletedNodes, nodeId);
      await this.repository.deleteNode(nodeId);
      await this.workspace.removeFavoritesForNodes(ids);
      return { deletedIds: ids, fileIds: fileIdsIn(deletedNodes, ids) };
    });
    await cleanupBlobs(this.storage, fileIds);
    return { deletedIds };
  }

  async listTrash(userId: string): Promise<TrashItemDto[]> {
    const rooms = await this.repository.listDataroomsForUser(userId);
    if (rooms.length === 0) return [];
    const roomById = new Map(rooms.map((room) => [room.id, room]));
    const deletedNodes = await this.repository.listDeletedNodes(rooms.map((room) => room.id));
    const roots = selectTrashRoots(deletedNodes);
    const usersById = new Map((await this.workspace.listUsers()).map((user) => [user.id, user]));

    return roots
      .map((root) => {
        const room = roomById.get(root.dataroomId);
        if (!room) return null;
        const itemCount = collectSubtreeIds(deletedNodes, root.id).length - 1;
        return {
          id: root.id,
          dataroomId: root.dataroomId,
          dataroomName: room.name,
          parentId: root.parentId,
          type: root.type,
          name: root.name,
          size: root.type === 'file' ? root.size : null,
          deletedAt: root.deletedAt ?? 0,
          deletedBy: root.deletedBy ? (usersById.get(root.deletedBy) ?? null) : null,
          itemCount,
          myRole: room.myRole,
        } satisfies TrashItemDto;
      })
      .filter((item): item is TrashItemDto => item !== null)
      .sort((a, b) => b.deletedAt - a.deletedAt);
  }

  /** Purge every trashed root the caller can delete (rooms where they are editor+). */
  async emptyTrash(userId: string): Promise<EmptyTrashResult> {
    const rooms = (await this.repository.listDataroomsForUser(userId)).filter((room) =>
      roleAtLeast(room.myRole, 'editor'),
    );
    if (rooms.length === 0) return { deletedIds: [] };
    // One transaction: "empty" must not stop halfway through the roots.
    const { deletedIds, fileIds } = await this.tx.run(async () => {
      const deletedNodes = await this.repository.listDeletedNodes(rooms.map((room) => room.id));
      const roots = selectTrashRoots(deletedNodes);

      const ids: string[] = [];
      for (const root of roots) {
        ids.push(...collectSubtreeIds(deletedNodes, root.id));
        await this.repository.deleteNode(root.id);
      }
      await this.workspace.removeFavoritesForNodes(ids);
      return { deletedIds: ids, fileIds: fileIdsIn(deletedNodes, ids) };
    });
    await cleanupBlobs(this.storage, fileIds);
    return { deletedIds };
  }

  async getFileContent(nodeId: string, userId: string): Promise<FileContentPayload> {
    const node = await this.repository.findNode(nodeId);
    if (!node || node.type !== 'file' || node.deletedAt !== null) throw new FileNotFoundError();
    await this.workspace.assertMember(node.dataroomId, userId);
    const blob = await this.storage.get(node.id);
    if (!blob) throw new FileNotFoundError();
    return {
      name: node.name,
      size: node.size,
      content: blob.content,
      contentType: blob.contentType,
    };
  }

  /** A live node (rejects both missing and trashed). Trashed nodes must be restored first. */
  private async getLiveNode(id: string): Promise<DataroomNode> {
    const node = await this.repository.findNode(id);
    if (!node || node.deletedAt !== null) throw new NodeNotFoundError();
    return node;
  }

  private async resolveRestoreParent(node: DataroomNode): Promise<string | null> {
    if (node.parentId === null) return null;
    const parent = await this.repository.findNode(node.parentId);
    // Parent gone or itself trashed → drop the item at the room root.
    return parent && parent.deletedAt === null ? node.parentId : null;
  }

  private async assertParentFolder(dataroomId: string, parentId: string | null): Promise<void> {
    if (parentId === null) return;
    const parent = await this.repository.findNode(parentId);
    if (!parent || parent.dataroomId !== dataroomId || parent.deletedAt !== null) {
      throw new NodeNotFoundError('Parent folder not found');
    }
    if (parent.type !== 'folder') {
      throw new InvalidInputError('Parent must be a folder');
    }
  }
}

/** File-node ids within the given id set — for blob cleanup on purge. */
function fileIdsIn(nodes: readonly DataroomNode[], ids: readonly string[]): string[] {
  const idSet = new Set(ids);
  return nodes
    .filter((node) => node.type === 'file' && idSet.has(node.id))
    .map((node) => node.id);
}

function moveValidationError(error: string): Error {
  if (error === 'node-not-found' || error === 'target-not-found') {
    return new NodeNotFoundError();
  }
  if (error === 'target-cross-dataroom') {
    return new NodeNotFoundError('Target folder not found');
  }
  if (error === 'target-not-folder') {
    return new InvalidInputError('Move target must be a folder');
  }
  if (error === 'target-is-self') {
    return new InvalidInputError('Cannot move a folder into itself');
  }
  return new InvalidInputError('Cannot move a folder into one of its descendants');
}

function parsePdfUpload(input: PdfUploadInput | undefined): PdfUpload {
  const result = PdfUpload.from(input);
  if (result.ok) return result.upload;

  if (result.error === 'too-large') {
    throw new PayloadTooLargeError(`File cannot be larger than ${UPLOAD.maxFileSizeBytes} bytes`);
  }
  if (result.error === 'missing') throw new InvalidInputError('A PDF file is required');
  if (result.error === 'empty') throw new InvalidInputError('Uploaded file cannot be empty');
  throw new InvalidInputError('Only PDF files are supported');
}

async function cleanupBlobs(storage: BlobStorage, keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await storage.deleteMany(keys).catch(() => undefined);
}

function normalizeListNodesOptions(
  options: ListNodesOptions | undefined,
): ListNodesOptions | undefined {
  const term = options?.nameContains?.trim();
  return term ? { nameContains: term } : undefined;
}
