import test from "node:test";
import assert from "node:assert/strict";
import { applyResultTuningModes, tuneResultAnswers } from "./result-tuning.ts";

test("tuneResultAnswers tightens noise preference without loosening an existing quieter answer", () => {
  assert.deepEqual(
    tuneResultAnswers({ maxDb: 40, tags: [] }, "quieter"),
    {
      maxDb: 40,
      tags: ["微调：更安静"],
    },
  );

  assert.equal(tuneResultAnswers({ tags: [] }, "quieter").maxDb, 45);
});

test("tuneResultAnswers lowers budget into a cheaper nearby range", () => {
  assert.deepEqual(
    tuneResultAnswers({ budget: [300, 10000], tags: [] }, "cheaper").budget,
    [100, 500],
  );

  assert.deepEqual(
    tuneResultAnswers({ budget: [100, 300], tags: [] }, "cheaper").budget,
    [0, 100],
  );
});

test("tuneResultAnswers makes beginner-friendly preferences gentle and easier to clean", () => {
  assert.deepEqual(
    tuneResultAnswers({ motorType: "strong", waterproof: 5, tags: [] }, "beginner"),
    {
      motorType: "gentle",
      waterproof: 6,
      tags: ["微调：新手友好"],
    },
  );
});

test("applyResultTuningModes always rebuilds from the same base answers", () => {
  assert.deepEqual(
    applyResultTuningModes(
      {
        maxDb: 52,
        budget: [300, 10000],
        motorType: "strong",
        waterproof: 5,
        tags: ["静音"],
      },
      ["quieter", "cheaper", "beginner"],
    ),
    {
      maxDb: 45,
      budget: [100, 500],
      motorType: "gentle",
      waterproof: 6,
      tags: ["静音", "微调：更安静", "微调：预算更低", "微调：新手友好"],
    },
  );
});
