import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ORIGIN = 'https://unboundbabes.com';
export const LIST_URL = `${ORIGIN}/collections/best-sellers`;
export const COLLECTION_JSON_URL = `${ORIGIN}/collections/best-sellers/products.json`;
export const BUFFER_PATH = path.resolve(__dirname, '../../data/unbound-official-review-buffer.json');
export const MAX_ITEMS = Number(process.env.UNBOUND_OFFICIAL_MAX_ITEMS || '200');
const CLEANER_MODULE_PATH = './cleaner.ts';

const REQUEST_HEADERS: HeadersInit = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
  'accept-language': 'en-US,en;q=0.9',
  pragma: 'no-cache',
  'cache-control': 'no-cache',
};

export type UnboundListItem = {
  sourceUrl: string;
  name: string;
  subtitle: string;
  coverImage: string;
  priceUsd: number | null;
  originalPriceUsd: number | null;
  priceCurrency: 'USD';
  categoryHints: string[];
  genderHint: 'female' | 'male' | 'unisex';
  listPosition: number | null;
};

export type UnboundProductDetail = {
  title: string;
  subtitle: string;
  metaTitle: string;
  metaDescription: string;
  priceUsd: number | null;
  originalPriceUsd: number | null;
  coverImage: string;
  galleryImages: string[];
  rawDescription: string;
};

export type UnboundReviewBufferItem = UnboundListItem &
  UnboundProductDetail & {
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

function parsePriceUsd(value: unknown): number | null {
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

  let url: URL;
  try {
    url = new URL(trimmed, ORIGIN);
  } catch {
    return '';
  }

  const handleMatch = url.pathname.match(/\/products\/([^/?#]+)/i);
  if (!handleMatch?.[1]) return '';
  url.protocol = 'https:';
  url.host = 'unboundbabes.com';
  url.pathname = `/products/${handleMatch[1]}`;
  url.search = '';
  url.hash = '';
  return url.toString();
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

export function shouldKeepUnboundCandidate(input: Record<string, unknown>): boolean {
  const haystack = buildCandidateText(input);
  if (!haystack) return false;

  const hardBlockedPatterns = [
    /\bgift\s*card\b/i,
    /\bsticker\b/i,
    /\bmerch\b/i,
    /\bhoodie\b/i,
    /\bt-?shirt\b/i,
    /\bhat\b/i,
    /\bcap\b/i,
    /\bposter\b/i,
  ];
  if (hardBlockedPatterns.some((pattern) => pattern.test(haystack))) {
    return false;
  }

  const allowedTerms = [
    'vibrator',
    'vibe',
    'wand',
    'suction',
    'stimulator',
    'clitoral',
    'g-spot',
    'g spot',
    'external',
    'internal',
    'insertable',
    'anal',
    'kegel',
    'pelvic',
    'massage',
    'pleasure',
    'waterproof',
    'body safe',
    'storage bag',
    'set',
    'bundle',
    'kit',
    'couples',
    'vibrating',
  ];

  return allowedTerms.some((term) => haystack.includes(term));
}

export function isShopifyErrorPage(html: string): boolean {
  const text = normalizeWhitespace(html).toLowerCase();
  if (!text) return true;

  return (
    (text.includes('something went wrong') && text.includes('shopify')) ||
    text.includes('there was an issue loading this page') ||
    text.includes('liquid error') ||
    text.includes('page you requested does not exist') ||
    text.includes('this store is unavailable')
  );
}

function extractElementByClass(html: string, className: string): string {
  const openTagPattern = new RegExp(`<([a-z0-9:-]+)\\b[^>]*\\bclass=["'][^"']*${className}[^"']*["'][^>]*>`, 'i');
  const openMatch = html.match(openTagPattern);
  if (!openMatch?.[0] || openMatch.index === undefined) return '';

  const tagName = String(openMatch[1] || '').toLowerCase();
  const startIndex = openMatch.index;
  const tagPattern = new RegExp(`</?${tagName}\\b[^>]*>`, 'gi');
  tagPattern.lastIndex = startIndex;

  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(html))) {
    if (!match[0].startsWith('</')) {
      depth += 1;
    } else {
      depth -= 1;
      if (depth === 0) {
        return html.slice(startIndex, tagPattern.lastIndex);
      }
    }
  }

  return html.slice(startIndex);
}

function extractGridItemBlocks(html: string): string[] {
  const result: string[] = [];
  const tagPattern = /<\/?(div|li)\b[^>]*>/gi;
  const classPattern = /\bclass\s*=\s*"[^"]*\bgrid__item\b[^"]*"/i;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(html))) {
    const tag = match[0];
    const tagName = String(match[1] || '').toLowerCase();
    if (tag.startsWith('</') || !classPattern.test(tag)) continue;

    const startIndex = match.index;
    let depth = 1;
    let endIndex = tagPattern.lastIndex;
    let nestedMatch: RegExpExecArray | null;

    while (depth > 0 && (nestedMatch = tagPattern.exec(html))) {
      if (String(nestedMatch[1] || '').toLowerCase() !== tagName) continue;
      depth += nestedMatch[0].startsWith('</') ? -1 : 1;
      endIndex = tagPattern.lastIndex;
    }

    if (depth === 0) {
      result.push(html.slice(startIndex, endIndex));
    }
  }

  return result;
}

function extractAnchorBlocks(html: string): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  const anchorPattern = /<a\b[^>]+href="([^"]*\/products\/[^"]+)"[^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = anchorPattern.exec(html))) {
    const sourceUrl = normalizeProductUrl(match[1] || '');
    if (!sourceUrl || seen.has(sourceUrl)) continue;
    seen.add(sourceUrl);
    const start = Math.max(0, match.index - 240);
    const end = Math.min(html.length, anchorPattern.lastIndex + 1400);
    result.push(html.slice(start, end));
  }

  return result;
}

