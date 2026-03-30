import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { Building2, Calendar, Upload, X, Globe, Mail, Phone, MapPin, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
];

const TIMEZONES = [
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Bahia',
  'America/Fortaleza',
  'America/Recife',
  'America/Belem',
  'America/Cuiaba',
  'America/Porto_Velho',
  'America/Rio_Branco',
  'America/Noronha',
];

interface CompanyData {
  company_name: string | null;
  sdr_name: string | null;
  company_logo: string | null;
  company_email: string | null;
  company_phone: string | null;
  company_website: string | null;
  company_address: string | null;
  company_description: string | null;
  company_cnpj: string | null;
  timezone: string;
  language: string;
  currency: string;
  business_hours_start: string;
  business_hours_end: string;
  business_days: number[];
}

const DEFAULTS: CompanyData = {
  company_name: null,
  sdr_name: null,
  company_logo: null,
  company_email: null,
  company_phone: null,
  company_website: null,
  company_address: null,
  company_description: null,
  company_cnpj: null,
  timezone: 'America/Sao_Paulo',
  language: 'pt-BR',
  currency: 'BRL',
  business_hours_start: '09:00',
  business_hours_end: '18:00',
  business_days: [1, 2, 3, 4, 5],
};

export interface EmpresaSettingsRef {
  save: () => Promise<void>;
  cancel: () => void;
  isSaving: boolean;
  isDirty: boolean;
}

