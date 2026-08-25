// backend/src/datacenters/datacenters.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DataCentersService implements OnModuleInit {
  private readonly logger = new Logger(DataCentersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedDefaultDataCenters();
  }

  private async seedDefaultDataCenters() {
    const count = await this.prisma.dataCenter.count();
    if (count === 0) {
      await this.prisma.dataCenter.createMany({
        data: [
          { name: 'Home DC', location: 'Jakarta, ID', description: 'Primary Local NOC Data Center' },
          { name: 'Jakarta DC-01', location: 'Jakarta, ID', description: 'Enterprise Edge Gateway Node' },
          { name: 'Singapore Cloud DC', location: 'Singapore, SG', description: 'Cloud Infra & DB Cluster' },
        ],
      });
      this.logger.log('Seeded default Data Centers: Home DC, Jakarta DC-01, Singapore Cloud DC');
    }
  }

  async findAll() {
    return this.prisma.dataCenter.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        monitors: {
          include: {
            heartbeats: {
              take: 10,
              orderBy: { timestamp: 'desc' },
            },
          },
        },
      },
    });
  }

  async create(data: { name: string; location?: string; description?: string }) {
    return this.prisma.dataCenter.create({
      data,
    });
  }

  async remove(id: string) {
    return this.prisma.dataCenter.delete({
      where: { id },
    });
  }
}
