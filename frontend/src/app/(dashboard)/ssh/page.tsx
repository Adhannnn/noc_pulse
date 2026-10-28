// frontend/src/app/(dashboard)/ssh/page.tsx
'use client';

import React from 'react';
import SshTerminalView from '@/components/SshTerminalView';

export default function SshPage() {
  return (
    <div className="space-y-6">
      <div>
        <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
          NETWORK OPERATIONS CENTER
        </span>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mt-0.5">
          SSH Console
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Secure command-line operational terminal interface.
        </p>
      </div>

      <SshTerminalView />
    </div>
  );
}
