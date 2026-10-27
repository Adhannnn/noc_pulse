// frontend/src/components/ProcessExplorerView.tsx
'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import {
  Activity,
  Cpu,
  Database,
  Search,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Play,
  Pause,
  User,
  SlidersHorizontal,
} from 'lucide-react';

export interface ProcessItem {
  pid: number;
  name: string;
  username: string;
  cpuPercent: number;
  memPercent: number;
  memRssMb: number;
  status: string;
  cmdline: string;
}

export default function ProcessExplorerView() {
  const [processes, setProcesses] = useState<ProcessItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'cpu' | 'mem'>('cpu');
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [killTarget, setKillTarget] = useState<ProcessItem | null>(null);
  const [killing, setKilling] = useState(false);

  const { authFetch, user } = useAuth();
  const toast = useToast();
  const isAdmin = user?.role === 'ADMIN';

  const fetchProcesses = useCallback(async () => {
    try {
      const res = await authFetch(`/api/metrics/processes?sort=${sortBy}&limit=35`);
      if (res.ok) {
        const data = await res.json();
        setProcesses(Array.isArray(data) ? data : []);
      }
    } catch (err: unknown) {
      console.error('Failed to fetch processes:', err);
    } finally {
      setLoading(false);
    }
  }, [authFetch, sortBy]);

  useEffect(() => {
    fetchProcesses();
  }, [fetchProcesses]);

  // Live Auto-Refresh every 3 seconds
  useEffect(() => {
    if (!isAutoRefresh) return;
    const interval = setInterval(() => {
      fetchProcesses();
    }, 3000);
    return () => clearInterval(interval);
  }, [isAutoRefresh, fetchProcesses]);

  const handleConfirmKill = async () => {
    if (!killTarget) return;
    setKilling(true);
    try {
      const res = await authFetch(`/api/metrics/processes/${killTarget.pid}/kill?force=true`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(`Terminated process ${killTarget.name} (PID: ${killTarget.pid})`);
        setProcesses((prev) => prev.filter((p) => p.pid !== killTarget.pid));
        setKillTarget(null);
      } else {
        toast.error(data.error || 'Failed to terminate process');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error terminating process';
      toast.error(msg);
    } finally {
      setKilling(false);
    }
  };

  const filtered = processes.filter((p) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      String(p.pid).includes(term) ||
      p.name.toLowerCase().includes(term) ||
      p.username.toLowerCase().includes(term) ||
      p.cmdline.toLowerCase().includes(term)
    );
  });

  const totalCpuUsage = processes.reduce((acc, p) => acc + (p.cpuPercent || 0), 0);
  const totalMemRss = processes.reduce((acc, p) => acc + (p.memRssMb || 0), 0);

  return (
    <div className="space-y-6 font-sans">
      {/* Workspace Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#121829] border border-[#1E2640] p-5 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Debian Host Process Explorer</h2>
            <p className="text-xs text-slate-400 font-mono">
              Real-time resource inspection and thread-level tracking on Linux host
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Sort Pill */}
          <div className="flex items-center bg-[#090C16] border border-[#1E2640] rounded-xl p-1 text-xs font-mono">
            <button
              type="button"
              onClick={() => setSortBy('cpu')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                sortBy === 'cpu'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              CPU%
            </button>
            <button
              type="button"
              onClick={() => setSortBy('mem')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                sortBy === 'mem'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              RAM RSS
            </button>
          </div>

          {/* Auto Refresh Toggle */}
          <button
            type="button"
            onClick={() => setIsAutoRefresh(!isAutoRefresh)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono border transition ${
              isAutoRefresh
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-[#161C2E] text-slate-400 border-[#2B3555]'
            }`}
            title={isAutoRefresh ? 'Live ticker active (3s)' : 'Live ticker paused'}
          >
            {isAutoRefresh ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isAutoRefresh ? 'Live (3s)' : 'Paused'}
          </button>

          {/* Manual Refresh */}
          <button
            type="button"
            onClick={() => fetchProcesses()}
            className="p-2 bg-[#161C2E] hover:bg-[#1E2640] border border-[#2B3555] text-slate-300 rounded-xl transition"
            title="Refresh process list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Metrics Stat Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#121829] border border-[#1E2640] p-4 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
              MONITORED PROCESSES
            </div>
            <div className="text-2xl font-extrabold text-white font-mono mt-1">
              {processes.length}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/50 text-slate-300">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#121829] border border-[#1E2640] p-4 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
              TOP CONSUMPTION CPU
            </div>
            <div className="text-2xl font-extrabold text-rose-400 font-mono mt-1">
              {totalCpuUsage.toFixed(1)}%
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <Cpu className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#121829] border border-[#1E2640] p-4 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
              TOP CONSUMPTION RAM
            </div>
            <div className="text-2xl font-extrabold text-indigo-400 font-mono mt-1">
              {(totalMemRss / 1024).toFixed(2)} GB
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Database className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Filter by PID, process name, command, or user..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#090C16] border border-[#1E2640] rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500 font-mono"
        />
      </div>

      {/* Processes Table */}
      <div className="bg-[#121829] border border-[#1E2640] rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#090C16] border-b border-[#1E2640] text-slate-400 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-4 py-3.5">PID</th>
                <th className="px-4 py-3.5">Process Name</th>
                <th className="px-4 py-3.5">User</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">CPU Usage</th>
                <th className="px-4 py-3.5">RAM RSS</th>
                <th className="px-4 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2640]/60 text-slate-300">
              {loading && processes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500 font-mono">
                    Inspecting Linux host threads...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500 font-mono">
                    No active processes matching &quot;{search}&quot;.
                  </td>
                </tr>
              ) : (
                filtered.map((proc) => {
                  const isHighCpu = proc.cpuPercent >= 40;
                  const isHighMem = proc.memRssMb >= 500;

                  return (
                    <tr key={proc.pid} className="hover:bg-[#161C2E] transition group">
                      {/* PID */}
                      <td className="px-4 py-3 font-semibold text-cyan-400">
                        {proc.pid}
                      </td>

                      {/* Process Name & Tooltip Command */}
                      <td className="px-4 py-3 max-w-[280px]">
                        <div className="font-bold text-white truncate" title={proc.name}>
                          {proc.name}
                        </div>
                        <div
                          className="text-[10px] text-slate-500 truncate mt-0.5"
                          title={proc.cmdline}
                        >
                          {proc.cmdline}
                        </div>
                      </td>

                      {/* Username */}
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-[11px] bg-slate-800/80 text-slate-300 px-2 py-0.5 rounded-md border border-slate-700/60">
                          <User className="w-3 h-3 text-slate-400" />
                          {proc.username || 'root'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                            proc.status === 'R'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : proc.status === 'S'
                              ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {proc.status === 'R' ? 'Running' : proc.status === 'S' ? 'Sleeping' : proc.status}
                        </span>
                      </td>

                      {/* CPU % */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-[#090C16] h-1.5 rounded-full overflow-hidden border border-[#1E2640]">
                            <div
                              style={{ width: `${Math.min(100, proc.cpuPercent)}%` }}
                              className={`h-full ${
                                isHighCpu ? 'bg-rose-500' : 'bg-amber-400'
                              }`}
                            />
                          </div>
                          <span
                            className={`font-semibold ${
                              isHighCpu ? 'text-rose-400' : 'text-slate-200'
                            }`}
                          >
                            {proc.cpuPercent.toFixed(1)}%
                          </span>
                        </div>
                      </td>

                      {/* Memory RSS */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-[#090C16] h-1.5 rounded-full overflow-hidden border border-[#1E2640]">
                            <div
                              style={{ width: `${Math.min(100, proc.memPercent * 2)}%` }}
                              className={`h-full ${
                                isHighMem ? 'bg-purple-500' : 'bg-cyan-400'
                              }`}
                            />
                          </div>
                          <div>
                            <span
                              className={`font-semibold ${
                                isHighMem ? 'text-purple-300' : 'text-slate-200'
                              }`}
                            >
                              {proc.memRssMb >= 1024
                                ? `${(proc.memRssMb / 1024).toFixed(2)} GB`
                                : `${proc.memRssMb.toFixed(0)} MB`}
                            </span>
                            <span className="text-[10px] text-slate-500 ml-1">
                              ({proc.memPercent.toFixed(1)}%)
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        {isAdmin ? (
                          <button
                            type="button"
                            onClick={() => setKillTarget(proc)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                            title={`Terminate process PID ${proc.pid}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-600 italic">Read-only</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal for Terminating Process */}
      {killTarget && (
        <ConfirmDeleteModal
          isOpen={!!killTarget}
          onClose={() => setKillTarget(null)}
          onConfirm={handleConfirmKill}
          title={`Terminate Process: ${killTarget.name}`}
          description={`Are you sure you want to terminate PID ${killTarget.pid} (${killTarget.cmdline})? A SIGKILL signal will be dispatched immediately.`}
          confirmText={killing ? 'Terminating...' : 'Kill Process'}
        />
      )}
    </div>
  );
}
