import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildLovehoneyFemaleRefreshPatch,
  extractLovehoneyCachedListItemsFromProfile,
  extractLovehoneyWomenListItemsFromHtml,
  shouldKeepLovehoneyFemaleSourceRow,
  shouldRunLovehoneyFemaleRefreshScript,
} from "./refresh-lovehoney-female-products-from-official.ts";

const BASE_ROW = {
  sourceUrl: "https://www.lovehoney.co.uk/sex-toys/vibrators/rabbit-vibrators/p/lovehoney-happy-rabbit/",
  name: "Lovehoney Happy Rabbit Rechargeable Rabbit Vibrator",
  safeDisplayName: "Lovehoney Happy Rabbit Rechargeable Rabbit Vibrator",
  sku: "lh-happy-rabbit",
  price: 69.99,
  priceCurrency: "GBP",
  image: "https://www.lovehoney.co.uk/product-images/happy-rabbit.jpg",
  genderHint: "female",
  categoryHints: ["sex-toys-for-women", "Lovehoney women list", "rabbit vibrator"],
  detailImageUrls: ["https://www.lovehoney.co.uk/product-images/happy-rabbit.jpg"],
  rawDescription:
    "[基础信息]\n商品名: Lovehoney Happy Rabbit Rechargeable Rabbit Vibrator\n页面价格(GBP): 69.99\n站内分类提示: sex-toys-for-women | Lovehoney women list\n性别提示: female\nAPP支持: No\n[规格参数]\nMaterial: Silicone\n[卖点摘要]\nRechargeable rabbit vibrator for clitoral and G-spot dual stimulation. Waterproof.\n[来源链接] https://www.lovehoney.co.uk/sex-toys/vibrators/rabbit-vibrators/p/lovehoney-happy-rabbit/",
  specs: {
    function_tags: ["兔耳双刺激", "G点刺激", "阴蒂刺激", "防水", "可充电"],
    gender: "female",
    material: "亲肤硅胶",
    type_code: "dual_stimulation",
    subtype_code: "rabbit_dual",
    max_db: 55,
    waterproof: 7,
    appearance: "normal",
    price_source_currency: "GBP",
    price_source_amount: 69.99,
    fx_rate_gbp_cny: 9.12,
  },
};

test("extractLovehoneyWomenListItemsFromHtml parses product anchors from women list HTML", () => {
  const html = `
    <article>
      <a href="/sex-toys/vibrators/p/lovehoney-rose/" aria-label="Lovehoney Rose Clitoral Suction Stimulator">
        <img src="/images/rose.jpg" alt="Lovehoney Rose" />
      </a>
    </article>
    <article>
      <a href="https://www.lovehoney.co.uk/sex-toys/dildos/p/lovehoney-dildo/?colour=purple" title="Lovehoney Silicone Dildo">
        Lovehoney Silicone Dildo £24.99
      </a>
    </article>
  `;

  assert.deepEqual(extractLovehoneyWomenListItemsFromHtml(html), [
    {
      sourceUrl: "https://www.lovehoney.co.uk/sex-toys/vibrators/p/lovehoney-rose/",
      name: "Lovehoney Rose Clitoral Suction Stimulator",
      genderHint: "female",
      categoryHints: ["sex-toys-for-women", "Lovehoney women list"],
      listPosition: 1,
    },
    {
      sourceUrl: "https://www.lovehoney.co.uk/sex-toys/dildos/p/lovehoney-dildo/?colour=purple",
      name: "Lovehoney Silicone Dildo",
      genderHint: "female",
      categoryHints: ["sex-toys-for-women", "Lovehoney women list"],
      listPosition: 2,
    },
  ]);
});

