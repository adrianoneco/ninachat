import React, { useState } from 'react';
import { Users, Plus } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

const initial = [
  { id: 'suporte', name: 'Suporte', slug: 'suporte-ti', description: 'Suporte', members: ['t1','t2','t3'], isDefault: true },
  { id: 'bot1', name: 'Bot1', slug: 'suporte-ti', description: 'Bot interno', members: [] },
  { id: 'comercial', name: 'Comercial Janaina', slug: 'comercial-ubva-janaina', description: 'Comercial', members: ['t4'] },
];

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
  const [sectors, setSectors] = useState(initial);
  const [editingSector, setEditingSector] = useState<any | null>(null);
  const [membersModalSector, setMembersModalSector] = useState<any | null>(null);
  const [team, setTeam] = useState<any[]>([
    { id: 't1', name: 'Admin User', role: 'admin' },
    { id: 't2', name: 'Sarah Connor', role: 'manager' },
    { id: 't3', name: 'John Doe', role: 'agent' },
    { id: 't4', name: 'Janaina', role: 'agent' },
  ]);

  const handleAdd = () => {
    const id = `sector-${Date.now()}`;
    setSectors(prev => [{ id, name: 'Novo Setor', slug: 'novo-setor', description: '', members: [], isDefault: false }, ...prev]);
  };

  const handleOpenMembers = (s: any) => setMembersModalSector(s);
  const handleCloseMembers = () => setMembersModalSector(null);

  const handleToggleMember = (sectorId: string, memberId: string) => {
    setSectors(prev => prev.map(sec => {
      if (sec.id !== sectorId) return sec;
      const set = new Set(sec.members || []);
      if (set.has(memberId)) set.delete(memberId); else set.add(memberId);
      return { ...sec, members: Array.from(set) };
    }));
  };

  const handleEdit = (s: any) => setEditingSector(s);
  const handleDelete = (s: any) => {
    if (!confirm('Remover setor?')) return;
    setSectors(prev => prev.filter(x => x.id !== s.id));
  };

  const saveEdit = () => {
    if (!editingSector) return;
    setSectors(prev => prev.map(s => s.id === editingSector.id ? editingSector : s));
    setEditingSector(null);
  };

  React.useEffect(() => {
    // load persisted sectors from backend
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/sectors`);
        if (res.ok) { const json = await res.json(); const data = json?.data ?? json; if (Array.isArray(data) && data.length) { setSectors(data); return; } }
      } catch {}
      // Backend unavailable - keep defaults
    })();
    // load team members from backend
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/team_members`);
        if (res.ok) { const json = await res.json(); const data = json?.data ?? json; if (Array.isArray(data) && data.length) setTeam(data); }
      } catch {}
    })();
  }, []);

  React.useEffect(() => {
    // persist on change to backend
    (async () => {
      try {
        await fetch(`${API_BASE}/sectors`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sectors) });
      } catch (err) {
        console.error('Failed to save sectors to backend', err);
      }
    })();
  }, [sectors]);

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
        {sectors.map(s => (
          <div key={s.id} className="w-full">
            <Card s={s} onOpenMembers={handleOpenMembers} onEdit={handleEdit} onDelete={handleDelete} />
          </div>
        ))}
      </div>

      {/* Members sidebar */}
      <Sheet open={!!membersModalSector} onOpenChange={(open) => { if (!open) handleCloseMembers(); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
          <SheetHeader className="p-6 border-b border-gray-200 dark:border-slate-800">
            <SheetTitle className="text-lg font-semibold">Membros — {membersModalSector?.name}</SheetTitle>
          </SheetHeader>
            <div className="p-6 space-y-3">
              {team.map((m: any) => (
                <label key={m.id} className="flex items-center justify-between gap-3 p-2 rounded hover:bg-gray-200/40 dark:bg-slate-800/40">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{m.name}</div>
                    <div className="text-xs text-gray-500 dark:text-slate-400">{m.role}</div>
                  </div>
                  <Switch checked={(membersModalSector?.members || []).includes(m.id)} onCheckedChange={() => membersModalSector && handleToggleMember(membersModalSector.id, m.id)} />
                </label>
              ))}
            </div>
            <div className="p-6 pt-0 flex justify-end">
              <button onClick={handleCloseMembers} className="px-3 py-2 rounded bg-gray-300 dark:bg-slate-700">Fechar</button>
            </div>
        </SheetContent>
      </Sheet>

      {/* Edit sector sidebar */}
      <Sheet open={!!editingSector} onOpenChange={(open) => { if (!open) setEditingSector(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0">
          <SheetHeader className="p-6 border-b border-gray-200 dark:border-slate-800">
            <SheetTitle className="text-lg font-semibold">Editar Setor</SheetTitle>
          </SheetHeader>
          {editingSector && (
            <div className="p-6 space-y-3">
              <input className="w-full bg-gray-200/30 dark:bg-slate-800/30 px-3 py-2 rounded" value={editingSector.name} onChange={e => setEditingSector({ ...editingSector, name: e.target.value })} />
              <input className="w-full bg-gray-200/30 dark:bg-slate-800/30 px-3 py-2 rounded" value={editingSector.slug} onChange={e => setEditingSector({ ...editingSector, slug: e.target.value })} />
              <textarea className="w-full bg-gray-200/30 dark:bg-slate-800/30 px-3 py-2 rounded" value={editingSector.description} onChange={e => setEditingSector({ ...editingSector, description: e.target.value })} />
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setEditingSector(null)} className="px-3 py-2 rounded bg-gray-300 dark:bg-slate-700">Cancelar</button>
                <button onClick={saveEdit} className="px-3 py-2 rounded bg-emerald-600 text-gray-900 dark:text-white">Salvar</button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Sectors;
