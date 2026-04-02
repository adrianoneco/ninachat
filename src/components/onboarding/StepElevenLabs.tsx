import React, { useState } from 'react';
import { Mic, Eye, EyeOff, Play, Loader2, Volume2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/Button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';

interface StepElevenLabsProps {
  elevenLabsApiKey: string;
  elevenLabsVoiceId: string;
  elevenLabsModel: string;
  audioResponseEnabled: boolean;
  elevenLabsStability: number;
  elevenLabsSimilarityBoost: number;
  elevenLabsSpeed: number;
  onApiKeyChange: (value: string) => void;
  onVoiceIdChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onAudioEnabledChange: (value: boolean) => void;
  onStabilityChange: (value: number) => void;
  onSimilarityBoostChange: (value: number) => void;
  onSpeedChange: (value: number) => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 }
  },
};

// Top ElevenLabs voices
const VOICES = [
  { id: '33B4UnXyTNbgLmdEDh5P', name: 'Keren - Young Brazilian Female', description: 'Feminina, brasileira (Padrão)' },
  { id: '9BWtsMINqrJLrRacOk9x', name: 'Aria', description: 'Feminina, natural' },
  { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger', description: 'Masculina, profissional' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', description: 'Feminina, amigável' },
  { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura', description: 'Feminina, suave' },
  { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie', description: 'Masculina, casual' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', description: 'Masculina, britânica' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', description: 'Masculina, jovem' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', description: 'Feminina, elegante' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', description: 'Feminina, expressiva' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', description: 'Masculina, clara' },
];

const MODELS = [
  { id: 'eleven_turbo_v2_5', name: 'Turbo v2.5', description: 'Rápido, 32 idiomas' },
  { id: 'eleven_multilingual_v2', name: 'Multilingual v2', description: 'Alta qualidade, 29 idiomas' },
  { id: 'eleven_turbo_v2', name: 'Turbo v2', description: 'Rápido, apenas inglês' },
];

export const StepElevenLabs: React.FC<StepElevenLabsProps> = ({
  elevenLabsApiKey,
  elevenLabsVoiceId,
  elevenLabsModel,
  audioResponseEnabled,
  elevenLabsStability,
  elevenLabsSimilarityBoost,
  elevenLabsSpeed,
  onApiKeyChange,
  onVoiceIdChange,
  onModelChange,
  onAudioEnabledChange,
  onStabilityChange,
  onSimilarityBoostChange,
  onSpeedChange,
}) => {
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const handleTestVoice = async () => {
    toast.info('Teste de voz não disponível no modo mock');
  };

  const selectedVoice = VOICES.find(v => v.id === elevenLabsVoiceId);

  return (
    <motion.div 
      className="space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants} className="text-center mb-8">
        <motion.div 
          className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30 flex items-center justify-center"
          whileHover={{ scale: 1.05, rotate: 5 }}
          transition={{ type: "spring", stiffness: 400 }}
        >
          <Mic className="w-8 h-8 text-violet-400" />
        </motion.div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Respostas em Áudio</h3>
        <p className="text-gray-500 dark:text-slate-400 text-sm max-w-md mx-auto">
          Configure o ElevenLabs para que seu agente responda também por áudio.
        </p>
        <span className="inline-flex items-center gap-1 mt-3 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 border border-amber-500/30 text-amber-400">
          ⚡ Opcional
        </span>
      </motion.div>

      <div className="space-y-6 max-w-md mx-auto">
        {/* Enable Audio Toggle */}
        <motion.div variants={itemVariants} className="flex items-center justify-between p-4 rounded-lg bg-gray-200/30 dark:bg-slate-800/30 border border-gray-300/50 dark:border-slate-700/50">
          <div className="flex items-center gap-3">
            <Volume2 className="w-5 h-5 text-violet-400" />
            <div>
              <Label className="text-gray-600 dark:text-slate-300">Habilitar Respostas em Áudio</Label>
              <p className="text-xs text-gray-500 dark:text-slate-500">O agente enviará mensagens de voz</p>
            </div>
          </div>
          <Switch
            checked={audioResponseEnabled}
            onCheckedChange={onAudioEnabledChange}
          />
        </motion.div>

        {/* API Key */}
        <motion.div variants={itemVariants} className="space-y-2">
          <Label htmlFor="elevenLabsApiKey" className="text-gray-600 dark:text-slate-300 flex items-center gap-2">
            <Mic className="w-4 h-4 text-gray-500 dark:text-slate-500" />
            API Key do ElevenLabs
          </Label>
          <div className="relative">
            <Input
              id="elevenLabsApiKey"
              type={showApiKey ? 'text' : 'password'}
              value={elevenLabsApiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder="sk-..."
              className="bg-gray-200/50 dark:bg-slate-800/50 border-gray-300 dark:border-slate-700 focus:border-violet-500 text-gray-900 dark:text-white placeholder:text-gray-500 dark:text-slate-500 pr-10 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-500 hover:text-gray-600 dark:text-slate-300"
            >
              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-500">
            Obtenha em{' '}
            <a href="https://elevenlabs.io/app/settings/api-keys" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline">
              elevenlabs.io
            </a>
          </p>
        </motion.div>

        {/* Voice Selector */}
        <motion.div variants={itemVariants} className="space-y-2">
          <Label className="text-gray-600 dark:text-slate-300">Voz</Label>
          <Select value={elevenLabsVoiceId} onValueChange={onVoiceIdChange}>
            <SelectTrigger className="bg-gray-200/50 dark:bg-slate-800/50 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white">
              <SelectValue placeholder="Selecione uma voz">
                {selectedVoice ? `${selectedVoice.name} - ${selectedVoice.description}` : 'Selecione uma voz'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-gray-200 dark:bg-slate-800 border-gray-300 dark:border-slate-700 z-50">
              {VOICES.map((voice) => (
                <SelectItem key={voice.id} value={voice.id} className="text-gray-900 dark:text-white hover:bg-violet-500/20 focus:bg-violet-500/20 focus:text-gray-900 dark:text-white">
                  <span className="font-medium">{voice.name}</span>
                  <span className="text-gray-500 dark:text-slate-400 ml-2">- {voice.description}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </motion.div>

        {/* Model Selector */}
        <motion.div variants={itemVariants} className="space-y-2">
          <Label className="text-gray-600 dark:text-slate-300">Modelo</Label>
          <Select value={elevenLabsModel} onValueChange={onModelChange}>
            <SelectTrigger className="bg-gray-200/50 dark:bg-slate-800/50 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white">
              <SelectValue placeholder="Selecione um modelo" />
            </SelectTrigger>
            <SelectContent className="bg-gray-200 dark:bg-slate-800 border-gray-300 dark:border-slate-700 z-50">
              {MODELS.map((model) => (
                <SelectItem key={model.id} value={model.id} className="text-gray-900 dark:text-white hover:bg-violet-500/20 focus:bg-violet-500/20 focus:text-gray-900 dark:text-white">
                  <span className="font-medium">{model.name}</span>
                  <span className="text-gray-500 dark:text-slate-400 ml-2">- {model.description}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </motion.div>

        {/* Voice Settings Sliders */}
        <motion.div variants={itemVariants} className="space-y-4 p-4 rounded-lg bg-gray-200/20 dark:bg-slate-800/20 border border-gray-300/30 dark:border-slate-700/30">
          <h4 className="text-sm font-medium text-gray-600 dark:text-slate-300">Ajustes da Voz</h4>
          
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500 dark:text-slate-400">Estabilidade</span>
                <span className="text-gray-500 dark:text-slate-500">{(Number(elevenLabsStability) * 100).toFixed(0)}%</span>
              </div>
              <Slider
                value={[Number(elevenLabsStability)]}
                onValueChange={([v]) => onStabilityChange(v)}
                min={0}
                max={1}
                step={0.05}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500 dark:text-slate-400">Similaridade</span>
                <span className="text-gray-500 dark:text-slate-500">{(Number(elevenLabsSimilarityBoost) * 100).toFixed(0)}%</span>
              </div>
              <Slider
                value={[Number(elevenLabsSimilarityBoost)]}
                onValueChange={([v]) => onSimilarityBoostChange(v)}
                min={0}
                max={1}
                step={0.05}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500 dark:text-slate-400">Velocidade</span>
                <span className="text-gray-500 dark:text-slate-500">{Number(elevenLabsSpeed).toFixed(1)}x</span>
              </div>
              <Slider
                value={[Number(elevenLabsSpeed)]}
                onValueChange={([v]) => onSpeedChange(v)}
                min={0.5}
                max={2}
                step={0.1}
                className="w-full"
              />
            </div>
          </div>
        </motion.div>

        {/* Test Button */}
        <motion.div variants={itemVariants}>
          <Button
            variant="outline"
            onClick={handleTestVoice}
            disabled={!elevenLabsApiKey || isTesting}
            className="w-full gap-2"
          >
            {isTesting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Testando...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Testar Voz
              </>
            )}
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
};
