import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { buildSafeDisplayName } from '../../lib/product-display-name.ts';
import {
  classifyLibrarySubtypeCode,
  classifyLibraryTypeCode,
} from '../../lib/library-product-type-classifier.ts';
import { translateRawDescriptionToZh } from '../shared/raw-description-translator.ts';
import {
  extractCanonicalName,
  hasMeaningfulEnglish,
  isPlaceholderProductName,
  prepareUniqueBufferItemsForCleaning,
  resolvePersistedRawDescription,
} from '../nomitang-official/cleaner-helpers.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const BUFFER_PATH = path.resolve(__dirname, '../../data/dame-official-review-buffer.json');
export const CLEANED_PATH = path.resolve(__dirname, '../../data/dame-official-cleaned-data.json');
const RAW_TRANSLATION_CACHE_PATH = path.resolve(__dirname, '../../data/dame-official-raw-description-zh-cache.json');

const FALLBACK_USD_TO_CNY_RATE = 7.2;

type FxSnapshot = {
  rate: number;
  source: string;
  date: string | null;
};

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

type Gender = 'male' | 'female' | 'unisex';

type CleanerBufferItem = {
  sourceUrl?: string;
  name?: string;
  subtitle?: string;
  brand?: string;
  price?: number | null;
  priceUsd?: number | null;
  originalPriceUsd?: number | null;
  priceCurrency?: string | null;
  coverImage?: string | null;
  rawDescription?: string;
  categoryHints?: unknown;
  genderHint?: string;
  stock?: string;
  [key: string]: unknown;
};

type NormalizedSpecs = {
  price_usd: number | null;
  price_rmb: number | null;
  original_price_usd: number | null;
  original_price_rmb: number | null;
  fx_rate_usd_cny: number;
  fx_rate_source: string;
  fx_rate_date: string | null;
  gender: Gender;
  material: string;
  appearance: string;
  physical_form: string;
  motor_type: string;
  waterproof: number | null;
  max_db: number | null;
  function_tags: string[];
  type_code: string | null;
  subtype_code: string | null;
};

