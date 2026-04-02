import axios from 'axios';
import { Repository } from 'typeorm';
import * as wppconnect from '@wppconnect-team/wppconnect';
import { randomUUID } from 'crypto';
import { Logger } from '@nestjs/common';

import { LiveChatSettings } from '../entities/livechat-settings.entity';
import { Message } from '../entities/message.entity';
import { Conversation } from '../entities/conversation.entity';
import { GenericRecord } from '../entities/generic-record.entity';
import { EventsGateway } from '../ws/events.gateway';

const logger = new Logger('AiAgent');

// ─── Human-transfer detection ─────────────────────────────────────────────────
const HUMAN_REQUEST_PATTERNS: RegExp[] = [
  /falar\s+com\s+(um\s+)?(humano|atendente|pessoa|agente|operador|funcionário)/i,
  /quero\s+(um\s+|o\s+)?atendente/i,
  /preciso\s+(de\s+)?(um\s+)?atendente/i,
  /me\s+(passa|coloca|transfere)\s+(para|pra)\s+(um\s+)?(humano|atendente|pessoa|agente)/i,
  /transfere\s+(para|pra)\s+(um\s+)?(humano|atendente|pessoa)/i,
  /transferir\s+(para|pra)\s+(um\s+)?(humano|atendente|pessoa)/i,
  /atendimento\s+humano/i,
  /suporte\s+humano/i,
  /chamar\s+(o\s+|um\s+)?atendente/i,
  /quero\s+falar\s+com\s+alguém/i,
  /pessoa\s+real/i,
];

function isHumanTransferRequest(text: string): boolean {
  return HUMAN_REQUEST_PATTERNS.some((p) => p.test(text));
}

// ─── Scheduling-intent detection ─────────────────────────────────────────────
const SCHEDULING_PATTERNS: RegExp[] = [
  /quero\s+(agendar|marcar|fazer|solicitar)/i,
  /pode\s+(agendar|marcar|fazer)\s+(uma|um|a|o)?\s*(visita|reuni[aã]o|consulta|atendimento|visita\s+t[eé]cnica|instala[cç][aã]o)/i,
  /gostaria\s+de\s+(agendar|marcar|confirmar)\s+(uma|um)?/i,
  /agendar\s+(uma|um)?\s*(visita|reuni[aã]o|consulta|atendimento|hora|hor[aá]rio)/i,
  /marcar\s+(uma|um)?\s*(visita|reuni[aã]o|consulta|dia|hora|hor[aá]rio)/i,
  /confirmar\s+(o\s+)?(agendamento|hor[aá]rio|data)/i,
  /qual[eE]?\s+(o\s+|a\s+)?hor[aá]rio\s+(dispon[ií]vel|livre)/i,
  /disponibilidade\s+(para|de)\s+(atendimento|visita|instala[cç][aã]o)/i,
  /quando\s+(voc[eê]s?\s+)?(podem?|conseguem?)\s+(vir|visitar|instalar|atender)/i,
  /pode\s+(me\s+)?atender\s+(quando|qual\s+(dia|hor[aá]rio))/i,
  /instalar\s+(quando|qual|a\s+partir)/i,
  /previs[aã]o\s+(de\s+)?(instala[cç][aã]o|visita|entrega)/i,
];

function isSchedulingRequest(text: string): boolean {
  return SCHEDULING_PATTERNS.some((p) => p.test(text));
}

// ─── Fetch pipeline context for a contact ────────────────────────────────────
async function fetchPipelineContext(
  contactId: string | undefined,
  genericRecordRepo: Repository<GenericRecord>,
): Promise<string> {
  if (!contactId) return '';

  try {
    // Find active deals for this contact
    const allDeals = await genericRecordRepo.find({
      where: { collection: 'deals' },
    });

    const contactDeals = allDeals
      .map((r) => r.data)
      .filter(
        (d: any) =>
          d.contactId === contactId &&
          d.lostAt == null &&
          d.wonAt == null,
      );

    if (!contactDeals.length) return '';

    // Load pipeline stages for name resolution
    const stageRecords = await genericRecordRepo.find({
      where: { collection: 'pipeline_stages' },
      order: { updated_at: 'ASC' },
    });
    const stageMap = new Map<string, string>(
      stageRecords.map((r) => [String(r.data.id), String(r.data.title)]),
    );

    const lines: string[] = contactDeals.map((d: any) => {
      const stageName =
        (d.stageId && stageMap.get(String(d.stageId))) || d.stage || 'Desconhecida';
      const value = d.value ? ` — Valor: R$ ${Number(d.value).toLocaleString('pt-BR')}` : '';
      const priority =
        d.priority === 'high'
          ? 'Alta'
          : d.priority === 'medium'
          ? 'Média'
          : 'Baixa';
      return `• "${d.title}" | Etapa: ${stageName}${value} | Prioridade: ${priority}`;
    });

    return (
      '\n\n---\n**Negociações ativas deste contato no pipeline:**\n' +
      lines.join('\n') +
      '\n---'
    );
  } catch (e) {
    logger.warn(`[AiAgent] fetchPipelineContext error: ${String(e)}`);
    return '';
  }
}

