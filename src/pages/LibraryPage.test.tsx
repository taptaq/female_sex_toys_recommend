import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { Product } from "../data/mock.ts";
import { LibraryPage, LibraryProductDetailModal } from "./LibraryPage.tsx";

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

  assert.match(html, /价格区间/);
  assert.match(html, /出品地区/);
  assert.match(html, /不限产地/);
  assert.match(html, /静音阈值/);
  assert.match(html, /高级筛选/);
  assert.match(html, /重置筛选/);
  assert.match(html, /library-filter-trigger/);
  assert.match(html, /library-filter-options/);
  assert.doesNotMatch(html, /<select/);
  assert.doesNotMatch(html, /适用对象/);
  assert.doesNotMatch(html, /全部性别/);
  assert.doesNotMatch(html, /品牌厂商/);
  assert.doesNotMatch(html, /材质偏好/);
});

test("library page keeps reset button disabled when filters are already at defaults", () => {
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
      onFilterTypeChange={() => {}}
      onFilterSubtypeChange={() => {}}
      onFilterBrandChange={() => {}}
      onFilterOriginChange={() => {}}
      onFilterMaterialChange={() => {}}
      onFilterPriceRangeChange={() => {}}
      onFilterMaxDbChange={() => {}}
      onResetFilters={() => {}}
      onBack={() => {}}
    />,
  );

  assert.match(html, /重置筛选/);
  assert.match(
    html,
    /<button[^>]*disabled=""[^>]*>\s*重置筛选\s*<\/button>/,
  );
});

test("library page ignores legacy gender filter state when deciding reset availability", () => {
  const html = renderToStaticMarkup(
    <LibraryPage
      allProducts={[makeProduct()]}
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
      onResetFilters={() => {}}
      onBack={() => {}}
    />,
  );

  assert.match(html, /重置筛选/);
  assert.match(
    html,
    /<button[^>]*disabled=""[^>]*>\s*重置筛选\s*<\/button>/,
  );
});

