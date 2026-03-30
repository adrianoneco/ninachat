import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Edit, Save, ToggleRight } from 'lucide-react';
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

      {editing && (
        <div className="mt-6 card-surface p-4 rounded">
          <div className="flex items-center justify-between mb-3">
            <strong>{editing.id ? 'Editar Regra' : 'Nova Regra'}</strong>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setEditing(null)}><Save className="w-4 h-4 mr-2"/>Fechar</Button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <input className="col-span-2 theme-input px-2 py-2 text-sm" placeholder="Nome da regra" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
            <select className="theme-input px-2 py-2 text-sm" value={editing.instanceId || ''} onChange={e => setEditing({ ...editing, instanceId: e.target.value })}>
              <option value="">-- Selecione instância --</option>
              {instances.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
            <select className="theme-input px-2 py-2 text-sm" value={editing.fixedAssignee || ''} onChange={e => setEditing({ ...editing, fixedAssignee: e.target.value })}>
              <option value="">-- Atribuição fixa (opcional) --</option>
              {team.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button variant="primary" onClick={handleSave}><Save className="w-4 h-4 mr-2"/>Salvar</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssignmentRules;
