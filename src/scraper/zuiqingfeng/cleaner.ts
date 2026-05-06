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
const BUFFER_PATH = path.resolve(__dirname, '../../data/zuiqingfeng-review-buffer.json');
const CLEANED_PATH = path.resolve(__dirname, '../../data/zuiqingfeng-cleaned-data.json');

// --- Prisma 7 适配器初始化 ---
// 使用 DIRECT_URL (5432) 绕过连接池，防止在 AI 等待期间因闲置被 PgBouncer 断开
const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

// 设置可变的 OpenAI 客户端
let openai: OpenAI | null = null;
try {
  const primaryKey = process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY;
  if (primaryKey) {
    openai = new OpenAI({
      apiKey: primaryKey,
      baseURL: 'https://api.deepseek.com/v1',
    });
  }
} catch (e) {
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

// --- 数据映射工具函数 ---

const mapGender = (raw: string, format: 'lowercase' | 'capitalized' = 'lowercase'): string => {
  const val = (raw || '').toLowerCase();
  let result = 'unisex';
  if (val.includes('unisex') || val.includes('通用') || val.includes('双方') || val.includes('情侣') || val.includes('双人')) result = 'unisex';
  else if (val.includes('male') || val.includes('男性') || val.includes('男用') || val.includes('男士')) result = 'male';
  else if (val.includes('female') || val.includes('女性') || val.includes('女用') || val.includes('她') || val.includes('妇')) result = 'female';
  return format === 'capitalized' ? result.charAt(0).toUpperCase() + result.slice(1) : result;
};

const inferExplicitGender = (text: string): 'male' | 'female' | 'unisex' | null => {
  const val = (text || '').toLowerCase();
  if (['男女通用', '男女', '通用', '情侣', '双人', '双方', '共用'].some((hint) => val.includes(hint))) {
    return 'unisex';
  }
  // 当标题里同时出现女性显式词和男性形态词时，优先按女性向理解，避免被营销/套餐文案带偏。
  if (['女用', '女性', '女孩子', '\u9634\u8482', 'g点', '跳蛋', '\u9707\u52a8\u68d2', '吮吸'].some((hint) => val.includes(hint))) {
    return 'female';
  }
  if (
    [
      '\u98de\u673a\u676f',
      '男用',
      '男性',
      '男士',
      '龟头',
      '\u9634\u830e',
      '\u524d\u5217\u817a',
      '伸缩杯',
      '绚风杯',
      '元気弹',
      '名器',
      '延时',
    ].some((hint) => val.includes(hint))
  ) {
    return 'male';
  }
  return null;
};

const mapPhysicalForm = (raw: string): string => {
  const val = (raw || '').toLowerCase();
  if (val.includes('composite') || val.includes('复合')) return 'composite';
  if (val.includes('internal') || val.includes('内') || val.includes('入')) return 'internal';
  return 'external';
};

const mapMotorType = (raw: string): string => {
  const val = (raw || '').toLowerCase();
  if (val.includes('strong') || val.includes('强')) return 'strong';
  return 'gentle';
};

const mapAppearance = (raw: string): string => {
  const val = (raw || '').toLowerCase();
  if (val.includes('disguise') || val.includes('隐蔽') || val.includes('伪装')) return 'high_disguise';
  return 'normal';
};

const extractCanonicalName = (rawDescription: string, fallbackName: string): string => {
  const text = rawDescription || '';
  const match = text.match(/(?:^|\n)\s*品名\s*[:：]\s*([^\n]+)/);
  const candidate = (match?.[1] || '').trim();
  return candidate || fallbackName;
};

const isPlaceholderProductName = (value: string): boolean => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return true;
  return [
    '未知产品',
    '未知商品',
    '未命名产品',
    '未命名商品',
    '无标题',
    'unknown product',
  ].includes(normalized);
};

const isDeviceLikeProduct = (text: string): boolean => {
  const normalized = (text || '').toLowerCase();
  return [
    '\u98de\u673a\u676f',
    '训练器',
    '按摩器',
    '跳蛋',
    '\u9707\u52a8\u68d2',
    '震动器',
    '吮吸',
    '\u81ea\u6170\u5668',
    '倒模',
    '\u524d\u5217\u817a',
    '龟头',
    '\u9634\u830e',
    '名器',
    '伸缩杯',
    '绚风杯',
    '遥控跳蛋',
    '穿戴',
    '锁精环',
    '延时训练',
    '器具',
    '玩具',
  ].some((hint) => normalized.includes(hint));
};

