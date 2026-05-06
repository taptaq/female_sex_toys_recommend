import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
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

export const BUFFER_PATH = path.resolve(__dirname, '../../data/womanizer-official-review-buffer.json');
export const CLEANED_PATH = path.resolve(__dirname, '../../data/womanizer-official-cleaned-data.json');
const RAW_TRANSLATION_CACHE_PATH = path.resolve(__dirname, '../../data/womanizer-official-raw-description-zh-cache.json');

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const FALLBACK_USD_TO_CNY_RATE = 7.2;
const DEFAULT_DEVICE_MAX_DB = 50;
let usdToCnyRate = FALLBACK_USD_TO_CNY_RATE;
let usdToCnyRateDate = '';
let usdToCnyRateSource = 'fallback';

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
  genderHint?: string;
  stock?: string;
  [key: string]: unknown;
};

type NormalizedSpecs = {
  price_usd: number | null;
  price_rmb: number | null;
  fx_rate_usd_cny: number;
  fx_rate_source: string;
  fx_rate_date: string | null;
  waterproof: number | null;
  max_db: number | null;
  appearance: string;
  physical_form: string;
  motor_type: string;
  gender: Gender;
  material: string;
  function_tags: string[];
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

function uniqueStrings(values: Array<string | null | undefined>, limit = 20): string[] {
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

function parseNumber(value: unknown): number | null {
  const numeric = Number(String(value ?? '').replace(/[^\d.]+/g, ''));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

export function inferBrandFromItem(item: { name?: unknown; rawDescription?: unknown; brand?: unknown }): string {
  const source = `${String(item.brand || '')}\n${String(item.name || '')}\n${String(item.rawDescription || '')}`.toLowerCase();
  if (source.includes('we-vibe')) return 'We-Vibe';
  if (source.includes('arcwave')) return 'Arcwave';
  return 'Womanizer';
}

function inferGender(text: string, fallback: string): Gender {
  const source = `${text}\n${fallback}`.toLowerCase();
  const hasFemaleHint =
    /\bfemale\b/.test(source) ||
    [
      'womanizer',
      '\x63litoral',
      'g-spot',
      'rabbit',
      'pleasure air',
      'vaginal',
      'for her',
      'dual stimulator',
      '\x63lit',
    ].some((hint) => source.includes(hint));
  const hasMaleHint =
    /\bmale\b/.test(source) ||
    [
      'arcwave',
      'stroker',
      'for him',
      '\x70enis',
      'prostate',
      '\x6dasturbator',
      '\x63ock ring',
    ].some((hint) => source.includes(hint));

  if (
    [
      'we-vibe',
      'couple',
      'couples',
      'partner',
      'shared',
      'remote',
      'dual stimulation',
      'wearable',
    ].some((hint) => source.includes(hint))
  ) {
    return 'unisex';
  }
  if (hasFemaleHint && !hasMaleHint) {
    return 'female';
  }
  if (hasMaleHint && !hasFemaleHint) {
    return 'male';
  }
  if (hasFemaleHint && hasMaleHint) {
    return 'unisex';
  }
  return 'unisex';
}

function extractWaterproofLevel(text: string): number | null {
  const source = String(text || '');
  const ipxMatch = source.match(/ipx\s*([0-9])/i);
  if (ipxMatch) return Number(ipxMatch[1]);
  if (/waterproof/i.test(source)) return 7;
  if (/water resistant|splashproof/i.test(source)) return 4;
  return null;
}

function inferMaterial(text: string): string {
  const source = String(text || '').toLowerCase();
  if (source.includes('body-safe silicone') || source.includes('soft silicone') || source.includes('silicone')) return '硅胶';
  if (source.includes('abs')) return 'ABS塑料';
  return '硅胶 / ABS塑料';
}

function inferFunctionTags(text: string): string[] {
  const source = String(text || '').toLowerCase();
  const tags: string[] = [];
  if (['pleasure air', 'air suction', 'air pressure', '\x63litoral stimulator', '\x63lit sucking'].some((hint) => source.includes(hint))) {
    tags.push('吮吸刺激');
  }
  if (['g-spot', 'dual stimulator', 'dual stimulation'].some((hint) => source.includes(hint))) {
    tags.push('G点刺激');
  }
  if (['smart silence', 'whisper quiet', 'quietest model', 'nearly silent'].some((hint) => source.includes(hint))) {
    tags.push('静音');
  }
  if (['waterproof', 'ipx7', 'ipx 7'].some((hint) => source.includes(hint))) {
    tags.push('防水');
  }
  if (['remote', 'app'].some((hint) => source.includes(hint))) {
    tags.push('远程互动');
  }
  if (['autopilot'].some((hint) => source.includes(hint))) {
    tags.push('自动节奏');
  }
  return uniqueStrings(tags, 10);
}

function inferPhysicalForm(text: string): string {
  const source = String(text || '').toLowerCase();
  if (['dual stimulator', 'dual stimulation', 'rabbit', 'couple'].some((hint) => source.includes(hint))) return 'composite';
  if (['g-spot', 'vaginal', 'insertable', 'prostate', '\x61nal'].some((hint) => source.includes(hint))) return 'internal';
  return 'external';
}

function inferMotorType(text: string): string {
  const source = String(text || '').toLowerCase();
  if (['powerful', 'intense', 'strong', 'ultrawave'].some((hint) => source.includes(hint))) return 'strong';
  return 'gentle';
}

function inferAppearance(text: string): string {
  const source = String(text || '').toLowerCase();
  if (['discreet', 'discretion', 'travel lock', 'quiet'].some((hint) => source.includes(hint))) return 'high_disguise';
  return 'normal';
}

export function resolveRmbPrice(usd: number | null, rate = usdToCnyRate): number | null {
  if (!Number.isFinite(Number(usd)) || Number(usd) <= 0) return null;
  return Math.round(Number(usd) * rate);
}

export function buildNormalizedSpecs(item: CleanerBufferItem): NormalizedSpecs {
  const rawDescription = normalizeWhitespace(String(item.rawDescription || ''));
  const text = [
    item.name,
    item.subtitle,
    item.brand,
    rawDescription,
    item.stock,
  ]
    .filter(Boolean)
    .join('\n');
  const priceUsd = parseNumber(item.priceUsd ?? item.price ?? null);

  return {
    price_usd: priceUsd,
    price_rmb: resolveRmbPrice(priceUsd),
    fx_rate_usd_cny: usdToCnyRate,
    fx_rate_source: usdToCnyRateSource,
    fx_rate_date: usdToCnyRateDate || null,
    waterproof: extractWaterproofLevel(text),
    max_db: /whisper quiet|smart silence|nearly silent/i.test(text) ? 40 : DEFAULT_DEVICE_MAX_DB,
    appearance: inferAppearance(text),
    physical_form: inferPhysicalForm(text),
    motor_type: inferMotorType(text),
    gender: inferGender(text, String(item.genderHint || '')),
    material: inferMaterial(text),
    function_tags: inferFunctionTags(text),
  };
}

async function refreshUsdToCnyRate() {
  try {
    const response = await fetch('https://api.frankfurter.dev/v1/latest?base=USD&symbols=CNY', {
      headers: { accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = (await response.json()) as { date?: string; rates?: Record<string, number> };
    const liveRate = Number(payload?.rates?.CNY);
    if (!Number.isFinite(liveRate) || liveRate <= 0) throw new Error('missing CNY rate');

    usdToCnyRate = liveRate;
    usdToCnyRateDate = String(payload?.date || '').trim();
    usdToCnyRateSource = 'frankfurter';
    console.log(`[汇率] 已刷新 USD/CNY=${usdToCnyRate}${usdToCnyRateDate ? ` (date=${usdToCnyRateDate})` : ''}`);
  } catch (error) {
    usdToCnyRate = FALLBACK_USD_TO_CNY_RATE;
    usdToCnyRateDate = '';
    usdToCnyRateSource = 'fallback';
    console.warn(`[汇率] 实时汇率获取失败，回退到固定汇率 USD/CNY=${FALLBACK_USD_TO_CNY_RATE}:`, error);
  }
}

export async function runCleaner() {
  if (!fs.existsSync(BUFFER_PATH)) {
    console.warn('[womanizer-official] review buffer 不存在，跳过 cleaner。');
    return [];
  }

  await refreshUsdToCnyRate();

  const rawRows = JSON.parse(fs.readFileSync(BUFFER_PATH, 'utf8')) as CleanerBufferItem[];
  const prepared = prepareUniqueBufferItemsForCleaning(rawRows as Array<Record<string, unknown>>);
  const cleanedData: Array<Record<string, unknown>> = [];

  for (const row of prepared.items as CleanerBufferItem[]) {
    const rawDescription = String(row.rawDescription || '');
    const fallbackName = normalizeWhitespace(String(row.name || ''));
    const canonicalName = normalizeWhitespace(extractCanonicalName(rawDescription, fallbackName));
    if (isPlaceholderProductName(canonicalName)) {
      console.warn(`[跳过] 商品名无效 (${canonicalName || 'empty'})，不执行清洗与入库。`);
      continue;
    }

    const translatedRawDescription = await translateRawDescriptionToZh(rawDescription, {
      cachePath: RAW_TRANSLATION_CACHE_PATH,
      logLabel: canonicalName,
    });

    const finalizedRawDescription =
      translatedRawDescription && hasMeaningfulEnglish(translatedRawDescription)
        ? await translateRawDescriptionToZh(translatedRawDescription, {
            cachePath: RAW_TRANSLATION_CACHE_PATH,
            logLabel: `${canonicalName} 二次`,
            force: true,
          })
        : translatedRawDescription;

    const persistedRawDescription = resolvePersistedRawDescription(finalizedRawDescription, rawDescription);
    const brand = inferBrandFromItem({
      name: canonicalName,
      rawDescription: persistedRawDescription,
      brand: row.brand,
    });
    const specs = buildNormalizedSpecs({
      ...row,
      name: canonicalName,
      brand,
      rawDescription: persistedRawDescription,
    });
    const numericPrice = specs.price_rmb;
    const coverImage = normalizeWhitespace(String(row.coverImage || '')) || null;
    const sourceUrl = normalizeWhitespace(String(row.sourceUrl || '')) || null;

    const productPayload = {
      name: canonicalName,
      price: numericPrice,
      image: coverImage,
      link: sourceUrl,
      specs: {
        ...specs,
        price_source_currency: normalizeWhitespace(String(row.priceCurrency || 'USD')) || 'USD',
        price_source_amount: specs.price_usd,
        rawDescription: persistedRawDescription || null,
      } as any,
      gender: specs.gender.charAt(0).toUpperCase() + specs.gender.slice(1),
      tags: specs.function_tags,
    };

    const itemPayload = {
      name: canonicalName,
      safe_display_name: buildSafeDisplayName(canonicalName),
      brand,
      price: numericPrice,
      max_db: specs.max_db,
      waterproof: specs.waterproof,
      appearance: specs.appearance,
      physical_form: specs.physical_form,
      motor_type: specs.motor_type,
      gender: specs.gender,
      material: specs.material,
      image_url: coverImage,
      raw_description: persistedRawDescription || null,
      updated_at: new Date(),
    };

    cleanedData.push({
      name: canonicalName,
      brand,
      price: numericPrice,
      image: coverImage,
      link: sourceUrl,
      rawDescription: persistedRawDescription,
      specs: {
        ...specs,
        price_source_currency: normalizeWhitespace(String(row.priceCurrency || 'USD')) || 'USD',
        price_source_amount: specs.price_usd,
      },
    });

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
            ...itemPayload,
          },
        });
      });
      console.log(`[完成] \`${canonicalName}\` 数据已注入数据库。`);
    } catch (error) {
      console.error(`[故障] 数据处理失败: ${canonicalName}`, error);
    }
  }

  const dir = path.dirname(CLEANED_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CLEANED_PATH, JSON.stringify(cleanedData, null, 2));

  await prisma.$disconnect().catch(() => {});
  await pool.end().catch(() => {});
  console.log('\n--- womanizer 官方站数据流水线任务结束 ---');

  return cleanedData;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCleaner().catch((error) => {
    console.error(error);
    prisma.$disconnect().catch(() => {});
    pool.end().catch(() => {});
    process.exitCode = 1;
  });
}
