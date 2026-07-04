import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { HealthResponseDto } from './health.dto';

@ApiTags('health')
@Controller()
export class HealthController {
  @Get('health')
  @ApiOkResponse({ type: HealthResponseDto })
  getHealth(): HealthResponseDto {
    return { status: 'ok' };
  }
}
