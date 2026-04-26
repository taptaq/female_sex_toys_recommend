import test from 'node:test';
import assert from 'node:assert/strict';
import * as cleaner from './cleaner.ts';

test('resolveRmbPrice converts USD to rounded RMB', () => {
  assert.equal(cleaner.resolveRmbPrice(229, 7.2), 1649);
  assert.equal(cleaner.resolveRmbPrice(null, 7.2), null);
  assert.equal(cleaner.resolveRmbPrice(0, 7.2), null);
});

test('buildNormalizedSpecs infers price, material, waterproof, tags, and gender', () => {
  const specs = cleaner.buildNormalizedSpecs({
    name: 'Womanizer Next',
    subtitle: '3D Pleasure Air Clitoral Stimulator',
    brand: 'Womanizer',
    priceUsd: 229,
    rawDescription: `
[基础信息]
品牌: Womanizer
副标题: 3D Pleasure Air Clitoral Stimulator

[卖点详情]
Waterproof IPX7: You want to dive deeper? Since your Womanizer is IPX7 waterproof.
Smart Silence: The toy only starts when it meets your skin.
Soft Silicone: Fully coated in soft-touch silicone that feels great on the skin.

[规格参数]
规格: Materials: Body-safe silicone
规格: Run Time: 240 min
    `,
    genderHint: 'female',
  });

  assert.equal(specs.price_usd, 229);
  assert.equal(specs.price_rmb, 1649);
  assert.equal(specs.gender, 'female');
  assert.equal(specs.waterproof, 7);
  assert.equal(specs.material, '硅胶');
  assert.deepEqual(specs.function_tags, ['吮吸刺激', '静音', '防水']);
  assert.equal(specs.physical_form, 'external');
  assert.equal(specs.motor_type, 'gentle');
});

test('buildNormalizedSpecs defaults toy max_db to 50 when no noise clue is present', () => {
  const specs = cleaner.buildNormalizedSpecs({
    name: 'Womanizer Liberty 2',
    subtitle: 'Discreet Clitoral Stimulator',
    brand: 'Womanizer',
    priceUsd: 109,
    rawDescription: `
[基础信息]
品牌: Womanizer
副标题: Discreet Clitoral Stimulator

[卖点详情]
Soft Silicone: Body-safe silicone for everyday comfort.
Waterproof Design: Easy to clean after use.
    `,
    genderHint: 'female',
  });

  assert.equal(specs.max_db, 50);
});

test('inferBrandFromItem respects product brand signals from source content', () => {
  assert.equal(cleaner.inferBrandFromItem({ name: 'We-Vibe Sync 2', rawDescription: '' }), 'We-Vibe');
  assert.equal(cleaner.inferBrandFromItem({ name: 'Arcwave Pow', rawDescription: '' }), 'Arcwave');
  assert.equal(cleaner.inferBrandFromItem({ name: 'Next', rawDescription: '品牌: Womanizer' }), 'Womanizer');
});
