import assert from "node:assert/strict";
import test from "node:test";

import type { AnswerState, Product } from "../data/mock.ts";
import { buildLocalRecommendationRanking } from "./recommendation-local-ranking.ts";

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: overrides.id ?? "p1",
    name: overrides.name ?? "Test Product",
    price: overrides.price ?? 199,
    maxDb: overrides.maxDb ?? 45,
    waterproof: overrides.waterproof ?? 7,
    appearance: overrides.appearance ?? "normal",
    physicalForm: overrides.physicalForm ?? "external",
    motorType: overrides.motorType ?? "gentle",
    gender: overrides.gender ?? "female",
    typeCode: overrides.typeCode ?? "suction",
    subtypeCode: overrides.subtypeCode ?? "clitoral_suction",
    brand: overrides.brand ?? "Brand",
    material: overrides.material ?? "Silicone",
    imagePlaceholder: overrides.imagePlaceholder ?? "",
    displayName: overrides.displayName,
    safeDisplayName: overrides.safeDisplayName,
    canonicalName: overrides.canonicalName,
    link: overrides.link,
    sourceUrl: overrides.sourceUrl,
    rawDescription: overrides.rawDescription ?? null,
    tags: overrides.tags ?? [],
    reason: overrides.reason,
    personaAnalysis: overrides.personaAnalysis,
    isDomestic: overrides.isDomestic,
  };
}

test("buildLocalRecommendationRanking keeps natural language evidence in the visible match summary", () => {
  const answers: AnswerState = {
    gender: "female",
    physicalForm: "external",
    motorType: "gentle",
    maxDb: 50,
    waterproof: 7,
    budget: [100, 300],
    appearance: "normal",
    tags: ["女性向"],
  };

  const ranking = buildLocalRecommendationRanking(
    answers,
    [
      makeProduct({
        id: "suction-strong",
        name: "Strong Suction",
        rawDescription: "空气脉冲吸感明显，强吸力更直接。多模式节奏变化。",
        tags: ["强吸", "模式多"],
      }),
      makeProduct({
        id: "gentle-vibe",
        name: "Gentle Vibe",
        typeCode: "external_vibe",
        subtypeCode: "wand_vibe",
        rawDescription: "外部震动，温和档位。",
      }),
    ],
    {
      context: {
        naturalLanguageQuery: "我是女生，想要吮吸感更强一点，波形更多一点。",
      },
    },
  );

  assert.equal(ranking.rankedCandidates[0].id, "suction-strong");
  assert.ok(
    ranking.rankedCandidates[0].matchSummary.some((line) =>
      line.includes("空气脉冲吸感明显"),
    ),
    `expected visible summary to include product evidence, got ${JSON.stringify(
      ranking.rankedCandidates[0].matchSummary,
    )}`,
  );
});

test("buildLocalRecommendationRanking respects selected pleasure focus", () => {
  const baseAnswers: AnswerState = {
    gender: "female",
    maxDb: 50,
    waterproof: 7,
    budget: [100, 300],
    appearance: "normal",
    tags: ["女性向"],
  };
  const clitoralProduct = makeProduct({
    id: "clitoral-suction",
    name: "Clitoral Suction",
    physicalForm: "external",
    typeCode: "suction",
    subtypeCode: "clitoral_suction",
    rawDescription: "阴蒂吸吮刺激，外部空气脉冲。",
  });
  const gspotProduct = makeProduct({
    id: "gspot-insertable",
    name: "G Spot Insertable",
    physicalForm: "internal",
    typeCode: "insertable",
    subtypeCode: "gspot_insertable",
    rawDescription: "G 点入体震动，适合阴道内探索。",
  });

  const clitoralRanking = buildLocalRecommendationRanking(
    { ...baseAnswers, pleasureFocus: "clitoral", tags: ["女性向", "阴蒂刺激"] },
    [gspotProduct, clitoralProduct],
  );
  const gspotRanking = buildLocalRecommendationRanking(
    { ...baseAnswers, pleasureFocus: "gspot", tags: ["女性向", "G点刺激"] },
    [clitoralProduct, gspotProduct],
  );

  assert.equal(clitoralRanking.rankedCandidates[0].id, "clitoral-suction");
  assert.equal(gspotRanking.rankedCandidates[0].id, "gspot-insertable");
});


test("buildLocalResultComputation filters male-only products before ranking in female MVP mode", async () => {
  const { buildLocalResultComputation } = await import("./app-result-flow.ts");
  const answers: AnswerState = {
    gender: "female",
    physicalForm: "external",
    motorType: "gentle",
    maxDb: 50,
    waterproof: 7,
    budget: [100, 300],
    appearance: "normal",
    tags: ["女性向"],
  };

  const result = buildLocalResultComputation(answers, [
    makeProduct({
      id: "female-good",
      name: "Female Good",
      rawDescription: "女性外部震动，温和安静。",
      tags: ["女性向"],
    }),
    makeProduct({
      id: "male-explicit",
      name: "Explicit Male Product",
      gender: "male",
      rawDescription: "男性飞机杯体验。",
      tags: ["男性向"],
    }),
    makeProduct({
      id: "male-coded-unisex",
      name: "Male Coded Unisex Product",
      gender: "unisex",
      rawDescription: "男性飞机杯体验，强调阴茎包裹感。",
      tags: ["男性向"],
    }),
  ]);

  assert.deepEqual(
    result.rankedCandidates.map((product) => product.id),
    ["female-good"],
  );
});

test("buildLocalResultComputation uses female MVP fallback products when the source is empty", async () => {
  const { buildLocalResultComputation } = await import("./app-result-flow.ts");
  const answers: AnswerState = {
    gender: "female",
    physicalForm: "external",
    motorType: "gentle",
    maxDb: 50,
    waterproof: 7,
    budget: [100, 300],
    appearance: "normal",
    tags: ["女性向", "外部震动/吮吸", "温柔慢热"],
  };

  const result = buildLocalResultComputation(answers, []);

  assert.ok(result.rankedCandidates.length > 0);
  assert.ok(result.fallbackTopProducts.length > 0);
  assert.ok(
    result.rankedCandidates.every((product) => product.gender === "female"),
    "fallback candidates should stay female-only",
  );
});

test("buildLocalResultComputation suggests relaxing waterproof instead of auto-filling loose matches", async () => {
  const { buildLocalResultComputation } = await import("./app-result-flow.ts");
  const answers: AnswerState = {
    gender: "female",
    physicalForm: "external",
    motorType: "gentle",
    maxDb: 45,
    waterproof: 7,
    budget: [100, 300],
    appearance: "high_disguise",
    tags: ["女性向", "外部震动/吮吸", "温柔慢热", "≥ IPX7 防水"],
  };

  const result = buildLocalResultComputation(answers, [
    makeProduct({
      id: "ipx6-good-otherwise",
      name: "IPX6 Good Otherwise",
      price: 199,
      maxDb: 42,
      waterproof: 6,
      appearance: "high_disguise",
      physicalForm: "external",
      gender: "female",
      rawDescription: "女性外部震动，温和安静，基础防水。",
      tags: ["女性向", "静音"],
    }),
  ]);

  assert.deepEqual(result.rankedCandidates, []);
  assert.deepEqual(result.fallbackTopProducts, []);
  assert.ok(
    result.recommendationTips.some((tip) => /IPX6|基础防水|防水/.test(tip)),
    `expected waterproof relaxation tip, got ${JSON.stringify(result.recommendationTips)}`,
  );
});
