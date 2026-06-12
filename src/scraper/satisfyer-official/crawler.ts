import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { runCleaner } from './cleaner.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_LIST_URL = 'https://us.satisfyer.com/us/products';
const LIST_URL_BASE = String(process.env.SATISFYER_OFFICIAL_LIST_URL || DEFAULT_LIST_URL).replace(/[?&]p=\d+$/i, '');
const ORIGIN = new URL(LIST_URL_BASE).origin;
const MAX_ITEMS = Number(process.env.SATISFYER_OFFICIAL_MAX_ITEMS || '200');
const MAX_PAGES = Number(process.env.SATISFYER_OFFICIAL_MAX_PAGES || '26');
const MAX_SCROLL_ROUNDS = Number(process.env.SATISFYER_OFFICIAL_SCROLL_ROUNDS || '24');
const BUFFER_PATH = path.resolve(__dirname, '../../data/satisfyer-official-review-buffer.json');
const IMAGE_PLACEHOLDER = 'bg-gradient-to-br from-zinc-950/50 to-rose-900/30';

type GenderHint = 'female' | 'male' | 'unisex';

type ListItem = {
  sourceUrl: string;
  name: string;
  coverImage: string;
  genderHint: GenderHint;
  categoryHints: string[];
  priceUsd: number | null;
  originalPriceUsd: number | null;
  listPosition: number | null;
};

type DetailPayload = {
  title: string;
  metaTitle: string;
  metaDescription: string;
  primaryPriceText: string;
  originalPriceText: string;
  extraPriceTexts: string[];
  priceCurrency: string;
  tabContents: string[];
  bodyText: string;
  imageUrls: string[];
};

type ProductDetail = {
  title: string;
  subtitle: string;
  metaTitle: string;
  metaDescription: string;
  priceUsd: number | null;
  originalPriceUsd: number | null;
  priceCurrency: string;
  featureHeadlines: string[];
  specPairs: Array<{ key: string; value: string }>;
  bodySummary: string;
  coverImage: string;
  imageUrls: string[];
  productCode: string;
  appSupport: boolean;
};

function toPageScript<T>(script: string, payload?: T): string {
  if (payload === undefined) return `(() => {\n${script}\n})()`;
  return `((input) => {\n${script}\n})(${JSON.stringify(payload)})`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function normalizeWhitespace(value: string): string {
  return String(value || '')
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
    const normalized = normalizeWhitespace(String(value || ''));
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= limit) break;
  }
  return result;
}

function parseNumber(value: unknown): number | null {
  const raw = String(value ?? '').trim();
  const normalized = raw.includes(',') && !raw.includes('.')
    ? raw.replace(/[^\d,]+/g, '').replace(',', '.')
    : raw.replace(/[^\d.]+/g, '');
  const numeric = Number(normalized);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function resolveUrl(input: string): string {
  const value = String(input || '').trim();
  if (!value) return '';
  try {
    return new URL(value, ORIGIN).toString();
  } catch {
    return '';
  }
}

function buildListUrl(pageNo: number): string {
  const url = new URL(LIST_URL_BASE, ORIGIN);
  url.searchParams.set('p', String(pageNo));
  return url.toString();
}

function extractFirstSrcsetUrl(input: string): string {
  const match = String(input || '')
    .split(',')
    .map((segment) => segment.trim().split(/\s+/)[0])
    .find(Boolean);
  return match ? resolveUrl(match) : '';
}

function inferGender(text: string): GenderHint {
  const value = String(text || '').toLowerCase();
  if (
    [
      'couple',
      'partner',
      'shared',
      'unisex',
      'for couples',
      'remote play',
    ].some((hint) => value.includes(hint))
  ) {
    return 'unisex';
  }
  if (
    [
      'male',
      'for him',
      '\x70enis',
      '\x63ock ring',
      'prostate',
      'stroker',
      '\x6dasturbator',
    ].some((hint) => value.includes(hint))
  ) {
    return 'male';
  }
  if (
    [
      'female',
      'for her',
      '\x63litoris',
      '\x63litoral',
      'g-spot',
      'rabbit',
      'vaginal',
      'egg',
      'air-pulse',
    ].some((hint) => value.includes(hint))
  ) {
    return 'female';
  }
  return 'unisex';
}

function buildImageMatchTokens(item: ListItem): string[] {
  const pathname = (() => {
    try {
      return new URL(item.sourceUrl).pathname;
    } catch {
      return '';
    }
  })();
  const slugTokens = pathname
    .split('/')
    .filter(Boolean)
    .pop()
    ?.split('-')
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token && token.length >= 2 && !['us', 'satisfyer', 'for'].includes(token));

  const nameTokens = item.name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token && token.length >= 2 && !['satisfyer', 'for'].includes(token));

  return uniqueStrings([...(slugTokens || []), ...nameTokens], 12);
}

