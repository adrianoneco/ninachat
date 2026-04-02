import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { Plus, Trash2, Edit, Save, X } from 'lucide-react';
import { Button } from '../Button';
import { api } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';

const emptyMacro = { id: '', name: '', shortcut: '', content: '', category: '', scope: 'user' as 'user' | 'global', userId: '' };

const MacrosSettings: React.FC = () => {
  const [globalMacros, setGlobalMacros] = useState<any[]>([]);
  const [userMacros, setUserMacros] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [editingScope, setEditingScope] = useState<'global' | 'user'>('user');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [team, setTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // try to get current user safely
  let currentUserId: string | null = null;
  try {
    const auth = useAuth();
    currentUserId = auth.user?.id || null;
  } catch (e) {
    currentUserId = null;
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [g, t] = await Promise.all([api.fetchMacrosGlobal(), api.fetchTeam()]);
      setGlobalMacros(g || []);
      setTeam(t || []);
      const uid = currentUserId || (t && t[0] && t[0].id) || null;
      setSelectedUser(uid);
      if (uid) {
        const um = await api.fetchUserMacros(uid);
        setUserMacros(um || []);
      }
      setLoading(false);
    };
    load();
  }, []);

  const loadUserMacros = async (uid: string | null) => {
    if (!uid) { setUserMacros([]); return; }
    const um = await api.fetchUserMacros(uid);
    setUserMacros(um || []);
  };

  const handleSelectUser = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const uid = e.target.value || null;
    setSelectedUser(uid);
    await loadUserMacros(uid);
  };

  const handleAdd = (scope: 'global' | 'user') => {
    const macro = { ...emptyMacro, scope, userId: scope === 'user' ? (selectedUser || '') : '' };
    setEditing(macro);
    setEditingScope(scope);
  };

  const handleEdit = (m: any, scope: 'global' | 'user') => { setEditing(m); setEditingScope(scope); };

  const handleCancel = () => { setEditing(null); };

  const handleSave = async () => {
    if (!editing) return;
    await api.saveMacro(editing);
    // reload
    const g = await api.fetchMacrosGlobal();
    setGlobalMacros(g || []);
    if (editing.userId) await loadUserMacros(editing.userId);
    setEditing(null);
  };

  const handleDelete = async (id: string, scope: 'global' | 'user', userId?: string) => {
    if (!confirm('Remover macro?')) return;
    await api.deleteMacro(id, scope, userId);
    const g = await api.fetchMacrosGlobal();
    setGlobalMacros(g || []);
    if (selectedUser) await loadUserMacros(selectedUser);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-2xl font-bold">Macros (Respostas Rápidas)</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Use macros para inserir respostas rápidas no chat. Gerencie globalmente ou por usuário.</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card-surface p-4 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <strong className="text-sm">Macros Globais</strong>
            <Button variant="outline" onClick={() => handleAdd('global')}><Plus className="w-4 h-4 mr-2"/>Novo</Button>
          </div>
          {loading ? <div className="text-sm text-gray-500 dark:text-slate-400">Carregando...</div> : (
            <div className="space-y-2">
              {globalMacros.length === 0 && <div className="text-sm text-gray-500 dark:text-slate-500">Nenhuma macro global definida.</div>}
              {globalMacros.map(m => (
                <div key={m.id} className="flex items-start justify-between theme-input p-2 rounded">
                  <div>
                    <div className="font-medium text-gray-700 dark:text-slate-200">{m.name} <span className="text-xs text-gray-500 dark:text-slate-400 ml-2">{m.shortcut}</span></div>
                    <div className="text-sm text-gray-500 dark:text-slate-400">{m.content}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(m, 'global')}><Edit className="w-4 h-4"/></Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(m.id, 'global')}><Trash2 className="w-4 h-4"/></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card-surface p-4 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <strong className="text-sm">Macros Por Usuário</strong>
            <div className="flex items-center gap-2">
              <select className="theme-input px-2 py-1 text-sm text-gray-700 dark:text-slate-200" value={selectedUser || ''} onChange={handleSelectUser}>
                <option value="">-- Selecionar usuário --</option>
                {team.map(u => (<option key={u.id} value={u.id}>{u.name}</option>))}
              </select>
              <Button variant="outline" onClick={() => handleAdd('user')}><Plus className="w-4 h-4 mr-2"/>Novo</Button>
            </div>
          </div>
          {loading ? <div className="text-sm text-gray-500 dark:text-slate-400">Carregando...</div> : (
            <div className="space-y-2">
              {(!userMacros || userMacros.length === 0) && <div className="text-sm text-gray-500 dark:text-slate-500">Nenhuma macro para este usuário.</div>}
              {userMacros.map(m => (
                <div key={m.id} className="flex items-start justify-between theme-input p-2 rounded">
                  <div>
                    <div className="font-medium text-gray-700 dark:text-slate-200">{m.name} <span className="text-xs text-gray-500 dark:text-slate-400 ml-2">{m.shortcut}</span></div>
                    <div className="text-sm text-gray-500 dark:text-slate-400">{m.content}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(m, 'user')}><Edit className="w-4 h-4"/></Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(m.id, 'user', selectedUser || undefined)}><Trash2 className="w-4 h-4"/></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Macro editor — portal drawer */}
      {!!editing && ReactDOM.createPortal(
        <>
          <div className="fixed inset-0 z-[100] bg-black/60" onClick={handleCancel} />
          <div className="fixed inset-y-0 right-0 z-[101] w-full sm:w-[440px] bg-white dark:bg-slate-900 shadow-2xl flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-800 shrink-0">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">{editing?.id ? 'Editar Macro' : 'Nova Macro'}</h2>
              <button onClick={handleCancel} className="p-1 rounded hover:bg-gray-200/60 dark:hover:bg-slate-800/60"><X className="w-4 h-4 text-gray-500 dark:text-slate-400" /></button>
            </div>
            <div className="flex-1 p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Nome</label>
                <input autoFocus className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" placeholder="Nome" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Atalho</label>
                  <input className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" placeholder="ex: /meu" value={editing.shortcut} onChange={e => setEditing({ ...editing, shortcut: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Categoria</label>
                  <input className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" placeholder="Categoria (opcional)" value={editing.category || ''} onChange={e => setEditing({ ...editing, category: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Conteúdo</label>
                <textarea className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" rows={5} placeholder="Conteúdo da macro" value={editing.content} onChange={e => setEditing({ ...editing, content: e.target.value })} />
              </div>
            </div>
            <div className="shrink-0 px-6 py-4 border-t border-gray-200 dark:border-slate-800 flex justify-end gap-3">
              <button type="button" onClick={handleCancel} className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-slate-300 text-sm hover:bg-gray-300 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
              <button type="button" onClick={handleSave} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-500 transition-colors flex items-center gap-2"><Save className="w-4 h-4" /> Salvar</button>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

export default MacrosSettings;
