import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("main bootstrap applies the stored theme without preloading removed home cosmos images", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "src/main.tsx"), "utf8");

  assert.match(source, /const initialThemeId = readStoredAppTheme\(\);/);
  assert.match(source, /applyAppTheme\(initialThemeId\);/);
  assert.doesNotMatch(source, /APP_THEME_HOME_COSMOS_IMAGE_BY_ID/);
  assert.doesNotMatch(source, /homeCosmosPreloadLink/);
  assert.doesNotMatch(source, /preloadAllAppThemeHomeCosmos/);
  assert.doesNotMatch(source, /requestIdleCallback/);
});
