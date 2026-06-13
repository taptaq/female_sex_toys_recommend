import assert from "node:assert/strict";
import test from "node:test";

import {
  buildHelloNancyFemaleRefreshPatch,
  extractHelloNancyFemaleRowsFromShopifyCatalog,
  shouldKeepHelloNancyFemaleSourceRow,
  shouldRunHelloNancyFemaleRefreshScript,
} from "./refresh-hellonancy-female-products-from-official.ts";

const BASE_PRODUCT = {
  id: 8862835573057,
  title: "Lem Clitoral Massager",
  handle: "lem",
  body_html:
    "<p>认识 Lem。这款阴蒂按摩器非常适合首次体验气流吸吮快感的人，拥有 12 种独特强度和模式。</p>",
  vendor: "Nancy",
  product_type: "个人按摩器",
  tags: [
    "10 unique intensities and patterns",
    "Quiet and discreet (Shhh!)",
    "Rechargeable Battery",
    "Splashproof",
  ],
  variants: [
    {
      title: "Default Title",
      sku: "NVIB-LEM-2311Y",
      available: true,
      price: "89.00",
      compare_at_price: "159.00",
    },
  ],
  images: [
    {
      src: "https://cdn.shopify.com/s/files/1/0726/3764/5121/files/lem.webp?v=1",
    },
  ],
  options: [{ name: "标题", values: ["默认标题"] }],
};

test("extractHelloNancyFemaleRowsFromShopifyCatalog keeps toys/bundles and filters non-toys", () => {
  const rows = extractHelloNancyFemaleRowsFromShopifyCatalog({
    products: [
      BASE_PRODUCT,
      {
        ...BASE_PRODUCT,
        title: "Uno Bliss Bundle",
        handle: "uno-bliss-bundle",
        body_html: "<p>包含 Uno 个人按摩器、Pleasure Pouch 和 Playtime Pleasures 指南。</p>",
        variants: [{ title: "Default Title", sku: "NBUN-VIP-2311P", available: true, price: "79.00", compare_at_price: "149.00" }],
      },
      {
        ...BASE_PRODUCT,
        title: "Pleasure Pouch",
        handle: "pleasure-pouch",
        body_html: "<p>用于收纳玩具、润滑剂和小物的收纳袋。</p>",
        product_type: "配件",
        variants: [{ title: "Default Title", sku: "NACC-PCH-23100", available: true, price: "9.00", compare_at_price: "19.00" }],
      },
      {
        ...BASE_PRODUCT,
        title: "Charger",
        handle: "charger",
        body_html: "<p>Magnetic charging cable.</p>",
        product_type: "",
        variants: [{ title: "Uno Charging Cable", sku: "NACC-UNC-2411W", available: true, price: "9.99", compare_at_price: null }],
      },
    ],
  });

  assert.deepEqual(rows.map((row) => row.name), ["Lem Clitoral Massager", "Uno Bliss Bundle"]);
  assert.equal(rows[0]?.sourceUrl, "https://hellonancy.com/products/lem");
  assert.equal(rows[0]?.priceUsd, 89);
  assert.equal(rows[0]?.originalPriceUsd, 159);
});

test("shouldKeepHelloNancyFemaleSourceRow keeps female toy rows and rejects obvious non-toys", () => {
  const baseRow = extractHelloNancyFemaleRowsFromShopifyCatalog([BASE_PRODUCT])[0]!;
  assert.equal(shouldKeepHelloNancyFemaleSourceRow(baseRow), true);
  assert.equal(
    shouldKeepHelloNancyFemaleSourceRow({
      ...baseRow,
      name: "Juicy Waterproof Blanket",
      productType: "Blankets",
      rawDescription: "A waterproof blanket for play and travel.",
      categoryHints: ["blanket", "waterproof"],
    }),
    false,
  );
  assert.equal(
    shouldKeepHelloNancyFemaleSourceRow({
      ...baseRow,
      name: "Playtime Pleasures",
      productType: "数字",
      rawDescription: "An ebook guide for self-love.",
      categoryHints: ["digital", "guide"],
    }),
    false,
  );
});

