import test from "node:test";
import assert from "node:assert/strict";
import { createClearedQuizSessionState, rewindQuizAnswer } from "./quiz-session.ts";

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

test("rewindQuizAnswer removes the latest tag and clears the previous question fields", () => {
  const result = rewindQuizAnswer(
    {
      gender: "female",
      experienceLevel: "sensitive",
      physicalForm: "external",
      tags: ["女性向", "外部震动/吮吸"],
    },
    {
      field: "experienceLevel",
      answerPatchFields: ["physicalForm"],
    },
  );

  assert.deepEqual(result, {
    gender: "female",
    tags: ["女性向"],
  });
});
