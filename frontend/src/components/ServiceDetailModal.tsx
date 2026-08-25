// frontend/src/components/ServiceDetailModal.tsx
'use client';

import React from 'react';
import { Monitor } from '@/components/MonitorCard';
import { X, Server, Globe, CheckCircle2, XCircle, Clock, Zap, AlertTriangle, ShieldAlert } from 'lucide-react';

interface ServiceDetailModalProps {
  monitor: Monitor | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ServiceDetailModal({ monitor, isOpen, onClose }: ServiceDetailModalProps) {
  if (!isOpen || !monitor) return null;

  const isUp = monitor.currentStatus === 'UP';
  const latestLatency = monitor.heartbeats[0]?.latencyMs ?? 0;
  const recentLogs = monitor.heartbeats.slice(0, 15);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0D111D] border border-[#1E2640] rounded-2xl w-full max-w-3xl p-6 text-slate-100 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto font-sans">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-[#1E2640] pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-3 rounded-xl ${
                isUp ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}
            >
              {monitor.type === 'HTTP' ? <Globe className="w-6 h-6" /> : <Server className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold text-white tracking-tight">{monitor.name}</h2>
                <span
                  className={`text-xs uppercase font-mono font-bold px-2.5 py-0.5 rounded-full ${
                    isUp
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  }`}
                >
                  {monitor.currentStatus}
                </span>
                <span className="text-xs font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md">
                  {monitor.type}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Endpoint Target: <span className="text-slate-200">{monitor.url || `Port ${monitor.port}`}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-[#1E2640] rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Telemetry KPI Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[#121829] border border-[#1E2640] p-4 rounded-xl">
            <div className="text-[10px] font-mono text-slate-400 uppercase">24H Uptime</div>
            <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">
              {monitor.uptimePercent24h}%
            </div>
          </div>

          <div className="bg-[#121829] border border-[#1E2640] p-4 rounded-xl">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Current Latency</div>
            <div className="text-2xl font-bold text-sky-400 font-mono mt-1">
              {latestLatency} ms
            </div>
          </div>

          <div className="bg-[#121829] border border-[#1E2640] p-4 rounded-xl">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Total Probes Recorded</div>
            <div className="text-2xl font-bold text-slate-100 font-mono mt-1">
              {monitor.heartbeats.length}
            </div>
          </div>
        </div>

        {/* Probe Logs Audit Trail */}
        <div className="space-y-3">
          <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" /> Recent Probe Execution Logs
          </h3>

          <div className="bg-[#121829] border border-[#1E2640] rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#090C16] border-b border-[#1E2640] text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-2.5">Timestamp</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">HTTP Code</th>
                  <th className="px-4 py-2.5">Latency</th>
                  <th className="px-4 py-2.5">Error / Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2640]/60 text-slate-200">
                {recentLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                      No probe logs recorded yet.
                    </td>
                  </tr>
                ) : (
                  recentLogs.map((hb) => (
                    <tr key={hb.id} className="hover:bg-[#161C2E] transition">
                      <td className="px-4 py-2.5 text-slate-400">
                        {new Date(hb.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                            hb.status === 'UP'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {hb.status === 'UP' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {hb.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-300">
                        {hb.statusCode ? <span className="bg-slate-800 px-1.5 py-0.5 rounded">{hb.statusCode}</span> : '-'}
                      </td>
                      <td className="px-4 py-2.5 text-sky-400 font-semibold">{hb.latencyMs} ms</td>
                      <td className="px-4 py-2.5 text-slate-400 truncate max-w-xs">
                        {hb.errorMessage || 'Response OK'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl text-xs font-semibold transition"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}
