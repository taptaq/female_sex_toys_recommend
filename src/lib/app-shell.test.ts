import assert from "node:assert/strict";
import test from "node:test";

import {
  APP_STATE_STORAGE_KEY,
  detectRoute,
  normalizeProductsPayload,
  readProductsCache,
  readSessionJsonStorage,
  resolveProfilesReturnRoute,
  writeProductsCache,
  writeSessionJsonStorage,
} from "./app-shell.ts";

function createMemoryStorage() {
  const store = new Map<string, string>();

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
}

test("private app state uses session storage instead of long-lived local storage", () => {
  const previousWindow = globalThis.window;
  const sessionStorage = createMemoryStorage();
  const localStorage = createMemoryStorage();

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      sessionStorage,
      localStorage,
    },
  });

  try {
    localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify({ legacy: true }));

    writeSessionJsonStorage(APP_STATE_STORAGE_KEY, {
      answers: { tags: ["静音"] },
    });

    assert.equal(localStorage.getItem(APP_STATE_STORAGE_KEY), null);
    assert.match(
      sessionStorage.getItem(APP_STATE_STORAGE_KEY) ?? "",
      /静音/,
    );
    assert.deepEqual(readSessionJsonStorage(APP_STATE_STORAGE_KEY, {}), {
      answers: { tags: ["静音"] },
    });
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: previousWindow,
    });
  }
});

test('detectRoute returns "/profiles" for saved equipment matching profiles', () => {
  assert.equal(detectRoute("/profiles"), "/profiles");
});

test("resolveProfilesReturnRoute sends profiles back to the route that opened it", () => {
  assert.equal(resolveProfilesReturnRoute("/results"), "/results");
  assert.equal(resolveProfilesReturnRoute("/"), "/");
  assert.equal(resolveProfilesReturnRoute(undefined), "/");
  assert.equal(resolveProfilesReturnRoute("/profiles"), "/");
});

test("normalizeProductsPayload preserves typeCode from cached products", () => {
  const products = normalizeProductsPayload([
    {
      id: "p1",
      name: "Liberty",
      safeDisplayName: "Liberty",
      canonicalName: "Liberty",
      price: 999,
      maxDb: 42,
      waterproof: 7,
      appearance: "normal",
      physicalForm: "external",
      motorType: "gentle",
      gender: "female",
      typeCode: "suction",
      subtypeCode: "suction_pure",
      brand: "Womanizer",
      material: "硅胶",
      imagePlaceholder: "",
      brandBrief: {
        brandName: "Womanizer",
        brandSlug: "womanizer",
        countryLabel: "德国",
        positioning: "偏设计感与高完成度的女性向品牌。",
        styleSummary: "风格更稳定、细腻，也更强调长期体验。",
      },
    },
  ]);

  assert.equal(products[0]?.typeCode, "suction");
  assert.equal(products[0]?.subtypeCode, "suction_pure");
  assert.equal(products[0]?.brandBrief?.brandSlug, "womanizer");
});

test("normalizeProductsPayload derives typeCode for cached legacy products that are missing it", () => {
  const products = normalizeProductsPayload([
    {
      id: "p2",
      name: "Womanizer Liberty",
      safeDisplayName: "Womanizer Liberty",
      canonicalName: "Womanizer Liberty",
      price: 999,
      maxDb: 42,
      waterproof: 7,
      appearance: "normal",
      physicalForm: "external",
      motorType: "gentle",
      gender: "female",
      brand: "Womanizer",
      material: "硅胶",
      imagePlaceholder: "",
      rawDescription: "气脉冲吸感，外部刺激设备",
      tags: [],
    },
  ]);

  assert.equal(products[0]?.typeCode, "suction");
  assert.equal(products[0]?.subtypeCode, "suction_pure");
});

test("normalizeProductsPayload corrects cached product gender when explicit device signals disagree with stale source gender", () => {
  const products = normalizeProductsPayload([
    {
      id: "p4",
      name: "AVA",
      safeDisplayName: "AVA",
      canonicalName: "AVA",
      price: 599,
      maxDb: 42,
      waterproof: 7,
      appearance: "normal",
      physicalForm: "external",
      motorType: "gentle",
      gender: "male",
      brand: "ZALO",
      material: "硅胶",
      imagePlaceholder: "",
      rawDescription:
        "商品名: AVA\n副标题: 迷你棒身震动棒\n卖点: 便携棒身，高频震动，适合外部探索。",
      tags: [],
    },
  ]);

  assert.equal(products[0]?.gender, "female");
  assert.equal(products[0]?.typeCode, "external_vibe");
});

test("normalizeProductsPayload stores a unified displayName for user-visible product surfaces", () => {
  const products = normalizeProductsPayload([
    {
      id: "p3",
      name: "情趣用品 套装",
      safeDisplayName: "个人护理用品 套装",
      canonicalName: "情趣用品 套装",
      price: 299,
      maxDb: 45,
      waterproof: 7,
      appearance: "normal",
      physicalForm: "external",
      motorType: "gentle",
      gender: "female",
      brand: "Brand",
      material: "硅胶",
      imagePlaceholder: "",
    },
  ]);

  assert.equal(products[0]?.displayName, "个人护理用品 套装");
});

test("writeProductsCache degrades gracefully when localStorage quota is exceeded", () => {
  const previousWindow = globalThis.window;
  const oversizedProducts = Array.from({ length: 2 }, (_, index) => ({
    id: `p-${index}`,
    name: `Product ${index}`,
    safeDisplayName: `Product ${index}`,
    canonicalName: `Product ${index}`,
    price: 199,
    maxDb: 42,
    waterproof: 7,
    appearance: "normal",
    physicalForm: "external",
    motorType: "gentle",
    gender: "female",
    brand: "Brand",
    material: "硅胶",
    imagePlaceholder: "",
    rawDescription: "x".repeat(8_000),
    tags: ["tag-a", "tag-b", "tag-c"],
  }));

  const localStorage = {
    getItem: () => null,
    setItem: (() => {
      let attempt = 0;
      return (_key: string, value: string) => {
        attempt += 1;
        if (attempt === 1) {
          const error = new Error("quota");
          error.name = "QuotaExceededError";
          throw error;
        }
        assert.ok(value.length > 0);
      };
    })(),
    removeItem: () => {},
  };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage,
      sessionStorage: createMemoryStorage(),
    },
  });

  try {
    assert.doesNotThrow(() => {
      writeProductsCache(oversizedProducts as never);
    });

    const cached = readProductsCache();
    assert.equal(Array.isArray(cached), true);
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: previousWindow,
    });
  }
});