const EmpresaSettings = forwardRef<EmpresaSettingsRef, { onDirtyChange?: (dirty: boolean) => void }>(({ onDirtyChange }, ref) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<CompanyData>({ ...DEFAULTS });
  const committedRef = useRef<string>('not-loaded');
  const [isDirty, setIsDirty] = useState(false);

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
      let data: any = null;
      try {
        const res = await fetch(`${API_BASE}/nina_settings`);
        if (res.ok) { const json = await res.json(); data = json?.data ?? json; }
      } catch {}
      if (!data) data = null;
      const merged: CompanyData = {
        company_name: data?.company_name || null,
        sdr_name: data?.sdr_name || null,
        company_logo: data?.company_logo || null,
        company_email: data?.company_email || null,
        company_phone: data?.company_phone || null,
        company_website: data?.company_website || null,
        company_address: data?.company_address || null,
        company_description: data?.company_description || null,
        company_cnpj: data?.company_cnpj || null,
        timezone: data?.timezone || 'America/Sao_Paulo',
        language: data?.language || 'pt-BR',
        currency: data?.currency || 'BRL',
        business_hours_start: data?.business_hours_start || '09:00',
        business_hours_end: data?.business_hours_end || '18:00',
        business_days: data?.business_days || [1, 2, 3, 4, 5],
      };
      committedRef.current = JSON.stringify(merged);
      setIsDirty(false);
      onDirtyChange?.(false);
      setSettings(merged);
    } catch (err) {
      console.error('[EmpresaSettings] load', err);
      toast.error('Erro ao carregar configurações da empresa');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadSettings(); }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const current = await (async () => {
        try { const res = await fetch(`${API_BASE}/nina_settings`); if (res.ok) { const json = await res.json(); return json?.data ?? json ?? {}; } } catch {}
        return {};
      })();
      const merged = { ...current, ...settings, updated_at: new Date().toISOString() };
      try {
        const res = await fetch(`${API_BASE}/nina_settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(merged) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        console.error('[EmpresaSettings] Failed to save to backend', err);
        throw err;
      }
      committedRef.current = JSON.stringify(settings);
      setIsDirty(false);
      onDirtyChange?.(false);
      toast.success('Configurações da empresa salvas');
    } catch (err) {
      console.error('[EmpresaSettings] save', err);
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  const toggleBusinessDay = (day: number) => {
    setSettings(prev => ({
      ...prev,
      business_days: prev.business_days.includes(day)
        ? prev.business_days.filter(d => d !== day)
        : [...prev.business_days, day].sort(),
    }));
  };

  if (loading) return <div className="flex items-center justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>;

  return (
    <div className="space-y-6">
      {/* Informações da Empresa + Horário (2 colunas) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dados da Empresa */}
        <div className="card-surface p-6">
          <div className="flex items-center gap-3 mb-4">
            <Building2 className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Informações da Empresa</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5 block">
                Nome da Empresa <span className="text-amber-400 text-[10px]">(recomendado)</span>
              </label>
              <input type="text" value={settings.company_name || ''} onChange={(e) => setSettings({ ...settings, company_name: e.target.value || null })} placeholder="Nome da sua empresa" className="h-9 w-full theme-input px-3 text-sm text-gray-800 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5 block">
                Nome do Agente <span className="text-amber-400 text-[10px]">(recomendado)</span>
              </label>
              <input type="text" value={settings.sdr_name || ''} onChange={(e) => setSettings({ ...settings, sdr_name: e.target.value || null })} placeholder="Nome do agente (ex: Ana, Sofia)" className="h-9 w-full theme-input px-3 text-sm text-gray-800 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5 block">Logo da Aplicação</label>
              <div className="flex items-center gap-4">
                {settings.company_logo ? (
                  <div className="relative group">
                    <img src={settings.company_logo} alt="Logo" className="h-14 w-14 rounded-lg object-cover border border-gray-300 dark:border-slate-700" />
                    <button type="button" onClick={() => setSettings({ ...settings, company_logo: null })} className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-rose-600 text-gray-900 dark:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="h-14 w-14 rounded-lg border-2 border-dashed border-gray-300 dark:border-slate-700 theme-input flex items-center justify-center">
                    <Upload className="w-5 h-5 text-gray-400 dark:text-slate-600" />
                  </div>
                )}
                <div className="flex-1">
                  <button type="button" onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/png,image/jpeg,image/svg+xml,image/webp';
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (!file) return;
                      if (file.size > 2 * 1024 * 1024) { toast.error('Arquivo muito grande. Máximo 2MB.'); return; }
                      const reader = new FileReader();
                      reader.onload = () => setSettings(prev => ({ ...prev, company_logo: reader.result as string }));
                      reader.readAsDataURL(file);
                    };
                    input.click();
                  }} className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors">
                    {settings.company_logo ? 'Trocar imagem' : 'Enviar logo'}
                  </button>
                  <p className="text-[10px] text-gray-500 dark:text-slate-500 mt-0.5">PNG, JPG, SVG ou WebP. Máx 2MB.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Horário de Atendimento */}
        <div className="card-surface p-6">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Horário de Atendimento</h3>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5 block">Início</label>
                <input type="time" value={settings.business_hours_start} onChange={(e) => setSettings({ ...settings, business_hours_start: e.target.value })} className="h-9 w-full theme-input px-3 text-sm text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5 block">Fim</label>
                <input type="time" value={settings.business_hours_end} onChange={(e) => setSettings({ ...settings, business_hours_end: e.target.value })} className="h-9 w-full theme-input px-3 text-sm text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-2 block">Dias da Semana</label>
              <div className="flex gap-2">
                {DAYS_OF_WEEK.map(day => (
                  <button key={day.value} onClick={() => toggleBusinessDay(day.value)} className={`flex-1 h-9 text-xs font-medium rounded-lg transition-all ${settings.business_days.includes(day.value) ? 'bg-indigo-500 text-gray-900 dark:text-white' : 'bg-gray-200 dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:bg-gray-300 dark:hover:bg-slate-700'}`}>
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5 block">Fuso Horário</label>
              <select value={settings.timezone} onChange={(e) => setSettings({ ...settings, timezone: e.target.value })} className="h-9 w-full theme-input px-3 text-sm text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace('America/', '').replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Contato e Localização */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-surface p-6">
          <div className="flex items-center gap-3 mb-4">
            <Phone className="w-5 h-5 text-emerald-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Contato</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5 block">E-mail da empresa</label>
              <input type="email" value={settings.company_email || ''} onChange={(e) => setSettings({ ...settings, company_email: e.target.value || null })} placeholder="contato@empresa.com" className="h-9 w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-gray-800 dark:text-slate-100 placeholder:text-gray-400 dark:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5 block">Telefone</label>
              <input type="tel" value={settings.company_phone || ''} onChange={(e) => setSettings({ ...settings, company_phone: e.target.value || null })} placeholder="(11) 99999-9999" className="h-9 w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-gray-800 dark:text-slate-100 placeholder:text-gray-400 dark:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5 block">Site</label>
              <input type="url" value={settings.company_website || ''} onChange={(e) => setSettings({ ...settings, company_website: e.target.value || null })} placeholder="https://www.empresa.com" className="h-9 w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-gray-800 dark:text-slate-100 placeholder:text-gray-400 dark:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5 block">CNPJ</label>
              <input type="text" value={settings.company_cnpj || ''} onChange={(e) => setSettings({ ...settings, company_cnpj: e.target.value || null })} placeholder="00.000.000/0000-00" className="h-9 w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-gray-800 dark:text-slate-100 placeholder:text-gray-400 dark:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
            </div>
          </div>
        </div>

        <div className="card-surface p-6">
          <div className="flex items-center gap-3 mb-4">
            <MapPin className="w-5 h-5 text-rose-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Localização e Preferências</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5 block">Endereço</label>
              <input type="text" value={settings.company_address || ''} onChange={(e) => setSettings({ ...settings, company_address: e.target.value || null })} placeholder="Rua Example, 123 - Cidade/UF" className="h-9 w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-gray-800 dark:text-slate-100 placeholder:text-gray-400 dark:text-slate-600 focus:outline-none focus:ring-2 focus:ring-rose-500/50" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5 block">Descrição da empresa</label>
              <textarea value={settings.company_description || ''} onChange={(e) => setSettings({ ...settings, company_description: e.target.value || null })} placeholder="Breve descrição do que sua empresa faz..." rows={3} className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-gray-800 dark:text-slate-100 placeholder:text-gray-400 dark:text-slate-600 focus:outline-none focus:ring-2 focus:ring-rose-500/50 resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5 block">Idioma</label>
                <select value={settings.language} onChange={(e) => setSettings({ ...settings, language: e.target.value })} className="h-9 w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500/50">
                  <option value="pt-BR">Português (BR)</option>
                  <option value="en-US">English (US)</option>
                  <option value="es">Español</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5 block">Moeda</label>
                <select value={settings.currency} onChange={(e) => setSettings({ ...settings, currency: e.target.value })} className="h-9 w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500/50">
                  <option value="BRL">R$ (BRL)</option>
                  <option value="USD">$ (USD)</option>
                  <option value="EUR">€ (EUR)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

EmpresaSettings.displayName = 'EmpresaSettings';
export default EmpresaSettings;
