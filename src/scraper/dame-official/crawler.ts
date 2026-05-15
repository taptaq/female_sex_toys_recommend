import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ORIGIN = 'https://dame.com';
export const LIST_URL = `${ORIGIN}/collections/shop-all?sort_by=best-selling`;
export const BUFFER_PATH = path.resolve(__dirname, '../../data/dame-official-review-buffer.json');
export const MAX_ITEMS = Number(process.env.DAME_OFFICIAL_MAX_ITEMS || '200');
const CLEANER_MODULE_PATH = './cleaner.ts';

export type DameListItem = {
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

export type DameProductDetail = {
  title: string;
  subtitle: string;
  metaTitle: string;
  metaDescription: string;
  priceUsd: number | null;
  originalPriceUsd: number | null;
  coverImage: string;
  galleryImages: string[];
  manualUrls: string[];
  rawDescription: string;
};

export type DameReviewBufferItem = DameListItem &
  DameProductDetail & {
    sourceUrl: string;
    isReviewed: false;
  };

function normalizeWhitespace(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function stripTags(value: string): string {
  return decodeHtml(normalizeWhitespace(value));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parsePriceUsd(value: string): number | null {
  const match = value.match(/-?\d+(?:\.\d+)?/);
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

  url.protocol = 'https:';
  url.host = 'dame.com';
  url.search = '';
  url.hash = '';
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  return url.toString();
}

function uniqueStrings(values: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = normalizeWhitespace(value);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }

  return result;
}

function buildCandidateText(input: Record<string, unknown>): string {
  const parts = [
    typeof input.name === 'string' ? input.name : '',
    typeof input.subtitle === 'string' ? input.subtitle : '',
    typeof input.rawDescription === 'string' ? input.rawDescription : '',
    ...(Array.isArray(input.tags) ? input.tags.map((tag) => String(tag || '')) : []),
  ];
  return parts.join(' ').toLowerCase();
}

export function shouldKeepDameCandidate(input: Record<string, unknown>): boolean {
  const haystack = buildCandidateText(input);
  if (!haystack) return false;

  const blockedPatterns = [/\bsti\b/i, /\bgonorrhea\b/i, /\bchlamydia\b/i, /\btest kit\b/i, /\bscreening\b/i];
  if (blockedPatterns.some((pattern) => pattern.test(haystack))) {
    return false;
  }

  const allowedTerms = [
    'vibrator',
    'toy',
    'lube',
    'lubricant',
    'wipes',
    'lingerie',
    'panty',
    'underwear',
    'apparel',
  ];
  return allowedTerms.some((term) => haystack.includes(term));
}

export function extractListItemsFromHtml(html: string): DameListItem[] {
  const itemMatches = extractGridItemBlocks(html);
  const items: DameListItem[] = [];

  for (const [index, block] of itemMatches.entries()) {
    const href = findFirstCapture(block, [/<a[^>]+href="([^"]*\/products\/[^"]*)"/i]) || '';
    const sourceUrl = normalizeProductUrl(href);
    const name = resolveListItemName(block);
    const subtitle = resolveListItemSubtitle(block, name);
    const coverImage = resolveListItemImage(block);
    const currentPrice =
      parsePriceUsd(
        findFirstCapture(block, [
          /<(?:span|div)[^>]*class="[^"]*card-product-v2__btn-price-current[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/i,
          /<(?:span|div)[^>]*class="[^"]*price-item--sale[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/i,
          /<(?:span|div)[^>]*class="[^"]*price-item[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/i,
        ]),
      ) ?? null;
    const originalPrice =
      parsePriceUsd(
        findFirstCapture(block, [
          /<(?:span|div|s)[^>]*class="[^"]*card-product-v2__btn-price-original[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div|s)>/i,
          /<(?:span|div|s)[^>]*class="[^"]*price-item--regular[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div|s)>/i,
        ]),
      ) ?? null;

    const item: DameListItem = {
      sourceUrl,
      name,
      subtitle,
      coverImage,
      priceUsd: currentPrice,
      originalPriceUsd: originalPrice,
      priceCurrency: 'USD',
      categoryHints: [],
      genderHint: 'unisex',
      listPosition: index + 1,
    };

    if (sourceUrl && shouldKeepDameCandidate(item)) {
      items.push(item);
    }
  }

  return items;
}

