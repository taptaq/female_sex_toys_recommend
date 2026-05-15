# Dame Official Scraper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full `dame-official` scraper pipeline that crawls the live Dame storefront with Playwright, keeps toys plus eligible care and apparel items, converts USD prices into RMB, and persists normalized records through the existing cleaner/database flow.

**Architecture:** Follow the repo's existing `*-official` scraper pattern. `crawler.ts` owns Playwright navigation, DOM-first list/detail extraction, inclusion filtering, deduplication, review-buffer writing, and cleaner invocation; `cleaner.ts` owns translation, USD-to-CNY conversion, classifier-driven type/subtype normalization, duplicate protection, cleaned JSON output, and DB writes.

**Tech Stack:** TypeScript, Node.js 20, `tsx`, `node:test`, Playwright, Prisma + PostgreSQL, shared raw-description translator, shared library product type classifier.

---

## File Structure

- Create: `src/scraper/dame-official/crawler.ts`
- Create: `src/scraper/dame-official/crawler.test.ts`
- Create: `src/scraper/dame-official/cleaner.ts`
- Create: `src/scraper/dame-official/cleaner.test.ts`
- Modify: `package.json`
- Create at runtime: `src/data/dame-official-review-buffer.json`
- Create at runtime: `src/data/dame-official-cleaned-data.json`
- Reuse: `src/scraper/shared/raw-description-translator.ts`
- Reuse: `src/scraper/nomitang-official/cleaner-helpers.ts`
- Reuse: `src/lib/library-product-type-classifier.ts`

Responsibilities:

- `src/scraper/dame-official/crawler.ts`: Playwright runtime, DOM parsing helpers, inclusion/exclusion filter helpers, canonical URL normalization, review-buffer generation, cleaner handoff.
- `src/scraper/dame-official/crawler.test.ts`: regression coverage for inclusion filtering, URL normalization, list-card parsing, and detail DOM parsing.
- `src/scraper/dame-official/cleaner.ts`: exchange-rate refresh/fallback, raw-description translation, spec inference, classifier-based type/subtype mapping, cleaned JSON emission, and DB writes.
- `src/scraper/dame-official/cleaner.test.ts`: regression coverage for USD→RMB conversion, care/apparel classification inputs, and normalized output shape.
- `package.json`: add `scrape:dame-official`.

## Task 1: Scaffold crawler tests around inclusion filtering and DOM parsing

**Files:**
- Create: `src/scraper/dame-official/crawler.test.ts`
- Create: `src/scraper/dame-official/crawler.ts`

- [ ] **Step 1: Write the failing crawler tests**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import * as crawler from './crawler.ts';

test('shouldKeepDameCandidate keeps toys, lubricants, wipes, and lingerie but rejects STI kits', () => {
  const shouldKeepDameCandidate = (crawler as Record<string, unknown>).shouldKeepDameCandidate;
  assert.equal(typeof shouldKeepDameCandidate, 'function');

  assert.equal(
    (shouldKeepDameCandidate as (input: Record<string, unknown>) => boolean)({
      name: 'Aer Suction Vibrator',
      subtitle: 'Soft seal air-pulse stimulation',
      tags: ['toy', 'waterproof'],
      mode: 'list',
    }),
    true,
  );

  assert.equal(
    (shouldKeepDameCandidate as (input: Record<string, unknown>) => boolean)({
      name: 'Aloe Personal Lubricant',
      subtitle: 'Water-based lube',
      tags: ['lube'],
      mode: 'list',
    }),
    true,
  );

  assert.equal(
    (shouldKeepDameCandidate as (input: Record<string, unknown>) => boolean)({
      name: 'Intimate Cleansing Wipes',
      subtitle: 'Single-use wipes',
      tags: ['wipes'],
      mode: 'list',
    }),
    true,
  );

  assert.equal(
    (shouldKeepDameCandidate as (input: Record<string, unknown>) => boolean)({
      name: 'Lace Panty',
      subtitle: 'Intimate-use apparel',
      tags: ['lingerie'],
      mode: 'detail',
    }),
    true,
  );

  assert.equal(
    (shouldKeepDameCandidate as (input: Record<string, unknown>) => boolean)({
      name: 'Gonorrhea & Chlamydia STI Test Kit',
      subtitle: 'At-home screening',
      tags: ['sti', 'kit'],
      mode: 'detail',
    }),
    false,
  );
});

