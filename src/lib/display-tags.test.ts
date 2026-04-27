import test from "node:test";
import assert from "node:assert/strict";
import { dedupeDisplayTags } from "./display-tags.ts";

test("dedupeDisplayTags preserves order while removing duplicates", () => {
  assert.deepEqual(
    dedupeDisplayTags([
      "女性向",
      "纯入体",
      "女性向",
      "进阶级",
      "纯入体",
      "高伪装",
    ]),
    ["女性向", "纯入体", "进阶级", "高伪装"],
  );
});

test("dedupeDisplayTags trims blanks and ignores empty values", () => {
  assert.deepEqual(
    dedupeDisplayTags(["  ≥ IPX7 防水  ", "", "≥ IPX7 防水", "   ", "无限制分贝"]),
    ["≥ IPX7 防水", "无限制分贝"],
  );
});
