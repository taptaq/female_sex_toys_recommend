# App AI Server Proxy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the app-level AI recommendation calls behind local server endpoints so the browser no longer talks directly to NVIDIA or other model providers.

**Architecture:** Add a small server-side provider-ladder helper with a focused test, then extend `src/server/index.ts` with JSON endpoints for rerank and result enhancement. `App.tsx` will keep prompt generation and local fallback behavior, but it will send prompt payloads to `/api/ai/...` instead of constructing model clients in the browser.

**Tech Stack:** Express, TypeScript, OpenAI SDK compatibility mode, node:test, Vite

---

### File Map

**Create:**
- `src/server/app-ai-proxy.ts` — shared server-side provider ladder executor
- `src/server/app-ai-proxy.test.ts` — focused test for provider order and early success behavior

**Modify:**
- `src/server/index.ts` — add JSON body parsing, AI provider runners, and `/api/ai/...` endpoints
- `src/App.tsx` — remove direct provider calls and call local proxy endpoints instead
- `vite.config.ts` — stop injecting third-party AI keys into the frontend runtime

### Task 1: Add Failing Test For The Server-Side Provider Ladder

**Files:**
- Create: `src/server/app-ai-proxy.test.ts`
- Test: `src/server/app-ai-proxy.test.ts`

- [ ] **Step 1: Write the failing test**

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
      "nvidia-deepseek": async () => {
        calls.push("nvidia-deepseek");
        throw new Error("down");
      },
      "nvidia-qwen": async () => {
        calls.push("nvidia-qwen");
        return "success";
      },
      "nvidia-glm": async () => {
        calls.push("nvidia-glm");
        return "should-not-run";
      },
      "nvidia-kimi": async () => "should-not-run",
      deepseek: async () => "should-not-run",
      qwen: async () => "should-not-run",
      glm: async () => "should-not-run",
    },
  });

  assert.equal(result, "success");
  assert.deepEqual(calls, ["nvidia-deepseek", "nvidia-qwen"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --loader ts-node/esm --test src/server/app-ai-proxy.test.ts`
Expected: FAIL because `src/server/app-ai-proxy.ts` does not exist yet

- [ ] **Step 3: Commit**

```bash
git add src/server/app-ai-proxy.test.ts
git commit -m "test: cover app ai server proxy ladder"
```

### Task 2: Implement The Server-Side Provider Ladder Helper

**Files:**
- Create: `src/server/app-ai-proxy.ts`
- Test: `src/server/app-ai-proxy.test.ts`

- [ ] **Step 1: Write minimal implementation**

```ts
import type { AppAiProvider } from "../lib/app-ai-chain";

type ProviderMap = Record<AppAiProvider, () => Promise<string>>;

export async function runAppAiProviderLadder({
  providerOrder,
  providers,
}: {
  providerOrder: readonly AppAiProvider[];
  providers: ProviderMap;
}) {
  let lastError: unknown;

  for (const provider of providerOrder) {
    try {
      return await providers[provider]();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("No provider available");
}
```

- [ ] **Step 2: Run test to verify it passes**

Run: `node --loader ts-node/esm --test src/server/app-ai-proxy.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/server/app-ai-proxy.ts src/server/app-ai-proxy.test.ts
git commit -m "feat: add app ai server proxy ladder"
```

### Task 3: Move App AI Calls Behind Local Server Endpoints

**Files:**
- Modify: `src/server/index.ts`
- Modify: `src/App.tsx`
- Modify: `vite.config.ts`
- Test: `src/server/app-ai-proxy.test.ts`

- [ ] **Step 1: Add server-side AI endpoints and provider runners**

In `src/server/index.ts`:

```ts
app.use(express.json());
```

Add:

- `POST /api/ai/rerank`
- `POST /api/ai/result-enhancement`

Each endpoint should:

- read `{ prompt }` from the request body
- run the full provider order
- parse provider output into the same JSON shape the frontend already expects
- return `500` with details if every provider fails

Provider execution order must stay:

```ts
NVIDIA DeepSeek -> NVIDIA Qwen -> NVIDIA GLM -> NVIDIA Kimi -> DeepSeek -> Qwen -> GLM
```

- [ ] **Step 2: Replace direct browser provider calls in `App.tsx`**

In `src/App.tsx`:

- remove `OpenAI` import
- remove `callNvidiaDeepseek`, `callNvidiaQwen`, `callNvidiaGlm`, `callNvidiaKimi`
- remove direct DeepSeek/Qwen/GLM browser client construction
- replace each app AI call with local proxy fetches like:

```ts
const response = await fetch("/api/ai/rerank", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prompt }),
});
```

and

```ts
const response = await fetch("/api/ai/result-enhancement", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prompt }),
});
```

If the local endpoint fails, preserve the current local fallback behavior already present in `calculateResults`.

- [ ] **Step 3: Stop exposing third-party AI keys to the frontend**

In `vite.config.ts`, remove browser-side injection for:

```ts
process.env.NVIDIA_API_KEY
process.env.DEEPSEEK_API_KEY
process.env.QWEN_API_KEY
```

The AI keys should only be read on the server side after this migration.

- [ ] **Step 4: Run verification**

Run: `node --loader ts-node/esm --test src/server/app-ai-proxy.test.ts`
Expected: PASS

Run: `npx tsc --noEmit`
Expected: PASS

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/app-ai-proxy.ts src/server/app-ai-proxy.test.ts src/server/index.ts src/App.tsx vite.config.ts
git commit -m "feat: proxy app ai calls through local server"
```
