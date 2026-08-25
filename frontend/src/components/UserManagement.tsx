// frontend/src/components/UserManagement.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import { Users, UserPlus, Shield, Trash2, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'OPERATOR';
  createdAt: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'OPERATOR'>('OPERATOR');
  const [submitting, setSubmitting] = useState(false);

  const { authFetch, user: currentUser } = useAuth();

  const fetchUsers = async () => {
    try {
      const res = await authFetch('/api/auth/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await authFetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to create user');
      }

      setName('');
      setEmail('');
      setPassword('');
      setRole('OPERATOR');
      setShowAddForm(false);
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleRole = async (userId: string, currentRole: 'ADMIN' | 'OPERATOR') => {
    const newRole = currentRole === 'ADMIN' ? 'OPERATOR' : 'ADMIN';
    setError(null);
    try {
      const res = await authFetch(`/api/auth/users/${userId}/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update user role');
      }
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const confirmDeleteUser = async (id: string) => {
    setError(null);
    try {
      const res = await authFetch(`/api/auth/users/${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to delete user');
      }

      setUsers((prev) => prev.filter((item) => item.id !== id));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteUserId(id);
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 p-5 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">NOC Access Control & User Directory</h2>
            <p className="text-xs text-slate-400">
              Only registered operators created by System Administrators can log in to PulseNOC
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-lg shadow-indigo-600/20 transition self-start md:self-auto"
        >
          <UserPlus className="w-4 h-4" /> {showAddForm ? 'Cancel' : 'Register Operator'}
        </button>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3.5 flex items-center gap-3 text-rose-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Register Form */}
      {showAddForm && (
        <form onSubmit={handleCreate} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-indigo-400" /> Provision New Operator Credentials
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Full Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Alex Rivera"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Operator Email</label>
              <input
                type="email"
                required
                placeholder="arivera@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Initial Security Password</label>
              <input
                type="password"
                required
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Access Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="OPERATOR">OPERATOR (Standard Monitoring Access)</option>
                <option value="ADMIN">ADMIN (Full Security & User Management)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-50"
            >
              {submitting ? 'Provisioning...' : 'Grant Access & Save'}
            </button>
          </div>
        </form>
      )}

      {/* Directory Table */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 font-mono text-sm">
          Loading User Access Directory...
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 text-xs font-mono uppercase">
                <tr>
                  <th className="px-5 py-3.5">Operator Name</th>
                  <th className="px-5 py-3.5">Email Address</th>
                  <th className="px-5 py-3.5">Role Level</th>
                  <th className="px-5 py-3.5">Provisioned Date</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {users.map((u) => {
                  const isCurrent = currentUser?.id === u.id;
                  const isAdmin = u.role === 'ADMIN';
                  return (
                    <tr key={u.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-5 py-4 font-semibold text-slate-100 flex items-center gap-2">
                        <span>{u.name}</span>
                        {isCurrent && (
                          <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded font-mono">
                            YOU
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-slate-300 font-mono text-xs">{u.email}</td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => handleToggleRole(u.id, u.role)}
                          className={`inline-flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase px-3 py-1 rounded-full border transition hover:scale-105 cursor-pointer ${
                            isAdmin
                              ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 hover:bg-purple-500/30'
                              : 'bg-sky-500/20 text-sky-300 border-sky-500/40 hover:bg-sky-500/30'
                          }`}
                          title="Click to toggle Role Level (ADMIN ↔ OPERATOR)"
                        >
                          <Shield className="w-3 h-3" /> {u.role} &crarr;
                        </button>
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-400 font-mono">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => handleDelete(u.id)}
                          disabled={isCurrent}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition disabled:opacity-30 disabled:hover:text-slate-500"
                          title={isCurrent ? 'Cannot delete your own active session' : 'Revoke Operator Access'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Revoke User Access Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteUserId}
        onClose={() => setDeleteUserId(null)}
        onConfirm={() => deleteUserId && confirmDeleteUser(deleteUserId)}
        title="Revoke Operator Access"
        description="Are you sure you want to revoke access for this operator user? Their login token and system privileges will be immediately revoked."
      />
    </div>
  );
}