function findFirstCapture(input: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const value = input.match(pattern)?.[1];
    if (value) {
      return normalizeWhitespace(value);
    }
  }

  return '';
}

function resolveListItemName(block: string): string {
  return (
    findFirstCapture(block, [
      /<h3[^>]*>([\s\S]*?)<\/h3>/i,
      /<h2[^>]*>([\s\S]*?)<\/h2>/i,
      /<a[^>]*href="[^"]*\/products\/[^"]*"[^>]*>\s*(?:<span[^>]*>)?([\s\S]*?)(?:<\/span>)?\s*<\/a>/i,
    ]) || normalizeWhitespace(block.match(/<img[^>]+alt="([^"]+)"/i)?.[1] || '')
  );
}

function resolveListItemSubtitle(block: string, name: string): string {
  const candidates = [
    findFirstCapture(block, [
      /<p[^>]*class="[^"]*caption[^"]*"[^>]*>([\s\S]*?)<\/p>/i,
      /<div[^>]*class="[^"]*card__caption[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<p[^>]*>([\s\S]*?)<\/p>/i,
      /<span[^>]*class="[^"]*caption[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
    ]),
  ].filter(Boolean);

  return candidates.find((candidate) => candidate !== name) || '';
}

function resolveListItemImage(block: string): string {
  const srcset = block.match(/<img[^>]+srcset="([^"]+)"/i)?.[1] || '';
  const srcsetFirst = srcset.split(',')[0]?.trim().split(/\s+/)[0] || '';
  const src =
    block.match(/<img[^>]+data-src="([^"]+)"/i)?.[1] ||
    block.match(/<img[^>]+src="([^"]+)"/i)?.[1] ||
    srcsetFirst;

  return normalizeAssetUrl(src);
}

