import type { AnswerState, Question } from "../data/mock.ts";

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

export function removeQuizQuestionAnswer(
  answers: AnswerState,
  question: Question,
): AnswerState {
  const optionTags = new Set(question.options.map((option) => option.tag));
  const answerPatchFields = new Set<keyof Omit<AnswerState, "tags">>();

  for (const option of question.options) {
    for (const field of Object.keys(option.answerPatch ?? {}) as (keyof Omit<
      AnswerState,
      "tags"
    >)[]) {
      answerPatchFields.add(field);
    }
  }

  const nextAnswers: AnswerState = {
    ...answers,
    tags: answers.tags.filter((tag) => !optionTags.has(tag)),
  };

  delete nextAnswers[question.field];
  for (const field of answerPatchFields) {
    delete nextAnswers[field];
  }

  return nextAnswers;
}
