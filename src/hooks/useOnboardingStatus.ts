import { useState, useCallback } from 'react';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  isComplete: boolean;
  isRequired: boolean;
}

export interface OnboardingStatus {
  loading: boolean;
  isComplete: boolean;
  currentStep: number;
  steps: OnboardingStep[];
  completionPercentage: number;
  hasSeenWizard: boolean;
  isAdmin: boolean;
  refetch: () => Promise<void>;
  markWizardSeen: () => void;
  resetWizard: () => void;
}

const API_BASE = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE) || '/api';

export function useOnboardingStatus(): OnboardingStatus {
  const [hasSeenWizard, setHasSeenWizard] = useState(false);

  // Load wizard-seen flag from backend on mount
  useState(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/system_settings`);
        if (res.ok) {
          const json = await res.json();
          const data = json?.data ?? json;
          if (data?.onboarding_wizard_seen) setHasSeenWizard(true);
        }
      } catch {}
    })();
  });

  const steps: OnboardingStep[] = [
    { id: 'identity', title: 'Identidade', description: 'Configure o nome da empresa e do agente', isComplete: true, isRequired: true },
    { id: 'whatsapp', title: 'WhatsApp', description: 'Configure a API do WhatsApp Cloud', isComplete: false, isRequired: true },
    { id: 'agent', title: 'Agente', description: 'Configure o prompt e comportamento do agente', isComplete: true, isRequired: true },
    { id: 'elevenlabs', title: 'ElevenLabs', description: 'Configure respostas em áudio (opcional)', isComplete: false, isRequired: false },
    { id: 'business_hours', title: 'Horário', description: 'Configure o horário de atendimento', isComplete: hasSeenWizard, isRequired: false },
    { id: 'verification', title: 'Verificação', description: 'Verifique se o sistema está configurado', isComplete: false, isRequired: false },
    { id: 'finish', title: 'Finalização', description: 'Revise e teste sua configuração', isComplete: hasSeenWizard, isRequired: false },
  ];

  const markWizardSeen = useCallback(() => {
    setHasSeenWizard(true);
    // Persist to backend
    fetch(`${API_BASE}/system_settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onboarding_wizard_seen: true }),
    }).catch(err => console.error('Failed to persist wizard seen', err));
  }, []);

  const resetWizard = useCallback(() => {
    setHasSeenWizard(false);
    fetch(`${API_BASE}/system_settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onboarding_wizard_seen: false }),
    }).catch(err => console.error('Failed to reset wizard seen', err));
  }, []);

  const completionPercentage = Math.round((steps.filter(s => s.isComplete).length / steps.length) * 100);

  return {
    loading: false,
    isComplete: steps.every(s => s.isComplete),
    currentStep: steps.findIndex(s => !s.isComplete),
    steps,
    completionPercentage,
    hasSeenWizard,
    isAdmin: true,
    refetch: async () => {},
    markWizardSeen,
    resetWizard,
  };
}
