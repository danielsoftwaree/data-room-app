import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { DataroomsModule } from './datarooms/datarooms.module';

@Module({
  imports: [DataroomsModule],
  controllers: [AppController],
})
export class AppModule {}
