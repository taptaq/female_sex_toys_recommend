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
const BUFFER_PATH = path.resolve(__dirname, '../../data/wevibe-official-review-buffer.json');
const CLEANED_PATH = path.resolve(__dirname, '../../data/wevibe-official-cleaned-data.json');

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
  if (['unisex', '通用', '双方', '情侣', 'couple', 'partner'].some((hint) => value.includes(hint))) result = 'unisex';
  else if (
    ['male', '男性', '男用', 'for him', '\x70enis', '\x63ock ring', 'prostate', '\x6dasturbator'].some((hint) =>
      value.includes(hint),
    )
  )
    result = 'male';
  else if (
    ['female', '女性', '女用', 'for her', '\x63litoral', 'g-spot', 'rabbit', 'panty', 'vaginal'].some((hint) =>
      value.includes(hint),
    )
  )
    result = 'female';

  return format === 'capitalized' ? result.charAt(0).toUpperCase() + result.slice(1) : result;
};

const inferExplicitGender = (text: string): 'male' | 'female' | 'unisex' | null => {
  const value = (text || '').toLowerCase();
  if (
    [
      '男女通用',
      '通用',
      '情侣',
      '双人',
      'couples',
      'partner',
      'unisex',
      'for couples',
      'worn during sex',
      'long-distance',
    ].some((hint) => value.includes(hint))
  ) {
    return 'unisex';
  }
  if (
    ['女用', '女性', '\x63litoral', 'g-spot', 'rabbit', 'panty', 'bullet \x76ibrator', 'for her', 'vaginal'].some((hint) =>
      value.includes(hint),
    )
  ) {
    return 'female';
  }
  if (
    ['男用', '男性', 'for him', '\x70enis', '\x63ock ring', 'prostate', '\x6dasturbator', 'verge', 'pivot', 'vector'].some(
      (hint) => value.includes(hint),
    )
  ) {
    return 'male';
  }
  return null;
};

const mapPhysicalForm = (raw: string): string => {
  const value = (raw || '').toLowerCase();
  if (value.includes('composite') || value.includes('复合')) return 'composite';
  if (
    ['internal', 'insertable', 'insert', 'vaginal', '\x61nal', 'g-spot', '\u524d\u5217\u817a', '\u809b\u585e', '\u63d2\u5165'].some((hint) =>
      value.includes(hint),
    )
  )
    return 'internal';
  return 'external';
};

const mapMotorType = (raw: string): string => {
  const value = (raw || '').toLowerCase();
  if (['strong', 'powerful', 'intense', '强'].some((hint) => value.includes(hint))) return 'strong';
  return 'gentle';
};

const mapAppearance = (raw: string): string => {
  const value = (raw || '').toLowerCase();
  if (['disguise', '隐蔽', '伪装', 'discreet'].some((hint) => value.includes(hint))) return 'high_disguise';
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
    'wand',
    'rabbit',
    'bullet',
    'stimulator',
    'air suction',
    '\x63litoral',
    'g-spot',
    'panty',
    'wearable',
    '\x63ock ring',
    '\x70enis ring',
    '\x61nal plug',
    'butt plug',
    'prostate',
    '\x6dasturbator',
    '\x73ex \x74oy',
    '\u524d\u5217\u817a',
    '跳蛋',
    '按摩器',
  ].some((hint) => value.includes(hint));
};

const isApparelLikeProduct = (text: string): boolean => {
  const value = (text || '').toLowerCase();
  return ['lingerie', 'bodysuit', 'panty', 'lace', 'dress', 'sleepwear', '内衣', '蕾丝'].some((hint) =>
    value.includes(hint),
  );
};

const isCareConsumableProduct = (text: string): boolean => {
  const value = (text || '').toLowerCase();
  if (isDeviceLikeProduct(value)) return false;
  return ['lube', 'lubricant', 'cleaner', 'condom', '润滑', '护理液', '安全套'].some((hint) => value.includes(hint));
};