function isRelevantProductImage(url: string, item: ListItem): boolean {
  const value = String(url || '').toLowerCase();
  if (!value) return false;
  if (
    [
      'logo',
      'signtm',
      'sidebar-paypal',
      '/vector/',
      'treasure-bag',
      'lubricant',
      'gentle-',
      'usb-charging-cables',
      'user-manual',
    ].some((fragment) => value.includes(fragment))
  ) {
    return false;
  }

  const matchTokens = buildImageMatchTokens(item);
  const hits = matchTokens.filter((token) => value.includes(token));
  return hits.length >= Math.min(2, matchTokens.length);
}

async function createContext(): Promise<BrowserContext> {
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

  return context;
}

async function gotoAndSettle(page: Page, url: string) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForTimeout(5000);
      return;
    } catch (error) {
      lastError = error;
      if (attempt === 4) break;
      console.warn(`[导航] 第 ${attempt} 次打开失败，稍后重试: ${url}`, error);
      await page.waitForTimeout(1500 * attempt);
    }
  }
  throw lastError;
}

async function ensureListExpanded(page: Page) {
  let lastCount = -1;
  let stableRounds = 0;

  for (let attempt = 0; attempt < MAX_SCROLL_ROUNDS; attempt += 1) {
    const currentCount = await page.locator('.listing .product--box').count();
    if (currentCount >= MAX_ITEMS) return;

    const loadMoreLocator = page
      .locator(
        [
          '.infinite--actions button',
          '.infinite--actions a',
          '.listing--actions button',
          '.listing--actions a',
          'button:has-text("Load more")',
          'a:has-text("Load more")',
          'button:has-text("Load more articles")',
          'a:has-text("Load more articles")',
        ].join(', '),
      )
      .first();
    const hasLoadMoreButton = await loadMoreLocator.isVisible().catch(() => false);

    if (hasLoadMoreButton) {
      await loadMoreLocator.click({ timeout: 6000 }).catch(() => undefined);
      await page.waitForTimeout(1800);
    } else {
      await page.mouse.wheel(0, 2400);
      await page.waitForTimeout(1200);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => undefined);
      await page.waitForTimeout(1200);
    }

    const nextCount = await page.locator('.listing .product--box').count();
    if (nextCount <= lastCount || nextCount === currentCount) {
      stableRounds += 1;
    } else {
      stableRounds = 0;
    }
    lastCount = Math.max(currentCount, nextCount);

    if (!hasLoadMoreButton && stableRounds >= 3) return;
  }
}

async function extractMaxPages(page: Page): Promise<number> {
  const discovered = await page.evaluate(
    toPageScript(`
      const listing = document.querySelector('.listing[data-infinite-scrolling="true"]');
      const totalPages = Number(listing?.getAttribute('data-pages') || '1');
      return Number.isFinite(totalPages) && totalPages > 0 ? totalPages : 1;
    `),
  );
  const numeric = Number(discovered || 1);
  if (!Number.isFinite(numeric) || numeric < 1) return 1;
  return Math.min(Math.floor(numeric), MAX_PAGES);
}

