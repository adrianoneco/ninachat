import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { Users, Search, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

type ConvCardProps = {
  c: any;
  onView: (c: any) => void;
  onAssume: (c: any) => void;
  onTransfer: (c: any) => void;
};

const ConvCard: React.FC<ConvCardProps> = ({ c, onView, onAssume, onTransfer }) => (
  <div className="rounded-lg border border-gray-300/10 dark:border-slate-200/5 bg-gray-100/40 dark:bg-slate-900/40 p-4 flex items-center justify-between">
    <div>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-200/60 dark:bg-slate-800/60 flex items-center justify-center text-gray-900 dark:text-white font-semibold">{(c.contactName||'U').charAt(0)}</div>
        <div>
          <div className="font-semibold text-gray-900 dark:text-white">{c.contactName}</div>
          <div className="text-sm text-gray-500 dark:text-slate-400">{c.contactPhone}</div>
        </div>
      </div>
      <div className="text-sm text-gray-500 dark:text-slate-400 mt-3">{c.lastMessage}</div>
    </div>
    <div className="flex flex-col items-end gap-3">
      <div className="text-sm text-gray-500 dark:text-slate-400">{c.assignedUserName || '—'}</div>
      <div className="flex gap-2">
        <button onClick={() => onView(c)} className="text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:text-white">Ver</button>
        <button onClick={() => onAssume(c)} className="text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:text-white">Assumir</button>
        <button onClick={() => onTransfer(c)} className="text-rose-400 hover:text-gray-900 dark:text-white">Transferir</button>
      </div>
    </div>
  </div>
);

const Monitor: React.FC = () => {
  const [convs, setConvs] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [instances, setInstances] = useState<any[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string>('all');
  const [slaFilter, setSlaFilter] = useState<string>('all');
  const [team, setTeam] = useState<any[]>([]);
  const [page, setPage] = useState<number>(1);
  const pageSize = 8;
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  let user: any = null;
  try {
    const auth = useAuth();
    user = auth?.user ?? null;
  } catch (err) {
    // If AuthProvider is not present, fallback to null (prevents render crash)
    user = null;
  }
  const { isAdmin } = useCompanySettings();
  const getDisplayName = (u: any) => {
    if (!u) return null;
    return u.user_metadata?.full_name || u.full_name || u.name || u.email || null;
  };
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferConv, setTransferConv] = useState<any | null>(null);
  const [transferTo, setTransferTo] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [data, inst, tm] = await Promise.all([api.fetchConversations(), api.fetchInstances(), api.fetchTeam()]);
      // apply same visibility rules as the main chat: only admins/managers or assigned user can see assigned convs
      const currentMember = user ? tm.find((t: any) => t.email === user.email || t.id === user.id) : null;
      const isManager = Boolean(currentMember && (currentMember.role === 'manager' || currentMember.role === 'admin'));
      const visible = (data || []).filter((c: any) => {
        if (isAdmin || isManager) return true;
        if (!c.assignedUserId) return true;
        if (!user) return false;
        return c.assignedUserId === user.id;
      });

      setConvs(visible);
      setInstances(inst || []);
      setTeam(tm || []);
    } catch (e) {
      console.error('monitor load', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return convs.filter(c => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (selectedInstance !== 'all' && (c.instanceId || null) !== selectedInstance) return false;
      if (slaFilter === 'violated' && !c.slaViolated) return false;
      if (slaFilter === 'ok' && c.slaViolated) return false;
      if (q && !(`${c.contactName} ${c.lastMessage} ${c.contactPhone}`).toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [convs, q, statusFilter, selectedInstance, slaFilter]);

  const paged = useMemo(() => filtered.slice(0, page * pageSize), [filtered, page]);

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setPage(p => {
            const maxPages = Math.ceil(filtered.length / pageSize);
            if (p < maxPages) return p + 1;
            return p;
          });
        }
      });
    }, { root: null, rootMargin: '200px', threshold: 0.1 });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [filtered.length]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Monitoramento de Conversas</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400">Visão em tempo real das conversas</p>
        </div>
        <div className="flex items-center gap-2">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por contato ou mensagem..." className="bg-gray-100/40 dark:bg-slate-900/40 border border-gray-200 dark:border-slate-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-white w-80" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-gray-100/40 dark:bg-slate-900/40 border border-gray-200 dark:border-slate-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-white">
            <option value="all">Todos</option>
            <option value="nina">Ativas</option>
            <option value="closed">Encerrada</option>
          </select>
          <select value={selectedInstance} onChange={e => setSelectedInstance(e.target.value)} className="bg-gray-100/40 dark:bg-slate-900/40 border border-gray-200 dark:border-slate-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-white">
            <option value="all">Todas instâncias</option>
            {instances.map(inst => <option key={inst.id} value={inst.id}>{inst.name}</option>)}
          </select>
          <select value={slaFilter} onChange={e => setSlaFilter(e.target.value)} className="bg-gray-100/40 dark:bg-slate-900/40 border border-gray-200 dark:border-slate-800 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-white">
            <option value="all">SLA</option>
            <option value="violated">Violado</option>
            <option value="ok">OK</option>
          </select>
          <button onClick={() => { setQ(''); setStatusFilter('all'); setSelectedInstance('all'); setSlaFilter('all'); }} className="px-3 py-2 bg-gray-200/60 dark:bg-slate-800/60 text-sm rounded-md">Limpar</button>
          <button onClick={() => load()} title="Atualizar" className="px-2 py-2 bg-gray-200/60 dark:bg-slate-800/60 rounded-md flex items-center gap-2 text-sm">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className="grid gap-3">
        {loading && <div className="text-gray-500 dark:text-slate-400">Carregando...</div>}
        {!loading && filtered.length === 0 && <div className="text-gray-500 dark:text-slate-400">Nenhuma conversa encontrada</div>}
        {paged.map(c => (
          <ConvCard
            key={c.id}
            c={c}
            onView={() => {
              navigate(`/chat?conversation=${c.id}`);
            }}
            onAssume={async (conv) => {
              try {
                setLoading(true);
                const userId = user?.id || team[0]?.id || null;
                const userName = getDisplayName(user) || team[0]?.name || '—';
                await api.assignConversation(conv.id, userId, conv.contactId || null);
                setConvs(prev => prev.map(p => p.id === conv.id ? { ...p, assignedUserId: userId, assignedUserName: userName } : p));
              } catch (err) {
                console.error('assume error', err);
              } finally {
                setLoading(false);
              }
            }}
            onTransfer={(conv) => {
              setTransferConv(conv);
              setTransferTo(null);
              setShowTransferModal(true);
            }}
          />
        ))}
        <div ref={sentinelRef} />
        {showTransferModal && transferConv && (
          <Sheet open={showTransferModal} onOpenChange={setShowTransferModal}>
            <SheetContent side="right" className="w-full sm:max-w-sm overflow-y-auto p-0">
              <SheetHeader className="p-6 border-b border-gray-200 dark:border-slate-800">
                <SheetTitle className="text-gray-900 dark:text-white font-semibold">Transferir conversa</SheetTitle>
              </SheetHeader>
              <div className="p-6 space-y-4">
                <div className="text-sm text-gray-500 dark:text-slate-400">Conversa: <span className="text-gray-900 dark:text-white">{transferConv.contactName}</span></div>
                <select value={transferTo || ''} onChange={e => setTransferTo(e.target.value)} className="w-full bg-gray-200/40 dark:bg-slate-800/40 border border-gray-300 dark:border-slate-700 rounded-md px-3 py-2 text-gray-900 dark:text-white">
                  <option value="">Selecione um usuário</option>
                  {team.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowTransferModal(false)} className="px-3 py-2 bg-gray-200/60 dark:bg-slate-800/60 rounded-md text-sm">Cancelar</button>
                  <button onClick={async () => {
                    if (!transferTo) return alert('Selecione um usuário');
                    try {
                      setLoading(true);
                      await api.assignConversation(transferConv.id, transferTo, transferConv.contactId || null);
                      const found = team.find(t => t.id === transferTo);
                      setConvs(prev => prev.map(p => p.id === transferConv.id ? { ...p, assignedUserId: transferTo, assignedUserName: found?.name || '—' } : p));
                      setShowTransferModal(false);
                    } catch (err) {
                      console.error('transfer modal error', err);
                      alert('Erro ao transferir');
                    } finally {
                      setLoading(false);
                    }
                  }} className="px-3 py-2 bg-rose-500 text-gray-900 dark:text-white rounded-md text-sm">Confirmar</button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>
    </div>
  );
};

export default Monitor;
