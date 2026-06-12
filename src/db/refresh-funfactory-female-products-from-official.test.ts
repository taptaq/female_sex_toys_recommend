import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFunFactoryFemaleRefreshPatch,
  shouldKeepFunFactoryFemaleSourceRow,
  shouldRunFunFactoryFemaleRefreshScript,
} from "./refresh-funfactory-female-products-from-official.ts";

const BASE_ROW = {
  sourceUrl: "https://www.funfactory.com/products/laya-iii",
  name: "LAYA III",
  safeDisplayName: "LAYA III",
  subtitle: "Auflegevibrator",
  priceSourceAmount: 89.9,
  originalPriceSourceAmount: null,
  priceCurrency: "EUR" as const,
  coverImage: "https://www.funfactory.com/cdn/shop/files/laya-iii.png",
  rawDescription:
    "[基础信息]\n商品名: LAYA III\n站内分类提示: alle-sextoys\n性别提示: female\n[规格参数]\nMaterial: medical-grade silicone\nWaterproof: IPX7\nRechargeable USB\n[卖点摘要]\nCompact clitoral Auflegevibrator with strong vibration modes for external stimulation.\n[来源链接] https://www.funfactory.com/products/laya-iii",
  categoryHints: ["Vibrators", "Auflegevibrator", "Silicone"],
  genderHint: "unisex" as const,
  listPosition: 1,
  detailImageUrls: ["https://www.funfactory.com/cdn/shop/files/laya-iii.png"],
  specs: {
    function_tags: ["阴蒂刺激", "防水", "可充电"],
    gender: "female",
    material: "亲肤硅胶",
    type_code: "external_vibe",
    subtype_code: "bullet_vibe",
    max_db: 50,
    waterproof: 7,
    appearance: "high_disguise",
    price_source_currency: "EUR",
    price_source_amount: 89.9,
    price_rmb: 701,
  },
};

test("shouldKeepFunFactoryFemaleSourceRow keeps female and shared Fun Factory products", () => {
  assert.equal(shouldKeepFunFactoryFemaleSourceRow(BASE_ROW), true);
  assert.equal(
    shouldKeepFunFactoryFemaleSourceRow({
      ...BASE_ROW,
      sourceUrl: "https://www.funfactory.com/products/miss-bi",
      name: "MISS BI",
      subtitle: "Rabbit vibrator",
      rawDescription:
        "[基础信息]\n商品名: MISS BI\n[卖点摘要]\nDual stimulation rabbit vibrator for G-spot and clitoral stimulation.",
      categoryHints: ["Rabbit", "Dual Stimulation"],
      specs: {},
    }),
    true,
  );
  assert.equal(
    shouldKeepFunFactoryFemaleSourceRow({
      ...BASE_ROW,
      sourceUrl: "https://www.funfactory.com/products/bootie",
      name: "BOOTIE",
      subtitle: "Anal plug",
      rawDescription: "[基础信息]\n商品名: BOOTIE\n[卖点摘要]\nBeginner-friendly silicone anal plug.",
      categoryHints: ["Anal", "Plug"],
      specs: {},
    }),
    true,
  );
});

test("shouldKeepFunFactoryFemaleSourceRow rejects obvious male-only and non-toy rows", () => {
  assert.equal(
    shouldKeepFunFactoryFemaleSourceRow({
      ...BASE_ROW,
      sourceUrl: "https://www.funfactory.com/products/manta",
      name: "MANTA",
      subtitle: "Penisvibrator",
      rawDescription: "[基础信息]\n商品名: MANTA\n[卖点摘要]\nPenis vibrator for men.",
      categoryHints: ["Penisvibrator", "Male"],
      specs: {},
    }),
    false,
  );
  assert.equal(
    shouldKeepFunFactoryFemaleSourceRow({
      ...BASE_ROW,
      sourceUrl: "https://www.funfactory.com/products/gift-card",
      name: "Gift Card",
      subtitle: "Gift card",
      rawDescription: "Fun Factory gift card.",
      categoryHints: ["Gift Card"],
      specs: {},
    }),
    false,
  );
});

