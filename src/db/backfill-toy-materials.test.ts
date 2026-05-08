import assert from "node:assert/strict";
import test from "node:test";

import { normalizeRecommenderToyMaterial } from "./backfill-toy-materials.ts";

test("normalizeRecommenderToyMaterial maps known traditional-silicone aliases to 硅胶", () => {
  assert.equal(normalizeRecommenderToyMaterial("超柔軟矽膠"), "硅胶");
  assert.equal(normalizeRecommenderToyMaterial("  超柔軟矽膠  "), "硅胶");
});

test("normalizeRecommenderToyMaterial preserves other materials and nullish values", () => {
  assert.equal(normalizeRecommenderToyMaterial("ABS塑料"), "ABS塑料");
  assert.equal(normalizeRecommenderToyMaterial("硅胶"), "硅胶");
  assert.equal(normalizeRecommenderToyMaterial(""), null);
  assert.equal(normalizeRecommenderToyMaterial(null), null);
  assert.equal(normalizeRecommenderToyMaterial(undefined), null);
});
