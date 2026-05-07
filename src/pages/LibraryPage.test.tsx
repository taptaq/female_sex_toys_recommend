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
    typeCode: "suction",
    subtypeCode: "suction_pure",
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
      filterType="all"
      filterSubtype="all"
      filterBrand="all"
      filterOrigin="all"
      filterMaterial="all"
      filterPriceRange="all"
      filterMaxDb={70}
      isLoading={false}
      error={null}
      onReload={() => {}}
      onFilterGenderChange={() => {}}
      onFilterSubtypeChange={() => {}}
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

test("library page shows only male type options when male gender is selected", () => {
  const html = renderToStaticMarkup(
    <LibraryPage
      allProducts={[
        makeProduct({ id: "m1", gender: "male", typeCode: "masturbator", name: "Cup One" }),
      ]}
      filterGender="male"
      filterType="all"
      filterSubtype="all"
      filterBrand="all"
      filterOrigin="all"
      filterMaterial="all"
      filterPriceRange="all"
      filterMaxDb={70}
      isLoading={false}
      error={null}
      onReload={() => {}}
      onFilterGenderChange={() => {}}
      onFilterTypeChange={() => {}}
      onFilterSubtypeChange={() => {}}
      onFilterBrandChange={() => {}}
      onFilterOriginChange={() => {}}
      onFilterMaterialChange={() => {}}
      onFilterPriceRangeChange={() => {}}
      onFilterMaxDbChange={() => {}}
      onBack={() => {}}
    />,
  );

  assert.match(html, /类型/);
  assert.match(html, /飞机杯/);
  assert.match(html, /前列腺探索/);
  assert.match(html, /护理与周边/);
  assert.doesNotMatch(html, /吮吸类/);
});

test("library page filters care accessory products by subtype", () => {
  const html = renderToStaticMarkup(
    <LibraryPage
      allProducts={[
        makeProduct({
          id: "c1",
          name: "Water-Based Lubricant 100ml",
          gender: "male",
          typeCode: "care_accessory",
          subtypeCode: "lube_care",
        }),
        makeProduct({
          id: "c2",
          name: "Lace Bodysuit",
          gender: "female",
          typeCode: "care_accessory",
          subtypeCode: "lingerie",
        }),
      ]}
      filterGender="all"
      filterType="care_accessory"
      filterSubtype="lube_care"
      filterBrand="all"
      filterOrigin="all"
      filterMaterial="all"
      filterPriceRange="all"
      filterMaxDb={70}
      isLoading={false}
      error={null}
      onReload={() => {}}
      onFilterGenderChange={() => {}}
      onFilterTypeChange={() => {}}
      onFilterSubtypeChange={() => {}}
      onFilterBrandChange={() => {}}
      onFilterOriginChange={() => {}}
      onFilterMaterialChange={() => {}}
      onFilterPriceRangeChange={() => {}}
      onFilterMaxDbChange={() => {}}
      onBack={() => {}}
    />,
  );

  assert.match(html, /护理与周边/);
  assert.match(html, /润滑护理/);
  assert.match(html, /避孕套/);
  assert.match(html, /内衣服饰/);
  assert.match(html, /Water-Based Lubricant 100ml/);
  assert.doesNotMatch(html, /Lace Bodysuit/);
});

test("library page filters products by selected type code", () => {
  const html = renderToStaticMarkup(
    <LibraryPage
      allProducts={[
        makeProduct({
          id: "f1",
          name: "Suction One",
          gender: "female",
          typeCode: "suction",
          subtypeCode: "suction_pure",
        }),
        makeProduct({
          id: "f2",
          name: "Insertable One",
          gender: "female",
          typeCode: "insertable",
          subtypeCode: "gspot_insertable",
        }),
      ]}
      filterGender="female"
      filterType="suction"
      filterSubtype="all"
      filterBrand="all"
      filterOrigin="all"
      filterMaterial="all"
      filterPriceRange="all"
      filterMaxDb={70}
      isLoading={false}
      error={null}
      onReload={() => {}}
      onFilterGenderChange={() => {}}
      onFilterTypeChange={() => {}}
      onFilterSubtypeChange={() => {}}
      onFilterBrandChange={() => {}}
      onFilterOriginChange={() => {}}
      onFilterMaterialChange={() => {}}
      onFilterPriceRangeChange={() => {}}
      onFilterMaxDbChange={() => {}}
      onBack={() => {}}
    />,
  );

  assert.match(html, /Suction One/);
  assert.doesNotMatch(html, /Insertable One/);
});

