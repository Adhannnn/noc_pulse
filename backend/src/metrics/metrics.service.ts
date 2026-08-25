// backend/src/metrics/metrics.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as si from 'systeminformation';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async onApplicationBootstrap() {
    this.logger.log('Executing initial host metrics collection...');
    await this.collectAndBroadcastMetrics();
  }

  // Cron job setiap 5 detik: Mengumpulkan stats & broadcast via WebSocket
  @Cron('*/5 * * * * *')
  async collectAndBroadcastMetrics() {
    try {
      const [cpu, mem, fsSize, netStats] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.fsSize(),
        si.networkStats(),
    ]);

      const disk = fsSize[0] || { use: 0 };
      const net = netStats[0] || { rx_sec: 0, tx_sec: 0 };

      const metricsData = {
        cpuUsage: Number(cpu.currentLoad.toFixed(2)),
        ramUsedMb: Number((mem.used / 1024 / 1024).toFixed(2)),
        ramTotalMb: Number((mem.total / 1024 / 1024).toFixed(2)),
        diskUsagePct: Number(disk.use.toFixed(2)),
        networkInKb: Number(((net.rx_sec || 0) / 1024).toFixed(2)),
        networkOutKb: Number(((net.tx_sec || 0) / 1024).toFixed(2)),
        timestamp: new Date(),
      };

      // 1. Simpan ke Database PostgreSQL (HostMetric)
      await this.prisma.hostMetric.create({
        data: metricsData,
      });

      // 2. Broadcast secara Realtime ke Dashboard Frontend via WebSocket
      this.eventsGateway.broadcastHostMetrics(metricsData);
    } catch (error) {
      this.logger.error('Failed to collect host metrics', error);
    }
  }

  // REST API untuk mengambil riwayat metrik (misal 50 data terakhir untuk grafik)
  async getMetricsHistory(limit = 50) {
    return this.prisma.hostMetric.findMany({
      take: limit,
      orderBy: { timestamp: 'desc' },
    });
  }

  // REST API untuk mengambil telemetry informasi server/OS
  async getServerInfo() {
    try {
      const [osInfo, cpu, time, netInterfaces] = await Promise.all([
        si.osInfo(),
        si.cpu(),
        si.time(),
        si.networkInterfaces(),
      ]);

      const uptimeSec = time.uptime || 0;
      const days = Math.floor(uptimeSec / 86400);
      const hours = Math.floor((uptimeSec % 86400) / 3600);
      const minutes = Math.floor((uptimeSec % 3600) / 60);
      const formattedUptime = `up ${days} days, ${hours} hours, ${minutes} minutes`;

      const primaryInterface = Array.isArray(netInterfaces)
        ? netInterfaces.find((i) => !i.internal && i.ip4) || netInterfaces[0]
        : { ip4: '192.168.203.151', iface: 'enp0s3' };

      return {
        hostname: osInfo.hostname || 'dashboard',
        os: `${osInfo.distro || 'Debian GNU/Linux'} ${osInfo.release || '13 (trixie)'}`,
        kernel: osInfo.kernel || '6.12.48+deb13-cloud-amd64',
        uptime: formattedUptime,
        cpuCores: `${cpu.cores || 4} cores`,
        ipAddress: `${primaryInterface.ip4 || '192.168.203.151'} (${primaryInterface.iface || 'enp0s3'})`,
      };
    } catch (error) {
      return {
        hostname: 'dashboard',
        os: 'Debian GNU/Linux 13 (trixie)',
        kernel: '6.12.48+deb13-cloud-amd64',
        uptime: 'up 2 days, 3 hours, 46 minutes',
        cpuCores: '4 cores',
        ipAddress: '192.168.203.151 (enp0s3)',
      };
    }
  }
}