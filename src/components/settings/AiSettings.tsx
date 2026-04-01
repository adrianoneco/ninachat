import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Cpu, Eye, EyeOff, Key, Globe } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { api, generateId } from '@/services/api';

const AI_PROVIDERS = [
  { id: 'openai',    name: 'OpenAI',         badge: 'GPT',     models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],                              defaultModel: 'gpt-4o-mini',              keyPlaceholder: 'sk-...' },
  { id: 'google',    name: 'Google Gemini',  badge: 'Gemini',  models: ['gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],            defaultModel: 'gemini-2.0-flash',         keyPlaceholder: 'AIza...' },
  { id: 'anthropic', name: 'Anthropic',      badge: 'Claude',  models: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-3-5-haiku-20241022'],                  defaultModel: 'claude-3-5-haiku-20241022', keyPlaceholder: 'sk-ant-...' },
  { id: 'groq',      name: 'Groq',           badge: 'Groq',    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],             defaultModel: 'llama-3.3-70b-versatile',  keyPlaceholder: 'gsk_...' },
  { id: 'deepseek',  name: 'DeepSeek',       badge: 'DS',      models: ['deepseek-chat', 'deepseek-reasoner'],                                                  defaultModel: 'deepseek-chat',            keyPlaceholder: 'sk-...' },
  { id: 'mistral',   name: 'Mistral AI',     badge: 'Mistral', models: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest'],                   defaultModel: 'mistral-small-latest',     keyPlaceholder: 'xxxxx' },
  { id: 'ollama',    name: 'Ollama (Local)', badge: 'Local',   models: ['llama3.2', 'llama3.1', 'mistral', 'codellama', 'qwen2.5', 'phi3'],                   defaultModel: 'llama3.2',                 keyPlaceholder: '—' },
];

export interface AiSettingsRef {
  save: () => Promise<void>;
  cancel: () => void;
  isSaving: boolean;
  isDirty: boolean;
}

const DEFAULTS = {
  // Copilot
  ai_copilot_enabled: false,
  ai_copilot_model: 'gpt-4o-mini',
  ai_copilot_system_prompt: 'Seja um assistente útil e conciso.',
  ai_copilot_temperature: 0.2,
  // Resumos
  ai_autosummary_enabled: true,
  ai_summary_length: 'short',
  // Verificação
  ai_behavior_verification_enabled: false,
  ai_behavior_events: ['conversation_end'],
  ai_behavior_sample_size: 50,
  // Global provider
  ai_global_provider: 'openai',
  ai_global_api_key: null as string | null,
  ai_global_model: 'gpt-4o-mini',
  ai_global_base_url: null as string | null,
  // Copilot override
  ai_copilot_use_own: false,
  ai_copilot_provider: 'openai',
  ai_copilot_api_key: null as string | null,
  ai_copilot_base_url: null as string | null,
  // Resumos override
  ai_summary_use_own: false,
  ai_summary_provider: 'openai',
  ai_summary_api_key: null as string | null,
  ai_summary_model: 'gpt-4o-mini',
  ai_summary_base_url: null as string | null,
  // Verificação override
  ai_behavior_use_own: false,
  ai_behavior_provider: 'openai',
  ai_behavior_api_key: null as string | null,
  ai_behavior_model: 'gpt-4o-mini',
  ai_behavior_base_url: null as string | null,
};

const AiSettings = forwardRef<AiSettingsRef, { onDirtyChange?: (dirty: boolean) => void }>(({ onDirtyChange }, ref) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  const toggleKey = (k: string) => setShowApiKeys(p => ({ ...p, [k]: !p[k] }));
  const [settings, setSettings] = useState<any>({ ...DEFAULTS });
  const committedRef = useRef<string>('not-loaded');
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (committedRef.current === 'not-loaded') return;
    const dirty = JSON.stringify(settings) !== committedRef.current;
    setIsDirty(dirty);
    onDirtyChange?.(dirty);
  }, [settings]);

  useImperativeHandle(ref, () => ({ save: handleSave, cancel: loadSettings, isSaving: saving, isDirty }));

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const API_BASE = import.meta.env.VITE_API_BASE || '/api';
      try {
        // Try backend
        const res = await fetch(`${API_BASE}/livechat_settings`);
        if (res.ok) {
          const json = await res.json();
          const data = json?.data ?? json;
          const newSettings = { ...DEFAULTS, ...(data || {}) };
          committedRef.current = JSON.stringify(newSettings);
          setIsDirty(false);
          onDirtyChange?.(false);
          setSettings(newSettings);
          setLoading(false);
          return;
        }
      } catch {}
      const newSettings = { ...DEFAULTS };
      committedRef.current = JSON.stringify(newSettings);
      setIsDirty(false);
      onDirtyChange?.(false);
      setSettings(newSettings);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[AiSettings] load', err);
      toast.error('Erro ao carregar configurações de IA');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const API_BASE = import.meta.env.VITE_API_BASE || '/api';
      const current = await (async () => {
        try {
          const res = await fetch(`${API_BASE}/livechat_settings`);
          if (res.ok) { const json = await res.json(); return json?.data ?? json ?? {}; }
        } catch {}
        return {};
      })();
      const merged = {
        ...current,
        ai_copilot_enabled: settings.ai_copilot_enabled,
        ai_copilot_model: settings.ai_copilot_model,
        ai_copilot_system_prompt: settings.ai_copilot_system_prompt,
        ai_copilot_temperature: Number(settings.ai_copilot_temperature),
        ai_autosummary_enabled: settings.ai_autosummary_enabled,
        ai_summary_length: settings.ai_summary_length,
        ai_behavior_verification_enabled: settings.ai_behavior_verification_enabled,
        ai_behavior_events: settings.ai_behavior_events,
        ai_behavior_sample_size: Number(settings.ai_behavior_sample_size),
        // global provider
        ai_global_provider: settings.ai_global_provider,
        ai_global_api_key: settings.ai_global_api_key,
        ai_global_model: settings.ai_global_model,
        ai_global_base_url: settings.ai_global_base_url,
        // copilot override
        ai_copilot_use_own: settings.ai_copilot_use_own,
        ai_copilot_provider: settings.ai_copilot_provider,
        ai_copilot_api_key: settings.ai_copilot_api_key,
        ai_copilot_base_url: settings.ai_copilot_base_url,
        // resumos override
        ai_summary_use_own: settings.ai_summary_use_own,
        ai_summary_provider: settings.ai_summary_provider,
        ai_summary_api_key: settings.ai_summary_api_key,
        ai_summary_model: settings.ai_summary_model,
        ai_summary_base_url: settings.ai_summary_base_url,
        // verificação override
        ai_behavior_use_own: settings.ai_behavior_use_own,
        ai_behavior_provider: settings.ai_behavior_provider,
        ai_behavior_api_key: settings.ai_behavior_api_key,
        ai_behavior_model: settings.ai_behavior_model,
        ai_behavior_base_url: settings.ai_behavior_base_url,
        updated_at: new Date().toISOString(),
      };
      // Try backend first
      try {
        const res = await fetch(`${API_BASE}/livechat_settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(merged) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        console.error('[AiSettings] backend save failed', err);
        throw err;
      }
      committedRef.current = JSON.stringify(merged);
      setIsDirty(false);
      onDirtyChange?.(false);
      toast.success('Configurações de IA salvas');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[AiSettings] save', err);
      toast.error('Erro ao salvar configurações de IA');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>;

  return (
    <div className="space-y-6">

      {/* Configuração Global de API */}
      <div className="rounded-xl border border-cyan-500/20 bg-gray-100/50 dark:bg-slate-900/50 p-6">
        <div className="flex items-center gap-3 mb-5">
          <Globe className="w-5 h-5 text-cyan-400" />
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Configuração Global de Provedores</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Todos os módulos usam este provedor por padrão. Cada módulo pode sobrescrever abaixo.</p>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-2 block">Provedor padrão</label>
            <div className="grid grid-cols-4 gap-2">
              {AI_PROVIDERS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSettings({ ...settings, ai_global_provider: p.id, ai_global_model: p.defaultModel })}
                  className={`p-2.5 rounded-lg border text-center transition-all ${
                    settings.ai_global_provider === p.id
                      ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300'
                      : 'bg-white/50 dark:bg-slate-950/50 border-gray-200 dark:border-slate-800 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="text-[11px] font-semibold leading-tight">{p.name}</div>
                  <div className={`mt-1 text-[10px] ${settings.ai_global_provider === p.id ? 'text-cyan-400/70' : 'text-gray-400 dark:text-slate-600'}`}>{p.badge}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5 block">Modelo padrão</label>
              <select
                value={settings.ai_global_model || ''}
                onChange={e => setSettings({ ...settings, ai_global_model: e.target.value })}
                className="w-full bg-gray-200/50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2.5 text-gray-900 dark:text-white text-sm"
              >
                {(AI_PROVIDERS.find(p => p.id === settings.ai_global_provider)?.models ?? []).map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5 block">API Key global</label>
              <div className="relative">
                <input
                  type={showApiKeys['global'] ? 'text' : 'password'}
                  value={settings.ai_global_api_key || ''}
                  onChange={e => setSettings({ ...settings, ai_global_api_key: e.target.value || null })}
                  placeholder={AI_PROVIDERS.find(p => p.id === settings.ai_global_provider)?.keyPlaceholder || 'api-key'}
                  className="w-full bg-gray-200/50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2.5 text-gray-900 dark:text-white text-sm pr-10"
                />
                <button type="button" onClick={() => toggleKey('global')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:text-white">
                  {showApiKeys['global'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5 block">Base URL <span className="text-gray-500 dark:text-slate-500 font-normal">(opcional, para proxies ou Ollama)</span></label>
            <input
              type="text"
              value={settings.ai_global_base_url || ''}
              onChange={e => setSettings({ ...settings, ai_global_base_url: e.target.value || null })}
              placeholder="https://api.exemplo.com/v1"
              className="w-full bg-gray-200/50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2.5 text-gray-900 dark:text-white text-sm"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-100/50 dark:bg-slate-900/50 p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Copilot</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">Configurações do assistente Copilot que influencia respostas automáticas e prompts.</p>

          <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
            <Switch checked={!!settings.ai_copilot_enabled} onCheckedChange={(v: boolean) => setSettings({ ...settings, ai_copilot_enabled: Boolean(v) })} />
            Habilitar Copilot
          </label>

          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Modelo</label>
            <select value={settings.ai_copilot_model} onChange={(e) => setSettings({ ...settings, ai_copilot_model: e.target.value })} className="w-full bg-gray-200/50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm">
              <option value="gpt-5-mini">gpt-5-mini</option>
              <option value="gpt-4o">gpt-4o</option>
              <option value="gpt-4">gpt-4</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">System prompt (padrão)</label>
            <textarea value={settings.ai_copilot_system_prompt} onChange={(e) => setSettings({ ...settings, ai_copilot_system_prompt: e.target.value })} rows={3} className="w-full bg-gray-200/50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm" />
          </div>

          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Temperatura</label>
            <input type="range" min={0} max={1} step={0.05} value={Number(settings.ai_copilot_temperature)} onChange={(e) => setSettings({ ...settings, ai_copilot_temperature: Number(e.target.value) })} className="w-full" />
            <div className="text-xs text-gray-500 dark:text-slate-400">{Number(settings.ai_copilot_temperature).toFixed(2)}</div>
          </div>

          {/* Provedor específico para Copilot */}
          <div className="pt-4 border-t border-gray-300/50 dark:border-slate-700/50">
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300 cursor-pointer">
              <Switch checked={!!settings.ai_copilot_use_own} onCheckedChange={(v: boolean) => setSettings({ ...settings, ai_copilot_use_own: Boolean(v) })} />
              Usar provedor específico para Copilot
            </label>
            {settings.ai_copilot_use_own && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Provedor</label>
                  <select value={settings.ai_copilot_provider || 'openai'} onChange={e => setSettings({ ...settings, ai_copilot_provider: e.target.value, ai_copilot_model: AI_PROVIDERS.find(p => p.id === e.target.value)?.defaultModel || '' })} className="w-full bg-gray-200/50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm">
                    {AI_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Modelo</label>
                  <select value={settings.ai_copilot_model || ''} onChange={e => setSettings({ ...settings, ai_copilot_model: e.target.value })} className="w-full bg-gray-200/50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm">
                    {(AI_PROVIDERS.find(p => p.id === (settings.ai_copilot_provider || 'openai'))?.models ?? []).map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">API Key</label>
                  <div className="relative">
                    <input type={showApiKeys['copilot'] ? 'text' : 'password'} value={settings.ai_copilot_api_key || ''} onChange={e => setSettings({ ...settings, ai_copilot_api_key: e.target.value || null })} placeholder={AI_PROVIDERS.find(p => p.id === (settings.ai_copilot_provider || 'openai'))?.keyPlaceholder || ''} className="w-full bg-gray-200/50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm pr-10" />
                    <button type="button" onClick={() => toggleKey('copilot')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:text-white">{showApiKeys['copilot'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-100/50 dark:bg-slate-900/50 p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Resumos Automáticos</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">Configurações para geração automática de resumos de conversa.</p>

        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
            <Switch checked={!!settings.ai_autosummary_enabled} onCheckedChange={(v: boolean) => setSettings({ ...settings, ai_autosummary_enabled: Boolean(v) })} />
            Habilitar resumos automáticos
          </label>

          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Tamanho do resumo</label>
            <select value={settings.ai_summary_length} onChange={(e) => setSettings({ ...settings, ai_summary_length: e.target.value })} className="w-full bg-gray-200/50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm">
              <option value="short">Curto</option>
              <option value="medium">Médio</option>
              <option value="long">Longo</option>
            </select>
          </div>

          {/* Provedor específico para Resumos */}
          <div className="pt-4 border-t border-gray-300/50 dark:border-slate-700/50">
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300 cursor-pointer">
              <Switch checked={!!settings.ai_summary_use_own} onCheckedChange={(v: boolean) => setSettings({ ...settings, ai_summary_use_own: Boolean(v) })} />
              Usar provedor específico para Resumos
            </label>
            {settings.ai_summary_use_own && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Provedor</label>
                  <select value={settings.ai_summary_provider || 'openai'} onChange={e => setSettings({ ...settings, ai_summary_provider: e.target.value, ai_summary_model: AI_PROVIDERS.find(p => p.id === e.target.value)?.defaultModel || '' })} className="w-full bg-gray-200/50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm">
                    {AI_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Modelo</label>
                  <select value={settings.ai_summary_model || ''} onChange={e => setSettings({ ...settings, ai_summary_model: e.target.value })} className="w-full bg-gray-200/50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm">
                    {(AI_PROVIDERS.find(p => p.id === (settings.ai_summary_provider || 'openai'))?.models ?? []).map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">API Key</label>
                  <div className="relative">
                    <input type={showApiKeys['summary'] ? 'text' : 'password'} value={settings.ai_summary_api_key || ''} onChange={e => setSettings({ ...settings, ai_summary_api_key: e.target.value || null })} placeholder={AI_PROVIDERS.find(p => p.id === (settings.ai_summary_provider || 'openai'))?.keyPlaceholder || ''} className="w-full bg-gray-200/50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm pr-10" />
                    <button type="button" onClick={() => toggleKey('summary')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:text-white">{showApiKeys['summary'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-100/50 dark:bg-slate-900/50 p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Verificação de Comportamento</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">Rastreie eventos e amostras para verificar o comportamento do cliente em relação aos resumos.</p>

        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
            <Switch checked={!!settings.ai_behavior_verification_enabled} onCheckedChange={(v: boolean) => setSettings({ ...settings, ai_behavior_verification_enabled: Boolean(v) })} />
            Habilitar verificação de comportamento
          </label>

          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Eventos monitorados</label>
              <div className="flex gap-2 flex-wrap">
              <label className="text-sm text-gray-500 dark:text-slate-400 flex items-center gap-2"><Switch checked={settings.ai_behavior_events?.includes('conversation_end')} onCheckedChange={(v: boolean) => {
                const set = new Set(settings.ai_behavior_events || []);
                if (v) set.add('conversation_end'); else set.delete('conversation_end');
                setSettings({ ...settings, ai_behavior_events: Array.from(set) });
              }} />Fim da conversa</label>
              <label className="text-sm text-gray-500 dark:text-slate-400 flex items-center gap-2"><Switch checked={settings.ai_behavior_events?.includes('summary_viewed')} onCheckedChange={(v: boolean) => {
                const set = new Set(settings.ai_behavior_events || []);
                if (v) set.add('summary_viewed'); else set.delete('summary_viewed');
                setSettings({ ...settings, ai_behavior_events: Array.from(set) });
              }} />Resumo visualizado</label>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Tamanho da amostra (%)</label>
            <input type="number" min={1} max={100} value={settings.ai_behavior_sample_size} onChange={(e) => setSettings({ ...settings, ai_behavior_sample_size: Number(e.target.value) })} className="w-28 bg-gray-200/50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm" />
          </div>

          {/* Provedor específico para Verificação */}
          <div className="pt-4 border-t border-gray-300/50 dark:border-slate-700/50">
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300 cursor-pointer">
              <Switch checked={!!settings.ai_behavior_use_own} onCheckedChange={(v: boolean) => setSettings({ ...settings, ai_behavior_use_own: Boolean(v) })} />
              Usar provedor específico para Verificação
            </label>
            {settings.ai_behavior_use_own && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Provedor</label>
                  <select value={settings.ai_behavior_provider || 'openai'} onChange={e => setSettings({ ...settings, ai_behavior_provider: e.target.value, ai_behavior_model: AI_PROVIDERS.find(p => p.id === e.target.value)?.defaultModel || '' })} className="w-full bg-gray-200/50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm">
                    {AI_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Modelo</label>
                  <select value={settings.ai_behavior_model || ''} onChange={e => setSettings({ ...settings, ai_behavior_model: e.target.value })} className="w-full bg-gray-200/50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm">
                    {(AI_PROVIDERS.find(p => p.id === (settings.ai_behavior_provider || 'openai'))?.models ?? []).map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">API Key</label>
                  <div className="relative">
                    <input type={showApiKeys['behavior'] ? 'text' : 'password'} value={settings.ai_behavior_api_key || ''} onChange={e => setSettings({ ...settings, ai_behavior_api_key: e.target.value || null })} placeholder={AI_PROVIDERS.find(p => p.id === (settings.ai_behavior_provider || 'openai'))?.keyPlaceholder || ''} className="w-full bg-gray-200/50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm pr-10" />
                    <button type="button" onClick={() => toggleKey('behavior')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:text-white">{showApiKeys['behavior'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-100/50 dark:bg-slate-900/50 p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Ferramentas de desenvolvimento</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">Crie uma conversa de teste para validar o Copilot e fluxo de mensagens.</p>
        <div className="flex gap-2">
          <button
            className="px-4 py-2 bg-cyan-600 rounded text-gray-900 dark:text-white"
            onClick={async () => {
                try {
                  const conv = await api.createConversation({ instanceId: 'inst1', phone: '+5511999999999', contactName: 'Cliente Teste' });
                  await api.processIncomingExternal({ id: generateId(), to: conv.id, from: '+5511999999999', content: 'Olá, quero testar o copilot.', provider: 'mock', timestamp: new Date().toISOString() });
                  await api.sendMessage(conv.id, 'Resposta automatica de teste pelo Copilot.');
                  toast.success('Conversa de teste criada e mensagem enviada');
                } catch (err) {
                  console.error('Erro criando conversa de teste', err);
                  toast.error('Falha ao criar conversa de teste');
                }
              }}
          >
            Criar conversa de teste
          </button>
        </div>
      </div>
    </div>
  );
});

AiSettings.displayName = 'AiSettings';
export default AiSettings;
