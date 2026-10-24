// frontend/src/components/SshTerminalView.tsx
'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSocket } from '@/hooks/useSocket';
import {
  Terminal as TerminalIcon,
  Play,
  Square,
  Server,
  Lock,
  Key,
  Trash2,
  Maximize2,
  Minimize2,
  Zap,
  ChevronDown,
  ChevronUp,
  Settings,
  ShieldCheck,
  Radio,
} from 'lucide-react';

interface AnsiSegment {
  text: string;
  className: string;
}

function parseAnsi(text: string): AnsiSegment[] {
  // 1. Strip OSC (Operating System Command) sequences (e.g. \x1b]0;title\x07 or \x1b]0;title\x1b\)
  // and handle edge cases where \x1b was dropped/rendered separately
  const cleanedText = text
    .replace(/\x1b\][0-9]+;[^\x07\x1b]*(\x07|\x1b\\)?/g, '')
    .replace(/\]0;[^\x07\r\n]*\x07/g, '')
    // 2. Strip private modes / bracketed paste / cursor toggles
    .replace(/\x1b\[\?[0-9;]*[a-zA-Z]/g, '')
    // 3. Strip non-color CSI escapes (cursor moves, display/line clear, scrolling)
    .replace(/\x1b\[[0-9;]*[A-HJKSTf]/g, '')
    // 4. Strip character set selections
    .replace(/\x1b\([AB012]/g, '')
    // 5. Strip BEL and NUL characters
    .replace(/[\x00\x07]/g, '');

  const ansiRegex = /\x1b\[([0-9;]*)m/g;
  const segments: AnsiSegment[] = [];
  let lastIndex = 0;
  const currentClasses = new Set<string>();

  // Calibrated, eye-friendly iTerm2 palette (comfortable contrast, no harsh neon glare)
  const colorMap: Record<string, string> = {
    '30': 'text-slate-600',
    '31': 'text-red-400',
    '32': 'text-emerald-400',
    '33': 'text-amber-300',
    '34': 'text-sky-400',
    '35': 'text-purple-400',
    '36': 'text-teal-400',
    '37': 'text-slate-300',
    '90': 'text-slate-500',
    '91': 'text-red-300',
    '92': 'text-emerald-300',
    '93': 'text-amber-200',
    '94': 'text-sky-300',
    '95': 'text-purple-300',
    '96': 'text-teal-300',
    '97': 'text-slate-100',
    '1': 'font-semibold',
    '2': 'opacity-65',
    '3': 'italic',
    '4': 'underline',
  };

  let match: RegExpExecArray | null;
  while ((match = ansiRegex.exec(cleanedText)) !== null) {
    if (match.index > lastIndex) {
      const raw = cleanedText.substring(lastIndex, match.index);
      if (raw) {
        segments.push({
          text: raw,
          className: Array.from(currentClasses).join(' '),
        });
      }
    }

    const codes = match[1] ? match[1].split(';') : ['0'];
    for (const code of codes) {
      if (code === '0' || code === '') {
        currentClasses.clear();
      } else if (colorMap[code]) {
        if (code !== '1' && code !== '2' && code !== '3' && code !== '4') {
          for (const c of Array.from(currentClasses)) {
            if (c.startsWith('text-')) currentClasses.delete(c);
          }
        }
        currentClasses.add(colorMap[code]);
      }
    }

    lastIndex = ansiRegex.lastIndex;
  }

  if (lastIndex < cleanedText.length) {
    const raw = cleanedText.substring(lastIndex);
    if (raw) {
      segments.push({
        text: raw,
        className: Array.from(currentClasses).join(' '),
      });
    }
  }

  return segments;
}

export default function SshTerminalView() {
  const { socket, isConnected } = useSocket();
  const [host, setHost] = useState('192.168.1.10');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('raffa');
  const [authType, setAuthType] = useState<'password' | 'privateKey'>('password');
  const [password, setPassword] = useState('');
  const [privateKey, setPrivateKey] = useState('');

  const [sessionStatus, setSessionStatus] = useState<
    'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR'
  >('DISCONNECTED');
  const [statusMessage, setStatusMessage] = useState('');
  const [tabTitle, setTabTitle] = useState('');
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [inputBuffer, setInputBuffer] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Dynamic host fallback from window.location
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hostname) {
      setHost(window.location.hostname);
    }
  }, []);

  // Auto-scroll terminal canvas to bottom when output or input changes
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [terminalOutput, inputBuffer]);

  useEffect(() => {
    if (!socket) return;

    socket.on(
      'ssh:status',
      (data: { status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR'; message?: string; host?: string }) => {
        if (data.status === 'CONNECTED') {
          setSessionStatus('CONNECTED');
          setStatusMessage(`Connected to ${username}@${data.host || host}`);
          setShowConfig(false);
          setTerminalOutput((prev) => [
            ...prev,
            `\x1b[90m➜ Connected to ${username}@${data.host || host}:${port} (session active)\x1b[0m\r\n`,
          ]);
        } else if (data.status === 'ERROR') {
          setSessionStatus('ERROR');
          setStatusMessage(data.message || 'SSH Connection Failed');
          setShowConfig(true);
          setTerminalOutput((prev) => [
            ...prev,
            `\x1b[31m✖ SSH error: ${data.message || 'Connection failed'}\x1b[0m\r\n`,
          ]);
        } else if (data.status === 'DISCONNECTED') {
          setSessionStatus('DISCONNECTED');
          setStatusMessage(data.message || 'SSH Session Ended');
          setTerminalOutput((prev) => [
            ...prev,
            `\x1b[90m➜ Connection closed by remote host.\x1b[0m\r\n`,
          ]);
        }
      },
    );

    socket.on('ssh:data', (data: string) => {
      // Extract dynamic shell title from OSC sequence if emitted by bash/shell
      const titleMatch = data.match(/\x1b\]0;([^\x07\x1b]+)/);
      if (titleMatch && titleMatch[1]) {
        setTabTitle(titleMatch[1]);
      }

      // Handle screen clear sequences (\x1b[2J, \x1b[3J, \x1bc, \x1b[H\x1b[2J)
      const clearIdx = Math.max(
        data.lastIndexOf('\x1b[2J'),
        data.lastIndexOf('\x1b[3J'),
        data.lastIndexOf('\x1bc')
      );
      if (clearIdx !== -1) {
        setTerminalOutput([data.substring(clearIdx)]);
      } else {
        setTerminalOutput((prev) => [...prev, data]);
      }
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
      `\x1b[90mLast login: ${new Date().toLocaleString()} on ttys001\x1b[0m\r\n` +
        `\x1b[90mConnecting to ${username}@${host}:${port} (xterm-256color PTY)...\x1b[0m\r\n`,
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
    const trimmed = cmd.trim();
    if (trimmed === 'clear' || trimmed === 'cls') {
      setTerminalOutput([]);
    }
    socket.emit('ssh:input', { data: cmd + '\n' });
    setCommandHistory((prev) => [...prev, cmd]);
    setHistoryIndex(-1);
    setInputBuffer('');
    inputRef.current?.focus();
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
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (socket && sessionStatus === 'CONNECTED') {
        socket.emit('ssh:input', { data: '\t' });
      }
    } else if (e.ctrlKey && e.key === 'c') {
      if (socket && sessionStatus === 'CONNECTED') {
        socket.emit('ssh:input', { data: '\x03' });
      }
    } else if ((e.ctrlKey && e.key === 'l') || (e.metaKey && e.key === 'k')) {
      e.preventDefault();
      setTerminalOutput([]);
      if (socket && sessionStatus === 'CONNECTED') {
        socket.emit('ssh:input', { data: '\x0c' });
      }
    }
  };

  const parsedSegments = useMemo(() => {
    return parseAnsi(terminalOutput.join(''));
  }, [terminalOutput]);

  return (
    <div className={`space-y-4 font-sans ${isFullscreen ? 'fixed inset-0 z-50 p-6 bg-[#070913]/95 backdrop-blur-xl flex flex-col' : ''}`}>
      {/* Top Banner / Session Controller */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#121829] border border-[#1E2640] p-4 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <TerminalIcon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight">iTerm2 Shell Terminal</h2>
              <span className="text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-bold">
                xterm-256color PTY
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Target: <strong className="text-slate-200">{username}@{host}:{port}</strong>
              {statusMessage ? ` • ${statusMessage}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#161C2E] hover:bg-[#1E2640] border border-[#2B3555] rounded-xl text-xs font-mono text-slate-300 transition"
          >
            <Settings className="w-3.5 h-3.5 text-slate-400" />
            <span>{showConfig ? 'Hide Credentials' : 'Configure Host'}</span>
            {showConfig ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
          </button>

          {sessionStatus === 'CONNECTED' || sessionStatus === 'CONNECTING' ? (
            <button
              onClick={handleDisconnect}
              className="px-4 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-mono font-bold text-xs border border-rose-500/30 transition flex items-center gap-1.5 shadow-sm"
            >
              <Square className="w-3.5 h-3.5 fill-current" /> Disconnect
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={!isConnected}
              className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-mono font-bold text-xs transition flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> Connect
            </button>
          )}
        </div>
      </div>

      {/* Host Credentials Config Drawer */}
      {showConfig && (
        <div className="bg-[#121829] border border-[#1E2640] p-5 rounded-2xl shadow-xl space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
            <div className="lg:col-span-3 space-y-1">
              <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-indigo-400" /> Host IP / Domain
              </label>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="192.168.1.10"
                disabled={sessionStatus === 'CONNECTED' || sessionStatus === 'CONNECTING'}
                className="w-full bg-[#090C16] border border-[#1E2640] rounded-xl px-3.5 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              />
            </div>

            <div className="lg:col-span-2 space-y-1">
              <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                Port
              </label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                placeholder="22"
                disabled={sessionStatus === 'CONNECTED' || sessionStatus === 'CONNECTING'}
                className="w-full bg-[#090C16] border border-[#1E2640] rounded-xl px-3.5 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              />
            </div>

            <div className="lg:col-span-2 space-y-1">
              <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="raffa"
                disabled={sessionStatus === 'CONNECTED' || sessionStatus === 'CONNECTING'}
                className="w-full bg-[#090C16] border border-[#1E2640] rounded-xl px-3.5 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              />
            </div>

            <div className="lg:col-span-2 space-y-1">
              <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" /> Mode
              </label>
              <select
                value={authType}
                onChange={(e) => setAuthType(e.target.value as any)}
                disabled={sessionStatus === 'CONNECTED' || sessionStatus === 'CONNECTING'}
                className="w-full bg-[#090C16] border border-[#1E2640] rounded-xl px-3.5 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              >
                <option value="password">Password</option>
                <option value="privateKey">Private Key</option>
              </select>
            </div>

            <div className="lg:col-span-3 space-y-1">
              <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-emerald-400" /> {authType === 'password' ? 'Password' : 'Key'}
              </label>
              {authType === 'password' ? (
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="SSH Password"
                  disabled={sessionStatus === 'CONNECTED' || sessionStatus === 'CONNECTING'}
                  className="w-full bg-[#090C16] border border-[#1E2640] rounded-xl px-3.5 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                />
              ) : (
                <input
                  type="password"
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  placeholder="-----BEGIN RSA PRIVATE KEY-----"
                  disabled={sessionStatus === 'CONNECTED' || sessionStatus === 'CONNECTING'}
                  className="w-full bg-[#090C16] border border-[#1E2640] rounded-xl px-3.5 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* iTerm-Style Quick Command Palette Bar */}
      <div className="flex flex-wrap items-center gap-2 bg-[#121829] border border-[#1E2640] px-4 py-2.5 rounded-2xl text-xs font-mono">
        <span className="text-slate-400 font-bold flex items-center gap-1.5 mr-1 text-[11px]">
          <Zap className="w-3.5 h-3.5 text-amber-400" /> Quick Shell:
        </span>
        {[
          { label: 'docker ps', cmd: 'docker ps' },
          { label: 'htop', cmd: 'htop' },
          { label: 'df -h', cmd: 'df -h' },
          { label: 'free -h', cmd: 'free -h' },
          { label: 'uptime', cmd: 'uptime' },
          { label: 'docker logs backend', cmd: 'docker logs pulsenoc-backend --tail 50' },
        ].map((item) => (
          <button
            key={item.label}
            onClick={() => sendCommand(item.cmd)}
            disabled={sessionStatus !== 'CONNECTED'}
            className="px-2.5 py-1 rounded-lg bg-[#090C16] hover:bg-[#1E2640] text-slate-300 border border-[#1E2640] disabled:opacity-40 transition hover:text-white"
          >
            {item.label}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setTerminalOutput([])}
            className="px-2.5 py-1 rounded-lg bg-[#090C16] hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-[#1E2640] transition flex items-center gap-1"
            title="Clear Console Output (Ctrl+L)"
          >
            <Trash2 className="w-3 h-3" /> Clear
          </button>
        </div>
      </div>

      {/* iTerm2 Authenticated macOS Terminal Window */}
      <div
        className={`bg-[#0A0E17] border border-[#1E2640] rounded-2xl shadow-2xl overflow-hidden font-mono flex flex-col transition-all duration-200 ${
          isFullscreen ? 'flex-1 min-h-0' : 'h-[560px]'
        }`}
      >
        {/* macOS iTerm Chrome Window Titlebar */}
        <div className="bg-[#101626] border-b border-[#1E2640] px-4 py-2.5 flex items-center justify-between select-none">
          {/* Traffic Light Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleDisconnect}
              className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E] hover:opacity-80 transition cursor-pointer"
              title="Close / Disconnect Session"
            />
            <button
              onClick={() => setTerminalOutput([])}
              className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123] hover:opacity-80 transition cursor-pointer"
              title="Clear Terminal Screen"
            />
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29] hover:opacity-80 transition cursor-pointer"
              title="Toggle Fullscreen Window"
            />

            {/* iTerm Active Tab Badge */}
            <div className="ml-3 flex items-center gap-2 bg-[#0A0E17] border border-[#1E2640] px-3 py-1 rounded-lg text-slate-300 text-xs font-mono shadow-inner">
              <span
                className={`w-2 h-2 rounded-full ${
                  sessionStatus === 'CONNECTED'
                    ? 'bg-emerald-400'
                    : sessionStatus === 'CONNECTING'
                    ? 'bg-amber-400 animate-spin'
                    : 'bg-slate-600'
                }`}
              />
              <span className="font-semibold text-slate-200 truncate max-w-[280px]">
                {tabTitle || `${username}@${host} — bash`}
              </span>
            </div>
          </div>

          {/* Window Right Metadata */}
          <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
            <span className="hidden sm:inline-flex items-center gap-1 text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> AES-256
            </span>
            <span className="hidden md:inline bg-[#161C2E] px-2 py-0.5 rounded text-[10px] text-slate-400 border border-[#2B3555]">
              120×35
            </span>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1 hover:text-white transition rounded"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Integrated Terminal Screen (Output & Inline Interactive Input in One Canvas) */}
        <div
          ref={outputRef}
          onClick={() => inputRef.current?.focus()}
          className="flex-1 p-5 overflow-y-auto whitespace-pre-wrap font-mono text-xs leading-relaxed cursor-text selection:bg-indigo-600/40 selection:text-white bg-[#0A0E17] text-slate-300 scrollbar-thin scrollbar-thumb-slate-800"
        >
          {terminalOutput.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-600 space-y-2 select-none py-16">
              <TerminalIcon className="w-12 h-12 text-slate-700" />
              <p className="text-sm font-semibold text-slate-400">PulseNOC iTerm2 Terminal Console</p>
              <p className="text-xs">
                {sessionStatus === 'CONNECTED'
                  ? 'Terminal connected. Type commands below.'
                  : 'Click "Connect" above to start an encrypted SSH PTY session.'}
              </p>
            </div>
          ) : (
            parsedSegments.map((segment, idx) => (
              <span key={idx} className={segment.className}>
                {segment.text}
              </span>
            ))
          )}

          {/* INLINE TERMINAL INPUT: Exactly like real iTerm2 (Embedded inside the terminal flow) */}
          {sessionStatus === 'CONNECTED' && (
            <div className="inline-flex items-baseline flex-wrap font-mono text-xs mt-1 align-bottom">
              {/* Active command text typed directly at cursor */}
              <span className="text-slate-200 whitespace-pre">{inputBuffer}</span>

              {/* Classic iTerm Blinking Green Block Cursor without blur glow */}
              <span className="inline-block w-2 h-4 bg-emerald-400/90 animate-pulse ml-0.5 align-middle select-none rounded-[1px] translate-y-0.5" />

              {/* Transparent hidden input capturing keystrokes without any separate input bar */}
              <input
                ref={inputRef}
                type="text"
                value={inputBuffer}
                onChange={(e) => setInputBuffer(e.target.value)}
                onKeyDown={handleKeyDown}
                className="opacity-0 absolute -left-[9999px] pointer-events-none"
                autoFocus
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
