import React, { useRef, useState } from 'react';
import {
  Shield, Bot, Loader2, Save, RotateCcw, BookOpen, Lock,
  Server, Users, Mic, Webhook, Cpu, ChevronRight, Sun, Moon, BarChart, Building2, Eye
} from 'lucide-react';
import Instances from './settings/Instances';
import AgentSettings, { AgentSettingsRef } from './settings/AgentSettings';
import ChamadaApi from './settings/ChamadaApi';
import Webhooks from './settings/Webhooks';
import AiSettings, { AiSettingsRef } from './settings/AiSettings';
import Sectors from './settings/Sectors';
import AssignmentRules from './settings/AssignmentRules';
import MacrosSettings from './settings/MacrosSettings';
import Permissions from './settings/Permissions';
import { OnboardingBanner } from './OnboardingBanner';
import { SystemHealthCard } from './SystemHealthCard';
import Report from './settings/Report';
import ReportContainer from './settings/ReportContainer';
import SystemRoadmap from './SystemRoadmap';
import Team from './Team';
import Monitor from './settings/Monitor';
import EmpresaSettings, { EmpresaSettingsRef } from './settings/EmpresaSettings';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { Button } from './Button';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';
import { useOutletContext } from 'react-router-dom';

interface OutletContext {
  showOnboarding: boolean;
  setShowOnboarding: (show: boolean) => void;
}

type TabId = 'empresa' | 'agent' | 'instances' | 'ia' | 'chamada' | 'webhooks' | 'atribuicao' | 'setores' | 'macros' | 'relatorio' | 'monitor' | 'equipe' | 'docs' | 'permissoes';

interface NavGroup {
  label: string;
  items: { id: TabId; label: string; description: string; icon: React.ElementType }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Empresa',
    items: [
      { id: 'empresa',   label: 'Empresa',        description: 'Dados, contato e horário',     icon: Building2 },
    ],
  },
  {
    label: 'Agente',
    items: [
      { id: 'agent',     label: 'Agente IA',     description: 'Personalidade e comportamento', icon: Bot    },
      { id: 'ia',        label: 'Módulos IA',     description: 'Copilot, resumos e análise',   icon: Cpu    },
    ],
  },
  {
    label: 'Integrações',
    items: [
      { id: 'instances', label: 'Instâncias',     description: 'Canais, APIs e conexões',          icon: Server  },
      { id: 'chamada',   label: 'Chamada API',    description: 'ElevenLabs e n8n',              icon: Mic     },
      { id: 'webhooks',  label: 'Webhooks',       description: 'Eventos e notificações',        icon: Webhook },
    ],
  },
  {
    label: 'Relatórios',
    items: [
      { id: 'relatorio', label: 'Relatório',      description: 'Métricas e gráficos',           icon: BarChart },
      { id: 'monitor',   label: 'Monitoramento',  description: 'Monitor de conversas em tempo real', icon: Eye },
    ],
  },
  {
    label: 'Organização',
    items: [
      { id: 'atribuicao', label: 'Atribuição',     description: 'Regras de atribuição automática', icon: Server },
      { id: 'setores',   label: 'Setores',        description: 'Organize setores e distribuição', icon: Building2 },
      { id: 'permissoes', label: 'Permissões',    description: 'Gerencie papéis e permissões', icon: Shield },
      { id: 'macros',    label: 'Macros',         description: 'Respostas rápidas e atalhos',     icon: BookOpen },
      { id: 'equipe',    label: 'Equipe',         description: 'Usuários, times e funções',     icon: Users   },
      { id: 'docs',      label: 'Documentação',   description: 'Roadmap e referências',         icon: BookOpen },
    ],
  },
];

const SAVE_TABS: TabId[] = ['empresa', 'agent', 'ia'];