async function extractListItemsFromPage(page: Page, pageNo: number): Promise<ListItem[]> {
  const payload = await page.evaluate(
    toPageScript(
      `
      const origin = String(input?.origin || '');
      const pageNumber = Number(input?.pageNo || 1);
      const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
      const parsePrice = (value) => {
        const numeric = Number(String(value || '').replace(/[^\\d.]+/g, ''));
        return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
      };
      const resolveUrl = (value) => {
        try {
          return new URL(String(value || '').trim(), origin).toString();
        } catch {
          return '';
        }
      };
      const resolveImage = (img) => {
        if (!img) return '';
        const current = normalize(img.currentSrc || img.src || '');
        if (current) return current;
        const srcset = normalize(img.getAttribute('srcset') || '');
        if (!srcset) return '';
        const first = srcset.split(',').map((entry) => entry.trim().split(/\\s+/)[0]).find(Boolean);
        return normalize(first || '');
      };
      const chooseDetailHref = (card) => {
        const anchors = Array.from(
          card.querySelectorAll('a.product--image[href], a.product--title[href], .product--btn-container a[href], a[href]')
        );
        for (const anchor of anchors) {
          const href = resolveUrl(anchor.getAttribute('href') || anchor.href || '');
          if (!href) continue;
          if (href.includes('/note/add/')) continue;
          if (!href.startsWith(origin + '/')) continue;
          if (/\\/products\\/?(?:[?#]|$)/i.test(new URL(href).pathname)) continue;
          return href;
        }
        return '';
      };
      const cards = Array.from(document.querySelectorAll('.listing .product--box'));
      return cards
        .map((card, index) => {
          const href = chooseDetailHref(card);
          const titleAnchor = card.querySelector('a.product--title[href], .product--btn-container a[href], a[href]');
          const image = card.querySelector('img');
          const priceText =
            normalize(card.querySelector('.product--price .price--default')?.textContent || '') ||
            normalize(card.querySelector('.product--price.price--default')?.textContent || '') ||
            normalize(card.querySelector('.product--price')?.textContent || '');
          const originalPriceText =
            normalize(card.querySelector('.price--discount .content--list-price')?.textContent || '') ||
            normalize(card.querySelector('.price--discount')?.textContent || '');
          const badgeTexts = Array.from(card.querySelectorAll('.product--badge, .product--badges *'))
            .map((node) => normalize(node.textContent || ''))
            .filter(Boolean);
          const name =
            normalize(card.querySelector('a.product--title')?.textContent || '') ||
            normalize(titleAnchor?.getAttribute('title') || '') ||
            normalize(titleAnchor?.textContent || '');
          return {
            sourceUrl: href,
            name,
            coverImage: resolveImage(image),
            categoryHints: Array.from(new Set(badgeTexts)).slice(0, 6),
            priceUsd: parsePrice(priceText),
            originalPriceUsd: parsePrice(originalPriceText),
            listPosition: (pageNumber - 1) * cards.length + index + 1,
          };
        })
        .filter((item) => item.sourceUrl && item.name);
      `,
      { origin: ORIGIN, pageNo },
    ),
  );

  const rows = Array.isArray(payload) ? payload : [];
  return rows.map((row) => {
    const sourceUrl = resolveUrl(String(row.sourceUrl || ''));
    const name = normalizeWhitespace(String(row.name || ''));
    const categoryHints = uniqueStrings(Array.isArray(row.categoryHints) ? row.categoryHints.map(String) : [], 6);
    const genderHint = inferGender(`${name}\n${categoryHints.join('\n')}`);
    return {
      sourceUrl,
      name,
      coverImage: resolveUrl(String(row.coverImage || '')) || extractFirstSrcsetUrl(String(row.coverImage || '')),
      genderHint,
      categoryHints,
      priceUsd: parseNumber(row.priceUsd),
      originalPriceUsd: parseNumber(row.originalPriceUsd),
      listPosition: parseNumber(row.listPosition),
    };
  });
}

async function collectListItems(page: Page): Promise<ListItem[]> {
  await gotoAndSettle(page, buildListUrl(1));
  await ensureListExpanded(page);
  const discoveredPages = await extractMaxPages(page);
  const totalPages = Math.min(discoveredPages, MAX_PAGES);
  console.log(`[列表] 探测到页数: ${totalPages}`);

  const seen = new Set<string>();
  const listItems: ListItem[] = [];

  for (let pageNo = 1; pageNo <= totalPages; pageNo += 1) {
    try {
      await gotoAndSettle(page, buildListUrl(pageNo));
    } catch (error) {
      if (listItems.length > 0) {
        console.warn(`[列表] p=${pageNo} 打开失败，已保留前序 ${listItems.length} 个候选，停止继续翻页。`, error);
        break;
      }
      throw error;
    }
    await ensureListExpanded(page);
    const pageItems = await extractListItemsFromPage(page, pageNo);
    console.log(`[列表] p=${pageNo} 解析到 ${pageItems.length} 个商品卡片`);

    for (const item of pageItems) {
      if (!item.sourceUrl || seen.has(item.sourceUrl)) continue;
      seen.add(item.sourceUrl);
      listItems.push(item);
      if (listItems.length >= MAX_ITEMS) return listItems;
    }
  }

  return listItems;
}