export function extractListItemsFromHtml(html: string): UnboundListItem[] {
  const gridHtml = extractElementByClass(html, 'collection-grid__items') || html;
  const blocks = extractGridItemBlocks(gridHtml);
  const candidates = blocks.length > 0 ? blocks : extractAnchorBlocks(gridHtml);
  const items: UnboundListItem[] = [];

  for (const [index, block] of candidates.entries()) {
    const href = block.match(/<a[^>]+href="([^"]*\/products\/[^"]+)"/i)?.[1] || '';
    const sourceUrl = normalizeProductUrl(href);
    const name = resolveListItemName(block);
    const subtitle = resolveListItemSubtitle(block, name);
    const coverImage = resolveListItemImage(block);
    const priceUsd =
      parsePriceUsd(
        findFirstCapture(block, [
          /<(?:span|div)[^>]*class="[^"]*price-item--sale[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/i,
          /<(?:span|div)[^>]*class="[^"]*price-item[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/i,
          /<(?:span|div)[^>]*class="[^"]*price[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/i,
        ]),
      ) ?? null;
    const originalPriceUsd =
      parsePriceUsd(
        findFirstCapture(block, [
          /<(?:span|div|s)[^>]*class="[^"]*price-item--regular[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div|s)>/i,
          /<(?:span|div|s)[^>]*class="[^"]*compare-at-price[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div|s)>/i,
        ]),
      ) ?? null;

    const item: UnboundListItem = {
      sourceUrl,
      name,
      subtitle,
      coverImage,
      priceUsd,
      originalPriceUsd,
      priceCurrency: 'USD',
      categoryHints: [],
      genderHint: 'female',
      listPosition: index + 1,
    };

    if (sourceUrl && shouldKeepUnboundCandidate(item)) {
      items.push(item);
    }
  }

  return items;
}

function normalizeShopifyProducts(payload: ShopifyCatalogResponse | ShopifyProduct[] | null | undefined): ShopifyProduct[] {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.products)) return payload.products;
  return [];
}

function buildProductUrlFromHandle(handle: string): string {
  return normalizeProductUrl(`/products/${String(handle || '').trim()}`);
}

function resolveShopifyProductPrice(product: ShopifyProduct): { priceUsd: number | null; originalPriceUsd: number | null } {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const firstVariant = variants.find((variant) => parsePriceUsd(variant.price) !== null) || variants[0];

  return {
    priceUsd: parsePriceUsd(firstVariant?.price ?? null),
    originalPriceUsd: parsePriceUsd(firstVariant?.compare_at_price ?? null),
  };
}

export function extractListItemsFromShopifyJson(
  payload: ShopifyCatalogResponse | ShopifyProduct[],
  positionOffset = 0,
): UnboundListItem[] {
  const products = normalizeShopifyProducts(payload);

  return products
    .map((product, index) => {
      const sourceUrl = buildProductUrlFromHandle(String(product.handle || ''));
      const { priceUsd, originalPriceUsd } = resolveShopifyProductPrice(product);
      const subtitle =
        normalizeWhitespace(String(product.product_type || '')) || normalizeWhitespace(String(product.body_html || ''));
      const categoryHints = uniqueStrings([String(product.product_type || ''), ...normalizeTags(product.tags)], 40);

      return {
        sourceUrl,
        name: normalizeWhitespace(String(product.title || '')),
        subtitle,
        coverImage: normalizeAssetUrl(String(product.images?.[0]?.src || '')),
        priceUsd,
        originalPriceUsd,
        priceCurrency: 'USD' as const,
        categoryHints,
        genderHint: 'female' as const,
        listPosition: positionOffset + index + 1,
      };
    })
    .filter((item) => item.sourceUrl && shouldKeepUnboundCandidate(item));
}

export function mergeUniqueListItems(items: UnboundListItem[]): UnboundListItem[] {
  const byUrl = new Map<string, UnboundListItem>();

  for (const item of items) {
    const sourceUrl = normalizeProductUrl(item.sourceUrl);
    if (!sourceUrl) continue;

    const existing = byUrl.get(sourceUrl);
    if (!existing) {
      byUrl.set(sourceUrl, {
        ...item,
        sourceUrl,
        categoryHints: uniqueStrings(item.categoryHints || [], 40),
      });
      continue;
    }

    const currentPosition = item.listPosition ?? Number.POSITIVE_INFINITY;
    const existingPosition = existing.listPosition ?? Number.POSITIVE_INFINITY;
    const preferred = currentPosition < existingPosition ? item : existing;

    byUrl.set(sourceUrl, {
      ...preferred,
      sourceUrl,
      subtitle: preferred.subtitle || existing.subtitle || item.subtitle,
      coverImage: preferred.coverImage || existing.coverImage || item.coverImage,
      priceUsd: preferred.priceUsd ?? existing.priceUsd ?? item.priceUsd,
      originalPriceUsd: preferred.originalPriceUsd ?? existing.originalPriceUsd ?? item.originalPriceUsd,
      categoryHints: uniqueStrings([...(existing.categoryHints || []), ...(item.categoryHints || [])], 40),
    });
  }

  return Array.from(byUrl.values()).sort(
    (left, right) => (left.listPosition ?? Number.POSITIVE_INFINITY) - (right.listPosition ?? Number.POSITIVE_INFINITY),
  );
}

