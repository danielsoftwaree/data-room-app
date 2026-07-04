import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { UPLOAD } from '@repo/config';
import type {
  Dataroom,
  DataroomNode,
  FileNode,
  FolderNode,
  NameValidationError,
} from '@repo/domain';
import {
  collectSubtreeIds,
  isNameTaken,
  NODE_NAME_MAX_LENGTH,
  nextAvailableName,
  sortNodes,
  validateNodeName,
} from '@repo/domain';
import { isUniqueViolation } from '../../shared/errors/database';
import { BLOB_STORAGE } from '../storage/blob-storage';
import type { BlobStorage } from '../storage/blob-storage';
import { DataroomsRepository } from './datarooms.repository';
import type { FileContentPayload, UploadedFilePayload } from './file-upload';

const NAME_ERROR_MESSAGES: Record<NameValidationError, string> = {
  empty: 'Name cannot be empty',
  'too-long': `Name cannot be longer than ${NODE_NAME_MAX_LENGTH} characters`,
  'invalid-chars': 'Name contains characters that are not allowed: \\ / : * ? " < > |',
};

/**
 * Business rules (naming, duplicates, cascades) come from @repo/domain.
 * Node/dataroom metadata lives in the repository; file bytes live behind
 * BlobStorage (db bytea locally, S3-compatible bucket in production).
 */
@Injectable()
export class DataroomsService {
  private readonly logger = new Logger(DataroomsService.name);

  constructor(
    private readonly repository: DataroomsRepository,
    @Inject(BLOB_STORAGE) private readonly storage: BlobStorage,
  ) {}

  async listDatarooms(): Promise<Dataroom[]> {
    return this.repository.listDatarooms();
  }

