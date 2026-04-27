# Results Model Recalibration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在推荐结果页支持切换不同模型，并基于当前答题与同一候选池整套重新校准 `Top 3 主推荐 + 备选卡片 + 选购建议`。

**Architecture:** 先把结果页模型目录与前端/服务端共用的重校准数据结构抽到独立模块，再把服务端 AI 调用逻辑从 `src/server/index.ts` 提炼成可测试服务，新增单模型 `/api/ai/recalibrate-results` 接口。前端继续负责结构化筛选与候选池构建，结果页只负责选择模型、触发统一接口，并在成功后一次性替换整套结果。

**Tech Stack:** React 19, TypeScript, Express, OpenAI-compatible SDK, Node test runner, Vite

---

### Task 1: 提炼结果页模型目录与重校准数据结构

**Files:**
- Create: `src/lib/result-models.ts`
- Create: `src/lib/result-models.test.ts`
- Create: `src/lib/result-recalibration.ts`

- [ ] **Step 1: Write the failing test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_RESULT_MODEL_PROVIDER,
  RESULT_MODEL_OPTIONS,
  getResultModelOption,
  getSafeSelectedResultProvider,
} from "./result-models.ts";

test("result model options keep the full recalibration order and labels", () => {
  assert.deepEqual(
    RESULT_MODEL_OPTIONS.map((option) => option.provider),
    [
      "dmxapi-mimo",
      "dmxapi-qwen",
      "dmxapi-glm",
      "dmxapi-kimi",
      "deepseek",
      "qwen",
      "glm",
    ],
  );
  assert.equal(DEFAULT_RESULT_MODEL_PROVIDER, "dmxapi-mimo");
  assert.equal(getResultModelOption("dmxapi-kimi")?.label, "Kimi（DMX）");
});

