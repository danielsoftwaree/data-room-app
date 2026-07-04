import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { UPLOAD } from '@repo/config';
import { DataroomsService } from '../application/datarooms.service';
import { NodesService } from '../application/nodes.service';
import { DataroomsExceptionFilter } from './datarooms-exception.filter';
import {
  CreateDataroomDto,
  CreateFolderDto,
  DataroomDto,
  DeleteDataroomResultDto,
  ListNodesQueryDto,
  NodeDto,
  RenameDto,
  UploadFileDto,
} from './dto';
import type { UploadedFilePayload } from './file-upload';
import { toPdfUploadInput } from './file-upload';

@ApiTags('datarooms')
@UseFilters(DataroomsExceptionFilter)
@Controller('datarooms')
export class DataroomsController {
  constructor(
    @Inject(DataroomsService) private readonly dataroomsService: DataroomsService,
    @Inject(NodesService) private readonly nodesService: NodesService,
  ) {}

  @Get()
  @ApiOkResponse({ type: [DataroomDto] })
  listDatarooms(): Promise<DataroomDto[]> {
    return this.dataroomsService.listDatarooms();
  }

  @Post()
  @ApiCreatedResponse({ type: DataroomDto })
  createDataroom(@Body() body: CreateDataroomDto): Promise<DataroomDto> {
    return this.dataroomsService.createDataroom(body.name);
  }

  @Get(':id')
  @ApiOkResponse({ type: DataroomDto })
  getDataroom(@Param('id') id: string): Promise<DataroomDto> {
    return this.dataroomsService.getDataroom(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: DataroomDto })
  renameDataroom(@Param('id') id: string, @Body() body: RenameDto): Promise<DataroomDto> {
    return this.dataroomsService.renameDataroom(id, body.name);
  }

  @Delete(':id')
  @ApiOkResponse({ type: DeleteDataroomResultDto })
  deleteDataroom(@Param('id') id: string): Promise<DeleteDataroomResultDto> {
    return this.dataroomsService.deleteDataroom(id);
  }

  @Get(':id/nodes')
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Case-insensitive substring filter over folder/file names',
  })
  @ApiOkResponse({ type: [NodeDto] })
  listNodes(@Param('id') id: string, @Query() query: ListNodesQueryDto): Promise<NodeDto[]> {
    return this.nodesService.listNodes(id, { nameContains: query.search });
  }

  @Post(':id/folders')
  @ApiCreatedResponse({ type: NodeDto })
  createFolder(@Param('id') id: string, @Body() body: CreateFolderDto): Promise<NodeDto> {
    return this.nodesService.createFolder(id, body.parentId ?? null, body.name);
  }

  @Post(':id/files')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: UPLOAD.maxFileSizeBytes } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        parentId: { type: 'string', nullable: true },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiCreatedResponse({ type: NodeDto })
  createFile(
    @Param('id') id: string,
    @Body() body: UploadFileDto,
    @UploadedFile() file?: UploadedFilePayload,
  ): Promise<NodeDto> {
    return this.nodesService.createFile(id, body.parentId ?? null, toPdfUploadInput(file));
  }
}
