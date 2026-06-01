import OpenAI from "openai";
import {
  APP_RECOMMENDATION_PROVIDER_ORDER,
  type AppAiProvider,
} from "../lib/app-ai-chain.js";
import {
  buildBackupCandidates,
  buildLocalBackupReason,
  buildLocalShoppingGuidance,
  type BackupCandidate,
  type RecommendationAnswers,
  type RecommendationRankedProduct,
} from "../lib/recommendation-results.js";
import {
  getResultModelOption,
  type ResultModelOption,
} from "../lib/result-models.js";
import type {
  ResultRecalibrationRequest,
  ResultRecalibrationResponse,
  ResultRecalibrationContext,
} from "../lib/result-recalibration.js";
import {
  getRecommendationRerollReasonLabel,
  getRecommendationRerollReasonPromptHint,
} from "../lib/recommendation-reroll.js";
import { buildProductDescriptionSignalsSummary } from "../lib/product-description-signals.js";
import { buildProductDisguiseSignalsSummary } from "../lib/product-disguise-signals.js";
import { getProductDisplayName } from "../lib/product-display-name.js";
import { buildRecommendationPreferenceSignals } from "../lib/recommendation-preference-signals.js";
import { runAppAiProviderLadder } from "./app-ai-proxy.js";

const FINAL_SELECTION_COUNT = 3;
const BACKUP_SELECTION_COUNT = 3;
const MAX_SHOPPING_GUIDANCE_COUNT = 5;
const DEFAULT_AI_MAX_TOKENS = 4096;
const RERANK_AI_MAX_TOKENS = 1200;
const ENHANCEMENT_AI_MAX_TOKENS = 1800;
export const RERANK_PROVIDER_TIMEOUT_MS = 45_000;
export const ENHANCEMENT_PROVIDER_TIMEOUT_MS = 60_000;

const PROVIDER_LABELS: Record<AppAiProvider, string> = {
  "dmxapi-mimo": "DMXAPI Mimo",
  "qnaigc-minimax": "七牛云 MiniMax",
  "dmxapi-minimax": "DMXAPI MiniMax",
  "qnaigc-qwen": "七牛云 Qwen",
  "dmxapi-qwen": "DMXAPI Qwen",
  "qnaigc-glm": "七牛云 GLM",
  "dmxapi-glm": "DMXAPI GLM",
  kimi: "Kimi 官方",
  "dmxapi-claude": "DMXAPI Claude",
  "dmxapi-gemini": "DMXAPI Gemini",
  "dmxapi-grok": "DMXAPI Grok",
  "dmxapi-gpt": "DMXAPI GPT",
  deepseek: "DeepSeek",
  qwen: "Qwen",
  glm: "GLM",
};

const PROVIDER_RUNTIME_CONFIG: Record<
  AppAiProvider,
  {
    apiKeyEnv: string;
    baseURL: string;
    temperature?: number;
    topP?: number;
  }
> = {
  "dmxapi-mimo": {
    apiKeyEnv: "DMXAPI_API_KEY",
    baseURL: "https://www.dmxapi.cn/v1",
    topP: 0.95,
  },
  "qnaigc-minimax": {
    apiKeyEnv: "QNAIGC_API_KEY",
    baseURL: "https://api.qnaigc.com/v1",
    topP: 0.95,
  },
  "dmxapi-minimax": {
    apiKeyEnv: "DMXAPI_API_KEY",
    baseURL: "https://www.dmxapi.cn/v1",
    topP: 0.95,
  },
  "qnaigc-qwen": {
    apiKeyEnv: "QNAIGC_API_KEY",
    baseURL: "https://api.qnaigc.com/v1",
    topP: 0.95,
  },
  "dmxapi-qwen": {
    apiKeyEnv: "DMXAPI_API_KEY",
    baseURL: "https://www.dmxapi.cn/v1",
    topP: 0.95,
  },
  "qnaigc-glm": {
    apiKeyEnv: "QNAIGC_API_KEY",
    baseURL: "https://api.qnaigc.com/v1",
    topP: 1,
  },
  "dmxapi-glm": {
    apiKeyEnv: "DMXAPI_API_KEY",
    baseURL: "https://www.dmxapi.cn/v1",
    topP: 1,
  },
  kimi: {
    apiKeyEnv: "MOONSHOT_API_KEY",
    baseURL: "https://api.moonshot.cn/v1",
    temperature: 1,
  },
  "dmxapi-claude": {
    apiKeyEnv: "DMXAPI_API_KEY",
    baseURL: "https://www.dmxapi.cn/v1",
    topP: 1,
  },
  "dmxapi-gemini": {
    apiKeyEnv: "DMXAPI_API_KEY",
    baseURL: "https://www.dmxapi.cn/v1",
    topP: 1,
  },
  "dmxapi-grok": {
    apiKeyEnv: "DMXAPI_API_KEY",
    baseURL: "https://www.dmxapi.cn/v1",
    topP: 1,
  },
  "dmxapi-gpt": {
    apiKeyEnv: "DMXAPI_API_KEY",
    baseURL: "https://www.dmxapi.cn/v1",
    topP: 1,
  },
  deepseek: {
    apiKeyEnv: "DEEPSEEK_API_KEY",
    baseURL: "https://api.deepseek.com/v1",
  },
  qwen: {
    apiKeyEnv: "QWEN_API_KEY",
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  },
  glm: {
    apiKeyEnv: "GLM_API_KEY",
    baseURL: "https://open.bigmodel.cn/api/paas/v4/",
  },
};

