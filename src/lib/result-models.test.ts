import test from "node:test";
import assert from "node:assert/strict";
import { APP_RECOMMENDATION_PROVIDER_ORDER } from "./app-ai-chain.ts";
import {
  DEFAULT_RESULT_MODEL_PROVIDER,
  RESULT_MODEL_OPTIONS,
  getResultModelOption,
  type ResultModelOption,
} from "./result-models.ts";

test("DEFAULT_RESULT_MODEL_PROVIDER follows the first app recommendation provider", () => {
  assert.equal(
    DEFAULT_RESULT_MODEL_PROVIDER,
    APP_RECOMMENDATION_PROVIDER_ORDER[0],
  );
});

test("RESULT_MODEL_OPTIONS preserves provider order and labels", () => {
  assert.deepEqual(RESULT_MODEL_OPTIONS, [
    {
      provider: "dmxapi-mimo",
      model: "mimo-v2.5-free",
      label: "Mimo（DMX）",
      description: "默认先试它，结果通常更稳妥。",
    },
    {
      provider: "dmxapi-minimax",
      model: "MiniMax-M2.7-free",
      label: "MiniMax（DMX）",
      description: "想看更详细的推荐解释，可以试它。",
    },
    {
      provider: "dmxapi-qwen",
      model: "qwen3.5-27b",
      label: "Qwen（DMX）",
      description: "想要更干脆清晰的结果，可以试它。",
    },
    {
      provider: "dmxapi-glm",
      model: "glm-5.1-free",
      label: "GLM（DMX）",
      description: "想快速看一版明确建议，可以试它。",
    },
    {
      provider: "dmxapi-kimi",
      model: "kimi-k2.6-free",
      label: "Kimi（DMX）",
      description: "想看更自然顺滑的说明文字，可以试它。",
    },
    {
      provider: "dmxapi-claude",
      model: "claude-opus-4-7",
      label: "Claude（DMX）",
      description: "想看更细致完整的说明，可以试它。",
    },
    {
      provider: "dmxapi-gemini",
      model: "gemini-3.1-pro-preview-ssvip",
      label: "Gemini（DMX）",
      description: "想换一个更综合的分析视角，可以试它。",
    },
    {
      provider: "dmxapi-grok",
      model: "grok-4.2-nothinking",
      label: "Grok（DMX）",
      description: "想看更直接大胆的一版结果，可以试它。",
    },
    {
      provider: "dmxapi-gpt",
      model: "gpt-5.4",
      label: "GPT（DMX）",
      description: "想看更均衡稳妥的一版结果，可以试它。",
    },
    {
      provider: "dmxapi-kimi-k2",
      model: "kimi-k2.6",
      label: "Kimi K2.6（DMX）",
      description: "想补一层更自然顺滑的表达，可以试它。",
    },
    {
      provider: "deepseek",
      model: "deepseek-v4-flash",
      label: "DeepSeek（官方）",
      description: "想看更直接利落的一版结果，可以试它。",
    },
    {
      provider: "qwen",
      model: "qwen-max",
      label: "Qwen（官方）",
      description: "想再换个稳定一点的视角，也可以试它。",
    },
    {
      provider: "glm",
      model: "glm-4.5-air",
      label: "GLM（官方）",
      description: "想快速再看一版结果，可以试它。",
    },
  ]);
});

test("RESULT_MODEL_OPTIONS stays aligned with APP_RECOMMENDATION_PROVIDER_ORDER", () => {
  assert.deepEqual(
    RESULT_MODEL_OPTIONS.map((option) => option.provider),
    [...APP_RECOMMENDATION_PROVIDER_ORDER],
  );
  assert.deepEqual(
    getResultModelOption(DEFAULT_RESULT_MODEL_PROVIDER),
    RESULT_MODEL_OPTIONS[0],
  );
});

test("getResultModelOption returns the matching option when provider exists", () => {
  assert.deepEqual(getResultModelOption("dmxapi-kimi"), {
    provider: "dmxapi-kimi",
    model: "kimi-k2.6-free",
    label: "Kimi（DMX）",
    description: "想看更自然顺滑的说明文字，可以试它。",
  });
  assert.deepEqual(getResultModelOption("dmxapi-qwen"), {
    provider: "dmxapi-qwen",
    model: "qwen3.5-27b",
    label: "Qwen（DMX）",
    description: "想要更干脆清晰的结果，可以试它。",
  });
  assert.equal(getResultModelOption("missing-provider"), undefined);
});

test("RESULT_MODEL_OPTIONS is protected from accidental mutation", () => {
  assert.equal(Object.isFrozen(RESULT_MODEL_OPTIONS), true);
  assert.equal(Object.isFrozen(RESULT_MODEL_OPTIONS[0]), true);
  assert.throws(() => {
    (RESULT_MODEL_OPTIONS as ResultModelOption[]).push({
      provider: "dmxapi-mimo",
      model: "duplicate",
      label: "Duplicate",
      description: "Duplicate",
    });
  });
});
