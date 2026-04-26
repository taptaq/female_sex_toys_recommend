# Womanizer Official Scraper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full `womanizer-official` scraper pipeline that crawls the Womanizer US storefront, captures list and detail product data, converts USD prices into RMB, and persists normalized records through the existing cleaner/database flow.

**Architecture:** Follow the existing `*-official` scraper pattern in this repo. `crawler.ts` owns Playwright navigation, list/detail extraction, deduplication, review-buffer writing, and cleaner invocation; `cleaner.ts` owns normalization, translation, USD-to-CNY conversion, duplicate protection, cleaned JSON output, and DB writes.

**Tech Stack:** TypeScript, Node.js 20, `tsx`, `node:test`, Playwright, Prisma + PostgreSQL, shared raw-description translator.

---

## File Structure

- Create: `src/scraper/womanizer-official/crawler.ts`
- Create: `src/scraper/womanizer-official/crawler.test.ts`
- Create: `src/scraper/womanizer-official/cleaner.ts`
- Create: `src/scraper/womanizer-official/cleaner.test.ts`
- Modify: `package.json`
- Create at runtime: `src/data/womanizer-official-review-buffer.json`
- Create at runtime: `src/data/womanizer-official-cleaned-data.json`

Responsibilities:

- `src/scraper/womanizer-official/crawler.ts`: list/detail parsing helpers, Playwright runtime, review-buffer generation, cleaner handoff.
- `src/scraper/womanizer-official/crawler.test.ts`: regression coverage for list parsing, detail parsing, URL normalization, and price extraction.
- `src/scraper/womanizer-official/cleaner.ts`: USD/CNY exchange-rate fallback, spec inference, translation, duplicate skipping, Prisma writes, cleaned JSON emission.
- `src/scraper/womanizer-official/cleaner.test.ts`: regression coverage for price conversion, duplicate preparation, and normalized spec defaults.
- `package.json`: add `scrape:womanizer-official`.

### Task 1: Scaffold the crawler around failing parser tests

**Files:**
- Create: `src/scraper/womanizer-official/crawler.test.ts`
- Create: `src/scraper/womanizer-official/crawler.ts`

- [ ] **Step 1: Write the failing crawler parser tests**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import * as crawler from './crawler.ts';

test('extractListItemsFromHtml normalizes Womanizer cards and prices', async () => {
  const extractListItemsFromHtml = (crawler as Record<string, unknown>).extractListItemsFromHtml;
  assert.equal(typeof extractListItemsFromHtml, 'function');

  const result = (extractListItemsFromHtml as (html: string, pageNo: number) => Array<Record<string, unknown>>)(
    `
      <section>
        <article data-testid="product-card">
          <a href="/us/next"><img src="//cdn.womanizer.com/next-main.jpg" /></a>
          <a href="/us/next">Womanizer Next</a>
          <p>Pleasure Air clitoral stimulator</p>
          <span>$219.00</span>
          <span>$249.00</span>
        </article>
      </section>
    `,
    1,
  );

  assert.equal(result.length, 1);
  assert.deepEqual(result[0], {
    sourceUrl: 'https://www.womanizer.com/us/next',
    name: 'Womanizer Next',
    subtitle: 'Pleasure Air clitoral stimulator',
    coverImage: 'https://cdn.womanizer.com/next-main.jpg',
    priceUsd: 219,
    originalPriceUsd: 249,
    genderHint: 'female',
    categoryHints: ['clitoral stimulator'],
    listPosition: 1,
  });
});

