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

test("feedback route wires private screenshot storage and email notifier", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "src/server/app.ts"), "utf8");

  assert.match(source, /createFeedbackScreenshotStorage/);
  assert.match(source, /bucket: process\.env\.FEEDBACK_SCREENSHOT_BUCKET \|\| "feedback-screenshots"/);
  assert.match(source, /createFeedbackEmailNotifier/);
  assert.match(source, /provider: process\.env\.FEEDBACK_NOTIFY_PROVIDER === "smtp" \? "smtp" : "resend"/);
  assert.match(source, /to: process\.env\.FEEDBACK_NOTIFY_TO \|\| "2902716634@qq\.com"/);
  assert.match(source, /host: process\.env\.SMTP_HOST/);
  assert.match(source, /user: process\.env\.SMTP_USER/);
  assert.match(source, /pass: process\.env\.SMTP_PASS/);
  assert.match(source, /screenshotStorage: getFeedbackScreenshotStorage\(\)/);
  assert.match(source, /notifier: getFeedbackEmailNotifier\(\)/);
});

test("server accepts feedback screenshot payloads and reports oversize requests clearly", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "src/server/app.ts"), "utf8");

  assert.match(source, /const JSON_BODY_LIMIT = "25mb"/);
  assert.match(source, /app\.use\(express\.json\(\{ limit: JSON_BODY_LIMIT \}\)\)/);
  assert.match(source, /error\.type === "entity\.too\.large"/);
  assert.match(source, /res\.status\(413\)\.json/);
  assert.match(source, /反馈截图太大/);
});
