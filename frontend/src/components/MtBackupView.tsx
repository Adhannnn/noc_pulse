// frontend/src/components/MtBackupView.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { HardDrive, Download, Play, CheckCircle2, ShieldCheck, RefreshCw } from 'lucide-react';

export interface BackupItem {
  id: string;
  deviceName: string;
  filename: string;
  sizeKb: number;
  status: string;
  createdAt: string;
}

export default function MtBackupView() {
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const { authFetch } = useAuth();

  const fetchBackups = async () => {
    try {
      const res = await authFetch('/api/backups');
      if (res.ok) {
        const data = await res.json();
        setBackups(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleTriggerBackup = async () => {
    setTriggering(true);
    try {
      const res = await authFetch('/api/backups/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceName: 'MikroTik CCR2004 Core Router' }),
      });
      if (res.ok) {
        fetchBackups();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#121829] border border-[#1E2640] p-5 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">MT Backup Vault</h2>
            <p className="text-xs text-slate-400">
              Automated configuration backup vault for MikroTik routers and database clusters
            </p>
          </div>
        </div>

        <button
          onClick={handleTriggerBackup}
          disabled={triggering}
          className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white px-4 py-2.5 rounded-xl font-semibold text-xs shadow-lg shadow-amber-600/20 transition disabled:opacity-50"
        >
          {triggering ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {triggering ? 'Executing Backup...' : 'Trigger Immediate Backup'}
        </button>
      </div>

      {/* Backup Records Table */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 font-mono text-xs">
          Loading Backup Archive Vault...
        </div>
      ) : (
        <div className="bg-[#121829] border border-[#1E2640] rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#090C16] border-b border-[#1E2640] text-slate-400 uppercase text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Device Source</th>
                <th className="px-5 py-3.5">Backup Filename</th>
                <th className="px-5 py-3.5">Archive Size</th>
                <th className="px-5 py-3.5">Execution Status</th>
                <th className="px-5 py-3.5">Timestamp</th>
                <th className="px-5 py-3.5 text-right">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2640]/60 text-slate-200">
              {backups.map((item) => (
                <tr key={item.id} className="hover:bg-[#161C2E] transition">
                  <td className="px-5 py-3.5 font-semibold text-white">{item.deviceName}</td>
                  <td className="px-5 py-3.5 text-amber-400">{item.filename}</td>
                  <td className="px-5 py-3.5 text-slate-400">{(item.sizeKb / 1024).toFixed(2)} MB</td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> {item.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-400">
                    {new Date(item.createdAt).toLocaleString()}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => alert(`Downloading backup file: ${item.filename}`)}
                      className="p-1.5 bg-[#1E2640] hover:bg-slate-700 text-slate-200 rounded-lg transition"
                      title="Download Backup RSC Archive"
                    >
                      <Download className="w-4 h-4 text-amber-400" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
