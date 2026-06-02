import test from "node:test";
import assert from "node:assert/strict";
import {
  ENHANCEMENT_PROVIDER_TIMEOUT_MS,
  RERANK_PROVIDER_TIMEOUT_MS,
  createAppAiService,
  type ChatCompletionRequest,
} from "./app-ai-service.ts";
import type {
  BackupCandidate,
  RecommendationAnswers,
  RecommendationRankedProduct,
} from "../lib/recommendation-results.ts";
import type { ResultRecalibrationResponse } from "../lib/result-recalibration.ts";
import type { AppAiProvider } from "../lib/app-ai-chain.ts";

function createRankedProduct(
  id: string,
  overrides: Partial<RecommendationRankedProduct> = {},
): RecommendationRankedProduct {
  return {
    id,
    name: `Product ${id}`,
    price: 199,
    maxDb: 42,
    waterproof: 7,
    appearance: "high_disguise",
    physicalForm: "external",
    motorType: "gentle",
    gender: "female",
    brand: "Test Brand",
    material: "Silicone",
    imagePlaceholder: "image",
    tags: ["静音", "温和"],
    score: 88,
    matchSummary: ["静音更稳", "外部刺激更贴合", "预算落点合适"],
    hardMisses: 0,
    budgetGap: 0,
    noiseGap: 0,
    ...overrides,
  };
}

function createBackupCandidate(
  id: string,
  backupLabel: BackupCandidate["backupLabel"],
  overrides: Partial<BackupCandidate> = {},
): BackupCandidate {
  return {
    ...createRankedProduct(id),
    backupLabel,
    backupReason: "本地备选理由",
    ...overrides,
  };
}

test("createProviderExecutors exposes provider-specific executors with result-model mapping", async () => {
  const requests: ChatCompletionRequest[] = [];
  const service = createAppAiService({
    env: {
      QWEN_API_KEY: "qwen-key",
    } as NodeJS.ProcessEnv,
    chatCompletionRunner: async (request) => {
      requests.push(request);
      return '[{"id":"p-1","reason":"官方 Qwen 结果"}]';
    },
  });

  const executors = service.createProviderExecutors({
    prompt: "rerank prompt",
    temperature: 0.1,
    emptyJson: "[]",
    logContext: "单模型重校准",
  });
  const result = await executors.qwen();

  assert.deepEqual(result, {
    data: [{ id: "p-1", reason: "官方 Qwen 结果" }],
    modelName: "qwen-max",
    provider: "qwen",
  });
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0], {
    apiKey: "qwen-key",
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-max",
    prompt: "rerank prompt",
    temperature: 0.1,
    maxTokens: 4096,
  });
});

test("createProviderExecutors routes qnaigc models through the qnaigc chat completions endpoint", async () => {
  const requests: ChatCompletionRequest[] = [];
  const service = createAppAiService({
    env: {
      QNAIGC_API_KEY: "qnaigc-key",
    } as NodeJS.ProcessEnv,
    chatCompletionRunner: async (request) => {
      requests.push(request);
      return '[{"id":"p-1","reason":"七牛云结果"}]';
    },
  });

  const executors = service.createProviderExecutors({
    prompt: "rerank prompt",
    temperature: 0.1,
    emptyJson: "[]",
    logContext: "单模型重校准",
  });
  const result = await executors["qnaigc-qwen"]();

  assert.deepEqual(result, {
    data: [{ id: "p-1", reason: "七牛云结果" }],
    modelName: "qwen/qwen3.6-plus",
    provider: "qnaigc-qwen",
  });
  assert.deepEqual(requests[0], {
    apiKey: "qnaigc-key",
    baseURL: "https://api.qnaigc.com/v1",
    model: "qwen/qwen3.6-plus",
    prompt: "rerank prompt",
    temperature: 0.1,
    maxTokens: 4096,
    topP: 0.95,
  });
});

