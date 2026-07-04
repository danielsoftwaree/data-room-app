import { Module } from '@nestjs/common';
import { WorkspaceService } from './application/workspace.service';
import { WORKSPACE_REPOSITORY } from './domain/workspace.repository.port';
import { WorkspaceController } from './http/workspace.controller';
import { DrizzleWorkspaceRepository } from './infrastructure/drizzle-workspace.repository';

@Module({
  controllers: [WorkspaceController],
  providers: [
    { provide: WORKSPACE_REPOSITORY, useClass: DrizzleWorkspaceRepository },
    WorkspaceService,
  ],
  exports: [WorkspaceService],
})
export class WorkspaceModule {}
