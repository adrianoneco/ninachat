import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/services/api';
import { connectSocket } from '@/lib/socket';
import { useAuth } from '@/hooks/useAuth';
import { useCompanySettings } from '@/hooks/useCompanySettings';
// storage fallback removed; use backend API
import { 
  UIConversation, 
  UIMessage,
  MessageDirection,
  MessageType
} from '@/types';
import { toast } from 'sonner';

export function useConversations() {
  const [conversations, setConversations] = useState<UIConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtimeConnected] = useState(false);
  const { user } = useAuth();
  const { isAdmin } = useCompanySettings();
  const initialLoadDone = useRef(false);

  const fetchConversations = useCallback(async () => {
    try {
      // Only show loading spinner on the very first fetch
      if (!initialLoadDone.current) {
        setLoading(true);
      }
      setError(null);
      const data = await api.fetchConversations();

      // Enforce visibility rules:
      // - Admins see everything
      // - If a conversation has `assignedUserId`, only that user (or admins/managers) can see it
      // - Otherwise the conversation is visible
      let teamMembers = [] as any[];
      try {
        teamMembers = await api.fetchTeam();
      } catch (e) {
        teamMembers = [];
      }

      const currentMember = user ? teamMembers.find((t: any) => t.email === user.email || t.id === user.id) : null;
      const isManager = Boolean(currentMember && (currentMember.role === 'manager' || currentMember.role === 'admin'));

      const visibleRaw = data.filter(conv => {
        if (isAdmin || isManager) return true;
        if (!conv.assignedUserId) return true;
        if (!user) return false;
        return conv.assignedUserId === user.id;
      });

      // Enrich conversations with contact data already returned from backend
      // The backend now returns contact directly via relations
      const visible = visibleRaw.map((conv: any) => {
        const contact = conv.contact;
        if (!contact) return conv;
        
        // Use profile_picture_url or picture_url from contact
        const profilePic = contact.profile_picture_url || contact.picture_url || null;
        const name = contact.name || contact.call_name || null;
        const avatarUrl = profilePic || (name ? `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0ea5e9&color=fff` : null);
        
        return {
          ...conv,
          contactId: contact.id || conv.contactId,
          contactName: name || contact.phone_formated || contact.phone_number || conv.contactName,
          contactPhone: contact.phone_formated || contact.phone_number || contact.phone || conv.contactPhone,
          contactAvatar: avatarUrl || conv.contactAvatar,
          contactEmail: contact.email || conv.contactEmail,
          contactPresence: contact.presense || null,
        };
      });

      setConversations(visible);
    } catch (err) {
      console.error('[useConversations] Error fetching:', err);
      if (!initialLoadDone.current) {
        setError('Erro ao carregar conversas');
      }
    } finally {
      initialLoadDone.current = true;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Subscribe to realtime socket events to refresh conversations
  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;

    const handler = async () => {
      try {
        await fetchConversations();
      } catch (e) {
        console.error('Failed refreshing conversations on socket event', e);
      }
    };

    try {
      socket.on('message:created', handler);
      socket.on('message:updated', handler);
      socket.on('message:deleted', handler);
      socket.on('wpp:message', handler);
      socket.on('conversation:created', handler);
      socket.on('conversation:updated', handler);
      socket.on('contact:updated', handler);
      socket.on('messages:read', handler);

      // ack:changed — update individual message status in-memory without full refetch
      socket.on('ack:changed', (data: { message_id: string; status: string }) => {
        const { message_id, status } = data;
        if (!message_id || !status) return;
        const uiStatus = status as 'sent' | 'delivered' | 'read';
        setConversations(prev => prev.map(conv => {
          if (!conv.messages?.length) return conv;
          const idx = conv.messages.findIndex(
            m => m.whatsappMessageId === message_id || m.id === message_id
          );
          if (idx === -1) return conv;
          const updated = [...conv.messages];
          updated[idx] = { ...updated[idx], status: uiStatus };
          // When all outbound messages are read, zero out unreadCount on our side
          const newUnread = uiStatus === 'read'
            ? conv.messages.filter(m => m.direction === 'inbound' && m.status !== 'read').length
            : conv.unreadCount;
          return { ...conv, messages: updated, unreadCount: newUnread };
        }));
      });
      // Handle incoming messages from WPP
      socket.on('message:new', (data: any) => {
        console.log('[message:new] received event:', data);
        const { conversation_id, message_preview, contact_name, contact_phone, contact_avatar, timestamp } = data;
        
        setConversations(prev => {
          const existing = prev.find(conv => conv.id === conversation_id);
          console.log('[message:new] conversation exists:', !!existing, 'id:', conversation_id);
          
          if (!existing) {
            // Conversation doesn't exist locally, refetch to sync
            console.log('[message:new] conversation not found, refetching...');
            fetchConversations();
            return prev;
          }
          
          // Update existing conversation
          return prev.map(conv => {
            if (conv.id === conversation_id) {
              console.log('[message:new] updating conversation:', conversation_id);
              return {
                ...conv,
                lastMessage: message_preview || '[mídia]',
                lastMessageTime: (() => { const d = new Date(timestamp); if (isNaN(d.getTime())) return ''; const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); return d >= today ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); })(),
                contactName: contact_name || conv.contactName,
                contactPhone: contact_phone || conv.contactPhone,
                contactAvatar: contact_avatar || conv.contactAvatar,
                unreadCount: (conv.unreadCount || 0) + 1,
              };
            }
            return conv;
          });
        });
      });
      
      // presence updates: patch in-memory without full refetch
      socket.on('contact:presence', (data: { phone: string; presence: string; contact_name?: string; contact_avatar?: string }) => {
        const pausedTimers = new Map<string, ReturnType<typeof setTimeout>>();
        setConversations(prev => prev.map(conv => {
          const cp = (conv as any).contactPhone || '';
          const matchPhone = cp.replace(/\D/g, '');
          const incomingPhone = (data.phone || '').replace(/\D/g, '');
          if (!matchPhone || !incomingPhone || !matchPhone.endsWith(incomingPhone) && !incomingPhone.endsWith(matchPhone)) return conv;
          const newPresence = data.presence;
          
          // Update contact info if provided
          const updatedConv = {
            ...conv,
            _dbPresence: newPresence !== 'paused' ? newPresence : (conv as any)._dbPresence,
            contactPresence: newPresence,
            contactName: data.contact_name || conv.contactName,
            contactAvatar: data.contact_avatar || conv.contactAvatar,
          };
          
          if (newPresence === 'paused') {
            // clear existing timer if any
            const key = conv.id;
            if (pausedTimers.has(key)) clearTimeout(pausedTimers.get(key)!);
            const t = setTimeout(() => {
              setConversations(p => p.map(c => c.id === key ? { ...c, contactPresence: (c as any)._dbPresence || 'unavailable' } : c));
              pausedTimers.delete(key);
            }, 5000);
            pausedTimers.set(key, t);
          }
          return updatedConv;
        }));
      });
    } catch (e) {
      // ignore
    }

    return () => {
      try {
        socket.off('message:created', handler);
        socket.off('message:updated', handler);
        socket.off('message:deleted', handler);
        socket.off('wpp:message', handler);
        socket.off('conversation:created', handler);
        socket.off('conversation:updated', handler);
        socket.off('contact:updated', handler);
        socket.off('messages:read', handler);
        socket.off('ack:changed');
        socket.off('message:new');
        socket.off('contact:presence');
      } catch (e) {}
    };
  }, [fetchConversations]);

  const sendMessage = useCallback(async (conversationId: string, content: string, attachments?: Array<{ dataUrl?: string; file?: File; name?: string; type?: string }>) => {
    if ((!content || !content.trim()) && !(attachments && attachments.length > 0)) return;
    try {
      // optimistic UI update (don't write to local mock storage)
      setConversations(prev => prev.map(conv => conv.id === conversationId ? { ...conv, lastMessage: content || (attachments && attachments.length > 0 ? '[anexo]' : ''), lastMessageTime: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) } : conv));
      // attempt real send via API (which includes copilot step) and let api persist messages
      const localConv = conversations.find(c => c.id === conversationId);
      const isHumanLocal = !!(localConv && localConv.status === 'human');
      console.log('[debug] useConversations.sendMessage', { conversationId, isHumanLocal, localConvStatus: localConv?.status });
      // Pass WPP context so api.sendMessage can call the binary endpoint directly
      // Note: UIConversation stores it as 'instanceId' (camelCase) from fetchConversations
      const wppContext = localConv ? {
        instanceId: (localConv as any).instanceId || (localConv as any).instance_id,
        contactPhone: (localConv as any).contact?.phone_number
          || ((localConv as any).contact?.whatsapp_id || '').replace(/@.+$/, '')
          || localConv.contactPhone?.replace(/\D/g, ''),
      } : undefined;
      await api.sendMessage(conversationId, content, isHumanLocal, attachments, wppContext);
      // refetch conversations to sync any changes
      fetchConversations();
    } catch (err) {
      console.error('sendMessage failed', err);
      toast.error('Falha ao enviar mensagem');
    }
  }, [conversations]);

  const updateStatus = useCallback(async (
    conversationId: string, 
    status: 'livechat' | 'human' | 'paused'
  ) => {
    const statusLabels = {
      livechat: 'IA ativada',
      human: 'Atendimento humano ativado',
      paused: 'Conversa pausada'
    };
    try {
      await api.updateConversationStatus(conversationId, status);
      setConversations(prev => prev.map(conv => conv.id === conversationId ? { ...conv, status } : conv));
      toast.success(statusLabels[status]);
    } catch (err) {
      console.error('updateStatus failed', err);
      toast.error('Falha ao alterar modo da conversa');
    }
  }, []);

  const markAsRead = useCallback(async (conversationId: string) => {
    setConversations(prev => prev.map(conv => 
      conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
    ));
    try {
      await api.markMessagesAsRead(conversationId);
    } catch (e) {
      console.warn('markAsRead failed', e);
    }
  }, []);

  const assignConversation = useCallback(async (conversationId: string, userId: string | null) => {
    setConversations(prev => prev.map(c => 
      c.id === conversationId ? { ...c, assignedUserId: userId } : c
    ));
  }, []);

  return {
    conversations,
    loading,
    error,
    realtimeConnected,
    sendMessage,
    updateStatus,
    markAsRead,
    assignConversation,
    refetch: fetchConversations
  };
}