test("createProviderExecutors routes Kimi through the official Moonshot API", async () => {
  const requests: ChatCompletionRequest[] = [];
  const service = createAppAiService({
    env: {
      MOONSHOT_API_KEY: "moonshot-key",
    } as NodeJS.ProcessEnv,
    chatCompletionRunner: async (request) => {
      requests.push(request);
      return '[{"id":"p-1","reason":"官方 Kimi 结果"}]';
    },
  });

  const executors = service.createProviderExecutors({
    prompt: "rerank prompt",
    temperature: 0.1,
    emptyJson: "[]",
    logContext: "单模型重校准",
  });
  const result = await executors.kimi();

  assert.deepEqual(result, {
    data: [{ id: "p-1", reason: "官方 Kimi 结果" }],
    modelName: "kimi-k2.6",
    provider: "kimi",
  });
  assert.deepEqual(requests[0], {
    apiKey: "moonshot-key",
    baseURL: "https://api.moonshot.cn/v1",
    model: "kimi-k2.6",
    prompt: "rerank prompt",
    temperature: 1,
    maxTokens: 4096,
  });
});

test("runServerAiProxy uses the currently available DMX GLM model", async () => {
  const requests: ChatCompletionRequest[] = [];
  const service = createAppAiService({
    env: {
      DMXAPI_API_KEY: "dmx-key",
    } as NodeJS.ProcessEnv,
    chatCompletionRunner: async (request) => {
      requests.push(request);
      return '[{"id":"p-1","reason":"GLM 兜底结果"}]';
    },
  });

  const result = await service.runServerAiProxy<{ id: string; reason: string }[]>({
    prompt: "rerank prompt",
    temperature: 0.1,
    emptyJson: "[]",
    logContext: "Top3 重排",
    providerOrder: ["dmxapi-glm"],
  });

  assert.equal(result.modelName, "glm-5");
  assert.equal(result.provider, "dmxapi-glm");
  assert.equal(requests[0]?.model, "glm-5");
});

test("runServerAiProxy tolerates model JSON with trailing commas", async () => {
  const service = createAppAiService({
    env: {
      DMXAPI_API_KEY: "dmx-key",
    } as NodeJS.ProcessEnv,
    chatCompletionRunner: async () => `[
      { "id": "p-1", "reason": "Gemini 兜底结果", },
    ]`,
  });

  const result = await service.runServerAiProxy<{ id: string; reason: string }[]>({
    prompt: "rerank prompt",
    temperature: 0.1,
    emptyJson: "[]",
    logContext: "Top3 重排",
    providerOrder: ["dmxapi-gemini"],
  });

  assert.deepEqual(result.data, [{ id: "p-1", reason: "Gemini 兜底结果" }]);
});

