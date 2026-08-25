// frontend/src/components/AlertChannelsView.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import { Bell, Send, Trash2, Plus, CheckCircle2, MessageSquare, Bot } from 'lucide-react';

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

export default function AlertChannelsView() {
  const [channels, setChannels] = useState<AlertChannel[]>([]);
  const [loading, setLoading] = useState(true);
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

  const { authFetch } = useAuth();

  const fetchChannels = async () => {
    try {
      const res = await authFetch('/api/alerts/channels');
      if (res.ok) {
        const data = await res.json();
        setChannels(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChannels();
  }, []);

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
        setName('');
        setWebhookUrl('');
        setChatId('');
        setBotToken('');
        setShowAddForm(false);
        fetchChannels();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDeleteChannel = async (id: string) => {
    try {
      const res = await authFetch(`/api/alerts/channels/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setChannels((prev) => prev.filter((item) => item.id !== id));
      }
    } catch (err) {
      console.error(err);
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
      if (res.ok) {
        setTestStatus((prev) => ({ ...prev, [id]: 'Sent Successfully! Check your app.' }));
      } else {
        setTestStatus((prev) => ({ ...prev, [id]: 'Failed to send test alert.' }));
      }
    } catch (err) {
      setTestStatus((prev) => ({ ...prev, [id]: 'Error triggering test.' }));
    }
    setTimeout(() => {
      setTestStatus((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }, 4000);
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 p-5 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">Alert Dispatch Integration</h2>
            <p className="text-xs text-slate-400">
              Configure Discord webhooks and Telegram Bots for instant downtime notifications
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-lg shadow-indigo-600/20 transition self-start md:self-auto"
        >
          <Plus className="w-4 h-4" /> {showAddForm ? 'Cancel' : 'Add Alert Channel'}
        </button>
      </div>

      {/* Form Card */}
      {showAddForm && (
        <form onSubmit={handleCreate} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
            <Plus className="w-4 h-4 text-indigo-400" /> New Alert Destination
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Channel Label</label>
              <input
                type="text"
                required
                placeholder="e.g. #devops-critical-alerts"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Channel Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="DISCORD">Discord Webhook</option>
                <option value="TELEGRAM">Telegram Bot</option>
              </select>
            </div>
          </div>

          {type === 'DISCORD' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Discord Webhook URL</label>
              <input
                type="url"
                required
                placeholder="https://discord.com/api/webhooks/..."
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-indigo-500"
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Bot Token (Optional)</label>
                <input
                  type="text"
                  placeholder="123456789:ABCdefGhIJK..."
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Register Integration'}
            </button>
          </div>
        </form>
      )}

      {/* Channels List */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 font-mono text-sm">
          Loading Alert Integrations...
        </div>
      ) : channels.length === 0 ? (
        <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-12 text-center text-slate-500">
          <p>No alert destinations registered. Click &quot;Add Alert Channel&quot; to hook Discord or Telegram!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {channels.map((channel) => (
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
                    <h3 className="font-bold text-slate-100">{channel.name}</h3>
                    <span className="text-[10px] font-mono uppercase bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md">
                      {channel.type}
                    </span>
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
                    <span className="text-amber-400 animate-pulse">{testStatus[channel.id]}</span>
                  ) : (
                    `Registered ${new Date(channel.createdAt).toLocaleDateString()}`
                  )}
                </span>
                <button
                  onClick={() => handleTestAlert(channel.id)}
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                >
                  <Send className="w-3.5 h-3.5 text-indigo-400" /> Send Test Alert
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
