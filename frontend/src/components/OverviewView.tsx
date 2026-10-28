// frontend/src/components/OverviewView.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import ServerInfoCard from '@/components/ServerInfoCard';
import CircularGauge from '@/components/CircularGauge';
import TelemetrySparkline from '@/components/TelemetrySparkline';
import MonitorCard, { Monitor, SSLCertificateInfo } from '@/components/MonitorCard';
import ServiceDetailView from '@/components/ServiceDetailView';
import GroupDetailView from '@/components/GroupDetailView';
import MemoryDetailView from '@/components/MemoryDetailView';
import { useSocket } from '@/hooks/useSocket';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  Layers,
  CheckCircle2,
  AlertTriangle,
  Zap,
  ChevronDown,
  ChevronUp,
  Terminal,
  Activity,
  Thermometer,
  Battery,
  BatteryCharging,
} from 'lucide-react';

export interface HostMetric {
  id?: string;
  timestamp: string;
  cpuUsage: number;
  ramUsagePct: number;
  ramUsedMb: number;
  ramTotalMb: number;
  diskUsagePct: number;
  diskUsedGb?: number;
  diskTotalGb?: number;
  networkInKb: number;
  networkOutKb: number;
  diskReadKb?: number;
  diskWriteKb?: number;
  cpuTempC?: number;
  battery?: {
    hasBattery: boolean;
    percentage: number;
    status: string;
    isCharging: boolean;
    acOnline: boolean;
  };
}

interface HeartbeatWsPayload {
  monitorId: string;
  status: 'UP' | 'DOWN' | 'DEGRADED';
  latencyMs: number;
  statusCode?: number;
  timestamp: string;
  uptimePercent24h?: number;
  sslCert?: SSLCertificateInfo;
}

