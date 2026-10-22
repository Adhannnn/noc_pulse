// frontend/src/components/DockerLogsView.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getWsBaseUrl } from '@/lib/api-config';
import {
  Box,
  Terminal,
  Search,
  RefreshCw,
  Play,
  Pause,
  Download,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Radio,
} from 'lucide-react';

export interface ContainerInfo {
  id: string;
  names: string[];
  image: string;
  state: string;
  status: string;
  created: number;
}

export default function DockerLogsView() {
  const { authFetch } = useAuth();
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<ContainerInfo | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [filterText, setFilterText] = useState('');
  const [containerSearch, setContainerSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [loadingContainers, setLoadingContainers] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [reconnectKey, setReconnectKey] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  const fetchContainers = async () => {
    setLoadingContainers(true);
    try {
      const res = await authFetch('/api/docker/containers');
      if (res.ok) {
        const data = await res.json();
        const validList: ContainerInfo[] = Array.isArray(data) ? data : [];
        setContainers(validList);
        if (validList.length > 0) {
          // If no container selected or selected container no longer exists, select first
          setSelectedContainer((prev) => {
            if (prev && validList.some((c) => c.id === prev.id)) {
              return validList.find((c) => c.id === prev.id) || validList[0];
            }
            return validList[0];
          });
        } else {
          setSelectedContainer(null);
        }
      }
    } catch (err) {
      console.error('Failed to load containers', err);
    } finally {
      setLoadingContainers(false);
    }
  };

  useEffect(() => {
    fetchContainers();
  }, []);

  // Connect WebSocket to stream logs when selectedContainer or reconnectKey changes
  useEffect(() => {
    if (!selectedContainer) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsStreaming(false);
      return;
    }

    setLogs([]);
    setIsStreaming(true);

    const baseWsUrl = getWsBaseUrl();
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('pulsenoc_token') || localStorage.getItem('token') || ''
        : '';
    const wsUrl = `${baseWsUrl.replace(/^http/, 'ws')}/api/docker/containers/${selectedContainer.id}/logs?tail=250&token=${encodeURIComponent(token)}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsStreaming(true);
    };

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
      wsRef.current = null;
    };
  }, [selectedContainer?.id, reconnectKey]);

  // Handle auto-scroll
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const toggleStreaming = () => {
    if (isStreaming && wsRef.current) {
      wsRef.current.close();
      setIsStreaming(false);
    } else {
      setReconnectKey((prev) => prev + 1);
    }
  };

  const handleDownloadLogs = () => {
    const blob = new Blob([logs.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const name = selectedContainer?.names?.[0] || selectedContainer?.id || 'container';
    a.download = `${name}-logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const safeContainers = Array.isArray(containers) ? containers : [];
  const filteredContainers = safeContainers.filter((c) => {
    const term = containerSearch.toLowerCase();
    const name = (c.names?.[0] || '').toLowerCase();
    const img = (c.image || '').toLowerCase();
    const id = (c.id || '').toLowerCase();
    return name.includes(term) || img.includes(term) || id.includes(term);
  });

  const filteredLogs = logs.filter((line) =>
    filterText ? line.toLowerCase().includes(filterText.toLowerCase()) : true,
  );

  return (
    <div className="space-y-6 font-sans">
      {/* Workspace Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#121829] border border-[#1E2640] p-5 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Box className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Docker Containers & Live Stream</h2>
            <p className="text-xs text-slate-400">
              Select any container from the fleet to inspect real-time log output and runtime health
            </p>
          </div>
        </div>

        <button
          onClick={fetchContainers}
          className="flex items-center gap-2 bg-[#161C2E] hover:bg-[#1E2640] border border-[#2B3555] text-slate-300 px-4 py-2 rounded-xl text-xs font-semibold font-mono transition self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${loadingContainers ? 'animate-spin' : ''}`} /> Refresh Fleet
        </button>
      </div>

      {/* Main Two-Pane Layout */}
      <div className="grid grid-cols-12 gap-6 min-h-[600px]">
        {/* Left Pane: Container Selector */}
        <div className="col-span-12 md:col-span-4 lg:col-span-3 bg-[#121829] border border-[#1E2640] rounded-2xl p-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Box className="w-4 h-4 text-sky-400" /> Containers ({safeContainers.length})
              </span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search container..."
                value={containerSearch}
                onChange={(e) => setContainerSearch(e.target.value)}
                className="w-full bg-[#090C16] border border-[#1E2640] rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>

            <div className="space-y-1.5 overflow-y-auto max-h-[500px] pr-1">
              {loadingContainers ? (
                <div className="p-8 text-center text-slate-500 font-mono text-xs">
                  Discovering containers...
                </div>
              ) : filteredContainers.length === 0 ? (
                <div className="p-8 text-center text-slate-500 font-mono text-xs">
                  No containers found.
                </div>
              ) : (
                filteredContainers.map((c) => {
                  const isSelected = selectedContainer?.id === c.id;
                  const isRunning = c.state === 'running';
                  const primaryName = c.names?.[0] || c.id;

                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedContainer(c)}
                      className={`w-full text-left p-3 rounded-xl text-xs font-mono transition border ${
                        isSelected
                          ? 'bg-sky-500/10 border-sky-500/50 text-white shadow-sm'
                          : 'bg-[#090C16] border-[#1E2640]/60 text-slate-300 hover:bg-[#161C2E] hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold truncate text-slate-100">{primaryName}</span>
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isRunning ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-rose-500'
                          }`}
                        />
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-1">{c.image}</div>
                      <div className="flex items-center justify-between text-[9px] text-slate-500 mt-2 font-mono">
                        <span>ID: {c.id}</span>
                        <span className="uppercase">{c.state}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Pane: Live Console Canvas */}
        <div className="col-span-12 md:col-span-8 lg:col-span-9 bg-[#121829] border border-[#1E2640] rounded-2xl p-5 flex flex-col justify-between">
          {!selectedContainer ? (
            <div className="flex flex-col items-center justify-center h-full p-12 text-center text-slate-500 font-mono space-y-3">
              <Terminal className="w-10 h-10 text-slate-600" />
              <p className="text-sm font-semibold text-slate-400">Select a container on the left</p>
              <p className="text-xs">Live log streams and telemetry output will display here.</p>
            </div>
          ) : (
            <div className="flex flex-col h-full space-y-4">
              {/* Header Container Banner */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#1E2640] pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    <Terminal className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white text-base font-mono">
                        {selectedContainer.names?.[0] || selectedContainer.id}
                      </h3>
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase border ${
                          selectedContainer.state === 'running'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                        }`}
                      >
                        {selectedContainer.state}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      Image: <span className="text-sky-300">{selectedContainer.image}</span> • ID:{' '}
                      <span className="text-slate-300">{selectedContainer.id}</span>
                    </p>
                  </div>
                </div>

                {/* Connection Status Badge & Reconnect */}
                <div className="flex items-center gap-3 self-start md:self-auto">
                  <div className="flex items-center gap-2 bg-[#090C16] border border-[#1E2640] px-3 py-1.5 rounded-xl text-xs font-mono">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isStreaming
                          ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]'
                          : 'bg-rose-500'
                      }`}
                    />
                    <span className={isStreaming ? 'text-emerald-400 font-semibold' : 'text-rose-400'}>
                      {isStreaming ? 'STREAMING' : 'DISCONNECTED'}
                    </span>
                  </div>

                  {!isStreaming && (
                    <button
                      onClick={toggleStreaming}
                      className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Reconnect
                    </button>
                  )}
                </div>
              </div>

              {/* Toolbar Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#090C16] p-2.5 rounded-xl border border-[#1E2640] text-xs font-mono">
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Filter logs in stream..."
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    className="bg-transparent border-none text-slate-200 focus:outline-none w-full text-xs font-mono"
                  />
                  {filterText && (
                    <button
                      onClick={() => setFilterText('')}
                      className="text-slate-500 hover:text-white"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleStreaming}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition font-semibold ${
                      isStreaming
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
                    }`}
                  >
                    {isStreaming ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    {isStreaming ? 'Pause' : 'Resume'}
                  </button>

                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-slate-200 select-none">
                    <input
                      type="checkbox"
                      checked={autoScroll}
                      onChange={(e) => setAutoScroll(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-0"
                    />
                    <span>Auto-scroll</span>
                  </label>

                  <button
                    onClick={() => setLogs([])}
                    className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-[#161C2E] transition"
                    title="Clear console"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={handleDownloadLogs}
                    className="flex items-center gap-1 bg-[#161C2E] hover:bg-slate-800 text-slate-300 border border-[#2B3555] px-2.5 py-1 rounded-lg transition"
                    title="Download Logs"
                  >
                    <Download className="w-3 h-3 text-sky-400" /> Export
                  </button>
                </div>
              </div>

              {/* Console Canvas Output */}
              <div
                ref={logContainerRef}
                className="flex-1 bg-[#070913] border border-[#1E2640] rounded-xl p-4 font-mono text-xs overflow-y-auto max-h-[520px] min-h-[400px] text-slate-300 space-y-0.5 select-text shadow-inner"
              >
                {filteredLogs.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-slate-600 font-mono text-xs italic">
                    {isStreaming
                      ? 'Connected. Waiting for incoming container logs...'
                      : 'No log output recorded.'}
                  </div>
                ) : (
                  filteredLogs.map((log, index) => {
                    const isError = /err|fail|fatal|exception/i.test(log);
                    const isWarn = /warn/i.test(log);

                    return (
                      <div
                        key={index}
                        className={`leading-relaxed whitespace-pre-wrap break-all ${
                          isError
                            ? 'text-rose-400 bg-rose-950/20 px-1 rounded'
                            : isWarn
                            ? 'text-amber-300'
                            : 'text-slate-300'
                        }`}
                      >
                        {log}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
