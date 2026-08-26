// backend/src/metrics/metrics.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { MetricsService } from './metrics.service';

@Controller('api/metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('history')
  getHistory(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.metricsService.getMetricsHistory(parsedLimit);
  }

  @Get('server-info')
  getServerInfo() {
    return this.metricsService.getServerInfo();
  }

  @Get('memory-detail')
  getMemoryDetail() {
    return this.metricsService.getDetailedMemoryStats();
  }
}