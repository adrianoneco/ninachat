import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { api } from '@/services/api';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { RefreshCw, X, Eye, UserCheck, ArrowRightLeft, Clock, AlertTriangle, CheckCircle, User, Phone, MessageSquare, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { MessageImage, MessageVideo, MessageFile, MessageSticker } from '@/components/MediaRenderers';
import { useMediaUrl } from '@/hooks/useMediaUrl';

// ─── helpers ────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    livechat: { label: 'Ativo', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    closed:   { label: 'Encerrado', cls: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
    human:    { label: 'Humano', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
    bot:      { label: 'Bot', cls: 'bg-violet-500/15 text-violet-400 border-violet-500/30' },
  };
  const { label, cls } = map[status] || { label: status, cls: 'bg-gray-500/15 text-gray-400 border-gray-500/30' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${cls}`}>{label}</span>;
}

function slaIcon(violated: boolean) {
  if (violated) return <span title="SLA Violado"><AlertTriangle className="w-4 h-4 text-rose-400" /></span>;
  return <span title="SLA OK"><CheckCircle className="w-4 h-4 text-emerald-400" /></span>;
}

function avatar(name: string) {
  return (
    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/30 to-violet-500/30 border border-white/10 flex items-center justify-center text-sm font-bold text-white shrink-0">
      {(name || 'U').charAt(0).toUpperCase()}
    </div>
  );
}

function formatTime(ts: string) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 24) return `${hrs}h`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// ─── ConvCard ───────────────────────────────────────────────────────────────

const ConvCard: React.FC<{ c: any; onView: () => void; onAssume: () => void; onTransfer: () => void }> = ({ c, onView, onAssume, onTransfer }) => (
  <div className="group rounded-xl border border-gray-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 hover:border-cyan-500/30 dark:hover:border-cyan-500/30 transition-all duration-150 shadow-sm">
    <div className="flex items-center gap-4 p-4">
      {/* Avatar */}
      {avatar(c.contactName)}

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-gray-900 dark:text-white text-sm truncate max-w-[140px]">{c.contactName || 'Desconhecido'}</span>
          {statusBadge(c.status)}
          {slaIcon(c.slaViolated)}
          {c.unreadCount > 0 && (
            <span className="bg-cyan-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">{c.unreadCount}</span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-500 dark:text-slate-400">
          <Phone className="w-3 h-3" /><span>{c.contactPhone || '—'}</span>
        </div>
        <p className="mt-1.5 text-xs text-gray-500 dark:text-slate-400 truncate max-w-xs">{c.lastMessage || '—'}</p>
      </div>

      {/* Right meta */}
      <div className="flex flex-col items-end gap-2 shrink-0 ml-2">
        <span className="text-xs text-gray-400 dark:text-slate-500">{formatTime(c.lastMessageTime || c.updated_at || '')}</span>
        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400">
          <User className="w-3 h-3" />
          <span className="max-w-[80px] truncate">{c.assignedUserName || 'sem atendente'}</span>
        </div>
        {/* Actions */}
        <div className="flex gap-1">
          <button
            onClick={onView}
            title="Ver conversa"
            className="p-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-cyan-500/20 hover:text-cyan-400 text-gray-500 dark:text-slate-400 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onAssume}
            title="Assumir"
            className="p-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-emerald-500/20 hover:text-emerald-400 text-gray-500 dark:text-slate-400 transition-colors"
          >
            <UserCheck className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onTransfer}
            title="Transferir"
            className="p-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-gray-500 dark:text-slate-400 transition-colors"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  </div>
);

// ─── Simple read-only audio player ─────────────────────────────────────────

const SimpleAudio: React.FC<{ mediaUrl?: string | null }> = ({ mediaUrl }) => {
  const src = useMediaUrl(mediaUrl);
  if (!src) return <span className="text-xs text-gray-400 italic">Áudio</span>;
  return <audio src={src} controls className="max-w-full h-8" />;
};

// ─── MessageBubble (read-only, no mark-as-read) ─────────────────────────────

const MessageBubble: React.FC<{ msg: any }> = ({ msg }) => {
  const isOut = msg.from_type === 'agent' || msg.from_type === 'bot' || msg.direction === 'outgoing';
  const type = msg.type || 'text';
  const content = msg.content || '';
  const mediaUrl = msg.media_url || msg.mediaUrl || null;

  const renderMedia = () => {
    if (type === 'image') return <MessageImage mediaUrl={mediaUrl} content={content} />;
    if (type === 'video') return <MessageVideo mediaUrl={mediaUrl} content={content} />;
    if (type === 'audio') return <SimpleAudio mediaUrl={mediaUrl} />;
    if (type === 'sticker') return <MessageSticker mediaUrl={mediaUrl} content={content} />;
    if (type === 'document' || type === 'file') return <MessageFile mediaUrl={mediaUrl} content={content} />;
    return null;
  };

  const timeStr = msg.sent_at || msg.created_at || msg.timestamp || '';

  return (
    <div className={`flex mb-2 ${isOut ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm break-words ${
        isOut
          ? 'bg-gradient-to-br from-cyan-600 to-cyan-700 text-white rounded-br-sm'
          : 'bg-white dark:bg-slate-800 border border-gray-200/60 dark:border-slate-700/60 text-gray-900 dark:text-white rounded-bl-sm'
      }`}>
        {type === 'text' || !renderMedia()
          ? <p className="whitespace-pre-wrap">{content}</p>
          : renderMedia()
        }
        <div className={`flex items-center gap-1 mt-1 text-[10px] ${isOut ? 'text-white/60 justify-end' : 'text-gray-400 dark:text-slate-500 justify-end'}`}>
          {timeStr ? new Date(timeStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
          {isOut && <span className="text-[10px]">{msg.from_type === 'bot' ? '🤖' : '👤'}</span>}
        </div>
      </div>
    </div>
  );
};

// ─── ConversationViewDrawer ──────────────────────────────────────────────────

const ConversationViewDrawer: React.FC<{ conv: any; onClose: () => void }> = ({ conv, onClose }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // fetchConversationMessages does NOT mark messages as read
        const msgs = await api.fetchConversationMessages(conv.id, 100);
        if (!cancelled) {
          const sorted = [...(msgs || [])].sort((a, b) =>
            new Date(a.sent_at || a.created_at || 0).getTime() - new Date(b.sent_at || b.created_at || 0).getTime()
          );
          setMessages(sorted);
        }
      } catch (e) {
        console.error('monitor drawer load msgs', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [conv.id]);

  useEffect(() => {
    if (!loading) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' });
    }
  }, [loading, messages.length]);

  return ReactDOM.createPortal(
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-[201] w-full sm:w-[480px] bg-white dark:bg-slate-950 flex flex-col shadow-2xl border-l border-gray-200 dark:border-slate-800">

        {/* Header */}
        <div className="shrink-0 flex items-center gap-3 px-5 py-4 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800">
          {avatar(conv.contactName)}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900 dark:text-white text-sm truncate">{conv.contactName || 'Desconhecido'}</span>
              {statusBadge(conv.status)}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400 dark:text-slate-500">
              <Phone className="w-3 h-3" /><span>{conv.contactPhone || '—'}</span>
              {conv.assignedUserName && (
                <><span>·</span><User className="w-3 h-3" /><span>{conv.assignedUserName}</span></>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
              <Eye className="w-3 h-3" /> Monitorando
            </span>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 dark:text-slate-400 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50 dark:bg-slate-950">
          {loading && (
            <div className="h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-slate-500">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span className="text-sm">Carregando mensagens...</span>
              </div>
            </div>
          )}
          {!loading && messages.length === 0 && (
            <div className="h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-slate-500">
                <MessageSquare className="w-6 h-6" />
                <span className="text-sm">Nenhuma mensagem</span>
              </div>
            </div>
          )}
          {!loading && messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
          <div ref={bottomRef} />
        </div>

        {/* Footer — read-only notice */}
        <div className="shrink-0 px-5 py-3 border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <p className="text-xs text-center text-gray-400 dark:text-slate-500">
            Modo de monitoramento — leitura apenas · mensagens não serão marcadas como lidas
          </p>
        </div>
      </div>
    </>,
    document.body
  );
};

// ─── Transfer Portal ────────────────────────────────────────────────────────

const TransferDrawer: React.FC<{ conv: any; team: any[]; onClose: () => void; onConfirm: (userId: string) => void }> = ({ conv, team, onClose, onConfirm }) => {
  const [transferTo, setTransferTo] = useState('');
  return ReactDOM.createPortal(
    <>
      <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-[201] w-full sm:w-[380px] bg-white dark:bg-slate-900 flex flex-col shadow-2xl border-l border-gray-200 dark:border-slate-800">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Transferir Conversa</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 p-6 space-y-4">
          <div className="flex items-center gap-3">
            {avatar(conv.contactName)}
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{conv.contactName}</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">{conv.contactPhone}</p>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1.5">Transferir para</label>
            <select
              value={transferTo}
              onChange={e => setTransferTo(e.target.value)}
              className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">Selecione um atendente</option>
              {team.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
        <div className="shrink-0 px-5 py-4 border-t border-gray-200 dark:border-slate-800 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-slate-300 text-sm hover:bg-gray-300 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
          <button
            onClick={() => { if (transferTo) onConfirm(transferTo); }}
            disabled={!transferTo}
            className="px-4 py-2 rounded-lg bg-rose-500 text-white text-sm hover:bg-rose-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >Confirmar</button>
        </div>
      </div>
    </>,
    document.body
  );
};

// ─── Monitor ────────────────────────────────────────────────────────────────

const Monitor: React.FC = () => {
  const [convs, setConvs] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [instances, setInstances] = useState<any[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string>('all');
  const [slaFilter, setSlaFilter] = useState<string>('all');
  const [team, setTeam] = useState<any[]>([]);
  const [page, setPage] = useState<number>(1);
  const pageSize = 12;
  const [loading, setLoading] = useState(true);
  const [viewingConv, setViewingConv] = useState<any | null>(null);
  const [transferConv, setTransferConv] = useState<any | null>(null);

  let user: any = null;
  try { const auth = useAuth(); user = auth?.user ?? null; } catch { user = null; }
  const { isAdmin } = useCompanySettings();

  const getDisplayName = (u: any) => u?.user_metadata?.full_name || u?.full_name || u?.name || u?.email || null;

  const load = async () => {
    setLoading(true);
    try {
      const [data, inst, tm] = await Promise.all([api.fetchConversations(), api.fetchInstances(), api.fetchTeam()]);
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

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => convs.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (selectedInstance !== 'all' && (c.instanceId || null) !== selectedInstance) return false;
    if (slaFilter === 'violated' && !c.slaViolated) return false;
    if (slaFilter === 'ok' && c.slaViolated) return false;
    if (q && !(`${c.contactName} ${c.lastMessage} ${c.contactPhone}`).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [convs, q, statusFilter, selectedInstance, slaFilter]);

  const paged = useMemo(() => filtered.slice(0, page * pageSize), [filtered, page]);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) setPage(p => Math.min(p + 1, Math.ceil(filtered.length / pageSize)));
      });
    }, { rootMargin: '200px' });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [filtered.length]);

  // Stats
  const stats = useMemo(() => ({
    total: convs.length,
    active: convs.filter(c => c.status === 'livechat' || c.status === 'human').length,
    unassigned: convs.filter(c => !c.assignedUserId).length,
    slaViolated: convs.filter(c => c.slaViolated).length,
  }), [convs]);

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Monitoramento de Conversas</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Visão em tempo real das conversas</p>
        </div>
        <button
          onClick={load}
          title="Atualizar"
          className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg text-gray-600 dark:text-slate-300 text-sm transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, icon: MessageSquare, color: 'text-cyan-400' },
          { label: 'Ativas', value: stats.active, icon: Wifi, color: 'text-emerald-400' },
          { label: 'Sem atendente', value: stats.unassigned, icon: User, color: 'text-amber-400' },
          { label: 'SLA Violado', value: stats.slaViolated, icon: AlertTriangle, color: 'text-rose-400' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-gray-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 p-4 flex items-center gap-3">
            <s.icon className={`w-5 h-5 ${s.color} shrink-0`} />
            <div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">{s.value}</div>
              <div className="text-xs text-gray-500 dark:text-slate-400">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar por contato ou mensagem..."
          className="flex-1 min-w-[200px] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none">
          <option value="all">Todos</option>
          <option value="livechat">Ativas</option>
          <option value="closed">Encerradas</option>
          <option value="human">Humano</option>
          <option value="bot">Bot</option>
        </select>
        <select value={selectedInstance} onChange={e => setSelectedInstance(e.target.value)} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none">
          <option value="all">Todas instâncias</option>
          {instances.map(inst => <option key={inst.id} value={inst.id}>{inst.name}</option>)}
        </select>
        <select value={slaFilter} onChange={e => setSlaFilter(e.target.value)} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none">
          <option value="all">SLA</option>
          <option value="violated">Violado</option>
          <option value="ok">OK</option>
        </select>
        <button
          onClick={() => { setQ(''); setStatusFilter('all'); setSelectedInstance('all'); setSlaFilter('all'); }}
          className="px-3 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-sm rounded-lg text-gray-600 dark:text-slate-300 transition-colors"
        >
          Limpar
        </button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {loading && (
          <div className="py-12 flex flex-col items-center gap-2 text-gray-400 dark:text-slate-500">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-sm">Carregando...</span>
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="py-12 flex flex-col items-center gap-2 text-gray-400 dark:text-slate-500">
            <MessageSquare className="w-6 h-6" />
            <span className="text-sm">Nenhuma conversa encontrada</span>
          </div>
        )}
        {paged.map(c => (
          <ConvCard
            key={c.id}
            c={c}
            onView={() => setViewingConv(c)}
            onAssume={async () => {
              try {
                setLoading(true);
                const userId = user?.id || team[0]?.id || null;
                const userName = getDisplayName(user) || team[0]?.name || '—';
                await api.assignConversation(c.id, userId, c.contactId || null);
                setConvs(prev => prev.map(p => p.id === c.id ? { ...p, assignedUserId: userId, assignedUserName: userName } : p));
              } catch (err) { console.error('assume error', err); }
              finally { setLoading(false); }
            }}
            onTransfer={() => setTransferConv(c)}
          />
        ))}
        <div ref={sentinelRef} />
      </div>

      {/* Conversation view drawer */}
      {viewingConv && (
        <ConversationViewDrawer conv={viewingConv} onClose={() => setViewingConv(null)} />
      )}

      {/* Transfer drawer */}
      {transferConv && (
        <TransferDrawer
          conv={transferConv}
          team={team}
          onClose={() => setTransferConv(null)}
          onConfirm={async (userId) => {
            try {
              setLoading(true);
              await api.assignConversation(transferConv.id, userId, transferConv.contactId || null);
              const found = team.find(t => t.id === userId);
              setConvs(prev => prev.map(p => p.id === transferConv.id ? { ...p, assignedUserId: userId, assignedUserName: found?.name || '—' } : p));
              setTransferConv(null);
            } catch (err) { console.error('transfer error', err); alert('Erro ao transferir'); }
            finally { setLoading(false); }
          }}
        />
      )}
    </div>
  );
};

export default Monitor;

