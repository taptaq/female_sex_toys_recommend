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

test("createRecalibrateResultsHandler routes the request to single-provider recalibration with the parsed provider", async () => {
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
      targetProvider: "qwen",
      rerankPool: [{ id: "p-1" }],
      rankedCandidates: [{ id: "p-1" }, { id: "b-1" }],
      filteredCount: 6,
      recommendationTips: ["tip-1"],
    }),
    mockResponse.response,
  );

  assert.equal(mockResponse.readStatusCode(), 200);
  assert.deepEqual(capturedRequest, {
    answers: { tags: ["静音"] },
    targetProvider: "qwen",
    rerankPool: [{ id: "p-1" }],
    rankedCandidates: [{ id: "p-1" }, { id: "b-1" }],
    filteredCount: 6,
    recommendationTips: ["tip-1"],
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

test("createRecalibrateResultsHandler rejects an invalid provider before calling the service", async () => {
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
      targetProvider: "missing-provider",
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
    error: "A valid targetProvider is required",
  });
});
