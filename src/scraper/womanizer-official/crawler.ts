import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { runCleaner } from './cleaner.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ORIGIN = 'https://www.womanizer.com';
export const LIST_URL = `${ORIGIN}/us/sex-toys`;
export const MAX_ITEMS = Number(process.env.WOMANIZER_OFFICIAL_MAX_ITEMS || '200');
export const BUFFER_PATH = path.resolve(__dirname, '../../data/womanizer-official-review-buffer.json');

const REQUEST_HEADERS: Record<string, string> = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
  pragma: 'no-cache',
  'cache-control': 'no-cache',
};

type GenderHint = 'male' | 'female' | 'unisex';

export type ListItem = {
  sourceUrl: string;
  name: string;
  subtitle: string;
  coverImage: string;
  priceUsd: number | null;
  originalPriceUsd: number | null;
  genderHint: GenderHint;
  stock: string;
  categoryHints: string[];
  listPosition: number | null;
  productId: string;
  sku: string;
};

export type ProductDetail = {
  title: string;
  subtitle: string;
  metaTitle: string;
  metaDescription: string;
  priceUsd: number | null;
  originalPriceUsd: number | null;
  priceCurrency: string;
  stock: string;
  coverImage: string;
  galleryImages: string[];
  featureHeadlines: string[];
  featureBullets: string[];
  inTheBox: string[];
  specPairs: Array<{ key: string; value: string }>;
  manualUrl: string;
  productCode: string;
  variantSkus: string[];
  brand: string;
  rawDescription: string;
};

type ImpressionItem = {
  url: string;
  price: number | null;
  originalPrice: number | null;
  stock: string;
  categoryHints: string[];
  position: number | null;
};

type BrowserSession = {
  browser: Browser;
  context: BrowserContext;
  page: Page;
};

type PlaywrightFetchOptions = {
  referer?: string;
  session?: BrowserSession | null;
};

type FetchHtmlOptions = PlaywrightFetchOptions & {
  preferBrowserSession?: boolean;
};

type FetchLike = (
  input: string | URL | globalThis.Request,
  init?: RequestInit,
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

type FetchHtmlDeps = {
  fetchImpl: FetchLike;
  curlRunner: (url: string, referer: string) => string;
  playwrightFetcher: (url: string, options: PlaywrightFetchOptions) => Promise<string>;
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

function parseNumber(value: unknown): number | null {
  const numeric = Number(String(value ?? '').replace(/[^\d.]+/g, ''));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of tag.matchAll(/([:@\w-]+)\s*=\s*"([^"]*)"/g)) {
    attrs[match[1]] = decodeHtmlEntities(match[2]);
  }
  return attrs;
}

export function resolveUrl(input: string): string {
  const value = String(input || '').trim();
  if (!value) return '';
  try {
    const url = new URL(value, ORIGIN);
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

function parseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function extractBalancedChunkAfterMarker(source: string, marker: string, openingChar: '{' | '['): string | null {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) return null;

  const start = source.indexOf(openingChar, markerIndex + marker.length);
  if (start === -1) return null;

  const closingChar = openingChar === '{' ? '}' : ']';
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
    if (char === openingChar) depth += 1;
    if (char === closingChar) {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }

  return null;
}

function extractJsonLdProduct(html: string): Record<string, unknown> | null {
  for (const match of html.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/gi)) {
    const parsed = parseJson<unknown>(decodeHtmlEntities(match[1]));
    if (!parsed) continue;

    if (Array.isArray(parsed)) {
      const product = parsed.find(
        (item) =>
          item &&
          typeof item === 'object' &&
          (String((item as Record<string, unknown>)['@type'] || '').toLowerCase() === 'product'),
      );
      if (product && typeof product === 'object') return product as Record<string, unknown>;
      continue;
    }

    if (typeof parsed === 'object' && String((parsed as Record<string, unknown>)['@type'] || '').toLowerCase() === 'product') {
      return parsed as Record<string, unknown>;
    }
  }

  return null;
}

function extractMetaContent(html: string, key: string): string {
  const match = html.match(new RegExp(`<meta[^>]+(?:property|name)="${key}"[^>]+content="([^"]*)"`, 'i'));
  return normalizeWhitespace(match?.[1] || '');
}

