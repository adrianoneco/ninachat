import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { 
  Search, Filter, MoreVertical, Phone, Paperclip, Send, Check, CheckCheck, 
  Play, Loader2, MessageSquare, Info, X, Mail, 
  Smile, Zap, Mic,
  Clock,
  Tag, Bot, User, Pause, Brain, Plus, TrendingUp, Heart,
  Sparkles, RefreshCw, Pencil, FileText, XCircle, CheckCircle, Menu, ChevronLeft, ChevronRight,
  Download, ZoomIn, ZoomOut, ChevronDown, Square,
  Copy, Share2, Trash2, AtSign, CornerUpLeft,
  Image, Video, Music, Sticker, File,
  PhoneIncoming, PhoneOff, VideoIcon
} from 'lucide-react';

import { Pin, Star, Flag } from 'lucide-react';

import { MessageDirection, MessageType, UIConversation, UIMessage, ConversationStatus, TagDefinition } from '../types';
import { Button } from './Button';
import { Switch } from './ui/switch';
import { useAuth } from '@/hooks/useAuth';
import { useConversations } from '../hooks/useConversations';
import { toast } from 'sonner';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { api } from '@/services/api';
import { TagSelector } from './TagSelector';
import { CreateDealModal } from './CreateDealModal';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription } from './ui/sheet';
import { MessageImage, MessageVideo, MessageSticker, MessageFile, MessageAudio } from './MediaRenderers';
import { connectSocket } from '@/lib/socket';
import { usePresence } from '@/hooks/usePresence';

