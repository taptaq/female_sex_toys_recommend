import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDameFemaleRefreshPatch,
  extractDameFemaleRowsFromShopifyCatalog,
  shouldKeepDameFemaleSourceRow,
  shouldRunDameFemaleRefreshScript,
} from "./refresh-dame-female-products-from-official.ts";

const BASE_PRODUCT = {
  id: 6169995411639,
  title: "Aer Suction Vibrator",
  handle: "aer",
  body_html:
    "<p>This suction vibrator creates a soft seal around your clitoris and delivers rhythmic pulses of air.</p>",
  vendor: "Dame Products",
  product_type: "Suction Vibrator",
  tags: ["beginner", "clitoral", "external", "sex toy", "solo", "toy", "vibrator", "waterproof"],
  variants: [
    {
      title: "Periwinkle",
      sku: "AER-PW",
      available: true,
      price: "125.00",
      compare_at_price: null,
    },
  ],
  images: [
    {
      src: "https://cdn.shopify.com/s/files/1/1027/2873/files/aer-1-periwinkle.png?v=1",
    },
  ],
  options: [{ name: "Color", values: ["Periwinkle"] }],
};

test("extractDameFemaleRowsFromShopifyCatalog keeps female toys and filters mixed catalog non-toys", () => {
  const rows = extractDameFemaleRowsFromShopifyCatalog({
    products: [
      BASE_PRODUCT,
      {
        ...BASE_PRODUCT,
        title: "Aloe Lube",
        handle: "aloe-lube",
        body_html: "<p>Toy-safe Aloe Vera Lube for silky glide.</p>",
        product_type: "Personal Lubricant",
        tags: ["accessories", "care", "lube"],
        variants: [{ title: "2 oz", sku: "ALO-2", available: true, price: "12.00", compare_at_price: "12.00" }],
      },
      {
        ...BASE_PRODUCT,
        title: "Aer x Sephora (Warehouse Sale)",
        handle: "aer-x-sephora",
        body_html: "<p>Warehouse sale Aer colorway.</p>",
        product_type: "",
        tags: ["oos-rule-exempt"],
        variants: [{ title: "Default Title", sku: "AER-FL", available: false, price: "62.50", compare_at_price: "125.00" }],
      },
      {
        ...BASE_PRODUCT,
        title: "Spare Charging Cable",
        handle: "spare-charging-cable",
        body_html: "<p>Replacement charging cable.</p>",
        product_type: "Component",
        tags: ["charger", "replacement"],
        variants: [{ title: "Default Title", sku: "CAB", available: true, price: "4.00", compare_at_price: null }],
      },
    ],
  });

  assert.deepEqual(rows.map((row) => row.name), ["Aer Suction Vibrator"]);
  assert.equal(rows[0]?.sourceUrl, "https://dame.com/products/aer");
  assert.equal(rows[0]?.priceUsd, 125);
});

test("shouldKeepDameFemaleSourceRow rejects non-toys and male-only devices", () => {
  const baseRow = extractDameFemaleRowsFromShopifyCatalog([BASE_PRODUCT])[0]!;
  assert.equal(shouldKeepDameFemaleSourceRow(baseRow), true);
  assert.equal(
    shouldKeepDameFemaleSourceRow({
      ...baseRow,
      name: "Hand + Vibe Sex Toy Cleaner",
      productType: "Sex Toy Cleaner",
      rawDescription: "Cleaner spray for toys.",
      categoryHints: ["accessories", "cleaner"],
    }),
    false,
  );
  assert.equal(
    shouldKeepDameFemaleSourceRow({
      ...baseRow,
      name: "Hug Vibrating Cock Ring",
      productType: "Vibrator",
      rawDescription: "Vibrating cock ring for penis stimulation.",
      categoryHints: ["cock ring", "couples"],
    }),
    false,
  );
});

test("buildDameFemaleRefreshPatch fills all fields and preserves USD provenance", () => {
  const row = extractDameFemaleRowsFromShopifyCatalog([BASE_PRODUCT])[0]!;
  const patch = buildDameFemaleRefreshPatch(row);

  assert.equal(patch.name, "Aer Suction Vibrator");
  assert.equal(patch.safeDisplayName, "Aer Suction Vibrator");
  assert.equal(patch.price, 890);
  assert.equal(patch.maxDb, 40);
  assert.equal(patch.waterproof, 7);
  assert.equal(patch.appearance, "high_disguise");
  assert.equal(patch.physicalForm, "external");
  assert.equal(patch.motorType, "gentle");
  assert.equal(patch.gender, "female");
  assert.equal(patch.brand, "Dame");
  assert.equal(patch.link, "https://dame.com/products/aer");
  assert.equal(patch.imageUrl, "https://cdn.shopify.com/s/files/1/1027/2873/files/aer-1-periwinkle.png?v=1");
  assert.equal(patch.typeCode, "suction");
  assert.equal(patch.subtypeCode, "suction_pure");
  assert.equal(patch.productSpecs.price_source_currency, "USD");
  assert.equal(patch.productSpecs.price_usd, 125);
  assert.equal(patch.productSpecs.price_rmb, 890);
  assert.equal(patch.productTags.includes("吮吸刺激"), true);
  assert.ok(
    Array.isArray(patch.recommendationFeatures.evidence) &&
      patch.recommendationFeatures.evidence.length > 0,
  );
});

