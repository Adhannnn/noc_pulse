// frontend/src/app/(dashboard)/layout.tsx
'use client';

import React from 'react';
import Sidebar from '@/components/Sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[#0B0F19] text-slate-100 font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto min-w-0 p-6 md:p-8 space-y-6">
        {children}
      </main>
    </div>
  );
}