function extractPrimaryPrice(detailPayload: DetailPayload): { priceUsd: number | null; originalPriceUsd: number | null } {
  const primaryPrice = parseNumber(detailPayload.primaryPriceText);
  const originalPrice = parseNumber(detailPayload.originalPriceText);
  if (primaryPrice !== null) {
    return {
      priceUsd: primaryPrice,
      originalPriceUsd: originalPrice && originalPrice > primaryPrice ? originalPrice : null,
    };
  }

  const numbers = detailPayload.extraPriceTexts
    .map((text) => parseNumber(text))
    .filter((value): value is number => value !== null);
  if (numbers.length === 0) return { priceUsd: null, originalPriceUsd: null };
  if (numbers.length === 1) return { priceUsd: numbers[0], originalPriceUsd: null };
  const sorted = [...numbers].sort((a, b) => b - a);
  return {
    priceUsd: sorted[0],
    originalPriceUsd: sorted[1] && sorted[1] > sorted[0] ? sorted[1] : null,
  };
}

function cleanTabHeading(value: string, productName: string): string {
  return normalizeWhitespace(
    String(value || '')
      .replace(/^Close menu\s*/i, '')
      .replace(new RegExp(`^Product information\\s*"${productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*`, 'i'), '')
      .replace(new RegExp(`^Properties\\s*"${productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*`, 'i'), '')
      .replace(new RegExp(`^Customer reviews for\\s*"${productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*`, 'i'), '')
      .trim(),
  );
}

function extractSpecPairsFromText(value: string): Array<{ key: string; value: string }> {
  const labels = [
    'Material',
    'Width',
    'Height',
    'Weight',
    'Length',
    'Color',
    'Suitable for',
    'Stimulation',
    'With vibration',
    'Battery',
    'Waterproof',
    'Product type',
    'Special features',
    'Article no.',
    'Article no',
    'Charging time',
    'Running time',
  ];
  const escapedLabels = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(
    `(${escapedLabels.join('|')})\\s*:\\s*([\\s\\S]*?)(?=(?:${escapedLabels.join('|')})\\s*:|$)`,
    'gi',
  );

  const pairs: Array<{ key: string; value: string }> = [];
  for (const match of value.matchAll(pattern)) {
    const key = normalizeWhitespace(match[1]);
    const val = normalizeWhitespace(match[2]);
    if (!key || !val) continue;
    pairs.push({ key, value: val });
  }
  return pairs;
}

function extractFeatureHeadlines(text: string): string[] {
  const sentences = normalizeWhitespace(text)
    .split(/(?<=[.!?])\s+/)
    .map((line) => normalizeWhitespace(line))
    .filter((line) => line.length >= 18 && line.length <= 220);
  return uniqueStrings(sentences, 8);
}

