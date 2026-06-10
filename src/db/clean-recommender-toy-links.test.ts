import assert from "node:assert/strict";
import test from "node:test";

import {
  buildToyLinkPatch,
  canonicalizeTmallLinkForToy,
  extractTmallItemIdForLinkClean,
  type LinkCleanRow,
} from "./clean-recommender-toy-links.ts";

const BASE_ROW: LinkCleanRow = {
  table_name: "recommender_toys",
  id: "toy-1",
  name: "测试产品",
  toy_link: null,
  product_link: null,
};

test("extractTmallItemIdForLinkClean extracts item ids from normal and protocol-relative links", () => {
  assert.equal(extractTmallItemIdForLinkClean("https://detail.tmall.com/item.htm?spm=x&id=123&pisk=y"), "123");
  assert.equal(extractTmallItemIdForLinkClean("//detail.taobao.com/item.htm?id=456"), "456");
  assert.equal(extractTmallItemIdForLinkClean("https://example.com/product"), "");
});

test("canonicalizeTmallLinkForToy strips volatile Tmall params but keeps non-Tmall links", () => {
  assert.equal(
    canonicalizeTmallLinkForToy("https://detail.tmall.com/item.htm?spm=x&id=123&pisk=y&skuId=9"),
    "https://detail.tmall.com/item.htm?id=123",
  );
  assert.equal(
    canonicalizeTmallLinkForToy("https://detail.taobao.com/item.htm?id=456&sku_properties=x"),
    "https://detail.tmall.com/item.htm?id=456",
  );
  assert.equal(canonicalizeTmallLinkForToy("https://example.com/product/abc"), "https://example.com/product/abc");
});

test("buildToyLinkPatch fills missing toy link from canonicalized product link", () => {
  const patch = buildToyLinkPatch({
    ...BASE_ROW,
    table_name: "female_recommender_toys",
    toy_link: "",
    product_link: "https://detail.tmall.com/item.htm?spm=x&id=987&pisk=y",
  });

  assert.equal(patch?.tableName, "female_recommender_toys");
  assert.equal(patch?.reason, "fill_from_product");
  assert.equal(patch?.nextLink, "https://detail.tmall.com/item.htm?id=987");
});

test("buildToyLinkPatch canonicalizes existing Tmall toy links", () => {
  const patch = buildToyLinkPatch({
    ...BASE_ROW,
    toy_link: "https://detail.tmall.com/item.htm?id=111&pisk=volatile",
    product_link: "https://detail.tmall.com/item.htm?id=111&spm=source",
  });

  assert.equal(patch?.reason, "canonicalize_tmall");
  assert.equal(patch?.nextLink, "https://detail.tmall.com/item.htm?id=111");
});

test("buildToyLinkPatch refuses to overwrite conflicting item ids", () => {
  const patch = buildToyLinkPatch({
    ...BASE_ROW,
    toy_link: "https://detail.tmall.com/item.htm?id=111&pisk=volatile",
    product_link: "https://detail.tmall.com/item.htm?id=222&spm=source",
  });

  assert.equal(patch, null);
});

test("buildToyLinkPatch replaces non-url toy links only when product link exists", () => {
  const patch = buildToyLinkPatch({
    ...BASE_ROW,
    toy_link: "not a link",
    product_link: "https://example.com/product",
  });

  assert.equal(patch?.reason, "replace_non_url_from_product");
  assert.equal(patch?.nextLink, "https://example.com/product");
});
