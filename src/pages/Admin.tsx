import React, { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, ShieldAlert } from 'lucide-react';

const API = '/api';

const Admin: React.FC = () => {
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetch(`${API}/system_settings`)
      .then(r => r.json())
      .then(data => {
        if (data && typeof data.registration_enabled === 'boolean') {
          setRegistrationEnabled(data.registration_enabled);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (checked: boolean) => {
    setUpdating(true);
    try {
      const res = await fetch(`${API}/system_settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'main', registration_enabled: checked }),
      });
      if (!res.ok) throw new Error('Falha');
      setRegistrationEnabled(checked);
      toast.success(checked ? 'Registro habilitado' : 'Registro desabilitado');
    } catch {
      toast.error('Erro ao atualizar configuração');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 md:p-8 overflow-y-auto">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <ShieldAlert className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Administração</h1>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Configurações do Sistema</h2>
          
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-foreground font-medium">Permitir novos registros</Label>
              <p className="text-sm text-muted-foreground">
                Quando desativado, a opção de criar conta não aparecerá na tela de login.
              </p>
            </div>
            <Switch
              checked={registrationEnabled}
              onCheckedChange={handleToggle}
              disabled={updating}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Admin;
