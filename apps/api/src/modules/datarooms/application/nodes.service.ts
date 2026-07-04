import { Inject, Injectable } from '@nestjs/common';
import { UPLOAD } from '@repo/config';
import type { DataroomNode, FileNode, FolderNode } from '@repo/domain';
import { collectSubtreeIds, nextAvailableName, sortNodes } from '@repo/domain';
import { isUniqueViolation } from '../../../shared/errors/database';
import { BLOB_STORAGE } from '../../storage/blob-storage';
import type { BlobStorage } from '../../storage/blob-storage';
import type { DataroomsRepository, ListNodesOptions } from '../domain/datarooms.repository.port';
import { DATAROOMS_REPOSITORY } from '../domain/datarooms.repository.port';
import {
  DataroomNotFoundError,
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
  ) {}

  async listNodes(dataroomId: string, options?: ListNodesOptions): Promise<DataroomNode[]> {
    await this.assertDataroomExists(dataroomId);
    return sortNodes(
      await this.repository.listNodes(dataroomId, normalizeListNodesOptions(options)),
    );
  }

  async createFolder(
    dataroomId: string,
    parentId: string | null,
    rawName: string,
  ): Promise<FolderNode> {
    await this.assertDataroomExists(dataroomId);
    await this.assertParentFolder(dataroomId, parentId);
    const name = parseNodeName(rawName);
    try {
      return await this.repository.createFolder({ dataroomId, parentId, name });
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
  ): Promise<FileNode> {
    await this.assertDataroomExists(dataroomId);
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
      return node;
    }

    throw new NameConflictError(`"${desiredName}" already exists in this folder`);
  }

  async renameNode(nodeId: string, rawName: string): Promise<DataroomNode> {
    await this.getNode(nodeId);
    const name = parseNodeName(rawName);
    try {
      const updated = await this.repository.renameNode(nodeId, name);
      if (!updated) throw new NodeNotFoundError();
      return updated;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new NameConflictError(`"${name}" already exists in this folder`);
      }
      throw error;
    }
  }

  async deleteNode(nodeId: string): Promise<{ deletedIds: string[] }> {
    const node = await this.getNode(nodeId);
    const dataroomNodes = await this.repository.listNodes(node.dataroomId);
    const deletedIds = collectSubtreeIds(dataroomNodes, nodeId);
    const deletedIdSet = new Set(deletedIds);
    const fileIds = dataroomNodes
      .filter((candidate) => candidate.type === 'file' && deletedIdSet.has(candidate.id))
      .map((candidate) => candidate.id);
    await this.repository.deleteNode(nodeId);
    await cleanupBlobs(this.storage, fileIds);
    return { deletedIds };
  }

  async getFileContent(nodeId: string): Promise<FileContentPayload> {
    const node = await this.repository.findNode(nodeId);
    if (!node || node.type !== 'file') throw new FileNotFoundError();
    const blob = await this.storage.get(node.id);
    if (!blob) throw new FileNotFoundError();
    return {
      name: node.name,
      size: node.size,
      content: blob.content,
      contentType: blob.contentType,
    };
  }

  private async assertDataroomExists(id: string): Promise<void> {
    const dataroom = await this.repository.findDataroom(id);
    if (!dataroom) throw new DataroomNotFoundError();
  }

  private async getNode(id: string): Promise<DataroomNode> {
    const node = await this.repository.findNode(id);
    if (!node) throw new NodeNotFoundError();
    return node;
  }

  private async assertParentFolder(dataroomId: string, parentId: string | null): Promise<void> {
    if (parentId === null) return;
    const parent = await this.repository.findNode(parentId);
    if (!parent || parent.dataroomId !== dataroomId) {
      throw new NodeNotFoundError('Parent folder not found');
    }
    if (parent.type !== 'folder') {
      throw new InvalidInputError('Parent must be a folder');
    }
  }
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
