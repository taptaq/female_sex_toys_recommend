import test from 'node:test';
import assert from 'node:assert/strict';
import * as cleaner from './cleaner.ts';

const TEST_FX = {
  rate: 7.2,
  source: 'test-fixture',
  date: '2026-05-16',
};

test('resolveRmbPrice converts USD prices to rounded RMB', () => {
  assert.equal(cleaner.resolveRmbPrice(89.1, 7.2), 642);
  assert.equal(cleaner.resolveRmbPrice(22.5, 7.2), 162);
  assert.equal(cleaner.resolveRmbPrice(null, 7.2), null);
});

test('buildNormalizedSpecs converts USD prices and preserves FX metadata', () => {
  const specs = cleaner.buildNormalizedSpecs(
    {
      name: 'Mimi Soft Clitoral Vibrator - Award Winning',
      subtitle: 'Deep rumbly clitoral vibrations',
      priceUsd: 89.1,
      originalPriceUsd: 99,
      rawDescription: 'Deep rumbly clitoral vibrator with rechargeable waterproof silicone body and quiet motor.',
      genderHint: 'female',
      categoryHints: ['Vibrator'],
    },
    TEST_FX,
  );

  assert.equal(specs.price_usd, 89.1);
  assert.equal(specs.price_rmb, 642);
  assert.equal(specs.original_price_usd, 99);
  assert.equal(specs.original_price_rmb, 713);
  assert.equal(specs.fx_rate_usd_cny, 7.2);
  assert.equal(specs.fx_rate_source, 'test-fixture');
  assert.equal(specs.fx_rate_date, '2026-05-16');
  assert.ok(specs.function_tags.includes('震动刺激'));
  assert.ok(specs.function_tags.includes('防水'));
});

test('buildNormalizedSpecs keeps massage candles in care-style classification instead of unknown', () => {
  const specs = cleaner.buildNormalizedSpecs(
    {
      name: 'Je Joue Luxury Massage Candle - Jasmine & Lily',
      subtitle: 'Massage candle',
      priceUsd: 22.5,
      originalPriceUsd: 25,
      rawDescription: 'Massage candle that melts into warm massage oil for sensual touch.',
      categoryHints: ['massage candle'],
    },
    TEST_FX,
  );

  assert.notEqual(specs.type_code, 'unknown');
  assert.ok(specs.function_tags.includes('按摩护理'));
});

test('buildNormalizedSpecs classifies kegel training sets as insertable instead of unknown noisy tags', () => {
  const specs = cleaner.buildNormalizedSpecs(
    {
      name: 'Ami 3 Step Kegel Training Set - Strengthen Your Pelvic Floor',
      subtitle: 'Pelvic training set',
      priceUsd: 59,
      originalPriceUsd: 59,
      rawDescription:
        'A kegel training set with three progressive weights for tailored pelvic fitness, stronger pelvic floor support, discreet waterproof silicone design.',
      categoryHints: ['kegel'],
      genderHint: 'female',
    },
    TEST_FX,
  );

  assert.equal(specs.type_code, 'insertable');
  assert.equal(specs.subtype_code, 'gspot_insertable');
  assert.ok(specs.function_tags.includes('凯格尔训练'));
  assert.ok(specs.function_tags.includes('防水'));
  assert.equal(specs.function_tags.includes('阴蒂刺激'), false);
  assert.equal(specs.function_tags.includes('G点刺激'), false);
  assert.equal(specs.function_tags.includes('按摩护理'), false);
});

test('formatJeJoueRawDescription separates common section labels', () => {
  const formatted = cleaner.formatJeJoueRawDescription(
    'Features deep rumbly vibes Details USB Rechargeable Product Features 100% Waterproof',
  );

  assert.equal(
    formatted,
    'Features: deep rumbly vibes\nDetails: USB Rechargeable\nProduct Features: 100% Waterproof',
  );
});
