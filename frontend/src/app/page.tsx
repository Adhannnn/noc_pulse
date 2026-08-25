// frontend/src/app/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Sidebar, { NOCNavSection } from '@/components/Sidebar';
import ServerInfoCard from '@/components/ServerInfoCard';
import CircularGauge from '@/components/CircularGauge';
import TelemetrySparkline from '@/components/TelemetrySparkline';
import MonitorCard, { Monitor } from '@/components/MonitorCard';
import AddMonitorModal from '@/components/AddMonitorModal';
import AddDatabaseModal from '@/components/AddDatabaseModal';
import AddGroupModal from '@/components/AddGroupModal';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import ServiceDetailView from '@/components/ServiceDetailView';
import GroupDetailView from '@/components/GroupDetailView';
import DatabasesView from '@/components/DatabasesView';
import IpManagementView from '@/components/IpManagementView';
import MtBackupView from '@/components/MtBackupView';
import IncidentsView from '@/components/IncidentsView';
import AlertChannelsView from '@/components/AlertChannelsView';
import UserManagement from '@/components/UserManagement';
import { useSocket } from '@/hooks/useSocket';
import { useAuth } from '@/context/AuthContext';
import {
  Layers,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Database,
  Plus,
  ChevronDown,
  ChevronUp,
  Edit3,
  Trash2,
  FolderPlus,
} from 'lucide-react';

interface HostMetric {
  cpuUsage: number;
  ramUsedMb: number;
  ramTotalMb: number;
  diskUsagePct: number;
  networkInKb: number;
  networkOutKb: number;
}