function extractMetaContent(html: string, name: string): string {
  const pattern = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i');
  return normalizeWhitespace(html.match(pattern)?.[1] || '');
}

function collectTagText(html: string, tags: string[]): string[] {
  const result: string[] = [];

  for (const tag of tags) {
    const pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html))) {
      result.push(normalizeWhitespace(match[1] || ''));
    }
  }

  return result;
}

function extractSectionByHint(html: string, hint: string): string[] {
  const pattern = new RegExp(
    `<(?:section|div|details|article)\\b[^>]*(?:class|id)=["'][^"']*${hint}[^"']*["'][^>]*>([\\s\\S]*?)<\\/(?:section|div|details|article)>`,
    'gi',
  );
  const result: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html))) {
    result.push(normalizeWhitespace(match[1] || ''));
  }

  return result;
}

export function extractRelevantDetailTextFromHtml(html: string): string {
  const mainHtml = html.match(/<main\b[\s\S]*?<\/main>/i)?.[0] || html;
  const sectionHints = [
    'product-info__text',
    'product-info',
    'image-with-text__text-item',
    'image-with-text',
    'accordion',
    'collapsible',
    'rte',
    'drawer',
    'modal',
    'popup',
    'product-tabs',
  ];
  const hintedSections = sectionHints.flatMap((hint) => extractSectionByHint(mainHtml, hint));
  const genericText = collectTagText(mainHtml, ['h1', 'h2', 'h3', 'h4', 'p', 'li', 'summary']);

  return uniqueStrings([...hintedSections, ...genericText], 160).join('\n');
}

export function buildUnboundRawDescription(parts: Array<string | null | undefined>): string {
  return uniqueStrings(parts, 200).join('\n');
}

export function extractDetailFromHtml(html: string, drawerTexts: string[] = []): UnboundProductDetail {
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
  const coverImage = galleryImages[0] || '';
  const currentPriceMatch =
    html.match(/<(?:span|div)[^>]*class="[^"]*price-item--sale[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/i) ||
    html.match(/<(?:span|div)[^>]*class="[^"]*price-item[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/i) ||
    html.match(/<(?:span|div)[^>]*class="[^"]*price[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/i);
  const originalPriceMatch = html.match(
    /<(?:span|div|s)[^>]*class="[^"]*(?:price-item--regular|compare-at-price)[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div|s)>/i,
  );
  const rawDescription = buildUnboundRawDescription([
    title,
    subtitle,
    metaDescription,
    extractRelevantDetailTextFromHtml(html),
    ...drawerTexts,
  ]);

  return {
    title,
    subtitle,
    metaTitle,
    metaDescription,
    priceUsd: parsePriceUsd(currentPriceMatch?.[1] || null),
    originalPriceUsd: parsePriceUsd(originalPriceMatch?.[1] || null),
    coverImage,
    galleryImages,
    rawDescription,
  };
}

