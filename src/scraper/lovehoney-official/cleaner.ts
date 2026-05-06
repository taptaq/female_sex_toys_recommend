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
const BUFFER_PATH = path.resolve(__dirname, '../../data/lovehoney-official-review-buffer.json');
const CLEANED_PATH = path.resolve(__dirname, '../../data/lovehoney-official-cleaned-data.json');
const RAW_TRANSLATION_CACHE_PATH = path.resolve(__dirname, '../../data/lovehoney-official-raw-description-zh-cache.json');

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const FALLBACK_CURRENCY_TO_CNY_RATE: Record<string, number> = {
  GBP: 9.1,
  USD: 7.2,
  EUR: 7.8,
};

const currencyToCnyRate = new Map<string, number>();
const currencyRateDate = new Map<string, string>();
const currencyRateSource = new Map<string, string>();

type CleanerBufferItem = {
  sourceUrl?: string;
  name?: string;
  price?: number | null;
  priceCurrency?: string | null;
  originalPrice?: number | null;
  originalPriceCurrency?: string | null;
  coverImage?: string | null;
  rawDescription?: string;
  genderHint?: string;
  imagePlaceholder?: string;
  [key: string]: unknown;
};

type ParsedSpecs = {
  max_db: number | null;
  waterproof: number | null;
  appearance: string;
  physical_form: string;
  motor_type: string;
  function_tags: string[];
  gender: 'male' | 'female' | 'unisex';
  material: string;
  price_source_currency: string | null;
  price_source_amount: number | null;
  price_rmb: number | null;
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

async function refreshCurrencyToCnyRate(currency: string) {
  const normalizedCurrency = String(currency || 'UNKNOWN').trim().toUpperCase();
  if (!normalizedCurrency || normalizedCurrency === 'UNKNOWN') return;
  if (currencyToCnyRate.has(normalizedCurrency)) return;

  try {
    const response = await fetch(`https://api.frankfurter.dev/v1/latest?base=${normalizedCurrency}&symbols=CNY`, {
      headers: { accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = (await response.json()) as { date?: string; rates?: Record<string, number> };
    const liveRate = Number(payload?.rates?.CNY);
    if (!Number.isFinite(liveRate) || liveRate <= 0) throw new Error('missing CNY rate');

    currencyToCnyRate.set(normalizedCurrency, liveRate);
    currencyRateDate.set(normalizedCurrency, String(payload?.date || '').trim());
    currencyRateSource.set(normalizedCurrency, 'frankfurter');
    console.log(`[汇率] 已刷新 ${normalizedCurrency}/CNY=${liveRate}${payload?.date ? ` (date=${payload.date})` : ''}`);
  } catch (error) {
    const fallback = FALLBACK_CURRENCY_TO_CNY_RATE[normalizedCurrency] || FALLBACK_CURRENCY_TO_CNY_RATE.USD;
    currencyToCnyRate.set(normalizedCurrency, fallback);
    currencyRateDate.set(normalizedCurrency, '');
    currencyRateSource.set(normalizedCurrency, 'fallback');
    console.warn(`[汇率] ${normalizedCurrency}/CNY 获取失败，回退到固定汇率 ${fallback}:`, error);
  }
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

function uniqueStrings(values: Array<string | null | undefined>, limit = 30): string[] {
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
  const numeric = Number(String(value ?? '').replace(/,/g, '').replace(/[^\d.]+/g, ''));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

const mapGender = (raw: string, format: 'lowercase' | 'capitalized' = 'lowercase'): string => {
  const value = (raw || '').toLowerCase();
  let result = 'unisex';
  if (['female', '女性', '女用'].some((hint) => value.includes(hint))) result = 'female';
  else if (['male', '男性', '男用'].some((hint) => value.includes(hint))) result = 'male';
  else if (['unisex', '通用', '情侣', 'couple'].some((hint) => value.includes(hint))) result = 'unisex';
  return format === 'capitalized' ? result.charAt(0).toUpperCase() + result.slice(1) : result;
};

const mapPhysicalForm = (raw: string): string => {
  const value = (raw || '').toLowerCase();
  if (['composite', '复合', 'rabbit', 'dual'].some((hint) => value.includes(hint))) return 'composite';
  if (
    ['internal', 'insertable', 'vaginal', '\x61nal', 'g-spot', 'prostate', 'insert', '\u809b\u585e', '\u63d2\u5165'].some((hint) =>
      value.includes(hint),
    )
  )
    return 'internal';
  return 'external';
};

const mapMotorType = (raw: string): string => {
  const value = (raw || '').toLowerCase();
  if (['strong', 'powerful', 'intense', 'rumbling', '强'].some((hint) => value.includes(hint))) return 'strong';
  return 'gentle';
};

const mapAppearance = (raw: string): string => {
  const value = (raw || '').toLowerCase();
  if (['disguise', '隐蔽', '伪装', 'discreet', 'wearable'].some((hint) => value.includes(hint))) return 'high_disguise';
  return 'normal';
};

const normalizeMaxDb = (raw: unknown): number | null => {
  const numeric = Number(String(raw ?? '').match(/\d+(?:\.\d+)?/)?.[0]);
  if (!Number.isFinite(numeric)) return null;
  if (numeric < 15 || numeric > 90) return null;
  return Math.round(numeric);
};

const extractNoiseMaxDb = (text: string): number | null => {
  const source = String(text || '')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/\s+/g, ' ');

  const patterns = [
    /(?:below|under|less than|up to|≤|<)?\s*(\d{2}(?:\.\d+)?)\s*(?:dB|db|DB|分贝)/gi,
    /(?:quiet|whisper quiet|noise|volume)[^\d]{0,12}(\d{2}(?:\.\d+)?)/gi,
  ];

  const candidates: number[] = [];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const value = normalizeMaxDb(match[1]);
      if (value !== null) candidates.push(value);
    }
  }

  if (candidates.length === 0) return null;
  return Math.min(...candidates);
};

function extractWaterproofLevel(text: string): number | null {
  const source = String(text || '').toLowerCase();
  const ipxMatch = source.match(/ipx\s*([0-9])/i);
  if (ipxMatch) return Number(ipxMatch[1]);
  if (/\bwaterproof\b|fully waterproof|100% waterproof|wasserdicht/i.test(source)) return 7;
  if (/water resistant|splashproof|splash proof/i.test(source)) return 4;
  return null;
}

function inferDefaultMaterial(name: string, rawDescription: string): string {
  const source = `${name}\n${rawDescription}`.toLowerCase();
  const materialMatch = source.match(/material\s*[:：]\s*([^\n]+)/i);
  if (materialMatch?.[1]) return normalizeWhitespace(materialMatch[1]);
  if (source.includes('silicone')) return '硅胶';
  if (source.includes('abs')) return 'ABS塑料';
  if (source.includes('glass')) return '玻璃';
  if (source.includes('metal')) return '金属';
  return '硅胶 / ABS塑料';
}

function extractFunctionTags(name: string, rawDescription: string): string[] {
  const source = `${name}\n${rawDescription}`.toLowerCase();
  const pairs: Array<[string, string[]]> = [
    ['\u9634\u8482刺激', ['\x63litoral', '\x63litoris', '\x63lit']],
    ['G点刺激', ['g-spot']],
    ['兔耳双刺激', ['rabbit']],
    ['\u524d\u5217\u817a刺激', ['prostate']],
    ['锁精环', ['\x63ock ring']],
    ['情侣互动', ['couple', 'couples']],
    ['按摩棒', ['wand']],
    ['吮吸', ['suction', 'air pulse', 'air-pulse']],
    ['震动', ['\x76ibrator', 'vibration', 'vibrating']],
    ['防水', ['waterproof', 'water resistant', 'ipx']],
    ['可充电', ['rechargeable', 'usb', 'charge']],
    ['静音', ['quiet', 'whisper']],
  ];
  return uniqueStrings(pairs.filter(([, hints]) => hints.some((hint) => source.includes(hint))).map(([tag]) => tag), 10);
}

function parseCurrencyCode(value: string): string {
  const source = String(value || '').toUpperCase();
  if (source.includes('GBP') || source.includes('£')) return 'GBP';
  if (source.includes('USD') || source.includes('$')) return 'USD';
  if (source.includes('EUR') || source.includes('€')) return 'EUR';
  return 'UNKNOWN';
}

function resolveSourcePrice(item: CleanerBufferItem): { amount: number | null; currency: string } {
  const amount = parseNumber(item.price);
  const currency = parseCurrencyCode(String(item.priceCurrency || ''));
  return { amount, currency };
}

function resolveRmbPrice(amount: number | null, currency: string): number | null {
  if (amount === null) return null;
  const normalizedCurrency = parseCurrencyCode(currency);
  const rate = currencyToCnyRate.get(normalizedCurrency);
  if (!rate) return null;
  return Math.round(amount * rate);
}

function buildDefaultSpecs(item: CleanerBufferItem, canonicalName: string, rawDescription: string): ParsedSpecs {
  const sourcePrice = resolveSourcePrice(item);
  const resolvedGender = mapGender(item.genderHint || 'unisex') as 'male' | 'female' | 'unisex';
  return {
    max_db: extractNoiseMaxDb(`${canonicalName}\n${rawDescription}`) ?? 40,
    waterproof: extractWaterproofLevel(rawDescription),
    appearance: /wearable|discreet/i.test(rawDescription) ? 'high_disguise' : 'normal',
    physical_form: /rabbit|g-spot|vaginal|\x61nal|prostate|insert/i.test(rawDescription) ? 'internal' : 'external',
    motor_type: /strong|powerful|intense|rumbling/i.test(rawDescription) ? 'strong' : 'gentle',
    function_tags: extractFunctionTags(canonicalName, rawDescription),
    gender: resolvedGender,
    material: inferDefaultMaterial(canonicalName, rawDescription),
    price_source_currency: sourcePrice.currency,
    price_source_amount: sourcePrice.amount,
    price_rmb: resolveRmbPrice(sourcePrice.amount, sourcePrice.currency),
  };
}

async function translateRawDescriptionSafely(rawDescription: string, canonicalName: string): Promise<string> {
  if (!normalizeWhitespace(rawDescription)) return '';
  try {
    const translated = await translateRawDescriptionToZh(rawDescription, {
      cachePath: RAW_TRANSLATION_CACHE_PATH,
      logLabel: canonicalName,
    });
    if (translated && hasMeaningfulEnglish(translated)) {
      try {
        return await translateRawDescriptionToZh(translated, {
          cachePath: RAW_TRANSLATION_CACHE_PATH,
          logLabel: `${canonicalName} 二次`,
          force: true,
        });
      } catch (error) {
        console.warn(`[翻译] ${canonicalName} 二次翻译失败，保留首次结果。`, error);
      }
    }
    return translated;
  } catch (error) {
    console.warn(`[翻译] ${canonicalName} 翻译失败，回退原文。`, error);
    return rawDescription;
  }
}

export async function runCleaner() {
  console.log('\n======================================================');
  console.log('--- 启动 Lovehoney 官方站 AI 清洗与入库模块 ---');
  console.log('======================================================');

  try {
    await prisma.$connect();
    console.log('✅ [DB] 数据库连接正常。');
  } catch (error) {
    console.error('❌ [DB] 数据库连接失败:', error);
    return;
  }

  if (!fs.existsSync(BUFFER_PATH)) {
    console.error('[中断] 未发现 Lovehoney review-buffer。');
    await prisma.$disconnect();
    await pool.end().catch(() => {});
    return;
  }

  const bufferData = JSON.parse(fs.readFileSync(BUFFER_PATH, 'utf-8'));
  console.log(`[清洗] review-buffer 已载入 ${Array.isArray(bufferData) ? bufferData.length : 0} 条记录`);
  if (!Array.isArray(bufferData) || bufferData.length === 0) {
    fs.writeFileSync(CLEANED_PATH, JSON.stringify([], null, 2));
    console.error('[中断] review-buffer 为空，本次不执行入库。');
    await prisma.$disconnect();
    await pool.end().catch(() => {});
    return;
  }

  const {
    items: preparedBufferItems,
    skippedDuplicateNames,
  } = prepareUniqueBufferItemsForCleaning(bufferData as Array<Record<string, unknown>>);
  const targetBufferItems = preparedBufferItems as CleanerBufferItem[];
  if (skippedDuplicateNames.length > 0) {
    console.log(`[清洗] 已按商品名跳过 ${skippedDuplicateNames.length} 条缓冲重复记录`);
  }

  const currencies = uniqueStrings(targetBufferItems.map((item) => String(item.priceCurrency || 'UNKNOWN')));
  for (const currency of currencies) {
    await refreshCurrencyToCnyRate(currency);
  }

  let brandId: string | null = null;
  try {
    const competitor = await withDbRetry('查询 Lovehoney 竞品', () =>
      prisma.competitors.findFirst({
        where: { name: { contains: 'lovehoney', mode: 'insensitive' } },
      }),
    );
    if (competitor) {
      brandId = competitor.id;
      console.log(`[关联] 已定位 Lovehoney 竞品 ID: ${brandId}`);
    } else {
      const newBrand = await withDbRetry('创建 Lovehoney 竞品', () =>
        prisma.competitors.create({
          data: {
            name: 'Lovehoney',
            description: 'Lovehoney 是英国\u6210\u4eba\u7528\u54c1零售与品牌平台，覆盖女性、男性和情侣场景产品。',
            is_domestic: false,
          },
        }),
      );
      brandId = newBrand.id;
      console.log(`[创建] 已创建 Lovehoney 竞品记录 (ID: ${brandId})`);
    }
  } catch (error) {
    console.warn('[警告] competitors 关联失败，将继续非关联入库。', error);
  }

  const cleanedData: Array<Record<string, unknown>> = [];

  for (const item of targetBufferItems) {
    const rawDescription = String(item.rawDescription || '');
    const fallbackName = String(item.name || '');
    const sourceUrl = String(item.sourceUrl || '');
    const coverImage = String(item.coverImage || '').trim() || null;
    const canonicalName = String(extractCanonicalName(rawDescription, fallbackName) || '').trim();
    if (isPlaceholderProductName(canonicalName)) {
      console.warn(`[跳过] 商品名无效 (${canonicalName || 'empty'})，不执行清洗与入库。`);
      continue;
    }

    const finalizedRawDescription = await translateRawDescriptionSafely(rawDescription, canonicalName);
    const persistedRawDescription = resolvePersistedRawDescription(finalizedRawDescription, rawDescription);
    const specs = buildDefaultSpecs(item, canonicalName, persistedRawDescription);
    specs.material = specs.material || inferDefaultMaterial(canonicalName, persistedRawDescription);
    specs.function_tags = uniqueStrings(specs.function_tags, 10);
    specs.max_db = extractNoiseMaxDb(`${canonicalName}\n${persistedRawDescription}`) ?? specs.max_db;
    specs.waterproof = extractWaterproofLevel(persistedRawDescription) ?? specs.waterproof;

    const sourcePrice = resolveSourcePrice(item);
    specs.price_source_currency = sourcePrice.currency;
    specs.price_source_amount = sourcePrice.amount;
    specs.price_rmb = resolveRmbPrice(sourcePrice.amount, sourcePrice.currency);

    const normalizedGender = mapGender(item.genderHint || specs.gender || 'unisex') as 'male' | 'female' | 'unisex';
    specs.gender = normalizedGender;

    const processedProduct = {
      name: canonicalName,
      price: specs.price_rmb,
      sourceUrl,
      image: coverImage || item.imagePlaceholder || null,
      specs: {
        ...specs,
        fx_rate_to_cny: currencyToCnyRate.get(specs.price_source_currency || 'UNKNOWN') || null,
        fx_rate_source: currencyRateSource.get(specs.price_source_currency || 'UNKNOWN') || null,
        fx_rate_date: currencyRateDate.get(specs.price_source_currency || 'UNKNOWN') || null,
      },
      rawDescription: persistedRawDescription,
    };
    cleanedData.push({ ...processedProduct, dbAction: 'pending' });

    try {
      const existingProduct = await withDbRetry(`查重商品 ${canonicalName}`, () =>
        prisma.products.findFirst({ where: { name: canonicalName } }),
      );
      if (existingProduct) {
        cleanedData[cleanedData.length - 1] = { ...processedProduct, dbAction: 'skipped_duplicate_name' };
        console.log(`[跳过] 数据库中已存在同名商品，不重复入库: ${canonicalName}`);
        continue;
      }

      cleanedData[cleanedData.length - 1] = { ...processedProduct, dbAction: 'created' };

      const productPayload = {
        name: canonicalName,
        price: specs.price_rmb,
        image: coverImage || item.imagePlaceholder || null,
        link: sourceUrl || null,
        specs: {
          ...specs,
          rawDescription: persistedRawDescription || null,
          fx_rate_to_cny: currencyToCnyRate.get(specs.price_source_currency || 'UNKNOWN') || null,
          fx_rate_source: currencyRateSource.get(specs.price_source_currency || 'UNKNOWN') || null,
          fx_rate_date: currencyRateDate.get(specs.price_source_currency || 'UNKNOWN') || null,
        } as any,
        gender: mapGender(normalizedGender, 'capitalized'),
        tags: specs.function_tags || [],
        competitor_id: brandId ?? null,
      };

      await withDbRetry(`同步商品 ${canonicalName}`, async () => {
        const created = await prisma.products.create({ data: productPayload });

        await prisma.recommender_toys.deleteMany({ where: { name: canonicalName } });
        await prisma.recommender_toys.create({
          data: {
            original_id: created.id,
            name: canonicalName,
            safe_display_name: buildSafeDisplayName(canonicalName),
            brand: 'Lovehoney',
            price: specs.price_rmb,
            max_db: specs.max_db ?? 40,
            waterproof: typeof specs.waterproof === 'number' && Number.isFinite(specs.waterproof) ? specs.waterproof : null,
            appearance: mapAppearance(specs.appearance),
            physical_form: mapPhysicalForm(specs.physical_form),
            motor_type: mapMotorType(specs.motor_type),
            gender: normalizedGender,
            material: specs.material,
            image_url: coverImage || item.imagePlaceholder || null,
            raw_description: persistedRawDescription || null,
            updated_at: new Date(),
          },
        });
      });

      console.log(`[完成] \`${canonicalName}\` 数据已注入数据库。`);
    } catch (error) {
      cleanedData[cleanedData.length - 1] = {
        ...processedProduct,
        dbAction: 'db_failed',
        dbError: error instanceof Error ? error.message : String(error || ''),
      };
      console.error(`[故障] 数据处理失败: ${canonicalName}`, error);
    }
  }

  const dir = path.dirname(CLEANED_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CLEANED_PATH, JSON.stringify(cleanedData, null, 2));

  await prisma.$disconnect();
  await pool.end().catch(() => {});
  console.log('\n--- Lovehoney 官方站数据流水线任务结束 ---');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCleaner().catch((error) => {
    console.error(error);
    prisma.$disconnect();
    pool.end().catch(() => {});
  });
}
