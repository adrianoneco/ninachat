import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { Users, Plus, X, Save } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

const Card: React.FC<any> = ({ s, onOpenMembers, onEdit, onDelete }) => {
  return (
    <div className="rounded-lg border border-gray-300/80 dark:border-slate-800/80 bg-gray-100/40 dark:bg-slate-900/40 p-6 w-full h-full flex flex-col justify-between">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-gray-200/60 dark:bg-slate-800/60 text-cyan-400"><Users className="w-4 h-4" /></div>
            <div className="flex items-center gap-3">
              <h4 className="font-semibold text-gray-900 dark:text-white leading-tight">{s.name}</h4>
              {s.isDefault && (
                <span className="text-xs text-gray-500 dark:text-slate-400 bg-gray-200/50 dark:bg-slate-800/50 px-2 py-1 rounded-full">Padrão</span>
              )}
            </div>
          </div>
          <div className="text-sm text-gray-500 dark:text-slate-400">{s.slug}</div>
          <div className="text-sm text-gray-500 dark:text-slate-400">{s.description}</div>
        </div>

        <div className="flex flex-col items-end gap-3 ml-4">
          <div className="text-sm text-gray-500 dark:text-slate-400">👥 <span className="ml-1 font-medium text-gray-900 dark:text-white">{(s.members || []).length}</span> membro(s)</div>
          <div className="flex gap-2">
            <button onClick={() => onOpenMembers(s)} className="px-3 py-1 rounded-lg border border-gray-300 dark:border-slate-700 text-gray-600 dark:text-slate-300 bg-gray-200/40 dark:bg-slate-800/40 whitespace-nowrap">Membros</button>
            <button onClick={() => onEdit(s)} className="px-3 py-1 rounded bg-gray-200/30 dark:bg-slate-800/30 text-gray-600 dark:text-slate-300 hover:bg-gray-200/50 dark:bg-slate-800/50">✏️</button>
            <button onClick={() => onDelete(s)} className="px-3 py-1 rounded bg-rose-900/20 text-rose-300 hover:bg-rose-900/30">🗑️</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Sectors: React.FC = () => {
  const [sectors, setSectors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSector, setEditingSector] = useState<any | null>(null);
  const [membersModalSector, setMembersModalSector] = useState<any | null>(null);
  const [newSectorSheet, setNewSectorSheet] = useState(false);
  const [newSectorDraft, setNewSectorDraft] = useState({ name: '', slug: '', description: '', isDefault: false });
  const [team, setTeam] = useState<any[]>([]);

  const saveSectorToBackend = async (sector: any) => {
    try {
      await fetch(`${API_BASE}/sectors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sector),
      });
    } catch {}
  };

  const deleteSectorFromBackend = async (sectorId: string) => {
    try { await fetch(`${API_BASE}/sectors/${sectorId}`, { method: 'DELETE' }); } catch {}
  };

  const handleAdd = () => {
    setNewSectorDraft({ name: '', slug: '', description: '', isDefault: false });
    setNewSectorSheet(true);
  };

  const handleSaveNewSector = async () => {
    const id = `sector-${Date.now()}`;
    const newSector = { id, ...newSectorDraft, members: [] };
    setSectors(prev => [newSector, ...prev]);
    setNewSectorSheet(false);
    await saveSectorToBackend(newSector);
  };

  const handleOpenMembers = (s: any) => setMembersModalSector(s);
  const handleCloseMembers = () => setMembersModalSector(null);

  const handleToggleMember = (sectorId: string, memberId: string) => {
    setSectors(prev => {
      const next = prev.map(sec => {
        if (sec.id !== sectorId) return sec;
        const set = new Set(sec.members || []);
        if (set.has(memberId)) set.delete(memberId); else set.add(memberId);
        return { ...sec, members: Array.from(set) };
      });
      const updated = next.find(s => s.id === sectorId);
      if (updated) saveSectorToBackend(updated);
      return next;
    });
    setMembersModalSector((prev: any) => {
      if (!prev || prev.id !== sectorId) return prev;
      const set = new Set(prev.members || []);
      if (set.has(memberId)) set.delete(memberId); else set.add(memberId);
      return { ...prev, members: Array.from(set) };
    });
  };

  const handleEdit = (s: any) => setEditingSector(s);
  const handleDelete = async (s: any) => {
    if (!confirm('Remover setor?')) return;
    setSectors(prev => prev.filter(x => x.id !== s.id));
    await deleteSectorFromBackend(s.id);
  };

  const saveEdit = async () => {
    if (!editingSector) return;
    setSectors(prev => prev.map(s => s.id === editingSector.id ? editingSector : s));
    setEditingSector(null);
    await saveSectorToBackend(editingSector);
  };

  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/sectors`);
        if (res.ok) {
          const json = await res.json();
          const data = json?.data ?? json;
          if (Array.isArray(data)) setSectors(data);
        }
      } catch {}
      setLoading(false);
    })();
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/team_members`);
        if (res.ok) {
          const json = await res.json();
          const data = json?.data ?? json;
          if (Array.isArray(data)) setTeam(data);
        }
      } catch {}
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold">Setores</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Organize sua equipe em setores para melhor distribuição de conversas</p>
        </div>
        <div>
          <button onClick={handleAdd} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-gray-900 dark:text-white rounded-lg">
            <Plus className="w-4 h-4" /> Novo Setor
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {loading ? (
          <div className="text-sm text-gray-500 dark:text-slate-400 py-8 text-center">Carregando setores...</div>
        ) : sectors.length === 0 ? (
          <div className="text-sm text-gray-500 dark:text-slate-400 py-8 text-center">Nenhum setor cadastrado. Clique em "Novo Setor" para começar.</div>
        ) : (
          sectors.map(s => (
            <div key={s.id} className="w-full">
              <Card s={s} onOpenMembers={handleOpenMembers} onEdit={handleEdit} onDelete={handleDelete} />
            </div>
          ))
        )}
      </div>

      {/* New Sector — portal drawer */}
      {newSectorSheet && ReactDOM.createPortal(
        <>
          <div className="fixed inset-0 z-[100] bg-black/60" onClick={() => setNewSectorSheet(false)} />
          <div className="fixed inset-y-0 right-0 z-[101] w-full sm:w-[420px] bg-white dark:bg-slate-900 shadow-2xl flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-800 shrink-0">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Novo Setor</h2>
              <button onClick={() => setNewSectorSheet(false)} className="p-1 rounded hover:bg-gray-200/60 dark:hover:bg-slate-800/60"><X className="w-4 h-4 text-gray-500 dark:text-slate-400" /></button>
            </div>
            <div className="flex-1 p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Nome</label>
                <input autoFocus className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" placeholder="Nome do setor" value={newSectorDraft.name} onChange={e => setNewSectorDraft(d => ({ ...d, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Slug</label>
                <input className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" placeholder="slug-do-setor" value={newSectorDraft.slug} onChange={e => setNewSectorDraft(d => ({ ...d, slug: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Descrição</label>
                <textarea className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" rows={3} placeholder="Descrição do setor" value={newSectorDraft.description} onChange={e => setNewSectorDraft(d => ({ ...d, description: e.target.value }))} />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={newSectorDraft.isDefault} onCheckedChange={v => setNewSectorDraft(d => ({ ...d, isDefault: v }))} />
                <label className="text-sm text-gray-700 dark:text-slate-300">Setor padrão</label>
              </div>
            </div>
            <div className="shrink-0 px-6 py-4 border-t border-gray-200 dark:border-slate-800 flex justify-end gap-3">
              <button type="button" onClick={() => setNewSectorSheet(false)} className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-slate-300 text-sm hover:bg-gray-300 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
              <button type="button" onClick={handleSaveNewSector} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-500 transition-colors flex items-center gap-2"><Save className="w-4 h-4" /> Salvar</button>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Members — portal drawer */}
      {!!membersModalSector && ReactDOM.createPortal(
        <>
          <div className="fixed inset-0 z-[100] bg-black/60" onClick={handleCloseMembers} />
          <div className="fixed inset-y-0 right-0 z-[101] w-full sm:w-[440px] bg-white dark:bg-slate-900 shadow-2xl flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-800 shrink-0">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Membros — {membersModalSector?.name}</h2>
              <button onClick={handleCloseMembers} className="p-1 rounded hover:bg-gray-200/60 dark:hover:bg-slate-800/60"><X className="w-4 h-4 text-gray-500 dark:text-slate-400" /></button>
            </div>
            <div className="flex-1 p-6 space-y-3 overflow-y-auto">
              {team.map((m: any) => (
                <label key={m.id} className="flex items-center justify-between gap-3 p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white text-sm">{m.name}</div>
                    <div className="text-xs text-gray-500 dark:text-slate-400">{m.role}</div>
                  </div>
                  <Switch checked={(membersModalSector?.members || []).includes(m.id)} onCheckedChange={() => membersModalSector && handleToggleMember(membersModalSector.id, m.id)} />
                </label>
              ))}
            </div>
            <div className="shrink-0 px-6 py-4 border-t border-gray-200 dark:border-slate-800 flex justify-end">
              <button onClick={handleCloseMembers} className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-slate-300 text-sm hover:bg-gray-300 dark:hover:bg-slate-700 transition-colors">Fechar</button>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Edit sector — portal drawer */}
      {!!editingSector && ReactDOM.createPortal(
        <>
          <div className="fixed inset-0 z-[100] bg-black/60" onClick={() => setEditingSector(null)} />
          <div className="fixed inset-y-0 right-0 z-[101] w-full sm:w-[420px] bg-white dark:bg-slate-900 shadow-2xl flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-800 shrink-0">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Editar Setor</h2>
              <button onClick={() => setEditingSector(null)} className="p-1 rounded hover:bg-gray-200/60 dark:hover:bg-slate-800/60"><X className="w-4 h-4 text-gray-500 dark:text-slate-400" /></button>
            </div>
            <div className="flex-1 p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Nome</label>
                <input autoFocus className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" value={editingSector.name} onChange={e => setEditingSector({ ...editingSector, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Slug</label>
                <input className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" value={editingSector.slug} onChange={e => setEditingSector({ ...editingSector, slug: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Descrição</label>
                <textarea className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" rows={3} value={editingSector.description} onChange={e => setEditingSector({ ...editingSector, description: e.target.value })} />
              </div>
            </div>
            <div className="shrink-0 px-6 py-4 border-t border-gray-200 dark:border-slate-800 flex justify-end gap-3">
              <button type="button" onClick={() => setEditingSector(null)} className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-slate-300 text-sm hover:bg-gray-300 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
              <button type="button" onClick={saveEdit} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-500 transition-colors flex items-center gap-2"><Save className="w-4 h-4" /> Salvar</button>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

export default Sectors;
