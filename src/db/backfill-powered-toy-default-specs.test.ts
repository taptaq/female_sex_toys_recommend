import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPoweredToySignalText,
  buildPoweredToySpecPatch,
  isPoweredToyCandidate,
  shouldRunPoweredToyDefaultSpecsScript,
} from "./backfill-powered-toy-default-specs.ts";

test("buildPoweredToySignalText combines toy and product sources", () => {
  const text = buildPoweredToySignalText({
    id: "toy-1",
    original_id: "product-1",
    name: "Quiet App-Controlled Vibrator",
    type_code: "external_vibe",
    raw_description: "支持 APP 控制，静音震动",
    max_db: null,
    waterproof: null,
    product_tags: ["防水", "可充电"],
    product_raw_description: "Rechargeable waterproof vibrator with whisper quiet motor.",
  });

  assert.match(text, /app/i);
  assert.match(text, /Rechargeable waterproof/i);
  assert.match(text, /静音震动/);
});

test("isPoweredToyCandidate accepts toy rows with powered signals", () => {
  assert.equal(
    isPoweredToyCandidate({
      id: "toy-2",
      original_id: "product-2",
      name: "Rechargeable Clitoral Stimulator",
      type_code: "suction",
      raw_description: "Rechargeable suction toy with waterproof body.",
      max_db: null,
      waterproof: null,
      product_tags: [],
      product_raw_description: null,
    }),
    true,
  );
});

test("isPoweredToyCandidate rejects non-toy and non-powered rows", () => {
  assert.equal(
    isPoweredToyCandidate({
      id: "toy-3",
      original_id: "product-3",
      name: "Water-Based Lubricant",
      type_code: "care_accessory",
      raw_description: "Water-based lube.",
      max_db: null,
      waterproof: null,
      product_tags: [],
      product_raw_description: null,
    }),
    false,
  );

  assert.equal(
    isPoweredToyCandidate({
      id: "toy-4",
      original_id: "product-4",
      name: "Glass Dildo",
      type_code: "insertable",
      raw_description: "Handmade glass toy without motor or battery.",
      max_db: null,
      waterproof: null,
      product_tags: [],
      product_raw_description: null,
    }),
    false,
  );

  assert.equal(
    isPoweredToyCandidate({
      id: "toy-4b",
      original_id: "product-4b",
      name: "Stainless Steel 3 Ring Set",
      type_code: "cock_ring",
      raw_description: "Manual stainless steel rings with no motor.",
      max_db: 50,
      waterproof: null,
      product_tags: [],
      product_raw_description: null,
    }),
    false,
  );
});

test("isPoweredToyCandidate accepts vibrating cock rings but not classic rings", () => {
  assert.equal(
    isPoweredToyCandidate({
      id: "toy-ring-powered",
      original_id: "product-ring-powered",
      name: "Magic Dante Ⅱ",
      type_code: "cock_ring",
      raw_description: "智能可穿戴阴茎环，10种手动模式震动模式，app control.",
      max_db: null,
      waterproof: null,
      product_tags: [],
      product_raw_description: null,
    }),
    true,
  );

  assert.equal(
    isPoweredToyCandidate({
      id: "toy-ring-tag-noise",
      original_id: "product-ring-tag-noise",
      name: "Lovehoney Black Mega Boost Double Stamina Ring",
      type_code: "cock_ring",
      raw_description: "双倍耐力环，提供紧密贴合，没有震动、马达或充电说明。",
      max_db: null,
      waterproof: null,
      product_tags: ["可充电"],
      product_raw_description: null,
    }),
    false,
  );
});

test("isPoweredToyCandidate rejects manual masturbators with incidental app text", () => {
  assert.equal(
    isPoweredToyCandidate({
      id: "manual-stroker",
      original_id: "manual-stroker-product",
      name: "Fleshlight Riley Reid Utopia Texture",
      type_code: "masturbator",
      raw_description: "手动仿真阴道。页面模板包含 APP支持: 是。",
      max_db: null,
      waterproof: null,
      product_tags: [],
      product_raw_description: null,
    }),
    false,
  );
});

test("isPoweredToyCandidate rejects non-powered insertables with incidental charging text", () => {
  assert.equal(
    isPoweredToyCandidate({
      id: "steel-wand",
      original_id: "steel-wand-product",
      name: "njoy Pure Wand Stainless Steel",
      type_code: "insertable",
      raw_description: "不锈钢双头按摩棒。页面附近包含其他商品的充电信息。",
      max_db: null,
      waterproof: null,
      product_tags: [],
      product_raw_description: null,
    }),
    false,
  );
});

test("buildPoweredToySpecPatch fills only missing defaults", () => {
  assert.deepEqual(
    buildPoweredToySpecPatch({
      id: "toy-5",
      original_id: "product-5",
      name: "Bullet Vibrator",
      type_code: "external_vibe",
      raw_description: "Quiet rechargeable bullet vibrator.",
      max_db: null,
      waterproof: 8,
      product_tags: [],
      product_raw_description: null,
    }),
    {
      max_db: 50,
      waterproof: null,
    },
  );

  assert.deepEqual(
    buildPoweredToySpecPatch({
      id: "toy-6",
      original_id: "product-6",
      name: "App-Controlled Egg",
      type_code: "wearable_remote",
      raw_description: "App-controlled rechargeable egg.",
      max_db: null,
      waterproof: null,
      product_tags: [],
      product_raw_description: null,
    }),
    {
      max_db: 50,
      waterproof: 7,
    },
  );
});

test("shouldRunPoweredToyDefaultSpecsScript matches direct execution only", () => {
  assert.equal(
    shouldRunPoweredToyDefaultSpecsScript("file:///tmp/script.ts", "/tmp/script.ts"),
    true,
  );
  assert.equal(
    shouldRunPoweredToyDefaultSpecsScript("file:///tmp/script.ts", "/tmp/other.ts"),
    false,
  );
  assert.equal(shouldRunPoweredToyDefaultSpecsScript("file:///tmp/script.ts"), false);
});
