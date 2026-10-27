'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Globe,
  Server,
  RefreshCw,
  Clock,
  Lock,
  ArrowRight,
} from 'lucide-react';

interface PublicHeartbeat {
  status: 'UP' | 'DOWN' | 'DEGRADED';
  latencyMs: number;
  timestamp: string;
}

interface PublicMonitor {
  id: string;
  name: string;
  type: string;
  group: string;
  currentStatus: 'UP' | 'DOWN' | 'DEGRADED' | 'PENDING';
  uptimePercent24h: number;
  lastProbedAt?: string;
  sslDaysRemaining?: number;
  heartbeats: PublicHeartbeat[];
}

interface PublicGroup {
  name: string;
  status: 'OPERATIONAL' | 'DEGRADED' | 'OUTAGE';
  uptimePercent: number;
  monitors: PublicMonitor[];
}

interface Incident {
  id: string;
  monitorId: string;
  title: string;
  description?: string;
  severity: string;
  status: string;
  startedAt: string;
  resolvedAt?: string;
}

interface PublicStatusData {
  overallStatus: 'ALL_OPERATIONAL' | 'DEGRADED' | 'MAJOR_OUTAGE';
  systemUptime: number;
  lastUpdated: string;
  groups: PublicGroup[];
  activeIncidents: Incident[];
  pastIncidents: Incident[];
}

