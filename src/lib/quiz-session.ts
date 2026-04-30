import type { AnswerState } from "../data/mock.ts";

export function createClearedQuizSessionState() {
  return {
    step: -1,
    answers: { tags: [] as string[] },
    topProducts: [],
    backupProducts: [],
    recommendationTips: [],
    shoppingGuidance: [],
  };
}

export function rewindQuizAnswer(
  answers: AnswerState,
  previousQuestion: {
    field: keyof AnswerState;
    answerPatchFields?: (keyof Omit<AnswerState, "tags">)[];
  },
): AnswerState {
  const { tags, ...restAnswers } = answers;
  const nextAnswers: AnswerState = {
    ...restAnswers,
    tags: tags.slice(0, -1),
  };

  delete nextAnswers[previousQuestion.field];
  for (const field of previousQuestion.answerPatchFields ?? []) {
    delete nextAnswers[field];
  }

  return nextAnswers;
}
