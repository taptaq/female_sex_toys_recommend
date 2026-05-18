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

test("opening with strict filters still keeps recommendation candidates inside the selected male toy pool", () => {
  const answers: AnswerState = {
    gender: "male",
    budget: [100, 150],
    maxDb: 40,
    appearance: "high_disguise",
    tags: [],
  };

  const pool = buildRecommendationCandidatePool(answers, [
    makeProduct({
      id: "male-toy-1",
      name: "Male Toy 1",
      gender: "male",
      typeCode: "masturbator",
      subtypeCode: "manual_masturbator",
      price: 299,
      maxDb: 55,
      appearance: "normal",
    }),
    makeProduct({
      id: "male-toy-2",
      name: "Male Toy 2",
      gender: "male",
      typeCode: "prostate",
      subtypeCode: "prostate_vibe",
      price: 259,
      maxDb: 48,
      appearance: "normal",
    }),
    makeProduct({
      id: "unisex-toy-1",
      name: "Unisex Toy 1",
      gender: "unisex",
      typeCode: "cock_ring",
      subtypeCode: "vibrating_cock_ring",
      price: 239,
      maxDb: 52,
      appearance: "normal",
    }),
    makeProduct({
      id: "female-toy-1",
      name: "Female Toy 1",
      gender: "female",
      typeCode: "suction",
      subtypeCode: "suction_pure",
      price: 199,
      physicalForm: "external",
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
    ["male-toy-1", "male-toy-2", "unisex-toy-1"],
  );
  assert.deepEqual(
    pool.rankedInputProducts.map((product) => product.id),
    ["male-toy-1", "male-toy-2", "unisex-toy-1"],
  );
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
