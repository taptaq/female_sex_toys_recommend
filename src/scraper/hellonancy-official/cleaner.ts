import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import {
  classifyLibrarySubtypeCode,
  classifyLibraryTypeCode,
} from '../../lib/library-product-type-classifier.ts';
import { buildSafeDisplayName } from '../../lib/product-display-name.ts';
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

export const BUFFER_PATH = path.resolve(__dirname, '../../data/hellonancy-official-review-buffer.json');
export const CLEANED_PATH = path.resolve(__dirname, '../../data/hellonancy-official-cleaned-data.json');
const RAW_TRANSLATION_CACHE_PATH = path.resolve(__dirname, '../../data/hellonancy-official-raw-description-zh-cache.json');
const BRAND_NAME = 'Nancy';

type Gender = 'male' | 'female' | 'unisex';

export type FxSnapshot = {
  rate: number;
  source: string;
  date: string | null;
  currency: string;
};

type CleanerBufferItem = {
  sourceUrl?: string;
  name?: string;
  subtitle?: string;
  priceSourceAmount?: number | null;
  originalPriceSourceAmount?: number | null;
  priceCurrency?: string | null;
  coverImage?: string | null;
  rawDescription?: string;
  categoryHints?: unknown;
  genderHint?: string;
  [key: string]: unknown;
};

export type NormalizedSpecs = {
  price_source_currency: string;
  price_source_amount: number | null;
  original_price_source_amount: number | null;
  price_rmb: number | null;
  original_price_rmb: number | null;
  fx_rate_to_cny: number;
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

export type CleanedRow = {
  sourceUrl: string;
  name: string;
  safeDisplayName: string;
  brand: string;
  price: number | null;
  coverImage: string;
  rawDescription: string;
  gender: Gender;
  material: string;
  specs: NormalizedSpecs;
  typeCode: string | null;
  subtypeCode: string | null;
};

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function resolveRmbPrice(amount: number | null, rate: number): number | null {
  if (!amount || !Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * rate);
}

function normalizeSourceCurrency(value: unknown): string {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) return 'CNY';
  if (normalized === '¥' || normalized === '￥' || normalized === 'CNY' || normalized === 'RMB') return 'CNY';
  return normalized;
}

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

function uniqueStrings(values: Array<string | null | undefined>, limit = 24): string[] {
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

function parsePositiveNumber(value: unknown): number | null {
  const parsed = Number(String(value ?? '').replace(/[^\d.]+/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeGenderHint(value: unknown): Gender {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'female' || normalized === 'male' || normalized === 'unisex') return normalized;
  return 'unisex';
}

function inferMaterial(name: string, rawDescription: string): string {
  const text = `${name}\n${rawDescription}`.toLowerCase();
  if (/silicone/.test(text)) return '硅胶';
  if (/abs|plastic/.test(text)) return 'ABS/硅胶复合';
  if (/metal|steel/.test(text)) return '金属';
  return '硅胶';
}

function inferAppearance(text: string): string {
  return /quiet|discreet|portable|travel|便携|静音/i.test(text) ? 'high_disguise' : 'normal';
}

function inferPhysicalForm(text: string): string {
  if (/g-spot|g spot|internal|insertable|insert|vaginal|anal|pelvic|kegel|阴道|肛门|插入/i.test(text)) return 'internal';
  return 'external';
}

function inferMotorType(text: string): string {
  return /powerful|deep|rumbly|intense|strong|强劲|强烈/i.test(text) ? 'strong' : 'gentle';
}

function inferWaterproof(text: string): number | null {
  const ipx = text.match(/ipx\s*([0-9])/i)?.[1];
  if (ipx) return Number(ipx);
  return /waterproof|splashproof|防水/i.test(text) ? 7 : null;
}

function inferFunctionTags(text: string): string[] {
  return uniqueStrings([
    hasAnyHint(text, ['vibrator', 'vibration', 'vibrating', '震动', '振动']) ? '震动刺激' : null,
    hasAnyHint(text, ['clitoral', 'clitoris', '阴蒂']) ? '阴蒂刺激' : null,
    hasAnyHint(text, ['g-spot', 'g spot', 'g点']) ? 'G点刺激' : null,
    hasAnyHint(text, ['suction', 'air suction', '吸吮', '吮吸']) ? '吸吮刺激' : null,
    hasAnyHint(text, ['waterproof', 'splashproof', '防水']) ? '防水' : null,
    hasAnyHint(text, ['rechargeable', 'usb', 'charging']) ? '可充电' : null,
    hasAnyHint(text, ['bundle', 'set', 'kit']) ? '套装' : null,
  ]);
}

const isTransientDbError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error || '');
  return /Connection terminated|ECONNRESET|server closed the connection|terminating connection|Can't reach database|P1001|P1017/i.test(message);
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
      await reconnectPrisma();
      await sleep(1000 * attempt);
    }
  }
  throw lastError;
}

async function refreshCurrencyToCnyRate(currency: string): Promise<FxSnapshot> {
  const normalized = normalizeSourceCurrency(currency);
  if (normalized === 'CNY') {
    return {
      rate: 1,
      source: 'identity',
      date: null,
      currency: 'CNY',
    };
  }
  return {
    rate: 1,
    source: 'identity',
    date: null,
    currency: normalized,
  };
}

