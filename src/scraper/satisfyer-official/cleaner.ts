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
const BUFFER_PATH = path.resolve(__dirname, '../../data/satisfyer-official-review-buffer.json');
const CLEANED_PATH = path.resolve(__dirname, '../../data/satisfyer-official-cleaned-data.json');
const RAW_TRANSLATION_CACHE_PATH = path.resolve(__dirname, '../../data/satisfyer-official-raw-description-zh-cache.json');

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const FALLBACK_USD_TO_CNY_RATE = 7.2;
let usdToCnyRate = FALLBACK_USD_TO_CNY_RATE;
let usdToCnyRateDate = '';
let usdToCnyRateSource = 'fallback';

type CleanerBufferItem = {
  sourceUrl?: string;
  name?: string;
  price?: number | null;
  priceUsd?: number | null;
  originalPriceUsd?: number | null;
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
  price_usd: number | null;
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
  const numeric = Number(String(value ?? '').replace(/[^\d.]+/g, ''));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

const mapGender = (raw: string, format: 'lowercase' | 'capitalized' = 'lowercase'): string => {
  const value = (raw || '').toLowerCase();
  let result = 'unisex';
  if (['unisex', '通用', '双方', '情侣', 'couple', 'partner'].some((hint) => value.includes(hint))) result = 'unisex';
  else if (
    ['female', '女性', '女用', 'for her', '\x63litoral', 'g-spot', 'rabbit', 'vaginal', 'woman'].some((hint) =>
      value.includes(hint),
    )
  )
    result = 'female';
  else if (
    ['male', '男性', '男用', 'for him', '\x70enis', '\x63ock ring', 'prostate', '\x6dasturbator', 'stroker'].some((hint) =>
      value.includes(hint),
    )
  )
    result = 'male';

  return format === 'capitalized' ? result.charAt(0).toUpperCase() + result.slice(1) : result;
};

const inferExplicitGender = (text: string): 'male' | 'female' | 'unisex' | null => {
  const value = (text || '').toLowerCase();
  if (['unisex', 'couple', 'partner', '情侣', '通用'].some((hint) => value.includes(hint))) return 'unisex';
  if (['female', 'for her', 'g-spot', '\x63litoral', 'rabbit', 'vaginal', 'woman'].some((hint) => value.includes(hint)))
    return 'female';
  if (['male', 'for him', 'prostate', '\x70enis', '\x63ock ring', '\x6dasturbator', 'stroker'].some((hint) => value.includes(hint)))
    return 'male';
  return null;
};

const mapPhysicalForm = (raw: string): string => {
  const value = (raw || '').toLowerCase();
  if (['composite', '复合', 'rabbit', 'double', 'dual'].some((hint) => value.includes(hint))) return 'composite';
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
  return '硅胶 / ABS塑料';
}

function extractFunctionTags(name: string, rawDescription: string): string[] {
  const source = `${name}\n${rawDescription}`.toLowerCase();
  const pairs: Array<[string, string[]]> = [
    ['APP互联', ['connect app', 'remotyca', 'app control', 'app-supported']],
    ['\u9634\u8482刺激', ['\x63litoris', '\x63litoral', '\x63lit']],
    ['G点刺激', ['g-spot']],
    ['兔耳双刺激', ['rabbit']],
    ['\u524d\u5217\u817a刺激', ['prostate']],
    ['锁精环', ['\x63ock ring']],
    ['穿戴', ['wearable']],
    ['情侣互动', ['couple', 'partner', 'for couples']],
    ['吮吸', ['air-pulse', 'pressure wave', 'suction']],
    ['震动', ['vibration', '\x76ibrator', 'with vibration']],
    ['防水', ['waterproof', 'water resistant', 'ipx']],
    ['可充电', ['battery: akku', 'rechargeable', 'usb rechargeable']],
    ['静音', ['quiet', 'whisper']],
  ];

  const tags = pairs.filter(([, hints]) => hints.some((hint) => source.includes(hint))).map(([tag]) => tag);
  return uniqueStrings(tags, 10);
}

function resolveUsdPrice(item: CleanerBufferItem): number | null {
  return parseNumber(item.priceUsd) ?? parseNumber(item.price) ?? null;
}

function resolveRmbPrice(item: CleanerBufferItem): number | null {
  const usd = resolveUsdPrice(item);
  if (usd === null) return null;
  return Math.round(usd * usdToCnyRate);
}

function buildDefaultSpecs(item: CleanerBufferItem, canonicalName: string, rawDescription: string): ParsedSpecs {
  const gender = mapGender(inferExplicitGender(`${canonicalName}\n${rawDescription}`) || item.genderHint || 'unisex') as
    | 'male'
    | 'female'
    | 'unisex';
  const priceUsd = resolveUsdPrice(item);
  return {
    max_db: extractNoiseMaxDb(`${canonicalName}\n${rawDescription}`) ?? 40,
    waterproof: extractWaterproofLevel(rawDescription),
    appearance: /wearable|discreet/i.test(rawDescription) ? 'high_disguise' : 'normal',
    physical_form: /rabbit|g-spot|vaginal|\x61nal|prostate|insert/i.test(rawDescription) ? 'internal' : 'external',
    motor_type: /strong|powerful|intense|rumbling/i.test(rawDescription) ? 'strong' : 'gentle',
    function_tags: extractFunctionTags(canonicalName, rawDescription),
    gender,
    material: inferDefaultMaterial(canonicalName, rawDescription),
    price_usd: priceUsd,
    price_rmb: priceUsd === null ? null : Math.round(priceUsd * usdToCnyRate),
  };
}

async function translateRawDescriptionSafely(rawDescription: string, canonicalName: string): Promise<string> {
  if (!normalizeWhitespace(rawDescription)) return '';
  try {
    const translatedRawDescription = await translateRawDescriptionToZh(rawDescription, {
      cachePath: RAW_TRANSLATION_CACHE_PATH,
      logLabel: canonicalName,
    });
    if (translatedRawDescription && hasMeaningfulEnglish(translatedRawDescription)) {
      try {
        return await translateRawDescriptionToZh(translatedRawDescription, {
          cachePath: RAW_TRANSLATION_CACHE_PATH,
          logLabel: `${canonicalName} 二次`,
          force: true,
        });
      } catch (error) {
        console.warn(`[翻译] ${canonicalName} 二次翻译失败，保留首次结果。`, error);
      }
    }
    return translatedRawDescription;
  } catch (error) {
    console.warn(`[翻译] ${canonicalName} 翻译失败，回退原文。`, error);
    return rawDescription;
  }
}

export async function runCleaner() {
  console.log('\n======================================================');
  console.log('--- 启动 Satisfyer 官方站 AI 清洗与入库模块 ---');
  console.log('======================================================');

  try {
    await prisma.$connect();
    console.log('✅ [DB] 数据库连接正常。');
  } catch (error) {
    console.error('❌ [DB] 数据库连接失败:', error);
    return;
  }

  if (!fs.existsSync(BUFFER_PATH)) {
    console.error('[中断] 未发现 Satisfyer review-buffer。');
    await prisma.$disconnect();
    return;
  }

  const bufferData = JSON.parse(fs.readFileSync(BUFFER_PATH, 'utf-8'));
  console.log(`[清洗] review-buffer 已载入 ${Array.isArray(bufferData) ? bufferData.length : 0} 条记录`);
  if (!Array.isArray(bufferData) || bufferData.length === 0) {
    console.error('[中断] review-buffer 为空，本次不执行入库。');
    await prisma.$disconnect();
    return;
  }

  const {
    items: preparedBufferItems,
    skippedDuplicateNames,
  } = prepareUniqueBufferItemsForCleaning(bufferData as Array<Record<string, unknown>>);
  const targetBufferItems = preparedBufferItems as CleanerBufferItem[];
  if (skippedDuplicateNames.length > 0) {
    console.log(`[清洗] 已按商品名跳过 ${skippedDuplicateNames.length} 条缓冲重复记录`);
    for (const duplicate of skippedDuplicateNames) {
      console.log(`[跳过] 同名商品仅保留首条: ${duplicate.canonicalName} <- ${duplicate.sourceUrl}`);
    }
  }

  await refreshUsdToCnyRate();

  let brandId: string | null = null;
  try {
    const competitor = await withDbRetry('查询 Satisfyer 竞品', () =>
      prisma.competitors.findFirst({
        where: {
          name: { contains: 'satisfyer', mode: 'insensitive' },
        },
      }),
    );

    if (competitor) {
      brandId = competitor.id;
      console.log(`[关联] 已定位 Satisfyer 竞品 ID: ${brandId}`);
    } else {
      const newBrand = await withDbRetry('创建 Satisfyer 竞品', () =>
        prisma.competitors.create({
          data: {
            name: 'Satisfyer',
            description: 'Satisfyer 是以吸吮、震动、情侣互动和应用互联产品见长的国际\u60c5\u8da3品牌。',
            is_domestic: false,
          },
        }),
      );
      brandId = newBrand.id;
      console.log(`[创建] 已创建 Satisfyer 竞品记录 (ID: ${brandId})`);
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
    const explicitGender = inferExplicitGender(`${canonicalName}\n${fallbackName}\n${persistedRawDescription}`);
    const resolvedGender = mapGender(explicitGender || item.genderHint || specs.gender || 'unisex') as
      | 'male'
      | 'female'
      | 'unisex';
    specs.gender = resolvedGender;
    specs.material = specs.material || inferDefaultMaterial(canonicalName, persistedRawDescription);
    specs.function_tags = uniqueStrings(specs.function_tags, 10);
    specs.max_db = extractNoiseMaxDb(`${canonicalName}\n${persistedRawDescription}`) ?? specs.max_db;
    specs.waterproof = extractWaterproofLevel(persistedRawDescription) ?? specs.waterproof;
    specs.price_usd = resolveUsdPrice(item);
    specs.price_rmb = resolveRmbPrice(item);

    const numericPrice = specs.price_rmb;
    const processedProduct = {
      name: canonicalName,
      price: numericPrice,
      sourceUrl,
      image: coverImage,
      specs: {
        ...specs,
        fx_rate_usd_cny: usdToCnyRate,
        fx_rate_source: usdToCnyRateSource,
        fx_rate_date: usdToCnyRateDate || null,
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
        price: numericPrice,
        image: coverImage,
        link: sourceUrl || null,
        specs: {
          ...specs,
          rawDescription: persistedRawDescription || null,
          fx_rate_usd_cny: usdToCnyRate,
          fx_rate_source: usdToCnyRateSource,
          fx_rate_date: usdToCnyRateDate || null,
        } as any,
        gender: mapGender(resolvedGender, 'capitalized'),
        tags: specs.function_tags || [],
        competitor_id: brandId ?? null,
      };

      await withDbRetry(`同步商品 ${canonicalName}`, async () => {
        const created = await prisma.products.create({ data: productPayload });

        const itemPayload = {
          original_id: created.id,
          name: canonicalName,
          safe_display_name: buildSafeDisplayName(canonicalName),
          brand: 'Satisfyer',
          price: numericPrice,
          max_db: specs.max_db ?? 40,
          waterproof: typeof specs.waterproof === 'number' && Number.isFinite(specs.waterproof) ? specs.waterproof : null,
          appearance: mapAppearance(specs.appearance),
          physical_form: mapPhysicalForm(specs.physical_form),
          motor_type: mapMotorType(specs.motor_type),
          gender: resolvedGender,
          material: specs.material,
          image_url: coverImage || item.imagePlaceholder || null,
          raw_description: persistedRawDescription || null,
          updated_at: new Date(),
        };

        await prisma.recommender_toys.deleteMany({ where: { name: canonicalName } });
        await prisma.recommender_toys.create({ data: itemPayload });
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
  console.log('\n--- Satisfyer 官方站数据流水线任务结束 ---');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCleaner().catch((error) => {
    console.error(error);
    prisma.$disconnect();
    pool.end().catch(() => {});
  });
}
