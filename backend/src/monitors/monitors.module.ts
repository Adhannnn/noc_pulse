import { Module } from '@nestjs/common';
import { MonitorsService } from './monitors.service';
import { MonitorsController } from './monitors.controller';
import { ProberModule } from 'src/prober/prober.module';
import { AlertsModule } from 'src/alerts/alerts.module';

@Module({
  imports: [ProberModule, AlertsModule],
  providers: [MonitorsService],
  controllers: [MonitorsController],
  exports: [MonitorsService],
})
export class MonitorsModule {}
