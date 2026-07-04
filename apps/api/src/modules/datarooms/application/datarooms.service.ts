import { Inject, Injectable } from '@nestjs/common';
import type { Dataroom } from '@repo/domain';
import { isUniqueViolation } from '../../../shared/errors/database';
import { BLOB_STORAGE } from '../../storage/blob-storage';
import type { BlobStorage } from '../../storage/blob-storage';
import type { DataroomsRepository } from '../domain/datarooms.repository.port';
import { DATAROOMS_REPOSITORY } from '../domain/datarooms.repository.port';
import { DataroomNotFoundError, NameConflictError } from '../domain/errors';
import { parseNodeName } from '../domain/node-name';

@Injectable()
export class DataroomsService {
  constructor(
    @Inject(DATAROOMS_REPOSITORY) private readonly repository: DataroomsRepository,
    @Inject(BLOB_STORAGE) private readonly storage: BlobStorage,
  ) {}

  async listDatarooms(): Promise<Dataroom[]> {
    return this.repository.listDatarooms();
  }

  async createDataroom(rawName: string): Promise<Dataroom> {
    const name = parseNodeName(rawName);
    try {
      return await this.repository.createDataroom(name);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new NameConflictError(`A data room named "${name}" already exists`);
      }
      throw error;
    }
  }

  async getDataroom(id: string): Promise<Dataroom> {
    const dataroom = await this.repository.findDataroom(id);
    if (!dataroom) throw new DataroomNotFoundError();
    return dataroom;
  }

  async renameDataroom(id: string, rawName: string): Promise<Dataroom> {
    await this.getDataroom(id);
    const name = parseNodeName(rawName);
    try {
      const updated = await this.repository.renameDataroom(id, name);
      if (!updated) throw new DataroomNotFoundError();
      return updated;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new NameConflictError(`A data room named "${name}" already exists`);
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
    await cleanupBlobs(this.storage, fileIds);
    return { deletedNodeIds };
  }
}

async function cleanupBlobs(storage: BlobStorage, keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await storage.deleteMany(keys).catch(() => undefined);
}