type CleanedRow = {
  sourceUrl: string;
  name: string;
  safeDisplayName: string;
  brand: string;
  price: number | null;
  coverImage: string;
  rawDescription: string;
  gender: Gender;
  material: string;
  specs: NormalizedSpecs & {
    price_source_currency: string;
    price_source_amount: number | null;
  };
  typeCode: string | null;
  subtypeCode: string | null;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeWhitespace(value: string): string {
  return String(value || '')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function parsePositiveNumber(value: unknown): number | null {
  const parsed = Number(String(value ?? '').replace(/[^\d.]+/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function uniqueStrings(values: Array<string | null | undefined>, limit = 12): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = normalizeWhitespace(String(value || ''));
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= limit) break;
  }

  return result;
}

function hasAnyHint(text: string, hints: string[]): boolean {
  const source = normalizeWhitespace(text).toLowerCase();
  return hints.some((hint) => source.includes(hint.toLowerCase()));
}

function normalizeGenderHint(value: unknown): Gender {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'female' || normalized === 'male' || normalized === 'unisex') {
    return normalized;
  }
  return 'unisex';
}

function inferMaterial(name: string, rawDescription: string): string {
  const text = `${name}\n${rawDescription}`.toLowerCase();
  if (/lace|lingerie|panty|bodysuit|sleepwear/.test(text)) return '锦纶蕾丝';
  if (/lubricant|lube|water-based|wipe|wipes/.test(text)) return '水基配方';
  if (/silicone/.test(text)) return '硅胶';
  return '硅胶';
}

function inferAppearance(text: string): string {
  return /wearable|discreet|travel|quiet|穿戴|便携|旅行锁|静音/i.test(text) ? 'high_disguise' : 'normal';
}

function inferPhysicalForm(text: string): string {
  if (/g-spot|insertable|insert|internal|vaginal|prostate|g点|阴道|前列腺|插入/i.test(text)) return 'internal';
  return 'external';
}

function inferMotorType(text: string): string {
  return /powerful|intense|strong|强烈|强劲|高强度/i.test(text) ? 'strong' : 'gentle';
}

function inferWaterproof(text: string): number | null {
  const ipxMatch = text.match(/ipx\s*([0-9])/i);
  if (ipxMatch) return Number(ipxMatch[1]);
  const waterproofLevelMatch = text.match(/防水\s*([0-9])/i);
  if (waterproofLevelMatch) return Number(waterproofLevelMatch[1]);
  return /waterproof|防水/i.test(text) ? 7 : null;
}

function inferCareSemanticTags(text: string, subtypeCode: string | null): string[] {
  const isLubeLike =
    subtypeCode === 'lube_care' &&
    hasAnyHint(text, ['lubricant', 'lube', 'personal lubricant', '润滑剂', '润滑液', '润滑']);
  const isWipeLike = hasAnyHint(text, ['wipe', 'wipes', '湿巾']);
  const looksWaterBased =
    hasAnyHint(text, ['water-based', 'water based', '水基']) ||
    (isLubeLike &&
      hasAnyHint(text, [
        'water',
        'aqua',
        'aloe',
        '芦荟',
        '透明质酸',
        'hyaluronate',
        '黄原胶',
        'xanthan',
        '羟乙基纤维素',
        'hydroxyethylcellulose',
        '丙二醇',
        'propanediol',
      ]) &&
      !hasAnyHint(text, ['silicone', 'dimethicone', 'oil-based', 'oil based', '矿物油', '凡士林']));

  return uniqueStrings([
    looksWaterBased ? '水基配方' : null,
    isWipeLike || hasAnyHint(text, ['portable', 'travel', '随身', '便携'])
      ? '便携'
      : null,
  ]);
}

function inferFunctionTags(text: string, typeCode: string | null, subtypeCode: string | null): string[] {
  const hasProductTextHints = !typeCode || typeCode === 'unknown';
  const isApparel =
    subtypeCode === 'lingerie' ||
    ((typeCode === 'care_accessory' || hasProductTextHints) &&
      hasAnyHint(text, ['lingerie', 'lace', 'bodysuit', 'sleepwear', '蕾丝', '内衣', '睡衣']));
  const isCare =
    !isApparel &&
    (typeCode === 'care_accessory' ||
      subtypeCode === 'lube_care' ||
      (hasProductTextHints &&
        hasAnyHint(text, [
          'lubricant',
          'lube',
          'water-based',
          'personal lubricant',
          'wipe',
          'wipes',
          'cleaner',
          'cleansing',
          'spray',
          '润滑',
          '湿巾',
          '清洁',
          '喷洒',
        ])));

  if (isApparel) {
    return uniqueStrings([
      '服饰',
      hasAnyHint(text, ['lace', '蕾丝']) ? '蕾丝' : null,
      hasAnyHint(text, ['panty', '内裤']) ? '情趣内搭' : null,
    ]);
  }

  if (isCare) {
    return uniqueStrings([
      hasAnyHint(text, ['lubricant', 'lube', 'personal lubricant', '润滑剂', '润滑液', '润滑']) ? '润滑护理' : null,
      hasAnyHint(text, ['wipe', 'wipes', 'cleaner', 'cleansing', 'spray', '湿巾', '清洁', '喷洒']) ? '清洁护理' : null,
      ...inferCareSemanticTags(text, subtypeCode),
    ]);
  }

  return uniqueStrings([
    hasAnyHint(text, ['vibrator', 'vibe', 'vibration', 'wand', 'bullet', '按摩棒', '振动', '震动']) ? '震动刺激' : null,
    hasAnyHint(text, ['quiet', 'silent', 'discreet', '静音', '安静', '低噪']) ? '静音' : null,
    hasAnyHint(text, ['waterproof', 'ipx', '防水']) ? '防水' : null,
    hasAnyHint(
      text,
      ['rechargeable', 'charge time', 'usb-c', 'usb c', 'usb charging', '可充电', '充电', 'usb', '通用串行总线', '感应充电'],
    )
      ? '可充电'
      : null,
    hasAnyHint(text, ['travel', 'travel lock', 'portable', 'mini', 'palm', 'finger', '收纳袋', '旅行锁', '便携', '迷你', '掌心'])
      ? '便携'
      : null,
    hasAnyHint(text, ['wearable', 'wear it', 'underwear', 'labia', 'magnetic clip', '穿戴', '佩戴', '内裤', '阴唇', '固定到位'])
      ? '穿戴'
      : null,
    hasAnyHint(text, ['remote', '遥控']) ? '遥控' : null,
    hasAnyHint(text, ['suction', 'air pulse', 'clitoral suction', '吮吸', '吸吮', '吸力']) ? '吮吸刺激' : null,
    hasAnyHint(text, ['g-spot', 'g spot', 'g点', 'g 点']) ? 'G点刺激' : null,
    hasAnyHint(text, ['rabbit', 'dual stimulation', 'dual', 'double stimulation', '双刺激', '双重刺激']) ? '双刺激' : null,
  ]);
}

function collectClassifierTags(item: Record<string, unknown>, rawDescription: string): string[] {
  const rawTags = Array.isArray(item.categoryHints)
    ? item.categoryHints.filter((value): value is string => typeof value === 'string')
    : [];
  const signalText = `${item.name || ''}\n${item.subtitle || ''}\n${rawDescription}`;

  return uniqueStrings([
    ...rawTags,
    hasAnyHint(signalText, ['lubricant', 'lube', 'water-based', 'personal lubricant', '润滑剂', '润滑液', '润滑']) ? 'lube' : null,
    hasAnyHint(signalText, ['wipe', 'wipes', '湿巾']) ? 'wipes' : null,
    hasAnyHint(signalText, ['cleaner', 'cleansing', 'spray', '清洁', '喷洒']) ? 'cleaner' : null,
    hasAnyHint(signalText, ['lingerie', 'lace', 'panty', 'bodysuit', 'sleepwear', '蕾丝', '内衣']) ? 'lingerie' : null,
    hasAnyHint(signalText, ['wearable', '穿戴', '佩戴']) ? 'wearable' : null,
    hasAnyHint(signalText, ['remote', '遥控']) ? 'remote' : null,
    hasAnyHint(signalText, ['suction', 'clitoral suction', '吮吸', '吸力']) ? 'suction' : null,
    hasAnyHint(signalText, ['g-spot', 'g点', 'g 点']) ? 'g_spot' : null,
  ]);
}

const isTransientDbError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error || '');
  return /Connection terminated|ECONNRESET|server closed the connection|terminating connection|Can't reach database|P1001|P1017/i.test(
    message,
  );
};

