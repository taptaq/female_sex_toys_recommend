# DMXAPI Provider Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the app recommendation chain's NVIDIA-backed providers with DMXAPI-backed providers while preserving the existing self-hosted fallback order and local server proxy entrypoints.

**Architecture:** Keep the current app AI proxy shape intact and scope the migration to the provider-order helper, the server-side third-party provider mapping, and the tests that assert fallback order. Rename the third-party provider ids to `dmxapi-*`, switch the third-party environment variable and base URL to DMXAPI, preserve the direct `deepseek -> qwen -> glm` fallback chain, and prefer a more structured JSON response path for the JSON-returning proxy endpoints when the installed SDK supports it cleanly.

**Tech Stack:** TypeScript, Node.js test runner, Express, OpenAI SDK

---

### Task 1: Lock The New DMXAPI Provider Order In Tests

**Files:**
- Modify: `src/lib/app-ai-chain.test.ts`
- Modify: `src/server/app-ai-proxy.test.ts`
- Test: `node --loader ts-node/esm --test src/lib/app-ai-chain.test.ts src/server/app-ai-proxy.test.ts`

- [ ] **Step 1: Rewrite the provider-order unit test to expect DMXAPI-first order**

Update `src/lib/app-ai-chain.test.ts` so the first-party assertion matches the new provider ids and primary provider:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  APP_RECOMMENDATION_PROVIDER_ORDER,
  getPrimaryAppAiProvider,
} from "./app-ai-chain.ts";

test("app ai provider order prefers all DMXAPI providers before self-hosted providers", () => {
  assert.deepEqual(APP_RECOMMENDATION_PROVIDER_ORDER, [
    "dmxapi-mimo",
    "dmxapi-qwen",
    "dmxapi-glm",
    "dmxapi-kimi",
    "deepseek",
    "qwen",
    "glm",
  ]);
  assert.equal(getPrimaryAppAiProvider(), "dmxapi-mimo");
});
```

- [ ] **Step 2: Rewrite the provider-ladder test to use renamed provider ids**

Update `src/server/app-ai-proxy.test.ts` so the ordered fallback still proves “first success stops the ladder”, but with DMXAPI names:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { runAppAiProviderLadder } from "./app-ai-proxy.ts";
import { APP_RECOMMENDATION_PROVIDER_ORDER } from "../lib/app-ai-chain.ts";

test("runAppAiProviderLadder stops at the first successful provider in order", async () => {
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
        return "success";
      },
      "dmxapi-glm": async () => {
        calls.push("dmxapi-glm");
        return "should-not-run";
      },
      "dmxapi-kimi": async () => "should-not-run",
      deepseek: async () => "should-not-run",
      qwen: async () => "should-not-run",
      glm: async () => "should-not-run",
    },
  });

  assert.equal(result, "success");
  assert.deepEqual(calls, ["dmxapi-mimo", "dmxapi-qwen"]);
});
```

- [ ] **Step 3: Run the targeted tests to verify they fail before implementation**

Run: `node --loader ts-node/esm --test src/lib/app-ai-chain.test.ts src/server/app-ai-proxy.test.ts`
Expected: FAIL because the current code still exports `nvidia-*` provider ids and order.

- [ ] **Step 4: Commit the failing-test checkpoint**

```bash
git add src/lib/app-ai-chain.test.ts src/server/app-ai-proxy.test.ts
git commit -m "test: cover dmxapi-first provider chain"
```

### Task 2: Replace Provider Order And Server Mapping With DMXAPI

**Files:**
- Modify: `src/lib/app-ai-chain.ts`
- Modify: `src/server/index.ts`
- Test: `node --loader ts-node/esm --test src/lib/app-ai-chain.test.ts src/server/app-ai-proxy.test.ts`

- [ ] **Step 1: Replace the provider-order helper with DMXAPI-prefixed ids**

Update `src/lib/app-ai-chain.ts` to export the new order:

```ts
export const APP_RECOMMENDATION_PROVIDER_ORDER = [
  "dmxapi-mimo",
  "dmxapi-qwen",
  "dmxapi-glm",
  "dmxapi-kimi",
  "deepseek",
  "qwen",
  "glm",
] as const;

export type AppAiProvider = (typeof APP_RECOMMENDATION_PROVIDER_ORDER)[number];

export function getPrimaryAppAiProvider(): AppAiProvider {
  return APP_RECOMMENDATION_PROVIDER_ORDER[0];
}
```

- [ ] **Step 2: Replace provider labels and third-party key lookup in `src/server/index.ts`**

Adjust the provider labels and environment variable lookup:

```ts
const PROVIDER_LABELS: Record<AppAiProvider, string> = {
  "dmxapi-mimo": "DMXAPI Mimo",
  "dmxapi-qwen": "DMXAPI Qwen",
  "dmxapi-glm": "DMXAPI GLM",
  "dmxapi-kimi": "DMXAPI Kimi",
  deepseek: "DeepSeek",
  qwen: "Qwen",
  glm: "GLM",
};

// ...

const dmxapiKey = process.env.DMXAPI_API_KEY;
const deepseekKey = process.env.DEEPSEEK_API_KEY;
const qwenKey = process.env.QWEN_API_KEY;
const glmKey = process.env.GLM_API_KEY;
```

