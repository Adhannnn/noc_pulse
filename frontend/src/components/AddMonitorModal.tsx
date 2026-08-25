// frontend/src/components/AddMonitorModal.tsx
'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultGroup?: string;
}

export default function AddMonitorModal({ isOpen, onClose, onSuccess, defaultGroup }: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState('HTTP');
  const [url, setUrl] = useState('');
  const [port, setPort] = useState('');
  const [group, setGroup] = useState(defaultGroup || 'Home DC');

  React.useEffect(() => {
    if (defaultGroup) {
      setGroup(defaultGroup);
    }
  }, [defaultGroup]);
  const [intervalSec, setIntervalSec] = useState(30);
  const [loading, setLoading] = useState(false);
  const { authFetch } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await authFetch('/api/monitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          type,
          url: url || undefined,
          port: port ? parseInt(port, 10) : undefined,
          group: group || 'Home DC',
          intervalSec: Number(intervalSec),
        }),
      });

      if (res.ok) {
        setName('');
        setUrl('');
        setPort('');
        setGroup('Home DC');
        onSuccess();
        onClose();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg">Add New Service</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Name</label>
            <input
              type="text"
              required
              placeholder="e.g. My Production API"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Group</label>
            <input
              type="text"
              disabled
              list="existing-groups-list"
              placeholder="e.g. Home DC, Production Cluster, Edge Gateway"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 font-mono"
            />
            <datalist id="existing-groups-list">
              <option value="Home DC" />
              <option value="Production Cluster" />
              <option value="Database Nodes" />
              <option value="Edge Gateway" />
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="HTTP">HTTP / HTTPS</option>
              <option value="TCP">TCP Port</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              {type === 'HTTP' ? 'URL' : 'Host / IP Address'}
            </label>
            <input
              type="text"
              required
              placeholder={type === 'HTTP' ? 'https://api.domain.com/health' : '192.168.1.1'}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          {type === 'TCP' && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Port</label>
              <input
                type="number"
                required
                placeholder="5432"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-400">Check Interval (Seconds)</label>
              <div className="flex items-center gap-1">
                {[10, 30, 60, 300].map((sec) => (
                  <button
                    type="button"
                    key={sec}
                    onClick={() => setIntervalSec(sec)}
                    className={`px-2 py-0.5 text-[10px] font-mono rounded font-semibold transition ${
                      intervalSec === sec
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </div>
            <input
              type="number"
              min="10"
              max="3600"
              value={intervalSec}
              onChange={(e) => setIntervalSec(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white transition disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Save Monitor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}