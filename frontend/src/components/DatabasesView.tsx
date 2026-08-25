// frontend/src/components/DatabasesView.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import AddDatabaseModal from '@/components/AddDatabaseModal';
import DatabaseDetailView from '@/components/DatabaseDetailView';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import { DatabaseRecord } from '@/components/DatabaseConsoleModal';
import { Database, CheckCircle2, Terminal, Trash2 } from 'lucide-react';

export default function DatabasesView() {
  const [databases, setDatabases] = useState<DatabaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedDb, setSelectedDb] = useState<DatabaseRecord | null>(null);
  const [deleteDbId, setDeleteDbId] = useState<string | null>(null);

  const { authFetch } = useAuth();

  const fetchDatabases = async () => {
    try {
      const res = await authFetch('/api/databases');
      if (res.ok) {
        const data = await res.json();
        setDatabases(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatabases();
  }, []);

  const confirmDeleteDb = async (id: string) => {
    try {
      const res = await authFetch(`/api/databases/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setDatabases((prev) => prev.filter((d) => d.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteDbId(id);
  };

  if (selectedDb) {
    return <DatabaseDetailView db={selectedDb} onBack={() => setSelectedDb(null)} />;
  }

  return (
    <div className="space-y-6 font-sans">
      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#121829] border border-[#1E2640] p-5 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Database Cluster Connections</h2>
            <p className="text-xs text-slate-400">
              Click any database card to open the Tables Explorer & SQL Query Studio
            </p>
          </div>
        </div>
      </div>

      {/* Grid of Database Cards */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 font-mono text-xs">
          Loading Database Connections...
        </div>
      ) : databases.length === 0 ? (
        <div className="bg-[#121829]/60 border border-dashed border-[#1E2640] rounded-2xl p-12 text-center text-slate-500 space-y-2">
          <Database className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="font-semibold text-slate-300">No Databases Configured</p>
          <p className="text-xs text-slate-500">Click &quot;+ Add Database Connection&quot; above to connect PostgreSQL, MySQL, Redis, or MongoDB.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {databases.map((db) => (
            <div
              key={db.id}
              onClick={() => setSelectedDb(db)}
              className="bg-[#121829] border border-[#1E2640] rounded-2xl p-5 shadow-sm space-y-4 hover:border-purple-500/60 cursor-pointer group transition"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg border border-purple-500/20 group-hover:bg-purple-600 group-hover:text-white transition">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm group-hover:text-purple-300 transition">
                      {db.name}
                    </h3>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                      {db.engine}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => handleDelete(db.id, e)}
                    className="p-1 text-slate-500 hover:text-rose-400 rounded transition opacity-0 group-hover:opacity-100"
                    title="Delete Database Connection"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <span className="flex items-center gap-1 text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3" /> {db.status}
                  </span>
                </div>
              </div>

              <div className="bg-[#090C16] border border-[#1E2640]/80 rounded-xl p-3 text-xs font-mono space-y-1 text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500">Host:</span>
                  <span>{db.host}:{db.port}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Database:</span>
                  <span className="text-purple-300 font-semibold">{db.database}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Connections:</span>
                  <span className="text-indigo-400 font-semibold">{db.connections} clients</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 text-xs font-mono text-purple-400 font-semibold group-hover:translate-x-1 transition">
                <span className="flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5" /> Open Studio Workspace
                </span>
                <span>View Details &rarr;</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Database Connection Modal */}
      <AddDatabaseModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchDatabases}
      />

      {/* Delete Database Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteDbId}
        onClose={() => setDeleteDbId(null)}
        onConfirm={() => deleteDbId && confirmDeleteDb(deleteDbId)}
        title="Delete Database Connection"
        description="Are you sure you want to delete this database connection target? The connection metadata and workspace links will be permanently removed."
      />
    </div>
  );
}