test("buildFunFactoryFemaleRefreshPatch fills all female_recommender_toys fields", () => {
  const patch = buildFunFactoryFemaleRefreshPatch(BASE_ROW);

  assert.equal(patch.name, "LAYA III");
  assert.equal(patch.safeDisplayName, "LAYA III");
  assert.equal(patch.price, 701);
  assert.equal(patch.maxDb, 50);
  assert.equal(patch.waterproof, 7);
  assert.equal(patch.appearance, "high_disguise");
  assert.equal(patch.physicalForm, "external");
  assert.equal(patch.motorType, "gentle");
  assert.equal(patch.gender, "female");
  assert.equal(patch.brand, "Fun Factory");
  assert.equal(patch.material, "亲肤硅胶");
  assert.equal(patch.link, BASE_ROW.sourceUrl);
  assert.equal(patch.imageUrl, BASE_ROW.coverImage);
  assert.equal(patch.rawDescription, BASE_ROW.rawDescription);
  assert.equal(patch.typeCode, "external_vibe");
  assert.equal(patch.subtypeCode, "bullet_vibe");
  assert.equal(patch.productTags.includes("阴蒂刺激"), true);
  assert.equal(patch.recommendationFeatures.featureVersion, "recommendation-product-features-v1");
  assert.ok(
    Array.isArray(patch.recommendationFeatures.evidence) &&
      patch.recommendationFeatures.evidence.length > 0,
  );
});

test("buildFunFactoryFemaleRefreshPatch classifies rabbit, insertable and anal rows without unknown subtype", () => {
  const rabbit = buildFunFactoryFemaleRefreshPatch({
    ...BASE_ROW,
    sourceUrl: "https://www.funfactory.com/products/miss-bi",
    name: "MISS BI",
    subtitle: "Rabbit vibrator",
    rawDescription: "Dual stimulation rabbit vibrator for G-spot and clitoral stimulation.",
    categoryHints: ["Rabbit", "Dual Stimulation"],
    specs: {},
  });
  const stronic = buildFunFactoryFemaleRefreshPatch({
    ...BASE_ROW,
    sourceUrl: "https://www.funfactory.com/products/stronic-g",
    name: "STRONIC G",
    subtitle: "Pulsator",
    rawDescription: "G-spot pulsator with powerful thrusting stimulation.",
    categoryHints: ["Pulsator", "G-Spot"],
    specs: {},
  });
  const anal = buildFunFactoryFemaleRefreshPatch({
    ...BASE_ROW,
    sourceUrl: "https://www.funfactory.com/products/bootie",
    name: "BOOTIE",
    subtitle: "Anal plug",
    rawDescription: "Silicone anal plug without vibration.",
    categoryHints: ["Anal", "Plug"],
    specs: {},
  });

  assert.equal(rabbit.typeCode, "dual_stimulation");
  assert.equal(rabbit.subtypeCode, "rabbit_dual");
  assert.equal(rabbit.physicalForm, "composite");
  assert.equal(stronic.typeCode, "insertable");
  assert.equal(stronic.subtypeCode, "insertable_vibe");
  assert.equal(stronic.motorType, "strong");
  assert.equal(anal.typeCode, "insertable");
  assert.equal(anal.subtypeCode, "gspot_insertable");
  assert.equal(anal.gender, "unisex");
  assert.notEqual(anal.typeCode, "unknown");
  assert.ok(anal.subtypeCode);
});

test("shouldRunFunFactoryFemaleRefreshScript only matches direct execution", () => {
  assert.equal(
    shouldRunFunFactoryFemaleRefreshScript(
      "file:///tmp/refresh-funfactory-female-products-from-official.ts",
      "/tmp/refresh-funfactory-female-products-from-official.ts",
    ),
    true,
  );
  assert.equal(
    shouldRunFunFactoryFemaleRefreshScript(
      "file:///tmp/refresh-funfactory-female-products-from-official.ts",
      "/tmp/other.ts",
    ),
    false,
  );
  assert.equal(
    shouldRunFunFactoryFemaleRefreshScript("file:///tmp/refresh-funfactory-female-products-from-official.ts"),
    false,
  );
});
