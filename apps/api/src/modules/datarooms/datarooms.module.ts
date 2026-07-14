import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { DataroomsService } from './application/datarooms.service';
import { NodesService } from './application/nodes.service';
import { ShareAttemptLimiter } from './application/share-attempt-limiter';
import { SharesService } from './application/shares.service';
import { DATAROOMS_REPOSITORY } from './domain/datarooms.repository.port';
import { SHARES_REPOSITORY } from './domain/shares.repository.port';
import { DataroomsExceptionFilter } from './http/datarooms-exception.filter';
import { DataroomsController } from './http/datarooms.controller';
import { NodesController } from './http/nodes.controller';
import { PublicSharesController } from './http/public-shares.controller';
import { SharesController } from './http/shares.controller';
import { TrashController } from './http/trash.controller';
import { DrizzleDataroomsRepository } from './infrastructure/drizzle-datarooms.repository';
import { DrizzleSharesRepository } from './infrastructure/drizzle-shares.repository';

@Module({
  imports: [StorageModule, WorkspaceModule],
  controllers: [
    DataroomsController,
    NodesController,
    TrashController,
    SharesController,
    PublicSharesController,
  ],
  providers: [
    { provide: DATAROOMS_REPOSITORY, useClass: DrizzleDataroomsRepository },
    { provide: SHARES_REPOSITORY, useClass: DrizzleSharesRepository },
    // Constructed via factory so its `now = Date.now` default holds (Nest would
    // otherwise try to resolve the clock argument as a dependency).
    { provide: ShareAttemptLimiter, useFactory: () => new ShareAttemptLimiter() },
    DataroomsExceptionFilter,
    DataroomsService,
    NodesService,
    SharesService,
  ],
})
export class DataroomsModule {}