function extractVisibleValueBlock(html: string, classFragment: string): string {
  const escaped = classFragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const visible = html.match(
    new RegExp(
      `<div[^>]+class="[^"]*${escaped}[^"]*"[^>]*>[\\s\\S]*?<div[^>]+class="[^"]*value[^"]*"(?:(?!style="display:\\s*none").)*>([\\s\\S]*?)<\\/div>`,
      'i',
    ),
  );
  if (visible?.[1]) return normalizeWhitespace(visible[1]);

  const first = html.match(
    new RegExp(`<div[^>]+class="[^"]*${escaped}[^"]*"[^>]*>[\\s\\S]*?<div[^>]+class="[^"]*value[^"]*"[^>]*>([\\s\\S]*?)<\\/div>`, 'i'),
  );
  return normalizeWhitespace(first?.[1] || '');
}

function extractSelectedOptionValue(jsonConfig: Record<string, unknown>): string {
  const attributes = jsonConfig.attributes as Record<string, unknown> | undefined;
  if (!attributes) return 'parent';

  for (const attribute of Object.values(attributes)) {
    if (!attribute || typeof attribute !== 'object') continue;
    const config = attribute as Record<string, unknown>;
    const activeOptionId = String(config.active_option_id || '').trim();
    const options = Array.isArray(config.options) ? (config.options as Array<Record<string, unknown>>) : [];
    const matchingOption = options.find((option) => String(option.id || '') === activeOptionId);
    if (matchingOption) return `${config.id}_${activeOptionId}`;

    const firstOptionId = String(options[0]?.id || '').trim();
    if (firstOptionId) return `${config.id}_${firstOptionId}`;
  }

  return 'parent';
}

function extractSelectedProductKey(jsonConfig: Record<string, unknown>): string {
  const attributes = jsonConfig.attributes as Record<string, unknown> | undefined;
  if (attributes) {
    for (const attribute of Object.values(attributes)) {
      if (!attribute || typeof attribute !== 'object') continue;
      const config = attribute as Record<string, unknown>;
      const activeOptionId = String(config.active_option_id || '').trim();
      const options = Array.isArray(config.options) ? (config.options as Array<Record<string, unknown>>) : [];
      const matchingOption = options.find((option) => String(option.id || '') === activeOptionId);
      const products = Array.isArray(matchingOption?.products) ? matchingOption.products : [];
      const productKey = String(products[0] || '').trim();
      if (productKey) return productKey;

      const firstProductKey = String((Array.isArray(options[0]?.products) ? options[0]?.products[0] : '') || '').trim();
      if (firstProductKey) return firstProductKey;
    }
  }

  const imageMap = jsonConfig.images as Record<string, unknown> | undefined;
  const fallbackKey = Object.keys(imageMap || {})[0];
  return String(fallbackKey || '').trim();
}

function extractSwatchJsonConfig(html: string): Record<string, unknown> {
  const jsonConfigChunk = extractBalancedChunkAfterMarker(html, '"jsonConfig":', '{');
  return parseJson<Record<string, unknown>>(jsonConfigChunk || '') || {};
}

function extractGalleryImagesFromJsonConfig(jsonConfig: Record<string, unknown>): string[] {
  const productKey = extractSelectedProductKey(jsonConfig);
  const imageMap = jsonConfig.images as Record<string, Array<Record<string, unknown>>> | undefined;
  const currentImages = Array.isArray(imageMap?.[productKey]) ? imageMap?.[productKey] : [];

  const candidates = currentImages.map((image) => String(image.full || image.img || image.thumb || ''));

  return uniqueStrings(candidates.map(resolveUrl), 30);
}

function extractVariantSkus(jsonConfig: Record<string, unknown>): string[] {
  const skuMap = jsonConfig.sku as Record<string, unknown> | undefined;
  return uniqueStrings(Object.values(skuMap || {}).map((value) => String(value || '').trim()), 40);
}

function extractProductIdFromUrl(url: string): string {
  try {
    return new URL(url).pathname.replace(/^\/+|\/+$/g, '').split('/').pop() || '';
  } catch {
    return '';
  }
}

