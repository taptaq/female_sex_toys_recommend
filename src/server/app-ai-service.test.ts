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
    maxTokens: 16384,
  });
});

test("runResultRecalibration recomputes canonical backup products from the recalibrated Top3", async () => {
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
    createRankedProduct("p-1", { score: 96 }),
    createRankedProduct("p-2", {
      score: 94,
      motorType: "strong",
      matchSummary: ["反馈更直接", "价格也在预算内"],
    }),
    createRankedProduct("b-1", { score: 93, price: 169 }),
    createRankedProduct("p-3", {
      score: 92,
      matchSummary: ["结构取向一致", "静音表现稳定", "清洁更省心"],
    }),
  ];
  const rankedCandidates = [
    ...rerankPool,
    createRankedProduct("b-2", { score: 89, price: 149, maxDb: 36 }),
    createRankedProduct("b-3", {
      score: 87,
      price: 189,
      waterproof: 8,
      matchSummary: ["防水更稳", "清洁维护更省心"],
    }),
  ];

  const result = await service.runResultRecalibration({
    answers,
    targetProvider: "qwen",
    rerankPool,
    rankedCandidates,
    filteredCount: 8,
    recommendationTips: ["如果放宽预算，可看到更多旗舰选项。"],
  });

  assert.deepEqual(
    requests.map((request) => ({
      model: request.model,
      baseURL: request.baseURL,
    })),
    [
      {
        model: "qwen-max",
        baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      },
      {
        model: "qwen-max",
        baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      },
    ],
  );
  assert.equal(requests.every((request) => request.model === "qwen-max"), true);

  const typedResponse: ResultRecalibrationResponse = result;
  assert.equal(typeof typedResponse.topProducts[0]?.reason, "string");
  assert.equal(typedResponse.modelName, "qwen-max");
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
        }),
        backupReason: "外观更利于日常收纳和隐蔽",
      },
      {
        ...createBackupCandidate("b-2", "更静音", {
          score: 89,
          price: 149,
          maxDb: 36,
        }),
        backupReason: "预算更轻，适合保守入手",
      },
      {
        ...createBackupCandidate("b-3", "更防水", {
          score: 87,
          price: 189,
          waterproof: 8,
          matchSummary: ["防水更稳", "清洁维护更省心"],
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
    modelName: "qwen-max",
    provider: "qwen",
  });

  assert.match(requests[1]?.prompt || "", /"id": "p-3"/);
  assert.match(requests[1]?.prompt || "", /"id": "b-2"/);
  assert.match(requests[1]?.prompt || "", /"id": "b-3"/);
});