- [ ] **Step 3: Replace the third-party provider implementations with DMXAPI base URL and model names**

Update the third-party branch inside `providers`:

```ts
const providers: Record<AppAiProvider, () => Promise<T>> = {
  "dmxapi-mimo": async () => {
    console.log(`🤖 [Server/AI] ${logContext}: 尝试 ${PROVIDER_LABELS["dmxapi-mimo"]}...`);
    return callAndParseJson<T>({
      apiKey: requireKey(dmxapiKey, "DMXAPI_API_KEY"),
      baseURL: "https://www.dmxapi.cn/v1",
      model: "mimo-v2.5-free",
      prompt,
      temperature,
      topP: 0.95,
    }, emptyJson);
  },
  "dmxapi-qwen": async () => {
    console.log(`🤖 [Server/AI] ${logContext}: 尝试 ${PROVIDER_LABELS["dmxapi-qwen"]}...`);
    return callAndParseJson<T>({
      apiKey: requireKey(dmxapiKey, "DMXAPI_API_KEY"),
      baseURL: "https://www.dmxapi.cn/v1",
      model: "qwen3.5-plus-free",
      prompt,
      temperature,
      topP: 0.95,
    }, emptyJson);
  },
  "dmxapi-glm": async () => {
    console.log(`🤖 [Server/AI] ${logContext}: 尝试 ${PROVIDER_LABELS["dmxapi-glm"]}...`);
    return callAndParseJson<T>({
      apiKey: requireKey(dmxapiKey, "DMXAPI_API_KEY"),
      baseURL: "https://www.dmxapi.cn/v1",
      model: "glm-5.1-free",
      prompt,
      temperature,
      topP: 1,
    }, emptyJson);
  },
  "dmxapi-kimi": async () => {
    console.log(`🤖 [Server/AI] ${logContext}: 尝试 ${PROVIDER_LABELS["dmxapi-kimi"]}...`);
    return callAndParseJson<T>({
      apiKey: requireKey(dmxapiKey, "DMXAPI_API_KEY"),
      baseURL: "https://www.dmxapi.cn/v1",
      model: "kimi-k2.6-free",
      prompt,
      temperature,
      topP: 1,
    }, emptyJson);
  },
  deepseek: async () => {
    // keep existing self-hosted fallback
  },
  qwen: async () => {
    // keep existing self-hosted fallback
  },
  glm: async () => {
    // keep existing self-hosted fallback
  },
};
```

When applying this step, remove the old `nvidia-*` keys entirely instead of aliasing them.

- [ ] **Step 4: Add or preserve a structured JSON-friendly response path for DMXAPI-backed calls**

Within `src/server/index.ts`, keep the existing normalization helper available, but shape the server-side DMXAPI request flow so JSON-returning endpoints can use a stricter response mode when the installed OpenAI SDK supports it without broad refactoring.

Implementation target:

```ts
async function callAndParseJson<T>(
  options: Parameters<typeof callChatCompletionContent>[0],
  emptyJson: string,
) {
  const content = await callChatCompletionContent(options);
  return JSON.parse(normalizeJsonResponse(content) || emptyJson) as T;
}
```

If SDK inspection during execution confirms a safe structured-output path for this repo, apply it behind this helper or a sibling helper. If not, keep this helper as the stable fallback so the migration remains shippable.

- [ ] **Step 5: Run the targeted tests again and verify the new order passes**

Run: `node --loader ts-node/esm --test src/lib/app-ai-chain.test.ts src/server/app-ai-proxy.test.ts`
Expected: PASS with the DMXAPI-first order and unchanged ladder semantics.

- [ ] **Step 6: Commit the provider migration**

```bash
git add src/lib/app-ai-chain.ts src/server/index.ts src/lib/app-ai-chain.test.ts src/server/app-ai-proxy.test.ts
git commit -m "feat: replace nvidia providers with dmxapi"
```

### Task 3: Run Broader Verification Against The Existing App Proxy Build

**Files:**
- Verify only: `src/server/app-ai-proxy.ts`
- Verify only: `src/App.tsx`
- Verify only: `src/server/index.ts`

- [ ] **Step 1: Run the server proxy unit test suite directly**

Run: `node --loader ts-node/esm --test src/server/app-ai-proxy.test.ts`
Expected: PASS

- [ ] **Step 2: Run TypeScript without emitting**

Run: `npx tsc --noEmit`
Expected: PASS with no type errors from renamed provider ids.

- [ ] **Step 3: Run the production build**

Run: `npm run build`
Expected: PASS and generate the production bundle successfully.

- [ ] **Step 4: Commit the verification checkpoint if this work is isolated in a clean branch**

```bash
git status --short
```

Expected: only the intended DMXAPI migration files are part of this change set before any final integration or PR step.
