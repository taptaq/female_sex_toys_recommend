import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runCleaner } from './cleaner.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'https://www.svakom.com.cn/';
const TARGET_LISTS = [
  {
    url: 'https://www.svakom.com.cn/index.php?route=product/category&path=168_169',
    categoryName: '女性',
    genderHint: 'female' as const,
  },
  {
    url: 'https://www.svakom.com.cn/index.php?route=product/category&path=168_170',
    categoryName: '男性',
    genderHint: 'male' as const,
  },
  {
    url: 'https://www.svakom.com.cn/index.php?route=product/category&path=168_171',
    categoryName: '夫妻共用',
    genderHint: 'unisex' as const,
  },
];
const MAX_ITEMS = Number(process.env.SVAKOM_OFFICIAL_MAX_ITEMS || '300');
const MAX_OCR_IMAGES = Number(process.env.SVAKOM_OFFICIAL_MAX_OCR_IMAGES || '8');
const BUFFER_PATH = path.resolve(__dirname, '../../data/svakom-official-review-buffer.json');

const REQUEST_HEADERS: HeadersInit = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
  pragma: 'no-cache',
  'cache-control': 'no-cache',
};

type GenderHint = 'female' | 'male' | 'unisex';

type ListSeed = {
  url: string;
  categoryName: string;
  genderHint: GenderHint;
};

type ListItem = {
  sourceUrl: string;
  productId: string;
  name: string;
  listDescription: string;
  coverImage: string;
  price: number | null;
  categories: string[];
  genderHint: GenderHint;
};

