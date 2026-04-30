import test from "node:test";
import assert from "node:assert/strict";
import type { RankedProduct } from "./app-shell.ts";
import {
  buildResultComparisonRows,
  buildResultComparisonTeaser,
} from "./result-comparison.ts";

function makeProduct(overrides: Partial<RankedProduct>): RankedProduct {
  return {
    id: "p",
    name: "Test Product",
    price: 199,
    score: 88,
    maxDb: 42,
    waterproof: 7,
    appearance: "high_disguise",
    physicalForm: "external",
    motorType: "gentle",
    gender: "female",
    brand: "Brand",
    material: "Silicone",
    imagePlaceholder: "",
    tags: [],
    ...overrides,
  };
}

test("buildResultComparisonRows summarizes the top three decision dimensions", () => {
  const rows = buildResultComparisonRows([
    makeProduct({ id: "p1", price: 299 }),
    makeProduct({
      id: "p2",
      price: 129,
      maxDb: null,
      waterproof: null,
      physicalForm: "internal",
      motorType: "strong",
      appearance: "normal",
    }),
    makeProduct({
      id: "p3",
      price: 399,
      physicalForm: "composite",
      motorType: "strong",
      waterproof: 7,
    }),
  ]);

  assert.deepEqual(
    rows.map((row) => row.label),
    ["价格", "静音", "防水", "刺激路线", "新手友好", "隐蔽性"],
  );
  assert.deepEqual(rows[0].values, ["¥299", "¥129", "¥399"]);
  assert.deepEqual(rows[1].values, ["< 42dB", "缺失", "< 42dB"]);
  assert.deepEqual(rows[3].values, ["外部刺激", "入体体验", "复合刺激"]);
  assert.deepEqual(rows[4].values, ["更友好", "需适应", "好打理"]);
});

test("buildResultComparisonTeaser summarizes hidden comparison dimensions", () => {
  const rows = buildResultComparisonRows([
    makeProduct({ id: "p1", price: 299 }),
    makeProduct({ id: "p2", price: 129 }),
    makeProduct({ id: "p3", price: 399 }),
  ]);

  const teaser = buildResultComparisonTeaser(rows, 3);

  assert.equal(teaser.countText, "3 款推荐对比");
  assert.equal(teaser.dimensionText, "价格 / 静音 / 防水等");
});

test("buildResultComparisonTeaser handles empty comparison rows", () => {
  const teaser = buildResultComparisonTeaser([], 0);

  assert.equal(teaser.countText, "暂无对比");
  assert.equal(teaser.dimensionText, "先看主推荐即可");
});
