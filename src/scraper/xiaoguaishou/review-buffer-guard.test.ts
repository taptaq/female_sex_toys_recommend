import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldPersistXiaoguaishouReviewEntry } from './review-buffer-guard';

test('shouldPersistXiaoguaishouReviewEntry rejects empty or placeholder raw descriptions', () => {
  assert.equal(shouldPersistXiaoguaishouReviewEntry(''), false);
  assert.equal(shouldPersistXiaoguaishouReviewEntry('   '), false);
  assert.equal(shouldPersistXiaoguaishouReviewEntry('信息未获取'), false);
});

test('shouldPersistXiaoguaishouReviewEntry accepts parameter or OCR detail text', () => {
  assert.equal(shouldPersistXiaoguaishouReviewEntry('[参数信息]\n材质: 硅胶'), true);
  assert.equal(shouldPersistXiaoguaishouReviewEntry('[图文提取]\n动力规格: 震动'), true);
});
