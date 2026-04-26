# NVIDIA DeepSeek Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app-level recommendation AI chain try NVIDIA's DeepSeek-compatible endpoint first, then fall back to the current DeepSeek endpoint before continuing to Qwen and GLM.

**Architecture:** Keep the change scoped to the app recommendation path by extracting a tiny provider-order helper plus one shared NVIDIA request helper in `src/App.tsx`. `App.tsx` will continue to own prompt construction and JSON parsing, while `vite.config.ts` exposes the new `NVIDIA_API_KEY` to the frontend runtime.

**Tech Stack:** React 19, TypeScript, OpenAI SDK compatibility mode, node:test, Vite

---

### File Map

**Create:**
- `src/lib/app-ai-chain.ts` — app-level DeepSeek provider order constants and helper
- `src/lib/app-ai-chain.test.ts` — focused test for the provider order

**Modify:**
- `src/App.tsx` — add NVIDIA-first request path for rerank and result enhancement
- `vite.config.ts` — expose `NVIDIA_API_KEY`

### Task 1: Add Failing Test For App AI Provider Order

**Files:**
- Create: `src/lib/app-ai-chain.test.ts`
- Test: `src/lib/app-ai-chain.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  APP_DEEPSEEK_PROVIDER_ORDER,
  getPrimaryAppDeepseekProvider,
} from "./app-ai-chain.ts";

test("app deepseek provider order prefers NVIDIA before direct DeepSeek", () => {
  assert.deepEqual(APP_DEEPSEEK_PROVIDER_ORDER, ["nvidia", "deepseek"]);
  assert.equal(getPrimaryAppDeepseekProvider(), "nvidia");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --loader ts-node/esm --test src/lib/app-ai-chain.test.ts`
Expected: FAIL because `src/lib/app-ai-chain.ts` does not exist yet

- [ ] **Step 3: Commit**

```bash
git add src/lib/app-ai-chain.test.ts
git commit -m "test: cover app deepseek provider order"
```

### Task 2: Implement Provider-Order Helper

**Files:**
- Create: `src/lib/app-ai-chain.ts`
- Test: `src/lib/app-ai-chain.test.ts`

- [ ] **Step 1: Write minimal implementation**

```ts
export const APP_DEEPSEEK_PROVIDER_ORDER = ["nvidia", "deepseek"] as const;

export type AppDeepseekProvider = (typeof APP_DEEPSEEK_PROVIDER_ORDER)[number];

export function getPrimaryAppDeepseekProvider(): AppDeepseekProvider {
  return APP_DEEPSEEK_PROVIDER_ORDER[0];
}
```

- [ ] **Step 2: Run test to verify it passes**

Run: `node --loader ts-node/esm --test src/lib/app-ai-chain.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/app-ai-chain.ts src/lib/app-ai-chain.test.ts
git commit -m "feat: add app deepseek provider order helper"
```

### Task 3: Wire NVIDIA Before DeepSeek In App

**Files:**
- Modify: `src/App.tsx`
- Modify: `vite.config.ts`
- Test: `src/lib/app-ai-chain.test.ts`

- [ ] **Step 1: Expose `NVIDIA_API_KEY` to the frontend runtime**

```ts
define: {
  "process.env.NVIDIA_API_KEY": JSON.stringify(env.NVIDIA_API_KEY),
  "process.env.DEEPSEEK_API_KEY": JSON.stringify(env.DEEPSEEK_API_KEY),
  "process.env.QWEN_API_KEY": JSON.stringify(env.QWEN_API_KEY),
  "process.env.MINIMAX_API_KEY": JSON.stringify(env.MINIMAX_API_KEY),
  "process.env.MINIMAX_MODEL": JSON.stringify(env.MINIMAX_MODEL),
},
```

- [ ] **Step 2: Add a shared NVIDIA request helper and insert it before direct DeepSeek**

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
    chat_template_kwargs: { thinking: false },
  });

  return response.choices[0].message.content;
}
```

Then use it in both app-level AI chains:

```ts
try {
  console.log("🤖 [AI] 正在启动首选引擎: NVIDIA DeepSeek，在结构化候选池中重排 Top3...");
  const content = await callNvidiaDeepseek(prompt, 0.1);
  return JSON.parse(normalizeJsonResponse(content) || "[]");
} catch (e) {
  console.warn("⚠️ [AI] NVIDIA DeepSeek 重排失败，切换至自有 DeepSeek...", e);
}
```

and

```ts
try {
  console.log("🤖 [AI] 正在为备选结果与选购建议生成增强文案: NVIDIA DeepSeek...");
  const content = await callNvidiaDeepseek(prompt, 0.3);
  return JSON.parse(normalizeJsonResponse(content) || "{}") as AiResultEnhancement;
} catch (e) {
  console.warn("⚠️ [AI] NVIDIA DeepSeek 结果增强失败，切换至自有 DeepSeek...", e);
}
```

Keep the existing direct DeepSeek, Qwen, and GLM paths after these new NVIDIA attempts.

- [ ] **Step 3: Run verification**

Run: `node --loader ts-node/esm --test src/lib/app-ai-chain.test.ts`
Expected: PASS

Run: `npx tsc --noEmit`
Expected: PASS

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts src/App.tsx
git commit -m "feat: prefer nvidia deepseek in app fallback chain"
```
