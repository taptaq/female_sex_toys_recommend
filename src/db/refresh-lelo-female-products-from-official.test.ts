import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLeloFemaleRefreshPatch,
  extractLeloWomenListItems,
  shouldKeepLeloFemaleSourceRow,
  shouldRunLeloFemaleRefreshScript,
} from "./refresh-lelo-female-products-from-official.ts";

const BASE_ROW = {
  sourceUrl: "https://www.lelo.com/zh-hant/sona-3-cruise",
  name: "SONA 3 Cruise",
  safeDisplayName: "SONA 3 Cruise",
  sku: "sona-3-cruise",
  schemaType: "Product",
  price: 6280,
  priceCurrency: "TWD",
  image: "https://www.lelo.com/sites/default/files/sona-3-cruise.png",
  genderHint: "female",
  categoryHints: ["sex-toys-for-women", "女性性愛玩具", "Product"],
  detailImageUrls: ["https://www.lelo.com/sites/default/files/sona-3-cruise.png"],
  rawDescription:
    "[基础信息]\n商品名: SONA 3 Cruise\n页面价格(TWD): 6280\n站内分类提示: sex-toys-for-women | 女性性愛玩具\n性别提示: female\nAPP支持: No\n[规格参数]\nSKU: sona-3-cruise\n材质: 亲肤硅胶\n[卖点摘要]\nSensonic clitoral stimulator with Cruise Control for deep sonic waves.\n[来源链接] https://www.lelo.com/zh-hant/sona-3-cruise",
  specs: {
    function_tags: ["声波刺激", "阴蒂刺激", "防水", "可充电"],
    gender: "female",
    material: "亲肤硅胶",
    type_code: "suction",
    subtype_code: "suction_pure",
    max_db: 50,
    waterproof: 7,
    appearance: "normal",
    price_source_currency: "TWD",
    price_source_amount: 6280,
    fx_rate_twd_cny: 0.214,
  },
};

test("extractLeloWomenListItems parses LELO CollectionPage JSON-LD product links", () => {
  const html = `
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "mainEntity": {
          "@type": "ItemList",
          "itemListElement": [
            {
              "@type": "ListItem",
              "position": 1,
              "item": {
                "@type": "Product",
                "name": "SONA 3 Cruise",
                "url": "https://www.lelo.com/zh-hant/sona-3-cruise?foo=bar"
              }
            },
            {
              "@type": "ListItem",
              "position": 2,
              "item": {
                "@type": "Product",
                "name": "ENIGMA Double Sonic",
                "url": "/zh-hant/enigma-double-sonic"
              }
            }
          ]
        }
      }
    </script>
  `;

  assert.deepEqual(extractLeloWomenListItems(html), [
    {
      position: 1,
      name: "SONA 3 Cruise",
      sourceUrl: "https://www.lelo.com/zh-hant/sona-3-cruise",
    },
    {
      position: 2,
      name: "ENIGMA Double Sonic",
      sourceUrl: "https://www.lelo.com/zh-hant/enigma-double-sonic",
    },
  ]);
});

test("shouldKeepLeloFemaleSourceRow keeps women-list rows and rejects obvious male-only rows", () => {
  assert.equal(shouldKeepLeloFemaleSourceRow(BASE_ROW), true);
  assert.equal(
    shouldKeepLeloFemaleSourceRow({
      ...BASE_ROW,
      sourceUrl: "https://www.lelo.com/zh-hant/couple-play",
      name: "COUPLE PLAY",
      schemaType: "Product Bundle",
      price: 229,
      priceCurrency: "SGD",
      rawDescription:
        "[基础信息]\n商品名: COUPLE PLAY\n页面描述: 高端情侣性爱玩具套装包括 TIANI™ 3、TOR™ 2、HEX™ 安全套和 LELO Personal Moisturizer 私密润滑液。\n站内分类提示: sex-toys-for-women | 女性性愛玩具\n性别提示: female\n[规格参数]\nSchema类型: Product Bundle\n[卖点摘要]\n情侣套装包含女性穿戴震动器、护理配件和润滑液。",
    }),
    true,
  );
  assert.equal(
    shouldKeepLeloFemaleSourceRow({
      ...BASE_ROW,
      sourceUrl: "https://www.lelo.com/zh-hant/loki-wave",
      name: "LOKI Wave",
      genderHint: "male",
      categoryHints: ["sex toys for men", "prostate massager"],
      rawDescription:
        "[基础信息]\n商品名: LOKI Wave\n性别提示: male\n[卖点摘要]\nProstate massager for men.",
    }),
    false,
  );
});

