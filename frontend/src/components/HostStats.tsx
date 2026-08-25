// frontend/src/components/HostStats.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useAuth } from '@/context/AuthContext';
import { Cpu, HardDrive, MemoryStick, Activity, Wifi } from 'lucide-react';

interface HostMetric {
  cpuUsage: number;
  ramUsedMb: number;
  ramTotalMb: number;
  diskUsagePct: number;
  networkInKb: number;
  networkOutKb: number;
}

export default function HostStats() {
  const { socket, isConnected } = useSocket();
  const { authFetch } = useAuth();
  const [metrics, setMetrics] = useState<HostMetric | null>(null);

  useEffect(() => {
    // Ambil initial metrics saat mount
    authFetch('/api/metrics/history?limit=1')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.length > 0) setMetrics(data[0]);
      })
      .catch(console.error);

    if (!socket) return;

    socket.on('metrics:host', (data: HostMetric) => {
      setMetrics(data);
    });

    return () => {
      socket.off('metrics:host');
    };
  }, [socket]);

  const ramPct = metrics
    ? Math.round((metrics.ramUsedMb / metrics.ramTotalMb) * 100)
    : 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm text-slate-100">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-400" />
          <h2 className="font-semibold text-lg">Server Host Health</h2>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
            }`}
          />
          <span className="text-xs text-slate-400">
            {isConnected ? 'Live WebSocket' : 'Disconnected'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* CPU */}
        <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700/50">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="flex items-center gap-1.5"><Cpu className="w-4 h-4 text-sky-400" /> CPU Usage</span>
            <span className="font-semibold text-slate-200">{metrics?.cpuUsage ?? 0}%</span>
          </div>
          <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden mt-2">
            <div
              className={`h-full transition-all duration-500 ${
                (metrics?.cpuUsage ?? 0) > 80 ? 'bg-rose-500' : 'bg-sky-400'
              }`}
              style={{ width: `${Math.min(metrics?.cpuUsage ?? 0, 100)}%` }}
            />
          </div>
        </div>

        {/* RAM */}
        <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700/50">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="flex items-center gap-1.5"><MemoryStick className="w-4 h-4 text-emerald-400" /> RAM Memory</span>
            <span className="font-semibold text-slate-200">{ramPct}%</span>
          </div>
          <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-emerald-400 transition-all duration-500"
              style={{ width: `${ramPct}%` }}
            />
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            {metrics ? `${Math.round(metrics.ramUsedMb / 1024)}GB / ${Math.round(metrics.ramTotalMb / 1024)}GB` : '-'}
          </div>
        </div>

        {/* Disk */}
        <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700/50">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="flex items-center gap-1.5"><HardDrive className="w-4 h-4 text-amber-400" /> Disk Storage</span>
            <span className="font-semibold text-slate-200">{metrics?.diskUsagePct ?? 0}%</span>
          </div>
          <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-amber-400 transition-all duration-500"
              style={{ width: `${metrics?.diskUsagePct ?? 0}%` }}
            />
          </div>
        </div>

        {/* Network */}
        <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700/50">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="flex items-center gap-1.5"><Wifi className="w-4 h-4 text-purple-400" /> Network I/O</span>
          </div>
          <div className="text-sm font-semibold text-slate-200 mt-1">
            ↓ {metrics?.networkInKb ?? 0} KB/s
          </div>
          <div className="text-xs text-slate-400">
            ↑ {metrics?.networkOutKb ?? 0} KB/s
          </div>
        </div>
      </div>
    </div>
  );
}