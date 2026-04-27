import test from "node:test";
import assert from "node:assert/strict";
import { createClearedQuizSessionState } from "./quiz-session.ts";

test("createClearedQuizSessionState resets quiz progress and recommendations", () => {
  assert.deepEqual(createClearedQuizSessionState(), {
    step: -1,
    answers: { tags: [] },
    topProducts: [],
    backupProducts: [],
    recommendationTips: [],
    shoppingGuidance: [],
  });
});
