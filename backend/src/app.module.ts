import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { ProberModule } from './prober/prober.module';
import { MonitorsModule } from './monitors/monitors.module';
import { EventsModule } from './events/events.module';
import { MetricsModule } from './metrics/metrics.module';
import { AlertsModule } from './alerts/alerts.module';
import { AuthModule } from './auth/auth.module';
import { DataCentersModule } from './datacenters/datacenters.module';
import { IpManagementModule } from './ip-management/ip-management.module';
import { BackupsModule } from './backups/backups.module';
import { DatabasesModule } from './databases/databases.module';
import { GroupsModule } from './groups/groups.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    ProberModule,
    MonitorsModule,
    EventsModule,
    MetricsModule,
    AlertsModule,
    AuthModule,
    DataCentersModule,
    IpManagementModule,
    BackupsModule,
    DatabasesModule,
    GroupsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
