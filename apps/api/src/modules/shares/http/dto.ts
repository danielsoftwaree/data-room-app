import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import type {
  NodeShareStateDto as NodeShareStateContract,
  ShareDto as ShareContract,
  SharedChildDto as SharedChildContract,
  SharedContentRequest,
  SharedNodeDto as SharedNodeContract,
  UnlockShareRequest,
  UpsertShareRequest,
} from '@repo/contracts';
import type { NodeType } from '@repo/domain';

export class UpsertShareDto implements UpsertShareRequest {
  // Length is validated in the service so the exact SHARE_PASSWORD_ERROR_MESSAGES copy
  // is returned (shared with the mock API); here we only guard the type.
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Share-link password (4-128 chars, never trimmed); null/omitted = no password',
  })
  @IsOptional()
  @IsString()
  password?: string | null;
}

export class ShareDto implements ShareContract {
  @ApiProperty({ description: 'Public share-link slug' })
  slug!: string;

  @ApiProperty({ description: 'Unix epoch ms' })
  createdAt!: number;

  @ApiProperty({ description: 'Whether opening the link requires a password' })
  hasPassword!: boolean;
}

export class NodeShareStateDto implements NodeShareStateContract {
  @ApiProperty({
    type: ShareDto,
    nullable: true,
    description: 'null when the node has no share link',
  })
  share!: ShareDto | null;
}

export class UnlockShareDto implements UnlockShareRequest {
  @ApiPropertyOptional({ type: String, nullable: true, description: 'Share-link password' })
  @IsOptional()
  @IsString()
  password?: string | null;
}

export class SharedContentDto implements SharedContentRequest {
  @ApiPropertyOptional({ type: String, nullable: true, description: 'Share-link password' })
  @IsOptional()
  @IsString()
  password?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'File to fetch inside a shared folder; ignored for file shares',
  })
  @IsOptional()
  @IsString()
  fileId?: string | null;
}

export class SharedChildDto implements SharedChildContract {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ['folder', 'file'] })
  type!: NodeType;

  @ApiProperty({ description: 'Unix epoch ms of the last modification' })
  updatedAt!: number;

  @ApiProperty({ required: false, description: 'File size in bytes (files only)' })
  size?: number;

  @ApiProperty({
    type: () => [SharedChildDto],
    required: false,
    description: 'Live children (folders only)',
  })
  children?: SharedChildDto[];
}

export class SharedNodeDto implements SharedNodeContract {
  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ['folder', 'file'] })
  type!: NodeType;

  @ApiProperty({ description: 'Unix epoch ms of the last modification' })
  updatedAt!: number;

  @ApiProperty({ required: false, description: 'File size in bytes (files only)' })
  size?: number;

  @ApiProperty({ required: false, description: 'Present for files' })
  contentType?: string;

  @ApiProperty({
    type: () => [SharedChildDto],
    required: false,
    description: 'The shared subtree of live nodes (folders only)',
  })
  children?: SharedChildDto[];
}