test("library page filters legacy products even when typeCode is missing from in-memory data", () => {
  const html = renderToStaticMarkup(
    <LibraryPage
      allProducts={[
        makeProduct({
          id: "legacy-1",
          name: "Womanizer Liberty",
          gender: "female",
          typeCode: null,
          rawDescription: "气脉冲吸感，外部刺激设备",
          tags: [],
        }),
        makeProduct({
          id: "legacy-2",
          name: "Insertable One",
          gender: "female",
          typeCode: null,
          physicalForm: "internal",
          rawDescription: "入体探索，深入包裹",
          tags: [],
        }),
      ]}
      filterGender="female"
      filterType="suction"
      filterSubtype="all"
      filterBrand="all"
      filterOrigin="all"
      filterMaterial="all"
      filterPriceRange="all"
      filterMaxDb={70}
      isLoading={false}
      error={null}
      onReload={() => {}}
      onFilterGenderChange={() => {}}
      onFilterTypeChange={() => {}}
      onFilterSubtypeChange={() => {}}
      onFilterBrandChange={() => {}}
      onFilterOriginChange={() => {}}
      onFilterMaterialChange={() => {}}
      onFilterPriceRangeChange={() => {}}
      onFilterMaxDbChange={() => {}}
      onBack={() => {}}
    />,
  );

  assert.match(html, /Womanizer Liberty/);
  assert.doesNotMatch(html, /Insertable One/);
});

test("library page keeps uncategorized products visible only under all types", () => {
  const html = renderToStaticMarkup(
    <LibraryPage
      allProducts={[
        makeProduct({ id: "u1", name: "Unknown One", gender: "female", typeCode: null }),
      ]}
      filterGender="female"
      filterType="all"
      filterSubtype="all"
      filterBrand="all"
      filterOrigin="all"
      filterMaterial="all"
      filterPriceRange="all"
      filterMaxDb={70}
      isLoading={false}
      error={null}
      onReload={() => {}}
      onFilterGenderChange={() => {}}
      onFilterTypeChange={() => {}}
      onFilterSubtypeChange={() => {}}
      onFilterBrandChange={() => {}}
      onFilterOriginChange={() => {}}
      onFilterMaterialChange={() => {}}
      onFilterPriceRangeChange={() => {}}
      onFilterMaxDbChange={() => {}}
      onBack={() => {}}
    />,
  );

  assert.match(html, /Unknown One/);
});

test("library page filters uncategorized products under 其他 type", () => {
  const html = renderToStaticMarkup(
    <LibraryPage
      allProducts={[
        makeProduct({ id: "u1", name: "Unknown One", gender: "female", typeCode: null }),
        makeProduct({
          id: "s1",
          name: "Known One",
          gender: "female",
          typeCode: "suction",
          subtypeCode: "suction_pure",
        }),
      ]}
      filterGender="female"
      filterType="unknown"
      filterSubtype="all"
      filterBrand="all"
      filterOrigin="all"
      filterMaterial="all"
      filterPriceRange="all"
      filterMaxDb={70}
      isLoading={false}
      error={null}
      onReload={() => {}}
      onFilterGenderChange={() => {}}
      onFilterTypeChange={() => {}}
      onFilterSubtypeChange={() => {}}
      onFilterBrandChange={() => {}}
      onFilterOriginChange={() => {}}
      onFilterMaterialChange={() => {}}
      onFilterPriceRangeChange={() => {}}
      onFilterMaxDbChange={() => {}}
      onBack={() => {}}
    />,
  );

  assert.match(html, /Unknown One/);
  assert.doesNotMatch(html, /Known One/);
  assert.match(html, /其他/);
});

