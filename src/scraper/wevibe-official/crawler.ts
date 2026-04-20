import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runCleaner } from './cleaner.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_URL = 'https://www.we-vibe.com/us/sex-toys';
const MAX_ITEMS = Number(process.env.WEVIBE_OFFICIAL_MAX_ITEMS || '60');
const BUFFER_PATH = path.resolve(__dirname, '../../data/wevibe-official-review-buffer.json');

const REQUEST_HEADERS: HeadersInit = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
  pragma: 'no-cache',
  'cache-control': 'no-cache',
};

type ListItem = {
  sourceUrl: string;
  name: string;
  priceUsd: number | null;
  coverImage?: string;
  genderHint: 'male' | 'female' | 'unisex';
  stock?: string;
  categoryHints: string[];
  listPosition: number | null;
  sku?: string;
};

type ProductDetail = {
  title: string;
  coverImage: string;
  galleryImages: string[];
  shortType: string;
  description: string;
  metaDescription: string;
  priceUsd: number | null;
  colors: string[];
  skuList: string[];
  imageCaptions: string[];
  appSupport: boolean;
};

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

function parseNumber(value: unknown): number | null {
  const numeric = Number(String(value ?? '').replace(/[^\d.]+/g, ''));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function uniqueStrings(values: Array<string | null | undefined>, limit = 50): string[] {
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

function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of tag.matchAll(/([:@\w-]+)\s*=\s*"([^"]*)"/g)) {
    attrs[match[1]] = decodeHtmlEntities(match[2]);
  }
  return attrs;
}

function splitCategoryHints(value: string): string[] {
  return uniqueStrings(
    decodeHtmlEntities(value)
      .replace(/<br\s*\/?>/gi, '|')
      .split('|')
      .map((segment) => segment.trim()),
    20,
  );
}

function inferGender(name: string, categoryHints: string[]): 'male' | 'female' | 'unisex' {
  const source = `${name}\n${categoryHints.join('\n')}`.toLowerCase();
  const hasCoupleHint = [
    'couples',
    'partner',
    'all sex toys for couples',
    'worn during sex',
    'long-distance',
    'remote-controlled',
  ].some((hint) => source.includes(hint));
  if (hasCoupleHint) return 'unisex';

  const femaleHints = [
    'for her',
    'clitoral',
    'g-spot',
    'rabbit',
    'panty',
    'wearable vibrator',
    'vaginal',
    'bullet vibrator',
    'wand massager',
    'air suction',
  ].some((hint) => source.includes(hint));
  const maleHints = [
    'for him',
    'penis',
    'cock ring',
    'prostate',
    'male',
    'anal plug',
    'masturbator',
    'verge',
    'pivot',
    'vector',
  ].some((hint) => source.includes(hint));

  if (femaleHints && maleHints) return 'unisex';
  if (femaleHints) return 'female';
  if (maleHints) return 'male';
  return 'unisex';
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, { headers: REQUEST_HEADERS, redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching ${url}`);
  }
  return await response.text();
}

function extractListItems(html: string): ListItem[] {
  const items: ListItem[] = [];
  const seen = new Set<string>();

  for (const match of html.matchAll(/<a\b[^>]*class="[^"]*product-item-photo[^"]*"[^>]*>/gi)) {
    const tag = match[0];
    const attrs = parseAttributes(tag);
    const href = attrs.href || '';
    const name = normalizeWhitespace(attrs['data-name'] || '');
    if (!href || !name || !href.startsWith('https://www.we-vibe.com/us/')) continue;
    if (seen.has(href)) continue;
    seen.add(href);

    const categoryHints = splitCategoryHints(attrs['data-category'] || '');
    items.push({
      sourceUrl: href,
      name,
      priceUsd: parseNumber(attrs['data-price']),
      genderHint: inferGender(name, categoryHints),
      stock: normalizeWhitespace(attrs['data-dimension10'] || ''),
      categoryHints,
      listPosition: parseNumber(attrs['data-position']),
      sku: normalizeWhitespace(attrs['data-id'] || ''),
    });
  }

  return items;
}

function extractBalancedJsonAfterMarker(source: string, marker: string): string | null {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) return null;
  const start = source.indexOf('{', markerIndex + marker.length);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  return null;
}

function extractJsonLdProduct(html: string): Record<string, unknown> | null {
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed && typeof parsed === 'object' && (parsed['@type'] === 'Product' || parsed.type === 'Product')) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function extractMetaContent(html: string, key: string): string {
  const match = html.match(new RegExp(`<meta[^>]+(?:property|name)="${key}"[^>]+content="([^"]*)"`, 'i'));
  return normalizeWhitespace(match?.[1] || '');
}

