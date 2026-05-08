import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("library page filter hot path uses precomputed type codes instead of reclassifying every product", () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), "src/pages/LibraryPage.tsx"),
    "utf8",
  );

  assert.match(source, /const matchType =[\s\S]*product\.typeCode === effectiveFilterType/);
  assert.match(
    source,
    /const matchSubtype =[\s\S]*product\.subtypeCode === effectiveFilterSubtype/,
  );
  assert.doesNotMatch(
    source,
    /\.filter\(\(product\) => \{[\s\S]*resolveLibraryTypeCode\(/,
  );
});