const inferDefaultMaterial = (name: string, rawDescription: string): string => {
  const nameText = `${name || ''}`.toLowerCase();
  const text = `${name || ''}\n${rawDescription || ''}`.toLowerCase();
  if (isDeviceLikeProduct(nameText)) {
    if (text.includes('tpe')) return 'TPE';
    if (text.includes('abs')) return 'ABS';
    if (text.includes('硅胶')) return '硅胶';
    return '亲肤硅胶';
  }
  if (nameText.includes('润滑液') || nameText.includes('润滑剂') || nameText.includes('水基') || nameText.includes('玻尿酸')) {
    return '水基配方';
  }
  if (nameText.includes('避孕套') || nameText.includes('安全套') || nameText.includes('套套') || nameText.includes('乳胶')) {
    return '天然橡胶乳胶';
  }
  if (isBedPadProduct(text)) {
    return 'TPU防水层/聚酯纤维';
  }
  const lingerieHints = [
    '内衣',
    '内裤',
    '网纱',
    '蕾丝',
    '透视',
    '\u60c5\u8da3套装',
    '套装',
    '礼盒',
    '文胸',
    '胸衣',
    '睡裙',
    '睡衣',
    '制服',
    '连体衣',
    '丝袜',
  ];
  return lingerieHints.some((hint) => text.includes(hint)) ? '锦纶蕾丝' : '亲肤硅胶';
};

const isApparelLikeProduct = (text: string): boolean => {
  const normalized = (text || '').toLowerCase();
  return [
    '内衣',
    '内裤',
    '网纱',
    '蕾丝',
    '透视',
    '\u60c5\u8da3套装',
    '套装',
    '礼盒',
    '文胸',
    '胸衣',
    '睡裙',
    '睡衣',
    '制服',
    '连体衣',
    '丝袜',
  ].some((hint) => normalized.includes(hint));
};

const isCareConsumableProduct = (text: string): boolean => {
  const normalized = (text || '').toLowerCase();
  if (isDeviceLikeProduct(normalized)) return false;
  return [
    '避孕套',
    '安全套',
    '套套',
    '润滑液',
    '润滑剂',
    '人体润滑',
    '水基',
    '玻尿酸',
    '护理液',
    '清洁液',
    '清洗液',
    '私处护理',
    '乳胶',
    '超薄',
  ].some((hint) => normalized.includes(hint));
};

const isBedPadProduct = (text: string): boolean => {
  const normalized = (text || '').toLowerCase();
  return [
    '床事垫',
    '房事垫',
    '床品垫',
    '防水垫',
    '隔水垫',
    '护理垫',
    '防渗垫',
    '亲密垫',
    '一次性垫单',
    '一次性床单',
    '床垫',
  ].some((hint) => normalized.includes(hint));
};

const resolveNumericPrice = (item: any, parsedSpecs?: any): number | null => {
  if (typeof item?.price === 'number' && Number.isFinite(item.price) && item.price > 0) {
    return item.price;
  }
  const aiPrice = Number(parsedSpecs?.price_rmb);
  return Number.isFinite(aiPrice) && aiPrice > 0 ? aiPrice : null;
};

const normalizeMaxDb = (raw: unknown): number | null => {
  const numeric = Number(String(raw ?? '').match(/\d+(?:\.\d+)?/)?.[0]);
  if (!Number.isFinite(numeric)) return null;
  if (numeric < 15 || numeric > 90) return null;
  return Math.round(numeric);
};

