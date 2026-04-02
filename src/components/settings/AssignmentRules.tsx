import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { Plus, Trash2, Edit, Save, ToggleRight, X } from 'lucide-react';
import { Button } from '../Button';
import { api } from '@/services/api';

const emptyRule = { id: '', name: '', instanceId: '', fixedAssignee: '', roundRobin: [], isActive: true };

const AssignmentRules: React.FC = () => {
  const [rules, setRules] = useState<any[]>([]);
  const [instances, setInstances] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [r, ins, t] = await Promise.all([api.fetchAssignmentRules(), api.fetchInstances(), api.fetchTeam()]);
      setRules(r || []);
      setInstances(ins || []);
      setTeam(t || []);
      setLoading(false);
    };
    load();
  }, []);

  const handleAdd = () => { setEditing({ ...emptyRule }); };

  const handleEdit = (r: any) => setEditing({ ...r });

  const handleSave = async () => {
    if (!editing) return;
    await api.saveAssignmentRule(editing);
    const r = await api.fetchAssignmentRules();
    setRules(r || []);
    setEditing(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir regra de atribuição?')) return;
    await api.deleteAssignmentRule(id);
    const r = await api.fetchAssignmentRules();
    setRules(r || []);
  };

  const toggleActive = async (r: any) => {
    await api.saveAssignmentRule({ ...r, isActive: !r.isActive });
    const list = await api.fetchAssignmentRules();
    setRules(list || []);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-2xl font-bold">Regras de Atribuição</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Configure regras para atribuição automática de conversas a atendentes.</p>
        </div>
        <Button variant="primary" onClick={handleAdd}><Plus className="w-4 h-4 mr-2"/>Nova Regra</Button>
      </div>

      <div className="space-y-4">
        {loading && <div className="text-sm text-gray-500 dark:text-slate-400">Carregando...</div>}
        {!loading && rules.length === 0 && <div className="text-sm text-gray-500 dark:text-slate-500">Nenhuma regra cadastrada.</div>}
        {rules.map(r => (
          <div key={r.id} className="card-surface p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold text-gray-700 dark:text-slate-200">{r.name}</div>
                <div className="text-sm text-gray-500 dark:text-slate-400">Instância: {instances.find(i => i.id === r.instanceId)?.name || r.instanceId || '—'}</div>
                <div className="text-sm text-gray-500 dark:text-slate-400 mt-1">Atribuição Fixa: {r.fixedAssignee ? (team.find(t => t.id === r.fixedAssignee)?.name || r.fixedAssignee) : '—'}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleActive(r)} title={r.isActive ? 'Ativa' : 'Inativa'} className="flex items-center gap-2">
                  <ToggleRight className={`w-6 h-6 ${r.isActive ? 'text-primary' : 'text-gray-400 dark:text-slate-600'}`} />
                </button>
                <Button size="sm" variant="ghost" onClick={() => handleEdit(r)}><Edit className="w-4 h-4"/></Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(r.id)}><Trash2 className="w-4 h-4"/></Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!!editing && ReactDOM.createPortal(
        <>
          <div className="fixed inset-0 z-[100] bg-black/60" onClick={() => setEditing(null)} />
          <div className="fixed inset-y-0 right-0 z-[101] w-full sm:w-[420px] bg-white dark:bg-slate-900 shadow-2xl flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-800 shrink-0">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">{editing?.id ? 'Editar Regra' : 'Nova Regra'}</h2>
              <button onClick={() => setEditing(null)} className="p-1 rounded hover:bg-gray-200/60 dark:hover:bg-slate-800/60"><X className="w-4 h-4 text-gray-500 dark:text-slate-400" /></button>
            </div>
            <div className="flex-1 p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Nome da regra</label>
                <input autoFocus className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" placeholder="Nome da regra" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Instância</label>
                <select className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" value={editing.instanceId || ''} onChange={e => setEditing({ ...editing, instanceId: e.target.value })}>
                  <option value="">-- Selecione instância --</option>
                  {instances.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Atribuição fixa (opcional)</label>
                <select className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" value={editing.fixedAssignee || ''} onChange={e => setEditing({ ...editing, fixedAssignee: e.target.value })}>
                  <option value="">-- Selecione atendente --</option>
                  {team.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>
            <div className="shrink-0 px-6 py-4 border-t border-gray-200 dark:border-slate-800 flex justify-end gap-3">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-slate-300 text-sm hover:bg-gray-300 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
              <button type="button" onClick={handleSave} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-500 transition-colors flex items-center gap-2"><Save className="w-4 h-4" /> Salvar</button>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

export default AssignmentRules;
