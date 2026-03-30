import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, Loader2 } from 'lucide-react';
import { Button } from './Button';
import { api } from '../services/api';
import { Team, TeamFunction } from '../types';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';

interface TeamConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

type TabType = 'teams' | 'functions';

const TeamConfigModal: React.FC<TeamConfigModalProps> = ({ isOpen, onClose, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<TabType>('teams');
  const [teams, setTeams] = useState<Team[]>([]);
  const [functions, setFunctions] = useState<TeamFunction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', color: '#3b82f6' });
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [teamsData, functionsData] = await Promise.all([
        api.fetchTeams(),
        api.fetchTeamFunctions()
      ]);
      setTeams(teamsData as any);
      setFunctions(functionsData as any);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = async () => {
    if (!editForm.name.trim()) return;
    try {
      await api.createTeam({ name: editForm.name, description: editForm.description, color: editForm.color });
      setEditForm({ name: '', description: '', color: '#3b82f6' });
      setIsCreating(false);
      onUpdate();
      loadData();
    } catch (error) { console.error(error); }
  };

  const handleCreateFunction = async () => {
    if (!editForm.name.trim()) return;
    try {
      await api.createTeamFunction({ name: editForm.name, description: editForm.description });
      setEditForm({ name: '', description: '', color: '#3b82f6' });
      setIsCreating(false);
      onUpdate();
      loadData();
    } catch (error) { console.error(error); }
  };

  const handleUpdateTeam = async (id: string) => {
    try {
      await api.updateTeam(id, { name: editForm.name, description: editForm.description, color: editForm.color });
      setEditingId(null);
      setEditForm({ name: '', description: '', color: '#3b82f6' });
      onUpdate();
      loadData();
    } catch (error) { console.error(error); }
  };

  const handleUpdateFunction = async (id: string) => {
    try {
      await api.updateTeamFunction(id, { name: editForm.name, description: editForm.description });
      setEditingId(null);
      setEditForm({ name: '', description: '', color: '#3b82f6' });
      onUpdate();
      loadData();
    } catch (error) { console.error(error); }
  };

  const handleDeleteTeam = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este time?')) return;
    try { await api.deleteTeam(id); onUpdate(); loadData(); } catch (e) { console.error(e); }
  };

  const handleDeleteFunction = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta função?')) return;
    try { await api.deleteTeamFunction(id); onUpdate(); loadData(); } catch (e) { console.error(e); }
  };

  const startEdit = (item: Team | TeamFunction, type: 'team' | 'function') => {
    setEditingId(item.id);
    setEditForm({ name: item.name, description: item.description || '', color: type === 'team' ? (item as Team).color : '#3b82f6' });
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <SheetHeader className="p-6 border-b border-gray-200 dark:border-slate-800">
          <SheetTitle className="text-lg font-bold text-gray-900 dark:text-white">⚙️ Configurar Equipe</SheetTitle>
        </SheetHeader>

        <div className="flex border-b border-gray-200 dark:border-slate-800">
          <button onClick={() => setActiveTab('teams')} className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${activeTab === 'teams' ? 'text-gray-900 dark:text-white border-b-2 border-cyan-500 bg-gray-200/50 dark:bg-slate-800/50' : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:text-white'}`}>
            🏢 Times
          </button>
          <button onClick={() => setActiveTab('functions')} className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${activeTab === 'functions' ? 'text-gray-900 dark:text-white border-b-2 border-cyan-500 bg-gray-200/50 dark:bg-slate-800/50' : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:text-white'}`}>
            💼 Funções
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-cyan-500" /></div>
          ) : activeTab === 'teams' ? (
            <div className="space-y-3">
              {isCreating ? (
                <div className="card-surface space-y-3">
                  <input type="text" placeholder="Nome do time" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full theme-input text-sm" />
                  <input type="text" placeholder="Descrição (opcional)" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="w-full theme-input text-sm" />
                  <div className="flex items-center gap-2">
                    <input type="color" value={editForm.color} onChange={(e) => setEditForm({ ...editForm, color: e.target.value })} className="w-12 h-8 rounded cursor-pointer" />
                    <span className="text-xs text-gray-500 dark:text-slate-400">Cor do time</span>
                  </div>
                  <div className="flex gap-2"><Button onClick={handleCreateTeam} className="flex-1">Salvar</Button><Button onClick={() => setIsCreating(false)} variant="ghost">Cancelar</Button></div>
                </div>
              ) : (
                <button onClick={() => setIsCreating(true)} className="w-full card-surface border-dashed text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:text-white transition-colors flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> Novo Time</button>
              )}

              {teams.map((team) => (
                <div key={team.id} className="card-surface">
                  {editingId === team.id ? (
                    <div className="space-y-3">
                      <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full theme-input text-sm" />
                      <input type="text" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="w-full theme-input text-sm" />
                      <div className="flex items-center gap-2"><input type="color" value={editForm.color} onChange={(e) => setEditForm({ ...editForm, color: e.target.value })} className="w-12 h-8 rounded cursor-pointer" /></div>
                      <div className="flex gap-2"><Button onClick={() => handleUpdateTeam(team.id)} size="sm"><Save className="w-3 h-3 mr-1" /> Salvar</Button><Button onClick={() => setEditingId(null)} variant="ghost" size="sm">Cancelar</Button></div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3"><div className="w-4 h-4 rounded-full" style={{ backgroundColor: team.color }}></div><div><div className="text-sm font-medium text-gray-900 dark:text-white">{team.name}</div>{team.description && <div className="text-xs text-gray-500 dark:text-slate-400">{team.description}</div>}</div></div>
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(team, 'team')} className="p-2 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:text-white transition-colors"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteTeam(team.id)} className="p-2 text-gray-500 dark:text-slate-400 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {isCreating ? (
                <div className="card-surface space-y-3">
                  <input type="text" placeholder="Nome da função" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full theme-input text-sm" />
                  <input type="text" placeholder="Descrição (opcional)" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="w-full theme-input text-sm" />
                  <div className="flex gap-2"><Button onClick={handleCreateFunction} className="flex-1">Salvar</Button><Button onClick={() => setIsCreating(false)} variant="ghost">Cancelar</Button></div>
                </div>
              ) : (
                <button onClick={() => setIsCreating(true)} className="w-full card-surface border-dashed text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:text-white transition-colors flex items-center justify-center gap-2 p-4"><Plus className="w-4 h-4" /> Nova Função</button>
              )}

              {functions.map((func) => (
                <div key={func.id} className="card-surface">
                  {editingId === func.id ? (
                    <div className="space-y-3">
                      <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full theme-input text-sm" />
                      <input type="text" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="w-full theme-input text-sm" />
                      <div className="flex gap-2"><Button onClick={() => handleUpdateFunction(func.id)} size="sm"><Save className="w-3 h-3 mr-1" /> Salvar</Button><Button onClick={() => setEditingId(null)} variant="ghost" size="sm">Cancelar</Button></div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div><div className="text-sm font-medium text-gray-900 dark:text-white">{func.name}</div>{func.description && <div className="text-xs text-gray-500 dark:text-slate-400">{func.description}</div>}</div>
                      <div className="flex gap-2"><button onClick={() => startEdit(func, 'function')} className="p-2 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:text-white transition-colors"><Edit2 className="w-4 h-4" /></button><button onClick={() => handleDeleteFunction(func.id)} className="p-2 text-gray-500 dark:text-slate-400 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-slate-800 flex justify-end">
          <Button onClick={onClose} variant="ghost">Fechar</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default TeamConfigModal;
