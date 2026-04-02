import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { Bot, Loader2, Wand2, RotateCcw, Info, Cpu, Eye, EyeOff, Key } from 'lucide-react';
import { Button } from '../Button';
import { toast } from 'sonner';
import PromptGeneratorSheet from './PromptGeneratorSheet';
import { DEFAULT_LIVECHAT_PROMPT } from '@/prompts/default-livechat-prompt';
// Mock mode - no auth needed
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AgentSettings {
  id?: string;
  system_prompt_override: string | null;
  is_active: boolean;
  auto_response_enabled: boolean;
  ai_model_mode: 'flash' | 'pro' | 'pro3' | 'adaptive';
  message_breaking_enabled: boolean;
  business_hours_start: string;
  business_hours_end: string;
  business_days: number[];
  company_name: string | null;
  sdr_name: string | null;
  company_logo: string | null;
  ai_scheduling_enabled: boolean;
  // AI provider
  ai_provider: string;
  ai_api_key: string | null;
  ai_model: string;
  ai_base_url: string | null;
}

const AI_PROVIDERS = [
  { id: 'openai',    name: 'OpenAI',         badge: 'GPT',     models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],                              defaultModel: 'gpt-4o-mini',              keyPlaceholder: 'sk-...',      defaultBase: 'https://api.openai.com/v1' },
  { id: 'google',    name: 'Google Gemini',  badge: 'Gemini',  models: ['gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],            defaultModel: 'gemini-2.0-flash',         keyPlaceholder: 'AIza...',     defaultBase: 'https://generativelanguage.googleapis.com/v1beta' },
  { id: 'anthropic', name: 'Anthropic',      badge: 'Claude',  models: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-3-5-haiku-20241022'],                  defaultModel: 'claude-3-5-haiku-20241022', keyPlaceholder: 'sk-ant-...',  defaultBase: 'https://api.anthropic.com/v1' },
  { id: 'groq',      name: 'Groq',           badge: 'Groq',    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],             defaultModel: 'llama-3.3-70b-versatile',  keyPlaceholder: 'gsk_...',     defaultBase: 'https://api.groq.com/openai/v1' },
  { id: 'deepseek',  name: 'DeepSeek',       badge: 'DS',      models: ['deepseek-chat', 'deepseek-reasoner'],                                                  defaultModel: 'deepseek-chat',            keyPlaceholder: 'sk-...',      defaultBase: 'https://api.deepseek.com/v1' },
  { id: 'mistral',   name: 'Mistral AI',     badge: 'Mistral', models: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest'],                   defaultModel: 'mistral-small-latest',     keyPlaceholder: 'xxxxx',       defaultBase: 'https://api.mistral.ai/v1' },
  { id: 'ollama',    name: 'Ollama (Local)', badge: 'Local',   models: ['llama3.2', 'llama3.1', 'mistral', 'codellama', 'qwen2.5', 'phi3'],                   defaultModel: 'llama3.2',                 keyPlaceholder: '—',           defaultBase: 'http://localhost:11434/v1' },
];

// Using shared prompt from @/prompts/default-livechat-prompt

export interface AgentSettingsRef {
  save: () => Promise<void>;
  cancel: () => void;
  isSaving: boolean;
  isDirty: boolean;
}

const AGENT_DEFAULTS: AgentSettings = {
  system_prompt_override: null,
  is_active: true,
  auto_response_enabled: true,
  ai_model_mode: 'flash',
  message_breaking_enabled: true,
  business_hours_start: '09:00',
  business_hours_end: '18:00',
  business_days: [1, 2, 3, 4, 5],
  company_name: null,
  sdr_name: null,
  company_logo: null,
  ai_scheduling_enabled: true,
  ai_provider: 'google',
  ai_api_key: null,
  ai_model: 'gemini-2.0-flash',
  ai_base_url: null,
};

const AgentSettings = forwardRef<AgentSettingsRef, { onDirtyChange?: (dirty: boolean) => void }>(({ onDirtyChange }, ref) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [showAgentApiKey, setShowAgentApiKey] = useState(false);
  const [settings, setSettings] = useState<AgentSettings>(AGENT_DEFAULTS);
  const committedRef = useRef<string>('not-loaded');
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (committedRef.current === 'not-loaded') return;
    const dirty = JSON.stringify(settings) !== committedRef.current;
    setIsDirty(dirty);
    onDirtyChange?.(dirty);
  }, [settings]);

  const API_BASE = import.meta.env.VITE_API_BASE || '/api';

  useImperativeHandle(ref, () => ({
    save: handleSave,
    cancel: loadSettings,
    isSaving: saving,
    isDirty,
  }));

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // Try loading from backend first
      let data: any = null;
      try {
        const res = await fetch(`${API_BASE}/livechat_settings`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (res.ok) {
          const json = await res.json();
          data = json?.data ?? json;
        } else {
          console.error('[AgentSettings] Load failed with status', res.status);
        }
      } catch (e) {
        console.error('[AgentSettings] Load fetch error', e);
      }
      if (!data) data = null;
      if (data) {
        const newSettings: AgentSettings = {
          ...AGENT_DEFAULTS,
          id: data.id || undefined,
          system_prompt_override: data.system_prompt_override ?? AGENT_DEFAULTS.system_prompt_override,
          is_active: data.is_active ?? AGENT_DEFAULTS.is_active,
          auto_response_enabled: data.auto_response_enabled ?? AGENT_DEFAULTS.auto_response_enabled,
          ai_model_mode: data.ai_model_mode || AGENT_DEFAULTS.ai_model_mode,
          message_breaking_enabled: data.message_breaking_enabled ?? AGENT_DEFAULTS.message_breaking_enabled,
          business_hours_start: data.business_hours_start || AGENT_DEFAULTS.business_hours_start,
          business_hours_end: data.business_hours_end || AGENT_DEFAULTS.business_hours_end,
          business_days: data.business_days || AGENT_DEFAULTS.business_days,
          company_name: data.company_name ?? AGENT_DEFAULTS.company_name,
          sdr_name: data.sdr_name ?? AGENT_DEFAULTS.sdr_name,
          ai_scheduling_enabled: data.ai_scheduling_enabled ?? AGENT_DEFAULTS.ai_scheduling_enabled,
          ai_provider: data.ai_provider || AGENT_DEFAULTS.ai_provider,
          ai_api_key: data.ai_api_key || AGENT_DEFAULTS.ai_api_key,
          ai_model: data.ai_model || AGENT_DEFAULTS.ai_model,
          ai_base_url: data.ai_base_url || AGENT_DEFAULTS.ai_base_url,
          company_logo: data.company_logo ?? AGENT_DEFAULTS.company_logo,
        };
        committedRef.current = JSON.stringify(newSettings);
        setIsDirty(false);
        onDirtyChange?.(false);
        setSettings(newSettings);
      }
    } catch (error) {
      console.error('[AgentSettings] Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let current: any = {};
      try {
        const res = await fetch(`${API_BASE}/livechat_settings`);
        if (res.ok) { const json = await res.json(); current = json?.data ?? json ?? {}; }
      } catch {}
      const merged = {
        ...current,
        system_prompt_override: settings.system_prompt_override,
        is_active: settings.is_active,
        auto_response_enabled: settings.auto_response_enabled,
        ai_model_mode: settings.ai_model_mode,
        message_breaking_enabled: settings.message_breaking_enabled,
        business_hours_start: settings.business_hours_start,
        business_hours_end: settings.business_hours_end,
        business_days: settings.business_days,
        company_name: settings.company_name,
        sdr_name: settings.sdr_name,
        ai_scheduling_enabled: settings.ai_scheduling_enabled,
        ai_provider: settings.ai_provider,
        ai_api_key: settings.ai_api_key,
        ai_model: settings.ai_model,
        ai_base_url: settings.ai_base_url,
        company_logo: settings.company_logo,
        updated_at: new Date().toISOString(),
      };
      // Save to backend first
      try {
        const res = await fetch(`${API_BASE}/livechat_settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(merged),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        console.error('[AgentSettings] Failed to save to backend', err);
        throw err;
      }
      committedRef.current = JSON.stringify(settings);
      setIsDirty(false);
      onDirtyChange?.(false);
      toast.success('Configurações do agente salvas com sucesso!');
    } catch (error) {
      console.error('Error saving agent settings:', error);
      toast.error('Erro ao salvar configurações do agente');
    } finally {
      setSaving(false);
    }
  };

  const handlePromptGenerated = (prompt: string) => {
    setSettings(prev => ({ ...prev, system_prompt_override: prompt }));
  };

  const handleRestoreDefault = () => {
    setSettings(prev => ({ ...prev, system_prompt_override: DEFAULT_LIVECHAT_PROMPT }));
    toast.success('Prompt restaurado para o padrão');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <>
      <PromptGeneratorSheet
        open={isGeneratorOpen}
        onOpenChange={setIsGeneratorOpen}
        onPromptGenerated={handlePromptGenerated}
      />
      
      <TooltipProvider>
      <div className="space-y-6">
        {/* System Prompt - PRIMEIRA SEÇÃO */}
        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-100/50 dark:bg-slate-900/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Bot className="w-5 h-5 text-cyan-400" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Prompt do Sistema</h3>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRestoreDefault}
                className="text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:text-white hover:bg-gray-300 dark:bg-slate-700"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Restaurar Padrão
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsGeneratorOpen(true)}
                className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
              >
                <Wand2 className="w-4 h-4 mr-2" />
                Gerar com IA
              </Button>
            </div>
          </div>
          
          {/* Nota explicativa sobre o prompt */}
          <div className="mb-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
            <p className="flex items-start gap-2">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Template de exemplo:</strong> Este é um modelo inicial para você começar. 
                Personalize completamente com as informações da sua empresa, produtos, serviços e tom de comunicação.
              </span>
            </p>
          </div>
          
          <textarea
            value={settings.system_prompt_override || ''}
            onChange={(e) => setSettings({ ...settings, system_prompt_override: e.target.value || null })}
            placeholder="Cole ou escreva o prompt do agente aqui..."
            rows={12}
            className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm text-gray-800 dark:text-slate-100 placeholder:text-gray-400 dark:text-slate-600 focus:outline-none focus:ring-2 focus:ring-ring/50 resize-y font-mono custom-scrollbar"
          />
          <details className="mt-3">
            <summary className="text-xs text-cyan-400 cursor-pointer hover:text-cyan-300 flex items-center gap-2">
              <span>📋</span> Variáveis dinâmicas disponíveis
            </summary>
            <div className="mt-2 p-3 rounded-lg bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 text-xs font-mono space-y-1">
              <div><span className="text-cyan-400">{"{{ data_hora }}"}</span> → Data e hora atual (ex: 29/11/2024 14:35:22)</div>
              <div><span className="text-cyan-400">{"{{ data }}"}</span> → Apenas data (ex: 29/11/2024)</div>
              <div><span className="text-cyan-400">{"{{ hora }}"}</span> → Apenas hora (ex: 14:35:22)</div>
              <div><span className="text-cyan-400">{"{{ dia_semana }}"}</span> → Dia da semana por extenso (ex: sexta-feira)</div>
              <div><span className="text-cyan-400">{"{{ cliente_nome }}"}</span> → Nome do cliente na conversa</div>
              <div><span className="text-cyan-400">{"{{ cliente_telefone }}"}</span> → Telefone do cliente</div>
            </div>
          </details>
        </div>

        {/* Provedor de IA do Agente */}
        <div className="rounded-xl border border-cyan-500/20 bg-gray-100/50 dark:bg-slate-900/50 p-6">
          <div className="flex items-center gap-3 mb-5">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Provedor de IA do Agente</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">API e modelo usados para as respostas automáticas do agente principal</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Provider grid */}
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-2 block">Provedor</label>
              <div className="grid grid-cols-4 gap-2">
                {AI_PROVIDERS.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSettings({ ...settings, ai_provider: p.id, ai_model: p.defaultModel })}
                    className={`p-2.5 rounded-lg border text-center transition-all ${
                      settings.ai_provider === p.id
                        ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300'
                        : 'bg-white/50 dark:bg-slate-950/50 border-gray-200 dark:border-slate-800 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="text-[11px] font-semibold leading-tight">{p.name}</div>
                    <div className={`mt-1 text-[10px] ${settings.ai_provider === p.id ? 'text-cyan-400/70' : 'text-gray-400 dark:text-slate-600'}`}>{p.badge}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* API Key */}
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5 block flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 inline mr-1" />API Key
              </label>
              <div className="relative">
                <input
                  type={showAgentApiKey ? 'text' : 'password'}
                  value={settings.ai_api_key || ''}
                  onChange={e => setSettings({ ...settings, ai_api_key: e.target.value || null })}
                  placeholder={AI_PROVIDERS.find(p => p.id === settings.ai_provider)?.keyPlaceholder || 'sua-api-key'}
                  className="w-full bg-gray-200/50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-700 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white pr-10 text-sm"
                />
                <button type="button" onClick={() => setShowAgentApiKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:text-white">
                  {showAgentApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Model + Base URL */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5 block">Modelo</label>
                <select
                  value={settings.ai_model}
                  onChange={e => setSettings({ ...settings, ai_model: e.target.value })}
                  className="w-full bg-gray-200/50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2.5 text-gray-900 dark:text-white text-sm"
                >
                  {(AI_PROVIDERS.find(p => p.id === settings.ai_provider)?.models ?? []).map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5 block">Base URL <span className="text-gray-500 dark:text-slate-500 font-normal">(opcional)</span></label>
                <input
                  type="text"
                  value={settings.ai_base_url || ''}
                  onChange={e => setSettings({ ...settings, ai_base_url: e.target.value || null })}
                  placeholder={AI_PROVIDERS.find(p => p.id === settings.ai_provider)?.defaultBase || ''}
                  className="w-full bg-gray-200/50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2.5 text-gray-900 dark:text-white text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Comportamento */}
        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-100/50 dark:bg-slate-900/50 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Bot className="w-5 h-5 text-violet-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Comportamento</h3>
          </div>
          
          {/* AI Model Selection */}
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-3 block">Modelo de IA</label>
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setSettings({ ...settings, ai_model_mode: 'flash' })}
                className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
                  settings.ai_model_mode === 'flash'
                    ? 'bg-violet-500/20 border-violet-500 text-violet-300'
                    : 'bg-white/50 dark:bg-slate-950/50 border-gray-200 dark:border-slate-800 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:bg-slate-800'
                }`}
              >
                <span className="text-lg">⚡</span>
                <span className="text-xs font-medium">Flash</span>
                <span className="text-[10px] text-center opacity-70">Rápido</span>
              </button>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, ai_model_mode: 'pro' })}
                className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
                  settings.ai_model_mode === 'pro'
                    ? 'bg-violet-500/20 border-violet-500 text-violet-300'
                    : 'bg-white/50 dark:bg-slate-950/50 border-gray-200 dark:border-slate-800 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:bg-slate-800'
                }`}
              >
                <span className="text-lg">🧠</span>
                <span className="text-xs font-medium">Pro 2.5</span>
                <span className="text-[10px] text-center opacity-70">Inteligente</span>
              </button>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, ai_model_mode: 'pro3' })}
                className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
                  settings.ai_model_mode === 'pro3'
                    ? 'bg-violet-500/20 border-violet-500 text-violet-300'
                    : 'bg-white/50 dark:bg-slate-950/50 border-gray-200 dark:border-slate-800 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:bg-slate-800'
                }`}
              >
                <span className="text-lg">🚀</span>
                <span className="text-xs font-medium">Pro 3</span>
                <span className="text-[10px] text-center opacity-70">Mais Recente</span>
              </button>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, ai_model_mode: 'adaptive' })}
                className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
                  settings.ai_model_mode === 'adaptive'
                    ? 'bg-violet-500/20 border-violet-500 text-violet-300'
                    : 'bg-white/50 dark:bg-slate-950/50 border-gray-200 dark:border-slate-800 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:bg-slate-800'
                }`}
              >
                <span className="text-lg">🎯</span>
                <span className="text-xs font-medium">Adaptativo</span>
                <span className="text-[10px] text-center opacity-70">Contexto</span>
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-500 mt-2">
              {settings.ai_model_mode === 'flash' && 'Gemini 2.5 Flash: respostas rápidas e econômicas'}
              {settings.ai_model_mode === 'pro' && 'Gemini 2.5 Pro: respostas elaboradas e inteligentes'}
              {settings.ai_model_mode === 'pro3' && 'Gemini 3 Pro: modelo mais recente e avançado'}
              {settings.ai_model_mode === 'adaptive' && 'Alterna automaticamente baseado no contexto da conversa'}
            </p>
          </div>

          {/* Toggles em grid 2x2 com tooltips */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/50 dark:bg-slate-950/50 border border-gray-200 dark:border-slate-800">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-sm text-gray-600 dark:text-slate-300 cursor-help flex items-center gap-1.5">
                    Agente Ativo
                    <Info className="w-3 h-3 text-gray-500 dark:text-slate-500" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-[200px]">Liga ou desliga o agente de IA completamente. Quando desativado, nenhuma resposta automática será enviada.</p>
                </TooltipContent>
              </Tooltip>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.is_active}
                  onChange={(e) => setSettings({ ...settings, is_active: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-300 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ring/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white dark:bg-slate-950 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/50 dark:bg-slate-950/50 border border-gray-200 dark:border-slate-800">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-sm text-gray-600 dark:text-slate-300 cursor-help flex items-center gap-1.5">
                    Resposta Automática
                    <Info className="w-3 h-3 text-gray-500 dark:text-slate-500" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-[200px]">Quando ativo, o agente responde automaticamente sem necessidade de aprovação humana.</p>
                </TooltipContent>
              </Tooltip>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.auto_response_enabled}
                  onChange={(e) => setSettings({ ...settings, auto_response_enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-300 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ring/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white dark:bg-slate-950 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/50 dark:bg-slate-950/50 border border-gray-200 dark:border-slate-800">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-sm text-gray-600 dark:text-slate-300 cursor-help flex items-center gap-1.5">
                    Quebrar Mensagens
                    <Info className="w-3 h-3 text-gray-500 dark:text-slate-500" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-[200px]">Divide respostas longas em várias mensagens menores, simulando uma conversa mais natural.</p>
                </TooltipContent>
              </Tooltip>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.message_breaking_enabled}
                  onChange={(e) => setSettings({ ...settings, message_breaking_enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-300 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ring/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white dark:bg-slate-950 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/50 dark:bg-slate-950/50 border border-gray-200 dark:border-slate-800">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-sm text-gray-600 dark:text-slate-300 cursor-help flex items-center gap-1.5">
                    Agendamento via IA
                    <Info className="w-3 h-3 text-gray-500 dark:text-slate-500" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-[200px]">Permite que o agente crie, altere e cancele agendamentos automaticamente durante a conversa.</p>
                </TooltipContent>
              </Tooltip>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.ai_scheduling_enabled}
                  onChange={(e) => setSettings({ ...settings, ai_scheduling_enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-300 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ring/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white dark:bg-slate-950 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        </div>

      </div>
      </TooltipProvider>
    </>
  );
});

AgentSettings.displayName = 'AgentSettings';

export default AgentSettings;
