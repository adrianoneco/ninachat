import React, { useEffect, useState } from 'react';
import { generateId } from '@/services/api';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';
import { Button } from '@/components/ui/button';
import { Copy, Edit, PlusCircle, Play, CheckCircle, ArrowLeft } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import InstanceCard from './InstanceCard';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { connectSocket } from '@/lib/socket';

type ChannelType = 'website' | 'api' | 'wppconnect';

const CHANNEL_OPTIONS: { id: ChannelType; label: string; icon: string; color: string }[] = [
  { id: 'website', label: 'Website', icon: '🌐', color: 'bg-slate-600' },
  { id: 'api', label: 'API', icon: '{ }', color: 'bg-cyan-600' },
  { id: 'wppconnect', label: 'WPPConnect', icon: '🔌', color: 'bg-purple-600' },
];

type Instance = {
  id: string;
  name: string;
  channel: ChannelType;
  webhook_url: string;
  created_at: string;
  status: 'connected' | 'disconnected';
  // WPPConnect
  wppconnect_api_url?: string | null;
  wppconnect_session?: string | null;
  // common
  isPrivate?: boolean;
  allowedUserIds?: string[];
  responsibleAgentId?: string | null;
  enableTicketing?: boolean;
  completed?: boolean;
  completed_at?: string | null;
};

