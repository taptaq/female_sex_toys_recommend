import assert from "node:assert/strict";
import test from "node:test";

import {
  ALL_SELECTABLE_LIBRARY_TYPE_CODES,
  GENDER_TO_TYPES,
  getAllowedLibraryTypeCodes,
  getLibraryTypeLabel,
  SELECTABLE_TYPE_LABELS,
  sanitizeLibraryTypeSelection,
  TYPE_LABELS,
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

test("getAllowedLibraryTypeCodes excludes unknown from all and returns a copy", () => {
  const allowed = getAllowedLibraryTypeCodes("all");
  assert.deepEqual(allowed, [
    "suction",
    "external_vibe",
    "insertable",
    "dual_stimulation",
    "masturbator",
    "prostate",
    "cock_ring",
    "couples",
    "wearable_remote",
  ]);

  allowed.push("suction");

  assert.deepEqual(getAllowedLibraryTypeCodes("all"), [
    "suction",
    "external_vibe",
    "insertable",
    "dual_stimulation",
    "masturbator",
    "prostate",
    "cock_ring",
    "couples",
    "wearable_remote",
  ]);
});

test("exported metadata stays frozen for shared consumers", () => {
  assert.equal(Object.isFrozen(SELECTABLE_TYPE_LABELS), true);
  assert.equal(Object.isFrozen(GENDER_TO_TYPES), true);
  assert.equal(Object.isFrozen(TYPE_LABELS), true);
  assert.equal(Object.isFrozen(ALL_SELECTABLE_LIBRARY_TYPE_CODES), true);
});

test("getAllowedLibraryTypeCodes keeps female and unisex routes distinct", () => {
  assert.deepEqual(getAllowedLibraryTypeCodes("female"), [
    "suction",
    "external_vibe",
    "insertable",
    "dual_stimulation",
  ]);
  assert.deepEqual(getAllowedLibraryTypeCodes("unisex"), [
    "couples",
    "wearable_remote",
  ]);
});

test("gender-specific groups partition all selectable type codes without duplicates", () => {
  const grouped = [
    ...GENDER_TO_TYPES.female,
    ...GENDER_TO_TYPES.male,
    ...GENDER_TO_TYPES.unisex,
  ];

  assert.deepEqual(
    [...new Set(grouped)].sort(),
    [...ALL_SELECTABLE_LIBRARY_TYPE_CODES].sort(),
  );
  assert.equal(grouped.length, ALL_SELECTABLE_LIBRARY_TYPE_CODES.length);
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