const PROXY_PROVIDER_MODELS: Record<AppAiProvider, string> = {
  "dmxapi-mimo": "mimo-v2.5-pro",
  "qnaigc-minimax": "minimax/minimax-m3",
  "dmxapi-minimax": "MiniMax-M2.7-free",
  "qnaigc-qwen": "qwen/qwen3.6-plus",
  "dmxapi-qwen": "qwen3.5-27b",
  "qnaigc-glm": "z-ai/glm-5.1",
  "dmxapi-glm": "glm-5",
  kimi: "kimi-k2.6",
  "dmxapi-claude": "claude-opus-4-7",
  "dmxapi-gemini": "gemini-3.1-pro-preview-ssvip",
  "dmxapi-grok": "grok-4.2-nothinking",
  "dmxapi-gpt": "gpt-5.4",
  deepseek: "deepseek-v4-flash",
  qwen: "qwen-turbo",
  glm: "glm-4.6v",
};

type RankedProductWithReason = RecommendationRankedProduct & {
  reason: string;
};

type BackupReasonResult = {
  id: string;
  reason: string;
};

type ResultEnhancementPayload = {
  backupProducts?: BackupReasonResult[];
  shoppingGuidance?: string[];
};

type RecalibrationPlan = {
  rerankProvider: AppAiProvider;
  enhancementProvider: AppAiProvider;
  fallbackOrder: AppAiProvider[];
};

const RERANK_REROLL_ROTATION_ORDER: readonly AppAiProvider[] = Object.freeze([
  ...APP_RECOMMENDATION_PROVIDER_ORDER.slice(1),
  APP_RECOMMENDATION_PROVIDER_ORDER[0],
]);

const DEFAULT_RECALIBRATION_FALLBACK_ORDER: readonly AppAiProvider[] = Object.freeze([
  "qnaigc-minimax",
  "qnaigc-qwen",
  "qnaigc-glm",
  "dmxapi-minimax",
  "dmxapi-qwen",
  "dmxapi-mimo",
  "dmxapi-glm",
  "kimi",
  "dmxapi-claude",
  "dmxapi-gemini",
  "dmxapi-grok",
  "dmxapi-gpt",
  "deepseek",
  "qwen",
  "glm",
]);

export type AiProxyEnvelope<T> = {
  data: T;
  modelName: string;
  provider: AppAiProvider;
};

export type ChatCompletionRequest = {
  apiKey: string;
  baseURL: string;
  model: string;
  prompt: string;
  temperature: number;
  topP?: number;
  maxTokens?: number;
  timeoutMs?: number;
};

type Logger = Pick<Console, "log" | "warn">;

type ChatCompletionRunner = (
  request: ChatCompletionRequest,
) => Promise<string | null | undefined>;

function normalizeJsonResponse(content: string | null | undefined) {
  return String(content || "")
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .replace(/,\s*([}\]])/g, "$1")
    .trim();
}

function requireKey(value: string | undefined, label: string) {
  if (!value) {
    throw new Error(`Missing ${label}`);
  }

  return value;
}

function normalizeReason(value: unknown) {
  return String(value || "").trim();
}

function dedupeProviderOrder(order: AppAiProvider[]) {
  return order.filter((provider, index) => order.indexOf(provider) === index);
}

function hasWeakReason(reason: string) {
  const normalized = String(reason || "").trim();
  if (!normalized) return true;
  if (normalized.length <= 8) return true;
  return /适合你|也适合你|匹配度高|综合表现好/.test(normalized);
}

