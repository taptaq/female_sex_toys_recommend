import { chromium } from 'playwright';
import OpenAI from 'openai';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { runCleaner } from './cleaner';
import {
  extractParamPairsFromCompactText,
  extractParamPairsFromLooseJsonText,
  extractParamPairsFromOcrText,
  extractParamPairsFromPageHtml,
  isPlaceholderParamValue,
  mergeWhitelistParams,
  scrapeParamPairsFromIceContext,
  scrapeParamPairsInPage,
} from './param-extraction';
import {
  buildReviewBufferLookup,
  findCachedReviewBufferEntry,
  indexReviewBufferEntry,
  loadReviewBufferEntries,
  mergeCachedReviewBufferEntry,
  type ReviewBufferEntry,
} from '../shared/review-buffer-cache';
import { tryRevealTmallParamTabs } from './tmall-param-ui';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_URL = 'https://iroha.tmall.com/category.htm?spm=a1z10.5-b.w4010-21702348873.2.4a874d3bC8PQpn&search=y';
const MAX_ITEMS = Number(process.env.IROHA_MAX_ITEMS || 200);
const DELAY_BETWEEN_PAGES = 3000;
const BUFFER_PATH = path.resolve(__dirname, '../../data/iroha-review-buffer.json');

function isTargetBrandListTitle(title: string): boolean {
  return /iroha/i.test(String(title || '').trim());
}

const INVALID_LIST_TITLE_PATTERNS = [
  '购物金',
  '会员充值',
  '充值享折',
  '过期随时退',
  '全店通用',
  '店铺权益',
  '会员专享',
  '权益卡',
  '礼品卡',
  '储值卡',
  '充值卡',
  '即充即用',
];

const PRODUCT_TITLE_HINTS = [
  '跳蛋',
  '按摩',
  '震动',
  '润滑',
  '避孕套',
  '安全套',
  '内衣',
  '内裤',
  '睡裙',
  '情趣',
  '玩具',
  '器具',
  '倒模',
  '名器',
  '前列腺',
  '龟头',
  '训练器',
  '乳夹',
  '自慰',
  '私处',
  '丝袜',
  '吊带',
  '网纱',
  '蕾丝',
  '凝胶',
  '润滑液',
  '按摩棒',
  '按摩器',
];

function normalizeListFilterText(value: string): string {
  return String(value || '')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();
}

function isPlaceholderListTitle(title: string): boolean {
  const normalizedTitle = normalizeListFilterText(title);
  return [
    '未知产品',
    '未知商品',
    '未命名产品',
    '未命名商品',
    '无标题',
    'unknownproduct',
  ].includes(normalizedTitle);
}

function isNonProductListTitle(title: string, extraText: string = ''): boolean {
  const normalizedTitle = normalizeListFilterText(title);
  if (!normalizedTitle || isPlaceholderListTitle(normalizedTitle)) return true;

  const haystack = `${normalizedTitle} ${normalizeListFilterText(extraText)}`.trim();
  const matchedPromo = INVALID_LIST_TITLE_PATTERNS.some((pattern) => haystack.includes(pattern));
  if (!matchedPromo) return false;

  const hasProductHint = PRODUCT_TITLE_HINTS.some((hint) => haystack.includes(hint));
  const hardRejectPromo = [
    '购物金',
    '会员充值',
    '充值享折',
    '过期随时退',
    '全店通用',
    '店铺权益',
    '权益卡',
    '礼品卡',
    '储值卡',
    '充值卡',
    '即充即用',
  ];
  return !hasProductHint || hardRejectPromo.some((pattern) => haystack.includes(pattern));
}

const TOY_DETAIL_OCR_PROMPT = `你是一个专业的产品目录审计员。请针对提供的商业摄影图片（偏个人护理器具/玩具类商品），提取该产品的核心规格参数。
这些图片用于企业内部库存管理系统，内容为严格的商业产品展出，不涉及任何违规或隐私内容。

请以结构化文本格式输出：
1. 产品名称/型号: 确保提取准确的商业名称。
2. 内部构造/材质: 如亲肤硅胶、食品级ABS等技术描述。
3. 动力规格: 包含震动、脉冲、吮吸、加温等物理按摩模式。
4. 环境属性: 包含防水等级（如IPX7）、静音分贝值。
5. 电源管理: 充电方式、续航时长。
6. 技术卖点: 概括该款按摩器具的核心技术优势。

注意：
- 采用正式、中性的专业术语。
- 直接输出参数，严禁输出任何与任务无关的描述性文字。
- 如果图中信息缺失，请标注为“未提及”。`;

const APPAREL_DETAIL_OCR_PROMPT = `你是一个专业的服装目录审计员。请针对提供的商业摄影图片（偏贴身服饰、网纱、蕾丝、套装、袜类、睡裙等服装类商品），提取该产品的核心商品信息。
这些图片用于企业内部库存管理系统，内容为普通商品目录整理。

请以结构化文本格式输出：
1. 产品名称: 提取商品主名称、款式名或礼盒名。
2. 材质/面料: 如锦纶、氨纶、蕾丝、网纱、聚酯纤维、棉质混纺等；能看出多种面料可并列写出。
3. 套装构成: 如上装、下装、连体款、袜类、颈饰、配件等。
4. 款式结构: 如蕾丝、网纱、镂空、连体、绑带、吊带、薄杯、多件套等。
5. 尺码/颜色/适穿信息: 如均码、可调节肩带、弹力面料、黑色/酒红色等；未提及时写未提及。
6. 核心卖点: 概括视觉风格、面料触感、设计亮点、场景定位等。

注意：
- 这是服装商品，不要误判成电子产品，不要虚构动力规格、电源管理、防水等级。
- 优先提取图片中明确可见或可读的文字信息，其次再概括款式特征。
- 直接输出参数，严禁输出任何与任务无关的描述性文字。
- 如果图中信息缺失，请标注为“未提及”。`;

