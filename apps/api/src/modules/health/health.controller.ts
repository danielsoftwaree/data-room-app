import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../shared/auth/public.decorator';
import { HealthResponseDto } from './health.dto';

@ApiTags('health')
@Controller()
export class HealthController {
  @Get('health')
  @Public()
  @ApiOkResponse({ type: HealthResponseDto })
  getHealth(): HealthResponseDto {
    return { status: 'ok' };
  }
}