function extractGridItemBlocks(html: string): string[] {
  const result: string[] = [];
  const tagPattern = /<\/?(div|li)\b[^>]*>/gi;
  const classPattern = /\bclass\s*=\s*"[^"]*\bgrid__item\b[^"]*"/i;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(html))) {
    const tag = match[0];
    const tagName = match[1]?.toLowerCase() || '';
    if (tag.startsWith('</') || !classPattern.test(tag)) {
      continue;
    }

    const startIndex = match.index;
    const containerTagName = tagName;
    let depth = 1;
    let endIndex = tagPattern.lastIndex;
    let nestedMatch: RegExpExecArray | null;

    while (depth > 0 && (nestedMatch = tagPattern.exec(html))) {
      const nestedTagName = nestedMatch[1]?.toLowerCase() || '';
      if (nestedTagName !== containerTagName) {
        continue;
      }
      depth += nestedMatch[0].startsWith('</') ? -1 : 1;
      endIndex = tagPattern.lastIndex;
    }

    if (depth === 0) {
      result.push(html.slice(startIndex, endIndex));
    }
  }

  return result;
}

function findFirstCapture(input: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const value = input.match(pattern)?.[1];
    if (value) {
      return stripTags(value);
    }
  }

  return '';
}

function resolveListItemName(block: string): string {
  return (
    findFirstCapture(block, [
      /<(?:span|p)[^>]*class="[^"]*card-product-v2__title-text[^"]*"[^>]*>([\s\S]*?)<\/(?:span|p)>/i,
      /<(?:span|p)[^>]*class="[^"]*card-product-v2__title[^"]*"[^>]*>([\s\S]*?)<\/(?:span|p)>/i,
      /<h3[^>]*>([\s\S]*?)<\/h3>/i,
      /<h2[^>]*>([\s\S]*?)<\/h2>/i,
      /<a[^>]*href="[^"]*\/products\/[^"]*"[^>]*>\s*(?:<span[^>]*>)?([\s\S]*?)(?:<\/span>)?\s*<\/a>/i,
    ]) ||
    stripTags(
      block.match(/<img[^>]+alt="([^"]+)"[^>]*class="[^"]*card-product-v2__img[^"]*"/i)?.[1] ||
        block.match(/<img[^>]+alt="([^"]+)"/i)?.[1] ||
        '',
    )
  );
}

function resolveListItemSubtitle(block: string, name: string): string {
  const candidates = [
    findFirstCapture(block, [
      /<(?:span|p)[^>]*class="[^"]*card-product-v2__variants[^"]*"[^>]*>([\s\S]*?)<\/(?:span|p)>/i,
      /<p[^>]*class="[^"]*card__caption[^"]*"[^>]*>([\s\S]*?)<\/p>/i,
      /<span[^>]*class="[^"]*caption[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
      /<p[^>]*>([\s\S]*?)<\/p>/i,
    ]),
  ].filter(Boolean);

  return candidates.find((candidate) => candidate !== name) || '';
}

function resolveListItemImage(block: string): string {
  const srcset = block.match(/<img[^>]+srcset="([^"]+)"/i)?.[1] || '';
  const srcsetFirst = srcset.split(',')[0]?.trim().split(/\s+/)[0] || '';
  const src =
    block.match(/<img[^>]+src="([^"]+)"/i)?.[1] ||
    block.match(/<img[^>]+data-src="([^"]+)"/i)?.[1] ||
    srcsetFirst;

  return normalizeAssetUrl(src);
}

