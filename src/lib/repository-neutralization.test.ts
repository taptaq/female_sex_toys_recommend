import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

test("core project identifiers use neutral naming", () => {
  const packageSource = read("package.json");
  const appSource = read("src/App.tsx");
  const serverSource = read("src/server/index.ts");
  const schemaSource = read("prisma/schema.prisma");

  assert.doesNotMatch(packageSource, /inner_space_toy_recommender/i);
  assert.doesNotMatch(packageSource, /db:backfill:\x74oy-max-db/i);
  assert.doesNotMatch(appSource, /\/api\/recommender\/items\b/i);
  assert.doesNotMatch(serverSource, /\/api\/recommender\/items\b/i);
  assert.doesNotMatch(serverSource, /\brecommender_items\b/i);
  assert.doesNotMatch(schemaSource, /\brecommender_items\b/i);

  assert.match(packageSource, /inner_space_gear_navigator/i);
  assert.match(packageSource, /db:backfill:item-max-db/i);
  assert.match(appSource, /\/api\/recommender\/toys\b/i);
  assert.match(serverSource, /\/api\/recommender\/toys\b/i);
  assert.match(serverSource, /\brecommender_\x74oys\b/i);
  assert.match(schemaSource, /\brecommender_\x74oys\b/i);
});

test("recommender items keep canonical names and expose a separate safe display field", () => {
  const serverSource = read("src/server/index.ts");
  const schemaSource = read("prisma/schema.prisma");

  assert.match(schemaSource, /\bsafe_display_name\b/i);
  assert.match(serverSource, /\bsafe_display_name\b/i);
  assert.match(serverSource, /\bsafeDisplayName:\s*t\.safe_display_name\b/);
  assert.match(serverSource, /\bname:\s*t\.name\b/);
});

test("scraper cleaners persist safe display names alongside canonical names", () => {
  const cleanerFiles = [
    "src/scraper/darentang/cleaner.ts",
    "src/scraper/iroha/cleaner.ts",
    "src/scraper/kistoy/cleaner.ts",
    "src/scraper/lelo/cleaner.ts",
    "src/scraper/lovehoney-official/cleaner.ts",
    "src/scraper/lovense-official/cleaner.ts",
    "src/scraper/nomitang-official/cleaner.ts",
    "src/scraper/romp/cleaner.ts",
    "src/scraper/satisfyer-official/cleaner.ts",
    "src/scraper/svakom-official/cleaner.ts",
    "src/scraper/tenga/cleaner.ts",
    "src/scraper/wangyichunfeng/cleaner.ts",
    "src/scraper/wevibe/cleaner.ts",
    "src/scraper/wevibe-official/cleaner.ts",
    "src/scraper/womanizer-official/cleaner.ts",
    "src/scraper/xiaoguaishou/cleaner.ts",
    "src/scraper/zalo-official/cleaner.ts",
    "src/scraper/zuiqingfeng/cleaner.ts",
  ];

  for (const file of cleanerFiles) {
    const source = read(file);
    assert.match(source, /\bsafe_display_name:\s*buildSafeDisplayName\(/);
    assert.doesNotMatch(source, /\bprisma\.recommender_items\b/);
    assert.match(source, /\bprisma\.recommender_toys\b/);
  }
});

test("repo ships a backfill script for safe display names", () => {
  const packageSource = read("package.json");
  const scriptSource = read("src/db/backfill-safe-display-name.ts");
  const maxDbScriptSource = read("src/db/backfill-item-max-db.ts");
  const syncMockSource = read("src/db/syncMock.ts");

  assert.match(packageSource, /db:backfill:safe-display-name/);
  assert.match(scriptSource, /UPDATE public\.recommender_toys/);
  assert.match(scriptSource, /safe_display_name/);
  assert.match(maxDbScriptSource, /UPDATE public\.recommender_toys/);
  assert.match(syncMockSource, /FROM public\.recommender_toys/);
});

test("repo ships a recovery backfill for qq-corrupted product names", () => {
  const packageSource = read("package.json");
  const scriptSource = read("src/db/backfill-reclean-item-names.ts");

  assert.match(packageSource, /db:backfill:reclean-item-names/);
  assert.match(scriptSource, /recommender_toys/);
  assert.doesNotMatch(scriptSource, /recommender_items/);
  assert.match(scriptSource, /recoverCanonicalProductName/);
  assert.match(scriptSource, /UPDATE public\.products/);
});

test("repo ships a type code backfill script for recommender_toys", () => {
  const packageSource = read("package.json");
  const scriptSource = read("src/db/backfill-item-type-code.ts");

  assert.match(packageSource, /db:backfill:item-type-code/);
  assert.match(scriptSource, /UPDATE public\.recommender_toys/);
  assert.match(scriptSource, /classifyLibraryTypeCode/);
  assert.doesNotMatch(scriptSource, /recommender_items/);
});

test("repo ships a contaminant purge script for recommender_toys", () => {
  const packageSource = read("package.json");
  const scriptSource = read("src/db/purge-recommender-toy-contaminants.ts");

  assert.match(packageSource, /db:purge:contaminant-toys/);
  assert.match(scriptSource, /DELETE FROM public\.recommender_toys/);
  assert.match(scriptSource, /selectContaminantToyIds/);
  assert.doesNotMatch(scriptSource, /recommender_items/);
});

test("public metadata avoids direct high-risk wording", () => {
  const metadataSource = read("metadata.json");
  const readmeSource = read("README.md");

  assert.doesNotMatch(metadataSource, /\x54oy Recommender|\x61dult toys?|\x73ex-toys?/i);
  assert.doesNotMatch(readmeSource, /\x54oy Recommender|\u60c5\u8da3|\u81ea\u6170\u5668|\u6210\u4eba\u73a9\u5177|\x73ex-toys?|\x61dult toys?/i);

  assert.match(metadataSource, /Gear Navigator|personal devices/i);
});