// ─── Create appointment record ────────────────────────────────────────────────
async function createAppointmentRecord(
  conversation: Conversation,
  genericRecordRepo: Repository<GenericRecord>,
  events: EventsGateway,
  contactName?: string,
  notes?: string,
): Promise<void> {
  try {
    const id = randomUUID();
    const data = {
      id,
      title: `Agendamento solicitado — ${contactName || 'Cliente'}`,
      contact_id: conversation.contact_id,
      conversation_id: conversation.id,
      status: 'pending',
      source: 'ai_detected',
      notes: notes || 'Solicitação detectada automaticamente pelo assistente virtual.',
      requested_at: new Date().toISOString(),
      scheduled_at: null,
    };

    const ent = genericRecordRepo.create({
      collection: 'appointments',
      record_id: id,
      data,
    });
    await genericRecordRepo.save(ent);

    events.emit('appointment:created', data);

    logger.log(
      `[AiAgent] Appointment record created for conversation ${conversation.id}`,
    );
  } catch (e) {
    logger.warn(`[AiAgent] createAppointmentRecord error: ${String(e)}`);
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ─── Build prompt ─────────────────────────────────────────────────────────────
function buildMessages(
  settings: LiveChatSettings,
  history: Message[],
  contactName?: string,
  pipelineContext?: string,
): ChatMessage[] {
  const now = new Date().toLocaleString('pt-BR', {
    timeZone: settings.timezone || 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  });
  const dayNames = [
    'domingo', 'segunda-feira', 'terça-feira', 'quarta-feira',
    'quinta-feira', 'sexta-feira', 'sábado',
  ];
  const dayName = dayNames[new Date().getDay()];

  let systemPrompt =
    settings.system_prompt_override ||
    `Você é um assistente virtual prestativo. Responda de forma clara e concisa em português.`;

  // Replace template variables
  systemPrompt = systemPrompt
    .replace(/\{\{\s*data_hora\s*\}\}/g, now)
    .replace(/\{\{\s*data\s*\}\}/g, now.split(',')[0]?.trim() ?? '')
    .replace(/\{\{\s*hora\s*\}\}/g, now.split(',')[1]?.trim() ?? '')
    .replace(/\{\{\s*dia_semana\s*\}\}/g, dayName)
    .replace(/\{\{\s*cliente_nome\s*\}\}/g, contactName || 'Cliente')
    .replace(/\{\{\s*cliente_telefone\s*\}\}/g, '');

  // Instruct AI to flag human-transfer intent
  systemPrompt +=
    '\n\nSe o cliente solicitar explicitamente falar com um humano, atendente ou pessoa real, ' +
    'inicie sua resposta exatamente com a tag [TRANSFERIR_HUMANO] seguida da sua mensagem de despedida.';

  // Inject pipeline / deal context if available
  if (pipelineContext) {
    systemPrompt += pipelineContext;
    systemPrompt +=
      '\nUse essas informações para contextualizar suas respostas sobre preços, etapas de venda e próximos passos.';
  }

  // Scheduling awareness
  systemPrompt +=
    '\n\nSe o cliente solicitar um agendamento, visita, reunião ou demonstração, ' +
    'inicie sua resposta exatamente com a tag [AGENDAR_SOLICITADO] seguida da sua mensagem normal confirmando a solicitação.';

  const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }];

  // Add conversation history (last 20 messages)
  for (const msg of history.slice(-20)) {
    if (!msg.content?.trim()) continue;
    const isAI =
      msg.from_type === 'livechat' || msg.direction === 'outbound';
    messages.push({
      role: isAI ? 'assistant' : 'user',
      content: msg.content,
    });
  }

  return messages;
}

// ─── Default base URLs for known providers ──────────────────────────────────
const PROVIDER_BASE_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  groq: 'https://api.groq.com/openai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  together: 'https://api.together.xyz/v1',
  mistral: 'https://api.mistral.ai/v1',
  anthropic: 'https://api.anthropic.com/v1',
  deepseek: 'https://api.deepseek.com/v1',
  ollama: 'http://localhost:11434/v1',
};