test("runResultRecalibration uses the automatic provider ladder and recomputes canonical backup products from the recalibrated Top3", async () => {
  const requests: ChatCompletionRequest[] = [];
  const service = createAppAiService({
    env: {
      QWEN_API_KEY: "qwen-key",
    } as NodeJS.ProcessEnv,
    chatCompletionRunner: async (request) => {
      requests.push(request);
      if (requests.length === 1) {
        return JSON.stringify([
          { id: "b-1", reason: "更适合当前预算和静音取向" },
          { id: "p-2", reason: "更符合你现在的刺激节奏" },
          { id: "p-1", reason: "隐蔽性和静音更贴近你的场景" },
        ]);
      }

      return JSON.stringify({
        backupProducts: [
          { id: "b-2", reason: "预算更轻，适合保守入手" },
          { id: "b-3", reason: "清洁维护更省心，适合日常使用" },
        ],
        shoppingGuidance: [
          "先比较主推和备选的静音差异。",
          "如果会在浴室使用，优先看防水等级。",
          "预算接近时，可优先看刺激方向差异。",
          "隐蔽收纳需求高的话，关注外观伪装程度。",
          "首次尝试建议优先选更温和的节奏。",
          "这条应被截断。",
        ],
      });
    },
  });

  const answers: RecommendationAnswers = {
    tags: ["静音", "高伪装"],
    gender: "female",
    physicalForm: "external",
    motorType: "gentle",
    maxDb: 45,
    waterproof: 7,
    budget: [100, 300],
    appearance: "high_disguise",
  };
  const rerankPool = [
    createRankedProduct("p-1", {
      score: 96,
      rawDescription: "低噪吮吸设计，适合新手慢热探索。",
    }),
    createRankedProduct("p-2", {
      score: 94,
      motorType: "strong",
      matchSummary: ["反馈更直接", "价格也在预算内"],
      rawDescription: "自动活塞抽送，强刺激反馈更直接。",
    }),
    createRankedProduct("b-1", {
      score: 93,
      price: 169,
      rawDescription: "轻量安静，适合日常补位使用。",
    }),
    createRankedProduct("p-3", {
      score: 92,
      matchSummary: ["结构取向一致", "静音表现稳定", "清洁更省心"],
      rawDescription: "可穿戴贴合机身，低噪更适合双人氛围。",
    }),
  ];
  const rankedCandidates = [
    ...rerankPool,
    createRankedProduct("b-2", {
      score: 89,
      price: 149,
      maxDb: 36,
      rawDescription: "低噪轻量机身，更适合安静环境。",
    }),
    createRankedProduct("b-3", {
      score: 87,
      price: 189,
      waterproof: 8,
      matchSummary: ["防水更稳", "清洁维护更省心"],
      rawDescription: "全身水洗，清洁维护更省心。",
    }),
  ];

  const result = await service.runResultRecalibration({
    answers,
    strategy: "auto",
    rerankPool,
    rankedCandidates,
    filteredCount: 8,
    recommendationTips: ["如果放宽预算，可看到更多旗舰选项。"],
    recalibrationContext: {
      attemptCount: 1,
      currentResultProvider: "qwen",
      currentResultModelName: "qwen-turbo",
      previousTopProducts: [],
      previousShoppingGuidanceCount: 0,
    },
  });

  assert.deepEqual(
    requests.map((request) => ({
      model: request.model,
      baseURL: request.baseURL,
      maxTokens: request.maxTokens,
      timeoutMs: request.timeoutMs,
    })),
    [
      {
        model: "qwen-turbo",
        baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        maxTokens: 1200,
        timeoutMs: RERANK_PROVIDER_TIMEOUT_MS,
      },
      {
        model: "qwen-turbo",
        baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        maxTokens: 1800,
        timeoutMs: ENHANCEMENT_PROVIDER_TIMEOUT_MS,
      },
    ],
  );
  assert.equal(requests.every((request) => request.model === "qwen-turbo"), true);

  const typedResponse: ResultRecalibrationResponse = result;
  assert.equal(typeof typedResponse.topProducts[0]?.reason, "string");
  assert.equal(typedResponse.modelName, "qwen-turbo");
  assert.equal(typedResponse.provider, "qwen");
  assert.deepEqual(result, {
    topProducts: [
      {
        ...rerankPool[2],
        reason: "更适合当前预算和静音取向",
      },
      {
        ...rerankPool[1],
        reason: "更符合你现在的刺激节奏",
      },
      {
        ...rerankPool[0],
        reason: "隐蔽性和静音更贴近你的场景",
      },
    ],
    backupProducts: [
      {
        ...createBackupCandidate("p-3", "更隐蔽", {
          score: 92,
          matchSummary: ["结构取向一致", "静音表现稳定", "清洁更省心"],
          rawDescription: "可穿戴贴合机身，低噪更适合双人氛围。",
        }),
        backupReason: "外观更利于日常收纳，降低被看到时的压力",
      },
      {
        ...createBackupCandidate("b-2", "更静音", {
          score: 89,
          price: 149,
          maxDb: 36,
          rawDescription: "低噪轻量机身，更适合安静环境。",
        }),
        backupReason: "预算更轻，适合保守入手",
      },
      {
        ...createBackupCandidate("b-3", "更防水", {
          score: 87,
          price: 189,
          waterproof: 8,
          matchSummary: ["防水更稳", "清洁维护更省心"],
          rawDescription: "全身水洗，清洁维护更省心。",
        }),
        backupReason: "清洁维护更省心，适合日常使用",
      },
    ],
    shoppingGuidance: [
      "先比较主推和备选的静音差异。",
      "如果会在浴室使用，优先看防水等级。",
      "预算接近时，可优先看刺激方向差异。",
      "隐蔽收纳需求高的话，关注外观伪装程度。",
      "首次尝试建议优先选更温和的节奏。",
    ],
    recommendationTips: ["如果放宽预算，可看到更多旗舰选项。"],
    modelName: "qwen-turbo",
    provider: "qwen",
  });

  assert.match(requests[1]?.prompt || "", /"id":"p-3"/);
  assert.match(requests[1]?.prompt || "", /"id":"b-2"/);
  assert.match(requests[1]?.prompt || "", /"id":"b-3"/);
  assert.match(requests[0]?.prompt || "", /"descriptionSignals":"/);
  assert.match(requests[0]?.prompt || "", /吮吸刺激/);
  assert.match(requests[0]?.prompt || "", /新手友好/);
  assert.match(requests[0]?.prompt || "", /自动活塞/);
  assert.match(requests[0]?.prompt || "", /强刺激/);
  assert.match(requests[0]?.prompt || "", /不要罗列参数/);
  assert.match(requests[0]?.prompt || "", /只抓一个最关键的适配取舍/);
  assert.doesNotMatch(requests[0]?.prompt || "", /\{\n\s+"rank"/);
  assert.doesNotMatch(requests[0]?.prompt || "", /低噪吮吸设计，适合新手慢热探索/);
  assert.match(requests[1]?.prompt || "", /"descriptionSignals":"/);
  assert.match(requests[1]?.prompt || "", /可穿戴/);
  assert.match(requests[1]?.prompt || "", /低噪静音/);
  assert.match(requests[1]?.prompt || "", /易清洗/);
});

test("runResultRecalibration passes explicit disguise signals to the rerank prompt", async () => {
  const requests: ChatCompletionRequest[] = [];
  const service = createAppAiService({
    env: {
      QWEN_API_KEY: "qwen-key",
    } as NodeJS.ProcessEnv,
    chatCompletionRunner: async (request) => {
      requests.push(request);
      return requests.length === 1
        ? JSON.stringify([{ id: "p-1", reason: "口红造型更适合隐蔽收纳" }])
        : JSON.stringify({ backupProducts: [], shoppingGuidance: [] });
    },
  });

  await service.runResultRecalibration({
    answers: {
      tags: ["高伪装"],
      gender: "female",
      appearance: "high_disguise",
    },
    strategy: "auto",
    rerankPool: [
      createRankedProduct("p-1", {
        name: "口红造型随身款",
        tags: ["隐形收纳"],
        rawDescription: "不是常规款式，日用品造型，低存在感。",
      }),
      createRankedProduct("p-2", {
        name: "经典手持款",
        rawDescription: "外观简洁，适合日常使用。",
      }),
    ],
    rankedCandidates: [
      createRankedProduct("p-1", {
        name: "口红造型随身款",
        tags: ["隐形收纳"],
        rawDescription: "不是常规款式，日用品造型，低存在感。",
      }),
      createRankedProduct("p-2", {
        name: "经典手持款",
        rawDescription: "外观简洁，适合日常使用。",
      }),
      createRankedProduct("p-3", {
        name: "玫瑰摆件款",
        tags: ["玫瑰款"],
      }),
    ],
    filteredCount: 3,
    recommendationTips: [],
    recalibrationContext: {
      attemptCount: 1,
      currentResultProvider: "qwen",
      currentResultModelName: "qwen-turbo",
      previousTopProducts: [],
      previousShoppingGuidanceCount: 0,
    },
  });

  assert.match(
    requests[0]?.prompt || "",
    /"disguiseSignals":"口红造型、日用品伪装、低存在感"/,
  );
  assert.match(
    requests[0]?.prompt || "",
    /"preferenceSignals":\["高伪装","女性向"\]/,
  );
  assert.match(
    requests[0]?.prompt || "",
    /高伪装偏好下，优先考虑明确非传统设备外观/,
  );
});

test("AI recommendation provider timeouts allow slower models to answer before fallback", () => {
  assert.equal(RERANK_PROVIDER_TIMEOUT_MS, 45_000);
  assert.equal(ENHANCEMENT_PROVIDER_TIMEOUT_MS, 60_000);
});

test("resolveRecalibrationPlan starts the first manual reroll on the next rerank provider while keeping the fallback ladder", () => {
  const service = createAppAiService();

  const plan = service.resolveRecalibrationPlan({
    attemptCount: 1,
    currentResultProvider: "dmxapi-mimo",
    currentResultModelName: "mimo-v2.5-pro",
    previousTopProducts: [{ id: "p-1", reason: "静音更稳" }],
    previousShoppingGuidanceCount: 4,
  });

  assert.equal(plan.rerankProvider, "qnaigc-minimax");
  assert.equal(plan.enhancementProvider, "dmxapi-qwen");
  assert.deepEqual(plan.fallbackOrder.slice(0, 3), [
    "qnaigc-minimax",
    "qnaigc-qwen",
    "qnaigc-glm",
  ]);
});

test("resolveRecalibrationPlan rotates rerank providers across repeated rerolls and wraps back around", () => {
  const service = createAppAiService();

  const secondPlan = service.resolveRecalibrationPlan({
    attemptCount: 2,
    currentResultProvider: "dmxapi-mimo",
    currentResultModelName: "mimo-v2.5-pro",
    previousTopProducts: [
      { id: "p-1", reason: "适合你" },
      { id: "p-2", reason: "也适合你" },
    ],
    previousShoppingGuidanceCount: 1,
  });

  const wrappedPlan = service.resolveRecalibrationPlan({
    attemptCount: 8,
    currentResultProvider: "dmxapi-qwen",
    currentResultModelName: "qwen3.5-27b",
    previousTopProducts: [{ id: "p-1", reason: "理由还可以" }],
    previousShoppingGuidanceCount: 4,
  });

  assert.equal(secondPlan.rerankProvider, "dmxapi-minimax");
  assert.equal(secondPlan.enhancementProvider, "dmxapi-qwen");
  assert.equal(secondPlan.fallbackOrder[0], "dmxapi-minimax");
  assert.ok(secondPlan.fallbackOrder.includes("qnaigc-qwen"));
  assert.ok(wrappedPlan.fallbackOrder.includes("dmxapi-claude"));
  assert.ok(wrappedPlan.fallbackOrder.includes("dmxapi-gemini"));
  assert.ok(wrappedPlan.fallbackOrder.includes("dmxapi-grok"));
  assert.ok(wrappedPlan.fallbackOrder.includes("dmxapi-gpt"));
  assert.ok(wrappedPlan.fallbackOrder.includes("kimi"));
  assert.equal(wrappedPlan.rerankProvider, "dmxapi-claude");
});

test("runResultRecalibration follows the rotated rerank provider while keeping the stable enhancement provider", async () => {
  const requests: ChatCompletionRequest[] = [];
  const service = createAppAiService({
    env: {
      DMXAPI_API_KEY: "dmx-key",
    } as NodeJS.ProcessEnv,
    chatCompletionRunner: async (request) => {
      requests.push(request);
      if (requests.length === 1) {
        return JSON.stringify([{ id: "p-1", reason: "第一步先保留更稳的静音路线" }]);
      }

      return JSON.stringify({
        backupProducts: [],
        shoppingGuidance: ["先从更轻压力的使用场景开始。", "第一次优先保留更温和的节奏。"],
      });
    },
  });

  const answers: RecommendationAnswers = {
    tags: ["静音", "高伪装"],
    gender: "female",
    physicalForm: "external",
    motorType: "gentle",
  };
  const rerankPool = [
    createRankedProduct("p-1", { score: 96 }),
    createRankedProduct("p-2", { score: 93 }),
    createRankedProduct("p-3", { score: 91 }),
  ];

  await service.runResultRecalibration({
    answers,
    strategy: "auto",
    rerankPool,
    rankedCandidates: rerankPool,
    filteredCount: 3,
    recommendationTips: [],
    recalibrationContext: {
      attemptCount: 1,
      currentResultProvider: "dmxapi-mimo",
      currentResultModelName: "mimo-v2.5-pro",
      previousTopProducts: [{ id: "p-1", reason: "适合你" }],
      previousShoppingGuidanceCount: 1,
    },
  });

  const models = requests.map((request) => request.model);
  assert.deepEqual(models.slice(0, 2), [
    "MiniMax-M2.7-free",
    "qwen3.5-27b",
  ]);
});
