import assert from "node:assert/strict";
import test from "node:test";

import { classifyLibraryTypeCode } from "./library-product-type-classifier.ts";

test("classifyLibraryTypeCode recognizes suction products from external female signals", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "female",
      physicalForm: "external",
      name: "Womanizer Liberty",
      rawDescription: "气脉冲吸感，外部刺激设备",
      tags: [],
    }),
    "suction",
  );
});

test("classifyLibraryTypeCode recognizes prostate products from male text signals", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "male",
      physicalForm: "internal",
      name: "前列腺按摩器",
      rawDescription: "P-spot 定向刺激",
      tags: [],
    }),
    "prostate",
  );
});

test("classifyLibraryTypeCode recognizes unisex remote wearable products", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "unisex",
      physicalForm: "external",
      name: "情侣远控穿戴器",
      rawDescription: "双人共玩，app 远程控制，可穿戴",
      tags: ["情侣", "远控"],
    }),
    "wearable_remote",
  );
});

test("classifyLibraryTypeCode falls back to unknown when signals are too weak", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "unisex",
      physicalForm: null,
      name: "探索系列",
      rawDescription: null,
      tags: [],
    }),
    "unknown",
  );
});
