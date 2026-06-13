import assert from "node:assert/strict";
import test from "node:test";

import {
  buildUnboundFemaleRefreshPatch,
  extractUnboundFemaleRowsFromShopifyCatalog,
  shouldKeepUnboundFemaleSourceRow,
  shouldRunUnboundFemaleRefreshScript,
} from "./refresh-unbound-female-products-from-official.ts";

const BASE_PRODUCT = {
  id: 4625682137160,
  title: "Puff",
  handle: "unbound-puff-suction-vibe",
  body_html:
    "<p>Puff is Unbound's #1 best-selling vibrator with targeted suction capabilities. With 5 intensity settings, Puff offers powerful sensations in a compact size.</p>",
  vendor: "Unbound",
  product_type: "Vibrator",
  tags: ["Best Seller", "External", "Filter: External", "Filter: Multispeed", "Filter: Quiet", "Filter: Waterproof"],
  variants: [
    {
      title: "Mint / Sea",
      sku: "PUFUBVB-MT",
      available: true,
      price: "48.00",
      compare_at_price: null,
    },
  ],
  images: [
    {
      src: "https://cdn.shopify.com/s/files/1/0314/5521/files/Puff_PDP_1.jpg?v=1",
    },
  ],
  options: [{ name: "Color", values: ["Mint / Sea", "Quartz / Coral"] }],
};

test("extractUnboundFemaleRowsFromShopifyCatalog keeps toys/sets and filters storage products", () => {
  const rows = extractUnboundFemaleRowsFromShopifyCatalog({
    products: [
      BASE_PRODUCT,
      {
        ...BASE_PRODUCT,
        title: "Best Sellers",
        handle: "best-sellers",
        body_html: "<p>Puff is a compact suction vibe. Bender is a flexible internal vibrator. Storage Bag included.</p>",
        product_type: "Sets",
        tags: ["Best Seller", "Couples", "Filter: External", "Filter: Internal", "Vibrating"],
        variants: [{ title: "Default Title", sku: "BESUBKS", available: true, price: "102.00", compare_at_price: "138.00" }],
      },
      {
        ...BASE_PRODUCT,
        title: "Storage Bag",
        handle: "storage-bag",
        body_html: "<p>A pleated double-zip storage bag for toys and charging cords.</p>",
        product_type: "Merch",
        tags: ["Toy Safe"],
        variants: [{ title: "Sea", sku: "STOUBAC-SE", available: true, price: "24.00", compare_at_price: null }],
      },
    ],
  });

  assert.deepEqual(rows.map((row) => row.name), ["Puff", "Best Sellers"]);
  assert.equal(rows[0]?.sourceUrl, "https://unboundbabes.com/products/unbound-puff-suction-vibe");
  assert.equal(rows[0]?.priceUsd, 48);
  assert.equal(rows[1]?.originalPriceUsd, 138);
});

test("shouldKeepUnboundFemaleSourceRow keeps female/unisex toys and rejects non-toys", () => {
  const baseRow = extractUnboundFemaleRowsFromShopifyCatalog([BASE_PRODUCT])[0]!;
  assert.equal(shouldKeepUnboundFemaleSourceRow(baseRow), true);
  assert.equal(
    shouldKeepUnboundFemaleSourceRow({
      ...baseRow,
      name: "Storage Bag",
      productType: "Merch",
      rawDescription: "A storage bag for charging cords.",
      categoryHints: ["Merch", "Toy Safe"],
    }),
    false,
  );
  assert.equal(
    shouldKeepUnboundFemaleSourceRow({
      ...baseRow,
      name: "Male Stroker",
      productType: "Masturbator",
      rawDescription: "A male stroker sleeve for penis stimulation.",
      categoryHints: ["male", "stroker"],
    }),
    false,
  );
});