test("buildDameFemaleRefreshPatch classifies representative Dame catalog toys", () => {
  const [arc, eva, fin, crystal, rope, rabbit] = extractDameFemaleRowsFromShopifyCatalog([
    {
      ...BASE_PRODUCT,
      title: "Arc G-Spot Vibrator",
      handle: "arc",
      body_html: "<p>Arc is a curved G-spot vibrator with internal vibrations.</p>",
      product_type: "My Products",
      tags: ["main", "toy"],
      variants: [{ title: "Plum", sku: "ARC-PL", available: true, price: "119.00", compare_at_price: "119.00" }],
    },
    {
      ...BASE_PRODUCT,
      title: "Eva Wearable Vibrator",
      handle: "eva-ii",
      body_html: "<p>A hands-free wearable vibrator that stays in place during partnered sex.</p>",
      product_type: "Wearable Vibrator",
      tags: ["clitoral", "couples", "sex toy", "toy", "wearable", "waterproof"],
      variants: [{ title: "Default Title", sku: "EVA", available: true, price: "129.00", compare_at_price: "129.00" }],
    },
    {
      ...BASE_PRODUCT,
      title: "Fin Finger Vibrator",
      handle: "fin",
      body_html: "<p>A finger vibrator for external clitoral stimulation.</p>",
      product_type: "Finger Vibrator",
      tags: ["couples", "external", "sex toy", "toy", "vibrator"],
      variants: [{ title: "Default Title", sku: "FIN", available: true, price: "49.00", compare_at_price: "49.00" }],
    },
    {
      ...BASE_PRODUCT,
      title: "Amethyst Crystal Dildo",
      handle: "amethyst-crystal-dildo",
      body_html: "<p>The Amethyst Original is a crystal dildo made from pure amethyst.</p>",
      vendor: "Chakrubs",
      product_type: "Chakrubs",
      tags: [],
      variants: [{ title: "Default Title", sku: "CKR-OG-AMTH", available: true, price: "250.00", compare_at_price: null }],
    },
    {
      ...BASE_PRODUCT,
      title: "Funfetti Rainbow Bondage Rope",
      handle: "funfetti-rainbow-bondage-rope",
      body_html: "<p>Bondage rope for restraint play.</p>",
      product_type: "Bondage",
      tags: [],
      variants: [{ title: "Default Title", sku: "ROP", available: true, price: "29.00", compare_at_price: "29.00" }],
    },
    {
      ...BASE_PRODUCT,
      title: "RITUAL Aura Rechargeable Silicone Rabbit Vibrator Lilac",
      handle: "ritual-aura-recharge-sili-rabbit-vib-lil",
      body_html: "<p>Rechargeable rabbit vibrator for dual action stimulation.</p>",
      product_type: "Discontinued",
      tags: ["Dual Action and Rabbits", "G-Spot and Classic Slimline"],
      variants: [{ title: "Default Title", sku: "RIT", available: true, price: "78.34", compare_at_price: null }],
    },
  ]).map(buildDameFemaleRefreshPatch);

  assert.equal(arc?.typeCode, "insertable");
  assert.equal(arc?.subtypeCode, "insertable_vibe");
  assert.equal(eva?.typeCode, "wearable_remote");
  assert.equal(eva?.subtypeCode, "panty_wearable");
  assert.equal(eva?.gender, "unisex");
  assert.equal(fin?.typeCode, "external_vibe");
  assert.equal(fin?.subtypeCode, "bullet_vibe");
  assert.equal(crystal?.typeCode, "insertable");
  assert.equal(crystal?.subtypeCode, "gspot_insertable");
  assert.equal(crystal?.material, "天然水晶/石材");
  assert.equal(rope?.typeCode, "bdsm");
  assert.equal(rope?.subtypeCode, "bondage_restraint");
  assert.equal(rabbit?.typeCode, "dual_stimulation");
  assert.equal(rabbit?.subtypeCode, "rabbit_dual");
  assert.equal(rabbit?.physicalForm, "composite");
});

test("shouldRunDameFemaleRefreshScript only matches direct execution", () => {
  assert.equal(
    shouldRunDameFemaleRefreshScript(
      "file:///tmp/refresh-dame-female-products-from-official.ts",
      "/tmp/refresh-dame-female-products-from-official.ts",
    ),
    true,
  );
  assert.equal(
    shouldRunDameFemaleRefreshScript(
      "file:///tmp/refresh-dame-female-products-from-official.ts",
      "/tmp/other.ts",
    ),
    false,
  );
  assert.equal(shouldRunDameFemaleRefreshScript("file:///tmp/refresh-dame-female-products-from-official.ts"), false);
});
