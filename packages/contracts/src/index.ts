/**
 * Public contract surface between web and api.
 * DTOs only - no implementation, no framework imports.
 */
import type { Dataroom, DataroomNode } from '@repo/domain';

export interface HealthResponse {
  status: 'ok';
}

export type DataroomDto = Dataroom;
export type NodeDto = DataroomNode;

export interface CreateDataroomRequest {
  name: string;
}

export interface CreateFolderRequest {
  parentId: string | null;
  name: string;
}

export interface RenameNodeRequest {
  name: string;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}
