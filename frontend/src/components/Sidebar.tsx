// frontend/src/components/Sidebar.tsx
'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  Server,
  Database,
  Terminal,
  ShieldAlert,
  Layers,
  HardDrive,
  Bell,
  Users,
  LogOut,
  Radio,
} from 'lucide-react';

export type NOCNavSection =
  | 'OVERVIEW'
  | 'SERVICES'
  | 'DATABASES'
  | 'INCIDENTS'
  | 'IPMANAGEMENT'
  | 'MTBACKUP'
  | 'ALERTS'
  | 'USERS'
  | 'SSH';

interface SidebarProps {
  currentTab: NOCNavSection;
  onSelectTab: (tab: NOCNavSection) => void;
}

export default function Sidebar({ currentTab, onSelectTab }: SidebarProps) {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <aside className="w-64 bg-[#0D111D] border-r border-[#1E2640] flex flex-col justify-between shrink-0 h-screen sticky top-0 font-sans select-none text-slate-300">
      {/* Top Section */}
      <div className="overflow-y-auto overflow-x-hidden p-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="p-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
              NOC System
            </h1>
          </div>
        </div>

        {/* Navigation Categories */}
        <nav className="space-y-5 text-xs font-medium">
          {/* CATEGORY: OVERVIEW */}
          <div>
            <div className="text-[10px] font-mono font-bold text-slate-500 tracking-wider uppercase px-2 mb-1.5">
              OVERVIEW
            </div>
            <button
              onClick={() => onSelectTab('OVERVIEW')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition ${
                currentTab === 'OVERVIEW'
                  ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-[#161C2E]'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-sky-400" />
              <span>Dashboard</span>
            </button>
          </div>

          {/* CATEGORY: INFRASTRUCTURE */}
          <div>
            <div className="text-[10px] font-mono font-bold text-slate-500 tracking-wider uppercase px-2 mb-1.5">
              INFRASTRUCTURE
            </div>
            <div className="space-y-0.5">
              <button
                onClick={() => onSelectTab('SERVICES')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition ${
                  currentTab === 'SERVICES'
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-[#161C2E]'
                }`}
              >
                <Server className="w-4 h-4 text-amber-400" />
                <span>Services</span>
              </button>

              <button
                onClick={() => onSelectTab('DATABASES')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition ${
                  currentTab === 'DATABASES'
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-[#161C2E]'
                }`}
              >
                <Database className="w-4 h-4 text-purple-400" />
                <span>Databases</span>
              </button>

              <button
                onClick={() => onSelectTab('SSH')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition ${
                  currentTab === 'SSH'
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-[#161C2E]'
                }`}
              >
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>SSH Console</span>
              </button>
            </div>
          </div>

          {/* CATEGORY: MANAGEMENT */}
          <div>
            <div className="text-[10px] font-mono font-bold text-slate-500 tracking-wider uppercase px-2 mb-1.5">
              MANAGEMENT
            </div>
            <div className="space-y-0.5">
              <button
                onClick={() => onSelectTab('INCIDENTS')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition ${
                  currentTab === 'INCIDENTS'
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-[#161C2E]'
                }`}
              >
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span>Incidents Log</span>
              </button>

              <button
                onClick={() => onSelectTab('IPMANAGEMENT')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition ${
                  currentTab === 'IPMANAGEMENT'
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-[#161C2E]'
                }`}
              >
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>IP Management</span>
              </button>

              <button
                onClick={() => onSelectTab('MTBACKUP')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition ${
                  currentTab === 'MTBACKUP'
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-[#161C2E]'
                }`}
              >
                <HardDrive className="w-4 h-4 text-amber-400" />
                <span>MT Backup</span>
              </button>
            </div>
          </div>

          {/* CATEGORY: SYSTEM */}
          <div>
            <div className="text-[10px] font-mono font-bold text-slate-500 tracking-wider uppercase px-2 mb-1.5">
              SYSTEM
            </div>
            <div className="space-y-0.5">
              <button
                onClick={() => onSelectTab('ALERTS')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition ${
                  currentTab === 'ALERTS'
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-[#161C2E]'
                }`}
              >
                <Bell className="w-4 h-4 text-amber-400" />
                <span>Alert Channels</span>
              </button>

              {user.role === 'ADMIN' && (
                <button
                  onClick={() => onSelectTab('USERS')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition ${
                    currentTab === 'USERS'
                      ? 'bg-purple-600 text-white font-semibold'
                      : 'text-purple-300 hover:text-purple-100 hover:bg-purple-950/40'
                  }`}
                >
                  <Users className="w-4 h-4 text-purple-400" />
                  <span>Users Directory</span>
                </button>
              )}
            </div>
          </div>
        </nav>
      </div>

      {/* Bottom Profile Footer Box */}
      <div className="p-3 border-t border-[#1E2640] bg-[#090C16]">
        <div className="flex items-center justify-between p-2 rounded-xl bg-[#121829] border border-[#1E2640]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center font-bold text-indigo-300 text-xs shrink-0">
              {user.name.substring(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-xs text-white truncate">{user.name}</div>
            </div>
          </div>

          <button
            onClick={logout}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-[#1E2640] rounded-lg transition"
            title="Logout NOC Session"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
