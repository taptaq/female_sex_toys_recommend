import test from "node:test";
import assert from "node:assert/strict";
import {
  createClearedQuizSessionState,
  removeQuizQuestionAnswer,
  rewindQuizAnswer,
} from "./quiz-session.ts";

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

test("removeQuizQuestionAnswer clears a targeted question value, option tags, and answer patch fields", () => {
  const result = removeQuizQuestionAnswer(
    {
      gender: "female",
      experienceLevel: "sensitive",
      physicalForm: "external",
      motorType: "gentle",
      tags: ["女性向", "外部震动/吮吸", "温柔慢热", "进阶级"],
    },
    {
      id: "female-route",
      title: "刺激路径",
      subtitle: "",
      field: "experienceLevel",
      options: [
        {
          label: "外部细节优先",
          value: "sensitive",
          tag: "外部震动/吮吸",
          answerPatch: { physicalForm: "external" },
        },
        {
          label: "内外一起到位",
          value: "intense",
          tag: "复合机型",
          answerPatch: { physicalForm: "composite" },
        },
      ],
    },
  );

  assert.deepEqual(result, {
    gender: "female",
    motorType: "gentle",
    tags: ["女性向", "温柔慢热", "进阶级"],
  });
});
