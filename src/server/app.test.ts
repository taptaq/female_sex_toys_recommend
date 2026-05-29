import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

test("server startup eagerly initializes the recommender schema", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "src/server/app.ts"), "utf8");
  const ensureServerReadyBlock =
    source.match(/export function ensureServerReady\(\)\s*\{[\s\S]*?\n\}/)?.[0] ?? "";

  assert.match(ensureServerReadyBlock, /export function ensureServerReady\(\)/);
  assert.match(ensureServerReadyBlock, /await ensureRecommenderItemsSchema\(pool\)/);
  assert.ok(
    ensureServerReadyBlock.indexOf("ensureDatabaseConfigured();") <
      ensureServerReadyBlock.indexOf("await ensureRecommenderItemsSchema(pool)"),
    "database config should be checked before schema init",
  );
});
