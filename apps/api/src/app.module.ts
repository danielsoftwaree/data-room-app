import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from './config/database/database.module';
import { EnvModule } from './config/env';
import { DataroomsModule } from './modules/datarooms/datarooms.module';
import { HealthModule } from './modules/health/health.module';
import { WorkspaceModule } from './modules/workspace/workspace.module';
import { ClerkAuthGuard } from './shared/auth/clerk-auth.guard';

@Module({
  imports: [
    // Coarse per-IP rate limit: enough to blunt bursts/scripts without
    // bothering a human clicking through the UI.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    EnvModule,
    DatabaseModule,
    HealthModule,
    WorkspaceModule,
    DataroomsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: ClerkAuthGuard },
  ],
})
export class AppModule {}
