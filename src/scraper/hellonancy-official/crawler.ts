import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ORIGIN = 'https://hellonancy.com';
export const LIST_URL = `${ORIGIN}/zh-hans/collections/nancy-all-products`;
export const COLLECTION_JSON_URL = `${ORIGIN}/zh-hans/collections/nancy-all-products/products.json`;
export const BUFFER_PATH = path.resolve(__dirname, '../../data/hellonancy-official-review-buffer.json');
export const MAX_ITEMS = Number(process.env.HELLONANCY_OFFICIAL_MAX_ITEMS || '250');
const REQUEST_TIMEOUT_MS = 30_000;
const CLEANER_MODULE_PATH = './cleaner.ts';

const REQUEST_HEADERS: HeadersInit = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
  'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
  pragma: 'no-cache',
  'cache-control': 'no-cache',
};

export type HelloNancyListItem = {
  sourceUrl: string;
  name: string;
  subtitle: string;
  coverImage: string;
  priceSourceAmount: number | null;
  originalPriceSourceAmount: number | null;
  priceCurrency: 'CNY';
  categoryHints: string[];
  genderHint: 'unisex';
  listPosition: number | null;
};

export type HelloNancyProductDetail = {
  title: string;
  subtitle: string;
  metaTitle: string;
  metaDescription: string;
  priceSourceAmount: number | null;
  originalPriceSourceAmount: number | null;
  priceCurrency: 'CNY';
  coverImage: string;
  galleryImages: string[];
  rawDescription: string;
};

export type HelloNancyReviewBufferItem = HelloNancyListItem &
  HelloNancyProductDetail & {
    isReviewed: false;
  };

export type ShopifyVariant = {
  title?: string | null;
  price?: string | number | null;
  compare_at_price?: string | number | null;
  available?: boolean | null;
};

export type ShopifyImage = {
  src?: string | null;
  alt?: string | null;
};

export type ShopifyProduct = {
  title?: string | null;
  handle?: string | null;
  body_html?: string | null;
  description?: string | null;
  vendor?: string | null;
  product_type?: string | null;
  tags?: string | string[] | null;
  variants?: ShopifyVariant[] | null;
  images?: ShopifyImage[] | null;
};

export type ShopifyCatalogResponse = {
  products?: ShopifyProduct[] | null;
};

function decodeHtml(value: string): string {
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
  return decodeHtml(String(value || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' '));
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

function uniqueStrings(values: Array<string | null | undefined>, limit = 120): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = normalizeWhitespace(String(value || ''));
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= limit) break;
  }
  return result;
}

function parsePrice(value: unknown): number | null {
  const match = String(value ?? '').match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeAssetUrl(input: string): string {
  const trimmed = decodeHtml(String(input || '').trim());
  if (!trimmed) return '';
  try {
    return new URL(trimmed, ORIGIN).toString();
  } catch {
    return '';
  }
}

export function normalizeProductUrl(input: string): string {
  const trimmed = String(input || '').trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed, ORIGIN);
    const handle = url.pathname.match(/\/products\/([^/?#]+)/i)?.[1];
    if (!handle) return '';
    return `${ORIGIN}/products/${handle}`;
  } catch {
    return '';
  }
}

function normalizeTags(tags: ShopifyProduct['tags']): string[] {
  if (Array.isArray(tags)) {
    return uniqueStrings(tags.map((value) => String(value || '')), 40);
  }
  return uniqueStrings(String(tags || '').split(',').map((value) => value.trim()), 40);
}

function buildCandidateText(input: Record<string, unknown>): string {
  const tags = Array.isArray(input.tags)
    ? input.tags.map((value) => String(value || ''))
    : Array.isArray(input.categoryHints)
      ? input.categoryHints.map((value) => String(value || ''))
      : [];
  return [
    String(input.name || ''),
    String(input.subtitle || ''),
    String(input.rawDescription || ''),
    String(input.productType || ''),
    ...tags,
  ].join(' ').toLowerCase();
}

function buildCandidateCoreText(input: Record<string, unknown>): string {
  const tags = Array.isArray(input.tags)
    ? input.tags.map((value) => String(value || ''))
    : Array.isArray(input.categoryHints)
      ? input.categoryHints.map((value) => String(value || ''))
      : [];
  return [String(input.name || ''), String(input.subtitle || ''), String(input.productType || ''), ...tags].join(' ').toLowerCase();
}

export function shouldKeepHelloNancyCandidate(input: Record<string, unknown>): boolean {
  const haystack = buildCandidateText(input);
  const coreHaystack = buildCandidateCoreText(input);
  if (!haystack) return false;

  const hardBlockedPatterns = [
    /\bcharging\s*cable\b/i,
    /\bcharger\b/i,
    /\bmagnetic\s*charging\s*cable\b/i,
    /\busb-c\b/i,
    /\bpin\s*charging\s*cable\b/i,
  ];
  if (hardBlockedPatterns.some((pattern) => pattern.test(coreHaystack))) return false;

  const allowedTerms = [
    'massager',
    'vibrator',
    'clitoral',
    'g-spot',
    'air suction',
    'personal massager',
    'bundle',
    'pleasure',
    'panty',
    'bullet',
    'rabbit',
    'toy',
  ];

  return allowedTerms.some((term) => haystack.includes(term));
}

function normalizeShopifyProducts(payload: ShopifyCatalogResponse | ShopifyProduct[] | null | undefined): ShopifyProduct[] {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.products)) return payload.products;
  return [];
}