function buildLocalReason(
  product: RecommendationRankedProduct,
  answers: RecommendationAnswers,
) {
  const summary = product.matchSummary?.slice(0, 3) ?? [];
  if (summary.length > 0) return summary.join("，");

  if (answers.physicalForm && product.physicalForm === answers.physicalForm) {
    return "结构取向贴近你的核心刺激偏好";
  }
  if (answers.motorType && product.motorType === answers.motorType) {
    return answers.motorType === "gentle"
      ? "节奏更温和，适合慢慢进入状态"
      : "输出更直接，适合追求强反馈体验";
  }
  if (
    answers.budget &&
    product.price >= answers.budget[0] &&
    product.price <= answers.budget[1]
  ) {
    return "预算友好，能更稳地落在你的预期区间";
  }
  return "综合表现均衡，适合作为当前偏好的稳妥选择";
}

function finalizeRankedProducts(
  products: RecommendationRankedProduct[],
  reasonMap: Map<string, string>,
  answers: RecommendationAnswers,
): RankedProductWithReason[] {
  return products.map((product) => ({
    ...product,
    reason: reasonMap.get(product.id) || buildLocalReason(product, answers),
  }));
}

function finalizeBackupProducts(
  products: BackupCandidate[],
  reasonMap: Map<string, string>,
): BackupCandidate[] {
  return products.map((product) => ({
    ...product,
    backupReason:
      reasonMap.get(product.id) ||
      buildLocalBackupReason(product, product.backupLabel),
  }));
}

function buildRerankPrompt(
  answers: RecommendationAnswers,
  rankedProducts: RecommendationRankedProduct[],
  rerollContext?: Pick<ResultRecalibrationContext, "rerollReason">,
) {
  const context = {
    userPreferences: answers.tags,
    preferenceSignals: buildRecommendationPreferenceSignals(answers).map(
      (signal) => signal.label,
    ),
    rankedProducts: rankedProducts.map((product, index) => ({
      rank: index + 1,
      id: product.id,
      name: getProductDisplayName(product),
      brand: product.brand,
      price: product.price,
      gender: product.gender,
      physicalForm: product.physicalForm,
      appearance: product.appearance,
      specs: `${product.material}, ${product.waterproof == null ? "无防水参数" : `IPX${product.waterproof}`}, ${product.maxDb == null ? "无噪音参数" : `<${product.maxDb}dB`}, ${product.motorType}马达`,
      tags: product.tags?.join(", ") || "",
      structuredScore: product.score,
      matchSummary: product.matchSummary?.join("、") || "",
      descriptionSignals: buildProductDescriptionSignalsSummary(product),
      disguiseSignals: buildProductDisguiseSignalsSummary(product),
    })),
  };

  return `
你是一个专业的个人护理设备选品助手。
当前候选池已经由结构化规则筛到较小范围。请你在这些候选商品中，重新挑选最匹配的前 3 名，并给出每个商品的推荐理由。

用户偏好标签: [${context.userPreferences.join(", ")}]
用户结构化偏好信号: ${JSON.stringify({ preferenceSignals: context.preferenceSignals })}
用户这次希望重看推荐的原因: ${getRecommendationRerollReasonLabel(
    rerollContext?.rerollReason ?? "want_more_accurate",
  )}
重看意图提示: ${getRecommendationRerollReasonPromptHint(rerollContext?.rerollReason)}

候选商品列表（已按结构化分数从高到低排序，仅可从中选择）:
${JSON.stringify(context.rankedProducts)}

请仅返回如下格式的 JSON 数组（不要包含任何 Markdown 格式或多余文字）：
[
  { "id": "产品ID", "reason": "30字以内的推荐理由" },
  ...
]

要求：
1. 只能从候选商品列表中选择，严禁输出列表外的 id。
2. 最多返回 3 个，顺序就是你最终认定的 Top1 到 Top3。
3. 推荐理由必须体现该商品为什么适合当前偏好，避免空泛夸张。
4. 用中文输出，简洁自然，不要重复同一句话。
5. 请综合用户标签、preferenceSignals、结构化分数、matchSummary、descriptionSignals、disguiseSignals、价格、噪音、防水、刺激形式来判断，不要只看单一字段。
6. 高伪装偏好下，优先考虑明确非传统设备外观、日用品/装饰物造型、口红/玫瑰/香水/挂件等伪装信号；不要仅凭抽象“高伪装”标签自由发挥。`;
}

