import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBdsmReclassifyInput,
  classifyBdsmReclassifyRow,
  shouldIncludeBdsmReclassifyRow,
  shouldRunBdsmReclassifyScript,
} from "./backfill-bdsm-reclassify.ts";

test("buildBdsmReclassifyInput joins toy and product descriptions with tags", () => {
  const input = buildBdsmReclassifyInput({
    id: "row-1",
    name: "Leather Wrist Cuffs",
    gender: "unisex",
    physical_form: "external",
    current_type_code: "bdsm",
    current_subtype_code: "bondage_restraint",
    raw_description: "toy-level bdsm copy",
    product_tags: ["bondage", "restraint"],
    product_raw_description: "product-level copy",
  });

  assert.match(input.rawDescription ?? "", /toy-level bdsm copy/);
  assert.match(input.rawDescription ?? "", /product-level copy/);
  assert.deepEqual(input.tags, ["bondage", "restraint"]);
});

test("classifyBdsmReclassifyRow keeps true bdsm rows in bdsm", () => {
  const result = classifyBdsmReclassifyRow({
    id: "row-2",
    name: "Leather Wrist Cuffs",
    gender: "unisex",
    physical_form: "external",
    current_type_code: "bdsm",
    current_subtype_code: "bondage_restraint",
    raw_description: "adjustable bondage restraint cuffs for roleplay",
    product_tags: ["bondage", "restraint"],
    product_raw_description: null,
  });

  assert.equal(result.typeCode, "bdsm");
  assert.equal(result.subtypeCode, "bondage_restraint");
});

test("classifyBdsmReclassifyRow demotes sensory false positives out of bdsm", () => {
  const result = classifyBdsmReclassifyRow({
    id: "row-3",
    name: "Satisfyer Partner Box 3",
    gender: "unisex",
    physical_form: "external",
    current_type_code: "bdsm",
    current_subtype_code: "sensory_play",
    raw_description: "在您的爱爱中享受感官的多样性 - 使用满足者伴侣套装！",
    product_tags: ["情侣适用", "app"],
    product_raw_description: "情侣适用，外部刺激，亲肤材质",
  });

  assert.equal(result.typeCode, "couples");
  assert.equal(result.subtypeCode, "external_couples");
});

test("shouldIncludeBdsmReclassifyRow includes current bdsm rows", () => {
  assert.equal(
    shouldIncludeBdsmReclassifyRow({
      id: "row-4",
      name: "Leather Wrist Cuffs",
      gender: "unisex",
      physical_form: "external",
      current_type_code: "bdsm",
      current_subtype_code: "bondage_restraint",
      raw_description: null,
      product_tags: [],
      product_raw_description: null,
    }),
    true,
  );
});

test("shouldIncludeBdsmReclassifyRow includes strong nipple clamp devices even when not currently bdsm", () => {
  assert.equal(
    shouldIncludeBdsmReclassifyRow({
      id: "row-5",
      name: "NAVE",
      gender: "unisex",
      physical_form: "external",
      current_type_code: "couples",
      current_subtype_code: "external_couples",
      raw_description: "NAVE Vibrating Nipple Clamps 无线乳夹按摩器",
      product_tags: ["乳夹按摩器"],
      product_raw_description: null,
    }),
    true,
  );
});

test("shouldIncludeBdsmReclassifyRow skips unrelated rows", () => {
  assert.equal(
    shouldIncludeBdsmReclassifyRow({
      id: "row-6",
      name: "Heat Flex 4",
      gender: "female",
      physical_form: "external",
      current_type_code: "external_vibe",
      current_subtype_code: "wand_massager",
      raw_description: "感官兔子震动棒，阴蒂刺激，亲肤材质",
      product_tags: ["女性", "阴蒂", "rabbit"],
      product_raw_description: null,
    }),
    false,
  );
});

test("shouldRunBdsmReclassifyScript only matches direct execution", () => {
  assert.equal(
    shouldRunBdsmReclassifyScript("file:///tmp/backfill-bdsm-reclassify.ts", "/tmp/backfill-bdsm-reclassify.ts"),
    true,
  );
  assert.equal(
    shouldRunBdsmReclassifyScript("file:///tmp/backfill-bdsm-reclassify.ts", "/tmp/other.ts"),
    false,
  );
  assert.equal(shouldRunBdsmReclassifyScript("file:///tmp/backfill-bdsm-reclassify.ts"), false);
});
