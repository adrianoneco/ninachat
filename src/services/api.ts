// evolution integration removed — use mock in-memory behaviour instead
import {
  Contact,
  StatMetric,
  TeamMember,
  Appointment,
  Deal,
  UIConversation,
  UIMessage,
  KanbanColumn,
  Team,
  TeamFunction,
  TagDefinition,
  MessageDirection,
  MessageType,
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

// Helper: generateId kept for client-side generated ids when needed
export function generateId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
      return (crypto as any).randomUUID();
    }
    // Try to use getRandomValues for RFC4122 v4
    const c = (typeof crypto !== 'undefined' ? (crypto as any) : (globalThis as any).crypto);
    if (c && typeof c.getRandomValues === 'function') {
      const buf = new Uint8Array(16);
      c.getRandomValues(buf);
      buf[6] = (buf[6] & 0x0f) | 0x40;
      buf[8] = (buf[8] & 0x3f) | 0x80;
      const hex = Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
    }
  } catch (e) {}
  // Fallback
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,10);
}


// Helper to get auth token from localStorage
function getAuthHeaders(): Record<string, string> {
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    const token = user?.access_token || user?.token;
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
  } catch (e) {
    // Silently fail if localStorage is not available
  }
  return {};
}

// Enhanced fetch wrapper that automatically includes auth headers
export async function apiFetch(
  endpoint: string,
  options: RequestInit & { baseUrl?: string } = {}
): Promise<Response> {
  const { baseUrl = API_BASE, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers || {});
  
  // Merge auth headers
  const authHeaders = getAuthHeaders();
  Object.entries(authHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });
  
  return fetch(`${baseUrl}/${endpoint}`, { ...fetchOptions, headers });
}

async function apiGet<T>(endpoint: string, fallback: T = [] as any): Promise<T> {
  try {
    const headers = { ...getAuthHeaders() };
    const res = await fetch(`${API_BASE}/${endpoint}`, { headers });
    if (!res.ok) {
      // try to return fallback if available
      return fallback;
    }
    const json = await res.json().catch(() => null);
    if (!json) return (fallback as T);
    return (json.data ?? json) as T;
  } catch (e) {
    console.error('apiGet failed', e);
    return fallback;
  }
}

