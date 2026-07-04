import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import type {
  ActivityDto as ActivityContract,
  AddMemberRequest,
  FavoriteDto as FavoriteContract,
  MemberDto as MemberContract,
  StorageUsageResponse,
  ToggleFavoriteRequest,
  UpdateMemberRequest,
  UserDto as UserContract,
} from '@repo/contracts';
import type { ActivityAction, MemberRole, NodeType } from '@repo/domain';

export class UserDto implements UserContract {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  color!: string;
}

export class MemberDto implements MemberContract {
  @ApiProperty()
  dataroomId!: string;

  @ApiProperty({ type: UserDto })
  user!: UserDto;

  @ApiProperty({ enum: ['owner', 'editor', 'viewer'] })
  role!: MemberRole;

  @ApiProperty({ description: 'Unix epoch ms' })
  addedAt!: number;
}

export class AddMemberDto implements AddMemberRequest {
  @ApiProperty()
  @IsUUID()
  userId!: string;

  @ApiProperty({ enum: ['owner', 'editor', 'viewer'] })
  @IsIn(['owner', 'editor', 'viewer'])
  role!: MemberRole;
}

export class UpdateMemberDto implements UpdateMemberRequest {
  @ApiProperty({ enum: ['owner', 'editor', 'viewer'] })
  @IsIn(['owner', 'editor', 'viewer'])
  role!: MemberRole;
}

export class ToggleFavoriteDto implements ToggleFavoriteRequest {
  @ApiProperty()
  @IsUUID()
  dataroomId!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsUUID()
  nodeId?: string | null;
}

export class FavoriteDto implements FavoriteContract {
  @ApiProperty()
  dataroomId!: string;

  @ApiProperty()
  dataroomName!: string;

  @ApiProperty({ type: String, nullable: true })
  nodeId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  nodeName!: string | null;

  @ApiProperty({ enum: ['folder', 'file'], nullable: true })
  nodeType!: NodeType | null;

  @ApiProperty({ type: String, nullable: true })
  parentId!: string | null;

  @ApiProperty({ description: 'Unix epoch ms' })
  createdAt!: number;
}

export class ActivityDto implements ActivityContract {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  dataroomId!: string;

  @ApiProperty({ type: String, nullable: true })
  nodeId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  nodeName!: string | null;

  @ApiProperty({ enum: ['folder', 'file'], nullable: true })
  nodeType!: NodeType | null;

  @ApiProperty({
    enum: [
      'dataroom.created',
      'folder.created',
      'file.uploaded',
      'node.renamed',
      'node.moved',
      'node.deleted',
      'node.restored',
      'member.added',
      'member.updated',
      'member.removed',
    ],
  })
  action!: ActivityAction;

  @ApiProperty({ type: UserDto })
  actor!: UserDto;

  @ApiProperty({ description: 'Unix epoch ms' })
  createdAt!: number;
}

export class ListActivityQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nodeId?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class StorageUsageDto implements StorageUsageResponse {
  @ApiProperty()
  usedBytes!: number;

  @ApiProperty()
  quotaBytes!: number;
}
