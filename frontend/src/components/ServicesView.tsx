// frontend/src/components/ServicesView.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import MonitorCard, { Monitor, SSLCertificateInfo } from '@/components/MonitorCard';
import AddMonitorModal from '@/components/AddMonitorModal';
import AddGroupModal from '@/components/AddGroupModal';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import ServiceDetailView from '@/components/ServiceDetailView';
import GroupDetailView from '@/components/GroupDetailView';
import { useSocket } from '@/hooks/useSocket';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  Plus,
  FolderPlus,
  Edit3,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface HeartbeatWsPayload {
  monitorId: string;
  status: 'UP' | 'DOWN' | 'DEGRADED';
  latencyMs: number;
  statusCode?: number;
  timestamp: string;
  uptimePercent24h?: number;
  sslCert?: SSLCertificateInfo;
}

export default function ServicesView() {
  const toast = useToast();
  const { socket } = useSocket();
  const { user, authFetch } = useAuth();

  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [registeredGroups, setRegisteredGroups] = useState<{ id: string; name: string }[]>([]);
  const [selectedMonitor, setSelectedMonitor] = useState<Monitor | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [targetGroupForNewService, setTargetGroupForNewService] = useState<string | undefined>(undefined);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);

  const [editingGroupName, setEditingGroupName] = useState<string | null>(null);
  const [newGroupNameInput, setNewGroupNameInput] = useState('');
  const [deleteGroupTargetName, setDeleteGroupTargetName] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  const fetchGroups = useCallback(async () => {
    try {
      const res = await authFetch('/api/groups');
      if (res.ok) {
        const data = await res.json();
        setRegisteredGroups(Array.isArray(data) ? data : []);
      }
    } catch (err: unknown) {
      console.error('Failed to fetch groups:', err);
    }
  }, [authFetch]);

  const fetchMonitors = useCallback(async () => {
    try {
      const res = await authFetch('/api/monitors');
      if (res.ok) {
        const data: Monitor[] = await res.json();
        const normalized = (data || []).map((m) => ({
          ...m,
          heartbeats: Array.isArray(m.heartbeats) ? m.heartbeats : [],
        }));
        setMonitors(normalized);
      }
    } catch (err: unknown) {
      console.error('Failed to fetch monitors:', err);
    }
  }, [authFetch]);

  useEffect(() => {
    if (user) {
      fetchMonitors();
      fetchGroups();
    }
  }, [user, fetchMonitors, fetchGroups]);

  useEffect(() => {
    if (!socket) return;

    socket.on('monitors:heartbeat', (data: HeartbeatWsPayload) => {
      setMonitors((prev) =>
        prev.map((m) => {
          if (m.id === data.monitorId) {
            if (m.currentStatus !== data.status) {
              if (data.status === 'DOWN') {
                toast.error(`🚨 OUTAGE: ${m.name} is DOWN!`);
              } else if (data.status === 'UP' && (m.currentStatus === 'DOWN' || m.currentStatus === 'DEGRADED')) {
                toast.success(`✅ RECOVERY: ${m.name} is back UP!`);
              }
            }

            const newHb = {
              id: `${Date.now()}`,
              status: data.status,
              latencyMs: data.latencyMs,
              statusCode: data.statusCode,
              timestamp: data.timestamp,
            };
            const updated: Monitor = {
              ...m,
              currentStatus: data.status,
              uptimePercent24h: data.uptimePercent24h ?? m.uptimePercent24h,
              sslCert: data.sslCert || m.sslCert,
              heartbeats: [newHb, ...(m.heartbeats || []).slice(0, 29)],
            };
            if (selectedMonitor && selectedMonitor.id === m.id) {
              setSelectedMonitor(updated);
            }
            return updated;
          }
          return m;
        }),
      );
    });

    return () => {
      socket.off('monitors:heartbeat');
    };
  }, [socket, selectedMonitor, toast]);

  const handleRenameGroup = async (oldName: string) => {
    if (!newGroupNameInput.trim() || newGroupNameInput.trim() === oldName) {
      setEditingGroupName(null);
      return;
    }
    const newName = newGroupNameInput.trim();
    try {
      const res = await authFetch('/api/monitors/groups/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldName, newName }),
      });
      if (res.ok) {
        toast.success(`Group renamed to "${newName}" successfully`);
        setEditingGroupName(null);
        setNewGroupNameInput('');
        fetchMonitors();
        fetchGroups();
      } else {
        const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
        toast.error(data.message || data.error || 'Failed to rename group');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error renaming group';
      toast.error(message);
    }
  };

  const confirmDeleteGroup = async (groupName: string) => {
    try {
      const res = await authFetch(`/api/groups/${encodeURIComponent(groupName)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success(`Service group "${groupName}" deleted successfully`);
        fetchMonitors();
        fetchGroups();
      } else {
        const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
        toast.error(data.message || data.error || 'Failed to delete service group');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error deleting group';
      toast.error(message);
    }
  };

  const confirmDeleteMonitor = async (id: string) => {
    try {
      const res = await authFetch(`/api/monitors/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('Service probe target removed successfully');
        setMonitors((prev) => prev.filter((m) => m.id !== id));
      } else {
        const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
        toast.error(data.message || data.error || 'Failed to delete service probe');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error deleting service probe';
      toast.error(message);
    }
  };

  const handleDeleteMonitor = (id: string) => {
    setDeleteTargetId(id);
  };

  const groupedMonitors = (() => {
    const acc: Record<string, Monitor[]> = {};
    (registeredGroups || []).forEach((g) => {
      acc[g.name] = [];
    });
    (monitors || []).forEach((m) => {
      const gName = m.group || 'Default';
      if (!acc[gName]) acc[gName] = [];
      acc[gName].push(m);
    });
    return acc;
  })();

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
            NETWORK OPERATIONS CENTER
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mt-0.5">
            Services
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage service endpoints, configure TCP/HTTP probers, and manage target groups.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsGroupModalOpen(true)}
            className="flex items-center gap-2 bg-[#161C2E] hover:bg-[#1E2640] border border-[#2B3555] text-slate-200 px-4 py-2 rounded-xl font-semibold text-xs transition"
          >
            <FolderPlus className="w-4 h-4 text-indigo-400" /> Add Group
          </button>
          <button
            onClick={() => {
              setTargetGroupForNewService(undefined);
              setIsServiceModalOpen(true);
            }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-semibold text-xs shadow-lg shadow-indigo-600/30 transition"
          >
            <Plus className="w-4 h-4" /> Add Service
          </button>
        </div>
      </div>

      {/* Main View Render */}
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
          isReadOnly={false}
        />
      ) : (
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

      {/* Modals */}
      <AddGroupModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        onSuccess={() => {
          fetchGroups();
          fetchMonitors();
        }}
      />

      <AddMonitorModal
        isOpen={isServiceModalOpen}
        defaultGroup={targetGroupForNewService}
        onClose={() => {
          setIsServiceModalOpen(false);
          setTargetGroupForNewService(undefined);
        }}
        onSuccess={fetchMonitors}
      />

      <ConfirmDeleteModal
        isOpen={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={() => deleteTargetId && confirmDeleteMonitor(deleteTargetId)}
        title="Delete Service Probe Target"
        description="Are you sure you want to delete this service probe target? Active monitoring and historical telemetry logs for this service will be permanently purged."
      />

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
