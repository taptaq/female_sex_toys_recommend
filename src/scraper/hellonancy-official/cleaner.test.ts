import test from 'node:test';
import assert from 'node:assert/strict';
import * as cleaner from './cleaner.ts';

test('resolveRmbPrice keeps CNY prices unchanged when fx rate is 1', () => {
  assert.equal(cleaner.resolveRmbPrice(89, 1), 89);
  assert.equal(cleaner.resolveRmbPrice(159, 1), 159);
  assert.equal(cleaner.resolveRmbPrice(null, 1), null);
});

test('buildNormalizedSpecs keeps CNY prices as RMB without conversion', () => {
  const specs = cleaner.buildNormalizedSpecs(
    {
      name: 'Lem Clitoral Massager',
      subtitle: 'Personal Massager',
      priceSourceAmount: 89,
      originalPriceSourceAmount: 159,
      priceCurrency: 'CNY',
      rawDescription: 'Clitoral massager with air suction, quiet motor, and rechargeable battery.',
      genderHint: 'female',
      categoryHints: ['Personal Massager'],
    },
    {
      rate: 1,
      source: 'identity',
      date: null,
      currency: 'CNY',
    },
  );

  assert.equal(specs.price_source_currency, 'CNY');
  assert.equal(specs.price_source_amount, 89);
  assert.equal(specs.price_rmb, 89);
  assert.equal(specs.original_price_rmb, 159);
  assert.equal(specs.fx_rate_to_cny, 1);
});

test('buildNormalizedSpecs keeps bundle rows from collapsing into unknown when toy signals are strong', () => {
  const specs = cleaner.buildNormalizedSpecs(
    {
      name: 'Uno Bliss Bundle',
      subtitle: 'Personal Massager',
      priceSourceAmount: 79,
      originalPriceSourceAmount: 149,
      priceCurrency: 'CNY',
      rawDescription: 'Bundle including a personal massager, clitoral stimulator, and toy pouch for self-love.',
      genderHint: 'female',
      categoryHints: ['Personal Massager'],
    },
    {
      rate: 1,
      source: 'identity',
      date: null,
      currency: 'CNY',
    },
  );

  assert.notEqual(specs.type_code, 'unknown');
  assert.ok(specs.function_tags.includes('套装'));
});