test("library page keeps a calmer mobile-first shell and lighter filter density", () => {
  const source = renderToStaticMarkup(
    <LibraryPage
      allProducts={[makeProduct()]}
      filterGender="all"
      filterType="all"
      filterSubtype="all"
      filterBrand="all"
      filterOrigin="all"
      filterMaterial="all"
      filterPriceRange="all"
      filterMaxDb={70}
      isLoading={false}
      error={null}
      onReload={() => {}}
      onFilterGenderChange={() => {}}
      onFilterSubtypeChange={() => {}}
      onFilterBrandChange={() => {}}
      onFilterOriginChange={() => {}}
      onFilterMaterialChange={() => {}}
      onFilterPriceRangeChange={() => {}}
      onFilterMaxDbChange={() => {}}
      onBack={() => {}}
    />,
  );

  assert.match(source, /p-4/);
  assert.match(source, /sm:p-6 md:p-8/);
  assert.match(source, /relative z-10 w-full max-w-5xl pb-20/);
  assert.match(source, /sm:pb-24/);
  assert.match(source, /text-center mb-8 sm:mb-10/);
  assert.match(source, /text-2xl font-light tracking-\[0\.2em\] text-white mb-2 sm:text-3xl sm:tracking-widest/);
  assert.match(source, /glass-panel rounded-\[1\.35rem\] p-4 mb-8 border border-white\/5 bg-white\/5 sm:rounded-2xl sm:p-6 sm:mb-10/);
  assert.match(source, /grid grid-cols-1 gap-4/);
  assert.match(source, /sm:gap-6 md:grid-cols-3/);
  assert.match(source, /mt-4 border-t border-white\/8 pt-4 sm:mt-5/);
  assert.match(source, /mt-4/);
  assert.match(source, /grid grid-cols-1 gap-4/);
  assert.match(source, /sm:gap-6 md:grid-cols-3/);
});

test("library page product grid and back-to-top affordance stay mobile-friendly", () => {
  const source = renderToStaticMarkup(
    <LibraryPage
      allProducts={[makeProduct(), makeProduct({ id: "p2", name: "Second Product" })]}
      filterGender="all"
      filterType="all"
      filterSubtype="all"
      filterBrand="all"
      filterOrigin="all"
      filterMaterial="all"
      filterPriceRange="all"
      filterMaxDb={70}
      isLoading={false}
      error={null}
      onReload={() => {}}
      onFilterGenderChange={() => {}}
      onFilterSubtypeChange={() => {}}
      onFilterBrandChange={() => {}}
      onFilterOriginChange={() => {}}
      onFilterMaterialChange={() => {}}
      onFilterPriceRangeChange={() => {}}
      onFilterMaxDbChange={() => {}}
      onBack={() => {}}
    />,
  );

  assert.match(source, /grid grid-cols-1 gap-4/);
  assert.match(source, /sm:grid-cols-2 sm:gap-6 lg:grid-cols-3/);
  assert.match(source, /glass-panel rounded-\[1\.35rem\] overflow-hidden flex flex-col group hover:border-cyan-500\/40 transition-all hover:bg-white\/5 sm:rounded-2xl/);
  assert.match(source, /fixed bottom-4 right-4 z-30 inline-flex items-center gap-2 rounded-full/);
  assert.match(source, /sm:bottom-8 sm:right-8/);
});

test("library page shows subtype options only after a supported top-level type is selected", () => {
  const html = renderToStaticMarkup(
    <LibraryPage
      allProducts={[
        makeProduct({
          id: "d1",
          name: "Rabbit Dual",
          gender: "female",
          typeCode: "dual_stimulation",
          subtypeCode: "rabbit_dual",
        }),
      ]}
      filterGender="female"
      filterType="dual_stimulation"
      filterSubtype="all"
      filterBrand="all"
      filterOrigin="all"
      filterMaterial="all"
      filterPriceRange="all"
      filterMaxDb={70}
      isLoading={false}
      error={null}
      onReload={() => {}}
      onFilterGenderChange={() => {}}
      onFilterTypeChange={() => {}}
      onFilterSubtypeChange={() => {}}
      onFilterBrandChange={() => {}}
      onFilterOriginChange={() => {}}
      onFilterMaterialChange={() => {}}
      onFilterPriceRangeChange={() => {}}
      onFilterMaxDbChange={() => {}}
      onBack={() => {}}
    />,
  );

  assert.match(html, /类型细分/);
  assert.match(html, /兔耳双刺激/);
  assert.match(html, /双头多点/);
});

