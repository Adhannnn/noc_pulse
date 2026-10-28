// frontend/src/app/(dashboard)/processes/page.tsx
'use client';

import React from 'react';
import ProcessExplorerView from '@/components/ProcessExplorerView';

export default function ProcessesPage() {
  return (
    <div className="space-y-6">
      <div>
        <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
          NETWORK OPERATIONS CENTER
        </span>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mt-0.5">
          Host Process Explorer
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Inspect active host processes, memory allocations, CPU footprints, and system health.
        </p>
      </div>

      <ProcessExplorerView />
    </div>
  );
}
