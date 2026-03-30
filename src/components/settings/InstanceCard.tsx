import React from 'react';
import { Copy, RefreshCw, Send, Phone, Settings, Trash2, Smartphone } from 'lucide-react';

type Instance = {
  id: string;
  name: string;
  channel?: string;
  webhook_url: string;
  created_at: string;
  status: 'connected' | 'disconnected';
  isPrivate?: boolean;
  completed?: boolean;
  completed_at?: string | null;
};

export const isLocalUrl = (url: string) => {
  try {
    const u = new URL(url);
    return ['localhost', '127.0.0.1'].includes(u.hostname) || /^192\.|^10\.|^172\./.test(u.hostname);
  } catch { return false; }
};

const InstanceCard: React.FC<{
  instance: Instance;
  selected?: boolean;
  onSelect?: (id: string) => void;
  onDelete?: (id: string) => void;
  onTest?: (url: string) => void;
  onCopy?: (text: string) => void;
  onCall?: (id: string) => void;
  onToggleComplete?: (id: string, value: boolean) => void;
}> = ({ instance, selected, onSelect, onDelete, onTest, onCopy, onCall, onToggleComplete }) => {
  const local = isLocalUrl(instance.webhook_url);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(instance.id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(instance.id); } }}
      className={`rounded-xl border bg-white dark:bg-slate-900/60 p-5 flex flex-col gap-5 transition-shadow hover:shadow-lg min-w-[320px] ${selected ? 'border-emerald-500 shadow-emerald-500/20' : 'border-slate-200 dark:border-slate-700'}`}
    >
      {/* Header: icon + info */}
      <div className="flex items-center gap-4">
        <div className="h-11 w-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
          <Smartphone className="w-5 h-5 text-slate-500 dark:text-slate-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight truncate">{instance.name}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{instance.channel ? (instance.channel.charAt(0).toUpperCase() + instance.channel.slice(1)) : 'Canal'}</p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0 min-w-[120px]">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${instance.status === 'connected' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span className={`text-xs font-medium ${instance.status === 'connected' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {instance.status === 'connected' ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
          {instance.completed ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-yellow-500">Concluído</span>
              <span className="text-[10px] text-slate-400">{instance.completed_at ? new Date(instance.completed_at).toLocaleString() : ''}</span>
            </div>
          ) : (
            <div style={{ height: '18px' }} />
          )}
        </div>
      </div>

      {/* Meta: tag + created date */}
      <div className="flex items-center justify-between">
        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{instance.name}</span>
        <span className="text-xs text-slate-400 dark:text-slate-500">Criado em {new Date(instance.created_at).toLocaleDateString()}</span>
      </div>

      {/* Webhook */}
      <div>
        <span className="text-xs text-slate-500 dark:text-slate-400 mb-1.5 block">🔗 Webhook:</span>
        <div className={`rounded-lg px-3 py-2 text-xs font-mono flex items-center gap-2 ${local ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800' : 'bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}>
          <span className="flex-1 truncate">{instance.webhook_url}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onCopy?.(instance.webhook_url); }}
            aria-label="Copiar webhook"
            className="flex-shrink-0 p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); onTest?.(instance.webhook_url); }} title="Atualizar" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><RefreshCw className="w-4 h-4 text-slate-500 dark:text-slate-400" /></button>
          <button onClick={(e) => { e.stopPropagation(); onTest?.(instance.webhook_url); }} title="Enviar teste" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><Send className="w-4 h-4 text-slate-500 dark:text-slate-400" /></button>
          <button onClick={(e) => { e.stopPropagation(); onCall?.(instance.id); }} title="Chamada" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><Phone className="w-4 h-4 text-slate-500 dark:text-slate-400" /></button>
          <button onClick={(e) => { e.stopPropagation(); onSelect?.(instance.id); }} title="Configurações" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><Settings className="w-4 h-4 text-slate-500 dark:text-slate-400" /></button>
        </div>
        <div className="flex items-center gap-2">
          {instance.completed ? (
            <button onClick={(e) => { e.stopPropagation(); (typeof onToggleComplete === 'function') && onToggleComplete?.(instance.id, false); }} title="Reverter conclusão" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><RefreshCw className="w-4 h-4 text-yellow-500" /></button>
          ) : null}
          <button onClick={(e) => { e.stopPropagation(); onDelete?.(instance.id); }} title="Deletar" className="p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"><Trash2 className="w-4 h-4 text-rose-500 dark:text-rose-400" /></button>
        </div>
      </div>
    </div>
  );
};

export default InstanceCard;
