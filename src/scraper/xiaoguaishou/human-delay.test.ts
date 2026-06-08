import test from 'node:test';
import assert from 'node:assert/strict';
import { getHumanDelayMs } from './human-delay';

test('getHumanDelayMs returns the lower bound when random is zero', () => {
  assert.equal(getHumanDelayMs({ minMs: 1200, maxMs: 3600 }, () => 0), 1200);
});

test('getHumanDelayMs returns the upper bound when random is one', () => {
  assert.equal(getHumanDelayMs({ minMs: 1200, maxMs: 3600 }, () => 1), 3600);
});

test('getHumanDelayMs normalizes inverted and negative ranges', () => {
  assert.equal(getHumanDelayMs({ minMs: -100, maxMs: -10 }, () => 0.5), 0);
  assert.equal(getHumanDelayMs({ minMs: 5000, maxMs: 1000 }, () => 1), 5000);
});
