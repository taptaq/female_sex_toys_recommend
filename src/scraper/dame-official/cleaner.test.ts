import test from 'node:test';
import assert from 'node:assert/strict';
import * as cleaner from './cleaner.ts';
import * as helpers from '../nomitang-official/cleaner-helpers.ts';

const getBuildNormalizedSpecs = () => {
  const buildNormalizedSpecs = (cleaner as Record<string, unknown>).buildNormalizedSpecs;
  assert.equal(typeof buildNormalizedSpecs, 'function');

  return buildNormalizedSpecs as (
    item: Record<string, unknown>,
    fx: { rate: number; source: string; date: string | null },
  ) => Record<string, unknown>;
};

const TEST_FX = {
  rate: 7.2,
  source: 'test-fixture',
  date: '2026-05-15',
};

test('prepareUniqueBufferItemsForCleaning drops duplicate canonical names', () => {
  const result = helpers.prepareUniqueBufferItemsForCleaning([
    {
      sourceUrl: 'https://dame.com/products/a',
      name: 'Fallback One',
      rawDescription: 'Name: Eva',
    },
    {
      sourceUrl: 'https://dame.com/products/b',
      name: 'Fallback Two',
      rawDescription: 'Name: Eva',
    },
  ]);

  assert.equal(result.items.length, 1);
  assert.equal(result.skippedDuplicateNames.length, 1);
  assert.equal(result.skippedDuplicateNames[0]?.canonicalName, 'Eva');
});

test('buildNormalizedSpecs converts USD prices to RMB and preserves fx metadata', () => {
  const buildNormalizedSpecs = getBuildNormalizedSpecs();

  const specs = buildNormalizedSpecs(
    {
      name: 'Aloe Personal Lubricant',
      priceUsd: 25,
      originalPriceUsd: 30,
      rawDescription: 'Water-based lubricant for intimate use.',
      genderHint: 'unisex',
    },
    TEST_FX,
  );

  assert.equal(specs.price_usd, 25);
  assert.equal(specs.price_rmb, 180);
  assert.equal(specs.original_price_usd, 30);
  assert.equal(specs.original_price_rmb, 216);
  assert.equal(specs.fx_rate_usd_cny, 7.2);
  assert.equal(specs.fx_rate_source, 'test-fixture');
  assert.equal(specs.fx_rate_date, '2026-05-15');
});

test('buildNormalizedSpecs lets classifier resolve lube and lingerie as care_accessory subtypes', () => {
  const buildNormalizedSpecs = getBuildNormalizedSpecs();

  const lube = buildNormalizedSpecs(
    {
      name: 'Aloe Personal Lubricant',
      priceUsd: 25,
      rawDescription: 'Water-based lubricant for intimate use.',
      genderHint: 'unisex',
    },
    TEST_FX,
  );

  const lingerie = buildNormalizedSpecs(
    {
      name: 'Lace Panty',
      priceUsd: 32,
      rawDescription: 'Soft lace lingerie for intimate styling.',
      genderHint: 'female',
    },
    TEST_FX,
  );

  assert.equal(lube.type_code, 'care_accessory');
  assert.equal(lube.subtype_code, 'lube_care');
  assert.equal(lingerie.type_code, 'care_accessory');
  assert.equal(lingerie.subtype_code, 'lingerie');
});

test('buildNormalizedSpecs resolves unisex Dame toys to concrete device categories instead of unknown', () => {
  const buildNormalizedSpecs = getBuildNormalizedSpecs();

  const wearable = buildNormalizedSpecs(
    {
      name: 'Eva Wearable Vibrator',
      priceUsd: 129,
      rawDescription: 'Award-winning wearable vibrator for couples and shared pleasure.',
      genderHint: 'unisex',
    },
    TEST_FX,
  );

  const external = buildNormalizedSpecs(
    {
      name: 'Pom Palm Vibrator',
      priceUsd: 103,
      rawDescription: 'A soft palm vibrator with multiple vibration modes for external use.',
      genderHint: 'unisex',
    },
    TEST_FX,
  );

  const wipes = buildNormalizedSpecs(
    {
      name: 'Body Wipes',
      priceUsd: 14,
      rawDescription: 'Soft intimate wipes for quick clean up after play.',
      genderHint: 'unisex',
    },
    TEST_FX,
  );

  assert.equal(wearable.type_code, 'couples');
  assert.equal(wearable.subtype_code, 'external_couples');
  assert.equal(external.type_code, 'external_vibe');
  assert.equal(external.subtype_code, 'bullet_vibe');
  assert.equal(wipes.type_code, 'care_accessory');
  assert.equal(wipes.subtype_code, 'lube_care');
});

