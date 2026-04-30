import test from "node:test";
import assert from "node:assert/strict";
import type { RankedProduct } from "./app-shell.ts";
import { buildResultComparisonRows } from "./result-comparison.ts";

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
