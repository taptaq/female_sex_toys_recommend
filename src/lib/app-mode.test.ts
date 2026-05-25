import assert from "node:assert/strict";
import test from "node:test";
import {
  APP_MODE,
  DEFAULT_MVP_ANSWERS,
  canShowMvpEntry,
  isFemaleMvpEligibleProduct,
  shouldUseFemaleMvp,
} from "./app-mode.ts";
import type { Product } from "../data/mock.ts";

const baseProduct: Product = {
  id: "product-1",
  name: "测试产品",
  price: 199,
  maxDb: 45,
  waterproof: 7,
  appearance: "normal",
  physicalForm: "external",
  motorType: "gentle",
  gender: "female",
  brand: "测试品牌",
  material: "硅胶",
  imagePlaceholder: "placeholder",
  tags: [],
};

function product(overrides: Partial<Product>): Product {
  return {
    ...baseProduct,
    ...overrides,
  };
}

test("APP_MODE is female-mvp", () => {
  assert.equal(APP_MODE, "female-mvp");
});

test("shouldUseFemaleMvp returns true", () => {
  assert.equal(shouldUseFemaleMvp(), true);
});

test("DEFAULT_MVP_ANSWERS defaults to female route and tag", () => {
  assert.deepEqual(DEFAULT_MVP_ANSWERS, { gender: "female", tags: ["女性向"] });
});

test("canShowMvpEntry shows only start match and favorites in female MVP", () => {
  assert.equal(canShowMvpEntry("start-match"), true);
  assert.equal(canShowMvpEntry("favorites"), true);
  assert.equal(canShowMvpEntry("library"), false);
  assert.equal(canShowMvpEntry("knowledge"), false);
  assert.equal(canShowMvpEntry("profiles"), false);
  assert.equal(canShowMvpEntry("body-persona"), false);
  assert.equal(canShowMvpEntry("theme-switcher"), false);
});

test("isFemaleMvpEligibleProduct returns true for female products", () => {
  assert.equal(isFemaleMvpEligibleProduct(product({ gender: "female" })), true);
});

test("isFemaleMvpEligibleProduct returns true for unisex products with female signals", () => {
  assert.equal(
    isFemaleMvpEligibleProduct(
      product({
        gender: "unisex",
        rawDescription: "适合女性向外部震动和情侣共玩",
        tags: ["女性向"],
      }),
    ),
    true,
  );
});

test("isFemaleMvpEligibleProduct returns true for unisex products with name or displayName female signals", () => {
  assert.equal(
    isFemaleMvpEligibleProduct(
      product({
        gender: "unisex",
        name: "G点按摩棒",
      }),
    ),
    true,
  );
  assert.equal(
    isFemaleMvpEligibleProduct(
      product({
        gender: "unisex",
        displayName: "盆底凯格尔训练器",
      }),
    ),
    true,
  );
});

test("isFemaleMvpEligibleProduct returns false for male products", () => {
  assert.equal(isFemaleMvpEligibleProduct(product({ gender: "male", tags: ["女性向"] })), false);
});

test("isFemaleMvpEligibleProduct returns false for male-coded unisex products", () => {
  const maleSignals = ["男性专用", "飞机杯刺激", "男士用品"];

  for (const rawDescription of maleSignals) {
    assert.equal(
      isFemaleMvpEligibleProduct(
        product({
          gender: "unisex",
          rawDescription,
          tags: ["女性向"],
        }),
      ),
      false,
    );
  }
});

test("isFemaleMvpEligibleProduct returns false for unisex products with safe or canonical male-only signals", () => {
  assert.equal(
    isFemaleMvpEligibleProduct(
      product({
        gender: "unisex",
        safeDisplayName: "前列腺按摩器",
        tags: ["女性向"],
      }),
    ),
    false,
  );
  assert.equal(
    isFemaleMvpEligibleProduct(
      product({
        gender: "unisex",
        canonicalName: "阴茎环",
        tags: ["女性向"],
      }),
    ),
    false,
  );
});