const isBedPadProduct = (text: string): boolean => {
  const value = (text || '').toLowerCase();
  return ['bed pad', 'mattress protector', '护理垫', '防水垫'].some((hint) => value.includes(hint));
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

const extractKeywordTags = (
  text: string,
  productKind: 'device' | 'apparel' | 'care' | 'pad',
): string[] => {
  const value = String(text || '').toLowerCase();
  const rules: Array<[string, string[]]> = [
    ['APP控制', ['app-enabled', 'app support', 'app支持', 'app control']],
    ['远程遥控', ['remote-controlled', 'squeeze remote', 'remote control']],
    ['长距离互动', ['long-distance']],
    ['静音', ['quiet', 'whisper quiet', 'discreet']],
    ['防水', ['waterproof', 'ipx']],
    ['可充电', ['rechargeable', 'usb rechargeable']],
  ];

  if (productKind === 'device') {
    rules.push(
      ['情侣共玩', ['couples', 'partner', 'for couples']],
      ['\u9634\u8482刺激', ['\x63litoral']],
      ['G点刺激', ['g-spot']],
      ['兔耳双刺激', ['rabbit']],
      ['空气脉冲', ['air suction', 'air pulse']],
      ['可穿戴', ['wearable', 'worn during sex']],
      ['震动环', ['\x63ock ring', '\x70enis ring']],
      ['\u809b\u585e按摩', ['\x61nal plug', 'butt plug']],
      ['\u524d\u5217\u817a按摩', ['prostate']],
      ['前戏撩拨', ['foreplay']],
      ['加温', ['warming', 'heat']],
      ['套装礼盒', ['bundle', 'collection', 'set']],
    );
  } else if (productKind === 'care') {
    rules.push(['润滑', ['lube', 'lubricant']], ['清洁护理', ['cleaner', 'cleaning']], ['乳胶', ['latex']]);
  } else if (productKind === 'apparel') {
    rules.push(['蕾丝', ['lace']], ['连体', ['bodysuit']], ['透视', ['sheer']]);
  } else if (productKind === 'pad') {
    rules.push(['防渗', ['waterproof']], ['可水洗', ['washable']]);
  }

  return rules.filter(([, hints]) => hints.some((hint) => value.includes(hint))).map(([tag]) => tag);
};

const extractFunctionTagsFromRawDescription = (
  text: string,
  productKind: 'device' | 'apparel' | 'care' | 'pad',
): string[] => dedupeTags(extractKeywordTags(text, productKind));

const inferDefaultMaterial = (name: string, rawDescription: string): string => {
  const value = `${name || ''}\n${rawDescription || ''}`.toLowerCase();
  if (value.includes('silicone') || value.includes('硅胶')) return '亲肤硅胶';
  if (value.includes('abs')) return 'ABS';
  if (value.includes('latex')) return '天然乳胶';
  if (value.includes('water-based')) return '水基配方';
  if (isCareConsumableProduct(value)) return '水基配方';
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

const buildDefaultSpecs = (item: any, canonicalName: string, productKind: 'device' | 'apparel' | 'care' | 'pad') => {
  const source = `${canonicalName}\n${item.rawDescription || ''}`;
  const explicitMaxDb = extractNoiseMaxDb(source);

  return {
    max_db: productKind === 'device' ? explicitMaxDb ?? 40 : null,
    waterproof: /waterproof|ipx7|ipx8/i.test(source) ? 7 : null,
    appearance: /discreet/i.test(source) ? 'high_disguise' : 'normal',
    physical_form:
      /rabbit|g-spot|vaginal|\x61nal plug|butt plug|prostate|insert/i.test(source) ? 'internal' : 'external',
    motor_type: /powerful|intense|strong/i.test(source) ? 'strong' : 'gentle',
    function_tags: extractFunctionTagsFromRawDescription(source, productKind),
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
  console.log('--- 启动 We-Vibe 官方站 AI 清洗与入库模块 ---');
  console.log('======================================================');

  try {
    await prisma.$connect();
    console.log('✅ [DB] 数据库连接正常。');
  } catch (error) {
    console.error('❌ [DB] 数据库连接失败:', error);
    return;
  }

  if (!fs.existsSync(BUFFER_PATH)) {
    console.error('[中断] 未发现官方站 review-buffer。');
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
    const competitor = await withDbRetry('查询 We-Vibe 竞品', () =>
      prisma.competitors.findFirst({
        where: {
          OR: [
            { name: { contains: 'we-vibe', mode: 'insensitive' } },
            { name: { contains: 'wevibe', mode: 'insensitive' } },
          ],
        },
      }),
    );

    if (competitor) {
      brandId = competitor.id;
      console.log(`[关联] 已定位 We-Vibe 竞品 ID: ${brandId}`);
    } else {
      const newBrand = await withDbRetry('创建 We-Vibe 竞品', () =>
        prisma.competitors.create({
          data: {
            name: 'We-Vibe',
            description: 'We-Vibe 是加拿大高端\u60c5\u8da3科技品牌，产品覆盖女性向、男性向与伴侣共玩系列。',
            is_domestic: false,
          },
        }),
      );
      brandId = newBrand.id;
      console.log(`[创建] 已创建 We-Vibe 竞品记录 (ID: ${brandId})`);
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
    const productKind = isDeviceLikeProduct(canonicalName)
      ? 'device'
      : isCareConsumableProduct(canonicalName)
      ? 'care'
      : isCareConsumableProduct(classifierText)
      ? 'care'
      : isBedPadProduct(classifierText)
      ? 'pad'
      : isApparelLikeProduct(classifierText)
      ? 'apparel'
      : 'device';
    const defaultSpecs = buildDefaultSpecs(item, canonicalName, productKind);

    console.log(`\n[AI清洗] 正在降维萃取: ${canonicalName}`);

    const prompt =
      productKind === 'care'
        ? `
你是一个个人护理电商品牌数据清洗助手。以下内容来自 We-Vibe 官方独立站，原文是英文。请阅读英文信息后，输出中文结论。

【商品名称】
${canonicalName}

【页面价格】
USD ${item.priceUsd ?? item.price ?? ''}

【英文详情】
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
  "function_tags": ["护理耗材", "润滑", "清洁护理"],
  "gender": "${item.genderHint || 'unisex'}",
  "material": "${defaultSpecs.material}",
  "price_usd": ${defaultSpecs.price_usd ?? 'null'},
  "price_rmb": ${defaultSpecs.price_rmb ?? 'null'}
}
`
        : `
你是一个个人护理电商品牌数据清洗助手。以下内容来自 We-Vibe 官方独立站，原文是英文。请阅读英文信息后，输出中文结构化结果。

【商品名称】
${canonicalName}

【页面价格】
USD ${item.priceUsd ?? item.price ?? ''}

【英文详情】
"""
${item.rawDescription}
"""

请只返回一个绝对合法的 JSON 对象，不要返回 markdown，不要补充解释。
要求：
1. \`function_tags\`、\`material\` 必须使用中文。
2. \`gender\` 只能是 \`female\` / \`male\` / \`unisex\`。
3. We-Vibe 官方站是混合商品池，可能是女性向、男性向、情侣共玩或礼盒套装，请优先依据标题和页面分类提示判断。
4. 人民币换算按 1 USD ≈ 7.2 CNY 估算。
5. 若是礼盒/套装，也仍按\u60c5\u8da3玩具商品理解，不要误判成非商品页面。

{
  "max_db": 40,
  "waterproof": 7,
  "appearance": "normal",
  "physical_form": "external",
  "motor_type": "gentle",
  "function_tags": ["APP控制", "远程遥控", "静音"],
  "gender": "${item.genderHint || 'unisex'}",
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
          brand: 'We-Vibe',
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
  console.log(`\n--- We-Vibe 官方站数据流水线任务结束 ---`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCleaner().catch((error) => {
    console.error(error);
    prisma.$disconnect();
  });
}
