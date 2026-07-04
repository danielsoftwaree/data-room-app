import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Res,
  StreamableFile,
  UseFilters,
} from '@nestjs/common';
import { ApiOkResponse, ApiProduces, ApiTags } from '@nestjs/swagger';
import { contentDispositionInline } from '../../../shared/helpers/headers';
import type { HeaderResponse } from '../../../shared/types/http';
import { WorkspaceService } from '../../workspace/application/workspace.service';
import { NodesService } from '../application/nodes.service';
import { DataroomsExceptionFilter } from './datarooms-exception.filter';
import { DeleteNodeResultDto, MoveNodeDto, NodeDto, RenameDto } from './dto';

@ApiTags('nodes')
@UseFilters(DataroomsExceptionFilter)
@Controller('nodes')
export class NodesController {
  constructor(
    @Inject(NodesService) private readonly service: NodesService,
    @Inject(WorkspaceService) private readonly workspace: WorkspaceService,
  ) {}

  @Patch(':id')
  @ApiOkResponse({ type: NodeDto })
  async renameNode(
    @Param('id') id: string,
    @Body() body: RenameDto,
    @Headers('x-user-id') rawUserId?: string | string[],
  ): Promise<NodeDto> {
    const userId = await this.workspace.resolveCurrentUserId(normalizeHeader(rawUserId));
    return this.service.renameNode(id, body.name, userId);
  }

  @Post(':id/move')
  @HttpCode(200)
  @ApiOkResponse({ type: NodeDto })
  async moveNode(
    @Param('id') id: string,
    @Body() body: MoveNodeDto,
    @Headers('x-user-id') rawUserId?: string | string[],
  ): Promise<NodeDto> {
    const userId = await this.workspace.resolveCurrentUserId(normalizeHeader(rawUserId));
    return this.service.moveNode(id, body.parentId ?? null, userId);
  }

  @Delete(':id')
  @ApiOkResponse({ type: DeleteNodeResultDto })
  async deleteNode(
    @Param('id') id: string,
    @Headers('x-user-id') rawUserId?: string | string[],
  ): Promise<DeleteNodeResultDto> {
    const userId = await this.workspace.resolveCurrentUserId(normalizeHeader(rawUserId));
    return this.service.deleteNode(id, userId);
  }

  @Get(':id/content')
  @ApiProduces('application/pdf')
  @ApiOkResponse({
    content: {
      'application/pdf': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  async getNodeContent(
    @Param('id') id: string,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<StreamableFile> {
    const file = await this.service.getFileContent(id);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Length', file.size);
    response.setHeader('Content-Disposition', contentDispositionInline(file.name));
    return new StreamableFile(file.content);
  }
}

function normalizeHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
