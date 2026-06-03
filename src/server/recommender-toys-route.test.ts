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
  let capturedSql = "";
  let now = 1000;

  const handler = createListRecommenderToysHandler({
    ensureLibraryRouteReady: async () => {},
    now: () => now,
    cacheTtlMs: 60_000,
    pool: {
      query: async (sql: string) => {
        queryCount += 1;
        capturedSql = sql;
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
              product_link: "https://example.com/product",
              tags: ["静音"],
              persona_analysis: "适合新手",
              is_domestic: true,
              competitor_domain: "brand.example.com",
              competitor_country: "德国",
              competitor_description: "Brand 是偏设计感与材质完成度的一线品牌。",
              competitor_focus: "Female",
              competitor_philosophy: [
                "整体风格更现代、克制，也更强调稳定体验。",
              ],
              competitor_major_user_group_profile: null,
            },
          ],
        };
      },
    },
  });

  const first = createMockResponse();
  await handler({} as never, first.response as never, (() => {}) as never);

  assert.equal(queryCount, 1);
  assert.match(capturedSql, /public\.female_recommender_toys/i);
  assert.match(capturedSql, /COALESCE\(NULLIF\(t\.link, ''\), p\.link\) AS product_link/i);
  assert.doesNotMatch(capturedSql, /FROM public\.recommender_toys/i);
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
      brandBrief: {
        brandName: "Brand",
        brandSlug: "brand",
        countryLabel: "德国",
        positioning: "Brand 是偏设计感与材质完成度的一线品牌。",
        styleSummary: "整体风格更现代、克制，也更强调稳定体验。",
        officialWebsiteUrl: "https://brand.example.com/",
      },
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
            product_link: "https://example.com/product",
            tags: ["静音"],
            persona_analysis: "适合新手",
            is_domestic: true,
            competitor_domain: "brand.example.com",
            competitor_country: "德国",
            competitor_description: "Brand 是偏设计感与材质完成度的一线品牌。",
            competitor_focus: "Female",
            competitor_philosophy: [
              "整体风格更现代、克制，也更强调稳定体验。",
            ],
            competitor_major_user_group_profile: null,
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

test("createListRecommenderToysHandler falls back to brand-name competitor domain when product competitor link is missing", async () => {
  let capturedSql = "";
  const handler = createListRecommenderToysHandler({
    ensureLibraryRouteReady: async () => {},
    now: () => 1000,
    cacheTtlMs: 60_000,
    pool: {
      query: async (sql: string) => {
        capturedSql = sql;
        return {
          rows: [
            {
              id: "toy-1",
              original_id: "product-1",
              name: "TENGA 测试装备",
              safe_display_name: "TENGA 测试装备",
              price: "199.00",
              max_db: 42,
              waterproof: 7,
              appearance: "normal",
              physical_form: "external",
              motor_type: "gentle",
              gender: "female",
              type_code: "external_vibe",
              subtype_code: "bullet_vibe",
              brand: "TENGA",
              material: "硅胶",
              image_url: "https://cdn.example.com/a.jpg",
              resolved_raw_description: "震动测试",
              product_link: "https://detail.tmall.com/item.htm?id=123",
              tags: ["静音"],
              persona_analysis: null,
              is_domestic: false,
              competitor_domain: "https://www.tenga.co.jp",
              competitor_country: "日本",
              competitor_description: "TENGA 是日本成人健康品牌。",
              competitor_focus: "Unisex",
              competitor_philosophy: ["以清晰产品线和身体友好体验为核心。"],
              competitor_major_user_group_profile: null,
            },
          ],
        };
      },
    },
  });

  const response = createMockResponse();
  await handler({ query: {}, headers: {} } as never, response.response as never, (() => {}) as never);

  assert.match(capturedSql, /LEFT JOIN public\.competitors c_brand/i);
  assert.deepEqual((response.readJsonPayload() as any[])[0].brandBrief.officialWebsiteUrl, "https://www.tenga.co.jp/");
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
              product_link: "https://example.com/product",
              tags: ["静音"],
              persona_analysis: "适合新手",
              is_domestic: true,
              competitor_domain: "brand.example.com",
              competitor_country: "德国",
              competitor_description: "Brand 是偏设计感与材质完成度的一线品牌。",
              competitor_focus: "Female",
              competitor_philosophy: [
                "整体风格更现代、克制，也更强调稳定体验。",
              ],
              competitor_major_user_group_profile: null,
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
      brandBrief: {
        brandName: "Brand",
        brandSlug: "brand",
        countryLabel: "德国",
        positioning: "Brand 是偏设计感与材质完成度的一线品牌。",
        styleSummary: "整体风格更现代、克制，也更强调稳定体验。",
        officialWebsiteUrl: "https://brand.example.com/",
      },
    },
  ]);
});
