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

const getAnyLibrarySubtypeLabel = getLibrarySubtypeLabel as (subtypeCode: string) => string;

test("getLibraryTypeLabel returns user-facing labels", () => {
  assert.equal(getLibraryTypeLabel("suction"), "吮吸类");
  assert.equal(getLibraryTypeLabel("masturbator"), "飞机杯");
  assert.equal(getLibraryTypeLabel("wearable_remote"), "远控穿戴");
  assert.equal(getLibraryTypeLabel("care_accessory"), "护理与周边");
  assert.equal(getLibraryTypeLabel("unknown"), "其他");
});

test("getLibrarySubtypeLabel returns user-facing subtype labels", () => {
  assert.equal(getLibrarySubtypeLabel("suction_dual"), "吮吸双刺激");
  assert.equal(getLibrarySubtypeLabel("rabbit_dual"), "兔耳双刺激");
  assert.equal(getLibrarySubtypeLabel("wand_massager"), "魔杖按摩");
  assert.equal(getAnyLibrarySubtypeLabel("interactive_masturbator"), "互动杯");
  assert.equal(getAnyLibrarySubtypeLabel("dual_wearable_remote"), "双人远控");
  assert.equal(getAnyLibrarySubtypeLabel("lube_care"), "润滑护理");
  assert.equal(getAnyLibrarySubtypeLabel("condom"), "避孕套");
  assert.equal(getAnyLibrarySubtypeLabel("lingerie"), "内衣服饰");
});

test("getAllowedLibraryTypeCodes hides female-only categories from male selection", () => {
  assert.deepEqual(getAllowedLibraryTypeCodes("male"), [
    "masturbator",
    "prostate",
    "cock_ring",
    "care_accessory",
    "unknown",
  ]);
  assert.equal(getAllowedLibraryTypeCodes("male").includes("suction"), false);
  assert.equal(getAllowedLibraryTypeCodes("female").includes("care_accessory"), true);
  assert.equal(getAllowedLibraryTypeCodes("female").includes("wearable_remote"), true);
  assert.equal(getAllowedLibraryTypeCodes("unisex").includes("care_accessory"), true);
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
    getAllowedLibrarySubtypeCodes("male", "masturbator"),
    ["manual_masturbator", "vibrating_masturbator", "interactive_masturbator"],
  );
  assert.deepEqual(
    getAllowedLibrarySubtypeCodes("female", "wearable_remote"),
    ["panty_wearable", "insertable_remote", "dual_wearable_remote"],
  );
  assert.deepEqual(
    getAllowedLibrarySubtypeCodes("unisex", "wearable_remote"),
    ["panty_wearable", "insertable_remote", "dual_wearable_remote"],
  );
  assert.deepEqual(
    getAllowedLibrarySubtypeCodes("all", "care_accessory"),
    ["lube_care", "condom", "lingerie"],
  );
  assert.deepEqual(
    getAllowedLibrarySubtypeCodes("female", "all"),
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
  assert.equal(
    sanitizeLibrarySubtypeSelection("condom", "male", "care_accessory"),
    "condom",
  );
  assert.equal(
    sanitizeLibrarySubtypeSelection("condom", "male", "masturbator"),
    "all",
  );
});
