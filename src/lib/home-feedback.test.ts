import assert from "node:assert/strict";
import test from "node:test";

import { submitHomeFeedback } from "./home-feedback.ts";

test("submitHomeFeedback posts anonymous home feedback to the feedback API", async () => {
  let captured: { url: RequestInfo | URL; init?: RequestInit } | null = null;

  const result = await submitHomeFeedback({
    message: "首页的推荐说明很有帮助",
    screenshots: ["https://example.com/shot-1.png"],
    pageRoute: "/",
    fetcher: async (url, init) => {
      captured = { url, init };
      return {
        ok: true,
        json: async () => ({ id: "feedback-1" }),
      } as Response;
    },
  });

  assert.deepEqual(result, { id: "feedback-1" });
  assert.equal(captured?.url, "/api/feedback");
  assert.equal(captured?.init?.method, "POST");
  assert.deepEqual(captured?.init?.headers, {
    "Content-Type": "application/json",
  });
  assert.deepEqual(JSON.parse(String(captured?.init?.body)), {
    message: "首页的推荐说明很有帮助",
    screenshots: ["https://example.com/shot-1.png"],
    pageRoute: "/",
  });
});

test("submitHomeFeedback surfaces API error text when feedback submission fails", async () => {
  await assert.rejects(
    () =>
      submitHomeFeedback({
        message: "提交后没有成功提示",
        screenshots: [],
        pageRoute: "/compare",
        fetcher: async () =>
          ({
            ok: false,
            json: async () => ({
              details: "feedback insert failed",
            }),
          }) as Response,
      }),
    /feedback insert failed/,
  );
});

test("submitHomeFeedback falls back to base error text when the API error response is not JSON", async () => {
  await assert.rejects(
    () =>
      submitHomeFeedback({
        message: "反馈接口返回了异常内容",
        screenshots: [],
        pageRoute: "/library",
        fetcher: async () =>
          ({
            ok: false,
            json: async () => {
              throw new Error("Unexpected token < in JSON");
            },
          }) as unknown as Response,
      }),
    /提交反馈失败，请稍后重试/,
  );
});

test("submitHomeFeedback rejects malformed success payloads with a controlled error", async () => {
  await assert.rejects(
    () =>
      submitHomeFeedback({
        message: "反馈提交成功但响应体不完整",
        screenshots: [],
        pageRoute: "/quiz",
        fetcher: async () =>
          ({
            ok: true,
            json: async () => ({}),
          }) as Response,
      }),
    /提交反馈失败，请稍后重试/,
  );
});
