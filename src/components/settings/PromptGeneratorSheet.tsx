import React, { useState, useEffect } from 'react';
import { Wand2, Loader2 } from 'lucide-react';
import { Button } from '../Button';
import { toast } from 'sonner';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface PromptGeneratorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPromptGenerated: (prompt: string) => void;
}

interface FormData {
  sdr_name: string;
  role: string;
  company_name: string;
  paper_type: string;
  personality: string;
  tone: string;
  prohibited_terms: string;
  philosophy_name: string;
  lead_talk_percentage: number;
  max_lines: number;
  products: string;
  differentials: string;
  conversion_action: string;
  tools: string;
}

const PromptGeneratorSheet: React.FC<PromptGeneratorSheetProps> = ({
  open,
  onOpenChange,
  onPromptGenerated,
}) => {
  const { companyName, sdrName } = useCompanySettings();
  const [loading, setLoading] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [formData, setFormData] = useState<FormData>({
    sdr_name: '',
    role: 'SDR',
    company_name: '',
    paper_type: 'consultor amigo',
    personality: 'Profissional, consultivo, empático e focado em entender necessidades reais',
    tone: 'consultivo',
    prohibited_terms: 'gírias, jargões complexos, pressão por venda',
    philosophy_name: 'Venda Consultiva',
    lead_talk_percentage: 80,
    max_lines: 3,
    products: '',
    differentials: '',
    conversion_action: 'Agendar reunião',
    tools: 'agendamento, reagendamento, cancelamento',
  });

  useEffect(() => {
    if (companyName && sdrName) {
      setFormData(prev => ({ ...prev, company_name: companyName, sdr_name: sdrName }));
    }
  }, [companyName, sdrName]);

  const handleGenerate = async () => {
    if (!formData.sdr_name || !formData.company_name || !formData.products || !formData.differentials) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      // Mock prompt generation
      const prompt = `Você é ${formData.sdr_name}, ${formData.role} da ${formData.company_name}.

Seu papel é atuar como ${formData.paper_type}.

PERSONALIDADE: ${formData.personality}
TOM: ${formData.tone}
TERMOS PROIBIDOS: ${formData.prohibited_terms}

FILOSOFIA: ${formData.philosophy_name}
- O lead deve falar ${formData.lead_talk_percentage}% do tempo
- Máximo de ${formData.max_lines} linhas por mensagem

PRODUTOS/SERVIÇOS:
${formData.products}

DIFERENCIAIS:
${formData.differentials}

AÇÃO DE CONVERSÃO: ${formData.conversion_action}
FERRAMENTAS: ${formData.tools}`;

      setGeneratedPrompt(prompt);
      toast.success('Prompt gerado com sucesso!');
    } catch (error) {
      console.error('Error generating prompt:', error);
      toast.error('Erro ao gerar prompt.');
    } finally {
      setLoading(false);
    }
  };

  const handleUsePrompt = () => {
    onPromptGenerated(generatedPrompt);
    setGeneratedPrompt('');
    onOpenChange(false);
    toast.success('Prompt aplicado!');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-cyan-400" />
            Gerador de Prompt
          </SheetTitle>
          <SheetDescription>
            Preencha as informações abaixo para gerar um prompt personalizado
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-primary">📋 Informações Básicas</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-600 dark:text-slate-300">Nome do SDR <span className="text-red-400">*</span></label>
                <input type="text" value={formData.sdr_name} onChange={(e) => setFormData({ ...formData, sdr_name: e.target.value })} placeholder="ex: Assistente" className="flex h-10 w-full theme-input text-sm placeholder:text-gray-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-ring/50" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-600 dark:text-slate-300">Nome da Empresa <span className="text-red-400">*</span></label>
                <input type="text" value={formData.company_name} onChange={(e) => setFormData({ ...formData, company_name: e.target.value })} placeholder="ex: Minha Empresa" className="flex h-10 w-full theme-input text-sm placeholder:text-gray-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-ring/50" />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-primary">📦 Produtos e Diferenciais</h3>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-600 dark:text-slate-300">Produtos/Serviços <span className="text-red-400">*</span></label>
              <textarea value={formData.products} onChange={(e) => setFormData({ ...formData, products: e.target.value })} placeholder="Descreva seus produtos..." rows={4} className="flex w-full theme-input text-sm placeholder:text-gray-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-600 dark:text-slate-300">Diferenciais <span className="text-red-400">*</span></label>
              <textarea value={formData.differentials} onChange={(e) => setFormData({ ...formData, differentials: e.target.value })} placeholder="Descreva seus diferenciais..." rows={3} className="flex w-full theme-input text-sm placeholder:text-gray-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none" />
            </div>
          </div>

          {!generatedPrompt && (
            <Button onClick={handleGenerate} disabled={loading} className="w-full" size="lg">
              {loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Gerando...</> : <><Wand2 className="w-5 h-5 mr-2" /> Gerar Prompt</>}
            </Button>
          )}

          {generatedPrompt && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-primary">📝 Prompt Gerado</h3>
              <textarea value={generatedPrompt} onChange={(e) => setGeneratedPrompt(e.target.value)} rows={12} className="flex w-full theme-input text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none font-mono" />
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => onOpenChange(false)} className="flex-1">Cancelar</Button>
                <Button onClick={handleUsePrompt} className="flex-1">✅ Usar este prompt</Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default PromptGeneratorSheet;
