import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { buildSafeDisplayName } from '../../lib/product-display-name.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BUFFER_PATH = path.resolve(__dirname, '../../data/zalo-official-review-buffer.json');
const CLEANED_PATH = path.resolve(__dirname, '../../data/zalo-official-cleaned-data.json');

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const FALLBACK_USD_TO_CNY_RATE = 7.2;
let usdToCnyRate = FALLBACK_USD_TO_CNY_RATE;
let usdToCnyRateDate = '';
let usdToCnyRateSource = 'fallback';

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

let openai: OpenAI | null = null;
try {
  const primaryKey = process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY;
  if (primaryKey) {
    openai = new OpenAI({
      apiKey: primaryKey,
      baseURL: 'https://api.deepseek.com/v1',
    });
  }
} catch {
  console.warn('⚠️ [Init] 初始模型客户端加载失败');
}

async function callGlmFallback(prompt: string) {
  console.log('⚠️ [Fallback] 正在切换至 glm-4.6v 兜底链路...');
  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) throw new Error('GLM_API_KEY 未配置');

  const glm = new OpenAI({
    apiKey,
    baseURL: 'https://open.bigmodel.cn/api/paas/v4/',
  });

  const response = await glm.chat.completions.create({
    model: 'glm-4.6v',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
  });

  return response.choices[0]?.message?.content || '{}';
}