export function extractDetailFromShopifyProduct(product: ShopifyProduct): UnboundProductDetail {
  const { priceUsd, originalPriceUsd } = resolveShopifyProductPrice(product);
  const tags = normalizeTags(product.tags);
  const bodyHtml = String(product.body_html ?? product.description ?? '');
  const galleryImages = uniqueStrings(
    (product.images || []).map((image) => normalizeAssetUrl(String(image?.src || ''))).filter(Boolean),
    24,
  );
  const rawDescription = buildUnboundRawDescription([
    String(product.title || ''),
    String(product.product_type || ''),
    normalizeWhitespace(bodyHtml),
    ...tags,
    ...((product.options || []).flatMap((option) => [
      String(option.name || ''),
      ...((option.values || []).map((value) => String(value || ''))),
    ])),
    ...((product.variants || []).map((variant) => String(variant?.title || ''))),
    ...((product.images || []).map((image) => String(image?.alt || ''))),
  ]);

  return {
    title: normalizeWhitespace(String(product.title || '')),
    subtitle: normalizeWhitespace(String(product.product_type || '')),
    metaTitle: normalizeWhitespace(String(product.title || '')),
    metaDescription: normalizeWhitespace(bodyHtml),
    priceUsd,
    originalPriceUsd,
    coverImage: galleryImages[0] || '',
    galleryImages,
    rawDescription,
  };
}

function normalizeDetail(detail: UnboundProductDetail): UnboundProductDetail {
  return {
    ...detail,
    coverImage: normalizeAssetUrl(detail.coverImage),
    galleryImages: uniqueStrings(detail.galleryImages.map((value) => normalizeAssetUrl(value)).filter(Boolean), 24),
  };
}

function mergeDetailSources(primary: UnboundProductDetail, secondary: UnboundProductDetail): UnboundProductDetail {
  return {
    title: primary.title || secondary.title,
    subtitle: primary.subtitle || secondary.subtitle,
    metaTitle: primary.metaTitle || secondary.metaTitle,
    metaDescription: primary.metaDescription || secondary.metaDescription,
    priceUsd: primary.priceUsd ?? secondary.priceUsd,
    originalPriceUsd: primary.originalPriceUsd ?? secondary.originalPriceUsd,
    coverImage: primary.coverImage || secondary.coverImage,
    galleryImages: uniqueStrings([...(primary.galleryImages || []), ...(secondary.galleryImages || [])], 24),
    rawDescription: buildUnboundRawDescription([primary.rawDescription, secondary.rawDescription]),
  };
}