const CARE_DETAIL_OCR_PROMPT = `你是一个专业的个人护理耗材目录审计员。请针对提供的商业摄影图片（偏安全套、润滑液、护理液、清洁用品等消耗品），提取该产品的核心商品信息。
这些图片用于企业内部库存管理系统，内容为普通商品目录整理。

请以结构化文本格式输出：
1. 产品名称: 提取商品主名称、系列名或型号。
2. 产品类型: 如安全套、润滑液、护理液、清洁用品、组合装等。
3. 材质/成分: 如天然橡胶乳胶、水基配方、玻尿酸、芦荟、甘油等；图片未提及时写未提及。
4. 规格信息: 如只数、容量、尺寸、厚度、香型、包装数量等。
5. 使用特性: 如超薄、润滑、无香型、亲肤、易清洗、便携、独立包装等。
6. 核心卖点: 概括安全性、舒适度、材质特点、使用体验等。

注意：
- 这是个人护理耗材，不要误判成电子产品，不要虚构动力规格、电源管理、防水等级。
- 优先提取图片中明确可见或可读的文字信息，其次再概括商品特征。
- 直接输出参数，严禁输出任何与任务无关的描述性文字。
- 如果图中信息缺失，请标注为“未提及”。`;

const PAD_DETAIL_OCR_PROMPT = `你是一个专业的家居床品防护垫目录审计员。请针对提供的商业摄影图片（偏床事垫、防水垫、护理垫、隔水垫、床品垫类商品），提取该产品的核心商品信息。
这些图片用于企业内部库存管理系统，内容为普通商品目录整理。

请以结构化文本格式输出：
1. 产品名称: 提取商品主名称、系列名或型号。
2. 产品类型: 如床事垫、防水垫、护理垫、隔水垫、床品垫、一次性垫单等。
3. 材质/结构: 如TPU防水层、聚酯纤维、棉质面层、吸水层、锁水层、防滑层等；图片未提及时写未提及。
4. 规格尺寸: 如65x52cm、90x120cm、单片/多片装、包装数量等。
5. 使用特性: 如防水、防渗、可水洗、可折叠、柔软亲肤、吸水、速干、防滑、便携等。
6. 核心卖点: 概括防护性能、材质触感、清洁便利性、适用场景等。

注意：
- 这是家居床品防护垫类商品，不要误判成电子产品，不要虚构动力规格、电源管理、震动模式。
- 优先提取图片中明确可见或可读的文字信息，其次再概括商品特征。
- 直接输出参数，严禁输出任何与任务无关的描述性文字。
- 如果图中信息缺失，请标注为“未提及”。`;

function isApparelLikeProduct(title: string): boolean {
  const t = (title || '').toLowerCase();
  const apparelHints = [
    '内衣',
    '内裤',
    '文胸',
    '胸衣',
    '网纱',
    '蕾丝',
    '透视',
    '情趣套装',
    '套装',
    '吊袜',
    '丝袜',
    '睡裙',
    '睡衣',
    '制服',
    '连体衣',
    '三点式',
    '比基尼',
  ];
  return apparelHints.some((hint) => t.includes(hint));
}

function isCareConsumableProduct(title: string): boolean {
  const t = (title || '').toLowerCase();
  const careHints = [
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
  ];
  return careHints.some((hint) => t.includes(hint));
}

function isBedPadProduct(title: string): boolean {
  const t = (title || '').toLowerCase();
  const padHints = [
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
  ];
  return padHints.some((hint) => t.includes(hint));
}

function buildDetailOcrPrompt(title: string): string {
  if (isCareConsumableProduct(title)) return CARE_DETAIL_OCR_PROMPT;
  if (isBedPadProduct(title)) return PAD_DETAIL_OCR_PROMPT;
  return isApparelLikeProduct(title) ? APPAREL_DETAIL_OCR_PROMPT : TOY_DETAIL_OCR_PROMPT;
}

/**
 * 使用 Qwen VL 对一组图片进行多图合并分析
 */
async function ocrWithQwenVL(imageUrls: string[], prompt: string = TOY_DETAIL_OCR_PROMPT): Promise<string> {
  const apiKey = process.env.QWEN_API_KEY;
  if (!apiKey) throw new Error('QWEN_API_KEY 未配置');

  const openai = new OpenAI({
    apiKey,
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  });

  const content: any[] = [{ type: 'text', text: prompt }];
  imageUrls.forEach((url) => {
    content.push({ type: 'image_url', image_url: { url } });
  });

  const response = await openai.chat.completions.create({
    model: 'qwen-vl-plus',
    messages: [{ role: 'user', content }],
    temperature: 0.1,
  });

  return response.choices[0]?.message?.content || '';
}

/**
 * 使用 GLM-4V 进行视觉分析
 */
async function ocrWithGLMV(imageUrls: string[], prompt: string = TOY_DETAIL_OCR_PROMPT): Promise<string> {
  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) throw new Error('GLM_API_KEY 未配置');

  const glm = new OpenAI({
    apiKey,
    baseURL: 'https://open.bigmodel.cn/api/paas/v4/',
  });

  const content: any[] = [{ type: 'text', text: prompt }];
  // GLM-4V 同样支持多图，限制数量以保证稳定性
  imageUrls.slice(0, 10).forEach(url => {
    content.push({ type: 'image_url', image_url: { url } });
  });

  const response = await glm.chat.completions.create({
    model: 'glm-4.6v',
    messages: [{ role: 'user', content }],
    temperature: 0.1,
  });

  return response.choices[0]?.message?.content || '';
}

/**
 * 视觉识别编排器：普通商品 GLM 优先；服饰类图片更容易触发 GLM 安全拦截，改为 Qwen 优先。
 */
async function orchestrateOCR(
  imageUrls: string[],
  prompt: string = TOY_DETAIL_OCR_PROMPT,
  preferQwenFirst = false,
): Promise<string> {
  if (preferQwenFirst) {
    console.log(`  [识别] 启动 Qwen-VL 进行服饰类详情解析...`);
    try {
      const qwenResult = await ocrWithQwenVL(imageUrls, prompt);
      if (qwenResult && qwenResult.length > 20) {
        console.log('  [识别] Qwen-VL 服饰模板解析成功。');
        console.log('  [OCR 结果回显]:\n------------------------------------------------\n' + qwenResult + '\n------------------------------------------------');
        return qwenResult;
      }
      throw new Error('Qwen 返回内容过短或为空');
    } catch (err: any) {
      console.warn(`  [告警] Qwen-VL 解析中断 (${err.message})，尝试 GLM-4V 兜底...`);
    }
  }

  console.log(`  [识别] 启动 glm-4.6v 分辨能力进行首轮解析...`);
  try {
    const result = await ocrWithGLMV(imageUrls, prompt);
    if (result && result.length > 50) {
      console.log('  [识别] GLM-4.6V 解析成功。');
      console.log('  [OCR 结果回显]:\n------------------------------------------------\n' + result + '\n------------------------------------------------');
      return result;
    }
    throw new Error('GLM 返回内容过短或为空');
  } catch (err: any) {
    console.warn(`  [告警] GLM-4V 解析中断 (${err.message})，正在由于 Qwen-VL 执行兜底方案...`);
    const qwenResult = await ocrWithQwenVL(imageUrls, prompt);
    console.log('  [识别] Qwen-VL 兜底解析完成。');
    console.log('  [OCR 结果回显]:\n------------------------------------------------\n' + qwenResult + '\n------------------------------------------------');
    return qwenResult;
  }
}

