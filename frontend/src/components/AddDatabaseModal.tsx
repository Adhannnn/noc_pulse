// frontend/src/components/AddDatabaseModal.tsx
'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { X, Database, Zap, CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddDatabaseModal({ isOpen, onClose, onSuccess }: Props) {
  const [name, setName] = useState('');
  const [engine, setEngine] = useState('PostgreSQL');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(5432);
  const [database, setDatabase] = useState('postgres');
  const [username, setUsername] = useState('postgres');
  const [password, setPassword] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(false);

  const { authFetch } = useAuth();

  if (!isOpen) return null;

  const handleEngineChange = (newEngine: string) => {
    setEngine(newEngine);
    setTestResult(null);
    if (newEngine === 'PostgreSQL') {
      setPort(5432);
      setDatabase('postgres');
      setUsername('postgres');
    } else if (newEngine === 'MySQL') {
      setPort(3306);
      setDatabase('sys');
      setUsername('root');
    } else if (newEngine === 'Redis') {
      setPort(6379);
      setDatabase('0');
      setUsername('default');
    } else if (newEngine === 'MongoDB') {
      setPort(27017);
      setDatabase('admin');
      setUsername('admin');
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await authFetch('/api/databases/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engine, host, port: Number(port) }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({ success: false, message: 'Failed to connect to database host.' });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await authFetch('/api/databases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          engine,
          host,
          port: Number(port),
          database,
          username,
          password: password || undefined,
        }),
      });

      if (res.ok) {
        setName('');
        setHost('');
        setPassword('');
        setTestResult(null);
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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0D111D] border border-[#1E2640] rounded-2xl w-full max-w-lg p-6 text-slate-100 shadow-2xl space-y-5 font-sans">
        <div className="flex items-center justify-between border-b border-[#1E2640] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Add Database Connection</h3>
              <p className="text-[11px] text-slate-400 font-mono">DBeaver-Style Database Driver Setup</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {testResult && (
          <div
            className={`p-3 rounded-xl border text-xs font-mono flex items-center gap-2.5 ${
              testResult.success
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
          >
            {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{testResult.message}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Database Engine Driver</label>
            <div className="grid grid-cols-4 gap-2">
              {['PostgreSQL', 'MySQL', 'Redis', 'MongoDB'].map((eng) => (
                <button
                  type="button"
                  key={eng}
                  onClick={() => handleEngineChange(eng)}
                  className={`py-2 text-xs font-semibold font-mono rounded-xl border transition ${
                    engine === eng
                      ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30'
                      : 'bg-[#121829] text-slate-400 border-[#1E2640] hover:text-white'
                  }`}
                >
                  {eng}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Connection Label</label>
            <input
              type="text"
              required
              placeholder="e.g. PostgreSQL Primary Cluster"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#121829] border border-[#1E2640] rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500 font-mono"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1">Host / IP Address</label>
              <input
                type="text"
                required
                placeholder="192.168.203.152"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                className="w-full bg-[#121829] border border-[#1E2640] rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Port</label>
              <input
                type="number"
                required
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                className="w-full bg-[#121829] border border-[#1E2640] rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Database Name</label>
              <input
                type="text"
                required
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
                className="w-full bg-[#121829] border border-[#1E2640] rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#121829] border border-[#1E2640] rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Password</label>
            <input
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#121829] border border-[#1E2640] rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500 font-mono"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-[#1E2640]">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing || !host}
              className="flex items-center gap-1.5 bg-[#1E2640] hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-xs font-semibold font-mono transition disabled:opacity-40"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              {testing ? 'Testing Connection...' : 'Test Connection'}
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-500 rounded-xl text-white transition disabled:opacity-50"
              >
                {loading ? 'Connecting...' : 'Save Database'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