test("library page shows male subtype options for masturbator products", () => {
  const html = renderToStaticMarkup(
    <LibraryPage
      allProducts={[
        makeProduct({
          id: "m1",
          gender: "male",
          typeCode: "masturbator",
          subtypeCode: "interactive_masturbator",
          name: "Sync Cup",
        }),
      ]}
      filterGender="male"
      filterType="masturbator"
      filterSubtype="all"
      filterBrand="all"
      filterOrigin="all"
      filterMaterial="all"
      filterPriceRange="all"
      filterMaxDb={70}
      isLoading={false}
      error={null}
      onReload={() => {}}
      onFilterGenderChange={() => {}}
      onFilterTypeChange={() => {}}
      onFilterSubtypeChange={() => {}}
      onFilterBrandChange={() => {}}
      onFilterOriginChange={() => {}}
      onFilterMaterialChange={() => {}}
      onFilterPriceRangeChange={() => {}}
      onFilterMaxDbChange={() => {}}
      onBack={() => {}}
    />,
  );

  assert.match(html, /类型细分/);
  assert.match(html, /互动杯/);
  assert.match(html, /震动杯/);
});

test("library page filters products by selected subtype code", () => {
  const html = renderToStaticMarkup(
    <LibraryPage
      allProducts={[
        makeProduct({
          id: "d1",
          name: "Rabbit Dual",
          gender: "female",
          typeCode: "dual_stimulation",
          subtypeCode: "rabbit_dual",
        }),
        makeProduct({
          id: "d2",
          name: "Multi Head Dual",
          gender: "female",
          typeCode: "dual_stimulation",
          subtypeCode: "multi_head_dual",
        }),
      ]}
      filterGender="female"
      filterType="dual_stimulation"
      filterSubtype="rabbit_dual"
      filterBrand="all"
      filterOrigin="all"
      filterMaterial="all"
      filterPriceRange="all"
      filterMaxDb={70}
      isLoading={false}
      error={null}
      onReload={() => {}}
      onFilterGenderChange={() => {}}
      onFilterTypeChange={() => {}}
      onFilterSubtypeChange={() => {}}
      onFilterBrandChange={() => {}}
      onFilterOriginChange={() => {}}
      onFilterMaterialChange={() => {}}
      onFilterPriceRangeChange={() => {}}
      onFilterMaxDbChange={() => {}}
      onBack={() => {}}
    />,
  );

  assert.match(html, /Rabbit Dual/);
  assert.doesNotMatch(html, /Multi Head Dual/);
});

test("library page filters unisex wearable remote products by subtype", () => {
  const html = renderToStaticMarkup(
    <LibraryPage
      allProducts={[
        makeProduct({
          id: "u1",
          name: "Panty One",
          gender: "unisex",
          typeCode: "wearable_remote",
          subtypeCode: "panty_wearable",
        }),
        makeProduct({
          id: "u2",
          name: "Couple Link",
          gender: "unisex",
          typeCode: "wearable_remote",
          subtypeCode: "dual_wearable_remote",
        }),
      ]}
      filterGender="unisex"
      filterType="wearable_remote"
      filterSubtype="dual_wearable_remote"
      filterBrand="all"
      filterOrigin="all"
      filterMaterial="all"
      filterPriceRange="all"
      filterMaxDb={70}
      isLoading={false}
      error={null}
      onReload={() => {}}
      onFilterGenderChange={() => {}}
      onFilterTypeChange={() => {}}
      onFilterSubtypeChange={() => {}}
      onFilterBrandChange={() => {}}
      onFilterOriginChange={() => {}}
      onFilterMaterialChange={() => {}}
      onFilterPriceRangeChange={() => {}}
      onFilterMaxDbChange={() => {}}
      onBack={() => {}}
    />,
  );

  assert.match(html, /Couple Link/);
  assert.doesNotMatch(html, /Panty One/);
});