export default function DashboardPage() {
  const [currentTab, setCurrentTab] = useState<NOCNavSection>('OVERVIEW');
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [dbKey, setDbKey] = useState(0);
  const [selectedMonitor, setSelectedMonitor] = useState<Monitor | null>(null);
  const [hostMetrics, setHostMetrics] = useState<HostMetric | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [editingGroupName, setEditingGroupName] = useState<string | null>(null);
  const [newGroupNameInput, setNewGroupNameInput] = useState('');
  const [deleteGroupTargetName, setDeleteGroupTargetName] = useState<string | null>(null);

  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [targetGroupForNewService, setTargetGroupForNewService] = useState<string | undefined>(undefined);
  const [registeredGroups, setRegisteredGroups] = useState<{ id: string; name: string }[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  const handleRenameGroup = async (oldName: string) => {
    if (!newGroupNameInput.trim() || newGroupNameInput.trim() === oldName) {
      setEditingGroupName(null);
      return;
    }
    try {
      const res = await authFetch('/api/monitors/groups/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldName, newName: newGroupNameInput.trim() }),
      });
      if (res.ok) {
        setEditingGroupName(null);
        setNewGroupNameInput('');
        fetchMonitors();
        fetchGroups();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const confirmDeleteGroup = async (groupName: string) => {
    try {
      const res = await authFetch(`/api/groups/${encodeURIComponent(groupName)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchMonitors();
        fetchGroups();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Dynamically group monitors by group field (including registered empty groups)
  const groupedMonitors = (() => {
    const acc: Record<string, Monitor[]> = {};
    registeredGroups.forEach((g) => {
      acc[g.name] = [];
    });
    if (Object.keys(acc).length === 0 && monitors.length === 0) {
      acc['Home DC'] = [];
    }
    monitors.forEach((m) => {
      const gName = m.group || 'Home DC';
      if (!acc[gName]) acc[gName] = [];
      acc[gName].push(m);
    });
    return acc;
  })();

  // Telemetry Sparkline Buffers
  const [cpuHistory, setCpuHistory] = useState<number[]>([12, 18, 15, 24, 14, 28, 19, 12, 22, 14, 18, 12.4]);
  const [netRxHistory, setNetRxHistory] = useState<number[]>([40, 80, 50, 120, 90, 150, 110, 143.2]);
  const [netTxHistory, setNetTxHistory] = useState<number[]>([10, 25, 15, 45, 20, 35, 28, 32.6]);
  const [diskReadHistory, setDiskReadHistory] = useState<number[]>([0, 0, 0, 10, 0, 0, 0, 0]);
  const [diskWriteHistory, setDiskWriteHistory] = useState<number[]>([2, 5, 3, 40, 12, 6, 8, 7.2]);

  const { socket } = useSocket();
  const { user, authFetch } = useAuth();

  const fetchGroups = async () => {
    try {
      const res = await authFetch('/api/groups');
      if (res.ok) {
        const data = await res.json();
        setRegisteredGroups(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMonitors = async () => {
    try {
      const res = await authFetch('/api/monitors');
      if (res.ok) {
        const data = await res.json();
        setMonitors(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchHostHistory = async () => {
    try {
      const res = await authFetch('/api/metrics/history?limit=1');
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          setHostMetrics(data[0]);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchMonitors();
      fetchGroups();
      fetchHostHistory();
    }
  }, [user]);

  useEffect(() => {
    if (!socket) return;

    socket.on('metrics:host', (data: HostMetric) => {
      setHostMetrics(data);
      setCpuHistory((prev) => [...prev.slice(-15), data.cpuUsage]);
      setNetRxHistory((prev) => [...prev.slice(-15), data.networkInKb]);
      setNetTxHistory((prev) => [...prev.slice(-15), data.networkOutKb]);
      setDiskWriteHistory((prev) => [...prev.slice(-15), data.diskUsagePct]);
    });

    socket.on('monitors:heartbeat', (data) => {
      setMonitors((prev) =>
        prev.map((m) => {
          if (m.id === data.monitorId) {
            const newHb = {
              id: `${Date.now()}`,
              status: data.status,
              latencyMs: data.latencyMs,
              statusCode: data.statusCode,
              timestamp: data.timestamp,
            };
            const updated = {
              ...m,
              currentStatus: data.status,
              uptimePercent24h: data.uptimePercent24h ?? m.uptimePercent24h,
              heartbeats: [newHb, ...m.heartbeats.slice(0, 29)],
            };
            if (selectedMonitor && selectedMonitor.id === m.id) {
              setSelectedMonitor(updated as Monitor);
            }
            return updated as Monitor;
          }
          return m;
        }),
      );
    });

    return () => {
      socket.off('metrics:host');
      socket.off('monitors:heartbeat');
    };
  }, [socket, selectedMonitor]);

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const confirmDeleteMonitor = async (id: string) => {
    try {
      const res = await authFetch(`/api/monitors/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setMonitors((prev) => prev.filter((m) => m.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteMonitor = (id: string) => {
    setDeleteTargetId(id);
  };

  if (!user) return null;

  // Metric Computations
  const totalServices = monitors.length;
  const onlineServices = monitors.filter((m) => m.currentStatus === 'UP').length;
  const offlineServices = monitors.filter((m) => m.currentStatus === 'DOWN').length;
  const avgLatency = monitors.length > 0
    ? Math.round(monitors.reduce((acc, m) => acc + (m.heartbeats[0]?.latencyMs || 0), 0) / (monitors.length || 1))
    : 0;

  const ramUsedGb = hostMetrics ? (hostMetrics.ramUsedMb / 1024).toFixed(1) : '0.8';
  const ramTotalGb = hostMetrics ? (hostMetrics.ramTotalMb / 1024).toFixed(1) : '4.0';
  const ramPct = hostMetrics && hostMetrics.ramTotalMb > 0 ? Math.round((hostMetrics.ramUsedMb / hostMetrics.ramTotalMb) * 100) : 20;
  const diskPct = hostMetrics ? Math.round(hostMetrics.diskUsagePct) : 14;

  const handleSelectTab = (tab: NOCNavSection) => {
    setCurrentTab(tab);
    setSelectedMonitor(null);
    setSelectedGroup(null);
  };

  return (
    <div className="flex min-h-screen bg-[#0B0F19] text-slate-100 font-sans">
      {/* Persistent Left Sidebar */}
      <Sidebar currentTab={currentTab} onSelectTab={handleSelectTab} />

      {/* Main Operations Canvas */}
      <main className="flex-1 overflow-y-auto min-w-0 p-6 md:p-8 space-y-6">
        {/* Top Header & Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
              NETWORK OPERATIONS CENTER
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mt-0.5">
              {currentTab === 'OVERVIEW' && 'Overview'}
              {currentTab === 'SERVICES' && 'Services'}
              {currentTab === 'DATABASES' && 'Databases'}
              {currentTab === 'INCIDENTS' && 'Incidents Log'}
              {currentTab === 'IPMANAGEMENT' && 'IP Management'}
              {currentTab === 'MTBACKUP' && 'MT Backup Vault'}
              {currentTab === 'ALERTS' && 'Alert Integration Channels'}
              {currentTab === 'USERS' && 'User Access Directory'}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Manage and monitor your network infrastructure in real-time.
            </p>
          </div>

          {/* Context-Aware Action Buttons */}
          <div className="flex items-center gap-3">
            {currentTab === 'SERVICES' && (
              <button
                onClick={() => setIsGroupModalOpen(true)}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4.5 py-2 rounded-xl font-semibold text-xs shadow-lg shadow-indigo-600/30 transition"
              >
                <FolderPlus className="w-4 h-4" /> Add Group
              </button>
            )}

            {currentTab === 'DATABASES' && (
              <button
                onClick={() => setIsDbModalOpen(true)}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4.5 py-2 rounded-xl font-semibold text-xs shadow-lg shadow-purple-600/30 transition"
              >
                <Plus className="w-4 h-4" /> Add Database Connection
              </button>
            )}
          </div>
        </div>

        {selectedMonitor ? (
          <ServiceDetailView
            monitor={selectedMonitor}
            onBack={() => setSelectedMonitor(null)}
          />
        ) : selectedGroup ? (
          <GroupDetailView
            groupName={selectedGroup}
            monitors={monitors}
            onBack={() => setSelectedGroup(null)}
            onSelectMonitor={(m) => setSelectedMonitor(m)}
            onDeleteMonitor={handleDeleteMonitor}
            isReadOnly={currentTab === 'OVERVIEW'}
          />
        ) : (
          <>
            {currentTab === 'OVERVIEW' && (
              <div className="space-y-6">
                {/* Top 5 KPI Summary Row */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  <div className="bg-[#121829] border border-[#1E2640] p-4 rounded-2xl flex items-center justify-between shadow-sm">
                    <div>
                      <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                        TOTAL SERVICES
                      </div>
                      <div className="text-2xl font-extrabold text-white font-mono mt-1">
                        {totalServices}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 text-slate-300">
                      <Layers className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="bg-[#121829] border border-[#1E2640] p-4 rounded-2xl flex items-center justify-between shadow-sm">
                    <div>
                      <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                        ONLINE
                      </div>
                      <div className="text-2xl font-extrabold text-emerald-400 font-mono mt-1">
                        {onlineServices}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="bg-[#121829] border border-[#1E2640] p-4 rounded-2xl flex items-center justify-between shadow-sm">
                    <div>
                      <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                        OFFLINE
                      </div>
                      <div className="text-2xl font-extrabold text-rose-400 font-mono mt-1">
                        {offlineServices}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="bg-[#121829] border border-[#1E2640] p-4 rounded-2xl flex items-center justify-between shadow-sm">
                    <div>
                      <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                        AVG LATENCY
                      </div>
                      <div className="text-2xl font-extrabold text-amber-400 font-mono mt-1">
                        {avgLatency}ms
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                      <Zap className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="bg-[#121829] border border-[#1E2640] p-4 rounded-2xl flex items-center justify-between shadow-sm col-span-2 sm:col-span-1">
                    <div>
                      <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                        DATA CENTERS
                      </div>
                      <div className="text-2xl font-extrabold text-indigo-400 font-mono mt-1">
                        {Object.keys(groupedMonitors).length}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                      <Database className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                {/* Middle Section: Server Info + Memory Arc + Storage Arc */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
                  <div className="lg:col-span-4">
                    <ServerInfoCard />
                  </div>
                  <div className="lg:col-span-4">
                    <CircularGauge
                      title="MEMORY"
                      percentage={ramPct}
                      usedLabel={`${ramUsedGb} / ${ramTotalGb} GB`}
                      type="memory"
                    />
                  </div>
                  <div className="lg:col-span-4">
                    <CircularGauge
                      title="STORAGE (/)"
                      percentage={diskPct}
                      usedLabel="3.5 / 24.4 GB"
                      type="storage"
                    />
                  </div>
                </div>

                {/* Bottom Section: Sparkline Waveforms */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <TelemetrySparkline
                    title="CPU USAGE"
                    type="cpu"
                    currentValue={`${hostMetrics ? hostMetrics.cpuUsage : 12.4}%`}
                    data={cpuHistory}
                  />

                  <TelemetrySparkline
                    title="NETWORK I/O"
                    type="network"
                    badgeLabel={`↓ ${hostMetrics ? hostMetrics.networkInKb : 143.2} KB/s  ↑ ${hostMetrics ? hostMetrics.networkOutKb : 32.6} KB/s`}
                    legend1={{ label: 'RX', color: '#10B981' }}
                    legend2={{ label: 'TX', color: '#F59E0B' }}
                    data1={netRxHistory}
                    data2={netTxHistory}
                  />

                  <TelemetrySparkline
                    title="DISK I/O"
                    type="disk"
                    badgeLabel="R: 0 B/s  W: 7.2 MB/s"
                    legend1={{ label: 'Read', color: '#F97316' }}
                    legend2={{ label: 'Write', color: '#EF4444' }}
                    data1={diskReadHistory}
                    data2={diskWriteHistory}
                  />
                </div>

                {/* Dynamically Grouped Service Data Center Cards (Read-Only Monitoring) */}
                {Object.keys(groupedMonitors).length === 0 ? (
                  <div className="bg-[#121829] border border-[#1E2640] rounded-2xl p-8 text-center text-slate-500 font-mono text-xs shadow-sm">
                    No custom services registered.
                  </div>
                ) : (
                  Object.entries(groupedMonitors).map(([groupName, groupMonitors]) => {
                    const isCollapsed = !!collapsedGroups[groupName];
                    const groupUpCount = groupMonitors.filter((m) => m.currentStatus === 'UP').length;
                    return (
                      <div key={groupName} className="bg-[#121829] border border-[#1E2640] rounded-2xl overflow-hidden shadow-sm">
                        <div className="flex items-center justify-between p-4 bg-[#161C2E]/40 border-b border-[#1E2640]/80">
                          <div
                            onClick={() => setSelectedGroup(groupName)}
                            className="flex items-center gap-3 cursor-pointer group/gtitle"
                          >
                            <div className="w-3 h-3 rounded-full bg-indigo-500 animate-pulse" />
                            <h3 className="font-bold text-sm text-slate-100 group-hover/gtitle:text-indigo-300 transition flex items-center gap-2">
                              {groupName}
                              <span className="text-xs font-mono font-normal text-slate-400 bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700/60">
                                {groupMonitors.length} {groupMonitors.length === 1 ? 'service' : 'services'} ({groupUpCount} UP)
                              </span>
                            </h3>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSelectedGroup(groupName)}
                              className="text-xs font-mono text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 px-2.5 py-1 rounded-lg transition"
                            >
                              View Group Studio →
                            </button>
                            <button onClick={() => toggleGroup(groupName)} className="text-slate-400 hover:text-white">
                              {isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>

                        {!isCollapsed && (
                          <div className="p-5">
                            {groupMonitors.length === 0 ? (
                              <div className="text-center py-6 text-slate-500 text-xs font-mono border border-dashed border-[#1E2640] rounded-xl">
                                No services registered in &quot;{groupName}&quot; yet.
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 gap-4">
                                {groupMonitors.map((m) => (
                                  <MonitorCard
                                    key={m.id}
                                    monitor={m}
                                    onSelect={(item) => setSelectedMonitor(item)}
                                    isReadOnly={true}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* SERVICES TAB */}
            {currentTab === 'SERVICES' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-100">Registered Services Workspace</h2>
                    <p className="text-xs text-slate-400">Click any service to view probe logs and latency traceback</p>
                  </div>
                </div>

                {Object.keys(groupedMonitors).length === 0 ? (
                  <div className="bg-[#121829] border border-[#1E2640] rounded-2xl p-8 text-center text-slate-500 font-mono text-xs shadow-sm">
                    No custom services registered. Click &quot;+ Add Group&quot; or &quot;+ Add Service&quot; above.
                  </div>
                ) : (
                  Object.entries(groupedMonitors).map(([groupName, groupMonitors]) => {
                    const isCollapsed = !!collapsedGroups[groupName];
                    const groupUpCount = groupMonitors.filter((m) => m.currentStatus === 'UP').length;
                    return (
                      <div key={groupName} className="bg-[#121829] border border-[#1E2640] rounded-2xl overflow-hidden shadow-sm space-y-3">
                        <div
                          onClick={() => toggleGroup(groupName)}
                          className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#161C2E] transition border-b border-[#1E2640]/80"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-indigo-500 animate-pulse" />
                            {editingGroupName === groupName ? (
                              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="text"
                                  value={newGroupNameInput}
                                  onChange={(e) => setNewGroupNameInput(e.target.value)}
                                  className="bg-slate-900 border border-indigo-500 rounded-lg px-2.5 py-1 text-xs text-white font-mono focus:outline-none"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleRenameGroup(groupName)}
                                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded-lg text-xs font-mono font-bold transition shadow-md shadow-indigo-600/30"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingGroupName(null)}
                                  className="text-slate-400 hover:text-white text-xs font-mono px-1"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <h3
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedGroup(groupName);
                                }}
                                className="font-bold text-sm text-slate-100 hover:text-indigo-300 transition cursor-pointer flex items-center gap-2"
                                title="Click to open Group Telemetry Studio"
                              >
                                {groupName}
                                <span className="text-xs font-mono font-normal text-slate-400 bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700/60">
                                  {groupMonitors.length} {groupMonitors.length === 1 ? 'service' : 'services'} ({groupUpCount} UP)
                                </span>
                              </h3>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {editingGroupName !== groupName && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTargetGroupForNewService(groupName);
                                    setIsServiceModalOpen(true);
                                  }}
                                  className="flex items-center gap-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition"
                                  title={`Add new service inside ${groupName}`}
                                >
                                  <Plus className="w-3.5 h-3.5" /> Add Service
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingGroupName(groupName);
                                    setNewGroupNameInput(groupName);
                                  }}
                                  className="p-1 text-slate-500 hover:text-indigo-400 rounded transition"
                                  title="Rename Group Name"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteGroupTargetName(groupName);
                                  }}
                                  className="p-1 text-slate-500 hover:text-rose-400 rounded transition"
                                  title="Delete Group & Assigned Services"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            <button className="text-slate-400 hover:text-white">
                              {isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>

                        {!isCollapsed && (
                          <div className="p-5 pt-0">
                            {groupMonitors.length === 0 ? (
                              <div className="text-center py-6 text-slate-500 text-xs font-mono border border-dashed border-[#1E2640] rounded-xl">
                                No services registered in &quot;{groupName}&quot; yet. Click &quot;+ Add Service&quot; above to configure target.
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 gap-4">
                                {groupMonitors.map((m) => (
                                  <MonitorCard
                                    key={m.id}
                                    monitor={m}
                                    onDelete={handleDeleteMonitor}
                                    onSelect={(item) => setSelectedMonitor(item)}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {currentTab === 'DATABASES' && <DatabasesView key={dbKey} />}

            {currentTab === 'INCIDENTS' && <IncidentsView />}

            {currentTab === 'IPMANAGEMENT' && <IpManagementView />}

            {currentTab === 'MTBACKUP' && <MtBackupView />}

            {currentTab === 'ALERTS' && <AlertChannelsView />}

            {currentTab === 'USERS' && <UserManagement />}
          </>
        )}
      </main>

      {/* Add Group Modal */}
      <AddGroupModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        onSuccess={() => {
          fetchGroups();
          fetchMonitors();
        }}
      />

      {/* Add Service Modal */}
      <AddMonitorModal
        isOpen={isServiceModalOpen}
        defaultGroup={targetGroupForNewService}
        onClose={() => {
          setIsServiceModalOpen(false);
          setTargetGroupForNewService(undefined);
        }}
        onSuccess={fetchMonitors}
      />

      {/* Add Database Connection Modal */}
      <AddDatabaseModal
        isOpen={isDbModalOpen}
        onClose={() => setIsDbModalOpen(false)}
        onSuccess={() => setDbKey((prev) => prev + 1)}
      />

      {/* Custom NOC Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={() => deleteTargetId && confirmDeleteMonitor(deleteTargetId)}
        title="Delete Service Probe Target"
        description="Are you sure you want to delete this service probe target? Active monitoring and historical telemetry logs for this service will be permanently purged."
      />

      {/* Delete Group Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteGroupTargetName}
        onClose={() => setDeleteGroupTargetName(null)}
        onConfirm={() => deleteGroupTargetName && confirmDeleteGroup(deleteGroupTargetName)}
        title="Delete Service Group & Assigned Targets"
        description={`Are you sure you want to delete service group "${deleteGroupTargetName}" and all assigned targets? Active monitoring and historical telemetry logs for all services in this group will be permanently purged.`}
      />
    </div>
  );
}