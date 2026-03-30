import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, Circle, Rocket, Send, Loader2, AlertCircle, RefreshCw, XCircle, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OnboardingStep } from '@/hooks/useOnboardingStatus';
import { toast } from 'sonner';

interface StepFinishProps {
  steps: OnboardingStep[];
  companyName: string;
  sdrName: string;
  onComplete: () => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } },
};

export const StepFinish: React.FC<StepFinishProps> = ({ steps, companyName, sdrName, onComplete }) => {
  const completedSteps = steps.filter(s => s.isComplete);
  const requiredIncomplete = steps.filter(s => s.isRequired && !s.isComplete);

  return (
    <motion.div className="space-y-6" variants={containerVariants} initial="hidden" animate="visible">
      <motion.div variants={itemVariants} className="text-center mb-6">
        <motion.div 
          className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center"
          whileHover={{ scale: 1.05, rotate: 5 }}
        >
          <Rocket className="w-8 h-8 text-emerald-400" />
        </motion.div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Tudo Pronto!</h3>
        <p className="text-gray-500 dark:text-slate-400 text-sm max-w-md mx-auto">
          {companyName ? `O sistema ${companyName}` : 'O sistema'} está configurado{sdrName ? ` com o agente ${sdrName}` : ''}.
        </p>
      </motion.div>

      {/* Steps Summary */}
      <motion.div variants={itemVariants} className="max-w-md mx-auto">
        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {completedSteps.length}/{steps.length} etapas concluídas
            </span>
          </div>
          <div className="space-y-1">
            {steps.map((step) => (
              <div key={step.id} className="flex items-center gap-2 text-xs">
                {step.isComplete ? (
                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Circle className="w-3 h-3 text-gray-500 dark:text-slate-500" />
                )}
                <span className={step.isComplete ? 'text-gray-600 dark:text-slate-300' : 'text-gray-500 dark:text-slate-500'}>
                  {step.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Info mock mode */}
      <motion.div variants={itemVariants} className="max-w-md mx-auto">
        <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
          <p className="text-xs text-amber-400">
            ⚠️ Modo Mock: dados salvos localmente no navegador. Testes de envio de mensagens não disponíveis.
          </p>
        </div>
      </motion.div>

      {/* Complete Button */}
      <motion.div variants={itemVariants} className="max-w-md mx-auto pt-4">
        <Button variant="primary" onClick={onComplete} className="w-full py-3 text-base">
          <Rocket className="w-5 h-5 mr-2" />
          Começar a Usar o Sistema
        </Button>
      </motion.div>
    </motion.div>
  );
};