async function refreshUsdToCnyRate() {
  try {
    const response = await fetch('https://api.frankfurter.dev/v1/latest?base=USD&symbols=CNY', {
      headers: {
        accept: 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = (await response.json()) as {
      date?: string;
      rates?: Record<string, number>;
    };
    const liveRate = Number(payload?.rates?.CNY);
    if (!Number.isFinite(liveRate) || liveRate <= 0) {
      throw new Error('missing CNY rate');
    }

    usdToCnyRate = liveRate;
    usdToCnyRateDate = String(payload?.date || '').trim();
    usdToCnyRateSource = 'frankfurter';
    console.log(
      `[汇率] 已刷新 USD/CNY=${usdToCnyRate}${usdToCnyRateDate ? ` (date=${usdToCnyRateDate})` : ''}`,
    );
  } catch (error) {
    usdToCnyRate = FALLBACK_USD_TO_CNY_RATE;
    usdToCnyRateDate = '';
    usdToCnyRateSource = 'fallback';
    console.warn(
      `[汇率] 实时汇率获取失败，回退到固定汇率 USD/CNY=${FALLBACK_USD_TO_CNY_RATE}:`,
      error,
    );
  }
}

const mapGender = (raw: string, format: 'lowercase' | 'capitalized' = 'lowercase'): string => {
  const value = (raw || '').toLowerCase();
  let result = 'unisex';
  if (
    ['情侣', '夫妻', '双人', 'couple', 'partner', 'shared intimacy', 'unisex', 'for couples'].some((hint) =>
      value.includes(hint),
    )
  )
    result = 'unisex';
  else if (
    ['male', '男性', '男用', 'for him', '\x70enis', '\x63ock ring', 'prostate', '\u524d\u5217\u817a', '\u9634\u830e', '震动环'].some((hint) =>
      value.includes(hint),
    )
  )
    result = 'male';
  else if (
    [
      'female',
      '女性',
      '女用',
      'for her',
      '\x63litoral',
      'g-spot',
      'rabbit',
      'vaginal',
      'g点',
      '\u9634\u8482',
      '吮吸',
      '按摩棒',
      '跳蛋',
      '穿戴',
      '拍打',
      '\u53e3\u4ea4',
    ].some((hint) => value.includes(hint))
  )
    result = 'female';

  return format === 'capitalized' ? result.charAt(0).toUpperCase() + result.slice(1) : result;
};

const inferExplicitGender = (text: string): 'male' | 'female' | 'unisex' | null => {
  const value = (text || '').toLowerCase();
  if (
    ['情侣', '夫妻', '双人', 'couple', 'partner', 'shared intimacy', 'unisex', 'for couples'].some((hint) =>
      value.includes(hint),
    )
  ) {
    return 'unisex';
  }
  if (
    ['男用', '男性', '\x63ock ring', '\x70enis', 'for him', 'prostate', '\u524d\u5217\u817a', '\u9634\u830e'].some((hint) =>
      value.includes(hint),
    )
  ) {
    return 'male';
  }
  if (
    [
      '女用',
      '女性',
      '\x63litoral',
      'g-spot',
      'rabbit',
      'vaginal',
      'for her',
      'g点',
      '\u9634\u8482',
      'c点',
      '按摩棒',
      '跳蛋',
      '\u9707\u52a8\u68d2',
      '拍打',
      '吮吸',
      '穿戴',
      '\u53e3\u4ea4',
    ].some((hint) => value.includes(hint))
  ) {
    return 'female';
  }
  return null;
};

const mapPhysicalForm = (raw: string): string => {
  const value = (raw || '').toLowerCase();
  if (['composite', '复合', 'rabbit', '双头', 'dual', '双刺激'].some((hint) => value.includes(hint))) return 'composite';
  if (
    ['internal', 'insertable', 'insert', 'vaginal', '\x61nal', 'g-spot', '\u524d\u5217\u817a', '\u809b\u585e', '\u63d2\u5165', '抽插', '穿戴'].some(
      (hint) => value.includes(hint),
    )
  )
    return 'internal';
  return 'external';
};

const mapMotorType = (raw: string): string => {
  const value = (raw || '').toLowerCase();
  if (['strong', 'powerful', 'intense', '强', '高频', '大推力'].some((hint) => value.includes(hint))) return 'strong';
  return 'gentle';
};

const mapAppearance = (raw: string): string => {
  const value = (raw || '').toLowerCase();
  if (['disguise', '隐蔽', '伪装', 'discreet', 'privacy', 'wearable', '珠宝'].some((hint) => value.includes(hint)))
    return 'high_disguise';
  return 'normal';
};

const isPlaceholderProductName = (value: string): boolean => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return true;
  return ['未知产品', '未知商品', '未命名产品', '未命名商品', '无标题', 'unknown product'].includes(normalized);
};

const extractCanonicalName = (rawDescription: string, fallbackName: string): string => {
  const source = String(rawDescription || '');
  const match =
    source.match(/(?:^|\n)\s*商品名\s*[:：]\s*([^\n]+)/) ||
    source.match(/(?:^|\n)\s*Name\s*[:：]\s*([^\n]+)/i) ||
    source.match(/(?:^|\n)\s*品名\s*[:：]\s*([^\n]+)/);
  const candidate = (match?.[1] || '').trim();
  return candidate || fallbackName;
};

const isDeviceLikeProduct = (text: string): boolean => {
  const value = (text || '').toLowerCase();
  return [
    '\x76ibrator',
    'massager',
    'wand',
    'rabbit',
    'stimulator',
    'wearable',
    '\x63ock ring',
    '\x73ex machine',
    'g-spot',
    '按摩棒',
    '按摩器',
    '跳蛋',
    '\u9707\u52a8\u68d2',
    '拍打',
    '吮吸',
    '穿戴',
    '震动环',
    '抽插',
  ].some((hint) => value.includes(hint));
};

const isCareConsumableProduct = (text: string): boolean => {
  const value = (text || '').toLowerCase();
  if (isDeviceLikeProduct(value)) return false;
  return ['lube', 'lubricant', 'cleaner', '润滑', '护理', '清洁'].some((hint) => value.includes(hint));
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
    /(?:below|under|less than|up to|≤|<|小于|低于)?\s*(\d{2}(?:\.\d+)?)\s*(?:dB|db|DB|分贝)/gi,
    /(?:quiet|whisper quiet|noise|volume|噪音)[^\d]{0,12}(\d{2}(?:\.\d+)?)/gi,
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

const normalizeFunctionTag = (value: string): string | null => {
  const normalized = String(value || '')
    .replace(/（[^）]*）/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/^[\d.\-、\s]+/, '')
    .replace(/\s+/g, '')
    .trim();

  if (!normalized || normalized.includes('未提及')) return null;
  if (normalized.length < 2 || normalized.length > 16) return null;
  if (/^[\d.]+$/.test(normalized)) return null;
  return normalized;
};

const dedupeTags = (tags: Array<string | null | undefined>, limit = 8): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const normalized = normalizeFunctionTag(tag || '');
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= limit) break;
  }
  return result;
};

