import assert from "node:assert/strict";
import test from "node:test";

import { canonicalizeTmallItemUrl } from "./backfill-iroha-female-links-from-tmall-category.ts";

test("canonicalizeTmallItemUrl keeps only the stable Tmall item id", () => {
  assert.equal(
    canonicalizeTmallItemUrl(
      "https://detail.tmall.com/item.htm?spm=a1z10&id=925735098578&rn=abc&pisk=long",
    ),
    "https://detail.tmall.com/item.htm?id=925735098578",
  );
  assert.equal(
    canonicalizeTmallItemUrl("//detail.tmall.com/item.htm?abbucket=0&id=811143418968"),
    "https://detail.tmall.com/item.htm?id=811143418968",
  );
  assert.equal(canonicalizeTmallItemUrl("https://example.com/product"), "https://example.com/product");
});
