import {
  APP_RECOMMENDATION_PROVIDER_ORDER,
  type AppAiProvider,
} from "./app-ai-chain.ts";

export type ResultModelOption = {
  provider: AppAiProvider;
  model: string;
  label: string;
  description: string;
};

const RESULT_MODEL_METADATA: Readonly<
  Record<AppAiProvider, Omit<ResultModelOption, "provider">>
> = {
  "dmxapi-mimo": {
    model: "mimo-v2.5-free",
    label: "Mimo（DMX）",
    description: "默认先试它，结果通常更稳妥。",
  },
  "dmxapi-minimax": {
    model: "MiniMax-M2.7-free",
    label: "MiniMax（DMX）",
    description: "想看更详细的推荐解释，可以试它。",
  },
  "dmxapi-qwen": {
    model: "qwen3.5-plus-free",
    label: "Qwen（DMX）",
    description: "想要更干脆清晰的结果，可以试它。",
  },
  "dmxapi-glm": {
    model: "glm-5.1-free",
    label: "GLM（DMX）",
    description: "想快速看一版明确建议，可以试它。",
  },
  "dmxapi-kimi": {
    model: "kimi-k2.6-free",
    label: "Kimi（DMX）",
    description: "想看更自然顺滑的说明文字，可以试它。",
  },
  deepseek: {
    model: "deepseek-v4-flash",
    label: "DeepSeek（官方）",
    description: "想看更直接利落的一版结果，可以试它。",
  },
  qwen: {
    model: "qwen-max",
    label: "Qwen（官方）",
    description: "想再换个稳定一点的视角，也可以试它。",
  },
  glm: {
    model: "glm-4.5-air",
    label: "GLM（官方）",
    description: "想快速再看一版结果，可以试它。",
  },
};

function buildResultModelOptions(): readonly Readonly<ResultModelOption>[] {
  const options = APP_RECOMMENDATION_PROVIDER_ORDER.map((provider) =>
    Object.freeze({
      provider,
      ...RESULT_MODEL_METADATA[provider],
    }),
  );
  const metadataProviders = Object.keys(RESULT_MODEL_METADATA);

  if (metadataProviders.length !== options.length) {
    throw new Error("Result model metadata is out of sync with provider order");
  }

  return Object.freeze(options);
}

export const RESULT_MODEL_OPTIONS = buildResultModelOptions();

export const DEFAULT_RESULT_MODEL_PROVIDER =
  APP_RECOMMENDATION_PROVIDER_ORDER[0];

export function getResultModelOption(provider: string | null | undefined) {
  return RESULT_MODEL_OPTIONS.find((option) => option.provider === provider);
}

export function getSafeSelectedResultProvider(
  provider: string | null | undefined,
): AppAiProvider {
  return getResultModelOption(provider)?.provider ?? DEFAULT_RESULT_MODEL_PROVIDER;
}
