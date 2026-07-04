import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Dataroom, DataroomNode, FolderNode, NameValidationError } from '@repo/domain';
import {
  collectSubtreeIds,
  isNameTaken,
  NODE_NAME_MAX_LENGTH,
  sortNodes,
  validateNodeName,
} from '@repo/domain';

const NAME_ERROR_MESSAGES: Record<NameValidationError, string> = {
  empty: 'Name cannot be empty',
  'too-long': `Name cannot be longer than ${NODE_NAME_MAX_LENGTH} characters`,
  'invalid-chars': 'Name contains characters that are not allowed: \\ / : * ? " < > |',
};

/**
 * In-memory store, deliberately shaped like a repository over a database.
 * Business rules (naming, duplicates, cascades) come from @repo/domain.
 */
@Injectable()
export class DataroomsService {
  private readonly datarooms = new Map<string, Dataroom>();
  private readonly nodes = new Map<string, DataroomNode>();

  listDatarooms(): Dataroom[] {
    return [...this.datarooms.values()].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
  }

  createDataroom(rawName: string): Dataroom {
    const name = this.validateName(rawName);
    const existing = this.listDatarooms().map((d) => d.name);
    if (isNameTaken(existing, name)) {
      throw new ConflictException(`A data room named "${name}" already exists`);
    }
    const now = Date.now();
    const dataroom: Dataroom = { id: randomUUID(), name, createdAt: now, updatedAt: now };
    this.datarooms.set(dataroom.id, dataroom);
    return dataroom;
  }

  getDataroom(id: string): Dataroom {
    const dataroom = this.datarooms.get(id);
    if (!dataroom) throw new NotFoundException('Data room not found');
    return dataroom;
  }

  renameDataroom(id: string, rawName: string): Dataroom {
    const dataroom = this.getDataroom(id);
    const name = this.validateName(rawName);
    const otherNames = this.listDatarooms()
      .filter((d) => d.id !== id)
      .map((d) => d.name);
    if (isNameTaken(otherNames, name)) {
      throw new ConflictException(`A data room named "${name}" already exists`);
    }
    const updated: Dataroom = { ...dataroom, name, updatedAt: Date.now() };
    this.datarooms.set(id, updated);
    return updated;
  }

  deleteDataroom(id: string): { deletedNodeIds: string[] } {
    this.getDataroom(id);
    const deletedNodeIds = [...this.nodes.values()]
      .filter((n) => n.dataroomId === id)
      .map((n) => n.id);
    for (const nodeId of deletedNodeIds) this.nodes.delete(nodeId);
    this.datarooms.delete(id);
    return { deletedNodeIds };
  }

  /** Returns all nodes of a dataroom (flat, sorted); the client assembles the tree. */
  listNodes(dataroomId: string): DataroomNode[] {
    this.getDataroom(dataroomId);
    return sortNodes([...this.nodes.values()].filter((n) => n.dataroomId === dataroomId));
  }

  createFolder(dataroomId: string, parentId: string | null, rawName: string): FolderNode {
    this.getDataroom(dataroomId);
    this.assertParentFolder(dataroomId, parentId);
    const name = this.validateName(rawName);
    if (isNameTaken(this.siblingNames(dataroomId, parentId), name)) {
      throw new ConflictException(`"${name}" already exists in this folder`);
    }
    const now = Date.now();
    const folder: FolderNode = {
      id: randomUUID(),
      dataroomId,
      parentId,
      type: 'folder',
      name,
      createdAt: now,
      updatedAt: now,
    };
    this.nodes.set(folder.id, folder);
    return folder;
  }

  renameNode(nodeId: string, rawName: string): DataroomNode {
    const node = this.getNode(nodeId);
    const name = this.validateName(rawName);
    const siblings = this.siblingNames(node.dataroomId, node.parentId, node.id);
    if (isNameTaken(siblings, name)) {
      throw new ConflictException(`"${name}" already exists in this folder`);
    }
    const updated: DataroomNode = { ...node, name, updatedAt: Date.now() };
    this.nodes.set(nodeId, updated);
    return updated;
  }

  deleteNode(nodeId: string): { deletedIds: string[] } {
    const node = this.getNode(nodeId);
    const dataroomNodes = [...this.nodes.values()].filter((n) => n.dataroomId === node.dataroomId);
    const deletedIds = collectSubtreeIds(dataroomNodes, nodeId);
    for (const id of deletedIds) this.nodes.delete(id);
    return { deletedIds };
  }

  private getNode(id: string): DataroomNode {
    const node = this.nodes.get(id);
    if (!node) throw new NotFoundException('Node not found');
    return node;
  }

  private siblingNames(dataroomId: string, parentId: string | null, excludeId?: string): string[] {
    return [...this.nodes.values()]
      .filter((n) => n.dataroomId === dataroomId && n.parentId === parentId && n.id !== excludeId)
      .map((n) => n.name);
  }

  private assertParentFolder(dataroomId: string, parentId: string | null): void {
    if (parentId === null) return;
    const parent = this.nodes.get(parentId);
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
}
