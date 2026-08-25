// backend/src/ip-management/ip-management.module.ts
import { Module } from '@nestjs/common';
import { IpManagementService } from './ip-management.service';
import { IpManagementController } from './ip-management.controller';

@Module({
  providers: [IpManagementService],
  controllers: [IpManagementController],
  exports: [IpManagementService],
})
export class IpManagementModule {}