test('extractListItemsFromHtml normalizes Dame product cards in storefront order', () => {
  const extractListItemsFromHtml = (crawler as Record<string, unknown>).extractListItemsFromHtml;
  assert.equal(typeof extractListItemsFromHtml, 'function');

  const result = (extractListItemsFromHtml as (html: string) => Array<Record<string, unknown>>)(`
    <div class="grid product-grid">
      <div class="grid__item">
        <a href="/products/eva-ii">
          <img src="//cdn.shopify.com/eva.jpg" />
          <h3>Eva Wearable Vibrator</h3>
        </a>
        <p>A hands-free vibrator for couples.</p>
        <span class="price-item price-item--sale">$129.00</span>
      </div>
      <div class="grid__item">
        <a href="/products/aloe-lube">
          <img src="//cdn.shopify.com/lube.jpg" />
          <h3>Aloe Personal Lubricant</h3>
        </a>
        <p>Water-based lubricant.</p>
        <span class="price-item">$25.00</span>
      </div>
    </div>
  `);

  assert.equal(result.length, 2);
  assert.deepEqual(result[0], {
    sourceUrl: 'https://dame.com/products/eva-ii',
    name: 'Eva Wearable Vibrator',
    subtitle: 'A hands-free vibrator for couples.',
    coverImage: 'https://cdn.shopify.com/eva.jpg',
    priceUsd: 129,
    originalPriceUsd: null,
    priceCurrency: 'USD',
    categoryHints: [],
    genderHint: 'unisex',
    listPosition: 1,
  });
});

test('buildDetailExtractionScript extracts accordion sections and gallery from a detail page', async () => {
  const buildDetailExtractionScript = (crawler as Record<string, unknown>).buildDetailExtractionScript;
  assert.equal(typeof buildDetailExtractionScript, 'function');

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(`
      <html>
        <head>
          <title>Eva Wearable Vibrator</title>
          <meta name="description" content="Hands-free wearable vibrator for couples." />
        </head>
        <body>
          <h1>Eva Wearable Vibrator</h1>
          <p class="product__text">A hands-free, wearable vibrator that stays in place.</p>
          <div class="price">$129.00</div>
          <div class="product__media-list">
            <img src="https://cdn.shopify.com/eva-1.jpg" />
            <img src="https://cdn.shopify.com/eva-2.jpg" />
          </div>
          <div class="accordion">
            <h2>How to Use</h2>
            <div>Wear during partnered play.</div>
            <h2>Specifications</h2>
            <div><ul><li>Medical Grade Silicone</li><li>Waterproof</li></ul></div>
            <h2>Manual</h2>
            <div><a href="https://cdn.shopify.com/eva-manual.pdf">English Manual</a></div>
          </div>
        </body>
      </html>
    `);

    const detail = (await page.evaluate((buildDetailExtractionScript as () => string)())) as Record<string, unknown>;
    assert.equal(detail.title, 'Eva Wearable Vibrator');
    assert.equal(detail.priceUsd, 129);
    assert.equal(detail.coverImage, 'https://cdn.shopify.com/eva-1.jpg');
    assert.deepEqual(detail.galleryImages, [
      'https://cdn.shopify.com/eva-1.jpg',
      'https://cdn.shopify.com/eva-2.jpg',
    ]);
    assert.match(String(detail.rawDescription || ''), /How to Use/);
    assert.match(String(detail.rawDescription || ''), /Medical Grade Silicone/);
    assert.match(String(detail.rawDescription || ''), /eva-manual\.pdf/);
  } finally {
    await browser.close();
  }
});
```

- [ ] **Step 2: Run the crawler tests to verify they fail**

Run: `node --import tsx --test src/scraper/dame-official/crawler.test.ts`

Expected: FAIL because `src/scraper/dame-official/crawler.ts` does not yet export `shouldKeepDameCandidate`, `extractListItemsFromHtml`, or `buildDetailExtractionScript`.

- [ ] **Step 3: Add the minimal crawler scaffold with the required exports**

```ts
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { runCleaner } from './cleaner.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ORIGIN = 'https://dame.com';
export const LIST_URL = `${ORIGIN}/collections/shop-all?sort_by=best-selling`;
export const BUFFER_PATH = path.resolve(__dirname, '../../data/dame-official-review-buffer.json');
export const MAX_ITEMS = Number(process.env.DAME_OFFICIAL_MAX_ITEMS || '200');

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

export function shouldKeepDameCandidate(_input: Record<string, unknown>): boolean {
  return false;
}

export function extractListItemsFromHtml(_html: string): DameListItem[] {
  return [];
}