export default function OverviewView() {
  const toast = useToast();
  const { socket } = useSocket();
  const { user, authFetch } = useAuth();

  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [registeredGroups, setRegisteredGroups] = useState<{ id: string; name: string }[]>([]);
  const [selectedMonitor, setSelectedMonitor] = useState<Monitor | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [showMemoryDetail, setShowMemoryDetail] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const [hostMetrics, setHostMetrics] = useState<HostMetric | null>(null);
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [netRxHistory, setNetRxHistory] = useState<number[]>([]);
  const [netTxHistory, setNetTxHistory] = useState<number[]>([]);
  const [diskReadHistory, setDiskReadHistory] = useState<number[]>([]);
  const [diskWriteHistory, setDiskWriteHistory] = useState<number[]>([]);

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  const fetchGroups = useCallback(async () => {
    try {
      const res = await authFetch('/api/groups');
      if (res.ok) {
        const data = await res.json();
        setRegisteredGroups(Array.isArray(data) ? data : []);
      }
    } catch (err: unknown) {
      console.error('Failed to fetch groups:', err);
    }
  }, [authFetch]);

  const fetchMonitors = useCallback(async () => {
    try {
      const res = await authFetch('/api/monitors');
      if (res.ok) {
        const data: Monitor[] = await res.json();
        const normalized = (data || []).map((m) => ({
          ...m,
          heartbeats: Array.isArray(m.heartbeats) ? m.heartbeats : [],
        }));
        setMonitors(normalized);
      }
    } catch (err: unknown) {
      console.error('Failed to fetch monitors:', err);
    }
  }, [authFetch]);

  const fetchHostHistory = useCallback(async () => {
    try {
      const res = await authFetch('/api/metrics/history?limit=16');
      if (res.ok) {
        const data: HostMetric[] = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const chronological = [...data].reverse();
          setHostMetrics(chronological[chronological.length - 1]);
          setCpuHistory(chronological.map((d) => d.cpuUsage));
          setNetRxHistory(chronological.map((d) => d.networkInKb));
          setNetTxHistory(chronological.map((d) => d.networkOutKb));
          setDiskReadHistory(chronological.map((d) => d.diskReadKb ?? 0));
          setDiskWriteHistory(chronological.map((d) => d.diskWriteKb ?? 0));
        }
      }
    } catch (err: unknown) {
      console.error('Failed to fetch host metrics history:', err);
    }
  }, [authFetch]);

  useEffect(() => {
    if (user) {
      fetchMonitors();
      fetchGroups();
      fetchHostHistory();
    }
  }, [user, fetchMonitors, fetchGroups, fetchHostHistory]);

  useEffect(() => {
    if (!socket) return;

    socket.on('metrics:host', (data: HostMetric) => {
      setHostMetrics(data);
      setCpuHistory((prev) => [...prev.slice(-15), data.cpuUsage]);
      setNetRxHistory((prev) => [...prev.slice(-15), data.networkInKb]);
      setNetTxHistory((prev) => [...prev.slice(-15), data.networkOutKb]);
      setDiskReadHistory((prev) => [...prev.slice(-15), data.diskReadKb ?? 0]);
      setDiskWriteHistory((prev) => [...prev.slice(-15), data.diskWriteKb ?? 0]);
    });

    socket.on('monitors:heartbeat', (data: HeartbeatWsPayload) => {
      setMonitors((prev) =>
        prev.map((m) => {
          if (m.id === data.monitorId) {
            if (m.currentStatus !== data.status) {
              if (data.status === 'DOWN') {
                toast.error(`🚨 OUTAGE: ${m.name} is DOWN!`);
              } else if (data.status === 'UP' && (m.currentStatus === 'DOWN' || m.currentStatus === 'DEGRADED')) {
                toast.success(`✅ RECOVERY: ${m.name} is back UP!`);
              }
            }

            const newHb = {
              id: `${Date.now()}`,
              status: data.status,
              latencyMs: data.latencyMs,
              statusCode: data.statusCode,
              timestamp: data.timestamp,
            };
            const updated: Monitor = {
              ...m,
              currentStatus: data.status,
              uptimePercent24h: data.uptimePercent24h ?? m.uptimePercent24h,
              sslCert: data.sslCert || m.sslCert,
              heartbeats: [newHb, ...(m.heartbeats || []).slice(0, 29)],
            };
            if (selectedMonitor && selectedMonitor.id === m.id) {
              setSelectedMonitor(updated);
            }
            return updated;
          }
          return m;
        }),
      );
    });

    return () => {
      socket.off('metrics:host');
      socket.off('monitors:heartbeat');
    };
  }, [socket, selectedMonitor, toast]);

  const groupedMonitors = (() => {
    const acc: Record<string, Monitor[]> = {};
    (registeredGroups || []).forEach((g) => {
      acc[g.name] = [];
    });
    (monitors || []).forEach((m) => {
      const gName = m.group || 'Default';
      if (!acc[gName]) acc[gName] = [];
      acc[gName].push(m);
    });
    return acc;
  })();

  const totalServices = monitors.length;
  const onlineServices = monitors.filter((m) => m.currentStatus === 'UP').length;
  const offlineServices = monitors.filter((m) => m.currentStatus === 'DOWN').length;
  const avgLatency =
    monitors.length > 0
      ? Math.round(
          monitors.reduce((acc, m) => acc + ((m.heartbeats && m.heartbeats[0]?.latencyMs) || 0), 0) /
            (monitors.length || 1),
        )
      : 0;

  const hasMetrics = !!hostMetrics;
  const ramUsedGb = hasMetrics ? (hostMetrics!.ramUsedMb / 1024).toFixed(1) : '—';
  const ramTotalGb = hasMetrics ? (hostMetrics!.ramTotalMb / 1024).toFixed(1) : '—';
  const ramPct =
    hasMetrics && hostMetrics!.ramTotalMb > 0
      ? Math.round((hostMetrics!.ramUsedMb / hostMetrics!.ramTotalMb) * 100)
      : 0;

  const diskPct = hasMetrics ? Math.round(hostMetrics!.diskUsagePct) : 0;
  const diskUsedGb =
    hasMetrics && hostMetrics!.diskUsedGb !== undefined ? hostMetrics!.diskUsedGb.toFixed(1) : '—';
  const diskTotalGb =
    hasMetrics && hostMetrics!.diskTotalGb !== undefined ? hostMetrics!.diskTotalGb.toFixed(1) : '—';

  const cpuDisplay = hasMetrics ? `${hostMetrics!.cpuUsage}%` : '—';
  const netInDisplay = hasMetrics ? hostMetrics!.networkInKb.toFixed(1) : '—';
  const netOutDisplay = hasMetrics ? hostMetrics!.networkOutKb.toFixed(1) : '—';

  const hasDiskIO =
    hasMetrics && hostMetrics!.diskReadKb !== undefined && hostMetrics!.diskWriteKb !== undefined;
  const diskIoBadge = hasDiskIO
    ? `R: ${hostMetrics!.diskReadKb!.toFixed(1)} KB/s  W: ${hostMetrics!.diskWriteKb!.toFixed(1)} KB/s`
    : 'Not tracked';

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
            NETWORK OPERATIONS CENTER
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mt-0.5">
            Overview
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage and monitor your network infrastructure in real-time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {hostMetrics?.cpuTempC !== undefined && (
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold ${
                hostMetrics.cpuTempC >= 80
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse'
                  : hostMetrics.cpuTempC >= 65
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              }`}
              title="Debian Host CPU Temperature"
            >
              <Thermometer className="w-3.5 h-3.5" />
              {hostMetrics.cpuTempC.toFixed(1)}°C
            </div>
          )}
          {hostMetrics?.battery?.hasBattery && (
            <div
              className="flex items-center gap-1.5 bg-[#161C2E] border border-[#2B3555] text-cyan-300 px-3 py-1.5 rounded-xl text-xs font-mono font-bold"
              title={`Battery: ${hostMetrics.battery.status}`}
            >
              {hostMetrics.battery.isCharging ? (
                <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Battery className="w-3.5 h-3.5 text-cyan-400" />
              )}
              {hostMetrics.battery.percentage}%
            </div>
          )}
          <Link
            href="/processes"
            className="flex items-center gap-2 bg-[#161C2E] hover:bg-[#1E2640] border border-[#2B3555] text-slate-200 px-3.5 py-2 rounded-xl font-semibold text-xs shadow-sm transition"
          >
            <Activity className="w-3.5 h-3.5 text-rose-400" /> Process Explorer
          </Link>
          <Link
            href="/docker"
            className="flex items-center gap-2 bg-[#161C2E] hover:bg-[#1E2640] border border-[#2B3555] text-slate-200 px-3.5 py-2 rounded-xl font-semibold text-xs shadow-sm transition"
          >
            <Terminal className="w-3.5 h-3.5 text-emerald-400" /> Docker Logs
          </Link>
        </div>
      </div>

      {/* Main Content Render */}
      {selectedMonitor ? (
        <ServiceDetailView
          monitor={selectedMonitor}
          onBack={() => setSelectedMonitor(null)}
        />
      ) : selectedGroup ? (
        <GroupDetailView
          groupName={selectedGroup}
          monitors={monitors}
          onBack={() => setSelectedGroup(null)}
          onSelectMonitor={(m) => setSelectedMonitor(m)}
          onDeleteMonitor={() => {}}
          isReadOnly={true}
        />
      ) : showMemoryDetail ? (
        <MemoryDetailView onBack={() => setShowMemoryDetail(false)} />
      ) : (
        <div className="space-y-6">
          {/* Stats Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="bg-[#121829] border border-[#1E2640] p-4 rounded-2xl flex items-center justify-between shadow-sm">
              <div>
                <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                  TOTAL SERVICES
                </div>
                <div className="text-2xl font-extrabold text-white font-mono mt-1">
                  {totalServices}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 text-slate-300">
                <Layers className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-[#121829] border border-[#1E2640] p-4 rounded-2xl flex items-center justify-between shadow-sm">
              <div>
                <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                  ONLINE
                </div>
                <div className="text-2xl font-extrabold text-emerald-400 font-mono mt-1">
                  {onlineServices}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-[#121829] border border-[#1E2640] p-4 rounded-2xl flex items-center justify-between shadow-sm">
              <div>
                <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                  OFFLINE
                </div>
                <div className="text-2xl font-extrabold text-rose-400 font-mono mt-1">
                  {offlineServices}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-[#121829] border border-[#1E2640] p-4 rounded-2xl flex items-center justify-between shadow-sm">
              <div>
                <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                  AVG LATENCY
                </div>
                <div className="text-2xl font-extrabold text-amber-400 font-mono mt-1">
                  {avgLatency}ms
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Zap className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-[#121829] border border-[#1E2640] p-4 rounded-2xl flex items-center justify-between shadow-sm col-span-2 sm:col-span-1">
              <div>
                <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                  SERVICE GROUPS
                </div>
                <div className="text-2xl font-extrabold text-indigo-400 font-mono mt-1">
                  {Object.keys(groupedMonitors).length}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <Layers className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Hardware Telemetry Gauges */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-4">
              <ServerInfoCard
                liveCpuTempC={hostMetrics?.cpuTempC}
                liveBattery={hostMetrics?.battery}
              />
            </div>
            <div className="lg:col-span-4">
              <CircularGauge
                title="MEMORY"
                percentage={ramPct}
                usedLabel={`${ramUsedGb} / ${ramTotalGb} GB`}
                type="memory"
                onClick={() => setShowMemoryDetail(true)}
              />
            </div>
            <div className="lg:col-span-4">
              <CircularGauge
                title="STORAGE (/)"
                percentage={diskPct}
                usedLabel={`${diskUsedGb} / ${diskTotalGb} GB`}
                type="storage"
              />
            </div>
          </div>

          {/* Sparklines */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <TelemetrySparkline
              title="CPU USAGE"
              type="cpu"
              currentValue={cpuDisplay}
              data={cpuHistory}
            />

            <TelemetrySparkline
              title="NETWORK I/O"
              type="network"
              badgeLabel={`↓ ${netInDisplay} KB/s  ↑ ${netOutDisplay} KB/s`}
              legend1={{ label: 'RX', color: '#10B981' }}
              legend2={{ label: 'TX', color: '#F59E0B' }}
              data1={netRxHistory}
              data2={netTxHistory}
            />

            <TelemetrySparkline
              title="DISK I/O"
              type="disk"
              badgeLabel={diskIoBadge}
              legend1={{ label: 'Read', color: '#F97316' }}
              legend2={{ label: 'Write', color: '#EF4444' }}
              data1={diskReadHistory}
              data2={diskWriteHistory}
            />
          </div>

          {/* Monitored Infrastructure Accordion */}
          {Object.keys(groupedMonitors).length === 0 ? (
            <div className="bg-[#121829] border border-[#1E2640] rounded-2xl p-8 text-center text-slate-500 font-mono text-xs shadow-sm">
              No custom services registered.
            </div>
          ) : (
            Object.entries(groupedMonitors).map(([groupName, groupMonitors]) => {
              const isCollapsed = !!collapsedGroups[groupName];
              const groupUpCount = groupMonitors.filter((m) => m.currentStatus === 'UP').length;
              return (
                <div key={groupName} className="bg-[#121829] border border-[#1E2640] rounded-2xl overflow-hidden shadow-sm">
                  <div className="flex items-center justify-between p-4 bg-[#161C2E]/40 border-b border-[#1E2640]/80">
                    <div
                      onClick={() => setSelectedGroup(groupName)}
                      className="flex items-center gap-3 cursor-pointer group/gtitle"
                    >
                      <div className="w-3 h-3 rounded-full bg-indigo-500 animate-pulse" />
                      <h3 className="font-bold text-sm text-slate-100 group-hover/gtitle:text-indigo-300 transition flex items-center gap-2">
                        {groupName}
                        <span className="text-xs font-mono font-normal text-slate-400 bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700/60">
                          {groupMonitors.length} {groupMonitors.length === 1 ? 'service' : 'services'} ({groupUpCount} UP)
                        </span>
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedGroup(groupName)}
                        className="text-xs font-mono text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 px-2.5 py-1 rounded-lg transition"
                      >
                        View Group Studio →
                      </button>
                      <button onClick={() => toggleGroup(groupName)} className="text-slate-400 hover:text-white">
                        {isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div className="p-5">
                      {groupMonitors.length === 0 ? (
                        <div className="text-center py-6 text-slate-500 text-xs font-mono border border-dashed border-[#1E2640] rounded-xl">
                          No services registered in &quot;{groupName}&quot; yet.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-4">
                          {groupMonitors.map((m) => (
                            <MonitorCard
                              key={m.id}
                              monitor={m}
                              onSelect={(item) => setSelectedMonitor(item)}
                              isReadOnly={true}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
