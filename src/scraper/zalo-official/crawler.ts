import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runCleaner } from './cleaner.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHINA_BASE_URL = 'http://www.zalo.com.cn/';
const SHOPIFY_CATALOG_URL = 'https://zalocare.com/products.json?limit=250';
const TARGET_LISTS = [
  { url: 'http://www.zalo.com.cn/product_1.html', series: '洛丽塔系列' },
  { url: 'http://www.zalo.com.cn/product_2.html', series: '极光系列' },
  { url: 'http://www.zalo.com.cn/product_5.html', series: '传奇系列HOT' },
  { url: 'http://www.zalo.com.cn/product_3.html', series: '传奇系列Classic' },
];
const MAX_ITEMS = Number(process.env.ZALO_OFFICIAL_MAX_ITEMS || '120');
const MAX_OCR_IMAGES = Number(process.env.ZALO_OFFICIAL_MAX_OCR_IMAGES || '8');
const BUFFER_PATH = path.resolve(__dirname, '../../data/zalo-official-review-buffer.json');

const REQUEST_HEADERS: HeadersInit = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
  pragma: 'no-cache',
  'cache-control': 'no-cache',
};

type ListItem = {
  sourceUrl: string;
  name: string;
  subtitle: string;
  coverImage: string;
  series: string;
  listPosition: number;
  purchaseUrl: string;
};

type ShopifyVariant = {
  price?: string | null;
  compare_at_price?: string | null;
  available?: boolean;
};

type ShopifyImage = {
  src?: string;
};

type ShopifyOption = {
  name?: string;
  values?: string[];
};

type ShopifyProduct = {
  title: string;
  handle: string;
  body_html?: string;
  vendor?: string;
  product_type?: string;
  variants?: ShopifyVariant[];
  images?: ShopifyImage[];
  options?: ShopifyOption[];
};

type ShopifyCatalogResponse = {
  products?: ShopifyProduct[];
};

type ProductDetail = {
  title: string;
  specsUrl: string;
  detailImages: string[];
  colorNames: string[];
  specsText: string;
  specsMap: Record<string, string>;
};

type ShopifyMatch = {
  product: ShopifyProduct;
  score: number;
  matchedBy: string;
};

const HANDLE_ALIAS: Record<string, string> = {
  TALIS: 'talis-g-spot-pulsewave-vibrator',
  FLORA: 'flora-smart-vibrating-pad',
  APIS: 'apis-vibrating-coupless-ring',
  DEYA: 'deya-wearable-vibrator',
  AVA: 'ava-smart-wand-massager',
  EVE: 'eve-oral-pleasure-vibrator',
  SESH: 'sesh-compact-sex-machine',
  MOSE2: 'mose-2-g-spot-rabbit-thruster',
  'MOSE 2': 'mose-2-g-spot-rabbit-thruster',
  BESS: 'bess-2-clitoral-vibrator',
  ARES: 'ares-g-spot-rabbit-vibrator',
  AYA: 'aya-wearable-vibrator',
  BAYEK: 'bayek-cock-ring',
};

const TOY_DETAIL_OCR_PROMPT = `你是一个专业的情趣用品详情图识别助手。你会收到同一款商品的一组长图详情页图片，请只提取图片中能明确看见或读出的商品信息。

请以中文结构化文本输出：
1. 产品名称/型号
2. 产品定位/玩法
3. 材质与结构
4. 模式与动力特征
5. 防水/静音/续航/充电
6. 核心卖点

注意：
- 优先提取图片里的真实文字，不要幻想页面里没有的信息。
- 如果某项图片没有写，请写“未提及”。
- 不要输出 markdown，不要输出额外解释。`;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function decodeHtmlEntities(value: string): string {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function stripTags(value: string): string {
  return decodeHtmlEntities(String(value || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' '));
}

function normalizeWhitespace(value: string): string {
  return stripTags(value)
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

function uniqueStrings(values: Array<string | null | undefined>, limit = 60): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = String(value || '').trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= limit) break;
  }
  return result;
}

