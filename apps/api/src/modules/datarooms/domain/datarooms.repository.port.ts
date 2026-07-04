import type { Dataroom, DataroomNode, FileNode, FolderNode } from '@repo/domain';

export interface CreateFolderInput {
  dataroomId: string;
  parentId: string | null;
  name: string;
}

export interface CreateFileNodeInput extends CreateFolderInput {
  size: number;
}

export interface ListNodesOptions {
  nameContains?: string;
}

export interface DataroomsRepository {
  listDatarooms(): Promise<Dataroom[]>;
  createDataroom(name: string): Promise<Dataroom>;
  findDataroom(id: string): Promise<Dataroom | undefined>;
  renameDataroom(id: string, name: string): Promise<Dataroom | undefined>;
  deleteDataroom(id: string): Promise<void>;
  listNodes(dataroomId: string, options?: ListNodesOptions): Promise<DataroomNode[]>;
  findNode(id: string): Promise<DataroomNode | undefined>;
  createFolder(input: CreateFolderInput): Promise<FolderNode>;
  createFileNode(input: CreateFileNodeInput): Promise<FileNode>;
  renameNode(id: string, name: string): Promise<DataroomNode | undefined>;
  deleteNode(id: string): Promise<void>;
  siblingNames(dataroomId: string, parentId: string | null, excludeId?: string): Promise<string[]>;
}

export const DATAROOMS_REPOSITORY = Symbol('DATAROOMS_REPOSITORY');
