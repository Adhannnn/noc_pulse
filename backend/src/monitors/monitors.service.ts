// backend/src/monitors/monitors.service.ts
import { Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ProberService } from '../prober/prober.service';
import { EventsGateway } from '../events/events.gateway';
import { AlertsService } from '../alerts/alerts.service'; // <-- Import AlertsService
import { CreateMonitorDto } from './dto/create-monitor.dto';
import { IncidentStatus, Monitor, MonitorStatus } from '@prisma/client';

@Injectable()
export class MonitorsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MonitorsService.name);
  private readonly activeProbes = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly prober: ProberService,
    private readonly eventsGateway: EventsGateway,
    private readonly alertsService: AlertsService, // <-- Inject AlertsService
  ) {}

  async onApplicationBootstrap() {
    this.logger.log('Starting 1-second precision probe ticker daemon...');
    await this.handleCronProbing();
    setInterval(() => {
      this.handleCronProbing().catch((err) =>
        this.logger.error('Error in probe ticker interval loop:', err),
      );
    }, 1000);
  }

  async create(dto: CreateMonitorDto) {
    const monitor = await this.prisma.monitor.create({
      data: dto,
    });

    this.probeSingleMonitor(monitor).catch((err) =>
      this.logger.error(`Initial probe failed for monitor ${monitor.id}`, err),
    );

    return monitor;
  }

  async findAll() {
    return this.prisma.monitor.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        heartbeats: {
          take: 30,
          orderBy: { timestamp: 'desc' },
        },
      },
    });
  }

  async findOne(id: string) {
    const monitor = await this.prisma.monitor.findUnique({
      where: { id },
      include: {
        heartbeats: {
          take: 100,
          orderBy: { timestamp: 'desc' },
        },
        incidents: {
          orderBy: { startedAt: 'desc' },
          include: { updates: true },
        },
      },
    });

    if (!monitor) {
      throw new NotFoundException(`Monitor with ID ${id} not found`);
    }

    return monitor;
  }

  async update(id: string, dto: Partial<CreateMonitorDto>) {
    return this.prisma.monitor.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    return this.prisma.monitor.delete({
      where: { id },
    });
  }

  async renameGroup(oldName: string, newName: string) {
    return this.prisma.monitor.updateMany({
      where: { group: oldName },
      data: { group: newName },
    });
  }

  async deleteGroup(groupName: string) {
    return this.prisma.monitor.deleteMany({
      where: { group: groupName },
    });
  }

  async findAllIncidents() {
    return this.prisma.incident.findMany({
      orderBy: { startedAt: 'desc' },
      include: {
        monitor: true,
        updates: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  @Cron(CronExpression.EVERY_SECOND)
  async handleCronProbing() {
    try {
      const activeMonitors = await this.prisma.monitor.findMany({
        where: { isActive: true },
      });

      const now = Date.now();

      for (const m of activeMonitors) {
        // Prevent concurrent overlapping probes on the same target
        if (this.activeProbes.has(m.id)) continue;

        const lastTime = m.lastProbedAt ? new Date(m.lastProbedAt).getTime() : 0;
        const elapsedSec = (now - lastTime) / 1000;
        const interval = m.intervalSec || 10;

        if (elapsedSec >= interval) {
          this.activeProbes.add(m.id);

          this.prisma.monitor
            .update({
              where: { id: m.id },
              data: { lastProbedAt: new Date(now) },
            })
            .catch((err) => this.logger.error(`Failed to update lastProbedAt for ${m.id}`, err));

          // Run probe asynchronously so it NEVER blocks other monitors or future ticks!
          this.probeSingleMonitor(m)
            .catch((err) => this.logger.error(`Error probing monitor ${m.name} (${m.id})`, err))
            .finally(() => {
              this.activeProbes.delete(m.id);
            });
        }
      }
    } catch (error) {
      this.logger.error('Error during ticker probing cycle:', error);
    }
  }

  private async probeSingleMonitor(monitor: Monitor) {
    const previousStatus = monitor.currentStatus;
    const result = await this.prober.probe(monitor);

    // 1. Simpan Heartbeat
    const heartbeat = await this.prisma.heartbeat.create({
      data: {
        monitorId: monitor.id,
        status: result.status,
        latencyMs: result.latencyMs,
        statusCode: result.statusCode,
        errorMessage: result.errorMessage,
      },
    });

    // 2. Update Status Monitor and calculate uptime %
    const updatedMonitor = await this.updateMonitorStatus(monitor.id, result.status);

    // 3. PUSH REALTIME WEBSOCKET WITH UPTIME %
    this.eventsGateway.broadcastMonitorHeartbeat({
      monitorId: monitor.id,
      status: result.status,
      latencyMs: result.latencyMs,
      statusCode: result.statusCode,
      timestamp: heartbeat.timestamp,
      uptimePercent24h: updatedMonitor.uptimePercent24h,
    });

    // 4. INCIDENT STATE MACHINE & ALERT DISPATCH
    await this.handleIncidentTransitions(monitor, previousStatus, result);
  }

  // Otomatisasi Buka & Selesaikan Insiden serta Kirim Alert
  private async handleIncidentTransitions(
    monitor: Monitor,
    prevStatus: MonitorStatus,
    result: { status: MonitorStatus; latencyMs: number; statusCode?: number; errorMessage?: string },
  ) {
    // KASUS 1: Status berubah menjadi DOWN (Buka Incident Baru)
    if (result.status === MonitorStatus.DOWN && prevStatus !== MonitorStatus.DOWN) {
      this.logger.warn(`Service DOWN detected: ${monitor.name}`);

      const incident = await this.prisma.incident.create({
        data: {
          monitorId: monitor.id,
          title: `Service Down: ${monitor.name}`,
          description: result.errorMessage || `HTTP Status: ${result.statusCode}`,
          status: IncidentStatus.INVESTIGATING,
          updates: {
            create: {
              status: IncidentStatus.INVESTIGATING,
              message: `Downtime detected. Error: ${result.errorMessage || result.statusCode}`,
            },
          },
        },
      });

      // Kirim Notifikasi Alert DOWN
      await this.alertsService.dispatchAlert({
        monitor,
        status: 'DOWN',
        latencyMs: result.latencyMs,
        statusCode: result.statusCode,
        errorMessage: result.errorMessage,
      });
    }

    // KASUS 2: Status pulih kembali ke UP dari DOWN (Resolve Incident)
    else if (result.status === MonitorStatus.UP && prevStatus === MonitorStatus.DOWN) {
      this.logger.log(`Service RECOVERED: ${monitor.name}`);

      // Cari insiden aktif terakhir yang belum selesai
      const activeIncident = await this.prisma.incident.findFirst({
        where: {
          monitorId: monitor.id,
          status: { not: IncidentStatus.RESOLVED },
        },
        orderBy: { startedAt: 'desc' },
      });

      let downtimeDuration = 'Unknown';

      if (activeIncident) {
        const now = new Date();
        const diffMs = now.getTime() - activeIncident.startedAt.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffSecs = Math.floor((diffMs % 60000) / 1000);
        downtimeDuration = `${diffMins}m ${diffSecs}s`;

        await this.prisma.incident.update({
          where: { id: activeIncident.id },
          data: {
            status: IncidentStatus.RESOLVED,
            resolvedAt: now,
            updates: {
              create: {
                status: IncidentStatus.RESOLVED,
                message: `Service has fully recovered. Total downtime: ${downtimeDuration}`,
              },
            },
          },
        });
      }

      // Kirim Notifikasi Alert RESOLVED
      await this.alertsService.dispatchAlert({
        monitor,
        status: 'RESOLVED',
        latencyMs: result.latencyMs,
        statusCode: result.statusCode,
        downtimeDuration,
      });
    }
  }

  private async updateMonitorStatus(monitorId: string, currentStatus: MonitorStatus) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [totalHeartbeats, upHeartbeats] = await Promise.all([
      this.prisma.heartbeat.count({
        where: { monitorId, timestamp: { gte: oneDayAgo } },
      }),
      this.prisma.heartbeat.count({
        where: {
          monitorId,
          timestamp: { gte: oneDayAgo },
          status: MonitorStatus.UP,
        },
      }),
    ]);

    const uptimePercent =
      totalHeartbeats > 0
        ? Number(((upHeartbeats / totalHeartbeats) * 100).toFixed(2))
        : 100.0;

    return this.prisma.monitor.update({
      where: { id: monitorId },
      data: {
        currentStatus,
        uptimePercent24h: uptimePercent,
      },
    });
  }
}