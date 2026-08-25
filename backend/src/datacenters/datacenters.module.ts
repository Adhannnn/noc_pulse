// backend/src/datacenters/datacenters.module.ts
import { Module } from '@nestjs/common';
import { DataCentersService } from './datacenters.service';
import { DataCentersController } from './datacenters.controller';

@Module({
  providers: [DataCentersService],
  controllers: [DataCentersController],
  exports: [DataCentersService],
})
export class DataCentersModule {}