export default function PublicStatusPage() {
  const [data, setData] = useState<PublicStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStatus = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/public/status`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error(`Failed to load system status: HTTP ${res.status}`);
      }
      const json: PublicStatusData = await res.json();
      setData(json);
      setLastRefreshed(new Date());
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to connect to status telemetry engine';
      setError(msg);
    } finally {
      setLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchStatus();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const getOverallStatusConfig = (status: PublicStatusData['overallStatus'] = 'ALL_OPERATIONAL') => {
    switch (status) {
      case 'ALL_OPERATIONAL':
        return {
          title: 'All Systems Operational',
          desc: 'All monitored infrastructure, microservices, and external endpoints are performing normally.',
          bgColor: 'bg-emerald-500/10',
          borderColor: 'border-emerald-500/30',
          textColor: 'text-emerald-400',
          indicatorColor: 'bg-emerald-400',
          icon: CheckCircle2,
        };
      case 'DEGRADED':
        return {
          title: 'Degraded System Performance',
          desc: 'Some services are experiencing elevated latency or non-critical anomalies.',
          bgColor: 'bg-amber-500/10',
          borderColor: 'border-amber-500/30',
          textColor: 'text-amber-400',
          indicatorColor: 'bg-amber-400',
          icon: AlertTriangle,
        };
      case 'MAJOR_OUTAGE':
      default:
        return {
          title: 'Active Service Outage',
          desc: 'One or more critical services are currently unavailable. Engineers are actively investigating.',
          bgColor: 'bg-rose-500/10',
          borderColor: 'border-rose-500/30',
          textColor: 'text-rose-400',
          indicatorColor: 'bg-rose-400',
          icon: XCircle,
        };
    }
  };

  const statusConfig = getOverallStatusConfig(data?.overallStatus);
  const StatusIcon = statusConfig.icon;

  return (
    <div className="min-h-screen bg-[#0A0D14] text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-[#1E2640] bg-[#0E131F]/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-sm">
              <Activity className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <span className="font-mono font-bold tracking-wider text-slate-100 text-sm">
                PULSE<span className="text-indigo-400">NOC</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono ml-2 uppercase px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700/60">
                Live Status
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 font-mono">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>Updated {lastRefreshed.toLocaleTimeString()}</span>
            </div>
            <button
              onClick={() => fetchStatus(true)}
              disabled={isRefreshing}
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-[#1E2640] rounded-lg transition border border-transparent hover:border-slate-700"
              title="Refresh telemetry now"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-mono font-medium px-3 py-1.5 rounded-lg bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/30 hover:border-indigo-400 transition"
            >
              <span>Operator Portal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 flex-1 flex flex-col gap-8">
        {loading && !data ? (
          <div className="p-12 text-center text-slate-400 font-mono flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
            <p className="text-sm">Connecting to PulseNOC telemetry engine...</p>
          </div>
        ) : error ? (
          <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-3">
            <XCircle className="w-6 h-6 shrink-0 text-rose-400" />
            <div>
              <h3 className="font-bold text-sm">Failed to Load Status</h3>
              <p className="text-xs text-rose-200/80 mt-0.5">{error}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Global Status Hero Banner */}
            <div
              className={`rounded-2xl p-6 sm:p-8 border ${statusConfig.bgColor} ${statusConfig.borderColor} transition shadow-lg`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex items-start sm:items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${statusConfig.bgColor} border ${statusConfig.borderColor} ${statusConfig.textColor}`}
                  >
                    <StatusIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${statusConfig.indicatorColor} animate-ping`} />
                      <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100">
                        {statusConfig.title}
                      </h2>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
                      {statusConfig.desc}
                    </p>
                  </div>
                </div>

                <div className="sm:text-right shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-[#1E2640]/40">
                  <div className="text-2xl sm:text-3xl font-mono font-bold text-slate-100 tracking-tight">
                    {data?.systemUptime ?? 100}%
                  </div>
                  <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mt-0.5">
                    24h System Uptime
                  </div>
                </div>
              </div>
            </div>

            {/* Active Incidents Banner (if any) */}
            {data && data.activeIncidents.length > 0 && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-xs font-mono font-semibold text-rose-400 uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Ongoing Incidents ({data.activeIncidents.length})</span>
                </div>
                <div className="flex flex-col gap-3">
                  {data.activeIncidents.map((inc) => (
                    <div
                      key={inc.id}
                      className="p-5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-slate-200 flex flex-col gap-2 shadow-sm"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 uppercase border border-rose-500/30">
                            {inc.severity}
                          </span>
                          <h4 className="font-semibold text-slate-100 text-sm">{inc.title}</h4>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400">
                          Started: {new Date(inc.startedAt).toLocaleString()}
                        </span>
                      </div>
                      {inc.description && (
                        <p className="text-xs text-slate-300 font-mono bg-slate-900/60 p-2.5 rounded border border-slate-800">
                          {inc.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Service Groups & Health Checks */}
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-mono font-semibold uppercase tracking-wider text-slate-400">
                  Services & Infrastructure Breakdown
                </h3>
                <span className="text-xs text-slate-500 font-mono">
                  {data?.groups.reduce((acc, g) => acc + g.monitors.length, 0) || 0} Probed Targets
                </span>
              </div>

              {data && data.groups.length === 0 ? (
                <div className="p-8 text-center text-slate-500 font-mono border border-dashed border-[#1E2640] rounded-2xl">
                  No monitors configured yet.
                </div>
              ) : (
                data?.groups.map((group) => {
                  const isGroupUp = group.status === 'OPERATIONAL';
                  return (
                    <div
                      key={group.name}
                      className="rounded-2xl bg-[#0F1424] border border-[#1E2640] overflow-hidden shadow-sm"
                    >
                      {/* Group Header */}
                      <div className="px-5 py-4 bg-[#141A2E]/60 border-b border-[#1E2640] flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <h4 className="font-bold text-slate-100 text-sm tracking-wide">{group.name}</h4>
                          <span
                            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                              isGroupUp
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : group.status === 'DEGRADED'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {group.status}
                          </span>
                        </div>
                        <div className="text-xs font-mono text-slate-400">
                          <span className="text-slate-200 font-semibold">{group.uptimePercent}%</span> 24h uptime
                        </div>
                      </div>

                      {/* Monitor Rows */}
                      <div className="divide-y divide-[#1A2238]">
                        {group.monitors.map((m) => {
                          const isMonitorUp = m.currentStatus === 'UP';
                          const heartbeats = m.heartbeats || [];
                          const latestLatency = heartbeats[0]?.latencyMs ?? 0;

                          // Pad 30 items for sparkline
                          const padded = Array.from({ length: 30 }).map((_, i) => {
                            return heartbeats[29 - i] || null;
                          });

                          return (
                            <div
                              key={m.id}
                              className="p-4 sm:px-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#141A2E]/30 transition"
                            >
                              {/* Left Info */}
                              <div className="flex items-center gap-3 min-w-[240px]">
                                <div
                                  className={`p-2 rounded-lg shrink-0 ${
                                    isMonitorUp ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                                  }`}
                                >
                                  {m.type === 'HTTP' ? <Globe className="w-4 h-4" /> : <Server className="w-4 h-4" />}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-slate-100 text-sm">{m.name}</span>
                                    {m.sslDaysRemaining !== undefined && (
                                      <span
                                        className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                                          m.sslDaysRemaining <= 0
                                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                            : m.sslDaysRemaining <= 14
                                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                        }`}
                                      >
                                        <Lock className="w-2.5 h-2.5" />
                                        <span>{m.sslDaysRemaining}d SSL</span>
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                                    {m.type} • {m.uptimePercent24h}% Uptime
                                  </div>
                                </div>
                              </div>

                              {/* Center Mini Sparkline */}
                              <div className="flex-1 max-w-xs flex flex-col gap-1">
                                <div className="flex items-center gap-0.5 h-6">
                                  {padded.map((hb, idx) => {
                                    if (!hb) {
                                      return (
                                        <div
                                          key={idx}
                                          className="flex-1 h-full rounded-xs bg-slate-800/40"
                                          title="No probe data"
                                        />
                                      );
                                    }
                                    const isHbUp = hb.status === 'UP';
                                    return (
                                      <div
                                        key={idx}
                                        className={`flex-1 h-full rounded-xs transition hover:scale-125 cursor-pointer ${
                                          isHbUp ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-rose-500 hover:bg-rose-400'
                                        }`}
                                        title={`${new Date(hb.timestamp).toLocaleTimeString()}: ${hb.status} (${hb.latencyMs}ms)`}
                                      />
                                    );
                                  })}
                                </div>
                                <div className="flex items-center justify-between text-[9px] font-mono text-slate-500">
                                  <span>30 checks ago</span>
                                  <span>Now ({latestLatency}ms)</span>
                                </div>
                              </div>

                              {/* Right Operational Status Pill */}
                              <div className="flex items-center justify-between md:justify-end gap-4 shrink-0">
                                <div className="text-right">
                                  <div className="text-xs font-mono font-semibold text-slate-200">
                                    {latestLatency} ms
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-mono">Latency</div>
                                </div>
                                <span
                                  className={`text-xs font-mono font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                                    isMonitorUp
                                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                  }`}
                                >
                                  {m.currentStatus}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Past Incidents (Past 7 Days) */}
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-mono font-semibold uppercase tracking-wider text-slate-400">
                Past Incidents (Last 7 Days)
              </h3>
              {data && data.pastIncidents.length === 0 ? (
                <div className="p-6 rounded-2xl bg-[#0F1424] border border-[#1E2640] text-center text-xs font-mono text-slate-400 flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>No incidents reported in the past 7 days. Continuous normal operations.</span>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {data?.pastIncidents.map((inc) => (
                    <div
                      key={inc.id}
                      className="p-4 rounded-xl bg-[#0F1424] border border-[#1E2640] flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            RESOLVED
                          </span>
                          <span className="font-semibold text-sm text-slate-200">{inc.title}</span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-500">
                          Resolved at: {inc.resolvedAt ? new Date(inc.resolvedAt).toLocaleString() : 'N/A'}
                        </span>
                      </div>
                      {inc.description && (
                        <p className="text-xs text-slate-400 font-mono mt-1">{inc.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1E2640] bg-[#0E131F] py-6 mt-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>PulseNOC Sentinel Engine • Autonomous Observability</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-slate-300 transition">
              Dashboard
            </Link>
            <span>•</span>
            <Link href="/login" className="hover:text-slate-300 transition">
              Operator Sign In
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
