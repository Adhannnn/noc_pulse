// frontend/src/app/(dashboard)/alerts/page.tsx
'use client';

import React from 'react';
import AlertChannelsView from '@/components/AlertChannelsView';

export default function AlertsPage() {
  return (
    <div className="space-y-6">
      <div>
        <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
          NETWORK OPERATIONS CENTER
        </span>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mt-0.5">
          Alert Integration Channels
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Configure Discord webhooks, Telegram bots, and automated anomaly detection thresholds.
        </p>
      </div>

      <AlertChannelsView />
    </div>
  );
}
