import { ApiProperty } from '@nestjs/swagger';
import type { HealthResponse } from '@repo/contracts';

export class HealthResponseDto implements HealthResponse {
  @ApiProperty({ enum: ['ok'] })
  status!: 'ok';
}
