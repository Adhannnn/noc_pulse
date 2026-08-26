// backend/src/metrics/metrics.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as si from 'systeminformation';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';

import * as fs from 'fs';
import { promises as fsp } from 'fs';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async onApplicationBootstrap() {
    this.logger.log('Executing initial host metrics collection...');
    // Purge old stale metric history from database to ensure fresh host data is displayed
    await this.prisma.hostMetric.deleteMany({}).catch(() => {});
    await this.collectAndBroadcastMetrics();
  }

  /**
   * Baca RAM asli host dari /host/proc/meminfo (bind-mounted dari docker-compose).
   * Tidak ada override manual — angka murni dari kernel host.
   */
  private getMemoryStats(mem: si.Systeminformation.MemData) {
    // Fallback awal kalau /proc/meminfo host gagal dibaca sama sekali
    let totalBytes = mem.total;
    let usedBytes = mem.active || (mem.total - mem.available) || mem.used;

    const targetPath = fs.existsSync('/host/proc/meminfo')
      ? '/host/proc/meminfo'
      : fs.existsSync('/proc/meminfo')
      ? '/proc/meminfo'
      : null;

    if (targetPath) {
      try {
        const content = fs.readFileSync(targetPath, 'utf-8');
        const lines = content.split('\n');
        let memTotalKb = 0;
        let memAvailableKb = 0;
        let memFreeKb = 0;
        let buffersKb = 0;
        let cachedKb = 0;

        lines.forEach((line) => {
          const parts = line.split(':');
          if (parts.length === 2) {
            const key = parts[0].trim();
            const val = parseInt(parts[1].trim().split(/\s+/)[0], 10);
            if (key === 'MemTotal') memTotalKb = val;
            if (key === 'MemAvailable') memAvailableKb = val;
            if (key === 'MemFree') memFreeKb = val;
            if (key === 'Buffers') buffersKb = val;
            if (key === 'Cached') cachedKb = val;
          }
        });

        if (memTotalKb > 0) {
          totalBytes = memTotalKb * 1024;
          const availableKb = memAvailableKb || (memFreeKb + buffersKb + cachedKb);
          usedBytes = (memTotalKb - availableKb) * 1024;
        }
      } catch (err) {
        this.logger.warn(`Failed to parse ${targetPath}: ${err}`);
      }
    } else {
      this.logger.warn('Host /proc/meminfo not accessible, falling back to container-view memory stats');
    }

    // Guard basic saja (data korup/negatif), bukan tempat nyuntik angka palsu
    if (usedBytes > totalBytes || usedBytes < 0) {
      usedBytes = 0;
    }

    return {
      ramUsedMb: Number((usedBytes / 1024 / 1024).toFixed(2)),
      ramTotalMb: Number((totalBytes / 1024 / 1024).toFixed(2)),
    };
  }

  async getDetailedMemoryStats() {
    const mem = await si.mem();
    let totalBytes = mem.total;
    let availableBytes = mem.available;
    let freeBytes = mem.free;
    let buffersBytes = mem.buffers || 0;
    let cachedBytes = mem.cached || 0;
    let swapTotalBytes = mem.swaptotal || 0;
    let swapUsedBytes = mem.swapused || 0;

    const targetPath = fs.existsSync('/host/proc/meminfo')
      ? '/host/proc/meminfo'
      : fs.existsSync('/proc/meminfo')
      ? '/proc/meminfo'
      : null;

    if (targetPath) {
      try {
        const content = fs.readFileSync(targetPath, 'utf-8');
        const lines = content.split('\n');
        lines.forEach((line) => {
          const parts = line.split(':');
          if (parts.length === 2) {
            const key = parts[0].trim();
            const val = parseInt(parts[1].trim().split(/\s+/)[0], 10) * 1024;
            if (key === 'MemTotal') totalBytes = val;
            if (key === 'MemAvailable') availableBytes = val;
            if (key === 'MemFree') freeBytes = val;
            if (key === 'Buffers') buffersBytes = val;
            if (key === 'Cached') cachedBytes = val;
            if (key === 'SwapTotal') swapTotalBytes = val;
            if (key === 'SwapFree') swapUsedBytes = Math.max(0, swapTotalBytes - val);
          }
        });
      } catch (_) {}
    }

    const available = availableBytes || (freeBytes + buffersBytes + cachedBytes);
    const usedBytes = Math.max(0, totalBytes - available);
    const activeBytes = Math.max(0, usedBytes - buffersBytes - cachedBytes);

    return {
      totalGb: Number((totalBytes / (1024 ** 3)).toFixed(2)),
      usedGb: Number((usedBytes / (1024 ** 3)).toFixed(2)),
      availableGb: Number((available / (1024 ** 3)).toFixed(2)),
      freeGb: Number((freeBytes / (1024 ** 3)).toFixed(2)),
      activeGb: Number((activeBytes / (1024 ** 3)).toFixed(2)),
      buffersMb: Number((buffersBytes / (1024 ** 2)).toFixed(2)),
      cachedMb: Number((cachedBytes / (1024 ** 2)).toFixed(2)),
      swapTotalGb: Number((swapTotalBytes / (1024 ** 3)).toFixed(2)),
      swapUsedGb: Number((swapUsedBytes / (1024 ** 3)).toFixed(2)),
      usedPct: totalBytes > 0 ? Number(((usedBytes / totalBytes) * 100).toFixed(1)) : 0,
      activePct: totalBytes > 0 ? Number(((activeBytes / totalBytes) * 100).toFixed(1)) : 0,
      cachedPct: totalBytes > 0 ? Number((((buffersBytes + cachedBytes) / totalBytes) * 100).toFixed(1)) : 0,
      freePct: totalBytes > 0 ? Number(((freeBytes / totalBytes) * 100).toFixed(1)) : 0,
    };
  }

  /**
   * Baca kapasitas & pemakaian disk root host langsung via statfs kernel,
   * lewat bind mount /host/root. Tidak ada fallback angka ngarang —
   * kalau gagal, return 0 dan biarkan frontend menampilkan "N/A".
   */
  private async getHostDiskStats() {
    try {
      const stats = await fsp.statfs('/host/root');
      const totalBytes = stats.blocks * stats.bsize;
      const freeBytes = stats.bavail * stats.bsize; // bavail = tersedia utk non-root, lebih akurat dari bfree
      const usedBytes = totalBytes - freeBytes;

      if (totalBytes <= 0) {
        throw new Error('statfs returned zero total blocks');
      }

      return {
        diskTotalGb: Number((totalBytes / 1024 ** 3).toFixed(1)),
        diskUsedGb: Number((usedBytes / 1024 ** 3).toFixed(1)),
        diskUsagePct: Number(((usedBytes / totalBytes) * 100).toFixed(2)),
      };
    } catch (error) {
      this.logger.error('Failed to read host disk stats from /host/root', error as Error);
      return { diskTotalGb: 0, diskUsedGb: 0, diskUsagePct: 0 };
    }
  }

  /**
   * Baca throughput baca/tulis disk (bytes/sec) via systeminformation.
   * Ini metrik I/O, beda dari kapasitas/pemakaian di atas.
   */
  private async getHostDiskIO() {
    try {
      const io = await si.fsStats();
      return {
        diskReadKb: Number(((io.rx_sec || 0) / 1024).toFixed(2)),
        diskWriteKb: Number(((io.wx_sec || 0) / 1024).toFixed(2)),
      };
    } catch (error) {
      this.logger.error('Failed to read disk I/O stats', error as Error);
      return { diskReadKb: 0, diskWriteKb: 0 };
    }
  }

  // Cron job setiap 5 detik: Mengumpulkan stats & broadcast via WebSocket
  @Cron('*/5 * * * * *')
  async collectAndBroadcastMetrics() {
    try {
      const [cpu, mem, netStats, diskStats, diskIO] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.networkStats(),
        this.getHostDiskStats(),
        this.getHostDiskIO(),
      ]);

      const net = netStats[0] || { rx_sec: 0, tx_sec: 0 };
      const { ramUsedMb, ramTotalMb } = this.getMemoryStats(mem);
      const { diskTotalGb, diskUsedGb, diskUsagePct } = diskStats;
      const { diskReadKb, diskWriteKb } = diskIO;

      const metricsData = {
        cpuUsage: Number(cpu.currentLoad.toFixed(2)),
        ramUsedMb,
        ramTotalMb,
        diskUsagePct,
        diskUsedGb,
        diskTotalGb,
        diskReadKb,
        diskWriteKb,
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
      this.logger.debug(
        `Host Metrics: RAM ${ramUsedMb}MB / ${ramTotalMb}MB | Disk ${diskUsagePct}% (${diskUsedGb}/${diskTotalGb}GB) | IO R:${diskReadKb}KB/s W:${diskWriteKb}KB/s`,
      );
    } catch (error) {
      this.logger.error('Failed to collect host metrics', error as Error);
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
        : null;

      let realHostname = osInfo.hostname || 'unknown-host';
      try {
        if (fs.existsSync('/host/proc/sys/kernel/hostname')) {
          realHostname = fs.readFileSync('/host/proc/sys/kernel/hostname', 'utf-8').trim();
        } else if (fs.existsSync('/proc/sys/kernel/hostname')) {
          realHostname = fs.readFileSync('/proc/sys/kernel/hostname', 'utf-8').trim();
        }
      } catch (err) {
        this.logger.warn(`Failed to read host hostname: ${err}`);
      }

      return {
        hostname: realHostname,
        os: `${osInfo.distro || 'Unknown'} ${osInfo.release || ''}`.trim(),
        kernel: osInfo.kernel || 'Unknown',
        uptime: formattedUptime,
        cpuCores: `${cpu.cores || 0} cores`,
        ipAddress: primaryInterface?.ip4
          ? `${primaryInterface.ip4} (${primaryInterface.iface})`
          : 'Unavailable',
      };
    } catch (error) {
      this.logger.error('Failed to collect server info', error as Error);
      // Tidak lempar data fiktif — beri tahu FE bahwa data gagal diambil
      return {
        hostname: 'Unavailable',
        os: 'Unavailable',
        kernel: 'Unavailable',
        uptime: 'Unavailable',
        cpuCores: 'Unavailable',
        ipAddress: 'Unavailable',
      };
    }
  }
}