import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import type {
  CreateDataroomRequest,
  CreateFolderRequest,
  DataroomDto as DataroomContract,
  DeleteDataroomResult,
  DeleteNodeResult,
  EmptyTrashResult,
  MoveNodeRequest,
  NodeShareStateDto as NodeShareStateContract,
  RenameNodeRequest,
  ShareDto as ShareContract,
  SharedFileDto as SharedFileContract,
  TrashItemDto as TrashItemContract,
  UnlockShareRequest,
  UploadFileRequest,
  UpsertShareRequest,
} from '@repo/contracts';
import type { MemberRole, NodeType } from '@repo/domain';
import { UserDto } from '../../workspace/http/dto';

const MEMBER_ROLES = ['owner', 'editor', 'viewer'] as const;

export class DataroomDto implements DataroomContract {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ description: 'Unix epoch ms' })
  createdAt!: number;

  @ApiProperty({ description: 'Unix epoch ms' })
  updatedAt!: number;

  @ApiProperty({ type: String, nullable: true })
  createdBy!: string | null;

  @ApiProperty({ type: String, nullable: true })
  updatedBy!: string | null;

  @ApiProperty({ enum: MEMBER_ROLES, description: "The caller's role in this room" })
  myRole!: MemberRole;

  @ApiProperty({ description: 'Number of members with access' })
  memberCount!: number;

  @ApiProperty({ type: UserDto, nullable: true, description: 'Earliest-added owner' })
  owner!: UserDto | null;
}

export class NodeDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  dataroomId!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'null = direct child of the dataroom root',
  })
  parentId!: string | null;

  @ApiProperty({ enum: ['folder', 'file'] })
  type!: 'folder' | 'file';

  @ApiProperty()
  name!: string;

  @ApiProperty({ required: false, description: 'File size in bytes (files only)' })
  size?: number;

  @ApiProperty({ description: 'Unix epoch ms' })
  createdAt!: number;

  @ApiProperty({ description: 'Unix epoch ms' })
  updatedAt!: number;

  @ApiProperty({ type: String, nullable: true })
  createdBy!: string | null;

  @ApiProperty({ type: String, nullable: true })
  updatedBy!: string | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Unix epoch ms; null when live' })
  deletedAt!: number | null;

  @ApiProperty({ type: String, nullable: true })
  deletedBy!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    required: false,
    description: 'Public share-link slug (files only); null when the file has no share link',
  })
  shareSlug?: string | null;
}

export class TrashItemDto implements TrashItemContract {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  dataroomId!: string;

  @ApiProperty()
  dataroomName!: string;

  @ApiProperty({ type: String, nullable: true })
  parentId!: string | null;

  @ApiProperty({ enum: ['folder', 'file'] })
  type!: NodeType;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: Number, nullable: true, description: 'File size in bytes; null for folders' })
  size!: number | null;

  @ApiProperty({ description: 'Unix epoch ms' })
  deletedAt!: number;

  @ApiProperty({ type: UserDto, nullable: true })
  deletedBy!: UserDto | null;

  @ApiProperty({ description: 'Folders + files contained within (0 for files)' })
  itemCount!: number;

  @ApiProperty({ enum: MEMBER_ROLES })
  myRole!: MemberRole;
}

export class CreateDataroomDto implements CreateDataroomRequest {
  @ApiProperty()
  @IsString()
  name!: string;
}

export class CreateFolderDto implements CreateFolderRequest {
  @ApiProperty({ type: String, nullable: true, description: 'null/omitted = dataroom root' })
  @IsOptional()
  @IsString()
  parentId!: string | null;

  @ApiProperty()
  @IsString()
  name!: string;
}

export class RenameDto implements RenameNodeRequest {
  @ApiProperty()
  @IsString()
  name!: string;
}

export class MoveNodeDto implements MoveNodeRequest {
  @ApiProperty({ type: String, nullable: true, description: 'null = data room root' })
  @IsOptional()
  @IsString()
  parentId!: string | null;
}

export class ListNodesQueryDto {
  @ApiPropertyOptional({
    description: 'Case-insensitive substring filter over folder/file names',
    minLength: 1,
  })
  @IsOptional()
  @IsString()
  search?: string;
}

export class UploadFileDto implements UploadFileRequest {
  @ApiProperty({
    type: String,
    nullable: true,
    required: false,
    description: 'null/omitted = dataroom root',
  })
  @IsOptional()
  @IsString()
  parentId!: string | null;
}

export class DeleteDataroomResultDto implements DeleteDataroomResult {
  @ApiProperty({ type: [String] })
  deletedNodeIds!: string[];
}

export class DeleteNodeResultDto implements DeleteNodeResult {
  @ApiProperty({ type: [String], description: 'Ids of the node and all of its descendants' })
  deletedIds!: string[];
}

export class EmptyTrashResultDto implements EmptyTrashResult {
  @ApiProperty({ type: [String], description: 'Ids of every purged node' })
  deletedIds!: string[];
}

export class UpsertShareDto implements UpsertShareRequest {
  // Length is validated in the service so the exact SHARE_PASSWORD_ERROR_MESSAGES copy
  // is returned (shared with the mock API); here we only guard the type.
  @ApiProperty({ description: 'Share-link password (4-128 chars, never trimmed)' })
  @IsString()
  password!: string;
}

export class ShareDto implements ShareContract {
  @ApiProperty({ description: 'Public share-link slug' })
  slug!: string;

  @ApiProperty({ description: 'Unix epoch ms' })
  createdAt!: number;
}

export class NodeShareStateDto implements NodeShareStateContract {
  @ApiProperty({ type: ShareDto, nullable: true, description: 'null when the file has no share link' })
  share!: ShareDto | null;
}

export class UnlockShareDto implements UnlockShareRequest {
  @ApiProperty({ description: 'Share-link password' })
  @IsString()
  password!: string;
}

export class SharedFileDto implements SharedFileContract {
  @ApiProperty()
  name!: string;

  @ApiProperty({ description: 'File size in bytes' })
  size!: number;

  @ApiProperty()
  contentType!: string;
}
