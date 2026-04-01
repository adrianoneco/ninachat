import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Loader2, Settings2, SkipForward } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Button } from '@/components/Button';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';
import { StepIdentity } from './onboarding/StepIdentity';
import { StepWhatsApp } from './onboarding/StepWhatsApp';
import { StepAgent } from './onboarding/StepAgent';
import { StepElevenLabs } from './onboarding/StepElevenLabs';
import { StepBusinessHours } from './onboarding/StepBusinessHours';
import { StepVerification } from './onboarding/StepVerification';
import { StepFinish } from './onboarding/StepFinish';
import { toast } from 'sonner';
import PromptGeneratorSheet from './settings/PromptGeneratorSheet';
import { DEFAULT_LIVECHAT_PROMPT } from '@/prompts/default-livechat-prompt';

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

const stepVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
    scale: 0.9,
    filter: 'blur(10px)',
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 80 : -80,
    opacity: 0,
    scale: 0.9,
    filter: 'blur(10px)',
  }),
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 30 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.9, y: 30 },
};

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const AnimatedCheckmark = () => (
  <motion.svg viewBox="0 0 24 24" className="w-4 h-4" initial="hidden" animate="visible">
    <motion.path
      d="M5 13l4 4L19 7"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      variants={{
        hidden: { pathLength: 0, opacity: 0 },
        visible: { pathLength: 1, opacity: 1, transition: { pathLength: { duration: 0.4, ease: "easeOut" }, opacity: { duration: 0.1 } } }
      }}
    />
  </motion.svg>
);

const StepCircle = ({ index, activeStep, isOptional, onClick }: { index: number; activeStep: number; isOptional?: boolean; onClick: () => void }) => {
  const isCompleted = index < activeStep;
  const isActive = index === activeStep;
  return (
    <motion.button onClick={onClick} className="relative z-10 flex-shrink-0" whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.95 }}>
      {isActive && (
        <motion.div className="absolute inset-0 rounded-full bg-cyan-500/30" animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} style={{ margin: '-4px' }} />
      )}
      <motion.div
        className={`relative flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors duration-300 ${
          isCompleted ? 'bg-gradient-to-br from-primary to-accent border-border/30 text-gray-900 dark:text-white shadow-lg shadow-[0_14px_40px_rgba(30,95,116,0.20)]'
            : isActive ? 'border-border/30 text-primary bg-primary/10 shadow-lg shadow-[0_10px_30px_rgba(30,95,116,0.16)]'
            : isOptional ? 'border-gray-300 dark:border-slate-600 text-gray-500 dark:text-slate-500 bg-gray-200/50 dark:bg-slate-800/50 border-dashed'
            : 'border-gray-300 dark:border-slate-700 text-gray-500 dark:text-slate-500 bg-gray-200/50 dark:bg-slate-800/50'
        }`}
        animate={isActive ? { boxShadow: ['0 0 0px rgba(6,182,212,0.4)', '0 0 25px rgba(6,182,212,0.6)', '0 0 0px rgba(6,182,212,0.4)'] } : {}}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        {isCompleted ? <AnimatedCheckmark /> : <motion.span key={index} className="text-xs font-semibold" initial={{ rotateY: -90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} transition={{ duration: 0.3 }}>{index + 1}</motion.span>}
      </motion.div>
    </motion.button>
  );
};

