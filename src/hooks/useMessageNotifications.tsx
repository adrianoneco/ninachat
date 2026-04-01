import React, { useEffect } from 'react';
import { connectSocket } from '@/lib/socket';
import { toast } from 'sonner';

interface MessageNotification {
  instance_id: string;
  conversation_id: string;
  contact_name?: string;
  contact_phone?: string;
  contact_avatar?: string;
  message_preview?: string;
  message_type?: string;
  timestamp?: string;
}

// Componente customizado para o toast
const MessageToast = ({ notification }: { notification: MessageNotification }) => {
  const getMessageTypeLabel = (type: string): string => {
    const typeMap: Record<string, string> = {
      text: 'Mensagem',
      image: 'Imagem',
      video: 'Vídeo',
      audio: 'Áudio',
      ptt: 'Áudio',
      file: 'Arquivo',
      document: 'Documento',
      sticker: 'Figurinha',
    };
    return typeMap[type] || 'Mensagem';
  };

  const getMessageTypeIcon = (type: string): string => {
    const iconMap: Record<string, string> = {
      text: '💬',
      image: '🖼️',
      video: '🎥',
      audio: '🎙️',
      ptt: '🎙️',
      file: '📄',
      document: '📄',
      sticker: '👋',
    };
    return iconMap[type] || '📱';
  };

  const messageTypeLabel = getMessageTypeLabel(notification.message_type || 'text');
  const messageTypeIcon = getMessageTypeIcon(notification.message_type || 'text');
  const avatarUrl = notification.contact_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(notification.contact_name || 'Contact')}&background=0ea5e9&color=fff&size=48`;

  return (
    <div className="flex gap-3 w-full max-w-sm">
      {/* Avatar à esquerda */}
      <div className="flex-shrink-0">
        <img
          src={avatarUrl}
          alt={notification.contact_name}
          className="w-12 h-12 rounded-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(notification.contact_name || 'Contact')}&background=0ea5e9&color=fff&size=48`;
          }}
        />
      </div>

      {/* Conteúdo à direita */}
      <div className="flex-1 min-w-0">
        {/* Nome como título */}
        <h3 className="font-semibold text-sm truncate">
          {notification.contact_name || 'Novo contato'}
        </h3>

        {/* Preview da mensagem */}
        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
          {notification.message_preview || '[mensagem]'}
        </p>

        {/* Tipo de mensagem */}
        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
          <span>{messageTypeIcon}</span>
          <span>{messageTypeLabel}</span>
        </div>
      </div>
    </div>
  );
};

export function useMessageNotifications() {
  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;

    const handleNewMessage = (data: MessageNotification) => {
      try {
        // Mostrar toast customizado
        toast.custom(
          (t) => (
            <div className="bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-lg shadow-lg p-4 pointer-events-auto">
              <MessageToast notification={data} />
            </div>
          ),
          {
            duration: 5000,
            position: 'top-right',
          }
        );

        // Reproduzir som de notificação (opcional)
        try {
          const audio = new Audio(
            'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA=='
          );
          audio.play().catch(() => {
            /* silently ignore if audio fails */
          });
        } catch (e) {
          /* ignore audio errors */
        }
      } catch (e) {
        console.warn('[useMessageNotifications] Error handling message:', e);
      }
    };

    // Escutar eventos de nova mensagem
    socket.on('message:new', handleNewMessage);
    socket.on('wpp:message', handleNewMessage);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('wpp:message', handleNewMessage);
    };
  }, []);
}
