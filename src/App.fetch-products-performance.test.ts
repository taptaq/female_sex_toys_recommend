import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("fetchProducts no longer adds staged timeout delays after the library API succeeds", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "src/App.tsx"), "utf8");

  assert.match(source, /const requestUrl = force[\s\S]*\/api\/recommender\/toys\?refresh=1/);
  assert.match(source, /fetch\(requestUrl\)/);
  assert.doesNotMatch(
    source,
    /fetch\(requestUrl\)[\s\S]*setTimeout\([\s\S]*1200[\s\S]*setTimeout\(/,
  );
});