const ConnectingLine = ({ isCompleted }: { isCompleted: boolean }) => (
  <div className="relative flex-1 h-0.5 mx-1 bg-gray-300/50 dark:bg-slate-700/50 rounded-full overflow-hidden self-center min-w-[12px]">
    <motion.div className="absolute inset-0 bg-gradient-to-r from-primary to-accent" initial={{ scaleX: 0 }} animate={{ scaleX: isCompleted ? 1 : 0 }} transition={{ duration: 0.5, ease: "easeOut" }} style={{ transformOrigin: 'left' }} />
  </div>
);

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ isOpen, onClose }) => {
  const { steps, currentStep, refetch, markWizardSeen } = useOnboardingStatus();
  const [activeStep, setActiveStep] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [showPromptGenerator, setShowPromptGenerator] = useState(false);
  const [verificationPassed, setVerificationPassed] = useState(false);

  // Form state - Identity
  const [companyName, setCompanyName] = useState('');
  const [sdrName, setSdrName] = useState('');
  
  // Form state - WhatsApp
  const [accessToken, setAccessToken] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [businessAccountId, setBusinessAccountId] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  
  // Form state - Agent
  const [systemPrompt, setSystemPrompt] = useState('');
  const [aiModelMode, setAiModelMode] = useState('flash');
  
  // Form state - ElevenLabs
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState('');
  const [elevenLabsVoiceId, setElevenLabsVoiceId] = useState('33B4UnXyTNbgLmdEDh5P');
  const [elevenLabsModel, setElevenLabsModel] = useState('eleven_turbo_v2_5');
  const [audioResponseEnabled, setAudioResponseEnabled] = useState(false);
  const [elevenLabsStability, setElevenLabsStability] = useState(0.75);
  const [elevenLabsSimilarityBoost, setElevenLabsSimilarityBoost] = useState(0.8);
  const [elevenLabsSpeed, setElevenLabsSpeed] = useState(1.0);
  
  // Form state - Business Hours
  const [timezone, setTimezone] = useState('America/Sao_Paulo');
  const [businessHoursStart, setBusinessHoursStart] = useState('09:00');
  const [businessHoursEnd, setBusinessHoursEnd] = useState('18:00');
  const [businessDays, setBusinessDays] = useState<number[]>([1, 2, 3, 4, 5]);

  const webhookUrl = 'https://mock-url/functions/v1/whatsapp-webhook';

  // Load settings from backend
  useEffect(() => {
    if (isOpen) {
      setIsInitializing(true);
      (async () => {
      try {
        // Try backend first
        const API_BASE = import.meta.env.VITE_API_BASE || '/api';
        try {
          const res = await fetch(`${API_BASE}/livechat_settings`);
          if (res.ok) {
            const json = await res.json();
            const data = json?.data ?? json;
            if (data) {
              setCompanyName(data.company_name || '');
              setSdrName(data.sdr_name || '');
              setAccessToken(data.whatsapp_access_token || '');
              setPhoneNumberId(data.whatsapp_phone_number_id || '');
              setBusinessAccountId(data.whatsapp_business_account_id || '');
              setVerifyToken(data.whatsapp_verify_token || '');
              setSystemPrompt(data.system_prompt_override || DEFAULT_LIVECHAT_PROMPT);
              setAiModelMode(data.ai_model_mode || 'flash');
              setElevenLabsApiKey(data.elevenlabs_api_key || '');
              setElevenLabsVoiceId(data.elevenlabs_voice_id || '33B4UnXyTNbgLmdEDh5P');
              setElevenLabsModel(data.elevenlabs_model || 'eleven_turbo_v2_5');
              setAudioResponseEnabled(data.audio_response_enabled || false);
              setElevenLabsStability(data.elevenlabs_stability || 0.75);
              setElevenLabsSimilarityBoost(data.elevenlabs_similarity_boost || 0.8);
              setElevenLabsSpeed(data.elevenlabs_speed || 1.0);
              setTimezone(data.timezone || 'America/Sao_Paulo');
              setBusinessHoursStart(data.business_hours_start?.substring(0, 5) || '09:00');
              setBusinessHoursEnd(data.business_hours_end?.substring(0, 5) || '18:00');
              setBusinessDays(data.business_days || [1, 2, 3, 4, 5]);
              setIsInitializing(false);
            }
          }
        } catch {}
        // Backend unavailable — use defaults (already set in state init)
      } catch (error) {
        console.error('[OnboardingWizard] Error loading settings:', error);
      } finally {
        setIsInitializing(false);
      }
      setActiveStep(0);
      })();
    }
  }, [isOpen]);

  const validateStepData = useCallback((stepIndex: number): { valid: boolean; issues: string[] } => {
    const issues: string[] = [];
    switch (stepIndex) {
      case 0:
        if (!companyName?.trim()) issues.push('Nome da empresa está vazio');
        if (!sdrName?.trim()) issues.push('Nome do SDR está vazio');
        break;
      case 1:
        if (!accessToken?.trim()) issues.push('Access Token está vazio');
        if (!phoneNumberId?.trim()) issues.push('Phone Number ID está vazio');
        break;
    }
    return { valid: issues.length === 0, issues };
  }, [companyName, sdrName, accessToken, phoneNumberId]);

  const saveSettings = useCallback(async () => {
    setIsSaving(true);
    try {
      const API_BASE = import.meta.env.VITE_API_BASE || '/api';
      let current: any = {};
      try {
        const res = await fetch(`${API_BASE}/livechat_settings`);
        if (res.ok) { const json = await res.json(); current = json?.data ?? json ?? {}; }
      } catch {}
      if (!current || !Object.keys(current).length) current = {};
      const settings = {
        ...current,
        company_name: companyName?.trim() || null,
        sdr_name: sdrName?.trim() || null,
        whatsapp_access_token: accessToken?.trim() || null,
        whatsapp_phone_number_id: phoneNumberId?.trim() || null,
        whatsapp_business_account_id: businessAccountId?.trim() || null,
        whatsapp_verify_token: verifyToken?.trim() || null,
        system_prompt_override: systemPrompt?.trim() || DEFAULT_LIVECHAT_PROMPT,
        ai_model_mode: aiModelMode || 'flash',
        elevenlabs_api_key: elevenLabsApiKey?.trim() || null,
        elevenlabs_voice_id: elevenLabsVoiceId || '33B4UnXyTNbgLmdEDh5P',
        elevenlabs_model: elevenLabsModel || 'eleven_turbo_v2_5',
        audio_response_enabled: Boolean(audioResponseEnabled),
        elevenlabs_stability: Number(elevenLabsStability) || 0.75,
        elevenlabs_similarity_boost: Number(elevenLabsSimilarityBoost) || 0.8,
        elevenlabs_speed: Number(elevenLabsSpeed) || 1.0,
        timezone: timezone || 'America/Sao_Paulo',
        business_hours_start: businessHoursStart || '09:00',
        business_hours_end: businessHoursEnd || '18:00',
        business_days: businessDays?.length > 0 ? businessDays : [1, 2, 3, 4, 5],
        is_active: true,
        auto_response_enabled: true,
        updated_at: new Date().toISOString(),
      };
      // Persist to backend
      try {
        const res = await fetch(`${API_BASE}/livechat_settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        console.error('[OnboardingWizard] Failed to save to backend', err);
        throw err;
      }
      toast.success('Configurações salvas!');
      await refetch();
      return true;
    } catch (error) {
      console.error('[OnboardingWizard] Error saving:', error);
      toast.error('Erro ao salvar configurações');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [companyName, sdrName, accessToken, phoneNumberId, businessAccountId, verifyToken,
      systemPrompt, aiModelMode, elevenLabsApiKey, elevenLabsVoiceId, elevenLabsModel,
      audioResponseEnabled, elevenLabsStability, elevenLabsSimilarityBoost, elevenLabsSpeed,
      timezone, businessHoursStart, businessHoursEnd, businessDays, refetch]);

  const handleNext = async () => {
    const { valid, issues } = validateStepData(activeStep);
    if (!valid) {
      toast.error('Preencha os campos obrigatórios', { description: issues.join(', ') });
      return;
    }
    const saved = await saveSettings();
    if (!saved) return;

    if (activeStep < STEP_CONFIG.length - 1) {
      setDirection(1);
      setActiveStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setDirection(-1);
      setActiveStep(prev => prev - 1);
    }
  };

  const handleSkipStep = async () => {
    await saveSettings();
    if (activeStep < STEP_CONFIG.length - 1) {
      setDirection(1);
      setActiveStep(prev => prev + 1);
    }
  };

  const handleFinish = async () => {
    const saved = await saveSettings();
    if (saved) {
      markWizardSeen();
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      toast.success('🎉 Configuração concluída!');
      onClose();
    }
  };

  const handleGoToStep = (index: number) => {
    setDirection(index > activeStep ? 1 : -1);
    setActiveStep(index);
  };

  const STEP_CONFIG = [
    { id: 'identity', title: 'Identidade', isOptional: false },
    { id: 'whatsapp', title: 'WhatsApp', isOptional: false },
    { id: 'agent', title: 'Agente IA', isOptional: false },
    { id: 'elevenlabs', title: 'Voz (ElevenLabs)', isOptional: true },
    { id: 'business_hours', title: 'Horário', isOptional: true },
    { id: 'verification', title: 'Verificação', isOptional: true },
    { id: 'finish', title: 'Finalizar', isOptional: false },
  ];

  const currentStepConfig = STEP_CONFIG[activeStep];
  const isLastStep = activeStep === STEP_CONFIG.length - 1;

  const renderStep = () => {
    switch (activeStep) {
      case 0:
        return <StepIdentity companyName={companyName} sdrName={sdrName} onCompanyNameChange={setCompanyName} onSdrNameChange={setSdrName} />;
      case 1:
        return <StepWhatsApp accessToken={accessToken} phoneNumberId={phoneNumberId} businessAccountId={businessAccountId} verifyToken={verifyToken} onAccessTokenChange={setAccessToken} onPhoneNumberIdChange={setPhoneNumberId} onBusinessAccountIdChange={setBusinessAccountId} onVerifyTokenChange={setVerifyToken} webhookUrl={webhookUrl} />;
      case 2:
        return <StepAgent systemPrompt={systemPrompt} aiModelMode={aiModelMode} onSystemPromptChange={setSystemPrompt} onAiModelModeChange={setAiModelMode} onGeneratePrompt={() => setShowPromptGenerator(true)} />;
      case 3:
        return <StepElevenLabs elevenLabsApiKey={elevenLabsApiKey} elevenLabsVoiceId={elevenLabsVoiceId} elevenLabsModel={elevenLabsModel} audioResponseEnabled={audioResponseEnabled} elevenLabsStability={elevenLabsStability} elevenLabsSimilarityBoost={elevenLabsSimilarityBoost} elevenLabsSpeed={elevenLabsSpeed} onApiKeyChange={setElevenLabsApiKey} onVoiceIdChange={setElevenLabsVoiceId} onModelChange={setElevenLabsModel} onAudioEnabledChange={setAudioResponseEnabled} onStabilityChange={setElevenLabsStability} onSimilarityBoostChange={setElevenLabsSimilarityBoost} onSpeedChange={setElevenLabsSpeed} />;
      case 4:
        return <StepBusinessHours timezone={timezone} businessHoursStart={businessHoursStart} businessHoursEnd={businessHoursEnd} businessDays={businessDays} onTimezoneChange={setTimezone} onBusinessHoursStartChange={setBusinessHoursStart} onBusinessHoursEndChange={setBusinessHoursEnd} onBusinessDaysChange={setBusinessDays} />;
      case 5:
        return <StepVerification onAllChecked={(passed: boolean) => setVerificationPassed(passed)} />;
      case 6:
        return <StepFinish steps={steps} companyName={companyName} sdrName={sdrName} onComplete={handleFinish} />;
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" variants={backdropVariants} initial="hidden" animate="visible" exit="exit">
          {/* Backdrop */}
          <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

          {/* Modal */}
          <motion.div className="relative w-full max-w-2xl max-h-[90vh] bg-gray-100 dark:bg-slate-900 border border-gray-300/50 dark:border-slate-700/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden" variants={modalVariants} initial="hidden" animate="visible" exit="exit" transition={{ type: 'spring', damping: 25, stiffness: 300 }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <Settings2 className="w-5 h-5 text-cyan-400" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Configuração Inicial</h2>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Passo {activeStep + 1} de {STEP_CONFIG.length} — {currentStepConfig.title}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-200 dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step indicators */}
            <div className="px-6 py-3 border-b border-gray-200/50 dark:border-slate-800/50">
              <div className="flex items-center">
                {STEP_CONFIG.map((step, index) => (
                  <React.Fragment key={step.id}>
                    <StepCircle index={index} activeStep={activeStep} isOptional={step.isOptional} onClick={() => handleGoToStep(index)} />
                    {index < STEP_CONFIG.length - 1 && <ConnectingLine isCompleted={index < activeStep} />}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 min-h-[300px]">
              {isInitializing ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
                  <p className="text-sm text-gray-500 dark:text-slate-400">Carregando configurações...</p>
                </div>
              ) : (
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div key={activeStep} custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3, ease: 'easeInOut' }}>
                    {renderStep()}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-slate-800 bg-gray-100/80 dark:bg-slate-900/80">
              <div>
                {activeStep > 0 && (
                  <Button variant="ghost" onClick={handleBack} disabled={isSaving}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {currentStepConfig.isOptional && !isLastStep && (
                  <Button variant="ghost" onClick={handleSkipStep} disabled={isSaving}>
                    <SkipForward className="w-4 h-4 mr-1" /> Pular
                  </Button>
                )}
                {isLastStep ? (
                  <Button onClick={handleFinish} disabled={isSaving}>
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                    🎉 Concluir
                  </Button>
                ) : (
                  <Button onClick={handleNext} disabled={isSaving}>
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                    Próximo <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      <PromptGeneratorSheet
        open={showPromptGenerator}
        onOpenChange={setShowPromptGenerator}
        onPromptGenerated={(prompt: string) => {
          setSystemPrompt(prompt);
          setShowPromptGenerator(false);
        }}
      />
    </>
  );
};
