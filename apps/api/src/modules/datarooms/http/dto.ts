import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import type {
  CreateDataroomRequest,
  CreateFolderRequest,
  DeleteDataroomResult,
  DeleteNodeResult,
  RenameNodeRequest,
  UploadFileRequest,
} from '@repo/contracts';
import type { Dataroom } from '@repo/domain';

export class DataroomDto implements Dataroom {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ description: 'Unix epoch ms' })
  createdAt!: number;

  @ApiProperty({ description: 'Unix epoch ms' })
  updatedAt!: number;
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
