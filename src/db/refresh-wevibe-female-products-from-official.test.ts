import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWeVibeFemaleRefreshPatch,
  extractWeVibeWomenListItems,
  shouldKeepWeVibeFemaleSourceRow,
  shouldRunWeVibeFemaleRefreshScript,
} from "./refresh-wevibe-female-products-from-official.ts";

const BASE_ROW = {
  sourceUrl: "https://www.we-vibe.com/us/melt-2",
  name: "We-Vibe Melt 2",
  safeDisplayName: "We-Vibe Melt 2",
  priceUsd: 159,
  originalPriceUsd: null,
  coverImage: "https://www.we-vibe.com/media/catalog/product/m/e/melt-2.png",
  genderHint: "female" as const,
  stock: "In stock",
  categoryHints: [
    "All Toys For Her",
    "clitoral stimulation",
    "air suction toys",
    "app-enabled vibrator",
    "long-distance",
    "all sex toys for couples",
  ],
  listPosition: 2,
  sku: "We-Vibe Melt 2",
  rawDescription:
    "[基础信息]\n商品名: We-Vibe Melt 2\n页面价格(USD): 159\n站内分类提示: All Toys For Her | clitoral stimulation | air suction toys | app-enabled vibrator | long-distance\n性别提示: female\nAPP支持: Yes\n[英文详情]\nAir suction clitoral stimulator with app-enabled long-distance control and waterproof rechargeable design.\n[来源链接] https://www.we-vibe.com/us/melt-2",
  detailImageUrls: ["https://www.we-vibe.com/media/catalog/product/m/e/melt-2.png"],
  colors: ["Purple"],
  skuList: ["We-Vibe Melt 2"],
  appSupport: true,
  specs: {
    function_tags: ["空气脉冲", "阴蒂刺激", "APP支持", "远程遥控"],
    price_usd: 159,
    price_rmb: 1132,
  },
};

test("extractWeVibeWomenListItems parses Magento product card anchors and filters other brands", () => {
  const html = `
    <a href="https://www.we-vibe.com/us/nova2" class="product__photo product-item-photo"
      data-id="Nova2" data-name="We-Vibe Nova 2" data-price="159"
      data-dimension10="In stock"
      data-category="All Toys For Her | rabbit vibrator | g spot vibrator | app-enabled vibrator"
      data-position="1"></a>
    <a href="https://www.we-vibe.com/us/womanizer-next" class="product__photo product-item-photo"
      data-id="Next" data-name="Womanizer Next" data-price="229"
      data-category="womanizer | all toys for her" data-position="2"></a>
    <a href="https://www.we-vibe.com/us/verge" class="product__photo product-item-photo"
      data-id="Verge" data-name="We-Vibe Verge" data-price="129"
      data-category="all toys for him | prostate | cock ring" data-position="3"></a>
  `;

  assert.deepEqual(extractWeVibeWomenListItems(html), [
    {
      sourceUrl: "https://www.we-vibe.com/us/nova2",
      name: "We-Vibe Nova 2",
      priceUsd: 159,
      originalPriceUsd: null,
      coverImage: null,
      genderHint: "female",
      stock: "In stock",
      categoryHints: ["All Toys For Her", "rabbit vibrator", "g spot vibrator", "app-enabled vibrator"],
      listPosition: 1,
      sku: "Nova2",
    },
  ]);
});

test("shouldKeepWeVibeFemaleSourceRow keeps We-Vibe female/shared rows and rejects other brands or male-only", () => {
  assert.equal(shouldKeepWeVibeFemaleSourceRow(BASE_ROW), true);
  assert.equal(
    shouldKeepWeVibeFemaleSourceRow({
      ...BASE_ROW,
      sourceUrl: "https://www.we-vibe.com/us/sync-2",
      name: "We-Vibe Sync 2",
      categoryHints: ["all sex toys for couples", "worn during sex", "app-enabled vibrator"],
      rawDescription: "Couples vibrator worn during sex with app-enabled long-distance play.",
    }),
    true,
  );
  assert.equal(
    shouldKeepWeVibeFemaleSourceRow({
      ...BASE_ROW,
      sourceUrl: "https://www.we-vibe.com/us/womanizer-next",
      name: "Womanizer Next",
      categoryHints: ["womanizer", "all toys for her"],
      rawDescription: "Womanizer Pleasure Air product.",
    }),
    false,
  );
  assert.equal(
    shouldKeepWeVibeFemaleSourceRow({
      ...BASE_ROW,
      sourceUrl: "https://www.we-vibe.com/us/vector",
      name: "We-Vibe Vector+",
      categoryHints: ["prostate", "all toys for him"],
      rawDescription: "Vibrating prostate massager for men.",
    }),
    false,
  );
});

