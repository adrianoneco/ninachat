import React, { useEffect, useState } from 'react';
import { Mic, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

const VOICE_OPTIONS = [
  { id: '33B4UnXyTNbgLmdEDh5P', name: 'Keren - Young Brazilian Female', desc: 'Feminina, brasileira (Padrão)' },
  { id: '9BWtsMINqrJLrRacOk9x', name: 'Aria', desc: 'Feminina, natural' },
];

const MODEL_OPTIONS = [
  { id: 'eleven_turbo_v2_5', name: 'Turbo v2.5 (Recomendado)' },
  { id: 'eleven_turbo_v2', name: 'Turbo v2' },
];

const ChamadaApi: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [showElevenLabsKey, setShowElevenLabsKey] = useState(false);
  const [showN8nSecret, setShowN8nSecret] = useState(false);
  const [settings, setSettings] = useState<any>({
    elevenlabs_api_key: null,
    elevenlabs_voice_id: '33B4UnXyTNbgLmdEDh5P',
    elevenlabs_model: 'eleven_turbo_v2_5',
    elevenlabs_stability: 0.75,
    elevenlabs_similarity_boost: 0.8,
    elevenlabs_style: 0.3,
    elevenlabs_speed: 1.0,
    elevenlabs_speaker_boost: true,
    audio_response_enabled: false,
    n8n_enabled: false,
    n8n_webhook_url: '',
    n8n_secret_token: null,
  });

  useEffect(() => {
    const API_BASE = import.meta.env.VITE_API_BASE || '/api';
    (async () => {
      let data: any = null;
      try {
        const res = await fetch(`${API_BASE}/nina_settings`);
        if (res.ok) { const json = await res.json(); data = json?.data ?? json; }
      } catch {}
      if (!data) data = {};
      setSettings((prev: any) => ({ ...prev,
        elevenlabs_api_key: data.elevenlabs_api_key || null,
        elevenlabs_voice_id: data.elevenlabs_voice_id || '33B4UnXyTNbgLmdEDh5P',
        elevenlabs_model: data.elevenlabs_model || 'eleven_turbo_v2_5',
        elevenlabs_stability: data.elevenlabs_stability ?? 0.75,
        elevenlabs_similarity_boost: data.elevenlabs_similarity_boost ?? 0.8,
        elevenlabs_style: data.elevenlabs_style ?? 0.3,
        elevenlabs_speed: data.elevenlabs_speed ?? 1.0,
        elevenlabs_speaker_boost: data.elevenlabs_speaker_boost ?? true,
        audio_response_enabled: data.audio_response_enabled || false,
        n8n_enabled: data.n8n_enabled || false,
        n8n_webhook_url: data.n8n_webhook_url || '',
        n8n_secret_token: data.n8n_secret_token || null,
      }));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [testing, setTesting] = useState(false);

  const handleSave = async () => {
    const API_BASE = import.meta.env.VITE_API_BASE || '/api';
    let current: any = {};
    try {
      const res = await fetch(`${API_BASE}/nina_settings`);
      if (res.ok) { const json = await res.json(); current = json?.data ?? json ?? {}; }
    } catch {}
    const merged = { ...current,
      elevenlabs_api_key: settings.elevenlabs_api_key,
      elevenlabs_voice_id: settings.elevenlabs_voice_id,
      elevenlabs_model: settings.elevenlabs_model,
      elevenlabs_stability: settings.elevenlabs_stability,
      elevenlabs_similarity_boost: settings.elevenlabs_similarity_boost,
      elevenlabs_style: settings.elevenlabs_style,
      elevenlabs_speed: settings.elevenlabs_speed,
      elevenlabs_speaker_boost: settings.elevenlabs_speaker_boost,
      audio_response_enabled: settings.audio_response_enabled,
      n8n_enabled: settings.n8n_enabled,
      n8n_webhook_url: settings.n8n_webhook_url,
      n8n_secret_token: settings.n8n_secret_token,
      updated_at: new Date().toISOString(),
    };
    try {
      const res = await fetch(`${API_BASE}/nina_settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(merged) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error('[ChamadaApi] Failed to save to backend', err);
      toast.error('Erro ao salvar no backend');
      return;
    }
    toast.success('Configurações de Chamada API salvas');
  };

  const testN8nWebhook = async () => {
    if (!settings.n8n_webhook_url) {
      toast.error('Informe a URL do Webhook n8n antes de testar');
      return;
    }
    setTesting(true);
    try {
      const res = await fetch(settings.n8n_webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(settings.n8n_secret_token ? { 'Authorization': `Bearer ${settings.n8n_secret_token}` } : {}),
        },
        body: JSON.stringify({ provider: 'n8n', test: true, timestamp: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success('Teste de Webhook n8n enviado com sucesso');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('n8n webhook test failed', err);
      toast.error('Falha ao enviar teste para o Webhook n8n');
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-100/50 dark:bg-slate-900/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Mic className="w-5 h-5 text-purple-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Chamada API — ElevenLabs</h3>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-200/30 dark:bg-slate-800/30 border border-gray-300/50 dark:border-slate-700/50">
            <div>
              <span className="text-sm text-gray-900 dark:text-white font-medium">Respostas em áudio</span>
              <p className="text-xs text-gray-500 dark:text-slate-400">Configuração da API ElevenLabs para geração de áudio</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1.5">API Key</label>
            <div className="relative">
              <input
                type={showElevenLabsKey ? 'text' : 'password'}
                value={settings.elevenlabs_api_key || ''}
                onChange={(e) => setSettings({ ...settings, elevenlabs_api_key: e.target.value })}
                placeholder="sk_xxxxx..."
                className="w-full bg-gray-200/50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-700 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white pr-10"
              />
              <button
                type="button"
                onClick={() => setShowElevenLabsKey(!showElevenLabsKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:text-white"
              >
                {showElevenLabsKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1.5">Voz</label>
            <select
              value={settings.elevenlabs_voice_id}
              onChange={(e) => setSettings({ ...settings, elevenlabs_voice_id: e.target.value })}
              className="w-full bg-gray-200/50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-700 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white"
            >
              {VOICE_OPTIONS.map(v => (
                <option key={v.id} value={v.id}>{v.name} — {v.desc}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1.5">Modelo</label>
            <select
              value={settings.elevenlabs_model || 'eleven_turbo_v2_5'}
              onChange={(e) => setSettings({ ...settings, elevenlabs_model: e.target.value })}
              className="w-full bg-gray-200/50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-700 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white"
            >
              {MODEL_OPTIONS.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end">
            <button onClick={handleSave} className="px-4 py-2 bg-cyan-600 rounded text-gray-900 dark:text-white">Salvar Chamada API</button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-100/50 dark:bg-slate-900/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Mic className="w-5 h-5 text-green-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Webhook n8n</h3>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-200/30 dark:bg-slate-800/30 border border-gray-300/50 dark:border-slate-700/50">
            <div>
              <span className="text-sm text-gray-900 dark:text-white font-medium">Integração com n8n</span>
              <p className="text-xs text-gray-500 dark:text-slate-400">Envie eventos de teste para um fluxo n8n. Use token se necessário.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
              <Switch checked={!!settings.n8n_enabled} onCheckedChange={(v: boolean) => setSettings({ ...settings, n8n_enabled: Boolean(v) })} />
              Habilitar Webhook n8n
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1.5">URL do Webhook</label>
            <input
              type="text"
              value={settings.n8n_webhook_url || ''}
              onChange={(e) => setSettings({ ...settings, n8n_webhook_url: e.target.value })}
              placeholder="https://seu-n8n.example/webhook/abcd"
              className="w-full bg-gray-200/50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-700 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1.5">Token secreto (opcional)</label>
            <div className="relative">
              <input
                type={showN8nSecret ? 'text' : 'password'}
                value={settings.n8n_secret_token || ''}
                onChange={(e) => setSettings({ ...settings, n8n_secret_token: e.target.value })}
                placeholder="token opcional"
                className="w-full bg-gray-200/50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-700 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white pr-10"
              />
              <button
                type="button"
                onClick={() => setShowN8nSecret(!showN8nSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:text-white"
              >
                {showN8nSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={testN8nWebhook} disabled={testing} className="px-4 py-2 bg-emerald-600 rounded text-gray-900 dark:text-white flex items-center gap-2">
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Testar Webhook n8n'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChamadaApi;
