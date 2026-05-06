import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSafeDisplayName,
  getProductDisplayName,
} from "./product-display-name.ts";

test("getProductDisplayName prefers explicit displayName when present", () => {
  assert.equal(
    getProductDisplayName({
      name: "原始产品名",
      safeDisplayName: "安全展示名",
      displayName: "最终展示名",
    }),
    "最终展示名",
  );
});

test("getProductDisplayName falls back to safeDisplayName before generating one from raw name", () => {
  assert.equal(
    getProductDisplayName({
      name: "原始产品名",
      safeDisplayName: "安全展示名",
    }),
    "安全展示名",
  );
  assert.equal(
    getProductDisplayName({
      name: "情趣用品 套装",
    }),
    buildSafeDisplayName("情趣用品 套装"),
  );
});
