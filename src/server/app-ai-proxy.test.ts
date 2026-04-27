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
      "dmxapi-minimax": async () => {
        calls.push("dmxapi-minimax");
        return {
          data: [{ id: "p-1", reason: "匹配度高" }],
          modelName: "MiniMax-M2.7-free",
          provider: "dmxapi-minimax",
        };
      },
      "dmxapi-qwen": async () => {
        calls.push("dmxapi-qwen");
        throw new Error("should-not-run");
      },
      "dmxapi-glm": async () => {
        calls.push("dmxapi-glm");
        throw new Error("should-not-run");
      },
      "dmxapi-kimi": async () => {
        calls.push("dmxapi-kimi");
        throw new Error("should-not-run");
      },
      deepseek: async () => {
        calls.push("deepseek");
        throw new Error("should-not-run");
      },
      qwen: async () => {
        calls.push("qwen");
        throw new Error("should-not-run");
      },
      glm: async () => {
        calls.push("glm");
        throw new Error("should-not-run");
      },
    },
  });

  assert.deepEqual(result, {
    data: [{ id: "p-1", reason: "匹配度高" }],
    modelName: "MiniMax-M2.7-free",
    provider: "dmxapi-minimax",
  });
  assert.deepEqual(calls, ["dmxapi-mimo", "dmxapi-minimax"]);
});
