import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Put,
  UseFilters,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { WorkspaceService } from '../../workspace/application/workspace.service';
import { SharesService } from '../application/shares.service';
import { DataroomsExceptionFilter } from './datarooms-exception.filter';
import { NodeShareStateDto, ShareDto, UpsertShareDto } from './dto';

@ApiTags('shares')
@UseFilters(DataroomsExceptionFilter)
@Controller('nodes')
export class SharesController {
  constructor(
    @Inject(SharesService) private readonly service: SharesService,
    @Inject(WorkspaceService) private readonly workspace: WorkspaceService,
  ) {}

  @Put(':id/share')
  @ApiOkResponse({ type: ShareDto })
  async upsertNodeShare(
    @Param('id') id: string,
    @Body() body: UpsertShareDto,
    @Headers('x-user-id') rawUserId?: string | string[],
  ): Promise<ShareDto> {
    const userId = await this.workspace.resolveCurrentUserId(normalizeHeader(rawUserId));
    return this.service.upsertShare(id, body.password, userId);
  }

  @Get(':id/share')
  @ApiOkResponse({ type: NodeShareStateDto })
  async getNodeShare(
    @Param('id') id: string,
    @Headers('x-user-id') rawUserId?: string | string[],
  ): Promise<NodeShareStateDto> {
    const userId = await this.workspace.resolveCurrentUserId(normalizeHeader(rawUserId));
    return this.service.getShareState(id, userId);
  }

  @Delete(':id/share')
  @HttpCode(204)
  @ApiNoContentResponse()
  async removeNodeShare(
    @Param('id') id: string,
    @Headers('x-user-id') rawUserId?: string | string[],
  ): Promise<void> {
    const userId = await this.workspace.resolveCurrentUserId(normalizeHeader(rawUserId));
    await this.service.removeShare(id, userId);
  }
}

function normalizeHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