function normalizeKey(value: string): string {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');
}

function resolveUrl(baseUrl: string, input: string): string {
  const value = String(input || '').trim();
  if (!value) return '';
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function parseNumber(value: unknown): number | null {
  const numeric = Number(String(value ?? '').replace(/[^\d.]+/g, ''));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function htmlToPlainText(value: string): string {
  return normalizeWhitespace(String(value || '').replace(/<\/(p|div|li|blockquote|h\d)>/gi, '\n'));
}

async function fetchText(url: string, extraHeaders?: HeadersInit): Promise<string> {
  const response = await fetch(url, {
    headers: { ...REQUEST_HEADERS, ...(extraHeaders || {}) },
    redirect: 'follow',
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching ${url}`);
  }
  return await response.text();
}

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: REQUEST_HEADERS,
      redirect: 'follow',
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = String(response.headers.get('content-type') || '').trim().toLowerCase();
    if (!contentType.startsWith('image/')) {
      throw new Error(`non-image content-type: ${contentType || 'unknown'}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) return null;
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch (error) {
    console.warn(`[OCR] 图片下载失败: ${url}`, error);
    return null;
  }
}

async function ocrWithQwenVL(imageInputs: string[], prompt: string): Promise<string> {
  const apiKey = process.env.QWEN_API_KEY;
  if (!apiKey) throw new Error('QWEN_API_KEY 未配置');

  const openai = new OpenAI({
    apiKey,
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  });

  const content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [
    { type: 'text', text: prompt },
  ];
  imageInputs.forEach((url) => {
    content.push({ type: 'image_url', image_url: { url } });
  });

  const response = await openai.chat.completions.create({
    model: 'qwen-vl-plus',
    messages: [{ role: 'user', content }],
    temperature: 0.1,
  });

  return String(response.choices[0]?.message?.content || '').trim();
}

async function ocrWithGLMV(imageInputs: string[], prompt: string): Promise<string> {
  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) throw new Error('GLM_API_KEY 未配置');

  const glm = new OpenAI({
    apiKey,
    baseURL: 'https://open.bigmodel.cn/api/paas/v4/',
  });

  const content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [
    { type: 'text', text: prompt },
  ];
  imageInputs.slice(0, MAX_OCR_IMAGES).forEach((url) => {
    content.push({ type: 'image_url', image_url: { url } });
  });

  const response = await glm.chat.completions.create({
    model: 'glm-4.6v',
    messages: [{ role: 'user', content }],
    temperature: 0.1,
  });

  return String(response.choices[0]?.message?.content || '').trim();
}

async function orchestrateDetailOcr(imageUrls: string[], productName: string): Promise<string> {
  const candidateUrls = uniqueStrings(imageUrls, MAX_OCR_IMAGES);
  if (candidateUrls.length === 0) return '';

  console.log(`  [OCR] 开始处理详情长图: ${productName} | images=${candidateUrls.length}`);
  const imageInputs = (
    await Promise.all(candidateUrls.map((url) => fetchImageAsDataUrl(url)))
  ).filter((value): value is string => Boolean(value));

  if (imageInputs.length === 0) {
    console.log('  [OCR] 无可用图片输入，跳过视觉识别。');
    return '';
  }

  const prompt = `${TOY_DETAIL_OCR_PROMPT}\n\n商品标题参考：${productName}`;

  try {
    const glmResult = await ocrWithGLMV(imageInputs, prompt);
    if (glmResult.length >= 30) {
      console.log('  [OCR] GLM-4.6V 识别成功。');
      return glmResult;
    }
    throw new Error('GLM 返回内容过短或为空');
  } catch (error: any) {
    console.warn(`  [OCR] GLM-4.6V 失败 (${error?.message || error})，改用 Qwen-VL...`);
  }

  try {
    const qwenResult = await ocrWithQwenVL(imageInputs, prompt);
    if (qwenResult.length >= 20) {
      console.log('  [OCR] Qwen-VL 识别成功。');
      return qwenResult;
    }
    throw new Error('Qwen 返回内容过短或为空');
  } catch (error) {
    console.warn(`[OCR] Qwen-VL 失败: ${error}`);
    return '';
  }
}

function sanitizeRawDescriptionText(text: string): string {
  if (!text) return text;
  return text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line, index, lines) => !(line.trim() === '' && lines[index - 1]?.trim() === ''))
    .join('\n')
    .trim();
}

