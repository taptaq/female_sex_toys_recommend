import test from "node:test";
import assert from "node:assert/strict";
import * as quizData from "./mock.ts";

test("getActiveQuestions returns the female-only flow immediately", () => {
  assert.equal(typeof quizData.getActiveQuestions, "function");

  const questions = quizData.getActiveQuestions?.();
  const ids = questions?.map((question) => question.id);

  assert.deepEqual(ids, [
    "female-route",
    "female-experience",
    "female-temperature",
    "female-noise",
    "female-cleanup",
    "female-budget",
    "female-appearance",
  ]);
});

test("choice-heavy questions include a help-me-decide option that does not force a preference", () => {
  const questions = quizData.getActiveQuestions?.() ?? [];
  const routeQuestion = questions.find((question) => question.id === "female-route");
  const uncertainOption = routeQuestion?.options.find((option) =>
    option.label.includes("帮我判断"),
  );

  assert.ok(uncertainOption);
  assert.equal(uncertainOption?.value, undefined);
  assert.deepEqual(uncertainOption?.answerPatch, {});
});

test("female-only flow removes audience, male, and couple question branches", () => {
  const source = Object.values(quizData)
    .map((value) => JSON.stringify(value))
    .join("\n");

  assert.doesNotMatch(source, /男性向探索|情侣共玩探索|male-drive|couple-interaction/);
  assert.doesNotMatch(source, /field":"gender"/);
});

test("female temperature question keeps heating preference lightweight", () => {
  const questions = quizData.getActiveQuestions?.() ?? [];
  const temperatureQuestion = questions.find((question) => question.id === "female-temperature");

  assert.equal(temperatureQuestion?.field, "temperaturePreference");
  assert.match(temperatureQuestion?.subtitle ?? "", /温热感/);
  assert.deepEqual(
    temperatureQuestion?.options.map((option) => option.value),
    ["want", "avoid", "neutral"],
  );
});