test("extractLovehoneyCachedListItemsFromProfile recovers product URLs and names from browser cache text", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lovehoney-cache-"));
  try {
    fs.writeFileSync(
      path.join(tempDir, "cache.txt"),
      [
        "https://www.lovehoney.co.uk/sex-toys/vibrators/wand-vibrators/p/lovehoney-deluxe-rechargeable-mini-massage-wand-vibrator/a37806g79577.html",
        "Lovehoney Deluxe Rechargeable Mini Massage Wand Vibrator",
        "https://www.lovehoney.co.uk/sex-toys/male-sex-toys/male-masturbators/p/example-male/a11111g22222.html",
      ].join("\n"),
    );

    assert.deepEqual(extractLovehoneyCachedListItemsFromProfile(tempDir), [
      {
        sourceUrl:
          "https://www.lovehoney.co.uk/sex-toys/vibrators/wand-vibrators/p/lovehoney-deluxe-rechargeable-mini-massage-wand-vibrator/a37806g79577.html",
        name: "Lovehoney Deluxe Rechargeable Mini Massage Wand Vibrator",
        subtitle: "",
        coverImage: "",
        genderHint: "female",
        categoryHints: [
          "sex-toys-for-women",
          "Lovehoney women list",
          "https://www.lovehoney.co.uk/sex-toys/vibrators/wand-vibrators/p/lovehoney-deluxe-rechargeable-mini-massage-wand-vibrator/a37806g79577.html",
        ],
        price: null,
        priceCurrency: "GBP",
        originalPrice: null,
        originalPriceCurrency: "UNKNOWN",
        listPosition: 1,
      },
    ]);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("shouldKeepLovehoneyFemaleSourceRow keeps women-list rows and rejects obvious male-only rows", () => {
  assert.equal(shouldKeepLovehoneyFemaleSourceRow(BASE_ROW), true);
  assert.equal(
    shouldKeepLovehoneyFemaleSourceRow({
      ...BASE_ROW,
      sourceUrl: "https://www.lovehoney.co.uk/sex-toys/male-sex-toys/p/male-stroker/",
      name: "Male Stroker Masturbator",
      genderHint: "male",
      categoryHints: ["male sex toy"],
      rawDescription: "[基础信息]\n商品名: Male Stroker Masturbator\n性别提示: male\n[卖点摘要]\nMale masturbator for men.",
    }),
    false,
  );
});

test("buildLovehoneyFemaleRefreshPatch fills all female_recommender_toys fields for rabbit vibrator", () => {
  const patch = buildLovehoneyFemaleRefreshPatch(BASE_ROW);

  assert.equal(patch.name, BASE_ROW.name);
  assert.equal(patch.safeDisplayName, BASE_ROW.safeDisplayName);
  assert.equal(patch.price, 638);
  assert.equal(patch.maxDb, 55);
  assert.equal(patch.waterproof, 7);
  assert.equal(patch.appearance, "normal");
  assert.equal(patch.physicalForm, "composite");
  assert.equal(patch.motorType, "gentle");
  assert.equal(patch.gender, "female");
  assert.equal(patch.brand, "Lovehoney");
  assert.equal(patch.material, "亲肤硅胶");
  assert.equal(patch.link, BASE_ROW.sourceUrl);
  assert.equal(patch.imageUrl, BASE_ROW.image);
  assert.equal(patch.rawDescription, BASE_ROW.rawDescription);
  assert.equal(patch.typeCode, "dual_stimulation");
  assert.equal(patch.subtypeCode, "rabbit_dual");
  assert.equal(patch.productTags.includes("兔耳双刺激"), true);
  assert.equal(patch.recommendationFeatures.featureVersion, "recommendation-product-features-v1");
  assert.ok(
    Array.isArray(patch.recommendationFeatures.evidence) &&
      patch.recommendationFeatures.evidence.length > 0,
  );
});

test("buildLovehoneyFemaleRefreshPatch classifies suction and wand products", () => {
  const suction = buildLovehoneyFemaleRefreshPatch({
    ...BASE_ROW,
    sourceUrl: "https://www.lovehoney.co.uk/sex-toys/vibrators/clitoral-stimulators/p/lovehoney-rose/",
    name: "Lovehoney Rose Clitoral Suction Stimulator",
    categoryHints: ["sex-toys-for-women", "clitoral suction stimulator"],
    rawDescription:
      "[基础信息]\n商品名: Lovehoney Rose Clitoral Suction Stimulator\n站内分类提示: sex-toys-for-women\n性别提示: female\n[卖点摘要]\nAir pulse suction clitoral stimulator.",
    specs: {
      ...BASE_ROW.specs,
      function_tags: ["吮吸刺激", "阴蒂刺激"],
      type_code: undefined,
      subtype_code: undefined,
    },
  });
  const wand = buildLovehoneyFemaleRefreshPatch({
    ...BASE_ROW,
    sourceUrl: "https://www.lovehoney.co.uk/sex-toys/vibrators/wand-vibrators/p/lovehoney-deluxe-wand/",
    name: "Lovehoney Deluxe Extra Powerful Wand Massager",
    categoryHints: ["sex-toys-for-women", "wand massager"],
    rawDescription:
      "[基础信息]\n商品名: Lovehoney Deluxe Extra Powerful Wand Massager\n站内分类提示: sex-toys-for-women\n性别提示: female\n[卖点摘要]\nPowerful wand body massager.",
    specs: {
      ...BASE_ROW.specs,
      function_tags: ["魔杖按摩"],
      type_code: undefined,
      subtype_code: undefined,
    },
  });

  assert.equal(suction.typeCode, "suction");
  assert.equal(suction.subtypeCode, "suction_pure");
  assert.equal(wand.typeCode, "external_vibe");
  assert.equal(wand.subtypeCode, "wand_massager");
  assert.equal(wand.motorType, "strong");
});

test("shouldRunLovehoneyFemaleRefreshScript only matches direct execution", () => {
  assert.equal(
    shouldRunLovehoneyFemaleRefreshScript(
      "file:///tmp/refresh-lovehoney-female-products-from-official.ts",
      "/tmp/refresh-lovehoney-female-products-from-official.ts",
    ),
    true,
  );
  assert.equal(
    shouldRunLovehoneyFemaleRefreshScript("file:///tmp/refresh-lovehoney-female-products-from-official.ts", "/tmp/other.ts"),
    false,
  );
  assert.equal(
    shouldRunLovehoneyFemaleRefreshScript("file:///tmp/refresh-lovehoney-female-products-from-official.ts"),
    false,
  );
});