const extractKeywordTags = (text: string, productKind: 'device' | 'care'): string[] => {
  const value = String(text || '').toLowerCase();
  const rules: Array<[string, string[]]> = [
    ['APP控制', ['app', '蓝牙', '智能连接', 'remote app']],
    ['远程遥控', ['remote', '远程', '遥控']],
    ['静音', ['quiet', 'whisper', '静音', '低噪']],
    ['防水', ['waterproof', 'water resistant', 'ipx', '防水', '全身水洗']],
    ['可充电', ['rechargeable', 'usb', '充电', '磁吸充电']],
  ];

  if (productKind === 'device') {
    rules.push(
      ['情侣共玩', ['couple', 'partner', '情侣', '夫妻']],
      ['G点刺激', ['g-spot', 'g点']],
      ['\u9634\u8482刺激', ['\x63litoral', '\u9634\u8482', 'c点']],
      ['兔耳双刺激', ['rabbit', '双头']],
      ['吮吸脉冲', ['suction', 'pulsewave', '吮吸']],
      ['拍打按摩', ['pulsewave', '拍打']],
      ['抽插伸缩', ['thrust', 'thruster', '伸缩', '抽插']],
      ['可穿戴', ['wearable', '穿戴']],
      ['震动环', ['\x63ock ring', 'ring', '震动环']],
      ['双马达', ['dual motor', '双马达', 'dual-stimulating']],
      ['加温', ['heating', 'heat', '加温', '预热']],
    );
  } else {
    rules.push(['私密护理', ['护理', 'care']], ['润滑', ['lube', 'lubricant', '润滑']], ['清洁护理', ['cleaner', '清洁']]);
  }

  return rules.filter(([, hints]) => hints.some((hint) => value.includes(hint))).map(([tag]) => tag);
};

const inferDefaultMaterial = (name: string, rawDescription: string): string => {
  const value = `${name || ''}\n${rawDescription || ''}`.toLowerCase();
  if (value.includes('道康宁硅胶') || value.includes('亲肤硅胶') || value.includes('silicone') || value.includes('硅胶'))
    return '亲肤硅胶';
  if (value.includes('abs')) return 'ABS';
  if (value.includes('金属') || value.includes('alloy')) return '金属+硅胶';
  if (isCareConsumableProduct(value)) return '护理配方';
  return '亲肤硅胶';
};

const convertUsdToRmb = (usd: number | null): number | null => {
  if (!usd || !Number.isFinite(usd) || usd <= 0) return null;
  return Math.round(usd * usdToCnyRate);
};

const resolveUsdPrice = (item: any, parsedSpecs?: any): number | null => {
  const direct = Number(item?.priceUsd ?? item?.price);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const parsedUsd = Number(parsedSpecs?.price_usd);
  return Number.isFinite(parsedUsd) && parsedUsd > 0 ? parsedUsd : null;
};

const resolveRmbPrice = (item: any, parsedSpecs?: any): number | null => {
  const directRmb = convertUsdToRmb(resolveUsdPrice(item, parsedSpecs));
  const modelRmb = Number(parsedSpecs?.price_rmb);
  if (Number.isFinite(modelRmb) && modelRmb > 0) return Math.round(modelRmb);
  return directRmb;
};

