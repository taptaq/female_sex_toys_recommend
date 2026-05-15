import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeDuplicateRowGroup,
  partitionDuplicateNameRows,
  resolveRecommenderToyGender,
  selectPrimaryDuplicateRow,
  type GenderDedupeRow,
} from "./backfill-item-gender-and-dedupe.ts";

function makeRow(
  overrides: Partial<GenderDedupeRow> & Pick<GenderDedupeRow, "id" | "name">,
): GenderDedupeRow {
  return {
    id: overrides.id,
    name: overrides.name,
    original_id: overrides.original_id ?? null,
    price: overrides.price ?? null,
    max_db: overrides.max_db ?? null,
    waterproof: overrides.waterproof ?? null,
    appearance: overrides.appearance ?? null,
    physical_form: overrides.physical_form ?? null,
    motor_type: overrides.motor_type ?? null,
    gender: overrides.gender ?? null,
    brand: overrides.brand ?? null,
    material: overrides.material ?? null,
    image_url: overrides.image_url ?? null,
    created_at: overrides.created_at ?? null,
    updated_at: overrides.updated_at ?? null,
    raw_description: overrides.raw_description ?? null,
    safe_display_name: overrides.safe_display_name ?? null,
    type_code: overrides.type_code ?? null,
    subtype_code: overrides.subtype_code ?? null,
    product_tags: overrides.product_tags ?? [],
    product_raw_description: overrides.product_raw_description ?? null,
  };
}

test("resolveRecommenderToyGender upgrades obvious female-target rows that were mislabeled male", () => {
  assert.equal(
    resolveRecommenderToyGender(
      makeRow({
        id: "toy-f-1",
        name: "kisstoy tina三代秒潮神器 玩具 用品女性 器入体",
        brand: "KISSTOY",
        gender: "male",
        physical_form: "internal",
        type_code: "suction",
        subtype_code: "suction_dual",
      }),
    ),
    "female",
  );
});

test("resolveRecommenderToyGender upgrades male-only prostate rows that were mislabeled female", () => {
  assert.equal(
    resolveRecommenderToyGender(
      makeRow({
        id: "toy-m-1",
        name: "BILLY 2",
        brand: "LELO",
        gender: "female",
        type_code: "prostate",
        subtype_code: "prostate_vibe",
        raw_description: "前列腺按摩与男性后庭探索设计",
      }),
    ),
    "male",
  );
});

test("resolveRecommenderToyGender uses strong male-brand fallback for ambiguous Arcwave air-stimulator rows", () => {
  assert.equal(
    resolveRecommenderToyGender(
      makeRow({
        id: "toy-m-2",
        name: "Arcwave Ion 2",
        brand: "Arcwave",
        gender: "unisex",
        type_code: "suction",
        subtype_code: "suction_pure",
      }),
    ),
    "male",
  );
});

test("partitionDuplicateNameRows avoids collapsing same-name rows across different brands", () => {
  const buckets = partitionDuplicateNameRows([
    makeRow({
      id: "dup-1",
      name: "Vibe",
      brand: "MAUDE",
      gender: "female",
    }),
    makeRow({
      id: "dup-2",
      name: "Vibe",
      brand: "Womanizer",
      gender: "female",
    }),
  ]);

  assert.equal(buckets.length, 2);
  assert.deepEqual(
    buckets.map((bucket) => bucket.map((row) => row.id)),
    [["dup-1"], ["dup-2"]],
  );
});

test("mergeDuplicateRowGroup keeps the richest same-brand row and absorbs missing fields from weaker duplicates", () => {
  const richer = makeRow({
    id: "keep-1",
    name: "Calor",
    brand: "Lovense",
    gender: "male",
    original_id: "prod-a",
    type_code: "masturbator",
    subtype_code: "interactive_masturbator",
    raw_description: "电动互动杯，支持应用联动和加热。",
    image_url: "https://cdn.example.com/calor-rich.jpg",
    updated_at: "2026-05-07T05:30:28.062Z",
  });
  const weaker = makeRow({
    id: "drop-1",
    name: "Calor",
    brand: "Lovense",
    gender: "male",
    original_id: "prod-b",
    type_code: "dual_stimulation",
    subtype_code: null,
    raw_description: null,
    image_url: "https://cdn.example.com/calor-weak.jpg",
    material: "硅胶",
    updated_at: "2026-05-07T05:21:07.488Z",
  });

  assert.equal(selectPrimaryDuplicateRow([weaker, richer]).id, "keep-1");

  const merged = mergeDuplicateRowGroup([weaker, richer]);

  assert.equal(merged.keeper.id, "keep-1");
  assert.deepEqual(merged.deleteIds, ["drop-1"]);
  assert.equal(merged.merged.material, "硅胶");
  assert.equal(merged.merged.type_code, "masturbator");
  assert.equal(merged.merged.subtype_code, "interactive_masturbator");
  assert.equal(
    merged.merged.raw_description,
    "电动互动杯，支持应用联动和加热。",
  );
});
