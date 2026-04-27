# AI Response Model Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the recommendation AI endpoints return `data`, `modelName`, and `provider` together, while keeping the current recommendation flow and UI behavior unchanged for end users.

**Architecture:** Keep the existing local AI proxy routes and provider ladder, but extend the server-side provider execution result so it carries metadata about the winning provider and concrete model name. Update the frontend proxy caller to parse the wrapped response object, continue consuming `data` for business logic, and optionally log the selected model/provider in development without surfacing it in the production UI.

**Tech Stack:** TypeScript, React, Express, Node.js test runner, OpenAI SDK

---

### Task 1: Lock The New Wrapped API Contract In Tests

**Files:**
- Modify: `src/server/app-ai-proxy.test.ts`
- Create or Modify: `src/server/index.ts` (only if adding small pure helper tests inline is clearly established; otherwise skip in this task)
- Test: `node --loader ts-node/esm --test src/server/app-ai-proxy.test.ts`

- [ ] **Step 1: Extend the ladder test surface to match metadata-carrying results**

Update the server proxy test so it no longer assumes providers only return a raw business payload. The test should assert that the ladder can return an object carrying both the business result and metadata:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { runAppAiProviderLadder } from "./app-ai-proxy.ts";
import { APP_RECOMMENDATION_PROVIDER_ORDER } from "../lib/app-ai-chain.ts";

test("runAppAiProviderLadder returns the first successful metadata-carrying provider result", async () => {
  const calls: string[] = [];

  const result = await runAppAiProviderLadder({
    providerOrder: APP_RECOMMENDATION_PROVIDER_ORDER,
    providers: {
      "dmxapi-mimo": async () => {
        calls.push("dmxapi-mimo");
        throw new Error("down");
      },
      "dmxapi-qwen": async () => {
        calls.push("dmxapi-qwen");
        return {
          data: [{ id: "p-1", reason: "匹配度高" }],
          modelName: "qwen3.5-plus-free",
          provider: "dmxapi-qwen",
        };
      },
      "dmxapi-glm": async () => {
        throw new Error("should-not-run");
      },
      "dmxapi-kimi": async () => {
        throw new Error("should-not-run");
      },
      deepseek: async () => {
        throw new Error("should-not-run");
      },
      qwen: async () => {
        throw new Error("should-not-run");
      },
      glm: async () => {
        throw new Error("should-not-run");
      },
    },
  });

  assert.deepEqual(result, {
    data: [{ id: "p-1", reason: "匹配度高" }],
    modelName: "qwen3.5-plus-free",
    provider: "dmxapi-qwen",
  });
  assert.deepEqual(calls, ["dmxapi-mimo", "dmxapi-qwen"]);
});
```

- [ ] **Step 2: Run the focused test first to see the current red/green baseline**

Run: `node --loader ts-node/esm --test src/server/app-ai-proxy.test.ts`
Expected: If the ladder already supports generic payloads, this may stay PASS. If not, capture the failing mismatch before implementation.

- [ ] **Step 3: Commit the contract-test checkpoint**

```bash
git add src/server/app-ai-proxy.test.ts
git commit -m "test: cover ai response model metadata contract"
```

### Task 2: Return `data + modelName + provider` From The Server AI Routes

**Files:**
- Modify: `src/server/index.ts`
- Verify: `src/server/app-ai-proxy.ts`
- Test: `node --loader ts-node/esm --test src/server/app-ai-proxy.test.ts`

- [ ] **Step 1: Introduce explicit response envelope types in `src/server/index.ts`**

Near the AI helper section, add small local types so the route payload shape is explicit:

```ts
type AiProxyEnvelope<T> = {
  data: T;
  modelName: string;
  provider: AppAiProvider;
};

