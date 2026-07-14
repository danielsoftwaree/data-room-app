import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { DataroomsService } from './application/datarooms.service';
import { NodesService } from './application/nodes.service';
import { DATAROOMS_REPOSITORY } from './domain/datarooms.repository.port';
import { DataroomsExceptionFilter } from './http/datarooms-exception.filter';
import { DataroomsController } from './http/datarooms.controller';
import { NodesController } from './http/nodes.controller';
import { TrashController } from './http/trash.controller';
import { DrizzleDataroomsRepository } from './infrastructure/drizzle-datarooms.repository';

@Module({
  imports: [StorageModule, WorkspaceModule],
  controllers: [DataroomsController, NodesController, TrashController],
  providers: [
    { provide: DATAROOMS_REPOSITORY, useClass: DrizzleDataroomsRepository },
    DataroomsExceptionFilter,
    DataroomsService,
    NodesService,
  ],
})
export class DataroomsModule {}