  async createDataroom(rawName: string): Promise<Dataroom> {
    const name = this.validateName(rawName);
    const existing = (await this.repository.listDatarooms()).map((d) => d.name);
    if (isNameTaken(existing, name)) {
      throw new ConflictException(`A data room named "${name}" already exists`);
    }
    try {
      return await this.repository.createDataroom(name);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`A data room named "${name}" already exists`);
      }
      throw error;
    }
  }

  async getDataroom(id: string): Promise<Dataroom> {
    const dataroom = await this.repository.findDataroom(id);
    if (!dataroom) throw new NotFoundException('Data room not found');
    return dataroom;
  }

  async renameDataroom(id: string, rawName: string): Promise<Dataroom> {
    await this.getDataroom(id);
    const name = this.validateName(rawName);
    const otherNames = (await this.repository.listDatarooms())
      .filter((d) => d.id !== id)
      .map((d) => d.name);
    if (isNameTaken(otherNames, name)) {
      throw new ConflictException(`A data room named "${name}" already exists`);
    }
    try {
      const updated = await this.repository.renameDataroom(id, name);
      if (!updated) throw new NotFoundException('Data room not found');
      return updated;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`A data room named "${name}" already exists`);
      }
      throw error;
    }
  }

  async deleteDataroom(id: string): Promise<{ deletedNodeIds: string[] }> {
    await this.getDataroom(id);
    const dataroomNodes = await this.repository.listNodes(id);
    const deletedNodeIds = dataroomNodes.map((node) => node.id);
    const fileIds = dataroomNodes.filter((node) => node.type === 'file').map((node) => node.id);
    await this.repository.deleteDataroom(id);
    await this.cleanupBlobs(fileIds);
    return { deletedNodeIds };
  }

  /** Returns all nodes of a dataroom (flat, sorted); the client assembles the tree. */
  async listNodes(dataroomId: string): Promise<DataroomNode[]> {
    await this.getDataroom(dataroomId);
    return sortNodes(await this.repository.listNodes(dataroomId));
  }

  async createFolder(
    dataroomId: string,
    parentId: string | null,
    rawName: string,
  ): Promise<FolderNode> {
    await this.getDataroom(dataroomId);
    await this.assertParentFolder(dataroomId, parentId);
    const name = this.validateName(rawName);
    if (isNameTaken(await this.repository.siblingNames(dataroomId, parentId), name)) {
      throw new ConflictException(`"${name}" already exists in this folder`);
    }
    try {
      return await this.repository.createFolder({ dataroomId, parentId, name });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`"${name}" already exists in this folder`);
      }
      throw error;
    }
  }

  async createFile(
    dataroomId: string,
    parentId: string | null,
    file: UploadedFilePayload | undefined,
  ): Promise<FileNode> {
    await this.getDataroom(dataroomId);
    await this.assertParentFolder(dataroomId, parentId);

    const upload = this.validateUpload(file);
    const desiredName = this.validateName(upload.originalName);

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
          content: upload.content,
          contentType: upload.contentType,
        });
      } catch (error) {
        // Compensate: never leave a metadata row without its bytes.
        await this.repository.deleteNode(node.id).catch(() => undefined);
        throw error;
      }
      return node;
    }

    throw new ConflictException(`"${desiredName}" already exists in this folder`);
  }

  async renameNode(nodeId: string, rawName: string): Promise<DataroomNode> {
    const node = await this.getNode(nodeId);
    const name = this.validateName(rawName);
    const siblings = await this.repository.siblingNames(node.dataroomId, node.parentId, node.id);
    if (isNameTaken(siblings, name)) {
      throw new ConflictException(`"${name}" already exists in this folder`);
    }
    try {
      const updated = await this.repository.renameNode(nodeId, name);
      if (!updated) throw new NotFoundException('Node not found');
      return updated;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`"${name}" already exists in this folder`);
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
    await this.cleanupBlobs(fileIds);
    return { deletedIds };
  }

  async getFileContent(nodeId: string): Promise<FileContentPayload> {
    const node = await this.repository.findNode(nodeId);
    if (!node || node.type !== 'file') throw new NotFoundException('File not found');
    const blob = await this.storage.get(node.id);
    if (!blob) throw new NotFoundException('File not found');
    return {
      name: node.name,
      size: node.size,
      content: blob.content,
      contentType: blob.contentType,
    };
  }

  private async getNode(id: string): Promise<DataroomNode> {
    const node = await this.repository.findNode(id);
    if (!node) throw new NotFoundException('Node not found');
    return node;
  }

  private async cleanupBlobs(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    try {
      await this.storage.deleteMany(keys);
    } catch (error) {
      // Metadata is already gone; orphaned blobs are invisible to users and
      // can be swept later. Do not fail the user's request over cleanup.
      this.logger.warn(`Failed to delete ${keys.length} blob(s) from storage: ${String(error)}`);
    }
  }

  private async assertParentFolder(dataroomId: string, parentId: string | null): Promise<void> {
    if (parentId === null) return;
    const parent = await this.repository.findNode(parentId);
    if (!parent || parent.dataroomId !== dataroomId) {
      throw new NotFoundException('Parent folder not found');
    }
    if (parent.type !== 'folder') {
      throw new BadRequestException('Parent must be a folder');
    }
  }

  private validateName(raw: string): string {
    const result = validateNodeName(raw);
    if (!result.ok) throw new BadRequestException(NAME_ERROR_MESSAGES[result.error]);
    return result.name;
  }

  private validateUpload(file: UploadedFilePayload | undefined): {
    originalName: string;
    size: number;
    content: Buffer;
    contentType: string;
  } {
    if (!file) throw new BadRequestException('A PDF file is required');
    if (file.size <= 0) throw new BadRequestException('Uploaded file cannot be empty');
    if (file.size > UPLOAD.maxFileSizeBytes) {
      throw new PayloadTooLargeException(
        `File cannot be larger than ${UPLOAD.maxFileSizeBytes} bytes`,
      );
    }

    const acceptedMimeTypes: readonly string[] = UPLOAD.acceptedMimeTypes;
    const acceptedExtensions: readonly string[] = UPLOAD.acceptedExtensions;
    const lowerName = file.originalname.toLowerCase();
    const hasAcceptedMime = acceptedMimeTypes.includes(file.mimetype);
    const hasAcceptedExtension = acceptedExtensions.some((extension) =>
      lowerName.endsWith(extension),
    );
    const hasPdfSignature = file.buffer.subarray(0, 5).toString('ascii') === '%PDF-';

    if (!hasAcceptedMime || !hasAcceptedExtension || !hasPdfSignature) {
      throw new BadRequestException('Only PDF files are supported');
    }

    return {
      originalName: file.originalname,
      size: file.size,
      content: file.buffer,
      contentType: file.mimetype,
    };
  }
}
