import assert from "node:assert/strict";
import test from "node:test";

import type { AnswerState, Product } from "../data/mock.ts";
import {
  buildRecommendationCandidatePool,
  isRecommendationEligibleProduct,
} from "./recommendation-candidate-pool.ts";

function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: overrides.id ?? "p1",
    name: overrides.name ?? "Test Product",
    displayName: overrides.displayName,
    safeDisplayName: overrides.safeDisplayName,
    canonicalName: overrides.canonicalName,
    price: overrides.price ?? 199,
    maxDb: overrides.maxDb ?? 45,
    waterproof: overrides.waterproof ?? 7,
    appearance: overrides.appearance ?? "normal",
    physicalForm: overrides.physicalForm ?? "external",
    motorType: overrides.motorType ?? "gentle",
    gender: overrides.gender ?? "male",
    typeCode:
      overrides.typeCode === undefined ? "masturbator" : overrides.typeCode,
    subtypeCode:
      overrides.subtypeCode === undefined
        ? "manual_masturbator"
        : overrides.subtypeCode,
    brand: overrides.brand ?? "Brand",
    material: overrides.material ?? "Silicone",
    imagePlaceholder: overrides.imagePlaceholder ?? "",
    link: overrides.link,
    sourceUrl: overrides.sourceUrl,
    rawDescription: overrides.rawDescription ?? null,
    tags: overrides.tags ?? [],
    reason: overrides.reason,
    personaAnalysis: overrides.personaAnalysis,
    isDomestic: overrides.isDomestic,
  };
}

test("strict filters do not fall back to relaxed candidates when nothing fully matches", () => {
  const answers: AnswerState = {
    gender: "female",
    budget: [100, 150],
    maxDb: 40,
    appearance: "high_disguise",
    waterproof: 7,
    tags: [],
  };

  const pool = buildRecommendationCandidatePool(answers, [
    makeProduct({
      id: "budget-miss",
      name: "Budget Miss",
      gender: "female",
      typeCode: "suction",
      subtypeCode: "clitoral_suction",
      price: 299,
      physicalForm: "external",
      maxDb: 39,
      appearance: "high_disguise",
      waterproof: 7,
    }),
    makeProduct({
      id: "care-1",
      name: "Care 1",
      gender: "unisex",
      typeCode: "care_accessory",
      subtypeCode: "lube_care",
      price: 49,
      rawDescription: "水基润滑液，亲肤易清洗",
      tags: ["润滑液"],
    }),
  ]);

  assert.equal(pool.filteredProducts.length, 0);
  assert.deepEqual(
    pool.relaxedProducts.map((product) => product.id),
    ["budget-miss"],
  );
  assert.deepEqual(pool.rankedInputProducts, []);
});

test("recommendation eligibility excludes care accessory products even when their stored type is missing", () => {
  const careLikeProduct = makeProduct({
    id: "care-unknown",
    name: "玻尿酸润滑液",
    typeCode: null,
    subtypeCode: null,
    gender: "unisex",
    rawDescription: "人体润滑液，水基配方，亲肤易清洗",
    tags: ["润滑液", "水基"],
  });

  const toyLikeProduct = makeProduct({
    id: "toy-unknown",
    name: "男士互动杯",
    typeCode: null,
    subtypeCode: null,
    gender: "male",
    physicalForm: "internal",
    rawDescription: "自动伸缩互动杯，包裹感明显",
    tags: ["互动", "男用"],
  });

  assert.equal(isRecommendationEligibleProduct(careLikeProduct), false);
  assert.equal(isRecommendationEligibleProduct(toyLikeProduct), true);
});

test("couple partner composition keeps compatible gendered toys in the candidate pool", () => {
  const products = [
    makeProduct({
      id: "male-prostate",
      gender: "male",
      typeCode: "prostate",
      subtypeCode: "prostate_massager",
    }),
    makeProduct({
      id: "female-dual",
      gender: "female",
      typeCode: "dual_stimulation",
      subtypeCode: "dual_wearable_remote",
    }),
    makeProduct({
      id: "unisex-ring",
      gender: "unisex",
      typeCode: "cock_ring",
      subtypeCode: "vibrating_cock_ring",
    }),
  ];

  const maleMalePool = buildRecommendationCandidatePool(
    { gender: "unisex", partnerComposition: "male_male", tags: [] },
    products,
  );
  const femaleFemalePool = buildRecommendationCandidatePool(
    { gender: "unisex", partnerComposition: "female_female", tags: [] },
    products,
  );

  assert.deepEqual(
    maleMalePool.relaxedProducts.map((product) => product.id),
    ["male-prostate", "unisex-ring"],
  );
  assert.deepEqual(
    femaleFemalePool.relaxedProducts.map((product) => product.id),
    ["female-dual", "unisex-ring"],
  );
});

test("natural language suction requests keep only external candidates unless insertable is explicitly requested", () => {
  const pool = buildRecommendationCandidatePool(
    { gender: "female", tags: [] },
    [
      makeProduct({
        id: "external-suction",
        gender: "female",
        typeCode: "suction",
        subtypeCode: "clitoral_suction",
        physicalForm: "external",
      }),
      makeProduct({
        id: "internal-gspot",
        gender: "female",
        typeCode: "insertable",
        subtypeCode: "gspot_insertable",
        physicalForm: "internal",
      }),
      makeProduct({
        id: "composite-dual",
        gender: "female",
        typeCode: "dual_stimulation",
        subtypeCode: "dual_wearable_remote",
        physicalForm: "composite",
        rawDescription: "双刺激震动器，主打内外震动，不带吮吸头。",
      }),
      makeProduct({
        id: "external-vibe",
        gender: "female",
        typeCode: "external_vibe",
        subtypeCode: "bullet_vibe",
        physicalForm: "external",
        rawDescription: "外部震动器，震感明显，但不是吮吸类产品。",
      }),
    ],
    {
      naturalLanguageQuery: "我是女生，想找一个吮吸感更强一点的，波形更多的，噪音适中的。",
    },
  );

  assert.deepEqual(
    pool.relaxedProducts.map((product) => product.id),
    ["external-suction"],
  );
});

test("natural language avoid constraints exclude insertable, app-controlled, and couple-oriented candidates", () => {
  const pool = buildRecommendationCandidatePool(
    { gender: "female", tags: [] },
    [
      makeProduct({
        id: "safe-suction",
        gender: "female",
        typeCode: "suction",
        subtypeCode: "clitoral_suction",
        physicalForm: "external",
        rawDescription: "外部吮吸器，单人使用，非 APP 控制。",
      }),
      makeProduct({
        id: "insertable-suction",
        gender: "female",
        typeCode: "dual_stimulation",
        subtypeCode: "suction_dual",
        physicalForm: "composite",
        rawDescription: "内外双刺激吮吸器，入体结构。",
      }),
      makeProduct({
        id: "app-suction",
        gender: "female",
        typeCode: "suction",
        subtypeCode: "clitoral_suction",
        physicalForm: "external",
        rawDescription: "外部吮吸器，支持 APP 远控和异地遥控。",
      }),
      makeProduct({
        id: "couple-suction",
        gender: "unisex",
        typeCode: "wearable_remote",
        subtypeCode: "dual_wearable_remote",
        physicalForm: "external",
        rawDescription: "情侣共玩远控穿戴款，双人互动。",
      }),
    ],
    {
      naturalLanguageQuery:
        "想要一个吮吸器，不要入体，不要APP，也不要情侣款。",
    },
  );

  assert.deepEqual(
    pool.relaxedProducts.map((product) => product.id),
    ["safe-suction"],
  );
});