async function reconnectPrisma() {
  await prisma.$disconnect().catch(() => {});
  await sleep(800);
  await prisma.$connect();
}

async function ensurePrismaConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    if (!isTransientDbError(error)) throw error;
    console.warn('[DB] 检测到连接已断开，正在重建 Prisma 连接...');
    await reconnectPrisma();
  }
}

async function withDbRetry<T>(label: string, action: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await ensurePrismaConnection();
      return await action();
    } catch (error) {
      lastError = error;
      if (!isTransientDbError(error) || attempt === 3) break;
      console.warn(`[DB] ${label} 遇到瞬断，重连后重试 (${attempt}/3)...`);
      await reconnectPrisma();
      await sleep(1000 * attempt);
    }
  }

  throw lastError;
}

export function resolveRmbPrice(usd: number | null, rate = FALLBACK_USD_TO_CNY_RATE): number | null {
  if (!Number.isFinite(Number(usd)) || Number(usd) <= 0) return null;
  return Math.round(Number(usd) * rate);
}

async function refreshUsdToCnyRate(): Promise<FxSnapshot> {
  try {
    const response = await fetch('https://api.frankfurter.dev/v1/latest?base=USD&symbols=CNY', {
      headers: { accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = (await response.json()) as { date?: string; rates?: Record<string, number> };
    const liveRate = Number(payload?.rates?.CNY);
    if (!Number.isFinite(liveRate) || liveRate <= 0) throw new Error('missing CNY rate');

    return {
      rate: liveRate,
      source: 'frankfurter',
      date: String(payload?.date || '').trim() || null,
    };
  } catch (error) {
    console.warn(`[汇率] 实时汇率获取失败，回退到固定汇率 USD/CNY=${FALLBACK_USD_TO_CNY_RATE}:`, error);
    return {
      rate: FALLBACK_USD_TO_CNY_RATE,
      source: 'fallback',
      date: null,
    };
  }
}

export function buildNormalizedSpecs(item: Record<string, unknown>, fx: FxSnapshot): NormalizedSpecs {
  const rawDescription = normalizeWhitespace(String(item.rawDescription || ''));
  const priceUsd = parsePositiveNumber(item.priceUsd ?? item.price ?? null);
  const originalPriceUsd = parsePositiveNumber(item.originalPriceUsd ?? null);
  const gender = normalizeGenderHint(item.genderHint);
  const tags = collectClassifierTags(item, rawDescription);
  const classifierInput = {
    gender,
    physicalForm: null,
    name: String(item.name || ''),
    rawDescription,
    tags,
  };
  const type_code = classifyLibraryTypeCode(classifierInput);
  const subtype_code = classifyLibrarySubtypeCode({
    ...classifierInput,
    typeCode: type_code,
  });
  const signalText = [item.name, item.subtitle, rawDescription, ...tags].filter(Boolean).join('\n');

  return {
    price_usd: priceUsd,
    price_rmb: resolveRmbPrice(priceUsd, fx.rate),
    original_price_usd: originalPriceUsd,
    original_price_rmb: resolveRmbPrice(originalPriceUsd, fx.rate),
    fx_rate_usd_cny: fx.rate,
    fx_rate_source: fx.source,
    fx_rate_date: fx.date,
    gender,
    material: inferMaterial(String(item.name || ''), rawDescription),
    appearance: inferAppearance(signalText),
    physical_form: inferPhysicalForm(signalText),
    motor_type: inferMotorType(signalText),
    waterproof: inferWaterproof(signalText),
    max_db: null,
    function_tags: inferFunctionTags(signalText, type_code, subtype_code),
    type_code,
    subtype_code,
  };
}

export function formatDameRawDescription(input: string): string {
  const normalized = String(input || '').replace(/\r/g, '\n');
  if (!normalized.trim()) return '';

  const protectedPhrases = normalized
    .replaceAll('用户手册', '〔占位一〕')
    .replaceAll('使用手册', '〔占位二〕');

  const sectioned = protectedPhrases
    .replace(/\s*(如何使用|使用方法|详情|详细信息|规格|成分|手册)\s*/g, '\n$1 ')
    .replace(/\s+(?=https?:\/\/)/g, '\n')
    .replace(/(https?:\/\/[^\s]+)\s+(?=https?:\/\/)/g, '$1\n');

  return sectioned
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replaceAll('〔占位一〕', '用户手册')
    .replaceAll('〔占位二〕', '使用手册')
    .trim();
}

async function translateForPersistence(rawDescription: string, canonicalName: string): Promise<string> {
  if (!hasMeaningfulEnglish(rawDescription)) {
    return formatDameRawDescription(rawDescription);
  }

  try {
    const translatedRawDescription = await translateRawDescriptionToZh(rawDescription, {
      cachePath: RAW_TRANSLATION_CACHE_PATH,
      logLabel: canonicalName,
    });

    const finalizedRawDescription = resolvePersistedRawDescription(translatedRawDescription, rawDescription);
    return formatDameRawDescription(finalizedRawDescription);
  } catch (error) {
    console.warn(`[翻译] ${canonicalName} 翻译失败，保留原始描述。`, error);
    return formatDameRawDescription(rawDescription);
  }
}

export async function runCleaner(): Promise<CleanedRow[]> {
  if (!fs.existsSync(BUFFER_PATH)) {
    console.error('[中断] 未发现 Dame review-buffer。');
    return [];
  }

  const bufferData = JSON.parse(fs.readFileSync(BUFFER_PATH, 'utf8')) as Array<Record<string, unknown>>;
  const prepared = prepareUniqueBufferItemsForCleaning(bufferData);
  const fx = await refreshUsdToCnyRate();

  const cleanedRows: CleanedRow[] = [];

  for (const item of prepared.items as CleanerBufferItem[]) {
    const canonicalName = normalizeWhitespace(
      extractCanonicalName(String(item.rawDescription || ''), String(item.name || '')),
    );
    if (isPlaceholderProductName(canonicalName)) continue;

    const persistedRawDescription = await translateForPersistence(String(item.rawDescription || ''), canonicalName);
    const specs = buildNormalizedSpecs(
      {
        ...item,
        name: canonicalName,
        rawDescription: persistedRawDescription,
      },
      fx,
    );

    const cleanedRow: CleanedRow = {
      sourceUrl: String(item.sourceUrl || ''),
      name: canonicalName,
      safeDisplayName: buildSafeDisplayName(canonicalName),
      brand: 'Dame',
      price: specs.price_rmb,
      coverImage: String(item.coverImage || ''),
      rawDescription: persistedRawDescription,
      gender: specs.gender,
      material: specs.material,
      specs: {
        ...specs,
        price_source_currency: normalizeWhitespace(String(item.priceCurrency || 'USD')) || 'USD',
        price_source_amount: specs.price_usd,
      },
      typeCode: specs.type_code,
      subtypeCode: specs.subtype_code,
    };

    cleanedRows.push(cleanedRow);

    const productPayload = {
      name: canonicalName,
      price: specs.price_rmb,
      image: cleanedRow.coverImage || null,
      link: cleanedRow.sourceUrl || null,
      specs: {
        ...cleanedRow.specs,
        rawDescription: persistedRawDescription || null,
      } as any,
      gender: specs.gender.charAt(0).toUpperCase() + specs.gender.slice(1),
      tags: specs.function_tags,
    };

    const toyPayload = {
      name: canonicalName,
      safe_display_name: cleanedRow.safeDisplayName,
      brand: 'Dame',
      price: specs.price_rmb,
      max_db: specs.max_db,
      waterproof: specs.waterproof,
      appearance: specs.appearance,
      physical_form: specs.physical_form,
      motor_type: specs.motor_type,
      gender: specs.gender,
      material: specs.material,
      image_url: cleanedRow.coverImage || null,
      raw_description: persistedRawDescription || null,
      type_code: specs.type_code,
      subtype_code: specs.subtype_code,
      updated_at: new Date(),
    };

    try {
      await withDbRetry(`同步商品 ${canonicalName}`, async () => {
        const existingProduct = await prisma.products.findFirst({ where: { name: canonicalName } });
        let originalId: string;

        if (existingProduct) {
          const updated = await prisma.products.update({
            where: { id: existingProduct.id },
            data: productPayload,
          });
          originalId = updated.id;
        } else {
          const created = await prisma.products.create({ data: productPayload });
          originalId = created.id;
        }

        await prisma.recommender_toys.deleteMany({ where: { name: canonicalName } });
        await prisma.recommender_toys.create({
          data: {
            original_id: originalId,
            ...toyPayload,
          },
        });
      });
    } catch (error) {
      console.error(`[故障] 数据处理失败: ${canonicalName}`, error);
    }
  }

  const dir = path.dirname(CLEANED_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CLEANED_PATH, JSON.stringify(cleanedRows, null, 2));

  await prisma.$disconnect().catch(() => {});
  await pool.end().catch(() => {});

  return cleanedRows;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCleaner().catch((error) => {
    console.error(error);
    prisma.$disconnect().catch(() => {});
    pool.end().catch(() => {});
    process.exitCode = 1;
  });
}
