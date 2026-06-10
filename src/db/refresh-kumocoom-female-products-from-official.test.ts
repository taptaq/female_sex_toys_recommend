import assert from "node:assert/strict";
import test from "node:test";

import {
  buildKumocoomFemaleRefreshPatch,
  shouldRunKumocoomFemaleRefreshScript,
} from "./refresh-kumocoom-female-products-from-official.ts";
import type { CleanedRow } from "../scraper/kumocoom-official/cleaner.ts";

const BASE_ROW: CleanedRow = {
  sourceUrl: "https://kumocoom.cn/products/abyssal-glow-silicone-toy",
  name: "Abyssal Glow Silicone Toy",
  safeDisplayName: "Abyssal Glow",
  brand: "KUMOCOOM",
  price: 475,
  coverImage: "https://cdn.shopify.com/example.jpg",
  rawDescription:
    "Abyssal Glow Silicone Toy\nPhosphorescent platinum silicone fantasy toy with soft glow.",
  gender: "female",
  material: "硅胶",
  specs: {
    price_source_currency: "USD",
    price_source_amount: 66,
    original_price_source_amount: null,
    price_rmb: 475,
    original_price_rmb: null,
    fx_rate_to_cny: 7.2,
    fx_rate_source: "test",
    fx_rate_date: "2026-06-10",
    gender: "female",
    material: "硅胶",
    appearance: "high_disguise",
    physical_form: "internal",
    motor_type: "gentle",
    waterproof: null,
    max_db: null,
    function_tags: ["幻想造型", "夜光"],
    type_code: "insertable",
    subtype_code: "gspot_insertable",
  },
  typeCode: "insertable",
  subtypeCode: "gspot_insertable",
};

test("buildKumocoomFemaleRefreshPatch fills all female_recommender_toys fields", () => {
  const patch = buildKumocoomFemaleRefreshPatch(BASE_ROW);

  assert.equal(patch.name, BASE_ROW.name);
  assert.equal(patch.safeDisplayName, "Abyssal Glow");
  assert.equal(patch.price, 475);
  assert.equal(patch.maxDb, 0);
  assert.equal(patch.waterproof, 0);
  assert.equal(patch.appearance, "high_disguise");
  assert.equal(patch.physicalForm, "internal");
  assert.equal(patch.motorType, "gentle");
  assert.equal(patch.gender, "female");
  assert.equal(patch.brand, "KUMOCOOM");
  assert.equal(patch.material, "硅胶");
  assert.equal(patch.link, BASE_ROW.sourceUrl);
  assert.equal(patch.imageUrl, BASE_ROW.coverImage);
  assert.equal(patch.rawDescription, BASE_ROW.rawDescription);
  assert.equal(patch.typeCode, "insertable");
  assert.equal(patch.subtypeCode, "gspot_insertable");
  assert.equal(patch.recommendationFeatures.featureVersion, "recommendation-product-features-v1");
  assert.ok(
    Array.isArray(patch.recommendationFeatures.evidence) &&
      patch.recommendationFeatures.evidence.some(
        (item: any) => item.signal === "insertable" && item.source === "structured",
      ),
  );
});

test("buildKumocoomFemaleRefreshPatch falls back away from unknown type and empty subtype", () => {
  const patch = buildKumocoomFemaleRefreshPatch({
    ...BASE_ROW,
    price: null,
    safeDisplayName: "",
    coverImage: "",
    sourceUrl: "",
    typeCode: "unknown",
    subtypeCode: null,
    specs: {
      ...BASE_ROW.specs,
      physical_form: "external",
      type_code: "unknown",
      subtype_code: null,
      function_tags: [],
    },
  });

  assert.equal(patch.safeDisplayName.length > 0, true);
  assert.equal(patch.price, 1);
  assert.equal(patch.link, "https://kumocoom.cn/collections/all");
  assert.equal(patch.imageUrl, "/assets/product-placeholder/gspot_insertable.png");
  assert.equal(patch.typeCode, "bdsm");
  assert.equal(patch.subtypeCode, "fetish_accessory");
  assert.deepEqual(patch.productTags, ["幻想造型"]);
  assert.ok(
    Array.isArray(patch.recommendationFeatures.evidence) &&
      patch.recommendationFeatures.evidence.some(
        (item: any) => item.signal === "accessory" && item.source === "structured",
      ),
  );
});

test("shouldRunKumocoomFemaleRefreshScript only matches direct execution", () => {
  assert.equal(
    shouldRunKumocoomFemaleRefreshScript(
      "file:///tmp/refresh-kumocoom-female-products-from-official.ts",
      "/tmp/refresh-kumocoom-female-products-from-official.ts",
    ),
    true,
  );
  assert.equal(
    shouldRunKumocoomFemaleRefreshScript(
      "file:///tmp/refresh-kumocoom-female-products-from-official.ts",
      "/tmp/other.ts",
    ),
    false,
  );
  assert.equal(shouldRunKumocoomFemaleRefreshScript("file:///tmp/refresh-kumocoom-female-products-from-official.ts"), false);
});
