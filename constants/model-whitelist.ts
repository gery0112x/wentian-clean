// constants/model-whitelist.ts
export const MODEL_WHITELIST = {
  openai: ['gpt-4o','gpt-4o-mini'],
  deepseek: ['deepseek-chat'],
  grok: ['grok-beta'],
  gemini: ['gemini-1.5-flash'],
} as const;

export function isAllowed(provider: keyof typeof MODEL_WHITELIST, model: string){
  return MODEL_WHITELIST[provider].includes(model);
}
