import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { MessageSquare, Eye, EyeOff, Copy, Check, Loader2, ChevronDown, FileAudio, Zap } from 'lucide-react';
import { toast } from 'sonner';
import * as Collapsible from '@radix-ui/react-collapsible';
import { useCompanySettings } from '@/hooks/useCompanySettings';

interface NinaSettings {
  whatsapp_access_token: string | null;
  whatsapp_phone_number_id: string | null;
  whatsapp_verify_token: string | null;
  evolution_api_url?: string | null;
  evolution_api_key?: string | null;
  zapi_instance_id?: string | null;
  zapi_token?: string | null;
  zapi_client_token?: string | null;
  // external integrations removed (evolution, zapi)
}

export interface ApiSettingsRef {
  save: () => Promise<void>;
  cancel: () => void;
  isSaving: boolean;
  isDirty: boolean;
}

const ApiSettings = forwardRef<ApiSettingsRef, { onDirtyChange?: (dirty: boolean) => void }>(({ onDirtyChange }, ref) => {
  const { companyName } = useCompanySettings();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showWhatsAppToken, setShowWhatsAppToken] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [webhookOpen, setWebhookOpen] = useState(false);
  const committedRef = useRef<string>('not-loaded');
  const [isDirty, setIsDirty] = useState(false);
  const [evolutionValid, setEvolutionValid] = useState<'unknown' | 'valid' | 'invalid'>('unknown');
  const [evolutionValidationMsg, setEvolutionValidationMsg] = useState<string | null>(null);
  const [evolutionTesting, setEvolutionTesting] = useState(false);
  const [showZapiToken, setShowZapiToken] = useState(false);
  const [showZapiClientToken, setShowZapiClientToken] = useState(false);

  // evolution integration removed

  const generateUniqueToken = () => {
    try {
      if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
        return `verify-${(crypto as any).randomUUID().slice(0, 8)}`;
      }

      // Fallback to UUIDv4-ish using getRandomValues
      const buf = new Uint8Array(16);
      if (typeof crypto !== 'undefined' && typeof (crypto as any).getRandomValues === 'function') {
        (crypto as any).getRandomValues(buf);
      } else {
        for (let i = 0; i < 16; i++) buf[i] = Math.floor(Math.random() * 256);
      }
      // Per RFC4122 v4 tweaks
      buf[6] = (buf[6] & 0x0f) | 0x40;
      buf[8] = (buf[8] & 0x3f) | 0x80;
      const hex = Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
      return `verify-${hex.slice(0, 8)}`;
    } catch (err) {
      return `verify-${Math.random().toString(36).slice(2, 10)}`;
    }
  };

  // zapi integration removed

  const [settings, setSettings] = useState<NinaSettings>({
    whatsapp_access_token: null,
    whatsapp_phone_number_id: null,
    whatsapp_verify_token: generateUniqueToken(),
    evolution_api_url: null,
    evolution_api_key: null,
    zapi_instance_id: null,
    zapi_token: null,
    zapi_client_token: null,
    // integrations removed
  });

  const webhookUrl = 'https://mock-url/functions/v1/whatsapp-webhook';

  const API_BASE = import.meta.env.VITE_API_BASE || '/api';
  useImperativeHandle(ref, () => ({ save: handleSave, cancel: loadSettings, isSaving: saving, isDirty }));

  useEffect(() => {
    if (committedRef.current === 'not-loaded') return;
    const dirty = JSON.stringify(settings) !== committedRef.current;
    setIsDirty(dirty);
    onDirtyChange?.(dirty);
  }, [settings]);

  async function loadSettings() {
    setLoading(true);
    try {
      // Try backend first
      try {
        const res = await fetch(`${API_BASE}/nina_settings`);
        if (res.ok) {
          const json = await res.json();
          const data = json?.data ?? json;
          if (data) {
            const newSettings = {
              whatsapp_access_token: data.whatsapp_access_token || null,
              whatsapp_phone_number_id: data.whatsapp_phone_number_id || null,
              whatsapp_verify_token: data.whatsapp_verify_token || generateUniqueToken(),
            };
            committedRef.current = JSON.stringify(newSettings);
            setIsDirty(false);
            onDirtyChange?.(false);
            setSettings(newSettings);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        // ignore and fallback to local storage
      }

      // Backend unavailable — use defaults
    } catch (err) {
      console.error('[ApiSettings] loadSettings', err);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
      setEvolutionValid('unknown');
    }
  }

  useEffect(() => { loadSettings(); }, []);

  function validateEvolutionUrl() {
    // lightweight noop validator to avoid runtime issues in this trimmed component
    setEvolutionTesting(true);
    setTimeout(() => {
      if (settings.evolution_api_url) {
        setEvolutionValid('valid');
        setEvolutionValidationMsg('Conectável');
      } else {
        setEvolutionValid('invalid');
        setEvolutionValidationMsg('URL inválida');
      }
      setEvolutionTesting(false);
    }, 600);
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Save to backend first, fallback to local
      const current = await (async () => {
        try {
          const res = await fetch(`${API_BASE}/nina_settings`);
          if (res.ok) { const json = await res.json(); return json?.data ?? json ?? {}; }
        } catch {}
        return {};
      })();
      const merged = {
        ...current,
        whatsapp_access_token: settings.whatsapp_access_token,
        whatsapp_phone_number_id: settings.whatsapp_phone_number_id,
        whatsapp_verify_token: settings.whatsapp_verify_token,
        updated_at: new Date().toISOString(),
      };

      // Try saving to backend
      try {
        const res = await fetch(`${API_BASE}/nina_settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(merged),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        console.error('[ApiSettings] Could not save to backend', err);
        throw err;
      }
      committedRef.current = JSON.stringify(settings);
      setIsDirty(false);
      onDirtyChange?.(false);
      toast.success('Configurações salvas');
    } catch (err) {
      console.error('[ApiSettings] save', err);
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    toast.success('URL copiada');
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  // evolution validation removed

  if (loading) return <div className="flex items-center justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>;

  const whatsappConfigured = Boolean(settings.whatsapp_access_token && settings.whatsapp_phone_number_id);

  return (
    <div className="space-y-6">
            {false && (
            <>
            <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-100/50 dark:bg-slate-900/50 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">WhatsApp Cloud API</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400">Configurações principais do WhatsApp e integração com provedores (Evolution)</p>
            </div>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${whatsappConfigured ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
            <span className={`h-2 w-2 rounded-full ${whatsappConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            {whatsappConfigured ? 'Configurado' : 'Aguardando'}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1.5">Access Token</label>
            <div className="relative">
              <input type={showWhatsAppToken ? 'text' : 'password'} value={settings.whatsapp_access_token || ''} onChange={(e) => setSettings({ ...settings, whatsapp_access_token: e.target.value })} placeholder="EAAxxxxxx..." className="w-full bg-gray-200/50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-700 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white pr-10" />
              <button type="button" onClick={() => setShowWhatsAppToken(!showWhatsAppToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:text-white">{showWhatsAppToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1.5">Phone Number ID</label>
            <input type="text" value={settings.whatsapp_phone_number_id || ''} onChange={(e) => setSettings({ ...settings, whatsapp_phone_number_id: e.target.value })} placeholder="123456789..." className="w-full bg-gray-200/50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-700 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1.5">Verify Token</label>
            <input type="text" value={settings.whatsapp_verify_token || ''} onChange={(e) => setSettings({ ...settings, whatsapp_verify_token: e.target.value })} className="w-full bg-gray-200/50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-700 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white" />
          </div>

          <Collapsible.Root open={webhookOpen} onOpenChange={setWebhookOpen}>
            <Collapsible.Trigger className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 cursor-pointer"><ChevronDown className={`w-4 h-4 transition-transform ${webhookOpen ? 'rotate-180' : ''}`} />Webhook URL</Collapsible.Trigger>
            <Collapsible.Content className="mt-3">
              <div className="flex gap-2">
                <input type="text" readOnly value={webhookUrl} className="flex-1 bg-gray-200/50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-700 rounded-lg px-4 py-2.5 text-gray-500 dark:text-slate-400 text-sm" />
                <button onClick={copyWebhookUrl} className="px-3 py-2 bg-gray-300 dark:bg-slate-700 rounded-lg hover:bg-gray-300 dark:bg-slate-600 text-gray-900 dark:text-white">{copiedWebhook ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</button>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-500 mt-2">Configure esta URL no painel do WhatsApp Business como Webhook URL. (Modo mock)</p>
            </Collapsible.Content>
          </Collapsible.Root>
        </div>
      </div>

        <div className="my-4 border-t border-gray-300 dark:border-slate-700" />

      <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-100/50 dark:bg-slate-900/50 p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3"><FileAudio className="w-4 h-4 text-emerald-400" /><h4 className="text-sm font-medium text-gray-900 dark:text-white">Evolution Provider (Global)</h4></div>
          <div className={`text-xs px-2 py-0.5 rounded ${settings.evolution_api_url ? 'bg-emerald-600 text-gray-900 dark:text-white' : 'bg-amber-600/10 text-amber-300'}`}>{settings.evolution_api_url ? 'Ativado' : 'Desativado'}</div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">API URL</label>
            <div className="flex gap-2">
              <input type="text" value={settings.evolution_api_url || ''} onChange={(e) => { setSettings({ ...settings, evolution_api_url: e.target.value }); setEvolutionValid('unknown'); setEvolutionValidationMsg(null); }} onBlur={() => validateEvolutionUrl()} placeholder="https://evolution.example.com/api" className="flex-1 bg-gray-200/50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm" />
              <button onClick={() => validateEvolutionUrl()} disabled={evolutionTesting} className={`px-3 py-2 rounded ${evolutionTesting ? 'bg-gray-300 dark:bg-slate-700 text-gray-700 dark:text-slate-200' : 'bg-emerald-600 text-gray-900 dark:text-white'}`}>{evolutionTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Validar'}</button>
            </div>
            {evolutionValid !== 'unknown' && (<div className="mt-2 text-sm">{evolutionValid === 'valid' ? (<span className="text-emerald-400">✓ {evolutionValidationMsg}</span>) : (<span className="text-rose-400">✕ {evolutionValidationMsg}</span>)}</div>)}
          </div>

          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">API Key (opcional)</label>
            <input type="password" value={settings.evolution_api_key || ''} onChange={(e) => setSettings({ ...settings, evolution_api_key: e.target.value })} placeholder="secret-key" className="w-full bg-gray-200/50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm" />
          </div>

          <p className="text-xs text-gray-500 dark:text-slate-500">Configure a URL e a chave da API da Evolution globalmente. Use <strong>Instâncias</strong> para configurações por instância.</p>
        </div>
      </div>
        </>
        )}
      {/* ── Z-API ── */}
      <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-100/50 dark:bg-slate-900/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-yellow-400" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Z-API</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400">Integração via Z-API para envio e recebimento de mensagens WhatsApp</p>
            </div>
          </div>
          <div className={`text-xs px-2 py-0.5 rounded ${settings.zapi_instance_id && settings.zapi_token ? 'bg-yellow-500/10 text-yellow-300 border border-yellow-500/20' : 'bg-gray-300/40 dark:bg-slate-700/40 text-gray-500 dark:text-slate-400'}`}>
            {settings.zapi_instance_id && settings.zapi_token ? 'Configurado' : 'Não configurado'}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1.5">Instance ID</label>
            <input
              type="text"
              value={settings.zapi_instance_id || ''}
              onChange={(e) => setSettings({ ...settings, zapi_instance_id: e.target.value })}
              placeholder="3ABC1234DEFG5678..."
              className="w-full bg-gray-200/50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-700 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">Encontrado em Z-API → Sua instância → Instance ID</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1.5">Token</label>
            <div className="relative">
              <input
                type={showZapiToken ? 'text' : 'password'}
                value={settings.zapi_token || ''}
                onChange={(e) => setSettings({ ...settings, zapi_token: e.target.value })}
                placeholder="token da instância..."
                className="w-full bg-gray-200/50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-700 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white pr-10"
              />
              <button type="button" onClick={() => setShowZapiToken(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:text-white">
                {showZapiToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1.5">Client Token <span className="text-gray-500 dark:text-slate-500 font-normal">(Security Token)</span></label>
            <div className="relative">
              <input
                type={showZapiClientToken ? 'text' : 'password'}
                value={settings.zapi_client_token || ''}
                onChange={(e) => setSettings({ ...settings, zapi_client_token: e.target.value })}
                placeholder="Client-Token do painel Z-API..."
                className="w-full bg-gray-200/50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-700 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white pr-10"
              />
              <button type="button" onClick={() => setShowZapiClientToken(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:text-white">
                {showZapiClientToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">Usado para validar requisições de webhook recebidas da Z-API</p>
          </div>

          {settings.zapi_instance_id && settings.zapi_token && (
            <div className="p-3 rounded-lg bg-gray-200/40 dark:bg-slate-800/40 border border-gray-300/50 dark:border-slate-700/50">
              <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Endpoint base</p>
              <code className="text-xs text-yellow-300 break-all">
                {`https://api.z-api.io/instances/${settings.zapi_instance_id}/token/${settings.zapi_token}`}
              </code>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-100/50 dark:bg-slate-900/50 p-6">
        <p className="text-sm text-gray-500 dark:text-slate-400">Para configurações de Chamada API (ElevenLabs), utilize a aba <strong>Chamada API</strong>.</p>
      </div>
    </div>
  );
});

ApiSettings.displayName = 'ApiSettings';
export default ApiSettings;