const buildDefaultSpecs = (item: any, canonicalName: string, productKind: 'device' | 'care') => {
  const source = `${canonicalName}\n${item.rawDescription || ''}`;
  const explicitMaxDb = extractNoiseMaxDb(source);

  return {
    max_db: productKind === 'device' ? explicitMaxDb ?? 40 : null,
    waterproof: /waterproof|water resistant|ipx|防水|全身水洗/i.test(source) ? 7 : null,
    appearance: /discreet|privacy|隐蔽|伪装|珠宝|wearable/i.test(source) ? 'high_disguise' : 'normal',
    physical_form:
      /rabbit|双头|dual|g-spot|vaginal|\x61nal|\u63d2\u5165|抽插|穿戴/i.test(source)
        ? /rabbit|双头|dual/i.test(source)
          ? 'composite'
          : 'internal'
        : 'external',
    motor_type: /powerful|intense|strong|高频|强震|大推力/i.test(source) ? 'strong' : 'gentle',
    function_tags: dedupeTags(extractKeywordTags(source, productKind)),
    gender: productKind === 'care' ? 'unisex' : item.genderHint || 'unisex',
    material: inferDefaultMaterial(canonicalName, item.rawDescription),
    price_rmb: resolveRmbPrice(item),
    price_usd: resolveUsdPrice(item),
  };
};

const mergeSpecsWithDefaults = (defaults: any, parsed: any) => ({
  ...defaults,
  ...(parsed || {}),
  function_tags: dedupeTags([
    ...(Array.isArray(parsed?.function_tags) ? parsed.function_tags : []),
    ...(Array.isArray(defaults?.function_tags) ? defaults.function_tags : []),
  ]),
  material: parsed?.material || defaults.material,
  gender: parsed?.gender || defaults.gender,
  max_db: parsed?.max_db ?? defaults.max_db,
  price_rmb:
    Number.isFinite(Number(parsed?.price_rmb)) && Number(parsed.price_rmb) > 0
      ? Math.round(Number(parsed.price_rmb))
      : defaults.price_rmb,
  price_usd:
    Number.isFinite(Number(parsed?.price_usd)) && Number(parsed.price_usd) > 0
      ? Number(parsed.price_usd)
      : defaults.price_usd,
});