type AiProviderExecution<T> = {
  data: T;
  modelName: string;
  provider: AppAiProvider;
};
```

- [ ] **Step 2: Make the provider map return both parsed data and metadata**

Update the provider call path so each successful provider returns an object shaped like:

```ts
return {
  data: await callAndParseJson<T>(
    {
      apiKey: requireKey(dmxapiKey, "DMXAPI_API_KEY"),
      baseURL: "https://www.dmxapi.cn/v1",
      model: "mimo-v2.5-free",
      prompt,
      temperature,
      topP: 0.95,
    },
    emptyJson,
  ),
  modelName: "mimo-v2.5-free",
  provider: "dmxapi-mimo",
} satisfies AiProviderExecution<T>;
```

Apply the same pattern to:
- `dmxapi-qwen`
- `dmxapi-glm`
- `dmxapi-kimi`
- `deepseek`
- `qwen`
- `glm`

Keep the existing parsing path:

```ts
const content = await callChatCompletionContent(options);
return JSON.parse(normalizeJsonResponse(content) || emptyJson) as T;
```

- [ ] **Step 3: Make `runServerAiProxy` return the envelope instead of a bare business payload**

Change `runServerAiProxy<T>(...)` to resolve an `AiProxyEnvelope<T>`:

```ts
async function runServerAiProxy<T>({
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
  // ...

  const providers: Record<AppAiProvider, () => Promise<AiProviderExecution<T>>> = {
    // ...
  };

  return runAppAiProviderLadder<AiProviderExecution<T>>({
    providerOrder: APP_RECOMMENDATION_PROVIDER_ORDER,
    providers,
    onProviderError(provider, error) {
      console.warn(
        `⚠️ [Server/AI] ${logContext}: ${PROVIDER_LABELS[provider]} 失败，继续下一个兜底...`,
        error,
      );
    },
  });
}
```

- [ ] **Step 4: Update `/api/ai/rerank` and `/api/ai/result-enhancement` to return the wrapped response**

Keep route URLs and validation unchanged, but ensure the JSON body is now the full envelope:

```ts
const result = await runServerAiProxy<unknown[]>({
  prompt,
  temperature: 0.1,
  emptyJson: "[]",
  logContext: "Top3 重排",
});
res.json(result);
```

and:

```ts
const result = await runServerAiProxy<Record<string, unknown>>({
  prompt,
  temperature: 0.3,
  emptyJson: "{}",
  logContext: "结果增强",
});
res.json(result);
```

- [ ] **Step 5: Re-run the focused server proxy test**

Run: `node --loader ts-node/esm --test src/server/app-ai-proxy.test.ts`
Expected: PASS

- [ ] **Step 6: Commit the server envelope change**

```bash
git add src/server/index.ts src/server/app-ai-proxy.test.ts
git commit -m "feat: return ai model metadata from proxy routes"
```

### Task 3: Update The Frontend Proxy Caller To Consume The Envelope

**Files:**
- Modify: `src/App.tsx`
- Test: `npx tsc --noEmit`

- [ ] **Step 1: Define a shared frontend response envelope type**

Near the existing AI result types in `src/App.tsx`, add:

```ts
type AppAiProxyResponse<T> = {
  data: T;
  modelName: string;
  provider: string;
};
```

- [ ] **Step 2: Make `postAppAiProxy` return the full envelope**

Replace the current return type and JSON parse assumption:

```ts
async function postAppAiProxy<T>(
  path: string,
  prompt: string,
): Promise<AppAiProxyResponse<T>> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    let details = `HTTP ${response.status}`;
    try {
      const payload = await response.json();
      details = payload?.details || payload?.error || details;
    } catch {
      // ignore JSON parse failure and keep HTTP status detail
    }
    throw new Error(details);
  }

  return (await response.json()) as AppAiProxyResponse<T>;
}
```

- [ ] **Step 3: Update `callAiRerank` to consume `data` and optionally log metadata**

Change the rerank path to:

```ts
const response = await postAppAiProxy<AiReasonResult[]>("/api/ai/rerank", prompt);

if (import.meta.env.DEV) {
  console.log(
    `[AI] rerank model: ${response.modelName} (${response.provider})`,
  );
}

return response.data;
```

- [ ] **Step 4: Update `callAiResultEnhancement` the same way**

Change the enhancement path to:

```ts
const response = await postAppAiProxy<AiResultEnhancement>(
  "/api/ai/result-enhancement",
  prompt,
);

if (import.meta.env.DEV) {
  console.log(
    `[AI] result enhancement model: ${response.modelName} (${response.provider})`,
  );
}

return response.data;
```

- [ ] **Step 5: Verify the frontend still type-checks**

Run: `npx tsc --noEmit`
Expected: PASS with no frontend type errors from the wrapped response contract.

- [ ] **Step 6: Commit the frontend contract update**

```bash
git add src/App.tsx
git commit -m "feat: consume ai response model metadata"
```

### Task 4: Run End-To-End Verification For The Contract Change

**Files:**
- Verify only: `src/server/index.ts`
- Verify only: `src/App.tsx`
- Verify only: `src/server/app-ai-proxy.test.ts`

- [ ] **Step 1: Re-run the targeted recommendation metadata test**

Run: `node --loader ts-node/esm --test src/server/app-ai-proxy.test.ts`
Expected: PASS

- [ ] **Step 2: Re-run the broader provider-order and ladder tests**

Run: `node --loader ts-node/esm --test src/lib/app-ai-chain.test.ts src/server/app-ai-proxy.test.ts`
Expected: PASS

- [ ] **Step 3: Re-run TypeScript**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Re-run production build**

Run: `npm run build`
Expected: PASS and produce the production bundle successfully.

- [ ] **Step 5: Sanity-check for accidental UI exposure**

Run: `rg -n "modelName|provider" src/App.tsx src/pages -g '!dist'`
Expected:
- metadata is consumed in `src/App.tsx`
- no new production-facing model label is rendered in result page UI

- [ ] **Step 6: Commit the verification checkpoint if the branch is cleanly isolated**

```bash
git status --short
```

Expected: only the intended metadata-contract files are part of this change set before final integration.