function inferBrand(text: string): string {
  const value = String(text || '').toLowerCase();
  if (value.includes('we-vibe')) return 'We-Vibe';
  if (value.includes('arcwave')) return 'Arcwave';
  return 'Womanizer';
}

function inferGender(name: string, subtitle: string, categoryHints: string[]): GenderHint {
  const source = `${name}\n${subtitle}\n${categoryHints.join('\n')}`.toLowerCase();
  if (
    [
      'couples',
      'partner',
      'shared',
      'remote',
      'we-vibe',
      'sync',
      'chorus',
      'moxie',
      'couple',
      'dual stimulation',
    ].some((hint) => source.includes(hint))
  ) {
    return 'unisex';
  }
  if (
    [
      'arcwave',
      'stroker',
      'prostate',
      'male',
      'for him',
      'masturbator',
      'penis',
      'cock ring',
    ].some((hint) => source.includes(hint))
  ) {
    return 'male';
  }
  if (
    [
      'clitoral',
      'g-spot',
      'rabbit',
      'pleasure air',
      'vaginal',
      'for her',
      'womanizer',
      'dual stimulator',
      'clit',
    ].some((hint) => source.includes(hint))
  ) {
    return 'female';
  }
  return 'unisex';
}

function inferCategoryHints(text: string): string[] {
  const value = String(text || '').toLowerCase();
  const hints: string[] = [];
  if (value.includes('sex toys')) hints.push('Sex Toys');
  if (value.includes('clitoral')) hints.push('clitoral stimulation');
  if (value.includes('g-spot')) hints.push('g-spot stimulation');
  if (value.includes('dual')) hints.push('dual stimulation');
  if (value.includes('pleasure air')) hints.push('pleasure air');
  if (value.includes('3d pleasure air')) hints.push('3d pleasure air');
  if (value.includes('water')) hints.push('water stimulation');
  if (value.includes('stroker')) hints.push('male toy');
  if (value.includes('we-vibe')) hints.push('couples toy');
  return uniqueStrings(hints, 12);
}

function parseFeatureItems(html: string, optionValue: string): Array<{ title: string; text: string }> {
  const optionBlock =
    html.match(new RegExp(`<ul[^>]+data-option="${optionValue}"[^>]+class="[^"]*product-features__list[^"]*"[^>]*>([\\s\\S]*?)<\\/ul>`, 'i'))?.[1] ||
    html.match(/<ul[^>]+data-option="parent"[^>]+class="[^"]*product-features__list[^"]*"[^>]*>([\s\S]*?)<\/ul>/i)?.[1] ||
    html.match(/<ul[^>]+class="[^"]*product-features__list[^"]*"[^>]*>([\s\S]*?)<\/ul>/i)?.[1] ||
    '';

  const items = [];
  for (const match of optionBlock.matchAll(
    /<li[^>]+class="[^"]*product-features__item[^"]*"[^>]*>[\s\S]*?<div[^>]+class="[^"]*product-features__title[^"]*"[^>]*>([\s\S]*?)<\/div>[\s\S]*?<p[^>]+class="[^"]*product-features__text[^"]*"[^>]*>([\s\S]*?)<\/p>[\s\S]*?<\/li>/gi,
  )) {
    const title = normalizeWhitespace(match[1]);
    const text = normalizeWhitespace(match[2]);
    if (!title && !text) continue;
    items.push({ title, text });
  }
  return items;
}

function parseInTheBox(html: string, optionValue: string): string[] {
  const optionBlock =
    html.match(new RegExp(`<div(?=[^>]*product-in-the-box__list)(?=[^>]*data-option="${optionValue}")([^>]*)>[\\s\\S]*?<ul>([\\s\\S]*?)<\\/ul>`, 'i'))?.[2] ||
    html.match(/<div(?=[^>]*product-in-the-box__list)(?=[^>]*data-option="parent")([^>]*)>[\s\S]*?<ul>([\s\S]*?)<\/ul>/i)?.[2] ||
    '';

  return uniqueStrings(
    Array.from(optionBlock.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)).map((match) => normalizeWhitespace(match[1])),
    30,
  );
}

