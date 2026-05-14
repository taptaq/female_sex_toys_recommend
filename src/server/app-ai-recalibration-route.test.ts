import test from "node:test";
import assert from "node:assert/strict";
import {
  createRecalibrateResultsHandler,
} from "./app-ai-recalibration-route.ts";
import type { Request, Response } from "express";

function createMockRequest(body: unknown) {
  return { body } as Request;
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

test("createRecalibrateResultsHandler routes the request through automatic model routing", async () => {
  let capturedRequest: unknown;
  const handler = createRecalibrateResultsHandler({
    appAiService: {
      runResultRecalibration: async (request) => {
        capturedRequest = request;
        return {
          topProducts: [],
          backupProducts: [],
          shoppingGuidance: [],
          recommendationTips: [],
          modelName: "qwen-max",
          provider: "qwen",
        };
      },
    },
  });

  const mockResponse = createMockResponse();
  await handler(
    createMockRequest({
      answers: { tags: ["静音"] },
      rerankPool: [{ id: "p-1" }],
      rankedCandidates: [{ id: "p-1" }, { id: "b-1" }],
      filteredCount: 6,
      recommendationTips: ["tip-1"],
      recalibrationContext: {
        attemptCount: 2,
        rerollReason: "did_not_understand",
        currentResultProvider: "dmxapi-mimo",
        currentResultModelName: "mimo-v2.5-pro",
        previousTopProducts: [{ id: "p-1", reason: "更安静，也更适合日常使用" }],
        previousShoppingGuidanceCount: 2,
      },
    }),
    mockResponse.response,
  );

  assert.equal(mockResponse.readStatusCode(), 200);
  assert.deepEqual(capturedRequest, {
    answers: { tags: ["静音"] },
    strategy: "auto",
    rerankPool: [{ id: "p-1" }],
    rankedCandidates: [{ id: "p-1" }, { id: "b-1" }],
    filteredCount: 6,
    recommendationTips: ["tip-1"],
    recalibrationContext: {
      attemptCount: 2,
      rerollReason: "did_not_understand",
      currentResultProvider: "dmxapi-mimo",
      currentResultModelName: "mimo-v2.5-pro",
      previousTopProducts: [{ id: "p-1", reason: "更安静，也更适合日常使用" }],
      previousShoppingGuidanceCount: 2,
    },
  });
  assert.deepEqual(mockResponse.readJsonPayload(), {
    topProducts: [],
    backupProducts: [],
    shoppingGuidance: [],
    recommendationTips: [],
    modelName: "qwen-max",
    provider: "qwen",
  });
});

test("createRecalibrateResultsHandler rejects an invalid recalibration strategy before calling the service", async () => {
  let callCount = 0;
  const handler = createRecalibrateResultsHandler({
    appAiService: {
      runResultRecalibration: async () => {
        callCount += 1;
        throw new Error("should not run");
      },
    },
  });

  const mockResponse = createMockResponse();
  await handler(
    createMockRequest({
      answers: { tags: ["静音"] },
      strategy: "manual",
      rerankPool: [{ id: "p-1" }],
      rankedCandidates: [{ id: "p-1" }, { id: "b-1" }],
      filteredCount: 6,
      recommendationTips: ["tip-1"],
    }),
    mockResponse.response,
  );

  assert.equal(callCount, 0);
  assert.equal(mockResponse.readStatusCode(), 400);
  assert.deepEqual(mockResponse.readJsonPayload(), {
    error: "Only auto recalibration strategy is supported",
  });
});
