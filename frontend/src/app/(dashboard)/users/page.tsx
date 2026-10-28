// frontend/src/app/(dashboard)/users/page.tsx
'use client';

import React from 'react';
import UserManagement from '@/components/UserManagement';

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
          NETWORK OPERATIONS CENTER
        </span>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mt-0.5">
          User Access Directory
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Manage operator credentials, roles, and administrative security privileges.
        </p>
      </div>

      <UserManagement />
    </div>
  );
}
