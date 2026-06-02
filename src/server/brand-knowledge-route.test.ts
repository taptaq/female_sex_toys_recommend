import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";

import {
  createGetBrandKnowledgeHandler,
  createListBrandKnowledgeHandler,
} from "./brand-knowledge-route.ts";

function createMockRequest(params: Record<string, string | undefined>) {
  return { params } as Request;
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

test("brand knowledge handler prefers database competitor content when available", async () => {
  const handler = createGetBrandKnowledgeHandler({
    pool: {
      query: async () => ({
        rows: [
          {
            name: "LELO",
            domain: "lelo.com",
            country: "瑞典",
            founded_date: "2003",
            description: "LELO 是偏高完成度与整体质感的经典品牌。",
            focus: "Unisex",
            philosophy: ["风格更克制、稳定，也更强调长期复用体验。"],
            major_user_group_profile: "【心理特征】重视完成度与审美一致性。",
            is_domestic: false,
          },
        ],
      }),
    },
  });

  const mockResponse = createMockResponse();
  await handler(createMockRequest({ brandSlug: "lelo" }), mockResponse.response);

  assert.equal(mockResponse.readStatusCode(), 200);
  assert.deepEqual(mockResponse.readJsonPayload(), {
    brandName: "LELO",
    brandSlug: "lelo",
    country: "瑞典",
    description: "LELO 是偏高完成度与整体质感的经典品牌。",
    focus: "Unisex",
    philosophy: ["风格更克制、稳定，也更强调长期复用体验。"],
    majorUserGroupProfile: "【心理特征】重视完成度与审美一致性。",
    domain: "lelo.com",
    foundedDate: "2003",
    isDomestic: false,
  });
});

test("brand knowledge handler falls back to local registry data when database misses", async () => {
  const handler = createGetBrandKnowledgeHandler({
    pool: {
      query: async () => ({ rows: [] }),
    },
  });

  const mockResponse = createMockResponse();
  await handler(createMockRequest({ brandSlug: "lelo" }), mockResponse.response);

  assert.equal(mockResponse.readStatusCode(), 200);
  assert.match(JSON.stringify(mockResponse.readJsonPayload()), /"brandSlug":"lelo"/);
  assert.match(JSON.stringify(mockResponse.readJsonPayload()), /"brandName":"LELO"/);
});

test("brand knowledge list handler returns database brands and backfills missing defaults", async () => {
  const handler = createListBrandKnowledgeHandler({
    pool: {
      query: async () => ({
        rows: [
          {
            name: "POPOCAT",
            domain: "popocat.tmall.com",
            country: "中国",
            founded_date: null,
            description: "POPOCAT 描述",
            focus: "Female",
            philosophy: ["POPOCAT 风格"],
            major_user_group_profile: null,
            is_domestic: true,
          },
          {
            name: "We-Vibe",
            domain: "we-vibe.com",
            country: "加拿大",
            founded_date: null,
            description: "We-Vibe 描述",
            focus: "Unisex",
            philosophy: ["We-Vibe 风格"],
            major_user_group_profile: null,
            is_domestic: false,
          },
        ],
      }),
    },
  });

  const mockResponse = createMockResponse();
  await handler({} as Request, mockResponse.response);

  const payload = mockResponse.readJsonPayload() as { brands: Array<{ brandSlug: string }> };
  assert.equal(mockResponse.readStatusCode(), 200);
  assert.ok(payload.brands.some((item) => item.brandSlug === "popocat"));
  assert.ok(payload.brands.some((item) => item.brandSlug === "we-vibe"));
  assert.ok(payload.brands.some((item) => item.brandSlug === "lelo"));
});
