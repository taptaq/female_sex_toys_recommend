import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";

import {
  createKnowledgeNebulaCreateCardHandler,
  createKnowledgeNebulaTopicHandler,
  createKnowledgeNebulaUpdateCardHandler,
} from "./knowledge-nebula-route.ts";

function createMockRequest({
  params = {},
  body,
}: {
  params?: Record<string, string | undefined>;
  body?: unknown;
}) {
  return { params, body } as Request;
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

test("knowledge topic handler returns the resolved topic payload", async () => {
  const expectedTopic = { slug: "science", sections: [] };
  const handler = createKnowledgeNebulaTopicHandler({
    store: {
      getTopicBySlug: async (slug) =>
        slug === "science" ? (expectedTopic as any) : null,
    },
  });

  const mockResponse = createMockResponse();
  await handler(
    createMockRequest({ params: { slug: "science" } }),
    mockResponse.response,
  );

  assert.equal(mockResponse.readStatusCode(), 200);
  assert.deepEqual(mockResponse.readJsonPayload(), expectedTopic);
});

test("knowledge create-card handler parses body text and returns the updated topic", async () => {
  let capturedInput: unknown;
  const handler = createKnowledgeNebulaCreateCardHandler({
    store: {
      createCard: async (topicSlug, input) => {
        capturedInput = { topicSlug, input };
        return { slug: topicSlug, sections: [] } as any;
      },
    },
  });

  const mockResponse = createMockResponse();
  await handler(
    createMockRequest({
      params: { slug: "science" },
      body: {
        title: "自定义卡片",
        summary: "一句摘要",
        bodyText: "第一段\n\n第二段",
        isFeatured: true,
        sourceUrl: "https://example.com/source",
        tags: "科普, 入门, 震动",
      },
    }),
    mockResponse.response,
  );

  assert.equal(mockResponse.readStatusCode(), 201);
  assert.deepEqual(capturedInput, {
    topicSlug: "science",
    input: {
      title: "自定义卡片",
      summary: "一句摘要",
      body: ["第一段", "第二段"],
      isFeatured: true,
      sourceUrl: "https://example.com/source",
      tags: ["科普", "入门", "震动"],
    },
  });
});

test("knowledge update-card handler rejects an empty title before touching the store", async () => {
  let callCount = 0;
  const handler = createKnowledgeNebulaUpdateCardHandler({
    store: {
      updateCard: async () => {
        callCount += 1;
        return null as any;
      },
    },
  });

  const mockResponse = createMockResponse();
  await handler(
    createMockRequest({
      params: { cardId: "science-routes" },
      body: {
        title: "   ",
        summary: "一句摘要",
        bodyText: "正文",
      },
    }),
    mockResponse.response,
  );

  assert.equal(callCount, 0);
  assert.equal(mockResponse.readStatusCode(), 400);
  assert.deepEqual(mockResponse.readJsonPayload(), {
    error: "title, summary, and bodyText are required",
  });
});
