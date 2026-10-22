import { HttpError } from './http.js';

/**
 * Optional AI provider. PAID service: Anthropic bills per token. Disabled unless ANTHROPIC_API_KEY is set.
 * The prompt text still comes from scriptPrompts.ts; this module only sends it and returns the draft.
 */

export interface AiResult {
  text: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  truncated: boolean;
}

const DEFAULT_MODEL = 'claude-haiku-5-5';

export function aiConfig(): { enabled: boolean; model: string; dailyLimit: number } {
  const dailyLimit = Number.parseInt(process.env.AI_DAILY_LIMIT ?? '', 10);
  return {
    enabled: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    model: process.env.AI_MODEL?.trim() || DEFAULT_MODEL,
    dailyLimit: Number.isFinite(dailyLimit) && dailyLimit > 0 ? Math.min(dailyLimit, 500) : 20,
  };
}

interface AnthropicResponse {
  content?: { type: string; text?: string }[];
  model?: string;
  stop_reason?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export async function generateText(prompt: string, maxTokens: number): Promise<AiResult> {
  const config = aiConfig();
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!config.enabled || !apiKey) throw new HttpError(501, 'not_configured', 'AI সংযোগ চালু করা হয়নি (ANTHROPIC_API_KEY নেই)।');

  let response: Response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: config.model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
      signal: AbortSignal.timeout(55_000),
    });
  } catch {
    throw new HttpError(504, 'ai_timeout', 'AI সার্ভার সময়মতো উত্তর দেয়নি। আবার চেষ্টা করুন বা প্রম্পট কপি করে হাতে চালান।');
  }

  if (!response.ok) {
    // Never forward the provider's body: it could echo request details.
    const message =
      response.status === 401 || response.status === 403 ? 'AI API কী সঠিক নয় বা অনুমতি নেই।'
      : response.status === 404 ? 'AI মডেলের নাম সঠিক নয় (AI_MODEL পরীক্ষা করুন)।'
      : response.status === 429 ? 'AI ব্যবহারের সীমা পার হয়েছে। কিছুক্ষণ পরে চেষ্টা করুন।'
      : response.status >= 500 ? 'AI সেবা এখন ব্যস্ত। কিছুক্ষণ পরে চেষ্টা করুন।'
      : 'AI অনুরোধ সম্পন্ন হয়নি।';
    throw new HttpError(502, 'ai_error', message);
  }

  const data = (await response.json()) as AnthropicResponse;
  const text = (data.content ?? []).filter((block) => block.type === 'text' && typeof block.text === 'string').map((block) => block.text as string).join('\n').trim();
  if (!text) throw new HttpError(502, 'ai_empty', 'AI কোনো লেখা ফেরত দেয়নি।');
  return {
    text,
    model: data.model ?? config.model,
    inputTokens: data.usage?.input_tokens,
    outputTokens: data.usage?.output_tokens,
    truncated: data.stop_reason === 'max_tokens',
  };
}
