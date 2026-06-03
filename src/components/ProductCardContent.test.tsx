import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { Product } from "../data/mock.ts";
import { ProductCardContent } from "./ProductCardContent.tsx";

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    name: "测试产品",
    price: 199,
    maxDb: 42,
    waterproof: 7,
    appearance: "normal",
    physicalForm: "external",
    motorType: "gentle",
    gender: "female",
    typeCode: "external_vibe",
    subtypeCode: "bullet_vibe",
    brand: "Brand",
    brandBrief: {
      brandName: "Brand",
      brandSlug: "brand",
      countryLabel: "USA",
      positioning: "偏入门友好与轻决策成本的品牌。",
      styleSummary: "风格更直接、轻量，也更适合快速开始。",
    },
    material: "硅胶",
    imagePlaceholder: "",
    tags: [],
    ...overrides,
  };
}

test("product card surfaces a clearer gender label outside the image area", () => {
  const html = renderToStaticMarkup(
    <ProductCardContent product={makeProduct({ gender: "female" })} />,
  );

  assert.match(html, /适用对象/);
  assert.match(html, /女性向/);
  assert.doesNotMatch(html, /女用/);
});

test("product card shows a compact brand brief block when brand metadata exists", () => {
  const html = renderToStaticMarkup(
    <ProductCardContent product={makeProduct()} />,
  );

  assert.match(html, /当前品牌/);
  assert.match(html, /Brand · 美国/);
  assert.match(html, /偏入门友好与轻决策成本的品牌。/);
  assert.match(html, /风格更直接、轻量，也更适合快速开始。/);
});

test("product card can derive a compact brand brief from the brand name when cached metadata is missing", () => {
  const html = renderToStaticMarkup(
    <ProductCardContent
      product={makeProduct({
        brand: "Lovense",
        brandBrief: null,
      })}
    />,
  );

  assert.match(html, /当前品牌/);
  assert.match(html, /Lovense/);
});

test("product card falls back to a subtype placeholder image when image placeholder is empty", () => {
  const html = renderToStaticMarkup(
    <ProductCardContent
      product={makeProduct({
        imagePlaceholder: "",
        subtypeCode: "bullet_vibe",
      })}
    />,
  );

  assert.match(html, /src="\/assets\/product-placeholder\/bullet_vibe.png"/);
});

test("product card labels taxonomy placeholder images as references", () => {
  const placeholderHtml = renderToStaticMarkup(
    <ProductCardContent
      product={makeProduct({
        imagePlaceholder: "",
        subtypeCode: "bullet_vibe",
      })}
    />,
  );
  const realImageHtml = renderToStaticMarkup(
    <ProductCardContent
      product={makeProduct({
        imagePlaceholder: "https://example.com/product.png",
        subtypeCode: "bullet_vibe",
      })}
    />,
  );

  assert.match(placeholderHtml, /类型产品占位参考图/);
  assert.match(placeholderHtml, /border-sky-200\/70/);
  assert.match(placeholderHtml, /bg-white\/82/);
  assert.match(placeholderHtml, /text-sky-800/);
  assert.doesNotMatch(realImageHtml, /类型产品占位参考图/);
});

test("product card maps legacy subtype aliases to placeholder images", () => {
  const html = renderToStaticMarkup(
    <ProductCardContent
      product={makeProduct({
        imagePlaceholder: "",
        typeCode: "suction",
        subtypeCode: "clitoral_suction",
      })}
    />,
  );

  assert.match(html, /src="\/assets\/product-placeholder\/suction_pure.png"/);
});

test("product card falls back to type placeholder when subtype is missing", () => {
  const html = renderToStaticMarkup(
    <ProductCardContent
      product={makeProduct({
        imagePlaceholder: "",
        typeCode: "suction",
        subtypeCode: null,
      })}
    />,
  );

  assert.match(html, /src="\/assets\/product-placeholder\/suction_pure.png"/);
});

test("product card replaces legacy gradient placeholders with subtype images", () => {
  const html = renderToStaticMarkup(
    <ProductCardContent
      product={makeProduct({
        imagePlaceholder: "bg-gradient-to-br from-indigo-900/40 to-blue-900/40",
        typeCode: "suction",
        subtypeCode: null,
      })}
    />,
  );

  assert.match(html, /src="\/assets\/product-placeholder\/suction_pure.png"/);
});

test("product card replaces non-renderable placeholder strings with subtype images", () => {
  const html = renderToStaticMarkup(
    <ProductCardContent
      product={makeProduct({
        imagePlaceholder: "image",
        subtypeCode: "bullet_vibe",
      })}
    />,
  );

  assert.match(html, /src="\/assets\/product-placeholder\/bullet_vibe.png"/);
});

test("product card falls back to physical form placeholder for restored result snapshots", () => {
  const html = renderToStaticMarkup(
    <ProductCardContent
      product={makeProduct({
        imagePlaceholder: "bg-gradient-to-br from-indigo-900/40 to-blue-900/40",
        typeCode: null,
        subtypeCode: null,
        physicalForm: "composite",
      })}
    />,
  );

  assert.match(html, /src="\/assets\/product-placeholder\/rabbit_dual.png"/);
});
