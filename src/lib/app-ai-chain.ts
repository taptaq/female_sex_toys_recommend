export const APP_RECOMMENDATION_PROVIDER_ORDER = [
  "dmxapi-mimo",
  "qnaigc-minimax",
  "dmxapi-minimax",
  "qnaigc-qwen",
  "dmxapi-qwen",
  "qnaigc-glm",
  "dmxapi-glm",
  "kimi",
  "dmxapi-claude",
  "dmxapi-gemini",
  "dmxapi-grok",
  "dmxapi-gpt",
  "deepseek",
  "qwen",
  "glm",
] as const;

export type AppAiProvider = (typeof APP_RECOMMENDATION_PROVIDER_ORDER)[number];

export function getPrimaryAppAiProvider(): AppAiProvider {
  return APP_RECOMMENDATION_PROVIDER_ORDER[0];
}
