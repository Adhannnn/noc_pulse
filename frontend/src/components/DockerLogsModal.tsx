// frontend/src/components/DockerLogsModal.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getWsBaseUrl } from '@/lib/api-config';
import {
  X,
  Terminal,
  Search,
  RefreshCw,
  Play,
  Pause,
  Download,
  Trash2,
  Box,
  Layers,
} from 'lucide-react';

interface ContainerInfo {
  id: string;
  names: string[];
  image: string;
  state: string;
  status: string;
  created: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function DockerLogsModal({ isOpen, onClose }: Props) {
  const { authFetch } = useAuth();
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [filterText, setFilterText] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [loadingContainers, setLoadingContainers] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  const fetchContainers = async () => {
    setLoadingContainers(true);
    try {
      const res = await authFetch('/api/docker/containers');
      if (res.ok) {
        const data: ContainerInfo[] = await res.json();
        setContainers(data || []);
        if (data.length > 0 && !selectedContainer) {
          setSelectedContainer(data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load containers', err);
    } finally {
      setLoadingContainers(false);
    }
  };

  // Fetch containers on modal open
  useEffect(() => {
    if (!isOpen) return;
    fetchContainers();
  }, [isOpen]);

  // Connect WebSocket to stream logs when selectedContainer changes
  useEffect(() => {
    if (!isOpen || !selectedContainer) {
      if (wsRef.current) {
        wsRef.current.close();
      }
      return;
    }

    setLogs([]);
    setIsStreaming(true);

    const baseWsUrl = getWsBaseUrl();
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('pulsenoc_token') || localStorage.getItem('token') || ''
        : '';
    const wsUrl = `${baseWsUrl.replace(/^http/, 'ws')}/api/docker/containers/${selectedContainer}/logs?tail=200&token=${encodeURIComponent(token)}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      setLogs((prev) => [...prev.slice(-1000), event.data]);
    };

    ws.onclose = () => {
      setIsStreaming(false);
    };

    ws.onerror = () => {
      setIsStreaming(false);
    };

    return () => {
      ws.close();
    };
  }, [isOpen, selectedContainer]);

  // Handle auto-scroll
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  if (!isOpen) return null;

  const filteredLogs = logs.filter((line) =>
    filterText ? line.toLowerCase().includes(filterText.toLowerCase()) : true
  );

  const handleDownloadLogs = () => {
    const blob = new Blob([logs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedContainer}-logs.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-[#090C16] border border-[#1E2640] rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E2640] bg-[#0D1222]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Docker Live Log Streamer
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  NOC STREAM
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Direct kernel socket tailing across all laptop microservices and Docker containers.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-[#1E2640] bg-[#070A14]">
          {/* Container Select Dropdown */}
          <div className="flex items-center gap-2">
            <Box className="w-4 h-4 text-slate-400" />
            <select
              value={selectedContainer}
              onChange={(e) => setSelectedContainer(e.target.value)}
              className="bg-[#121829] border border-[#1E2640] text-slate-200 text-xs font-mono rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500"
            >
              {containers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.names.join(', ') || c.id} ({c.state})
                </option>
              ))}
            </select>

            <button
              onClick={fetchContainers}
              disabled={loadingContainers}
              title="Refresh containers list"
              className="p-1.5 rounded-lg bg-[#121829] border border-[#1E2640] text-slate-400 hover:text-slate-200 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingContainers ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Controls: Search, AutoScroll, Download, Clear */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter logs..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="bg-[#121829] border border-[#1E2640] text-slate-200 text-xs font-mono rounded-lg pl-8 pr-3 py-1.5 w-44 md:w-56 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-mono font-semibold rounded-lg border transition ${
                autoScroll
                  ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                  : 'bg-[#121829] border-[#1E2640] text-slate-400'
              }`}
            >
              {autoScroll ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              {autoScroll ? 'Auto-scroll On' : 'Paused'}
            </button>

            <button
              onClick={handleDownloadLogs}
              title="Download Logs"
              className="p-1.5 rounded-lg bg-[#121829] border border-[#1E2640] text-slate-400 hover:text-slate-200 transition"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setLogs([])}
              title="Clear Console"
              className="p-1.5 rounded-lg bg-[#121829] border border-[#1E2640] text-rose-400 hover:bg-rose-500/10 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Terminal Screen */}
        <div
          ref={logContainerRef}
          className="flex-1 bg-[#05070E] p-4 overflow-y-auto font-mono text-xs text-slate-300 select-text leading-relaxed"
        >
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-600 space-y-2">
              <Layers className="w-8 h-8 opacity-40 animate-pulse" />
              <p>Waiting for incoming logs from container...</p>
            </div>
          ) : (
            filteredLogs.map((line, idx) => {
              const isError = /error|err|fail|fatal|panic|exception/i.test(line);
              const isWarn = /warn|warning/i.test(line);
              return (
                <div
                  key={idx}
                  className={`py-0.5 px-1 rounded hover:bg-slate-900/60 transition whitespace-pre-wrap ${
                    isError
                      ? 'text-rose-400 bg-rose-950/20 font-semibold'
                      : isWarn
                      ? 'text-amber-300 bg-amber-950/15'
                      : 'text-slate-300'
                  }`}
                >
                  {line}
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-6 py-2.5 border-t border-[#1E2640] bg-[#070A14] flex items-center justify-between text-[11px] font-mono text-slate-500">
          <div className="flex items-center gap-3">
            <span>Container ID: <span className="text-slate-300">{selectedContainer || '-'}</span></span>
            <span>Total lines: <span className="text-slate-300">{logs.length}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-emerald-400' : 'bg-rose-500'}`} />
            <span>{isStreaming ? 'STREAMING ACTIVE' : 'DISCONNECTED'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
