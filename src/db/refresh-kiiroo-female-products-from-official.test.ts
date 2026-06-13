import assert from "node:assert/strict";
import test from "node:test";

import {
  buildKiirooFemaleRefreshPatch,
  extractKiirooFemaleRowsFromShopifyCatalog,
  shouldKeepKiirooFemaleSourceRow,
  shouldRunKiirooFemaleRefreshScript,
} from "./refresh-kiiroo-female-products-from-official.ts";

const BASE_PRODUCT = {
  id: 9185372799312,
  title: "スポット",
  handle: "spot",
  body_html:
    "<p>Kiiroo Spot is a wearable remote egg vibrator with FeelConnect app support, quiet vibration, waterproof body and partner control.</p>",
  vendor: "KIIROO®",
  product_type: "バイブレーター",
  tags: ["vibrator", "sdc-sync", "YGroup_spot"],
  variants: [
    {
      id: 48498837586256,
      title: "Default Title",
      sku: "11069-W",
      available: true,
      price: "17800",
      compare_at_price: null,
    },
  ],
  images: [
    {
      src: "https://cdn.shopify.com/s/files/1/2331/0997/files/spot.webp?v=1",
    },
  ],
  options: [{ name: "タイトル", values: ["Default Title"] }],
};

test("extractKiirooFemaleRowsFromShopifyCatalog parses Shopify vibrators and filters male/accessory products", () => {
  const rows = extractKiirooFemaleRowsFromShopifyCatalog({
    products: [
      BASE_PRODUCT,
      {
        ...BASE_PRODUCT,
        title: "Kiiroo Launch",
        handle: "launch",
        body_html: "<p>Male stroker accessory for penis stimulation.</p>",
        product_type: "Masturbator",
        tags: ["male", "stroker"],
      },
      {
        ...BASE_PRODUCT,
        title: "Charging Cable",
        handle: "charging-cable",
        body_html: "<p>Replacement charging cable.</p>",
        product_type: "Accessory",
        tags: ["accessory"],
      },
    ],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.name, "スポット");
  assert.equal(rows[0]?.sourceUrl, "https://www.kiiroo.jp/products/spot");
  assert.equal(rows[0]?.priceJpy, 17800);
  assert.equal(rows[0]?.coverImage, "https://cdn.shopify.com/s/files/1/2331/0997/files/spot.webp?v=1");
  assert.equal(rows[0]?.appSupport, true);
});

test("shouldKeepKiirooFemaleSourceRow keeps female vibrators and rejects male-only/accessory rows", () => {
  const rows = extractKiirooFemaleRowsFromShopifyCatalog([BASE_PRODUCT]);
  const baseRow = rows[0]!;

  assert.equal(shouldKeepKiirooFemaleSourceRow(baseRow), true);
  assert.equal(
    shouldKeepKiirooFemaleSourceRow({
      ...baseRow,
      name: "Kiiroo Launch",
      productType: "Masturbator",
      rawDescription: "Male stroker for penis stimulation.",
      categoryHints: ["male", "stroker"],
    }),
    false,
  );
  assert.equal(
    shouldKeepKiirooFemaleSourceRow({
      ...baseRow,
      name: "Charging Cable",
      productType: "Accessory",
      rawDescription: "Replacement charging cable.",
      categoryHints: ["accessory"],
    }),
    false,
  );
});

test("buildKiirooFemaleRefreshPatch fills all fields and preserves JPY price provenance", () => {
  const row = extractKiirooFemaleRowsFromShopifyCatalog([BASE_PRODUCT])[0]!;
  const patch = buildKiirooFemaleRefreshPatch(row);

  assert.equal(patch.name, "スポット");
  assert.equal(patch.safeDisplayName, "スポット");
  assert.equal(patch.price, 819);
  assert.equal(patch.maxDb, 40);
  assert.equal(patch.waterproof, 7);
  assert.equal(patch.appearance, "high_disguise");
  assert.equal(patch.physicalForm, "internal");
  assert.equal(patch.motorType, "gentle");
  assert.equal(patch.gender, "unisex");
  assert.equal(patch.brand, "Kiiroo");
  assert.equal(patch.material, "亲肤硅胶/ABS");
  assert.equal(patch.link, "https://www.kiiroo.jp/products/spot");
  assert.equal(patch.imageUrl, "https://cdn.shopify.com/s/files/1/2331/0997/files/spot.webp?v=1");
  assert.equal(patch.typeCode, "wearable_remote");
  assert.equal(patch.subtypeCode, "insertable_remote");
  assert.equal(patch.productSpecs.price_source_currency, "JPY");
  assert.equal(patch.productSpecs.price_jpy, 17800);
  assert.equal(patch.productSpecs.price_rmb, 819);
  assert.equal(patch.productTags.includes("APP支持"), true);
  assert.equal(patch.recommendationFeatures.featureVersion, "recommendation-product-features-v1");
  assert.ok(
    Array.isArray(patch.recommendationFeatures.evidence) &&
      patch.recommendationFeatures.evidence.length > 0,
  );
});

test("buildKiirooFemaleRefreshPatch classifies ProWand, Pearl and Fuse", () => {
  const [prowand, pearl, fuse] = extractKiirooFemaleRowsFromShopifyCatalog([
    {
      ...BASE_PRODUCT,
      title: "KiirooのProWand",
      handle: "prowand",
      body_html: "<p>Powerful wand vibrator with FeelConnect app and strong external stimulation.</p>",
      product_type: "ワンドバイブレーター",
    },
    {
      ...BASE_PRODUCT,
      title: "パール3",
      handle: "pearl3",
      body_html: "<p>G-spot vibrator for internal vaginal stimulation with FeelConnect app.</p>",
    },
    {
      ...BASE_PRODUCT,
      title: "ヒューズ",
      handle: "fuse-au",
      body_html: "<p>Dual stimulation vibrator for partners and interactive couples play.</p>",
    },
  ]).map(buildKiirooFemaleRefreshPatch);

  assert.equal(prowand?.typeCode, "external_vibe");
  assert.equal(prowand?.subtypeCode, "wand_massager");
  assert.equal(prowand?.motorType, "strong");
  assert.equal(pearl?.typeCode, "insertable");
  assert.equal(pearl?.subtypeCode, "gspot_insertable");
  assert.equal(fuse?.typeCode, "couples");
  assert.equal(fuse?.subtypeCode, "external_couples");
  assert.equal(fuse?.gender, "unisex");
});

test("shouldRunKiirooFemaleRefreshScript only matches direct execution", () => {
  assert.equal(
    shouldRunKiirooFemaleRefreshScript(
      "file:///tmp/refresh-kiiroo-female-products-from-official.ts",
      "/tmp/refresh-kiiroo-female-products-from-official.ts",
    ),
    true,
  );
  assert.equal(
    shouldRunKiirooFemaleRefreshScript(
      "file:///tmp/refresh-kiiroo-female-products-from-official.ts",
      "/tmp/other.ts",
    ),
    false,
  );
  assert.equal(
    shouldRunKiirooFemaleRefreshScript("file:///tmp/refresh-kiiroo-female-products-from-official.ts"),
    false,
  );
});
