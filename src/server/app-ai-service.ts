import OpenAI from "openai";
import {
  APP_RECOMMENDATION_PROVIDER_ORDER,
  type AppAiProvider,
} from "../lib/app-ai-chain.ts";
import {
  buildBackupCandidates,
  buildLocalBackupReason,
  buildLocalShoppingGuidance,
  type BackupCandidate,
  type RecommendationAnswers,
  type RecommendationRankedProduct,
} from "../lib/recommendation-results.ts";
import {
  getResultModelOption,
  type ResultModelOption,
} from "../lib/result-models.ts";
import type {
  ResultRecalibrationRequest,
  ResultRecalibrationResponse,
} from "../lib/result-recalibration.ts";
import { buildProductDescriptionSignalsSummary } from "../lib/product-description-signals.ts";
import { runAppAiProviderLadder } from "./app-ai-proxy.ts";

const FINAL_SELECTION_COUNT = 3;
const BACKUP_SELECTION_COUNT = 3;
const MAX_SHOPPING_GUIDANCE_COUNT = 5;
const DEFAULT_AI_MAX_TOKENS = 24576;

const PROVIDER_LABELS: Record<AppAiProvider, string> = {
  "dmxapi-mimo": "DMXAPI Mimo",
  "dmxapi-minimax": "DMXAPI MiniMax",
  "dmxapi-qwen": "DMXAPI Qwen",
  "dmxapi-glm": "DMXAPI GLM",
  "dmxapi-kimi": "DMXAPI Kimi",
  deepseek: "DeepSeek",
  qwen: "Qwen",
  glm: "GLM",
};

const PROVIDER_RUNTIME_CONFIG: Record<
  AppAiProvider,
  {
    apiKeyEnv: string;
    baseURL: string;
    topP?: number;
  }
