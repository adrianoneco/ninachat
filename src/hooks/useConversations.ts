import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/services/api';
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

  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
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

      // enrich conversations by resolving contact via conv.user (match contacts.lid or contacts.serialized)
      let visible = visibleRaw as any[];
      try {
        const contacts = await api.fetchContacts();
        visible = visibleRaw.map((conv: any) => {
          try {
            // Relacionamento correto: conversations.lid = contacts.lid
            if (!conv.lid) return conv;
            const match = contacts.find((c: any) => c.lid === conv.lid);
            if (!match) return conv;
            return {
              ...conv,
              contactId: match.id || conv.contactId,
              contactName: match.name  || conv.contactName,
              contactPhone: match.phone || conv.contactPhone,
              contactAvatar: match.picture_url || conv.contactAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent((match.name||'U'))}&background=0ea5e9&color=fff`,
              contactEmail: match.email || conv.contactEmail,
            };
          } catch (e) { return conv; }
        });
      } catch (e) {
        visible = visibleRaw as any[];
      }

      setConversations(visible);
    } catch (err) {
      console.error('[useConversations] Error fetching:', err);
      setError('Erro ao carregar conversas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const sendMessage = useCallback(async (conversationId: string, content: string, attachments?: Array<{ dataUrl?: string; name?: string; type?: string }>) => {
    if ((!content || !content.trim()) && !(attachments && attachments.length > 0)) return;
    try {
      // optimistic UI update (don't write to local mock storage)
      setConversations(prev => prev.map(conv => conv.id === conversationId ? { ...conv, lastMessage: content || (attachments && attachments.length > 0 ? '[anexo]' : ''), lastMessageTime: new Date().toLocaleString() } : conv));
      // attempt real send via API (which includes copilot step) and let api persist messages
      const localConv = conversations.find(c => c.id === conversationId);
      const isHumanLocal = !!(localConv && localConv.status === 'human');
      console.log('[debug] useConversations.sendMessage', { conversationId, isHumanLocal, localConvStatus: localConv?.status });
      await api.sendMessage(conversationId, content, isHumanLocal, attachments);
      // refetch conversations to sync any changes
      fetchConversations();
    } catch (err) {
      console.error('sendMessage failed', err);
      toast.error('Falha ao enviar mensagem');
    }
  }, []);

  const updateStatus = useCallback(async (
    conversationId: string, 
    status: 'nina' | 'human' | 'paused'
  ) => {
    const statusLabels = {
      nina: 'IA ativada',
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
