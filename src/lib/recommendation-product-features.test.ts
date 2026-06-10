import assert from "node:assert/strict";
import test from "node:test";

import type { Product } from "../data/mock.ts";
import { buildRecommendationProductFeatures } from "./recommendation-product-features.ts";

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

test("buildRecommendationProductFeatures detects positive and negated suction signals", () => {
  assert.equal(
    buildRecommendationProductFeatures(
      makeProduct({
        typeCode: "suction",
        rawDescription: "外部吮吸器，空气脉冲吸感明显。",
      }),
    ).isSuctionLike,
    true,
  );

  assert.equal(
    buildRecommendationProductFeatures(
      makeProduct({
        typeCode: "external_vibe",
        subtypeCode: "wand_vibe",
        rawDescription: "外部震动强劲，但不是吮吸类产品。",
      }),
    ).isSuctionLike,
    false,
  );
});

test("buildRecommendationProductFeatures handles app, remote, and their negated wording", () => {
  assert.equal(
    buildRecommendationProductFeatures(
      makeProduct({
        rawDescription: "外部吮吸器，支持 APP 远控和异地互动。",
      }),
    ).supportsAppOrRemote,
    true,
  );

  assert.equal(
    buildRecommendationProductFeatures(
      makeProduct({
        rawDescription: "外部吮吸器，单人使用，非 APP 控制。",
      }),
    ).supportsAppOrRemote,
    false,
  );
});

test("buildRecommendationProductFeatures detects couple, pattern, and intensity signals", () => {
  const features = buildRecommendationProductFeatures(
    makeProduct({
      gender: "unisex",
      rawDescription:
        "情侣共玩外部吮吸器，多模式、多档位、多频率节奏变化，强吸力但也有温和档。",
      tags: ["情侣", "模式多", "强吸", "温和"],
    }),
  );

  assert.equal(features.isCoupleOriented, true);
  assert.equal(features.hasManyPatterns, true);
  assert.equal(features.hasStrongSuctionSignal, true);
  assert.equal(features.hasGentleSignal, true);
  assert.equal(features.hasStrongIntensitySignal, true);
});

test("buildRecommendationProductFeatures returns concise evidence snippets for positive and negative signals", () => {
  const features = buildRecommendationProductFeatures(
    makeProduct({
      typeCode: "external_vibe",
      subtypeCode: "wand_vibe",
      rawDescription:
        "外部震动产品，不是吮吸类产品。单人使用，非 APP 控制。多模式、多档位节奏变化，温和档适合慢热。",
      tags: ["模式多", "温和"],
    }),
  );

  assert.deepEqual(
    features.evidence
      .filter((item) => item.signal === "suction")
      .map((item) => ({
        polarity: item.polarity,
        text: item.text,
      })),
    [
      {
        polarity: "negative",
        text: "外部震动产品，不是吮吸类产品。",
      },
    ],
  );
  assert.deepEqual(
    features.evidence
      .filter((item) => item.signal === "appOrRemote")
      .map((item) => ({
        polarity: item.polarity,
        text: item.text,
      })),
    [
      {
        polarity: "negative",
        text: "单人使用，非 APP 控制。",
      },
    ],
  );
  assert.deepEqual(
    features.evidence
      .filter((item) => item.signal === "patterns")
      .map((item) => item.text),
    ["多模式、多档位节奏变化，温和档适合慢热。", "模式多"],
  );
});

test("buildRecommendationProductFeatures adds structured evidence for insertable silicone fantasy products", () => {
  const features = buildRecommendationProductFeatures(
    makeProduct({
      typeCode: "insertable",
      subtypeCode: "gspot_insertable",
      physicalForm: "internal",
      material: "铂金硅胶",
      rawDescription:
        "Phosphorescent platinum silicone fantasy toy with a luminous glow and body-safe non-porous finish.",
      tags: ["幻想造型"],
    }),
  );

  assert.ok(features.evidence.some((item) => item.signal === "insertable" && item.source === "structured"));
  assert.ok(features.evidence.some((item) => item.signal === "material" && item.source === "structured"));
  assert.ok(features.evidence.some((item) => item.signal === "fantasy" && item.source === "structured"));
});

test("buildRecommendationProductFeatures adds structured evidence for accessories", () => {
  const features = buildRecommendationProductFeatures(
    makeProduct({
      typeCode: "bdsm",
      subtypeCode: "fetish_accessory",
      physicalForm: "external",
      rawDescription: "Acrylic keychain add-on and collectible accessory.",
      tags: ["周边"],
    }),
  );

  assert.ok(features.evidence.some((item) => item.signal === "accessory" && item.source === "structured"));
});
