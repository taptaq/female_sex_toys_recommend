import assert from "node:assert/strict";
import test from "node:test";

import type { RankedProduct } from "./app-shell.ts";
import {
  buildRecommendationProfilePayload,
  listRecommendationProfiles,
  saveRecommendationProfile,
} from "./user-recommendation-profile.ts";

function makeProduct(overrides: Partial<RankedProduct>): RankedProduct {
  return {
    id: "item-1",
    name: "Nebula Match",
    price: 269,
    score: 96,
    maxDb: 42,
    waterproof: 7,
    appearance: "high_disguise",
    physicalForm: "external",
    motorType: "gentle",
    gender: "female",
    brand: "Brand",
    material: "Silicone",
    imagePlaceholder: "",
    tags: ["静音"],
    ...overrides,
  };
}

test("buildRecommendationProfilePayload keeps enough recommendation context for encrypted cloud save", () => {
  const payload = buildRecommendationProfilePayload({
    answers: {
      tags: ["静音"],
      maxDb: 50,
    },
    topProducts: [
      makeProduct({ id: "item-1", name: "Top Pick" }),
      makeProduct({ id: "item-2", name: "Second Pick", score: 88 }),
    ],
    backupProducts: [],
    recommendationTips: ["可以放宽预算"],
    shoppingGuidance: ["优先看售后"],
  });

  assert.deepEqual(payload.answers, { tags: ["静音"], maxDb: 50 });
  assert.equal(payload.title, "Top Pick 等 2 个推荐");
  assert.match(payload.summary, /静音/);
  assert.deepEqual(payload.topProductIds, ["item-1", "item-2"]);
  assert.deepEqual(payload.topProducts, [
    { id: "item-1", name: "Top Pick", displayName: "Top Pick", score: 96 },
    { id: "item-2", name: "Second Pick", displayName: "Second Pick", score: 88 },
  ]);
  assert.deepEqual(payload.recommendationTips, ["可以放宽预算"]);
  assert.deepEqual(payload.shoppingGuidance, ["优先看售后"]);
  assert.match(payload.createdAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("buildRecommendationProfilePayload persists displayName when raw name should stay internal", () => {
  const payload = buildRecommendationProfilePayload({
    answers: { tags: ["静音"] },
    topProducts: [
      makeProduct({
        id: "item-1",
        name: "原始产品名",
        safeDisplayName: "个人护理用品 A",
      }),
    ],
    backupProducts: [],
    recommendationTips: [],
    shoppingGuidance: [],
  });

  assert.equal(payload.topProducts[0]?.name, "个人护理用品 A");
  assert.equal(payload.topProducts[0]?.displayName, "个人护理用品 A");
});

test("buildRecommendationProfilePayload dedupes saved preference tags", () => {
  const payload = buildRecommendationProfilePayload({
    answers: {
      tags: ["静音", " 入门级 ", "静音", "", "入门级", "防水"],
      maxDb: 50,
    },
    topProducts: [makeProduct({ id: "item-1", name: "Top Pick" })],
    backupProducts: [],
    recommendationTips: [],
    shoppingGuidance: [],
  });

  assert.deepEqual(payload.answers.tags, ["静音", "入门级", "防水"]);
  assert.equal(payload.summary, "偏好：静音、入门级、防水；推荐：Top Pick");
});

test("buildRecommendationProfilePayload no longer saves later-comparison candidates", () => {
  const payload = buildRecommendationProfilePayload({
    answers: {
      tags: ["静音"],
    },
    topProducts: [
      makeProduct({ id: "item-1", name: "Top Pick" }),
      makeProduct({ id: "item-2", name: "Second Pick", score: 88 }),
    ],
    backupProducts: [
      {
        ...makeProduct({ id: "item-3", name: "Budget Backup", score: 82 }),
        backupLabel: "更省预算",
        backupReason: "预算压力更小",
      },
    ],
    recommendationTips: [],
    shoppingGuidance: [],
  });

  assert.equal("savedCandidateIds" in payload, false);
  assert.equal("savedCandidates" in payload, false);
});

test("saveRecommendationProfile posts the payload with bearer authorization", async () => {
  let captured: unknown;

  const result = await saveRecommendationProfile({
    authToken: "signed-token",
    payload: {
      createdAt: "2026-05-01T00:00:00.000Z",
      title: "推荐档案",
      summary: "偏好：静音",
      topProductIds: ["item-1"],
      answers: { tags: ["静音"] },
      topProducts: [],
      backupProducts: [],
      recommendationTips: [],
      shoppingGuidance: [],
    },
    fetcher: async (url, init) => {
      captured = { url, init };
      return {
        ok: true,
        json: async () => ({ id: "profile-1" }),
      } as Response;
    },
  });

  assert.deepEqual(result, { id: "profile-1" });
  assert.match(JSON.stringify(captured), /\/api\/user\/recommendation-profiles/);
  assert.match(JSON.stringify(captured), /Bearer signed-token/);
  assert.match(JSON.stringify(captured), /静音/);
});

test("saveRecommendationProfile refuses to call the API without a token", async () => {
  let fetchCount = 0;

  await assert.rejects(
    () =>
      saveRecommendationProfile({
        authToken: "",
        payload: {
          createdAt: "2026-05-01T00:00:00.000Z",
          title: "推荐档案",
          summary: "",
          topProductIds: [],
          answers: { tags: [] },
          topProducts: [],
          backupProducts: [],
          recommendationTips: [],
          shoppingGuidance: [],
        },
        fetcher: async () => {
          fetchCount += 1;
          return { ok: true, json: async () => ({}) } as Response;
        },
      }),
    /需要登录后才能保存推荐档案/,
  );

  assert.equal(fetchCount, 0);
});

test("saveRecommendationProfile surfaces server error details", async () => {
  await assert.rejects(
    () =>
      saveRecommendationProfile({
        authToken: "signed-token",
        payload: {
          createdAt: "2026-05-01T00:00:00.000Z",
          title: "推荐档案",
          summary: "",
          topProductIds: [],
          answers: { tags: [] },
          topProducts: [],
          backupProducts: [],
          recommendationTips: [],
          shoppingGuidance: [],
        },
        fetcher: async () =>
          ({
            ok: false,
            json: async () => ({
              error: "Recommendation profile save failed",
              details: "insert or update on table violates foreign key constraint",
            }),
          }) as Response,
      }),
    /foreign key constraint/,
  );
});

test("listRecommendationProfiles fetches saved equipment matching profiles", async () => {
  let captured: unknown;

  const result = await listRecommendationProfiles({
    authToken: "signed-token",
    fetcher: async (url, init) => {
      captured = { url, init };
      return {
        ok: true,
        json: async () => ({
          profiles: [
            {
              id: "profile-1",
              title: "我的装备匹配档案",
              summary: "偏好：静音",
              topProductIds: ["item-1"],
              savedAt: "2026-05-02T12:00:00.000Z",
              payload: {
                createdAt: "2026-05-02T12:00:00.000Z",
                title: "我的装备匹配档案",
                summary: "偏好：静音",
                topProductIds: ["item-1"],
                answers: { tags: ["静音"] },
                topProducts: [{ id: "item-1", name: "Nebula Pick", score: 96 }],
                backupProducts: [],
                recommendationTips: [],
                shoppingGuidance: [],
              },
            },
          ],
        }),
      } as Response;
    },
  });

  assert.match(JSON.stringify(captured), /\/api\/user\/recommendation-profiles/);
  assert.match(JSON.stringify(captured), /GET/);
  assert.match(JSON.stringify(captured), /Bearer signed-token/);
  assert.equal(result.profiles[0]?.title, "我的装备匹配档案");
});