function persistBuffer(bufferData: unknown[]) {
  ensureDir(BUFFER_PATH);
  fs.writeFileSync(BUFFER_PATH, JSON.stringify(bufferData, null, 2));
}

function extractListItems(html: string, series: string): ListItem[] {
  const items: ListItem[] = [];
  let listPosition = 0;

  const blockPattern =
    /<div class="product-item[^"]*"[\s\S]*?<div class="product-text">([\s\S]*?)<\/div>\s*<a href="([^"]+)"><img src="([^"]+)"/gi;

  for (const match of html.matchAll(blockPattern)) {
    const textBlock = match[1];
    const detailMatch = textBlock.match(
      /<a href="([^"]+)">\s*<h3>([\s\S]*?)<\/h3><br\s*\/?>\s*<p>([\s\S]*?)<\/p>\s*<\/a>/i,
    );
    if (!detailMatch) continue;

    const detailUrl = resolveUrl(CHINA_BASE_URL, detailMatch[1]);
    const name = normalizeWhitespace(detailMatch[2]);
    const subtitle = normalizeWhitespace(detailMatch[3]);
    const coverImage = resolveUrl(CHINA_BASE_URL, match[3]);
    const purchaseUrl =
      resolveUrl(
        CHINA_BASE_URL,
        textBlock.match(/<a class="pmore" href="([^"]+)"[^>]*>\s*购买\s*<\/a>/i)?.[1] || '',
      ) || '';

    if (!detailUrl || !name) continue;

    listPosition += 1;
    items.push({
      sourceUrl: detailUrl,
      name,
      subtitle,
      coverImage,
      series,
      listPosition,
      purchaseUrl,
    });
  }

  return items;
}

function extractSpecPairs(html: string): Array<{ key: string; value: string }> {
  const rows: Array<{ key: string; value: string }> = [];
  for (const tableMatch of html.matchAll(/<table[\s\S]*?<\/table>/gi)) {
    const tds = Array.from(tableMatch[0].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)).map((cell) =>
      normalizeWhitespace(cell[1]),
    );
    if (tds.length < 2) continue;
    const key = normalizeWhitespace(tds[0]).replace(/\n+/g, ' / ');
    const value = normalizeWhitespace(tds[1]);
    if (!key || !value) continue;
    rows.push({ key, value });
  }
  return rows;
}

