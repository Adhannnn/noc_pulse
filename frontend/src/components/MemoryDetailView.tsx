// frontend/src/components/MemoryDetailView.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useAuth } from '@/context/AuthContext';
import {
  ArrowLeft,
  MemoryStick,
  Layers,
  HardDrive,
  Activity,
  Zap,
  RefreshCw,
  Server,
  ShieldCheck,
  Clock,
  BarChart3,
} from 'lucide-react';

interface DetailedMemoryStats {
  totalGb: number;
  usedGb: number;
  availableGb: number;
  freeGb: number;
  activeGb: number;
  buffersMb: number;
  cachedMb: number;
  swapTotalGb: number;
  swapUsedGb: number;
  usedPct: number;
  activePct: number;
  cachedPct: number;
  freePct: number;
}

interface HostMetricSample {
  id?: string;
  ramUsedMb: number;
  ramTotalMb: number;
  cpuUsage: number;
  diskUsagePct: number;
  timestamp: string;
}

interface MemoryDetailViewProps {
  onBack: () => void;
}

export default function MemoryDetailView({ onBack }: MemoryDetailViewProps) {
  const { socket } = useSocket();
  const { authFetch } = useAuth();
  const [detailStats, setDetailStats] = useState<DetailedMemoryStats | null>(null);
  const [historySamples, setHistorySamples] = useState<HostMetricSample[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDetail = async () => {
    try {
      const res = await authFetch('/api/metrics/memory-detail');
      if (res.ok) {
        const data = await res.json();
        setDetailStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch detailed memory stats:', err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await authFetch('/api/metrics/history?limit=20');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setHistorySamples([...data].reverse());
        }
      }
    } catch (err) {
      console.error('Failed to fetch memory history samples:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
    fetchHistory();
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on('metrics:host', (data: any) => {
      fetchDetail();
      setHistorySamples((prev) => [
        ...prev.slice(-19),
        {
          ramUsedMb: data.ramUsedMb,
          ramTotalMb: data.ramTotalMb,
          cpuUsage: data.cpuUsage,
          diskUsagePct: data.diskUsagePct,
          timestamp: new Date().toISOString(),
        },
      ]);
    });

    return () => {
      socket.off('metrics:host');
    };
  }, [socket]);

  // Derived computations
  const usedPct = detailStats?.usedPct ?? (historySamples.length > 0 ? Math.round((historySamples[historySamples.length - 1].ramUsedMb / historySamples[historySamples.length - 1].ramTotalMb) * 100) : 0);
  const totalGb = detailStats?.totalGb ?? (historySamples.length > 0 ? (historySamples[historySamples.length - 1].ramTotalMb / 1024).toFixed(1) : '—');
  const usedGb = detailStats?.usedGb ?? (historySamples.length > 0 ? (historySamples[historySamples.length - 1].ramUsedMb / 1024).toFixed(1) : '—');
  const availableGb = detailStats?.availableGb ?? '—';
  const activeGb = detailStats?.activeGb ?? '—';
  const cachedMb = detailStats?.cachedMb ?? '—';
  const swapTotalGb = detailStats?.swapTotalGb ?? 0;
  const swapUsedGb = detailStats?.swapUsedGb ?? 0;

  const getStatusBadge = (pct: number) => {
    if (pct >= 85) {
      return { text: 'HIGH PRESSURE', color: 'bg-rose-500/10 text-rose-400 border-rose-500/30' };
    }
    if (pct >= 70) {
      return { text: 'MODERATE USAGE', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
    }
    return { text: 'OPTIMAL HEALTH', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
  };

  const status = getStatusBadge(Number(usedPct));

  // Render SVG chart path for history samples
  const chartPoints = historySamples.map((s, idx) => {
    const x = (idx / Math.max(historySamples.length - 1, 1)) * 300;
    const pct = s.ramTotalMb > 0 ? (s.ramUsedMb / s.ramTotalMb) * 100 : 0;
    const y = 80 - (pct / 100) * 70;
    return `${x},${y}`;
  });

  const svgPathD = chartPoints.length > 0 ? `M ${chartPoints.join(' L ')}` : '';
  const areaPathD = chartPoints.length > 0 ? `M 0,80 L ${chartPoints.join(' L ')} L 300,80 Z` : '';

  return (
    <div className="space-y-6">
      {/* Header & Back Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#121829] border border-[#1E2640] p-6 rounded-2xl shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all flex items-center gap-2 text-xs font-mono font-bold"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Overview
          </button>

          <div>
            <div className="flex items-center gap-2.5">
              <MemoryStick className="w-5 h-5 text-purple-400" />
              <h1 className="text-xl font-extrabold text-white tracking-tight font-sans">
                RAM Memory Telemetry & Deep Inspector
              </h1>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-1">
              Real-time physical RAM usage breakdown, kernel buffer cache, swap memory, and historical trends.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1.5 rounded-full text-xs font-mono font-bold border ${status.color}`}
          >
            {status.text}
          </span>
          <button
            onClick={() => {
              fetchDetail();
              fetchHistory();
            }}
            className="p-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700/50 transition-all"
            title="Refresh Memory Stats"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Top 4 KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total RAM */}
        <div className="bg-[#121829] border border-[#1E2640] p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono font-bold uppercase mb-2">
            <span>TOTAL INSTALLED RAM</span>
            <Server className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">{totalGb} <span className="text-sm text-slate-400">GB</span></div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Hardware Host Memory
          </div>
        </div>

        {/* Used RAM */}
        <div className="bg-[#121829] border border-[#1E2640] p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono font-bold uppercase mb-2">
            <span>ACTIVE / USED RAM</span>
            <Activity className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-3xl font-extrabold text-purple-400 font-mono">{usedGb} <span className="text-sm text-slate-400">GB</span></div>
          <div className="text-[11px] text-slate-400 mt-2 font-mono">
            {usedPct}% Allocated Capacity
          </div>
        </div>

        {/* Available RAM */}
        <div className="bg-[#121829] border border-[#1E2640] p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono font-bold uppercase mb-2">
            <span>AVAILABLE / FREE RAM</span>
            <Zap className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-400 font-mono">{availableGb} <span className="text-sm text-slate-400">GB</span></div>
          <div className="text-[11px] text-slate-400 mt-2 font-mono">
            Ready for Instant Allocation
          </div>
        </div>

        {/* Buffers & Cache */}
        <div className="bg-[#121829] border border-[#1E2640] p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono font-bold uppercase mb-2">
            <span>BUFFERS & PAGE CACHE</span>
            <Layers className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-3xl font-extrabold text-sky-400 font-mono">{cachedMb} <span className="text-sm text-slate-400">MB</span></div>
          <div className="text-[11px] text-slate-400 mt-2 font-mono">
            Linux Kernel I/O Cache
          </div>
        </div>
      </div>

      {/* Memory Allocation Segmented Bar */}
      <div className="bg-[#121829] border border-[#1E2640] p-6 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-400" />
            Physical Memory Distribution
          </div>
          <div className="text-xs font-mono text-slate-400">
            Total Capacity: <span className="text-white font-bold">{totalGb} GB</span>
          </div>
        </div>

        {/* Multi-color segment bar */}
        <div className="h-4 w-full bg-slate-800 rounded-full overflow-hidden flex gap-0.5 p-0.5 border border-slate-700/50">
          <div
            className="h-full bg-purple-500 rounded-l-full transition-all duration-700"
            style={{ width: `${detailStats?.activePct ?? usedPct}%` }}
            title={`Active Apps: ${detailStats?.activePct ?? usedPct}%`}
          />
          <div
            className="h-full bg-sky-400 transition-all duration-700"
            style={{ width: `${detailStats?.cachedPct ?? 10}%` }}
            title={`Buffers & Cache: ${detailStats?.cachedPct ?? 10}%`}
          />
          <div
            className="h-full bg-emerald-400 rounded-r-full transition-all duration-700"
            style={{ width: `${detailStats?.freePct ?? 30}%` }}
            title={`Free Memory: ${detailStats?.freePct ?? 30}%`}
          />
        </div>

        {/* Legend */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs font-mono">
          <div className="flex items-center gap-2 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <span className="w-3 h-3 rounded-full bg-purple-500" />
            <div>
              <div className="text-slate-400">Active App Memory</div>
              <div className="font-bold text-slate-200">{activeGb} GB ({detailStats?.activePct ?? usedPct}%)</div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <span className="w-3 h-3 rounded-full bg-sky-400" />
            <div>
              <div className="text-slate-400">Buffers & OS Page Cache</div>
              <div className="font-bold text-slate-200">{cachedMb} MB ({detailStats?.cachedPct ?? 10}%)</div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <span className="w-3 h-3 rounded-full bg-emerald-400" />
            <div>
              <div className="text-slate-400">Unallocated Free RAM</div>
              <div className="font-bold text-slate-200">{availableGb} GB ({detailStats?.freePct ?? 30}%)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Section: Realtime History Line Chart & Swap Info */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Memory Realtime Sparkline */}
        <div className="lg:col-span-8 bg-[#121829] border border-[#1E2640] p-6 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
              <Activity className="w-4 h-4 text-purple-400" />
              Live Memory Utilization Trend (Last 20 Probes)
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-purple-400 font-bold bg-purple-500/10 px-2.5 py-1 rounded-lg border border-purple-500/20">
              Current: {usedPct}%
            </div>
          </div>

          {/* SVG Chart */}
          <div className="h-44 w-full relative flex items-end">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 300 80" preserveAspectRatio="none">
              <defs>
                <linearGradient id="ramAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="0" y1="20" x2="300" y2="20" stroke="#1E2640" strokeDasharray="3 3" strokeWidth="1" />
              <line x1="0" y1="40" x2="300" y2="40" stroke="#1E2640" strokeDasharray="3 3" strokeWidth="1" />
              <line x1="0" y1="60" x2="300" y2="60" stroke="#1E2640" strokeDasharray="3 3" strokeWidth="1" />

              {/* Area */}
              {areaPathD && <path d={areaPathD} fill="url(#ramAreaGrad)" />}
              {/* Line */}
              {svgPathD && (
                <path
                  d={svgPathD}
                  fill="none"
                  stroke="#8B5CF6"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-2 border-t border-slate-800">
            <span>Older (20 probes ago)</span>
            <span>Real-time Sync via WebSocket</span>
            <span>Latest Probe</span>
          </div>
        </div>

        {/* Swap Space Info */}
        <div className="lg:col-span-4 bg-[#121829] border border-[#1E2640] p-6 rounded-2xl shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-3">
              <HardDrive className="w-4 h-4 text-amber-400" />
              Virtual Memory / Swap
            </div>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Swap space is allocated disk memory used by the Linux kernel when physical RAM reaches capacity.
            </p>
          </div>

          <div className="space-y-3 bg-slate-900/80 p-4 rounded-xl border border-slate-800 font-mono text-xs">
            <div className="flex justify-between items-center text-slate-400">
              <span>Total Swap Capacity:</span>
              <span className="font-bold text-slate-200">{swapTotalGb} GB</span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Used Swap Memory:</span>
              <span className="font-bold text-amber-400">{swapUsedGb} GB</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 transition-all duration-500"
                style={{ width: `${swapTotalGb > 0 ? (swapUsedGb / swapTotalGb) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-[11px] font-mono text-indigo-300">
            💡 Low swap activity indicates healthy host RAM sizing without page swapping thrashing.
          </div>
        </div>
      </div>

      {/* Memory Telemetry Sample History Table */}
      <div className="bg-[#121829] border border-[#1E2640] rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-[#1E2640] flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
            <Clock className="w-4 h-4 text-purple-400" />
            Recent RAM Telemetry Samples
          </div>
          <div className="text-xs font-mono text-slate-500">
            Showing last {historySamples.length} samples
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-[#0B0F19] text-slate-400 uppercase tracking-wider border-b border-[#1E2640]">
              <tr>
                <th className="py-3 px-5">Timestamp</th>
                <th className="py-3 px-5">RAM Used (MB)</th>
                <th className="py-3 px-5">RAM Total (MB)</th>
                <th className="py-3 px-5">Usage %</th>
                <th className="py-3 px-5">CPU Load</th>
                <th className="py-3 px-5 text-right">Health Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2640]/60 text-slate-300">
              {historySamples.map((sample, idx) => {
                const samplePct = sample.ramTotalMb > 0 ? Math.round((sample.ramUsedMb / sample.ramTotalMb) * 100) : 0;
                const sampleStatus = getStatusBadge(samplePct);
                return (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-5 text-slate-400">
                      {new Date(sample.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-3 px-5 font-bold text-purple-300">{sample.ramUsedMb.toLocaleString()} MB</td>
                    <td className="py-3 px-5 text-slate-400">{sample.ramTotalMb.toLocaleString()} MB</td>
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-400"
                            style={{ width: `${samplePct}%` }}
                          />
                        </div>
                        <span>{samplePct}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-sky-400">{sample.cpuUsage}%</td>
                    <td className="py-3 px-5 text-right">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${sampleStatus.color}`}>
                        {sampleStatus.text}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
