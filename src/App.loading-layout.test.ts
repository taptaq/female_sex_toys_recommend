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