function extractBlockValue(html: string, blockClassFragment: string, valuePattern = 'div class="value[^"]*"[^>]*>([\\s\\S]*?)<\\/div>'): string {
  const blockRegex = new RegExp(
    `<div class="[^"]*${blockClassFragment}[^"]*"[^>]*>[\\s\\S]*?${valuePattern}`,
    'i',
  );
  const match = html.match(blockRegex);
  return normalizeWhitespace(match?.[1] || '');
}

function extractDetail(html: string, fallback: ListItem): ProductDetail {
  const jsonLd = extractJsonLdProduct(html);
  const jsonConfigRaw = extractBalancedJsonAfterMarker(html, '"jsonConfig":');
  let jsonConfig: any = null;
  if (jsonConfigRaw) {
    try {
      jsonConfig = JSON.parse(jsonConfigRaw);
    } catch {
      jsonConfig = null;
    }
  }

  const title =
    normalizeWhitespace(String(jsonLd?.name || '')) ||
    normalizeWhitespace(html.match(/<span class="base"[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '') ||
    fallback.name;
  const shortType =
    extractBlockValue(html, 'product__attribute short_description') ||
    normalizeWhitespace(String(jsonLd?.category || ''));
  const description =
    extractBlockValue(html, 'product__attribute description', 'itemprop="description"[^>]*>([\\s\\S]*?)<\\/div>') ||
    normalizeWhitespace(String(jsonLd?.description || '')) ||
    extractMetaContent(html, 'description');
  const metaDescription = extractMetaContent(html, 'description');

  const galleryImages = uniqueStrings([
    extractMetaContent(html, 'og:image'),
    normalizeWhitespace(String(jsonLd?.image || '')),
    normalizeWhitespace(
      html.match(/class="gallery-placeholder__image"[^>]+(?:src|data-src)="([^"]+)"/i)?.[1] || '',
    ),
    ...Object.values(jsonConfig?.images || {})
      .flatMap((items: any) => (Array.isArray(items) ? items : []))
      .flatMap((item: any) => [item?.full, item?.img, item?.thumb]),
  ], 30);

  const imageCaptions = uniqueStrings(
    Object.values(jsonConfig?.images || {})
      .flatMap((items: any) => (Array.isArray(items) ? items : []))
      .map((item: any) => item?.caption),
    20,
  );

  const colors = uniqueStrings(
    Object.values(jsonConfig?.attributes || {})
      .flatMap((attribute: any) => (Array.isArray(attribute?.options) ? attribute.options : []))
      .map((option: any) => option?.label),
    12,
  );

  const skuList = uniqueStrings([
    normalizeWhitespace(String(jsonLd?.sku || '')),
    ...Object.values(jsonConfig?.sku || {}).map((value) => String(value || '')),
  ], 10);

  const priceUsd =
    parseNumber((jsonLd?.offers as Record<string, unknown> | undefined)?.price) ||
    parseNumber(jsonConfig?.prices?.finalPrice?.amount) ||
    parseNumber(html.match(/data-price-amount="([^"]+)"/i)?.[1]) ||
    fallback.priceUsd;

  return {
    title,
    coverImage: galleryImages[0] || fallback.coverImage || '',
    galleryImages,
    shortType,
    description,
    metaDescription,
    priceUsd,
    colors,
    skuList,
    imageCaptions,
    appSupport: /class="app-badge-label"|https:\/\/www\.we-vibe\.com\/app/i.test(html),
  };
}

function buildRawDescription(item: ListItem, detail: ProductDetail): string {
  const sections = [
    '[基础信息]',
    `商品名: ${detail.title || item.name}`,
    detail.shortType ? `产品类型: ${detail.shortType}` : '',
    detail.priceUsd ? `页面价格(USD): ${detail.priceUsd}` : '',
    item.stock ? `库存状态: ${item.stock}` : '',
    detail.skuList.length ? `SKU: ${detail.skuList.join(' / ')}` : '',
    detail.colors.length ? `颜色选项: ${detail.colors.join(' / ')}` : '',
    item.categoryHints.length ? `站内分类提示: ${item.categoryHints.join(' | ')}` : '',
    `性别提示: ${item.genderHint}`,
    `APP支持: ${detail.appSupport ? 'Yes' : 'No'}`,
    '',
    '[英文详情]',
    detail.description || detail.metaDescription || 'No description found.',
    '',
    detail.imageCaptions.length ? '[图片文案]' : '',
    detail.imageCaptions.join('\n'),
  ]
    .filter(Boolean)
    .join('\n');

  return sections.slice(0, 12000).trim();
}

function persistBuffer(bufferData: unknown[]) {
  ensureDir(BUFFER_PATH);
  fs.writeFileSync(BUFFER_PATH, JSON.stringify(bufferData, null, 2));
}

async function runCrawler() {
  console.log('--- 启动 We-Vibe 官方站抓取任务 ---');
  console.log(`[列表] 入口: ${TARGET_URL}`);

  const listHtml = await fetchHtml(TARGET_URL);
  const listItems = extractListItems(listHtml);
  console.log(`[列表] 原始商品卡片数: ${listItems.length}`);

  if (listItems.length === 0) {
    throw new Error('官方站列表页未解析到任何商品卡片。');
  }

  const targetItems = listItems.slice(0, MAX_ITEMS);
  console.log(`[列表] 本轮抓取上限: ${MAX_ITEMS}，实际处理: ${targetItems.length}`);

  const bufferData: Array<Record<string, unknown>> = [];
  persistBuffer(bufferData);

  for (let index = 0; index < targetItems.length; index += 1) {
    const item = targetItems[index];
    console.log(`\n[详情] (${index + 1}/${targetItems.length}) ${item.name}`);
    console.log(`[详情] URL: ${item.sourceUrl}`);

    try {
      const detailHtml = await fetchHtml(item.sourceUrl);
      const detail = extractDetail(detailHtml, item);
      const rawDescription = buildRawDescription(item, detail);

      const record = {
        sourceUrl: item.sourceUrl,
        name: detail.title || item.name,
        price: detail.priceUsd ?? item.priceUsd ?? null,
        priceUsd: detail.priceUsd ?? item.priceUsd ?? null,
        priceCurrency: 'USD',
        coverImage: detail.coverImage || item.coverImage || '',
        genderHint: item.genderHint,
        rawDescription,
        detailImageUrls: detail.galleryImages,
        imagePlaceholder: 'bg-gradient-to-br from-slate-900/40 to-rose-900/30',
        isReviewed: false,
      };

      bufferData.push(record);
      persistBuffer(bufferData);

      console.log(
        `[抓取] 已写入缓冲: ${record.name} | priceUsd=${record.priceUsd ?? 'null'} | images=${detail.galleryImages.length}`,
      );
      await sleep(800);
    } catch (error) {
      console.error(`[故障] 详情抓取失败: ${item.sourceUrl}`, error);
    }
  }

  console.log(`\n--- We-Vibe 官方站抓取结束，共写入 ${bufferData.length} 条 ---`);
  console.log(`[缓冲] ${BUFFER_PATH}`);

  try {
    await runCleaner();
  } catch (error) {
    console.error('[致命错误] cleaner 执行失败:', error);
  }
}

runCrawler().catch((error) => {
  console.error('[致命错误] 官方站抓取进程崩溃:', error);
});
