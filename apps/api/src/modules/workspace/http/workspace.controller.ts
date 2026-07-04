import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { WorkspaceService } from '../application/workspace.service';
import {
  ActivityDto,
  AddMemberDto,
  FavoriteDto,
  ListActivityQueryDto,
  MemberDto,
  StorageUsageDto,
  ToggleFavoriteDto,
  UserDto,
} from './dto';

@ApiTags('workspace')
@Controller()
export class WorkspaceController {
  constructor(@Inject(WorkspaceService) private readonly workspace: WorkspaceService) {}

  @Get('me')
  @ApiOkResponse({ type: UserDto })
  getMe(@Headers('x-user-id') rawUserId?: string | string[]): Promise<UserDto> {
    return this.workspace.getCurrentUser(normalizeHeader(rawUserId));
  }

  @Get('users')
  @ApiOkResponse({ type: [UserDto] })
  listUsers(): Promise<UserDto[]> {
    return this.workspace.listUsers();
  }

  @Get('datarooms/:id/members')
  @ApiOkResponse({ type: [MemberDto] })
  listMembers(@Param('id') id: string): Promise<MemberDto[]> {
    return this.workspace.listMembers(id);
  }

  @Post('datarooms/:id/members')
  @ApiCreatedResponse({ type: MemberDto })
  async addMember(
    @Param('id') id: string,
    @Body() body: AddMemberDto,
    @Headers('x-user-id') rawUserId?: string | string[],
  ): Promise<MemberDto> {
    const actorId = await this.workspace.resolveCurrentUserId(normalizeHeader(rawUserId));
    return this.workspace.addMember(id, actorId, body.userId, body.role);
  }

  @Delete('datarooms/:id/members/:userId')
  @HttpCode(200)
  @ApiOkResponse({ schema: { type: 'object', properties: { ok: { type: 'boolean' } } } })
  async removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Headers('x-user-id') rawUserId?: string | string[],
  ): Promise<{ ok: true }> {
    const actorId = await this.workspace.resolveCurrentUserId(normalizeHeader(rawUserId));
    await this.workspace.removeMember(id, actorId, userId);
    return { ok: true };
  }

  @Get('favorites')
  @ApiOkResponse({ type: [FavoriteDto] })
  async listFavorites(@Headers('x-user-id') rawUserId?: string | string[]): Promise<FavoriteDto[]> {
    const userId = await this.workspace.resolveCurrentUserId(normalizeHeader(rawUserId));
    return this.workspace.listFavorites(userId);
  }

  @Put('favorites')
  @ApiOkResponse({ type: FavoriteDto })
  async addFavorite(
    @Body() body: ToggleFavoriteDto,
    @Headers('x-user-id') rawUserId?: string | string[],
  ): Promise<FavoriteDto> {
    const userId = await this.workspace.resolveCurrentUserId(normalizeHeader(rawUserId));
    return this.workspace.addFavorite(userId, body);
  }

  @Delete('favorites')
  @HttpCode(200)
  @ApiOkResponse({ schema: { type: 'object', properties: { ok: { type: 'boolean' } } } })
  async removeFavorite(
    @Body() body: ToggleFavoriteDto,
    @Headers('x-user-id') rawUserId?: string | string[],
  ): Promise<{ ok: true }> {
    const userId = await this.workspace.resolveCurrentUserId(normalizeHeader(rawUserId));
    await this.workspace.removeFavorite(userId, body);
    return { ok: true };
  }

  @Get('datarooms/:id/activity')
  @ApiOkResponse({ type: [ActivityDto] })
  listActivity(
    @Param('id') id: string,
    @Query() query: ListActivityQueryDto,
  ): Promise<ActivityDto[]> {
    return this.workspace.listActivity(id, {
      nodeId: query.nodeId?.trim() || undefined,
      limit: query.limit,
    });
  }

  @Get('storage')
  @ApiOkResponse({ type: StorageUsageDto })
  getStorageUsage(): Promise<StorageUsageDto> {
    return this.workspace.storageUsage();
  }
}

function normalizeHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
