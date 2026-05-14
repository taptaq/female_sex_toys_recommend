import assert from "node:assert/strict";
import test from "node:test";

import { submitRecommendationFeedbackEvent } from "./recommendation-feedback.ts";

test("submitRecommendationFeedbackEvent posts reroll events to the recommendation feedback endpoint", async () => {
  let captured: { url?: string; init?: RequestInit } = {};

  await submitRecommendationFeedbackEvent({
    eventType: "reroll_recommendation",
    sessionId: "session-1",
    answers: { gender: "female", tags: ["女性向"] },
    answerPath: [{ questionId: "q0", tag: "女性向" }],
    topProducts: [{ id: "p1", name: "Pick 1", score: 96 }],
    rerollAttempt: 1,
    rerollReason: "want_different_style",
    resultProvider: "qwen",
    resultModelName: "qwen3.5-27b",
    pageRoute: "/results",
    fetcher: async (url, init) => {
      captured = { url: String(url), init };
      return new Response(JSON.stringify({ id: "event-1" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  assert.equal(captured.url, "/api/recommendation-feedback/events");
  assert.equal(captured.init?.method, "POST");
  assert.deepEqual(JSON.parse(String(captured.init?.body)), {
    eventType: "reroll_recommendation",
    sessionId: "session-1",
    answers: { gender: "female", tags: ["女性向"] },
    answerPath: [{ questionId: "q0", tag: "女性向" }],
    topProducts: [{ id: "p1", name: "Pick 1", score: 96 }],
    rerollAttempt: 1,
    rerollReason: "want_different_style",
    resultProvider: "qwen",
    resultModelName: "qwen3.5-27b",
    pageRoute: "/results",
  });
});

test("submitRecommendationFeedbackEvent surfaces API errors", async () => {
  await assert.rejects(
    () =>
      submitRecommendationFeedbackEvent({
        eventType: "reroll_recommendation",
        answers: { tags: [] },
        topProducts: [],
        rerollAttempt: 1,
        pageRoute: "/results",
        fetcher: async () =>
          new Response(JSON.stringify({ error: "bad payload" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }),
      }),
    /记录推荐反馈失败：bad payload/,
  );
});
