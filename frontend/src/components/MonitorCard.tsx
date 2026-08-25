// frontend/src/components/MonitorCard.tsx
'use client';

import React from 'react';
import { Globe, Server, CheckCircle2, XCircle, Clock, Trash2, Edit3 } from 'lucide-react';

export interface Heartbeat {
  id: string;
  status: 'UP' | 'DOWN' | 'DEGRADED';
  latencyMs: number;
  statusCode?: number;
  errorMessage?: string;
  timestamp: string;
}

export interface Monitor {
  id: string;
  name: string;
  type: 'HTTP' | 'TCP' | 'DATABASE';
  url?: string;
  port?: number;
  group?: string;
  intervalSec?: number;
  timeoutSec?: number;
  currentStatus: 'UP' | 'DOWN' | 'DEGRADED' | 'PENDING';
  uptimePercent24h: number;
  heartbeats: Heartbeat[];
}

interface Props {
  monitor: Monitor;
  onDelete?: (id: string) => void;
  onSelect?: (monitor: Monitor) => void;
  isReadOnly?: boolean;
}

export default function MonitorCard({ monitor, onDelete, onSelect, isReadOnly = false }: Props) {
  const isUp = monitor.currentStatus === 'UP';
  const latestLatency = monitor.heartbeats[0]?.latencyMs ?? 0;

  const totalHb = monitor.heartbeats.length;
  const upHb = monitor.heartbeats.filter((hb) => hb.status === 'UP').length;
  const computedUptime = totalHb > 0 ? Math.round((upHb / totalHb) * 100) : (monitor.uptimePercent24h ?? 100);

  // Render 30 batang status (heartbeats)
  const paddedHeartbeats = Array.from({ length: 30 }).map((_, i) => {
    return monitor.heartbeats[29 - i] || null;
  });

  return (
    <div
      onClick={() => onSelect && onSelect(monitor)}
      className="bg-[#121829] border border-[#1E2640] rounded-2xl p-5 shadow-sm text-slate-100 hover:border-slate-600 transition cursor-pointer group"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg ${
              isUp ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
            }`}
          >
            {monitor.type === 'HTTP' ? <Globe className="w-5 h-5" /> : <Server className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-100">{monitor.name}</h3>
              <span
                className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                  isUp ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                }`}
              >
                {monitor.currentStatus}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-sm">
              {monitor.url || `Port: ${monitor.port}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm font-semibold text-slate-200">{computedUptime}%</div>
            <div className="text-[10px] text-slate-400">24h Uptime</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold text-sky-400">{latestLatency} ms</div>
            <div className="text-[10px] text-slate-400">Latency</div>
          </div>
          {!isReadOnly && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onSelect) onSelect(monitor);
                }}
                className="p-1.5 text-slate-500 hover:text-indigo-400 hover:bg-[#1E2640] rounded-lg transition"
                title="Edit / Update Service Settings"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(monitor.id);
                  }}
                  className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-[#1E2640] rounded-lg transition"
                  title="Delete Monitor"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Uptime Mini Bars (30-day/probe style) */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1.5">
          <span>Past checks</span>
          <span>Latest check: {latestLatency}ms</span>
        </div>
        <div className="flex items-center gap-1 h-7">
          {paddedHeartbeats.map((hb, idx) => {
            if (!hb) {
              return (
                <div
                  key={idx}
                  className="flex-1 h-full rounded-sm bg-slate-800/40"
                  title="No data"
                />
              );
            }
            const isHbUp = hb.status === 'UP';
            return (
              <div
                key={hb.id || idx}
                className={`flex-1 h-full rounded-sm transition-all hover:scale-110 cursor-pointer ${
                  isHbUp ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-rose-500 hover:bg-rose-400'
                }`}
                title={`${new Date(hb.timestamp).toLocaleTimeString()}: ${hb.status} (${hb.latencyMs}ms)`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}