export function buildDetailExtractionScript(): string {
  return `(() => ({ title: '', subtitle: '', metaTitle: '', metaDescription: '', priceUsd: null, originalPriceUsd: null, coverImage: '', galleryImages: [], manualUrls: [], rawDescription: '' }))()`;
}

export async function runCrawler() {
  return [];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCrawler()
    .then(() => runCleaner())
    .catch((error) => {
      console.error('[dame-official] crawler failed', error);
      process.exitCode = 1;
    });
}
```

- [ ] **Step 4: Re-run the crawler tests and confirm they still fail on behavior**

Run: `node --import tsx --test src/scraper/dame-official/crawler.test.ts`

Expected: FAIL on field assertions, proving the tests are checking behavior rather than only module presence.

- [ ] **Step 5: Commit the scaffold**

```bash
git add src/scraper/dame-official/crawler.ts src/scraper/dame-official/crawler.test.ts
git commit -m "test: scaffold dame official crawler coverage"
```

## Task 2: Implement crawler parsing helpers, filtering, and deduplication

**Files:**
- Modify: `src/scraper/dame-official/crawler.ts`
- Modify: `src/scraper/dame-official/crawler.test.ts`

- [ ] **Step 1: Extend crawler tests with canonical URL and dedupe coverage**

```ts
test('mergeUniqueListItems canonicalizes urls and keeps earliest position', () => {
  const mergeUniqueListItems = (crawler as Record<string, unknown>).mergeUniqueListItems;
  assert.equal(typeof mergeUniqueListItems, 'function');

  const result = (mergeUniqueListItems as (items: Array<Record<string, unknown>>) => Array<Record<string, unknown>>)([
    {
      sourceUrl: 'https://dame.com/products/eva-ii?variant=ice',
      name: 'Eva Wearable Vibrator',
      subtitle: '',
      coverImage: 'https://cdn.shopify.com/eva.jpg',
      priceUsd: 129,
      originalPriceUsd: null,
      priceCurrency: 'USD',
      categoryHints: [],
      genderHint: 'unisex',
      listPosition: 2,
    },
    {
      sourceUrl: 'https://dame.com/products/eva-ii',
      name: 'Eva Wearable Vibrator',
      subtitle: '',
      coverImage: 'https://cdn.shopify.com/eva.jpg',
      priceUsd: 129,
      originalPriceUsd: null,
      priceCurrency: 'USD',
      categoryHints: [],
      genderHint: 'unisex',
      listPosition: 1,
    },
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].sourceUrl, 'https://dame.com/products/eva-ii');
  assert.equal(result[0].listPosition, 1);
});
```

- [ ] **Step 2: Run the crawler tests to verify the new test fails**

Run: `node --import tsx --test src/scraper/dame-official/crawler.test.ts`

Expected: FAIL because `mergeUniqueListItems` is missing and the existing parser behavior is not implemented yet.

- [ ] **Step 3: Implement URL normalization, inclusion filtering, list parsing, detail parsing, and dedupe**

```ts
function normalizeWhitespace(value: string) {
  return String(value || '')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function parseUsdPrice(value: string): number | null {
  const numeric = Number(String(value || '').replace(/[^\d.]+/g, ''));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

export function resolveUrl(input: string) {
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

export function shouldKeepDameCandidate(input: Record<string, unknown>) {
  const corpus = [
    input.name,
    input.subtitle,
    ...(Array.isArray(input.tags) ? input.tags : []),
    input.rawDescription,
  ]
    .map((value) => String(value || '').toLowerCase())
    .join('\n');

  const keepPatterns = [
    /\bvibrator\b/u,
    /\bwand\b/u,
    /\bwearable\b/u,
    /\bsuction\b/u,
    /\bg-spot\b/u,
    /\bclitoral\b/u,
    /\bcouples?\b/u,
    /\blube\b/u,
    /\blubricant\b/u,
    /\bwipes?\b/u,
    /\blingerie\b/u,
    /\bpanty\b/u,
    /\bunderwear\b/u,
  ];

  const rejectPatterns = [
    /\bsti\b/u,
    /\btest kit\b/u,
    /\bgift card\b/u,
    /\bsticker\b/u,
    /\bmug\b/u,
  ];

  if (rejectPatterns.some((pattern) => pattern.test(corpus))) return false;
  return keepPatterns.some((pattern) => pattern.test(corpus));
}

export function extractListItemsFromHtml(html: string): DameListItem[] {
  const cards = Array.from(
    html.matchAll(/<div class="grid__item">([\s\S]*?)<\/div>\s*<\/div>?/g),
  );

  return cards
    .map((match, index) => {
      const fragment = match[1];
      const href = fragment.match(/<a[^>]+href="([^"]+)"/i)?.[1] || '';
      const image = fragment.match(/<img[^>]+src="([^"]+)"/i)?.[1] || '';
      const name = normalizeWhitespace(fragment.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1] || '');
      const subtitle = normalizeWhitespace(fragment.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] || '');
      const prices = Array.from(fragment.matchAll(/\$[\d,.]+/g)).map((entry) => parseUsdPrice(entry[0]));
      return {
        sourceUrl: resolveUrl(href),
        name,
        subtitle,
        coverImage: resolveUrl(image),
        priceUsd: prices[0] ?? null,
        originalPriceUsd: prices[1] ?? null,
        priceCurrency: 'USD' as const,
        categoryHints: [],
        genderHint: /\bcouples?\b/i.test(`${name}\n${subtitle}`) ? 'unisex' : 'unisex',
        listPosition: index + 1,
      };
    })
    .filter((item) => item.sourceUrl && item.name);
}

