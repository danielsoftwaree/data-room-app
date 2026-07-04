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

/**
 * A data room as returned by the API, enriched with the caller's access context
 * so the dashboard can render owner + member count without extra round-trips.
 */
export type DataroomDto = Dataroom & {
  myRole: MemberRole;
  memberCount: number;
  owner: UserDto | null;
};
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

export interface UpdateMemberRequest {
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

/** One top-level item in the trash, with enough context to list and restore it. */
export interface TrashItemDto {
  id: string;
  dataroomId: string;
  dataroomName: string;
  parentId: string | null;
  type: NodeType;
  name: string;
  size: number | null;
  deletedAt: number;
  deletedBy: UserDto | null;
  /** folders + files contained within (0 for files), for "Folder · N items" copy */
  itemCount: number;
  /** the caller's role in this data room, so the UI can gate destructive actions */
  myRole: MemberRole;
}

export interface EmptyTrashResult {
  deletedIds: string[];
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}
