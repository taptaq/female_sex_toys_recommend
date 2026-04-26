# NVIDIA Priority AI Chain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app-level recommendation chain try all NVIDIA-hosted models first, and only then fall back to the existing self-hosted DeepSeek/Qwen/GLM providers.

**Architecture:** Expand the existing app-level NVIDIA DeepSeek scaffolding into a shared provider ladder used by both recommendation call sites. Keep provider-order knowledge in one tiny helper, keep `vite.config.ts` responsible for env exposure, and keep `App.tsx` responsible for prompt construction, provider execution, and JSON parsing.

**Tech Stack:** React 19, TypeScript, OpenAI SDK compatibility mode, node:test, Vite

---

### File Map

**Create:**
- `docs/superpowers/plans/2026-04-26-nvidia-priority-ai-chain.md` — this execution plan

**Modify:**
- `src/lib/app-ai-chain.ts` — expand provider order from two entries to the full NVIDIA-first ladder
- `src/lib/app-ai-chain.test.ts` — verify the new full order
- `src/App.tsx` — add NVIDIA Qwen and NVIDIA GLM helpers, then reorder both app AI call paths
- `vite.config.ts` — keep `NVIDIA_API_KEY` exposed for frontend runtime access

### Task 1: Update The Provider-Order Test First

**Files:**
- Modify: `src/lib/app-ai-chain.test.ts`
- Test: `src/lib/app-ai-chain.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  APP_RECOMMENDATION_PROVIDER_ORDER,
  getPrimaryAppAiProvider,
} from "./app-ai-chain.ts";

test("app ai provider order prefers all NVIDIA providers before self-hosted providers", () => {
  assert.deepEqual(APP_RECOMMENDATION_PROVIDER_ORDER, [
    "nvidia-deepseek",
    "nvidia-qwen",
    "nvidia-glm",
    "deepseek",
    "qwen",
    "glm",
  ]);
  assert.equal(getPrimaryAppAiProvider(), "nvidia-deepseek");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --loader ts-node/esm --test src/lib/app-ai-chain.test.ts`
Expected: FAIL because the current helper only exposes the old `["nvidia", "deepseek"]` order

- [ ] **Step 3: Commit**

```bash
git add src/lib/app-ai-chain.test.ts
git commit -m "test: cover nvidia-first app ai chain order"
```

### Task 2: Expand The Provider-Order Helper

**Files:**
- Modify: `src/lib/app-ai-chain.ts`
- Test: `src/lib/app-ai-chain.test.ts`

- [ ] **Step 1: Write minimal implementation**

```ts
export const APP_RECOMMENDATION_PROVIDER_ORDER = [
  "nvidia-deepseek",
  "nvidia-qwen",
  "nvidia-glm",
  "deepseek",
  "qwen",
  "glm",
] as const;

export type AppAiProvider = (typeof APP_RECOMMENDATION_PROVIDER_ORDER)[number];

export function getPrimaryAppAiProvider(): AppAiProvider {
  return APP_RECOMMENDATION_PROVIDER_ORDER[0];
}
```

- [ ] **Step 2: Run test to verify it passes**

Run: `node --loader ts-node/esm --test src/lib/app-ai-chain.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/app-ai-chain.ts src/lib/app-ai-chain.test.ts
git commit -m "feat: add nvidia-first app ai provider order"
```

### Task 3: Reorder The App Recommendation Chain

**Files:**
- Modify: `src/App.tsx`
- Modify: `vite.config.ts`
- Test: `src/lib/app-ai-chain.test.ts`

- [ ] **Step 1: Keep `NVIDIA_API_KEY` exposed in `vite.config.ts`**

```ts
define: {
  "process.env.NVIDIA_API_KEY": JSON.stringify(env.NVIDIA_API_KEY),
  "process.env.DEEPSEEK_API_KEY": JSON.stringify(env.DEEPSEEK_API_KEY),
  "process.env.QWEN_API_KEY": JSON.stringify(env.QWEN_API_KEY),
  "process.env.MINIMAX_API_KEY": JSON.stringify(env.MINIMAX_API_KEY),
  "process.env.MINIMAX_MODEL": JSON.stringify(env.MINIMAX_MODEL),
},
```

- [ ] **Step 2: Add shared NVIDIA request helpers in `App.tsx`**

```ts
async function callNvidiaDeepseek(prompt: string, temperature: number) {
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  if (!nvidiaKey) throw new Error("Missing NVIDIA Key");

  const openai = new OpenAI({
    apiKey: nvidiaKey,
    baseURL: "https://integrate.api.nvidia.com/v1",
    dangerouslyAllowBrowser: true,
  });

  const response = await openai.chat.completions.create({
    model: "deepseek-ai/deepseek-v4-pro",
    messages: [{ role: "user", content: prompt }],
    temperature,
    top_p: 0.95,
    max_tokens: 16384,
  });

  return response.choices[0].message.content;
}

async function callNvidiaQwen(prompt: string, temperature: number) {
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  if (!nvidiaKey) throw new Error("Missing NVIDIA Key");

  const openai = new OpenAI({
    apiKey: nvidiaKey,
    baseURL: "https://integrate.api.nvidia.com/v1",
    dangerouslyAllowBrowser: true,
  });

  const response = await openai.chat.completions.create({
    model: "qwen/qwen3.5-397b-a17b",
    messages: [{ role: "user", content: prompt }],
    temperature,
    top_p: 0.95,
    max_tokens: 16384,
  });

  return response.choices[0].message.content;
}

async function callNvidiaGlm(prompt: string, temperature: number) {
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  if (!nvidiaKey) throw new Error("Missing NVIDIA Key");

  const openai = new OpenAI({
    apiKey: nvidiaKey,
    baseURL: "https://integrate.api.nvidia.com/v1",
    dangerouslyAllowBrowser: true,
  });

  const response = await openai.chat.completions.create({
    model: "z-ai/glm-5.1",
    messages: [{ role: "user", content: prompt }],
    temperature,
    top_p: 1,
    max_tokens: 16384,
  });

  return response.choices[0].message.content;
}
```

- [ ] **Step 3: Reorder both app AI call sites**

For `callAiRerank`, order the branches as:

```ts
NVIDIA DeepSeek -> NVIDIA Qwen -> NVIDIA GLM -> DeepSeek -> Qwen -> GLM
```

For `callAiResultEnhancement`, use the exact same order:

```ts
NVIDIA DeepSeek -> NVIDIA Qwen -> NVIDIA GLM -> DeepSeek -> Qwen -> GLM
```

Each branch should:

- log provider start/failure clearly
- preserve the existing prompt
- preserve the existing `normalizeJsonResponse(...)` + `JSON.parse(...)` behavior

- [ ] **Step 4: Run verification**

Run: `node --loader ts-node/esm --test src/lib/app-ai-chain.test.ts`
Expected: PASS

Run: `npx tsc --noEmit`
Expected: PASS

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/app-ai-chain.ts src/lib/app-ai-chain.test.ts src/App.tsx vite.config.ts
git commit -m "feat: prefer nvidia providers in app ai chain"
```