function buildResultEnhancementPrompt(
  answers: RecommendationAnswers,
  finalTopProducts: RankedProductWithReason[],
  backupCandidates: BackupCandidate[],
  filteredCount: number,
  rerollContext?: Pick<ResultRecalibrationContext, "rerollReason">,
) {
  const context = {
    userPreferences: answers.tags,
    filteredCount,
    topProducts: finalTopProducts.map((product, index) => ({
      rank: index + 1,
      id: product.id,
      name: getProductDisplayName(product),
      brand: product.brand,
      price: product.price,
      reason: product.reason,
      descriptionSignals: buildProductDescriptionSignalsSummary(product),
      disguiseSignals: buildProductDisguiseSignalsSummary(product),
    })),
    backupCandidates: backupCandidates.map((product, index) => ({
      rank: index + 1,
      id: product.id,
      name: getProductDisplayName(product),
      brand: product.brand,
      price: product.price,
      backupLabel: product.backupLabel,
      structuredScore: product.score,
      matchSummary: product.matchSummary?.join("、") || "",
      descriptionSignals: buildProductDescriptionSignalsSummary(product),
      disguiseSignals: buildProductDisguiseSignalsSummary(product),
      localReason: buildLocalBackupReason(product, product.backupLabel),
    })),
  };

  return `
你是一个专业的个人护理设备选品助手。
Top 3 主推荐已经确定，请只补充两个结果区域：
1. 为备选卡片写一句简短说明
2. 为结果页写 3-5 条选购建议

用户偏好标签: [${context.userPreferences.join(", ")}]
候选池数量: ${context.filteredCount}
用户这次希望重看推荐的原因: ${getRecommendationRerollReasonLabel(
    rerollContext?.rerollReason ?? "want_more_accurate",
  )}
重看意图提示: ${getRecommendationRerollReasonPromptHint(rerollContext?.rerollReason)}

已确定 Top 3（仅供参考，不需要重排）:
${JSON.stringify(context.topProducts)}

备选候选（只能基于这些 id 输出说明）:
${JSON.stringify(context.backupCandidates)}

请仅返回如下格式的 JSON 对象（不要包含任何 Markdown 格式或多余文字）：
{
  "backupProducts": [
    { "id": "产品ID", "reason": "20字以内的备选说明" }
  ],
  "shoppingGuidance": ["建议1", "建议2", "建议3"]
}

要求：
1. 不要改动 Top 3 排名，也不要输出列表外的 id。
2. backupProducts 只为备选卡片补一句简短说明，语气自然，不要和 Top 3 推荐理由重复。
3. shoppingGuidance 返回 3-5 条中文建议，尽量具体，帮助用户做最终购买判断。
4. 建议可以参考静音、预算、防水、外观隐蔽、刺激方向、清洁维护等维度。
5. 如果备选数量不足，也只返回实际存在的备选说明。`;
}

function defaultChatCompletionRunner({
  apiKey,
  baseURL,
  model,
  prompt,
  temperature,
  topP,
  maxTokens = DEFAULT_AI_MAX_TOKENS,
  timeoutMs,
}: ChatCompletionRequest) {
  const openai = new OpenAI({
    apiKey,
    baseURL,
  });
  const abortController = new AbortController();
  const timeoutId =
    timeoutMs && timeoutMs > 0
      ? setTimeout(() => abortController.abort(), timeoutMs)
      : undefined;

  return openai.chat.completions
    .create({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature,
      top_p: topP,
      max_tokens: maxTokens,
    }, {
      signal: abortController.signal,
    })
    .then((response) => response.choices[0].message.content)
    .finally(() => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    });
}

