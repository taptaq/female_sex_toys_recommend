import test from "node:test";
import assert from "node:assert/strict";
import {
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
    maxTokens: 24576,
  });
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
    })),
    [
      {
        model: "qwen-turbo",
        baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        maxTokens: 24576,
      },
      {
        model: "qwen-turbo",
        baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        maxTokens: 24576,
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

  assert.match(requests[1]?.prompt || "", /"id": "p-3"/);
  assert.match(requests[1]?.prompt || "", /"id": "b-2"/);
  assert.match(requests[1]?.prompt || "", /"id": "b-3"/);
  assert.match(requests[0]?.prompt || "", /"descriptionSignals": "低噪静音、吮吸刺激、新手友好"/);
  assert.match(requests[0]?.prompt || "", /"descriptionSignals": "自动活塞、强刺激"/);
  assert.doesNotMatch(requests[0]?.prompt || "", /低噪吮吸设计，适合新手慢热探索/);
  assert.match(requests[1]?.prompt || "", /"descriptionSignals": "低噪静音、可穿戴"/);
  assert.match(requests[1]?.prompt || "", /"descriptionSignals": "低噪静音"/);
  assert.match(requests[1]?.prompt || "", /"descriptionSignals": "易清洗"/);
});

test("resolveRecalibrationPlan starts the first manual reroll on the next rerank provider while keeping the fallback ladder", () => {
  const service = createAppAiService();

  const plan = service.resolveRecalibrationPlan({
    attemptCount: 1,
    currentResultProvider: "dmxapi-mimo",
    currentResultModelName: "mimo-v2.5-free",
    previousTopProducts: [{ id: "p-1", reason: "静音更稳" }],
    previousShoppingGuidanceCount: 4,
  });

  assert.equal(plan.rerankProvider, "dmxapi-minimax");
  assert.equal(plan.enhancementProvider, "dmxapi-qwen");
  assert.deepEqual(plan.fallbackOrder.slice(0, 3), [
    "dmxapi-minimax",
    "dmxapi-qwen",
    "dmxapi-mimo",
  ]);
});

test("resolveRecalibrationPlan rotates rerank providers across repeated rerolls and wraps back around", () => {
  const service = createAppAiService();

  const secondPlan = service.resolveRecalibrationPlan({
    attemptCount: 2,
    currentResultProvider: "dmxapi-mimo",
    currentResultModelName: "mimo-v2.5-free",
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

  assert.equal(secondPlan.rerankProvider, "dmxapi-qwen");
  assert.equal(secondPlan.enhancementProvider, "dmxapi-qwen");
  assert.equal(secondPlan.fallbackOrder[0], "dmxapi-qwen");
  assert.ok(secondPlan.fallbackOrder.includes("dmxapi-minimax"));
  assert.ok(wrappedPlan.fallbackOrder.includes("dmxapi-claude"));
  assert.ok(wrappedPlan.fallbackOrder.includes("dmxapi-gemini"));
  assert.ok(wrappedPlan.fallbackOrder.includes("dmxapi-grok"));
  assert.ok(wrappedPlan.fallbackOrder.includes("dmxapi-gpt"));
  assert.ok(wrappedPlan.fallbackOrder.includes("dmxapi-kimi-k2"));
  assert.equal(wrappedPlan.rerankProvider, "dmxapi-gpt");
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
      currentResultModelName: "mimo-v2.5-free",
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
