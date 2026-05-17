import test from 'node:test';
import assert from 'node:assert/strict';
import * as cleaner from './cleaner.ts';

const TEST_FX = {
  rate: 7.2,
  source: 'test-fixture',
  date: '2026-05-17',
  currency: 'USD',
};

test('resolveRmbPrice converts USD prices to rounded RMB', () => {
  assert.equal(cleaner.resolveRmbPrice(129.99, 7.2), 936);
  assert.equal(cleaner.resolveRmbPrice(89, 7.2), 641);
  assert.equal(cleaner.resolveRmbPrice(null, 7.2), null);
});

test('buildNormalizedSpecs converts USD prices and preserves FX metadata', () => {
  const specs = cleaner.buildNormalizedSpecs(
    {
      name: 'Magic Flamingo Luxury Smart App Controlled Vibrator',
      subtitle: 'Smart Vibrator',
      priceSourceAmount: 129.99,
      originalPriceSourceAmount: 159.99,
      priceCurrency: 'USD',
      rawDescription: 'Body-safe silicone vibrator with app control and whisper quiet motor.',
      genderHint: 'female',
      categoryHints: ['App Control'],
    },
    TEST_FX,
  );

  assert.equal(specs.price_source_currency, 'USD');
  assert.equal(specs.price_source_amount, 129.99);
  assert.equal(specs.price_rmb, 936);
  assert.equal(specs.original_price_rmb, 1152);
  assert.equal(specs.fx_rate_to_cny, 7.2);
});

test('buildNormalizedSpecs infers silicone and smart-control tags', () => {
  const specs = cleaner.buildNormalizedSpecs(
    {
      name: 'Magic Flamingo Luxury Smart App Controlled Vibrator',
      subtitle: 'Smart Vibrator',
      priceSourceAmount: 129.99,
      originalPriceSourceAmount: null,
      priceCurrency: 'USD',
      rawDescription: 'Body-safe silicone vibrator with app control, waterproof design and whisper quiet motor.',
      genderHint: 'female',
      categoryHints: ['App Control'],
    },
    TEST_FX,
  );

  assert.equal(specs.material, '硅胶');
  assert.ok(specs.function_tags.includes('智能控制'));
  assert.ok(specs.function_tags.includes('防水'));
});

test('buildNormalizedSpecs infers wearable/internal form for kegel products', () => {
  const specs = cleaner.buildNormalizedSpecs(
    {
      name: 'Eidolon Smart Kegel Trainer',
      subtitle: 'Kegel Trainer',
      priceSourceAmount: 89,
      originalPriceSourceAmount: null,
      priceCurrency: 'USD',
      rawDescription: 'Wearable pelvic floor trainer with silicone body and app guidance.',
      genderHint: 'female',
      categoryHints: ['Kegel'],
    },
    TEST_FX,
  );

  assert.equal(specs.physical_form, 'internal');
  assert.ok(specs.function_tags.includes('穿戴'));
});