test("library page ignores legacy gender filter state when deriving type options", () => {
  const html = renderToStaticMarkup(
    <LibraryPage
      allProducts={[
        makeProduct({ id: "m1", gender: "male", typeCode: "masturbator", name: "Cup One" }),
        makeProduct({ id: "f1", gender: "female", typeCode: "suction", name: "Suction One" }),
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
  assert.match(html, /吮吸类/);
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
  assert.match(html, /内衣服饰/);
  assert.doesNotMatch(html, /避孕套/);
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

  assert.match(source, /female-mvp-library-page/);
  assert.match(source, /bg-\[#fff7fb\]/);
  assert.match(source, /px-4 py-\[calc\(0\.75rem\+env\(safe-area-inset-top\)\)\]/);
  assert.match(source, /relative z-10 w-full max-w-5xl pb-20/);
  assert.match(source, /sm:pb-24/);
  assert.match(source, /female-mvp-library-hero/);
  assert.match(source, /Luna 产品库/);
  assert.match(source, /按类型、品牌和预算慢慢筛选/);
  assert.match(source, /female-mvp-library-filter-panel/);
  assert.match(source, /rounded-\[1\.35rem\] border border-white\/70 bg-white\/70/);
  assert.match(source, /grid grid-cols-1 gap-4/);
  assert.match(source, /sm:gap-6 md:grid-cols-3/);
  assert.match(source, /mt-4 border-t border-sky-100\/80 pt-4 sm:mt-5/);
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

  assert.match(source, /female-mvp-library-grid relative z-0 grid grid-cols-2 gap-3/);
  assert.match(source, /sm:gap-6 lg:grid-cols-3/);
  assert.match(source, /rounded-\[1rem\] overflow-hidden flex flex-col group border border-white\/70 bg-white\/75/);
  assert.match(source, /fixed bottom-4 right-4 z-30 inline-flex items-center gap-2 rounded-full/);
  assert.match(source, /bg-white\/86/);
  assert.match(source, /text-sky-600/);
  assert.match(source, /sm:bottom-8 sm:right-8/);
});

test("library page cards open in-app details instead of linking the whole card", () => {
  const source = renderToStaticMarkup(
    <LibraryPage
      allProducts={[
        makeProduct({
          sourceUrl: "https://example.com/product-detail",
          link: "https://fallback.example.com/product",
        }),
      ]}
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

  assert.match(source, /查看详情信息/);
  assert.doesNotMatch(source, /href="https:\/\/example\.com\/product-detail"/);
  assert.doesNotMatch(source, /target="_blank"/);
});

test("library product detail modal separates product information from the external detail link", () => {
  const source = renderToStaticMarkup(
    <LibraryProductDetailModal
      product={makeProduct({
        sourceUrl: "https://example.com/product-detail",
        brandBrief: {
          brandName: "Test Brand",
          brandSlug: "test-brand",
          countryLabel: "USA",
          positioning: "偏入门友好的品牌。",
          styleSummary: "风格轻巧清晰。",
        },
        personaAnalysis: "适合想先低压力探索的用户。",
        rawDescription: "[参数信息]\n材质: 硅胶\n[图文提取]\n动力规格: 柔和震动",
        tags: ["静音", "亲肤"],
      })}
      onClose={() => {}}
    />,
  );

  assert.match(source, /role="dialog"/);
  assert.match(source, /产品详情信息/);
  assert.match(source, /品牌信息/);
  assert.match(source, /适配提示/);
  assert.match(source, /产品详情摘要/);
  assert.match(source, /打开产品详情链接/);
  assert.match(source, /href="https:\/\/example\.com\/product-detail"/);
  assert.doesNotMatch(source, /查看详情信息/);
});

test("library page shows only in-stock subtype options after a supported top-level type is selected", () => {
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
  assert.doesNotMatch(html, /双头多点/);
});

test("library page brand options follow origin filter", () => {
  const html = renderToStaticMarkup(
    <LibraryPage
      allProducts={[
        makeProduct({
          id: "d1",
          brand: "国产一号",
          isDomestic: true,
        }),
        makeProduct({
          id: "i1",
          brand: "Overseas One",
          isDomestic: false,
        }),
      ]}
      filterGender="all"
      filterType="all"
      filterSubtype="all"
      filterBrand="all"
      filterOrigin="international"
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

  assert.match(html, /Overseas One/);
  assert.doesNotMatch(html, /国产一号/);
});

test("library page keeps favorites-only filter behind advanced filters entry", () => {
  const html = renderToStaticMarkup(
    <LibraryPage
      allProducts={[makeProduct()]}
      filterGender="all"
      filterType="all"
      filterSubtype="all"
      filterBrand="all"
      filterOrigin="all"
      showFavoritesOnly={true}
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
      onShowFavoritesOnlyChange={() => {}}
      onFilterMaterialChange={() => {}}
      onFilterPriceRangeChange={() => {}}
      onFilterMaxDbChange={() => {}}
      onBack={() => {}}
    />,
  );

  assert.match(html, /高级筛选/);
  assert.doesNotMatch(html, /只看已收藏/);
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
  assert.doesNotMatch(html, /震动杯/);
});

test("library page derives type options from loaded products while keeping taxonomy labels", () => {
  const html = renderToStaticMarkup(
    <LibraryPage
      allProducts={[
        makeProduct({
          id: "s1",
          name: "Suction One",
          gender: "female",
          typeCode: "suction",
          subtypeCode: "suction_pure",
        }),
        makeProduct({
          id: "m1",
          name: "Cup One",
          gender: "male",
          typeCode: "masturbator",
          subtypeCode: "interactive_masturbator",
        }),
      ]}
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

  assert.match(html, /吮吸类/);
  assert.match(html, /飞机杯/);
  assert.doesNotMatch(html, /双刺激/);
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
