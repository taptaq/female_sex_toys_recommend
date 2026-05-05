import assert from "node:assert/strict";
import test from "node:test";

import {
  getAllowedLibraryTypeCodes,
  getLibraryTypeLabel,
  sanitizeLibraryTypeSelection,
} from "./library-product-types.ts";

test("getLibraryTypeLabel returns user-facing labels", () => {
  assert.equal(getLibraryTypeLabel("suction"), "吮吸类");
  assert.equal(getLibraryTypeLabel("masturbator"), "飞机杯");
  assert.equal(getLibraryTypeLabel("wearable_remote"), "远控穿戴");
});

test("getAllowedLibraryTypeCodes hides female-only categories from male selection", () => {
  assert.deepEqual(getAllowedLibraryTypeCodes("male"), [
    "masturbator",
    "prostate",
    "cock_ring",
  ]);
  assert.equal(getAllowedLibraryTypeCodes("male").includes("suction"), false);
});

test("sanitizeLibraryTypeSelection resets invalid type choices to all", () => {
  assert.equal(
    sanitizeLibraryTypeSelection("suction", "male"),
    "all",
  );
  assert.equal(
    sanitizeLibraryTypeSelection("masturbator", "male"),
    "masturbator",
  );
  assert.equal(
    sanitizeLibraryTypeSelection("unknown", "all"),
    "all",
  );
});