async function extractDetail(page: Page, fallback: ListItem): Promise<ProductDetail | null> {
  const payload = await page.evaluate(
    toPageScript(
      `
      const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
      const unique = (values) => Array.from(new Set(values.filter(Boolean)));
      const getImageUrl = (img) => {
        if (!img) return '';
        const current = normalize(img.currentSrc || img.src || img.getAttribute('data-src') || '');
        if (current) return current;
        const srcset = normalize(img.getAttribute('srcset') || '');
        if (!srcset) return '';
        return normalize(srcset.split(',').map((entry) => entry.trim().split(/\\s+/)[0]).find(Boolean) || '');
      };
      const tabContents = Array.from(document.querySelectorAll('.tab--content'))
        .map((node) => normalize(node.textContent || ''))
        .filter(Boolean);
      const images = unique(
        Array.from(document.querySelectorAll('img'))
          .map((img) => getImageUrl(img))
          .filter((url) => url && /satisfyer|imb-images|media\\/image/i.test(url))
      );
      const title =
        normalize(document.querySelector('h1.product--title')?.textContent || '') ||
        normalize(document.querySelector('h1')?.textContent || '');
      const metaDescription = normalize(document.querySelector('meta[name="description"]')?.getAttribute('content') || '');
      const primaryPriceText = normalize(
        document.querySelector(
          '.product--buybox .product--price.price--default, .buybox--inner .product--price.price--default, .content--product .product--price.price--default, .product--price.price--default'
        )?.textContent || ''
      );
      const originalPriceText = normalize(
        document.querySelector(
          '.product--buybox .content--list-price, .buybox--inner .content--list-price, .product--buybox .price--discount, .buybox--inner .price--discount'
        )?.textContent || ''
      );
      const extraPriceTexts = unique(
        Array.from(document.querySelectorAll('.product--price.price--default, .buybox--price .product--price, .product--price'))
          .map((node) => normalize(node.textContent || ''))
          .filter(Boolean)
      ).slice(0, 6);
      const pageHtml = document.documentElement?.innerHTML || '';
      const metaProductPrice = normalize(document.querySelector('meta[property="product:price"]')?.getAttribute('content') || '');
      const dataLayerProductPrice = normalize(pageHtml.match(/"productPrice"\\s*:\\s*"([^"]+)"/)?.[1] || '');
      const dataLayerValuePrice = normalize(pageHtml.match(/"value"\\s*:\\s*"([^"]+)"/)?.[1] || '');
      const productCurrency =
        normalize(pageHtml.match(/"productCurrency"\\s*:\\s*"([^"]+)"/)?.[1] || '') ||
        normalize(pageHtml.match(/"currency"\\s*:\\s*"([^"]+)"/)?.[1] || '');
      return {
        title,
        metaTitle: normalize(document.title || ''),
        metaDescription,
        primaryPriceText: primaryPriceText || metaProductPrice || dataLayerProductPrice || dataLayerValuePrice,
        originalPriceText,
        extraPriceTexts: unique([metaProductPrice, dataLayerProductPrice, dataLayerValuePrice, ...extraPriceTexts]).slice(0, 8),
        priceCurrency: productCurrency,
        tabContents,
        bodyText: normalize(document.body?.innerText || ''),
        imageUrls: images.slice(0, 40),
      };
      `,
    ),
  );

  if (!payload || typeof payload !== 'object') return null;

  const detailPayload = payload as DetailPayload;
  const title = normalizeWhitespace(detailPayload.title) || fallback.name;
  if (!title) return null;

  const infoTab =
    detailPayload.tabContents.find((text) => /product information/i.test(text)) || detailPayload.tabContents[0] || '';
  const propertiesTab = detailPayload.tabContents.find((text) => /properties/i.test(text)) || '';
  const bodySummary = cleanTabHeading(infoTab, title);
  const specPairs = extractSpecPairsFromText(cleanTabHeading(propertiesTab, title));
  const { priceUsd, originalPriceUsd } = extractPrimaryPrice(detailPayload);
  const productCode =
    specPairs.find((pair) => /article no/i.test(pair.key))?.value ||
    normalizeWhitespace(detailPayload.bodyText.match(/\bSW\d+(?:\.\d+)?\b/i)?.[0] || '');

  const categoryHints = uniqueStrings([
    ...fallback.categoryHints,
    specPairs.find((pair) => /suitable for/i.test(pair.key))?.value || '',
    specPairs.find((pair) => /stimulation/i.test(pair.key))?.value || '',
    specPairs.find((pair) => /product type/i.test(pair.key))?.value || '',
  ]);

  const resolvedImageUrls = uniqueStrings(
    detailPayload.imageUrls.map((url) => resolveUrl(url)).filter((url) => isRelevantProductImage(url, fallback)),
    16,
  );

  return {
    title,
    subtitle: categoryHints.join(' | '),
    metaTitle: normalizeWhitespace(detailPayload.metaTitle),
    metaDescription: normalizeWhitespace(detailPayload.metaDescription),
    priceUsd: priceUsd ?? fallback.priceUsd,
    originalPriceUsd: originalPriceUsd ?? fallback.originalPriceUsd,
    priceCurrency: normalizeWhitespace(detailPayload.priceCurrency || 'USD').toUpperCase(),
    featureHeadlines: extractFeatureHeadlines(bodySummary || detailPayload.metaDescription),
    specPairs,
    bodySummary,
    coverImage: fallback.coverImage || resolvedImageUrls[0] || resolveUrl(detailPayload.imageUrls[0] || ''),
    imageUrls: resolvedImageUrls,
    productCode,
    appSupport: /connect app|remotyca|app control|app-enabled/i.test(
      `${detailPayload.metaTitle}\n${detailPayload.metaDescription}\n${detailPayload.bodyText}`,
    ),
  };
}

