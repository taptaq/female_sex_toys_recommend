import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { Product } from "../data/mock.ts";

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    originalId: "product-1",
    name: "Test Product",
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
    link: "https://example.com/product",
    sourceUrl: "https://example.com/product",
    tags: [],
    ...overrides,
  };
}

test("favorites modal can render saved products independently of profiles page", () => {
  const favoriteProducts = [makeProduct()];
  const html = renderToStaticMarkup(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[linear-gradient(165deg,rgba(255,248,250,0.98),rgba(239,249,255,0.96)_52%,rgba(253,242,248,0.94))] text-slate-900">
      <div className="min-h-dvh w-full px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-0">
        <div className="mb-5 flex flex-col gap-3 border-b border-sky-100 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div className="min-w-0">
            <p className="mb-2 text-[10px] font-black tracking-[0.28em] text-sky-500/76">
              FAVORITES
            </p>
            <h2 className="text-lg font-black text-slate-950 sm:text-xl">
              我的收藏
            </h2>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {favoriteProducts.map((product) => (
            <div
              key={product.id}
              className="rounded-2xl border border-sky-100 bg-white/78 p-4"
            >
              <div>{product.name}</div>
              <a
                href={product.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                查看产品详情
              </a>
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>,
  );

  assert.match(html, /FAVORITES/);
  assert.match(html, /我的收藏/);
  assert.match(html, /Test Product/);
  assert.match(html, /查看产品详情/);
  assert.match(html, /fixed inset-0 z-50 overflow-y-auto/);
  assert.match(html, /min-h-dvh w-full/);
  assert.match(html, /mx-auto w-full max-w-5xl px-4 sm:px-0/);
  assert.match(html, /border-b border-sky-100 p-5/);
  assert.match(html, /text-slate-900/);
  assert.doesNotMatch(html, /bg-slate-950 p-5/);
  assert.doesNotMatch(html, /匹配档案/);
});
