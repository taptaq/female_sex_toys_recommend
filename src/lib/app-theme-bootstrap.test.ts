import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("main bootstrap eagerly warms the current theme image and schedules the remaining theme backgrounds soon after startup", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "src/main.tsx"), "utf8");

  assert.match(source, /APP_THEME_HOME_COSMOS_IMAGE_BY_ID/);
  assert.match(source, /homeCosmosPreloadLink\.rel = "preload";/);
  assert.match(source, /homeCosmosPreloadLink\.as = "image";/);
  assert.match(source, /homeCosmosPreloadLink\.href = APP_THEME_HOME_COSMOS_IMAGE_BY_ID\[initialThemeId\];/);
  assert.match(source, /void preloadAllAppThemeHomeCosmos\(\);/);
  assert.match(source, /window\.requestIdleCallback\(scheduleHomeCosmosPreload, \{ timeout: 900 \}\);/);
  assert.match(source, /globalThis\.setTimeout\(scheduleHomeCosmosPreload, 240\);/);
});
