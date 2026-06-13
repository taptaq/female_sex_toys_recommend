import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";

import { createSaveRecommendationFeedbackEventHandler } from "./recommendation-feedback-route.ts";

function createMockRequest({
  headers = {},
  body = {},
}: {
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
}) {
  return { headers, body } as Request;
}

function createMockResponse() {
  let statusCode = 200;
  let jsonPayload: unknown;

  const response = {
    status(code: number) {
      statusCode = code;
      return response;
    },
    json(payload: unknown) {
      jsonPayload = payload;
      return response;
    },
  } as unknown as Response;

  return {
    response,
    readStatusCode() {
      return statusCode;
    },
    readJsonPayload() {
      return jsonPayload;
    },
  };
}

test("recommendation feedback handler rejects unsupported event types", async () => {
  let saveCount = 0;
  const handler = createSaveRecommendationFeedbackEventHandler({
    store: {
      saveEvent: async () => {
        saveCount += 1;
        return { id: "event-1" };
      },
    },
  });

  const mockResponse = createMockResponse();
  await handler(
    createMockRequest({
      body: {
        eventType: "unknown",
        answers: {},
        topProducts: [],
      },
    }),
    mockResponse.response,
  );

  assert.equal(saveCount, 0);
  assert.equal(mockResponse.readStatusCode(), 400);
  assert.deepEqual(mockResponse.readJsonPayload(), {
    error: "Unsupported recommendation feedback event type",
  });
});

test("recommendation feedback handler stores normalized reroll events", async () => {
  let captured: unknown;
  const handler = createSaveRecommendationFeedbackEventHandler({
    store: {
      saveEvent: async (payload) => {
        captured = payload;
        return { id: "event-1" };
      },
    },
  });

  const mockResponse = createMockResponse();
  await handler(
    createMockRequest({
      headers: {
        "user-agent": "Mozilla/5.0 RecommendationFeedbackTest",
      },
      body: {
        eventType: "reroll_recommendation",
        sessionId: "session-1",
        answers: { gender: "unisex", tags: ["情侣共玩"] },
        answerPath: [{ questionId: "q0", tag: "情侣共玩" }],
        topProducts: [{ id: "p1", name: "Pick 1", score: 98 }],
        rerollAttempt: 3,
        rerollReason: "did_not_understand",
        resultProvider: "kimi",
        resultModelName: "kimi-k2.6",
        pageRoute: " /results ",
      },
    }),
    mockResponse.response,
  );

  assert.equal(mockResponse.readStatusCode(), 201);
  assert.deepEqual(mockResponse.readJsonPayload(), { id: "event-1" });
  assert.deepEqual(captured, {
    eventType: "reroll_recommendation",
    sessionId: "session-1",
    answers: { gender: "unisex", tags: ["情侣共玩"] },
    answerPath: [{ questionId: "q0", tag: "情侣共玩" }],
    topProducts: [{ id: "p1", name: "Pick 1", score: 98 }],
    rerollAttempt: 3,
    rerollReason: "did_not_understand",
    resultProvider: "kimi",
    resultModelName: "kimi-k2.6",
    pageRoute: "/results",
    userAgent: "Mozilla/5.0 RecommendationFeedbackTest",
  });
});

test("recommendation feedback handler rejects oversized answer payloads", async () => {
  let saveCount = 0;
  const handler = createSaveRecommendationFeedbackEventHandler({
    store: {
      saveEvent: async () => {
        saveCount += 1;
        return { id: "event-1" };
      },
    },
  });

  const mockResponse = createMockResponse();
  await handler(
    createMockRequest({
      body: {
        eventType: "reroll_recommendation",
        answers: { freeText: "x".repeat(31_000) },
      },
    }),
    mockResponse.response,
  );

  assert.equal(saveCount, 0);
  assert.equal(mockResponse.readStatusCode(), 413);
  assert.deepEqual(mockResponse.readJsonPayload(), {
    error: "Recommendation feedback answers are too large",
  });
});
