// frontend/src/components/IpManagementView.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import { Layers, Network, Plus, CheckCircle2, Server, Trash2 } from 'lucide-react';

export interface IpRecord {
  id: string;
  ip: string;
  subnet: string;
  hostname?: string;
  status: string;
  assignedTo?: string;
  lastPingMs?: number;
}

export default function IpManagementView() {
  const [ipRecords, setIpRecords] = useState<IpRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [ip, setIp] = useState('');
  const [hostname, setHostname] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [deleteIpId, setDeleteIpId] = useState<string | null>(null);

  const { authFetch } = useAuth();

  const fetchIpRecords = async () => {
    try {
      const res = await authFetch('/api/ip-management');
      if (res.ok) {
        const data = await res.json();
        setIpRecords(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIpRecords();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await authFetch('/api/ip-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip,
          subnet: '192.168.203.0/24',
          hostname: hostname || undefined,
          assignedTo: assignedTo || undefined,
          status: 'ACTIVE',
        }),
      });
      if (res.ok) {
        setIp('');
        setHostname('');
        setAssignedTo('');
        setShowAddForm(false);
        fetchIpRecords();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const confirmDeleteIp = async (id: string) => {
    try {
      const res = await authFetch(`/api/ip-management/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setIpRecords((prev) => prev.filter((item) => item.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteIpId(id);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#121829] border border-[#1E2640] p-5 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">NOC IP Address Management (IPAM)</h2>
            <p className="text-xs text-slate-400">
              Subnet allocation tracking for subnet <code className="text-cyan-300">192.168.203.0/24</code>
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl font-semibold text-xs shadow-lg shadow-indigo-600/20 transition self-start md:self-auto"
        >
          <Plus className="w-4 h-4" /> {showAddForm ? 'Cancel' : 'Allocate New IP'}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleCreate} className="bg-[#121829] border border-[#1E2640] rounded-2xl p-6 space-y-4">
          <h3 className="font-bold text-slate-100 text-xs font-mono uppercase">
            Allocate IP Address
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">IP Address</label>
              <input
                type="text"
                required
                placeholder="192.168.203.160"
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                className="w-full bg-[#090C16] border border-[#1E2640] rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Hostname (FQDN)</label>
              <input
                type="text"
                placeholder="node-02.pulsenoc.local"
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                className="w-full bg-[#090C16] border border-[#1E2640] rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Assigned Device / Service</label>
              <input
                type="text"
                placeholder="Worker Node 02"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full bg-[#090C16] border border-[#1E2640] rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl text-xs font-semibold transition"
            >
              Save IP Allocation
            </button>
          </div>
        </form>
      )}

      {/* IP Table */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 font-mono text-xs">
          Loading IP Address Pool...
        </div>
      ) : (
        <div className="bg-[#121829] border border-[#1E2640] rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#090C16] border-b border-[#1E2640] text-slate-400 uppercase text-[10px]">
              <tr>
                <th className="px-5 py-3.5">IP Address</th>
                <th className="px-5 py-3.5">Subnet</th>
                <th className="px-5 py-3.5">Hostname</th>
                <th className="px-5 py-3.5">Assigned Target</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2640]/60 text-slate-200">
              {ipRecords.map((rec) => (
                <tr key={rec.id} className="hover:bg-[#161C2E] transition">
                  <td className="px-5 py-3.5 font-bold text-cyan-400">{rec.ip}</td>
                  <td className="px-5 py-3.5 text-slate-400">{rec.subnet}</td>
                  <td className="px-5 py-3.5 text-slate-300">{rec.hostname || '-'}</td>
                  <td className="px-5 py-3.5 text-slate-200">{rec.assignedTo || 'Unassigned'}</td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        rec.status === 'GATEWAY'
                          ? 'bg-purple-500/20 text-purple-400'
                          : rec.status === 'ACTIVE'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {rec.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => handleDelete(rec.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 rounded transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete IP Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteIpId}
        onClose={() => setDeleteIpId(null)}
        onConfirm={() => deleteIpId && confirmDeleteIp(deleteIpId)}
        title="Remove IP Address Allocation"
        description="Are you sure you want to remove this IP address from the active subnet pool? Device assignment and routing records for this IP will be unlinked."
      />
    </div>
  );
}
