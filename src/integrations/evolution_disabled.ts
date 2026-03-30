export type EvolutionConfig = {
  url: string;
  apiKey?: string | null;
};

export async function sendEvolutionMessage(config: EvolutionConfig, to: string, content: string) {
  if (!config || !config.url) throw new Error('Evolution config missing');

  const payload = {
    to,
    content,
  };

  const res = await fetch(`${config.url.replace(/\/$/, '')}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Evolution API error: ${res.status} ${text}`);
  }

  return res.json();
}

// Normaliza o payload de webhook recebido da Evolution para o formato interno da app
export function normalizeEvolutionWebhook(payload: any) {
  // Tenta extrair campos comuns: from, to, text, id, timestamp
  const from = payload?.from || payload?.sender || payload?.contact || null;
  const to = payload?.to || payload?.receiver || null;
  const content = payload?.text || payload?.message || payload?.body || null;
  const id = payload?.id || payload?.message_id || payload?.event_id || null;
  const timestamp = payload?.timestamp || payload?.ts || payload?.time || new Date().toISOString();

  return {
    provider: 'evolution',
    id,
    from,
    to,
    content,
    timestamp,
    raw: payload,
  };
}
