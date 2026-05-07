import type { AnswerState } from "../data/mock.ts";

export type ResultTuningMode = "quieter" | "cheaper" | "beginner";

export type ResultTuningOption = {
  mode: ResultTuningMode;
  label: string;
};

export const RESULT_TUNING_OPTIONS: ResultTuningOption[] = [
  { mode: "quieter", label: "更安静一点" },
  { mode: "cheaper", label: "预算低一点" },
  { mode: "beginner", label: "更适合新手" },
];

export const RESULT_TUNING_APPLIED_TAGS = RESULT_TUNING_OPTIONS.map((option) =>
  getResultTuningAppliedTag(option.mode),
);

export function getResultTuningAppliedTag(mode: ResultTuningMode) {
  switch (mode) {
    case "quieter":
      return "微调：更安静";
    case "cheaper":
      return "微调：预算更低";
    case "beginner":
      return "微调：新手友好";
  }
}

function lowerBudget(budget: [number, number] | undefined): [number, number] {
  if (!budget) return [0, 300];
  const [, max] = budget;
  if (max <= 100) return [0, 100];
  if (max <= 300) return [0, 100];
  if (max <= 500) return [100, 300];
  return [100, 500];
}

export function tuneResultAnswers(
  answers: AnswerState,
  mode: ResultTuningMode,
): AnswerState {
  const nextTags = [...answers.tags];
  const addTag = (tag: string) => {
    if (!nextTags.includes(tag)) nextTags.push(tag);
  };

  switch (mode) {
    case "quieter":
      addTag(getResultTuningAppliedTag(mode));
      return {
        ...answers,
        maxDb: Math.min(answers.maxDb ?? 50, 45),
        tags: nextTags,
      };
    case "cheaper":
      addTag(getResultTuningAppliedTag(mode));
      return {
        ...answers,
        budget: lowerBudget(answers.budget),
        tags: nextTags,
      };
    case "beginner":
      addTag(getResultTuningAppliedTag(mode));
      return {
        ...answers,
        motorType: "gentle",
        waterproof: Math.max(answers.waterproof ?? 0, 6),
        tags: nextTags,
      };
  }
}

export function applyResultTuningModes(
  baseAnswers: AnswerState,
  modes: ResultTuningMode[],
): AnswerState {
  return modes.reduce((currentAnswers, mode) => {
    return tuneResultAnswers(currentAnswers, mode);
  }, {
    ...baseAnswers,
    tags: [...baseAnswers.tags],
  });
}
