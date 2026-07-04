/**
 * Public contract surface between web and api.
 * DTOs only - no implementation, no framework imports.
 *
 * These interfaces are the authored source of truth; apps/api DTO classes
 * implement them, and @repo/api-client is generated from the resulting OpenAPI schema.
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

export interface DeleteDataroomResult {
  deletedNodeIds: string[];
}

export interface DeleteNodeResult {
  deletedIds: string[];
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}
