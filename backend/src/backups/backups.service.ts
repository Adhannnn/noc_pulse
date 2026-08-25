// backend/src/backups/backups.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BackupsService implements OnModuleInit {
  private readonly logger = new Logger(BackupsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedDefaultBackups();
  }

  private async seedDefaultBackups() {
    const count = await this.prisma.backupRecord.count();
    if (count === 0) {
      await this.prisma.backupRecord.createMany({
        data: [
          { deviceName: 'MikroTik Core Router (CCR2004)', filename: 'ccr2004-export-2026-08-25.rsc', sizeKb: 1420, status: 'SUCCESS' },
          { deviceName: 'PostgreSQL Primary DB Cluster', filename: 'pg-dump-pulsenoc-2026-08-25.sql.gz', sizeKb: 45800, status: 'SUCCESS' },
          { deviceName: 'Redis Session Cache Cluster', filename: 'redis-dump-2026-08-25.rdb', sizeKb: 3200, status: 'SUCCESS' },
        ],
      });
      this.logger.log('Seeded default MT Backup records');
    }
  }

  async findAll() {
    return this.prisma.backupRecord.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async triggerBackup(deviceName: string) {
    const filename = `${deviceName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}.rsc`;
    const record = await this.prisma.backupRecord.create({
      data: {
        deviceName,
        filename,
        sizeKb: Math.floor(Math.random() * 2000) + 500,
        status: 'SUCCESS',
      },
    });
    return record;
  }
}