test("getSafeSelectedResultProvider falls back to default when provider is unknown", () => {
  assert.equal(getSafeSelectedResultProvider("glm"), "glm");
  assert.equal(getSafeSelectedResultProvider("unknown-provider"), "dmxapi-mimo");
  assert.equal(getSafeSelectedResultProvider(""), "dmxapi-mimo");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --loader ts-node/esm --test src/lib/result-models.test.ts`

Expected: FAIL with `Cannot find module './result-models.ts'`.

- [ ] **Step 3: Write minimal implementation**

```ts
import { APP_RECOMMENDATION_PROVIDER_ORDER, type AppAiProvider } from "./app-ai-chain.ts";

export type ResultModelOption = {
  provider: AppAiProvider;
  modelName: string;
  label: string;
  providerLabel: string;
};

export const RESULT_MODEL_OPTIONS: ResultModelOption[] = [
  {
    provider: "dmxapi-mimo",
    modelName: "mimo-v2.5-free",
    label: "Mimo（DMX）",
    providerLabel: "DMX",
  },
  {
    provider: "dmxapi-qwen",
    modelName: "qwen3.5-plus-free",
    label: "Qwen（DMX）",
    providerLabel: "DMX",
  },
  {
    provider: "dmxapi-glm",
    modelName: "glm-5.1-free",
    label: "GLM（DMX）",
    providerLabel: "DMX",
  },
  {
    provider: "dmxapi-kimi",
    modelName: "kimi-k2.6-free",
    label: "Kimi（DMX）",
    providerLabel: "DMX",
  },
  {
    provider: "deepseek",
    modelName: "deepseek-v4-flash",
    label: "DeepSeek（官方）",
    providerLabel: "官方",
  },
  {
    provider: "qwen",
    modelName: "qwen-max",
    label: "Qwen（官方）",
    providerLabel: "官方",
  },
  {
    provider: "glm",
    modelName: "glm-4.5-air",
    label: "GLM（官方）",
    providerLabel: "官方",
  },
];

export const DEFAULT_RESULT_MODEL_PROVIDER = APP_RECOMMENDATION_PROVIDER_ORDER[0];

export function getResultModelOption(provider: AppAiProvider) {
  return RESULT_MODEL_OPTIONS.find((option) => option.provider === provider);
}

export function getSafeSelectedResultProvider(provider: string | null | undefined): AppAiProvider {
  return (
    RESULT_MODEL_OPTIONS.find((option) => option.provider === provider)?.provider ??
    DEFAULT_RESULT_MODEL_PROVIDER
  );
}
```

```ts
import type { AnswerState } from "../data/mock";
import type { RankedProduct } from "./app-shell";
import type { BackupCandidate } from "./recommendation-results";
import type { AppAiProvider } from "./app-ai-chain.ts";

export type ResultRecalibrationRequest = {
  answers: AnswerState;
  targetProvider: AppAiProvider;
  rerankPool: RankedProduct[];
  backupCandidates: BackupCandidate[];
  filteredCount: number;
  recommendationTips: string[];
};

export type ResultRecalibrationResponse = {
  topProducts: RankedProduct[];
  backupProducts: BackupCandidate[];
  shoppingGuidance: string[];
  recommendationTips: string[];
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --loader ts-node/esm --test src/lib/result-models.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/result-models.ts src/lib/result-models.test.ts src/lib/result-recalibration.ts
git commit -m "feat: add result recalibration model catalog"
```

### Task 2: 提炼可测试的服务端 AI 服务并新增单模型重校准接口

**Files:**
- Create: `src/server/app-ai-service.ts`
- Create: `src/server/app-ai-service.test.ts`
- Modify: `src/server/index.ts`
- Reuse Test: `src/server/app-ai-proxy.test.ts`

- [ ] **Step 1: Write the failing service test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { createProviderExecutors } from "./app-ai-service.ts";

test("createProviderExecutors exposes provider-specific models for single-provider recalibration", async () => {
  const calls: Array<{ provider: string; model: string }> = [];
  const executors = createProviderExecutors({
    prompt: "[]",
    temperature: 0.1,
    emptyJson: "[]",
    env: {
      DMXAPI_API_KEY: "dmx-key",
      DEEPSEEK_API_KEY: "deepseek-key",
      QWEN_API_KEY: "qwen-key",
      GLM_API_KEY: "glm-key",
    },
    callJson: async (options) => {
      calls.push({ provider: options.provider, model: options.model });
      return [];
    },
  });

  await executors["dmxapi-kimi"]();
  await executors.deepseek();

  assert.deepEqual(calls, [
    { provider: "dmxapi-kimi", model: "kimi-k2.6-free" },
    { provider: "deepseek", model: "deepseek-v4-flash" },
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --loader ts-node/esm --test src/server/app-ai-service.test.ts`

Expected: FAIL because `src/server/app-ai-service.ts` does not exist yet.

- [ ] **Step 3: Extract the server AI service**

```ts
import OpenAI from "openai";
import { APP_RECOMMENDATION_PROVIDER_ORDER, type AppAiProvider } from "../lib/app-ai-chain.ts";
import { RESULT_MODEL_OPTIONS } from "../lib/result-models.ts";
import { runAppAiProviderLadder } from "./app-ai-proxy.ts";

export type AiProxyEnvelope<T> = {
  data: T;
  modelName: string;
  provider: AppAiProvider;
};

export function createProviderExecutors<T>({
  prompt,
  temperature,
  emptyJson,
  env,
  callJson = defaultCallJson,
}: {
  prompt: string;
  temperature: number;
  emptyJson: string;
  env: NodeJS.ProcessEnv;
  callJson?: (options: ProviderCallOptions) => Promise<T>;
}) {
  const byProvider = new Map(RESULT_MODEL_OPTIONS.map((option) => [option.provider, option]));

  return {
    "dmxapi-mimo": async () => ({
      data: await callJson(buildProviderCallOptions("dmxapi-mimo")),
      modelName: byProvider.get("dmxapi-mimo")!.modelName,
      provider: "dmxapi-mimo" as const,
    }),
    // ...other providers, same shape...
  };

  function buildProviderCallOptions(provider: AppAiProvider) {
    const option = byProvider.get(provider)!;
    return {
      provider,
      apiKey: resolveApiKey(provider, env),
      baseURL: resolveBaseUrl(provider),
      model: option.modelName,
      prompt,
      temperature,
      emptyJson,
    };
  }
}

export async function runServerAiProxy<T>({
  prompt,
  temperature,
  emptyJson,
  logContext,
  providerOrder = APP_RECOMMENDATION_PROVIDER_ORDER,
}: {
  prompt: string;
  temperature: number;
  emptyJson: string;
  logContext: string;
  providerOrder?: readonly AppAiProvider[];
}): Promise<AiProxyEnvelope<T>> {
  const providers = createProviderExecutors<T>({
    prompt,
    temperature,
    emptyJson,
    env: process.env,
  });

  return runAppAiProviderLadder({
    providerOrder,
    providers,
    onProviderError(provider, error) {
      console.warn(`⚠️ [Server/AI] ${logContext}: ${provider} 失败，继续下一个兜底...`, error);
    },
  });
}
```

- [ ] **Step 4: Add the new endpoint in `src/server/index.ts`**

```ts
import type { ResultRecalibrationRequest, ResultRecalibrationResponse } from "../lib/result-recalibration.ts";
import { buildLocalBackupReason } from "../lib/recommendation-results";
import { runServerAiProxy } from "./app-ai-service";

app.post("/api/ai/recalibrate-results", async (req, res) => {
  const body = req.body as Partial<ResultRecalibrationRequest>;
  const targetProvider = body.targetProvider;
  const rerankPool = Array.isArray(body.rerankPool) ? body.rerankPool : [];
  const backupCandidates = Array.isArray(body.backupCandidates) ? body.backupCandidates : [];

  if (!targetProvider || rerankPool.length === 0) {
    res.status(400).json({ error: "targetProvider and rerankPool are required" });
    return;
  }

  try {
    const rerankPrompt = buildRerankPrompt(body.answers, rerankPool);
    const rerankResult = await runServerAiProxy<unknown[]>({
      prompt: rerankPrompt,
      temperature: 0.1,
      emptyJson: "[]",
      logContext: "结果页二次校准 Top3",
      providerOrder: [targetProvider],
    });

    const enhancementPrompt = buildResultEnhancementPrompt({
      answers: body.answers,
      finalTopProducts: finalizeRecalibratedTopProducts(rerankPool, rerankResult.data),
      backupCandidates,
      filteredCount: body.filteredCount ?? rerankPool.length,
    });
    const enhancementResult = await runServerAiProxy<Record<string, unknown>>({
      prompt: enhancementPrompt,
      temperature: 0.3,
      emptyJson: "{}",
      logContext: "结果页二次校准备选增强",
      providerOrder: [targetProvider],
    });

    const payload: ResultRecalibrationResponse = {
      topProducts: finalizeRecalibratedTopProducts(rerankPool, rerankResult.data),
      backupProducts: finalizeRecalibratedBackupProducts(backupCandidates, enhancementResult.data),
      shoppingGuidance: normalizeShoppingGuidance(enhancementResult.data),
      recommendationTips: Array.isArray(body.recommendationTips) ? body.recommendationTips : [],
    };

    res.json({
      data: payload,
      modelName: rerankResult.modelName,
      provider: rerankResult.provider,
    });
  } catch (error) {
    console.error("❌ [Server/AI] 结果页二次校准失败:", error);
    res.status(500).json({ error: "AI recalibration failed", details: String(error) });
  }
});
```

- [ ] **Step 5: Run focused server tests**

Run: `node --loader ts-node/esm --test src/server/app-ai-proxy.test.ts src/server/app-ai-service.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/server/app-ai-service.ts src/server/app-ai-service.test.ts src/server/index.ts
git commit -m "feat: add server-side result recalibration endpoint"
```

### Task 3: 抽离前端重校准编排并接入结果元数据状态

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/lib/result-recalibration.ts`
- Create: `src/lib/result-recalibration.test.ts`

- [ ] **Step 1: Write the failing front-end helper test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildResultRecalibrationPayload,
  readResultSourceState,
} from "./result-recalibration.ts";

test("readResultSourceState prefers persisted provider when it is valid", () => {
  assert.deepEqual(
    readResultSourceState({
      currentResultProvider: "dmxapi-glm",
      currentResultModelName: "glm-5.1-free",
    }),
    {
      currentResultProvider: "dmxapi-glm",
      currentResultModelName: "glm-5.1-free",
      selectedResultProvider: "dmxapi-glm",
    },
  );
});

test("buildResultRecalibrationPayload keeps the current candidate pools intact", () => {
  const payload = buildResultRecalibrationPayload({
    answers: { tags: ["静音"] },
    targetProvider: "dmxapi-mimo",
    rerankPool: [{ id: "p1", name: "Alpha", price: 199, imagePlaceholder: "", tags: [], motorType: "gentle" }],
    backupCandidates: [],
    filteredCount: 8,
    recommendationTips: ["可适当放宽价格区间"],
  });

  assert.equal(payload.targetProvider, "dmxapi-mimo");
  assert.equal(payload.rerankPool.length, 1);
  assert.equal(payload.recommendationTips[0], "可适当放宽价格区间");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --loader ts-node/esm --test src/lib/result-recalibration.test.ts`

Expected: FAIL because helper functions are not implemented yet.

- [ ] **Step 3: Add result-source helpers and wire them into `App.tsx`**

```ts
export function readResultSourceState(
  persistedState: Partial<{
    currentResultProvider: string;
    currentResultModelName: string;
  }>,
) {
  const currentResultProvider = getSafeSelectedResultProvider(
    persistedState.currentResultProvider,
  );

  return {
    currentResultProvider,
    currentResultModelName:
      persistedState.currentResultModelName ||
      getResultModelOption(currentResultProvider)?.modelName ||
      "",
    selectedResultProvider: currentResultProvider,
  };
}

export function buildResultRecalibrationPayload(input: ResultRecalibrationRequest) {
  return input;
}
```

```ts
type PersistedAppState = {
  // existing fields...
  currentResultProvider?: string;
  currentResultModelName?: string;
};

const resultSourceState = readResultSourceState(persistedState);
const [currentResultProvider, setCurrentResultProvider] = useState(resultSourceState.currentResultProvider);
const [currentResultModelName, setCurrentResultModelName] = useState(resultSourceState.currentResultModelName);
const [selectedResultProvider, setSelectedResultProvider] = useState(resultSourceState.selectedResultProvider);
const [isRecalibratingResults, setIsRecalibratingResults] = useState(false);
const [resultRecalibrationError, setResultRecalibrationError] = useState<string | null>(null);
```

- [ ] **Step 4: Add the recalibration action in `App.tsx`**

```ts
async function recalibrateResults() {
  if (topProducts.length === 0) return;

  setIsRecalibratingResults(true);
  setResultRecalibrationError(null);

  const filtered = allProducts.filter(/* reuse existing calculateResults filter conditions */);
  const candidates = filtered.length >= 3 ? filtered : allProducts;
  const scorePreset = selectScorePreset(answers, candidates);
  const rankedCandidates = candidates
    .map((product) => scoreStructuredProduct(product, answers, scorePreset))
    .sort(compareStructuredProducts);
  const rerankPool = rankedCandidates.slice(0, AI_RERANK_POOL_SIZE);
  const backupCandidates = buildBackupCandidates(
    rankedCandidates,
    topProducts.map((product) => product.id),
    BACKUP_SELECTION_COUNT,
  );

  try {
    const response = await postAppAiProxy<ResultRecalibrationResponse>(
      "/api/ai/recalibrate-results",
      buildResultRecalibrationPayload({
        answers,
        targetProvider: selectedResultProvider,
        rerankPool,
        backupCandidates,
        filteredCount: filtered.length,
        recommendationTips,
      }),
    );

    setTopProducts(response.data.topProducts);
    setBackupProducts(response.data.backupProducts);
    setShoppingGuidance(response.data.shoppingGuidance);
    setRecommendationTips(response.data.recommendationTips);
    setCurrentResultProvider(response.provider);
    setCurrentResultModelName(response.modelName);
    setSelectedResultProvider(response.provider);
  } catch (error) {
    setResultRecalibrationError(String(error));
  } finally {
    setIsRecalibratingResults(false);
  }
}
```

- [ ] **Step 5: Run helper test and typecheck**

Run: `node --loader ts-node/esm --test src/lib/result-recalibration.test.ts`

Expected: PASS

Run: `npx tsc --noEmit`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/lib/result-recalibration.ts src/lib/result-recalibration.test.ts
git commit -m "feat: wire result recalibration state into app shell"
```

### Task 4: 更新结果页 UI 并做整体验证

**Files:**
- Modify: `src/pages/ResultsPage.tsx`
- Modify: `src/index.css` (only if shared utility classes are needed)

- [ ] **Step 1: Extend `ResultsPage` props and render the recalibration panel**

```tsx
import { RotateCw, Bot } from "lucide-react";
import { RESULT_MODEL_OPTIONS } from "../lib/result-models.ts";

export function ResultsPage({
  pageVariants,
  answers,
  topProducts,
  backupProducts,
  shoppingGuidance,
  recommendationTips,
  currentResultProvider,
  currentResultModelName,
  selectedResultProvider,
  isRecalibratingResults,
  resultRecalibrationError,
  onSelectResultProvider,
  onRecalibrateResults,
  onReset,
}: {
  // existing props...
  currentResultProvider: string;
  currentResultModelName: string;
  selectedResultProvider: string;
  isRecalibratingResults: boolean;
  resultRecalibrationError: string | null;
  onSelectResultProvider: (provider: AppAiProvider) => void;
  onRecalibrateResults: () => void;
}) {
  const currentModelLabel =
    getResultModelOption(currentResultProvider as AppAiProvider)?.label || currentResultModelName;

  return (
    <>
      <div className="glass-panel mx-auto max-w-4xl rounded-3xl border border-cyan-500/15 bg-cyan-500/5 p-4 sm:p-5">
        <div className="flex items-center gap-2 text-cyan-300">
          <Bot className="h-4 w-4" />
          <span className="text-sm font-medium">模型二次校准</span>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          可切换不同模型，基于当前偏好与候选池重新校准整套推荐结果。
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {RESULT_MODEL_OPTIONS.map((option) => (
            <button
              key={option.provider}
              type="button"
              disabled={isRecalibratingResults}
              onClick={() => onSelectResultProvider(option.provider)}
              className={option.provider === selectedResultProvider ? "..." : "..."}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-400">
            当前结果来源：{currentModelLabel || "未知模型"}
          </p>
          <button
            type="button"
            disabled={isRecalibratingResults}
            onClick={onRecalibrateResults}
            className="glass-button inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm text-white"
          >
            <RotateCw className={isRecalibratingResults ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            {selectedResultProvider === currentResultProvider ? "重新生成当前模型结果" : "重新校准推荐"}
          </button>
        </div>
        {resultRecalibrationError && (
          <p className="mt-3 text-sm text-red-300">
            校准失败，当前仍保留上一版结果：{resultRecalibrationError}
          </p>
        )}
      </div>
      {/* existing guidance and result cards */}
    </>
  );
}
```

- [ ] **Step 2: Pass the new props from `src/App.tsx`**

```tsx
<ResultsPage
  pageVariants={pageVariants}
  answers={answers}
  topProducts={topProducts}
  backupProducts={backupProducts}
  shoppingGuidance={shoppingGuidance}
  recommendationTips={recommendationTips}
  currentResultProvider={currentResultProvider}
  currentResultModelName={currentResultModelName}
  selectedResultProvider={selectedResultProvider}
  isRecalibratingResults={isRecalibratingResults}
  resultRecalibrationError={resultRecalibrationError}
  onSelectResultProvider={setSelectedResultProvider}
  onRecalibrateResults={recalibrateResults}
  onReset={resetQuiz}
/>;
```

- [ ] **Step 3: Run all verification**

Run: `node --loader ts-node/esm --test src/lib/result-models.test.ts src/lib/result-recalibration.test.ts src/server/app-ai-proxy.test.ts src/server/app-ai-service.test.ts`

Expected: PASS

Run: `npx tsc --noEmit`

Expected: PASS

Run: `npm run build`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/pages/ResultsPage.tsx src/App.tsx src/index.css
git commit -m "feat: add results page model recalibration UI"
```
