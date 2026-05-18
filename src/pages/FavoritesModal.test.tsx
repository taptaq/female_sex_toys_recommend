import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { Product } from "../data/mock.ts";
import { HomeAuthOverlay } from "./HomePage.tsx";

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
    <HomeAuthOverlay onClose={() => {}}>
      <div className="w-full max-w-4xl rounded-[1.7rem] border border-cyan-300/18 bg-slate-950 p-5 text-left shadow-[0_0_90px_rgba(8,47,73,0.38)] sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-cyan-100/10 pb-4">
          <div className="min-w-0">
            <p className="mb-2 text-[10px] tracking-[0.28em] text-cyan-200/45">
              FAVORITES
            </p>
            <h2 className="text-lg font-medium text-white sm:text-xl">
              我的收藏
            </h2>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {favoriteProducts.map((product) => (
            <a
              key={product.id}
              href={product.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <div>{product.name}</div>
            </a>
          ))}
        </div>
      </div>
    </HomeAuthOverlay>,
  );

  assert.match(html, /FAVORITES/);
  assert.match(html, /我的收藏/);
  assert.match(html, /Test Product/);
  assert.doesNotMatch(html, /匹配档案/);
});
