// frontend/src/app/(dashboard)/incidents/page.tsx
'use client';

import React from 'react';
import IncidentsView from '@/components/IncidentsView';

export default function IncidentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
          NETWORK OPERATIONS CENTER
        </span>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mt-0.5">
          Incidents Log
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Audit trail of past outages, recovery timelines, and active operational incidents.
        </p>
      </div>

      <IncidentsView />
    </div>
  );
}
