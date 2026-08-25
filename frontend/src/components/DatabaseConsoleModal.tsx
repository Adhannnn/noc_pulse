// frontend/src/components/DatabaseConsoleModal.tsx
'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { X, Play, Terminal, Database, Clock, Table, CheckCircle2 } from 'lucide-react';

export interface DatabaseRecord {
  id: string;
  name: string;
  engine: string;
  host: string;
  port: number;
  database: string;
  username: string;
  status: string;
  latencyMs: number;
  connections: number;
}

interface Props {
  db: DatabaseRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function DatabaseConsoleModal({ db, isOpen, onClose }: Props) {
  const [query, setQuery] = useState('SELECT * FROM USERS LIMIT 10;');
  const [results, setResults] = useState<{
    columns: string[];
    rows: any[];
    rowCount: number;
    durationMs: number;
  } | null>(null);
  const [executing, setExecuting] = useState(false);

  const { authFetch } = useAuth();

  if (!isOpen || !db) return null;

  const handleExecute = async () => {
    setExecuting(true);
    try {
      const res = await authFetch(`/api/databases/${db.id}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0D111D] border border-[#1E2640] rounded-2xl w-full max-w-4xl p-6 text-slate-100 shadow-2xl space-y-5 font-sans max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1E2640] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Terminal className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">{db.name}</h2>
                <span className="text-xs font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full uppercase">
                  {db.engine}
                </span>
                <span className="text-xs font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {db.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Host: <span className="text-slate-200">{db.host}:{db.port}</span> • Database: <span className="text-sky-400">{db.database}</span>
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-[#1E2640] rounded-xl transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* DBeaver Query Editor Panel */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-purple-400" /> DBeaver Query Console
            </span>
            <button
              onClick={handleExecute}
              disabled={executing}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-1.5 rounded-xl font-semibold text-xs font-mono shadow-md shadow-purple-600/30 transition disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {executing ? 'Executing...' : 'Execute Query (Ctrl+Enter)'}
            </button>
          </div>

          <textarea
            rows={3}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-[#070913] border border-[#1E2640] rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-purple-500 resize-none shadow-inner"
            placeholder="Type SQL query or command..."
          />
        </div>

        {/* Query Results Table Panel */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-[#1E2640] pb-2">
            <span className="flex items-center gap-1.5">
              <Table className="w-4 h-4 text-sky-400" /> Results Grid Data
            </span>
            {results && (
              <span className="text-slate-300">
                Fetched <strong className="text-emerald-400">{results.rowCount}</strong> rows in <strong className="text-sky-400">{results.durationMs}ms</strong>
              </span>
            )}
          </div>

          {!results ? (
            <div className="bg-[#121829] border border-[#1E2640] rounded-xl p-8 text-center text-slate-500 font-mono text-xs">
              Click &quot;Execute Query&quot; above to run queries against {db.name}.
            </div>
          ) : (
            <div className="bg-[#121829] border border-[#1E2640] rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#090C16] border-b border-[#1E2640] text-purple-300 uppercase text-[10px]">
                  <tr>
                    {results.columns.map((col) => (
                      <th key={col} className="px-4 py-2.5">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2640]/60 text-slate-200">
                  {results.rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-[#161C2E] transition">
                      {results.columns.map((col) => (
                        <td key={col} className="px-4 py-2.5">
                          {row[col] !== undefined ? String(row[col]) : <span className="text-slate-600">NULL</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="bg-[#1E2640] hover:bg-slate-700 text-slate-200 px-5 py-2 rounded-xl text-xs font-semibold font-mono transition"
          >
            Close Console
          </button>
        </div>
      </div>
    </div>
  );
}