/**
 * DeepSeek 文字整理兜底
 */
async function textFallbackWithDeepSeek(pageText: string): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return '';

  const deepseek = new OpenAI({ apiKey, baseURL: 'https://api.deepseek.com/v1' });

  const response = await deepseek.chat.completions.create({
    model: 'deepseek-v4-flash',
    messages: [
      {
        role: 'user',
        content: `以下是从页面中提取的零散文字，请提炼核心参数：\n\n${pageText.substring(0, 3000)}`,
      },
    ],
    temperature: 0.1,
  });

  return response.choices[0]?.message?.content || '';
}

/**
 * 自动化破解阿里系滑块验证 (nc_wrapper)
 */
async function solveSliderCaptcha(page: any) {
  const sliderSelector = '#nc_1_n1z';
  const trackSelector = '#nc_1_wrapper';
  
  try {
    const slider = await page.$(sliderSelector);
    if (!slider) return false;

    console.log('  [破解] 检测到滑块阻断，正在执行自动化精准拖拽...');
    
    const sliderBox = await slider.boundingBox();
    if (!sliderBox) return false;

    const track = await page.$(trackSelector);
    const trackBox = await track?.boundingBox();
    const dragDistance = trackBox ? trackBox.width : 260;

    // 移动到滑块中心
    await page.mouse.move(sliderBox.x + sliderBox.width / 2, sliderBox.y + sliderBox.height / 2);
    await page.mouse.down();

    // 模拟人手抖动分段滑动
    const segments = 10;
    const step = dragDistance / segments;
    for (let i = 1; i <= segments; i++) {
      await page.mouse.move(
        sliderBox.x + step * i + (Math.random() * 5 - 2), 
        sliderBox.y + sliderBox.height / 2 + (Math.random() * 4 - 2),
        { steps: 2 }
      );
      await page.waitForTimeout(100 + Math.random() * 50);
    }

    await page.mouse.up();
    console.log('  [破解] 滑块任务执行完毕，等待验证结果...');
    await page.waitForTimeout(3000);
    return true;
  } catch (err) {
    console.error('  [破解] 滑块操作异常:', err);
    return false;
  }
}

/**
 * 启发式性别预判逻辑
 */
function guessGender(title: string): string {
  const t = title.toLowerCase();
  const hasExplicitUnisex = ['男女通用', '男女', '通用', '情侣', '双人', '同性'].some((hint) => t.includes(hint));
  const hasStrongMale = [
    '飞机杯',
    '男用',
    '男性',
    '男士',
    '龟头',
    '阴茎',
    '前列腺',
    '伸缩杯',
    '绚风杯',
    '元気弹',
    '名器',
    '延时',
  ].some((hint) => t.includes(hint));
  const hasMale = hasStrongMale || t.includes('男');
  const hasFemale = t.includes('女') || t.includes('跳蛋') || t.includes('震动棒') || t.includes('吮吸') || t.includes('入体') || t.includes('小海豹');
  
  // 1. 同时包含男女关键字，或者明确标注为通用/情侣
  if (hasExplicitUnisex) {
    return 'unisex';
  }
  // 2. 强男用产品形态优先，避免“女孩子爱玩”等营销词误判
  if (hasStrongMale) return 'male';
  if (hasMale && hasFemale) return 'unisex';
  // 2. 单独男用特征
  if (hasMale) return 'male';
  // 3. 单独女用特征或默认倾向
  return 'female';
}

