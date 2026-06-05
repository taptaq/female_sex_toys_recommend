import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("loading route uses a lightweight data preparation page before the final matching ritual", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "src/App.tsx"), "utf8");

  assert.match(
    source,
    /function DataLoadingPage/,
  );
  assert.match(
    source,
    /if \(isLoading && currentRoute !== "\/library"\) \{[\s\S]*<DataLoadingPage loadingStep=\{loadingStep\} \/>/,
  );
  assert.doesNotMatch(
    source,
    /if \(isLoading && currentRoute !== "\/library"\) \{[\s\S]*<MatchingPage/,
  );
  assert.match(source, /正在准备装备库/);
  assert.match(source, /稍后再进入 Luna 校准匹配/);
});

test("favorite auth prompt uses the female MVP auth shell instead of the legacy dark panel", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "src/App.tsx"), "utf8");
  const favoriteAuthBlock = source.slice(
    source.indexOf("const favoriteAuthOverlay = isFavoriteAuthOpen ? ("),
    source.indexOf("if (DEBUG_FORCE_MATCHING_LOADING_PAGE)"),
  );
  const libraryRouteBlock = source.slice(
    source.indexOf('if (currentRoute === "/library")'),
    source.indexOf("const shellRoute = shellRouteState.route"),
  );

  assert.match(favoriteAuthBlock, /<HomeAuthOverlay variant="femaleMvp"/);
  assert.match(favoriteAuthBlock, /female-mvp-auth-modal-shell/);
  assert.match(favoriteAuthBlock, /female-mvp-auth-orbit-glow/);
  assert.match(favoriteAuthBlock, /登录后即可收藏喜欢的装备/);
  assert.match(libraryRouteBlock, /<LibraryPage/);
  assert.match(libraryRouteBlock, /\{favoriteAuthOverlay\}/);
  assert.match(libraryRouteBlock, /onBack=\{\(\) => navigateTo\("\/match-mode"\)\}/);
  assert.doesNotMatch(libraryRouteBlock, /navigateTo\(getReturnRoute\(\)\)/);
  assert.doesNotMatch(
    favoriteAuthBlock,
    /className="mt-3 w-full rounded-full border border-white\/10 bg-white\/\[0\.035\]/,
  );
});
