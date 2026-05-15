import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizePlaceholderRawDescription,
  PLACEHOLDER_RAW_DESCRIPTION_VALUES,
  shouldRunNullPlaceholderRawDescriptionScript,
} from "./backfill-null-placeholder-raw-description.ts";

test("normalizePlaceholderRawDescription turns known placeholders into null", () => {
  for (const value of PLACEHOLDER_RAW_DESCRIPTION_VALUES) {
    assert.equal(normalizePlaceholderRawDescription(value), null);
    assert.equal(normalizePlaceholderRawDescription(` ${value} `), null);
  }
});

test("normalizePlaceholderRawDescription keeps real descriptions intact", () => {
  assert.equal(
    normalizePlaceholderRawDescription("参数信息完整，支持低噪运行"),
    "参数信息完整，支持低噪运行",
  );
  assert.equal(normalizePlaceholderRawDescription(""), null);
  assert.equal(normalizePlaceholderRawDescription(null), null);
});

test("shouldRunNullPlaceholderRawDescriptionScript only matches direct execution", () => {
  assert.equal(
    shouldRunNullPlaceholderRawDescriptionScript(
      "file:///tmp/script.ts",
      "/tmp/script.ts",
    ),
    true,
  );
  assert.equal(
    shouldRunNullPlaceholderRawDescriptionScript(
      "file:///tmp/script.ts",
      "/tmp/other.ts",
    ),
    false,
  );
  assert.equal(
    shouldRunNullPlaceholderRawDescriptionScript("file:///tmp/script.ts"),
    false,
  );
});
