// frontend/src/components/GroupDetailView.tsx
'use client';

import React, { useMemo } from 'react';
import MonitorCard, { Monitor } from './MonitorCard';
import {
  ArrowLeft,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Activity,
  Server,
} from 'lucide-react';

interface Props {
  groupName: string;
  monitors: Monitor[];
  onBack: () => void;
  onSelectMonitor: (monitor: Monitor) => void;
  onDeleteMonitor?: (id: string) => void;
  isReadOnly?: boolean;
}

export default function GroupDetailView({
  groupName,
  monitors,
  onBack,
  onSelectMonitor,
  onDeleteMonitor,
  isReadOnly = false,
}: Props) {
  const groupMonitors = useMemo(() => {
    return monitors.filter((m) => (m.group || 'Home DC') === groupName);
  }, [monitors, groupName]);

  const total = groupMonitors.length;
  const online = groupMonitors.filter((m) => m.currentStatus === 'UP').length;
  const offline = groupMonitors.filter((m) => m.currentStatus === 'DOWN').length;

  // Compute average group latency
  const avgLatency = useMemo(() => {
    if (groupMonitors.length === 0) return 0;
    const sum = groupMonitors.reduce((acc, m) => acc + (m.heartbeats[0]?.latencyMs || 0), 0);
    return Math.round(sum / groupMonitors.length);
  }, [groupMonitors]);

  // Compute average group uptime %
  const groupUptimePct = useMemo(() => {
    if (groupMonitors.length === 0) return 100;
    const sumPct = groupMonitors.reduce((acc, m) => {
      const totalHb = m.heartbeats.length;
      const upHb = m.heartbeats.filter((hb) => hb.status === 'UP').length;
      return acc + (totalHb > 0 ? (upHb / totalHb) * 100 : (m.uptimePercent24h ?? 100));
    }, 0);
    return Math.round(sumPct / groupMonitors.length);
  }, [groupMonitors]);

  // Compute combined 30-interval average latency history waveform for graph
  const avgLatencyHistory = useMemo(() => {
    const points: number[] = [];
    for (let i = 0; i < 30; i++) {
      let stepSum = 0;
      let count = 0;
      groupMonitors.forEach((m) => {
        const hb = m.heartbeats[29 - i];
        if (hb) {
          stepSum += hb.latencyMs;
          count++;
        }
      });
      points.push(count > 0 ? Math.round(stepSum / count) : 0);
    }
    return points;
  }, [groupMonitors]);

  // SVG Graph bounds for telemetry waveform
  const maxVal = Math.max(...avgLatencyHistory, 100);
  const minVal = 0;
  const svgWidth = 700;
  const svgHeight = 160;

  const pointsString = avgLatencyHistory
    .map((val, idx) => {
      const x = (idx / 29) * svgWidth;
      const y = svgHeight - ((val - minVal) / (maxVal - minVal || 1)) * (svgHeight - 20) - 10;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="space-y-6 font-sans">
      {/* Top Header & Navigation */}
      <div className="flex items-center justify-between border-b border-[#1E2640] pb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 rounded-xl bg-[#121829] hover:bg-[#1E2640] border border-[#1E2640] text-slate-300 hover:text-white transition flex items-center gap-2 text-xs font-mono font-bold"
          >
            <ArrowLeft className="w-4 h-4 text-indigo-400" /> Back
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-extrabold text-white tracking-tight">{groupName}</h2>
              <span className="text-xs font-mono font-normal text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-0.5 rounded-full">
                Group Studio
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Aggregated latency telemetry and member services for DataCenter Group
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-[#121829] border border-[#1E2640] p-4 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
              SERVICES
            </div>
            <div className="text-2xl font-extrabold text-white font-mono mt-1">{total}</div>
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
            <div className="text-2xl font-extrabold text-emerald-400 font-mono mt-1">{online}</div>
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
            <div className="text-2xl font-extrabold text-rose-400 font-mono mt-1">{offline}</div>
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
            <div className="text-2xl font-extrabold text-amber-400 font-mono mt-1">{avgLatency}ms</div>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Zap className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#121829] border border-[#1E2640] p-4 rounded-2xl flex items-center justify-between shadow-sm col-span-2 md:col-span-1">
          <div>
            <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
              GROUP UPTIME
            </div>
            <div className="text-2xl font-extrabold text-indigo-400 font-mono mt-1">{groupUptimePct}%</div>
          </div>
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Activity className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Aggregated Average Latency Waveform Telemetry Chart */}
      <div className="bg-[#121829] border border-[#1E2640] rounded-2xl p-6 shadow-sm space-y-4 font-mono">
        <div className="flex items-center justify-between border-b border-[#1E2640] pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400" />
            <h3 className="font-bold text-slate-100 text-sm">Aggregated Group Average Latency Waveform</h3>
          </div>
          <span className="text-[11px] text-slate-400">30-Check Traceback Window</span>
        </div>

        <div className="relative w-full h-[180px] bg-[#090C16] border border-[#1E2640] rounded-xl p-4 flex items-center justify-center">
          <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
            <defs>
              <linearGradient id="groupLatencyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366F1" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#6366F1" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid Lines */}
            <line x1="0" y1="20" x2={svgWidth} y2="20" stroke="#1E2640" strokeDasharray="3 3" />
            <line x1="0" y1="80" x2={svgWidth} y2="80" stroke="#1E2640" strokeDasharray="3 3" />
            <line x1="0" y1="140" x2={svgWidth} y2="140" stroke="#1E2640" strokeDasharray="3 3" />

            {/* Area Fill */}
            <polygon
              points={`0,${svgHeight} ${pointsString} ${svgWidth},${svgHeight}`}
              fill="url(#groupLatencyGrad)"
            />

            {/* Line Graph */}
            <polyline
              fill="none"
              stroke="#818CF8"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={pointsString}
            />
          </svg>
        </div>
      </div>

      {/* Group Member Services Section */}
      <div className="space-y-4">
        <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
          <Server className="w-4 h-4 text-indigo-400" /> Member Services inside &quot;{groupName}&quot;
        </h3>

        {groupMonitors.length === 0 ? (
          <div className="bg-[#121829] border border-[#1E2640] rounded-2xl p-8 text-center text-slate-500 font-mono text-xs shadow-sm">
            No services registered in this group yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {groupMonitors.map((m) => (
              <MonitorCard
                key={m.id}
                monitor={m}
                onDelete={(id) => (!isReadOnly && onDeleteMonitor ? onDeleteMonitor(id) : undefined)}
                onSelect={onSelectMonitor}
                isReadOnly={isReadOnly}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
