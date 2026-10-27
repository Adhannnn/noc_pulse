// frontend/src/components/Sidebar.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  Server,
  Database,
  Terminal,
  ShieldAlert,
  Bell,
  Users,
  LogOut,
  Radio,
  Box,
  ChevronLeft,
  ChevronRight,
  Activity,
} from 'lucide-react';

export type NOCNavSection =
  | 'OVERVIEW'
  | 'SERVICES'
  | 'DATABASES'
  | 'DOCKER'
  | 'PROCESSES'
  | 'INCIDENTS'
  | 'ALERTS'
  | 'USERS'
  | 'SSH';

interface SidebarProps {
  currentTab: NOCNavSection;
  onSelectTab: (tab: NOCNavSection) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface NavItem {
  id: NOCNavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  adminOnly?: boolean;
}

interface NavCategory {
  title: string;
  items: NavItem[];
}

const NAV_CATEGORIES: NavCategory[] = [
  {
    title: 'OVERVIEW',
    items: [
      {
        id: 'OVERVIEW',
        label: 'Dashboard',
        icon: LayoutDashboard,
        iconColor: 'text-sky-400',
      },
    ],
  },
  {
    title: 'INFRASTRUCTURE',
    items: [
      {
        id: 'SERVICES',
        label: 'Services',
        icon: Server,
        iconColor: 'text-amber-400',
      },
      {
        id: 'DATABASES',
        label: 'Databases',
        icon: Database,
        iconColor: 'text-purple-400',
      },
      {
        id: 'DOCKER',
        label: 'Docker Logs',
        icon: Box,
        iconColor: 'text-sky-400',
      },
      {
        id: 'PROCESSES',
        label: 'Process Explorer',
        icon: Activity,
        iconColor: 'text-rose-400',
      },
      {
        id: 'SSH',
        label: 'SSH Console',
        icon: Terminal,
        iconColor: 'text-emerald-400',
      },
    ],
  },
  {
    title: 'MANAGEMENT',
    items: [
      {
        id: 'INCIDENTS',
        label: 'Incidents Log',
        icon: ShieldAlert,
        iconColor: 'text-rose-400',
      },
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      {
        id: 'ALERTS',
        label: 'Alert Channels',
        icon: Bell,
        iconColor: 'text-amber-400',
      },
      {
        id: 'USERS',
        label: 'Users Directory',
        icon: Users,
        iconColor: 'text-purple-400',
        adminOnly: true,
      },
    ],
  },
];

export default function Sidebar({
  currentTab,
  onSelectTab,
  isCollapsed: controlledCollapsed,
  onToggleCollapse,
}: SidebarProps) {
  const { user, logout } = useAuth();
  const [internalCollapsed, setInternalCollapsed] = useState(false);

  // Restore collapsed state from localStorage on client-side mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pulsenoc_sidebar_collapsed');
      if (saved !== null) {
        setInternalCollapsed(saved === 'true');
      }
    } catch {
      // LocalStorage access exception fallback
    }
  }, []);

  const isCollapsed =
    controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  const toggleCollapse = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      const next = !internalCollapsed;
      setInternalCollapsed(next);
      try {
        localStorage.setItem('pulsenoc_sidebar_collapsed', String(next));
      } catch {
        // Ignore local storage error
      }
    }
  };

  // Keyboard shortcut: Ctrl+B or Cmd+B to toggle sidebar collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleCollapse();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [controlledCollapsed, internalCollapsed]);

  if (!user) return null;

  return (
    <aside
      className={`${
        isCollapsed ? 'w-[72px]' : 'w-64'
      } bg-[#0D111D] border-r border-[#1E2640] flex flex-col justify-between shrink-0 h-screen sticky top-0 font-sans select-none text-slate-300 transition-all duration-300 ease-in-out z-30`}
    >
      {/* Top Header & Navigation Section */}
      <div
        className={`flex-1 p-3 space-y-5 scrollbar-thin scrollbar-thumb-slate-800 ${
          isCollapsed ? 'overflow-visible' : 'overflow-y-auto overflow-x-hidden'
        }`}
      >
        {/* Brand Header */}
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2 py-1">
            <div
              className="p-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 shrink-0"
              title="PulseNOC Telemetry"
            >
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <button
              onClick={toggleCollapse}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1E2640] transition cursor-pointer"
              title="Expand Sidebar (Ctrl+B / ⌘B)"
              aria-label="Expand Sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between px-2 py-1">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 shrink-0">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div className="overflow-hidden">
                <h1 className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5 whitespace-nowrap">
                  NOC System
                </h1>
                <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                  LIVE TELEMETRY
                </span>
              </div>
            </div>

            <button
              onClick={toggleCollapse}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1E2640] transition cursor-pointer shrink-0"
              title="Collapse Sidebar (Ctrl+B / ⌘B)"
              aria-label="Collapse Sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Navigation Categories */}
        <nav className="space-y-4 text-xs font-medium">
          {NAV_CATEGORIES.map((cat) => {
            const visibleItems = cat.items.filter(
              (item) => !item.adminOnly || user.role === 'ADMIN',
            );

            if (visibleItems.length === 0) return null;

            return (
              <div key={cat.title}>
                {isCollapsed ? (
                  <div className="h-px bg-[#1E2640]/80 my-2.5 mx-1" />
                ) : (
                  <div className="text-[10px] font-mono font-bold text-slate-500 tracking-wider uppercase px-2 mb-1.5">
                    {cat.title}
                  </div>
                )}

                <div className="space-y-1">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentTab === item.id;

                    return (
                      <button
                        key={item.id}
                        onClick={() => onSelectTab(item.id)}
                        className={`w-full flex items-center ${
                          isCollapsed
                            ? 'justify-center p-2.5'
                            : 'px-3 py-2 gap-3'
                        } rounded-xl transition relative group cursor-pointer ${
                          isActive
                            ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/25'
                            : 'text-slate-400 hover:text-slate-100 hover:bg-[#161C2E]'
                        }`}
                        title={isCollapsed ? item.label : undefined}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : item.iconColor}`} />

                        {!isCollapsed && (
                          <span className="truncate">{item.label}</span>
                        )}

                        {/* Collapsed Tooltip on Hover */}
                        {isCollapsed && (
                          <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#161C2E] text-slate-100 text-xs font-medium rounded-lg whitespace-nowrap shadow-2xl border border-[#2B3555] opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150 z-50 flex items-center gap-2">
                            <span>{item.label}</span>
                            {isActive && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </div>

      {/* Bottom Profile Footer Box */}
      <div className={`p-3 border-t border-[#1E2640] bg-[#090C16] ${isCollapsed ? 'overflow-visible' : ''}`}>
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-9 h-9 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center font-bold text-indigo-300 text-xs shrink-0 relative group cursor-pointer"
              title={`${user.name} (${user.role})`}
            >
              {user.name.substring(0, 2).toUpperCase()}
              <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#161C2E] text-slate-100 text-xs font-medium rounded-lg whitespace-nowrap shadow-2xl border border-[#2B3555] opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150 z-50">
                <div className="font-semibold">{user.name}</div>
                <div className="text-[10px] text-slate-400 font-mono">{user.role}</div>
              </div>
            </div>

            <button
              onClick={logout}
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-[#1E2640] rounded-xl transition relative group cursor-pointer"
              title="Logout NOC Session"
            >
              <LogOut className="w-4 h-4" />
              <div className="absolute left-full ml-3 px-2.5 py-1 bg-[#161C2E] text-rose-300 text-xs font-medium rounded-lg whitespace-nowrap shadow-2xl border border-[#2B3555] opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150 z-50">
                Logout
              </div>
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between p-2 rounded-xl bg-[#121829] border border-[#1E2640]">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center font-bold text-indigo-300 text-xs shrink-0">
                {user.name.substring(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-xs text-white truncate">{user.name}</div>
                <div className="text-[10px] text-slate-400 font-mono truncate">{user.role}</div>
              </div>
            </div>

            <button
              onClick={logout}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-[#1E2640] rounded-lg transition cursor-pointer"
              title="Logout NOC Session"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