const ChatInterface: React.FC = () => {
  const { conversations, loading, sendMessage, updateStatus, markAsRead, assignConversation, refetch } = useConversations();
  const { sdrName, companyName } = useCompanySettings();
  const { isTyping, isRecording, isOnline, getPresence } = usePresence();
  const auth = useAuth();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [editingModalId, setEditingModalId] = useState<string | null>(null);
  const [editingModalDraft, setEditingModalDraft] = useState('');
  const editingModalRef = useRef<HTMLTextAreaElement | null>(null);
  const [attachments, setAttachments] = useState<Array<{ id: string; dataUrl: string; name?: string; type?: string }>>([]);
  const [showAttachPopup, setShowAttachPopup] = useState(false);
  const [showAttachGrid, setShowAttachGrid] = useState(false);
  const [pastedPreview, setPastedPreview] = useState<string | null>(null);
  const [showProfileInfo, setShowProfileInfo] = useState(true);
  const [isListOpen, setIsListOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'chats'|'groups'>('chats');
  const [chipFilter, setChipFilter] = useState<'all'|'queue'|'unread'|'waiting'|'mine'>('all');
  const chipsRef = useRef<HTMLDivElement | null>(null);
  const [showLeftChipArrow, setShowLeftChipArrow] = useState(false);
  const [showRightChipArrow, setShowRightChipArrow] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);
  const [awaitingFilter, setAwaitingFilter] = useState<boolean>(false);
  const [scheduledFilter, setScheduledFilter] = useState<boolean>(false);
  const [availableTags, setAvailableTags] = useState<TagDefinition[]>([]);
  const [isTagSelectorOpen, setIsTagSelectorOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [instancesList, setInstancesList] = useState<any[]>([]);
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<string[]>([]);
  const [instanceSearch, setInstanceSearch] = useState('');
  const [statusSearch, setStatusSearch] = useState('');
  const [orderBy, setOrderBy] = useState<'recent' | 'oldest'>('recent');
  const [teamsList, setTeamsList] = useState<any[]>([]);
  const [notesValue, setNotesValue] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // Z-API buttons modal state
  const [isButtonDialogOpen, setIsButtonDialogOpen] = useState(false);
  const [buttonsDraft, setButtonsDraft] = useState<{ id: string; title: string }[]>([{ id: 'b1', title: '' }]);
  const [buttonMessageText, setButtonMessageText] = useState('');
  const [buttonImageUrl, setButtonImageUrl] = useState('');
  const [sendingButtons, setSendingButtons] = useState(false);

  // New Conversation modal state
  const [isNewConvOpen, setIsNewConvOpen] = useState(false);
  const [newConvInstance, setNewConvInstance] = useState('');
  const [newConvPhone, setNewConvPhone] = useState('');
  const [newConvName, setNewConvName] = useState('');
  const [newConvClientCode, setNewConvClientCode] = useState('');
  const [newConvTicket, setNewConvTicket] = useState(false);
  const [newConvMute, setNewConvMute] = useState(false);
  const [creatingConv, setCreatingConv] = useState(false);

  // Pipeline
  const [linkedDeal, setLinkedDeal] = useState<any>(null);
  const [pipelineStages, setPipelineStages] = useState<any[]>([]);
  const [editingDealStatus, setEditingDealStatus] = useState(false);
  const [editingDealValue, setEditingDealValue] = useState(false);
  const [dealValueInput, setDealValueInput] = useState('');
  const [isCreateDealOpen, setIsCreateDealOpen] = useState(false);
  // Sentiment
  const [sentiment, setSentiment] = useState<{ emoji: string; label: string; colorClass: string } | null>(null);
  const [analyzingSentiment, setAnalyzingSentiment] = useState(false);
  // Topics
  const [topics, setTopics] = useState<string[]>([]);
  const [categorizingTopics, setCategorizingTopics] = useState(false);
  // Summaries
  const [aiSummaries, setAiSummaries] = useState<{ id: string; text: string; created_at: string }[]>([]);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  
  // Audio player state
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioDurations, setAudioDurations] = useState<Record<string, number>>({});
  const [audioProgress, setAudioProgress] = useState<Record<string, number>>({});
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  // Audio recording state
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; name?: string } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const stickerInputRef = useRef<HTMLInputElement | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);
  const inputWrapperRef = useRef<HTMLDivElement | null>(null);
  const iconsRef = useRef<HTMLDivElement | null>(null);
  const sendBtnRef = useRef<HTMLButtonElement | null>(null);
  const [dynamicPaddingRight, setDynamicPaddingRight] = useState<number | null>(null);
  // default right offset for icons (px). Calculated so icons sit just left of the send button.
  // send button: right-3 (12px) + w-12 (48px) => left edge at 60px from right. We keep a small gap.
  const DEFAULT_SEND_RIGHT = 12; // px (right-3)
  const DEFAULT_SEND_WIDTH = 48; // px (w-12)
  const DEFAULT_ICON_GAP = 0; // no gap — icons sit immediately left of send button
  const [iconsRightPx, setIconsRightPx] = useState<number>(DEFAULT_SEND_RIGHT + DEFAULT_SEND_WIDTH - DEFAULT_ICON_GAP);
  const [inputActive, setInputActive] = useState(false);
  const [isInputLifted, setIsInputLifted] = useState(false);
  // shared class for icon buttons to keep styles consistent and polished
  const iconBtnClass = "w-8 h-8 rounded-full bg-slate-800/30 hover:bg-slate-800/50 flex items-center justify-center text-slate-200 dark:text-white shadow-sm transition-transform transform hover:scale-105 ring-1 ring-white/5";
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [refreshingSuggestions, setRefreshingSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ tone: string; color: string; text: string }>>([
    { tone: 'Formal', color: 'sky', text: 'Olá! Como posso ajudar você hoje?' },
    { tone: 'Amigável', color: 'emerald', text: 'Oi! Em que posso te ajudar?' },
    { tone: 'Direto', color: 'amber', text: 'Oi! Qual sua dúvida?' },
  ]);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [galleryZoom, setGalleryZoom] = useState(1);
  const [galleryPan, setGalleryPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const galleryStartPan = useRef<{ x: number; y: number } | null>(null);
  const [transferTeamId, setTransferTeamId] = useState<string | null>(null);
  const [transferMode, setTransferMode] = useState<'team'|'agent'>('team');
  const [transferAgentId, setTransferAgentId] = useState<string | null>(null);
  const [isPrevConvsOpen, setIsPrevConvsOpen] = useState(false);
  const [prevTickets, setPrevTickets] = useState<any[]>([]);
  const [expandedTickets, setExpandedTickets] = useState<Record<string, boolean>>({});
  const [isTicketDetailOpen, setIsTicketDetailOpen] = useState(false);
  const [ticketDetail, setTicketDetail] = useState<any | null>(null);
  const galleryImgWrapperRef = useRef<HTMLDivElement | null>(null);
  
  const activeChat = conversations.find(c => c.id === selectedChatId);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const firstAssignedRef = useRef(false);

  const getDisplayName = (chat: any) => {
    console.debug(chat);
    return chat?.contactName || chat?.contactPhone || ((chat as any)?.user ? String((chat as any).user).split('@')[0] : 'Contato');
  };

  const getAvatarUrl = (chat: any) => {
    const name = getDisplayName(chat) || 'U';
    return chat?.contactAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0ea5e9&color=fff`;
  };

  // Helper functions for presence status mapping
  const getPresenceDotColor = (presense: string | null, contactId?: string): string => {
    // Check real-time presence from socket first
    if (contactId) {
      if (isTyping(contactId)) return 'bg-amber-400 animate-pulse';
      if (isRecording(contactId)) return 'bg-amber-400 animate-pulse';
      if (isOnline(contactId)) return 'bg-emerald-500';
    }
    
    // Fallback to static presence
    if (!presense) return 'bg-gray-400';
    if (presense === 'available') return 'bg-emerald-500';
    if (presense === 'composing' || presense === 'recording') return 'bg-amber-400 animate-pulse';
    if (presense === 'paused') return 'bg-yellow-400';
    if (presense === 'unavailable') return 'bg-gray-400';
    return 'bg-gray-400';
  };

  const getPresenceStatusText = (presense: string | null, contactId?: string): React.ReactNode => {
    // Check real-time presence from socket first
    if (contactId) {
      if (isTyping(contactId)) return <span className="text-amber-400 animate-pulse">Digitando...</span>;
      if (isRecording(contactId)) return <span className="text-amber-400 animate-pulse">Gravando áudio...</span>;
      if (isOnline(contactId)) return <span className="text-emerald-400">Online</span>;
    }
    
    // Fallback to static presence
    if (!presense) return null;
    if (presense === 'available') return <span className="text-emerald-400">Online</span>;
    if (presense === 'composing') return <span className="text-amber-400 animate-pulse">Digitando...</span>;
    if (presense === 'recording') return <span className="text-amber-400 animate-pulse">Gravando áudio...</span>;
    if (presense === 'paused') return <span className="text-yellow-400">Parou de digitar</span>;
    if (presense === 'unavailable') return <span className="text-gray-400">Offline</span>;
    return null;
  };

  const getPresenceLabel = (presense: string | null, contactId?: string): string => {
    // Check real-time presence from socket first
    if (contactId) {
      if (isTyping(contactId)) return 'Digitando...';
      if (isRecording(contactId)) return 'Gravando áudio...';
      if (isOnline(contactId)) return 'Online';
    }
    
    // Fallback to static presence
    if (!presense) return '';
    if (presense === 'available') return 'Online';
    if (presense === 'composing') return 'Digitando...';
    if (presense === 'recording') return 'Gravando áudio...';
    if (presense === 'paused') return 'Parou de digitar';
    if (presense === 'unavailable') return 'Offline';
    return '';
  };

  // Resizable sidebar state — width persisted to backend
  const [sidebarWidth, setSidebarWidth] = useState<number>(320);
  const sidebarWidthLoadedRef = useRef(false);
  useEffect(() => {
    if (sidebarWidthLoadedRef.current) return;
    sidebarWidthLoadedRef.current = true;
    const API_BASE = (import.meta as any).env?.VITE_API_BASE || '/api';
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/system_settings`);
        if (res.ok) {
          const json = await res.json();
          const data = json?.data ?? json;
          if (data?.sidebar_width && Number(data.sidebar_width) > 0) setSidebarWidth(Number(data.sidebar_width));
        }
      } catch {}
    })();
  }, []);
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const minSidebar = 80;
  const maxSidebar = 560;


  const startDrag = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    document.addEventListener('mousemove', onDrag as any);
    document.addEventListener('touchmove', onDrag as any, { passive: false } as any);
    document.addEventListener('mouseup', stopDrag as any);
    document.addEventListener('touchend', stopDrag as any);
  };

  const onDrag = (e: MouseEvent | TouchEvent) => {
    if (!draggingRef.current) return;
    const clientX = (e as TouchEvent).touches ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
    const rect = sidebarRef.current?.parentElement?.getBoundingClientRect();
    if (!rect) return;
    let next = clientX - rect.left;
    next = Math.max(minSidebar, Math.min(maxSidebar, next));
    setSidebarWidth(next);
  };

  const stopDrag = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    document.removeEventListener('mousemove', onDrag as any);
    document.removeEventListener('touchmove', onDrag as any);
    document.removeEventListener('mouseup', stopDrag as any);
    document.removeEventListener('touchend', stopDrag as any);
    // Persist sidebar width to backend
    const API_BASE_SW = (import.meta as any).env?.VITE_API_BASE || '/api';
    fetch(`${API_BASE_SW}/system_settings`).then(r => r.ok ? r.json() : {}).then((json: any) => {
      const current = json?.data ?? json ?? {};
      fetch(`${API_BASE_SW}/system_settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...current, sidebar_width: sidebarWidth }) }).catch(() => {});
    }).catch(() => {});
  };

  const adjustSidebar = (delta: number) => {
    setSidebarWidth(w => {
      const next = Math.max(minSidebar, Math.min(maxSidebar, w + delta));
      return next;
    });
  };

  useEffect(() => {
    if (firstAssignedRef.current) return;
    if (loading) return;
    if (!auth?.user) return;
    if (!conversations || conversations.length === 0) return;
    if (!auth.user) return;
    const first = conversations[0];
    if (!first.assignedUserId) {
      firstAssignedRef.current = true;
      (async () => {
        try {
          await assignConversation(first.id, auth.user!.id);
          toast.success('Primeira conversa atribuída a você');
        } catch (err) {
          console.error('Falha ao atribuir primeira conversa', err);
        }
      })();
    }
  }, [conversations, loading, auth?.user, assignConversation]);
  
  // Format audio time helper
  const formatAudioTime = (seconds: number): string => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Z-API Buttons helpers
  const addButtonField = () => setButtonsDraft(prev => [...prev, { id: `b${prev.length + 1}`, title: '' }]);
  const updateButtonTitle = (index: number, value: string) => {
    setButtonsDraft(prev => {
      const copy = [...prev];
      if (copy[index]) copy[index] = { ...copy[index], title: value };
      return copy;
    });
  };
  const removeButtonField = (index: number) => setButtonsDraft(prev => prev.filter((_, i) => i !== index));

  const handleSendButtons = async () => {
    if (!activeChat) return toast.error('Selecione uma conversa');
    const payload = buttonsDraft.map(b => ({ id: b.id, title: b.title.trim() })).filter(b => b.title.length > 0).slice(0, 3);
    if (payload.length === 0) return toast.error('Adicione ao menos um botão');
    setSendingButtons(true);
    try {
      await api.sendZApiButtons(activeChat.id, activeChat.contactPhone, payload, buttonMessageText, buttonImageUrl || null);
      toast.success('Botões enviados (mock)');
      setIsButtonDialogOpen(false);
      setButtonsDraft([{ id: 'b1', title: '' }]);
      setButtonMessageText('');
      setButtonImageUrl('');
    } catch (err) {
      console.error('sendZApiButtons failed', err);
      toast.error('Falha ao enviar botões');
    } finally {
      setSendingButtons(false);
    }
  };

  // Load tag definitions and team members
  useEffect(() => {
    api.fetchTagDefinitions().then(setAvailableTags).catch(err => {
      console.error('Error loading tags:', err);
      toast.error('Erro ao carregar tags');
    });

    api.fetchTeam().then(setTeamMembers).catch(err => {
      console.error('Error loading team members:', err);
    });
    api.fetchInstances().then(setInstancesList).catch(() => {});
    api.fetchTeams().then(setTeamsList).catch(() => {});
  }, []);

  // Auto-select first conversation or from URL param
  useEffect(() => {
    // Check for conversation param in URL
    const urlParams = new URLSearchParams(window.location.search);
    const conversationParam = urlParams.get('conversation');
    
    if (conversationParam && conversations.some(c => c.id === conversationParam)) {
      setSelectedChatId(conversationParam);
    } else if (conversations.length > 0 && !selectedChatId) {
      setSelectedChatId(conversations[0].id);
    }
  }, [conversations, selectedChatId]);

  // Mark as read when selecting conversation
  useEffect(() => {
    if (selectedChatId && (activeChat?.unreadCount ?? 0) > 0) {
      markAsRead(selectedChatId);
    }
  }, [selectedChatId, activeChat?.unreadCount, markAsRead]);

  // Sync notes value with active chat
  useEffect(() => {
    if (activeChat) {
      setNotesValue(activeChat.notes || '');
    }
    // keep transfer selector in sync with active chat
    setTransferTeamId(activeChat?.assignedTeam || null);
  }, [activeChat?.id]);

  // Load pipeline stages once on mount
  useEffect(() => {
    api.fetchPipelineStages().then(setPipelineStages).catch(() => {});
  }, []);

  // Load linked deal when active chat changes
  useEffect(() => {
    if (!activeChat) { setLinkedDeal(null); return; }
    setSentiment(null);
    setTopics([]);
    setAiSummaries([]);
    setEditingDealStatus(false);
    setEditingDealValue(false);
    api.fetchPipeline().then(deals => {
      const deal = deals.find((d: any) => d.contactId === activeChat.contactId);
      setLinkedDeal(deal ?? null);
      if (deal) setDealValueInput(String(deal.value ?? 0));
    }).catch(() => {});
  }, [activeChat?.id]);

  // Handle notes save on blur
  const handleNotesBlur = async () => {
    if (!activeChat || notesValue === (activeChat.notes || '')) return;
    
    setIsSavingNotes(true);
    try {
      await api.updateContactNotes(activeChat.contactId, notesValue);
      toast.success('Notas salvas');
    } catch (error) {
      console.error('Error saving notes:', error);
      toast.error('Erro ao salvar notas');
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleSaveDealValue = async () => {
    if (!linkedDeal) return;
    const val = parseFloat(dealValueInput.replace(',', '.'));
    if (isNaN(val)) { setEditingDealValue(false); return; }
    await api.updateDeal(linkedDeal.id, { value: val });
    setLinkedDeal({ ...linkedDeal, value: val });
    setEditingDealValue(false);
    toast.success('Valor atualizado');
  };

  const SENTIMENTS = [
    { emoji: '😊', label: 'Positivo', colorClass: 'text-emerald-400' },
    { emoji: '😐', label: 'Neutro',   colorClass: 'text-yellow-400'  },
    { emoji: '😞', label: 'Negativo', colorClass: 'text-rose-400'    },
  ];

  const handleAnalyzeSentiment = async () => {
    setAnalyzingSentiment(true);
    await new Promise(r => setTimeout(r, 1200));
    setSentiment(SENTIMENTS[Math.floor(Math.random() * SENTIMENTS.length)]);
    setAnalyzingSentiment(false);
  };

  const MOCK_TOPICS = ['Produto', 'Preço', 'Suporte', 'Entrega', 'Qualidade', 'Prazo', 'Parceria'];
  const handleCategorizeTopics = async () => {
    setCategorizingTopics(true);
    await new Promise(r => setTimeout(r, 1000));
    const count = Math.floor(Math.random() * 3) + 1;
    setTopics([...MOCK_TOPICS].sort(() => Math.random() - 0.5).slice(0, count));
    setCategorizingTopics(false);
  };

  const MOCK_SUMMARIES = [
    'Lead demonstrou interesse no produto principal. Solicitou mais informações sobre preço e condições.',
    'Cliente relatou problema no suporte. Foi encaminhado para equipe técnica.',
    'Prospect qualificado. Próximo passo: agendar demonstração do produto.',
  ];
  const handleGenerateSummary = async () => {
    setGeneratingSummary(true);
    await new Promise(r => setTimeout(r, 1500));
    const text = MOCK_SUMMARIES[Math.floor(Math.random() * MOCK_SUMMARIES.length)];
    setAiSummaries(prev => [{ id: String(Date.now()), text, created_at: new Date().toISOString() }, ...prev]);
    setGeneratingSummary(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Hover actions state
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  const clearHoverTimeout = () => {
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    // keep toolbar visible while timeout cleared
    // (do not hide here)
  };

  const scheduleHideHover = (delay = 300) => {
    clearHoverTimeout();
    hoverTimeoutRef.current = window.setTimeout(() => setHoveredMessageId(null), delay);
  };

  

  const sendReaction = async (emoji: string) => {
    if (!activeChat) return;
    try {
      await sendMessage(activeChat.id, emoji);
    } catch (err) {
      console.error('sendReaction failed', err);
    }
  };

  const handleReplyTo = (msg: UIMessage) => {
    setInputText(prev => `> ${msg.content}\n${prev}`);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleCopyMessage = async (msg: UIMessage) => {
    try {
      await navigator.clipboard.writeText(msg.content || '');
      toast.success('Mensagem copiada');
    } catch (err) {
      console.error('copy failed', err);
      toast.error('Falha ao copiar');
    }
  };

  const handleForward = async (msg: UIMessage) => {
    if (!msg) return;
    try {
      const target = window.prompt('ID da conversa de destino:');
      if (!target) return;
      await api.forwardMessage(msg.id, target.trim());
      toast.success('Mensagem encaminhada');
    } catch (err) {
      console.error('forward failed', err);
      toast.error('Falha ao encaminhar');
    }
  };

  const handleMention = (participantName: string) => {
    setInputText(prev => `@${participantName} ${prev}`);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const togglePreviewAudio = (url?: string | null) => {
    if (!url) return;
    try {
      // if same url playing -> pause
      if (previewAudioRef.current && previewAudioUrl === url) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
        setPreviewAudioUrl(null);
        return;
      }
      // stop existing
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      const a = new Audio(url);
      previewAudioRef.current = a;
      a.play().catch(() => {});
      setPreviewAudioUrl(url);
      a.onended = () => { setPreviewAudioUrl(null); previewAudioRef.current = null; };
    } catch (err) {
      console.error('preview audio failed', err);
    }
  };

  const openGallery = (images: string[], startIndex: number = 0) => {
    if (!images || images.length === 0) return;
    setGalleryImages(images);
    setGalleryIndex(Math.max(0, Math.min(startIndex, images.length - 1)));
    setIsGalleryOpen(true);
  };

  const closeGallery = () => {
    setIsGalleryOpen(false);
    setGalleryImages([]);
    setGalleryIndex(0);
  };

  const showNextGallery = () => {
    setGalleryIndex(i => Math.min(i + 1, galleryImages.length - 1));
  };

  const showPrevGallery = () => {
    setGalleryIndex(i => Math.max(i - 1, 0));
  };

  const resetGalleryTransform = () => {
    setGalleryZoom(1);
    setGalleryPan({ x: 0, y: 0 });
  };

  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

  const onGalleryWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY;
    const factor = delta > 0 ? 1.1 : 0.9;
    setGalleryZoom(z => {
      const next = clamp(Number((z * factor).toFixed(2)), 1, 4);
      return next;
    });
  };

  const onGalleryMouseDown = (e: React.MouseEvent) => {
    if (galleryZoom <= 1) return;
    setIsPanning(true);
    galleryStartPan.current = { x: e.clientX - galleryPan.x, y: e.clientY - galleryPan.y };
  };

  const onGalleryMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || !galleryStartPan.current) return;
    const nx = e.clientX - galleryStartPan.current.x;
    const ny = e.clientY - galleryStartPan.current.y;
    setGalleryPan({ x: nx, y: ny });
  };

  const onGalleryMouseUp = () => {
    setIsPanning(false);
    galleryStartPan.current = null;
  };

  const onGalleryDoubleClick = () => {
    if (galleryZoom === 1) setGalleryZoom(2);
    else resetGalleryTransform();
  };

  // Touch: basic pan support
  const touchLastRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const onGalleryTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && galleryZoom > 1) {
      const t = e.touches[0];
      touchLastRef.current = { id: t.identifier, x: t.clientX, y: t.clientY };
    }
  };
  const onGalleryTouchMove = (e: React.TouchEvent) => {
    if (!touchLastRef.current) return;
    const t = Array.from(e.touches).find(t => t.identifier === touchLastRef.current!.id);
    if (!t) return;
    const dx = t.clientX - touchLastRef.current.x;
    const dy = t.clientY - touchLastRef.current.y;
    setGalleryPan(p => ({ x: p.x + dx, y: p.y + dy }));
    touchLastRef.current = { id: t.identifier, x: t.clientX, y: t.clientY };
  };
  const onGalleryTouchEnd = () => { touchLastRef.current = null; };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isGalleryOpen) return;
      if (e.key === 'ArrowRight') showNextGallery();
      if (e.key === 'ArrowLeft') showPrevGallery();
      if (e.key === 'Escape') closeGallery();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isGalleryOpen, galleryImages.length]);

  useEffect(() => {
    if (activeChat) {
      scrollToBottom();
    }
  }, [activeChat?.id, selectedChatId]); 

  useEffect(() => {
    scrollToBottom();
  }, [activeChat?.messages]);

  // Listen for new messages in real-time and reload when active conversation gets a message
  useEffect(() => {
    if (!selectedChatId) return;
    
    const handleNewMessage = async (data: any) => {
      console.log('[ChatInterface] message:new event received:', data);
      const { conversation_id } = data;
      
      // If the message is for the active conversation, reload messages
      if (conversation_id === selectedChatId || conversation_id === activeChat?.id) {
        console.log('[ChatInterface] Message is for active conversation, refetching messages...');
        try {
          // Small delay to ensure message is committed to DB
          await new Promise(r => setTimeout(r, 300));
          refetch();
        } catch (err) {
          console.error('[ChatInterface] Failed to refetch:', err);
        }
      }
    };

    const socket = connectSocket();
    if (socket) {
      socket.on('message:new', handleNewMessage);
      return () => {
        socket.off('message:new', handleNewMessage);
      };
    }
  }, [selectedChatId, activeChat?.id, refetch]);

  // Listen for incoming calls and show a rich toast notification
  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;

    const handleCall = (data: {
      phone: string;
      phone_formated: string;
      contact_name: string | null;
      contact_avatar: string | null;
      isVideo: boolean;
      isGroup: boolean;
    }) => {
      const name = data.contact_name || data.phone_formated || data.phone;
      const avatar = data.contact_avatar
        || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0ea5e9&color=fff`;
      const callType = data.isVideo ? 'Vídeo chamada' : 'Chamada de voz';
      const phone = data.phone_formated || data.phone;

      toast.custom(
        (toastId) => (
          <div className="flex items-center gap-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-xl px-4 py-3 min-w-[300px] max-w-sm">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <img
                src={avatar}
                alt={name}
                className="w-12 h-12 rounded-full object-cover border-2 border-emerald-400"
                onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0ea5e9&color=fff`; }}
              />
              <span className="absolute -bottom-0.5 -right-0.5 bg-emerald-500 rounded-full p-0.5">
                {data.isVideo
                  ? <VideoIcon className="w-2.5 h-2.5 text-white" />
                  : <PhoneIncoming className="w-2.5 h-2.5 text-white" />}
              </span>
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">{callType}</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{name}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">{phone}</p>
            </div>
            {/* Dismiss */}
            <button
              onClick={() => toast.dismiss(toastId)}
              className="flex-shrink-0 p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-colors"
              title="Fechar"
            >
              <PhoneOff className="w-4 h-4" />
            </button>
          </div>
        ),
        { duration: 30_000, position: 'top-right' },
      );
    };

    socket.on('instance:call', handleCall);
    return () => { socket.off('instance:call', handleCall); };
  }, []);

  // Fetch tickets when previous conversations sheet opens
  useEffect(() => {
    if (!isPrevConvsOpen) return;
    let mounted = true;
    api.fetchTickets().then(list => { if (mounted) setPrevTickets(list || []); }).catch(() => { if (mounted) setPrevTickets([]); });
    return () => { mounted = false; };
  }, [isPrevConvsOpen]);

  // Mobile floating action: focus search / open list
  const handleMobileCompose = () => {
    setIsListOpen(true);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 250);
  };

  const handleToggleTag = async (tagKey: string) => {
    if (!activeChat) return;
    
    const currentTags = activeChat.tags || [];
    const newTags = currentTags.includes(tagKey)
      ? currentTags.filter(t => t !== tagKey)
      : [...currentTags, tagKey];
    
    try {
      await api.updateContactTags(activeChat.contactId, newTags);
      toast.success('Tag atualizada');
    } catch (error) {
      console.error('Error updating tag:', error);
      toast.error('Erro ao atualizar tag');
    }
  };

  const handleCreateTag = async (tag: { key: string; label: string; color: string; category: string }) => {
    try {
      const newTag = await api.createTagDefinition(tag);
      setAvailableTags(prev => [...prev, newTag]);
      toast.success('Tag criada com sucesso');
      
      // Adicionar a tag ao contato automaticamente
      if (activeChat) {
        await handleToggleTag(tag.key);
      }
    } catch (error) {
      console.error('Error creating tag:', error);
      toast.error('Erro ao criar tag');
    }
  };

  const handleCreateConversation = async () => {
    if (!newConvPhone.trim()) return toast.error('Informe o número de telefone');
    setCreatingConv(true);
    try {
      const conv = await api.createConversation({
        instanceId: newConvInstance || instancesList[0]?.id || '',
        phone: newConvPhone,
        contactName: newConvName || 'Contato',
        createTicket: newConvTicket,
        muteNotifications: newConvMute,
      });
      if (newConvTicket && conv?.id) {
        await api.createTicket(conv.id, undefined, undefined, undefined as any);
      }
      toast.success('Conversa criada!');
      setIsNewConvOpen(false);
      setNewConvPhone('');
      setNewConvName('');
      setNewConvTicket(false);
      setNewConvMute(false);
      if (refetch) await refetch();
      setSelectedChatId(conv.id);
    } catch (err: any) {
      console.error('create conversation failed', err);
      toast.error('Falha ao criar conversa: ' + (err?.message || String(err)));
    } finally {
      setCreatingConv(false);
    }
  };

  // Prefill contact fields by searching name, phone or client code
  const prefillContactBySearch = async () => {
    try {
      const nameQ = (newConvName || '').trim().toLowerCase();
      const phoneQ = (newConvPhone || '').replace(/\D/g, '');
      const codeQ = (newConvClientCode || '').trim();
      const contacts = await api.fetchContacts();
      let found: any = null;
      if (nameQ) {
        found = contacts.find((c: any) => (c.name || '').toLowerCase().includes(nameQ));
      }
      if (!found && phoneQ) {
        found = contacts.find((c: any) => ((c.phone || '').toString().replace(/\D/g, '') || '').includes(phoneQ));
      }
      if (!found && codeQ) {
        found = contacts.find((c: any) => ((c.extra && (c.extra.clientCode || c.extra.client_code)) || '').toString() === codeQ.toString());
      }
      if (found) {
        setNewConvName(found.name || '');
        setNewConvPhone(found.phone || '');
        const clientCode = (found.extra && (found.extra.clientCode || found.extra.client_code)) || '';
        setNewConvClientCode(clientCode);
      }
    } catch (err) {
      console.error('prefillContactBySearch failed', err);
    }
  };

  const handleNewConvTicketChange = (val: any) => {
    const active = Boolean(val);
    setNewConvTicket(active);
    if (active) prefillContactBySearch();
  };

  const handleNewConvMuteChange = (val: any) => {
    const active = Boolean(val);
    setNewConvMute(active);
    if (active) prefillContactBySearch();
  };

  // Conversation actions
  const handleAssign = async (conversationId: string, memberId: string | null) => {
    if (!memberId) return toast.error('Selecione um membro');
    try {
      await api.assignConversation(conversationId, memberId);
      const member = teamMembers.find(m => m.id === memberId);
      toast.success(`Atribuído para ${member ? member.name : memberId}`);
      if (refetch) await refetch();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atribuir');
    }
  };

  

  const handleTransfer = async (conversationId: string, instanceId: string | null) => {
    try {
      // If transferMode is agent and transferAgentId provided, assign to that user
      if (transferMode === 'agent' && transferAgentId) {
        await api.assignConversation(conversationId, transferAgentId);
        const user = teamMembers.find(u => u.id === transferAgentId);
        toast.success(`Atribuída para ${user ? user.name : transferAgentId}`);
      } else {
        await api.transferConversation(conversationId, instanceId);
        const inst = instancesList.find(i => i.id === instanceId);
        toast.success(`Transferida para ${inst ? inst.name : 'nenhuma instância'}`);
      }
      if (refetch) await refetch();
    } catch (err) {
      console.error(err);
      toast.error('Falha ao transferir');
    }
  };

  const handleEditContact = (conversationId: string, phone?: string) => {
    const target = phone || conversations.find(c => c.id === conversationId)?.contactPhone;
    if (target) window.location.href = `/contacts?phone=${encodeURIComponent(target)}`;
    else toast.error('Contato não disponível');
  };

  const handleEndConversation = async (conversationId: string) => {
    if (!window.confirm('Encerrar conversa?')) return;
    try {
      await api.closeConversation(conversationId);
      toast.success('Conversa encerrada');
      if (refetch) await refetch();
    } catch (err) {
      console.error(err);
      toast.error('Falha ao encerrar');
    }
  };

  const handleArchiveConversation = async (conversationId: string) => {
    if (!window.confirm('Arquivar conversa?')) return;
    try {
      await api.archiveConversation(conversationId);
      toast.success('Conversa arquivada');
      if (refetch) await refetch();
    } catch (err) {
      console.error(err);
      toast.error('Falha ao arquivar');
    }
  };

  const handleExportConversation = (conversationId: string) => {
    const conv = conversations.find(c => c.id === conversationId);
    if (!conv) return toast.error('Conversa não encontrada');
    const data = JSON.stringify(conv, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-${conversationId}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success('Exportação iniciada');
  };

  const handleLeaveGroup = async (conversationId: string) => {
    if (!auth?.user) return toast.error('Usuário não identificado');
    if (!window.confirm('Sair deste grupo?')) return;
    try {
      await api.leaveGroup(conversationId, auth.user.id);
      toast.success('Você saiu do grupo');
      if (refetch) await refetch();
      // If the active chat was the group, deselect it
      if (selectedChatId === conversationId) setSelectedChatId(null);
    } catch (err) {
      console.error('fail leave group', err);
      toast.error('Falha ao sair do grupo');
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!activeChat) return;

    const content = inputText.trim();
    // prepare attachments payload for API
    const attachPayload = attachments.map(a => ({ dataUrl: a.dataUrl, name: a.name, type: a.type }));
    setInputText('');
    setAttachments([]);
    setShowAttachGrid(false);
    await sendMessage(activeChat.id, content, attachPayload.length > 0 ? attachPayload : undefined);
  };

  const adjustInputLayout = () => {
    const ta = inputRef.current;
    const wrap = inputWrapperRef.current;
    const iconsEl = iconsRef.current;
    const sendEl = sendBtnRef.current;
    if (!ta || !wrap || !iconsEl || !sendEl) return;

    // If conversation is handled by LiveChat, icons are hidden — keep padding minimal
    if (activeChat?.status === 'livechat') {
      setDynamicPaddingRight(12);
      // place iconsRightPx near the send button area (icons hidden, value won't affect layout)
      setIconsRightPx(DEFAULT_SEND_RIGHT + DEFAULT_SEND_WIDTH);
      return;
    }

    const textWidth = Math.max(ta.scrollWidth, ta.clientWidth);
    const wrapperWidth = wrap.clientWidth;
    const sendWidth = sendEl.offsetWidth || 48;
    const iconsWidth = iconsEl.offsetWidth || 0;

    const gap = 12; // min gap between text and icons
    // reserve icons width + send button width + gap when send button is at the end of input
    const maxReserved = iconsWidth + sendWidth + gap; // px reserved on right
    const visibleWidth = wrapperWidth - maxReserved;

    if (textWidth > visibleWidth) {
      const extra = Math.min(maxReserved - gap, textWidth - visibleWidth);
      const newPadding = Math.max(gap, maxReserved - extra);
      setDynamicPaddingRight(newPadding);
      // baseline positions icons just left of the send button; add extra when text grows
      const baseline = DEFAULT_SEND_RIGHT + DEFAULT_SEND_WIDTH - DEFAULT_ICON_GAP;
      setIconsRightPx(baseline + extra);
    } else {
      // When there is text typed, reserve space so text doesn't overlap icons/button
      if (inputText.trim().length > 0) {
        setDynamicPaddingRight(maxReserved);
      } else {
        setDynamicPaddingRight(maxReserved);
      }
      const baseline = DEFAULT_SEND_RIGHT + DEFAULT_SEND_WIDTH - DEFAULT_ICON_GAP;
      setIconsRightPx(baseline);
    }

    // If text is approaching the icon area, lift the input slightly so it "suba"
    const approachThreshold = 24; // px before the icons (smaller so input lifts later)
    if (textWidth > (visibleWidth - approachThreshold)) {
      setIsInputLifted(true);
    } else {
      setIsInputLifted(false);
    }
  };

  useEffect(() => {
    adjustInputLayout();
    // re-adjust on window resize
    const onResize = () => adjustInputLayout();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [inputText, attachments.length]);

  // Ensure padding is correct after paint to avoid icons overlapping typed text.
  useLayoutEffect(() => {
    const measureAndSet = () => {
      const ta = inputRef.current;
      const iconsEl = iconsRef.current;
      const sendEl = sendBtnRef.current;
      if (!ta || !iconsEl || !sendEl) return;

      // If LiveChat is active hide icons and keep small padding
      if (activeChat?.status === 'livechat') {
        setDynamicPaddingRight(12);
        return;
      }

      const iconsW = iconsEl.offsetWidth || 0;
      const sendW = sendEl.offsetWidth || 48;
      const extraGap = 12; // safety gap
      const desired = iconsW + sendW + extraGap;
      setDynamicPaddingRight(desired);
      // ensure icons are positioned next to send button baseline
      const baseline = DEFAULT_SEND_RIGHT + DEFAULT_SEND_WIDTH - DEFAULT_ICON_GAP;
      setIconsRightPx(baseline);
    };

    // measure on next frame
    requestAnimationFrame(measureAndSet);
    window.addEventListener('resize', measureAndSet);
    return () => window.removeEventListener('resize', measureAndSet);
  }, [inputText, activeChat?.status, attachments.length]);

  const readFileAsDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData && Array.from(e.clipboardData.items || []);
    if (!items || items.length === 0) return;
    const imgItem = items.find(it => it.type && it.type.startsWith('image'));
    if (imgItem) {
      e.preventDefault();
      const file = imgItem.getAsFile();
      if (!file) return;
      try {
        const dataUrl = await readFileAsDataUrl(file);
        setPastedPreview(dataUrl);
        setShowAttachPopup(true);
      } catch (err) {
        console.error('Failed reading pasted image', err);
      }
    }
  };

  // ── Audio recording handlers ──
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      recordedChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          setAttachments(prev => [
            { id: (crypto as any).randomUUID?.() || String(Date.now()), dataUrl, name: `audio_${Date.now()}.webm`, type: 'audio/webm' },
            ...prev,
          ]);
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecordingAudio(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch (err) {
      console.error('Microphone access denied', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    setIsRecordingAudio(false);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
    setRecordingTime(0);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop());
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    mediaRecorderRef.current = null;
    recordedChunksRef.current = [];
    setIsRecordingAudio(false);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
    setRecordingTime(0);
  };

  const handleMicClick = () => {
    if (isRecordingAudio) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleAttachClick = () => {
    setShowAttachGrid(prev => !prev);
  };

  const handleAttachGridSelect = (type: 'image' | 'video' | 'audio' | 'sticker' | 'document') => {
    setShowAttachGrid(false);
    switch (type) {
      case 'image': imageInputRef.current?.click(); break;
      case 'video': videoInputRef.current?.click(); break;
      case 'audio': audioInputRef.current?.click(); break;
      case 'sticker': stickerInputRef.current?.click(); break;
      case 'document': docInputRef.current?.click(); break;
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const picked: Array<{ id: string; dataUrl: string; name?: string; type?: string }> = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        const dataUrl = await readFileAsDataUrl(f);
        picked.push({ id: (crypto as any).randomUUID?.() || String(Date.now()) + String(i), dataUrl, name: f.name, type: f.type });
      } catch (err) {
        console.error('read file failed', err);
      }
    }
    if (picked.length > 0) setAttachments(prev => [...picked, ...prev]);
    // reset all file inputs
    const target = e.target;
    if (target) target.value = '';
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const confirmAttach = () => {
    if (!pastedPreview) return;
    setAttachments(prev => [{ id: (crypto as any).randomUUID?.() || String(Date.now()), dataUrl: pastedPreview, name: 'pasted-image' }, ...prev]);
    setPastedPreview(null);
    setShowAttachPopup(false);
  };

  const handleSuggestionMenuAction = (action: string) => {
    if (action === 'Expandir') {
      setShowSuggestions(true);
      toast.success('Expandir (abrindo sugestões)');
      return;
    }
    if (action === 'Reformular') {
      toast.success('Reformular (funcionalidade a implementar)');
      return;
    }
    if (action === 'Meu tom de voz') {
      const tone = window.prompt('Insira o tom desejado (ex: Mais amigável, Formal):', 'Mais amigável');
      if (tone) toast.success(`Tom aplicado: ${tone}`);
      return;
    }
    if (action === 'Mais amigável' || action === 'Mais formal' || action === 'Corrigir gramática') {
      toast.success(`${action} (a implementar)`);
      return;
    }
    if (action === 'Traduzir') {
      const lang = window.prompt('Traduzir para qual idioma?', 'Inglês');
      if (lang) toast.success(`Traduzir para ${lang} (a implementar)`);
      return;
    }
  };

  const removeAttachment = (id: string) => setAttachments(prev => prev.filter(a => a.id !== id));

  const openAttachmentPreview = (a: { id: string; dataUrl: string; name?: string; type?: string }) => {
    const t = (a.type || '').toLowerCase();
    if (t.startsWith('image/')) {
      openGallery([a.dataUrl], 0);
      return;
    }
    if (t.startsWith('audio/')) {
      setPreviewAudioUrl(a.dataUrl);
      try { previewAudioRef.current?.pause(); } catch {};
      return;
    }
    if (t.startsWith('video/')) {
      setPreviewVideoUrl(a.dataUrl);
      try { previewVideoRef.current?.pause(); } catch {};
      return;
    }
    // fallback to document preview (offer download)
    setPreviewDoc({ url: a.dataUrl, name: a.name });
  };

  const handleOpenTicket = async () => {
    if (!activeChat) return;
    try {
      await api.createTicket(activeChat.id, undefined, undefined, undefined as any);
      toast.success('Chamado criado');
    } catch (err) {
      console.error('create ticket failed', err);
      toast.error('Falha ao criar chamado');
    }
  };

  const handleCloseConversation = async () => {
    if (!activeChat) return;
    try {
      await api.closeConversation(activeChat.id, null as any);
      toast.success('Conversa encerrada');
      if (refetch) await refetch();
    } catch (err) {
      console.error('close conversation failed', err);
      toast.error('Falha ao encerrar conversa');
    }
  };

  const handleReopenConversation = async () => {
    if (!activeChat) return;
    try {
      await api.reopenConversation(activeChat.id, null as any);
      toast.success('Conversa reaberta');
      if (refetch) await refetch();
    } catch (err) {
      console.error('reopen conversation failed', err);
      toast.error('Falha ao reabrir conversa');
    }
  };

  const handleStatusChange = async (status: ConversationStatus) => {
    if (!activeChat) return;
    await updateStatus(activeChat.id, status);
  };

  const filteredConversations = conversations.filter(chat => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      chat.contactName.toLowerCase().includes(query) ||
      chat.contactPhone.includes(query) ||
      chat.lastMessage.toLowerCase().includes(query)
    );
  });

  // Apply chip filter
  const applyChipFilter = (list: typeof conversations) => {
    switch (chipFilter) {
      case 'queue':
        return list.filter(c => c.status === 'paused');
      case 'unread':
        return list.filter(c => (c.unreadCount || 0) > 0);
      case 'waiting':
        return list.filter(c => c.status === 'livechat' && (c.unreadCount || 0) === 0);
      case 'mine':
        return list.filter(c => c.assignedUserId && auth?.user && c.assignedUserId === auth.user.id);
      default:
        return list;
    }
  };

  const updateChipsOverflow = () => {
    const el = chipsRef.current;
    if (!el) return;
    const { scrollWidth, clientWidth, scrollLeft } = el;
    setShowLeftChipArrow(scrollLeft > 5);
    setShowRightChipArrow(scrollLeft + clientWidth < scrollWidth - 5);
  };

  useEffect(() => {
    updateChipsOverflow();
    const el = chipsRef.current;
    if (!el) return;
    const onScroll = () => updateChipsOverflow();
    window.addEventListener('resize', updateChipsOverflow);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('resize', updateChipsOverflow);
      el.removeEventListener('scroll', onScroll as any);
    };
  }, [conversations.length]);

  // Enable click-and-drag scrolling on the chips container (desktop & touch)
  useEffect(() => {
    const el = chipsRef.current;
    if (!el) return;
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDown = true;
      el.classList.add('dragging');
      startX = e.pageX - (el.getBoundingClientRect().left + window.scrollX);
      scrollLeft = el.scrollLeft;
      document.body.style.userSelect = 'none';
    };
    const onMouseLeave = () => {
      isDown = false;
      el.classList.remove('dragging');
      document.body.style.userSelect = '';
    };
    const onMouseUp = () => {
      isDown = false;
      el.classList.remove('dragging');
      document.body.style.userSelect = '';
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - (el.getBoundingClientRect().left + window.scrollX);
      const walk = (x - startX) * 1.5; // speed multiplier
      el.scrollLeft = scrollLeft - walk;
    };

    const onTouchStart = (e: TouchEvent) => {
      isDown = true;
      el.classList.add('dragging');
      startX = e.touches[0].pageX - (el.getBoundingClientRect().left + window.scrollX);
      scrollLeft = el.scrollLeft;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!isDown) return;
      const x = e.touches[0].pageX - (el.getBoundingClientRect().left + window.scrollX);
      const walk = (x - startX) * 1.5;
      el.scrollLeft = scrollLeft - walk;
    };
    const onTouchEnd = () => {
      isDown = false;
      el.classList.remove('dragging');
    };

    el.addEventListener('mousedown', onMouseDown);
    el.addEventListener('mouseleave', onMouseLeave);
    document.addEventListener('mouseup', onMouseUp);
    el.addEventListener('mousemove', onMouseMove);

    el.addEventListener('touchstart', onTouchStart, { passive: true } as any);
    el.addEventListener('touchmove', onTouchMove, { passive: true } as any);
    el.addEventListener('touchend', onTouchEnd as any);

    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      el.removeEventListener('mouseleave', onMouseLeave);
      document.removeEventListener('mouseup', onMouseUp);
      el.removeEventListener('mousemove', onMouseMove);
      el.removeEventListener('touchstart', onTouchStart as any);
      el.removeEventListener('touchmove', onTouchMove as any);
      el.removeEventListener('touchend', onTouchEnd as any);
    };
  }, []);

  const scrollChips = (dir: 'left'|'right') => {
    const el = chipsRef.current;
    if (!el) return;
    const amount = Math.max(el.clientWidth * 0.5, 120);
    el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
    setTimeout(updateChipsOverflow, 300);
  };

  // Apply additional filters from the popover
  let filteredAndApplied = filteredConversations.filter(chat => {
    if (statusFilter !== 'all' && chat.status !== statusFilter) return false;
    if (unreadOnly && (chat.unreadCount ?? 0) === 0) return false;
    return true;
  });
  filteredAndApplied = applyChipFilter(filteredAndApplied);

  // Apply awaiting/agendado filters (if any selected)
  if (awaitingFilter || scheduledFilter) {
    filteredAndApplied = filteredAndApplied.filter(c => {
      const tags = (c as any).tags || [];
      const matchAwaiting = awaitingFilter && tags.includes('aguardando');
      const matchScheduled = scheduledFilter && tags.includes('agendado');
      return matchAwaiting || matchScheduled;
    });
  }

  // Apply tab filter: show only groups when `groups` tab active, otherwise show non-group chats
  if (activeTab === 'groups') {
    filteredAndApplied = filteredAndApplied.filter(c => Boolean((c as any).isGroup));
  } else {
    filteredAndApplied = filteredAndApplied.filter(c => !Boolean((c as any).isGroup));
  }

  // Apply instance filter (if any instances selected)
  if (selectedInstanceIds.length > 0) {
    filteredAndApplied = filteredAndApplied.filter(c => {
      const inst = (c as any).assignedTeam || (c as any).instanceId || null;
      return inst && selectedInstanceIds.includes(inst);
    });
  }

  // Sort conversations by last message timestamp according to `orderBy`
  const getLastTs = (c: UIConversation) => {
    try {
      const msgs = c.messages || [];
      if (msgs.length > 0) return new Date(msgs[msgs.length - 1].timestamp).getTime();
      // fallback to lastMessageTime if available
      const t = c.lastMessageTime || c.lastMessage || '';
      const parsed = Date.parse(t as string);
      return isNaN(parsed) ? 0 : parsed;
    } catch (err) {
      return 0;
    }
  };

  filteredAndApplied.sort((a, b) => {
    const ta = getLastTs(a as UIConversation);
    const tb = getLastTs(b as UIConversation);
    return orderBy === 'recent' ? tb - ta : ta - tb;
  });

  // Counts for UI badges
  const groupsCount = conversations.filter(c => Boolean((c as any).isGroup)).length;
  const chatsUnreadCount = conversations.filter(c => !Boolean((c as any).isGroup) && (c.unreadCount || 0) > 0).length;
  const groupsUnreadCount = conversations.filter(c => Boolean((c as any).isGroup) && (c.unreadCount || 0) > 0).length;

  const renderStatusBadge = (status: ConversationStatus) => {
    const config = {
      livechat: { label: sdrName, icon: Bot, color: 'bg-violet-500/20 text-violet-400 border-violet-500/30' },
      human: { label: 'Humano', icon: User, color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
      paused: { label: 'Pausado', icon: Pause, color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' }
    };
    const entry = (config as any)[status] || { label: 'Encerrada', icon: XCircle, color: 'bg-gray-200 dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-300/30 dark:border-slate-700/30' };
    const { label, icon: Icon, color } = entry;
    return (
      <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium border flex items-center gap-1 ${color}`}>
        <Icon className="w-3 h-3" />
        {label}
      </span>
    );
  };

  const renderMessageContent = (msg: UIMessage) => {
    if (msg.type === MessageType.IMAGE) {
      return <MessageImage mediaUrl={msg.mediaUrl} content={msg.content} direction={msg.direction} />;
    }

    if (msg.type === MessageType.VIDEO) {
      return <MessageVideo mediaUrl={msg.mediaUrl} content={msg.content} />;
    }

    if (msg.type === MessageType.STICKER) {
      return <MessageSticker mediaUrl={msg.mediaUrl} content={msg.content} />;
    }

    if (msg.type === MessageType.FILE) {
      return <MessageFile mediaUrl={msg.mediaUrl} content={msg.content} direction={msg.direction} />;
    }

    if (msg.type === MessageType.AUDIO) {
      return (
        <MessageAudio
          msgId={msg.id}
          mediaUrl={msg.mediaUrl}
          direction={msg.direction}
          audioRefs={audioRefs}
          playingAudioId={playingAudioId}
          setPlayingAudioId={setPlayingAudioId}
          audioDurations={audioDurations}
          setAudioDurations={setAudioDurations}
          audioProgress={audioProgress}
          setAudioProgress={setAudioProgress}
          formatAudioTime={formatAudioTime}
        />
      );
    }

    return <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>;
  };

  if (loading) {
    return (
      <div className="flex h-full bg-white dark:bg-slate-950 items-center justify-center">
          <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-gray-500 dark:text-slate-500">Sincronizando conversas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-white dark:bg-slate-950 rounded-tl-2xl overflow-hidden border-t border-l border-gray-200/50 dark:border-slate-800/50 shadow-2xl">
      
      {/* Left Sidebar: Chat List (desktop) */}
      <div ref={sidebarRef} style={{ width: sidebarWidth }} className="hidden md:flex border-r-0 flex flex-col bg-gray-100/50 dark:bg-slate-900/50 backdrop-blur-md z-20 flex-shrink-0">
        {/* Search Header */}
        <div className="p-3 border-b border-gray-200/50 dark:border-slate-800/50">
          <div className="flex items-center gap-2 mb-2">
          <div className="relative group flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-slate-500 group-focus-within:text-primary transition-colors" />
            <input 
              type="text" 
              placeholder="Buscar conversa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              ref={el => (searchInputRef.current = el)}
              className="w-full pl-9 pr-12 py-2 bg-white/50 dark:bg-slate-950/50 border border-gray-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-ring/50 focus:border-primary/50 outline-none text-gray-700 dark:text-slate-200 placeholder:text-gray-400 dark:text-slate-600 transition-all"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <Popover>
                <PopoverTrigger asChild>
                  <button title="Filtros" className="p-1 rounded-md text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:text-white hover:bg-gray-200/40 dark:bg-slate-800/40 transition-colors">
                    <Filter className="w-4 h-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0">
                  <div className="p-4">
                    <h4 className="text-lg font-semibold">Filtros Avançados</h4>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Refine sua busca com filtros adicionais</p>

                    <div className="mt-4">
                      <div className="text-xs text-gray-500 dark:text-slate-400 mb-2">Ordenação</div>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="w-full rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 flex items-center justify-between text-sm text-gray-900 dark:text-slate-100">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-primary" />
                              <span>{orderBy === 'recent' ? 'Mais Recentes' : 'Mais Antigas'}</span>
                            </div>
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-2">
                          <div className="space-y-2">
                            <button onClick={() => setOrderBy('recent')} className={`w-full text-left px-3 py-2 rounded-md ${orderBy === 'recent' ? 'bg-primary text-white' : 'hover:bg-gray-100 dark:hover:bg-slate-800'}`}>
                              Mais Recentes
                            </button>
                            <button onClick={() => setOrderBy('oldest')} className={`w-full text-left px-3 py-2 rounded-md ${orderBy === 'oldest' ? 'bg-primary text-white' : 'hover:bg-gray-100 dark:hover:bg-slate-800'}`}>
                              Mais Antigas
                            </button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="mt-4">
                      <div className="text-xs text-gray-500 dark:text-slate-400 mb-2">Status</div>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className={`w-full text-left rounded-lg px-3 py-2 text-sm flex items-center justify-between ${statusFilter !== 'all' ? 'bg-primary text-white' : 'bg-white dark:bg-slate-950 text-gray-900 dark:text-slate-100 border border-gray-200 dark:border-slate-800'}`}>
                            <span>{({ all: 'Todas', livechat: 'IA', human: 'Humano', paused: 'Pausado' } as Record<string,string>)[statusFilter] || 'Todas'}</span>
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-2">
                          <div className="p-2">
                            <input
                              value={statusSearch}
                              onChange={e => setStatusSearch(e.target.value)}
                              placeholder="Buscar status..."
                              className="w-full mb-2 px-3 py-2 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm outline-none"
                            />
                            <div className="max-h-48 overflow-auto">
                              {Object.entries({ all: 'Todas', livechat: 'IA', human: 'Humano', paused: 'Pausado' })
                                .filter(([k, v]) => v.toLowerCase().includes(statusSearch.toLowerCase()))
                                .map(([value, label]) => (
                                  <button
                                    key={value}
                                    type="button"
                                    onClick={() => setStatusFilter(value)}
                                    className={`w-full flex items-center justify-between px-3 py-1.5 text-sm rounded hover:bg-gray-100 dark:hover:bg-slate-800 ${statusFilter === value ? 'bg-primary/5 dark:bg-slate-800/40' : ''}`}
                                  >
                                    <span className="truncate">{label}</span>
                                    {statusFilter === value ? <Check className="w-4 h-4 text-primary" /> : <span className="w-4 h-4" />}
                                  </button>
                                ))}
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="mt-4">
                      <div className="text-xs text-gray-500 dark:text-slate-400 mb-2">Instância</div>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="w-full text-left border border-gray-200 dark:border-slate-800 rounded-md px-3 py-2 text-sm text-gray-700 dark:text-slate-200 flex items-center justify-between">
                            <span>{selectedInstanceIds.length === 0 ? 'Todas as Instâncias' : `${selectedInstanceIds.length} selecionadas`}</span>
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-2">
                          <div className="p-2">
                            <input
                              value={instanceSearch}
                              onChange={e => setInstanceSearch(e.target.value)}
                              placeholder="Buscar instância..."
                              className="w-full mb-2 px-3 py-2 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm outline-none"
                            />
                            <div className="max-h-48 overflow-auto">
                              <div className="py-1">
                                <button type="button" onClick={() => setSelectedInstanceIds([])} className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-gray-100 dark:hover:bg-slate-800">Todas as Instâncias</button>
                              </div>
                              {instancesList.filter((ins: any) => (ins.name || ins.id || '').toLowerCase().includes(instanceSearch.toLowerCase())).map((ins: any) => {
                                const active = selectedInstanceIds.includes(ins.id);
                                return (
                                  <button
                                    key={ins.id}
                                    type="button"
                                    onClick={() => setSelectedInstanceIds(prev => active ? prev.filter(id => id !== ins.id) : [...prev, ins.id])}
                                    className={`w-full flex items-center justify-between px-3 py-1.5 text-sm rounded ${active ? 'bg-primary/5 dark:bg-slate-800/40' : 'hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                                  >
                                    <span className="truncate">{ins.name || ins.id}</span>
                                    {active ? <Check className="w-4 h-4 text-primary" /> : <span className="w-4 h-4" />}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="mt-5 flex justify-end gap-3">
                      <button onClick={() => { setStatusFilter('all'); setUnreadOnly(false); }} className="px-4 py-2 rounded-md border border-gray-300 dark:border-slate-700 text-sm text-gray-700 dark:text-slate-200">Limpar</button>
                      <button onClick={() => { /* apply filters */ }} className="px-4 py-2 rounded-md bg-primary hover:bg-primary/90 text-white text-sm">Aplicar</button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <button
            onClick={() => { setNewConvInstance(instancesList[0]?.id || ''); setIsNewConvOpen(true); }}
            className="flex-shrink-0 w-9 h-9 rounded-xl bg-primary hover:bg-primary/90 text-white dark:text-white flex items-center justify-center shadow-lg transition-colors"
            title="Nova conversa"
          >
            <Plus className="w-5 h-5" />
          </button>
          </div>
        </div>

        {/* Resizer was moved out to be a sibling to the sidebar (inserted after sidebar closing) */}

          <div className="sticky top-0 z-20 bg-transparent pt-2">
            {/* Tabs: hide when searching to free space */}
            {!searchQuery.trim() && (
              <div className="relative mb-2">
                <div className="flex items-center justify-center w-full">
                  <div className="inline-flex items-center bg-gray-100 dark:bg-slate-900 rounded-full p-1 shadow-sm">
                    <button
                      onClick={() => setActiveTab('chats')}
                      className={`px-4 py-1.5 rounded-full text-sm transition-colors ${activeTab === 'chats' ? 'bg-white dark:bg-slate-950 text-gray-900 dark:text-white font-semibold shadow-sm' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}
                    >
                      <span className="flex items-center gap-2">
                        <span>Chats</span>
                        {chatsUnreadCount > 0 && (
                          <span className="ml-1 inline-block bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full">{chatsUnreadCount}</span>
                        )}
                      </span>
                    </button>

                    <button
                      onClick={() => setActiveTab('groups')}
                      className={`px-4 py-1.5 rounded-full text-sm transition-colors ${activeTab === 'groups' ? 'bg-white dark:bg-slate-950 text-gray-900 dark:text-white font-semibold shadow-sm' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}
                    >
                      <span className="flex items-center gap-2">
                        <span>Grupos</span>
                        {groupsUnreadCount > 0 && (
                          <span className="ml-1 inline-block bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full">{groupsUnreadCount}</span>
                        )}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Filter chips */}
            <div className="relative mt-1">

              <div className="flex items-center justify-center gap-2 mb-3">
                <div ref={chipsRef} className="chips-scroll flex flex-nowrap items-center gap-2 overflow-x-auto py-0.5 max-w-full whitespace-nowrap">
                  <button title={`Todas (${conversations.length})`} onClick={() => setChipFilter('all')} className={`flex flex-shrink-0 whitespace-nowrap items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${chipFilter === 'all' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-slate-900 text-gray-700 dark:text-slate-300 hover:bg-gray-200/60 dark:hover:bg-slate-800/70'}`}>
                    <span>Todas</span>
                    <span className="inline-block bg-gray-100 dark:bg-slate-900 text-gray-700 dark:text-slate-200 text-[10px] px-2 py-0.5 rounded-full">{conversations.length}</span>
                  </button>
                  <button title={`Na Fila (${conversations.filter(c => c.status === 'paused').length})`} onClick={() => setChipFilter('queue')} className={`flex flex-shrink-0 whitespace-nowrap items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${chipFilter === 'queue' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-slate-900 text-gray-700 dark:text-slate-300 hover:bg-gray-200/60 dark:hover:bg-slate-800/70'}`}>
                    <span>Na Fila</span>
                    <span className="inline-block bg-gray-100 dark:bg-slate-900 text-gray-700 dark:text-slate-200 text-[10px] px-2 py-0.5 rounded-full">{conversations.filter(c => c.status === 'paused').length}</span>
                  </button>
                  <button title={`Aguardando (${conversations.filter(c => (c.tags||[]).includes('aguardando')).length})`} onClick={() => setAwaitingFilter(prev => !prev)} className={`flex flex-shrink-0 whitespace-nowrap items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${awaitingFilter ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-slate-900 text-gray-700 dark:text-slate-300 hover:bg-gray-200/60 dark:hover:bg-slate-800/70'}`}>
                    <span>Aguardando</span>
                    <span className="inline-block bg-gray-100 dark:bg-slate-900 text-gray-700 dark:text-slate-200 text-[10px] px-2 py-0.5 rounded-full">{conversations.filter(c => (c.tags||[]).includes('aguardando')).length}</span>
                  </button>
                  <button title={`Agendado (${conversations.filter(c => (c.tags||[]).includes('agendado')).length})`} onClick={() => setScheduledFilter(prev => !prev)} className={`flex flex-shrink-0 whitespace-nowrap items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${scheduledFilter ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-slate-900 text-gray-700 dark:text-slate-300 hover:bg-gray-200/60 dark:hover:bg-slate-800/70'}`}>
                    <span>Agendado</span>
                    <span className="inline-block bg-gray-100 dark:bg-slate-900 text-gray-700 dark:text-slate-200 text-[10px] px-2 py-0.5 rounded-full">{conversations.filter(c => (c.tags||[]).includes('agendado')).length}</span>
                  </button>
                  <button title={`Não lidas (${conversations.filter(c => (c.unreadCount||0) > 0).length})`} onClick={() => setChipFilter('unread')} className={`flex flex-shrink-0 whitespace-nowrap items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${chipFilter === 'unread' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-slate-900 text-gray-700 dark:text-slate-300 hover:bg-gray-200/60 dark:hover:bg-slate-800/70'}`}>
                    <span>Não lidas</span>
                    <span className="inline-block bg-gray-100 dark:bg-slate-900 text-gray-700 dark:text-slate-200 text-[10px] px-2 py-0.5 rounded-full">{conversations.filter(c => (c.unreadCount||0) > 0).length}</span>
                  </button>
                </div>
                <div className="ml-2 flex items-center shrink-0">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button title="Filtros" className="p-2 rounded-md text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:text-white hover:bg-gray-200/40 dark:bg-slate-800/40"><Filter className="w-4 h-4" /></button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64">
                      <div className="space-y-2">
                        <div className="text-xs text-gray-500 dark:text-slate-400">Status</div>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full border border-gray-200 dark:border-slate-800 rounded-md px-2 py-1 text-sm text-gray-900 dark:text-white">
                          <option value="all">Todos</option>
                          <option value="livechat">IA</option>
                          <option value="human">Humano</option>
                          <option value="paused">Pausado</option>
                        </select>
                        <div className="flex items-center gap-2">
                          <Switch id="unreadOnlyChips" checked={unreadOnly} onCheckedChange={(v: boolean) => setUnreadOnly(Boolean(v))} />
                          <label htmlFor="unreadOnlyChips" className="text-sm text-gray-600 dark:text-slate-300">Somente não lidas</label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch id="awaitingFilter" checked={awaitingFilter} onCheckedChange={(v: boolean) => setAwaitingFilter(Boolean(v))} />
                          <label htmlFor="awaitingFilter" className="text-sm text-gray-600 dark:text-slate-300">Aguardando</label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch id="scheduledFilter" checked={scheduledFilter} onCheckedChange={(v: boolean) => setScheduledFilter(Boolean(v))} />
                          <label htmlFor="scheduledFilter" className="text-sm text-gray-600 dark:text-slate-300">Agendado</label>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                          <button onClick={() => { setStatusFilter('all'); setUnreadOnly(false); setAwaitingFilter(false); setScheduledFilter(false); }} className="px-3 py-1 rounded-md bg-gray-200 dark:bg-slate-800 text-sm text-gray-600 dark:text-slate-300">Limpar</button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
 
            </div>
          </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filteredAndApplied.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-slate-500 p-8 text-center">
              <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-sm">Nenhuma conversa encontrada</p>
              <p className="text-xs mt-1 opacity-70">As conversas aparecerão aqui quando receberem mensagens</p>
            </div>
          ) : (
            filteredAndApplied.map((chat) => (
              <div 
                key={chat.id}
                onClick={() => setSelectedChatId(chat.id)}
                className={`flex items-center p-4 cursor-pointer transition-all duration-200 border-b border-gray-300/30 dark:border-slate-800/30 hover:bg-gray-200/50 dark:bg-slate-800/50 ${
                  selectedChatId === chat.id 
                    ? 'bg-gray-200/80 dark:bg-slate-800/80 border-l-2 border-l-cyan-500' 
                    : 'border-l-2 border-l-transparent'
                }`}
              >
                <div className="relative">
                  <div className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-gray-300 to-gray-400 dark:from-slate-700 dark:to-slate-900">
                    <img 
                      src={getAvatarUrl(chat)} 
                      alt={getDisplayName(chat)} 
                      className="w-full h-full rounded-full object-cover border border-gray-200 dark:border-slate-800" 
                    />
                  </div>
                  {chat.unreadCount > 0 ? (
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-cyan-500 border-2 border-gray-200 dark:border-slate-900 rounded-full animate-pulse"></span>
                  ) : (
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-gray-300 dark:bg-slate-600 border-2 border-gray-200 dark:border-slate-900 rounded-full"></span>
                  )}
                </div>
                
                <div className="ml-3 flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className={`text-sm font-semibold truncate ${selectedChatId === chat.id ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-slate-300'}`}>
                      {getDisplayName(chat)}
                    </h3>
                    <span className="text-[10px] text-gray-500 dark:text-slate-500 font-medium">{chat.lastMessageTime}</span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-slate-500 truncate flex items-center gap-2">
                    {(() => {
                      const last = chat.messages[chat.messages.length - 1];
                      if (!last) return <span className="truncate">Sem mensagens</span>;
                      if (last.type === MessageType.IMAGE && (last.mediaUrl || last.content)) {
                        return (
                            <img
                              src={last.mediaUrl || last.content}
                              alt="thumb"
                              className="w-14 h-10 object-cover rounded-md border border-gray-200 dark:border-slate-800 cursor-pointer"
                              onError={(e) => {(e.target as HTMLImageElement).src = 'https://placehold.co/56x40/1e293b/cbd5e1?text=Img'}}
                              onClick={(ev) => { ev.stopPropagation(); const imgs = (chat.messages || []).filter((mm: any) => mm.type === MessageType.IMAGE && (mm.mediaUrl || mm.content)).map((mm: any) => mm.mediaUrl || mm.content); const idx = imgs.indexOf(last.mediaUrl || last.content); if (imgs.length) openGallery(imgs, idx); }}
                            />
                          );
                      }
                      if (last.type === MessageType.AUDIO && (last.mediaUrl)) {
                        return (
                          <button onClick={(e) => { e.stopPropagation(); togglePreviewAudio(last.mediaUrl); }} className="flex items-center gap-2 text-gray-600 dark:text-slate-300">
                            <Play className="w-4 h-4 text-cyan-400" />
                            <span className="text-xs truncate">Áudio</span>
                          </button>
                        );
                      }
                      return <span className="truncate">{chat.lastMessage || 'Sem mensagens'}</span>;
                    })()}
                  </div>
                  
                  <div className="flex items-center mt-2 gap-1.5">
                    {/* Presence indicator dot */}
                    <div className="relative inline-block">
                      <span 
                        className={`w-2 h-2 rounded-full ${getPresenceDotColor((chat as any).contactPresence, chat.contact_id)}`}
                        title={getPresenceLabel((chat as any).contactPresence, chat.contact_id)}
                      ></span>
                    </div>
                    {renderStatusBadge(chat.status)}
                    {chat.tags.slice(0, 1).map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-gray-200/80 dark:bg-slate-800/80 border border-gray-300 dark:border-slate-700 text-gray-500 dark:text-slate-400 text-[10px] rounded-md font-medium">
                        {tag}
                      </span>
                    ))}
                    {chat.unreadCount > 0 && (
                      <span className="ml-auto bg-gradient-to-r from-primary to-accent text-white text-[10px] font-bold px-1.5 h-4 min-w-[1rem] flex items-center justify-center rounded-full shadow-lg shadow-[0_6px_18px_rgba(30,95,116,0.18)]">
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
                <div className="ml-2 flex-shrink-0">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button onClick={(e) => e.stopPropagation()} className="p-1 rounded-md text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:text-white hover:bg-gray-200/40 dark:bg-slate-800/40">
                        <Menu className="w-4 h-4" />
                      </button>
                    </PopoverTrigger>
                      <PopoverContent className="w-64 rounded-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-2 shadow-lg">
                        <div className="px-2 py-1">
                          <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-4 h-4 text-slate-700 dark:text-slate-200" />
                            <div className="text-sm font-semibold text-gray-900 dark:text-slate-100">Transferir</div>
                          </div>

                          <div className="space-y-2">
                            <button
                              onClick={async () => { try { await updateStatus(chat.id, 'livechat'); toast.success('Devolvido para I.A'); if (refetch) await refetch(); } catch (err) { console.error(err); toast.error('Falha'); } }}
                              className="w-full flex items-center gap-3 px-3 py-2 rounded-md bg-cyan-100 dark:bg-slate-800 text-slate-900 dark:text-white"
                            >
                              <span className="w-7 h-7 rounded-md bg-cyan-200/70 dark:bg-cyan-900/40 flex items-center justify-center">
                                <Bot className="w-4 h-4 text-cyan-700 dark:text-cyan-200" />
                              </span>
                              <span className="text-sm font-medium">Devolver para I.A</span>
                            </button>

                            <div className="border-t border-gray-200 dark:border-slate-800" />

                            <button onClick={() => { toast.success('Marcado como não lida (mock)'); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 text-sm text-gray-700 dark:text-slate-200">
                              <Mail className="w-4 h-4" />
                              Marcar como não lida
                            </button>

                            <button onClick={() => handleEndConversation(chat.id)} className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 text-sm text-gray-700 dark:text-slate-200">
                              <XCircle className="w-4 h-4" />
                              Encerrar conversa
                            </button>

                            <button onClick={() => handleArchiveConversation(chat.id)} className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 text-sm text-gray-700 dark:text-slate-200">
                              <FileText className="w-4 h-4" />
                              Arquivar conversa
                            </button>

                            <button onClick={() => handleExportConversation(chat.id)} className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 text-sm text-gray-700 dark:text-slate-200">
                              <Download className="w-4 h-4" />
                              Exportar conversa
                            </button>
                          </div>

                          <div className="mt-3 border-t border-gray-100 dark:border-slate-800 pt-2">
                            <label className="text-[11px] text-gray-500 dark:text-slate-400 mb-1 block">Transferir para setor</label>
                            <select
                              value={chat.assignedTeam || ''}
                              onChange={async (e) => {
                                const val = e.target.value || null;
                                try {
                                  await api.transferConversation(chat.id, val);
                                  const inst = instancesList.find(i => i.id === val);
                                  toast.success(`Transferida para ${inst ? inst.name : 'nenhuma instância'}`);
                                  if (refetch) await refetch();
                                } catch (err) {
                                  console.error(err);
                                  toast.error('Falha ao transferir');
                                }
                              }}
                              className="w-full border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-200 text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                            >
                              <option value="">Selecionar setor</option>
                              {teamsList.map(i => (
                                <option key={i.id} value={i.id}>{i.name}</option>
                              ))}
                            </select>

                            <div className="mt-3">
                              <label className="text-[11px] text-gray-500 dark:text-slate-400 mb-1 block">Ou transferir para agente</label>
                              <select
                                value={chat.assignedUserId || ''}
                                onChange={async (e) => {
                                  const val = e.target.value || null;
                                  try {
                                    await api.assignConversation(chat.id, val);
                                    const user = teamMembers.find(u => u.id === val);
                                    toast.success(`Atribuída para ${user ? user.name : val}`);
                                    if (refetch) await refetch();
                                  } catch (err) {
                                    console.error(err);
                                    toast.error('Falha ao atribuir');
                                  }
                                }}
                                className="w-full border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-200 text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                              >
                                <option value="">Selecionar agente</option>
                                {teamMembers.map((m: any) => (
                                  <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      </PopoverContent>
                  </Popover>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Ultra-thin resizer between sidebar and main content (desktop only) */}
      <div className="hidden md:flex items-stretch" style={{ width: 8, marginLeft: -4, zIndex: 60 }}>
        <div className="flex items-center justify-center w-full">
          <div
            onMouseDown={startDrag}
            onTouchStart={startDrag}
            role="separator"
            aria-orientation="vertical"
            className="relative w-2 h-28 cursor-col-resize flex items-center justify-center"
            style={{ touchAction: 'none' }}
          >
            {/* vertical line centered on the separator */}
            <div className="absolute inset-y-0 left-1/2 transform -translate-x-1/2 w-px bg-gray-200 dark:bg-slate-800" />
            {/* small grip dot placed on the line */}
            <span className="relative z-10 block w-1 h-1 rounded-full bg-gray-400 dark:bg-slate-400" />
          </div>
        </div>
      </div>

      {/* Mobile chat list drawer */}
      <div className="md:hidden">
        <div className={`fixed inset-0 z-40 ${isListOpen ? 'block' : 'pointer-events-none'} `} aria-hidden={!isListOpen}>
          <div className={`fixed inset-0 bg-black/50 ${isListOpen ? 'opacity-100' : 'opacity-0'} transition-opacity`} onClick={() => setIsListOpen(false)} />
          <div className={`fixed left-0 top-0 bottom-0 w-4/5 max-w-sm bg-white dark:bg-slate-950 p-4 z-50 transform ${isListOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Chats</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setNewConvInstance(instancesList[0]?.id || ''); setIsNewConvOpen(true); setIsListOpen(false); }}
                  className="w-8 h-8 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-gray-900 dark:text-white flex items-center justify-center transition-colors"
                  title="Nova conversa"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button onClick={() => setIsListOpen(false)} className="p-2 rounded-md text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:text-white bg-gray-100 dark:bg-slate-900">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="border-t border-gray-200/50 dark:border-slate-800/50 pt-3 overflow-y-auto h-[80vh]">
              {/* reuse conversation list markup (simplified) */}
              {filteredAndApplied.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-slate-500 p-8 text-center">
                  <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
                  <p className="text-sm">Nenhuma conversa encontrada</p>
                </div>
              ) : (
                filteredAndApplied.map((chat) => (
                  <div 
                    key={chat.id}
                    onClick={() => { setSelectedChatId(chat.id); setIsListOpen(false); }}
                    className={`flex items-center p-3 cursor-pointer transition-all duration-200 border-b border-gray-300/30 dark:border-slate-800/30 hover:bg-gray-200/50 dark:bg-slate-800/50 ${
                      selectedChatId === chat.id 
                        ? 'bg-gray-200/80 dark:bg-slate-800/80 border-l-2 border-l-cyan-500' 
                        : 'border-l-2 border-l-transparent'
                    }`}
                  >
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full p-0.5 bg-gradient-to-tr from-gray-300 to-gray-400 dark:from-slate-700 dark:to-slate-900">
                        <img src={chat.contactAvatar} alt={chat.contactName} className="w-full h-full rounded-full object-cover border border-gray-200 dark:border-slate-800" />
                      </div>
                    </div>
                    <div className="ml-3 flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <h3 className={`text-sm font-semibold truncate ${selectedChatId === chat.id ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-slate-300'}`}>
                          {chat.contactName}
                        </h3>
                        <span className="text-[10px] text-gray-500 dark:text-slate-500 font-medium">{chat.lastMessageTime}</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-slate-500 truncate">{chat.lastMessage || 'Sem mensagens'}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right Area: Chat Window & Profile */}
      {activeChat ? (
        <div className="flex-1 flex overflow-hidden bg-gray-50 dark:bg-[#0B0E14]">
          {/* Main Chat Content */}
          <div className="flex-1 flex flex-col min-w-0 relative">
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>

            {/* Chat Header */}
            <div className="h-16 px-6 flex items-center justify-between bg-gray-100/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-200 dark:border-slate-800 z-10 shrink-0">
              <div className="flex items-center gap-2">
                <button className="md:hidden p-2 rounded-md text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:text-white" onClick={() => setIsListOpen(true)} aria-label="Abrir lista de conversas">
                  <Menu className="w-5 h-5" />
                </button>
                <div 
                  className="flex items-center cursor-pointer hover:bg-gray-200/50 dark:bg-slate-800/50 p-1.5 -ml-1.5 rounded-lg transition-colors pr-3"
                  onClick={() => setShowProfileInfo(!showProfileInfo)}
                >
                <div className="relative">
                  <img src={getAvatarUrl(activeChat)} alt={getDisplayName(activeChat)} className="w-9 h-9 rounded-full ring-2 ring-gray-200 dark:ring-slate-800" />
                  <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-gray-200 dark:border-slate-900 rounded-full ${getPresenceDotColor((activeChat as any).contactPresence, activeChat.contact_id)}`} title={getPresenceLabel((activeChat as any).contactPresence, activeChat.contact_id)}></span>
                </div>
                <div className="ml-3">
                  <h2 className="text-sm font-bold text-gray-800 dark:text-slate-100 flex items-center gap-2">
                    {activeChat.contactName}
                    {renderStatusBadge(activeChat.status)}
                  </h2>
                  <p className="text-xs text-cyan-500 font-medium">
                    {getPresenceStatusText((activeChat as any).contactPresence, activeChat.contact_id) || <span>{activeChat.contactPhone}</span>}
                  </p>
                </div>
              </div>
              </div>
              <div className="flex items-center gap-1">
                {/* Status control buttons */}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={`text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:text-white ${activeChat.status === 'livechat' ? 'bg-violet-500/20 text-violet-400' : ''}`}
                  onClick={() => handleStatusChange('livechat')}
                  title={`Ativar ${sdrName} (IA)`}
                >
                  <Bot className="w-5 h-5" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={`text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:text-white ${activeChat.status === 'human' ? 'bg-emerald-500/20 text-emerald-400' : ''}`}
                  onClick={() => handleStatusChange('human')}
                  title="Assumir conversa"
                >
                  <User className="w-5 h-5" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={`text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:text-white ${activeChat.status === 'paused' ? 'bg-amber-500/20 text-amber-400' : ''}`}
                  onClick={() => handleStatusChange('paused')}
                  title="Pausar conversa"
                >
                  <Pause className="w-5 h-5" />
                </Button>
                {/* Transfer button placed next to Pause */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:text-white"
                      title="Transferir conversa"
                    >
                      <TrendingUp className="w-5 h-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72">
                    <div className="flex flex-col py-1">
                      <div className="px-3">
                        <div className="flex gap-1 mb-2">
                          <button
                            onClick={() => setTransferMode('team')}
                            className={`flex-1 px-2 py-1 rounded-md text-sm ${transferMode === 'team' ? 'bg-cyan-600 text-white' : 'bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-200'}`}
                          >
                            Setor
                          </button>
                          <button
                            onClick={() => setTransferMode('agent')}
                            className={`flex-1 px-2 py-1 rounded-md text-sm ${transferMode === 'agent' ? 'bg-cyan-600 text-white' : 'bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-200'}`}
                          >
                            Agente
                          </button>
                        </div>

                        {transferMode === 'team' ? (
                          <>
                            <label className="text-[11px] text-gray-500 dark:text-slate-400 mb-1 block">Transferir para setor</label>
                            <select
                              value={transferTeamId || ''}
                              onChange={(e) => setTransferTeamId(e.target.value || null)}
                              className="w-full border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-200 text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-600 mb-2"
                            >
                              <option value="">Selecionar setor</option>
                              {teamsList.map(i => (
                                <option key={i.id} value={i.id}>{i.name}</option>
                              ))}
                            </select>
                          </>
                        ) : (
                          <>
                            <label className="text-[11px] text-gray-500 dark:text-slate-400 mb-1 block">Transferir para agente</label>
                            <select
                              value={transferAgentId || ''}
                              onChange={(e) => setTransferAgentId(e.target.value || null)}
                              className="w-full border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-200 text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-600 mb-2"
                            >
                              <option value="">Selecionar agente</option>
                              {teamMembers.map((m: any) => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                              ))}
                            </select>
                          </>
                        )}

                        <div className="flex gap-2 mt-2">
                          <button onClick={() => { handleTransfer(activeChat.id, transferTeamId); }} className="w-full px-3 py-2 rounded-md bg-cyan-600 text-gray-900 dark:text-white">Confirmar</button>
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                {/* Close/Reopen conversation button */}
                {activeChat?.isActive ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:text-white"
                    onClick={async () => { if (confirm('Encerrar esta conversa?')) await handleCloseConversation(); }}
                    title="Encerrar conversa"
                  >
                    <XCircle className="w-5 h-5" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:text-white"
                    onClick={async () => { if (confirm('Reabrir esta conversa?')) await handleReopenConversation(); }}
                    title="Reabrir conversa"
                  >
                    <CheckCircle className="w-5 h-5" />
                  </Button>
                )}
                <div className="h-6 w-px bg-gray-200 dark:bg-slate-800 mx-1"></div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={`text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:text-white ${showProfileInfo ? 'bg-gray-200 dark:bg-slate-800 text-cyan-400' : ''}`} 
                  onClick={() => setShowProfileInfo(!showProfileInfo)} 
                  title="Ver Informações"
                >
                  <Info className="w-5 h-5" />
                </Button>
                {/* Conversas Anteriores moved to profile panel */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:text-white"
                      title="Mais opções"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 rounded-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-2 shadow-lg">
                    <div className="px-2 py-1">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-slate-700 dark:text-slate-200" />
                        <div className="text-sm font-semibold text-gray-900 dark:text-slate-100">Transferir</div>
                      </div>

                      <div className="space-y-2">
                        <button
                          onClick={() => { handleStatusChange('livechat'); }}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-md bg-cyan-100 dark:bg-slate-800 text-slate-900 dark:text-white"
                        >
                          <span className="w-7 h-7 rounded-md bg-cyan-200/70 dark:bg-cyan-900/40 flex items-center justify-center">
                            <Bot className="w-4 h-4 text-cyan-700 dark:text-cyan-200" />
                          </span>
                          <span className="text-sm font-medium">Devolver para I.A</span>
                        </button>

                        <div className="border-t border-gray-200 dark:border-slate-800" />

                        <button onClick={() => { toast.success('Marcado como não lida (mock)'); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 text-sm text-gray-700 dark:text-slate-200">
                          <Mail className="w-4 h-4" />
                          Marcar como não lida
                        </button>

                        <button onClick={() => handleEndConversation(activeChat.id)} className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 text-sm text-gray-700 dark:text-slate-200">
                          <XCircle className="w-4 h-4" />
                          Encerrar conversa
                        </button>

                        <button onClick={() => handleArchiveConversation(activeChat.id)} className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 text-sm text-gray-700 dark:text-slate-200">
                          <FileText className="w-4 h-4" />
                          Arquivar conversa
                        </button>

                        <button onClick={() => handleExportConversation(activeChat.id)} className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 text-sm text-gray-700 dark:text-slate-200">
                          <Download className="w-4 h-4" />
                          Exportar conversa
                        </button>
                      </div>

                      <div className="mt-3 border-t border-gray-100 dark:border-slate-800 pt-2">
                        <label className="text-[11px] text-gray-500 dark:text-slate-400 mb-1 block">Transferir para setor</label>
                        <select
                          value={activeChat.assignedTeam || ''}
                          onChange={(e) => handleTransfer(activeChat.id, e.target.value || null)}
                          className="w-full border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-200 text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                        >
                          <option value="">Selecionar setor</option>
                          {teamsList.map(i => (
                            <option key={i.id} value={i.id}>{i.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                
              </div>
            </div>

            {/* IA Mode Banner (show when LiveChat is handling the conversation) */}
            {(activeChat?.status === 'livechat' && !activeChat?.assignedUserId) && (
              <div className="px-6 pb-3">
                <div className="w-full rounded-2xl bg-emerald-50/80 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 p-3 flex items-center justify-between gap-4 shadow-md">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex-shrink-0 p-2 rounded-lg bg-emerald-100/60 dark:bg-emerald-800/40 border border-emerald-200 dark:border-emerald-700">
                      <Bot className="w-5 h-5 text-emerald-600 dark:text-emerald-200" />
                    </div>
                    <div className="truncate">
                      <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-100 truncate">Conversa em modo I.A.</div>
                      <div className="text-xs text-emerald-700 dark:text-emerald-200 truncate">O Assistente Virtual está atendendo automaticamente.</div>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <Button onClick={() => handleStatusChange('human')} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
                      <User className="w-4 h-4" />
                      Assumir Conversa
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar relative z-0">
              {/* Large media preview gallery for selected conversation */}
              {activeChat && (
                (() => {
                  const images = (activeChat.messages || []).filter(m => m.type === MessageType.IMAGE && (m.mediaUrl || m.content));
                  if (!images || images.length === 0) return null;
                  return (
                    <div className="mb-4">
                      <div className="flex gap-3 items-start">
                        {images.slice(0, 4).map((img, idx) => (
                          <img
                            key={img.id}
                            src={img.mediaUrl || img.content}
                            alt={`anexo-${idx}`}
                            className={`rounded-lg object-cover border border-gray-300 dark:border-slate-700 shadow-md cursor-pointer ${idx === 0 ? 'w-72 h-44' : 'w-36 h-24'}`}
                            onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/300x200/1e293b/cbd5e1?text=Erro+Imagem'; }}
                            onClick={() => {
                              const imgs = images.map(m => m.mediaUrl || m.content);
                              openGallery(imgs, idx);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })()
              )}
              {activeChat.messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-slate-500">
                  <MessageSquare className="w-16 h-16 mb-4 opacity-30" />
                  <p className="text-sm">Nenhuma mensagem ainda</p>
                  <p className="text-xs mt-1 opacity-70">Envie uma mensagem para iniciar a conversa</p>
                </div>
              ) : (
                <>
                  <div className="flex justify-center my-6">
                    <span className="px-4 py-1.5 bg-gray-200/80 dark:bg-slate-800/80 border border-gray-300 dark:border-slate-700 text-gray-500 dark:text-slate-400 text-xs font-medium rounded-full shadow-sm backdrop-blur-sm">Hoje</span>
                  </div>

                  {activeChat.messages.map((msg) => {
                    // detect simple system message markers in the content
                    const text = String(msg.content || '');
                    const isInternalNote = text.startsWith('Nota Interna') || text.startsWith('INTERNAL_NOTE:') || text.includes('assumiu a conversa');
                    const isStartAttendance = text.includes('Início do atendimento') || text.startsWith('START_ATTENDANCE:');
                    const isEndAttendance = text.includes('Fim do atendimento') || text.startsWith('END_ATTENDANCE:');

                    if (isInternalNote || isStartAttendance || isEndAttendance) {
                      // render centered system-style block
                      const baseClasses = 'w-full flex justify-center my-2';
                      if (isInternalNote) {
                        return (
                          <div key={msg.id} className={baseClasses}>
                            <div className="max-w-[78%] rounded-2xl border border-amber-300/60 bg-amber-50/80 p-3 shadow-sm text-amber-800 text-sm relative" title="Nota Interna">
                              <div className="absolute -top-3 left-3 inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-amber-100 border border-amber-200 text-amber-700 text-xs font-semibold">
                                <User className="w-3 h-3" />
                                Nota Interna
                              </div>
                              <div className="mt-1 pt-1">{text.replace(/^Nota Interna:?\s*/i, '').replace(/^INTERNAL_NOTE:?\s*/i, '')}</div>
                              <div className="text-[11px] text-amber-700/80 mt-2 flex justify-end">{msg.timestamp}</div>
                            </div>
                          </div>
                        );
                      }

                      if (isStartAttendance) {
                        return (
                          <div key={msg.id} className={baseClasses}>
                            <div className="max-w-[92%] rounded-2xl border border-amber-400 bg-amber-50 p-3 shadow-sm text-amber-800 text-sm flex items-center gap-3">
                              <div className="flex-shrink-0 p-2 rounded-full bg-amber-100 border border-amber-200">
                                <Flag className="w-4 h-4 text-amber-600" />
                              </div>
                              <div className="flex-1">
                                <div className="font-medium">{text.replace(/^Início do atendimento:?\s*/i, '').replace(/^START_ATTENDANCE:?\s*/i, '')}</div>
                                <div className="text-[11px] text-amber-700/80 mt-1">{msg.timestamp}</div>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // end attendance
                      return (
                        <div key={msg.id} className={baseClasses}>
                          <div className="max-w-[92%] rounded-2xl border border-rose-300 bg-rose-50 p-3 shadow-sm text-rose-800 text-sm flex items-center gap-3">
                            <div className="flex-shrink-0 p-2 rounded-full bg-rose-100 border border-rose-200">
                              <X className="w-4 h-4 text-rose-600" />
                            </div>
                            <div className="flex-1">
                              <div className="font-medium">{text.replace(/^Fim do atendimento:?\s*/i, '').replace(/^END_ATTENDANCE:?\s*/i, '')}</div>
                              <div className="text-[11px] text-rose-700/80 mt-1">{msg.timestamp}</div>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    const isOutgoing = msg.direction === MessageDirection.OUTGOING;
                    const isAgentSent = isOutgoing && msg.fromType === 'user';
                    return (
                      <div
                        key={msg.id}
                        onMouseEnter={() => { clearHoverTimeout(); setHoveredMessageId(msg.id); }}
                        onMouseLeave={() => { scheduleHideHover(); }}
                        className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'} group animate-in fade-in slide-in-from-bottom-2 duration-300 relative overflow-visible`}
                      >
                        <div className={`flex flex-col max-w-[75%] ${isOutgoing ? 'items-end' : 'items-start'}`}>
                          <div 
                            className={`px-5 py-3 rounded-2xl shadow-md relative text-sm leading-relaxed ${
                              isOutgoing 
                                  ? msg.fromType === 'livechat'
                                    ? 'bg-gradient-to-br from-violet-600 to-purple-700 text-gray-900 dark:text-white rounded-tr-sm shadow-violet-900/20'
                                    : isAgentSent
                                      ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-tr-sm shadow-emerald-900/20'
                                      : 'bg-gradient-to-br from-primary to-accent text-white rounded-tr-sm shadow-[0_6px_18px_rgba(30,95,116,0.12)]'
                                  : 'bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-slate-200 rounded-tl-sm border border-gray-300/50 dark:border-slate-700/50'
                            }`}
                          >
                            {renderMessageContent(msg)}

                            <div className={`absolute top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-30 ${isOutgoing ? 'left-[-36px]' : 'right-[-36px]'}`}> 
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="w-9 h-9 rounded-full bg-slate-800/30 hover:bg-slate-800/50 flex items-center justify-center text-slate-200">
                                    <MoreVertical className="w-4 h-4" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-56 p-1">
                                  <div className="flex flex-col">
                                    <button onClick={() => handleReplyTo(msg)} className="w-full flex items-center text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-800 rounded"><CornerUpLeft className="w-4 h-4 mr-3" />Responder</button>
                                    {activeChat.isGroup && (
                                      <>
                                        <button onClick={() => { toast('Responder em particular (a implementar)'); }} className="w-full flex items-center text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-800 rounded"><AtSign className="w-4 h-4 mr-3" />Responder em particular</button>
                                        <button onClick={() => { toast('Conversar com mkt (a implementar)'); }} className="w-full flex items-center text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-800 rounded"><Share2 className="w-4 h-4 mr-3" />Conversar com mkt</button>
                                      </>
                                    )}
                                    {isOutgoing && (
                                      <button onClick={() => {
                                        setEditingModalId(msg.id);
                                        setEditingModalDraft(msg.content || '');
                                        setTimeout(() => editingModalRef.current?.focus(), 120);
                                      }} className="w-full flex items-center text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-800 rounded"><Pencil className="w-4 h-4 mr-3" />Editar</button>
                                    )}
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <button className="w-full flex items-center text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-800 rounded"><Share2 className="w-4 h-4 mr-3" />Encaminhar</button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-56 p-1">
                                        <div className="flex flex-col max-h-48 overflow-auto">
                                          {teamMembers.length === 0 && (
                                            <div className="px-3 py-2 text-sm text-gray-500">Nenhum agente disponível</div>
                                          )}
                                          {teamMembers.map(tm => (
                                            <button key={tm.id} onClick={async () => { await handleAssign(activeChat.id, tm.id); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-800 rounded">{tm.name || tm.email || tm.id}</button>
                                          ))}
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                    <div className="my-1 border-t" />
                                    <div className="flex items-center gap-2 px-2 py-1">
                                      <button onClick={() => sendReaction('👍')} className="p-1 rounded-full hover:bg-gray-100">👍</button>
                                      <button onClick={() => sendReaction('❤️')} className="p-1 rounded-full hover:bg-gray-100">❤️</button>
                                      <button onClick={() => sendReaction('😂')} className="p-1 rounded-full hover:bg-gray-100">😂</button>
                                      <button onClick={() => sendReaction('😮')} className="p-1 rounded-full hover:bg-gray-100">😮</button>
                                    </div>
                                    <div className="my-1 border-t" />
                                    <button onClick={() => handleCopyMessage(msg)} className="w-full flex items-center text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-800 rounded"><Copy className="w-4 h-4 mr-3" />Copiar</button>
                                    <button onClick={() => { toast('Fixar (a implementar)'); }} className="w-full flex items-center text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-800 rounded"><Pin className="w-4 h-4 mr-3" />Fixar</button>
                                    <button onClick={() => { toast('Favoritar (a implementar)'); }} className="w-full flex items-center text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-800 rounded"><Star className="w-4 h-4 mr-3" />Favoritar</button>
                                    <div className="my-1 border-t" />
                                    <button onClick={() => { toast('Denunciar (a implementar)'); }} className="w-full flex items-center text-left px-3 py-2 text-sm text-rose-500 hover:bg-gray-100 dark:hover:bg-slate-800 rounded"><Flag className="w-4 h-4 mr-3" />Denunciar</button>
                                    <button onClick={() => { toast('Apagar (a implementar)'); }} className="w-full flex items-center text-left px-3 py-2 text-sm text-rose-500 hover:bg-gray-100 dark:hover:bg-slate-800 rounded"><Trash2 className="w-4 h-4 mr-3" />Apagar</button>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>
                          
                          <div className="flex items-center mt-1.5 gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity px-1">
                            {isOutgoing && msg.fromType === 'livechat' && (
                              <Bot className="w-3 h-3 text-violet-400" />
                            )}
                            {isOutgoing && msg.fromType === 'user' && (
                              <User className="w-3 h-3 text-emerald-400" />
                            )}
                            {/* Presence indicator for incoming messages */}
                            {!isOutgoing && (activeChat as any).contactPresence && (
                              <span 
                                className={`inline-block w-1.5 h-1.5 rounded-full ${getPresenceDotColor((activeChat as any).contactPresence, activeChat.contact_id)}`}
                                title={getPresenceLabel((activeChat as any).contactPresence, activeChat.contact_id)}
                              ></span>
                            )}
                            <span className="text-[10px] text-gray-500 dark:text-slate-500 font-medium">{msg.timestamp}</span>
                            {isOutgoing && (
                              msg.status === 'read' ? <CheckCheck className={`w-3.5 h-3.5 ${isAgentSent ? 'text-emerald-500' : 'text-cyan-500'}`} /> : 
                              msg.status === 'delivered' ? <CheckCheck className="w-3.5 h-3.5 text-gray-500 dark:text-slate-500" /> :
                              <Check className="w-3.5 h-3.5 text-gray-500 dark:text-slate-500" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
              <div ref={messagesEndRef} />
              
            </div>

            {/* Gallery Sidebar */}
            <Sheet open={isGalleryOpen} onOpenChange={(o) => { if (!o) closeGallery(); }}>
              <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto p-0">
                <div className="relative bg-gray-100 dark:bg-slate-900 rounded-lg p-4 border border-gray-200 dark:border-slate-800">
                  <div className="absolute right-3 top-3 flex items-center gap-2">
                    <button onClick={closeGallery} className="text-gray-600 dark:text-slate-300 p-2 rounded hover:bg-gray-200 dark:bg-slate-800">Fechar</button>
                    {galleryImages.length > 0 && (
                      <a href={galleryImages[galleryIndex]} download target="_blank" rel="noreferrer" className="text-gray-600 dark:text-slate-300 p-2 rounded hover:bg-gray-200 dark:bg-slate-800" title="Baixar imagem">
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                    <button onClick={() => resetGalleryTransform()} className="text-gray-600 dark:text-slate-300 p-2 rounded hover:bg-gray-200 dark:bg-slate-800" title="Resetar zoom">
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <button onClick={() => setGalleryZoom(z => clamp(z * 1.25, 1, 4))} className="text-gray-600 dark:text-slate-300 p-2 rounded hover:bg-gray-200 dark:bg-slate-800" title="Aumentar zoom">
                      <ZoomIn className="w-4 h-4" />
                    </button>
                  </div>
                  {galleryImages.length > 0 && (
                    <div className="flex items-center justify-center">
                      <button onClick={showPrevGallery} className="p-2 mr-3 text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:text-white">‹</button>
                      <div
                        ref={galleryImgWrapperRef}
                        onWheel={onGalleryWheel}
                        onMouseDown={onGalleryMouseDown}
                        onMouseMove={onGalleryMouseMove}
                        onMouseUp={onGalleryMouseUp}
                        onMouseLeave={onGalleryMouseUp}
                        onDoubleClick={onGalleryDoubleClick}
                        onTouchStart={onGalleryTouchStart}
                        onTouchMove={onGalleryTouchMove}
                        onTouchEnd={onGalleryTouchEnd}
                        className="max-h-[70vh] max-w-[90%] flex items-center justify-center overflow-hidden rounded-md"
                        style={{ cursor: galleryZoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'auto' }}
                      >
                        <img
                          src={galleryImages[galleryIndex]}
                          alt={`gallery-${galleryIndex}`}
                          className="object-contain"
                          style={{
                            transform: `translate(${galleryPan.x}px, ${galleryPan.y}px) scale(${galleryZoom})`,
                            transition: isPanning ? 'none' : 'transform 160ms ease-out',
                            maxHeight: '70vh',
                            maxWidth: '90%'
                          }}
                          onError={(e) => {(e.target as HTMLImageElement).src = 'https://placehold.co/800x600/1e293b/cbd5e1?text=Erro+Imagem'}}
                          draggable={false}
                        />
                      </div>
                      <button onClick={showNextGallery} className="p-2 ml-3 text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:text-white">›</button>
                    </div>
                  )}
                  {galleryImages.length > 1 && (
                    <div className="mt-3 text-center text-gray-500 dark:text-slate-400 text-sm">{galleryIndex + 1} / {galleryImages.length}</div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
            {/* Ticket detail sheet */}
            <Sheet open={isTicketDetailOpen} onOpenChange={(o) => { setIsTicketDetailOpen(Boolean(o)); if (!o) setTicketDetail(null); }}>
              <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
                <div className="relative rounded-lg p-4 card-surface">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold">Detalhes do Chamado</h3>
                    <button onClick={() => setIsTicketDetailOpen(false)} className="text-gray-600 dark:text-slate-300 p-2 rounded hover:bg-gray-200 dark:bg-slate-800">Fechar</button>
                  </div>
                  {ticketDetail ? (
                    <div className="space-y-4">
                      <div className="p-3 rounded-md border bg-amber-50 border-amber-200">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-amber-100 border border-amber-200"><Flag className="w-5 h-5 text-amber-700" /></div>
                          <div className="flex-1">
                            <div className="font-bold text-lg">{ticketDetail.title}</div>
                            <div className="text-xs text-amber-700/80">Aberto em {new Date(ticketDetail.createdAt).toLocaleString()}</div>
                          </div>
                          <div className={`text-sm font-semibold ${ticketDetail.status === 'open' ? 'text-amber-700' : 'text-rose-600'}`}>{ticketDetail.status}</div>
                        </div>
                        {ticketDetail.description && <div className="mt-3 text-sm text-amber-800">{ticketDetail.description}</div>}
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold mb-2">Conversas relacionadas</h4>
                        {(() => {
                          const conv = conversations.find(c => c.id === ticketDetail.conversationId);
                          if (!conv) return <div className="text-sm text-gray-500">Não foi encontrada a conversa relacionada.</div>;
                          return (
                            <div className="space-y-2">
                              {conv.messages.slice(-5).reverse().map(m => (
                                <div key={m.id} className="p-2 rounded-md bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-sm">
                                  <div className="text-xs text-gray-500">{m.timestamp} • {m.direction === MessageDirection.OUTGOING ? 'Você' : 'Cliente'}</div>
                                  <div className="mt-1">{m.type === MessageType.IMAGE ? '📷 Foto' : m.type === MessageType.AUDIO ? '📢 Áudio' : m.content}</div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>

                      <div className="flex justify-end gap-2">
                        <button onClick={() => { setIsTicketDetailOpen(false); }} className="px-4 py-2 rounded-md border">Fechar</button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">Nenhum chamado selecionado</div>
                  )}
                </div>
              </SheetContent>
            </Sheet>

            {/* Previous Conversations Sheet */}
            <Sheet open={isPrevConvsOpen} onOpenChange={(o) => { setIsPrevConvsOpen(Boolean(o)); }}>
              <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0">
                <div className="relative rounded-lg p-4 card-surface">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold">Conversas Anteriores</h3>
                    <button onClick={() => setIsPrevConvsOpen(false)} className="text-gray-600 dark:text-slate-300 p-2 rounded hover:bg-gray-200 dark:bg-slate-800">Fechar</button>
                  </div>
                  <div className="space-y-2">
                    {(() => {
                      if (!activeChat) return <div className="text-sm text-gray-500">Selecione uma conversa</div>;
                      const prev = conversations.filter(c => c.contactId === activeChat.contactId && c.id !== activeChat.id).slice().sort((a,b) => (a.lastMessageTime > b.lastMessageTime ? -1 : 1));
                      // map tickets by conversationId for quick lookup
                      const ticketsByConv: Record<string, any[]> = {};
                      prevTickets.forEach(t => { if (!ticketsByConv[t.conversationId]) ticketsByConv[t.conversationId] = []; ticketsByConv[t.conversationId].push(t); });
                      if (!prev || prev.length === 0) return <div className="text-sm text-gray-500">Nenhuma conversa anterior encontrada</div>;
                      return prev.map(conv => {
                        const convTickets = ticketsByConv[conv.id] || [];
                        const previews = (conv.messages || []).slice(-3);
                        return (
                          <button key={conv.id} onClick={() => { setSelectedChatId(conv.id); setIsPrevConvsOpen(false); }} className="w-full text-left px-3 py-3 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 flex items-start gap-3">
                            <img src={conv.contactAvatar} alt={conv.contactName} className="w-10 h-10 rounded-md object-cover" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <div className="font-medium truncate">{getDisplayName(conv)}</div>
                                <div className="text-xs text-gray-500">{conv.lastMessageTime}</div>
                              </div>

                              {/* If there's a ticket for this conversation, show a ticket-like badge */}
                              {convTickets.length > 0 && (
                                <div className="mt-2 p-2 rounded-md border border-amber-300 bg-amber-50 text-amber-800 text-sm">
                                  <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 p-2 rounded-full bg-amber-100 border border-amber-200">
                                      <Flag className="w-4 h-4 text-amber-700" />
                                    </div>
                                    <div className="flex-1">
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="font-semibold truncate">{convTickets[0].title || `Chamado ${convTickets[0].id}`}</div>
                                        <div className={`text-xs font-medium ${convTickets[0].status === 'open' ? 'text-amber-700' : 'text-rose-600'}`}>{convTickets[0].status}</div>
                                      </div>
                                      <div className="text-xs text-amber-700/80 mt-1">Aberto em: {new Date(convTickets[0].createdAt).toLocaleString()}</div>
                                      {expandedTickets[conv.id] && convTickets[0].description && (
                                        <div className="mt-2 text-xs text-amber-800/90">{convTickets[0].description}</div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="mt-3 flex items-center gap-2 justify-end">
                                    <button onClick={(e) => { e.stopPropagation(); setExpandedTickets(prev => ({ ...prev, [conv.id]: !prev[conv.id] })); }} className="px-3 py-1 rounded-md text-sm bg-white/60 hover:bg-white/80 dark:bg-slate-800/40">{expandedTickets[conv.id] ? 'Fechar' : 'Expandir'}</button>
                                    <button onClick={(e) => { e.stopPropagation(); setTicketDetail(convTickets[0]); setIsTicketDetailOpen(true); }} className="px-3 py-1 rounded-md text-sm bg-amber-600 text-white hover:bg-amber-500">Ver Chamado</button>
                                  </div>
                                </div>
                              )}

                              <div className="text-sm text-gray-600 dark:text-slate-300 truncate mt-1">{conv.lastMessage || '—'}</div>
                              {previews.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {previews.map(m => (
                                    <div key={m.id} className="text-xs text-gray-500 truncate flex items-center gap-2">
                                      <span className="text-[11px] text-gray-400 flex-shrink-0">{m.direction === MessageDirection.OUTGOING ? 'Você:' : ''}</span>
                                      <span className="truncate">{m.type === MessageType.IMAGE ? '📷 Foto' : m.type === MessageType.AUDIO ? '📢 Áudio' : (m.content || '')}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      });
                    })()}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            

            {/* Input Area */}
            {/* AI suggestion chips (above input) */}
            {activeChat && (
              <div className="px-4 pt-3 pb-1 bg-white/90 dark:bg-slate-900/90 border-t border-gray-200 dark:border-slate-800 backdrop-blur-sm z-10">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300 font-medium">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span>Sugestões IA</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      title="Atualizar sugestões"
                      onClick={async () => {
                        setRefreshingSuggestions(true);
                        // simple shuffle
                        setSuggestions(s => {
                          const copy = [...s];
                          for (let i = copy.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [copy[i], copy[j]] = [copy[j], copy[i]];
                          }
                          return copy;
                        });
                        await new Promise(r => setTimeout(r, 600));
                        setRefreshingSuggestions(false);
                      }}
                      className={`p-1 rounded-md text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:text-white hover:bg-gray-200/40 dark:bg-slate-800/40 transition-colors ${refreshingSuggestions ? 'animate-spin' : ''}`}>
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button title={showSuggestions ? 'Ocultar' : 'Mostrar'} onClick={() => setShowSuggestions(s => !s)} className="p-1 rounded-md text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:text-white hover:bg-gray-200/40 dark:bg-slate-800/40 transition-colors">
                      <ChevronDown className={`w-4 h-4 transition-transform ${showSuggestions ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>

                {showSuggestions && (
                  <div className="flex gap-3 items-start">
                    <div className="flex gap-3 w-full overflow-x-auto py-2">
                      {suggestions.map((sug, idx) => (
                        <button
                          key={idx}
                          onClick={() => { setInputText(sug.text); setTimeout(() => inputRef.current?.focus(), 50); }}
                          className="flex-shrink-0 relative max-w-[18.5rem] p-2.5 rounded-lg bg-slate-50/3 border hover:shadow-md transition-all"
                          style={{ borderColor: `var(--tw-color-${sug.color}-400, rgba(99,102,241,0.5))` }}
                        >
                          <div className={`absolute -top-3 left-3 text-[10px] px-2 py-0.5 rounded-full text-gray-900 dark:text-white font-medium`} style={{ backgroundColor: `var(--tw-color-${sug.color}-500, #60a5fa)` }}>
                            {sug.tone}
                          </div>
                          <div className="text-sm text-gray-700 dark:text-slate-200 truncate mt-0.5 text-[13px] leading-tight">{sug.text}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="p-4 bg-white/90 dark:bg-slate-900/90 border-t border-gray-200 dark:border-slate-800 backdrop-blur-sm z-10 relative">
              {/* WhatsApp-style attachment grid */}
              {showAttachGrid && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowAttachGrid(false)} />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-40 animate-in fade-in slide-in-from-bottom-4 duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 p-4">
                      <div className="grid grid-cols-3 gap-4 min-w-[240px]">
                        {[
                          { type: 'document' as const, icon: File, label: 'Documento', bg: 'bg-indigo-500', hover: 'hover:bg-indigo-600' },
                          { type: 'image' as const, icon: Image, label: 'Imagem', bg: 'bg-violet-500', hover: 'hover:bg-violet-600' },
                          { type: 'sticker' as const, icon: Sticker, label: 'Sticker', bg: 'bg-teal-500', hover: 'hover:bg-teal-600' },
                          { type: 'video' as const, icon: Video, label: 'Vídeo', bg: 'bg-rose-500', hover: 'hover:bg-rose-600' },
                          { type: 'audio' as const, icon: Music, label: 'Áudio', bg: 'bg-orange-500', hover: 'hover:bg-orange-600' },
                        ].map(item => (
                          <button
                            key={item.type}
                            type="button"
                            onClick={() => handleAttachGridSelect(item.type)}
                            className="flex flex-col items-center gap-2 group"
                          >
                            <div className={`w-14 h-14 rounded-full ${item.bg} ${item.hover} flex items-center justify-center shadow-lg transition-all duration-150 group-hover:scale-110 group-active:scale-95`}>
                              <item.icon className="w-6 h-6 text-white" />
                            </div>
                            <span className="text-xs text-gray-600 dark:text-slate-300 font-medium">{item.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
              {/* attachments preview above input */}
              {attachments.length > 0 && (
                <div className="flex items-center gap-2 px-3 pb-2 max-w-4xl mx-auto">
                  {attachments.map(a => (
                    <div key={a.id} className="w-12 h-12 rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700 bg-black/10 relative flex items-center justify-center flex-shrink-0">
                      {a.type && a.type.startsWith('image/') ? (
                        <img onClick={() => openAttachmentPreview(a as any)} src={a.dataUrl} alt={a.name} className="w-full h-full object-cover cursor-pointer" />
                      ) : a.type && a.type.startsWith('video/') ? (
                        <button onClick={() => openAttachmentPreview(a as any)} className="w-full h-full flex items-center justify-center cursor-pointer">
                          <Play className="w-5 h-5 text-white/90" />
                        </button>
                      ) : a.type && a.type.startsWith('audio/') ? (
                        <button onClick={() => openAttachmentPreview(a as any)} className="w-full h-full flex items-center justify-center cursor-pointer">
                          <Play className="w-5 h-5 text-white/90" />
                        </button>
                      ) : (
                        <div onClick={() => openAttachmentPreview(a as any)} className="w-full h-full flex flex-col items-center justify-center text-xs text-gray-700 dark:text-slate-200 cursor-pointer px-1 text-center">
                          <FileText className="w-4 h-4 mb-0.5" />
                          <div className="truncate max-w-[40px] text-[9px]">{a.name}</div>
                        </div>
                      )}
                      <button onClick={() => removeAttachment(a.id)} className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full shadow">×</button>
                    </div>
                  ))}
                </div>
              )}
              <form onSubmit={handleSendMessage} className="flex items-end gap-3 max-w-4xl mx-auto">
                {/* left-side action buttons removed as requested */}
                
                <div
                  ref={inputWrapperRef}
                  className="relative flex-1 bg-white dark:bg-slate-950 rounded-2xl border border-gray-200 dark:border-slate-800 focus-within:ring-2 focus-within:ring-ring/30 focus-within:border-primary/50 transition-all shadow-inner"
                  style={isInputLifted ? { transform: 'translateY(-8px)', transition: 'transform 0.12s' } : { transition: 'transform 0.12s' }}
                >
                  <textarea
                    value={inputText}
                    ref={inputRef}
                    onPaste={handlePaste}
                    onChange={(e) => { setInputText(e.target.value); setInputActive(e.target.value.trim().length > 0); setTimeout(adjustInputLayout, 0); }}
                    onFocus={() => setInputActive(true)}
                    onBlur={() => { if (!inputText.trim()) setInputActive(false); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={activeChat.status === 'livechat' ? `${sdrName} está respondendo automaticamente...` : 'Digite sua mensagem...'}
                    style={dynamicPaddingRight != null ? { paddingRight: `${dynamicPaddingRight}px` } : undefined}
                    className={`w-full bg-transparent border-none p-3.5 max-h-32 min-h-[48px] text-sm ${inputActive ? 'text-white' : 'text-gray-700 dark:text-slate-200'} focus:ring-0 resize-none outline-none placeholder:text-gray-400 dark:placeholder:text-slate-600`}
                    rows={1}
                  />

                  <input ref={fileInputRef} type="file" multiple onChange={handleFileInput} accept="image/*,video/*,audio/*,application/*" className="hidden" />
                  <input ref={imageInputRef} type="file" multiple onChange={handleFileInput} accept="image/*" className="hidden" />
                  <input ref={videoInputRef} type="file" multiple onChange={handleFileInput} accept="video/*" className="hidden" />
                  <input ref={audioInputRef} type="file" multiple onChange={handleFileInput} accept="audio/*" className="hidden" />
                  <input ref={stickerInputRef} type="file" onChange={handleFileInput} accept="image/png,image/webp" className="hidden" />
                  <input ref={docInputRef} type="file" multiple onChange={handleFileInput} accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar" className="hidden" />

                  

                  {/* Icons behavior:
                      - If LiveChat is handling the conversation: hide all icon options.
                      - If user is typing: show full set of icons.
                      - Otherwise (not typing): show compact/condensed icons.
                  */}
                    {activeChat?.status === 'livechat' ? null : (
                      inputText.trim().length > 0 ? (
                        <div ref={iconsRef} style={iconsRightPx != null ? { right: `${iconsRightPx}px` } : undefined} className="absolute inset-y-0 right-0 flex items-center gap-0 z-10 pr-3">
                          <button type="button" title="Emoji" className={iconBtnClass}>
                            <Smile className="w-4 h-4" />
                          </button>
                          <button type="button" title="Atalho" className={iconBtnClass}>
                            <Zap className="w-4 h-4" />
                          </button>
                          <button type="button" title="Anexar" onClick={handleAttachClick} className={iconBtnClass}>
                            <Paperclip className="w-4 h-4" />
                          </button>
                          <Popover>
                            <PopoverTrigger asChild>
                              <button type="button" title="Sugestões" className={iconBtnClass}>
                                <Sparkles className="w-4 h-4" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-0 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg">
                              <div className="flex flex-col py-1">
                                <button onClick={() => handleSuggestionMenuAction('Expandir')} className="flex items-center gap-3 px-4 py-3 text-sm text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800">
                                  <ZoomIn className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                                  <span>Expandir</span>
                                </button>
                                <button onClick={() => handleSuggestionMenuAction('Reformular')} className="flex items-center gap-3 px-4 py-3 text-sm text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800">
                                  <RefreshCw className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                                  <span>Reformular</span>
                                </button>
                                <div className="border-t border-gray-100 dark:border-slate-800 my-1" />
                                <button onClick={() => handleSuggestionMenuAction('Meu tom de voz')} className="flex items-center gap-3 px-4 py-3 text-sm text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800">
                                  <User className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                                  <span>Meu tom de voz</span>
                                </button>
                                <button onClick={() => handleSuggestionMenuAction('Mais amigável')} className="flex items-center gap-3 px-4 py-3 text-sm text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800">
                                  <Smile className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                                  <span>Mais amigável</span>
                                </button>
                                <button onClick={() => handleSuggestionMenuAction('Mais formal')} className="flex items-center gap-3 px-4 py-3 text-sm text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800">
                                  <TrendingUp className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                                  <span>Mais formal</span>
                                </button>
                                <button onClick={() => handleSuggestionMenuAction('Corrigir gramática')} className="flex items-center gap-3 px-4 py-3 text-sm text-slate-800 dark:text-slate-200 bg-sky-100/80 dark:bg-sky-900/50 rounded-md">
                                  <CheckCircle className="w-4 h-4 text-sky-600" />
                                  <span>Corrigir gramática</span>
                                </button>
                                <div className="border-t border-gray-100 dark:border-slate-800 my-1" />
                                <button onClick={() => handleSuggestionMenuAction('Traduzir')} className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800">
                                  <div className="flex items-center gap-3">
                                    <FileText className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                                    <span>Traduzir para...</span>
                                  </div>
                                  <ChevronRight className="w-4 h-4 text-slate-400" />
                                </button>
                              </div>
                            </PopoverContent>
                          </Popover>
                          <button type="button" title="Documento" onClick={() => docInputRef.current?.click()} className={iconBtnClass}>
                            <FileText className="w-4 h-4" />
                          </button>
                          <button type="button" title={isRecordingAudio ? 'Parar gravação' : 'Microfone'} onClick={handleMicClick} className={`${iconBtnClass} ${isRecordingAudio ? '!bg-red-500/70 animate-pulse' : ''}`}>
                            {isRecordingAudio ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                          </button>
                          {isRecordingAudio && (
                            <>
                              <span className="text-xs text-red-400 ml-1 tabular-nums">{Math.floor(recordingTime / 60).toString().padStart(2,'0')}:{(recordingTime % 60).toString().padStart(2,'0')}</span>
                              <button type="button" title="Cancelar gravação" onClick={cancelRecording} className={`${iconBtnClass} !bg-slate-600/50`}>
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          
                        </div>
                      ) : (
                        <div ref={iconsRef} style={iconsRightPx != null ? { right: `${iconsRightPx}px` } : undefined} className="absolute inset-y-0 right-0 flex items-center gap-0 z-10 pr-3">
                          <button type="button" title="Emoji" className={iconBtnClass}>
                            <Smile className="w-4 h-4" />
                          </button>
                          <button type="button" title="Atalho" className={iconBtnClass}>
                            <Zap className="w-4 h-4" />
                          </button>
                          <button type="button" title="Anexar" onClick={handleAttachClick} className={iconBtnClass}>
                            <Paperclip className="w-4 h-4" />
                          </button>
                          <Popover>
                            <PopoverTrigger asChild>
                              <button type="button" title="Sugestões" className={iconBtnClass}>
                                <Sparkles className="w-4 h-4" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-0 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg">
                              <div className="flex flex-col py-1">
                                <button onClick={() => handleSuggestionMenuAction('Expandir')} className="flex items-center gap-3 px-4 py-3 text-sm text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800">
                                  <ZoomIn className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                                  <span>Expandir</span>
                                </button>
                                <button onClick={() => handleSuggestionMenuAction('Reformular')} className="flex items-center gap-3 px-4 py-3 text-sm text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800">
                                  <RefreshCw className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                                  <span>Reformular</span>
                                </button>
                                <div className="border-t border-gray-100 dark:border-slate-800 my-1" />
                                <button onClick={() => handleSuggestionMenuAction('Meu tom de voz')} className="flex items-center gap-3 px-4 py-3 text-sm text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800">
                                  <User className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                                  <span>Meu tom de voz</span>
                                </button>
                                <button onClick={() => handleSuggestionMenuAction('Mais amigável')} className="flex items-center gap-3 px-4 py-3 text-sm text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800">
                                  <Smile className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                                  <span>Mais amigável</span>
                                </button>
                                <button onClick={() => handleSuggestionMenuAction('Mais formal')} className="flex items-center gap-3 px-4 py-3 text-sm text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800">
                                  <TrendingUp className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                                  <span>Mais formal</span>
                                </button>
                                <button onClick={() => handleSuggestionMenuAction('Corrigir gramática')} className="flex items-center gap-3 px-4 py-3 text-sm text-slate-800 dark:text-slate-200 bg-sky-100/80 dark:bg-sky-900/50 rounded-md">
                                  <CheckCircle className="w-4 h-4 text-sky-600" />
                                  <span>Corrigir gramática</span>
                                </button>
                                <div className="border-t border-gray-100 dark:border-slate-800 my-1" />
                                <button onClick={() => handleSuggestionMenuAction('Traduzir')} className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800">
                                  <div className="flex items-center gap-3">
                                    <FileText className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                                    <span>Traduzir para...</span>
                                  </div>
                                  <ChevronRight className="w-4 h-4 text-slate-400" />
                                </button>
                              </div>
                            </PopoverContent>
                          </Popover>
                          <button type="button" title="Documento" onClick={() => docInputRef.current?.click()} className={iconBtnClass}>
                            <FileText className="w-4 h-4" />
                          </button>
                          <button type="button" title={isRecordingAudio ? 'Parar gravação' : 'Microfone'} onClick={handleMicClick} className={`${iconBtnClass} ${isRecordingAudio ? '!bg-red-500/70 animate-pulse' : ''}`}>
                            {isRecordingAudio ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                          </button>
                          {isRecordingAudio && (
                            <>
                              <span className="text-xs text-red-400 ml-1 tabular-nums">{Math.floor(recordingTime / 60).toString().padStart(2,'0')}:{(recordingTime % 60).toString().padStart(2,'0')}</span>
                              <button type="button" title="Cancelar gravação" onClick={cancelRecording} className={`${iconBtnClass} !bg-slate-600/50`}>
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          
                        </div>
                      )
                    )}

                  <Button
                    type="submit"
                    ref={sendBtnRef}
                    disabled={!inputText.trim() && attachments.length === 0}
                    className={`absolute right-3 top-1/2 transform -translate-y-1/2 rounded-full w-12 h-12 p-0 transition-transform flex items-center justify-center z-20 ${
                      (inputText.trim() || attachments.length > 0)
                        ? 'bg-gradient-to-br from-cyan-500 to-emerald-400 text-white shadow-xl hover:scale-105 active:scale-95 ring-1 ring-white/10'
                        : 'bg-gray-200 text-gray-400 opacity-60 cursor-not-allowed'
                    }`}>
                    <Send className="w-5 h-5" />
                  </Button>
                </div>
              </form>
              {editingModalId && activeChat && (() => {
                const msg = activeChat.messages.find(m => m.id === editingModalId);
                if (!msg) return null;
                const history = Array.isArray(msg.edits) ? [...msg.edits] : [];
                // include current content as latest item (preview)
                history.push({ content: msg.content, edited_at: msg.edited_at || msg.created_at || new Date().toISOString() });

                const saveEdit = async () => {
                  try {
                    await api.updateMessage(editingModalId, editingModalDraft);
                    setEditingModalId(null);
                    setEditingModalDraft('');
                    if (refetch) await refetch();
                    toast.success('Mensagem editada');
                  } catch (err) {
                    console.error('edit failed', err);
                    toast.error('Falha ao editar mensagem');
                  }
                };

                return (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-2xl rounded-lg shadow-lg overflow-hidden card-surface">
                      <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Pencil className="w-5 h-5" />
                          <h3 className="font-semibold">Editar mensagem</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => { setEditingModalId(null); setEditingModalDraft(''); }} className="px-3 py-1 rounded bg-gray-200 dark:bg-slate-800">Cancelar</button>
                          <button onClick={saveEdit} className="px-3 py-1 rounded bg-cyan-600 text-white">Salvar</button>
                        </div>
                      </div>
                      <div className="p-4 grid grid-cols-3 gap-4">
                        <div className="col-span-2">
                          <textarea ref={editingModalRef} value={editingModalDraft} onChange={(e) => setEditingModalDraft(e.target.value)} rows={8} className="w-full p-3 theme-input rounded text-sm" />
                        </div>
                        <div className="col-span-1 max-h-72 overflow-auto border-l border-gray-100 dark:border-slate-800 pl-3">
                          <h4 className="text-sm font-semibold mb-2">Histórico de edição</h4>
                          {history.slice().reverse().map((h: any, i: number) => (
                            <div key={i} className="mb-3 text-sm">
                              <div className="text-xs text-gray-500">{new Date(h.edited_at).toLocaleString()}</div>
                              <div className="mt-1 p-2 card-surface rounded text-sm">{h.content}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
              {showAttachPopup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                  <div className="rounded-lg p-4 w-[420px] max-w-full card-surface">
                    <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">Anexar imagem colada</h3>
                    {pastedPreview && (<div className="mb-3"><img src={pastedPreview} alt="pasted" className="w-full rounded" /></div>)}
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setShowAttachPopup(false); setPastedPreview(null); }} className="px-3 py-2 rounded bg-gray-200 dark:bg-slate-800">Cancelar</button>
                      <button onClick={() => confirmAttach()} className="px-3 py-2 rounded bg-cyan-600 text-white">Anexar</button>
                    </div>
                  </div>
                </div>
              )}
              {/* Attachment preview modals */}
              {previewAudioUrl && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                  <div className="rounded-lg p-4 w-[420px] max-w-full card-surface">
                    <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">Pré-visualizar áudio</h3>
                    <div className="mb-3">
                      <audio ref={previewAudioRef} controls src={previewAudioUrl} className="w-full" />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setPreviewAudioUrl(null)} className="px-3 py-2 rounded bg-gray-200 dark:bg-slate-800">Fechar</button>
                    </div>
                  </div>
                </div>
              )}

              {previewVideoUrl && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                  <div className="rounded-lg p-4 w-[80%] max-w-4xl card-surface">
                    <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">Pré-visualizar vídeo</h3>
                    <div className="mb-3">
                      <video ref={previewVideoRef} controls src={previewVideoUrl} className="w-full max-h-[70vh]" />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setPreviewVideoUrl(null)} className="px-3 py-2 rounded bg-gray-200 dark:bg-slate-800">Fechar</button>
                    </div>
                  </div>
                </div>
              )}

              {previewDoc && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                  <div className="rounded-lg p-4 w-[420px] max-w-full card-surface">
                    <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">Pré-visualizar documento</h3>
                    <div className="mb-3">
                      <p className="text-sm truncate">{previewDoc.name || 'Documento'}</p>
                      <a href={previewDoc.url} target="_blank" rel="noreferrer" className="text-cyan-600 mt-2 inline-block">Abrir / Baixar</a>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setPreviewDoc(null)} className="px-3 py-2 rounded bg-gray-200 dark:bg-slate-800">Fechar</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            {/* Mobile FAB (new chat / focus search) */}
            <button
              onClick={handleMobileCompose}
              className="md:hidden fixed right-4 bottom-20 z-50 bg-cyan-600 hover:bg-cyan-500 text-gray-900 dark:text-white w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
              aria-label="Nova conversa"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Right Profile Sidebar (CRM View) */}
          {/* Mobile modal for profile (full-screen on small screens) */}
          {showProfileInfo && (
            <div className="fixed inset-0 z-50 md:hidden bg-white/95 dark:bg-slate-950/95 p-4 overflow-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Informações do Lead</h3>
                <button onClick={() => setShowProfileInfo(false)} className="p-2 rounded-md text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:text-white bg-gray-100 dark:bg-slate-900">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="bg-gray-100/80 dark:bg-slate-900/80 rounded-lg p-4">
                <div className="flex flex-col items-center text-center">
                  <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-cyan-500 to-teal-600 shadow-xl mb-4">
                        <img src={getAvatarUrl(activeChat)} alt={getDisplayName(activeChat)} className="w-full h-full rounded-full object-cover border-2 border-gray-200 dark:border-slate-900" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{activeChat.contactName}</h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">{activeChat.clientMemory?.lead_profile?.lead_stage ?? ''}</p>
                </div>
                <div className="mt-4">
                  <div className="flex items-center gap-3 text-sm mb-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 text-gray-500 dark:text-slate-400">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500 dark:text-slate-500">Telefone</span>
                      <span className="text-gray-700 dark:text-slate-200 font-medium">{activeChat.contactPhone}</span>
                    </div>
                  </div>
                  <button onClick={() => setIsButtonDialogOpen(true)} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-gray-900 dark:text-white text-sm font-medium transition-colors">Enviar Botões</button>
                </div>
              </div>
            </div>
          )}

          <div 
            className={`${showProfileInfo ? 'w-80 border-l border-gray-200 dark:border-slate-800 opacity-100' : 'w-0 opacity-0 border-none'} transition-all duration-300 ease-in-out bg-white/95 dark:bg-slate-900/95 flex-shrink-0 flex flex-col overflow-hidden`}
          >
            <div className="w-80 h-full flex flex-col">
              {/* Header */}
              <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200 dark:border-slate-800 flex-shrink-0">
                <span className="font-semibold text-gray-900 dark:text-white">Informações do Lead</span>
                <button 
                  onClick={() => setShowProfileInfo(false)}
                  className="p-1.5 rounded-lg hover:bg-gray-200 dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                {/* Identity */}
                <div className="flex flex-col items-center text-center">
                  <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-cyan-500 to-teal-600 shadow-xl mb-4 relative">
                    <img src={activeChat.contactAvatar} alt={activeChat.contactName} className="w-full h-full rounded-full object-cover border-2 border-gray-200 dark:border-slate-900" />
                    <span 
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${getPresenceDotColor((activeChat as any).contactPresence, activeChat.contact_id)}`}
                      title={getPresenceLabel((activeChat as any).contactPresence, activeChat.contact_id)}
                    ></span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{activeChat.contactName}</h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mb-1">
                    {(activeChat.clientMemory?.lead_profile?.lead_stage === 'new') ? 'Novo Lead' : 
                     (activeChat.clientMemory?.lead_profile?.lead_stage === 'qualified') ? 'Lead Qualificado' :
                     (activeChat.clientMemory?.lead_profile?.lead_stage ?? '')}
                  </p>
                  {/* Display presence status */}
                  <p className="text-xs font-medium mb-2">
                    {getPresenceStatusText((activeChat as any).contactPresence)}
                  </p>
                  {activeChat.isGroup && (
                    <div className="w-full text-left mt-2">
                      <div className="text-xs text-gray-500 dark:text-slate-400 mb-2">Participantes</div>
                      <div className="flex flex-col gap-2">
                        {(activeChat.participants || []).map(p => (
                          <div key={p.id} className="flex items-center gap-3">
                            <img src={p.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}`} alt={p.name} className="w-8 h-8 rounded-full" />
                            <div>
                              <div className="text-sm text-gray-700 dark:text-slate-200">{p.name}</div>
                              {p.phone && <div className="text-xs text-gray-500 dark:text-slate-500">{p.phone}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Details List */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-gray-500 dark:text-slate-500 uppercase tracking-wider">Dados de Contato</h4>
                  
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 text-gray-500 dark:text-slate-400">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500 dark:text-slate-500">Telefone</span>
                      <span className="text-gray-700 dark:text-slate-200 font-medium">{activeChat.contactPhone}</span>
                    </div>
                  </div>

                  {/* Z-API Buttons trigger */}
                  <div className="mt-3">
                    <button
                      onClick={() => setIsButtonDialogOpen(true)}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-gray-900 dark:text-white text-sm font-medium transition-colors"
                    >
                      Enviar Botões
                    </button>
                  </div>

                  {/* Z-API Buttons Sidebar */}
                  <Sheet open={isButtonDialogOpen} onOpenChange={setIsButtonDialogOpen}>
                    <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0">
                      <SheetHeader className="p-6 border-b border-gray-200 dark:border-slate-800">
                        <SheetTitle>Enviar Botões</SheetTitle>
                        <SheetDescription>Crie até 3 botões de resposta rápida para envio.</SheetDescription>
                      </SheetHeader>

                      <div className="p-6 space-y-3">
                        <div>
                          <label className="text-xs text-gray-500 dark:text-slate-400">Texto da mensagem (opcional)</label>
                          <input
                            value={buttonMessageText}
                            onChange={e => setButtonMessageText(e.target.value)}
                            placeholder="Mensagem acima dos botões"
                            className="w-full mt-1 theme-input px-3 py-2 text-sm text-gray-700 dark:text-slate-200"
                          />
                        </div>

                        <div>
                          <label className="text-xs text-gray-500 dark:text-slate-400">Imagem (URL opcional)</label>
                          <div className="mt-1 flex gap-2 items-center">
                            <input
                              value={buttonImageUrl}
                              onChange={e => setButtonImageUrl(e.target.value)}
                              placeholder="https://.../imagem.jpg"
                              className="flex-1 theme-input px-3 py-2 text-sm text-gray-700 dark:text-slate-200"
                            />
                            <button type="button" onClick={() => setButtonImageUrl('')} className="px-2 py-1 rounded bg-gray-200 dark:bg-slate-800 text-gray-600 dark:text-slate-300">Limpar</button>
                          </div>
                          {buttonImageUrl && (
                            <div className="mt-2">
                              <img src={buttonImageUrl} alt="preview" className="max-h-36 rounded border border-gray-300 dark:border-slate-700 object-contain" onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/300x200/1e293b/cbd5e1?text=Erro+Imagem'; }} />
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="text-xs text-gray-500 dark:text-slate-400">Botões</label>
                          <div className="space-y-2 mt-2">
                            {buttonsDraft.map((b, idx) => (
                              <div key={b.id} className="flex items-center gap-2">
                                <input
                                  value={b.title}
                                  onChange={e => updateButtonTitle(idx, e.target.value)}
                                  placeholder={`Título do botão ${idx + 1}`}
                                  className="flex-1 theme-input px-3 py-2 text-sm text-gray-700 dark:text-slate-200"
                                />
                                <button
                                  onClick={() => removeButtonField(idx)}
                                  className="p-2 rounded bg-gray-200 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-300 dark:bg-slate-700"
                                  title="Remover"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                          <div className="mt-2">
                            <button onClick={addButtonField} className="px-3 py-1 rounded bg-gray-200 dark:bg-slate-800 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-300 dark:bg-slate-700">Adicionar botão</button>
                            <p className="text-[11px] text-gray-500 dark:text-slate-500 mt-2">Máx. 3 botões serão enviados. Títulos curtos funcionam melhor.</p>
                          </div>
                        </div>
                      </div>

                      <SheetFooter className="p-6 border-t border-gray-200 dark:border-slate-800">
                        <div className="flex w-full justify-between gap-2">
                          <button onClick={() => setIsButtonDialogOpen(false)} className="px-3 py-2 rounded bg-gray-200 dark:bg-slate-800 text-sm text-gray-700 dark:text-slate-200">Cancelar</button>
                          <button onClick={handleSendButtons} disabled={sendingButtons} className="px-3 py-2 rounded bg-cyan-600 text-sm text-gray-900 dark:text-white disabled:opacity-60">
                            {sendingButtons ? 'Enviando...' : 'Enviar Botões'}
                          </button>
                        </div>
                      </SheetFooter>
                    </SheetContent>
                  </Sheet>

                  {activeChat.contactEmail && (
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 text-gray-500 dark:text-slate-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 dark:text-slate-500">Email</span>
                        <span className="text-gray-700 dark:text-slate-200 font-medium">{activeChat.contactEmail}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="h-px bg-gray-200/50 dark:bg-slate-800/50 w-full"></div>

                {/* Pipeline de Vendas */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-500 dark:text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Pipeline de Vendas
                  </h4>
                  {linkedDeal ? (
                    <div className="rounded-xl border border-gray-300/60 dark:border-slate-700/60 bg-gray-200/30 dark:bg-slate-800/30 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 dark:text-slate-400">Status</span>
                        {editingDealStatus ? (
                            <select
                              autoFocus
                              value={linkedDeal.stageId || ''}
                              onChange={async (e) => {
                              const stageId = e.target.value;
                              const stage = pipelineStages.find((s: any) => s.id === stageId);
                              await api.moveDealStage(linkedDeal.id, stageId);
                              setLinkedDeal({ ...linkedDeal, stageId, stage: stage?.title?.toLowerCase() || linkedDeal.stage });
                              setEditingDealStatus(false);
                              toast.success('Status atualizado');
                            }}
                            onBlur={() => setEditingDealStatus(false)}
                            className="text-xs border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-gray-900 dark:text-white"
                          >
                            {pipelineStages.map((s: any) => (
                              <option key={s.id} value={s.id}>{s.title}</option>
                            ))}
                          </select>
                        ) : (
                          (() => {
                            const stage = pipelineStages.find((s: any) => s.id === linkedDeal.stageId);
                            const colorMap: Record<string, string> = {
                              'border-slate-500':   'bg-slate-500/20 text-slate-300 border-slate-500/30 hover:bg-slate-500/30',
                              'border-primary':     'bg-cyan-500/20 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/30',
                              'border-violet-500':  'bg-violet-500/20 text-violet-300 border-violet-500/30 hover:bg-violet-500/30',
                              'border-orange-500':  'bg-orange-500/20 text-orange-300 border-orange-500/30 hover:bg-orange-500/30',
                              'border-emerald-500': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30',
                              'border-red-500':     'bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30',
                              'border-blue-500':    'bg-blue-500/20 text-blue-300 border-blue-500/30 hover:bg-blue-500/30',
                              'border-yellow-500':  'bg-yellow-500/20 text-yellow-200 border-yellow-500/30 hover:bg-yellow-500/30',
                              'border-pink-500':    'bg-pink-500/20 text-pink-300 border-pink-500/30 hover:bg-pink-500/30',
                              'border-indigo-500':  'bg-indigo-500/20 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/30',
                            };
                            const cls = colorMap[stage?.color ?? ''] ?? 'bg-purple-500/20 text-purple-300 border-purple-500/30 hover:bg-purple-500/30';
                            return (
                              <button
                                onClick={() => setEditingDealStatus(true)}
                                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${cls}`}
                              >
                                {stage?.title || linkedDeal.stage || 'Sem estágio'}
                              </button>
                            );
                          })()
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 dark:text-slate-400">Valor</span>
                        {editingDealValue ? (
                          <input
                            autoFocus
                            type="text"
                            value={dealValueInput}
                            onChange={e => setDealValueInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSaveDealValue()}
                            onBlur={handleSaveDealValue}
                            className="w-24 text-xs bg-gray-100 dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-gray-900 dark:text-white text-right"
                          />
                        ) : (
                          <button
                            onClick={() => { setDealValueInput(String(linkedDeal.value ?? 0)); setEditingDealValue(true); }}
                            className="flex items-center gap-1.5 text-sm text-gray-900 dark:text-white hover:text-cyan-300 transition-colors"
                          >
                            R$ {(linkedDeal.value ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            <Pencil className="w-3 h-3 text-gray-500 dark:text-slate-400" />
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-slate-500">Clique no status ou valor para alterar</p>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-gray-300/50 dark:border-slate-700/50 bg-gray-200/20 dark:bg-slate-800/20 text-center">
                      <p className="text-xs text-gray-500 dark:text-slate-500 mb-3">Nenhum deal vinculado a este contato</p>
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => setIsCreateDealOpen(true)} className="px-3 py-1.5 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white text-sm">Adicionar Deal</button>
                        <button onClick={() => { window.location.href = '/pipeline'; }} className="px-3 py-1.5 rounded-md border text-sm">Ver Pipeline</button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="h-px bg-gray-200/50 dark:bg-slate-800/50 w-full"></div>

                {/* centered link to previous conversations (moved from Notes) */}
                <div className="w-full flex justify-center mb-3">
                  <button type="button" onClick={() => setIsPrevConvsOpen(true)} className="text-sm text-gray-400 dark:text-slate-400 hover:text-cyan-400 hover:underline transition-colors flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Conversas anteriores
                  </button>
                </div>

                {/* Sentimento */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-500 dark:text-slate-500 uppercase tracking-wider flex items-center justify-between">
                    <span className="flex items-center gap-2"><Heart className="w-4 h-4" /> Sentimento</span>
                    <Info className="w-3.5 h-3.5 text-gray-400 dark:text-slate-600" />
                  </h4>
                  <div className="rounded-xl border border-gray-300/60 dark:border-slate-700/60 bg-gray-200/30 dark:bg-slate-800/30 p-4 space-y-3">
                    {sentiment ? (
                      <div className="text-center py-1">
                        <span className="text-3xl">{sentiment.emoji}</span>
                        <p className={`text-sm font-medium mt-1 ${sentiment.colorClass}`}>{sentiment.label}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-slate-500 text-center py-1">Aguardando análise...</p>
                    )}
                    <button
                      onClick={handleAnalyzeSentiment}
                      disabled={analyzingSentiment}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-gray-900 dark:text-white text-sm font-medium transition-colors"
                    >
                      {analyzingSentiment
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <><Sparkles className="w-4 h-4" /> Analisar Sentimento</>}
                    </button>
                  </div>
                </div>

                <div className="h-px bg-gray-200/50 dark:bg-slate-800/50 w-full"></div>

                {/* Tópicos */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-500 dark:text-slate-500 uppercase tracking-wider flex items-center justify-between">
                    <span className="flex items-center gap-2"><Tag className="w-4 h-4" /> Tópicos</span>
                    <div className="flex items-center gap-2">
                      <Info className="w-3.5 h-3.5 text-gray-400 dark:text-slate-600" />
                      <button
                        onClick={handleCategorizeTopics}
                        disabled={categorizingTopics}
                        className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 hover:border-cyan-400/50 transition-colors disabled:opacity-50"
                      >
                        {categorizingTopics ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        Categorizar
                      </button>
                    </div>
                  </h4>
                  {topics.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {topics.map(t => (
                        <span key={t} className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-200/60 dark:bg-slate-700/60 border border-gray-300/50 dark:border-slate-600/50 text-gray-600 dark:text-slate-300">{t}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 dark:text-slate-500 leading-snug">
                      Nenhum tópico identificado. Clique em &quot;Categorizar&quot; para analisar a conversa.
                    </p>
                  )}
                </div>

                <div className="h-px bg-gray-200/50 dark:bg-slate-800/50 w-full"></div>

                {/* Resumos AI */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-500 dark:text-slate-500 uppercase tracking-wider flex items-center justify-between">
                    <span className="flex items-center gap-2"><FileText className="w-4 h-4" /> Resumos AI ({aiSummaries.length})</span>
                    <button
                      onClick={handleGenerateSummary}
                      disabled={generatingSummary}
                      className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 hover:border-cyan-400/50 transition-colors disabled:opacity-50"
                    >
                      {generatingSummary ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      Gerar Resumo
                    </button>
                  </h4>
                  {aiSummaries.length > 0 ? (
                    <div className="space-y-2">
                      {aiSummaries.map(s => (
                        <div key={s.id} className="p-3 rounded-lg bg-gray-200/40 dark:bg-slate-800/40 border border-gray-300/50 dark:border-slate-700/50">
                          <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed">{s.text}</p>
                          <p className="text-[10px] text-gray-400 dark:text-slate-600 mt-1.5">{new Date(s.created_at).toLocaleString('pt-BR')}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-gray-300/50 dark:border-slate-700/50 bg-gray-200/20 dark:bg-slate-800/20 text-center">
                      <p className="text-xs text-gray-500 dark:text-slate-500">Nenhum resumo gerado ainda</p>
                    </div>
                  )}
                </div>

                {/* AI Memory Section */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-gray-500 dark:text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Brain className="w-4 h-4" />
                    Memória do(a) {sdrName}
                  </h4>
                  
                  {Array.isArray(activeChat.clientMemory?.lead_profile?.interests) && activeChat.clientMemory.lead_profile.interests.length > 0 && (
                    <div className="p-3 rounded-lg bg-gray-200/50 dark:bg-slate-800/50 border border-gray-300/50 dark:border-slate-700/50">
                      <span className="text-xs text-gray-500 dark:text-slate-400">Interesses</span>
                      <p className="text-sm text-gray-700 dark:text-slate-200 mt-1">
                        {activeChat.clientMemory.lead_profile.interests.join(', ')}
                      </p>
                    </div>
                  )}

                  {Array.isArray(activeChat.clientMemory?.sales_intelligence?.pain_points) && activeChat.clientMemory.sales_intelligence.pain_points.length > 0 && (
                    <div className="p-3 rounded-lg bg-gray-200/50 dark:bg-slate-800/50 border border-gray-300/50 dark:border-slate-700/50">
                      <span className="text-xs text-gray-500 dark:text-slate-400">Dores Identificadas</span>
                      <p className="text-sm text-gray-700 dark:text-slate-200 mt-1">
                        {activeChat.clientMemory.sales_intelligence.pain_points.join(', ')}
                      </p>
                    </div>
                  )}

                  <div className="p-3 rounded-lg bg-gray-200/50 dark:bg-slate-800/50 border border-gray-300/50 dark:border-slate-700/50">
                    <span className="text-xs text-gray-500 dark:text-slate-400">Próxima Ação Sugerida</span>
                    <p className="text-sm text-gray-700 dark:text-slate-200 mt-1">
                      {(activeChat.clientMemory?.sales_intelligence?.next_best_action === 'qualify') ? 'Qualificar lead' :
                       (activeChat.clientMemory?.sales_intelligence?.next_best_action === 'demo') ? 'Agendar demonstração' :
                       (activeChat.clientMemory?.sales_intelligence?.next_best_action ?? '')}
                    </p>
                  </div>

                  <div className="text-xs text-gray-500 dark:text-slate-500 text-center">
                    Total de conversas: {activeChat.clientMemory?.interaction_summary?.total_conversations ?? 0}
                  </div>
                </div>

                <div className="h-px bg-gray-200/50 dark:bg-slate-800/50 w-full"></div>

                {/* Assigned User */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-500 dark:text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Responsável
                  </h4>
                  <select
                    value={activeChat.assignedUserId || ''}
                    onChange={(e) => {
                      const userId = e.target.value || null;
                      assignConversation(activeChat.id, userId);
                      toast.success('Conversa atribuída. Deal atualizado automaticamente.');
                    }}
                    className="w-full border border-gray-200 dark:border-slate-800 rounded-lg p-3 text-sm text-gray-600 dark:text-slate-300 focus:ring-1 focus:ring-ring/50 focus:border-primary/50 outline-none transition-all"
                  >
                    <option value="">Não atribuído</option>
                    {teamMembers.map(member => (
                      <option key={member.id} value={member.id}>
                        {member.name} ({member.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="h-px bg-gray-200/50 dark:bg-slate-800/50 w-full"></div>

                {/* Tags */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-500 dark:text-slate-500 uppercase tracking-wider flex items-center justify-between">
                    Tags
                    <Popover open={isTagSelectorOpen} onOpenChange={setIsTagSelectorOpen}>
                      <PopoverTrigger asChild>
                        <button className="text-cyan-500 hover:text-cyan-400 transition-colors">
                          <Plus className="w-4 h-4" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-0 bg-gray-100 dark:bg-slate-900 border-gray-300 dark:border-slate-700" align="end">
                        <TagSelector 
                          availableTags={availableTags}
                          selectedTags={activeChat.tags || []}
                          onToggleTag={handleToggleTag}
                          onCreateTag={handleCreateTag}
                        />
                      </PopoverContent>
                    </Popover>
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {activeChat.tags && activeChat.tags.length > 0 ? (
                      activeChat.tags.map(tagKey => {
                        const tagDef = availableTags.find(t => t.key === tagKey);
                        return (
                          <span 
                            key={tagKey}
                            style={{ 
                              backgroundColor: tagDef?.color ? `${tagDef.color}20` : 'rgba(59, 130, 246, 0.2)',
                              borderColor: tagDef?.color || '#3b82f6'
                            }}
                            className="px-2.5 py-1 rounded-md border text-xs font-medium flex items-center gap-1.5 group hover:brightness-110 transition-all"
                          >
                            <span className="text-gray-700 dark:text-slate-200">{tagDef?.label || tagKey}</span>
                            <button
                              onClick={() => handleToggleTag(tagKey)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:text-slate-200" />
                            </button>
                          </span>
                        );
                      })
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-slate-500 italic">Nenhuma tag adicionada</p>
                    )}
                  </div>
                </div>

                {/* Notes Area */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-500 dark:text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    Notas Internas
                    {isSavingNotes && <Loader2 className="w-3 h-3 animate-spin text-cyan-500" />}
                  </h4>
                  <textarea 
                    className="w-full bg-white/50 dark:bg-slate-950/50 border border-gray-200 dark:border-slate-800 rounded-lg p-3 text-sm text-gray-600 dark:text-slate-300 placeholder:text-gray-400 dark:text-slate-600 focus:ring-1 focus:ring-ring/50 focus:border-primary/50 outline-none resize-none transition-all"
                    rows={4}
                    placeholder="Adicione observações sobre este lead..."
                    value={notesValue}
                    onChange={(e) => setNotesValue(e.target.value)}
                    onBlur={handleNotesBlur}
                  />
                  {/* link moved above 'Sentimento' and centered */}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-[#0B0E14] relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-gray-200/20 to-transparent dark:from-slate-900/20 dark:to-transparent"></div>
          <div className="relative z-10 flex flex-col items-center p-8 text-center max-w-md">
            <div className="w-24 h-24 bg-gray-100 dark:bg-slate-900 rounded-full flex items-center justify-center mb-6 shadow-2xl border border-gray-200 dark:border-slate-800 relative group">
              <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-xl group-hover:bg-cyan-500/30 transition-all duration-1000"></div>
              <MessageSquare className="w-10 h-10 text-cyan-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">LiveChat</h2>
            <p className="text-gray-500 dark:text-slate-400 text-sm leading-relaxed">
              {conversations.length === 0 
                ? 'Nenhuma conversa por aqui ainda. Envie uma mensagem, importe contatos ou aguarde o próximo contato pelo WhatsApp.'
                : 'Selecione uma conversa ao lado para iniciar o atendimento.'}
            </p>
            <div className="mt-8 flex gap-3 text-xs text-gray-500 dark:text-slate-500 font-mono bg-gray-100/50 dark:bg-slate-900/50 px-4 py-2 rounded-lg border border-gray-200/50 dark:border-slate-800/50">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                {sdrName} Online
              </span>
              <span className="w-px h-4 bg-gray-200 dark:bg-slate-800"></span>
              <span>{conversations.length} conversas</span>
            </div>
          </div>
        </div>
      )}

      {/* Nova Conversa Sidebar */}
      <Sheet open={isNewConvOpen} onOpenChange={setIsNewConvOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0">
          <SheetHeader className="p-6 border-b border-gray-200 dark:border-slate-800">
            <SheetTitle>Nova Conversa</SheetTitle>
            <SheetDescription>Preencha os dados para iniciar uma nova conversa.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 p-6">
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-300 mb-1 block">Instância</label>
              <select
                value={newConvInstance}
                onChange={e => setNewConvInstance(e.target.value)}
                className="w-full border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white"
              >
                {instancesList.map(inst => (
                  <option key={inst.id} value={inst.id}>{inst.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-300 mb-1 block">Número de telefone</label>
              <input
                type="tel"
                placeholder="5511999999999"
                value={newConvPhone}
                onChange={e => setNewConvPhone(e.target.value)}
                className="w-full bg-gray-100 dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:text-slate-600"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-300 mb-1 block">Nome do contato</label>
              <input
                type="text"
                placeholder="Nome"
                value={newConvName}
                onChange={e => setNewConvName(e.target.value)}
                className="w-full bg-gray-100 dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:text-slate-600"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-300 mb-1 block">Código do cliente</label>
              <input
                type="text"
                placeholder="Código do cliente (opcional)"
                value={newConvClientCode}
                onChange={e => setNewConvClientCode(e.target.value)}
                className="w-full bg-gray-100 dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:text-slate-600"
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch id="newConvTicket" checked={newConvTicket} onCheckedChange={handleNewConvTicketChange} />
              <label htmlFor="newConvTicket" className={`text-sm ${newConvTicket ? 'text-cyan-400' : 'text-gray-600'} dark:${newConvTicket ? 'text-cyan-400' : 'text-slate-300'}`}>Gerar ticket</label>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="newConvMute" checked={newConvMute} onCheckedChange={handleNewConvMuteChange} />
              <label htmlFor="newConvMute" className={`text-sm ${newConvMute ? 'text-cyan-400' : 'text-gray-600'} dark:${newConvMute ? 'text-cyan-400' : 'text-slate-300'}`}>Não enviar notificações</label>
            </div>
          </div>
          <SheetFooter className="flex gap-2 sm:justify-end p-6 border-t border-gray-200 dark:border-slate-800">
            <button onClick={() => setIsNewConvOpen(false)} className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-slate-800 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-300 dark:bg-slate-700 transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleCreateConversation}
              disabled={creatingConv}
              className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-gray-900 dark:text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {creatingConv ? 'Criando...' : 'Criar Conversa'}
            </button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    
      <CreateDealModal
        open={isCreateDealOpen}
        onOpenChange={setIsCreateDealOpen}
        initialContactId={activeChat?.contactId}
        onDealCreated={() => {
          setIsCreateDealOpen(false);
          // refresh pipeline/deals after creation
          api.fetchPipeline().then(deals => {
            const deal = deals.find((d: any) => d.contactId === activeChat?.contactId);
            setLinkedDeal(deal ?? null);
          }).catch(() => {});
        }}
      />

    </div>
  );
};


export default ChatInterface;