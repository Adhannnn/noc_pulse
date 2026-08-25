// backend/src/ip-management/ip-management.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IpManagementService implements OnModuleInit {
  private readonly logger = new Logger(IpManagementService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedDefaultIpPool();
  }

  private async seedDefaultIpPool() {
    const count = await this.prisma.ipAddress.count();
    if (count === 0) {
      await this.prisma.ipAddress.createMany({
        data: [
          { ip: '192.168.203.1', subnet: '192.168.203.0/24', hostname: 'gateway.pulsenoc.local', status: 'GATEWAY', assignedTo: 'Core Gateway Router', lastPingMs: 1 },
          { ip: '192.168.203.151', subnet: '192.168.203.0/24', hostname: 'dashboard.pulsenoc.local', status: 'ACTIVE', assignedTo: 'NOC Master Dashboard', lastPingMs: 2 },
          { ip: '192.168.203.152', subnet: '192.168.203.0/24', hostname: 'db-master.pulsenoc.local', status: 'ACTIVE', assignedTo: 'PostgreSQL Primary Cluster', lastPingMs: 4 },
          { ip: '192.168.203.153', subnet: '192.168.203.0/24', hostname: 'redis-cache.pulsenoc.local', status: 'ACTIVE', assignedTo: 'Redis Session Cache', lastPingMs: 2 },
          { ip: '192.168.203.154', subnet: '192.168.203.0/24', hostname: 'k8s-node-01.pulsenoc.local', status: 'ACTIVE', assignedTo: 'K8s Worker Node 01', lastPingMs: 6 },
          { ip: '192.168.203.200', subnet: '192.168.203.0/24', hostname: undefined, status: 'AVAILABLE', assignedTo: undefined, lastPingMs: undefined },
        ],
      });
      this.logger.log('Seeded default IP Management pool (192.168.203.0/24)');
    }
  }

  async findAll() {
    return this.prisma.ipAddress.findMany({
      orderBy: { ip: 'asc' },
    });
  }

  async create(data: { ip: string; subnet?: string; hostname?: string; status?: string; assignedTo?: string }) {
    return this.prisma.ipAddress.create({
      data,
    });
  }

  async remove(id: string) {
    return this.prisma.ipAddress.delete({
      where: { id },
    });
  }
}
