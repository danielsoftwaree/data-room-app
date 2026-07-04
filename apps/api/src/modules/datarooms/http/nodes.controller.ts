import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Res,
  StreamableFile,
  UseFilters,
} from '@nestjs/common';
import { ApiOkResponse, ApiProduces, ApiTags } from '@nestjs/swagger';
import { sanitizeHeaderFilename } from '../../../shared/helpers/headers';
import type { HeaderResponse } from '../../../shared/types/http';
import { NodesService } from '../application/nodes.service';
import { DataroomsExceptionFilter } from './datarooms-exception.filter';
import { DeleteNodeResultDto, NodeDto, RenameDto } from './dto';

@ApiTags('nodes')
@UseFilters(DataroomsExceptionFilter)
@Controller('nodes')
export class NodesController {
  constructor(@Inject(NodesService) private readonly service: NodesService) {}

  @Patch(':id')
  @ApiOkResponse({ type: NodeDto })
  renameNode(@Param('id') id: string, @Body() body: RenameDto): Promise<NodeDto> {
    return this.service.renameNode(id, body.name);
  }

  @Delete(':id')
  @ApiOkResponse({ type: DeleteNodeResultDto })
  deleteNode(@Param('id') id: string): Promise<DeleteNodeResultDto> {
    return this.service.deleteNode(id);
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
    response.setHeader(
      'Content-Disposition',
      `inline; filename="${sanitizeHeaderFilename(file.name)}"`,
    );
    return new StreamableFile(file.content);
  }
}
