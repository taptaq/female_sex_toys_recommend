import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ORIGIN = 'https://www.hotoctopuss.com';
export const BUFFER_PATH = path.resolve(__dirname, '../../data/hotoctopuss-official-review-buffer.json');
export const MAX_ITEMS = Number(process.env.HOTOCTOPUSS_OFFICIAL_MAX_ITEMS || '250');
const REQUEST_TIMEOUT_MS = 30_000;
const CLEANER_MODULE_PATH = './cleaner.ts';

export type CollectionCode = 'male' | 'female' | 'couples';
export type GenderHint = 'male' | 'female' | 'unisex';

export const COLLECTIONS: Array<{
  code: CollectionCode;
  listUrl: string;
  jsonUrl: string;
  genderHint: GenderHint;
}> = [
  {
    code: 'male',
    listUrl: `${ORIGIN}/collections/male-sex-toys`,
    jsonUrl: `${ORIGIN}/collections/male-sex-toys/products.json`,
    genderHint: 'male',
  },
  {
    code: 'female',
    listUrl: `${ORIGIN}/collections/female-sex-toys`,
    jsonUrl: `${ORIGIN}/collections/female-sex-toys/products.json`,
    genderHint: 'female',
  },
  {
    code: 'couples',
    listUrl: `${ORIGIN}/collections/couples-sex-toys`,
    jsonUrl: `${ORIGIN}/collections/couples-sex-toys/products.json`,
    genderHint: 'unisex',
  },
];

const REQUEST_HEADERS: HeadersInit = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
  'accept-language': 'en-US,en;q=0.9',
  pragma: 'no-cache',
  'cache-control': 'no-cache',
};

export type HotoctopussListItem = {
  sourceUrl: string;
  name: string;
  subtitle: string;
  coverImage: string;
  priceSourceAmount: number | null;
  originalPriceSourceAmount: number | null;
  priceCurrency: 'GBP';
  categoryHints: string[];
  genderHint: GenderHint;
  listPosition: number | null;
};

export type HotoctopussProductDetail = {
  title: string;
  subtitle: string;
  metaTitle: string;
  metaDescription: string;
  priceSourceAmount: number | null;
  originalPriceSourceAmount: number | null;
  priceCurrency: 'GBP';
  coverImage: string;
  galleryImages: string[];
  rawDescription: string;
};

export type HotoctopussReviewBufferItem = HotoctopussListItem &
  HotoctopussProductDetail & {
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
  options?: Array<{ name?: string | null; values?: string[] | null }> | null;
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

function parseShopifyMoney(value: unknown): number | null {
  const parsed = parsePrice(value);
  if (parsed === null) return null;

  const raw = String(value ?? '').trim();
  if (/^-?\d+$/.test(raw) && Math.abs(parsed) >= 1000) {
    return parsed / 100;
  }

  return parsed;
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

  return uniqueStrings(
    String(tags || '')
      .split(',')
      .map((value) => value.trim()),
    40,
  );
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
  ]
    .join(' ')
    .toLowerCase();
}

function buildCandidateCoreText(input: Record<string, unknown>): string {
  const tags = Array.isArray(input.tags)
    ? input.tags.map((value) => String(value || ''))
    : Array.isArray(input.categoryHints)
      ? input.categoryHints.map((value) => String(value || ''))
      : [];

  return [String(input.name || ''), String(input.subtitle || ''), String(input.productType || ''), ...tags]
    .join(' ')
    .toLowerCase();
}

export function shouldKeepHotoctopussCandidate(input: Record<string, unknown>): boolean {
  const haystack = buildCandidateText(input);
  const coreHaystack = buildCandidateCoreText(input);
  if (!haystack) return false;

  const hardBlockedPatterns = [
    /\bgift\s*card\b/i,
    /\bshipping\s*protection\b/i,
    /\broute\b/i,
    /\bwarranty\b/i,
  ];
  if (hardBlockedPatterns.some((pattern) => pattern.test(coreHaystack))) {
    return false;
  }

  const allowedTerms = [
    'sex toy',
    'masturbator',
    'penis',
    'vibrator',
    'clitoral',
    'stimulator',
    'cock ring',
    'prostate',
    'bundle',
    'couples',
    'toy',
    'pulse',
    'guybrator',
    'lube',
    'accessories',
    'bondage',
  ];

  return allowedTerms.some((term) => haystack.includes(term));
}