async function apiPost<T = any>(endpoint: string, body: any): Promise<T> {
  try {
    const headers = { 'Content-Type': 'application/json', ...getAuthHeaders() };
    const res = await fetch(`${API_BASE}/${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`POST ${endpoint} failed: ${res.status}`);
    }
    const json = await res.json().catch(() => null);
    return (json?.data ?? json) as T;
  } catch (e) {
    console.error('apiPost failed', e);
    throw e;
  }
}

async function apiDelete(endpoint: string, id: string): Promise<void> {
  try {
    const headers = getAuthHeaders();
    const res = await fetch(`${API_BASE}/${endpoint}/${encodeURIComponent(id)}`, { method: 'DELETE', headers });
    if (!res.ok) throw new Error(`DELETE ${endpoint}/${id} failed: ${res.status}`);
  } catch (e) {
    console.error('apiDelete failed', e);
    throw e;
  }
}

// ─── Helper functions ───────────────────────────────────
const getDayName = (date: Date): string => {
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return days[date.getDay()];
};

// ─── Exported standalone functions ──────────────────────
export async function upsertContact(contact: any): Promise<any> {
  return apiPost('contacts', contact);
}

export async function deleteContact(id: string): Promise<void> {
  await apiDelete('contacts', id);
}

export const clearStagesCache = () => {};

// ─── Main API object ───────────────────────────────────
export const api = {

  // ── Dashboard ──────────────────────────────────────
  fetchDashboardMetrics: async (days: number = 7): Promise<StatMetric[]> => {
    try {
      const data = await apiGet<StatMetric[]>(`reports/metrics?days=${days}`, []);
      if (Array.isArray(data) && data.length > 0) return data;
    } catch {}
    // fallback to zero values
    return [
      { label: 'Atendimentos', value: '0', trend: '0%', trendUp: true },
      { label: 'Conversões', value: '0', trend: '0%', trendUp: true },
      { label: 'Tempo Médio', value: '—', trend: '', trendUp: true },
      { label: 'Novos Leads', value: '0', trend: '0%', trendUp: true },
    ];
  },

  fetchChartData: async (days: number = 7): Promise<any[]> => {
    try {
      const data = await apiGet<any[]>(`reports/chart?days=${days}`, []);
      if (Array.isArray(data) && data.length > 0) return data;
    } catch {}
    // fallback: empty zeroes
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const name = days === 1 ? 'Hoje' : (days <= 7 ? getDayName(date) : `${date.getDate()}/${date.getMonth() + 1}`);
      result.push({ name, chats: 0, sales: 0 });
    }
    return result;
  },

  // ── Contacts ───────────────────────────────────────
  fetchContacts: async (): Promise<Contact[]> => {
    const contacts = await apiGet<Contact[]>('contacts', []);

    console.log('Fetched contacts:', contacts);
    return contacts;
  },

  importContacts: async (rows: { name: string; phone: string; email?: string; status?: string }[]): Promise<{ imported: number; skipped: number }> => {
    const contacts = await apiGet<Contact[]>('contacts', []);
    const existingPhones = new Set(contacts.map(c => (c.phone || '').toString().replace(/\D/g, '')));
    let imported = 0;
    let skipped = 0;
    for (const row of rows) {
      const digits = (row.phone || '').toString().replace(/\D/g, '');
      if (!digits) { skipped++; continue; }
      let formatted = '';
      if (digits.length === 10 || digits.length === 11) formatted = `+55${digits}`;
      else if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) formatted = `+${digits}`;
      else formatted = `+${digits}`;
      if (existingPhones.has(digits)) { skipped++; continue; }
      existingPhones.add(digits);
      await apiPost('contacts', {
        id: generateId(),
        name: row.name || 'Sem nome',
        phone: formatted,
        email: row.email || '',
        status: (['lead', 'customer', 'churned'].includes(row.status || '') ? row.status : 'lead'),
        lastContact: new Date().toISOString(),
      });
      imported++;
    }
    return { imported, skipped };
  },

  updateContactTags: async (contactId: string, tags: string[]): Promise<void> => {
    await apiPost('contacts', { id: contactId, tags });
  },

  updateContactNotes: async (contactId: string, notes: string): Promise<void> => {
    await apiPost('contacts', { id: contactId, notes });
  },

  toggleContactBlock: async (contactId: string, blocked: boolean, reason?: string): Promise<void> => {
    await apiPost('contacts', { id: contactId, blocked, blocked_reason: reason || undefined });
  },

  createContact: async (contact: { name: string; phone_number: string; email?: string }): Promise<{ id: string }> => {
    const id = generateId();
    await apiPost('contacts', {
      id,
      name: contact.name,
      phone: contact.phone_number,
      email: contact.email || '',
      status: 'lead',
      lastContact: new Date().toLocaleDateString('pt-BR'),
    });
    return { id };
  },

  // ── Team Members ───────────────────────────────────
  fetchTeam: async (): Promise<TeamMember[]> => {
    return apiGet<TeamMember[]>('team_members', []);
  },

  createTeamMember: async (member: {
    name: string;
    email: string;
    role: 'admin' | 'manager' | 'agent';
    team_id?: string;
    function_id?: string;
    weight?: number;
  }): Promise<TeamMember> => {
    const newMember: TeamMember = {
      id: generateId(),
      name: member.name,
      email: member.email,
      role: member.role,
      status: 'invited',
      avatar: `https://ui-avatars.com/api/?name=${member.name.replace(' ', '+')}&background=random`,
      team_id: member.team_id || null,
      function_id: member.function_id || null,
      weight: member.weight || 1,
    };
    await apiPost('team_members', newMember);
    return newMember;
  },

  updateTeamMember: async (id: string, updates: Partial<any>): Promise<void> => {
    await apiPost('team_members', { id, ...updates });
  },

  deleteTeamMember: async (id: string): Promise<void> => {
    await apiDelete('team_members', id);
  },

  // ── Teams ──────────────────────────────────────────
  fetchTeams: async () => {
    return apiGet<Team[]>('teams', []);
  },

  createTeam: async (team: { name: string; description?: string; color?: string }) => {
    const newTeam = {
      id: generateId(),
      name: team.name,
      description: team.description || null,
      color: team.color || '#3b82f6',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await apiPost('teams', newTeam);
    return newTeam;
  },

  updateTeam: async (id: string, updates: Partial<any>) => {
    await apiPost('teams', { id, ...updates, updated_at: new Date().toISOString() });
  },

  deleteTeam: async (id: string) => {
    await apiPost('teams', { id, is_active: false, updated_at: new Date().toISOString() });
  },

  // ── Team Functions ─────────────────────────────────
  fetchTeamFunctions: async () => {
    return apiGet<TeamFunction[]>('team_functions', []);
  },

  createTeamFunction: async (func: { name: string; description?: string }) => {
    const newFunc = {
      id: generateId(),
      name: func.name,
      description: func.description || null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await apiPost('team_functions', newFunc);
    return newFunc;
  },

  updateTeamFunction: async (id: string, updates: Partial<any>) => {
    await apiPost('team_functions', { id, ...updates, updated_at: new Date().toISOString() });
  },

  deleteTeamFunction: async (id: string) => {
    await apiPost('team_functions', { id, is_active: false, updated_at: new Date().toISOString() });
  },

  // ── Appointments ───────────────────────────────────
  fetchAppointments: async (): Promise<Appointment[]> => {
    return apiGet<Appointment[]>('appointments', []);
  },

  createAppointment: async (appointment: {
    title: string;
    description?: string;
    date: string;
    time: string;
    duration?: number;
    type: 'demo' | 'meeting' | 'support' | 'followup';
    attendees?: string[];
    contact_id?: string;
    meeting_url?: string;
  }): Promise<Appointment> => {
    const newAppointment: Appointment = {
      id: generateId(),
      title: appointment.title,
      date: appointment.date,
      time: appointment.time,
      duration: appointment.duration || 60,
      type: appointment.type,
      description: appointment.description,
      attendees: appointment.attendees || [],
      contact_id: appointment.contact_id,
    };
    await apiPost('appointments', newAppointment);
    return newAppointment;
  },

  updateAppointment: async (id: string, updates: Partial<any>): Promise<void> => {
    await apiPost('appointments', { id, ...updates });
  },

  deleteAppointment: async (id: string): Promise<void> => {
    await apiDelete('appointments', id);
  },

  // ── Pipeline / Deals ──────────────────────────────
  fetchPipeline: async (): Promise<Deal[]> => {
    return apiGet<Deal[]>('deals', []);
  },

  fetchPipelineStages: async (): Promise<KanbanColumn[]> => {
    const stages = await apiGet<KanbanColumn[]>('pipeline_stages', []);
    return stages.sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
  },

  createPipelineStage: async (stage: { title: string; color: string; isAiManaged?: boolean; aiTriggerCriteria?: string }): Promise<KanbanColumn> => {
    const stages = await apiGet<KanbanColumn[]>('pipeline_stages', []);
    const maxPos = stages.reduce((max, s) => Math.max(max, s.position), -1);
    const newStage: KanbanColumn = {
      id: generateId(),
      title: stage.title,
      color: stage.color,
      position: maxPos + 1,
      isSystem: false,
      isActive: true,
      isAiManaged: stage.isAiManaged || false,
      aiTriggerCriteria: stage.aiTriggerCriteria || null,
    };
    await apiPost('pipeline_stages', newStage);
    return newStage;
  },

  updatePipelineStage: async (id: string, updates: any): Promise<void> => {
    await apiPost('pipeline_stages', { id, ...updates });
  },

  deletePipelineStage: async (id: string, moveToStageId?: string): Promise<void> => {
    if (moveToStageId) {
      const deals = await apiGet<Deal[]>('deals', []);
      for (const d of deals) {
        if (d.stageId === id) {
          await apiPost('deals', { id: d.id, stageId: moveToStageId });
        }
      }
    }
    await apiDelete('pipeline_stages', id);
  },

  reorderPipelineStages: async (stageIds: string[]): Promise<void> => {
    for (let i = 0; i < stageIds.length; i++) {
      await apiPost('pipeline_stages', { id: stageIds[i], position: i });
    }
  },

  createDeal: async (deal: any): Promise<Deal> => {
    const newDeal: Deal = {
      id: generateId(),
      title: deal.title,
      company: deal.company || 'Sem empresa',
      value: deal.value || 0,
      stage: deal.stage || 'new',
      stageId: deal.stage_id,
      ownerAvatar: 'https://ui-avatars.com/api/?name=NA&background=334155&color=fff',
      tags: deal.tags || [],
      dueDate: deal.due_date,
      priority: deal.priority || 'medium',
      contactId: deal.contact_id,
    };
    await apiPost('deals', newDeal);
    return newDeal;
  },

  updateDeal: async (id: string, updates: Partial<any>): Promise<void> => {
    await apiPost('deals', { id, ...updates });
  },

  deleteDeal: async (id: string): Promise<void> => {
    await apiDelete('deals', id);
  },

  moveDealStage: async (id: string, newStageId: string): Promise<void> => {
    const stages = await apiGet<KanbanColumn[]>('pipeline_stages', []);
    const stage = stages.find(s => s.id === newStageId);
    await apiPost('deals', {
      id,
      stageId: newStageId,
      stage: stage?.title.toLowerCase() || undefined,
    });
  },

  markDealWon: async (dealId: string): Promise<void> => {
    const stages = await apiGet<KanbanColumn[]>('pipeline_stages', []);
    const wonStage = stages.find(s => s.title.toLowerCase().includes('ganho') || s.title.toLowerCase().includes('won'));
    await apiPost('deals', {
      id: dealId,
      stage: 'won',
      wonAt: new Date().toISOString(),
      ...(wonStage ? { stageId: wonStage.id } : {}),
    });
  },

  markDealLost: async (dealId: string, reason: string): Promise<void> => {
    const stages = await apiGet<KanbanColumn[]>('pipeline_stages', []);
    const lostStage = stages.find(s => s.title.toLowerCase().includes('perdido') || s.title.toLowerCase().includes('lost'));
    await apiPost('deals', {
      id: dealId,
      stage: 'lost',
      lostAt: new Date().toISOString(),
      lostReason: reason,
      ...(lostStage ? { stageId: lostStage.id } : {}),
    });
  },

  updateDealOwner: async (dealId: string, ownerId: string): Promise<void> => {
    await apiPost('deals', { id: dealId, ownerId });
  },

  // ── Deal Activities ────────────────────────────────
  fetchDealActivities: async (dealId: string): Promise<any[]> => {
    return apiGet<any[]>(`deal_activities?deal_id=${encodeURIComponent(dealId)}`, []);
  },

  createDealActivity: async (activity: any): Promise<any> => {
    const newActivity = {
      id: generateId(),
      deal_id: activity.dealId,
      type: activity.type,
      title: activity.title,
      description: activity.description || null,
      scheduled_at: activity.scheduledAt || null,
      completed_at: null,
      is_completed: false,
      created_by: activity.createdBy || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await apiPost('deal_activities', newActivity);
    return newActivity;
  },

  updateDealActivity: async (id: string, updates: any): Promise<void> => {
    const patch: any = { id, updated_at: new Date().toISOString() };
    if (updates.isCompleted !== undefined) {
      patch.is_completed = updates.isCompleted;
      patch.completed_at = updates.isCompleted ? new Date().toISOString() : null;
    }
    if (updates.title !== undefined) patch.title = updates.title;
    if (updates.description !== undefined) patch.description = updates.description;
    await apiPost('deal_activities', patch);
  },

  deleteDealActivity: async (id: string): Promise<void> => {
    await apiDelete('deal_activities', id);
  },

  // ── Reports ────────────────────────────────────────
  fetchReport: async (opts?: { days?: number; instanceId?: string; agentId?: string }) => {
    const days = opts?.days ?? 30;
    const params = new URLSearchParams({ days: String(days) });
    if (opts?.instanceId) params.set('instanceId', opts.instanceId);
    if (opts?.agentId) params.set('agentId', opts.agentId);
    try {
      const data = await apiGet<any>(`reports/full?${params}`, null);
      if (data) return data;
    } catch {}
    // fallback empty structure
    return {
      statusDistribution: [
        { name: 'Abertas', value: 0 },
        { name: 'Fechadas', value: 0 },
        { name: 'Arquivadas', value: 0 },
      ],
      mediaDistribution: [
        { name: 'Texto', value: 0 },
        { name: 'Imagem', value: 0 },
        { name: 'Áudio', value: 0 },
        { name: 'Documento', value: 0 },
      ],
      hourlyActivity: Array.from({ length: 24 }, (_, h) => ({ hour: `${h}h`, value: 0 })),
      weekdayVolume: ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(day => ({ day, value: 0 })),
      agentPerformance: [],
    };
  },

  // ── Messages ───────────────────────────────────────
  updateMessage: async (messageId: string, newContent: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/messages/${encodeURIComponent(messageId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newContent }),
    });
    if (!res.ok) throw new Error('Falha ao editar mensagem');
    return res.json();
  },

  forwardMessage: async (messageId: string, targetConversationId: string): Promise<any> => {
    return apiPost('messages/forward', { message_id: messageId, target_conversation_id: targetConversationId });
  },

  fetchConversationMessages: async (conversationId: string, limit: number = 50): Promise<any[]> => {
    return apiGet<any[]>(`messages?conversation_id=${encodeURIComponent(conversationId)}&limit=${limit}`, []);
  },

  sendMessage: async (conversationId: string, content: string, isHumanModeParam?: boolean, attachments?: Array<{ dataUrl?: string; name?: string; type?: string }>): Promise<string> => {
    console.log('[debug] api.sendMessage called', { conversationId, isHumanModeParam });
    const livechatSettings = await apiGet<any>('livechat_settings', {});

    const applyCopilotIfEnabled = async (text: string) => {
      try {
        if (livechatSettings?.ai_copilot_enabled) {
          const prompt = livechatSettings.ai_copilot_system_prompt || 'Seja conciso.';
          const suggestion = `[Copilot suggestion based on "${prompt}"]`;
          return `${suggestion} ${text}`;
        }
      } catch (err) {
        console.error('Copilot step failed', err);
      }
      return text;
    };

    content = await applyCopilotIfEnabled(content);

    let isHumanMode = false;
    if (typeof isHumanModeParam === 'boolean') {
      isHumanMode = isHumanModeParam;
    } else {
      const convs = await apiGet<any[]>('conversations', []);
      const convEntry = (convs || []).find((c: any) => c.id === conversationId || c.contact_id === conversationId);
      isHumanMode = convEntry && convEntry.status === 'human';
    }

    // Evolution integration removed: fall back to mock provider

    const API_BASE = (import.meta as any).env?.VITE_API_BASE || '/api';

    const uploadIfDataUrl = async (val: any, defaultName: string) => {
      if (!val) return val;
      if (typeof val === 'string' && val.startsWith('data:')) {
        try {
          const m = val.match(/^data:([^;]+);/);
          const mime = m?.[1] || 'application/octet-stream';
          const ext = mime.split('/').pop() || 'bin';
          const filename = `${defaultName.replace(/\s+/g,'_')}-${Date.now()}.${ext}`;
          const res = await fetch(`${API_BASE}/uploads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename, data: val }) });
          const json = await res.json();
          if (json) return json.url || json.thumbUrl || json.avatarUrl || val;
        } catch (e) { console.error('upload failed', e); }
      }
      return val;
    };

    let attached: any[] = [];
    if (Array.isArray(attachments) && attachments.length > 0) {
      for (const a of attachments) {
        const url = a.dataUrl ? await uploadIfDataUrl(a.dataUrl, a.name || 'attachment') : undefined;
        attached.push({ url: url || a.dataUrl, name: a.name, type: a.type });
      }
    }

    // Determine the specific message type based on the first attachment's MIME type
    let msgType = 'text';
    if (attached.length > 0) {
      const mime = (attached[0].type || '').toLowerCase();
      if (mime.startsWith('image/webp') || mime.startsWith('image/png') && (attached[0].name || '').toLowerCase().includes('sticker')) {
        msgType = 'sticker';
      } else if (mime.startsWith('image/')) {
        msgType = 'image';
      } else if (mime.startsWith('video/')) {
        msgType = 'video';
      } else if (mime.startsWith('audio/')) {
        msgType = 'audio';
      } else {
        msgType = 'file';
      }
    }

    const id = generateId();
    const newMsg = {
      id,
      // message_id used by server as unique external id
      message_id: id,
      conversation_id: conversationId,
      direction: 'outbound',
      from_type: isHumanMode ? 'user' : 'livechat',
      content,
      created_at: new Date().toISOString(),
      provider: 'mock',
      type: msgType,
      media_url: attached.length > 0 ? attached[0].url : undefined,
      payload: attached.length > 0 ? { attachments: attached } : undefined,
    };
    await apiPost('messages', newMsg);
    return id;
  },

  sendZApiButtons: async (conversationId: string, phone: string, buttons: { id: string; title: string }[], text?: string, imageUrl?: string | null) => {
    const newMsg = {
      id: generateId(),
      message_id: generateId(),
      conversation_id: conversationId,
      direction: 'outbound',
      content: text || '',
      created_at: new Date().toISOString(),
      provider: 'mock',
      type: 'buttons',
      payload: { phone, buttons, imageUrl: imageUrl || null },
      status: 'sent',
    };
    await apiPost('messages', newMsg);
    return newMsg;
  },

  // ── Direct WPP Send Routes (via /:session/messages/send-*) ──────────

  /** Post multipart form data (binary-first) to a WPP send endpoint */
  async _wppPostMedia(endpoint: string, to: string, fields: Record<string, string | undefined>, file?: File | Blob) {
    if (file) {
      const fd = new FormData();
      fd.append('to', to);
      if (file instanceof File) {
        fd.append('file', file, file.name);
        if (fields.filename) fd.append('filename', fields.filename);
      } else {
        // Blob without a name — use provided filename or default
        fd.append('file', file, fields.filename || 'blob');
      }
      if (fields.caption) fd.append('caption', fields.caption);
      const res = await apiFetch(endpoint, { method: 'POST', body: fd });
      if (!res.ok) throw new Error(`POST ${endpoint} failed: ${res.status}`);
      return res.json().catch(() => null);
    }
    // Fallback: JSON with URL
    return apiPost(endpoint, { to, ...fields });
  },

  /** Send text directly via WPP session */
  wppSendText: async (session: string, to: string, body: string) => {
    return apiPost(`${session}/messages/send-text`, { to, body });
  },

  /** Send image — binary (File/Blob) first, URL as fallback */
  wppSendImage: async (
    session: string,
    to: string,
    fileOrUrl: File | Blob | string,
    filename?: string,
    caption?: string,
  ) => {
    const endpoint = `${session}/messages/send-image`;
    if (typeof fileOrUrl !== 'string') {
      return api._wppPostMedia(endpoint, to, { filename, caption }, fileOrUrl);
    }
    return apiPost(endpoint, { to, url: fileOrUrl, filename, caption });
  },

  /** Send video — binary (File/Blob) first, URL as fallback */
  wppSendVideo: async (
    session: string,
    to: string,
    fileOrUrl: File | Blob | string,
    filename?: string,
    caption?: string,
  ) => {
    const endpoint = `${session}/messages/send-video`;
    if (typeof fileOrUrl !== 'string') {
      return api._wppPostMedia(endpoint, to, { filename, caption }, fileOrUrl);
    }
    return apiPost(endpoint, { to, url: fileOrUrl, filename, caption });
  },

  /** Send audio — binary (File/Blob) first, URL as fallback */
  wppSendAudio: async (
    session: string,
    to: string,
    fileOrUrl: File | Blob | string,
    filename?: string,
  ) => {
    const endpoint = `${session}/messages/send-audio`;
    if (typeof fileOrUrl !== 'string') {
      return api._wppPostMedia(endpoint, to, { filename }, fileOrUrl);
    }
    return apiPost(endpoint, { to, url: fileOrUrl });
  },

  /** Send voice note (PTT) — binary (File/Blob) first, URL as fallback */
  wppSendPtt: async (session: string, to: string, fileOrUrl: File | Blob | string) => {
    const endpoint = `${session}/messages/send-ptt`;
    if (typeof fileOrUrl !== 'string') {
      return api._wppPostMedia(endpoint, to, {}, fileOrUrl);
    }
    return apiPost(endpoint, { to, url: fileOrUrl });
  },

  /** Send sticker — binary (File/Blob) first, URL as fallback */
  wppSendSticker: async (session: string, to: string, fileOrUrl: File | Blob | string) => {
    const endpoint = `${session}/messages/send-sticker`;
    if (typeof fileOrUrl !== 'string') {
      return api._wppPostMedia(endpoint, to, {}, fileOrUrl);
    }
    return apiPost(endpoint, { to, url: fileOrUrl });
  },

  processIncomingExternal: async (payload: any): Promise<void> => {
    try {
      // Evolution normalization removed — expect payload to already be in a compatible shape
      const normalized = (payload as any) || {};
      const id = normalized.id || generateId();
      // Normalize phone-like identifiers to a digits-only form to avoid duplicates
      const rawFrom = normalized.from || '';
      const rawTo = normalized.to || '';
      const normalizedFrom = typeof rawFrom === 'string' ? rawFrom.replace(/\D/g, '') : rawFrom;
      const normalizedTo = typeof rawTo === 'string' ? rawTo.replace(/\D/g, '') : rawTo;

      // Prefer an explicit conversation id (payload.to), otherwise try normalized phone (from)
      const conversationId = normalized.to || (normalizedFrom ? String(normalizedFrom) : undefined) || generateId();

      const newMsg = {
        id,
        message_id: id,
        conversation_id: conversationId,
        direction: 'inbound',
        content: normalized.content,
        from: rawFrom,
        to: rawTo,
        created_at: normalized.timestamp || new Date().toISOString(),
        provider: normalized.provider,
        raw: normalized.raw,
      };
      await apiPost('messages', newMsg);

      // Ensure contact exists before creating a conversation
      try {
        if (normalizedFrom) {
          const contacts = await apiGet<any[]>('contacts', []);
          const digitsFrom = String(normalizedFrom).replace(/\D/g, '');
          const existing = contacts.find((c: any) => String(c.phone_number || '').replace(/\D/g, '') === digitsFrom || String(c.whatsapp_id || '').replace(/\D/g, '') === digitsFrom);
          if (!existing) {
            // create minimal contact record
            await apiPost('contacts', {
              id: generateId(),
              name: undefined,
              phone_number: normalizedFrom,
              whatsapp_id: normalizedFrom,
              created_at: new Date().toISOString(),
            });
          }
        }
      } catch (e) {
        console.error('Failed ensuring contact exists for incoming message', e);
      }

      const conversations = await apiGet<any[]>('conversations', []);
      // Try to match existing by explicit id or by normalized contact id (digits-only)
      const conv = conversations.find((c: any) => c.id === conversationId || (c.contact_id && String(c.contact_id).replace(/\D/g, '') === String(normalizedFrom)));
      if (!conv) {
        // create conversation using digits-only contact_id when possible
        const contactIdToUse = normalizedFrom || conversationId;
        await apiPost('conversations', {
          id: conversationId,
          contact_id: contactIdToUse,
          created_at: new Date().toISOString(),
          is_active: true,
          last_message_at: new Date().toISOString(),
          livechat_context: null,
        });
      }
    } catch (err) {
      console.error('Error processing incoming external message', err);
    }
  },

  markMessagesAsRead: async (conversationId: string): Promise<void> => {
    try {
      await apiPost('messages/mark-read', { conversation_id: conversationId });
    } catch (e) {
      console.warn('markMessagesAsRead failed', e);
    }
  },

  // ── Conversations ──────────────────────────────────
  fetchConversations: async (): Promise<UIConversation[]> => {
    try {
      // Use pooled endpoint which already includes recent messages and contact status
      const convs = await apiGet<any[]>('conversations/pool', []);
      const result: UIConversation[] = (convs || []).map((c) => {
        const sorted = (c.messages || []).sort((a: any, b: any) => new Date(a.sent_at || a.created_at).getTime() - new Date(b.sent_at || b.created_at).getTime());
        const last = sorted[sorted.length - 1];
        const contact = c.contact || {};
        return {
          id: c.id,
          contactId: contact.id || c.contact_id || c.id,
          contactName: (contact && (contact.name || contact.call_name)) || contact.phone_formated || contact.phone_number || 'Contato',
          contactPhone: contact.phone_formated || contact.phone_number || '',
          contactAvatar: contact.profile_picture_url || `https://ui-avatars.com/api/?name=${encodeURIComponent((contact && contact.name) || 'U')}&background=0ea5e9&color=fff`,
          contactEmail: contact.email || null,
          status: c.status || 'livechat',
          isActive: c.is_active !== false,
          assignedTeam: c.assigned_team || null,
          assignedUserId: c.assigned_user_id || null,
          assignedUserName: null,
          instanceId: c.assigned_team || c.instance_id || null,
          lastMessage: last?.content || '',
          lastMessageTime: last ? new Date(last.sent_at || last.created_at).toLocaleString() : (c.last_message_at ? new Date(c.last_message_at).toLocaleString() : ''),
          unreadCount: c.unread_count || (c.messages || []).filter((m: any) => (m.direction === 'inbound' || m.from_type === 'whatsapp') && m.status !== 'read').length || 0,
          tags: c.tags || [],
          isGroup: c.isGroup || false,
          participants: c.participants || [],
          messages: (sorted || []).map((m: any) => {
            let msgType = MessageType.TEXT;
            const media = (m.media_url || m.mediaUrl || '').toString().toLowerCase();
            const explicit = (m.type || '').toString().toLowerCase();
            const imageExt = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];
            const audioExt = ['.mp3', '.wav', '.ogg', '.m4a', '.aac'];
            const videoExt = ['.mp4', '.webm', '.mov', '.avi'];
            if (explicit === 'sticker') msgType = MessageType.STICKER;
            else if (explicit === 'video' || videoExt.some(ext => media.endsWith(ext))) msgType = MessageType.VIDEO;
            else if (explicit === 'image' || imageExt.some(ext => media.endsWith(ext))) msgType = MessageType.IMAGE;
            else if (explicit === 'audio' || explicit === 'ptt' || audioExt.some(ext => media.endsWith(ext))) msgType = MessageType.AUDIO;
            else if (explicit === 'file' || explicit === 'document') msgType = MessageType.FILE;
            return {
              id: m.id,
              content: m.content,
              timestamp: new Date(m.sent_at || m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
              direction: m.direction === 'outbound' ? MessageDirection.OUTGOING : MessageDirection.INCOMING,
              type: msgType,
              status: m.status || 'sent',
              fromType: (m.from_type as any) || (m.direction === 'outbound' ? 'livechat' : 'user'),
              mediaUrl: m.media_url || m.mediaUrl || null,
              whatsappMessageId: m.whatsapp_message_id || m.whatsappMessageId || null,
              edits: m.edits || undefined,
              edited_at: m.edited_at || undefined,
              created_at: m.created_at || m.sent_at || undefined,
            } as UIMessage;
          }),
          clientMemory: c.client_memory || null,
          notes: c.notes || null,
          contactPresence: c.contact?.presense || null,
        } as UIConversation;
      });
      return result as UIConversation[];
    } catch (err) {
      console.error('fetchConversations error', err);
      return [];
    }
  },

  createConversation: async (opts: { instanceId: string; phone: string; contactName: string; createTicket?: boolean; muteNotifications?: boolean }): Promise<any> => {
    const now = new Date().toISOString();
    const normalizedPhone = opts.phone.replace(/\D/g, '');
    const id = generateId();
    const conv = {
      id,
      contact_id: normalizedPhone,
      contact: {
        name: opts.contactName || 'Contato',
        phone_number: normalizedPhone,
        profile_picture_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(opts.contactName || 'U')}&background=0ea5e9&color=fff`,
        email: null,
      },
      status: 'human',
      is_active: true,
      created_at: now,
      last_message_at: now,
      assigned_team: opts.instanceId,
      assigned_user_id: null,
      tags: [],
      notes: null,
      mute_notifications: Boolean(opts.muteNotifications),
      client_memory: null,
      livechat_context: null,
    };
    await apiPost('conversations', conv);
    return conv;
  },

  leaveGroup: async (conversationId: string, userId: string) => {
    const conversations = await apiGet<any[]>('conversations', []);
    const conv = conversations.find(c => c.id === conversationId);
    if (!conv) return;
    if (!conv.participants || !Array.isArray(conv.participants)) return;
    conv.participants = conv.participants.filter((p: any) => p.id !== userId);
    if (conv.participants.length === 0) conv.is_active = false;
    conv.updated_at = new Date().toISOString();
    await apiPost('conversations', conv);
    return conv;
  },

  closeConversation: async (conversationId: string, closedBy?: string) => {
    await apiPost('conversations', {
      id: conversationId,
      is_active: false,
      status: 'closed',
      closed_at: new Date().toISOString(),
      closed_by: closedBy || null,
    });
  },

  reopenConversation: async (conversationId: string, _reopenedBy?: string) => {
    await apiPost('conversations', {
      id: conversationId,
      is_active: true,
      status: 'livechat',
      closed_at: null,
      closed_by: null,
      updated_at: new Date().toISOString(),
    });
  },

  transferConversation: async (conversationId: string, instanceId: string | null) => {
    await apiPost('conversations', {
      id: conversationId,
      assigned_team: instanceId,
      updated_at: new Date().toISOString(),
    });
  },

  archiveConversation: async (conversationId: string, archivedBy?: string) => {
    await apiPost('conversations', {
      id: conversationId,
      is_active: false,
      status: 'archived',
      archived_at: new Date().toISOString(),
      archived_by: archivedBy || null,
    });
  },

  updateConversationStatus: async (conversationId: string, status: 'livechat' | 'human' | 'paused'): Promise<void> => {
    await apiPost('conversations', {
      id: conversationId,
      status,
      updated_at: new Date().toISOString(),
    });
  },

  assignConversation: async (conversationId: string, userId: string | null, _contactId: string | null = null): Promise<void> => {
    await apiPost('conversations', {
      id: conversationId,
      assigned_user_id: userId,
      updated_at: new Date().toISOString(),
    });
  },

  // ── Instances ──────────────────────────────────────
  fetchInstances: async (): Promise<any[]> => {
    const list = await apiGet<any[]>('instances', []);
    return list.map(i => ({ ...i, isPrivate: Boolean(i.isPrivate), allowedUserIds: i.allowedUserIds || [], enableTicketing: Boolean(i.enableTicketing) }));
  },

  // ── Tickets ────────────────────────────────────────
  createTicket: async (conversationId: string, title?: string, description?: string, createdBy?: string) => {
    const ticket = {
      id: generateId(),
      conversationId,
      title: title || `Chamado ${conversationId}`,
      description: description || '',
      status: 'open',
      createdAt: new Date().toISOString(),
      createdBy: createdBy || null,
    };
    await apiPost('tickets', ticket);
    return ticket;
  },

  fetchTickets: async (): Promise<any[]> => {
    return apiGet<any[]>('tickets', []);
  },

  // ── Tags ───────────────────────────────────────────
  fetchTagDefinitions: async (): Promise<TagDefinition[]> => {
    return apiGet<TagDefinition[]>('tag_definitions', []);
  },

  createTagDefinition: async (tag: { key: string; label: string; color: string; category: string }) => {
    const newTag = {
      id: generateId(),
      ...tag,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await apiPost('tag_definitions', newTag);
    return newTag;
  },

  // ── Macros ─────────────────────────────────────────
  fetchMacrosGlobal: async (): Promise<any[]> => {
    return apiGet<any[]>('macros_global', []);
  },

  fetchUserMacros: async (userId: string): Promise<any[]> => {
    try {
      const res = await fetch(`${API_BASE}/macros_by_user?user_id=${encodeURIComponent(userId)}`);
      if (res.ok) return res.json();
    } catch {}
    return [];
  },

  saveMacro: async (macro: { id?: string; name: string; shortcut?: string; content: string; category?: string; scope?: 'global' | 'user'; userId?: string; uses?: number }) => {
    const now = new Date().toISOString();
    const endpoint = macro.scope === 'user' ? 'macros_by_user' : 'macros_global';
    if (macro.id) {
      await apiPost(endpoint, { ...macro, updated_at: now });
    } else {
      await apiPost(endpoint, { ...macro, id: generateId(), uses: macro.uses || 0, created_at: now, updated_at: now });
    }
  },

  deleteMacro: async (id: string, scope: 'global' | 'user', _userId?: string) => {
    const endpoint = scope === 'user' ? 'macros_by_user' : 'macros_global';
    await apiDelete(endpoint, id);
  },

  // ── Assignment Rules ───────────────────────────────
  fetchAssignmentRules: async (): Promise<any[]> => {
    return apiGet<any[]>('assignment_rules', []);
  },

  saveAssignmentRule: async (rule: any) => {
    const now = new Date().toISOString();
    if (rule.id) {
      await apiPost('assignment_rules', { ...rule, updated_at: now });
    } else {
      await apiPost('assignment_rules', { ...rule, id: generateId(), created_at: now, updated_at: now });
    }
  },

  deleteAssignmentRule: async (id: string) => {
    await apiDelete('assignment_rules', id);
  },
};
