import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { runCleaner } from './cleaner.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ORIGIN = 'https://www.nomitang.com';
const LIST_URL = `${ORIGIN}/Shop/?order=topseller&p=`;
const MAX_ITEMS = Number(process.env.NOMITANG_OFFICIAL_MAX_ITEMS || '300');
const MAX_PAGES = Number(process.env.NOMITANG_OFFICIAL_MAX_PAGES || '20');
const BUFFER_PATH = path.resolve(__dirname, '../../data/nomitang-official-review-buffer.json');

type GenderHint = 'female' | 'male' | 'unisex';

type ListItem = {
  sourceUrl: string;
  name: string;
  subtitle: string;
  coverImage: string;
  genderHint: GenderHint;
  categoryHints: string[];
  priceUsd: number | null;
  originalPriceUsd: number | null;
  listPosition: number | null;
};

type ProductDetail = {
  title: string;
  subtitle: string;
  metaTitle: string;
  metaDescription: string;
  priceUsd: number | null;
  originalPriceUsd: number | null;
  featureHeadlines: string[];
  specPairs: Array<{ key: string; value: string }>;
  faqItems: string[];
  reviewHighlights: string[];
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

function resolveUrl(input: string): string {
  const value = String(input || '').trim();
  if (!value) return '';
  try {
    return new URL(value, ORIGIN).toString();
  } catch {
    return '';
  }
}

function inferGender(text: string): GenderHint {
  const value = String(text || '').toLowerCase();
  if (
    [
      'couple',
      'partner',
      'shared',
      'unisex',
      'lubricant',
      'lotion',
      'potions',
      'accessory',
      'anal beads',
      'massage oil',
    ].some((hint) => value.includes(hint))
  ) {
    return 'unisex';
  }
  if (
    [
      'male',
      'for him',
      'prostate',
      'penis',
      'cock',
      'masturbator',
      'stroker',
      'p-spot',
    ].some((hint) => value.includes(hint))
  ) {
    return 'male';
  }
  if (
    [
      'female',
      'for her',
      'clit',
      'clitoral',
      'vagina',
      'g-spot',
      'rabbit',
      'kegel',
      'egg',
    ].some((hint) => value.includes(hint))
  ) {
    return 'female';
  }
  return 'unisex';
}

function shouldSkipDetailUrl(url: string): boolean {
  const value = String(url || '').trim();
  if (!value.startsWith(ORIGIN)) return true;
  const pathname = new URL(value).pathname.replace(/\/+$/, '');
  if (!pathname || pathname === '/Shop' || pathname.startsWith('/Shop/')) return true;
  if (
    [
      '/account',
      '/checkout',
      '/wishlist',
      '/search',
      '/Footer',
      '/widgets',
      '/navigation',
      '/cookie',
      '/country',
    ].some((part) => pathname.includes(part))
  ) {
    return true;
  }
  const segments = pathname.split('/').filter(Boolean);
  return segments.length < 2;
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
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(5000);
}

async function extractMaxPage(page: Page): Promise<number> {
  const discovered = await page.evaluate(
    toPageScript(`
      const pageValues = Array.from(document.querySelectorAll('input[name="p"]'))
        .map((node) => Number(node.getAttribute('value') || '0'))
        .filter((v) => Number.isFinite(v) && v > 0);
      return pageValues.length ? Math.max(...pageValues) : 1;
    `),
  );
  const numeric = Number(discovered || 1);
  if (!Number.isFinite(numeric) || numeric < 1) return 1;
  return Math.floor(numeric);
}

async function extractListItemsFromPage(page: Page, pageNo: number): Promise<ListItem[]> {
  const payload = await page.evaluate(
    toPageScript(
      `
      const origin = String(input?.origin || '');
      const currentPage = Number(input?.pageNo || 1);
      const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
      const parsePrice = (value) => {
        const numeric = Number(String(value || '').replace(/[^\d.]+/g, ''));
        return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
      };
      const resolveImageUrl = (image) => {
        if (!image) return '';
        return normalize(
          image.currentSrc ||
            image.src ||
            image.getAttribute('data-src') ||
            image.getAttribute('data-original') ||
            image.getAttribute('data-lazy') ||
            '',
        );
      };
      const cards = Array.from(document.querySelectorAll('.cms-listing-col .product-box, .product-box.box-standard'));
      const seen = new Set();
      const listItems = cards
        .map((card, index) => {
          const primaryAnchor = card.querySelector('a.product-name, a.product-image-link, a[href]');
          const href = primaryAnchor?.href || '';
          const name =
            normalize(card.querySelector('.product-name')?.textContent || '') ||
            normalize(primaryAnchor?.getAttribute('title') || '') ||
            normalize(primaryAnchor?.textContent || '');
          const subtitle =
            normalize(card.querySelector('.product-description')?.textContent || '') ||
            normalize(card.querySelector('.product-variant-characteristics')?.textContent || '');
          const priceText =
            normalize(card.querySelector('.product-price')?.textContent || '') ||
            normalize(card.querySelector('.price')?.textContent || '');
          const originalPriceText =
            normalize(card.querySelector('.list-price-price')?.textContent || '') ||
            normalize(card.querySelector('.product-list-price')?.textContent || '');
          const coverImage = resolveImageUrl(card.querySelector('.product-image-wrapper img, .product-image img, img'));
          const categoryHints = [
            normalize(document.querySelector('h1')?.textContent || ''),
            normalize(document.querySelector('.breadcrumb')?.textContent || ''),
          ].filter(Boolean);

          return {
            sourceUrl: href,
            name,
            subtitle,
            coverImage,
            priceUsd: parsePrice(priceText),
            originalPriceUsd: parsePrice(originalPriceText),
            categoryHints,
            listPosition: (currentPage - 1) * 100 + index + 1,
          };
        })
        .filter((item) => item.sourceUrl.startsWith(origin) && item.name)
        .filter((item) => {
          const cleanUrl = item.sourceUrl.replace(/#.*$/, '');
          if (seen.has(cleanUrl)) return false;
          seen.add(cleanUrl);
          item.sourceUrl = cleanUrl;
          return true;
        });

      return { listItems, cardCount: cards.length };
      `,
      { origin: ORIGIN, pageNo },
    ),
  ) as {
    listItems: Array<Omit<ListItem, 'genderHint'>>;
    cardCount: number;
  };

  console.log(`[列表] 第 ${pageNo} 页解析卡片数: ${Number(payload.cardCount || 0)}`);

  return payload.listItems.map((item) => {
    const genderHint = inferGender(`${item.name}\n${item.subtitle}\n${(item.categoryHints || []).join(' ')}`);
    return {
      ...item,
      genderHint,
    };
  });
}

async function collectListItems(page: Page): Promise<ListItem[]> {
  const itemMap = new Map<string, ListItem>();

  const page1Url = `${LIST_URL}1`;
  console.log(`[列表] 打开第一页: ${page1Url}`);
  await gotoAndSettle(page, page1Url);

  const discoveredMaxPage = await extractMaxPage(page);
  const targetMaxPage = Math.max(1, Math.min(discoveredMaxPage, MAX_PAGES));
  console.log(`[列表] 发现分页上限: ${discoveredMaxPage}，本轮抓取页数: ${targetMaxPage}`);

  for (let pageNo = 1; pageNo <= targetMaxPage; pageNo += 1) {
    const url = `${LIST_URL}${pageNo}`;
    console.log(`[列表] 抓取第 ${pageNo}/${targetMaxPage} 页: ${url}`);
    await gotoAndSettle(page, url);
    const items = await extractListItemsFromPage(page, pageNo);

    let acceptedCount = 0;
    for (const item of items) {
      if (shouldSkipDetailUrl(item.sourceUrl)) continue;
      acceptedCount += 1;

      const existing = itemMap.get(item.sourceUrl);
      if (!existing) {
        itemMap.set(item.sourceUrl, {
          ...item,
          categoryHints: uniqueStrings(item.categoryHints, 8),
        });
        continue;
      }

      existing.name = existing.name || item.name;
      existing.subtitle = existing.subtitle || item.subtitle;
      existing.coverImage = existing.coverImage || item.coverImage;
      existing.priceUsd = existing.priceUsd ?? item.priceUsd;
      existing.originalPriceUsd = existing.originalPriceUsd ?? item.originalPriceUsd;
      existing.listPosition = existing.listPosition ?? item.listPosition;
      existing.categoryHints = uniqueStrings([...(existing.categoryHints || []), ...(item.categoryHints || [])], 8);
    }

    console.log(`[列表] 第 ${pageNo} 页有效详情链接数: ${acceptedCount}`);
    await sleep(300);
  }

  return Array.from(itemMap.values()).filter((item) => item.sourceUrl && item.name);
}

export function buildDetailExtractionScript(): string {
  return toPageScript(`
    const normalize = (value) =>
      String(value || '')
        .replace(/\\u00a0/g, ' ')
        .replace(/\\s+/g, ' ')
        .trim();

    const uniqueStrings = (values, limit = 60) => {
      const seen = new Set();
      const result = [];
      for (const value of values) {
        const normalized = normalize(String(value || ''));
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        result.push(normalized);
        if (result.length >= limit) break;
      }
      return result;
    };

    const parsePrice = (value) => {
      const numeric = Number(String(value || '').replace(/[^\\d.]+/g, ''));
      return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
    };

    const meta = (selector) =>
      normalize(document.querySelector(selector)?.content || '');
    const h1Text = normalize(document.querySelector('h1')?.textContent || '');

    const rawDescriptionBlocks = uniqueStrings(
      Array.from(
        document.querySelectorAll(
          '.product-detail-description, .tab-pane, .product-detail-tabs-content, .product-detail-properties, .product-detail-buy',
        ),
      )
        .map((el) => normalize(el.textContent || ''))
        .filter((text) => text.length >= 40),
      24,
    );

    const specPairs = uniqueStrings(
      rawDescriptionBlocks
        .flatMap((text) => text.split(/\\n|\\s{2,}/g))
        .map((line) => normalize(line)),
      120,
    )
      .map((line) => {
        const matched = line.match(/^([A-Za-z][A-Za-z0-9\\s\\-]{1,30})\\s*[:：]\\s*(.{1,120})$/);
        if (!matched) return null;
        return { key: normalize(matched[1]), value: normalize(matched[2]) };
      })
      .filter((item) => Boolean(item && item.key && item.value))
      .slice(0, 40);

    const featureHeadlines = uniqueStrings(
      Array.from(document.querySelectorAll('h2, h3, .product-detail-description strong'))
        .map((el) => normalize(el.textContent || ''))
        .filter((text) => text.length >= 6),
      24,
    );

    const faqItems = uniqueStrings(
      Array.from(document.querySelectorAll('.product-detail-tabs-content h3, .product-detail-tabs-content h4'))
        .map((el) => normalize(el.textContent || ''))
        .filter((text) => {
          const t = text.toLowerCase();
          return (
            text.includes('?') ||
            t.includes('how ') ||
            t.includes('what ') ||
            t.includes('why ') ||
            t.includes('can ') ||
            t.includes('is ')
          );
        }),
      12,
    );

    const reviewHighlights = uniqueStrings(
      Array.from(
        document.querySelectorAll('.product-detail-tabs-content p, .product-detail-description p, .product-detail-description li'),
      )
        .map((el) => normalize(el.textContent || ''))
        .filter((text) => text.length >= 40)
        .filter((text) =>
          /(vibration|quiet|comfortable|powerful|waterproof|rechargeable|g-spot|clitoris|prostate|penetrat|anal|massage)/i.test(
            text,
          ),
        ),
      10,
    );

    const bodySummary = uniqueStrings(
      rawDescriptionBlocks
        .flatMap((text) => text.split(/(?<=[.!?])\\s+/g))
        .map((line) => normalize(line))
        .filter((line) => line.length >= 30),
      36,
    ).join('\\n');

    const imageUrls = uniqueStrings(
      Array.from(document.querySelectorAll('.product-detail-media img, .gallery-slider-image img, .product-image img, img'))
        .map((image) => image.currentSrc || image.src || image.getAttribute('src') || '')
        .filter(Boolean)
        .filter((url) => /^https:\\/\\/www\\.nomitang\\.com\\//i.test(url)),
      80,
    );

    const priceCandidates = uniqueStrings(
      [
        normalize(document.querySelector('.product-detail-price')?.textContent || ''),
        normalize(document.querySelector('.price')?.textContent || ''),
        ...Array.from(document.querySelectorAll('.product-price, .listing .price')).map((el) => normalize(el.textContent || '')),
      ],
      10,
    );

    const originalPriceCandidates = uniqueStrings(
      [
        normalize(document.querySelector('.list-price-price')?.textContent || ''),
        normalize(document.querySelector('.product-list-price')?.textContent || ''),
      ],
      10,
    );

    const productCode = normalize(
      document.querySelector('.product-detail-ordernumber')?.textContent ||
        document.querySelector('[itemprop="sku"]')?.textContent ||
        '',
    );

    return {
      title: h1Text,
      subtitle: meta('meta[name="description"]') || '',
      metaTitle: meta('meta[property="og:title"]') || meta('meta[name="title"]') || '',
      metaDescription: meta('meta[property="og:description"]') || meta('meta[name="description"]') || '',
      priceUsd: parsePrice(priceCandidates.find((x) => /\\$|USD|US\\$/i.test(x)) || ''),
      originalPriceUsd: parsePrice(originalPriceCandidates.find((x) => /\\$|USD|US\\$/i.test(x)) || ''),
      featureHeadlines,
      specPairs,
      faqItems,
      reviewHighlights,
      bodySummary,
      coverImage: imageUrls[0] || '',
      imageUrls,
      productCode,
      appSupport: /(app|remote|bluetooth)/i.test([h1Text, bodySummary, meta('meta[name="description"]')].join('\\n')),
    };
  `);
}

async function extractDetail(page: Page, fallback: ListItem): Promise<ProductDetail | null> {
  const detail = (await page.evaluate(buildDetailExtractionScript())) as ProductDetail;

  const resolvedTitle = normalizeWhitespace(detail.title || fallback.name);
  if (!resolvedTitle || resolvedTitle.toLowerCase().includes('page not found')) return null;

  return {
    title: resolvedTitle,
    subtitle: normalizeWhitespace(detail.subtitle || fallback.subtitle),
    metaTitle: normalizeWhitespace(detail.metaTitle),
    metaDescription: normalizeWhitespace(detail.metaDescription),
    priceUsd: detail.priceUsd ?? fallback.priceUsd,
    originalPriceUsd: detail.originalPriceUsd ?? fallback.originalPriceUsd,
    featureHeadlines: uniqueStrings(detail.featureHeadlines, 24),
    specPairs: detail.specPairs
      .map((item) => ({ key: normalizeWhitespace(item.key), value: normalizeWhitespace(item.value) }))
      .filter((item) => item.key && item.value),
    faqItems: uniqueStrings(detail.faqItems, 12),
    reviewHighlights: uniqueStrings(detail.reviewHighlights, 10),
    bodySummary: normalizeWhitespace(detail.bodySummary),
    coverImage: resolveUrl(detail.coverImage) || fallback.coverImage,
    imageUrls: uniqueStrings(detail.imageUrls.map((url) => resolveUrl(url)).filter(Boolean), 80),
    productCode: normalizeWhitespace(detail.productCode),
    appSupport: Boolean(detail.appSupport),
  };
}

function buildRawDescription(item: ListItem, detail: ProductDetail): string {
  const sections = [
    '[基础信息]',
    `商品名: ${detail.title || item.name}`,
    detail.subtitle ? `副标题: ${detail.subtitle}` : '',
    detail.metaTitle ? `页面标题: ${detail.metaTitle}` : '',
    detail.metaDescription ? `页面描述: ${detail.metaDescription}` : '',
    detail.priceUsd ? `页面价格(USD): ${detail.priceUsd}` : '',
    detail.originalPriceUsd ? `划线价格(USD): ${detail.originalPriceUsd}` : '',
    item.categoryHints.length ? `站内分类提示: ${item.categoryHints.join(' | ')}` : '',
    `性别提示: ${item.genderHint}`,
    detail.productCode ? `产品代码: ${detail.productCode}` : '',
    `APP支持: ${detail.appSupport ? 'Yes' : 'No'}`,
    '',
    detail.specPairs.length ? '[规格参数]' : '',
    ...detail.specPairs.map((entry) => `${entry.key}: ${entry.value}`),
    '',
    detail.featureHeadlines.length ? '[卖点摘要]' : '',
    ...detail.featureHeadlines,
    '',
    detail.bodySummary ? '[英文正文摘录]' : '',
    detail.bodySummary,
    '',
    detail.faqItems.length ? '[FAQ]' : '',
    ...detail.faqItems,
    '',
    detail.reviewHighlights.length ? '[评论亮点]' : '',
    ...detail.reviewHighlights,
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
  console.log('--- 启动 nomiTang 官方站抓取任务 ---');
  console.log(`[列表] 入口: ${LIST_URL}1`);

  const context = await createContext();
  const page = await context.newPage();

  try {
    const listItems = await collectListItems(page);
    console.log(`[列表] 去重后候选商品数: ${listItems.length}`);

    if (listItems.length === 0) {
      throw new Error('nomiTang 官方站未解析到任何商品链接。');
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

        const detailImageUrls = uniqueStrings([detail.coverImage, ...detail.imageUrls], 80);
        const rawDescription = buildRawDescription(item, detail);
        const resolvedGender = inferGender(`${item.name}\n${item.subtitle}\n${item.categoryHints.join('\n')}\n${rawDescription}`);

        const record = {
          sourceUrl: item.sourceUrl,
          name: detail.title || item.name,
          price: detail.priceUsd ?? item.priceUsd ?? null,
          priceUsd: detail.priceUsd ?? item.priceUsd ?? null,
          originalPriceUsd: detail.originalPriceUsd ?? item.originalPriceUsd ?? null,
          priceCurrency: 'USD',
          coverImage: detail.coverImage || item.coverImage || '',
          genderHint: resolvedGender,
          categoryHints: uniqueStrings(item.categoryHints, 10),
          rawDescription,
          detailImageUrls,
          imagePlaceholder: 'bg-gradient-to-br from-rose-900/40 to-slate-900/40',
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

    console.log(`\n--- nomiTang 官方站抓取结束，共写入 ${bufferData.length} 条 ---`);
    console.log(`[缓冲] ${BUFFER_PATH}`);

    try {
      await runCleaner();
    } catch (error) {
      console.error('[致命错误] cleaner 执行失败:', error);
    }
  } finally {
    await context.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCrawler().catch((error) => {
    console.error('[致命错误] nomiTang 官方站抓取进程崩溃:', error);
  });
}
