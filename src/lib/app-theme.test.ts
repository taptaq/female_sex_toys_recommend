import assert from "node:assert/strict";
import test from "node:test";

import {
  APP_THEME_STORAGE_KEY,
  DEFAULT_APP_THEME_ID,
  applyAppTheme,
  normalizeAppThemeId,
  readStoredAppTheme,
  writeStoredAppTheme,
} from "./app-theme.ts";

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

test("normalizeAppThemeId only accepts known theme ids", () => {
  assert.equal(normalizeAppThemeId("soft-signal"), "soft-signal");
  assert.equal(normalizeAppThemeId("missing-theme"), DEFAULT_APP_THEME_ID);
  assert.equal(normalizeAppThemeId(null), DEFAULT_APP_THEME_ID);
});

test("app theme preference persists in localStorage", () => {
  const previousWindow = globalThis.window;
  const localStorage = createMemoryStorage();

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage },
  });

  try {
    writeStoredAppTheme("sync-field");

    assert.equal(localStorage.getItem(APP_THEME_STORAGE_KEY), "sync-field");
    assert.equal(readStoredAppTheme(), "sync-field");
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: previousWindow,
    });
  }
});

test("app theme preference falls back to memory when localStorage is blocked", () => {
  const previousWindow = globalThis.window;
  const localStorage = {
    getItem: () => {
      throw new Error("storage blocked");
    },
    setItem: () => {
      throw new Error("storage blocked");
    },
    removeItem: () => {
      throw new Error("storage blocked");
    },
  };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage },
  });

  try {
    writeStoredAppTheme("sync-field");

    assert.equal(readStoredAppTheme(), "sync-field");
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: previousWindow,
    });
  }
});

test("applyAppTheme writes the selected theme to the document root", () => {
  const previousDocument = globalThis.document;
  const documentElement = { dataset: {} as Record<string, string> };

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { documentElement },
  });

  try {
    applyAppTheme("soft-signal");
    assert.equal(documentElement.dataset.theme, "soft-signal");
  } finally {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: previousDocument,
    });
  }
});
