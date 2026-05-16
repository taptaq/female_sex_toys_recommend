import test from 'node:test';
import assert from 'node:assert/strict';
import * as cleaner from './cleaner.ts';

const TEST_FX = {
  rate: 7.2,
  source: 'test-fixture',
  date: '2026-05-16',
};

test('resolveRmbPrice converts USD prices to rounded RMB', () => {
  assert.equal(cleaner.resolveRmbPrice(48, 7.2), 346);
  assert.equal(cleaner.resolveRmbPrice(102, 7.2), 734);
  assert.equal(cleaner.resolveRmbPrice(null, 7.2), null);
});

test('buildNormalizedSpecs converts USD prices and preserves FX metadata', () => {
  const specs = cleaner.buildNormalizedSpecs(
    {
      name: 'Puff',
      subtitle: 'Compact suction vibe',
      priceUsd: 48,
      originalPriceUsd: 58,
      rawDescription: 'Compact suction vibrator with 5 intensities, quiet motor, and waterproof body-safe silicone.',
      genderHint: 'female',
      categoryHints: ['Vibrator', 'External'],
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
  assert.ok(specs.function_tags.includes('吸吮刺激'));
  assert.ok(specs.function_tags.includes('防水'));
});

test('buildNormalizedSpecs keeps bundle sets from collapsing into unknown when toy signals are strong', () => {
  const specs = cleaner.buildNormalizedSpecs(
    {
      name: 'Best Sellers',
      subtitle: 'Bundle set',
      priceUsd: 102,
      rawDescription: 'Includes Puff suction vibrator, Bender flexible vibrator, and a storage bag.',
      categoryHints: ['Sets', 'Vibrating'],
    },
    TEST_FX,
  );

  assert.notEqual(specs.type_code, 'unknown');
  assert.ok(specs.function_tags.includes('套装'));
});

test('formatUnboundRawDescription separates common section labels', () => {
  const formatted = cleaner.formatUnboundRawDescription(
    'Features compact suction vibe Details 5 intensities Shipping discreet packaging',
  );

  assert.equal(
    formatted,
    'Features: compact suction vibe\nDetails: 5 intensities\nShipping: discreet packaging',
  );
});