export function buildNormalizedSpecs(item: CleanerBufferItem, fx: FxSnapshot): NormalizedSpecs {
  const name = normalizeWhitespace(String(item.name || ''));
  const subtitle = normalizeWhitespace(String(item.subtitle || ''));
  const rawDescription = normalizeWhitespace(String(item.rawDescription || ''));
  const signalText = `${name}\n${subtitle}\n${rawDescription}`;
  const priceSourceAmount = parsePositiveNumber(item.priceSourceAmount);
  const originalPriceSourceAmount = parsePositiveNumber(item.originalPriceSourceAmount);
  const priceSourceCurrency = normalizeSourceCurrency(item.priceCurrency || fx.currency || 'CNY');
  const genderHint = normalizeGenderHint(item.genderHint);
  const classifierTags = Array.isArray(item.categoryHints)
    ? item.categoryHints.filter((value): value is string => typeof value === 'string')
    : [];

  const type_code = classifyLibraryTypeCode({
    gender: genderHint,
    physicalForm: inferPhysicalForm(signalText),
    name,
    rawDescription,
    tags: classifierTags,
  });
  const subtype_code = classifyLibrarySubtypeCode({
    gender: genderHint,
    physicalForm: inferPhysicalForm(signalText),
    name,
    rawDescription,
    tags: classifierTags,
    typeCode: type_code,
  });

  return {
    price_source_currency: priceSourceCurrency,
    price_source_amount: priceSourceAmount,
    original_price_source_amount: originalPriceSourceAmount,
    price_rmb: resolveRmbPrice(priceSourceAmount, fx.rate),
    original_price_rmb: resolveRmbPrice(originalPriceSourceAmount, fx.rate),
    fx_rate_to_cny: fx.rate,
    fx_rate_source: fx.source,
    fx_rate_date: fx.date,
    gender: genderHint,
    material: inferMaterial(name, rawDescription),
    appearance: inferAppearance(signalText),
    physical_form: inferPhysicalForm(signalText),
    motor_type: inferMotorType(signalText),
    waterproof: inferWaterproof(signalText),
    max_db: hasAnyHint(signalText, ['quiet', 'silent', 'shhh']) ? 50 : null,
    function_tags: inferFunctionTags(signalText),
    type_code,
    subtype_code,
  };
}

function loadTranslationCache(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(RAW_TRANSLATION_CACHE_PATH, 'utf8')) as Record<string, string>;
  } catch {
    return {};
  }
}

function saveTranslationCache(cache: Record<string, string>) {
  const dir = path.dirname(RAW_TRANSLATION_CACHE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(RAW_TRANSLATION_CACHE_PATH, JSON.stringify(cache, null, 2));
}

async function translateForPersistence(rawDescription: string, canonicalName: string): Promise<string> {
  const normalizedRaw = normalizeWhitespace(rawDescription);
  if (!hasMeaningfulEnglish(normalizedRaw)) return normalizedRaw;

  const cache = loadTranslationCache();
  const cacheKey = canonicalName || normalizedRaw.slice(0, 120);
  if (cache[cacheKey]) {
    return resolvePersistedRawDescription(cache[cacheKey], normalizedRaw);
  }

  try {
    const translated = await translateRawDescriptionToZh(normalizedRaw);
    const persisted = resolvePersistedRawDescription(translated, normalizedRaw);
    cache[cacheKey] = persisted;
    saveTranslationCache(cache);
    return persisted;
  } catch {
    return normalizedRaw;
  }
}

export async function runCleaner(): Promise<CleanedRow[]> {
  if (!fs.existsSync(BUFFER_PATH)) {
    await prisma.$disconnect().catch(() => {});
    return [];
  }

  const bufferData = JSON.parse(fs.readFileSync(BUFFER_PATH, 'utf8')) as Array<Record<string, unknown>>;
  if (bufferData.length === 0) {
    fs.writeFileSync(CLEANED_PATH, JSON.stringify([], null, 2));
    await prisma.$disconnect().catch(() => {});
    return [];
  }

  const prepared = prepareUniqueBufferItemsForCleaning(bufferData);
  console.log(`[clean] review-buffer 已载入 ${prepared.items.length} 条`);
  const fx = await refreshCurrencyToCnyRate(String((prepared.items[0] as CleanerBufferItem)?.priceCurrency || 'CNY'));
  const cleanedRows: CleanedRow[] = [];

  for (const [index, item] of (prepared.items as CleanerBufferItem[]).entries()) {
    const canonicalName = normalizeWhitespace(
      extractCanonicalName(String(item.rawDescription || ''), String(item.name || '')),
    );
    if (isPlaceholderProductName(canonicalName)) continue;
    console.log(`[clean] 处理 ${index + 1}/${prepared.items.length}: ${canonicalName || item.name || 'Unnamed Item'}`);
    const persistedRawDescription = await translateForPersistence(String(item.rawDescription || ''), canonicalName);
    const specs = buildNormalizedSpecs({ ...item, name: canonicalName, rawDescription: persistedRawDescription }, fx);

    const cleanedRow: CleanedRow = {
      sourceUrl: String(item.sourceUrl || ''),
      name: canonicalName,
      safeDisplayName: buildSafeDisplayName(canonicalName),
      brand: BRAND_NAME,
      price: specs.price_rmb,
      coverImage: String(item.coverImage || ''),
      rawDescription: persistedRawDescription,
      gender: specs.gender,
      material: specs.material,
      specs,
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
      gender: specs.gender === 'male' ? 'Male' : specs.gender === 'female' ? 'Female' : 'Unisex',
      tags: specs.function_tags,
    };

    const toyPayload = {
      name: canonicalName,
      safe_display_name: cleanedRow.safeDisplayName,
      brand: BRAND_NAME,
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
          const updated = await prisma.products.update({ where: { id: existingProduct.id }, data: productPayload });
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
  console.log(`[clean] cleaned-data 已写入 ${cleanedRows.length} 条: ${CLEANED_PATH}`);
  await prisma.$disconnect().catch(() => {});
  return cleanedRows;
}
