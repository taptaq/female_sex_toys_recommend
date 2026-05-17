export type ShelfScrollStateInput = {
  currentCount: number;
  previousCount: number;
  unchangedRounds: number;
  maxItems: number;
};

export type ShelfScrollStateResult = {
  shouldContinue: boolean;
  unchangedRounds: number;
  reason: 'growing' | 'stable' | 'shelf_stable' | 'max_items_reached';
};

const MAX_UNCHANGED_SHELF_ROUNDS = 2;

export function nextShelfScrollState(input: ShelfScrollStateInput): ShelfScrollStateResult {
  if (input.currentCount >= input.maxItems) {
    return {
      shouldContinue: false,
      unchangedRounds: input.unchangedRounds,
      reason: 'max_items_reached',
    };
  }

  if (input.currentCount > input.previousCount) {
    return {
      shouldContinue: true,
      unchangedRounds: 0,
      reason: 'growing',
    };
  }

  const nextUnchangedRounds = input.unchangedRounds + 1;
  if (nextUnchangedRounds > MAX_UNCHANGED_SHELF_ROUNDS) {
    return {
      shouldContinue: false,
      unchangedRounds: nextUnchangedRounds,
      reason: 'shelf_stable',
    };
  }

  return {
    shouldContinue: true,
    unchangedRounds: nextUnchangedRounds,
    reason: 'stable',
  };
}