function buildReviewBufferItem(item: UnboundListItem, detail: UnboundProductDetail): UnboundReviewBufferItem | null {
  if (
    !shouldKeepUnboundCandidate({
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
    priceUsd: detail.priceUsd ?? item.priceUsd,
    originalPriceUsd: detail.originalPriceUsd ?? item.originalPriceUsd,
    isReviewed: false,
  };
}

export async function crawlDetailItems(
  items: UnboundListItem[],
  fetchDetail: (item: UnboundListItem) => Promise<UnboundProductDetail>,
): Promise<UnboundReviewBufferItem[]> {
  const result: UnboundReviewBufferItem[] = [];

  for (const item of items) {
    try {
      const detail = normalizeDetail(await fetchDetail(item));
      const row = buildReviewBufferItem(item, detail);
      if (row) {
        result.push(row);
      }
    } catch (error) {
      console.warn(`[unbound-official] 详情抓取失败，跳过 ${item.sourceUrl}:`, error);
    }
  }

  return result;
}

type CrawlListingPagesInput = {
  maxItems?: number;
  fetchCollectionHtml: () => Promise<string>;
  fetchCollectionJsonPage: (page: number) => Promise<ShopifyCatalogResponse>;
};

export async function crawlListingPages(input: CrawlListingPagesInput): Promise<UnboundListItem[]> {
  const { fetchCollectionHtml, fetchCollectionJsonPage } = input;
  const maxItems = input.maxItems ?? MAX_ITEMS;
  const mergedCandidates: UnboundListItem[] = [];

  try {
    const html = await fetchCollectionHtml();
    if (html && !isShopifyErrorPage(html)) {
      mergedCandidates.push(...extractListItemsFromHtml(html));
    }
  } catch (error) {
    console.warn('[unbound-official] 列表 HTML 抓取失败，将继续尝试 Shopify JSON。', error);
  }

  const jsonItems: UnboundListItem[] = [];

  for (let page = 1; jsonItems.length < maxItems; page += 1) {
    const payload = await fetchCollectionJsonPage(page);
    const products = normalizeShopifyProducts(payload);
    if (products.length === 0) break;

    const pageItems = extractListItemsFromShopifyJson(products, jsonItems.length);
    jsonItems.push(...pageItems);

    if (products.length < 250) break;
  }

  mergedCandidates.push(...jsonItems);
  return mergeUniqueListItems(mergedCandidates).slice(0, maxItems);
}

async function fetchText(url: string, accept = 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8'): Promise<string> {
  const response = await fetch(url, {
    headers: { ...REQUEST_HEADERS, accept },
    redirect: 'follow',
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
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching ${url}`);
  }
  return (await response.json()) as T;
}

function extractProductHandle(sourceUrl: string): string {
  return normalizeProductUrl(sourceUrl).split('/products/')[1] || '';
}

async function fetchCollectionHtml(): Promise<string> {
  return await fetchText(LIST_URL);
}

async function fetchCollectionJsonPage(page: number): Promise<ShopifyCatalogResponse> {
  const url = new URL(COLLECTION_JSON_URL);
  url.searchParams.set('limit', '250');
  url.searchParams.set('page', String(page));
  return await fetchJson<ShopifyCatalogResponse>(url.toString());
}

async function fetchAllCollectionProducts(maxPages = 12): Promise<ShopifyProduct[]> {
  const products: ShopifyProduct[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const payload = await fetchCollectionJsonPage(page);
    const pageProducts = normalizeShopifyProducts(payload);
    if (pageProducts.length === 0) break;
    products.push(...pageProducts);
    if (pageProducts.length < 250) break;
  }

  return products;
}

async function fetchProductJson(handle: string): Promise<ShopifyProduct> {
  return await fetchJson<ShopifyProduct>(`${ORIGIN}/products/${handle}.js`);
}

type BrowserSession = {
  browser: Browser;
  context: BrowserContext;
};

async function createContext(): Promise<BrowserSession> {
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

  return { browser, context };
}

async function closeContext(session: BrowserSession | null) {
  if (!session) return;
  await session.context.close().catch(() => {});
  await session.browser.close().catch(() => {});
}

async function collectDrawerTexts(page: Page): Promise<string[]> {
  const triggers = page.locator('.product-form__link');
  const count = await triggers.count().catch(() => 0);
  const collected: string[] = [];

  for (let index = 0; index < count; index += 1) {
    const trigger = triggers.nth(index);
    const label = normalizeWhitespace((await trigger.textContent().catch(() => '')) || '');
    const controlId =
      (await trigger.getAttribute('aria-controls').catch(() => null)) ||
      ((await trigger.getAttribute('href').catch(() => null)) || '').replace(/^#/, '') ||
      '';

    await trigger.scrollIntoViewIfNeeded().catch(() => {});
    await trigger.click({ timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(350);

    const text = await page
      .evaluate(({ controlId }) => {
        const normalize = (value: string) => String(value || '').replace(/\s+/g, ' ').trim();
        const isVisible = (element: Element | null) => {
          if (!(element instanceof HTMLElement)) return false;
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || '1') !== 0 &&
            rect.width > 0 && rect.height > 0;
        };
        const result: string[] = [];
        const seen = new Set<string>();
        const push = (element: Element | null) => {
          if (!isVisible(element)) return;
          const text = normalize((element as HTMLElement).innerText || element?.textContent || '');
          if (!text) return;
          const key = text.toLowerCase();
          if (seen.has(key)) return;
          seen.add(key);
          result.push(text);
        };

        if (controlId) {
          push(document.getElementById(controlId));
          push(document.querySelector(`#${CSS.escape(controlId)} [role="dialog"]`));
        }

        [
          '[role="dialog"]',
          '.drawer.is-open',
          '.drawer.active',
          '.drawer[open]',
          '.drawer[aria-hidden="false"]',
          '.modal.is-open',
          '.modal.active',
          '.modal[open]',
          '.popup.is-open',
          '.popup.active',
          '.product-popup.is-open',
          '.product-popup.active',
          'details[open]',
          '.accordion__content',
          '.collapsible-content',
          '.shopify-section [aria-modal="true"]',
        ].forEach((selector) => {
          document.querySelectorAll(selector).forEach((element) => push(element));
        });

        return result.join('\n');
      }, { controlId })
      .catch(() => '');

    const merged = buildUnboundRawDescription([label, text]);
    if (merged) {
      collected.push(merged);
    }

    await page.keyboard.press('Escape').catch(() => {});
    const closeCandidate = page.locator(
      '.drawer__close, .modal__close, .popup__close, [aria-label*="Close"], [aria-label*="close"]',
    );
    await closeCandidate.first().click({ timeout: 1_000 }).catch(() => {});
    await page.waitForTimeout(120);
  }

  return uniqueStrings(collected, 40);
}