test('buildNormalizedSpecs extracts richer function tags from translated Chinese device descriptions', () => {
  const buildNormalizedSpecs = getBuildNormalizedSpecs();

  const lay = buildNormalizedSpecs(
    {
      name: 'Lay Panty Vibrator',
      priceUsd: 79,
      rawDescription:
        '如何使用 将蕾放入你的内裤中，弯曲的一侧贴着身体。使用磁力夹将其固定到位。使用单个按钮开启，或使用遥控器控制。规格 医用级硅胶 防水7级 5种速度 5种模式 旅行锁 丙型可充电。',
      genderHint: 'unisex',
    },
    TEST_FX,
  );

  const arc = buildNormalizedSpecs(
    {
      name: 'Arc G-Spot Vibrator',
      priceUsd: 119,
      rawDescription:
        '细节 安静 响亮。规格 医用级硅胶 防水 5种强度级别 5种模式 USB-C充电。弧是 G 点振动器。',
      genderHint: 'unisex',
    },
    TEST_FX,
  );

  const aer = buildNormalizedSpecs(
    {
      name: 'Aer Suction Vibrator',
      priceUsd: 125,
      rawDescription:
        '详情 安静度 静音-响亮。规格 医用级硅胶 防水5 模式口 到 背部。C型通用串行总线可充电。艾尔是吮吸振动器。',
      genderHint: 'unisex',
    },
    TEST_FX,
  );

  assert.ok(Array.isArray(lay.function_tags));
  assert.ok(lay.function_tags.includes('穿戴'));
  assert.ok(lay.function_tags.includes('遥控'));
  assert.ok(lay.function_tags.includes('防水'));
  assert.ok(lay.function_tags.includes('可充电'));

  assert.ok(Array.isArray(arc.function_tags));
  assert.ok(arc.function_tags.includes('G点刺激'));
  assert.ok(arc.function_tags.includes('静音'));
  assert.ok(arc.function_tags.includes('防水'));
  assert.ok(arc.function_tags.includes('可充电'));

  assert.ok(Array.isArray(aer.function_tags));
  assert.ok(aer.function_tags.includes('吮吸刺激'));
  assert.ok(aer.function_tags.includes('静音'));
  assert.ok(aer.function_tags.includes('防水'));
  assert.ok(aer.function_tags.includes('可充电'));
});

test('buildNormalizedSpecs extracts richer function tags from care product descriptions', () => {
  const buildNormalizedSpecs = getBuildNormalizedSpecs();

  const aloe = buildNormalizedSpecs(
    {
      name: 'Aloe Lube',
      priceUsd: 19,
      rawDescription:
        '详细 成分 芦荟叶汁、丙二醇、透明质酸钠、羟乙基纤维素、黄原胶。使用方法 用作个人润滑剂，适用于阴茎和/或阴道。按需涂抹于所需部位，需要时可重新涂抹。用温水即可洗去。规格 pH值：4。',
      genderHint: 'unisex',
    },
    TEST_FX,
  );

  const cleanerProduct = buildNormalizedSpecs(
    {
      name: 'Hand + Vibe Sex Toy Cleaner',
      priceUsd: 14,
      rawDescription:
        '成分 水。规格 用于手部，大量喷洒并彻底揉搓。用于玩具，大量喷洒并在使用前让其蒸发。',
      genderHint: 'unisex',
    },
    TEST_FX,
  );

  const wipes = buildNormalizedSpecs(
    {
      name: 'Body Wipes',
      priceUsd: 6,
      rawDescription:
        '规格 保质期：开封后3个月。成分：水、芦荟叶汁、黄瓜果提取物。适合亲密清洁和事后快速整理。',
      genderHint: 'unisex',
    },
    TEST_FX,
  );

  assert.ok(Array.isArray(aloe.function_tags));
  assert.ok(aloe.function_tags.includes('润滑护理'));
  assert.ok(aloe.function_tags.includes('水基配方'));

  assert.ok(Array.isArray(cleanerProduct.function_tags));
  assert.ok(cleanerProduct.function_tags.includes('清洁护理'));

  assert.ok(Array.isArray(wipes.function_tags));
  assert.ok(wipes.function_tags.includes('清洁护理'));
  assert.ok(wipes.function_tags.includes('便携'));
});

test('formatDameRawDescription keeps section labels and URLs on separate lines', () => {
  const formatDameRawDescription = (cleaner as Record<string, unknown>).formatDameRawDescription;
  assert.equal(typeof formatDameRawDescription, 'function');

  const formatted = (formatDameRawDescription as (value: string) => string)(
    '详情 成分 芦荟 使用方法 涂抹即可 手册 中文 https://dame.com/a.pdf https://dame.com/b.pdf',
  );

  assert.match(formatted, /^详情\n成分 芦荟\n使用方法 涂抹即可\n手册 中文\nhttps:\/\/dame\.com\/a\.pdf\nhttps:\/\/dame\.com\/b\.pdf$/);

  const keepsManualPhrase = (formatDameRawDescription as (value: string) => string)(
    '规格 包含：收纳袋和用户手册 手册 中文 https://dame.com/c.pdf',
  );

  assert.match(keepsManualPhrase, /用户手册\n手册 中文\nhttps:\/\/dame\.com\/c\.pdf$/);
});
