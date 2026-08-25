// backend/src/prober/prober.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Monitor, MonitorStatus, MonitorType } from '@prisma/client';
import axios from 'axios';
import * as net from 'net';
import { performance } from 'perf_hooks';

export interface ProbeResult {
  status: MonitorStatus;
  latencyMs: number;
  statusCode?: number;
  errorMessage?: string;
}

@Injectable()
export class ProberService {
  private readonly logger = new Logger(ProberService.name);

  async probe(monitor: Monitor): Promise<ProbeResult> {
    switch (monitor.type) {
      case MonitorType.HTTP:
        return this.probeHttp(monitor);
      case MonitorType.TCP:
        return this.probeTcp(monitor);
      default:
        return {
          status: MonitorStatus.DOWN,
          latencyMs: 0,
          errorMessage: `Unsupported monitor type: ${monitor.type}`,
        };
    }
  }

  // 1. Probe HTTP / HTTPS
  private async probeHttp(monitor: Monitor): Promise<ProbeResult> {
    if (!monitor.url) {
      return {
        status: MonitorStatus.DOWN,
        latencyMs: 0,
        errorMessage: 'URL is required for HTTP monitor',
      };
    }

    const start = performance.now();
    try {
      const response = await axios.get(monitor.url, {
        timeout: (monitor.timeoutSec || 10) * 1000,
        validateStatus: () => true, // Capture status code without throwing axios exception
      });

      const latencyMs = Math.round(performance.now() - start);
      // HTTP Status 2xx, 3xx, 401, 403 confirm the server daemon is alive and handling traffic
      const isUp = (response.status >= 200 && response.status < 400) || response.status === 401 || response.status === 403;

      let detailMsg: string | undefined = undefined;
      if (!isUp) {
        detailMsg = `HTTP Status: ${response.status}`;
      } else if (response.status === 401) {
        detailMsg = 'Response OK (401 Auth Required)';
      } else if (response.status === 403) {
        detailMsg = 'Response OK (403 Forbidden)';
      } else {
        detailMsg = 'Response OK';
      }

      return {
        status: isUp ? MonitorStatus.UP : MonitorStatus.DOWN,
        latencyMs,
        statusCode: response.status,
        errorMessage: detailMsg,
      };
    } catch (error: any) {
      const latencyMs = Math.round(performance.now() - start);
      return {
        status: MonitorStatus.DOWN,
        latencyMs,
        errorMessage: error.message || 'Request Failed',
      };
    }
  }

  // 2. Probe TCP Port Check
  private async probeTcp(monitor: Monitor): Promise<ProbeResult> {
    const { url, port } = monitor;
    if (!url || !port) {
      return {
        status: MonitorStatus.DOWN,
        latencyMs: 0,
        errorMessage: 'Host (url) and Port are required for TCP monitor',
      };
    }

    return new Promise((resolve) => {
      const start = performance.now();
      const socket = new net.Socket();
      const timeoutMs = (monitor.timeoutSec || 10) * 1000;

      socket.setTimeout(timeoutMs);

      socket.connect(port, url, () => {
        const latencyMs = Math.round(performance.now() - start);
        socket.destroy();
        resolve({
          status: MonitorStatus.UP,
          latencyMs,
          errorMessage: 'TCP Port Open',
        });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({
          status: MonitorStatus.DOWN,
          latencyMs: timeoutMs,
          errorMessage: 'Connection Timed Out',
        });
      });

      socket.on('error', (err) => {
        socket.destroy();
        const latencyMs = Math.round(performance.now() - start);
        resolve({
          status: MonitorStatus.DOWN,
          latencyMs,
          errorMessage: err.message,
        });
      });
    });
  }
}