export function mergeUniqueListItems(items: DameListItem[]): DameListItem[] {
  const byUrl = new Map<string, DameListItem>();

  for (const item of items) {
    const sourceUrl = normalizeProductUrl(item.sourceUrl);
    if (!sourceUrl) continue;

    const existing = byUrl.get(sourceUrl);
    if (!existing) {
      byUrl.set(sourceUrl, {
        ...item,
        sourceUrl,
        categoryHints: uniqueStrings(item.categoryHints || []),
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
      categoryHints: uniqueStrings([...(existing.categoryHints || []), ...(item.categoryHints || [])]),
    });
  }

  return Array.from(byUrl.values()).sort(
    (left, right) => (left.listPosition ?? Number.POSITIVE_INFINITY) - (right.listPosition ?? Number.POSITIVE_INFINITY),
  );
}

export function buildDetailExtractionScript(): string {
  return `(() => {
    const normalizeWhitespace = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
    const parsePriceUsd = (value) => {
      const match = String(value || '').match(/-?\\d+(?:\\.\\d+)?/);
      return match ? Number(match[0]) : null;
    };
    const uniqueStrings = (values) => {
      const result = [];
      const seen = new Set();
      for (const value of values) {
        const normalized = normalizeWhitespace(value);
        if (!normalized) continue;
        const key = normalized.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(normalized);
      }
      return result;
    };
    const title = normalizeWhitespace(document.querySelector('h1')?.textContent || '');
    const subtitle = normalizeWhitespace(document.querySelector('.product__text')?.textContent || '');
    const metaTitle = normalizeWhitespace(document.title || title);
    const metaDescription = normalizeWhitespace(
      document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
    );
    const galleryImages = uniqueStrings(
      Array.from(document.querySelectorAll('.product__media-list img'))
        .map((image) => image.getAttribute('src') || image.getAttribute('data-src') || '')
        .filter(Boolean),
    );
    const coverImage = galleryImages[0] || '';
    const priceNodes = Array.from(document.querySelectorAll('.price')).map((node) =>
      normalizeWhitespace(node.textContent || ''),
    );
    const compareNode = document.querySelector('.price--compare');
    const priceUsd = parsePriceUsd(
      priceNodes.find((value) => value && value !== normalizeWhitespace(compareNode?.textContent || '')) || priceNodes[0] || '',
    );
    const originalPriceUsd = parsePriceUsd(compareNode?.textContent || '');
    const manualUrls = uniqueStrings(
      Array.from(document.querySelectorAll('a[href$=".pdf"]'))
        .map((link) => link.getAttribute('href') || '')
        .filter(Boolean),
    );
    const rawDescription = normalizeWhitespace(
      Array.from(document.querySelectorAll('.accordion h2, .accordion div'))
        .map((node) => {
          if (node instanceof HTMLAnchorElement) {
            return node.href;
          }
          const hrefs = Array.from(node.querySelectorAll('a[href]')).map((link) => link.href);
          return [node.textContent || '', ...hrefs].join(' ');
        })
        .join('\\n'),
    );

    return {
      title,
      subtitle,
      metaTitle,
      metaDescription,
      priceUsd,
      originalPriceUsd,
      coverImage,
      galleryImages,
      manualUrls,
      rawDescription,
    };
  })()`;
}

function ensureDir(filePath: string) {
  const dirPath = path.dirname(filePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
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

async function loadAllListingCards(page: Page) {
  let lastCount = 0;

  for (let index = 0; index < 10; index += 1) {
    await page.mouse.wheel(0, 1800);
    await page.waitForTimeout(800);

    const currentCount = await page.locator('.grid__item a[href*="/products/"]').count();
    if (currentCount === lastCount) {
      break;
    }

    lastCount = currentCount;
  }

  await page.waitForTimeout(1200);
}

function normalizeDetail(detail: DameProductDetail): DameProductDetail {
  return {
    ...detail,
    coverImage: normalizeAssetUrl(detail.coverImage),
    galleryImages: uniqueStrings(detail.galleryImages.map((value) => normalizeAssetUrl(value)).filter(Boolean)),
    manualUrls: uniqueStrings(detail.manualUrls.map((value) => normalizeAssetUrl(value)).filter(Boolean)),
  };
}

function buildReviewBufferItem(item: DameListItem, detail: DameProductDetail): DameReviewBufferItem | null {
  if (
    !shouldKeepDameCandidate({
      name: detail.title || item.name,
      subtitle: detail.subtitle || item.subtitle,
      rawDescription: detail.rawDescription,
      tags: item.categoryHints,
      mode: 'detail',
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
  items: DameListItem[],
  fetchDetail: (item: DameListItem) => Promise<DameProductDetail>,
): Promise<DameReviewBufferItem[]> {
  const reviewBuffer: DameReviewBufferItem[] = [];

  for (const item of items) {
    try {
      const detail = normalizeDetail(await fetchDetail(item));
      const row = buildReviewBufferItem(item, detail);
      if (row) {
        reviewBuffer.push(row);
      }
    } catch (error) {
      console.warn(`[dame-official] 详情抓取失败，跳过 ${item.sourceUrl}:`, error);
    }
  }

  return reviewBuffer;
}

function writeReviewBuffer(rows: DameReviewBufferItem[]) {
  ensureDir(BUFFER_PATH);
  fs.writeFileSync(BUFFER_PATH, JSON.stringify(rows, null, 2));
}

export async function runCrawler(): Promise<DameReviewBufferItem[]> {
  const session = await createContext();
  const page = await session.context.newPage();

  try {
    await page.goto(LIST_URL, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForTimeout(5_000);
    await loadAllListingCards(page);

    const listItems = mergeUniqueListItems(extractListItemsFromHtml(await page.content())).slice(0, MAX_ITEMS);
    const reviewBuffer = await crawlDetailItems(listItems, async (item) => {
      const detailPage = await session.context.newPage();

      try {
        await detailPage.goto(item.sourceUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 });
        await detailPage.waitForTimeout(2_500);
        return (await detailPage.evaluate(buildDetailExtractionScript())) as DameProductDetail;
      } finally {
        await detailPage.close().catch(() => {});
      }
    });

    writeReviewBuffer(reviewBuffer);
    return reviewBuffer;
  } finally {
    await page.close().catch(() => {});
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
