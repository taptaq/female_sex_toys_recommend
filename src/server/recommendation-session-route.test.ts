import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";

import { createSaveRecommendationSessionHandler } from "./recommendation-session-route.ts";

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

test("recommendation session handler rejects missing session ids", async () => {
  let saveCount = 0;
  const handler = createSaveRecommendationSessionHandler({
    store: {
      saveSession: async () => {
        saveCount += 1;
        return { id: "session-row-1" };
      },
    },
  });

  const mockResponse = createMockResponse();
  await handler(
    createMockRequest({
      body: {
        sessionId: "   ",
        answers: {},
        answerPath: [],
      },
    }),
    mockResponse.response,
  );

  assert.equal(saveCount, 0);
  assert.equal(mockResponse.readStatusCode(), 400);
  assert.deepEqual(mockResponse.readJsonPayload(), {
    error: "Recommendation session id is required",
  });
});

test("recommendation session handler stores normalized completed sessions", async () => {
  let captured: unknown;
  const handler = createSaveRecommendationSessionHandler({
    store: {
      saveSession: async (payload) => {
        captured = payload;
        return { id: "session-row-1" };
      },
    },
  });

  const mockResponse = createMockResponse();
  await handler(
    createMockRequest({
      body: {
        sessionId: " session-1 ",
        answers: {
          gender: "male",
          tags: ["男性向"],
          nestedPrivateNote: { body: "不要明文保存" },
        },
        answerPath: [
          {
            questionId: "q0",
            tag: "男性向",
            nestedPrivateNote: { body: "不要明文保存" },
          },
        ],
        topProducts: [
          {
            id: "p1",
            score: 97,
            rawDescription: "详细描述不要明文保存",
          },
        ],
        resultProvider: "kimi",
        resultModelName: "kimi-k2.6",
        pageRoute: " /results ",
      },
    }),
    mockResponse.response,
  );

  assert.equal(mockResponse.readStatusCode(), 201);
  assert.deepEqual(mockResponse.readJsonPayload(), { id: "session-row-1" });
  assert.deepEqual(captured, {
    sessionId: "session-1",
    answers: { gender: "male", tags: ["男性向"] },
    answerPath: [{ questionId: "q0", tag: "男性向" }],
    topProducts: [{ id: "p1", score: 97 }],
    flowVersion: "quiz-flow-v1",
    algorithmVersion: "recommendation-v1",
    resultProvider: "kimi",
    resultModelName: "kimi-k2.6",
    pageRoute: "/results",
    privatePayload: {
      answers: {
        gender: "male",
        tags: ["男性向"],
        nestedPrivateNote: { body: "不要明文保存" },
      },
      answerPath: [
        {
          questionId: "q0",
          tag: "男性向",
          nestedPrivateNote: { body: "不要明文保存" },
        },
      ],
      topProducts: [
        {
          id: "p1",
          score: 97,
          rawDescription: "详细描述不要明文保存",
        },
      ],
    },
  });
});

test("recommendation session handler rejects oversized answer payloads", async () => {
  let saveCount = 0;
  const handler = createSaveRecommendationSessionHandler({
    store: {
      saveSession: async () => {
        saveCount += 1;
        return { id: "session-row-1" };
      },
    },
  });

  const mockResponse = createMockResponse();
  await handler(
    createMockRequest({
      body: {
        sessionId: "session-1",
        answers: { freeText: "x".repeat(31_000) },
      },
    }),
    mockResponse.response,
  );

  assert.equal(saveCount, 0);
  assert.equal(mockResponse.readStatusCode(), 413);
  assert.deepEqual(mockResponse.readJsonPayload(), {
    error: "Recommendation answers are too large",
  });
});

test("recommendation session handler caps stored path and product arrays", async () => {
  let captured: unknown;
  const handler = createSaveRecommendationSessionHandler({
    store: {
      saveSession: async (payload) => {
        captured = payload;
        return { id: "session-row-1" };
      },
    },
  });

  const mockResponse = createMockResponse();
  await handler(
    createMockRequest({
      body: {
        sessionId: "session-1",
        answers: {},
        answerPath: Array.from({ length: 50 }, (_, index) => ({
          questionId: `q${index}`,
        })),
        topProducts: Array.from({ length: 50 }, (_, index) => ({
          id: `p${index}`,
        })),
      },
    }),
    mockResponse.response,
  );

  assert.equal(mockResponse.readStatusCode(), 201);
  assert.equal((captured as { answerPath: unknown[] }).answerPath.length, 30);
  assert.equal((captured as { topProducts: unknown[] }).topProducts.length, 20);
});