// ─── OpenAI-compatible call ───────────────────────────────────────────────────
async function callOpenAI(
  settings: LiveChatSettings,
  messages: ChatMessage[],
): Promise<string> {
  const provider = (settings.ai_provider || 'openai').toLowerCase();
  const baseUrl =
    settings.ai_base_url?.replace(/\/$/, '') ||
    PROVIDER_BASE_URLS[provider] ||
    'https://api.openai.com/v1';
  const model = settings.ai_model || 'gpt-4o-mini';

  logger.log(`[AiAgent] Calling ${provider} (${baseUrl}) model=${model}`);

  const res = await axios.post(
    `${baseUrl}/chat/completions`,
    { model, messages, temperature: 0.7 },
    {
      headers: {
        Authorization: `Bearer ${settings.ai_api_key}`,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    },
  );

  return (res.data?.choices?.[0]?.message?.content as string) || '';
}

// ─── Google Gemini call ───────────────────────────────────────────────────────
async function callGemini(
  settings: LiveChatSettings,
  messages: ChatMessage[],
): Promise<string> {
  const model = settings.ai_model || 'gemini-2.0-flash';
  const apiKey = settings.ai_api_key!;
  const baseUrl =
    settings.ai_base_url?.replace(/\/$/, '') ||
    'https://generativelanguage.googleapis.com/v1beta';

  const systemMsg = messages.find((m) => m.role === 'system');
  const chatMsgs = messages.filter((m) => m.role !== 'system');

  const contents = chatMsgs.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const body: Record<string, unknown> = { contents };
  if (systemMsg) {
    body.systemInstruction = { parts: [{ text: systemMsg.content }] };
  }

  const res = await axios.post(
    `${baseUrl}/models/${model}:generateContent?key=${apiKey}`,
    body,
    { headers: { 'Content-Type': 'application/json' }, timeout: 30_000 },
  );

  return (
    (res.data?.candidates?.[0]?.content?.parts?.[0]?.text as string) || ''
  );
}

// ─── Save AI reply to DB ──────────────────────────────────────────────────────
async function saveAiMessage(
  content: string,
  conversationId: string,
  msgRepo: Repository<Message>,
): Promise<any> {
  const msgId = `ai-${randomUUID()}`;
  const ent = msgRepo.create({
    message_id: msgId,
    whatsapp_message_id: msgId,
    content,
    conversation_id: conversationId,
    direction: 'outbound',
    from_type: 'livechat',
    type: 'chat',
    message_type: 'chat',
    processed_by_livechat: true,
    status: 'sent',
    sent_at: new Date(),
  } as any);
  return msgRepo.save(ent);
}

// ─── Handle human-transfer ────────────────────────────────────────────────────
async function handleHumanTransfer(
  client: wppconnect.Whatsapp,
  chatId: string,
  conversation: Conversation,
  convRepo: Repository<Conversation>,
  msgRepo: Repository<Message>,
  events: EventsGateway,
  farewell?: string,
): Promise<void> {
  const transferText =
    farewell?.trim() ||
    'Entendido! Vou transferir você para um de nossos atendentes. Um momento, por favor. ✋';

  try {
    await (client as any).sendText(chatId, transferText);
  } catch (e) {
    logger.warn(`[AiAgent] sendText (transfer) error: ${String(e)}`);
  }

  await saveAiMessage(transferText, conversation.id, msgRepo);

  await convRepo.update(conversation.id, { status: 'paused' as any });

  events.emit('conversation:updated', {
    id: conversation.id,
    status: 'paused',
    _reason: 'human_requested',
  });

  logger.log(
    `[AiAgent] Conversation ${conversation.id} queued for human agent`,
  );
}

// ─── Main entry-point  ────────────────────────────────────────────────────────
/**
 * Called from OnMessageChanged for every inbound message.
 * Processes the message with the AI agent when the conversation is in
 * 'livechat' mode and AI settings are configured.
 */
export async function processAiAgentMessage(
  message: wppconnect.Message,
  client: wppconnect.Whatsapp,
  conversation: Conversation,
  convRepo: Repository<Conversation>,
  msgRepo: Repository<Message>,
  settingsRepo: Repository<LiveChatSettings>,
  events: EventsGateway,
  contactName?: string,
  genericRecordRepo?: Repository<GenericRecord>,
): Promise<void> {
  try {
    // Only respond to inbound messages while in livechat mode
    if (conversation.status !== 'livechat') return;
    if ((message as any).fromMe) return;
    if (!((message as any).body as string | undefined)?.trim()) return;

    const settings = await settingsRepo.findOne({ where: {} });
    if (!settings?.is_active) return;
    if (!settings?.auto_response_enabled) return;
    if (!settings?.ai_api_key?.trim()) {
      logger.warn('[AiAgent] No AI API key configured — skipping AI response');
      return;
    }

    const body = (message as any).body as string;
    const chatId = (message as any).chatId as string;

    // ── Check for explicit human-transfer request ─────────────────────────
    if (isHumanTransferRequest(body)) {
      await handleHumanTransfer(
        client,
        chatId,
        conversation,
        convRepo,
        msgRepo,
        events,
      );
      return;
    }

    // ── Detect scheduling intent (before calling AI) ──────────────────────
    const schedulingRequested =
      settings.ai_scheduling_enabled && isSchedulingRequest(body);

    // ── Fetch pipeline context for the contact ────────────────────────────
    const pipelineContext =
      genericRecordRepo && conversation.contact_id
        ? await fetchPipelineContext(conversation.contact_id, genericRecordRepo)
        : '';

    // ── Fetch recent conversation history ─────────────────────────────────
    const history = (await msgRepo.find({
      where: { conversation_id: conversation.id } as any,
      order: { sent_at: 'ASC' } as any,
      take: 30,
    })) as Message[];

    // ── Build prompt and add current user message ─────────────────────────
    const chatMessages = buildMessages(settings, history, contactName, pipelineContext || undefined);

    // If scheduling was requested by client, reinforce the instruction
    if (schedulingRequested) {
      chatMessages[0].content +=
        '\n\nIMPORTANTE: O cliente está solicitando um agendamento nesta mensagem. ' +
        'Inicie sua resposta com [AGENDAR_SOLICITADO] e confirme que a solicitação foi registrada ' +
        'e que entrarão em contato para confirmar data e horário.';
    }

    chatMessages.push({ role: 'user', content: body });

    // ── Simulate typing delay ─────────────────────────────────────────────
    const delayMin = settings.response_delay_min ?? 1000;
    const delayMax = settings.response_delay_max ?? 3000;
    const delay =
      Math.floor(Math.random() * (delayMax - delayMin)) + delayMin;
    await new Promise<void>((resolve) => setTimeout(resolve, delay));

    // ── Call the configured AI provider ──────────────────────────────────
    const provider = (settings.ai_provider || 'google').toLowerCase();
    logger.log(
      `[AiAgent] Processing message for conv ${conversation.id} via provider=${provider}, model=${settings.ai_model}`,
    );
    let aiText: string;
    try {
      if (provider === 'google' || provider === 'gemini') {
        aiText = await callGemini(settings, chatMessages);
      } else {
        aiText = await callOpenAI(settings, chatMessages);
      }
    } catch (e: any) {
      const errMsg = String(
        e?.response?.data?.error?.message ||
          e?.response?.data?.message ||
          e?.message ||
          e,
      );
      logger.error(
        `[AiAgent] AI API call failed (provider="${provider}"): ${errMsg}`,
      );
      return;
    }

    if (!aiText?.trim()) return;

    // ── Check if the AI itself detected a human-transfer intent ──────────
    if (aiText.startsWith('[TRANSFERIR_HUMANO]')) {
      const farewell = aiText.replace('[TRANSFERIR_HUMANO]', '').trim();
      await handleHumanTransfer(
        client,
        chatId,
        conversation,
        convRepo,
        msgRepo,
        events,
        farewell || undefined,
      );
      return;
    }

    // ── Handle scheduling-request tag from AI ─────────────────────────────
    let appointmentNotes: string | undefined;
    if (aiText.startsWith('[AGENDAR_SOLICITADO]')) {
      aiText = aiText.replace('[AGENDAR_SOLICITADO]', '').trim();
      appointmentNotes = body; // store what the client said
    } else if (schedulingRequested) {
      // AI didn't tag it but client clearly asked — create appointment anyway
      appointmentNotes = body;
    }

    if (appointmentNotes && genericRecordRepo) {
      await createAppointmentRecord(
        conversation,
        genericRecordRepo,
        events,
        contactName,
        appointmentNotes,
      );
    }

    // ── Send AI reply ─────────────────────────────────────────────────────
    try {
      await (client as any).sendText(chatId, aiText);
    } catch (e) {
      logger.warn(`[AiAgent] sendText error: ${String(e)}`);
      return;
    }

    const saved = await saveAiMessage(aiText, conversation.id, msgRepo);

    // Update conversation timestamp
    await convRepo.update(conversation.id, { last_message_at: new Date() } as any);

    // Notify frontend
    events.emit('message:created', {
      id: saved.id,
      conversation_id: conversation.id,
      content: aiText,
      direction: 'outbound',
      from_type: 'livechat',
      type: 'chat',
      sent_at: new Date().toISOString(),
    });
  } catch (e) {
    logger.error(`[AiAgent] Unexpected error: ${String(e)}`);
  }
}
