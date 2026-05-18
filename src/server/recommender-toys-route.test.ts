import assert from "node:assert/strict";
import test from "node:test";

import { createListRecommenderToysHandler } from "./recommender-toys-route.ts";

function createMockResponse() {
  let statusCode = 200;
  let jsonPayload: unknown;
  const headers = new Map<string, string>();

  const response = {
    status(code: number) {
      statusCode = code;
      return response;
    },
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
      return response;
    },
    json(payload: unknown) {
      jsonPayload = payload;
      return response;
    },
    end() {
      return response;
    },
  };

  return {
    response,
    readStatusCode() {
      return statusCode;
    },
    readJsonPayload() {
      return jsonPayload;
    },
    readHeader(name: string) {
      return headers.get(name.toLowerCase());
    },
  };
}

test("createListRecommenderToysHandler caches the normalized library payload and sets CDN-friendly headers", async () => {
  let queryCount = 0;
  let now = 1000;

  const handler = createListRecommenderToysHandler({
    ensureLibraryRouteReady: async () => {},
    now: () => now,
    cacheTtlMs: 60_000,
    pool: {
      query: async () => {
        queryCount += 1;
        return {
          rows: [
            {
              id: "toy-1",
              original_id: "product-1",
              name: "测试装备",
              safe_display_name: "测试装备",
              price: "199.00",
              max_db: 42,
              waterproof: 7,
              appearance: "normal",
              physical_form: "external",
              motor_type: "gentle",
              gender: "female",
              type_code: "suction",
              subtype_code: "suction_pure",
              brand: "Brand",
              material: "硅胶",
              image_url: "https://cdn.example.com/a.jpg",
              resolved_raw_description: "气脉冲测试",
              link: "https://example.com/product",
              tags: ["静音"],
              persona_analysis: "适合新手",
              is_domestic: true,
            },
          ],
        };
      },
    },
  });

  const first = createMockResponse();
  await handler({} as never, first.response as never, (() => {}) as never);

  assert.equal(queryCount, 1);
  assert.equal(first.readStatusCode(), 200);
  assert.equal(
    first.readHeader("cache-control"),
    "public, max-age=0, s-maxage=300, stale-while-revalidate=1800",
  );
  assert.deepEqual(first.readJsonPayload(), [
    {
      id: "toy-1",
      originalId: "product-1",
      name: "测试装备",
      canonicalName: "测试装备",
      displayName: "测试装备",
      safeDisplayName: "测试装备",
      price: 199,
      maxDb: 42,
      waterproof: 7,
      appearance: "normal",
      physicalForm: "external",
      motorType: "gentle",
      gender: "female",
      typeCode: "suction",
      subtypeCode: "suction_pure",
      brand: "Brand",
      material: "硅胶",
      rawDescription: "气脉冲测试",
      imagePlaceholder: "https://cdn.example.com/a.jpg",
      link: "https://example.com/product",
      sourceUrl: "https://example.com/product",
      tags: ["静音"],
      personaAnalysis: "适合新手",
      isDomestic: true,
    },
  ]);

  now += 10_000;
  const second = createMockResponse();
  await handler({} as never, second.response as never, (() => {}) as never);

  assert.equal(queryCount, 1);
  assert.deepEqual(second.readJsonPayload(), first.readJsonPayload());
});

test("createListRecommenderToysHandler returns 304 when the cached payload etag matches", async () => {
  const handler = createListRecommenderToysHandler({
    ensureLibraryRouteReady: async () => {},
    now: () => 1000,
    cacheTtlMs: 60_000,
    pool: {
      query: async () => ({
        rows: [
          {
            id: "toy-1",
            original_id: "product-1",
            name: "测试装备",
            safe_display_name: "测试装备",
            price: "199.00",
            max_db: 42,
            waterproof: 7,
            appearance: "normal",
            physical_form: "external",
            motor_type: "gentle",
            gender: "female",
            type_code: "suction",
            subtype_code: "suction_pure",
            brand: "Brand",
            material: "硅胶",
            image_url: "https://cdn.example.com/a.jpg",
            resolved_raw_description: "气脉冲测试",
            link: "https://example.com/product",
            tags: ["静音"],
            persona_analysis: "适合新手",
            is_domestic: true,
          },
        ],
      }),
    },
  });

  const first = createMockResponse();
  await handler({ query: {}, headers: {} } as never, first.response as never, (() => {}) as never);
  const etag = first.readHeader("etag");

  assert.ok(etag, "first response should include an etag");

  const second = createMockResponse();
  await handler(
    { query: {}, headers: { "if-none-match": etag } } as never,
    second.response as never,
    (() => {}) as never,
  );

  assert.equal(second.readStatusCode(), 304);
  assert.equal(second.readJsonPayload(), undefined);
});

test("createListRecommenderToysHandler retries once on transient database disconnects", async () => {
  let queryCount = 0;

  const handler = createListRecommenderToysHandler({
    ensureLibraryRouteReady: async () => {},
    now: () => 1000,
    cacheTtlMs: 60_000,
    pool: {
      query: async () => {
        queryCount += 1;
        if (queryCount === 1) {
          throw new Error("Connection terminated unexpectedly");
        }
        return {
          rows: [
          {
            id: "toy-1",
            original_id: "product-1",
            name: "测试装备",
              safe_display_name: "测试装备",
              price: "199.00",
              max_db: 42,
              waterproof: 7,
              appearance: "normal",
              physical_form: "external",
              motor_type: "gentle",
              gender: "female",
              type_code: "suction",
              subtype_code: "suction_pure",
              brand: "Brand",
              material: "硅胶",
              image_url: "https://cdn.example.com/a.jpg",
              resolved_raw_description: "气脉冲测试",
              link: "https://example.com/product",
              tags: ["静音"],
              persona_analysis: "适合新手",
              is_domestic: true,
            },
          ],
        };
      },
    },
  });

  const response = createMockResponse();
  await handler({ query: {}, headers: {} } as never, response.response as never, (() => {}) as never);

  assert.equal(queryCount, 2);
  assert.equal(response.readStatusCode(), 200);
  assert.deepEqual(response.readJsonPayload(), [
    {
      id: "toy-1",
      originalId: "product-1",
      name: "测试装备",
      canonicalName: "测试装备",
      displayName: "测试装备",
      safeDisplayName: "测试装备",
      price: 199,
      maxDb: 42,
      waterproof: 7,
      appearance: "normal",
      physicalForm: "external",
      motorType: "gentle",
      gender: "female",
      typeCode: "suction",
      subtypeCode: "suction_pure",
      brand: "Brand",
      material: "硅胶",
      rawDescription: "气脉冲测试",
      imagePlaceholder: "https://cdn.example.com/a.jpg",
      link: "https://example.com/product",
      sourceUrl: "https://example.com/product",
      tags: ["静音"],
      personaAnalysis: "适合新手",
      isDomestic: true,
    },
  ]);
});
