// frontend/src/components/ServiceDetailView.tsx
'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Monitor } from '@/components/MonitorCard';
import TelemetrySparkline from '@/components/TelemetrySparkline';
import {
  ArrowLeft,
  Globe,
  Server,
  Activity,
  FileText,
  Settings,
  Clock,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Search,
  RefreshCw,
} from 'lucide-react';

interface Props {
  monitor: Monitor;
  onBack: () => void;
}

export default function ServiceDetailView({ monitor, onBack }: Props) {
  const [activeTab, setActiveTab] = useState<'LOGS' | 'TELEMETRY' | 'CONFIG'>('LOGS');
  const [logSearch, setLogSearch] = useState('');

  // Config Edit States
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(monitor.name);
  const [editGroup, setEditGroup] = useState(monitor.group || 'Home DC');
  const [editUrl, setEditUrl] = useState(monitor.url || '');
  const [editPort, setEditPort] = useState(monitor.port ? String(monitor.port) : '');
  const [editIntervalSec, setEditIntervalSec] = useState(monitor.intervalSec || 30);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const { authFetch } = useAuth();

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedMsg(null);
    try {
      const res = await authFetch(`/api/monitors/${monitor.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          group: editGroup || 'Home DC',
          url: editUrl || undefined,
          port: editPort ? parseInt(editPort, 10) : undefined,
          intervalSec: Number(editIntervalSec),
        }),
      });

      if (res.ok) {
        setSavedMsg('Probe settings updated successfully! Precision ticker updated.');
        setIsEditing(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const isUp = monitor.currentStatus === 'UP';
  const latestLatency = monitor.heartbeats[0]?.latencyMs ?? 0;
  const totalProbes = monitor.heartbeats.length;

  const paddedHeartbeats = Array.from({ length: 30 }).map((_, i) => {
    return monitor.heartbeats[29 - i] || null;
  });

  const latencyHistory = monitor.heartbeats.map((hb) => hb.latencyMs).reverse();

  const filteredHeartbeats = monitor.heartbeats.filter((hb) => {
    if (!logSearch) return true;
    const term = logSearch.toLowerCase();
    return (
      hb.status.toLowerCase().includes(term) ||
      (hb.statusCode && String(hb.statusCode).includes(term)) ||
      (hb.errorMessage && hb.errorMessage.toLowerCase().includes(term)) ||
      new Date(hb.timestamp).toLocaleString().toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 font-sans">
      {/* Workspace Navigation Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#121829] border border-[#1E2640] p-5 rounded-2xl">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 bg-[#161C2E] hover:bg-[#1E2640] border border-[#2B3555] text-slate-300 px-3.5 py-2 rounded-xl text-xs font-semibold font-mono transition"
          >
            <ArrowLeft className="w-4 h-4 text-indigo-400" /> Back to Services
          </button>

          <div className="flex items-center gap-3 border-l border-[#1E2640] pl-4">
            <div
              className={`p-2.5 rounded-xl border ${
                isUp
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}
            >
              {monitor.type === 'HTTP' ? <Globe className="w-6 h-6" /> : <Server className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">{monitor.name}</h2>
                <span
                  className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full uppercase border ${
                    isUp
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                  }`}
                >
                  {monitor.currentStatus}
                </span>
                <span className="text-xs font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">
                  {monitor.type}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5 truncate max-w-md">
                Target: <span className="text-sky-400">{monitor.url || `Port ${monitor.port}`}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center bg-[#090C16] p-1 rounded-xl border border-[#1E2640] text-xs">
          <button
            onClick={() => setActiveTab('LOGS')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-semibold transition ${
              activeTab === 'LOGS'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> Probe Logs ({monitor.heartbeats.length})
          </button>
          <button
            onClick={() => setActiveTab('TELEMETRY')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-semibold transition ${
              activeTab === 'TELEMETRY'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" /> Latency Telemetry
          </button>
          <button
            onClick={() => setActiveTab('CONFIG')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-semibold transition ${
              activeTab === 'CONFIG'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" /> Target Settings
          </button>
        </div>
      </div>

      {/* Top 3 KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#121829] border border-[#1E2640] p-4.5 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
              24H UPTIME
            </div>
            <div className="text-2xl font-extrabold text-emerald-400 font-mono mt-1">
              {monitor.uptimePercent24h}%
            </div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-[#121829] border border-[#1E2640] p-4.5 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
              CURRENT LATENCY
            </div>
            <div className="text-2xl font-extrabold text-sky-400 font-mono mt-1">
              {latestLatency} ms
            </div>
          </div>
          <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
            <Zap className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-[#121829] border border-[#1E2640] p-4.5 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
              TOTAL PROBES RECORDED
            </div>
            <div className="text-2xl font-extrabold text-white font-mono mt-1">
              {totalProbes}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* TAB 1: PROBE LOGS */}
      {activeTab === 'LOGS' && (
        <div className="bg-[#121829] border border-[#1E2640] rounded-2xl p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#1E2640] pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              <h3 className="font-bold text-slate-100 text-sm font-mono uppercase tracking-wider">
                Recent Probe Execution Logs
              </h3>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter logs..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="w-full md:w-64 bg-[#090C16] border border-[#1E2640] rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          <div className="bg-[#090C16] border border-[#1E2640] rounded-xl overflow-x-auto shadow-sm">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#070913] border-b border-[#1E2640] text-indigo-300 uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">HTTP Code</th>
                  <th className="px-4 py-3">Latency</th>
                  <th className="px-4 py-3">Error / Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2640]/60 text-slate-200">
                {filteredHeartbeats.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-500 italic bg-[#070913]/40">
                      No probe log entries recorded.
                    </td>
                  </tr>
                ) : (
                  filteredHeartbeats.map((hb) => {
                    const isHbUp = hb.status === 'UP';
                    return (
                      <tr key={hb.id} className="hover:bg-[#161C2E] transition">
                        <td className="px-4 py-3 text-slate-400">
                          {new Date(hb.timestamp).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              isHbUp
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {isHbUp ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                            {hb.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {hb.statusCode ? (
                            <span className="font-semibold text-slate-200">{hb.statusCode}</span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sky-400 font-semibold">{hb.latencyMs} ms</td>
                        <td className="px-4 py-3 text-slate-300">
                          {hb.errorMessage || (isHbUp ? 'Response OK' : 'Probe Failed')}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: TELEMETRY */}
      {activeTab === 'TELEMETRY' && (
        <div className="space-y-6">
          {/* Sparkline Chart */}
          <TelemetrySparkline
            title="PING LATENCY WAVEFORM (MS)"
            type="cpu"
            currentValue={`${latestLatency} ms`}
            data={latencyHistory.length > 0 ? latencyHistory : [8, 12, 10, 15, 9, 11, 8]}
          />

          {/* 30-Probe Visualizer Bar */}
          <div className="bg-[#121829] border border-[#1E2640] rounded-2xl p-5 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between text-slate-400">
              <span className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" /> 30-Probe Execution Visualizer
              </span>
              <span>Latest: {latestLatency}ms</span>
            </div>

            <div className="flex items-center gap-1.5 h-10 pt-2">
              {paddedHeartbeats.map((hb, idx) => {
                if (!hb) {
                  return (
                    <div
                      key={idx}
                      className="flex-1 h-full rounded-md bg-slate-800/40"
                      title="No data"
                    />
                  );
                }
                const isHbUp = hb.status === 'UP';
                return (
                  <div
                    key={hb.id || idx}
                    className={`flex-1 h-full rounded-md transition-all hover:scale-110 cursor-pointer ${
                      isHbUp ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-rose-500 hover:bg-rose-400'
                    }`}
                    title={`${new Date(hb.timestamp).toLocaleTimeString()}: ${hb.status} (${hb.latencyMs}ms)`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CONFIG */}
      {activeTab === 'CONFIG' && (
        <div className="bg-[#121829] border border-[#1E2640] rounded-2xl p-6 space-y-5 font-mono text-xs text-slate-200">
          <div className="flex items-center justify-between border-b border-[#1E2640] pb-3">
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <Settings className="w-4 h-4 text-indigo-400" /> Target Probe Configuration
            </h3>
            <div className="flex items-center gap-2">
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="bg-[#161C2E] hover:bg-[#1E2640] border border-[#2B3555] text-indigo-300 px-3 py-1.5 rounded-xl font-bold text-xs transition"
                >
                  Edit Probe Settings
                </button>
              ) : (
                <button
                  onClick={() => setIsEditing(false)}
                  className="bg-[#161C2E] hover:bg-[#1E2640] border border-[#2B3555] text-slate-400 px-3 py-1.5 rounded-xl font-bold text-xs transition"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </div>

          {savedMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> {savedMsg}
            </div>
          )}

          {isEditing ? (
            <form onSubmit={handleSaveConfig} className="space-y-4 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-[10px] uppercase font-bold mb-1">
                    Service Target Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-[#090C16] border border-[#1E2640] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-[10px] uppercase font-bold mb-1">
                    Service Group / Data Center
                  </label>
                  <input
                    type="text"
                    required
                    value={editGroup}
                    onChange={(e) => setEditGroup(e.target.value)}
                    className="w-full bg-[#090C16] border border-[#1E2640] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 text-[10px] uppercase font-bold mb-1">
                  {monitor.type === 'HTTP' ? 'Target URL' : 'Host IP'}
                </label>
                <input
                  type="text"
                  required
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  className="w-full bg-[#090C16] border border-[#1E2640] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              {monitor.type === 'TCP' && (
                <div>
                  <label className="block text-slate-400 text-[10px] uppercase font-bold mb-1">Port</label>
                  <input
                    type="number"
                    required
                    value={editPort}
                    onChange={(e) => setEditPort(e.target.value)}
                    className="w-full bg-[#090C16] border border-[#1E2640] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-400 text-[10px] uppercase font-bold">
                    Check Interval (Seconds)
                  </label>
                  <div className="flex items-center gap-1">
                    {[10, 30, 60, 300].map((sec) => (
                      <button
                        type="button"
                        key={sec}
                        onClick={() => setEditIntervalSec(sec)}
                        className={`px-2 py-0.5 text-[10px] font-mono rounded font-bold transition ${
                          editIntervalSec === sec
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="number"
                  min="10"
                  max="3600"
                  value={editIntervalSec}
                  onChange={(e) => setEditIntervalSec(Number(e.target.value))}
                  className="w-full bg-[#090C16] border border-[#1E2640] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl text-xs font-bold font-mono shadow-md shadow-indigo-600/30 transition disabled:opacity-50"
                >
                  {saving ? 'Saving Changes...' : 'Save Settings'}
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#090C16] p-4 rounded-xl border border-[#1E2640] space-y-1">
                <span className="text-slate-500 uppercase text-[10px]">Service Target Name</span>
                <div className="font-bold text-white text-sm">{editName}</div>
              </div>

              <div className="bg-[#090C16] p-4 rounded-xl border border-[#1E2640] space-y-1">
                <span className="text-slate-500 uppercase text-[10px]">Monitor Probe Driver</span>
                <div className="font-bold text-indigo-400 text-sm">{monitor.type}</div>
              </div>

              <div className="bg-[#090C16] p-4 rounded-xl border border-[#1E2640] space-y-1 col-span-2">
                <span className="text-slate-500 uppercase text-[10px]">Target Endpoint URL / Host</span>
                <div className="font-bold text-sky-400 text-sm">{editUrl || `Port ${editPort}`}</div>
              </div>

              <div className="bg-[#090C16] p-4 rounded-xl border border-[#1E2640] space-y-2">
                <span className="text-slate-500 uppercase text-[10px]">Probe Check Interval</span>
                <div className="font-bold text-emerald-400 text-sm">
                  Every {editIntervalSec} seconds
                </div>
              </div>

              <div className="bg-[#090C16] p-4 rounded-xl border border-[#1E2640] space-y-1">
                <span className="text-slate-500 uppercase text-[10px]">Probe Timeout</span>
                <div className="font-bold text-amber-400 text-sm">{monitor.timeoutSec || 10} seconds</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