function parseSpecPairs(html: string, optionValue: string): Array<{ key: string; value: string }> {
  const optionBlock =
    html.match(new RegExp(`<div(?=[^>]*product-tabs--specification-list)(?=[^>]*data-option="${optionValue}")([^>]*)>[\\s\\S]*?<ul[^>]+class="[^"]*specification__list[^"]*"[^>]*>([\\s\\S]*?)<\\/ul>`, 'i'))?.[2] ||
    html.match(/<div(?=[^>]*product-tabs--specification-list)(?=[^>]*data-option="parent")([^>]*)>[\s\S]*?<ul[^>]+class="[^"]*specification__list[^"]*"[^>]*>([\s\S]*?)<\/ul>/i)?.[2] ||
    '';

  const items: Array<{ key: string; value: string }> = [];
  for (const match of optionBlock.matchAll(
    /<li[^>]+class="[^"]*specification__item[^"]*"[^>]*>[\s\S]*?<span[^>]+class="[^"]*label[^"]*"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<span[^>]+class="[^"]*data[^"]*"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<\/li>/gi,
  )) {
    const key = normalizeWhitespace(match[1]);
    const value = normalizeWhitespace(match[2]);
    if (!key || !value) continue;
    items.push({ key, value });
  }
  return items;
}

function extractManualUrl(block: string): string {
  const href = block.match(/<a[^>]+href="([^"]+)"[^>]*>\s*<span>\s*Online Manual\s*<\/span>/i)?.[1] || '';
  return resolveUrl(href);
}

function buildRawDescription(detail: {
  title: string;
  brand: string;
  subtitle: string;
  metaDescription: string;
  priceUsd: number | null;
  priceCurrency: string;
  stock: string;
  sourceUrl: string;
  featureItems: Array<{ title: string; text: string }>;
  inTheBox: string[];
  specPairs: Array<{ key: string; value: string }>;
  manualUrl: string;
}): string {
  const featureHeadlines = detail.featureItems.map((item) => item.title).filter(Boolean).join(' | ');
  const featureDetails = detail.featureItems
    .map((item) => `${item.title}: ${item.text}`)
    .filter(Boolean)
    .join('\n');
  const specs = detail.specPairs.map((item) => `${item.key}: ${item.value}`).join('\n');
  const boxItems = detail.inTheBox.join(' | ');

  return normalizeWhitespace(`
[基础信息]
商品名: ${detail.title}
品牌: ${detail.brand}
副标题: ${detail.subtitle}
页面标题: ${detail.title}
页面简介: ${detail.metaDescription}
链接: ${detail.sourceUrl}
库存: ${detail.stock}
价格: ${detail.priceCurrency} ${detail.priceUsd ?? ''}

[卖点摘要]
卖点摘要: ${featureHeadlines}

[卖点详情]
${featureDetails}

[包装清单]
包装清单: ${boxItems}

[规格参数]
规格: ${specs}

[手册]
手册: ${detail.manualUrl}
  `);
}

function extractImpressionItems(html: string): Map<string, ImpressionItem> {
  const result = new Map<string, ImpressionItem>();
  const dataLayerChunk = extractBalancedChunkAfterMarker(html, '"dataLayer":', '{');
  const dataLayer = parseJson<Record<string, unknown>>(dataLayerChunk || '');
  const ecommerce = dataLayer?.ecommerce as Record<string, unknown> | undefined;
  const items = Array.isArray(ecommerce?.items) ? (ecommerce.items as Array<Record<string, unknown>>) : [];

  for (const item of items) {
    const url = resolveUrl(String(item.item_url || ''));
    if (!url) continue;
    result.set(url, {
      url,
      price: parseNumber(item.price),
      originalPrice: parseNumber(item.price_before_discount),
      stock: normalizeWhitespace(String(item.item_stock || '')),
      categoryHints: uniqueStrings(
        String(item.item_category || '')
          .split('|')
          .map((segment) => normalizeWhitespace(segment)),
        20,
      ),
      position: parseNumber(item.index),
    });
  }

  return result;
}

