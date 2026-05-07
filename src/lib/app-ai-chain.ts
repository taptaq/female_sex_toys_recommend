export const APP_RECOMMENDATION_PROVIDER_ORDER = [
  "dmxapi-mimo",
  "dmxapi-minimax",
  "dmxapi-qwen",
  "dmxapi-glm",
  "dmxapi-kimi",
  "dmxapi-claude",
  "dmxapi-gemini",
  "dmxapi-grok",
  "dmxapi-gpt",
  "dmxapi-kimi-k2",
  "deepseek",
  "qwen",
  "glm",
] as const;

export type AppAiProvider = (typeof APP_RECOMMENDATION_PROVIDER_ORDER)[number];

export function getPrimaryAppAiProvider(): AppAiProvider {
  return APP_RECOMMENDATION_PROVIDER_ORDER[0];
}
