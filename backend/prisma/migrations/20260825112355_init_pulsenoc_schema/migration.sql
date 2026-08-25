-- CreateEnum
CREATE TYPE "MonitorType" AS ENUM ('HTTP', 'TCP', 'PING', 'DATABASE');

-- CreateEnum
CREATE TYPE "MonitorStatus" AS ENUM ('UP', 'DEGRADED', 'DOWN', 'PENDING');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('INVESTIGATING', 'IDENTIFIED', 'MONITORING', 'RESOLVED');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('CRITICAL', 'MAJOR', 'MINOR', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "AlertChannelType" AS ENUM ('TELEGRAM', 'DISCORD', 'SLACK', 'WEBHOOK');

-- CreateTable
CREATE TABLE "monitors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "MonitorType" NOT NULL DEFAULT 'HTTP',
    "url" TEXT,
    "port" INTEGER,
    "intervalSec" INTEGER NOT NULL DEFAULT 60,
    "timeoutSec" INTEGER NOT NULL DEFAULT 10,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "currentStatus" "MonitorStatus" NOT NULL DEFAULT 'PENDING',
    "uptimePercent24h" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "heartbeats" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "status" "MonitorStatus" NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "statusCode" INTEGER,
    "errorMessage" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "heartbeats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" "IncidentSeverity" NOT NULL DEFAULT 'CRITICAL',
    "status" "IncidentStatus" NOT NULL DEFAULT 'INVESTIGATING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_updates" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "status" "IncidentStatus" NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_channels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AlertChannelType" NOT NULL,
    "webhookUrl" TEXT,
    "chatId" TEXT,
    "botToken" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "host_metrics" (
    "id" TEXT NOT NULL,
    "cpuUsage" DOUBLE PRECISION NOT NULL,
    "ramUsedMb" DOUBLE PRECISION NOT NULL,
    "ramTotalMb" DOUBLE PRECISION NOT NULL,
    "diskUsagePct" DOUBLE PRECISION NOT NULL,
    "networkInKb" DOUBLE PRECISION NOT NULL,
    "networkOutKb" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "host_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AlertChannelToMonitor" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AlertChannelToMonitor_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "heartbeats_monitorId_timestamp_idx" ON "heartbeats"("monitorId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "incidents_monitorId_status_idx" ON "incidents"("monitorId", "status");

-- CreateIndex
CREATE INDEX "host_metrics_timestamp_idx" ON "host_metrics"("timestamp" DESC);

-- CreateIndex
CREATE INDEX "_AlertChannelToMonitor_B_index" ON "_AlertChannelToMonitor"("B");

-- AddForeignKey
ALTER TABLE "heartbeats" ADD CONSTRAINT "heartbeats_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_updates" ADD CONSTRAINT "incident_updates_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AlertChannelToMonitor" ADD CONSTRAINT "_AlertChannelToMonitor_A_fkey" FOREIGN KEY ("A") REFERENCES "alert_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AlertChannelToMonitor" ADD CONSTRAINT "_AlertChannelToMonitor_B_fkey" FOREIGN KEY ("B") REFERENCES "monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
