import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Loader2, 
  RefreshCw,
  Shield,
  MessageSquare,
  Building2,
  Bot,
  Database,
  Users,
  Mic,
  Clock
} from 'lucide-react';
import { Button } from '@/components/Button';

interface HealthCheckResult {
  component: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  details?: Record<string, unknown>;
}

interface StepVerificationProps {
  onAllChecked: (allOk: boolean) => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

const componentIcons: Record<string, React.ReactNode> = {
  identity: <Building2 className="w-5 h-5" />,
  whatsapp: <MessageSquare className="w-5 h-5" />,
  agent_prompt: <Bot className="w-5 h-5" />,
  livechat_settings: <Database className="w-5 h-5" />,
  elevenlabs: <Mic className="w-5 h-5" />,
  business_hours: <Clock className="w-5 h-5" />,
};

const componentLabels: Record<string, string> = {
  identity: 'Identidade da Empresa',
  whatsapp: 'WhatsApp Cloud API',
  agent_prompt: 'Prompt do Agente',
  livechat_settings: 'Configurações do Sistema',
  elevenlabs: 'Respostas em Áudio',
  business_hours: 'Horário Comercial',
};

export const StepVerification: React.FC<StepVerificationProps> = ({ onAllChecked }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<HealthCheckResult[]>([]);
  const [overallStatus, setOverallStatus] = useState<'ok' | 'warning' | 'error' | null>(null);
  const [hasChecked, setHasChecked] = useState(false);

  const runHealthCheck = async () => {
    setIsLoading(true);
    try {
      let settings: any = {};
      const API_BASE = import.meta.env.VITE_API_BASE || '/api';
      try {
        const res = await fetch(`${API_BASE}/livechat_settings`);
        if (res.ok) { const json = await res.json(); settings = json?.data ?? json ?? {}; }
      } catch {}
      if (!settings || !Object.keys(settings).length) settings = {};
      const checkResults: HealthCheckResult[] = [];

      // Check identity
      checkResults.push({
        component: 'identity',
        status: settings.company_name && settings.sdr_name ? 'ok' : 'error',
        message: settings.company_name ? `${settings.company_name} / ${settings.sdr_name}` : 'Nome da empresa não configurado',
      });

      // Check WhatsApp
      checkResults.push({
        component: 'whatsapp',
        status: settings.whatsapp_access_token && settings.whatsapp_phone_number_id ? 'ok' : 'warning',
        message: settings.whatsapp_access_token ? 'Credenciais configuradas' : 'Credenciais não configuradas',
      });

      // Check agent prompt
      checkResults.push({
        component: 'agent_prompt',
        status: settings.system_prompt_override ? 'ok' : 'warning',
        message: settings.system_prompt_override ? 'Prompt personalizado configurado' : 'Usando prompt padrão',
      });

      // Check ElevenLabs
      checkResults.push({
        component: 'elevenlabs',
        status: settings.elevenlabs_api_key ? 'ok' : 'warning',
        message: settings.elevenlabs_api_key ? 'API Key configurada' : 'Opcional - não configurado',
      });

      // Check business hours
      checkResults.push({
        component: 'business_hours',
        status: 'ok',
        message: `${settings.business_hours_start || '09:00'} - ${settings.business_hours_end || '18:00'}`,
      });

      setResults(checkResults);
      const hasErrors = checkResults.some(r => r.status === 'error');
      const hasWarnings = checkResults.some(r => r.status === 'warning');
      const status = hasErrors ? 'error' : hasWarnings ? 'warning' : 'ok';
      setOverallStatus(status);
      onAllChecked(!hasErrors);
    } finally {
      setIsLoading(false);
      setHasChecked(true);
    }
  };

  useEffect(() => {
    runHealthCheck();
  }, []);

  const getStatusIcon = (status: 'ok' | 'warning' | 'error') => {
    switch (status) {
      case 'ok': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'error': return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const getStatusColor = (status: 'ok' | 'warning' | 'error') => {
    switch (status) {
      case 'ok': return 'border-green-500/30 bg-green-500/5';
      case 'warning': return 'border-yellow-500/30 bg-yellow-500/5';
      case 'error': return 'border-red-500/30 bg-red-500/5';
    }
  };

  const getOverallMessage = () => {
    if (!hasChecked) return null;
    switch (overallStatus) {
      case 'ok':
        return (
          <div className="p-4 rounded-lg border border-green-500/30 bg-green-500/10 text-green-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">Sistema configurado!</span>
            </div>
            <p className="text-sm mt-1 text-green-400/80">Todas as configurações estão OK.</p>
          </div>
        );
      case 'warning':
        return (
          <div className="p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-yellow-300">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">Sistema funcional com pendências</span>
            </div>
            <p className="text-sm mt-1 text-yellow-400/80">Algumas configurações opcionais estão pendentes.</p>
          </div>
        );
      case 'error':
        return (
          <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              <span className="font-medium">Configuração necessária</span>
            </div>
            <p className="text-sm mt-1 text-red-400/80">Complete os itens em vermelho.</p>
          </div>
        );
      default: return null;
    }
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Verificação do Sistema</h3>
        <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">Verificando configurações salvas localmente</p>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
          <p className="text-sm text-gray-500 dark:text-slate-400">Verificando...</p>
        </div>
      ) : (
        <>
          {getOverallMessage()}
          <div className="space-y-2">
            {results.map((result) => (
              <motion.div
                key={result.component}
                variants={itemVariants}
                className={`p-3 rounded-lg border ${getStatusColor(result.status)} flex items-start gap-3`}
              >
                <div className="mt-0.5">
                  {componentIcons[result.component] || <Database className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm text-gray-900 dark:text-white">
                      {componentLabels[result.component] || result.component}
                    </span>
                    {getStatusIcon(result.status)}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 truncate">{result.message}</p>
                </div>
              </motion.div>
            ))}
          </div>
          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={runHealthCheck} disabled={isLoading}
              className="gap-2 border-violet-500/50 text-violet-400 hover:bg-violet-500/20 hover:text-violet-300">
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Verificar Novamente
            </Button>
          </div>
        </>
      )}
    </motion.div>
  );
};
