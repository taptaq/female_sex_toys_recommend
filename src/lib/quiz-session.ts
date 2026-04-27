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
