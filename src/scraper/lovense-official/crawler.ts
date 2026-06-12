import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { runCleaner } from './cleaner.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ORIGIN = 'https://www.lovense.com';
const MAX_ITEMS = Number(process.env.LOVENSE_OFFICIAL_MAX_ITEMS || '200');
const BUFFER_PATH = path.resolve(__dirname, '../../data/lovense-official-review-buffer.json');
const STORE_DEVICE_LIST_SELECTOR = '.\x74oy_list._store\x54oyList';

const LIST_PAGE_CONFIGS = [
  {
    url: 'https://www.lovense.com/store/\x73ex-toys-for-women',
    label: 'Sex Toys for Women',
    genderHint: 'female',
  },
  {
    url: 'https://www.lovense.com/store/\x73ex-toys-for-men',
    label: 'Sex Toys for Men',
    genderHint: 'male',
  },
  {
    url: 'https://www.lovense.com/store/\x73ex-toys-for-couples',
    label: 'Sex Toys for Couples',
    genderHint: 'unisex',
  },
] as const;

type GenderHint = 'female' | 'male' | 'unisex';

type ListPageConfig = {
  url: string;
  label: string;
  genderHint: GenderHint;
};

function resolveListPageConfigs(): readonly ListPageConfig[] {
  const targetUrl = String(process.env.LOVENSE_OFFICIAL_LIST_URL || '').trim();
  const target = String(process.env.LOVENSE_OFFICIAL_TARGET || '').trim().toLowerCase();

  if (targetUrl) {
    const inferredGenderHint: GenderHint =
      /women|female|for-her/i.test(targetUrl)
        ? 'female'
        : /men|male|for-him/i.test(targetUrl)
          ? 'male'
          : 'unisex';
    const knownConfig = LIST_PAGE_CONFIGS.find((config) => config.url === targetUrl);
    return [
      knownConfig ?? {
        url: targetUrl,
        label: target || 'Lovense Target List',
        genderHint: inferredGenderHint,
      },
    ];
  }

  if (['women', 'female', 'for-women'].includes(target)) {
    return LIST_PAGE_CONFIGS.filter((config) => config.genderHint === 'female');
  }
  if (['men', 'male', 'for-men'].includes(target)) {
    return LIST_PAGE_CONFIGS.filter((config) => config.genderHint === 'male');
  }
  if (['couples', 'couple', 'unisex'].includes(target)) {
    return LIST_PAGE_CONFIGS.filter((config) => config.genderHint === 'unisex');
  }

  return LIST_PAGE_CONFIGS;
}

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
  if (payload === undefined) {
    return `(() => {\n${script}\n})()`;
  }
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

function shouldSkipDetailUrl(url: string): boolean {
  const value = String(url || '');
  if (!value.startsWith(ORIGIN)) return true;
  const pathname = new URL(value).pathname.replace(/\/+$/, '');
  const listPathnames = new Set(LIST_PAGE_CONFIGS.map((config) => new URL(config.url).pathname.replace(/\/+$/, '')));
  if (
    [
      '/public/',
      '/apps',
      '/app/',
      '/cam',
      '/community',
      '/my-shopping-cart',
      '/more-compare',
      '/interactive-',
      '/AI-',
      '/tools/',
      '/what-is-',
      '/scenarios',
      '/bloom',
      '/collections',
    ].some((part) => value.includes(part))
  ) {
    return true;
  }
  return listPathnames.has(pathname) || pathname === '/store' || pathname === '/public/store';
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
  await page.waitForTimeout(7000);
}

