import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from './config/database/database.module';
import { DataroomsModule } from './modules/datarooms/datarooms.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    // Coarse per-IP rate limit: enough to blunt bursts/scripts without
    // bothering a human clicking through the UI.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    DatabaseModule,
    HealthModule,
    DataroomsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
