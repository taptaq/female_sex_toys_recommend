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
