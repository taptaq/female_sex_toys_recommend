import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeRecommenderRows,
  type RecommenderMergeRow,
} from "./merge-recommender-items-into-toys.ts";

function makeToyRow(overrides: Partial<RecommenderMergeRow> = {}): RecommenderMergeRow {
  return {
    id: "toy-1",
    original_id: "product-1",
    name: "Alpha",
    safe_display_name: "Alpha",
    price: "199.00",
    max_db: 42,
    waterproof: 7,
    appearance: "normal",
    physical_form: "external",
    motor_type: "gentle",
    gender: "female",
    brand: "Brand A",
    material: "硅胶",
    image_url: null,
    raw_description: "old desc",
    type_code: null,
    ...overrides,
  };
}

test("mergeRecommenderRows preserves non-empty recommender_toys fields", () => {
  const toys = [makeToyRow()];
  const items = [
    makeToyRow({
      id: "item-1",
      safe_display_name: "New Alpha",
      raw_description: "new desc",
      type_code: "suction",
    }),
  ];

  const result = mergeRecommenderRows({ toys, items });

  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]?.safe_display_name, "Alpha");
  assert.equal(result.rows[0]?.raw_description, "old desc");
  assert.equal(result.rows[0]?.type_code, "suction");
});

test("mergeRecommenderRows backfills blank recommender_toys fields from recommender_items", () => {
  const toys = [
    makeToyRow({
      safe_display_name: "",
      raw_description: null,
      type_code: null,
    }),
  ];
  const items = [
    makeToyRow({
      id: "item-1",
      safe_display_name: "Alpha Safe",
      raw_description: "new desc",
      type_code: "suction",
    }),
  ];

  const result = mergeRecommenderRows({ toys, items });
  const merged = result.rows[0];

  assert.equal(merged?.safe_display_name, "Alpha Safe");
  assert.equal(merged?.raw_description, "new desc");
  assert.equal(merged?.type_code, "suction");
});

test("mergeRecommenderRows falls back to name plus brand matching", () => {
  const toys = [
    makeToyRow({
      id: "toy-2",
      original_id: null,
      name: "Bravo",
      brand: "Brand B",
      safe_display_name: "",
    }),
  ];
  const items = [
    makeToyRow({
      id: "item-2",
      original_id: null,
      name: "Bravo",
      brand: "Brand B",
      safe_display_name: "Bravo Safe",
    }),
  ];

  const result = mergeRecommenderRows({ toys, items });

  assert.equal(result.summary.matchedByNameBrand, 1);
  assert.equal(result.rows[0]?.safe_display_name, "Bravo Safe");
});

test("mergeRecommenderRows inserts unmatched recommender_items rows", () => {
  const toys = [makeToyRow()];
  const items = [
    makeToyRow({
      id: "item-3",
      original_id: "product-3",
      name: "Charlie",
      brand: "Brand C",
    }),
  ];

  const result = mergeRecommenderRows({ toys, items });

  assert.equal(result.summary.inserted, 1);
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[1]?.name, "Charlie");
});