test("buildUnboundFemaleRefreshPatch fills all fields and preserves USD price provenance", () => {
  const row = extractUnboundFemaleRowsFromShopifyCatalog([BASE_PRODUCT])[0]!;
  const patch = buildUnboundFemaleRefreshPatch(row);

  assert.equal(patch.name, "Puff");
  assert.equal(patch.safeDisplayName, "Puff");
  assert.equal(patch.price, 342);
  assert.equal(patch.maxDb, 40);
  assert.equal(patch.waterproof, 7);
  assert.equal(patch.appearance, "high_disguise");
  assert.equal(patch.physicalForm, "external");
  assert.equal(patch.motorType, "gentle");
  assert.equal(patch.gender, "female");
  assert.equal(patch.brand, "Unbound");
  assert.equal(patch.material, "亲肤安全材质");
  assert.equal(patch.link, "https://unboundbabes.com/products/unbound-puff-suction-vibe");
  assert.equal(patch.imageUrl, "https://cdn.shopify.com/s/files/1/0314/5521/files/Puff_PDP_1.jpg?v=1");
  assert.equal(patch.typeCode, "suction");
  assert.equal(patch.subtypeCode, "suction_pure");
  assert.equal(patch.productSpecs.price_source_currency, "USD");
  assert.equal(patch.productSpecs.price_usd, 48);
  assert.equal(patch.productSpecs.price_rmb, 342);
  assert.equal(patch.productTags.includes("吮吸刺激"), true);
  assert.equal(patch.recommendationFeatures.featureVersion, "recommendation-product-features-v1");
  assert.ok(
    Array.isArray(patch.recommendationFeatures.evidence) &&
      patch.recommendationFeatures.evidence.length > 0,
  );
});

test("buildUnboundFemaleRefreshPatch classifies Dex, Gemini, Cuffies and Best Sellers", () => {
  const [dex, gemini, cuffies, set] = extractUnboundFemaleRowsFromShopifyCatalog([
    {
      ...BASE_PRODUCT,
      title: "Dex",
      handle: "dex",
      body_html: "<p>Dex is a compact wand with deep, rumbly vibrations across 4 speeds and 4 patterns.</p>",
      tags: ["External", "Powerful", "Waterproof"],
    },
    {
      ...BASE_PRODUCT,
      title: "Gemini",
      handle: "unbound-gem-glass-g-spot-dildo",
      body_html: "<p>Gemini is a dual-ended borosilicate glass dildo for G-spot and anal play.</p>",
      product_type: "Accessory",
      tags: ["Anal", "Internal", "Glass", "Waterproof"],
    },
    {
      ...BASE_PRODUCT,
      title: "Cuffies",
      handle: "cuffies",
      body_html: "<p>Cuffies are strong, stretchy restraints made from super-soft, body-safe silicone.</p>",
      product_type: "Accessory",
      tags: ["BDSM", "Couples", "Filter: Couples", "Filter: Waterproof"],
    },
    {
      ...BASE_PRODUCT,
      title: "Best Sellers",
      handle: "best-sellers",
      body_html: "<p>Puff is a compact suction vibe. Bender is a flexible internal vibrator.</p>",
      product_type: "Sets",
      tags: ["Couples", "Filter: External", "Filter: Internal", "Vibrating"],
    },
  ]).map(buildUnboundFemaleRefreshPatch);

  assert.equal(dex?.typeCode, "external_vibe");
  assert.equal(dex?.subtypeCode, "wand_massager");
  assert.equal(dex?.motorType, "strong");
  assert.equal(gemini?.typeCode, "insertable");
  assert.equal(gemini?.subtypeCode, "gspot_insertable");
  assert.equal(gemini?.material, "硼硅玻璃");
  assert.equal(cuffies?.typeCode, "bdsm");
  assert.equal(cuffies?.subtypeCode, "bondage_restraint");
  assert.equal(cuffies?.gender, "unisex");
  assert.equal(set?.typeCode, "dual_stimulation");
  assert.equal(set?.subtypeCode, "suction_dual");
  assert.equal(set?.physicalForm, "composite");
});

test("shouldRunUnboundFemaleRefreshScript only matches direct execution", () => {
  assert.equal(
    shouldRunUnboundFemaleRefreshScript(
      "file:///tmp/refresh-unbound-female-products-from-official.ts",
      "/tmp/refresh-unbound-female-products-from-official.ts",
    ),
    true,
  );
  assert.equal(
    shouldRunUnboundFemaleRefreshScript(
      "file:///tmp/refresh-unbound-female-products-from-official.ts",
      "/tmp/other.ts",
    ),
    false,
  );
  assert.equal(
    shouldRunUnboundFemaleRefreshScript("file:///tmp/refresh-unbound-female-products-from-official.ts"),
    false,
  );
});