test("buildLeloFemaleRefreshPatch fills all female_recommender_toys fields for SONA", () => {
  const patch = buildLeloFemaleRefreshPatch(BASE_ROW);

  assert.equal(patch.name, "SONA 3 Cruise");
  assert.equal(patch.safeDisplayName, "SONA 3 Cruise");
  assert.equal(patch.price, 1344);
  assert.equal(patch.maxDb, 50);
  assert.equal(patch.waterproof, 7);
  assert.equal(patch.appearance, "normal");
  assert.equal(patch.physicalForm, "external");
  assert.equal(patch.motorType, "strong");
  assert.equal(patch.gender, "female");
  assert.equal(patch.brand, "LELO");
  assert.equal(patch.material, "亲肤硅胶");
  assert.equal(patch.link, BASE_ROW.sourceUrl);
  assert.equal(patch.imageUrl, BASE_ROW.image);
  assert.equal(patch.rawDescription, BASE_ROW.rawDescription);
  assert.equal(patch.typeCode, "suction");
  assert.equal(patch.subtypeCode, "suction_pure");
  assert.equal(patch.productTags.includes("声波刺激"), true);
  assert.equal(patch.recommendationFeatures.featureVersion, "recommendation-product-features-v1");
  assert.ok(
    Array.isArray(patch.recommendationFeatures.evidence) &&
      patch.recommendationFeatures.evidence.some((item: any) => item.signal === "suction"),
  );
});

test("buildLeloFemaleRefreshPatch converts LELO non-TWD prices with detail-page rates", () => {
  const patch = buildLeloFemaleRefreshPatch({
    ...BASE_ROW,
    price: 249,
    priceCurrency: "SGD",
    specs: {
      ...BASE_ROW.specs,
      price_source_currency: "SGD",
      price_source_amount: 249,
      fx_rate_sgd_cny: 5.258,
      fx_rates_cny: {
        SGD: 5.258,
        TWD: 0.214,
        CNY: 1,
      },
    },
  });

  assert.equal(patch.price, 1309);
});

test("buildLeloFemaleRefreshPatch classifies dual sonic LELO products", () => {
  const patch = buildLeloFemaleRefreshPatch({
    ...BASE_ROW,
    sourceUrl: "https://www.lelo.com/zh-hant/enigma-double-sonic",
    name: "ENIGMA Double Sonic",
    safeDisplayName: "ENIGMA Double Sonic",
    rawDescription:
      "[基础信息]\n商品名: ENIGMA Double Sonic\n站内分类提示: sex-toys-for-women | 女性性愛玩具\n性别提示: female\n[卖点摘要]\nDual stimulation product combining clitoral sonic waves and G-spot vibration.",
    specs: {
      ...BASE_ROW.specs,
      type_code: undefined,
      subtype_code: undefined,
    },
  });

  assert.equal(patch.typeCode, "dual_stimulation");
  assert.equal(patch.subtypeCode, "suction_dual");
  assert.equal(patch.physicalForm, "composite");
});

test("shouldRunLeloFemaleRefreshScript only matches direct execution", () => {
  assert.equal(
    shouldRunLeloFemaleRefreshScript(
      "file:///tmp/refresh-lelo-female-products-from-official.ts",
      "/tmp/refresh-lelo-female-products-from-official.ts",
    ),
    true,
  );
  assert.equal(
    shouldRunLeloFemaleRefreshScript("file:///tmp/refresh-lelo-female-products-from-official.ts", "/tmp/other.ts"),
    false,
  );
  assert.equal(shouldRunLeloFemaleRefreshScript("file:///tmp/refresh-lelo-female-products-from-official.ts"), false);
});
