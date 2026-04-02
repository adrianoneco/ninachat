import axios from 'axios';
import { Repository } from 'typeorm';
import * as wppconnect from '@wppconnect-team/wppconnect';
import { randomUUID } from 'crypto';
import { Logger } from '@nestjs/common';

import { LiveChatSettings } from '../entities/livechat-settings.entity';
import { Message } from '../entities/message.entity';
import { Conversation } from '../entities/conversation.entity';
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

// ─── OpenAI-compatible call ───────────────────────────────────────────────────
async function callOpenAI(
  settings: LiveChatSettings,
  messages: ChatMessage[],
): Promise<string> {
  const baseUrl =
    settings.ai_base_url?.replace(/\/$/, '') || 'https://api.openai.com/v1';
  const model = settings.ai_model || 'gpt-4o-mini';

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

    // ── Fetch recent conversation history ─────────────────────────────────
    const history = (await msgRepo.find({
      where: { conversation_id: conversation.id } as any,
      order: { sent_at: 'ASC' } as any,
      take: 30,
    })) as Message[];

    // ── Build prompt and add current user message ─────────────────────────
    const chatMessages = buildMessages(settings, history, contactName);
    chatMessages.push({ role: 'user', content: body });

    // ── Simulate typing delay ─────────────────────────────────────────────
    const delayMin = settings.response_delay_min ?? 1000;
    const delayMax = settings.response_delay_max ?? 3000;
    const delay =
      Math.floor(Math.random() * (delayMax - delayMin)) + delayMin;
    await new Promise<void>((resolve) => setTimeout(resolve, delay));

    // ── Call the configured AI provider ──────────────────────────────────
    const provider = (settings.ai_provider || 'google').toLowerCase();
    let aiText: string;
    try {
      if (provider === 'google') {
        aiText = await callGemini(settings, chatMessages);
      } else {
        aiText = await callOpenAI(settings, chatMessages);
      }
    } catch (e: any) {
      logger.error(
        `[AiAgent] AI API call failed (provider="${provider}"): ${String(e?.response?.data?.error?.message || e?.message || e)}`,
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