function buildRawDescription(item: ListItem, detail: ProductDetail, resolvedGender: GenderHint): string {
  const sections = [
    '[基础信息]',
    `商品名: ${detail.title || item.name}`,
    detail.subtitle ? `副标题: ${detail.subtitle}` : '',
    detail.metaTitle ? `页面标题: ${detail.metaTitle}` : '',
    detail.metaDescription ? `页面描述: ${detail.metaDescription}` : '',
    detail.priceUsd ? `页面价格(${detail.priceCurrency || 'USD'}): ${detail.priceUsd}` : '',
    detail.originalPriceUsd ? `划线价格(${detail.priceCurrency || 'USD'}): ${detail.originalPriceUsd}` : '',
    item.categoryHints.length ? `站内分类提示: ${item.categoryHints.join(' | ')}` : '',
    `性别提示: ${resolvedGender}`,
    detail.productCode ? `产品代码: ${detail.productCode}` : '',
    `APP支持: ${detail.appSupport ? 'Yes' : 'No'}`,
    '',
    detail.specPairs.length ? '[规格参数]' : '',
    ...detail.specPairs.map((pair) => `${pair.key}: ${pair.value}`),
    '',
    detail.featureHeadlines.length ? '[卖点摘要]' : '',
    ...detail.featureHeadlines,
    '',
    detail.bodySummary ? '[英文正文摘录]' : '',
    detail.bodySummary,
  ]
    .filter(Boolean)
    .join('\n');

  return sections.slice(0, 18000).trim();
}

function persistBuffer(bufferData: unknown[]) {
  ensureDir(BUFFER_PATH);
  fs.writeFileSync(BUFFER_PATH, JSON.stringify(bufferData, null, 2));
}

export async function runCrawler() {
  console.log('--- 启动 Satisfyer 官方站抓取任务 ---');
  console.log(`[列表] 入口: ${buildListUrl(1)}`);

  const context = await createContext();
  const page = await context.newPage();

  try {
    const listItems = await collectListItems(page);
    console.log(`[列表] 去重后候选商品数: ${listItems.length}`);

    if (listItems.length === 0) {
      throw new Error('Satisfyer 官方站未解析到任何商品链接。');
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
        await gotoAndSettle(page, item.sourceUrl);
        const detail = await extractDetail(page, item);
        if (!detail) {
          console.warn(`[跳过] 未识别为有效商品详情页: ${item.sourceUrl}`);
          continue;
        }

        const detailImageUrls = uniqueStrings([detail.coverImage, ...detail.imageUrls], 60);
        const resolvedGender = inferGender(
          `${detail.title}\n${detail.subtitle}\n${item.categoryHints.join('\n')}\n${detail.metaTitle}\n${detail.metaDescription}\n${detail.bodySummary}`,
        );
        const rawDescription = buildRawDescription(item, detail, resolvedGender);

        const record = {
          sourceUrl: item.sourceUrl,
          name: detail.title || item.name,
          price: detail.priceUsd ?? item.priceUsd ?? null,
          priceUsd: detail.priceUsd ?? item.priceUsd ?? null,
          originalPriceUsd: detail.originalPriceUsd ?? item.originalPriceUsd ?? null,
          priceCurrency: detail.priceCurrency || 'USD',
          coverImage: detail.coverImage || item.coverImage || '',
          genderHint: resolvedGender,
          categoryHints: uniqueStrings(item.categoryHints, 8),
          rawDescription,
          detailImageUrls,
          imagePlaceholder: IMAGE_PLACEHOLDER,
          isReviewed: false,
        };

        bufferData.push(record);
        persistBuffer(bufferData);

        console.log(`[抓取] 已写入缓冲: ${record.name} | priceUsd=${record.priceUsd ?? 'null'} | images=${detailImageUrls.length}`);
        await sleep(350);
      } catch (error) {
        console.error(`[故障] 详情抓取失败: ${item.sourceUrl}`, error);
      }
    }

    console.log(`\n--- Satisfyer 官方站抓取结束，共写入 ${bufferData.length} 条 ---`);
    console.log(`[缓冲] ${BUFFER_PATH}`);

    if (process.env.SATISFYER_OFFICIAL_SKIP_CLEANER === '1') {
      console.log('[清洗] 已按 SATISFYER_OFFICIAL_SKIP_CLEANER=1 跳过旧 cleaner。');
    } else {
      try {
        await runCleaner();
      } catch (error) {
        console.error('[致命错误] cleaner 执行失败:', error);
      }
    }
  } finally {
    await context.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCrawler().catch((error) => {
    console.error('[致命错误] Satisfyer 官方站抓取进程崩溃:', error);
  });
}