> = {
  "dmxapi-mimo": {
    apiKeyEnv: "DMXAPI_API_KEY",
    baseURL: "https://www.dmxapi.cn/v1",
    topP: 0.95,
  },
  "dmxapi-minimax": {
    apiKeyEnv: "DMXAPI_API_KEY",
    baseURL: "https://www.dmxapi.cn/v1",
    topP: 0.95,
  },
  "dmxapi-qwen": {
    apiKeyEnv: "DMXAPI_API_KEY",
    baseURL: "https://www.dmxapi.cn/v1",
    topP: 0.95,
  },
  "dmxapi-glm": {
    apiKeyEnv: "DMXAPI_API_KEY",
    baseURL: "https://www.dmxapi.cn/v1",
    topP: 1,
  },
  "dmxapi-kimi": {
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
  "dmxapi-mimo": "mimo-v2.5-free",
  "dmxapi-minimax": "MiniMax-M2.7-free",
  "dmxapi-qwen": "qwen3.5-plus-free",
  "dmxapi-glm": "glm-5.1-free",
  "dmxapi-kimi": "kimi-k2.6-free",
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
};

type Logger = Pick<Console, "log" | "warn">;

type ChatCompletionRunner = (
  request: ChatCompletionRequest,
) => Promise<string | null | undefined>;

function normalizeJsonResponse(content: string | null | undefined) {
  return String(content || "")
    .replace(/```json/g, "")
    .replace(/```/g, "")
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
) {
  const context = {
    userPreferences: answers.tags,
    rankedProducts: rankedProducts.map((product, index) => ({
      rank: index + 1,
      id: product.id,
      name: product.name,
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
    })),
  };

  return `
你是一个专业的性健康装备选品专家。
当前候选池已经由结构化规则筛到较小范围。请你在这些候选商品中，重新挑选最匹配的前 3 名，并给出每个商品的推荐理由。

用户偏好标签: [${context.userPreferences.join(", ")}]

候选商品列表（已按结构化分数从高到低排序，仅可从中选择）:
${JSON.stringify(context.rankedProducts, null, 2)}

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
5. 请综合用户标签、结构化分数、matchSummary、descriptionSignals、价格、噪音、防水、刺激形式来判断，不要只看单一字段。`;
}

function buildResultEnhancementPrompt(
  answers: RecommendationAnswers,
  finalTopProducts: RankedProductWithReason[],
  backupCandidates: BackupCandidate[],
  filteredCount: number,
) {
  const context = {
    userPreferences: answers.tags,
    filteredCount,
    topProducts: finalTopProducts.map((product, index) => ({
      rank: index + 1,
      id: product.id,
      name: product.name,
      brand: product.brand,
      price: product.price,
      reason: product.reason,
      descriptionSignals: buildProductDescriptionSignalsSummary(product),
    })),
    backupCandidates: backupCandidates.map((product, index) => ({
      rank: index + 1,
      id: product.id,
      name: product.name,
      brand: product.brand,
      price: product.price,
      backupLabel: product.backupLabel,
      structuredScore: product.score,
      matchSummary: product.matchSummary?.join("、") || "",
      descriptionSignals: buildProductDescriptionSignalsSummary(product),
      localReason: buildLocalBackupReason(product, product.backupLabel),
    })),
  };

  return `
你是一个专业的性健康装备选品专家。
Top 3 主推荐已经确定，请只补充两个结果区域：
1. 为备选卡片写一句简短说明
2. 为结果页写 3-5 条选购建议

用户偏好标签: [${context.userPreferences.join(", ")}]
候选池数量: ${context.filteredCount}

已确定 Top 3（仅供参考，不需要重排）:
${JSON.stringify(context.topProducts, null, 2)}

备选候选（只能基于这些 id 输出说明）:
${JSON.stringify(context.backupCandidates, null, 2)}

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
}: ChatCompletionRequest) {
  const openai = new OpenAI({
    apiKey,
    baseURL,
  });

  return openai.chat.completions
    .create({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature,
      top_p: topP,
      max_tokens: maxTokens,
    })
    .then((response) => response.choices[0].message.content);
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
  }: {
    prompt: string;
    temperature: number;
    emptyJson: string;
    logContext: string;
    resolveModel: (provider: AppAiProvider) => string;
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
            temperature,
            maxTokens: DEFAULT_AI_MAX_TOKENS,
            ...(runtimeConfig.topP == null ? {} : { topP: runtimeConfig.topP }),
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
  }: {
    prompt: string;
    temperature: number;
    emptyJson: string;
    logContext: string;
  }) {
    return buildProviderExecutors<T>({
      prompt,
      temperature,
      emptyJson,
      logContext,
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
  }: {
    provider: AppAiProvider;
    prompt: string;
    temperature: number;
    emptyJson: string;
    logContext: string;
  }) {
    return createProviderExecutors<T>({
      prompt,
      temperature,
      emptyJson,
      logContext,
    })[provider]();
  }

  function runServerAiProxy<T>({
    prompt,
    temperature,
    emptyJson,
    logContext,
  }: {
    prompt: string;
    temperature: number;
    emptyJson: string;
    logContext: string;
  }) {
    const providers = buildProviderExecutors<T>({
      prompt,
      temperature,
      emptyJson,
      logContext,
      resolveModel(provider) {
        return PROXY_PROVIDER_MODELS[provider];
      },
    });

    return runAppAiProviderLadder({
      providerOrder: APP_RECOMMENDATION_PROVIDER_ORDER,
      providers,
      onProviderError(provider, error) {
        logger.warn(
          `⚠️ [Server/AI] ${logContext}: ${PROVIDER_LABELS[provider]} 失败，继续下一个兜底...`,
          error,
        );
      },
    });
  }

  async function runResultRecalibration({
    answers,
    rerankPool,
    rankedCandidates,
    filteredCount,
    recommendationTips,
  }: ResultRecalibrationRequest): Promise<ResultRecalibrationResponse> {
    const rerankResult = await runServerAiProxy<BackupReasonResult[]>({
      prompt: buildRerankPrompt(answers, rerankPool),
      temperature: 0.1,
      emptyJson: "[]",
      logContext: "结果重校准 Top3 重排",
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
      ),
      temperature: 0.3,
      emptyJson: "{}",
      logContext: "结果重校准 备选说明与选购建议",
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
    runResultRecalibration,
  };
}
