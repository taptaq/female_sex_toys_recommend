import test from "node:test";
import assert from "node:assert/strict";
import {
  APP_RECOMMENDATION_PROVIDER_ORDER,
  getPrimaryAppAiProvider,
} from "./app-ai-chain.ts";

test("app ai provider order prefers Qinaigc before DMXAPI for minimax, qwen, and glm", () => {
  assert.deepEqual(APP_RECOMMENDATION_PROVIDER_ORDER, [
    "dmxapi-mimo",
    "qnaigc-minimax",
    "dmxapi-minimax",
    "qnaigc-qwen",
    "dmxapi-qwen",
    "qnaigc-glm",
    "dmxapi-glm",
    "kimi",
    "dmxapi-claude",
    "dmxapi-gemini",
    "dmxapi-grok",
    "dmxapi-gpt",
    "deepseek",
    "qwen",
    "glm",
  ]);
  assert.equal(getPrimaryAppAiProvider(), "dmxapi-mimo");
});
