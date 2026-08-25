// frontend/src/components/DatabaseDetailView.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { DatabaseRecord } from '@/components/DatabaseConsoleModal';
import {
  ArrowLeft,
  Database,
  Table,
  Terminal,
  Activity,
  Play,
  CheckCircle2,
  Clock,
  Layers,
  RefreshCw,
  Search,
} from 'lucide-react';

interface Props {
  db: DatabaseRecord;
  onBack: () => void;
}

export default function DatabaseDetailView({ db, onBack }: Props) {
  const [activeTab, setActiveTab] = useState<'TABLES' | 'CONSOLE' | 'TELEMETRY'>('TABLES');
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<{
    columns: string[];
    rows: any[];
    rowCount: number;
    durationMs: number;
  } | null>(null);

  const [loadingTables, setLoadingTables] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);

  // SQL Query Console State
  const [query, setQuery] = useState('SELECT * FROM users LIMIT 10;');
  const [queryResults, setQueryResults] = useState<{
    columns: string[];
    rows: any[];
    rowCount: number;
    durationMs: number;
  } | null>(null);
  const [executing, setExecuting] = useState(false);
  const [tableSearch, setTableSearch] = useState('');

  const { authFetch } = useAuth();

  // Fetch real PostgreSQL tables list
  const fetchTables = async () => {
    setLoadingTables(true);
    try {
      const res = await authFetch(`/api/databases/${db.id}/tables`);
      if (res.ok) {
        const data = await res.json();
        setTables(data);
        if (data && data.length > 0) {
          fetchTableData(data[0]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTables(false);
    }
  };

  // Fetch real table data (SELECT * FROM "tableName" LIMIT 50)
  const fetchTableData = async (tableName: string) => {
    setSelectedTable(tableName);
    setLoadingRows(true);
    try {
      const res = await authFetch(`/api/databases/${db.id}/tables/${tableName}`);
      if (res.ok) {
        const data = await res.json();
        setTableData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRows(false);
    }
  };

  const handleExecuteQuery = async () => {
    setExecuting(true);
    try {
      const res = await authFetch(`/api/databases/${db.id}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      if (res.ok) {
        const data = await res.json();
        setQueryResults(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setExecuting(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, [db.id]);

  const filteredTables = tables.filter((t) =>
    t.toLowerCase().includes(tableSearch.toLowerCase()),
  );

  return (
    <div className="space-y-6 font-sans">
      {/* Workspace Navigation Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#121829] border border-[#1E2640] p-5 rounded-2xl">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 bg-[#161C2E] hover:bg-[#1E2640] border border-[#2B3555] text-slate-300 px-3.5 py-2 rounded-xl text-xs font-semibold font-mono transition"
          >
            <ArrowLeft className="w-4 h-4 text-purple-400" /> Back to Connections
          </button>

          <div className="flex items-center gap-3 border-l border-[#1E2640] pl-4">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Database className="w-6 h-6" />
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
                Host: <span className="text-slate-200">{db.host}:{db.port}</span> • Database: <span className="text-purple-300">{db.database}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center bg-[#090C16] p-1 rounded-xl border border-[#1E2640] text-xs">
          <button
            onClick={() => setActiveTab('TABLES')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-semibold transition ${
              activeTab === 'TABLES'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Table className="w-3.5 h-3.5" /> Tables Explorer ({tables.length})
          </button>
          <button
            onClick={() => setActiveTab('CONSOLE')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-semibold transition ${
              activeTab === 'CONSOLE'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" /> SQL Console
          </button>
          <button
            onClick={() => setActiveTab('TELEMETRY')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-semibold transition ${
              activeTab === 'TELEMETRY'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" /> Telemetry
          </button>
        </div>
      </div>

      {/* TAB 1: TABLES EXPLORER */}
      {activeTab === 'TABLES' && (
        <div className="grid grid-cols-12 gap-6 min-h-[500px]">
          {/* Left Table Tree Sidebar */}
          <div className="col-span-12 md:col-span-3 bg-[#121829] border border-[#1E2640] rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-purple-400" /> PostgreSQL Tables
              </span>
              <button
                onClick={fetchTables}
                className="text-slate-400 hover:text-white transition p-1"
                title="Refresh Table Schema"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter tables..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="w-full bg-[#090C16] border border-[#1E2640] rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>

            <div className="space-y-1 overflow-y-auto max-h-[420px] pr-1">
              {loadingTables ? (
                <div className="p-4 text-center text-slate-500 font-mono text-xs">
                  Fetching tables...
                </div>
              ) : filteredTables.length === 0 ? (
                <div className="p-4 text-center text-slate-500 font-mono text-xs">
                  No tables found.
                </div>
              ) : (
                filteredTables.map((t) => (
                  <button
                    key={t}
                    onClick={() => fetchTableData(t)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-mono transition flex items-center gap-2 ${
                      selectedTable === t
                        ? 'bg-purple-600 text-white font-bold shadow-sm'
                        : 'text-slate-300 hover:bg-[#161C2E] hover:text-white'
                    }`}
                  >
                    <Table className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{t}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right Data Grid Inspector Canvas */}
          <div className="col-span-12 md:col-span-9 bg-[#121829] border border-[#1E2640] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#1E2640] pb-3">
              <div className="flex items-center gap-2">
                <Table className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-white text-base font-mono">
                  {selectedTable ? `Table: "${selectedTable}"` : 'Select a Table'}
                </h3>
              </div>

              {tableData && (
                <span className="text-xs font-mono text-slate-400">
                  Fetched <strong className="text-emerald-400">{tableData.rowCount}</strong> rows in{' '}
                  <strong className="text-sky-400">{tableData.durationMs}ms</strong>
                </span>
              )}
            </div>

            {loadingRows ? (
              <div className="p-12 text-center text-slate-500 font-mono text-xs">
                Executing <code className="text-purple-300">SELECT * FROM &quot;{selectedTable}&quot; LIMIT 50</code>...
              </div>
            ) : !tableData ? (
              <div className="p-12 text-center text-slate-500 font-mono text-xs">
                Select a table on the left to inspect its rows.
              </div>
            ) : (
              <div className="bg-[#090C16] border border-[#1E2640] rounded-xl overflow-x-auto shadow-sm">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#070913] border-b border-[#1E2640] text-purple-300 uppercase text-[10px]">
                    <tr>
                      {tableData.columns.map((col) => (
                        <th key={col} className="px-4 py-2.5 whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E2640]/60 text-slate-200">
                    {tableData.rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={tableData.columns.length || 1}
                          className="px-4 py-10 text-center text-slate-500 font-mono text-xs italic bg-[#070913]/40"
                        >
                          No records found in table &quot;{selectedTable}&quot; (0 rows).
                        </td>
                      </tr>
                    ) : (
                      tableData.rows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-[#161C2E] transition">
                          {tableData.columns.map((col) => (
                            <td key={col} className="px-4 py-2.5 max-w-xs truncate">
                              {row[col] !== undefined ? String(row[col]) : <span className="text-slate-600">NULL</span>}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SQL CONSOLE */}
      {activeTab === 'CONSOLE' && (
        <div className="bg-[#121829] border border-[#1E2640] rounded-2xl p-6 space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Terminal className="w-4 h-4 text-purple-400" /> Interactive Query Editor
              </span>

              {/* Template Shortcuts */}
              <div className="flex items-center gap-2">
                {['SELECT * FROM users;', 'SELECT * FROM alert_channels;', 'SELECT * FROM monitors;'].map((tmpl) => (
                  <button
                    key={tmpl}
                    onClick={() => setQuery(tmpl)}
                    className="text-[10px] font-mono bg-[#161C2E] hover:bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg border border-[#2B3555] transition"
                  >
                    {tmpl.substring(0, 24)}...
                  </button>
                ))}
              </div>
            </div>

            <textarea
              rows={4}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-[#070913] border border-[#1E2640] rounded-xl p-4 text-xs font-mono text-slate-100 focus:outline-none focus:border-purple-500 shadow-inner"
              placeholder="Enter raw SQL query..."
            />

            <div className="flex justify-end">
              <button
                onClick={handleExecuteQuery}
                disabled={executing}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-5 py-2 rounded-xl text-xs font-mono font-semibold shadow-lg shadow-purple-600/30 transition disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-current" />
                {executing ? 'Executing SQL...' : 'Run Query (Ctrl+Enter)'}
              </button>
            </div>
          </div>

          {/* Results Canvas */}
          {queryResults && (
            <div className="space-y-3 pt-3 border-t border-[#1E2640]">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1.5 font-bold text-slate-200">
                  <Table className="w-4 h-4 text-sky-400" /> Output Results Data
                </span>
                <span>
                  Fetched <strong className="text-emerald-400">{queryResults.rowCount}</strong> rows in{' '}
                  <strong className="text-sky-400">{queryResults.durationMs}ms</strong>
                </span>
              </div>

              <div className="bg-[#090C16] border border-[#1E2640] rounded-xl overflow-x-auto shadow-sm">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#070913] border-b border-[#1E2640] text-purple-300 uppercase text-[10px]">
                    <tr>
                      {queryResults.columns.map((col) => (
                        <th key={col} className="px-4 py-2.5 whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E2640]/60 text-slate-200">
                    {queryResults.rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={queryResults.columns.length || 1}
                          className="px-4 py-8 text-center text-slate-500 font-mono text-xs italic bg-[#070913]/40"
                        >
                          Query executed successfully. 0 rows returned.
                        </td>
                      </tr>
                    ) : (
                      queryResults.rows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-[#161C2E] transition">
                          {queryResults.columns.map((col) => (
                            <td key={col} className="px-4 py-2.5 max-w-xs truncate">
                              {row[col] !== undefined ? String(row[col]) : <span className="text-slate-600">NULL</span>}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: TELEMETRY */}
      {activeTab === 'TELEMETRY' && (
        <div className="bg-[#121829] border border-[#1E2640] rounded-2xl p-6 space-y-4 font-mono text-xs">
          <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" /> Database Server Health Metrics
          </h3>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#090C16] p-4 rounded-xl border border-[#1E2640]">
              <span className="text-slate-500 uppercase text-[10px]">Connection Ping</span>
              <div className="text-xl font-bold text-emerald-400 mt-1">{db.latencyMs} ms</div>
            </div>
            <div className="bg-[#090C16] p-4 rounded-xl border border-[#1E2640]">
              <span className="text-slate-500 uppercase text-[10px]">Active Clients</span>
              <div className="text-xl font-bold text-sky-400 mt-1">{db.connections} connections</div>
            </div>
            <div className="bg-[#090C16] p-4 rounded-xl border border-[#1E2640]">
              <span className="text-slate-500 uppercase text-[10px]">Health Status</span>
              <div className="text-xl font-bold text-purple-400 mt-1">ONLINE</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
