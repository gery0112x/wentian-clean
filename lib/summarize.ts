// /lib/summarize.ts
import { env } from './env';

type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

/**
 * 將對話壓縮成短摘要
 * @param messages 對話陣列
 * @param model （可選）模型，預設取 env.OPENAI_MODEL
 */
export async function summarizeHistory(
  messages: Msg[] = [],
  model: string = env.OPENAI_MODEL || 'gpt-4o'
): Promise<string> {
  try {
    const condensed = (messages || [])
      .map(m => `${m.role}: ${m.content}`)
      .join('\n')
      .slice(-8000); // 粗略截斷，避免太長

    const payload = {
      model,
      temperature: 0,
      messages: [
        { role: 'system', content: '請把以下對話濃縮成一句話要點摘要。' },
        { role: 'user', content: condensed }
      ]
    };

    const r = await fetch(`${env.OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!r.ok) return '';
    const data = await r.json();
    return data?.choices?.[0]?.message?.content?.trim?.() ?? '';
  } catch {
    return '';
  }
}