export function extractListItems(html: string): ListItem[] {
  const items: ListItem[] = [];
  const impressionItems = extractImpressionItems(html);

  for (const match of html.matchAll(/<li class="product product-item [\s\S]*?<\/li>/gi)) {
    const block = match[0];
    const photoTag = block.match(/<a[^>]+class="[^"]*product-item-photo[^"]*"[^>]*>/i)?.[0] || '';
    if (!photoTag) continue;

    const photoAttrs = parseAttributes(photoTag);
    const sourceUrl = resolveUrl(photoAttrs.href || '');
    if (!sourceUrl.startsWith(`${ORIGIN}/us/`)) continue;

    const impression = impressionItems.get(sourceUrl);
    const imgTag = block.match(/<img[^>]+class="[^"]*product-image-photo[^"]*"[^>]*>/i)?.[0] || '';
    const imgAttrs = parseAttributes(imgTag);
    const name =
      normalizeWhitespace(block.match(/<a[^>]+class="[^"]*product__link[^"]*"[^>]*>([\s\S]*?)<\/a>/i)?.[1] || '') ||
      normalizeWhitespace(photoAttrs['data-name'] || '');
    const subtitle =
      normalizeWhitespace(block.match(/<div[^>]+class="[^"]*product__description[^"]*"[^>]*>[\s\S]*?<span>([\s\S]*?)<span>/i)?.[1] || '') ||
      normalizeWhitespace(impression?.categoryHints.join(' | ') || '');
    const finalPrice =
      parseNumber(block.match(/id="product-price-[^"]+"[^>]+data-price-amount="([^"]+)"/i)?.[1]) ||
      parseNumber(photoAttrs['data-price']) ||
      impression?.price ||
      null;
    const oldPrice =
      parseNumber(block.match(/id="old-price-[^"]+"[^>]+data-price-amount="([^"]+)"/i)?.[1]) ||
      impression?.originalPrice ||
      null;
    const stock =
      normalizeWhitespace(photoAttrs['data-dimension10'] || '') ||
      normalizeWhitespace(block.match(/<div[^>]+class="[^"]*stock[^"]*"[^>]*>\s*<span>([\s\S]*?)<\/span>/i)?.[1] || '') ||
      impression?.stock ||
      '';
    const categoryHints = uniqueStrings(
      [
        normalizeWhitespace(photoAttrs['data-category'] || ''),
        ...(impression?.categoryHints || []),
        ...inferCategoryHints(`${name}\n${subtitle}`),
      ],
      20,
    );
    const productId =
      normalizeWhitespace(block.match(/data-product-id="([^"]+)"/i)?.[1] || '') ||
      extractProductIdFromUrl(sourceUrl);

    items.push({
      sourceUrl,
      name,
      subtitle,
      coverImage: resolveUrl(imgAttrs['data-src'] || imgAttrs.src || ''),
      priceUsd: finalPrice,
      originalPriceUsd: oldPrice && finalPrice && oldPrice > finalPrice ? oldPrice : null,
      genderHint: inferGender(name, subtitle, categoryHints),
      stock,
      categoryHints,
      listPosition: parseNumber(photoAttrs['data-position']) || impression?.position || null,
      productId,
      sku: normalizeWhitespace(photoAttrs['data-simple-id'] || photoAttrs['data-id'] || ''),
    });
  }

  return items;
}

export function mergeUniqueListItems(items: ListItem[]): ListItem[] {
  const byUrl = new Map<string, ListItem>();

  for (const item of items) {
    const url = resolveUrl(item.sourceUrl);
    if (!url) continue;

    const existing = byUrl.get(url);
    if (!existing) {
      byUrl.set(url, { ...item, sourceUrl: url, categoryHints: uniqueStrings(item.categoryHints, 20) });
      continue;
    }

    const keepCurrent =
      Number(item.listPosition ?? Number.POSITIVE_INFINITY) < Number(existing.listPosition ?? Number.POSITIVE_INFINITY);
    const preferred = keepCurrent ? item : existing;
    const merged: ListItem = {
      ...preferred,
      sourceUrl: url,
      subtitle: preferred.subtitle || existing.subtitle || item.subtitle,
      coverImage: preferred.coverImage || existing.coverImage || item.coverImage,
      priceUsd: preferred.priceUsd ?? existing.priceUsd ?? item.priceUsd,
      originalPriceUsd: preferred.originalPriceUsd ?? existing.originalPriceUsd ?? item.originalPriceUsd,
      stock: preferred.stock || existing.stock || item.stock,
      productId: preferred.productId || existing.productId || item.productId,
      sku: preferred.sku || existing.sku || item.sku,
      categoryHints: uniqueStrings([...(existing.categoryHints || []), ...(item.categoryHints || [])], 20),
    };
    byUrl.set(url, merged);
  }

  return Array.from(byUrl.values()).sort((a, b) => Number(a.listPosition || 0) - Number(b.listPosition || 0));
}

export function extractProductDetail(html: string, sourceUrl: string): ProductDetail {
  const productJson = extractJsonLdProduct(html);
  const swatchJsonConfig = extractSwatchJsonConfig(html);
  const optionValue = extractSelectedOptionValue(swatchJsonConfig);

  const title =
    normalizeWhitespace(html.match(/<h1[^>]+class="[^"]*page-title[^"]*"[^>]*>[\s\S]*?<span[^>]+class="[^"]*base[^"]*"[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '') ||
    normalizeWhitespace(String(productJson?.name || ''));
  const subtitle =
    normalizeWhitespace(
      html.match(
        /<div[^>]+class="[^"]*info__type product__attribute short_description[^"]*"[^>]*>[\s\S]*?<div[^>]+class="[^"]*value[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      )?.[1] || '',
    ) || extractVisibleValueBlock(html, 'info__type product__attribute short_description');
  const metaTitle = normalizeWhitespace(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || title);
  const metaDescription =
    extractMetaContent(html, 'description') ||
    extractMetaContent(html, 'og:description') ||
    normalizeWhitespace(String(productJson?.description || ''));
  const priceUsd =
    parseNumber(extractMetaContent(html, 'product:price:amount')) ||
    parseNumber(
      String(
        (productJson?.offers as Record<string, unknown> | undefined)?.price ||
          html.match(/<meta itemprop="price" content="([^"]+)"/i)?.[1] ||
          html.match(/id="product-price-[^"]+"[^>]+data-price-amount="([^"]+)"/i)?.[1] ||
          '',
      ),
    ) ||
    parseNumber(((swatchJsonConfig.prices as Record<string, unknown> | undefined)?.finalPrice as Record<string, unknown> | undefined)?.amount) ||
    null;
  const originalPriceUsd =
    parseNumber(html.match(/id="old-price-[^"]+"[^>]+data-price-amount="([^"]+)"/i)?.[1] || '') ||
    parseNumber(((swatchJsonConfig.prices as Record<string, unknown> | undefined)?.oldPrice as Record<string, unknown> | undefined)?.amount) ||
    null;
  const priceCurrency =
    extractMetaContent(html, 'product:price:currency') ||
    normalizeWhitespace(String((productJson?.offers as Record<string, unknown> | undefined)?.priceCurrency || 'USD')) ||
    'USD';
  const stock = normalizeWhitespace(html.match(/<div[^>]+class="[^"]*stock available[^"]*"[^>]*>\s*<span>([\s\S]*?)<\/span>/i)?.[1] || 'In stock');

  const galleryImages = extractGalleryImagesFromJsonConfig(swatchJsonConfig);
  const featureItems = parseFeatureItems(html, optionValue);
  const featureHeadlines = uniqueStrings(featureItems.map((item) => item.title), 20);
  const featureBullets = uniqueStrings(featureItems.map((item) => `${item.title}: ${item.text}`), 20);
  const inTheBox = parseInTheBox(html, optionValue);
  const specPairs = parseSpecPairs(html, optionValue);
  const manualUrl = extractManualUrl(html);
  const productCode =
    normalizeWhitespace(html.match(/<div[^>]+class="[^"]*info__sku[^"]*"[^>]*>[\s\S]*?<div[^>]+class="[^"]*value[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || '') ||
    normalizeWhitespace(String(productJson?.sku || ''));
  const variantSkus = extractVariantSkus(swatchJsonConfig);
  const coverImage = resolveUrl(
    galleryImages[0] ||
      String(productJson?.image || '') ||
      extractMetaContent(html, 'og:image'),
  );
  const brand = inferBrand(`${title}\n${subtitle}\n${sourceUrl}`);

  return {
    title,
    subtitle,
    metaTitle,
    metaDescription,
    priceUsd,
    originalPriceUsd:
      originalPriceUsd && priceUsd && originalPriceUsd > priceUsd ? originalPriceUsd : null,
    priceCurrency: normalizeWhitespace(priceCurrency || 'USD'),
    stock,
    coverImage,
    galleryImages: uniqueStrings([coverImage, ...galleryImages], 30),
    featureHeadlines,
    featureBullets,
    inTheBox,
    specPairs,
    manualUrl,
    productCode,
    variantSkus,
    brand,
    rawDescription: buildRawDescription({
      title,
      brand,
      subtitle,
      metaDescription,
      priceUsd,
      priceCurrency: normalizeWhitespace(priceCurrency || 'USD'),
      stock,
      sourceUrl,
      featureItems,
      inTheBox,
      specPairs,
      manualUrl,
    }),
  };
}

export function buildDetailReferer(previousDetailUrl?: string | null): string {
  return resolveUrl(previousDetailUrl || '') || LIST_URL;
}

export function isRetryableFetchErrorMessage(message: string): boolean {
  return /HTTP 403|HTTP 406|fetch failed|ECONNRESET|socket/i.test(message);
}

function runCurlFetch(url: string, referer: string): string {
  return execFileSync(
    'curl',
    [
      '-L',
      '--fail-with-body',
      '-A',
      String(REQUEST_HEADERS['user-agent'] || ''),
      '-H',
      `accept: ${String(REQUEST_HEADERS.accept || '')}`,
      '-H',
      `accept-language: ${String(REQUEST_HEADERS['accept-language'] || '')}`,
      '-H',
      `pragma: ${String(REQUEST_HEADERS.pragma || '')}`,
      '-H',
      `cache-control: ${String(REQUEST_HEADERS['cache-control'] || '')}`,
      '-H',
      `referer: ${referer}`,
      url,
    ],
    { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
  );
}

async function createBrowserSession(): Promise<BrowserSession> {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 2200 },
    locale: 'en-US',
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  await context.route('**/*', async (route) => {
    const resourceType = route.request().resourceType();
    if (resourceType === 'media' || resourceType === 'font') {
      await route.abort();
      return;
    }
    await route.continue();
  });

  const page = await context.newPage();
  return { browser, context, page };
}

async function closeBrowserSession(session: BrowserSession | null | undefined) {
  if (!session) return;
  await session.context.close().catch(() => {});
  await session.browser.close().catch(() => {});
}

async function readPlaywrightPage(page: Page, url: string, referer: string): Promise<string> {
  const response = await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
    referer,
  });
  if (response && response.status() >= 400) {
    throw new Error(`HTTP ${response.status()}`);
  }
  await page.waitForTimeout(4000);
  return await page.content();
}

async function getPlaywrightHtml(url: string, options: PlaywrightFetchOptions = {}): Promise<string> {
  const referer = buildDetailReferer(options.referer);
  if (options.session) {
    return readPlaywrightPage(options.session.page, url, referer);
  }

  const session = await createBrowserSession();
  try {
    return await readPlaywrightPage(session.page, url, referer);
  } finally {
    await closeBrowserSession(session);
  }
}

export function createFetchHtmlRunner(deps: FetchHtmlDeps) {
  return async function fetchHtml(url: string, options: FetchHtmlOptions = {}): Promise<string> {
    const referer = buildDetailReferer(options.referer);

    if (options.preferBrowserSession && options.session) {
      try {
        return await deps.playwrightFetcher(url, { session: options.session, referer });
      } catch (error) {
        const sessionMessage = error instanceof Error ? error.message : String(error || '');
        if (!isRetryableFetchErrorMessage(sessionMessage)) throw error;
        console.warn(`[womanizer-official] session 回退 fetch: ${url} (${sessionMessage})`);
      }
    }

    try {
      const response = await deps.fetchImpl(url, { headers: REQUEST_HEADERS, redirect: 'follow' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || '');
      if (!isRetryableFetchErrorMessage(message)) throw error;

      try {
        console.warn(`[womanizer-official] fetch 回退 curl: ${url} (${message})`);
        return deps.curlRunner(url, referer);
      } catch (curlError) {
        const curlMessage = curlError instanceof Error ? curlError.message : String(curlError || '');
        console.warn(`[womanizer-official] curl 回退 Playwright: ${url} (${curlMessage})`);
        return deps.playwrightFetcher(url, { session: options.session, referer });
      }
    }
  };
}

const fetchHtml = createFetchHtmlRunner({
  fetchImpl: fetch as FetchLike,
  curlRunner: runCurlFetch,
  playwrightFetcher: getPlaywrightHtml,
});

function extractProductUrlsFromImpressions(html: string): string[] {
  return Array.from(extractImpressionItems(html).keys());
}

async function writeReviewBuffer(rows: Array<Record<string, unknown>>) {
  ensureDir(BUFFER_PATH);
  fs.writeFileSync(BUFFER_PATH, JSON.stringify(rows, null, 2), 'utf8');
}

export async function runCrawler() {
  console.log('[womanizer-official] 开始抓取列表页...');
  const listHtml = await fetchHtml(LIST_URL);
  const mergedListItems = mergeUniqueListItems([
    ...extractListItems(listHtml),
    ...extractProductUrlsFromImpressions(listHtml).map((url, index) => ({
      sourceUrl: url,
      name: extractProductIdFromUrl(url),
      subtitle: '',
      coverImage: '',
      priceUsd: null,
      originalPriceUsd: null,
      genderHint: 'unisex' as GenderHint,
      stock: '',
      categoryHints: [],
      listPosition: index + 1,
      productId: '',
      sku: '',
    })),
  ]).slice(0, MAX_ITEMS);

  const rows: Array<Record<string, unknown>> = [];
  let browserSession: BrowserSession | null = null;
  let previousDetailUrl: string | null = null;

  try {
    browserSession = await createBrowserSession();
    console.log('[womanizer-official] 预热详情浏览器上下文...');
    await getPlaywrightHtml(LIST_URL, { session: browserSession, referer: ORIGIN });
  } catch (error) {
    console.warn('[womanizer-official] 浏览器上下文预热失败，继续使用无会话抓取:', error);
    await closeBrowserSession(browserSession);
    browserSession = null;
  }

  try {
    for (const item of mergedListItems) {
      try {
        console.log(`[womanizer-official] 抓取详情: ${item.sourceUrl}`);
        const detailHtml = await fetchHtml(item.sourceUrl, {
          preferBrowserSession: Boolean(browserSession),
          session: browserSession,
          referer: previousDetailUrl || LIST_URL,
        });
        const detail = extractProductDetail(detailHtml, item.sourceUrl);
        rows.push({
          ...item,
          ...detail,
          name: detail.title ? `${detail.brand} ${detail.title}`.replace(/\s+/g, ' ').trim() : item.name,
          price: detail.priceUsd ?? item.priceUsd ?? null,
          priceUsd: detail.priceUsd ?? item.priceUsd ?? null,
          originalPriceUsd: detail.originalPriceUsd ?? item.originalPriceUsd ?? null,
          priceCurrency: detail.priceCurrency || 'USD',
          coverImage: detail.coverImage || item.coverImage,
          productId: item.productId || extractProductIdFromUrl(item.sourceUrl),
          sku: item.sku || detail.productCode || '',
        });
        previousDetailUrl = item.sourceUrl;
        await sleep(250);
      } catch (error) {
        console.warn(`[womanizer-official] 详情抓取失败，跳过 ${item.sourceUrl}:`, error);
      }
    }
  } finally {
    await closeBrowserSession(browserSession);
  }

  await writeReviewBuffer(rows);
  console.log(`[womanizer-official] 已写入 review buffer: ${rows.length} 条`);
  await runCleaner();
  return rows;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCrawler().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
