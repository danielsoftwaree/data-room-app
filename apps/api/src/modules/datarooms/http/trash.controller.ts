import { Controller, Delete, Get, Headers, Inject, UseFilters } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { WorkspaceService } from '../../workspace/application/workspace.service';
import { NodesService } from '../application/nodes.service';
import { DataroomsExceptionFilter } from './datarooms-exception.filter';
import { EmptyTrashResultDto, TrashItemDto } from './dto';

@ApiTags('trash')
@UseFilters(DataroomsExceptionFilter)
@Controller('trash')
export class TrashController {
  constructor(
    @Inject(NodesService) private readonly nodes: NodesService,
    @Inject(WorkspaceService) private readonly workspace: WorkspaceService,
  ) {}

  @Get()
  @ApiOkResponse({ type: [TrashItemDto] })
  async listTrash(@Headers('x-user-id') rawUserId?: string | string[]): Promise<TrashItemDto[]> {
    const userId = await this.workspace.resolveCurrentUserId(normalizeHeader(rawUserId));
    return this.nodes.listTrash(userId);
  }

  @Delete()
  @ApiOkResponse({ type: EmptyTrashResultDto })
  async emptyTrash(
    @Headers('x-user-id') rawUserId?: string | string[],
  ): Promise<EmptyTrashResultDto> {
    const userId = await this.workspace.resolveCurrentUserId(normalizeHeader(rawUserId));
    return this.nodes.emptyTrash(userId);
  }
}

function normalizeHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