function resolveCollectionGenderHint(collectionCode: CollectionCode): GenderHint {
  return collectionCode === 'male' ? 'male' : collectionCode === 'female' ? 'female' : 'unisex';
}

export function formatCollectionLogLabel(collectionCode: CollectionCode): string {
  return `[${collectionCode}]`;
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
  const firstVariant = variants.find((variant) => parseShopifyMoney(variant.price) !== null) || variants[0];
  return {
    priceSourceAmount: parseShopifyMoney(firstVariant?.price ?? null),
    originalPriceSourceAmount: parseShopifyMoney(firstVariant?.compare_at_price ?? null),
  };
}

function findFirstCapture(input: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const value = input.match(pattern)?.[1];
    if (value) return normalizeWhitespace(value);
  }
  return '';
}

function extractResultBlocks(html: string): string[] {
  const gridHtml = html.match(/<div[^>]+id="filter-results"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || html;
  return Array.from(gridHtml.matchAll(/<li\b[^>]*class="[^"]*js-pagination-result[^"]*"[\s\S]*?<\/li>/gi)).map((match) => match[0]);
}

function resolveListItemName(block: string): string {
  return (
    findFirstCapture(block, [
      /<h3[^>]*>([\s\S]*?)<\/h3>/i,
      /aria-label="([^"]+)"/i,
    ]) || ''
  );
}

function resolveListItemSubtitle(block: string, name: string): string {
  const candidates = [
    findFirstCapture(block, [
      /<p[^>]*>([\s\S]*?)<\/p>/i,
      /<span[^>]*class="[^"]*card__caption[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
    ]),
  ].filter(Boolean);

  return candidates.find((candidate) => candidate !== name) || '';
}

function resolveListItemImage(block: string): string {
  const srcset = block.match(/<img[^>]+srcset="([^"]+)"/i)?.[1] || '';
  const srcsetFirst = srcset.split(',')[0]?.trim().split(/\s+/)[0] || '';
  const src = block.match(/<img[^>]+src="([^"]+)"/i)?.[1] || srcsetFirst;
  return normalizeAssetUrl(src);
}

export function extractListItemsFromHtml(html: string, collectionCode: CollectionCode): HotoctopussListItem[] {
  const blocks = extractResultBlocks(html);
  const items: HotoctopussListItem[] = [];
  const genderHint = resolveCollectionGenderHint(collectionCode);

  for (const [index, block] of blocks.entries()) {
    const href = block.match(/<a[^>]+href="([^"]*\/products\/[^"]+)"/i)?.[1] || '';
    const sourceUrl = normalizeProductUrl(href);
    const name = resolveListItemName(block);
    const subtitle = resolveListItemSubtitle(block, name);
    const coverImage = resolveListItemImage(block);
    const priceSourceAmount =
      parsePrice(
        findFirstCapture(block, [
          /<(?:span|div)[^>]*class="[^"]*price-item--sale[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/i,
          /<(?:span|div)[^>]*class="[^"]*price-item[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/i,
        ]),
      ) ?? null;
    const originalPriceSourceAmount =
      parsePrice(
        findFirstCapture(block, [
          /<(?:span|div|s)[^>]*class="[^"]*price-item--regular[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div|s)>/i,
        ]),
      ) ?? null;

    const item: HotoctopussListItem = {
      sourceUrl,
      name,
      subtitle,
      coverImage,
      priceSourceAmount,
      originalPriceSourceAmount,
      priceCurrency: 'GBP',
      categoryHints: [],
      genderHint,
      listPosition: index + 1,
    };

    if (sourceUrl && shouldKeepHotoctopussCandidate(item)) {
      items.push(item);
    }
  }

  return items;
}

