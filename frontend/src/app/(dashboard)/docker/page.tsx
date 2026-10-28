// frontend/src/app/(dashboard)/docker/page.tsx
'use client';

import React from 'react';
import DockerLogsView from '@/components/DockerLogsView';

export default function DockerPage() {
  return (
    <div className="space-y-6">
      <div>
        <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
          NETWORK OPERATIONS CENTER
        </span>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mt-0.5">
          Docker Fleet & Logs
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Real-time container inspection and live log streaming from Docker daemon.
        </p>
      </div>

      <DockerLogsView />
    </div>
  );
}
