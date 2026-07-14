import { Module } from '@nestjs/common';
import { DATAROOMS_REPOSITORY } from '../datarooms/domain/datarooms.repository.port';
import { DataroomsExceptionFilter } from '../datarooms/http/datarooms-exception.filter';
import { DrizzleDataroomsRepository } from '../datarooms/infrastructure/drizzle-datarooms.repository';
import { StorageModule } from '../storage/storage.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { ShareAttemptLimiter } from './application/share-attempt-limiter';
import { SharesService } from './application/shares.service';
import { SHARES_REPOSITORY } from './domain/shares.repository.port';
import { PublicSharesController } from './http/public-shares.controller';
import { SharesController } from './http/shares.controller';
import { DrizzleSharesRepository } from './infrastructure/drizzle-shares.repository';

/** Public share links: management (members) + the anonymous unlock surface. */
@Module({
  imports: [StorageModule, WorkspaceModule],
  controllers: [SharesController, PublicSharesController],
  providers: [
    { provide: SHARES_REPOSITORY, useClass: DrizzleSharesRepository },
    { provide: DATAROOMS_REPOSITORY, useClass: DrizzleDataroomsRepository },
    // Constructed via factory so its `now = Date.now` default holds (Nest would
    // otherwise try to resolve the clock argument as a dependency).
    { provide: ShareAttemptLimiter, useFactory: () => new ShareAttemptLimiter() },
    DataroomsExceptionFilter,
    SharesService,
  ],
})
export class SharesModule {}
