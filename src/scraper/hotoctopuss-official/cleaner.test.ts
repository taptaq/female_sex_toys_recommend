import test from 'node:test';
import assert from 'node:assert/strict';
import * as cleaner from './cleaner.ts';

const TEST_FX = {
  rate: 9.1,
  source: 'test-fixture',
  date: '2026-05-17',
  currency: 'GBP',
};

test('resolveRmbPrice converts GBP prices to rounded RMB', () => {
  assert.equal(cleaner.resolveRmbPrice(99.99, 9.1), 910);
  assert.equal(cleaner.resolveRmbPrice(129, 9.1), 1174);
  assert.equal(cleaner.resolveRmbPrice(null, 9.1), null);
});

test('buildNormalizedSpecs converts GBP prices and preserves FX metadata', () => {
  const specs = cleaner.buildNormalizedSpecs(
    {
      name: 'PULSE SOLO ESSENTIAL',
      subtitle: 'Vibrating Penis Masturbator',
      priceSourceAmount: 99.99,
      originalPriceSourceAmount: null,
      priceCurrency: 'GBP',
      rawDescription: 'Male masturbator with PulsePlate Technology, waterproof body, and USB rechargeable battery.',
      genderHint: 'male',
      categoryHints: ['H.O. Sex Toys'],
    },
    TEST_FX,
  );

  assert.equal(specs.price_source_currency, 'GBP');
  assert.equal(specs.price_source_amount, 99.99);
  assert.equal(specs.price_rmb, 910);
  assert.equal(specs.gender, 'male');
  assert.equal(specs.fx_rate_to_cny, 9.1);
  assert.equal(specs.fx_rate_source, 'test-fixture');
  assert.equal(specs.fx_rate_date, '2026-05-17');
});

test('buildNormalizedSpecs keeps bundle rows from collapsing into unknown when toy signals are strong', () => {
  const specs = cleaner.buildNormalizedSpecs(
    {
      name: 'His & Hers, The Amplified Intimacy Bundle',
      subtitle: 'Bundle',
      priceSourceAmount: 206.99,
      originalPriceSourceAmount: 229.99,
      priceCurrency: 'GBP',
      rawDescription: 'Includes one penis toy and one clitoral stimulator for couples intimacy.',
      genderHint: 'unisex',
      categoryHints: ['Bundle'],
    },
    TEST_FX,
  );

  assert.notEqual(specs.type_code, 'unknown');
  assert.ok(specs.function_tags.includes('套装'));
});