export function mergeUniqueListItems(items: DameListItem[]) {
  const byUrl = new Map<string, DameListItem>();
  for (const item of items) {
    const canonicalUrl = resolveUrl(item.sourceUrl);
    const existing = byUrl.get(canonicalUrl);
    if (!existing || (item.listPosition ?? Number.MAX_SAFE_INTEGER) < (existing.listPosition ?? Number.MAX_SAFE_INTEGER)) {
      byUrl.set(canonicalUrl, { ...item, sourceUrl: canonicalUrl });
    }
  }
  return [...byUrl.values()];
}

export function buildDetailExtractionScript() {
  return `(() => {
    const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
    const pickText = (selector) => normalize(document.querySelector(selector)?.textContent || '');
    const galleryImages = Array.from(document.querySelectorAll('img'))
      .map((node) => node.getAttribute('src') || node.getAttribute('data-src') || '')
      .filter(Boolean)
      .map((value) => value.startsWith('//') ? 'https:' + value : value)
      .filter((value, index, array) => array.indexOf(value) === index);
    const manualUrls = Array.from(document.querySelectorAll('a[href$=".pdf"]'))
      .map((node) => node.href)
      .filter(Boolean);
    const accordions = Array.from(document.querySelectorAll('h2'))
      .map((heading) => {
        const label = normalize(heading.textContent || '');
        const body = normalize(heading.nextElementSibling?.textContent || '');
        return label && body ? label + ': ' + body : '';
      })
      .filter(Boolean);
    const rawDescription = [
      'Name: ' + pickText('h1'),
      'Subtitle: ' + pickText('.product__text, .product__description, .rte p'),
      ...accordions,
      ...manualUrls.map((url) => 'Manual: ' + url),
    ].filter(Boolean).join('\\n');
    const priceMatch = (document.body.textContent || '').match(/\\$\\s*([\\d,.]+)/);
    const priceUsd = priceMatch ? Number(priceMatch[1].replace(/,/g, '')) : null;
    return {
      title: pickText('h1'),
      subtitle: pickText('.product__text, .product__description, .rte p'),
      metaTitle: document.title || '',
      metaDescription: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
      priceUsd,
      originalPriceUsd: null,
      coverImage: galleryImages[0] || '',
      galleryImages,
      manualUrls,
      rawDescription,
    };
  })()`;
}
```

- [ ] **Step 4: Re-run crawler tests and confirm they pass**

Run: `node --import tsx --test src/scraper/dame-official/crawler.test.ts`

Expected: PASS for inclusion filtering, list parsing, detail extraction, and URL deduplication.

- [ ] **Step 5: Commit the parsing layer**

```bash
git add src/scraper/dame-official/crawler.ts src/scraper/dame-official/crawler.test.ts
git commit -m "feat: add dame crawler parsing and filtering"
```

## Task 3: Implement the Playwright crawl runtime and script entrypoint

**Files:**
- Modify: `src/scraper/dame-official/crawler.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the runtime-focused failing test**

```ts
test('shouldKeepDameCandidate rejects generic merch copy at detail stage', () => {
  const shouldKeepDameCandidate = (crawler as Record<string, unknown>).shouldKeepDameCandidate;
  assert.equal(
    (shouldKeepDameCandidate as (input: Record<string, unknown>) => boolean)({
      name: 'Blue Logo Mug',
      subtitle: 'Ceramic coffee mug',
      rawDescription: 'Giftable kitchen merch for everyday use.',
      mode: 'detail',
    }),
    false,
  );
});
```