function buildProductUrlFromHandle(handle: string): string {
  return normalizeProductUrl(`/products/${String(handle || '').trim()}`);
}

function resolveShopifyProductPrice(product: ShopifyProduct): { priceSourceAmount: number | null; originalPriceSourceAmount: number | null } {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const firstVariant = variants.find((variant) => parsePrice(variant.price) !== null) || variants[0];
  return {
    priceSourceAmount: parsePrice(firstVariant?.price ?? null),
    originalPriceSourceAmount: parsePrice(firstVariant?.compare_at_price ?? null),
  };
}

function findFirstCapture(input: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const value = input.match(pattern)?.[1];
    if (value) return normalizeWhitespace(value);
  }
  return '';
}

function extractListBlocks(html: string): string[] {
  const listHtml = html.match(/<[^>]+class="[^"]*product-list[^"]*"[^>]*>([\s\S]*)/i)?.[1] || html;
  return Array.from(
    listHtml.matchAll(/<(?:li|div)\b[^>]*class="[^"]*product-card[^"]*"[\s\S]*?<\/(?:li|div)>/gi),
  ).map((match) => match[0]);
}

function resolveListItemName(block: string): string {
  return findFirstCapture(block, [
    /<h3[^>]*>([\s\S]*?)<\/h3>/i,
    /aria-label="([^"]+)"/i,
    /title="([^"]+)"/i,
  ]);
}

function resolveListItemSubtitle(block: string, name: string): string {
  const candidate = findFirstCapture(block, [
    /<p[^>]*>([\s\S]*?)<\/p>/i,
    /<span[^>]*class="[^"]*caption[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
  ]);
  return candidate && candidate !== name ? candidate : '';
}

function resolveListItemImage(block: string): string {
  const srcset = block.match(/<img[^>]+srcset="([^"]+)"/i)?.[1] || '';
  const srcsetFirst = srcset.split(',')[0]?.trim().split(/\s+/)[0] || '';
  const src = block.match(/<img[^>]+src="([^"]+)"/i)?.[1] || srcsetFirst;
  return normalizeAssetUrl(src);
}

export function extractListItemsFromHtml(html: string): HelloNancyListItem[] {
  const blocks = extractListBlocks(html);
  const items: HelloNancyListItem[] = [];

  for (const [index, block] of blocks.entries()) {
    const href = block.match(/href="([^"]*\/products\/[^"]+)"/i)?.[1] || '';
    const sourceUrl = normalizeProductUrl(href);
    const name = resolveListItemName(block);
    const subtitle = resolveListItemSubtitle(block, name);
    const coverImage = resolveListItemImage(block);
    const priceSourceAmount = parsePrice(
      findFirstCapture(block, [
        /<(?:span|div)[^>]*class="[^"]*price[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/i,
      ]),
    );

    const item: HelloNancyListItem = {
      sourceUrl,
      name,
      subtitle,
      coverImage,
      priceSourceAmount,
      originalPriceSourceAmount: null,
      priceCurrency: 'CNY',
      categoryHints: [],
      genderHint: 'unisex',
      listPosition: index + 1,
    };

    if (sourceUrl && shouldKeepHelloNancyCandidate(item)) items.push(item);
  }

  return items;
}

