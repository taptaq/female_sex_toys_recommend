import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTypeCodeSignals,
  chunkTypeCodeUpdates,
  classifySubtypeCodeBackfillRow,
  collectUniqueOriginalIds,
  classifyTypeCodeBackfillRow,
  hydrateTypeCodeBackfillRows,
  shouldRunTypeCodeBackfillScript,
} from "./backfill-item-type-code.ts";

test("buildTypeCodeSignals combines toy and product text sources", () => {
  const signals = buildTypeCodeSignals({
    id: "toy-1",
    name: "Quiet One",
    gender: "unisex",
    physical_form: "external",
    raw_description: null,
    product_tags: ["情侣", "远控"],
    product_raw_description: "可穿戴设计，适合双人共玩",
  });

  assert.match(signals.rawDescription ?? "", /可穿戴设计/);
  assert.deepEqual(signals.tags, ["情侣", "远控"]);
});

test("classifyTypeCodeBackfillRow uses joined product metadata to detect wearable remote", () => {
  assert.equal(
    classifyTypeCodeBackfillRow({
      id: "toy-2",
      name: "Silent Link",
      gender: "unisex",
      physical_form: "external",
      raw_description: null,
      product_tags: ["远控"],
      product_raw_description: "轻薄可穿戴，适合情侣双人互动",
    }),
    "wearable_remote",
  );
});

test("classifyTypeCodeBackfillRow keeps unmatched rows as unknown", () => {
  assert.equal(
    classifyTypeCodeBackfillRow({
      id: "toy-3",
      name: "Series One",
      gender: "female",
      physical_form: null,
      raw_description: null,
      product_tags: [],
      product_raw_description: null,
    }),
    "unknown",
  );
});

test("classifySubtypeCodeBackfillRow derives subtype codes from joined female product signals", () => {
  assert.equal(
    classifySubtypeCodeBackfillRow({
      id: "toy-sub-1",
      name: "Hyphy 双头振动器",
      gender: "female",
      physical_form: "external",
      raw_description: "适用于阴蒂、G点及乳头的双头高频振动器",
      product_tags: ["阴蒂刺激", "G点刺激", "双头高频"],
      product_raw_description: null,
    }),
    "multi_head_dual",
  );
});

test("shouldRunTypeCodeBackfillScript handles tsx file URLs with spaces safely", () => {
  assert.equal(
    shouldRunTypeCodeBackfillScript(
      "file:///Users/test/My%20Project/src/db/backfill-item-type-code.ts",
      "/Users/test/My Project/src/db/backfill-item-type-code.ts",
    ),
    true,
  );
});

test("chunkTypeCodeUpdates splits large updates into stable batches", () => {
  const updates = Array.from({ length: 450 }, (_, index) => ({
    id: `toy-${index + 1}`,
    typeCode: "unknown",
  }));

  assert.deepEqual(
    chunkTypeCodeUpdates(updates, 200).map((batch) => batch.length),
    [200, 200, 50],
  );
});

test("hydrateTypeCodeBackfillRows merges product metadata by original_id", () => {
  assert.deepEqual(
    hydrateTypeCodeBackfillRows(
      [
        {
          id: "toy-1",
          original_id: "product-1",
          name: "Link One",
          gender: "unisex",
          physical_form: "external",
          raw_description: null,
          current_type_code: null,
          current_subtype_code: null,
        },
      ],
      new Map([
        [
          "product-1",
          {
            id: "product-1",
            product_tags: ["远控"],
            product_raw_description: "可穿戴设计",
          },
        ],
      ]),
    ),
    [
      {
        id: "toy-1",
        name: "Link One",
        gender: "unisex",
        physical_form: "external",
        raw_description: null,
        current_type_code: null,
        current_subtype_code: null,
        product_tags: ["远控"],
        product_raw_description: "可穿戴设计",
      },
    ],
  );
});

test("collectUniqueOriginalIds deduplicates non-empty original ids", () => {
  assert.deepEqual(
    collectUniqueOriginalIds([
      {
        id: "toy-1",
        original_id: "product-1",
        name: "A",
        gender: "female",
        physical_form: "external",
        raw_description: null,
        current_type_code: null,
        current_subtype_code: null,
      },
      {
        id: "toy-2",
        original_id: "product-1",
        name: "B",
        gender: "female",
        physical_form: "external",
        raw_description: null,
        current_type_code: null,
        current_subtype_code: null,
      },
      {
        id: "toy-3",
        original_id: null,
        name: "C",
        gender: "female",
        physical_form: "external",
        raw_description: null,
        current_type_code: null,
        current_subtype_code: null,
      },
    ]),
    ["product-1"],
  );
});