- [ ] **Step 2: Run the crawler tests to verify the merch guard fails if still missing**

Run: `node --import tsx --test src/scraper/dame-official/crawler.test.ts`

Expected: FAIL if the current filter still lets generic merch through.

- [ ] **Step 3: Implement the browser context, listing expansion, detail crawl, review-buffer write, and package script**

```ts
function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
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

async function loadAllListingCards(page: Page) {
  let lastCount = 0;
  for (let index = 0; index < 10; index += 1) {
    await page.mouse.wheel(0, 1800);
    await page.waitForTimeout(800);
    const currentCount = await page.locator('.grid__item a[href*="/products/"]').count();
    if (currentCount === lastCount) break;
    lastCount = currentCount;
  }
  await page.waitForTimeout(1200);
}

export async function runCrawler() {
  const context = await createContext();
  const page = await context.newPage();

  try {
    await page.goto(LIST_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(5000);
    await loadAllListingCards(page);

    const listItems = mergeUniqueListItems(
      extractListItemsFromHtml(await page.content()).filter((item) =>
        shouldKeepDameCandidate({
          name: item.name,
          subtitle: item.subtitle,
          tags: item.categoryHints,
          mode: 'list',
        }),
      ),
    ).slice(0, MAX_ITEMS);

    const reviewBuffer: Array<Record<string, unknown>> = [];
    for (const item of listItems) {
      const detailPage = await context.newPage();
      try {
        await detailPage.goto(item.sourceUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
        await detailPage.waitForTimeout(2500);
        const detail = (await detailPage.evaluate(buildDetailExtractionScript())) as DameProductDetail;
        if (
          !shouldKeepDameCandidate({
            name: detail.title || item.name,
            subtitle: detail.subtitle || item.subtitle,
            rawDescription: detail.rawDescription,
            mode: 'detail',
          })
        ) {
          continue;
        }

        reviewBuffer.push({
          ...item,
          ...detail,
          sourceUrl: item.sourceUrl,
          coverImage: detail.coverImage || item.coverImage,
          rawDescription: detail.rawDescription,
          isReviewed: false,
        });
      } finally {
        await detailPage.close().catch(() => {});
      }
    }

    ensureDir(BUFFER_PATH);
    fs.writeFileSync(BUFFER_PATH, JSON.stringify(reviewBuffer, null, 2));
    return reviewBuffer;
  } finally {
    await context.close().catch(() => {});
  }
}
```

```json
"scrape:dame-official": "tsx -r dotenv/config src/scraper/dame-official/crawler.ts"
```

- [ ] **Step 4: Re-run crawler tests and typecheck**

Run: `node --import tsx --test src/scraper/dame-official/crawler.test.ts`
Expected: PASS

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit the runtime and script entrypoint**

```bash
git add src/scraper/dame-official/crawler.ts package.json
git commit -m "feat: add dame official crawl runtime"
```

## Task 4: Scaffold cleaner tests around RMB conversion and care/apparel classification

**Files:**
- Create: `src/scraper/dame-official/cleaner.test.ts`
- Create: `src/scraper/dame-official/cleaner.ts`

- [ ] **Step 1: Write the failing cleaner tests**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import * as cleaner from './cleaner.ts';

test('buildNormalizedSpecs converts USD prices to RMB and preserves fx metadata', () => {
  const buildNormalizedSpecs = (cleaner as Record<string, unknown>).buildNormalizedSpecs;
  assert.equal(typeof buildNormalizedSpecs, 'function');

  const specs = (buildNormalizedSpecs as (item: Record<string, unknown>, rate: number) => Record<string, unknown>)(
    {
      name: 'Aloe Personal Lubricant',
      priceUsd: 25,
      originalPriceUsd: 30,
      rawDescription: 'Water-based lubricant for intimate use.',
      genderHint: 'unisex',
    },
    7.2,
  );

  assert.equal(specs.price_usd, 25);
  assert.equal(specs.price_rmb, 180);
  assert.equal(specs.original_price_usd, 30);
  assert.equal(specs.original_price_rmb, 216);
});

