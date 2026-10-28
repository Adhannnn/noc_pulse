// frontend/src/components/AlertChannelsView.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import {
  Bell,
  Send,
  Trash2,
  Plus,
  MessageSquare,
  Bot,
  Sliders,
  Cpu,
  HardDrive,
  Thermometer,
  Clock,
  ShieldAlert,
  Save,
  RefreshCw,
  Zap,
} from 'lucide-react';

export interface AlertChannel {
  id: string;
  name: string;
  type: 'DISCORD' | 'TELEGRAM';
  webhookUrl?: string;
  chatId?: string;
  botToken?: string;
  isEnabled: boolean;
  createdAt: string;
}

export interface AlertThresholds {
  id?: string;
  cpuPercent: number;
  ramPercent: number;
  diskPercent: number;
  cpuTempC: number;
  latencyMs: number;
  cooldownMins: number;
  isEnabled: boolean;
  updatedAt?: string;
}

const DEFAULT_THRESHOLDS: AlertThresholds = {
  cpuPercent: 85,
  ramPercent: 90,
  diskPercent: 90,
  cpuTempC: 80,
  latencyMs: 1000,
  cooldownMins: 5,
  isEnabled: true,
};

export default function AlertChannelsView() {
  const [channels, setChannels] = useState<AlertChannel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [testStatus, setTestStatus] = useState<Record<string, string>>({});
  const [deleteChannelId, setDeleteChannelId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState<'DISCORD' | 'TELEGRAM'>('DISCORD');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [chatId, setChatId] = useState('');
  const [botToken, setBotToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [preflightTesting, setPreflightTesting] = useState(false);

  // Thresholds State
  const [thresholds, setThresholds] = useState<AlertThresholds>(DEFAULT_THRESHOLDS);
  const [loadingThresholds, setLoadingThresholds] = useState(true);
  const [savingThresholds, setSavingThresholds] = useState(false);

  const { authFetch } = useAuth();
  const toast = useToast();

  const fetchChannels = useCallback(async () => {
    try {
      const res = await authFetch('/api/alerts/channels');
      if (res.ok) {
        const data = await res.json();
        setChannels(Array.isArray(data) ? data : []);
      }
    } catch (err: unknown) {
      console.error('Failed to load alert channels:', err);
    } finally {
      setLoadingChannels(false);
    }
  }, [authFetch]);

  const fetchThresholds = useCallback(async () => {
    try {
      const res = await authFetch('/api/alerts/thresholds');
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.cpuPercent === 'number') {
          setThresholds(data);
        }
      }
    } catch (err: unknown) {
      console.error('Failed to load alert thresholds:', err);
    } finally {
      setLoadingThresholds(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchChannels();
    fetchThresholds();
  }, [fetchChannels, fetchThresholds]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await authFetch('/api/alerts/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          type,
          webhookUrl: type === 'DISCORD' ? webhookUrl : undefined,
          chatId: type === 'TELEGRAM' ? chatId : undefined,
          botToken: type === 'TELEGRAM' ? botToken : undefined,
        }),
      });

      if (res.ok) {
        toast.success(`Alert channel "${name}" configured successfully`);
        setName('');
        setWebhookUrl('');
        setChatId('');
        setBotToken('');
        setShowAddForm(false);
        fetchChannels();
      } else {
        const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
        toast.error(data.message || data.error || 'Failed to configure alert channel');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creating alert channel';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePreflightTest = async () => {
    if (type === 'DISCORD' && !webhookUrl) {
      toast.error('Please enter a Discord Webhook URL first');
      return;
    }
    if (type === 'TELEGRAM' && (!chatId || !botToken)) {
      toast.error('Please enter both Telegram Chat ID and Bot Token to test');
      return;
    }

    setPreflightTesting(true);
    try {
      const res = await authFetch('/api/alerts/test-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          webhookUrl: type === 'DISCORD' ? webhookUrl : undefined,
          chatId: type === 'TELEGRAM' ? chatId : undefined,
          botToken: type === 'TELEGRAM' ? botToken : undefined,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string; error?: string };
      if (res.ok && data.success) {
        toast.success(data.message || 'Diagnostic test message received by target!');
      } else {
        toast.error(data.error || 'Diagnostic test failed. Check webhook URL or bot credentials.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network failure during pre-flight test';
      toast.error(msg);
    } finally {
      setPreflightTesting(false);
    }
  };

  const confirmDeleteChannel = async (id: string) => {
    try {
      const res = await authFetch(`/api/alerts/channels/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('Alert channel removed successfully');
        setChannels((prev) => prev.filter((item) => item.id !== id));
      } else {
        const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
        toast.error(data.message || data.error || 'Failed to delete alert channel');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error deleting alert channel';
      toast.error(msg);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteChannelId(id);
  };

  const handleTestAlert = async (id: string) => {
    setTestStatus((prev) => ({ ...prev, [id]: 'Sending...' }));
    try {
      const res = await authFetch(`/api/alerts/channels/${id}/test`, {
        method: 'POST',
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string; error?: string };
      if (res.ok && data.success) {
        setTestStatus((prev) => ({ ...prev, [id]: 'Dispatched' }));
        toast.success(data.message || 'Test notification dispatched successfully');
      } else {
        setTestStatus((prev) => ({ ...prev, [id]: 'Failed' }));
        toast.error(data.error || 'Failed to dispatch test notification');
      }
    } catch (err: unknown) {
      setTestStatus((prev) => ({ ...prev, [id]: 'Error' }));
      const msg = err instanceof Error ? err.message : 'Error triggering test alert';
      toast.error(msg);
    }
    setTimeout(() => {
      setTestStatus((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }, 4000);
  };

  const handleSaveThresholds = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingThresholds(true);
    try {
      const res = await authFetch('/api/alerts/thresholds', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(thresholds),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string; error?: string };
      if (res.ok && data.success) {
        toast.success(data.message || 'Alert thresholds updated successfully');
      } else {
        toast.error(data.error || 'Failed to save alert thresholds');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save threshold configuration';
      toast.error(msg);
    } finally {
      setSavingThresholds(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* SECTION 1: ALERT CHANNELS & DESTINATIONS */}
      <div className="space-y-4">
        {/* View Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100">Alert Dispatch Integration</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {channels.length} {channels.length === 1 ? 'CHANNEL' : 'CHANNELS'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Configure Discord webhooks and Telegram Bots for real-time incident broadcast & telemetry alerts
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-lg shadow-indigo-600/20 transition self-start md:self-auto"
          >
            <Plus className="w-4 h-4" /> {showAddForm ? 'Cancel' : 'Add Alert Destination'}
          </button>
        </div>

        {/* Form Card */}
        {showAddForm && (
          <form onSubmit={handleCreate} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" /> New Alert Destination
              </h3>
              <span className="text-xs font-mono text-slate-500">PROACTIVE TELEMETRY HOOK</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Channel Label</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. #noc-incident-feed"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Channel Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as 'DISCORD' | 'TELEGRAM')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                >
                  <option value="DISCORD">Discord Webhook</option>
                  <option value="TELEGRAM">Telegram Bot Channel</option>
                </select>
              </div>
            </div>

            {type === 'DISCORD' ? (
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Discord Webhook URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://discord.com/api/webhooks/1234567890/..."
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Telegram Chat ID</label>
                  <input
                    type="text"
                    required
                    placeholder="-100123456789"
                    value={chatId}
                    onChange={(e) => setChatId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Bot Token</label>
                  <input
                    type="text"
                    required
                    placeholder="123456789:ABCdefGhIJK..."
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
              <button
                type="button"
                onClick={handlePreflightTest}
                disabled={preflightTesting}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-4 py-2 rounded-xl text-xs font-semibold font-mono border border-slate-700 transition disabled:opacity-50"
              >
                {preflightTesting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                ) : (
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                )}
                {preflightTesting ? 'Testing Diagnostic...' : 'Test Pre-Flight Dispatch'}
              </button>

              <div className="w-full sm:w-auto flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl text-xs font-semibold transition disabled:opacity-50"
                >
                  {submitting ? 'Registering...' : 'Register Integration'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Channels List */}
        {loadingChannels ? (
          <div className="p-12 text-center text-slate-500 font-mono text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" /> Loading Alert Integrations...
          </div>
        ) : !channels || channels.length === 0 ? (
          <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-12 text-center text-slate-500">
            <p className="text-sm">No alert destinations registered. Click &quot;Add Alert Destination&quot; to hook Discord or Telegram!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(channels || []).map((channel) => (
              <div
                key={channel.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 hover:border-slate-700 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-xl ${
                        channel.type === 'DISCORD'
                          ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                          : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                      }`}
                    >
                      {channel.type === 'DISCORD' ? (
                        <MessageSquare className="w-5 h-5" />
                      ) : (
                        <Bot className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-100 text-sm">{channel.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-mono uppercase bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md">
                          {channel.type}
                        </span>
                        <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          ONLINE
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(channel.id)}
                    className="p-2 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                    title="Delete Channel"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 text-xs text-slate-400 font-mono truncate">
                  {channel.type === 'DISCORD' ? channel.webhookUrl : `Chat ID: ${channel.chatId}`}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-500 font-mono">
                    {testStatus[channel.id] ? (
                      <span className="text-amber-400 animate-pulse font-semibold">
                        {testStatus[channel.id]}
                      </span>
                    ) : (
                      `ID: ${channel.id}`
                    )}
                  </span>
                  <button
                    onClick={() => handleTestAlert(channel.id)}
                    className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition"
                  >
                    <Send className="w-3.5 h-3.5 text-indigo-400" /> Send Test Alert
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: PROACTIVE THRESHOLDS & ANOMALY DETECTION */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">Anomaly Triggers & Alert Thresholds</h3>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold border ${
                    thresholds.isEnabled
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  }`}
                >
                  {thresholds.isEnabled ? 'EVALUATION ACTIVE' : 'EVALUATION PAUSED'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Proactive anomaly detection triggers alerts to all connected channels before critical system outages occur
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800">
              <input
                type="checkbox"
                checked={thresholds.isEnabled}
                onChange={(e) => setThresholds({ ...thresholds, isEnabled: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-0 bg-slate-900 border-slate-700 cursor-pointer"
              />
              <span className="text-xs font-mono font-semibold text-slate-300">Master Alert Engine</span>
            </label>
          </div>
        </div>

        {loadingThresholds ? (
          <div className="p-12 text-center text-slate-500 font-mono text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-amber-500" /> Loading Anomaly Detection Configuration...
          </div>
        ) : (
          <form onSubmit={handleSaveThresholds} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* CPU Warning */}
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-300 font-semibold text-xs">
                    <Cpu className="w-4 h-4 text-indigo-400" />
                    <span>Host CPU Utilization</span>
                  </div>
                  <span className="text-sm font-mono font-bold text-indigo-400">
                    {thresholds.cpuPercent}%
                  </span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="99"
                  step="1"
                  value={thresholds.cpuPercent}
                  onChange={(e) => setThresholds({ ...thresholds, cpuPercent: Number(e.target.value) })}
                  className="w-full accent-indigo-500 bg-slate-800 rounded-lg cursor-pointer h-2"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>Normal &lt; 50%</span>
                  <span>Alert &gt;= {thresholds.cpuPercent}%</span>
                </div>
              </div>

              {/* RAM Warning */}
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-300 font-semibold text-xs">
                    <HardDrive className="w-4 h-4 text-sky-400" />
                    <span>Host RAM Allocation</span>
                  </div>
                  <span className="text-sm font-mono font-bold text-sky-400">
                    {thresholds.ramPercent}%
                  </span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="99"
                  step="1"
                  value={thresholds.ramPercent}
                  onChange={(e) => setThresholds({ ...thresholds, ramPercent: Number(e.target.value) })}
                  className="w-full accent-sky-500 bg-slate-800 rounded-lg cursor-pointer h-2"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>Normal &lt; 50%</span>
                  <span>Alert &gt;= {thresholds.ramPercent}%</span>
                </div>
              </div>

              {/* Disk Warning */}
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-300 font-semibold text-xs">
                    <HardDrive className="w-4 h-4 text-emerald-400" />
                    <span>Disk Storage Partition</span>
                  </div>
                  <span className="text-sm font-mono font-bold text-emerald-400">
                    {thresholds.diskPercent}%
                  </span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="98"
                  step="1"
                  value={thresholds.diskPercent}
                  onChange={(e) => setThresholds({ ...thresholds, diskPercent: Number(e.target.value) })}
                  className="w-full accent-emerald-500 bg-slate-800 rounded-lg cursor-pointer h-2"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>Safe Space &lt; 50%</span>
                  <span>Alert &gt;= {thresholds.diskPercent}%</span>
                </div>
              </div>

              {/* CPU Thermals */}
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-300 font-semibold text-xs">
                    <Thermometer className="w-4 h-4 text-rose-400" />
                    <span>CPU Core Temperature</span>
                  </div>
                  <span className="text-sm font-mono font-bold text-rose-400">
                    {thresholds.cpuTempC} °C
                  </span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="105"
                  step="1"
                  value={thresholds.cpuTempC}
                  onChange={(e) => setThresholds({ ...thresholds, cpuTempC: Number(e.target.value) })}
                  className="w-full accent-rose-500 bg-slate-800 rounded-lg cursor-pointer h-2"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>Ambient ~50°C</span>
                  <span>Thermal Warning &gt;= {thresholds.cpuTempC}°C</span>
                </div>
              </div>

              {/* Service Latency */}
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-300 font-semibold text-xs">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span>Response Latency Ceiling</span>
                  </div>
                  <span className="text-sm font-mono font-bold text-amber-400">
                    {thresholds.latencyMs} ms
                  </span>
                </div>
                <input
                  type="range"
                  min="200"
                  max="5000"
                  step="50"
                  value={thresholds.latencyMs}
                  onChange={(e) => setThresholds({ ...thresholds, latencyMs: Number(e.target.value) })}
                  className="w-full accent-amber-500 bg-slate-800 rounded-lg cursor-pointer h-2"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>Target &lt; 250ms</span>
                  <span>Slow Breach &gt;= {thresholds.latencyMs}ms</span>
                </div>
              </div>

              {/* Cooldown Buffer */}
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-300 font-semibold text-xs">
                    <ShieldAlert className="w-4 h-4 text-purple-400" />
                    <span>Anti-Flap Cooldown</span>
                  </div>
                  <span className="text-sm font-mono font-bold text-purple-400">
                    {thresholds.cooldownMins} mins
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="60"
                  step="1"
                  value={thresholds.cooldownMins}
                  onChange={(e) => setThresholds({ ...thresholds, cooldownMins: Number(e.target.value) })}
                  className="w-full accent-purple-500 bg-slate-800 rounded-lg cursor-pointer h-2"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>Fast Repeat (1m)</span>
                  <span>Quiet Buffer ({thresholds.cooldownMins}m)</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
              <div className="text-[11px] font-mono text-slate-500">
                {thresholds.updatedAt ? `Last configured: ${new Date(thresholds.updatedAt).toLocaleString()}` : 'Default operational policy active'}
              </div>

              <button
                type="submit"
                disabled={savingThresholds}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-semibold text-xs font-mono shadow-lg shadow-indigo-600/20 transition disabled:opacity-50"
              >
                {savingThresholds ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {savingThresholds ? 'Saving Configuration...' : 'Apply Alert Policy'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Delete Alert Channel Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteChannelId}
        onClose={() => setDeleteChannelId(null)}
        onConfirm={() => deleteChannelId && confirmDeleteChannel(deleteChannelId)}
        title="Delete Alert Channel Integration"
        description="Are you sure you want to delete this alert dispatch channel? Operational alerts and downtime notifications will no longer be routed to this channel."
      />
    </div>
  );
}