function inferDefaultMaterial(title: string): string {
  const t = (title || '').toLowerCase();
  if (isBedPadProduct(t)) {
    return 'TPU防水层/聚酯纤维';
  }
  const lingerieHints = [
    '内衣',
    '内裤',
    '网纱',
    '蕾丝',
    '透视',
    '情趣套装',
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
  if (lingerieHints.some((hint) => t.includes(hint))) {
    return '锦纶蕾丝';
  }
  return '硅胶';
}

function extractNumericPrice(raw: string): string {
  if (!raw) return '';
  const cleaned = raw.replace(/[,，\s]/g, '');
  const match = cleaned.match(/(\d+(?:\.\d{1,2})?)/);
  return match?.[1] || '';
}

function parsePriceNumber(raw: string): number | null {
  const numeric = extractNumericPrice(raw);
  return numeric ? Number(numeric) : null;
}

function choosePreferredDetailUrl(...candidates: Array<string | null | undefined>): string {
  const normalized = candidates
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .map((value) => (value.startsWith('http') ? value : `https:${value}`))
    .filter((value) => /^https?:\/\//i.test(value));

  const withPisk = normalized.find((value) => /[?&]pisk=/i.test(value));
  if (withPisk) return withPisk;

  const detailUrl = normalized.find((value) => value.includes('detail.tmall.com/item.htm'));
  if (detailUrl) return detailUrl;

  return normalized[0] || '';
}

function extractTmallItemId(rawUrl: string | null | undefined): string {
  const value = String(rawUrl || '').trim();
  if (!value) return '';
  try {
    const parsed = new URL(value.startsWith('//') ? `https:${value}` : value);
    return parsed.searchParams.get('id')?.trim() || '';
  } catch {
    return value.match(/[?&]id=(\d+)/)?.[1] || '';
  }
}

function persistReviewBuffer(bufferData: unknown[]) {
  const dir = path.dirname(BUFFER_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(BUFFER_PATH, JSON.stringify(bufferData, null, 2));
}

function sanitizeRawDescriptionText(text: string): string {
  if (!text) return text;
  return text
    .split('\n')
    .filter((line) => {
      const normalized = line.trim();
      if (!normalized) return true;
      return !/^(?:\d+\.\s*)?(产品名称\/型号|产品名称|品名)\s*[:：]/.test(normalized);
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * 从天猫 URL 中解析出 pageNo 参数
 */
function getPageNo(url: string | null): number {
  if (!url) return 0;
  try {
    const u = new URL(url.startsWith('//') ? 'https:' + url : url);
    const p = u.searchParams.get('pageNo');
    // 处理可能包含空格的情况
    return p ? parseInt(p.trim()) : 1;
  } catch (e) {
    // 处理非标准 URL (正则降级)
    const match = url.match(/pageNo=(\d+)/);
    return match ? parseInt(match[1]) : 1;
  }
}

/**
 * 构造标准 item URL，作为兜底地址。
 * 注意：原始链接中的 pisk/abbucket 在部分详情页上可能影响模板或数据路由，
 * 因此不应默认替换原链接，只在必要时作为备用地址重试。
 */
function canonicalizeTmallItemUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl;
  try {
    const parsed = new URL(rawUrl.startsWith('//') ? `https:${rawUrl}` : rawUrl);
    const id = parsed.searchParams.get('id')?.trim();
    if (!id) return parsed.toString();
    return `https://detail.tmall.com/item.htm?id=${encodeURIComponent(id)}`;
  } catch {
    const match = rawUrl.match(/[?&]id=(\d+)/);
    return match ? `https://detail.tmall.com/item.htm?id=${match[1]}` : rawUrl;
  }
}

async function openDetailByClickingListItem(page: any, context: any, item: any): Promise<string> {
  const listPageUrl = item.listPageUrl || TARGET_URL;
  console.log(`  [详情链接] 回到列表页模拟点击: ${listPageUrl}`);

  await page.goto(listPageUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
  await solveSliderCaptcha(page);
  await page.waitForSelector('.J_TItems', { timeout: 20000 });

  const hasDomIndex = typeof item.domIndex === 'number' && item.domIndex >= 0;
  if (!hasDomIndex && !item.itemId) {
    throw new Error('缺少可点击定位信息: domIndex/itemId');
  }

  const card =
    hasDomIndex
      ? page.locator('.J_TItems dl.item').nth(item.domIndex)
      : page.locator(`a[href*="id=${item.itemId || ''}"]`).first();

  await card.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(600);

  await card
    .evaluate((dl: Element) => {
      dl.querySelectorAll('a[target]').forEach((anchor) => {
        anchor.setAttribute('target', '_self');
      });
    })
    .catch(() => {});

  const clickTarget = card
    .locator('dt.photo a, a.J_TGoldData, a.J_GoldData, dd.detail a.item-name')
    .first();
  const fallbackClickTarget =
    hasDomIndex
      ? clickTarget
      : page.locator(`a[href*="id=${item.itemId || ''}"]`).first();

  const popupOrNavigation = Promise.race([
    context
      .waitForEvent('page', { timeout: 8000 })
      .then((popupPage: any) => ({ type: 'popup' as const, popupPage }))
      .catch(() => null),
    page
      .waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 })
      .then(() => ({ type: 'navigation' as const }))
      .catch(() => null),
    page.waitForTimeout(10000).then(() => ({ type: 'timeout' as const })),
  ]);

  await fallbackClickTarget.click({ timeout: 15000 });
  const clickResult = await popupOrNavigation;

  if (clickResult?.type === 'popup') {
    const popupPage = clickResult.popupPage;
    await popupPage.waitForLoadState('domcontentloaded', { timeout: 60000 }).catch(() => {});
    await popupPage.waitForTimeout(2000).catch(() => {});
    const popupUrl = popupPage.url();
    console.log(`  [详情链接] 点击弹窗落地: ${popupUrl}`);
    await popupPage.close().catch(() => {});

    if (popupUrl && popupUrl !== 'about:blank') {
      await page.goto(popupUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(3000);
      return page.url() || popupUrl;
    }
  }

  const landedUrl = page.url();
  if (!landedUrl || !landedUrl.includes('detail.tmall.com')) {
    throw new Error(`列表点击未进入详情页，当前地址: ${landedUrl || '(empty)'}`);
  }

  return landedUrl;
}

async function runCrawler() {
  console.log('--- 启动 Playwright 无头抓取引擎 [Target: iroha Tmall] ---');
  const existingBufferEntries = loadReviewBufferEntries(BUFFER_PATH);
  const reviewBufferLookup = buildReviewBufferLookup(existingBufferEntries, extractTmallItemId);
  console.log(`--- 详情缓存已加载: ${existingBufferEntries.length} 条，本次可复用 ${reviewBufferLookup.size} 个索引键 ---`);

  const browser = await chromium.launch({
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=SafeBrowsing',
      '--no-sandbox',
    ],
    ignoreDefaultArgs: ['--enable-automation']
  }); 

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true
  });

  // 注入 Cookie
  const cookieStr = process.env.TMALL_COOKIE || '';
  if (cookieStr) {
    const parseCookies = (domain: string) =>
      cookieStr.split(';').map((c) => {
        const [name, ...rest] = c.trim().split('=');
        return { name, value: rest.join('='), domain, path: '/' };
      }).filter((c) => c.name);

    await context.addCookies([
      ...parseCookies('.tmall.com'),
      ...parseCookies('.taobao.com'),
    ]);
    const injectedCount = cookieStr.split(';').filter(Boolean).length * 2;
    const maskedPreview = `${cookieStr.slice(0, 20)}***`;
    console.log(`[情报] 成功向浏览器上下文注入 Cookie (原始长度: ${cookieStr.length}, 注入条目约: ${injectedCount}, 预览: ${maskedPreview})`);
  } else {
    console.warn('[告警] TMALL_COOKIE 为空，可能触发登录页或风控页。');
  }

  // 隐藏 webdriver 特征
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    // @ts-ignore
    navigator.languages = ['zh-CN', 'zh'];
  });

  const page = await context.newPage();

  // Session Warming
  console.log('[预热] 正在访问天猫首页进行环境初始化...');
  await page.goto('https://www.tmall.com/', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(5000);
  console.log(`[预热] 当前页面标题: ${await page.title()}`);

  page.on('console', msg => {
    if (msg.type() === 'info' || msg.type() === 'log') {
      console.log(`    [Browser] ${msg.text()}`);
    }
  });

  let listItems: any[] = [];
  let currentPage = 1;
  let nextPageUrl = '';

  try {
    // 阶段一：全量列表抓取
    console.log('[阶段一] 正在进行全店地毯式扫描，获取完整商品清单...');
    while (true) {
      const pageUrl = currentPage === 1 ? TARGET_URL : nextPageUrl;
      console.log(`\n[雷达] 正在搜索列表 (第 ${currentPage} 页): ${pageUrl}`);

      try {
        await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(5000);
        await solveSliderCaptcha(page);
        await page.waitForSelector('.J_TItems', { timeout: 20000 });
      } catch (e) {
        console.error('  [致命] 列表页加载超时或被拦截');
        throw e;
      }

      const pageItems = (await page.evaluate(`(() => {
        var normalizeHref = function(value) {
          var trimmed = String(value || '').trim();
          if (!trimmed) return '';
          return trimmed.indexOf('http') === 0 ? trimmed : 'https:' + trimmed;
        };
        var getItemId = function(href) {
          try {
            return new URL(href).searchParams.get('id') || '';
          } catch (e) {
            var match = String(href || '').match(/[?&]id=(\\d+)/);
            return match ? match[1] : '';
          }
        };
        var isRecommended = function(el) {
          return !!(el.closest('.shop-recommend') || el.closest('.sh-results-promote') || el.closest('.similar-items'));
        };
        var pickHref = function(values) {
          var hrefCandidates = values.map(function(value) {
            return normalizeHref(value || '');
          }).filter(Boolean);
          return (
            hrefCandidates.find(function(value) { return /[?&]pisk=/i.test(value); }) ||
            hrefCandidates.find(function(value) { return value.indexOf('detail.tmall.com/item.htm') >= 0; }) ||
            hrefCandidates[0] ||
            ''
          );
        };

        var results = [];
        var seen = new Set();
        var push = function(item) {
          var key = item.itemId || item.href || item.title;
          if (!item.href || !key || seen.has(key)) return;
          seen.add(key);
          results.push(item);
        };

        Array.from(document.querySelectorAll('.J_TItems dl.item')).forEach(function(dl, domIndex) {
          if (isRecommended(dl)) return;
          var nameAnchor = dl.querySelector('dd.detail a.item-name');
          var goldAnchor = dl.querySelector('a.J_GoldData') || dl.querySelector('a.J_TGoldData');
          var photoAnchor = dl.querySelector('dt.photo a');
          var href = pickHref([
            goldAnchor && goldAnchor.href,
            photoAnchor && photoAnchor.href,
            nameAnchor && nameAnchor.href
          ]);
          var title =
            (nameAnchor && nameAnchor.textContent && nameAnchor.textContent.trim()) ||
            ((dl.querySelector('dt.photo img') || {}).alt) ||
            '未知产品';
          var coverImg = dl.querySelector('dt.photo img');
          var coverImage = (coverImg && coverImg.src) || '';
          if (coverImage && coverImage.indexOf('http') !== 0) coverImage = 'https:' + coverImage;
          push({ domIndex: domIndex, itemId: getItemId(href), href: href, title: title, coverImage: coverImage });
        });

        Array.from(document.querySelectorAll('a[href*="detail.tmall.com/item.htm"], a[href*="//detail.tmall.com/item.htm"]')).forEach(function(anchor) {
          if (isRecommended(anchor)) return;
          var href = normalizeHref(anchor.href || anchor.getAttribute('href') || '');
          var itemId = getItemId(href);
          if (!itemId) return;
          var card = anchor.closest('dl.item, li, .item, [data-id], [data-itemid], [data-item-id]') || anchor.parentElement || anchor;
          var itemName = card && card.querySelector('a.item-name');
          var img = card && card.querySelector('img');
          var title =
            (anchor.textContent && anchor.textContent.trim()) ||
            (itemName && itemName.textContent && itemName.textContent.trim()) ||
            (img && img.alt) ||
            '未知产品';
          var coverImage = (img && (img.src || img.getAttribute('data-src'))) || '';
          if (coverImage && coverImage.indexOf('http') !== 0) coverImage = 'https:' + coverImage;
          push({ domIndex: -1, itemId: itemId, href: href, title: title, coverImage: coverImage });
        });

        return results;
      })()`) as Array<{
        domIndex: number;
        itemId: string;
        href: string;
        title: string;
        coverImage: string;
      }>);

      const normalizedPageItems = pageItems.map((item) => ({
        domIndex: item.domIndex,
        listPageUrl: pageUrl,
        href: item.href,
        title: item.title,
        coverImage: item.coverImage,
        price: null,
      }));
      const filteredOutPromoItems = normalizedPageItems.filter((item) =>
        isNonProductListTitle(item.title, item.href),
      );
      const filteredOutBrandItems = normalizedPageItems.filter(
        (item) => !isNonProductListTitle(item.title, item.href) && !isTargetBrandListTitle(item.title),
      );
      const acceptedPageItems = normalizedPageItems.filter((item) =>
        !isNonProductListTitle(item.title, item.href) && isTargetBrandListTitle(item.title),
      );
      console.log(
        `  [列表统计] 原始卡片 ${normalizedPageItems.length}，伪商品过滤 ${filteredOutPromoItems.length}，非 iroha 过滤 ${filteredOutBrandItems.length}，最终保留 ${acceptedPageItems.length}`,
      );
      if (filteredOutPromoItems.length > 0) {
        console.log(
          `  [列表过滤] 已跳过购物金/充值等伪商品: ${filteredOutPromoItems
            .map((item) => item.title)
            .join(' | ')}`,
        );
      }
      if (filteredOutBrandItems.length > 0) {
        console.log(
          `  [列表过滤] 已跳过非 iroha 商品: ${filteredOutBrandItems
            .map((item) => item.title)
            .join(' | ')}`,
        );
      }
      console.log(`  [列表商品] 本页候选: ${acceptedPageItems.map((item, index) => `${index + 1}.${item.title}`).join(' | ')}`);

      console.log(`  -> 取得 ${acceptedPageItems.length} 个正选产品`);
      listItems.push(...acceptedPageItems);

      // 翻页逻辑：升级为“定向安全锁代” (Counter + Directional + Validation)
      await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);

      const nextData = await page.evaluate(() => {
        // 精准指向判定：寻找文本包含“下一页”且不含数字的按钮，避免被商品轮播的 1/1 误伤。
        const allAnchors = Array.from(document.querySelectorAll('a'));
        const nextBtn = allAnchors.find(a => {
            const txt = a.textContent?.trim() || '';
            // 必须包含“下一页”，且不能包含数字（排除数字按钮误伤）
            return txt.includes('下一页') && !/\d+/.test(txt);
        }) as HTMLAnchorElement;

        if (!nextBtn || !nextBtn.href || nextBtn.href.includes('javascript')) {
            return { exists: false, reason: 'BTN_NOT_FOUND' };
        }

        const isBtnDisabled = nextBtn.classList.contains('disable') || 
                              nextBtn.classList.contains('disabled') || 
                              nextBtn.classList.contains('ui-page-s-next-disabled');
        
        if (isBtnDisabled) {
            return { exists: false, reason: 'BTN_DISABLED' };
        }

        return { exists: true, href: nextBtn.href };
      });

      const absoluteNextUrl = nextData.href?.startsWith('http') ? nextData.href : 'https:' + nextData.href;
      const nextPageNo = getPageNo(absoluteNextUrl);

      // 方向锁：严禁向回跳转或原地踏步
      if (nextData.exists && nextPageNo <= currentPage) {
          console.log(`  [安全锁] 下页页码 (${nextPageNo}) 非递增，判定为回环，停止搜索。`);
          break;
      }

      if (!nextData.exists) {
          console.log(`  [情报] 已抵达全店列表末尾 (原因: ${nextData.reason || 'BTN_DISABLED'})。`);
          break;
      }
      
      nextPageUrl = absoluteNextUrl;
      currentPage++;
      await page.waitForTimeout(DELAY_BETWEEN_PAGES);
    }

    console.log(`\n[阶段二] 搜索完成。共汇总 ${listItems.length} 个有效商品，开始逐一访问详情...`);

    const targetItems = listItems.slice(0, MAX_ITEMS);
    const bufferData: ReviewBufferEntry[] = [];
    let skippedByCache = 0;
    console.log(`[缓冲] 本次目标商品数: ${targetItems.length}`);

    for (let i = 0; i < targetItems.length; i++) {
      const item = targetItems[i];
      console.log(`\n[探测] (${i + 1}/${targetItems.length}) ${item.title}`);

      const cachedEntry = findCachedReviewBufferEntry(
        reviewBufferLookup,
        {
          itemId: item.itemId,
          href: item.href,
          title: item.title,
        },
        extractTmallItemId,
      );
      if (cachedEntry) {
        const reusedEntry = mergeCachedReviewBufferEntry(cachedEntry, {
          sourceUrl: choosePreferredDetailUrl(item.href),
          title: item.title,
          price: item.price ?? null,
          coverImage: item.coverImage,
          genderHint: guessGender(item.title),
          imagePlaceholder: 'bg-gradient-to-br from-pink-900/40 to-rose-900/40',
        });
        bufferData.push(reusedEntry);
        indexReviewBufferEntry(reviewBufferLookup, reusedEntry, extractTmallItemId);
        skippedByCache++;
        persistReviewBuffer(bufferData);
        console.log(`  [缓冲命中] 已复用本地缓存并跳过详情抓取 (${skippedByCache}) ${item.title}`);
        await page.waitForTimeout(DELAY_BETWEEN_PAGES);
        continue;
      }

      let ocrText = '';
      let detailParamsText = '';
      let finalDetailUrl = item.href;
      let retryCount = 0;
      const MAX_RETRIES = 1;
      const capturedV8Images: string[] = [];

      const onResponse = async (res: any) => {
        const url = res.url();
        const isDescApi = url.includes('desc') || url.includes('v8') || url.includes('h5api');
        if (isDescApi) {
          try {
            const text = await res.text();
            if (text.includes('alicdn.com')) {
              const matches = text.match(/(\\\/\\\/|\/\/|https?:)[^"']+\.alicdn\.com\/[^"']+/g);
              if (matches) {
                matches.forEach(m => {
                  let cleanUrl = m.replace(/\\/g, '');
                  if (cleanUrl.startsWith('//')) cleanUrl = 'https:' + cleanUrl;
                  if (!cleanUrl.toLowerCase().includes('.gif')) capturedV8Images.push(cleanUrl);
                });
              }
            }
          } catch {}
        }
      };

      while (retryCount <= MAX_RETRIES && !ocrText) {
        try {
          page.on('response', onResponse);
          const originalDetailUrl = item.href;
          const normalizedDetailUrl = canonicalizeTmallItemUrl(item.href);
          try {
            finalDetailUrl = await openDetailByClickingListItem(page, context, item);
          } catch (clickErr: any) {
            console.warn(`  [详情链接] 列表点击失败，回退 href 直达: ${clickErr.message || clickErr}`);
            await page.goto(originalDetailUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            finalDetailUrl = page.url() || originalDetailUrl;
          }
          await page.waitForTimeout(5000);
          // console.log(`  [详情链接] 列表链接: ${originalDetailUrl}`);
          // console.log(`  [详情链接] 来源列表页: ${item.listPageUrl || '(missing)'}`);
          console.log(`  [详情链接] 首次落地: ${finalDetailUrl}`);
          
          const isBlocked = await page.evaluate(() => {
            const title = document.title;
            return title.includes('验证码') || title.includes('robot') || document.body.innerText.includes('滑动一下');
          });
          const isLoginPage = await page.evaluate(() => {
            const title = document.title || '';
            const body = document.body?.innerText || '';
            return title.includes('登录') || body.includes('密码登录') || body.includes('短信登录') || body.includes('免费注册');
          });

          if (isLoginPage) {
            throw new Error('会话失效: 详情页落入登录页');
          }

          if (isBlocked) {
            console.log('  [中箭] 详情页触发防护，尝试自动破解...');
            const success = await solveSliderCaptcha(page);
            if (!success) throw new Error('滑块破解失败');
            finalDetailUrl = page.url() || finalDetailUrl;
            console.log(`  [详情链接] 风控处理后落地: ${finalDetailUrl}`);
          }

          // 价格提取引擎 (Robust Price Engine)
          const capturedPrice = await page.evaluate(() => {
            // A. 尝试 SSR 静态块提取 (明文)
            const ssrBlock = document.querySelector('meta[property="og:product:price"]') || 
                             document.querySelector('meta[name="twitter:data1"]');
            if (ssrBlock) {
              const match = ssrBlock.getAttribute('content')?.match(/(\d+\.?\d*)/);
              if (match) return { val: match[1], src: 'SSR_META' };
            }
            // B. 传统类名
            const wrap = document.querySelector('[class*="priceWrap"]');
            const textElem = wrap?.querySelector('[class*="text"]');
            if (textElem) return { val: textElem.textContent?.trim(), src: 'DOM_SELECTOR' };
            return null;
          }).catch(() => null);

          let validatedPrice = extractNumericPrice(capturedPrice?.val || '');
          let priceSource = capturedPrice?.src || 'NONE';

          // C. 源码级硬核挖掘 (加固)
          const isInvalidPrice = (s: string) => !extractNumericPrice(s || '');
          if (!validatedPrice || isInvalidPrice(validatedPrice)) {
            const pageSource = await page.content();
            const jsonMatch = pageSource.match(/"price":"(\d+\.?\d*)"/i) || 
                              pageSource.match(/"skuPrice":"(\d+\.?\d*)"/i);
            if (jsonMatch) {
              validatedPrice = jsonMatch[1];
              priceSource = 'SOURCE_JSON';
            }
          }

          if (validatedPrice && !isInvalidPrice(validatedPrice)) {
            const numericPrice = parsePriceNumber(validatedPrice);
            console.log(`  [详情价格] 从 [${priceSource}] 成功捕捉实时售价: ${numericPrice} (原列表价: ${item.price ?? '未提取'})`);
            item.price = numericPrice;
          }

          // 激活懒加载
          await page.evaluate(async () => {
            for (let j = 0; j < 5; j++) {
              window.scrollBy(0, 2000);
              await new Promise(r => setTimeout(r, 800));
            }
          });

          await tryRevealTmallParamTabs(page);
          await page.evaluate(async () => {
            for (let j = 0; j < 6; j++) {
              const bodyText = document.body?.innerText || '';
              if (bodyText.includes('参数信息') && bodyText.includes('图文详情')) break;
              window.scrollBy(0, 1200);
              await new Promise((r) => setTimeout(r, 700));
            }
          });

          await page
            .waitForFunction(() => {
              const bodyText = document.body?.innerText || '';
              return bodyText.includes('参数信息') || bodyText.includes('图文详情');
            }, { timeout: 8000 })
            .catch(() => {});

          await page
            .waitForFunction(
              () =>
                !!(window as unknown as { __ICE_APP_CONTEXT__?: { loaderData?: unknown } })
                  .__ICE_APP_CONTEXT__?.loaderData,
              { timeout: 20000 },
            )
            .catch(() => {});

          // 抓取详情页“参数信息”区域（如材质、品牌、产地等）
          const mergedParams = new Map<string, string>();
          let paramSectionHitCount = 0;
          let rawParamPairTotal = 0;

          const icePairs = await page
            .evaluate(scrapeParamPairsFromIceContext)
            .catch(() => [] as Array<[string, string]>);
          rawParamPairTotal += icePairs.length;
          if (icePairs.length > 0) paramSectionHitCount++;
          mergeWhitelistParams(mergedParams, icePairs);
          if (icePairs.length) {
            console.log(`  [参数] ICE loaderData 内嵌属性候选: ${icePairs.length} 条`);
          }

          for (const frame of page.frames()) {
            const framePairs = await frame
              .evaluate(scrapeParamPairsInPage)
              .catch(() => [] as Array<[string, string]>);

            rawParamPairTotal += framePairs.length;
            if (framePairs.length > 0) paramSectionHitCount++;

            mergeWhitelistParams(mergedParams, framePairs);
          }

          const pageHtmlSnapshot = await page.content();
          const htmlPairs = extractParamPairsFromPageHtml(pageHtmlSnapshot);
          rawParamPairTotal += htmlPairs.length;
          if (htmlPairs.length > 0) paramSectionHitCount++;
          mergeWhitelistParams(mergedParams, htmlPairs);

          const loosePairs = extractParamPairsFromLooseJsonText(pageHtmlSnapshot);
          rawParamPairTotal += loosePairs.length;
          if (loosePairs.length > 0) paramSectionHitCount++;
          mergeWhitelistParams(mergedParams, loosePairs);

          const bodyTextSnapshot = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
          const compactTextPairs = extractParamPairsFromCompactText(bodyTextSnapshot);
          rawParamPairTotal += compactTextPairs.length;
          if (compactTextPairs.length > 0) paramSectionHitCount++;
          mergeWhitelistParams(mergedParams, compactTextPairs);

          if (
            rawParamPairTotal === 0 &&
            normalizedDetailUrl !== originalDetailUrl &&
            !bodyTextSnapshot.includes('参数信息') &&
            !bodyTextSnapshot.includes('图文详情')
          ) {
            console.log(`  [详情链接] 原始链接未出现详情模块，尝试标准地址兜底: ${normalizedDetailUrl}`);
            await page.goto(normalizedDetailUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await page.waitForTimeout(4000);
            finalDetailUrl = page.url() || normalizedDetailUrl;
            console.log(`  [详情链接] 标准地址落地: ${finalDetailUrl}`);

            const retryHtmlSnapshot = await page.content();
            const retryBodyTextSnapshot = await page.evaluate(() => document.body?.innerText || '').catch(() => '');

            const retryHtmlPairs = extractParamPairsFromPageHtml(retryHtmlSnapshot);
            const retryLoosePairs = extractParamPairsFromLooseJsonText(retryHtmlSnapshot);
            const retryCompactTextPairs = extractParamPairsFromCompactText(retryBodyTextSnapshot);

            const retryPairs = [...retryHtmlPairs, ...retryLoosePairs, ...retryCompactTextPairs];
            rawParamPairTotal += retryPairs.length;
            if (retryPairs.length > 0) paramSectionHitCount++;
            mergeWhitelistParams(mergedParams, retryPairs);
          }

          const orderedKeys = ['材质', '品牌', '产地', '生产企业', '分类'];
          detailParamsText = orderedKeys
            .filter((k) => mergedParams.has(k))
            .map((k) => `${k}: ${mergedParams.get(k)}`)
            .join('\n');

          let domImages: string[] = [];
          for (const frame of page.frames()) {
            try {
              const fData = await frame.evaluate(() => {
                const imgs = Array.from(document.querySelectorAll('img'));
                return imgs.map(i => {
                  const s = i.getAttribute('data-src') || i.getAttribute('src') || '';
                  return s.startsWith('//') ? 'https:' + s : s;
                }).filter(s => /alicdn\.com/.test(s) && !s.includes('.gif') && s.length > 30);
              });
              domImages.push(...fData);
            } catch {}
          }

          const allImages = [...new Set([...domImages, ...capturedV8Images])];
          const uniqueUrls = allImages.slice(0, 15);

          if (uniqueUrls.length > 0) {
            console.log(`  [详情图片] 已收集 ${uniqueUrls.length} 张候选详情图，送审 URL 如下:`);
            console.log('------------------------------------------------');
            uniqueUrls.forEach((url, index) => {
              console.log(`  [${index + 1}] ${url}`);
            });
            console.log('------------------------------------------------');
          } else {
            console.log('  [详情图片] 未收集到可用于 OCR 的详情图片 URL');
          }

          if (uniqueUrls.length > 3) {
            const detailOcrPrompt = buildDetailOcrPrompt(item.title);
            const isCareTemplate = isCareConsumableProduct(item.title);
            const isPadTemplate = isBedPadProduct(item.title);
            const isApparelTemplate = isApparelLikeProduct(item.title);
            const templateName = isCareTemplate ? 'CARE' : isPadTemplate ? 'PAD' : isApparelTemplate ? 'APPAREL' : 'TOY';
            console.log(`  [识别] 当前详情图识别模板: ${templateName}`);
            ocrText = await orchestrateOCR(uniqueUrls, detailOcrPrompt, isCareTemplate || isPadTemplate || isApparelTemplate);
          } else {
            console.log('  [策略] 图片不足，回退文字整理...');
            const pText = await page.evaluate(() => document.body.innerText);
            ocrText = await textFallbackWithDeepSeek(pText);
          }

          if (!detailParamsText && ocrText) {
            const ocrParamPairs = extractParamPairsFromOcrText(ocrText);
            if (/iroha/i.test(item.title)) {
              ocrParamPairs.push(['品牌', 'iroha']);
            }
            rawParamPairTotal += ocrParamPairs.length;
            if (ocrParamPairs.length > 0) paramSectionHitCount++;
            mergeWhitelistParams(mergedParams, ocrParamPairs);

            detailParamsText = orderedKeys
              .filter((k) => mergedParams.has(k))
              .map((k) => `${k}: ${mergedParams.get(k)}`)
              .join('\n');

            if (detailParamsText) {
              console.log(`  [参数] 页面参数区缺失，已从 OCR 文本回填 ${detailParamsText.split('\n').length} 条参数信息`);
            }
          }

          if (!mergedParams.has('材质') || isPlaceholderParamValue(mergedParams.get('材质') || '')) {
            const defaultMaterial = inferDefaultMaterial(item.title);
            mergedParams.set('材质', defaultMaterial);
            detailParamsText = orderedKeys
              .filter((k) => mergedParams.has(k))
              .map((k) => `${k}: ${mergedParams.get(k)}`)
              .join('\n');
            console.log(`  [参数] 材质仍未命中，已按默认规则回填: ${defaultMaterial}`);
          }

          if (detailParamsText) {
            ocrText = `[参数信息]\n${detailParamsText}${ocrText ? `\n\n[图文提取]\n${sanitizeRawDescriptionText(ocrText)}` : ''}`;
            console.log(`  [参数] 已从 paramsInfoArea 抓取 ${detailParamsText.split('\n').length} 条参数信息`);
            console.log('  [参数详情]\n------------------------------------------------');
            console.log(detailParamsText);
            console.log('------------------------------------------------');
          } else {
            const pageTitle = await page.title().catch(() => '');
            const paramInfoIndex = bodyTextSnapshot.indexOf('参数信息');
            const bodyAroundParam =
              paramInfoIndex >= 0
                ? bodyTextSnapshot.slice(Math.max(0, paramInfoIndex - 40), paramInfoIndex + 260)
                : bodyTextSnapshot.slice(0, 260);
            console.log(
              `  [参数] 未提取到白名单字段(材质/品牌/产地/生产企业/分类)，含候选键值对的 frame 数: ${paramSectionHitCount}，原始键值候选总数: ${rawParamPairTotal}`,
            );
            console.log(
              `  [参数诊断] title=${pageTitle || '(empty)'} | bodyLen=${bodyTextSnapshot.length} | has参数信息=${paramInfoIndex >= 0} | compactPairs=${compactTextPairs.length}`,
            );
            console.log('  [参数诊断片段]\n------------------------------------------------');
            console.log(bodyAroundParam || '(empty body snippet)');
            console.log('\n------------------------------------------------');
          }
        } catch (err: any) {
          console.error(`  [故障] 访问失败: ${err.message}`);
          if (String(err.message || '').includes('会话失效')) {
            console.error('  [会话] 请检查 TMALL_COOKIE 是否过期，或重新登录后更新 .env');
          }
          retryCount++;
        } finally {
          page.removeListener('response', onResponse);
        }
      }

      const nextEntry: ReviewBufferEntry = {
        sourceUrl: choosePreferredDetailUrl(finalDetailUrl, item.href),
        name: item.title,
        price: item.price ?? null,
        coverImage: item.coverImage,
        genderHint: guessGender(item.title),
        rawDescription: sanitizeRawDescriptionText(ocrText) || '信息未获取',
        imagePlaceholder: 'bg-gradient-to-br from-pink-900/40 to-rose-900/40',
        isReviewed: false,
      };
      bufferData.push(nextEntry);
      indexReviewBufferEntry(reviewBufferLookup, nextEntry, extractTmallItemId);
      persistReviewBuffer(bufferData);
      console.log(`  [缓冲] 已写入 (${bufferData.length}/${targetItems.length}) ${item.title}`);

      await page.waitForTimeout(DELAY_BETWEEN_PAGES);
    }

    persistReviewBuffer(bufferData);
    console.log(`[缓冲] 最终写入 ${bufferData.length} 条，目标 ${targetItems.length} 条，缓存跳过 ${skippedByCache} 条`);
    console.log(`\n--- 抓取完成，数据存入: ${BUFFER_PATH} ---`);
    await runCleaner();
  } catch (error) {
    console.error('[致命错误] 进程崩溃:', error);
  } finally {
    await browser.close();
  }
}

runCrawler().catch(console.error);