type ProductDetail = {
  title: string;
  brand: string;
  model: string;
  stock: string;
  price: number | null;
  galleryImages: string[];
  detailImages: string[];
  options: string[];
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

function resolveUrl(baseUrl: string, input: string): string {
  const value = decodeHtmlEntities(String(input || '').trim());
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

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: REQUEST_HEADERS,
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
      return null;
    }

    const contentType = String(response.headers.get('content-type') || '').trim().toLowerCase();
    if (!contentType.startsWith('image/')) {
      return null;
    }
    if (contentType === 'image/gif') {
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) return null;
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch {
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
  const candidateUrls = uniqueStrings(
    imageUrls
      .map((url) => String(url || '').trim())
      .filter(Boolean)
      .sort((left, right) => {
        const leftGif = /\.gif(?:[?#]|$)/i.test(left);
        const rightGif = /\.gif(?:[?#]|$)/i.test(right);
        if (leftGif === rightGif) return 0;
        return leftGif ? 1 : -1;
      }),
    40,
  );
  if (candidateUrls.length === 0) return '';

  console.log(`  [OCR] 开始处理详情长图: ${productName} | candidates=${candidateUrls.length}`);
  const imageInputs: string[] = [];
  let skippedCount = 0;
  for (const url of candidateUrls) {
    const input = await fetchImageAsDataUrl(url);
    if (input) {
      imageInputs.push(input);
      if (imageInputs.length >= MAX_OCR_IMAGES) break;
    } else {
      skippedCount += 1;
    }
  }

  if (imageInputs.length === 0) {
    console.log('  [OCR] 无可用图片输入，跳过视觉识别。');
    return '';
  }
  if (skippedCount > 0) {
    console.log(`  [OCR] 已跳过 ${skippedCount} 张失效/不支持的图片，实际送审 ${imageInputs.length} 张。`);
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

function mergeGenderHints(current: GenderHint, incoming: GenderHint): GenderHint {
  if (current === incoming) return current;
  if (current === 'unisex' || incoming === 'unisex') return 'unisex';
  return 'unisex';
}

function inferPageCount(html: string): number {
  const count = Number(html.match(/总计\s+\d+\s+\(共\s+(\d+)\s+页\)/)?.[1] || '1');
  return Number.isFinite(count) && count > 0 ? count : 1;
}

function appendPageParam(url: string, page: number): string {
  if (page <= 1) return url;
  const parsed = new URL(url);
  parsed.searchParams.set('page', String(page));
  return parsed.toString();
}

function extractListItems(html: string, seed: ListSeed): ListItem[] {
  const items: ListItem[] = [];
  const pattern =
    /<div class="product-thumb product-wrapper[\s\S]*?<div class="caption">([\s\S]*?)<\/div>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi;

  for (const match of html.matchAll(pattern)) {
    const block = match[0];
    const caption = match[1];
    const href =
      resolveUrl(BASE_URL, block.match(/<a href="([^"]+route=product\/product[^"]+)"/i)?.[1] || '') || '';
    const productId = href.match(/product_id=(\d+)/)?.[1] || '';
    const name = normalizeWhitespace(caption.match(/<h4 class="name"><a[^>]*>([\s\S]*?)<\/a><\/h4>/i)?.[1] || '');
    const listDescription = normalizeWhitespace(
      caption.match(/<p class="description">([\s\S]*?)<\/p>/i)?.[1] || '',
    );
    const price = parseNumber(caption.match(/<p class="price">([\s\S]*?)<\/p>/i)?.[1] || '');
    const coverImage =
      resolveUrl(
        BASE_URL,
        block.match(/<img[^>]+(?:data-src|src)="([^"]+)"[^>]*title=/i)?.[1] ||
          block.match(/style="background:\s*url\('([^']+)'\)/i)?.[1] ||
          '',
      ) || '';

    if (!href || !productId || !name) continue;

    items.push({
      sourceUrl: href,
      productId,
      name,
      listDescription,
      coverImage,
      price,
      categories: [seed.categoryName],
      genderHint: seed.genderHint,
    });
  }

  return items;
}

function extractProductDetail(html: string, fallback: ListItem): ProductDetail {
  const title =
    normalizeWhitespace(html.match(/<h1 class="heading-title"[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '') || fallback.name;
  const brand = normalizeWhitespace(html.match(/<li class="p-brand">品牌:\s*([\s\S]*?)<\/li>/i)?.[1] || '');
  const model = normalizeWhitespace(html.match(/<li class="p-model">型号:\s*([\s\S]*?)<\/li>/i)?.[1] || '');
  const stock = normalizeWhitespace(html.match(/<li class="p-stock">库存状态:\s*([\s\S]*?)<\/li>/i)?.[1] || '');
  const price =
    parseNumber(html.match(/<meta itemprop="price" content="([^"]+)"/i)?.[1] || '') ??
    parseNumber(html.match(/<li class="product-price">([\s\S]*?)<\/li>/i)?.[1] || '') ??
    fallback.price;
  const galleryImages = uniqueStrings(
    Array.from(html.matchAll(/<a class="swiper-slide"[^>]+(?:data-original|href)="([^"]+)"/gi)).map((item) =>
      resolveUrl(BASE_URL, item[1]),
    ),
    30,
  );
  const detailImages = uniqueStrings(
    Array.from(
      (
        html.match(/<div class="tab-pane tab-content active" id="tab-description">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i)?.[1] ||
        ''
      ).matchAll(/<img[^>]+src="([^"]+)"/gi),
    ).map((item) => resolveUrl(BASE_URL, item[1])),
    80,
  );

  const options = uniqueStrings(
    Array.from(html.matchAll(/<div class="radio">\s*<label>[\s\S]*?<\/label>\s*<\/div>/gi)).map((item) =>
      normalizeWhitespace(item[0]),
    ),
    20,
  );

  return {
    title,
    brand,
    model,
    stock,
    price,
    galleryImages,
    detailImages,
    options,
  };
}

function buildRawDescription(item: ListItem, detail: ProductDetail, ocrText: string): string {
  const sections = [
    '[基础信息]',
    `商品名: ${detail.title || item.name}`,
    detail.brand ? `品牌: ${detail.brand}` : '',
    detail.model ? `型号: ${detail.model}` : '',
    `分类: ${item.categories.join(' / ')}`,
    `性别提示: ${item.genderHint}`,
    detail.stock ? `库存状态: ${detail.stock}` : '',
    typeof detail.price === 'number' ? `页面价格(RMB): ${detail.price}` : '',
    item.listDescription ? `列表摘要: ${item.listDescription}` : '',
    detail.options.length ? `可选项: ${detail.options.join(' | ')}` : '',
    '',
    '[中文详情OCR]',
    ocrText || '未执行或未识别到有效文字。',
    '',
    '[页面图像信息]',
    `主图/画廊数量: ${detail.galleryImages.length}`,
    `详情长图数量: ${detail.detailImages.length}`,
  ]
    .filter(Boolean)
    .join('\n');

  return sections.slice(0, 12000).trim();
}

function persistBuffer(bufferData: unknown[]) {
  ensureDir(BUFFER_PATH);
  fs.writeFileSync(BUFFER_PATH, JSON.stringify(bufferData, null, 2));
}

async function crawlCategory(seed: ListSeed): Promise<ListItem[]> {
  const firstHtml = await fetchText(seed.url);
  const totalPages = inferPageCount(firstHtml);
  const items = extractListItems(firstHtml, seed);
  console.log(`[列表] ${seed.categoryName}: page 1/${totalPages} 命中 ${items.length} 个卡片`);

  for (let page = 2; page <= totalPages; page += 1) {
    const html = await fetchText(appendPageParam(seed.url, page));
    const pageItems = extractListItems(html, seed);
    console.log(`[列表] ${seed.categoryName}: page ${page}/${totalPages} 命中 ${pageItems.length} 个卡片`);
    items.push(...pageItems);
    await sleep(200);
  }

  return items;
}

export async function runCrawler() {
  console.log('--- 启动 SVAKOM 官方站抓取任务 ---');
  console.log(`[列表] 顺序入口: ${TARGET_LISTS.map((item) => item.url).join(' | ')}`);

  const uniqueItemMap = new Map<string, ListItem>();
  for (const seed of TARGET_LISTS) {
    const items = await crawlCategory(seed);
    for (const item of items) {
      const existing = uniqueItemMap.get(item.productId);
      if (!existing) {
        uniqueItemMap.set(item.productId, item);
        continue;
      }

      existing.categories = uniqueStrings([...existing.categories, ...item.categories], 6);
      existing.genderHint = mergeGenderHints(existing.genderHint, item.genderHint);
      existing.price = existing.price ?? item.price;
      if (!existing.coverImage && item.coverImage) existing.coverImage = item.coverImage;
      if (!existing.listDescription && item.listDescription) existing.listDescription = item.listDescription;
    }
  }

  const listItems = Array.from(uniqueItemMap.values()).slice(0, MAX_ITEMS);
  console.log(`[列表] 去重后共 ${listItems.length} 个产品，抓取上限 ${MAX_ITEMS}`);

  if (listItems.length === 0) {
    throw new Error('SVAKOM 官方站列表页未解析到任何商品。');
  }

  const bufferData: Array<Record<string, unknown>> = [];
  persistBuffer(bufferData);

  for (let index = 0; index < listItems.length; index += 1) {
    const item = listItems[index];
    console.log(`\n[详情] (${index + 1}/${listItems.length}) ${item.name} | ${item.sourceUrl}`);

    try {
      const html = await fetchText(item.sourceUrl);
      const detail = extractProductDetail(html, item);
      const detailOcrCandidates = uniqueStrings([...detail.detailImages, ...detail.galleryImages], 60);
      const detailOcrText = sanitizeRawDescriptionText(
        await orchestrateDetailOcr(detailOcrCandidates, detail.title || item.name),
      );
      const detailImageUrls = uniqueStrings([...detail.galleryImages, ...detail.detailImages], 100);
      const rawDescription = buildRawDescription(item, detail, detailOcrText);

      const record = {
        sourceUrl: item.sourceUrl,
        name: detail.title || item.name,
        price: detail.price ?? item.price ?? null,
        priceCurrency: 'CNY',
        coverImage: detailImageUrls[0] || item.coverImage || '',
        genderHint: item.genderHint,
        categories: item.categories,
        rawDescription,
        detailImageUrls,
        imagePlaceholder: 'bg-gradient-to-br from-zinc-900/50 to-red-900/30',
        isReviewed: false,
      };

      bufferData.push(record);
      persistBuffer(bufferData);

      console.log(
        `[抓取] 已写入缓冲: ${record.name} | price=${record.price ?? 'null'} RMB | images=${detailImageUrls.length}`,
      );
      await sleep(400);
    } catch (error) {
      console.error(`[故障] 详情抓取失败: ${item.sourceUrl}`, error);
    }
  }

  console.log(`\n--- SVAKOM 官方站抓取结束，共写入 ${bufferData.length} 条 ---`);
  console.log(`[缓冲] ${BUFFER_PATH}`);

  try {
    await runCleaner();
  } catch (error) {
    console.error('[致命错误] cleaner 执行失败:', error);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCrawler().catch((error) => {
    console.error('[致命错误] SVAKOM 官方站抓取进程崩溃:', error);
  });
}
