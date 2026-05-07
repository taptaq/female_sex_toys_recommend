import assert from "node:assert/strict";
import test from "node:test";

import {
  APP_STATE_STORAGE_KEY,
  detectRoute,
  normalizeProductsPayload,
  readSessionJsonStorage,
  resolveProfilesReturnRoute,
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
    },
  ]);

  assert.equal(products[0]?.typeCode, "suction");
  assert.equal(products[0]?.subtypeCode, "suction_pure");
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
