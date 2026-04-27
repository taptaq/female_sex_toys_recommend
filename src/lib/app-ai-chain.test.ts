import test from "node:test";
import assert from "node:assert/strict";
import {
  APP_RECOMMENDATION_PROVIDER_ORDER,
  getPrimaryAppAiProvider,
} from "./app-ai-chain.ts";

test("app ai provider order prefers all DMXAPI providers before self-hosted providers", () => {
  assert.deepEqual(APP_RECOMMENDATION_PROVIDER_ORDER, [
    "dmxapi-mimo",
    "dmxapi-minimax",
    "dmxapi-qwen",
    "dmxapi-glm",
    "dmxapi-kimi",
    "deepseek",
    "qwen",
    "glm",
  ]);
  assert.equal(getPrimaryAppAiProvider(), "dmxapi-mimo");
});
