import test from 'node:test';
import assert from 'node:assert/strict';
import * as cleaner from './cleaner.ts';

const TEST_FX = {
  rate: 7.2,
  source: 'test-fixture',
  date: '2026-05-16',
};

test('resolveRmbPrice converts USD prices to rounded RMB', () => {
  assert.equal(cleaner.resolveRmbPrice(69, 7.2), 497);
  assert.equal(cleaner.resolveRmbPrice(48, 7.2), 346);
  assert.equal(cleaner.resolveRmbPrice(null, 7.2), null);
});

test('buildNormalizedSpecs converts USD prices to RMB and preserves fx metadata', () => {
  const specs = cleaner.buildNormalizedSpecs(
    {
      name: 'Bullet',
      subtitle: 'Compact personal vibrator',
      priceUsd: 48,
      originalPriceUsd: 58,
      rawDescription: 'Compact bullet vibrator with quiet motor and USB charging.',
      genderHint: 'female',
    },
    TEST_FX,
  );

  assert.equal(specs.price_usd, 48);
  assert.equal(specs.price_rmb, 346);
  assert.equal(specs.original_price_usd, 58);
  assert.equal(specs.original_price_rmb, 418);
  assert.equal(specs.fx_rate_usd_cny, 7.2);
  assert.equal(specs.fx_rate_source, 'test-fixture');
  assert.equal(specs.fx_rate_date, '2026-05-16');
  assert.ok(specs.function_tags.includes('伪装型强'));
  assert.ok(specs.function_tags.includes('项链款'));
});

test('buildNormalizedSpecs does not misclassify wearable necklace vibrators as pure accessories', () => {
  const specs = cleaner.buildNormalizedSpecs(
    {
      name: 'Vesper',
      subtitle: 'Wearable necklace vibrator',
      priceUsd: 69,
      rawDescription:
        'Vesper is a wearable necklace vibrator designed for discreet pleasure, quiet vibration, and USB charging.',
      categoryHints: ['Jewelry Vibrators'],
    },
    TEST_FX,
  );

  assert.notEqual(specs.type_code, 'care_accessory');
  assert.notEqual(specs.type_code, 'unknown');
  assert.ok(specs.function_tags.includes('伪装型强'));
  assert.ok(specs.function_tags.includes('项链款'));
  assert.ok(specs.function_tags.includes('穿戴'));
  assert.ok(specs.function_tags.includes('高隐蔽'));
});

test('buildNormalizedSpecs keeps classic toy-like products in toy categories', () => {
  const specs = cleaner.buildNormalizedSpecs(
    {
      name: 'Wink',
      subtitle: 'Finger vibrator',
      priceUsd: 55,
      rawDescription: 'A compact finger vibrator for clitoral stimulation with quiet, rechargeable power.',
      genderHint: 'female',
    },
    TEST_FX,
  );

  assert.notEqual(specs.type_code, 'care_accessory');
  assert.notEqual(specs.type_code, 'unknown');
  assert.ok(specs.function_tags.includes('震动刺激'));
  assert.ok(specs.function_tags.includes('阴蒂刺激'));
});

test('formatLovecraveRawDescription keeps broad product sections on separate lines', () => {
  const formatted = cleaner.formatLovecraveRawDescription(
    'Features body-safe silicone Details wearable necklace vibrator Specifications USB rechargeable',
  );

  assert.equal(
    formatted,
    'Features: body-safe silicone\nDetails: wearable necklace vibrator\nSpecifications: USB rechargeable',
  );
});
