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
