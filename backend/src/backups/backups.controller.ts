// backend/src/backups/backups.controller.ts
import { Body, Controller, Get, Post } from '@nestjs/common';
import { BackupsService } from './backups.service';

@Controller('api/backups')
export class BackupsController {
  constructor(private readonly backupsService: BackupsService) {}

  @Get()
  findAll() {
    return this.backupsService.findAll();
  }

  @Post('trigger')
  triggerBackup(@Body('deviceName') deviceName: string) {
    return this.backupsService.triggerBackup(deviceName || 'MikroTik Gateway Router');
  }
}