const Instances: React.FC = () => {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showChannelPicker, setShowChannelPicker] = useState(false);
  const [newChannel, setNewChannel] = useState<ChannelType | null>(null);
  const [newForm, setNewForm] = useState<Partial<Instance>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [qrModal, setQrModal] = useState<{ session: string; qr: string } | null>(null);
  const [completedFilter, setCompletedFilter] = useState<'all'|'completed'|'incomplete'>('all');

  useEffect(() => {
    const fetchInstances = async () => {
      try {
        const res = await fetch(`${API_BASE}/instances`);
        if (res.ok) {
          const json = await res.json();
          const stored: Instance[] = json?.data ?? json ?? [];
          setInstances(stored.map(s => ({ ...s, channel: s.channel || 'website' })));
        } else {
          const text = await res.text().catch(() => res.statusText || 'Erro desconhecido');
          toast.error(`Falha ao carregar instâncias: ${res.status} ${text}`);
        }
      } catch (err: any) {
        console.error('Failed to fetch instances', err);
        toast.error('Falha ao carregar instâncias — verifique o servidor');
      }
    };
    // initial fetch
    fetchInstances();
    // poll every 5s as a fallback to keep UI in sync
    const _interval = setInterval(fetchInstances, 5000);
    return () => clearInterval(_interval);
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/team_members`);
        if (res.ok) {
          const json = await res.json();
          setTeamMembers(json?.data ?? json ?? []);
        } else {
          const text = await res.text().catch(() => res.statusText || 'Erro desconhecido');
          toast.error(`Falha ao carregar membros da equipe: ${res.status} ${text}`);
        }
      } catch (err: any) {
        console.error('Failed to fetch team members', err);
        toast.error('Falha ao carregar membros da equipe — verifique o servidor');
      }
    })();
  }, []);

  // Socket listeners for realtime WPPConnect events (QR, messages, contacts, conversations)
  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;

    const handleQr = (payload: any) => {
      const session = payload?.session;
      if (!session) return;
      const inst = instances.find(i => (i.wppconnect_session || i.id) === session);
      if (!inst) return;
      const qrVal = payload?.qr || payload?.message || payload;
      setQrModal({ session, qr: String(qrVal) });
      if (selectedId === inst.id) toast('QR recebido para ' + inst.name);
      else toast.success(`QR para ${inst.name}`);
    };

    const handleMessage = (payload: any) => {
      const session = payload?.session;
      if (!session) return;
      const inst = instances.find(i => (i.wppconnect_session || i.id) === session);
      if (!inst) return;
      // notify user that a message arrived for this instance
      toast.success(`Mensagem recebida em ${inst.name}`);
    };

    const handleGeneric = (payload: any) => {
      const session = payload?.session;
      if (!session) return;
      const inst = instances.find(i => (i.wppconnect_session || i.id) === session);
      if (!inst) return;
      // generic event debug (no toast flood)
      console.debug('wpp:event', payload);
    };

    socket.on('wpp:qr', handleQr);
    socket.on('message:received', handleMessage);
    socket.on('wpp:event', handleGeneric);
    const handleInstanceUpdated = (payload: any) => {
      const updated = payload?.id ? payload : payload?.data ?? payload;
      if (!updated) return;
      setInstances(prev => prev.map(i => {
        if (i.id === updated.id) return { ...i, ...updated } as Instance;
        if (i.wppconnect_session && updated.wppconnect_session && i.wppconnect_session === updated.wppconnect_session) return { ...i, ...updated } as Instance;
        return i;
      }));
    };
    socket.on('instance:updated', handleInstanceUpdated);

    return () => {
      socket.off('wpp:qr', handleQr);
      socket.off('message:received', handleMessage);
      socket.off('wpp:event', handleGeneric);
      socket.off('instance:updated', handleInstanceUpdated);
    };
  }, [instances, selectedId]);


  const save = async (list: Instance[]) => {
    setInstances(list);
    try {
      await fetch(`${API_BASE}/instances`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(list) });
    } catch (err) {
      console.error('Failed to save instances to backend', err);
    }
  };

  const openNewForm = (channel: ChannelType) => {
    const chLabel = CHANNEL_OPTIONS.find(c => c.id === channel)?.label || channel;
    setNewChannel(channel);
    setNewForm({
      name: `${chLabel}-${generateId().slice(0,6)}`,
      webhook_url: `/api/webhook/${channel}`,
    });
    setShowChannelPicker(false);
  };

  const confirmCreate = () => {
    if (!newChannel) return;
    const id = generateId();
    const inst: Instance = {
      id,
      name: newForm.name || `instance-${id.slice(0,6)}`,
      channel: newChannel,
      webhook_url: newForm.webhook_url || '',
      created_at: new Date().toISOString(),
      status: 'disconnected',
      wppconnect_api_url: newForm.wppconnect_api_url || null,
      wppconnect_session: newForm.wppconnect_session || null,
      isPrivate: Boolean(newForm.isPrivate),
      allowedUserIds: newForm.allowedUserIds || [],
      responsibleAgentId: newForm.responsibleAgentId || null,
      enableTicketing: Boolean(newForm.enableTicketing),
    };
    save([inst, ...instances]);
    toast.success('Instância criada');
    setNewChannel(null);
    setNewForm({});
    setSelectedId(id);
  };

  const cancelCreate = () => {
    setNewChannel(null);
    setNewForm({});
  };

  const selectInstance = (id: string) => {
    setSelectedId(id);
    setEditingId(null);
    setEditingValue('');
    // join socket room for this session so the edit/monitor sheet receives session-scoped events
    try {
      const inst = instances.find(i => i.id === id);
      const session = inst?.wppconnect_session || id;
      const socket = connectSocket();
      if (socket && session) socket.emit('join', session);
    } catch (e) {
      // ignore
    }
  };

  const handleDelete = (id: string) => {
    const next = instances.filter(i => i.id !== id);
    save(next);
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/instances/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Delete failed');
        toast.success('Instância removida do servidor');
      } catch (err: any) {
        console.error('Failed to delete instance on server', err);
        toast.error('Falha ao remover no servidor — verifique o backend');
      }
    })();
  };

  const handleToggle = (id: string) => {
    const next = instances.map(i => i.id === id ? { ...i, status: (i.status === 'connected' ? 'disconnected' : 'connected') as Instance['status'] } : i);
    save(next);
  };

  const togglePrivate = (id: string) => {
    const next = instances.map(i => i.id === id ? { ...i, isPrivate: !i.isPrivate } : i);
    save(next);
  };

  const toggleAllowedUser = (id: string, userId: string) => {
    const next = instances.map(i => {
      if (i.id !== id) return i;
      const allowed = new Set(i.allowedUserIds || []);
      if (allowed.has(userId)) allowed.delete(userId); else allowed.add(userId);
      return { ...i, allowedUserIds: Array.from(allowed) };
    });
    save(next);
  };

  const toggleEnableTicketing = (id: string) => {
    const next = instances.map(i => i.id === id ? { ...i, enableTicketing: !i.enableTicketing } : i);
    save(next);
  };

  const handleCopy = (text: string) => navigator.clipboard.writeText(text);

  const startEdit = (inst: Instance) => {
    setEditingId(inst.id);
    setEditingValue(inst.webhook_url);
  };
  const cancelEdit = () => { setEditingId(null); setEditingValue(''); };
  const saveEdit = (id: string) => {
    if (!/^https?:\/\/.+/i.test(editingValue.trim())) { toast.error('URL inválida'); return; }
    const next = instances.map(i => i.id === id ? { ...i, webhook_url: editingValue.trim() } : i);
    save(next);
    setEditingId(null); setEditingValue(''); toast.success('Webhook salvo');
  };

  const testWebhook = async (url: string) => {
    try {
      const resp = await fetch(`${API_BASE}/test-webhook`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, method: 'POST', body: { from: 'system-test', to: 'instance-test', text: 'Teste de webhook' } }),
      });
      if (!resp.ok) throw new Error(`Status ${resp.status}`);
      toast.success('Teste enviado');
    } catch (err: any) {
      console.error('Webhook test failed', err);
      toast.error('Falha no teste');
    }
  };

  const updateField = (id: string, field: string, value: any) => {
    setInstances(prev => {
      const next = prev.map(i => i.id === id ? { ...i, [field]: value } : i);
      fetch(`${API_BASE}/instances`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) }).catch(() => {});
      return next;
    });
  };

  const renderChannelConfig = (inst: Instance) => {
    if (inst.channel === 'wppconnect') {
      return (
        <div className="p-4 rounded-lg card-surface space-y-3">
          <h5 className="text-sm font-medium">WPPConnect</h5>
          <div>
            <label className="text-xs text-gray-500">Session</label>
            <input readOnly className="w-full theme-input" value={inst.wppconnect_session || inst.id} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={async () => {
              try {
                const res = await fetch(`${API_BASE}/instances/${encodeURIComponent(inst.id)}/start`, { method: 'POST' });
                if (res.ok) {
                  updateField(inst.id, 'status', 'connected');
                  updateField(inst.id, 'completed', true);
                  updateField(inst.id, 'completed_at', new Date().toISOString());
                  toast.success('Sessão iniciada');
                } else {
                  const txt = await res.text().catch(() => res.statusText || 'Erro');
                  toast.error('Falha ao iniciar sessão: ' + txt);
                }
              } catch (err: any) { console.error(err); toast.error('Erro ao iniciar sessão'); }
            }} className="flex-1">Iniciar</Button>
            <Button onClick={async () => {
              try {
                const res = await fetch(`${API_BASE}/instances/${encodeURIComponent(inst.id)}/stop`, { method: 'POST' });
                if (res.ok) {
                  updateField(inst.id, 'status', 'disconnected');
                  toast.success('Sessão parada');
                } else {
                  const txt = await res.text().catch(() => res.statusText || 'Erro');
                  toast.error('Falha ao parar sessão: ' + txt);
                }
              } catch (err: any) { console.error(err); toast.error('Erro ao parar sessão'); }
            }} className="flex-1">Parar</Button>
          </div>
          <div className="pt-2">
            <Button variant="ghost" onClick={() => selectInstance(inst.id)}>Abrir monitor</Button>
          </div>
        </div>
      );
    }

    return (
      <div className="p-4 rounded-lg card-surface">
        <h5 className="text-sm font-medium">Configuração</h5>
        <p className="text-sm text-gray-500">Nenhuma configuração adicional para este canal.</p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">Instâncias</h3>
        <Button onClick={() => setShowChannelPicker(true)} className="gap-2 bg-violet-600"> <PlusCircle className="w-4 h-4" /> Nova</Button>
      </div>

      <div>
        {instances.length === 0 ? (
          <div className="p-8 rounded-xl border border-dashed text-center">Nenhuma instância encontrada.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {instances.filter(i => completedFilter === 'all' ? true : completedFilter === 'completed' ? i.completed : !i.completed).map(inst => (
              <InstanceCard
                key={inst.id}
                instance={inst as any}
                selected={selectedId === inst.id}
                onSelect={() => selectInstance(inst.id)}
                onDelete={() => handleDelete(inst.id)}
                onTest={(url) => testWebhook(url)}
                onCopy={(t) => handleCopy(t)}
                onToggleComplete={(id, value) => { updateField(id, 'completed', value); updateField(id, 'completed_at', value ? new Date().toISOString() : null); }}
              />
            ))}
          </div>
        )}
      </div>

      <Sheet open={showChannelPicker && !newChannel} onOpenChange={(open) => { if (!open) setShowChannelPicker(false); }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
          <SheetHeader className="p-6 border-b">
            <SheetTitle>Escolha um canal</SheetTitle>
          </SheetHeader>
          <div className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {CHANNEL_OPTIONS.map(ch => (
                <button key={ch.id} onClick={() => openNewForm(ch.id)} className="flex flex-col items-center gap-3 p-5 rounded-xl border bg-gray-100/40 hover:border-violet-500">
                  <div className={`h-14 w-14 rounded-xl ${ch.color} flex items-center justify-center text-2xl text-white`}>{ch.icon}</div>
                  <span className="text-sm font-medium">{ch.label}</span>
                </button>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
      {qrModal && (() => {
        const inst = instances.find(i => (i.wppconnect_session || i.id) === qrModal.session);
        const qrStr = qrModal.qr || '';
        const isDataUrl = qrStr.startsWith('data:image');
        const qrImgSrc = isDataUrl ? qrStr : `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrStr)}`;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => setQrModal(null)} />
            <div className="relative bg-white dark:bg-slate-900 rounded-lg shadow-lg p-6 w-[360px] max-w-[95%] z-10">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-sm text-gray-500">Pareamento</div>
                  <div className="text-lg font-bold">{inst?.name || qrModal.session}</div>
                </div>
                <button onClick={() => setQrModal(null)} className="text-sm text-gray-500">Fechar</button>
              </div>
              <div className="flex flex-col items-center gap-4">
                <img src={qrImgSrc} alt="QR" className="w-64 h-64 object-contain bg-white p-2" />
                <div className="flex gap-2">
                  <Button onClick={() => { navigator.clipboard.writeText(qrStr || ''); toast.success('QR copiado'); }}>Copiar</Button>
                  <a className="px-4 py-2 rounded bg-gray-100 text-sm" href={qrImgSrc} download={`qr-${qrModal.session}.png`}>Download</a>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <Sheet open={!!newChannel} onOpenChange={(open) => { if (!open) cancelCreate(); }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
          {newChannel && (() => {
            const chInfo = CHANNEL_OPTIONS.find(c => c.id === newChannel);
            return (
              <>
                <SheetHeader className="p-6 border-b">
                  <div className="flex items-center gap-3">
                    <button onClick={() => { setNewChannel(null); setShowChannelPicker(true); }} className="p-1.5 rounded"><ArrowLeft className="w-4 h-4" /></button>
                    {chInfo && <div className={`h-9 w-9 rounded-lg ${chInfo.color} flex items-center justify-center text-lg text-white`}>{chInfo.icon}</div>}
                    <div>
                      <SheetTitle>Nova instância — {chInfo?.label}</SheetTitle>
                    </div>
                  </div>
                </SheetHeader>
                <div className="space-y-4 p-6">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Nome da instância</label>
                    <input type="text" value={newForm.name || ''} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} className="w-full theme-input" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Webhook URL</label>
                    <input type="text" value={newForm.webhook_url || ''} onChange={(e) => setNewForm({ ...newForm, webhook_url: e.target.value })} className="w-full theme-input" />
                  </div>
                  {newChannel === 'wppconnect' && (
                    <></>
                  )}

                  <div className="flex gap-3 pt-2">
                    <Button onClick={confirmCreate} className="flex-1 bg-violet-600">Criar instância</Button>
                    <Button variant="ghost" onClick={cancelCreate}>Cancelar</Button>
                  </div>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      <Sheet open={!!selectedId} onOpenChange={(open) => { if (!open) { setSelectedId(null); setEditingId(null); setEditingValue(''); } }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
          {selectedId && (() => {
            const inst = instances.find(i => i.id === selectedId)!;
            if (!inst) return null;
            const chInfo = CHANNEL_OPTIONS.find(c => c.id === inst.channel);
            return (
              <>
                <SheetHeader className="p-6 border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {chInfo && <div className={`h-9 w-9 rounded-lg ${chInfo.color} flex items-center justify-center text-lg text-white`}>{chInfo.icon}</div>}
                      <div>
                        <SheetTitle>{inst.name}</SheetTitle>
                        <p className="text-xs text-gray-500 mt-0.5">{chInfo?.label || inst.channel} · Criado em {new Date(inst.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <button onClick={() => handleToggle(inst.id)} className={`px-3 py-1 rounded text-sm ${inst.status === 'connected' ? 'bg-emerald-600' : 'bg-gray-300'}`}>{inst.status === 'connected' ? 'Conectado' : 'Desconectado'}</button>
                  </div>
                </SheetHeader>

                <div className="space-y-4 p-6">
                  <div>
                    <label className="text-xs text-gray-500">Webhook</label>
                    <div className="mt-2">
                      {editingId === inst.id ? (
                        <div className="flex gap-2 items-center">
                          <input value={editingValue} onChange={(e) => setEditingValue(e.target.value)} className="flex-1" />
                          <button onClick={() => saveEdit(inst.id)} className="px-3 py-2 bg-emerald-600">Salvar</button>
                          <button onClick={cancelEdit} className="px-3 py-2 bg-gray-300">Cancelar</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 break-all font-mono">{inst.webhook_url}</div>
                          <button onClick={() => handleCopy(inst.webhook_url)} className="p-2"><Copy /></button>
                          <button onClick={() => startEdit(inst)} className="p-2"><Edit /></button>
                        </div>
                      )}
                    </div>
                  </div>

                  {renderChannelConfig(inst)}

                  <div className="p-4 rounded-lg card-surface">
                    <h5 className="text-sm font-medium mb-3">Chamados (Tickets)</h5>
                    <label className="flex items-center gap-2 text-sm">
                      <Switch checked={Boolean(inst.enableTicketing)} onCheckedChange={() => toggleEnableTicketing(inst.id)} />
                      <span className="text-sm">Ativar gerenciamento de chamados</span>
                    </label>
                  </div>

                  <div className="p-4 rounded-lg card-surface">
                    <h5 className="text-sm font-medium mb-3">Privacidade</h5>
                    <label className="flex items-center gap-2 text-sm">
                      <Switch checked={Boolean(inst.isPrivate)} onCheckedChange={() => togglePrivate(inst.id)} />
                      <span className="text-sm">Instância privada</span>
                    </label>
                    <div className="mt-2 space-y-2">
                      {teamMembers.map((m: any) => (
                        <label key={m.id} className="flex items-center gap-2 text-sm">
                          <Switch checked={Boolean(inst.allowedUserIds?.includes(m.id))} onCheckedChange={() => toggleAllowedUser(inst.id, m.id)} />
                          <span className="text-sm">{m.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Instances;
