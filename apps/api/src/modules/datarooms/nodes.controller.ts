import { Body, Controller, Delete, Param, Patch } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { DataroomsService } from './datarooms.service';
import { DeleteNodeResultDto, NodeDto, RenameDto } from './dto';

@ApiTags('nodes')
@Controller('nodes')
export class NodesController {
  constructor(private readonly service: DataroomsService) {}

  @Patch(':id')
  @ApiOkResponse({ type: NodeDto })
  renameNode(@Param('id') id: string, @Body() body: RenameDto): NodeDto {
    return this.service.renameNode(id, body.name);
  }

  @Delete(':id')
  @ApiOkResponse({ type: DeleteNodeResultDto })
  deleteNode(@Param('id') id: string): DeleteNodeResultDto {
    return this.service.deleteNode(id);
  }
}
