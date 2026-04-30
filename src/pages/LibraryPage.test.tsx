import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { Product } from "../data/mock.ts";
import { LibraryPage } from "./LibraryPage.tsx";

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    name: "Test Product",
    price: 199,
    maxDb: 42,
    waterproof: 7,
    appearance: "high_disguise",
    physicalForm: "external",
    motorType: "gentle",
    gender: "female",
    brand: "Test Brand",
    material: "硅胶",
    imagePlaceholder: "",
    link: null,
    sourceUrl: null,
    tags: [],
    ...overrides,
  };
}

test("library page keeps primary filters visible and moves admin-like filters behind advanced entry", () => {
  const html = renderToStaticMarkup(
    <LibraryPage
      allProducts={[makeProduct()]}
      filterGender="all"
      filterBrand="all"
      filterOrigin="all"
      filterMaterial="all"
      filterPriceRange="all"
      filterMaxDb={70}
      isLoading={false}
      error={null}
      onReload={() => {}}
      onFilterGenderChange={() => {}}
      onFilterBrandChange={() => {}}
      onFilterOriginChange={() => {}}
      onFilterMaterialChange={() => {}}
      onFilterPriceRangeChange={() => {}}
      onFilterMaxDbChange={() => {}}
      onBack={() => {}}
    />,
  );

  assert.match(html, /适用对象/);
  assert.match(html, /价格区间/);
  assert.match(html, /静音阈值/);
  assert.match(html, /高级筛选/);
  assert.doesNotMatch(html, /品牌厂商/);
  assert.doesNotMatch(html, /出品地区/);
  assert.doesNotMatch(html, /材质偏好/);
});