test('buildNormalizedSpecs lets classifier resolve lube and lingerie as care_accessory subtypes', () => {
  const buildNormalizedSpecs = (cleaner as Record<string, unknown>).buildNormalizedSpecs;
  assert.equal(typeof buildNormalizedSpecs, 'function');

  const lube = (buildNormalizedSpecs as (item: Record<string, unknown>, rate: number) => Record<string, unknown>)(
    {
      name: 'Aloe Personal Lubricant',
      priceUsd: 25,
      rawDescription: 'Water-based lubricant for intimate use.',
      genderHint: 'unisex',
    },
    7.2,
  );

  const lingerie = (buildNormalizedSpecs as (item: Record<string, unknown>, rate: number) => Record<string, unknown>)(
    {
      name: 'Lace Panty',
      priceUsd: 32,
      rawDescription: 'Soft lace lingerie for intimate styling.',
      genderHint: 'female',
    },
    7.2,
  );

  assert.equal(lube.type_code, 'care_accessory');
  assert.equal(lube.subtype_code, 'lube_care');
  assert.equal(lingerie.type_code, 'care_accessory');
  assert.equal(lingerie.subtype_code, 'lingerie');
});
```

- [ ] **Step 2: Run the cleaner tests to verify they fail**

Run: `node --import tsx --test src/scraper/dame-official/cleaner.test.ts`

Expected: FAIL because `src/scraper/dame-official/cleaner.ts` does not yet export `buildNormalizedSpecs`.

- [ ] **Step 3: Add the minimal cleaner scaffold**

```ts
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const BUFFER_PATH = path.resolve(__dirname, '../../data/dame-official-review-buffer.json');
export const CLEANED_PATH = path.resolve(__dirname, '../../data/dame-official-cleaned-data.json');

export function buildNormalizedSpecs(_item: Record<string, unknown>, _rate: number) {
  return {
    price_usd: null,
    price_rmb: null,
    original_price_usd: null,
    original_price_rmb: null,
    type_code: null,
    subtype_code: null,
  };
}

export async function runCleaner() {
  return [];
}
```

- [ ] **Step 4: Re-run cleaner tests and confirm they fail on behavior**

Run: `node --import tsx --test src/scraper/dame-official/cleaner.test.ts`

Expected: FAIL on RMB and subtype assertions.

- [ ] **Step 5: Commit the cleaner scaffold**

```bash
git add src/scraper/dame-official/cleaner.ts src/scraper/dame-official/cleaner.test.ts
git commit -m "test: scaffold dame official cleaner coverage"
```

## Task 5: Implement cleaner normalization, translation, classifier mapping, and persistence

**Files:**
- Modify: `src/scraper/dame-official/cleaner.ts`
- Modify: `src/scraper/dame-official/cleaner.test.ts`

- [ ] **Step 1: Extend cleaner tests with duplicate preparation coverage**

```ts
test('prepareUniqueBufferItemsForCleaning drops duplicate canonical names', async () => {
  const helpers = await import('../nomitang-official/cleaner-helpers.ts');
  const result = helpers.prepareUniqueBufferItemsForCleaning([
    { name: 'Eva Wearable Vibrator', rawDescription: 'Name: Eva Wearable Vibrator', sourceUrl: 'https://dame.com/products/eva-ii' },
    { name: 'Eva Wearable Vibrator', rawDescription: 'Name: Eva Wearable Vibrator', sourceUrl: 'https://dame.com/products/eva-ii?variant=papaya' },
  ]);

  assert.equal(result.items.length, 1);
  assert.equal(result.skippedDuplicateNames.length, 1);
});
```

- [ ] **Step 2: Run the cleaner tests to verify the helper integration still leaves implementation gaps**

Run: `node --import tsx --test src/scraper/dame-official/cleaner.test.ts`

Expected: FAIL because `buildNormalizedSpecs` and `runCleaner` still do not perform real normalization.

- [ ] **Step 3: Implement exchange-rate refresh, normalized specs, classifier mapping, cleaned JSON output, and DB writes**

```ts
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { buildSafeDisplayName } from '../../lib/product-display-name.ts';
import { classifyLibraryTypeCode, classifyLibrarySubtypeCode } from '../../lib/library-product-type-classifier.ts';
import { translateRawDescriptionToZh } from '../shared/raw-description-translator.ts';
import {
  extractCanonicalName,
  hasMeaningfulEnglish,
  isPlaceholderProductName,
  prepareUniqueBufferItemsForCleaning,
  resolvePersistedRawDescription,
} from '../nomitang-official/cleaner-helpers.ts';

