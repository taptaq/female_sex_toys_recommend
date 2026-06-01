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
      "qnaigc-minimax": async () => {
        calls.push("qnaigc-minimax");
        throw new Error("still-down");
      },
      "dmxapi-minimax": async () => {
        calls.push("dmxapi-minimax");
        return {
          data: [{ id: "p-1", reason: "匹配度高" }],
          modelName: "MiniMax-M2.7-free",
          provider: "dmxapi-minimax",
        };
      },
      "qnaigc-qwen": async () => {
        calls.push("qnaigc-qwen");
        throw new Error("should-not-run");
      },
      "dmxapi-qwen": async () => {
        calls.push("dmxapi-qwen");
        throw new Error("should-not-run");
      },
      "qnaigc-glm": async () => {
        calls.push("qnaigc-glm");
        throw new Error("should-not-run");
      },
      "dmxapi-glm": async () => {
        calls.push("dmxapi-glm");
        throw new Error("should-not-run");
      },
      kimi: async () => {
        calls.push("kimi");
        throw new Error("should-not-run");
      },
      "dmxapi-claude": async () => {
        calls.push("dmxapi-claude");
        throw new Error("should-not-run");
      },
      "dmxapi-gemini": async () => {
        calls.push("dmxapi-gemini");
        throw new Error("should-not-run");
      },
      "dmxapi-grok": async () => {
        calls.push("dmxapi-grok");
        throw new Error("should-not-run");
      },
      "dmxapi-gpt": async () => {
        calls.push("dmxapi-gpt");
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
  assert.deepEqual(calls, ["dmxapi-mimo", "qnaigc-minimax", "dmxapi-minimax"]);
});

test("runAppAiProviderLadder skips a provider when it exceeds the timeout", async () => {
  const calls: string[] = [];

  const result = await runAppAiProviderLadder({
    providerOrder: ["dmxapi-mimo", "qnaigc-minimax", "dmxapi-minimax"],
    providerTimeoutMs: 5,
    providers: {
      "dmxapi-mimo": async () => {
        calls.push("dmxapi-mimo");
        await new Promise((resolve) => setTimeout(resolve, 30));
        return {
          data: [{ id: "p-1", reason: "过慢结果不应采用" }],
          modelName: "mimo-v2.5-pro",
          provider: "dmxapi-mimo",
        };
      },
      "qnaigc-minimax": async () => {
        calls.push("qnaigc-minimax");
        return {
          data: [{ id: "p-1", reason: "七牛兜底结果" }],
          modelName: "minimax/minimax-m3",
          provider: "qnaigc-minimax",
        };
      },
      "dmxapi-minimax": async () => {
        calls.push("dmxapi-minimax");
        return {
          data: [{ id: "p-2", reason: "快速兜底结果" }],
          modelName: "MiniMax-M2.7-free",
          provider: "dmxapi-minimax",
        };
      },
      "qnaigc-qwen": async () => {
        throw new Error("unused");
      },
      "dmxapi-qwen": async () => {
        throw new Error("unused");
      },
      "qnaigc-glm": async () => {
        throw new Error("unused");
      },
      "dmxapi-glm": async () => {
        throw new Error("unused");
      },
      kimi: async () => {
        throw new Error("unused");
      },
      "dmxapi-claude": async () => {
        throw new Error("unused");
      },
      "dmxapi-gemini": async () => {
        throw new Error("unused");
      },
      "dmxapi-grok": async () => {
        throw new Error("unused");
      },
      "dmxapi-gpt": async () => {
        throw new Error("unused");
      },
      deepseek: async () => {
        throw new Error("unused");
      },
      qwen: async () => {
        throw new Error("unused");
      },
      glm: async () => {
        throw new Error("unused");
      },
    },
  });

  assert.deepEqual(result, {
    data: [{ id: "p-1", reason: "七牛兜底结果" }],
    modelName: "minimax/minimax-m3",
    provider: "qnaigc-minimax",
  });
  assert.deepEqual(calls, ["dmxapi-mimo", "qnaigc-minimax"]);
});
