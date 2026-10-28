// frontend/src/app/(dashboard)/databases/page.tsx
'use client';

import React, { useState } from 'react';
import DatabasesView from '@/components/DatabasesView';
import AddDatabaseModal from '@/components/AddDatabaseModal';
import { Plus } from 'lucide-react';

export default function DatabasesPage() {
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [dbKey, setDbKey] = useState(0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
            NETWORK OPERATIONS CENTER
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mt-0.5">
            Databases
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage multi-database connections, run SQL diagnostics, and monitor table health.
          </p>
        </div>

        <button
          onClick={() => setIsDbModalOpen(true)}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4.5 py-2 rounded-xl font-semibold text-xs shadow-lg shadow-purple-600/30 transition self-start md:self-auto"
        >
          <Plus className="w-4 h-4" /> Add Database Connection
        </button>
      </div>

      <DatabasesView key={dbKey} />

      <AddDatabaseModal
        isOpen={isDbModalOpen}
        onClose={() => setIsDbModalOpen(false)}
        onSuccess={() => {
          setIsDbModalOpen(false);
          setDbKey((prev) => prev + 1);
        }}
      />
    </div>
  );
}