test("buildWeVibeFemaleRefreshPatch fills all female_recommender_toys fields for Melt 2", () => {
  const patch = buildWeVibeFemaleRefreshPatch(BASE_ROW);

  assert.equal(patch.name, "We-Vibe Melt 2");
  assert.equal(patch.safeDisplayName, "We-Vibe Melt 2");
  assert.equal(patch.price, 1132);
  assert.equal(patch.maxDb, 40);
  assert.equal(patch.waterproof, 7);
  assert.equal(patch.appearance, "normal");
  assert.equal(patch.physicalForm, "external");
  assert.equal(patch.motorType, "gentle");
  assert.equal(patch.gender, "female");
  assert.equal(patch.brand, "We-Vibe");
  assert.equal(patch.material, "亲肤硅胶");
  assert.equal(patch.link, BASE_ROW.sourceUrl);
  assert.equal(patch.imageUrl, BASE_ROW.coverImage);
  assert.equal(patch.rawDescription, BASE_ROW.rawDescription);
  assert.equal(patch.typeCode, "suction");
  assert.equal(patch.subtypeCode, "suction_pure");
  assert.equal(patch.productTags.includes("APP支持"), true);
  assert.equal(patch.recommendationFeatures.featureVersion, "recommendation-product-features-v1");
  assert.ok(
    Array.isArray(patch.recommendationFeatures.evidence) &&
      patch.recommendationFeatures.evidence.length > 0,
  );
});

test("buildWeVibeFemaleRefreshPatch classifies common We-Vibe female/shared product families", () => {
  const nova = buildWeVibeFemaleRefreshPatch({
    ...BASE_ROW,
    sourceUrl: "https://www.we-vibe.com/us/nova2",
    name: "We-Vibe Nova 2",
    rawDescription: "Rabbit vibrator for G-spot and clitoral stimulation with app-enabled control.",
    categoryHints: ["All Toys For Her", "rabbit vibrator", "g spot vibrator"],
    specs: {},
  });
  const moxie = buildWeVibeFemaleRefreshPatch({
    ...BASE_ROW,
    sourceUrl: "https://www.we-vibe.com/us/moxie-plus",
    name: "We-Vibe Moxie+",
    rawDescription: "Panty wearable vibrator with remote-controlled app-enabled long-distance play.",
    categoryHints: ["All Toys For Her", "panty vibrators", "wearable vibrator"],
    specs: {},
  });
  const sync = buildWeVibeFemaleRefreshPatch({
    ...BASE_ROW,
    sourceUrl: "https://www.we-vibe.com/us/sync-2",
    name: "We-Vibe Sync 2",
    rawDescription: "Couples vibrator worn during sex with app-enabled long-distance control.",
    categoryHints: ["all sex toys for couples", "worn during sex", "couples vibrator"],
    specs: {},
  });
  const jive = buildWeVibeFemaleRefreshPatch({
    ...BASE_ROW,
    sourceUrl: "https://www.we-vibe.com/us/jive-2",
    name: "We-Vibe Jive 2",
    rawDescription: "Wearable egg vibrator delivering discreet vibrations to your G-spot.",
    categoryHints: ["All Toys For Her", "g spot vibrator", "wearable vibrator"],
    specs: {},
  });

  assert.equal(nova.typeCode, "dual_stimulation");
  assert.equal(nova.subtypeCode, "rabbit_dual");
  assert.equal(nova.physicalForm, "composite");
  assert.equal(moxie.typeCode, "wearable_remote");
  assert.equal(moxie.subtypeCode, "panty_wearable");
  assert.equal(sync.typeCode, "couples");
  assert.equal(sync.subtypeCode, "insertable_couples");
  assert.equal(sync.gender, "unisex");
  assert.equal(jive.typeCode, "wearable_remote");
  assert.equal(jive.subtypeCode, "insertable_remote");
});

test("shouldRunWeVibeFemaleRefreshScript only matches direct execution", () => {
  assert.equal(
    shouldRunWeVibeFemaleRefreshScript(
      "file:///tmp/refresh-wevibe-female-products-from-official.ts",
      "/tmp/refresh-wevibe-female-products-from-official.ts",
    ),
    true,
  );
  assert.equal(
    shouldRunWeVibeFemaleRefreshScript("file:///tmp/refresh-wevibe-female-products-from-official.ts", "/tmp/other.ts"),
    false,
  );
  assert.equal(shouldRunWeVibeFemaleRefreshScript("file:///tmp/refresh-wevibe-female-products-from-official.ts"), false);
});