test("buildHelloNancyFemaleRefreshPatch fills all fields and preserves USD provenance", () => {
  const row = extractHelloNancyFemaleRowsFromShopifyCatalog([BASE_PRODUCT])[0]!;
  const patch = buildHelloNancyFemaleRefreshPatch(row);

  assert.equal(patch.name, "Lem Clitoral Massager");
  assert.equal(patch.safeDisplayName, "Lem Clitoral Massager");
  assert.equal(patch.price, 634);
  assert.equal(patch.maxDb, 40);
  assert.equal(patch.waterproof, 7);
  assert.equal(patch.appearance, "high_disguise");
  assert.equal(patch.physicalForm, "external");
  assert.equal(patch.motorType, "gentle");
  assert.equal(patch.gender, "female");
  assert.equal(patch.brand, "Hello Nancy");
  assert.equal(patch.material, "亲肤安全材质");
  assert.equal(patch.link, "https://hellonancy.com/products/lem");
  assert.equal(patch.imageUrl, "https://cdn.shopify.com/s/files/1/0726/3764/5121/files/lem.webp?v=1");
  assert.equal(patch.typeCode, "suction");
  assert.equal(patch.subtypeCode, "suction_pure");
  assert.equal(patch.productSpecs.price_source_currency, "USD");
  assert.equal(patch.productSpecs.price_usd, 89);
  assert.equal(patch.productSpecs.original_price_usd, 159);
  assert.equal(patch.productSpecs.price_rmb, 634);
  assert.equal(patch.productTags.includes("吮吸刺激"), true);
  assert.equal(patch.recommendationFeatures.featureVersion, "recommendation-product-features-v1");
  assert.ok(
    Array.isArray(patch.recommendationFeatures.evidence) &&
      patch.recommendationFeatures.evidence.length > 0,
  );
});

test("buildHelloNancyFemaleRefreshPatch classifies representative Hello Nancy products", () => {
  const [berri, kalii, gii, pixie, lolly, bundle] = extractHelloNancyFemaleRowsFromShopifyCatalog([
    {
      ...BASE_PRODUCT,
      title: "Berri Tapping Clitoral Massager",
      handle: "berri",
      body_html: "<p>Berri TapSphere technology brings tapping clitoral stimulation with 12 rhythms.</p>",
      product_type: "Personal Massager",
    },
    {
      ...BASE_PRODUCT,
      title: "Kalii",
      handle: "kalii",
      body_html: "<p>Kalii is a borosilicate glass G-spot wand for internal pleasure.</p>",
      vendor: "Biird",
      product_type: "",
      tags: ["Kalii"],
    },
    {
      ...BASE_PRODUCT,
      title: "Gii Glow",
      handle: "gii-glow",
      body_html: "<p>Gii Glow offers inner and outer dual stimulation with deep vibrations.</p>",
      vendor: "Biird",
      product_type: "",
      tags: [],
    },
    {
      ...BASE_PRODUCT,
      title: "Pixie Remote-Controlled Panty Vibrator",
      handle: "pixie",
      body_html: "<p>Pixie is a remote-controlled panty vibrator for wearable pleasure.</p>",
      product_type: "个人按摩器",
    },
    {
      ...BASE_PRODUCT,
      title: "Lolly Mini Wand",
      handle: "lolly-mini-wand",
      body_html: "<p>Lolly is a mini wand vibrator with rechargeable battery.</p>",
      product_type: "个人按摩器",
    },
    {
      ...BASE_PRODUCT,
      title: "Oh-Oh-Oh Triple Bundle",
      handle: "oh-oh-oh-triple-bundle",
      body_html: "<p>A triple bundle with Lem, Lolly and Uno personal massager toys.</p>",
      product_type: "个人按摩器",
    },
  ]).map(buildHelloNancyFemaleRefreshPatch);

  assert.equal(berri?.typeCode, "external_vibe");
  assert.equal(berri?.subtypeCode, "bullet_vibe");
  assert.equal(kalii?.typeCode, "insertable");
  assert.equal(kalii?.subtypeCode, "gspot_insertable");
  assert.equal(kalii?.material, "硼硅玻璃");
  assert.equal(gii?.typeCode, "dual_stimulation");
  assert.equal(gii?.subtypeCode, "rabbit_dual");
  assert.equal(gii?.physicalForm, "composite");
  assert.equal(pixie?.typeCode, "wearable_remote");
  assert.equal(pixie?.subtypeCode, "panty_wearable");
  assert.equal(pixie?.gender, "unisex");
  assert.equal(lolly?.typeCode, "external_vibe");
  assert.equal(lolly?.subtypeCode, "wand_massager");
  assert.equal(bundle?.typeCode, "dual_stimulation");
  assert.equal(bundle?.physicalForm, "composite");
});

test("shouldRunHelloNancyFemaleRefreshScript only matches direct execution", () => {
  assert.equal(
    shouldRunHelloNancyFemaleRefreshScript(
      "file:///tmp/refresh-hellonancy-female-products-from-official.ts",
      "/tmp/refresh-hellonancy-female-products-from-official.ts",
    ),
    true,
  );
  assert.equal(
    shouldRunHelloNancyFemaleRefreshScript(
      "file:///tmp/refresh-hellonancy-female-products-from-official.ts",
      "/tmp/other.ts",
    ),
    false,
  );
  assert.equal(
    shouldRunHelloNancyFemaleRefreshScript("file:///tmp/refresh-hellonancy-female-products-from-official.ts"),
    false,
  );
});
