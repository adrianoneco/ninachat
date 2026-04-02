import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { generateId } from '@/services/api';
import { Trash, PlusCircle, Play, Check, X, Save } from 'lucide-react';
import { toast } from 'sonner';

type Webhook = {
  id: string;
  name: string;
  url: string;
  events: string[];
  enabled: boolean;
  created_at: string;
};

const AVAILABLE_EVENTS = ['message.created', 'message.delivered', 'contact.created', 'conversation.started'];

const Webhooks: React.FC = () => {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [creating, setCreating] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<Webhook>({ id: '', name: '', url: '', events: ['message.created'], enabled: false, created_at: '' });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const API_BASE = import.meta.env.VITE_API_BASE || '/api';
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/global_webhooks`);
        if (res.ok) {
          const json = await res.json();
          const data = json?.data ?? json;
          setWebhooks(Array.isArray(data) ? data : []);
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  const upsertWebhook = async (webhook: Webhook) => {
    const API_BASE = import.meta.env.VITE_API_BASE || '/api';
    try {
      await fetch(`${API_BASE}/global_webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhook),
      });
    } catch (err) {
      console.error('Failed to save webhook', err);
    }
  };

  const deleteWebhook = async (id: string) => {
    const API_BASE = import.meta.env.VITE_API_BASE || '/api';
    try {
      await fetch(`${API_BASE}/global_webhooks/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to delete webhook', err);
    }
  };

  const handleCreate = () => {
    const id = generateId();
    setDraft({ id, name: '', url: '', events: ['message.created'], enabled: false, created_at: new Date().toISOString() });
    setSheetOpen(true);
  };

  const handleSaveDraft = async () => {
    if (!draft.name.trim() || !draft.url.trim()) {
      toast.error('Preencha o nome e a URL do webhook.');
      return;
    }
    await upsertWebhook(draft);
    setWebhooks(prev => [draft, ...prev]);
    setSheetOpen(false);
    setCreating(true);
    setTimeout(() => setCreating(false), 200);
  };

  const handleDelete = async (id: string) => {
    await deleteWebhook(id);
    setWebhooks(prev => prev.filter(w => w.id !== id));
  };

  const toggleEnabled = async (id: string) => {
    const updated = webhooks.map(w => w.id === id ? { ...w, enabled: !w.enabled } : w);
    setWebhooks(updated);
    const webhook = updated.find(w => w.id === id);
    if (webhook) await upsertWebhook(webhook);
  };

  const updateField = (id: string, patch: Partial<Webhook>) => {
    setWebhooks(prev => prev.map(w => w.id === id ? { ...w, ...patch } : w));
  };

  const handleBlurSave = async (id: string) => {
    const webhook = webhooks.find(w => w.id === id);
    if (webhook) await upsertWebhook(webhook);
  };

  const testWebhook = async (url: string) => {
    try {
      const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ test: true, ts: new Date().toISOString() }) });
      if (!resp.ok) throw new Error(`Status ${resp.status}`);
      toast.success('Teste enviado com sucesso');
    } catch (err: any) {
      console.error('Webhook test failed', err);
      toast.error('Falha no teste: ' + (err?.message || String(err)));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Integração Webhooks (Global)</h3>
        <div>
          <button onClick={handleCreate} className="px-3 py-2 bg-gray-200/40 dark:bg-slate-800/40 rounded text-sm flex items-center gap-2"><PlusCircle className="w-4 h-4" /> Nova</button>
        </div>
      </div>

      <div className="space-y-3">
        {loading && <div className="text-sm text-gray-500 dark:text-slate-400">Carregando webhooks...</div>}
        {!loading && webhooks.length === 0 && <div className="p-4 rounded bg-gray-100/40 dark:bg-slate-900/40 text-gray-500 dark:text-slate-400">Nenhum webhook configurado.</div>}

        {webhooks.map(w => (
          <div key={w.id} className="p-4 rounded border border-gray-200 dark:border-slate-800 bg-gray-100/30 dark:bg-slate-900/30 flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <input className="bg-gray-200/40 dark:bg-slate-800/40 rounded px-2 py-1 text-sm text-gray-900 dark:text-white" value={w.name} onChange={(e) => updateField(w.id, { name: e.target.value })} onBlur={() => handleBlurSave(w.id)} />
                <span className={`text-xs px-2 py-0.5 rounded ${w.enabled ? 'bg-emerald-600 text-gray-900 dark:text-white' : 'bg-gray-300 dark:bg-slate-700 text-gray-700 dark:text-slate-200'}`}>{w.enabled ? 'Ativo' : 'Inativo'}</span>
              </div>
              <div className="mt-2">
                <input className="w-full bg-gray-200/40 dark:bg-slate-800/40 rounded px-3 py-2 text-sm text-gray-900 dark:text-white" placeholder="https://example.com/webhook" value={w.url} onChange={(e) => updateField(w.id, { url: e.target.value })} onBlur={() => handleBlurSave(w.id)} />
              </div>
              <div className="mt-2 text-xs text-gray-500 dark:text-slate-400">Eventos:</div>
              <div className="flex flex-wrap gap-2 mt-2">
                {AVAILABLE_EVENTS.map(ev => {
                  const active = (w.events ?? []).includes(ev);
                  return (
                    <button
                      key={ev}
                      type="button"
                      onClick={() => {
                        const nextEvents = active ? (w.events ?? []).filter(x => x !== ev) : [...(w.events ?? []), ev];
                          const updated = { ...w, events: nextEvents };
                          updateField(w.id, { events: nextEvents });
                          upsertWebhook(updated);
                      }}
                      className={`inline-flex items-center gap-2 text-sm select-none rounded px-2 py-1 transition-colors ${active ? 'bg-emerald-600 text-white' : 'bg-gray-200/30 dark:bg-slate-800/30 text-gray-700 dark:text-slate-200'}`}
                    >
                      {active ? <Check className="w-4 h-4" /> : <span className="w-4 h-4" />}
                      <span className="leading-none">{ev}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <button onClick={() => toggleEnabled(w.id)} className="px-3 py-1 rounded bg-gray-200/40 dark:bg-slate-800/40 text-sm">Toggle</button>
              <button onClick={() => testWebhook(w.url)} className="px-3 py-1 rounded bg-gray-200/40 dark:bg-slate-800/40 text-sm flex items-center gap-2"><Play className="w-4 h-4" /> Testar</button>
              <button onClick={() => handleDelete(w.id)} className="px-3 py-1 rounded bg-rose-700/20 text-rose-300 text-sm flex items-center gap-2"><Trash className="w-4 h-4" /> Deletar</button>
            </div>
          </div>
        ))}
      </div>

      {/* New Webhook Drawer — portal to body to escape overflow:hidden */}
      {sheetOpen && ReactDOM.createPortal(
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[100] bg-black/60"
            onClick={() => setSheetOpen(false)}
          />
          {/* Drawer */}
          <div className="fixed inset-y-0 right-0 z-[101] w-full sm:w-[420px] bg-white dark:bg-slate-900 shadow-2xl flex flex-col overflow-y-auto transition-transform">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-800 shrink-0">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Novo Webhook</h2>
              <button onClick={() => setSheetOpen(false)} className="p-1 rounded hover:bg-gray-200/60 dark:hover:bg-slate-800/60">
                <X className="w-4 h-4 text-gray-500 dark:text-slate-400" />
              </button>
            </div>
            {/* Body */}
            <div className="flex-1 p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Nome</label>
                <input
                  autoFocus
                  className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="Nome do webhook"
                  value={draft.name}
                  onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">URL</label>
                <input
                  className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="https://example.com/webhook"
                  value={draft.url}
                  onChange={e => setDraft(d => ({ ...d, url: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Eventos</label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_EVENTS.map(ev => {
                    const active = draft.events.includes(ev);
                    return (
                      <button
                        key={ev}
                        type="button"
                        onClick={() => {
                          const next = active ? draft.events.filter(x => x !== ev) : [...draft.events, ev];
                          setDraft(d => ({ ...d, events: next }));
                        }}
                        className={`inline-flex items-center gap-2 text-sm rounded-lg px-3 py-1.5 border transition-colors ${active ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-gray-100 dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300'}`}
                      >
                        {active && <Check className="w-3.5 h-3.5" />}
                        {ev}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700 dark:text-slate-300">Ativar agora</label>
                <button
                  type="button"
                  onClick={() => setDraft(d => ({ ...d, enabled: !d.enabled }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${draft.enabled ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-slate-700'}`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${draft.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
            {/* Footer */}
            <div className="shrink-0 px-6 py-4 border-t border-gray-200 dark:border-slate-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-slate-300 text-sm hover:bg-gray-300 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveDraft}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-500 transition-colors flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> Salvar
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

export default Webhooks;
