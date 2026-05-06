import assert from "node:assert/strict";
import test from "node:test";

import {
  getAllowedLibraryTypeCodes,
  getAllowedLibrarySubtypeCodes,
  getLibrarySubtypeLabel,
  getLibraryTypeLabel,
  sanitizeLibrarySubtypeSelection,
  sanitizeLibraryTypeSelection,
} from "./library-product-types.ts";

test("getLibraryTypeLabel returns user-facing labels", () => {
  assert.equal(getLibraryTypeLabel("suction"), "吮吸类");
  assert.equal(getLibraryTypeLabel("masturbator"), "飞机杯");
  assert.equal(getLibraryTypeLabel("wearable_remote"), "远控穿戴");
  assert.equal(getLibraryTypeLabel("unknown"), "其他");
});

test("getLibrarySubtypeLabel returns user-facing subtype labels", () => {
  assert.equal(getLibrarySubtypeLabel("suction_dual"), "吮吸双刺激");
  assert.equal(getLibrarySubtypeLabel("rabbit_dual"), "兔耳双刺激");
  assert.equal(getLibrarySubtypeLabel("wand_massager"), "魔杖按摩");
});

test("getAllowedLibraryTypeCodes hides female-only categories from male selection", () => {
  assert.deepEqual(getAllowedLibraryTypeCodes("male"), [
    "masturbator",
    "prostate",
    "cock_ring",
    "unknown",
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
    "unknown",
  );
});

test("getAllowedLibrarySubtypeCodes only returns subtypes for supported parent types", () => {
  assert.deepEqual(
    getAllowedLibrarySubtypeCodes("female", "dual_stimulation"),
    ["suction_dual", "rabbit_dual", "multi_head_dual"],
  );
  assert.deepEqual(
    getAllowedLibrarySubtypeCodes("female", "all"),
    [],
  );
  assert.deepEqual(
    getAllowedLibrarySubtypeCodes("male", "masturbator"),
    [],
  );
});

test("sanitizeLibrarySubtypeSelection resets invalid subtype choices to all", () => {
  assert.equal(
    sanitizeLibrarySubtypeSelection("rabbit_dual", "female", "dual_stimulation"),
    "rabbit_dual",
  );
  assert.equal(
    sanitizeLibrarySubtypeSelection("rabbit_dual", "female", "suction"),
    "all",
  );
  assert.equal(
    sanitizeLibrarySubtypeSelection("wand_massager", "male", "external_vibe"),
    "all",
  );
});
