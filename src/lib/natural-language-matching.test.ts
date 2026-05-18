import assert from "node:assert/strict";
import test from "node:test";

import { deriveAnswersFromNaturalLanguage } from "./natural-language-matching.ts";

test("deriveAnswersFromNaturalLanguage extracts common preference signals", () => {
  const result = deriveAnswersFromNaturalLanguage(
    "想要一个更静音、预算 300 以内、适合女生新手、最好容易清洁的产品。",
  );

  assert.equal(result.answers.gender, "female");
  assert.equal(result.answers.maxDb, 50);
  assert.equal(result.answers.waterproof, 7);
  assert.deepEqual(result.answers.budget, [0, 300]);
  assert.equal(result.answers.experienceLevel, "sensitive");
  assert.equal(result.answers.physicalForm, undefined);
  assert.ok(result.answers.tags.includes("女性向"));
  assert.ok(result.answers.tags.includes("温柔慢热"));
});

test("deriveAnswersFromNaturalLanguage extracts couples and remote signals", () => {
  const result = deriveAnswersFromNaturalLanguage(
    "想找情侣共用、异地也能互动的产品，不要太吵，外观别太高调。",
  );

  assert.equal(result.answers.gender, "unisex");
  assert.equal(result.answers.interactionMode, "remote");
  assert.equal(result.answers.maxDb, 50);
  assert.equal(result.answers.appearance, "normal");
  assert.ok(result.answers.tags.includes("情侣共玩"));
  assert.ok(result.answers.tags.includes("远程互动"));
});

test("deriveAnswersFromNaturalLanguage keeps sensation words in the raw query instead of forcing physical form", () => {
  const result = deriveAnswersFromNaturalLanguage(
    "我是女生，想找一个吮吸感更强一点的，波形更多的，噪音适中的。",
  );

  assert.equal(result.answers.gender, "female");
  assert.equal(result.answers.physicalForm, undefined);
  assert.equal(result.prompt, "我是女生，想找一个吮吸感更强一点的，波形更多的，噪音适中的。");
});
