import test from "node:test";
import assert from "node:assert/strict";

import {
  buildProductLinkMergePlan,
  buildToyOriginalIdMergePlan,
  normalizeDuplicateLinkKey,
  type DuplicateProductRow,
  type DuplicateToyRow,
} from "./clean-duplicate-products-and-toys.ts";

function makeProduct(overrides: Partial<DuplicateProductRow>): DuplicateProductRow {
  return {
    id: "product-1",
    competitor_id: null,
    name: "Product",
    price: null,
    category: null,
    tags: null,
    link: null,
    image: null,
    sales: null,
    launch_date: null,
    gender: null,
    specs: null,
    price_history: null,
    analysis: null,
    reviews: null,
    price_analysis: null,
    use_scenario: null,
    persona_analysis: null,
    standardization_analysis: null,
    toy_count: 0,
    ref_count: 0,
    ...overrides,
  };
}

function makeToy(overrides: Partial<DuplicateToyRow>): DuplicateToyRow {
  return {
    id: "toy-1",
    original_id: "product-1",
    name: "Toy",
    price: null,
    max_db: null,
    waterproof: null,
    appearance: null,
    physical_form: null,
    motor_type: null,
    gender: null,
    brand: null,
    material: null,
    image_url: null,
    raw_description: null,
    safe_display_name: null,
    type_code: null,
    subtype_code: null,
    recommendation_features: null,
    product_name: null,
    ...overrides,
  };
}

test("normalizeDuplicateLinkKey ignores blank links and strips query noise", () => {
  assert.equal(normalizeDuplicateLinkKey("   "), "");
  assert.equal(
    normalizeDuplicateLinkKey("https://detail.tmall.com/item.htm?id=123&spm=abc&skuId=9"),
    "https://detail.tmall.com/item.htm?id=123",
  );
  assert.equal(
    normalizeDuplicateLinkKey("HTTPS://Example.com/Product?utm_source=x&variant=red"),
    "https://example.com/Product?variant=red",
  );
});

test("buildProductLinkMergePlan merges same non-empty link and preserves richer fields", () => {
  const keeper = makeProduct({
    id: "product-rich",
    name: "Clean Name",
    link: "https://example.com/toy?utm_source=ignored",
    tags: ["remote"],
    specs: { rawDescription: "short" },
    toy_count: 1,
  });
  const duplicate = makeProduct({
    id: "product-sparse",
    name: '"Clean Name",',
    link: "https://example.com/toy",
    image: "https://example.com/image.jpg",
    tags: ["remote", "silicone"],
    specs: { rawDescription: "a much longer raw description" },
  });
  const blank = makeProduct({ id: "blank-link", link: "" });

  const plan = buildProductLinkMergePlan([duplicate, blank, keeper]);

  assert.equal(plan.groups.length, 1);
  assert.equal(plan.groups[0]?.keeper.id, "product-rich");
  assert.deepEqual(plan.groups[0]?.deleteIds, ["product-sparse"]);
  assert.equal(plan.groups[0]?.merged.image, "https://example.com/image.jpg");
  assert.deepEqual(plan.groups[0]?.merged.tags, ["remote", "silicone"]);
  assert.equal(plan.groups[0]?.merged.specs?.rawDescription, "a much longer raw description");
});

test("buildProductLinkMergePlan does not merge same link when names are unrelated", () => {
  const plan = buildProductLinkMergePlan([
    makeProduct({
      id: "toy-product",
      name: "FIT 电动震动棒（升级款）",
      link: "https://detail.tmall.com/item.htm?id=41742396256&spm=abc",
    }),
    makeProduct({
      id: "lube-product",
      name: "TENGA典雅LOTION人体润滑油剂液水溶插入式打男用飞机日本进口",
      link: "https://detail.tmall.com/item.htm?id=41742396256",
    }),
  ]);

  assert.equal(plan.groups.length, 0);
});

test("buildProductLinkMergePlan merges official aliases with localized suffixes", () => {
  const plan = buildProductLinkMergePlan([
    makeProduct({
      id: "official",
      name: "We-Vibe Moxie+",
      link: "https://www.we-vibe.com/us/moxie-plus",
    }),
    makeProduct({
      id: "localized",
      name: "Moxie+ 跳蛋",
      link: "https://www.we-vibe.com/us/moxie-plus",
      specs: { rawDescription: "localized raw" },
    }),
  ]);

  assert.equal(plan.groups.length, 1);
  assert.equal(plan.groups[0]?.deleteIds.length, 1);
});

test("buildProductLinkMergePlan merges known male toy localized aliases", () => {
  const plan = buildProductLinkMergePlan([
    makeProduct({
      id: "official",
      name: "Arcwave Zing Rechargeable Vibrating Male Masturbator",
      link: "https://www.lovehoney.co.uk/sex-toys/male-sex-toys/male-masturbators/p/arcwave-zing-rechargeable-vibrating-male-masturbator/a48868g86816.html",
    }),
    makeProduct({
      id: "localized",
      name: "Arcwave Zing男式免提振动器自慰器",
      link: "https://www.lovehoney.co.uk/sex-toys/male-sex-toys/male-masturbators/p/arcwave-zing-rechargeable-vibrating-male-masturbator/a48868g86816.html",
    }),
  ]);

  assert.equal(plan.groups.length, 1);
});

test("buildToyOriginalIdMergePlan keeps row matching products.name and merges richer fields", () => {
  const canonical = makeToy({
    id: "canonical",
    original_id: "product-1",
    name: "Lovense Kraken Masturbator",
    product_name: "Lovense Kraken Masturbator",
    raw_description: "short",
    type_code: "masturbator",
  });
  const duplicate = makeToy({
    id: "duplicate",
    original_id: "product-1",
    name: "Lovense Kraken",
    product_name: "Lovense Kraken Masturbator",
    raw_description: "a much longer raw description",
    subtype_code: "interactive_masturbator",
  });

  const plan = buildToyOriginalIdMergePlan([duplicate, canonical]);

  assert.equal(plan.groups.length, 1);
  assert.equal(plan.groups[0]?.keeper.id, "canonical");
  assert.deepEqual(plan.groups[0]?.deleteIds, ["duplicate"]);
  assert.equal(plan.groups[0]?.merged.name, "Lovense Kraken Masturbator");
  assert.equal(plan.groups[0]?.merged.raw_description, "a much longer raw description");
  assert.equal(plan.groups[0]?.merged.subtype_code, "interactive_masturbator");
});