function extractProductDetail(detailHtml: string, sourceUrl: string, fallback: ListItem): ProductDetail {
  const title =
    normalizeWhitespace(detailHtml.match(/<title>([^<|]+)\|/i)?.[1] || '') ||
    normalizeWhitespace(detailHtml.match(/<div class="productDe-top">[\s\S]*?<\/div>\s*([^<\n]+)/i)?.[1] || '') ||
    fallback.name;

  const specsUrl =
    resolveUrl(CHINA_BASE_URL, detailHtml.match(/href="(specs_\d+\.html)"/i)?.[1] || '') ||
    sourceUrl.replace(/productDe_(\d+)\.html/i, 'specs_$1.html');

  const detailBodyHtml =
    detailHtml.match(/<div class="productDe-body">([\s\S]*?)<\/div>\s*<div class="product-color/i)?.[1] ||
    detailHtml.match(/<div class="productDe-body">([\s\S]*?)<\/div>\s*<!--footer-->/i)?.[1] ||
    '';
  const colorBlockHtml = detailHtml.match(/<div class="product-color[\s\S]*?<!--footer-->/i)?.[0] || '';
  const detailImages = uniqueStrings(
    Array.from(detailBodyHtml.matchAll(/<img[^>]+src="([^"]+)"/gi)).map((item) => resolveUrl(CHINA_BASE_URL, item[1])),
    40,
  );
  const colorNames = uniqueStrings(
    Array.from(colorBlockHtml.matchAll(/<span>([^<]+)<\/span>/gi)).map((item) =>
      normalizeWhitespace(item[1]),
    ),
    12,
  );

  return {
    title,
    specsUrl,
    detailImages,
    colorNames,
    specsText: '',
    specsMap: {},
  };
}

async function fetchProductDetail(item: ListItem): Promise<ProductDetail> {
  const detailHtml = await fetchText(item.sourceUrl);
  const baseDetail = extractProductDetail(detailHtml, item.sourceUrl, item);
  let specsText = '';
  let specsMap: Record<string, string> = {};

  if (baseDetail.specsUrl) {
    try {
      const specsHtml = await fetchText(baseDetail.specsUrl);
      const specRows = extractSpecPairs(specsHtml);
      specsMap = Object.fromEntries(specRows.map((row) => [row.key, row.value]));
      specsText = specRows.map((row) => `${row.key}: ${row.value}`).join('\n');
    } catch (error) {
      console.warn(`[规格] 抓取失败: ${baseDetail.specsUrl}`, error);
    }
  }

  return {
    ...baseDetail,
    specsText,
    specsMap,
  };
}

function extractSearchKeys(name: string, subtitle: string): string[] {
  const rawTokens = `${name} ${subtitle}`.match(/[A-Za-z0-9]+(?:\s+[A-Za-z0-9]+)*/g) || [];
  const tokens = rawTokens.flatMap((token) => {
    const normalized = token.trim();
    const compact = normalizeKey(normalized);
    const split = normalized
      .split(/\s+/)
      .map((part) => normalizeKey(part))
      .filter(Boolean);
    return [normalized.toUpperCase(), compact, ...split];
  });

  return uniqueStrings(tokens.filter((token) => token.length >= 4 || /\d/.test(token)));
}

function getShopifyUsdPrice(product: ShopifyProduct | null): number | null {
  if (!product) return null;
  const values = (product.variants || [])
    .map((variant) => parseNumber(variant.price))
    .filter((value): value is number => value !== null);
  if (values.length === 0) return null;
  return Math.min(...values);
}

function getShopifyImages(product: ShopifyProduct | null): string[] {
  return uniqueStrings((product?.images || []).map((image) => String(image?.src || '').trim()), 40);
}

function getShopifyOptionValues(product: ShopifyProduct | null): string[] {
  return uniqueStrings((product?.options || []).flatMap((option) => option?.values || []), 20);
}

function scoreShopifyCandidate(product: ShopifyProduct, item: ListItem, keys: string[]): ShopifyMatch | null {
  const nameKey = normalizeKey(item.name);
  const titleKey = normalizeKey(product.title);
  const handleKey = normalizeKey(product.handle);
  const sourceText = `${product.title}\n${product.handle}\n${product.product_type || ''}\n${htmlToPlainText(product.body_html || '')}`.toLowerCase();

  let score = 0;
  let matchedBy = '';

  const aliasHandle = HANDLE_ALIAS[item.name.toUpperCase()] || HANDLE_ALIAS[nameKey];
  if (aliasHandle && product.handle === aliasHandle) {
    return { product, score: 100, matchedBy: 'alias' };
  }

  if (nameKey.length >= 5 && (titleKey.includes(nameKey) || handleKey.includes(nameKey))) {
    score += 35;
    matchedBy = matchedBy || 'name';
  }

  for (const key of keys) {
    const normalized = normalizeKey(key);
    if (!normalized || normalized.length < 4) continue;
    if (titleKey.includes(normalized) || handleKey.includes(normalized)) {
      score += normalized.length >= 6 ? 20 : 12;
      matchedBy = matchedBy || 'token';
    }
  }

  if (/情侣|夫妻/.test(item.subtitle) && /couple|partner/.test(sourceText)) score += 12;
  if (/G点|拍打|兔耳|吮吸|按摩棒|跳蛋|穿戴/.test(item.subtitle) && /g-spot|rabbit|clitoral|wearable|vibrator|massager|suction/.test(sourceText))
    score += 8;
  if (/环/.test(item.subtitle) && /ring/.test(sourceText)) score += 8;

  if (score < 25) return null;
  return { product, score, matchedBy: matchedBy || 'heuristic' };
}

function findShopifyMatch(item: ListItem, catalog: ShopifyProduct[]): ShopifyMatch | null {
  const keys = extractSearchKeys(item.name, item.subtitle);
  const candidates = catalog
    .map((product) => scoreShopifyCandidate(product, item, keys))
    .filter((candidate): candidate is ShopifyMatch => Boolean(candidate))
    .sort((left, right) => right.score - left.score);

  if (candidates.length === 0) return null;
  if (candidates.length > 1 && candidates[0].score - candidates[1].score < 4 && candidates[0].matchedBy !== 'alias') {
    return null;
  }
  return candidates[0];
}

function inferGender(text: string): 'male' | 'female' | 'unisex' {
  const value = String(text || '').toLowerCase();
  if (
    ['情侣', '夫妻', 'couple', 'partner', 'shared intimacy', 'wearable couple', 'couples'].some((hint) =>
      value.includes(hint),
    )
  ) {
    return 'unisex';
  }
  if (
    ['男用', '男性', '阴茎', 'cock ring', 'penis ring', 'for him', 'prostate', '前列腺', '震动环'].some((hint) =>
      value.includes(hint),
    )
  ) {
    return 'male';
  }
  if (
    ['女性', '女用', 'g点', 'c点', '阴蒂', '按摩棒', '吮吸', '跳蛋', 'rabbit', 'clitoral', 'g-spot', 'wearable'].some(
      (hint) => value.includes(hint),
    )
  ) {
    return 'female';
  }
  return 'unisex';
}

function buildRawDescription(
  item: ListItem,
  detail: ProductDetail,
  match: ShopifyMatch | null,
  priceUsd: number | null,
  ocrText: string,
): string {
  const product = match?.product || null;
  const shopifyText = htmlToPlainText(product?.body_html || '');
  const specLines = Object.entries(detail.specsMap).map(([key, value]) => `${key}: ${value}`);
  const sections = [
    '[基础信息]',
    `商品名: ${detail.title || item.name}`,
    `系列: ${item.series}`,
    item.subtitle ? `副标题: ${item.subtitle}` : '',
    `中文详情页: ${item.sourceUrl}`,
    detail.specsUrl ? `技术规格页: ${detail.specsUrl}` : '',
    item.purchaseUrl ? `中文站购买链接: ${item.purchaseUrl}` : '',
    match?.product ? `英文站匹配: ${product?.title || ''}` : '英文站匹配: 未匹配',
    match?.product ? `英文Handle: ${product?.handle || ''}` : '',
    typeof priceUsd === 'number' ? `页面价格(USD): ${priceUsd}` : '页面价格(USD): 未匹配',
    `性别提示: ${inferGender(`${item.name}\n${item.subtitle}\n${product?.title || ''}\n${shopifyText}`)}`,
    detail.colorNames.length ? `颜色选项: ${detail.colorNames.join(' / ')}` : '',
    getShopifyOptionValues(product).length ? `英文颜色选项: ${getShopifyOptionValues(product).join(' / ')}` : '',
    '',
    '[中文详情]',
    `详情主图数量: ${detail.detailImages.length}`,
    '',
    '[中文详情OCR]',
    ocrText || '未执行或未识别到有效文字。',
    '',
    '[技术规格]',
    specLines.length ? specLines.join('\n') : '未获取到技术规格。',
    '',
    '[英文补充]',
    product?.product_type ? `英文品类: ${product.product_type}` : '',
    shopifyText || 'No English description found.',
  ]
    .filter(Boolean)
    .join('\n');

  return sections.slice(0, 12000).trim();
}

async function loadShopifyCatalog(): Promise<ShopifyProduct[]> {
  const raw = await fetchText(SHOPIFY_CATALOG_URL, { 'accept-language': 'en-US,en;q=0.9' });
  const payload = JSON.parse(raw) as ShopifyCatalogResponse;
  return Array.isArray(payload.products) ? payload.products : [];
}

export async function runCrawler() {
  console.log('--- 启动 ZALO 官方站抓取任务 ---');
  console.log(`[列表] 顺序入口: ${TARGET_LISTS.map((item) => item.url).join(' | ')}`);

  const catalog = await loadShopifyCatalog();
  console.log(`[英文站] Shopify 产品目录: ${catalog.length} 条`);

  const uniqueItemMap = new Map<string, ListItem>();
  for (const target of TARGET_LISTS) {
    const html = await fetchText(target.url);
    const items = extractListItems(html, target.series);
    console.log(`[列表] ${target.series}: 解析到 ${items.length} 个产品卡片`);
    for (const item of items) {
      if (!uniqueItemMap.has(item.sourceUrl)) {
        uniqueItemMap.set(item.sourceUrl, item);
      }
    }
  }

  const listItems = Array.from(uniqueItemMap.values()).slice(0, MAX_ITEMS);
  console.log(`[列表] 去重后共 ${listItems.length} 个产品，抓取上限 ${MAX_ITEMS}`);

  if (listItems.length === 0) {
    throw new Error('ZALO 中文官网列表页未解析到任何商品。');
  }

  const bufferData: Array<Record<string, unknown>> = [];
  persistBuffer(bufferData);

  for (let index = 0; index < listItems.length; index += 1) {
    const item = listItems[index];
    console.log(`\n[详情] (${index + 1}/${listItems.length}) ${item.name} | ${item.sourceUrl}`);

    try {
      const detail = await fetchProductDetail(item);
      const match = findShopifyMatch(item, catalog);
      const priceUsd = getShopifyUsdPrice(match?.product || null);
      const shopifyImages = getShopifyImages(match?.product || null);
      const detailImages = uniqueStrings([...detail.detailImages, ...shopifyImages], 50);
      const detailOcrText = sanitizeRawDescriptionText(
        await orchestrateDetailOcr(detail.detailImages.slice(0, MAX_OCR_IMAGES), detail.title || item.name),
      );
      const genderHint = inferGender(
        `${item.name}\n${item.subtitle}\n${detail.specsText}\n${detailOcrText}\n${match?.product?.title || ''}\n${htmlToPlainText(match?.product?.body_html || '')}`,
      );
      const rawDescription = buildRawDescription(item, detail, match, priceUsd, detailOcrText);

      const record = {
        sourceUrl: item.sourceUrl,
        name: detail.title || item.name,
        subtitle: item.subtitle,
        series: item.series,
        price: priceUsd,
        priceUsd,
        priceCurrency: 'USD',
        coverImage: detailImages[0] || item.coverImage || '',
        genderHint,
        rawDescription,
        detailImageUrls: detailImages,
        shopifyHandle: match?.product?.handle || null,
        shopifyTitle: match?.product?.title || null,
        imagePlaceholder: 'bg-gradient-to-br from-zinc-900/50 to-emerald-900/30',
        isReviewed: false,
      };

      bufferData.push(record);
      persistBuffer(bufferData);

      console.log(
        `[抓取] 已写入缓冲: ${record.name} | priceUsd=${record.priceUsd ?? 'null'} | shopify=${record.shopifyHandle ?? 'unmatched'}`,
      );
      await sleep(600);
    } catch (error) {
      console.error(`[故障] 详情抓取失败: ${item.sourceUrl}`, error);
    }
  }

  console.log(`\n--- ZALO 官方站抓取结束，共写入 ${bufferData.length} 条 ---`);
  console.log(`[缓冲] ${BUFFER_PATH}`);

  try {
    await runCleaner();
  } catch (error) {
    console.error('[致命错误] cleaner 执行失败:', error);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCrawler().catch((error) => {
    console.error('[致命错误] ZALO 官方站抓取进程崩溃:', error);
  });
}
