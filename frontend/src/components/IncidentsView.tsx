// frontend/src/components/IncidentsView.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AlertTriangle, CheckCircle2, Clock, ShieldAlert, History, Filter } from 'lucide-react';

export interface IncidentUpdate {
  id: string;
  status: string;
  message: string;
  createdAt: string;
}

export interface Incident {
  id: string;
  title: string;
  description?: string;
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR' | 'MAINTENANCE';
  status: 'INVESTIGATING' | 'IDENTIFIED' | 'MONITORING' | 'RESOLVED';
  startedAt: string;
  resolvedAt?: string;
  monitor?: {
    name: string;
    url?: string;
  };
  updates: IncidentUpdate[];
}

export default function IncidentsView() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'RESOLVED'>('ALL');
  const { authFetch } = useAuth();

  const fetchIncidents = async () => {
    try {
      const res = await authFetch('/api/monitors/incidents/all');
      if (res.ok) {
        const data = await res.json();
        setIncidents(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, []);

  const filteredIncidents = incidents.filter((item) => {
    if (filter === 'ACTIVE') return item.status !== 'RESOLVED';
    if (filter === 'RESOLVED') return item.status === 'RESOLVED';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 p-5 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">NOC Incident Command Center</h2>
            <p className="text-xs text-slate-400">
              Automated outage detection, error telemetry, and timeline audit logs
            </p>
          </div>
        </div>

        {/* Filter Pill */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          {(['ALL', 'ACTIVE', 'RESOLVED'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                filter === tab
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab === 'ALL' ? 'All Incidents' : tab === 'ACTIVE' ? 'Active Alerts' : 'Resolved'}
            </button>
          ))}
        </div>
      </div>

      {/* Incidents List */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 font-mono text-sm">
          Loading Incident Timeline Telemetry...
        </div>
      ) : filteredIncidents.length === 0 ? (
        <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-12 text-center text-slate-500 space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
          <p className="font-semibold text-slate-300">All Systems Operational</p>
          <p className="text-xs text-slate-500">No security or downtime incidents recorded for this view.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredIncidents.map((incident) => {
            const isResolved = incident.status === 'RESOLVED';
            return (
              <div
                key={incident.id}
                className={`bg-slate-900/90 border rounded-2xl p-5 transition space-y-4 ${
                  isResolved
                    ? 'border-slate-800 hover:border-slate-700'
                    : 'border-rose-500/40 bg-rose-950/10 shadow-lg shadow-rose-950/20'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-lg mt-0.5 ${
                        isResolved
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'
                      }`}
                    >
                      {isResolved ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <AlertTriangle className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-100 text-base">{incident.title}</h3>
                        <span
                          className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full ${
                            isResolved
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                          }`}
                        >
                          {incident.status}
                        </span>
                        <span className="text-[10px] uppercase font-mono font-semibold bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                          {incident.severity}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Service Target: <strong className="text-slate-200">{incident.monitor?.name}</strong> •{' '}
                        {incident.monitor?.url}
                      </p>
                    </div>
                  </div>

                  <div className="text-xs text-slate-400 space-y-1 font-mono md:text-right">
                    <div className="flex items-center gap-1.5 md:justify-end">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      Started: {new Date(incident.startedAt).toLocaleString()}
                    </div>
                    {incident.resolvedAt && (
                      <div className="text-emerald-400">
                        Resolved: {new Date(incident.resolvedAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>

                {incident.description && (
                  <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 text-xs text-slate-300 font-mono">
                    <span className="text-slate-500">Root Cause / Error: </span>
                    {incident.description}
                  </div>
                )}

                {/* Updates Timeline */}
                {incident.updates && incident.updates.length > 0 && (
                  <div className="border-t border-slate-800/80 pt-3 space-y-2">
                    <h4 className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">
                      Audit Trail & Updates ({incident.updates.length})
                    </h4>
                    <div className="space-y-1.5">
                      {incident.updates.map((update) => (
                        <div
                          key={update.id}
                          className="flex items-center justify-between text-xs bg-slate-950/40 px-3 py-2 rounded-lg border border-slate-800/50"
                        >
                          <span className="text-slate-300">{update.message}</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(update.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