export function extractListItemsFromShopifyJson(
  payload: ShopifyCatalogResponse | ShopifyProduct[],
  positionOffset = 0,
): HelloNancyListItem[] {
  const products = normalizeShopifyProducts(payload);
  return products
    .map((product, index) => {
      const sourceUrl = buildProductUrlFromHandle(String(product.handle || ''));
      const { priceSourceAmount, originalPriceSourceAmount } = resolveShopifyProductPrice(product);
      const subtitle =
        normalizeWhitespace(String(product.product_type || '')) || normalizeWhitespace(String(product.body_html || ''));
      const categoryHints = uniqueStrings([String(product.product_type || ''), ...normalizeTags(product.tags)], 40);

      return {
        sourceUrl,
        name: normalizeWhitespace(String(product.title || '')),
        subtitle,
        coverImage: normalizeAssetUrl(String(product.images?.[0]?.src || '')),
        priceSourceAmount,
        originalPriceSourceAmount,
        priceCurrency: 'CNY' as const,
        categoryHints,
        genderHint: 'unisex' as const,
        listPosition: positionOffset + index + 1,
      };
    })
    .filter((item) => item.sourceUrl && shouldKeepHelloNancyCandidate(item));
}

export function mergeUniqueListItems(items: HelloNancyListItem[]): HelloNancyListItem[] {
  const byUrl = new Map<string, HelloNancyListItem>();
  for (const item of items) {
    const sourceUrl = normalizeProductUrl(item.sourceUrl);
    if (!sourceUrl) continue;
    const existing = byUrl.get(sourceUrl);
    if (!existing) {
      byUrl.set(sourceUrl, { ...item, sourceUrl, categoryHints: uniqueStrings(item.categoryHints || [], 40) });
      continue;
    }
    const currentPosition = item.listPosition ?? Number.POSITIVE_INFINITY;
    const existingPosition = existing.listPosition ?? Number.POSITIVE_INFINITY;
    const preferred = currentPosition < existingPosition ? item : existing;
    byUrl.set(sourceUrl, {
      ...preferred,
      sourceUrl,
      name: preferred.name || existing.name || item.name,
      subtitle: preferred.subtitle || existing.subtitle || item.subtitle,
      coverImage: preferred.coverImage || existing.coverImage || item.coverImage,
      priceSourceAmount: preferred.priceSourceAmount ?? existing.priceSourceAmount ?? item.priceSourceAmount,
      originalPriceSourceAmount:
        preferred.originalPriceSourceAmount ?? existing.originalPriceSourceAmount ?? item.originalPriceSourceAmount,
      categoryHints: uniqueStrings([...(existing.categoryHints || []), ...(item.categoryHints || [])], 40),
    });
  }
  return Array.from(byUrl.values()).sort((a, b) => (a.listPosition ?? 1e9) - (b.listPosition ?? 1e9));
}

export async function crawlCollectionPages(input: {
  maxItems?: number;
  fetchCollectionHtml: () => Promise<string>;
  fetchCollectionJsonPage: (page: number) => Promise<ShopifyCatalogResponse>;
}): Promise<HelloNancyListItem[]> {
  const maxItems = input.maxItems ?? MAX_ITEMS;
  const merged: HelloNancyListItem[] = [];
  try {
    const html = await input.fetchCollectionHtml();
    merged.push(...extractListItemsFromHtml(html));
  } catch {}

  const jsonItems: HelloNancyListItem[] = [];
  for (let page = 1; jsonItems.length < maxItems; page += 1) {
    try {
      const payload = await input.fetchCollectionJsonPage(page);
      const products = normalizeShopifyProducts(payload);
      if (products.length === 0) break;
      jsonItems.push(...extractListItemsFromShopifyJson(products, jsonItems.length));
      if (products.length < 250) break;
    } catch {
      break;
    }
  }

  merged.push(...jsonItems);
  return mergeUniqueListItems(merged).slice(0, maxItems);
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: REQUEST_HEADERS,
    redirect: 'follow',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} while fetching ${url}`);
  return await response.text();
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { ...REQUEST_HEADERS, accept: 'application/json,text/plain;q=0.9,*/*;q=0.8' },
    redirect: 'follow',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} while fetching ${url}`);
  return (await response.json()) as T;
}

