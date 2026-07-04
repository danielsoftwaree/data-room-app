import { Module } from '@nestjs/common';
import { DataroomsModule } from './modules/datarooms/datarooms.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [HealthModule, DataroomsModule],
})
export class AppModule {}
