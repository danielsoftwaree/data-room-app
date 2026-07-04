import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { DataroomsService } from './datarooms.service';
import {
  CreateDataroomDto,
  CreateFolderDto,
  DataroomDto,
  DeleteDataroomResultDto,
  NodeDto,
  RenameDto,
} from './dto';

@ApiTags('datarooms')
@Controller('datarooms')
export class DataroomsController {
  constructor(private readonly service: DataroomsService) {}

  @Get()
  @ApiOkResponse({ type: [DataroomDto] })
  listDatarooms(): DataroomDto[] {
    return this.service.listDatarooms();
  }

  @Post()
  @ApiCreatedResponse({ type: DataroomDto })
  createDataroom(@Body() body: CreateDataroomDto): DataroomDto {
    return this.service.createDataroom(body.name);
  }

  @Get(':id')
  @ApiOkResponse({ type: DataroomDto })
  getDataroom(@Param('id') id: string): DataroomDto {
    return this.service.getDataroom(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: DataroomDto })
  renameDataroom(@Param('id') id: string, @Body() body: RenameDto): DataroomDto {
    return this.service.renameDataroom(id, body.name);
  }

  @Delete(':id')
  @ApiOkResponse({ type: DeleteDataroomResultDto })
  deleteDataroom(@Param('id') id: string): DeleteDataroomResultDto {
    return this.service.deleteDataroom(id);
  }

  @Get(':id/nodes')
  @ApiOkResponse({ type: [NodeDto] })
  listNodes(@Param('id') id: string): NodeDto[] {
    return this.service.listNodes(id);
  }

  @Post(':id/folders')
  @ApiCreatedResponse({ type: NodeDto })
  createFolder(@Param('id') id: string, @Body() body: CreateFolderDto): NodeDto {
    return this.service.createFolder(id, body.parentId ?? null, body.name);
  }
}
