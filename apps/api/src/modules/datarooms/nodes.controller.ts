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
} from '@nestjs/common';
import { ApiOkResponse, ApiProduces, ApiTags } from '@nestjs/swagger';
import { sanitizeHeaderFilename } from '../../shared/helpers/headers';
import type { HeaderResponse } from '../../shared/types/http';
import { DataroomsService } from './datarooms.service';
import { DeleteNodeResultDto, NodeDto, RenameDto } from './dto';

@ApiTags('nodes')
@Controller('nodes')
export class NodesController {
  // Explicit @Inject: Bun's transpiler cannot emit class types into design:paramtypes.
  constructor(@Inject(DataroomsService) private readonly service: DataroomsService) {}

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
