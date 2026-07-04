/**
 * Public contract surface between web and api.
 * DTOs only - no implementation, no framework imports.
 *
 * These interfaces are the authored source of truth; apps/api DTO classes
 * implement them, and @repo/api-client is generated from the resulting OpenAPI schema.
 */
import type {
  ActivityAction,
  Dataroom,
  DataroomMember,
  DataroomNode,
  MemberRole,
  NodeType,
  User,
} from '@repo/domain';

export interface HealthResponse {
  status: 'ok';
}

export type DataroomDto = Dataroom;
export type NodeDto = DataroomNode;
export type UserDto = User;
export type MemberDto = DataroomMember;

export interface CreateDataroomRequest {
  name: string;
}

export interface CreateFolderRequest {
  parentId: string | null;
  name: string;
}

export interface UploadFileRequest {
  parentId: string | null;
}

export interface RenameNodeRequest {
  name: string;
}

export interface MoveNodeRequest {
  parentId: string | null;
}

export interface AddMemberRequest {
  userId: string;
  role: MemberRole;
}

export interface ToggleFavoriteRequest {
  dataroomId: string;
  nodeId?: string | null;
}

export interface FavoriteDto {
  dataroomId: string;
  dataroomName: string;
  nodeId: string | null;
  nodeName: string | null;
  nodeType: NodeType | null;
  parentId: string | null;
  createdAt: number;
}

export interface ActivityDto {
  id: string;
  dataroomId: string;
  nodeId: string | null;
  nodeName: string | null;
  nodeType: NodeType | null;
  action: ActivityAction;
  actor: UserDto;
  createdAt: number;
}

export interface StorageUsageResponse {
  usedBytes: number;
  quotaBytes: number;
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
