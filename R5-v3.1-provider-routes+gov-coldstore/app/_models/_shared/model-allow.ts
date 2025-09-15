export const ALLOW: Record<string, string[]> = {
  openai: ['gpt-4o','gpt-4o-mini'],
  deepseek: ['deepseek-chat'],
  grok: ['grok-2','grok-2-mini'],
  gemini: ['gemini-1.5-pro','gemini-1.5-flash'],
};

export function assertModel(provider: string, model?: string) {
  if (!model) {
    return new Response(JSON.stringify({ ok:false, error:'MODEL_REQUIRED', allow: ALLOW[provider]||[] }), { status: 422 });
  }
  const ok = ALLOW[provider]?.includes(model);
  if (!ok) {
    return new Response(JSON.stringify({ ok:false, error:'MODEL_NOT_ALLOWED', allow: ALLOW[provider]||[] }), { status: 422 });
  }
  return null;
}