const Settings: React.FC = () => {
  const { companyName, isAdmin } = useCompanySettings();
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    // Read from DOM class (set by main.tsx from backend)
    return document.documentElement.classList.contains('light') ? 'light' : 'dark';
  });
  const empresaRef = useRef<EmpresaSettingsRef>(null);
  const agentRef = useRef<AgentSettingsRef>(null);
  const aiRef    = useRef<AiSettingsRef>(null);
  const [activeTab, setActiveTab] = useState<TabId>('agent');
  const [isDirty, setIsDirty] = React.useState(false);
  const { resetWizard } = useOnboardingStatus();
  const { setShowOnboarding } = useOutletContext<OutletContext>();

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    setIsDirty(false);
  };

  const handleReopenOnboarding = () => { resetWizard(); setShowOnboarding(true); };

  React.useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') { root.classList.remove('dark');  root.classList.add('light'); }
    else                   { root.classList.remove('light'); root.classList.add('dark');  }
    // Persist theme to backend
    const API_BASE = (import.meta as any).env?.VITE_API_BASE || '/api';
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/system_settings`);
        const current = res.ok ? ((await res.json())?.data ?? await res.json() ?? {}) : {};
        await fetch(`${API_BASE}/system_settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...current, theme }) });
      } catch (err) { console.error('Failed to persist theme', err); }
    })();
  }, [theme]);

  const handleSave = async () => {
    if (activeTab === 'empresa') await empresaRef.current?.save();
    else if (activeTab === 'agent') await agentRef.current?.save();
    else if (activeTab === 'ia')   await aiRef.current?.save();
  };

  const handleCancel = () => {
    if (activeTab === 'empresa') empresaRef.current?.cancel();
    else if (activeTab === 'agent') agentRef.current?.cancel();
    else if (activeTab === 'ia')   aiRef.current?.cancel();
  };

  const isSaving =
    activeTab === 'empresa' ? empresaRef.current?.isSaving :
    activeTab === 'agent' ? agentRef.current?.isSaving :
    activeTab === 'ia'    ? aiRef.current?.isSaving     : false;

  const activeItem = NAV_GROUPS.flatMap(g => g.items).find(i => i.id === activeTab);

  return (
    <div className="flex h-full w-full overflow-hidden bg-white dark:bg-slate-950 text-gray-900 dark:text-slate-50">

      {/* ── Left sub-sidebar ── */}
      <aside className="flex flex-col w-56 sm:w-64 shrink-0 border-r border-gray-200/70 dark:border-slate-800/70 bg-gray-100/60 dark:bg-slate-900/60 h-full overflow-y-auto custom-scrollbar">

        {/* Header */}
        <div className="px-5 pt-6 pb-4 border-b border-gray-200/60 dark:border-slate-800/60">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Configurações</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 leading-snug">
            {companyName}
            {!isAdmin && <span className="ml-1 text-amber-400">· leitura</span>}
          </p>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 px-3 py-4 space-y-5">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              <p className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-500 dark:text-slate-500">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map(item => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => handleTabChange(item.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all group ${
                          active
                            ? 'bg-primary/10 border border-primary/20 text-primary'
                            : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:text-white hover:bg-gray-200/50 dark:bg-slate-800/50 border border-transparent'
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-cyan-400' : 'text-gray-500 dark:text-slate-500 group-hover:text-gray-600 dark:text-slate-300'}`} />
                        <span className="flex-1 text-sm font-medium">{item.label}</span>
                        {active && <ChevronRight className="w-3.5 h-3.5 text-cyan-400/60" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer actions */}
        <div className="px-3 py-4 border-t border-gray-200/60 dark:border-slate-800/60 space-y-2">
          {/* Theme toggle */}
          <button
            onClick={() => setTheme(p => p === 'dark' ? 'light' : 'dark')}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:text-white hover:bg-gray-200/50 dark:bg-slate-800/50 transition-all text-sm"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
          </button>

          {/* Onboarding */}
          {isAdmin && (
            <button
              onClick={handleReopenOnboarding}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:text-white hover:bg-gray-200/50 dark:bg-slate-800/50 transition-all text-sm"
            >
              <RotateCcw className="w-4 h-4" />
              Refazer Onboarding
            </button>
          )}

          {/* Save / Cancel — removed from sidebar, now shown inline in header */}

          {/* Role badge */}
          <div className="flex justify-center pt-1">
            <span className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] rounded-full font-mono flex items-center gap-1">
              {isAdmin ? <><Shield className="w-3 h-3" /> Admin</> : <><Lock className="w-3 h-3" /> Somente Leitura</>}
            </span>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">

        {/* Content header breadcrumb */}
        <div className="flex items-center justify-between px-8 py-3 border-b border-gray-200/50 dark:border-slate-800/50 bg-white/80 dark:bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-slate-500">Configurações</span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400 dark:text-slate-600" />
            <span className="text-xs text-gray-600 dark:text-slate-300 font-medium">{activeItem?.label}</span>
            {activeItem?.description && (
              <>
                <span className="ml-2 text-gray-400 dark:text-slate-600">·</span>
                <span className="text-xs text-gray-500 dark:text-slate-500">{activeItem.description}</span>
              </>
            )}
          </div>

          {/* Botão flutuante de salvar — aparece ao detectar mudanças */}
          {isDirty && isAdmin && SAVE_TABS.includes(activeTab) && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={handleCancel} disabled={!!isSaving} className="h-8 text-sm">
                Cancelar
              </Button>
              <Button variant="primary" onClick={handleSave} disabled={!!isSaving} className="h-8 text-sm gap-2 shadow-lg shadow-[0_10px_30px_rgba(30,95,116,0.18)]">
                {isSaving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Salvando...</> : <><Save className="w-3.5 h-3.5" />Salvar alterações</>}
              </Button>
            </div>
          )}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-6 sm:p-8 max-w-full sm:max-w-4xl mx-auto">
            {/* Moved from Dashboard: onboarding + system status */}
            <div className="space-y-6 mb-6">
              <OnboardingBanner onOpenWizard={() => setShowOnboarding(true)} />
              <SystemHealthCard />
            </div>
            {activeTab === 'empresa'   && <EmpresaSettings ref={empresaRef} onDirtyChange={setIsDirty} />}
            {activeTab === 'agent'     && <AgentSettings ref={agentRef} onDirtyChange={setIsDirty} />}
            {activeTab === 'instances' && <Instances />}
            {activeTab === 'ia'        && <AiSettings ref={aiRef} onDirtyChange={setIsDirty} />}
            {activeTab === 'relatorio' && <ReportContainer />}
            {activeTab === 'monitor' && <Monitor />}
            {activeTab === 'chamada'   && <ChamadaApi />}
            {activeTab === 'webhooks'  && <Webhooks />}
            {activeTab === 'atribuicao'&& <AssignmentRules />}
            {activeTab === 'macros'    && <MacrosSettings />}
            {activeTab === 'equipe'    && <Team />}
            {activeTab === 'docs'      && <SystemRoadmap />}
            {activeTab === 'setores'   && <Sectors />}
            {activeTab === 'permissoes' && <Permissions />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
