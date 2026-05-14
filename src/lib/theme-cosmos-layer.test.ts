import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("theme cosmos layer defines one unified space motif system for every app page", () => {
  const componentPath = path.resolve(root, "src/components/ThemeCosmosLayer.tsx");
  assert.ok(fs.existsSync(componentPath), "ThemeCosmosLayer component should exist");

  const source = fs.readFileSync(componentPath, "utf8");

  for (const variant of [
    "home",
    "quiz",
    "matching",
    "results",
    "library",
    "knowledge-hub",
    "knowledge-detail",
    "profiles",
  ]) {
    assert.match(source, new RegExp(`"${variant}"`));
  }

  assert.match(source, /theme-cosmos-spiral/);
  assert.match(source, /theme-cosmos-nebula/);
  assert.match(source, /theme-cosmos-pulsar/);
  assert.match(source, /theme-cosmos-binary/);
});

test("app shell renders the theme cosmos layer across loading library and routed pages", () => {
  const appSource = fs.readFileSync(path.resolve(root, "src/App.tsx"), "utf8");

  assert.match(appSource, /ThemeCosmosLayer/);
  assert.match(appSource, /variant="matching"/);
  assert.match(appSource, /variant="library"/);
  assert.match(appSource, /themeCosmosVariant/);
  assert.doesNotMatch(appSource, /app-ambient absolute top-\[-10%\]/);
});

test("global css maps each theme to a distinct astronomy motif", () => {
  const cssSource = fs.readFileSync(path.resolve(root, "src/index.css"), "utf8");

  assert.match(cssSource, /data-theme="inner-space"[\s\S]*theme-cosmos-spiral/);
  assert.match(cssSource, /data-theme="soft-signal"[\s\S]*theme-cosmos-nebula/);
  assert.match(cssSource, /data-theme="sync-field"[\s\S]*theme-cosmos-binary/);
  assert.match(cssSource, /theme-cosmos-layer-home/);
  assert.match(cssSource, /theme-cosmos-layer-quiz/);
  assert.match(cssSource, /theme-cosmos-layer-matching/);
  assert.match(cssSource, /theme-cosmos-layer-results/);
  assert.match(cssSource, /theme-cosmos-layer-library/);
  assert.match(cssSource, /theme-cosmos-layer-knowledge-hub/);
  assert.match(cssSource, /theme-cosmos-layer-knowledge-detail/);
  assert.match(cssSource, /theme-cosmos-layer-profiles/);
});

test("page modules inherit theme accent tokens instead of locking to one cyan palette", () => {
  const appSource = fs.readFileSync(path.resolve(root, "src/App.tsx"), "utf8");
  const cssSource = fs.readFileSync(path.resolve(root, "src/index.css"), "utf8");

  assert.match(appSource, /theme-synced-page/);
  assert.match(cssSource, /\.theme-synced-page \[class\^="border-cyan"\]/);
  assert.match(cssSource, /\.theme-synced-page \[class\*=" border-cyan"\]/);
  assert.match(cssSource, /\.theme-synced-page \[class\^="bg-cyan"\]/);
  assert.match(cssSource, /\.theme-synced-page \[class\*=" bg-cyan"\]/);
  assert.match(cssSource, /\.theme-synced-page \[class\^="text-cyan"\]/);
  assert.match(cssSource, /\.theme-synced-page \[class\*=" text-cyan"\]/);
  assert.match(cssSource, /\.theme-synced-page \[class\^="from-cyan"\]/);
  assert.match(cssSource, /\.theme-synced-page \[class\*=" from-cyan"\]/);
  assert.match(cssSource, /\.theme-synced-page \[class\^="via-cyan"\]/);
  assert.match(cssSource, /\.theme-synced-page \[class\*=" via-cyan"\]/);
  assert.match(cssSource, /\.theme-synced-page \[class\^="to-cyan"\]/);
  assert.match(cssSource, /\.theme-synced-page \[class\*=" to-cyan"\]/);
  assert.match(cssSource, /\.theme-synced-page \[class\^="ring-cyan"\]/);
  assert.match(cssSource, /\.theme-synced-page \[class\*=" ring-cyan"\]/);
  assert.match(cssSource, /\.theme-synced-page \[class\^="accent-cyan"\]/);
  assert.match(cssSource, /\.theme-synced-page \[class\*=" accent-cyan"\]/);
  assert.doesNotMatch(cssSource, /\[class\*="bg-cyan"\]/);
  assert.doesNotMatch(cssSource, /\[class\*="hover:bg-cyan"\]/);
});