export function extractListItemsFromShopifyJson(
  payload: ShopifyCatalogResponse | ShopifyProduct[],
  collectionCode: CollectionCode,
  positionOffset = 0,
): HotoctopussListItem[] {
  const products = normalizeShopifyProducts(payload);
  const genderHint = resolveCollectionGenderHint(collectionCode);

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
        priceCurrency: 'GBP' as const,
        categoryHints,
        genderHint,
        listPosition: positionOffset + index + 1,
      };
    })
    .filter((item) => item.sourceUrl && shouldKeepHotoctopussCandidate(item));
}

function scoreCanonicalName(value: string): number {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return -1;
  let score = 0;
  if (normalized.includes('&')) score += 3;
  if (normalized.length <= 90) score += 1;
  if (!/[,.]/.test(normalized)) score += 1;
  return score;
}

export function mergeUniqueListItems(items: HotoctopussListItem[]): HotoctopussListItem[] {
  const byUrl = new Map<string, HotoctopussListItem>();

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
    const preferredName = scoreCanonicalName(item.name) > scoreCanonicalName(existing.name) ? item.name : existing.name;

    byUrl.set(sourceUrl, {
      ...preferred,
      sourceUrl,
      name: preferredName,
      subtitle: preferred.subtitle || existing.subtitle || item.subtitle,
      coverImage: preferred.coverImage || existing.coverImage || item.coverImage,
      priceSourceAmount: preferred.priceSourceAmount ?? existing.priceSourceAmount ?? item.priceSourceAmount,
      originalPriceSourceAmount:
        preferred.originalPriceSourceAmount ?? existing.originalPriceSourceAmount ?? item.originalPriceSourceAmount,
      categoryHints: uniqueStrings([...(existing.categoryHints || []), ...(item.categoryHints || [])], 40),
    });
  }

  return Array.from(byUrl.values()).sort(
    (left, right) => (left.listPosition ?? Number.POSITIVE_INFINITY) - (right.listPosition ?? Number.POSITIVE_INFINITY),
  );
}

export async function crawlCollectionPages(input: {
  collectionCode: CollectionCode;
  maxItems?: number;
  fetchCollectionHtml: () => Promise<string>;
  fetchCollectionJsonPage: (page: number) => Promise<ShopifyCatalogResponse>;
}): Promise<HotoctopussListItem[]> {
  const maxItems = input.maxItems ?? MAX_ITEMS;
  const mergedCandidates: HotoctopussListItem[] = [];

  try {
    const html = await input.fetchCollectionHtml();
    mergedCandidates.push(...extractListItemsFromHtml(html, input.collectionCode));
  } catch {}

  const jsonItems: HotoctopussListItem[] = [];
  for (let page = 1; jsonItems.length < maxItems; page += 1) {
    try {
      const payload = await input.fetchCollectionJsonPage(page);
      const products = normalizeShopifyProducts(payload);
      if (products.length === 0) break;
      jsonItems.push(...extractListItemsFromShopifyJson(products, input.collectionCode, jsonItems.length));
      if (products.length < 250) break;
    } catch {
      break;
    }
  }

  mergedCandidates.push(...jsonItems);
  return mergeUniqueListItems(mergedCandidates).slice(0, maxItems);
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: REQUEST_HEADERS,
    redirect: 'follow',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching ${url}`);
  }
  return await response.text();
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { ...REQUEST_HEADERS, accept: 'application/json,text/plain;q=0.9,*/*;q=0.8' },
    redirect: 'follow',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching ${url}`);
  }
  return (await response.json()) as T;
}

function extractMetaContent(html: string, name: string): string {
  const pattern = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i');
  return normalizeWhitespace(html.match(pattern)?.[1] || '');
}

export function buildHotoctopussRawDescription(parts: Array<string | null | undefined>): string {
  return uniqueStrings(parts, 220).join('\n');
}

