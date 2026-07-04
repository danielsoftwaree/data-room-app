import { Module } from '@nestjs/common';
import { DataroomsController } from './datarooms.controller';
import { DataroomsService } from './datarooms.service';
import { NodesController } from './nodes.controller';

@Module({
  controllers: [DataroomsController, NodesController],
  providers: [DataroomsService],
})
export class DataroomsModule {}
