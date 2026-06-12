import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSvakomFemaleRefreshPatch,
  shouldKeepSvakomFemaleSourceRow,
  shouldRunSvakomFemaleRefreshScript,
} from "./refresh-svakom-female-products-from-official.ts";

const BASE_ROW = {
  shopifyId: 123,
  handle: "clitoral-panty-vibrator",
  sourceUrl: "https://www.svakom.com/zh-hans-hk/products/clitoral-panty-vibrator",
  name: "EDENY",
  price: 503,
  priceCurrency: "HKD",
  image: "https://cdn.shopify.com/s/files/edeny.jpg",
  genderHint: "female",
  categoryHints: [
    "female sex toys",
    "clitoral vibrators",
    "panty vibrator",
    "app-controlled sex toys",
    "bluetooth vibrator",
    "wearable vibrator",
  ],
  rawDescription:
    "[基础信息]\n商品名: EDENY\n页面标题: Svakom Edeny | 可穿戴阴蒂振动器\n页面描述: App-controlled clitoral panty vibrator for women.\n页面价格(HKD): 503\n站内分类提示: female sex toys | clitoral vibrators | panty vibrator | app-controlled sex toys\n性别提示: female\nAPP支持: Yes\n[规格参数]\n材质: 亲肤硅胶\n[卖点摘要]\nWearable vibrator for clitoral stimulation.",
  specs: {
    function_tags: ["APP控制", "阴蒂刺激", "穿戴", "震动"],
    gender: "female",
    material: "亲肤硅胶",
    price_source_currency: "HKD",
    price_source_amount: 503,
  },
};

test("shouldKeepSvakomFemaleSourceRow keeps female rows and rejects male-only or accessory rows", () => {
  assert.equal(shouldKeepSvakomFemaleSourceRow(BASE_ROW), true);
  assert.equal(
    shouldKeepSvakomFemaleSourceRow({
      ...BASE_ROW,
      name: "ALEX",
      handle: "alex",
      genderHint: "male",
      categoryHints: ["Male Sex Toys", "masturbators"],
      rawDescription:
        "[基础信息]\n商品名: ALEX\n页面描述: Alex 是一款专为男性快感设计的强力推送式自慰器。\n性别提示: male",
    }),
    false,
  );
  assert.equal(
    shouldKeepSvakomFemaleSourceRow({
      ...BASE_ROW,
      name: "SVAKOM CHARGER - USB-A TO USB-C CHARGING CABLE",
      handle: "charge-cable-type-c",
      categoryHints: ["Accessories", "charging cable"],
      rawDescription: "[基础信息]\n商品名: Charging Cable\n站内分类提示: Accessories | cable",
    }),
    false,
  );
});

test("buildSvakomFemaleRefreshPatch fills all female_recommender_toys fields for app wearables", () => {
  const patch = buildSvakomFemaleRefreshPatch(BASE_ROW);

  assert.equal(patch.name, "EDENY");
  assert.equal(patch.safeDisplayName.length > 0, true);
  assert.equal(patch.price, 460);
  assert.equal(patch.maxDb, 50);
  assert.equal(patch.waterproof, 7);
  assert.equal(patch.appearance, "high_disguise");
  assert.equal(patch.physicalForm, "internal");
  assert.equal(patch.motorType, "gentle");
  assert.equal(patch.gender, "female");
  assert.equal(patch.brand, "SVAKOM");
  assert.equal(patch.material, "亲肤硅胶");
  assert.equal(patch.link, BASE_ROW.sourceUrl);
  assert.equal(patch.imageUrl, BASE_ROW.image);
  assert.equal(patch.rawDescription, BASE_ROW.rawDescription);
  assert.equal(patch.typeCode, "wearable_remote");
  assert.equal(patch.subtypeCode, "panty_wearable");
  assert.equal(patch.recommendationFeatures.featureVersion, "recommendation-product-features-v1");
  assert.ok(
    Array.isArray(patch.recommendationFeatures.evidence) &&
      patch.recommendationFeatures.evidence.some(
        (item: any) => item.signal === "appOrRemote" && item.polarity === "positive",
      ),
  );
});

test("buildSvakomFemaleRefreshPatch classifies main female Svakom families", () => {
  const rabbit = buildSvakomFemaleRefreshPatch({
    ...BASE_ROW,
    name: "AVERY",
    handle: "thrusting-rabbit-vibrator",
    sourceUrl: "https://www.svakom.com/zh-hans-hk/products/thrusting-rabbit-vibrator",
    categoryHints: ["female sex toys", "rabbit", "Rabbit Vibrators", "thrusting vibrators"],
    rawDescription:
      "[基础信息]\n商品名: AVERY\n性别提示: female\nThrusting rabbit vibrator for G-spot and clitoral dual stimulation.",
  });
  assert.equal(rabbit.typeCode, "dual_stimulation");
  assert.equal(rabbit.subtypeCode, "rabbit_dual");
  assert.equal(rabbit.physicalForm, "composite");
  assert.equal(rabbit.motorType, "strong");

  const suction = buildSvakomFemaleRefreshPatch({
    ...BASE_ROW,
    name: "PULSE LITE NEO",
    handle: "interactive-clitoral-stimulator",
    sourceUrl: "https://www.svakom.com/zh-hans-hk/products/interactive-clitoral-stimulator",
    categoryHints: ["female sex toys", "clit sucker", "suction", "app-controlled sex toys"],
    rawDescription:
      "[基础信息]\n商品名: PULSE LITE NEO\n性别提示: female\nApp controlled clitoral suction stimulator.",
  });
  assert.equal(suction.typeCode, "wearable_remote");
  assert.equal(suction.subtypeCode, "insertable_remote");

  const gspot = buildSvakomFemaleRefreshPatch({
    ...BASE_ROW,
    name: "AMY 2",
    handle: "g-spot-vibrator",
    sourceUrl: "https://www.svakom.com/zh-hans-hk/products/g-spot-vibrator",
    categoryHints: ["female sex toys", "g-spot vibrators", "classic vibrators"],
    rawDescription: "[基础信息]\n商品名: AMY 2\n性别提示: female\nWaterproof G-spot vibrator.",
  });
  assert.equal(gspot.typeCode, "insertable");
  assert.equal(gspot.subtypeCode, "insertable_vibe");
});

test("shouldRunSvakomFemaleRefreshScript only matches direct execution", () => {
  assert.equal(
    shouldRunSvakomFemaleRefreshScript(
      "file:///tmp/refresh-svakom-female-products-from-official.ts",
      "/tmp/refresh-svakom-female-products-from-official.ts",
    ),
    true,
  );
  assert.equal(
    shouldRunSvakomFemaleRefreshScript("file:///tmp/refresh-svakom-female-products-from-official.ts", "/tmp/other.ts"),
    false,
  );
  assert.equal(shouldRunSvakomFemaleRefreshScript("file:///tmp/refresh-svakom-female-products-from-official.ts"), false);
});