function extractProductDetailsBlockTexts(html: string): string[] {
  const sections: string[] = [];
  const highlightMatches = Array.from(
    html.matchAll(/<div\b[^>]*class="[^"]*product-details__block[^"]*product-details__highlight[^"]*"[^>]*>([\s\S]*?)<\/div>/gi),
  );
  for (const match of highlightMatches) {
    const block = match[0];
    const highlightHeading = normalizeWhitespace(block.match(/<p\b[^>]*class="[^"]*\bh4\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1] || '');
    const highlightBody = normalizeWhitespace(block.match(/<div\b[^>]*class="[^"]*rte[^"]*large-text[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || '');
    if (highlightHeading || highlightBody) {
      sections.push(buildHotoctopussRawDescription([highlightHeading, highlightBody]));
    }
  }

  const tabMatches = Array.from(
    html.matchAll(/<button\b[^>]*class="[^"]*tablist__tab[^"]*font-bold[^"]*"[^>]*aria-controls="([^"]+)"[^>]*>([\s\S]*?)<\/button>/gi),
  );
  for (const [, panelId, buttonText] of tabMatches) {
    const panelPattern = new RegExp(
      `<div\\b[^>]*id=["']${String(panelId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>([\\s\\S]*?)<\\/div>`,
      'i',
    );
    const panelHtml = html.match(panelPattern)?.[1] || '';
    const panelTitle = normalizeWhitespace(buttonText || '');
    const panelText = normalizeWhitespace(panelHtml);
    if (panelText) {
      sections.push(buildHotoctopussRawDescription([panelTitle, panelText]));
    }
  }

  return uniqueStrings(sections, 40);
}

export function extractDetailFromHtml(html: string): HotoctopussProductDetail {
  const title =
    normalizeWhitespace(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '') ||
    extractMetaContent(html, 'og:title') ||
    normalizeWhitespace(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
  const subtitle = normalizeWhitespace(
    html.match(/<p\b[^>]*class="[^"]*(?:product__text|caption|subtitle)[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1] || '',
  );
  const metaTitle = normalizeWhitespace(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || title);
  const metaDescription = extractMetaContent(html, 'description') || extractMetaContent(html, 'og:description');
  const galleryImages = uniqueStrings(
    Array.from(html.matchAll(/<img\b[^>]+(?:data-src|src)=["']([^"']+)["'][^>]*>/gi)).map((match) =>
      normalizeAssetUrl(match[1] || ''),
    ),
    24,
  ).filter(Boolean);
  const currentPriceMatch =
    html.match(/<(?:span|div)[^>]*class="[^"]*price-item--sale[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/i) ||
    html.match(/<(?:span|div)[^>]*class="[^"]*price-item[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/i) ||
    html.match(/<(?:span|div)[^>]*class="[^"]*price[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/i);
  const originalPriceMatch = html.match(
    /<(?:span|div|s)[^>]*class="[^"]*(?:price-item--regular|compare-at-price)[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div|s)>/i,
  );
  const detailSections = extractProductDetailsBlockTexts(html);
  const rawDescription = buildHotoctopussRawDescription([title, subtitle, metaDescription, ...detailSections]);

  return {
    title,
    subtitle,
    metaTitle,
    metaDescription,
    priceSourceAmount: parsePrice(currentPriceMatch?.[1] || null),
    originalPriceSourceAmount: parsePrice(originalPriceMatch?.[1] || null),
    priceCurrency: 'GBP',
    coverImage: galleryImages[0] || '',
    galleryImages,
    rawDescription,
  };
}

export function extractDetailFromShopifyProduct(product: ShopifyProduct): HotoctopussProductDetail {
  const { priceSourceAmount, originalPriceSourceAmount } = resolveShopifyProductPrice(product);
  const tags = normalizeTags(product.tags);
  const bodyHtml = String(product.body_html ?? product.description ?? '');
  const galleryImages = uniqueStrings(
    (product.images || []).map((image) => normalizeAssetUrl(String(image?.src || ''))).filter(Boolean),
    24,
  );
  const rawDescription = buildHotoctopussRawDescription([
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
    priceCurrency: 'GBP',
    coverImage: galleryImages[0] || '',
    galleryImages,
    rawDescription,
  };
}

function extractProductHandle(sourceUrl: string): string {
  return normalizeProductUrl(sourceUrl).split('/products/')[1] || '';
}

function isPlausiblePriceSourceAmount(value: number | null): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 5000;
}

function choosePlausiblePriceSourceAmount(primary: number | null, secondary: number | null): number | null {
  if (isPlausiblePriceSourceAmount(primary)) return primary;
  if (isPlausiblePriceSourceAmount(secondary)) return secondary;
  return primary ?? secondary ?? null;
}

export function mergeDetailSources(primary: HotoctopussProductDetail, secondary: HotoctopussProductDetail): HotoctopussProductDetail {
  return {
    title: primary.title || secondary.title,
    subtitle: primary.subtitle || secondary.subtitle,
    metaTitle: primary.metaTitle || secondary.metaTitle,
    metaDescription: primary.metaDescription || secondary.metaDescription,
    priceSourceAmount: choosePlausiblePriceSourceAmount(primary.priceSourceAmount, secondary.priceSourceAmount),
    originalPriceSourceAmount: choosePlausiblePriceSourceAmount(
      primary.originalPriceSourceAmount,
      secondary.originalPriceSourceAmount,
    ),
    priceCurrency: primary.priceCurrency || secondary.priceCurrency,
    coverImage: primary.coverImage || secondary.coverImage,
    galleryImages: uniqueStrings([...(primary.galleryImages || []), ...(secondary.galleryImages || [])], 24),
    rawDescription: buildHotoctopussRawDescription([primary.rawDescription, secondary.rawDescription]),
  };
}

function buildReviewBufferItem(item: HotoctopussListItem, detail: HotoctopussProductDetail): HotoctopussReviewBufferItem | null {
  if (
    !shouldKeepHotoctopussCandidate({
      name: detail.title || item.name,
      subtitle: detail.subtitle || item.subtitle,
      rawDescription: detail.rawDescription,
      categoryHints: item.categoryHints,
    })
  ) {
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

export function writeReviewBuffer(rows: HotoctopussReviewBufferItem[]) {
  ensureDir(BUFFER_PATH);
  fs.writeFileSync(BUFFER_PATH, JSON.stringify(rows, null, 2));
}

export async function runCrawler(): Promise<HotoctopussReviewBufferItem[]> {
  const rows: HotoctopussReviewBufferItem[] = [];

  for (const collection of COLLECTIONS) {
    const label = formatCollectionLogLabel(collection.code);
    console.log(`${label} 开始抓取: ${collection.listUrl}`);
    const listItems = await crawlCollectionPages({
      collectionCode: collection.code,
      maxItems: MAX_ITEMS,
      fetchCollectionHtml: async () => await fetchText(collection.listUrl),
      fetchCollectionJsonPage: async (page) => {
        const url = new URL(collection.jsonUrl);
        url.searchParams.set('limit', '250');
        url.searchParams.set('page', String(page));
        return await fetchJson<ShopifyCatalogResponse>(url.toString());
      },
    });
    console.log(`${label} 列表候选 ${listItems.length} 条`);

    for (const [index, item] of listItems.entries()) {
      console.log(`${label} 详情 ${index + 1}/${listItems.length}: ${item.name}`);
      const handle = extractProductHandle(item.sourceUrl);
      try {
        const jsonDetail = handle
          ? extractDetailFromShopifyProduct(await fetchJson<ShopifyProduct>(`${ORIGIN}/products/${handle}.js`))
          : null;
        let detail = jsonDetail;

        try {
          const html = await fetchText(item.sourceUrl);
          const htmlDetail = extractDetailFromHtml(html);
          detail = detail ? mergeDetailSources(htmlDetail, detail) : htmlDetail;
        } catch {
          // keep JSON detail as the stable fallback
        }

        if (!detail) continue;
        const row = buildReviewBufferItem(item, detail);
        if (row) rows.push(row);
      } catch {
        if (!handle) continue;
        try {
          const row = buildReviewBufferItem(item, extractDetailFromShopifyProduct(await fetchJson<ShopifyProduct>(`${ORIGIN}/products/${handle}.js`)));
          if (row) rows.push(row);
        } catch {}
      }
    }

    console.log(`${label} 完成，当前累计 buffer ${rows.length} 条`);
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
