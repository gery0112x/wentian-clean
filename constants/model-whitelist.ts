// /constants/model-whitelist.ts
export const MODEL_WHITELIST: Record<string, string[]> = {
  openai:  ['gpt-4o', 'gpt-4o-mini'],
  deepseek:['deepseek-chat'],
  grok:    ['grok-beta'],
  gemini:  ['gemini-1.5-flash'],
};

export function isAllowed(provider: string, model: string): boolean {
  return (MODEL_WHITELIST[provider] ?? []).includes(model);
}
