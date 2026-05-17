import test from 'node:test';
import assert from 'node:assert/strict';

import { nextShelfScrollState } from './list-collection';

test('nextShelfScrollState keeps scrolling while new shelf cards appear', () => {
  const first = nextShelfScrollState({
    currentCount: 30,
    previousCount: 0,
    unchangedRounds: 0,
    maxItems: 200,
  });
  assert.equal(first.shouldContinue, true);
  assert.equal(first.unchangedRounds, 0);

  const second = nextShelfScrollState({
    currentCount: 45,
    previousCount: 30,
    unchangedRounds: 1,
    maxItems: 200,
  });
  assert.equal(second.shouldContinue, true);
  assert.equal(second.unchangedRounds, 0);
});

test('nextShelfScrollState tolerates a few unchanged shelf rounds before stopping', () => {
  const firstIdle = nextShelfScrollState({
    currentCount: 30,
    previousCount: 30,
    unchangedRounds: 0,
    maxItems: 200,
  });
  assert.equal(firstIdle.shouldContinue, true);
  assert.equal(firstIdle.unchangedRounds, 1);

  const secondIdle = nextShelfScrollState({
    currentCount: 30,
    previousCount: 30,
    unchangedRounds: firstIdle.unchangedRounds,
    maxItems: 200,
  });
  assert.equal(secondIdle.shouldContinue, true);
  assert.equal(secondIdle.unchangedRounds, 2);

  const thirdIdle = nextShelfScrollState({
    currentCount: 30,
    previousCount: 30,
    unchangedRounds: secondIdle.unchangedRounds,
    maxItems: 200,
  });
  assert.equal(thirdIdle.shouldContinue, false);
  assert.equal(thirdIdle.reason, 'shelf_stable');
});

test('nextShelfScrollState stops once max item cap is reached', () => {
  const result = nextShelfScrollState({
    currentCount: 200,
    previousCount: 180,
    unchangedRounds: 0,
    maxItems: 200,
  });
  assert.equal(result.shouldContinue, false);
  assert.equal(result.reason, 'max_items_reached');
});
