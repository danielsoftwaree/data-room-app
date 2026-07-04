import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { UPLOAD } from '@repo/config';
import { DataroomsService } from './datarooms.service';
import {
  CreateDataroomDto,
  CreateFolderDto,
  DataroomDto,
  DeleteDataroomResultDto,
  NodeDto,
  RenameDto,
  UploadFileDto,
} from './dto';
import type { UploadedFilePayload } from './file-upload';

@ApiTags('datarooms')
@Controller('datarooms')
export class DataroomsController {
  // Explicit @Inject: Bun's transpiler cannot emit class types into design:paramtypes.
  constructor(@Inject(DataroomsService) private readonly service: DataroomsService) {}

  @Get()
  @ApiOkResponse({ type: [DataroomDto] })
  listDatarooms(): Promise<DataroomDto[]> {
    return this.service.listDatarooms();
  }

  @Post()
  @ApiCreatedResponse({ type: DataroomDto })
  createDataroom(@Body() body: CreateDataroomDto): Promise<DataroomDto> {
    return this.service.createDataroom(body.name);
  }

  @Get(':id')
  @ApiOkResponse({ type: DataroomDto })
  getDataroom(@Param('id') id: string): Promise<DataroomDto> {
    return this.service.getDataroom(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: DataroomDto })
  renameDataroom(@Param('id') id: string, @Body() body: RenameDto): Promise<DataroomDto> {
    return this.service.renameDataroom(id, body.name);
  }

  @Delete(':id')
  @ApiOkResponse({ type: DeleteDataroomResultDto })
  deleteDataroom(@Param('id') id: string): Promise<DeleteDataroomResultDto> {
    return this.service.deleteDataroom(id);
  }

  @Get(':id/nodes')
  @ApiOkResponse({ type: [NodeDto] })
  listNodes(@Param('id') id: string): Promise<NodeDto[]> {
    return this.service.listNodes(id);
  }

  @Post(':id/folders')
  @ApiCreatedResponse({ type: NodeDto })
  createFolder(@Param('id') id: string, @Body() body: CreateFolderDto): Promise<NodeDto> {
    return this.service.createFolder(id, body.parentId ?? null, body.name);
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
    return this.service.createFile(id, body.parentId ?? null, file);
  }
}
