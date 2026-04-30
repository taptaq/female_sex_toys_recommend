import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("vite dev server keeps port 3009 exclusive instead of auto-switching", () => {
  const configSource = fs.readFileSync(
    path.resolve(process.cwd(), "vite.config.ts"),
    "utf8",
  );

  assert.match(configSource, /port:\s*3009/);
  assert.match(configSource, /strictPort:\s*true/);
});
