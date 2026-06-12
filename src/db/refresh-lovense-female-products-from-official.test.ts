import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLovenseFemaleRefreshPatch,
  shouldKeepLovenseFemaleCleanedRow,
  shouldRunLovenseFemaleRefreshScript,
} from "./refresh-lovense-female-products-from-official.ts";

const BASE_ROW = {
  sourceUrl: "https://www.lovense.com/lush-4-best-bluetooth-remote-controlled-g-spot-vibrator",
  name: "Lush 4",
  price: 835,
  image: "https://cdn.lovense.com/example.jpg",
  rawDescription:
    "[基础信息]\n商品名: Lush 4\n副标题: Bluetooth App-Controlled G-Spot Egg Vibrator\n站内分类提示: Sex Toys for Women | lush4\n性别提示: 女性\nAPP支持: Yes\n[卖点摘要]\nApp controlled remote G-spot vibrator with quiet waterproof silicone body.",
  specs: {
    max_db: null,
    waterproof: 7,
    appearance: "normal",
    physical_form: "internal",
    motor_type: "gentle",
    function_tags: ["APP控制", "远程遥控", "G点刺激", "防水"],
    gender: "female",
    material: "亲肤硅胶",
    price_rmb: 835,
    price_usd: 116,
  },
};

test("shouldKeepLovenseFemaleCleanedRow keeps women-list products and rejects obvious non-toy rows", () => {
  assert.equal(shouldKeepLovenseFemaleCleanedRow(BASE_ROW), true);
  assert.equal(
    shouldKeepLovenseFemaleCleanedRow({
      ...BASE_ROW,
      name: "Lovense 4K Webcam 2",
      sourceUrl: "https://www.lovense.com/lovense-webcam",
      rawDescription: `${BASE_ROW.rawDescription}\n最适合直播主播的专业网络摄像头。`,
    }),
    false,
  );
  assert.equal(
    shouldKeepLovenseFemaleCleanedRow({
      ...BASE_ROW,
      name: "Max 2",
      rawDescription: "[基础信息]\n商品名: Max 2\n性别提示: 男性\n站内分类提示: Sex Toys for Men",
      specs: { ...BASE_ROW.specs, gender: "male" },
    }),
    false,
  );
});

test("buildLovenseFemaleRefreshPatch fills all female_recommender_toys fields", () => {
  const patch = buildLovenseFemaleRefreshPatch(BASE_ROW);

  assert.equal(patch.name, "Lush 4");
  assert.equal(patch.safeDisplayName.length > 0, true);
  assert.equal(patch.price, 835);
  assert.equal(patch.maxDb, 40);
  assert.equal(patch.waterproof, 7);
  assert.equal(patch.appearance, "normal");
  assert.equal(patch.physicalForm, "internal");
  assert.equal(patch.motorType, "gentle");
  assert.equal(patch.gender, "female");
  assert.equal(patch.brand, "Lovense");
  assert.equal(patch.material, "亲肤硅胶");
  assert.equal(patch.link, BASE_ROW.sourceUrl);
  assert.equal(patch.imageUrl, BASE_ROW.image);
  assert.equal(patch.rawDescription, BASE_ROW.rawDescription);
  assert.equal(patch.typeCode, "insertable");
  assert.equal(patch.subtypeCode, "insertable_vibe");
  assert.equal(patch.recommendationFeatures.featureVersion, "recommendation-product-features-v1");
  assert.ok(
    Array.isArray(patch.recommendationFeatures.evidence) &&
      patch.recommendationFeatures.evidence.some(
        (item: any) => item.signal === "appOrRemote" && item.polarity === "positive",
      ),
  );
});

test("buildLovenseFemaleRefreshPatch gives accessories and lube non-empty subtypes", () => {
  const lube = buildLovenseFemaleRefreshPatch({
    ...BASE_ROW,
    name: "Personal Lubricant Jelly/Lotion",
    sourceUrl: "https://www.lovense.com/natural-water-based-lubricant-jelly",
    price: 108,
    rawDescription:
      "[基础信息]\n商品名: Personal Lubricant Jelly/Lotion\n性别提示: 女性\n站内分类提示: Sex Toys for Women\n水基润滑剂，身体安全且对硅胶玩具安全。",
    specs: {
      ...BASE_ROW.specs,
      max_db: null,
      waterproof: null,
      function_tags: ["护理耗材", "润滑"],
      gender: "unisex",
    },
  });
  assert.equal(lube.typeCode, "care_accessory");
  assert.equal(lube.subtypeCode, "lube_care");
  assert.equal(lube.maxDb, 0);
  assert.equal(lube.waterproof, 0);

  const harness = buildLovenseFemaleRefreshPatch({
    ...BASE_ROW,
    name: "Lovense Harness",
    sourceUrl: "https://www.lovense.com/lovense-dildos-strap-on-harness",
    rawDescription:
      "[基础信息]\n商品名: Lovense Harness\n性别提示: 女性\n站内分类提示: Sex Toys for Women\n适配 Lapis 的亲肤背带。",
    specs: { ...BASE_ROW.specs, material: "亲肤面料" },
  });
  assert.equal(harness.typeCode, "bdsm");
  assert.equal(harness.subtypeCode, "fetish_accessory");
});

test("buildLovenseFemaleRefreshPatch converts review-buffer USD rows to RMB fields", () => {
  const patch = buildLovenseFemaleRefreshPatch({
    sourceUrl: "https://www.lovense.com/mini-bullet-vibrator-for-clitoral-simulation",
    name: "Ambi",
    price: 59,
    priceUsd: 59,
    priceCurrency: "USD",
    coverImage: "https://cdn.lovense.com/ambi.jpg",
    genderHint: "female",
    categoryHints: ["Sex Toys for Women", "ambi"],
    rawDescription:
      "[基础信息]\n商品名: Ambi\n性别提示: female\n站内分类提示: Sex Toys for Women\nAPP controlled remote mini bullet vibrator for clitoral stimulation.",
  });

  assert.equal(patch.price, 400);
  assert.equal(patch.gender, "female");
  assert.equal(patch.typeCode, "external_vibe");
  assert.equal(patch.subtypeCode, "bullet_vibe");
  assert.equal(patch.material, "亲肤硅胶");
  assert.ok(patch.productTags.includes("APP控制"));
});

test("shouldKeepLovenseFemaleCleanedRow accepts review-buffer category and gender hints", () => {
  assert.equal(
    shouldKeepLovenseFemaleCleanedRow({
      name: "Ambi",
      genderHint: "female",
      categoryHints: ["Sex Toys for Women"],
      rawDescription: "Remote mini bullet vibrator.",
    }),
    true,
  );
});

test("shouldRunLovenseFemaleRefreshScript only matches direct execution", () => {
  assert.equal(
    shouldRunLovenseFemaleRefreshScript(
      "file:///tmp/refresh-lovense-female-products-from-official.ts",
      "/tmp/refresh-lovense-female-products-from-official.ts",
    ),
    true,
  );
  assert.equal(
    shouldRunLovenseFemaleRefreshScript(
      "file:///tmp/refresh-lovense-female-products-from-official.ts",
      "/tmp/other.ts",
    ),
    false,
  );
  assert.equal(shouldRunLovenseFemaleRefreshScript("file:///tmp/refresh-lovense-female-products-from-official.ts"), false);
});
