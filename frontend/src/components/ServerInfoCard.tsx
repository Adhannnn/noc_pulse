// frontend/src/components/ServerInfoCard.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Server } from 'lucide-react';

interface ServerInfoData {
  hostname: string;
  os: string;
  kernel: string;
  uptime: string;
  cpuCores: string;
  ipAddress: string;
}

export default function ServerInfoCard() {
  const [info, setInfo] = useState<ServerInfoData | null>(null);
  const { authFetch } = useAuth();

  useEffect(() => {
    authFetch('/api/metrics/server-info')
      .then((res) => res.json())
      .then((data) => {
        if (data) setInfo(data);
      })
      .catch(console.error);
  }, []);

  return (
    <div className="bg-[#121829] border border-[#1E2640] rounded-2xl p-5 shadow-sm text-slate-100 flex flex-col justify-between h-full font-sans">
      {/* Header */}
      <div className="flex items-center gap-2 text-slate-400 text-xs font-mono uppercase tracking-wider font-bold mb-4">
        <Server className="w-4 h-4 text-sky-400" />
        <span>SERVER INFO</span>
      </div>

      {/* Info Rows or Lazy Skeleton Loading */}
      {!info ? (
        <div className="space-y-3 font-mono text-xs">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center justify-between border-b border-[#1E2640]/60 pb-2">
              <div className="w-20 h-3.5 bg-slate-800/80 rounded animate-pulse" />
              <div className="w-32 h-3.5 bg-slate-800/60 rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3 text-xs font-mono">
          <div className="flex items-center justify-between border-b border-[#1E2640]/60 pb-2">
            <span className="text-slate-400">Hostname</span>
            <span className="font-semibold text-slate-200">{info.hostname}</span>
          </div>

          <div className="flex items-center justify-between border-b border-[#1E2640]/60 pb-2">
            <span className="text-slate-400">OS</span>
            <span className="font-semibold text-slate-200 truncate max-w-[200px]" title={info.os}>
              {info.os}
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-[#1E2640]/60 pb-2">
            <span className="text-slate-400">Kernel</span>
            <span className="font-semibold text-slate-200 truncate max-w-[200px]" title={info.kernel}>
              {info.kernel}
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-[#1E2640]/60 pb-2">
            <span className="text-slate-400">Uptime</span>
            <span className="font-semibold text-emerald-400">{info.uptime}</span>
          </div>

          <div className="flex items-center justify-between border-b border-[#1E2640]/60 pb-2">
            <span className="text-slate-400">CPU Cores</span>
            <span className="font-semibold text-slate-200">{info.cpuCores}</span>
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <span className="text-slate-400">IP Addresses</span>
            <span className="font-semibold text-sky-400">{info.ipAddress}</span>
          </div>
        </div>
      )}
    </div>
  );
}