const extractNoiseMaxDb = (text: string): number | null => {
  const normalized = String(text || '')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/≤|≦|﹤|＜/g, '<')
    .replace(/≥|≧|﹥|＞/g, '>')
    .replace(/\s+/g, ' ');

  const patterns = [
    /(?:低至|低于|小于|不高于|不超过|约|≤|<)?\s*(\d{2}(?:\.\d+)?)\s*(?:dB|db|DB|分贝)/gi,
    /(?:噪音|音量|声量|静音|低噪|低音|运行音|工作音)[^\d]{0,12}(\d{2}(?:\.\d+)?)/gi,
    /(\d{2}(?:\.\d+)?)[^\d]{0,8}(?:静音|低噪|低音)/gi,
  ];

  const candidates: number[] = [];
  for (const pattern of patterns) {
    for (const match of normalized.matchAll(pattern)) {
      const value = normalizeMaxDb(match[1]);
      if (value !== null) candidates.push(value);
    }
  }

  if (candidates.length === 0) return null;
  return Math.min(...candidates);
};

const FEATURE_LABELS = [
  '技术卖点',
  '核心卖点',
  '使用特性',
  '动力规格',
  '产品类型',
  '款式结构',
  '套装构成',
  '规格信息',
  '环境属性',
];

const normalizeFunctionTag = (value: string): string | null => {
  const normalized = String(value || '')
    .replace(/（[^）]*）/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/^[\d.\-、\s]+/, '')
    .replace(/^(如|例如|包含|支持|具有|主打)/, '')
    .replace(/app/gi, 'APP')
    .replace(/hpv/gi, 'HPV')
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

const extractFeatureTagsFromLines = (text: string): string[] => {
  const source = String(text || '');
  const tags: string[] = [];
  for (const label of FEATURE_LABELS) {
    const pattern = new RegExp(`(?:^|\\n)\\s*(?:\\d+\\.\\s*)?${label}\\s*[:：]\\s*([^\\n]+)`, 'gi');
    for (const match of source.matchAll(pattern)) {
      const value = match[1] || '';
      value
        .split(/[、，,；;\/|]/)
        .map((segment) => segment.trim())
        .forEach((segment) => {
          const normalized = normalizeFunctionTag(segment);
          if (normalized) tags.push(normalized);
        });
    }
  }
  return tags;
};

const extractKeywordTags = (text: string, productKind: 'device' | 'apparel' | 'care' | 'pad'): string[] => {
  const source = String(text || '').toLowerCase();
  const rules: Array<[string, string[]]> = [
    ['远程遥控', ['远程', '异地']],
    ['APP控制', ['app', '智能互联']],
    ['静音', ['静音', '低噪', '低音']],
    ['防水', ['防水', 'ipx']],
  ];

  if (productKind === 'device') {
    rules.push(
      ['跳蛋', ['跳蛋']],
      ['震动', ['震动', '震感']],
      ['吮吸', ['吮吸', '声波吸']],
      ['拍打', ['拍打']],
      ['穿戴', ['穿戴']],
      ['G点刺激', ['g点', '点潮']],
      ['\u9634\u8482刺激', ['\u9634\u8482']],
      ['前戏撩拨', ['前戏', '撩拨']],
      ['抑菌HPV', ['hpv', '抑菌']],
      ['加温', ['加温']],
      ['\u98de\u673a\u676f', ['\u98de\u673a\u676f', '绚风杯', '伸缩杯', '元気弹']],
      ['活塞伸缩', ['活塞', '伸缩']],
      ['\u524d\u5217\u817a按摩', ['\u524d\u5217\u817a']],
      ['龟头按摩', ['龟头']],
      ['电击刺激', ['电击']],
    );
  } else if (productKind === 'apparel') {
    rules.push(
      ['蕾丝', ['蕾丝']],
      ['网纱', ['网纱']],
      ['透视', ['透视']],
      ['连体', ['连体']],
      ['吊带', ['吊带']],
      ['镂空', ['镂空']],
      ['绑带', ['绑带']],
      ['多件套', ['多件套', '套装']],
      ['制服风', ['制服']],
    );
  } else if (productKind === 'care') {
    rules.push(
      ['润滑', ['润滑']],
      ['水基配方', ['水基']],
      ['玻尿酸', ['玻尿酸']],
      ['超薄', ['超薄']],
      ['抑菌', ['抑菌']],
      ['独立包装', ['独立包装']],
      ['便携', ['便携']],
      ['乳胶', ['乳胶']],
    );
  } else if (productKind === 'pad') {
    rules.push(
      ['防渗', ['防渗']],
      ['可水洗', ['可水洗']],
      ['吸水', ['吸水']],
      ['速干', ['速干']],
      ['可折叠', ['可折叠']],
      ['便携', ['便携']],
      ['防滑', ['防滑']],
    );
  }

  return rules
    .filter(([, hints]) => hints.some((hint) => source.includes(hint)))
    .map(([tag]) => tag);
};

const extractFunctionTagsFromRawDescription = (
  text: string,
  productKind: 'device' | 'apparel' | 'care' | 'pad',
): string[] =>
  dedupeTags([
    ...extractFeatureTagsFromLines(text),
    ...extractKeywordTags(text, productKind),
  ]);

const buildDefaultSpecs = (item: any, canonicalName: string, productKind: 'device' | 'apparel' | 'care' | 'pad') => {
  const text = `${canonicalName}\n${item.rawDescription || ''}`;
  const explicitMaxDb = extractNoiseMaxDb(text);
  const functionTags =
    productKind === 'apparel'
      ? ['服饰', '套装', '蕾丝', '网纱'].filter((tag) => text.includes(tag))
      : productKind === 'care'
        ? ['护理耗材', '安全套', '润滑液', '水基', '乳胶', '超薄'].filter((tag) => text.includes(tag) || tag === '护理耗材')
        : productKind === 'pad'
          ? ['床品垫', '防水', '防渗', '可水洗', '便携'].filter((tag) => text.includes(tag) || tag === '床品垫')
          : [];
  const localFeatureTags = extractFunctionTagsFromRawDescription(text, productKind);

  return {
    max_db: productKind === 'device' ? (explicitMaxDb ?? 50) : null,
    waterproof: null,
    appearance: 'normal',
    physical_form: 'external',
    motor_type: 'gentle',
    function_tags: dedupeTags([...localFeatureTags, ...functionTags]),
    gender: productKind === 'care' ? 'unisex' : (item.genderHint || 'female'),
    material: inferDefaultMaterial(canonicalName, item.rawDescription),
    price_rmb: typeof item?.price === 'number' && Number.isFinite(item.price) ? item.price : null,
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
  price_rmb: Number.isFinite(Number(parsed?.price_rmb)) && Number(parsed.price_rmb) > 0 ? Number(parsed.price_rmb) : defaults.price_rmb,
});

export async function runCleaner() {
  console.log('\n======================================================');
  console.log('--- 启动 醉清风-谜姬 (Zuiqingfeng) AI 清洗与入库模块 ---');
  console.log('======================================================');

  // --- 数据库健康检查 ---
  try {
    await prisma.$connect();
    console.log('✅ [DB] 数据库直连通道 (5432) 已建立，状态稳固。');
  } catch (dbErr) {
    console.error('❌ [DB] 数据库连接失败:', dbErr);
    return;
  }
  
  if (!fs.existsSync(BUFFER_PATH)) {
    console.error('[中断] 未发现数据缓冲池。');
    return;
  }

  const rawDataStr = fs.readFileSync(BUFFER_PATH, 'utf-8');
  const bufferData = JSON.parse(rawDataStr);
  console.log(`[清洗] review-buffer 已载入 ${Array.isArray(bufferData) ? bufferData.length : 0} 条记录`);
  if (!Array.isArray(bufferData) || bufferData.length === 0) {
    console.error('[中断] review-buffer 为空，本次不执行入库。');
    await prisma.$disconnect();
    return;
  }

  // --- 预搜索 醉清风-谜姬 在 competitors 表中的 ID ---
  let brandId: string | null = null;
  try {
    const competitor = await prisma.competitors.findFirst({
      where: { name: { contains: '醉清风-谜姬', mode: 'insensitive' } }
    });
    if (competitor) {
      brandId = competitor.id;
      console.log(`[关联] 已定位 醉清风-谜姬 竞品 ID: ${brandId}`);
    } else {
        // 如果不存在，尝试创建一个基础记录
        console.log('[创建] 数据库中未发现「醉清风-谜姬」，正在初始化记录...');
        const newBrand = await prisma.competitors.create({
            data: {
                name: '醉清风-谜姬',
                description: '醉清风-谜姬是一个综合\u60c5\u8da3用品店铺品牌抓取源，覆盖男用器具、女用玩具、服饰和护理耗材等品类。',
                is_domestic: true
            }
        });
        brandId = newBrand.id;
        console.log(`[创建] 已创建 醉清风-谜姬 竞品记录 (ID: ${brandId})`);
    }
  } catch (err) {
    console.warn('[警告] Competitors 关联失败，将继续非关联抓取。');
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
    
    const prompt = productKind === 'care'
      ? `
你是一个个人护理耗材商品目录数据清洗助手。现有抓取至「醉清风-谜姬 (Zuiqingfeng)」天猫店的安全套/润滑液/护理用品类商品描述：

【商品名称】: ${canonicalName}
【原始价格抓取】: ${item.price ?? ''}
【详情页文案】:
"""
${item.rawDescription}
"""

请提取护理耗材商品特征。结果必须是一个绝对合法的 JSON 对象。严禁返回任何 markdown 标记。
字段要求：
{
  "max_db": null,
  "waterproof": null,
  "appearance": "normal",
  "physical_form": "external",
  "motor_type": "gentle",
  "function_tags": ["护理耗材", "安全套", "润滑液"],
  "gender": "${item.genderHint || 'unisex'}",
  "material": "${defaultSpecs.material}",
  "price_rmb": ${defaultSpecs.price_rmb ?? 'null'}
}
`
      : productKind === 'pad'
      ? `
你是一个家居床品防护垫商品目录数据清洗助手。现有抓取至「醉清风-谜姬 (Zuiqingfeng)」天猫店的床事垫/防水垫/护理垫类商品描述：

【商品名称】: ${canonicalName}
【原始价格抓取】: ${item.price ?? ''}
【详情页文案】:
"""
${item.rawDescription}
"""

请提取床品防护垫商品特征。结果必须是一个绝对合法的 JSON 对象。严禁返回任何 markdown 标记。
字段要求：
{
  "max_db": null,
  "waterproof": null,
  "appearance": "normal",
  "physical_form": "external",
  "motor_type": "gentle",
  "function_tags": ["床品垫", "防水", "防渗", "可水洗"],
  "gender": "${item.genderHint || 'unisex'}",
  "material": "${defaultSpecs.material}",
  "price_rmb": ${defaultSpecs.price_rmb ?? 'null'}
}
`
      : productKind === 'apparel'
      ? `
你是一个服装商品目录数据清洗助手。现有抓取至「醉清风-谜姬 (Zuiqingfeng)」天猫店的服饰类商品描述：

【商品名称】: ${canonicalName}
【原始价格抓取】: ${item.price ?? ''}
【详情页文案】:
"""
${item.rawDescription}
"""

请提取服装商品特征。结果必须是一个绝对合法的 JSON 对象。严禁返回任何 markdown 标记。
字段要求：
{
  "max_db": null,
  "waterproof": null,
  "appearance": "normal",
  "physical_form": "external",
  "motor_type": "gentle",
  "function_tags": ["服饰", "套装", "蕾丝"],
  "gender": "${item.genderHint || 'female'}",
  "material": "${defaultSpecs.material}",
  "price_rmb": ${defaultSpecs.price_rmb ?? 'null'}
}
`
      : `
你是一个专注处理个人护理器具参数的数据拆解机器人。现有抓取至「醉清风-谜姬 (Zuiqingfeng)」天猫店的纯文本描述：

【商品名称】: ${canonicalName}
【原始价格抓取】: ${item.price ?? ''}
【详情页文案】:
"""
${item.rawDescription}
"""

请提取相关特征。结果必须是一个绝对合法的 JSON 对象。严禁返回任何 markdown 标记。
注意：醉清风-谜姬店铺是混合类目，不要默认判成女性向，也不要把服饰或护理耗材误判成器具。
字段要求：
{
  "max_db": 50,
  "waterproof": 7,
  "appearance": "normal",
  "physical_form": "external",
  "motor_type": "gentle",
  "function_tags": ["静音", "便携"],
  "gender": "${item.genderHint || 'male'}",
  "material": "${defaultSpecs.material}",
  "price_rmb": ${defaultSpecs.price_rmb ?? 'null'}
}
`;

    let resultText = '{}';
    try {
      if (!openai) throw new Error("无 AI 客户端");
      const response = await openai.chat.completions.create({
        model: 'deepseek-v4-flash', 
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1, 
      });
      resultText = response.choices[0].message.content || '{}';
    } catch (e) {
      try {
        resultText = await callGlmFallback(prompt);
      } catch (fallbackErr) {
        console.warn(`[AI清洗] ${canonicalName} 模型清洗失败，使用本地默认规格兜底。`);
        resultText = '{}';
      }
    }

    try {
      let parsedSpecs = defaultSpecs;
      try {
        const modelSpecs = JSON.parse(resultText.replace(/```json/g, '').replace(/```/g, '').trim());
        parsedSpecs = mergeSpecsWithDefaults(defaultSpecs, modelSpecs);
      } catch (parseErr) {
        console.warn(`[AI清洗] ${canonicalName} 返回 JSON 不合法，使用本地默认规格兜底。`);
      }
      if (productKind !== 'device') {
        parsedSpecs.max_db = null;
      } else {
        const explicitMaxDb = extractNoiseMaxDb(`${canonicalName}\n${item.rawDescription || ''}`);
        parsedSpecs.max_db = explicitMaxDb ?? normalizeMaxDb(parsedSpecs.max_db) ?? 50;
      }
      if (productKind === 'care') {
        parsedSpecs.gender = 'unisex';
      }
      const numericPrice = resolveNumericPrice(item, parsedSpecs);
      const explicitGender = inferExplicitGender(`${canonicalName}\n${item.name || ''}\n${item.rawDescription || ''}`);
      const resolvedGender = productKind === 'care'
        ? 'unisex'
        : mapGender(explicitGender || item.genderHint || parsedSpecs.gender || 'male');
      parsedSpecs.gender = resolvedGender;
      
      const processedProduct = {
        name: canonicalName,
        price: numericPrice,
        sourceUrl: item.sourceUrl,
        image: item.coverImage,
        specs: parsedSpecs,
        rawDescription: item.rawDescription
      };
      cleanedData.push(processedProduct);

      // --- 数据库同步 ---
      
      // 1. Products 表
      const productPayload = {
        name:          canonicalName,
        price:         numericPrice,
        image:         item.coverImage || null,
        link:          item.sourceUrl,
        specs:         parsedSpecs as any,
        gender:        mapGender(resolvedGender, 'capitalized'),
        tags:          parsedSpecs.function_tags || [],
        competitor_id: brandId
      };

      // 2. Recommender_toys 表
      await withDbRetry(`同步商品 ${canonicalName}`, async () => {
        const existingProduct = await prisma.products.findFirst({ where: { name: canonicalName } });
        let originalId: string;
        if (existingProduct) {
          const u = await prisma.products.update({ where: { id: existingProduct.id }, data: productPayload });
          originalId = u.id;
        } else {
          const c = await prisma.products.create({ data: productPayload });
          originalId = c.id;
        }

        const itemPayload = {
           original_id:   originalId,
           name:          canonicalName,
           safe_display_name: buildSafeDisplayName(canonicalName),
           brand:         '醉清风-谜姬',
           price:         numericPrice,
           max_db:        productKind === 'device' ? (parsedSpecs.max_db ?? 50) : null,
           waterproof:    parsedSpecs.waterproof || null,
           appearance:    mapAppearance(parsedSpecs.appearance),
           physical_form: mapPhysicalForm(parsedSpecs.physical_form),
           motor_type:    mapMotorType(parsedSpecs.motor_type),
           gender:        resolvedGender,
           material:      parsedSpecs.material || inferDefaultMaterial(canonicalName, item.rawDescription),
           image_url:     item.coverImage || null,
           raw_description: item.rawDescription || null,
           updated_at:    new Date(),
        };

        await prisma.recommender_toys.deleteMany({ where: { name: canonicalName } });
        await prisma.recommender_toys.create({ data: itemPayload });
      });

      console.log(`[完成] \`${canonicalName}\` 数据已注入数据库。`);

    } catch (e) {
       console.error(`[故障] 数据处理失败: ${canonicalName}`, e);
    }
  }

  const dir = path.dirname(CLEANED_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CLEANED_PATH, JSON.stringify(cleanedData, null, 2));
  
  await prisma.$disconnect();
  console.log(`\n--- 醉清风-谜姬 数据流水线任务结束 ---`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCleaner().catch(err => { console.error(err); prisma.$disconnect(); });
}
