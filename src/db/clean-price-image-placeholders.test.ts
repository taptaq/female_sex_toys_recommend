import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPriceImagePatch,
  isUsableImageUrl,
  isUsablePrice,
  type PriceImagePairRow,
} from "./clean-price-image-placeholders.ts";

function makeRow(overrides: Partial<PriceImagePairRow>): PriceImagePairRow {
  return {
    product_id: "product-1",
    toy_id: "toy-1",
    product_price: null,
    toy_price: null,
    product_image: null,
    toy_image_url: null,
    ...overrides,
  };
}

test("isUsableImageUrl rejects known scraper placeholders", () => {
  assert.equal(isUsableImageUrl(null), false);
  assert.equal(isUsableImageUrl(""), false);
  assert.equal(isUsableImageUrl("https://img.alicdn.com/imgextra/i4/2-tps-2-2.png"), false);
  assert.equal(isUsableImageUrl("https://img.alicdn.com/imgextra/i4/O1CN01abc_!!1-2-tps-48-48.png"), false);
  assert.equal(isUsableImageUrl("https://img.alicdn.com/tfs/TB1MaLKRXXXXXaWXFXXXXXXXXXX-480-260.png"), false);
  assert.equal(isUsableImageUrl("https://assets.alicdn.com/s.gif"), false);
  assert.equal(isUsableImageUrl("https://www.facebook.com/tr?id=343782953321127&ev=PageView&noscript=1"), false);
  assert.equal(isUsableImageUrl("https://www.kiiroo.com/$%7Bn.image%7D"), false);
  assert.equal(isUsableImageUrl("https://cdn.example.com/placeholder-product.png"), false);
  assert.equal(isUsableImageUrl("https://cdn.lovehoney.com/countries/GB.svg"), false);
  assert.equal(isUsableImageUrl("https://cdn.example.com/products/real-product.jpg"), true);
});

test("isUsablePrice accepts real prices and rejects empty or sentinel prices", () => {
  assert.equal(isUsablePrice(null), false);
  assert.equal(isUsablePrice(""), false);
  assert.equal(isUsablePrice(0), false);
  assert.equal(isUsablePrice("1"), false);
  assert.equal(isUsablePrice("49.99"), true);
  assert.equal(isUsablePrice(699), true);
});

test("buildPriceImagePatch syncs product image from toy when product image is placeholder", () => {
  const patch = buildPriceImagePatch(
    makeRow({
      product_image: "https://img.alicdn.com/imgextra/i4/2-tps-2-2.png",
      toy_image_url: "https://cdn.example.com/products/toy.jpg",
    }),
  );

  assert.equal(patch.productImage, "https://cdn.example.com/products/toy.jpg");
  assert.equal(patch.toyImageUrl, undefined);
  assert.match(patch.reasons.join(","), /product_image_from_toy/);
});

test("buildPriceImagePatch syncs toy image from product when toy image is placeholder", () => {
  const patch = buildPriceImagePatch(
    makeRow({
      product_image: "https://cdn.example.com/products/product.jpg",
      toy_image_url: "https://www.kiiroo.com/$%7Bn.image%7D",
    }),
  );

  assert.equal(patch.productImage, undefined);
  assert.equal(patch.toyImageUrl, "https://cdn.example.com/products/product.jpg");
  assert.match(patch.reasons.join(","), /toy_image_from_product/);
});

test("buildPriceImagePatch nulls placeholder images when no trusted counterpart exists", () => {
  const patch = buildPriceImagePatch(
    makeRow({
      product_image: "https://cdn.example.com/placeholder-product.png",
      toy_image_url: "https://cdn.example.com/countries/GB.svg",
    }),
  );

  assert.equal(patch.productImage, null);
  assert.equal(patch.toyImageUrl, null);
});

test("buildPriceImagePatch only fills bad prices from a usable counterpart", () => {
  const productPatch = buildPriceImagePatch(makeRow({ product_price: null, toy_price: "59.99" }));
  assert.equal(productPatch.productPrice, "59.99");
  assert.equal(productPatch.toyPrice, undefined);

  const toyPatch = buildPriceImagePatch(makeRow({ product_price: 88, toy_price: 1 }));
  assert.equal(toyPatch.productPrice, undefined);
  assert.equal(toyPatch.toyPrice, 88);

  const untouched = buildPriceImagePatch(makeRow({ product_price: 29, toy_price: 35 }));
  assert.equal(untouched.productPrice, undefined);
  assert.equal(untouched.toyPrice, undefined);
});

test("buildPriceImagePatch fixes product prices that were stored in cents", () => {
  const exactCents = buildPriceImagePatch(makeRow({ product_price: "68800", toy_price: "688.00" }));
  assert.equal(exactCents.productPrice, "688.00");
  assert.match(exactCents.reasons.join(","), /product_price_from_toy_scaled/);

  const approximateCents = buildPriceImagePatch(makeRow({ product_price: "76279", toy_price: "784.00" }));
  assert.equal(approximateCents.productPrice, "784.00");

  const suspiciousRatio = buildPriceImagePatch(makeRow({ product_price: "68106", toy_price: "385.00" }));
  assert.equal(suspiciousRatio.productPrice, undefined);
});

test("buildPriceImagePatch does not create patches for missing joined rows", () => {
  const productOnly = buildPriceImagePatch(
    makeRow({
      toy_id: null,
      product_price: "99",
      product_image: "https://www.facebook.com/tr?id=343782953321127&ev=PageView&noscript=1",
    }),
  );
  assert.equal(productOnly.toyPrice, undefined);
  assert.equal(productOnly.toyImageUrl, undefined);
  assert.equal(productOnly.productImage, null);

  const toyOnly = buildPriceImagePatch(
    makeRow({
      product_id: null,
      toy_price: "88",
      toy_image_url: "https://cdn.example.com/products/toy.jpg",
    }),
  );
  assert.equal(toyOnly.productPrice, undefined);
  assert.equal(toyOnly.productImage, undefined);
});
