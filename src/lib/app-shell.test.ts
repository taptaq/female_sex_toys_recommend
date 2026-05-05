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
      brand: "Womanizer",
      material: "硅胶",
      imagePlaceholder: "",
    },
  ]);

  assert.equal(products[0]?.typeCode, "suction");
});