async function fetchBrowserDrawerTexts(context: BrowserContext, sourceUrl: string): Promise<string[]> {
  const page = await context.newPage();

  try {
    await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForTimeout(2_000);
    return await collectDrawerTexts(page);
  } finally {
    await page.close().catch(() => {});
  }
}

async function fetchUnboundDetail(
  item: UnboundListItem,
  preloadedProduct: ShopifyProduct | null = null,
  context: BrowserContext | null = null,
): Promise<UnboundProductDetail> {
  const preloadedDetail = preloadedProduct ? extractDetailFromShopifyProduct(preloadedProduct) : null;

  try {
    const html = await fetchText(item.sourceUrl);
    if (html && !isShopifyErrorPage(html)) {
      const drawerTexts = context ? await fetchBrowserDrawerTexts(context, item.sourceUrl).catch(() => []) : [];
      const detail = extractDetailFromHtml(html, drawerTexts);
      if (detail.rawDescription || detail.title) {
        return preloadedDetail ? mergeDetailSources(detail, preloadedDetail) : detail;
      }
    }
  } catch (error) {
    console.warn(`[unbound-official] 商品页 HTML 解析失败，回退 JSON: ${item.sourceUrl}`, error);
  }

  if (preloadedDetail) {
    return preloadedDetail;
  }

  const handle = extractProductHandle(item.sourceUrl);
  if (!handle) {
    throw new Error(`无法从链接提取 handle: ${item.sourceUrl}`);
  }

  return extractDetailFromShopifyProduct(await fetchProductJson(handle));
}

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function writeReviewBuffer(rows: UnboundReviewBufferItem[]) {
  ensureDir(BUFFER_PATH);
  fs.writeFileSync(BUFFER_PATH, JSON.stringify(rows, null, 2));
}

export async function runCrawler(): Promise<UnboundReviewBufferItem[]> {
  const listItems = await crawlListingPages({
    maxItems: MAX_ITEMS,
    fetchCollectionHtml,
    fetchCollectionJsonPage,
  });
  const catalogProducts = await fetchAllCollectionProducts();
  const catalogByUrl = new Map<string, ShopifyProduct>();

  for (const product of catalogProducts) {
    const sourceUrl = buildProductUrlFromHandle(String(product.handle || ''));
    if (!sourceUrl) continue;
    if (!catalogByUrl.has(sourceUrl)) {
      catalogByUrl.set(sourceUrl, product);
    }
  }

  let session: BrowserSession | null = null;

  try {
    session = await createContext().catch((error) => {
      console.warn('[unbound-official] Playwright 上下文启动失败，将跳过抽屉点击抓取。', error);
      return null;
    });

    const reviewBuffer = await crawlDetailItems(listItems, async (item) => {
      const preloadedProduct = catalogByUrl.get(normalizeProductUrl(item.sourceUrl)) || null;
      return fetchUnboundDetail(item, preloadedProduct, session?.context || null);
    });

    writeReviewBuffer(reviewBuffer);
    return reviewBuffer;
  } finally {
    await closeContext(session);
  }
}

async function runCleaner() {
  try {
    const cleanerModule = await import(CLEANER_MODULE_PATH);
    return cleanerModule.runCleaner();
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      error.code === 'ERR_MODULE_NOT_FOUND' &&
      error.message.includes(CLEANER_MODULE_PATH)
    ) {
      return;
    }
    throw error;
  }
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  runCrawler()
    .then(() => runCleaner())
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
