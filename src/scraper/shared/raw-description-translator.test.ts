import test from 'node:test';
import assert from 'node:assert/strict';
import {
  replaceUrlsWithPlaceholders,
  restoreUrlPlaceholders,
} from './raw-description-translator.ts';

test('replaceUrlsWithPlaceholders protects raw URLs and restoreUrlPlaceholders recovers them exactly', () => {
  const source = [
    'Manual English https://dame.com/cdn/shop/files/Eva_Manual-_English.pdf?v=1',
    'https://dame.com/cdn/shop/files/Eva_Manual-_French.pdf?v=2',
  ].join('\n');

  const replaced = replaceUrlsWithPlaceholders(source);
  assert.equal(replaced.placeholders.length, 2);
  assert.match(replaced.text, /【链接1】/);
  assert.match(replaced.text, /【链接2】/);
  assert.doesNotMatch(replaced.text, /https?:\/\//);

  const restored = restoreUrlPlaceholders(replaced.text, replaced.placeholders);
  assert.equal(restored, source);
});