const FALLBACK_USD_TO_CNY_RATE = 7.2;
let usdToCnyRate = FALLBACK_USD_TO_CNY_RATE;
let usdToCnyRateDate = '';
let usdToCnyRateSource = 'fallback';

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function normalizeWhitespace(value: string) {
  return String(value || '')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function parseUsd(value: unknown): number | null {
  const numeric = Number(String(value ?? '').replace(/[^\d.]+/g, ''));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

export async function refreshUsdToCnyRate() {
  try {
    const response = await fetch('https://api.frankfurter.dev/v1/latest?base=USD&symbols=CNY', {
      headers: { accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = (await response.json()) as { date?: string; rates?: Record<string, number> };
    const liveRate = Number(payload?.rates?.CNY);
    if (!Number.isFinite(liveRate) || liveRate <= 0) throw new Error('missing CNY rate');
    usdToCnyRate = liveRate;
    usdToCnyRateDate = String(payload?.date || '').trim();
    usdToCnyRateSource = 'frankfurter';
  } catch {
    usdToCnyRate = FALLBACK_USD_TO_CNY_RATE;
    usdToCnyRateDate = '';
    usdToCnyRateSource = 'fallback';
  }
}

export function buildNormalizedSpecs(item: Record<string, unknown>, rate: number) {
  const priceUsd = parseUsd(item.priceUsd);
  const originalPriceUsd = parseUsd(item.originalPriceUsd);
  const rawDescription = normalizeWhitespace(String(item.rawDescription || ''));
  const tags = String(item.name || '')
    .toLowerCase()
    .split(/[\s/|,-]+/)
    .filter(Boolean);
  const type_code = classifyLibraryTypeCode({
    gender: String(item.genderHint || 'unisex'),
    physicalForm: null,
    name: String(item.name || ''),
    rawDescription,
    tags,
  });
  const subtype_code = classifyLibrarySubtypeCode({
    gender: String(item.genderHint || 'unisex'),
    physicalForm: null,
    name: String(item.name || ''),
    rawDescription,
    tags,
    typeCode: type_code,
  });

  return {
    price_usd: priceUsd,
    price_rmb: priceUsd === null ? null : Math.round(priceUsd * rate),
    original_price_usd: originalPriceUsd,
    original_price_rmb: originalPriceUsd === null ? null : Math.round(originalPriceUsd * rate),
    fx_rate_usd_cny: rate,
    fx_rate_source: usdToCnyRateSource,
    fx_rate_date: usdToCnyRateDate || null,
    gender: String(item.genderHint || 'unisex'),
    material: /lace|lingerie|panty/i.test(`${item.name}\n${rawDescription}`) ? '锦纶蕾丝' : '硅胶',
    appearance: /wearable|discreet|travel/i.test(rawDescription) ? 'high_disguise' : 'normal',
    physical_form: /g-spot|insert/i.test(rawDescription) ? 'internal' : 'external',
    motor_type: /powerful|intense|strong/i.test(rawDescription) ? 'strong' : 'gentle',
    waterproof: /waterproof/i.test(rawDescription) ? 7 : null,
    max_db: null,
    function_tags: [
      /lubricant|lube/i.test(rawDescription) ? '润滑护理' : '',
      /wipe/i.test(rawDescription) ? '清洁护理' : '',
      /vibrator|wand|wearable|suction|clitoral/i.test(rawDescription) ? '震动刺激' : '',
    ].filter(Boolean),
    type_code,
    subtype_code,
  };
}

export async function runCleaner() {
  if (!fs.existsSync(BUFFER_PATH)) {
    console.error('[中断] 未发现 Dame review-buffer。');
    return [];
  }

  const bufferData = JSON.parse(fs.readFileSync(BUFFER_PATH, 'utf8')) as Array<Record<string, unknown>>;
  const prepared = prepareUniqueBufferItemsForCleaning(bufferData);
  await refreshUsdToCnyRate();

  const cleanedRows: Array<Record<string, unknown>> = [];
  for (const item of prepared.items) {
    const canonicalName = extractCanonicalName(String(item.rawDescription || ''), String(item.name || ''));
    if (isPlaceholderProductName(canonicalName)) continue;

    const translatedRawDescription = hasMeaningfulEnglish(String(item.rawDescription || ''))
      ? await translateRawDescriptionToZh(String(item.rawDescription || ''), path.resolve(__dirname, '../../data/dame-official-raw-description-zh-cache.json'))
      : String(item.rawDescription || '');

    const rawDescription = resolvePersistedRawDescription(translatedRawDescription, String(item.rawDescription || ''));
    const specs = buildNormalizedSpecs({ ...item, rawDescription }, usdToCnyRate);

    cleanedRows.push({
      sourceUrl: String(item.sourceUrl || ''),
      name: canonicalName,
      safeDisplayName: buildSafeDisplayName(canonicalName),
      brand: 'Dame',
      price: specs.price_rmb,
      coverImage: String(item.coverImage || ''),
      rawDescription,
      gender: specs.gender,
      material: specs.material,
      specs,
      typeCode: specs.type_code,
      subtypeCode: specs.subtype_code,
    });
  }

  fs.writeFileSync(CLEANED_PATH, JSON.stringify(cleanedRows, null, 2));
  return cleanedRows;
}
```

- [ ] **Step 4: Re-run cleaner tests and typecheck**

Run: `node --import tsx --test src/scraper/dame-official/cleaner.test.ts`
Expected: PASS

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit the cleaner implementation**

```bash
git add src/scraper/dame-official/cleaner.ts src/scraper/dame-official/cleaner.test.ts
git commit -m "feat: add dame official cleaner pipeline"
```

## Task 6: Verify the end-to-end pipeline against the live storefront

**Files:**
- Modify: `src/scraper/dame-official/crawler.ts`
- Modify: `src/scraper/dame-official/cleaner.ts`
- Create at runtime: `src/data/dame-official-review-buffer.json`
- Create at runtime: `src/data/dame-official-cleaned-data.json`

- [ ] **Step 1: Run the scraper with a small item cap**

Run: `DAME_OFFICIAL_MAX_ITEMS=12 npm run scrape:dame-official`

Expected:
- `src/data/dame-official-review-buffer.json` is created
- `src/data/dame-official-cleaned-data.json` is created
- buffer contains a mix of toys, lubricant/wipes, and apparel when present
- obvious STI kit rows are absent from the cleaned output

- [ ] **Step 2: Inspect cleaned output for expected inclusion and exclusion**

Run: `node --import tsx --eval "import fs from 'fs'; const rows = JSON.parse(fs.readFileSync('src/data/dame-official-cleaned-data.json','utf8')); console.log(rows.map((row) => ({ name: row.name, typeCode: row.typeCode, subtypeCode: row.subtypeCode, price: row.price })).slice(0, 12));"`

Expected:
- toys map into device categories such as `external_vibe`, `couples`, `wearable_remote`, or `insertable` as appropriate
- lubricant maps to `care_accessory` + `lube_care`
- lingerie/apparel maps to `care_accessory` + `lingerie`
- no `STI kit` records remain

- [ ] **Step 3: Re-run all targeted tests and full typecheck**

Run: `node --import tsx --test src/scraper/dame-official/crawler.test.ts src/scraper/dame-official/cleaner.test.ts`
Expected: PASS

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Make final polish fixes if verification exposes gaps**

```ts
// Example polish checklist:
// - tighten reject patterns if an STI kit still slips through
// - widen keep patterns if intimate apparel is being dropped
// - improve detail selectors if manual/spec sections are missing
// - preserve original price when compare-at price is visible
```

- [ ] **Step 5: Commit the verified end-to-end integration**

```bash
git add src/scraper/dame-official/crawler.ts src/scraper/dame-official/crawler.test.ts src/scraper/dame-official/cleaner.ts src/scraper/dame-official/cleaner.test.ts package.json src/data/dame-official-review-buffer.json src/data/dame-official-cleaned-data.json
git commit -m "feat: add dame official scraper pipeline"
```

## Self-Review

Spec coverage:

- DOM-first crawler: covered by Tasks 1-3
- keep toys + lubricant/wipes + apparel: covered by Tasks 1, 2, 5, and 6
- exclude STI kits / gift cards / generic merch: covered by Tasks 1, 2, 3, and 6
- USD→RMB conversion with source-price preservation: covered by Tasks 4, 5, and 6
- review buffer + cleaned JSON + DB-ready cleaner pipeline: covered by Tasks 3, 5, and 6

Placeholder scan:

- no `TODO` / `TBD` placeholders remain in task steps
- each executable step has a concrete command or code block

Type consistency:

- crawler output uses `priceUsd`, `originalPriceUsd`, `priceCurrency`, `rawDescription`
- cleaner output uses `typeCode`, `subtypeCode`, and specs keys `price_usd`, `price_rmb`, `original_price_usd`, `original_price_rmb`
- care/apparel classification reuses the existing library classifier instead of inventing a parallel taxonomy
