import { Inject, Injectable } from '@nestjs/common';
import type { DataroomDto } from '@repo/contracts';
import type { MemberRole } from '@repo/domain';
import { TRANSACTION_RUNNER } from '../../../shared/database/transaction';
import type { TransactionRunner } from '../../../shared/database/transaction';
import { isUniqueViolation } from '../../../shared/errors/database';
import { BLOB_STORAGE } from '../../storage/blob-storage';
import type { BlobStorage } from '../../storage/blob-storage';
import { WorkspaceService } from '../../workspace/application/workspace.service';
import type { DataroomsRepository } from '../domain/datarooms.repository.port';
import { DATAROOMS_REPOSITORY } from '../domain/datarooms.repository.port';
import { DataroomNotFoundError, NameConflictError } from '../domain/errors';
import { parseNodeName } from '../domain/node-name';

@Injectable()
export class DataroomsService {
  constructor(
    @Inject(DATAROOMS_REPOSITORY) private readonly repository: DataroomsRepository,
    @Inject(BLOB_STORAGE) private readonly storage: BlobStorage,
    @Inject(WorkspaceService) private readonly workspace: WorkspaceService,
    @Inject(TRANSACTION_RUNNER) private readonly tx: TransactionRunner,
  ) {}

  async listDatarooms(userId: string): Promise<DataroomDto[]> {
    const rooms = await this.repository.listDataroomsForUser(userId);
    const meta = await this.repository.dataroomMeta(rooms.map((room) => room.id));
    return rooms.map((room) => {
      const roomMeta = meta.get(room.id);
      return {
        ...room,
        memberCount: roomMeta?.memberCount ?? 0,
        owner: roomMeta?.owner ?? null,
      };
    });
  }

  async createDataroom(rawName: string, userId: string): Promise<DataroomDto> {
    const name = parseNodeName(rawName);
    try {
      // One transaction: a room without its owner membership would be
      // unreachable yet still hold the unique name.
      const dataroom = await this.tx.run(async () => {
        const created = await this.repository.createDataroom(name, userId);
        await this.workspace.ensureOwnerMember(created.id, userId);
        await this.workspace.recordActivity({
          dataroomId: created.id,
          node: null,
          action: 'dataroom.created',
          actorId: userId,
        });
        return created;
      });
      return this.getDataroom(dataroom.id, userId);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new NameConflictError(`A data room named "${name}" already exists`);
      }
      throw error;
    }
  }

  async getDataroom(id: string, userId: string): Promise<DataroomDto> {
    const myRole = await this.workspace.assertMember(id, userId);
    return this.toDto(id, myRole);
  }

  async renameDataroom(id: string, rawName: string, userId: string): Promise<DataroomDto> {
    const myRole = await this.workspace.assertRole(id, userId, 'owner');
    const name = parseNodeName(rawName);
    try {
      const updated = await this.repository.renameDataroom(id, name, userId);
      if (!updated) throw new DataroomNotFoundError();
      return this.toDto(id, myRole);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new NameConflictError(`A data room named "${name}" already exists`);
      }
      throw error;
    }
  }

  async deleteDataroom(id: string, userId: string): Promise<{ deletedNodeIds: string[] }> {
    await this.workspace.assertRole(id, userId, 'owner');
    // Snapshot + delete in one transaction so a file uploaded in between
    // cannot slip past the blob cleanup below.
    const { deletedNodeIds, fileIds } = await this.tx.run(async () => {
      await this.repository.lockDataroom(id);
      // Include trashed nodes so their blobs are cleaned up too — the whole room goes.
      const dataroomNodes = await this.repository.listNodes(id, { includeDeleted: true });
      await this.repository.deleteDataroom(id);
      return {
        deletedNodeIds: dataroomNodes.map((node) => node.id),
        fileIds: dataroomNodes.filter((node) => node.type === 'file').map((node) => node.id),
      };
    });
    await cleanupBlobs(this.storage, fileIds);
    return { deletedNodeIds };
  }

  private async toDto(id: string, myRole: MemberRole): Promise<DataroomDto> {
    const dataroom = await this.repository.findDataroom(id);
    if (!dataroom) throw new DataroomNotFoundError();
    const meta = (await this.repository.dataroomMeta([id])).get(id);
    return { ...dataroom, myRole, memberCount: meta?.memberCount ?? 0, owner: meta?.owner ?? null };
  }
}

async function cleanupBlobs(storage: BlobStorage, keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await storage.deleteMany(keys).catch(() => undefined);
}