export async function runCleaner() {
  console.log('\n======================================================');
  console.log('--- 启动 ZALO 官方站 AI 清洗与入库模块 ---');
  console.log('======================================================');

  try {
    await prisma.$connect();
    console.log('✅ [DB] 数据库连接正常。');
  } catch (error) {
    console.error('❌ [DB] 数据库连接失败:', error);
    return;
  }

  if (!fs.existsSync(BUFFER_PATH)) {
    console.error('[中断] 未发现 ZALO 官方站 review-buffer。');
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

  await refreshUsdToCnyRate();

  let brandId: string | null = null;
  try {
    const competitor = await withDbRetry('查询 ZALO 竞品', () =>
      prisma.competitors.findFirst({
        where: {
          name: { contains: 'zalo', mode: 'insensitive' },
        },
      }),
    );

    if (competitor) {
      brandId = competitor.id;
      console.log(`[关联] 已定位 ZALO 竞品 ID: ${brandId}`);
    } else {
      const newBrand = await withDbRetry('创建 ZALO 竞品', () =>
        prisma.competitors.create({
          data: {
            name: 'ZALO',
            description: 'ZALO 是源自法国的高端\u60c5\u8da3科技品牌，产品覆盖女性向、男性向与伴侣共玩系列。',
            is_domestic: false,
          },
        }),
      );
      brandId = newBrand.id;
      console.log(`[创建] 已创建 ZALO 竞品记录 (ID: ${brandId})`);
    }
  } catch (error) {
    console.warn('[警告] competitors 关联失败，将继续非关联入库。', error);
  }

  const cleanedData = [];

  for (const item of bufferData) {
    const canonicalName = String(extractCanonicalName(item.rawDescription, item.name) || '').trim();
    if (isPlaceholderProductName(canonicalName)) {
      console.warn(`[跳过] 商品名无效 (${canonicalName || 'empty'})，不执行清洗与入库。`);
      continue;
    }

    const classifierText = `${canonicalName}\n${item.rawDescription || ''}`;
    const productKind = isCareConsumableProduct(classifierText) ? 'care' : 'device';
    const defaultSpecs = buildDefaultSpecs(item, canonicalName, productKind);

    console.log(`\n[AI清洗] 正在降维萃取: ${canonicalName}`);

    const prompt =
      productKind === 'care'
        ? `
你是一个\u60c5\u8da3电商品牌数据清洗助手。以下内容来自 ZALO 官方独立站，信息以中文为主，可能混有英文补充。

【商品名称】
${canonicalName}

【页面价格】
USD ${item.priceUsd ?? item.price ?? ''}

【原始信息】
"""
${item.rawDescription}
"""

请返回一个绝对合法的 JSON 对象，不要返回 markdown，不要补充解释。
要求：
1. \`function_tags\`、\`material\` 必须使用中文。
2. \`gender\` 只能是 \`female\` / \`male\` / \`unisex\`。
3. 这是护理耗材时，\`max_db\`、\`waterproof\` 必须为 null。
4. 人民币换算按 1 USD ≈ 7.2 CNY 估算。

{
  "max_db": null,
  "waterproof": null,
  "appearance": "normal",
  "physical_form": "external",
  "motor_type": "gentle",
  "function_tags": ["私密护理", "润滑", "清洁护理"],
  "gender": "unisex",
  "material": "${defaultSpecs.material}",
  "price_usd": ${defaultSpecs.price_usd ?? 'null'},
  "price_rmb": ${defaultSpecs.price_rmb ?? 'null'}
}
`
        : `
你是一个\u60c5\u8da3电商品牌数据清洗助手。以下内容来自 ZALO 官方独立站，信息以中文为主，可能混有英文补充。请阅读后输出中文结构化结果。

【商品名称】
${canonicalName}

【页面价格】
USD ${item.priceUsd ?? item.price ?? ''}

【原始信息】
"""
${item.rawDescription}
"""

请只返回一个绝对合法的 JSON 对象，不要返回 markdown，不要补充解释。
要求：
1. \`function_tags\`、\`material\` 必须使用中文。
2. \`gender\` 只能是 \`female\` / \`male\` / \`unisex\`。
3. 优先依据中文技术规格、产品副标题和英文站补充来判断产品类型，不要把明显女性向产品误判为男性。
4. 人民币换算按 1 USD ≈ 7.2 CNY 估算。

{
  "max_db": 40,
  "waterproof": 7,
  "appearance": "normal",
  "physical_form": "external",
  "motor_type": "gentle",
  "function_tags": ["防水", "G点刺激", "静音"],
  "gender": "${item.genderHint || 'female'}",
  "material": "${defaultSpecs.material}",
  "price_usd": ${defaultSpecs.price_usd ?? 'null'},
  "price_rmb": ${defaultSpecs.price_rmb ?? 'null'}
}
`;

    let resultText = '{}';
    try {
      if (!openai) throw new Error('无 AI 客户端');
      const response = await openai.chat.completions.create({
        model: 'deepseek-v4-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      });
      resultText = response.choices[0]?.message?.content || '{}';
    } catch {
      try {
        resultText = await callGlmFallback(prompt);
      } catch {
        console.warn(`[AI清洗] ${canonicalName} 模型清洗失败，使用本地默认规格兜底。`);
        resultText = '{}';
      }
    }

    try {
      let parsedSpecs = defaultSpecs;
      try {
        const modelSpecs = JSON.parse(resultText.replace(/```json/g, '').replace(/```/g, '').trim());
        parsedSpecs = mergeSpecsWithDefaults(defaultSpecs, modelSpecs);
      } catch {
        console.warn(`[AI清洗] ${canonicalName} 返回 JSON 不合法，使用本地默认规格兜底。`);
      }

      if (productKind !== 'device') {
        parsedSpecs.max_db = null;
      } else {
        const explicitMaxDb = extractNoiseMaxDb(`${canonicalName}\n${item.rawDescription || ''}`);
        parsedSpecs.max_db = explicitMaxDb ?? normalizeMaxDb(parsedSpecs.max_db) ?? 40;
      }

      if (productKind === 'care') {
        parsedSpecs.gender = 'unisex';
      }

      const explicitGender = inferExplicitGender(`${canonicalName}\n${item.name || ''}\n${item.rawDescription || ''}`);
      const resolvedGender =
        productKind === 'care' ? 'unisex' : mapGender(explicitGender || item.genderHint || parsedSpecs.gender || 'unisex');
      parsedSpecs.gender = resolvedGender;

      const numericPrice = resolveRmbPrice(item, parsedSpecs);
      parsedSpecs.function_tags = dedupeTags(parsedSpecs.function_tags || []);
      parsedSpecs.material = parsedSpecs.material || inferDefaultMaterial(canonicalName, item.rawDescription);

      const processedProduct = {
        name: canonicalName,
        price: numericPrice,
        sourceUrl: item.sourceUrl,
        image: item.coverImage,
        specs: {
          ...parsedSpecs,
          fx_rate_usd_cny: usdToCnyRate,
          fx_rate_source: usdToCnyRateSource,
          fx_rate_date: usdToCnyRateDate || null,
        },
        rawDescription: item.rawDescription,
      };
      cleanedData.push(processedProduct);

      const productPayload = {
        name: canonicalName,
        price: numericPrice,
        image: item.coverImage || null,
        link: item.sourceUrl,
        specs: {
          ...parsedSpecs,
          fx_rate_usd_cny: usdToCnyRate,
          fx_rate_source: usdToCnyRateSource,
          fx_rate_date: usdToCnyRateDate || null,
        } as any,
        gender: mapGender(resolvedGender, 'capitalized'),
        tags: parsedSpecs.function_tags || [],
        competitor_id: brandId,
      };

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

        const itemPayload = {
          original_id: originalId,
          name: canonicalName,
          safe_display_name: buildSafeDisplayName(canonicalName),
          brand: 'ZALO',
          price: numericPrice,
          max_db: productKind === 'device' ? (parsedSpecs.max_db ?? 40) : null,
          waterproof:
            typeof parsedSpecs.waterproof === 'number' && Number.isFinite(parsedSpecs.waterproof)
              ? parsedSpecs.waterproof
              : null,
          appearance: mapAppearance(parsedSpecs.appearance),
          physical_form: mapPhysicalForm(parsedSpecs.physical_form),
          motor_type: mapMotorType(parsedSpecs.motor_type),
          gender: resolvedGender,
          material: parsedSpecs.material || inferDefaultMaterial(canonicalName, item.rawDescription),
          image_url: item.coverImage || null,
          raw_description: item.rawDescription || null,
          updated_at: new Date(),
        };

        await prisma.recommender_toys.deleteMany({ where: { name: canonicalName } });
        await prisma.recommender_toys.create({ data: itemPayload });
      });

      console.log(`[完成] \`${canonicalName}\` 数据已注入数据库。`);
    } catch (error) {
      console.error(`[故障] 数据处理失败: ${canonicalName}`, error);
    }
  }

  const dir = path.dirname(CLEANED_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CLEANED_PATH, JSON.stringify(cleanedData, null, 2));

  await prisma.$disconnect();
  console.log(`\n--- ZALO 官方站数据流水线任务结束 ---`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCleaner().catch((error) => {
    console.error(error);
    prisma.$disconnect();
  });
}
