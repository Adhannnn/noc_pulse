// backend/src/databases/databases.module.ts
import { Module } from '@nestjs/common';
import { DatabasesService } from './databases.service';
import { DatabasesController } from './databases.controller';

@Module({
  providers: [DatabasesService],
  controllers: [DatabasesController],
  exports: [DatabasesService],
})
export class DatabasesModule {}