export function buildHelloNancyRawDescription(parts: Array<string | null | undefined>): string {
  return uniqueStrings(parts, 220).join('\n');
}

export function extractDetailFromShopifyProduct(product: ShopifyProduct): HelloNancyProductDetail {
  const { priceSourceAmount, originalPriceSourceAmount } = resolveShopifyProductPrice(product);
  const tags = normalizeTags(product.tags);
  const bodyHtml = String(product.body_html ?? product.description ?? '');
  const galleryImages = uniqueStrings((product.images || []).map((image) => normalizeAssetUrl(String(image?.src || ''))).filter(Boolean), 24);
  const rawDescription = buildHelloNancyRawDescription([
    String(product.title || ''),
    String(product.product_type || ''),
    normalizeWhitespace(bodyHtml),
    ...tags,
  ]);

  return {
    title: normalizeWhitespace(String(product.title || '')),
    subtitle: normalizeWhitespace(String(product.product_type || '')),
    metaTitle: normalizeWhitespace(String(product.title || '')),
    metaDescription: normalizeWhitespace(bodyHtml),
    priceSourceAmount,
    originalPriceSourceAmount,
    priceCurrency: 'CNY',
    coverImage: galleryImages[0] || '',
    galleryImages,
    rawDescription,
  };
}

function buildReviewBufferItem(item: HelloNancyListItem, detail: HelloNancyProductDetail): HelloNancyReviewBufferItem | null {
  if (!shouldKeepHelloNancyCandidate({ name: detail.title || item.name, subtitle: detail.subtitle || item.subtitle, rawDescription: detail.rawDescription, categoryHints: item.categoryHints })) {
    return null;
  }
  return {
    ...item,
    ...detail,
    sourceUrl: item.sourceUrl,
    coverImage: detail.coverImage || item.coverImage,
    priceSourceAmount: detail.priceSourceAmount ?? item.priceSourceAmount,
    originalPriceSourceAmount: detail.originalPriceSourceAmount ?? item.originalPriceSourceAmount,
    isReviewed: false,
  };
}

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function writeReviewBuffer(rows: HelloNancyReviewBufferItem[]) {
  ensureDir(BUFFER_PATH);
  fs.writeFileSync(BUFFER_PATH, JSON.stringify(rows, null, 2));
}

export async function runCrawler(): Promise<HelloNancyReviewBufferItem[]> {
  console.log(`[all] 开始抓取: ${LIST_URL}`);
  const listItems = await crawlCollectionPages({
    maxItems: MAX_ITEMS,
    fetchCollectionHtml: async () => await fetchText(LIST_URL),
    fetchCollectionJsonPage: async (page) => {
      const url = new URL(COLLECTION_JSON_URL);
      url.searchParams.set('limit', '250');
      url.searchParams.set('page', String(page));
      return await fetchJson<ShopifyCatalogResponse>(url.toString());
    },
  });
  console.log(`[all] 列表候选 ${listItems.length} 条`);

  const rows: HelloNancyReviewBufferItem[] = [];
  for (const [index, item] of listItems.entries()) {
    console.log(`[all] 详情 ${index + 1}/${listItems.length}: ${item.name}`);
    const handle = item.sourceUrl.split('/products/')[1] || '';
    if (!handle) continue;
    try {
      const detail = extractDetailFromShopifyProduct(await fetchJson<ShopifyProduct>(`${ORIGIN}/products/${handle}.js`));
      const row = buildReviewBufferItem(item, detail);
      if (row) rows.push(row);
    } catch {}
  }

  writeReviewBuffer(rows);
  console.log(`[crawler] review-buffer 已写入 ${rows.length} 条: ${BUFFER_PATH}`);
  return rows;
}

export async function runCleaner() {
  const cleanerModule = await import(CLEANER_MODULE_PATH);
  return cleanerModule.runCleaner();
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  runCrawler()
    .then(() => runCleaner())
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
