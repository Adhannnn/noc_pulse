// frontend/src/components/SshTerminalView.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '@/hooks/useSocket';
import {
  Terminal as TerminalIcon,
  Play,
  Square,
  RefreshCw,
  Server,
  Lock,
  Key,
  Trash2,
  Maximize2,
  CheckCircle2,
  AlertTriangle,
  Zap,
} from 'lucide-react';

export default function SshTerminalView() {
  const { socket, isConnected } = useSocket();
  const [host, setHost] = useState('192.168.1.10');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('raffa');
  const [authType, setAuthType] = useState<'password' | 'privateKey'>('password');
  const [password, setPassword] = useState('');
  const [privateKey, setPrivateKey] = useState('');

  const [sessionStatus, setSessionStatus] = useState<'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR'>('DISCONNECTED');
  const [statusMessage, setStatusMessage] = useState('');
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [inputBuffer, setInputBuffer] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Dynamic host fallback from window.location
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hostname) {
      setHost(window.location.hostname);
    }
  }, []);

  // Auto-scroll terminal canvas to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [terminalOutput]);

  useEffect(() => {
    if (!socket) return;

    socket.on('ssh:status', (data: { status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR'; message?: string; host?: string }) => {
      if (data.status === 'CONNECTED') {
        setSessionStatus('CONNECTED');
        setStatusMessage(`Connected to ${username}@${data.host || host}`);
        setTerminalOutput((prev) => [
          ...prev,
          `\x1b[32m[PulseNOC SSH] Successfully authenticated to ${username}@${data.host || host}:${port}\x1b[0m\n`,
        ]);
      } else if (data.status === 'ERROR') {
        setSessionStatus('ERROR');
        setStatusMessage(data.message || 'SSH Connection Failed');
        setTerminalOutput((prev) => [
          ...prev,
          `\x1b[31m[PulseNOC SSH ERROR] ${data.message || 'Connection failed'}\x1b[0m\n`,
        ]);
      } else if (data.status === 'DISCONNECTED') {
        setSessionStatus('DISCONNECTED');
        setStatusMessage(data.message || 'SSH Session Ended');
        setTerminalOutput((prev) => [
          ...prev,
          `\x1b[33m[PulseNOC SSH] Connection closed.\x1b[0m\n`,
        ]);
      }
    });

    socket.on('ssh:data', (data: string) => {
      setTerminalOutput((prev) => [...prev, data]);
    });

    return () => {
      socket.off('ssh:status');
      socket.off('ssh:data');
    };
  }, [socket, host, port, username]);

  const handleConnect = () => {
    if (!socket || !isConnected) return;
    if (!host || !username) return;

    setSessionStatus('CONNECTING');
    setStatusMessage('Initiating SSH handshake...');
    setTerminalOutput([
      `[PulseNOC SSH] Connecting to ${username}@${host}:${port}...\n`,
    ]);

    socket.emit('ssh:connect', {
      host: host.trim(),
      port: Number(port) || 22,
      username: username.trim(),
      password: authType === 'password' ? password : undefined,
      privateKey: authType === 'privateKey' ? privateKey : undefined,
    });
  };

  const handleDisconnect = () => {
    if (!socket) return;
    socket.emit('ssh:disconnect');
    setSessionStatus('DISCONNECTED');
    setStatusMessage('SSH Session Terminated');
  };

  const sendCommand = (cmd: string) => {
    if (!socket || sessionStatus !== 'CONNECTED') return;
    socket.emit('ssh:input', { data: cmd + '\n' });
    setCommandHistory((prev) => [...prev, cmd]);
    setHistoryIndex(-1);
    setInputBuffer('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      sendCommand(inputBuffer);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const nextIdx = historyIndex + 1 < commandHistory.length ? historyIndex + 1 : historyIndex;
        setHistoryIndex(nextIdx);
        setInputBuffer(commandHistory[commandHistory.length - 1 - nextIdx] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        setInputBuffer(commandHistory[commandHistory.length - 1 - nextIdx] || '');
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInputBuffer('');
      }
    } else if (e.ctrlKey && e.key === 'c') {
      if (socket && sessionStatus === 'CONNECTED') {
        socket.emit('ssh:input', { data: '\x03' });
      }
    }
  };

  const cleanAnsi = (text: string) => {
    // Simple ANSI escape code stripper for clean dark terminal rendering
    return text.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
  };

  return (
    <div className="space-y-5">
      {/* Top Header Card */}
      <div className="bg-[#121829] border border-[#1E2640] p-6 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <TerminalIcon className="w-5 h-5 text-indigo-400" />
            <h1 className="text-xl font-extrabold text-white tracking-tight font-sans">
              Interactive Web SSH Console
            </h1>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Establish secure encrypted SSH shell sessions directly to server hosts from PulseNOC.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-full border border-slate-800 text-xs font-mono">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                sessionStatus === 'CONNECTED'
                  ? 'bg-emerald-500 animate-pulse'
                  : sessionStatus === 'CONNECTING'
                  ? 'bg-amber-400 animate-spin'
                  : sessionStatus === 'ERROR'
                  ? 'bg-rose-500'
                  : 'bg-slate-600'
              }`}
            />
            <span className="text-slate-300 font-bold">{sessionStatus}</span>
          </div>
        </div>
      </div>

      {/* Connection Form Bar */}
      <div className="bg-[#121829] border border-[#1E2640] p-5 rounded-2xl shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
          {/* Host */}
          <div className="lg:col-span-3 space-y-1">
            <label className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-indigo-400" /> Host IP / Domain
            </label>
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="e.g. 192.168.1.10"
              disabled={sessionStatus === 'CONNECTED' || sessionStatus === 'CONNECTING'}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 disabled:opacity-50"
            />
          </div>

          {/* Port */}
          <div className="lg:col-span-2 space-y-1">
            <label className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
              Port
            </label>
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(Number(e.target.value))}
              placeholder="22"
              disabled={sessionStatus === 'CONNECTED' || sessionStatus === 'CONNECTING'}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 disabled:opacity-50"
            />
          </div>

          {/* Username */}
          <div className="lg:col-span-2 space-y-1">
            <label className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. raffa or root"
              disabled={sessionStatus === 'CONNECTED' || sessionStatus === 'CONNECTING'}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 disabled:opacity-50"
            />
          </div>

          {/* Auth Type */}
          <div className="lg:col-span-2 space-y-1">
            <label className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" /> Auth Mode
            </label>
            <select
              value={authType}
              onChange={(e) => setAuthType(e.target.value as any)}
              disabled={sessionStatus === 'CONNECTED' || sessionStatus === 'CONNECTING'}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 disabled:opacity-50"
            >
              <option value="password">Password</option>
              <option value="privateKey">Private Key (PEM)</option>
            </select>
          </div>

          {/* Password or Key Input */}
          <div className="lg:col-span-3 space-y-1">
            <label className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-emerald-400" /> {authType === 'password' ? 'Password' : 'PEM Key'}
            </label>
            {authType === 'password' ? (
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="SSH Password"
                disabled={sessionStatus === 'CONNECTED' || sessionStatus === 'CONNECTING'}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              />
            ) : (
              <input
                type="password"
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder="Paste -----BEGIN RSA PRIVATE KEY-----"
                disabled={sessionStatus === 'CONNECTED' || sessionStatus === 'CONNECTING'}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              />
            )}
          </div>
        </div>

        {/* Action Button & Status Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
          <div className="text-xs font-mono text-slate-400">
            {statusMessage && (
              <span className={`font-bold ${sessionStatus === 'ERROR' ? 'text-rose-400' : sessionStatus === 'CONNECTED' ? 'text-emerald-400' : 'text-slate-300'}`}>
                {statusMessage}
              </span>
            )}
          </div>

          {sessionStatus === 'CONNECTED' || sessionStatus === 'CONNECTING' ? (
            <button
              onClick={handleDisconnect}
              className="px-5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-mono font-bold text-xs border border-rose-500/30 transition flex items-center gap-2"
            >
              <Square className="w-3.5 h-3.5 fill-current" /> Disconnect Session
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={!isConnected}
              className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-mono font-bold text-xs transition flex items-center gap-2 shadow-lg shadow-indigo-600/20"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> Connect SSH Shell
            </button>
          )}
        </div>
      </div>

      {/* Preset Quick Commands Bar */}
      <div className="flex flex-wrap items-center gap-2 bg-[#121829] border border-[#1E2640] p-3 rounded-2xl text-xs font-mono">
        <span className="text-slate-400 font-bold px-2 flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-400" /> Quick Commands:
        </span>
        <button
          onClick={() => sendCommand('docker ps')}
          disabled={sessionStatus !== 'CONNECTED'}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 disabled:opacity-40 transition"
        >
          docker ps
        </button>
        <button
          onClick={() => sendCommand('htop')}
          disabled={sessionStatus !== 'CONNECTED'}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 disabled:opacity-40 transition"
        >
          htop
        </button>
        <button
          onClick={() => sendCommand('df -h')}
          disabled={sessionStatus !== 'CONNECTED'}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 disabled:opacity-40 transition"
        >
          df -h
        </button>
        <button
          onClick={() => sendCommand('free -h')}
          disabled={sessionStatus !== 'CONNECTED'}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 disabled:opacity-40 transition"
        >
          free -h
        </button>
        <button
          onClick={() => sendCommand('uptime')}
          disabled={sessionStatus !== 'CONNECTED'}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 disabled:opacity-40 transition"
        >
          uptime
        </button>
        <button
          onClick={() => sendCommand('docker logs pulsenoc-backend')}
          disabled={sessionStatus !== 'CONNECTED'}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 disabled:opacity-40 transition"
        >
          docker logs backend
        </button>
        <button
          onClick={() => setTerminalOutput([])}
          className="ml-auto px-3 py-1.5 rounded-lg bg-slate-800/60 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-700/50 transition flex items-center gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" /> Clear Console
        </button>
      </div>

      {/* Terminal Screen Window */}
      <div className="bg-[#080C14] border border-[#1E2640] rounded-2xl shadow-2xl overflow-hidden font-mono text-xs text-slate-200 flex flex-col h-[520px]">
        {/* Terminal Header */}
        <div className="bg-[#0D1322] px-4 py-2.5 border-b border-[#1E2640] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
            <span className="ml-2 text-slate-400 text-[11px] font-bold">
              {username}@{host}:{port} — xterm-256color PTY
            </span>
          </div>

          <div className="text-[11px] text-slate-500 font-mono">
            {sessionStatus === 'CONNECTED' ? 'SSH Ready' : 'Console Idle'}
          </div>
        </div>

        {/* Terminal Output Screen */}
        <div
          ref={outputRef}
          onClick={() => inputRef.current?.focus()}
          className="flex-1 p-4 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed cursor-text selection:bg-indigo-500 selection:text-white"
        >
          {terminalOutput.length === 0 ? (
            <div className="text-slate-600 italic py-10 text-center font-mono">
              Terminal console idle. Enter connection credentials above and click &quot;Connect SSH Shell&quot;.
            </div>
          ) : (
            terminalOutput.map((chunk, idx) => (
              <span key={idx} className="font-mono text-slate-200">
                {cleanAnsi(chunk)}
              </span>
            ))
          )}
        </div>

        {/* Terminal Prompt Input Line */}
        <div className="bg-[#0D1322] px-4 py-3 border-t border-[#1E2640] flex items-center gap-2">
          <span className="text-emerald-400 font-bold select-none">
            {sessionStatus === 'CONNECTED' ? `${username}@${host}:~$` : 'pulsenoc>'}
          </span>
          <input
            ref={inputRef}
            type="text"
            value={inputBuffer}
            onChange={(e) => setInputBuffer(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sessionStatus !== 'CONNECTED'}
            placeholder={sessionStatus === 'CONNECTED' ? 'Type shell command (e.g. ls -la, htop, docker ps)...' : 'Connect SSH session above to type commands...'}
            className="flex-1 bg-transparent text-white font-mono text-xs focus:outline-none placeholder:text-slate-600 disabled:opacity-50"
          />
        </div>
      </div>
    </div>
  );
}