test('buildDetailExtractionScript extracts fallback detail fields from a product page', async () => {
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
          <title>Womanizer Next</title>
          <meta name="description" content="Flagship Pleasure Air stimulator." />
          <script type="application/ld+json">
            {
              "@context":"https://schema.org",
              "@type":"Product",
              "name":"Womanizer Next",
              "sku":"WZ-NEXT-001",
              "image":["https://cdn.womanizer.com/next-main.jpg","https://cdn.womanizer.com/next-side.jpg"],
              "offers":{"price":"219.00","priceCurrency":"USD"}
            }
          </script>
        </head>
        <body>
          <h1>Womanizer Next</h1>
          <p>Adaptive Pleasure Air technology for personalized stimulation.</p>
          <div>SKU: WZ-NEXT-001</div>
          <div>$219.00</div>
          <section>
            <h2>Materials</h2>
            <p>Body-safe silicone</p>
          </section>
        </body>
      </html>
    `);

    const detail = (await page.evaluate((buildDetailExtractionScript as () => string)())) as Record<string, unknown>;
    assert.equal(detail.title, 'Womanizer Next');
    assert.equal(detail.productCode, 'WZ-NEXT-001');
    assert.equal(detail.priceUsd, 219);
    assert.equal(detail.coverImage, 'https://cdn.womanizer.com/next-main.jpg');
    assert.deepEqual(detail.imageUrls, [
      'https://cdn.womanizer.com/next-main.jpg',
      'https://cdn.womanizer.com/next-side.jpg',
    ]);
  } finally {
    await browser.close();
  }
});
```

- [ ] **Step 2: Run the crawler parser tests to verify they fail**

Run: `node --import tsx --test src/scraper/womanizer-official/crawler.test.ts`

Expected: FAIL because `src/scraper/womanizer-official/crawler.ts` does not yet export `extractListItemsFromHtml` and `buildDetailExtractionScript`.

- [ ] **Step 3: Add the minimal crawler module and exports**

```ts
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { runCleaner } from './cleaner.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ORIGIN = 'https://www.womanizer.com';
export const LIST_URL = `${ORIGIN}/us/sex-toys`;
export const BUFFER_PATH = path.resolve(__dirname, '../../data/womanizer-official-review-buffer.json');
export const MAX_ITEMS = Number(process.env.WOMANIZER_OFFICIAL_MAX_ITEMS || '200');

export type ListItem = {
  sourceUrl: string;
  name: string;
  subtitle: string;
  coverImage: string;
  priceUsd: number | null;
  originalPriceUsd: number | null;
  genderHint: 'female' | 'male' | 'unisex';
  categoryHints: string[];
  listPosition: number | null;
};

export type ProductDetail = {
  title: string;
  subtitle: string;
  metaTitle: string;
  metaDescription: string;
  priceUsd: number | null;
  originalPriceUsd: number | null;
  featureHeadlines: string[];
  specPairs: Array<{ key: string; value: string }>;
  bodySummary: string;
  coverImage: string;
  imageUrls: string[];
  productCode: string;
};

export function extractListItemsFromHtml(_html: string, _pageNo: number): ListItem[] {
  return [];
}

export function buildDetailExtractionScript(): string {
  return `(() => ({ title: '', subtitle: '', metaTitle: '', metaDescription: '', priceUsd: null, originalPriceUsd: null, featureHeadlines: [], specPairs: [], bodySummary: '', coverImage: '', imageUrls: [], productCode: '' }))()`;
}

export async function runCrawler() {
  return [];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCrawler()
    .then(() => runCleaner())
    .catch((error) => {
      console.error('[womanizer-official] crawler failed', error);
      process.exitCode = 1;
    });
}
```

- [ ] **Step 4: Re-run the crawler parser tests and confirm the specific assertions still fail**

Run: `node --import tsx --test src/scraper/womanizer-official/crawler.test.ts`

Expected: FAIL on list/detail field assertions, proving the tests are exercising real behavior rather than only module presence.

- [ ] **Step 5: Commit the scaffold**

```bash
git add src/scraper/womanizer-official/crawler.ts src/scraper/womanizer-official/crawler.test.ts
git commit -m "test: scaffold womanizer crawler parsing coverage"
```

### Task 2: Implement the crawler list/detail extraction and review-buffer flow

**Files:**
- Modify: `src/scraper/womanizer-official/crawler.ts`
- Modify: `src/scraper/womanizer-official/crawler.test.ts`

- [ ] **Step 1: Extend the crawler tests with URL normalization and deduplication expectations**

```ts
test('mergeUniqueListItems keeps earliest list position for duplicate canonical urls', () => {
  const mergeUniqueListItems = (crawler as Record<string, unknown>).mergeUniqueListItems;
  assert.equal(typeof mergeUniqueListItems, 'function');

  const result = (mergeUniqueListItems as (items: Array<Record<string, unknown>>) => Array<Record<string, unknown>>)([
    {
      sourceUrl: 'https://www.womanizer.com/us/next?variant=black',
      name: 'Womanizer Next',
      subtitle: '',
      coverImage: 'https://cdn.womanizer.com/next-main.jpg',
      priceUsd: 219,
      originalPriceUsd: 249,
      genderHint: 'female',
      categoryHints: ['clitoral stimulator'],
      listPosition: 1,
    },
    {
      sourceUrl: 'https://www.womanizer.com/us/next',
      name: 'Womanizer Next',
      subtitle: '',
      coverImage: 'https://cdn.womanizer.com/next-main.jpg',
      priceUsd: 219,
      originalPriceUsd: 249,
      genderHint: 'female',
      categoryHints: ['clitoral stimulator'],
      listPosition: 7,
    },
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].sourceUrl, 'https://www.womanizer.com/us/next');
  assert.equal(result[0].listPosition, 1);
});
```

- [ ] **Step 2: Run the crawler tests to verify the new deduplication test fails**

Run: `node --import tsx --test src/scraper/womanizer-official/crawler.test.ts`

Expected: FAIL because `mergeUniqueListItems` is not implemented yet.

- [ ] **Step 3: Implement the actual crawler parsing and buffer-writing flow**

```ts
function normalizeWhitespace(value: string): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNumber(value: unknown): number | null {
  const numeric = Number(String(value ?? '').replace(/[^\d.]+/g, ''));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
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

function inferGender(text: string): 'female' | 'male' | 'unisex' {
  const value = text.toLowerCase();
  if (/(clitoral|g-spot|rabbit|vaginal|pleasure air)/i.test(value)) return 'female';
  if (/(prostate|male|for him|penis)/i.test(value)) return 'male';
  return 'unisex';
}

function inferCategoryHints(text: string): string[] {
  const value = text.toLowerCase();
  const hints: string[] = [];
  if (value.includes('clitoral')) hints.push('clitoral stimulator');
  if (value.includes('g-spot')) hints.push('g-spot vibrator');
  if (value.includes('couples')) hints.push('couples toy');
  return hints;
}

export function extractListItemsFromHtml(html: string, pageNo: number): ListItem[] {
  const cards = Array.from(
    html.matchAll(/<article[\s\S]*?<a[^>]+href="([^"]+)"[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?<a[^>]*>([^<]+)<\/a>[\s\S]*?<p>([^<]*)<\/p>[\s\S]*?<span>\$?([\d.]+)<\/span>(?:[\s\S]*?<span>\$?([\d.]+)<\/span>)?/gi),
  );

  return cards.map((match, index) => {
    const name = normalizeWhitespace(match[3]);
    const subtitle = normalizeWhitespace(match[4]);
    return {
      sourceUrl: resolveUrl(match[1]),
      name,
      subtitle,
      coverImage: resolveUrl(match[2]),
      priceUsd: parseNumber(match[5]),
      originalPriceUsd: parseNumber(match[6]),
      genderHint: inferGender(`${name}\n${subtitle}`),
      categoryHints: inferCategoryHints(`${name}\n${subtitle}`),
      listPosition: (pageNo - 1) * 100 + index + 1,
    };
  });
}

export function mergeUniqueListItems(items: ListItem[]): ListItem[] {
  const byUrl = new Map<string, ListItem>();
  for (const item of items) {
    const canonicalUrl = resolveUrl(item.sourceUrl);
    if (!canonicalUrl) continue;
    const existing = byUrl.get(canonicalUrl);
    if (!existing || Number(item.listPosition ?? Infinity) < Number(existing.listPosition ?? Infinity)) {
      byUrl.set(canonicalUrl, { ...item, sourceUrl: canonicalUrl });
    }
  }
  return Array.from(byUrl.values());
}

export function buildDetailExtractionScript(): string {
  return `(() => {
    const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
    const parsePrice = (value) => {
      const numeric = Number(String(value || '').replace(/[^\\d.]+/g, ''));
      return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
    };
    const ldJson = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
      .map((node) => node.textContent || '')
      .find((text) => text.includes('"Product"'));
    let product = {};
    try { product = ldJson ? JSON.parse(ldJson) : {}; } catch {}
    const images = Array.isArray(product.image) ? product.image : [];
    return {
      title: normalize(document.querySelector('h1')?.textContent || product.name || document.title),
      subtitle: normalize(document.querySelector('main p')?.textContent || ''),
      metaTitle: normalize(document.title),
      metaDescription: normalize(document.querySelector('meta[name="description"]')?.getAttribute('content') || ''),
      priceUsd: parsePrice(document.body.textContent || '') ?? parsePrice(product?.offers?.price),
      originalPriceUsd: null,
      featureHeadlines: Array.from(document.querySelectorAll('h2, h3')).map((node) => normalize(node.textContent || '')).filter(Boolean).slice(0, 8),
      specPairs: Array.from(document.querySelectorAll('section')).flatMap((section) => {
        const key = normalize(section.querySelector('h2, h3, strong')?.textContent || '');
        const value = normalize(section.querySelector('p, li')?.textContent || '');
        return key && value ? [{ key, value }] : [];
      }).slice(0, 20),
      bodySummary: normalize(document.querySelector('main')?.textContent || document.body.textContent || ''),
      coverImage: normalize(document.querySelector('img')?.currentSrc || images[0] || ''),
      imageUrls: images.filter(Boolean),
      productCode: normalize(document.body.textContent?.match(/SKU[:\\s]+([A-Z0-9-]+)/i)?.[1] || product.sku || ''),
    };
  })()`;
}

async function createContext(): Promise<BrowserContext> {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    ignoreDefaultArgs: ['--enable-automation'],
  });
  return browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 2200 },
    locale: 'en-US',
  });
}

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function gotoAndSettle(page: Page, url: string) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(3000);
}

async function extractListItems(page: Page): Promise<ListItem[]> {
  const html = await page.content();
  return extractListItemsFromHtml(html, 1);
}

async function extractProductDetail(page: Page): Promise<ProductDetail> {
  return page.evaluate(buildDetailExtractionScript());
}

async function writeReviewBuffer(rows: Array<Record<string, unknown>>) {
  ensureDir(BUFFER_PATH);
  fs.writeFileSync(BUFFER_PATH, JSON.stringify(rows, null, 2), 'utf8');
}

export async function runCrawler() {
  const context = await createContext();
  const page = await context.newPage();

  try {
    await gotoAndSettle(page, LIST_URL);
    const uniqueListItems = mergeUniqueListItems(await extractListItems(page)).slice(0, MAX_ITEMS);
    const rows: Array<Record<string, unknown>> = [];

    for (const item of uniqueListItems) {
      const detailPage = await context.newPage();
      try {
        await gotoAndSettle(detailPage, item.sourceUrl);
        const detail = await extractProductDetail(detailPage);
        rows.push({
          ...item,
          ...detail,
          price: detail.priceUsd ?? item.priceUsd ?? null,
          priceUsd: detail.priceUsd ?? item.priceUsd ?? null,
          priceCurrency: 'USD',
        });
      } finally {
        await detailPage.close();
      }
    }

    await writeReviewBuffer(rows);
    return rows;
  } finally {
    await context.close();
  }
}
```

- [ ] **Step 4: Re-run the crawler tests and confirm they pass**

Run: `node --import tsx --test src/scraper/womanizer-official/crawler.test.ts`

Expected: PASS with all crawler parser tests green.

- [ ] **Step 5: Commit the crawler implementation**

```bash
git add src/scraper/womanizer-official/crawler.ts src/scraper/womanizer-official/crawler.test.ts
git commit -m "feat: add womanizer official crawler"
```

### Task 3: Drive cleaner behavior from failing normalization tests

**Files:**
- Create: `src/scraper/womanizer-official/cleaner.test.ts`
- Create: `src/scraper/womanizer-official/cleaner.ts`

- [ ] **Step 1: Write the failing cleaner tests**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import * as cleaner from './cleaner.ts';

test('resolveRmbPrice converts usd using the provided rate and rounds to whole RMB', () => {
  const resolveRmbPrice = (cleaner as Record<string, unknown>).resolveRmbPrice;
  assert.equal(typeof resolveRmbPrice, 'function');
  assert.equal((resolveRmbPrice as (usd: number | null, rate: number) => number | null)(219, 7.2), 1577);
  assert.equal((resolveRmbPrice as (usd: number | null, rate: number) => number | null)(null, 7.2), null);
});

test('buildNormalizedSpecs keeps usd traceability and inferred tags', () => {
  const buildNormalizedSpecs = (cleaner as Record<string, unknown>).buildNormalizedSpecs;
  assert.equal(typeof buildNormalizedSpecs, 'function');

  const specs = (buildNormalizedSpecs as (item: Record<string, unknown>, rate: number) => Record<string, unknown>)(
    {
      name: 'Womanizer Next',
      subtitle: 'Adaptive Pleasure Air clitoral stimulator',
      priceUsd: 219,
      rawDescription: '[基础信息]\\n材质: Body-safe silicone\\n防水: IPX7',
      genderHint: 'female',
    },
    7.2,
  );

  assert.equal(specs.price_usd, 219);
  assert.equal(specs.price_rmb, 1577);
  assert.equal(specs.gender, 'female');
  assert.equal(specs.waterproof, 7);
  assert.deepEqual(specs.function_tags, ['吮吸刺激']);
});
```

- [ ] **Step 2: Run the cleaner tests to verify they fail**

Run: `node --import tsx --test src/scraper/womanizer-official/cleaner.test.ts`

Expected: FAIL because `resolveRmbPrice` and `buildNormalizedSpecs` are not implemented yet.

- [ ] **Step 3: Add the minimal cleaner exports**

```ts
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const BUFFER_PATH = path.resolve(__dirname, '../../data/womanizer-official-review-buffer.json');
export const CLEANED_PATH = path.resolve(__dirname, '../../data/womanizer-official-cleaned-data.json');

export function resolveRmbPrice(_usd: number | null, _rate: number): number | null {
  return null;
}

export function buildNormalizedSpecs(_item: Record<string, unknown>, _rate: number): Record<string, unknown> {
  return {
    price_usd: null,
    price_rmb: null,
    gender: 'unisex',
    waterproof: null,
    function_tags: [],
  };
}

export async function runCleaner() {
  if (!fs.existsSync(BUFFER_PATH)) return [];
  return [];
}
```

- [ ] **Step 4: Re-run the cleaner tests and confirm the assertions still fail**

Run: `node --import tsx --test src/scraper/womanizer-official/cleaner.test.ts`

Expected: FAIL on conversion and normalized-spec assertions, proving the tests are behavior-oriented.

- [ ] **Step 5: Commit the cleaner test scaffold**

```bash
git add src/scraper/womanizer-official/cleaner.ts src/scraper/womanizer-official/cleaner.test.ts
git commit -m "test: scaffold womanizer cleaner coverage"
```

### Task 4: Implement cleaner normalization, translation, persistence, and script wiring

**Files:**
- Modify: `src/scraper/womanizer-official/cleaner.ts`
- Modify: `package.json`

- [ ] **Step 1: Add a package script test by updating the plan-owned command surface**

```json
{
  "scripts": {
    "scrape:womanizer-official": "tsx -r dotenv/config src/scraper/womanizer-official/crawler.ts"
  }
}
```

- [ ] **Step 2: Implement the cleaner behavior and DB write flow**

```ts
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { translateRawDescriptionToZh } from '../shared/raw-description-translator.ts';
import {
  extractCanonicalName,
  hasMeaningfulEnglish,
  isPlaceholderProductName,
  prepareUniqueBufferItemsForCleaning,
  resolvePersistedRawDescription,
} from '../nomitang-official/cleaner-helpers.ts';

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const FALLBACK_USD_TO_CNY_RATE = 7.2;

export function resolveRmbPrice(usd: number | null, rate: number): number | null {
  if (!Number.isFinite(Number(usd)) || Number(usd) <= 0) return null;
  return Math.round(Number(usd) * rate);
}

function inferFunctionTags(text: string): string[] {
  const value = text.toLowerCase();
  const tags: string[] = [];
  if (/(pleasure air|air suction|clitoral stimulator|clitoral suction)/i.test(value)) tags.push('吮吸刺激');
  if (/(g-spot)/i.test(value)) tags.push('G点刺激');
  if (/(app|remote)/i.test(value)) tags.push('远程互动');
  return tags;
}

function extractWaterproofLevel(text: string): number | null {
  const match = text.match(/ipx\\s*([0-9])/i);
  if (match) return Number(match[1]);
  if (/waterproof/i.test(text)) return 7;
  return null;
}

export function buildNormalizedSpecs(item: Record<string, unknown>, rate: number): Record<string, unknown> {
  const sourceText = [item.name, item.subtitle, item.rawDescription].filter(Boolean).join('\\n');
  const priceUsd = Number(item.priceUsd ?? item.price ?? null);
  return {
    price_usd: Number.isFinite(priceUsd) && priceUsd > 0 ? priceUsd : null,
    price_rmb: resolveRmbPrice(Number.isFinite(priceUsd) && priceUsd > 0 ? priceUsd : null, rate),
    fx_rate_to_cny: rate,
    fx_rate_source: 'frankfurter-or-fallback',
    fx_rate_date: '',
    gender: String(item.genderHint || '').toLowerCase() === 'female' ? 'female' : 'unisex',
    waterproof: extractWaterproofLevel(sourceText),
    function_tags: inferFunctionTags(sourceText),
    material: /silicone/i.test(sourceText) ? '硅胶' : '硅胶 / ABS塑料',
    appearance: 'normal',
    physical_form: 'external',
    motor_type: 'gentle',
    max_db: null,
  };
}

async function refreshUsdToCnyRate(): Promise<{ rate: number; source: string; date: string }> {
  try {
    const response = await fetch('https://api.frankfurter.dev/v1/latest?base=USD&symbols=CNY', {
      headers: { accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = (await response.json()) as { date?: string; rates?: Record<string, number> };
    const rate = Number(payload?.rates?.CNY);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error('missing CNY rate');
    return { rate, source: 'frankfurter', date: String(payload?.date || '') };
  } catch {
    return { rate: FALLBACK_USD_TO_CNY_RATE, source: 'fallback', date: '' };
  }
}

export async function runCleaner() {
  const rawRows = JSON.parse(fs.readFileSync(BUFFER_PATH, 'utf8')) as Array<Record<string, unknown>>;
  const prepared = prepareUniqueBufferItemsForCleaning(rawRows);
  const fx = await refreshUsdToCnyRate();
  const cleaned = [];

  for (const item of prepared.items) {
    const canonicalName = extractCanonicalName(String(item.name || ''));
    if (!canonicalName || isPlaceholderProductName(canonicalName)) continue;

    const translated = await translateRawDescriptionToZh(String(item.rawDescription || ''));
    const rawDescription = resolvePersistedRawDescription(translated, String(item.rawDescription || ''));
    const specs = buildNormalizedSpecs({ ...item, rawDescription }, fx.rate);
    specs.fx_rate_source = fx.source;
    specs.fx_rate_date = fx.date;

    cleaned.push({
      name: canonicalName,
      brand: 'Womanizer',
      price: specs.price_rmb,
      image_url: item.coverImage || '',
      source_url: item.sourceUrl || '',
      raw_description: hasMeaningfulEnglish(rawDescription) ? rawDescription : rawDescription,
      specs,
      gender: specs.gender,
      material: specs.material,
    });
  }

  fs.writeFileSync(CLEANED_PATH, JSON.stringify(cleaned, null, 2), 'utf8');
  for (const row of cleaned) {
    const existing = await prisma.products.findFirst({ where: { name: row.name } });
    if (existing) continue;

    const inserted = await prisma.products.create({
      data: {
        name: row.name,
        brand: row.brand,
        price: row.price,
        image: row.image_url,
        specs: row.specs,
        raw_description: row.raw_description,
        gender: row.gender,
        material: row.material,
      },
    });

    await prisma.recommender_toys.create({
      data: {
        original_id: inserted.id,
        name: row.name,
        brand: row.brand,
        price: row.price,
        image_url: row.image_url,
        raw_description: row.raw_description,
        specs: row.specs,
        gender: row.gender,
        material: row.material,
      },
    });
  }

  return cleaned;
}
```

- [ ] **Step 3: Run the cleaner tests and confirm they pass**

Run: `node --import tsx --test src/scraper/womanizer-official/cleaner.test.ts`

Expected: PASS with both cleaner normalization tests green.

- [ ] **Step 4: Run a focused end-to-end scrape against a small item cap**

Run: `WOMANIZER_OFFICIAL_MAX_ITEMS=2 npm run scrape:womanizer-official`

Expected:
- `src/data/womanizer-official-review-buffer.json` exists
- `src/data/womanizer-official-cleaned-data.json` exists
- both files contain real `https://www.womanizer.com/us/...` product URLs

- [ ] **Step 5: Commit the cleaner and script wiring**

```bash
git add package.json src/scraper/womanizer-official/cleaner.ts src/scraper/womanizer-official/cleaner.test.ts src/data/womanizer-official-review-buffer.json src/data/womanizer-official-cleaned-data.json
git commit -m "feat: add womanizer official cleaner"
```

### Task 5: Final verification and handoff

**Files:**
- Modify if needed: `src/scraper/womanizer-official/crawler.ts`
- Modify if needed: `src/scraper/womanizer-official/cleaner.ts`
- Modify if needed: `src/scraper/womanizer-official/crawler.test.ts`
- Modify if needed: `src/scraper/womanizer-official/cleaner.test.ts`

- [ ] **Step 1: Run the full targeted scraper test suite**

Run: `node --import tsx --test src/scraper/womanizer-official/crawler.test.ts src/scraper/womanizer-official/cleaner.test.ts`

Expected: PASS with all Womanizer-specific tests green.

- [ ] **Step 2: Run the project typecheck**

Run: `npx tsc --noEmit`

Expected: PASS with exit code `0`.

- [ ] **Step 3: Re-run the 2-item scrape after any final fixes**

Run: `WOMANIZER_OFFICIAL_MAX_ITEMS=2 npm run scrape:womanizer-official`

Expected: PASS with updated review buffer and cleaned JSON reflecting the final parser behavior.

- [ ] **Step 4: Inspect the output for the required business fields**

Run: `rg -n "\"price\"|\"price_usd\"|\"price_rmb\"|\"sourceUrl\"|\"name\"" src/data/womanizer-official-review-buffer.json src/data/womanizer-official-cleaned-data.json`

Expected:
- review buffer contains `sourceUrl`, product name, and USD price data
- cleaned JSON contains `price`, `price_usd`, and `price_rmb`

- [ ] **Step 5: Commit the verification-safe final state**

```bash
git add src/scraper/womanizer-official/crawler.ts src/scraper/womanizer-official/crawler.test.ts src/scraper/womanizer-official/cleaner.ts src/scraper/womanizer-official/cleaner.test.ts package.json src/data/womanizer-official-review-buffer.json src/data/womanizer-official-cleaned-data.json
git commit -m "feat: add womanizer official scraper pipeline"
```
