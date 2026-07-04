import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { DataroomsController } from './datarooms.controller';
import { DataroomsRepository } from './datarooms.repository';
import { DataroomsService } from './datarooms.service';
import { NodesController } from './nodes.controller';

@Module({
  imports: [StorageModule],
  controllers: [DataroomsController, NodesController],
  providers: [DataroomsRepository, DataroomsService],
})
export class DataroomsModule {}
