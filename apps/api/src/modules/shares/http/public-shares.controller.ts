import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Param,
  Post,
  Res,
  StreamableFile,
  UseFilters,
} from '@nestjs/common';
import { ApiOkResponse, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../shared/auth/public.decorator';
import { contentDispositionInline } from '../../../shared/helpers/headers';
import type { HeaderResponse } from '../../../shared/types/http';
import { DataroomsExceptionFilter } from '../../datarooms/http/datarooms-exception.filter';
import { SharesService } from '../application/shares.service';
import { SharedContentDto, SharedNodeDto, UnlockShareDto } from './dto';

/**
 * Unauthenticated surface for opening a shared node (file or folder) by slug.
 * The password always travels in the POST body, never the URL, so it never
 * lands in logs or history.
 */
@ApiTags('public-shares')
@Public()
@UseFilters(DataroomsExceptionFilter)
@Controller('public/shares')
export class PublicSharesController {
  constructor(@Inject(SharesService) private readonly service: SharesService) {}

  @Post(':slug/unlock')
  @HttpCode(200)
  @ApiOkResponse({ type: SharedNodeDto })
  unlockShare(@Param('slug') slug: string, @Body() body: UnlockShareDto): Promise<SharedNodeDto> {
    return this.service.unlockShare(slug, body.password);
  }

  @Post(':slug/content')
  @HttpCode(200)
  @ApiProduces('application/pdf')
  @ApiOkResponse({
    content: {
      'application/pdf': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  async getSharedFileContent(
    @Param('slug') slug: string,
    @Body() body: SharedContentDto,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<StreamableFile> {
    const file = await this.service.getSharedContent(slug, body.password, body.fileId);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Length', file.size);
    response.setHeader('Content-Disposition', contentDispositionInline(file.name));
    return new StreamableFile(file.content);
  }
}