export function createAppAiService({
  env = process.env,
  logger = console,
  chatCompletionRunner = defaultChatCompletionRunner,
}: {
  env?: NodeJS.ProcessEnv;
  logger?: Logger;
  chatCompletionRunner?: ChatCompletionRunner;
} = {}) {
  function getProviderModel(provider: AppAiProvider): ResultModelOption {
    const option = getResultModelOption(provider);

    if (!option) {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    return option;
  }

  async function callAndParseJson<T>(
    request: ChatCompletionRequest,
    emptyJson: string,
  ) {
    const content = await chatCompletionRunner(request);
    return JSON.parse(normalizeJsonResponse(content) || emptyJson) as T;
  }

  function buildProviderExecutors<T>({
    prompt,
    temperature,
    emptyJson,
    logContext,
    resolveModel,
    maxTokens = DEFAULT_AI_MAX_TOKENS,
    timeoutMs,
  }: {
    prompt: string;
    temperature: number;
    emptyJson: string;
    logContext: string;
    resolveModel: (provider: AppAiProvider) => string;
    maxTokens?: number;
    timeoutMs?: number;
  }): Record<AppAiProvider, () => Promise<AiProxyEnvelope<T>>> {
    return APP_RECOMMENDATION_PROVIDER_ORDER.reduce(
      (executors, provider) => {
        executors[provider] = async () => {
          const modelName = resolveModel(provider);
          const runtimeConfig = PROVIDER_RUNTIME_CONFIG[provider];
          logger.log(
            `🤖 [Server/AI] ${logContext}: 尝试 ${PROVIDER_LABELS[provider]}...`,
          );

          const request: ChatCompletionRequest = {
            apiKey: requireKey(
              env[runtimeConfig.apiKeyEnv],
              runtimeConfig.apiKeyEnv,
            ),
            baseURL: runtimeConfig.baseURL,
            model: modelName,
            prompt,
            temperature: runtimeConfig.temperature ?? temperature,
            maxTokens,
            ...(runtimeConfig.topP == null ? {} : { topP: runtimeConfig.topP }),
            ...(timeoutMs == null ? {} : { timeoutMs }),
          };

          const data = await callAndParseJson<T>(request, emptyJson);
          return {
            data,
            modelName,
            provider,
          };
        };

        return executors;
      },
      {} as Record<AppAiProvider, () => Promise<AiProxyEnvelope<T>>>,
    );
  }

  function createProviderExecutors<T>({
    prompt,
    temperature,
    emptyJson,
    logContext,
    maxTokens,
    timeoutMs,
  }: {
    prompt: string;
    temperature: number;
    emptyJson: string;
    logContext: string;
    maxTokens?: number;
    timeoutMs?: number;
  }) {
    return buildProviderExecutors<T>({
      prompt,
      temperature,
      emptyJson,
      logContext,
      maxTokens,
      timeoutMs,
      resolveModel(provider) {
        return getProviderModel(provider).model;
      },
    });
  }

  function runSingleProvider<T>({
    provider,
    prompt,
    temperature,
    emptyJson,
    logContext,
    maxTokens,
    timeoutMs,
  }: {
    provider: AppAiProvider;
    prompt: string;
    temperature: number;
    emptyJson: string;
    logContext: string;
    maxTokens?: number;
    timeoutMs?: number;
  }) {
    return createProviderExecutors<T>({
      prompt,
      temperature,
      emptyJson,
      logContext,
      maxTokens,
      timeoutMs,
    })[provider]();
  }

  function runServerAiProxy<T>({
    prompt,
    temperature,
    emptyJson,
    logContext,
    providerOrder = APP_RECOMMENDATION_PROVIDER_ORDER,
    maxTokens = DEFAULT_AI_MAX_TOKENS,
    providerTimeoutMs,
  }: {
    prompt: string;
    temperature: number;
    emptyJson: string;
    logContext: string;
    providerOrder?: readonly AppAiProvider[];
    maxTokens?: number;
    providerTimeoutMs?: number;
  }) {
    const providers = buildProviderExecutors<T>({
      prompt,
      temperature,
      emptyJson,
      logContext,
      maxTokens,
      timeoutMs: providerTimeoutMs,
      resolveModel(provider) {
        return PROXY_PROVIDER_MODELS[provider];
      },
    });

    return runAppAiProviderLadder({
      providerOrder,
      providers,
      providerTimeoutMs,
      onProviderError(provider, error) {
        logger.warn(
          `⚠️ [Server/AI] ${logContext}: ${PROVIDER_LABELS[provider]} 失败，继续下一个兜底...`,
          error,
        );
      },
    });
  }

  function resolveRecalibrationPlan(
    context: ResultRecalibrationContext | undefined,
  ): RecalibrationPlan {
    const attemptCount = Math.max(1, context?.attemptCount || 1);
    const rerankProvider =
      RERANK_REROLL_ROTATION_ORDER[
        (attemptCount - 1) % RERANK_REROLL_ROTATION_ORDER.length
      ];
    const enhancementProvider: AppAiProvider = "dmxapi-qwen";
    const fallbackOrder = dedupeProviderOrder([
      rerankProvider,
      ...DEFAULT_RECALIBRATION_FALLBACK_ORDER,
    ]);

    return {
      rerankProvider,
      enhancementProvider,
      fallbackOrder,
    };
  }

  async function runResultRecalibration({
    answers,
    rerankPool,
    rankedCandidates,
    filteredCount,
    recommendationTips,
    recalibrationContext,
  }: ResultRecalibrationRequest): Promise<ResultRecalibrationResponse> {
    const recalibrationPlan = resolveRecalibrationPlan(recalibrationContext);
    const rerankProviderOrder = dedupeProviderOrder([
      recalibrationPlan.rerankProvider,
      ...recalibrationPlan.fallbackOrder,
    ]);
    const rerankResult = await runServerAiProxy<BackupReasonResult[]>({
      prompt: buildRerankPrompt(answers, rerankPool, recalibrationContext),
      temperature: 0.1,
      emptyJson: "[]",
      logContext: "结果重校准 Top3 重排",
      providerOrder: rerankProviderOrder,
      maxTokens: RERANK_AI_MAX_TOKENS,
      providerTimeoutMs: RERANK_PROVIDER_TIMEOUT_MS,
    });
    const reasonMap = new Map<string, string>();
    const poolById = new Map(rerankPool.map((product) => [product.id, product]));
    const orderedProducts: RecommendationRankedProduct[] = [];
    const seen = new Set<string>();

    for (const item of rerankResult.data) {
      const matched = poolById.get(item?.id);
      if (!matched || seen.has(matched.id)) continue;
      seen.add(matched.id);
      orderedProducts.push(matched);

      const reason = normalizeReason(item?.reason);
      if (reason) {
        reasonMap.set(matched.id, reason);
      }
    }

    for (const product of rerankPool) {
      if (orderedProducts.length >= FINAL_SELECTION_COUNT) break;
      if (seen.has(product.id)) continue;
      seen.add(product.id);
      orderedProducts.push(product);
    }

    const topProducts = finalizeRankedProducts(
      orderedProducts.slice(0, FINAL_SELECTION_COUNT),
      reasonMap,
      answers,
    );
    const backupCandidates = buildBackupCandidates(
      rankedCandidates,
      topProducts.map((product) => product.id),
      BACKUP_SELECTION_COUNT,
    );
    const enhancementResult = await runServerAiProxy<ResultEnhancementPayload>({
      prompt: buildResultEnhancementPrompt(
        answers,
        topProducts,
        backupCandidates,
        filteredCount,
        recalibrationContext,
      ),
      temperature: 0.3,
      emptyJson: "{}",
      logContext: "结果重校准 备选说明与选购建议",
      maxTokens: ENHANCEMENT_AI_MAX_TOKENS,
      providerTimeoutMs: ENHANCEMENT_PROVIDER_TIMEOUT_MS,
      providerOrder: dedupeProviderOrder([
        recalibrationPlan.enhancementProvider,
        ...recalibrationPlan.fallbackOrder,
      ]),
    });
    const backupReasonMap = new Map<string, string>();
    const backupIds = new Set(backupCandidates.map((product) => product.id));

    for (const item of enhancementResult.data.backupProducts || []) {
      if (!backupIds.has(item?.id)) continue;
      const reason = normalizeReason(item?.reason);
      if (reason) {
        backupReasonMap.set(item.id, reason);
      }
    }

    const aiShoppingGuidance = Array.isArray(enhancementResult.data.shoppingGuidance)
      ? enhancementResult.data.shoppingGuidance
          .map((line) => String(line || "").trim())
          .filter(Boolean)
          .slice(0, MAX_SHOPPING_GUIDANCE_COUNT)
      : [];
    const normalizedRecommendationTips = Array.isArray(recommendationTips)
      ? recommendationTips.map((line) => String(line || "").trim()).filter(Boolean)
      : [];

    return {
      topProducts,
      backupProducts: finalizeBackupProducts(backupCandidates, backupReasonMap),
      shoppingGuidance:
        aiShoppingGuidance.length > 0
          ? aiShoppingGuidance
          : buildLocalShoppingGuidance({
              answers,
              filteredCount,
              backupCandidates: backupCandidates.map((product) => ({
                id: product.id,
                backupLabel: product.backupLabel,
                backupReason:
                  backupReasonMap.get(product.id) ||
                  buildLocalBackupReason(product, product.backupLabel),
              })),
            }),
      recommendationTips: normalizedRecommendationTips,
      modelName: enhancementResult.modelName,
      provider: enhancementResult.provider,
    };
  }

  return {
    createProviderExecutors,
    runSingleProvider,
    runServerAiProxy,
    resolveRecalibrationPlan,
    runResultRecalibration,
  };
}