async function scrollListPage(page: Page) {
  for (let index = 0; index < 6; index += 1) {
    await page.mouse.wheel(0, 1400);
    await page.waitForTimeout(500);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
}

async function extractListItemsFromGenderPage(page: Page, config: ListPageConfig) {
  const payload = await page.evaluate(
    toPageScript(
      `
        const origin = String(input?.origin || '');
        const currentSeedLabel = String(input?.seedLabel || '');
        const normalize = (value) =>
          String(value || '')
            .replace(/\\s+/g, ' ')
            .trim();

        const parsePrice = (value) => {
          const numeric = Number(String(value || '').replace(/[^\\d.]+/g, ''));
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

        const pickText = (root, selectors) => {
          for (const selector of selectors) {
            const text = normalize(root.querySelector(selector)?.textContent || '');
            if (text) return text;
          }
          return '';
        };

        const roots = Array.from(document.querySelectorAll('.\x74oy_list._store\x54oyList'));
        const scope = roots.length > 0 ? roots : [document];
        const cards = scope.flatMap((root) => Array.from(root.querySelectorAll('.\x74oy')));
        const seenUrls = new Set();
        const listItems = cards
          .map((card, index) => {
            const primaryAnchor =
              card.querySelector('a[data-product-code][href]') ||
              card.querySelector('a[href]');
            const href = primaryAnchor?.href || '';
            const productCode = normalize(primaryAnchor?.getAttribute('data-product-code') || '');
            const name =
              pickText(card, ['.\x74oy_name', '.h_name', '.\x74oy_title', '.product_title', '.product_name', '.name']) ||
              normalize(primaryAnchor?.getAttribute('title') || primaryAnchor?.textContent || '');
            const subtitle = pickText(card, ['.\x74oy_desc', '.subtitle', '.sub_title', '.desc', '.description', 'p']);
            const coverImage = resolveImageUrl(card.querySelector('.pro_img') || card.querySelector('.bg_img') || card.querySelector('img'));
            const priceText =
              normalize(card.querySelector('.priceCoupon')?.textContent || '') ||
              normalize(card.querySelector('.priceActive')?.textContent || '') ||
              normalize(card.querySelector('.current_price')?.textContent || '') ||
              normalize(card.querySelector('.sale_price')?.textContent || '') ||
              normalize(card.querySelector('.price')?.textContent || '');
            const originalPriceText =
              normalize(card.querySelector('.priceNormol')?.textContent || '') ||
              normalize(card.querySelector('.original_price')?.textContent || '') ||
              normalize(card.querySelector('.old_price')?.textContent || '') ||
              normalize(card.querySelector('.o_price')?.textContent || '');
            const categoryHints = [
              currentSeedLabel,
              normalize(primaryAnchor?.dataset.valid || ''),
              normalize(primaryAnchor?.dataset.productCode || ''),
              productCode,
            ].filter(Boolean);
            return {
              sourceUrl: href,
              name,
              subtitle,
              coverImage,
              priceUsd: parsePrice(priceText),
              originalPriceUsd: parsePrice(originalPriceText),
              categoryHints,
              listPosition: index + 1,
            };
          })
          .filter((item) => item.sourceUrl.startsWith(origin) && item.name)
          .filter((item) => {
            const cleanUrl = item.sourceUrl.replace(/#.*$/, '');
            if (seenUrls.has(cleanUrl)) return false;
            seenUrls.add(cleanUrl);
            item.sourceUrl = cleanUrl;
            return true;
          });

        const visibleProductCount = normalize(
          Array.from(scope.flatMap((root) => Array.from(root.querySelectorAll('*'))))
            .map((element) => normalize(element.textContent || ''))
            .find((text) => /^\\d+\\s+Products$/i.test(text)) || '',
        );

        return {
          listItems,
          listRootCount: roots.length,
          visibleProductCount,
        };
      `,
      { origin: ORIGIN, seedLabel: config.label },
    ),
  ) as {
    listItems: Array<Omit<ListItem, 'genderHint'>>;
    listRootCount: number;
    visibleProductCount: string;
  };

  return {
    listItems: (payload.listItems as Array<Omit<ListItem, 'genderHint'>>).map((item) => ({
      ...item,
      genderHint: config.genderHint,
    })),
    listRootCount: Number(payload.listRootCount || 0),
    visibleProductCount: String(payload.visibleProductCount || ''),
  };
}

async function collectListItems(page: Page, listPageConfigs: readonly ListPageConfig[]): Promise<ListItem[]> {
  const itemMap = new Map<string, ListItem>();

  for (const config of listPageConfigs) {
    console.log(`[列表] 打开${config.label}: ${config.url}`);
    await gotoAndSettle(page, config.url);
    try {
      await page.waitForSelector(STORE_DEVICE_LIST_SELECTOR, { timeout: 20000 });
    } catch {
      console.warn(`[列表] 未等到指定列表容器: ${STORE_DEVICE_LIST_SELECTOR}，继续尝试兜底解析`);
    }
    await scrollListPage(page);
    const extracted = await extractListItemsFromGenderPage(page, config);

    console.log(`[列表] ${config.label} 列表容器数: ${extracted.listRootCount}`);
    if (extracted.visibleProductCount) {
      console.log(`[列表] 页面标注商品数: ${extracted.visibleProductCount}`);
    }

    let acceptedCount = 0;
    for (const item of extracted.listItems) {
      if (shouldSkipDetailUrl(item.sourceUrl)) continue;
      acceptedCount += 1;
      const existing = itemMap.get(item.sourceUrl);
      if (!existing) {
        itemMap.set(item.sourceUrl, {
          ...item,
          categoryHints: uniqueStrings([config.label, ...item.categoryHints], 10),
          genderHint: config.genderHint,
        });
        continue;
      }

      existing.name = existing.name || item.name;
      existing.subtitle = existing.subtitle || item.subtitle;
      existing.coverImage = existing.coverImage || item.coverImage;
      existing.priceUsd = existing.priceUsd ?? item.priceUsd;
      existing.originalPriceUsd = existing.originalPriceUsd ?? item.originalPriceUsd;
      existing.listPosition = existing.listPosition ?? item.listPosition;
      existing.categoryHints = uniqueStrings([...existing.categoryHints, config.label, ...item.categoryHints], 10);
      existing.genderHint = existing.genderHint;
    }

    console.log(`[列表] ${config.label} 解析商品链接数: ${acceptedCount}`);
    await sleep(250);
  }

  return Array.from(itemMap.values()).filter((item) => item.sourceUrl && item.name);
}

async function extractDetail(page: Page, fallback: ListItem): Promise<ProductDetail | null> {
  const detail = await page.evaluate(
    toPageScript(`
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

      const meta = (selector) => normalize(document.querySelector(selector)?.content || '');

      const h1Text = normalize(document.querySelector('h1')?.textContent || '');
      const h1Lines = String(document.querySelector('h1')?.textContent || '')
        .split('\\n')
        .map((line) => normalize(line))
        .filter(Boolean);

      const specPairs = Array.from(document.querySelectorAll('.lush4_thirteenth_item'))
        .map((item) => ({
          key: normalize(item.querySelector('.lush4_thirteenth_item_left')?.textContent || ''),
          value: normalize(item.querySelector('.lush4_thirteenth_item_right')?.textContent || ''),
        }))
        .filter((item) => item.key && item.value);

      const featureHeadlines = Array.from(document.querySelectorAll('h2, h3'))
        .map((element) => normalize(element.textContent || ''))
        .filter(Boolean)
        .filter((text) => !/^q\\d+:/i.test(text))
        .filter((text) => text.length >= 8)
        .slice(0, 24);

      const faqItems = Array.from(document.querySelectorAll('h3'))
        .map((element) => normalize(element.textContent || ''))
        .filter((text) => /^q\\d+:/i.test(text) || text.includes('?'))
        .slice(0, 12);

      const reviewHighlights = Array.from(document.querySelectorAll('p, blockquote, .review-item, .review-content'))
        .map((element) => normalize(element.textContent || ''))
        .filter((text) => text.length >= 30)
        .filter(
          (text) =>
            /(vibration|quiet|comfortable|public|remote|app|\x6frgasm|control|wear|powerful|charging|discreet)/i.test(text),
        )
        .slice(0, 10);

      const bodySummary = uniqueStrings(
        Array.from(document.querySelectorAll('p, li'))
          .map((element) => normalize(element.textContent || ''))
          .filter((text) => text.length >= 25)
          .filter(
            (text) =>
              /(vibration|motor|charging|battery|waterproof|remote|app|wearable|g-spot|\x63lit|\x61nal|\x70enis|prostate|thrust|heat)/i.test(
                text,
              ),
          ),
        24,
      ).join('\\n');

      const imageUrls = uniqueStrings(
        Array.from(document.querySelectorAll('img'))
          .map((image) => image.currentSrc || image.src || '')
          .filter(Boolean)
          .filter((url) => /^https:\\/\\/cdn\\.lovense\\.com\\//i.test(url)),
        80,
      );

      const rawPriceCandidates = uniqueStrings(
        [
          normalize(document.querySelector('.product_price._use_coupon_price')?.textContent || ''),
          normalize(document.querySelector('.lush3_product_price')?.textContent || ''),
          normalize(document.querySelector('.price')?.textContent || ''),
        ],
        10,
      );

      const rawOriginalPriceCandidates = uniqueStrings(
        [
          normalize(document.querySelector('.product_original_price')?.textContent || ''),
          normalize(document.querySelector('.lush3_product_origin_price')?.textContent || ''),
          normalize(document.querySelector('.o_price')?.textContent || ''),
        ],
        10,
      );

      const code =
        normalize(document.querySelector('[data-code]')?.getAttribute('data-code') || '') ||
        normalize(document.querySelector('.product_buy')?.getAttribute('t') || '');

      const currentUrl = window.location.href;
      return {
        title: h1Lines[0] || h1Text,
        subtitle: h1Lines.slice(1).join(' | '),
        metaTitle: document.title || '',
        metaDescription:
          meta('meta[name="Description"]') ||
          meta('meta[name="description"]') ||
          meta('meta[property="og:description"]'),
        coverImage: meta('meta[property="og:image"]') || imageUrls[0] || '',
        priceUsd: rawPriceCandidates.map(parsePrice).find((value) => value !== null) ?? null,
        originalPriceUsd: rawOriginalPriceCandidates.map(parsePrice).find((value) => value !== null) ?? null,
        specPairs,
        featureHeadlines,
        faqItems,
        reviewHighlights,
        bodySummary,
        imageUrls,
        productCode: code,
        appSupport: /lovense remote|app-control|app controlled|long-distance/i.test(document.body?.innerText || ''),
        currentUrl,
      };
    `),
  ) as ProductDetail;

  const resolvedTitle = normalizeWhitespace(detail.title || fallback.name);
  const resolvedSubtitle = normalizeWhitespace(detail.subtitle || fallback.subtitle);
  const classifierText = `${resolvedTitle}\n${resolvedSubtitle}\n${detail.metaDescription}\n${detail.bodySummary}`;

  if (!resolvedTitle) return null;
  if (!detail.priceUsd && detail.specPairs.length === 0 && !/(\x76ibrator|\x64ildo|massager|\x6dasturbator|plug|machine|bundle|set)/i.test(classifierText)) {
    return null;
  }

  return {
    title: resolvedTitle,
    subtitle: resolvedSubtitle,
    metaTitle: normalizeWhitespace(detail.metaTitle),
    metaDescription: normalizeWhitespace(detail.metaDescription),
    priceUsd: detail.priceUsd ?? fallback.priceUsd,
    originalPriceUsd: detail.originalPriceUsd ?? fallback.originalPriceUsd,
    featureHeadlines: uniqueStrings(detail.featureHeadlines, 24),
    specPairs: detail.specPairs
      .map((item) => ({
        key: normalizeWhitespace(item.key),
        value: normalizeWhitespace(item.value),
      }))
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
    detail.priceUsd ? `页面价格(USD): ${detail.priceUsd}` : '',
    detail.originalPriceUsd ? `划线价格(USD): ${detail.originalPriceUsd}` : '',
    item.categoryHints.length ? `站内分类提示: ${item.categoryHints.join(' | ')}` : '',
    `性别提示: ${item.genderHint}`,
    detail.productCode ? `产品代码: ${detail.productCode}` : '',
    `APP支持: ${detail.appSupport ? 'Yes' : 'No'}`,
    '',
    detail.specPairs.length ? '[规格参数]' : '',
    ...detail.specPairs.map((item) => `${item.key}: ${item.value}`),
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

  return sections.slice(0, 14000).trim();
}

function persistBuffer(bufferData: unknown[]) {
  ensureDir(BUFFER_PATH);
  fs.writeFileSync(BUFFER_PATH, JSON.stringify(bufferData, null, 2));
}

export async function runCrawler() {
  const listPageConfigs = resolveListPageConfigs();
  console.log('--- 启动 Lovense 官方站抓取任务 ---');
  console.log(`[列表] 入口: ${listPageConfigs.map((config) => config.url).join(' | ')}`);

  const context = await createContext();
  const page = await context.newPage();

  try {
    const listItems = await collectListItems(page, listPageConfigs);
    console.log(`[列表] 去重后候选商品数: ${listItems.length}`);

    if (listItems.length === 0) {
      throw new Error('Lovense 官方站未解析到任何商品链接。');
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
        const resolvedGender = item.genderHint;

        const record = {
          sourceUrl: item.sourceUrl,
          name: detail.title || item.name,
          price: detail.priceUsd ?? item.priceUsd ?? null,
          priceUsd: detail.priceUsd ?? item.priceUsd ?? null,
          originalPriceUsd: detail.originalPriceUsd ?? item.originalPriceUsd ?? null,
          priceCurrency: 'USD',
          coverImage: detail.coverImage || item.coverImage || '',
          genderHint: resolvedGender,
          categoryHints: item.categoryHints,
          rawDescription,
          detailImageUrls,
          imagePlaceholder: 'bg-gradient-to-br from-slate-950/50 to-pink-900/30',
          isReviewed: false,
        };

        bufferData.push(record);
        persistBuffer(bufferData);

        console.log(
          `[抓取] 已写入缓冲: ${record.name} | priceUsd=${record.priceUsd ?? 'null'} | images=${detailImageUrls.length}`,
        );
        await sleep(500);
      } catch (error) {
        console.error(`[故障] 详情抓取失败: ${item.sourceUrl}`, error);
      }
    }

    console.log(`\n--- Lovense 官方站抓取结束，共写入 ${bufferData.length} 条 ---`);
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
    console.error('[致命错误] Lovense 官方站抓取进程崩溃:', error);
  });
}
