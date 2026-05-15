import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import {
  buildDetailExtractionScript,
  crawlDetailItems,
  extractListItemsFromHtml,
  mergeUniqueListItems,
  shouldKeepDameCandidate,
  type DameListItem,
} from './crawler.ts';

test('shouldKeepDameCandidate keeps toys, lubricants, wipes, and lingerie but rejects STI kits', () => {
  assert.equal(
    shouldKeepDameCandidate({
      name: 'Aer Suction Vibrator',
      subtitle: 'Soft seal air-pulse stimulation',
      tags: ['toy', 'waterproof'],
      mode: 'list',
    }),
    true,
  );

  assert.equal(
    shouldKeepDameCandidate({
      name: 'Aloe Personal Lubricant',
      subtitle: 'Water-based lube',
      tags: ['lube'],
      mode: 'list',
    }),
    true,
  );

  assert.equal(
    shouldKeepDameCandidate({
      name: 'Intimate Cleansing Wipes',
      subtitle: 'Single-use wipes',
      tags: ['wipes'],
      mode: 'list',
    }),
    true,
  );

  assert.equal(
    shouldKeepDameCandidate({
      name: 'Lace Panty',
      subtitle: 'Intimate-use apparel',
      tags: ['lingerie'],
      mode: 'detail',
    }),
    true,
  );

  assert.equal(
    shouldKeepDameCandidate({
      name: 'Gonorrhea & Chlamydia STI Test Kit',
      subtitle: 'At-home screening',
      tags: ['sti', 'kit'],
      mode: 'detail',
    }),
    false,
  );
});

test('shouldKeepDameCandidate rejects generic merch copy at detail stage', () => {
  assert.equal(
    shouldKeepDameCandidate({
      name: 'Blue Logo Mug',
      subtitle: 'Ceramic coffee mug',
      rawDescription: 'Giftable kitchen merch for everyday use.',
      mode: 'detail',
    }),
    false,
  );
});

test('extractListItemsFromHtml normalizes Dame product cards in storefront order', () => {
  const result = extractListItemsFromHtml(`
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
  assert.deepEqual(result[1], {
    sourceUrl: 'https://dame.com/products/aloe-lube',
    name: 'Aloe Personal Lubricant',
    subtitle: 'Water-based lubricant.',
    coverImage: 'https://cdn.shopify.com/lube.jpg',
    priceUsd: 25,
    originalPriceUsd: null,
    priceCurrency: 'USD',
    categoryHints: [],
    genderHint: 'unisex',
    listPosition: 2,
  });
});

test('extractListItemsFromHtml excludes STI and health products from a mixed storefront list', () => {
  const result = extractListItemsFromHtml(`
    <div class="grid product-grid">
      <div class="grid__item">
        <a href="/products/eva-ii">
          <img src="//cdn.shopify.com/eva.jpg" />
          <h3>Eva Wearable Vibrator</h3>
        </a>
        <p>A hands-free vibrator for couples.</p>
        <span class="price-item">$129.00</span>
      </div>
      <div class="grid__item">
        <a href="/products/sti-test-kit">
          <img src="//cdn.shopify.com/sti.jpg" />
          <h3>Gonorrhea &amp; Chlamydia STI Test Kit</h3>
        </a>
        <p>At-home screening.</p>
        <span class="price-item">$59.00</span>
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
  assert.deepEqual(
    result.map((item) => item.sourceUrl),
    ['https://dame.com/products/eva-ii', 'https://dame.com/products/aloe-lube'],
  );
  assert.deepEqual(
    result.map((item) => item.listPosition),
    [1, 3],
  );
});

test('extractListItemsFromHtml handles realistic nested Shopify card markup with additional classes', () => {
  const result = extractListItemsFromHtml(`
    <section class="collection grid grid--uniform">
      <div class="grid__item small--one-half medium-up--one-third product-card-wrapper">
        <article class="card-wrapper product-card card-wrapper--media">
          <div class="card card--standard card--media">
            <div class="card__inner">
              <div class="card__media">
                <a class="full-unstyled-link" href="/products/eva-ii?variant=123">
                  <div class="media media--transparent">
                    <img class="motion-reduce" src="//cdn.shopify.com/eva.jpg?v=1" alt="Eva Wearable Vibrator" />
                  </div>
                </a>
              </div>
              <div class="card__content">
                <div class="card__information">
                  <h3 class="card__heading h5">
                    <a href="/products/eva-ii?variant=123" class="full-unstyled-link">
                      <span>Eva Wearable Vibrator</span>
                    </a>
                  </h3>
                  <div class="card-information">
                    <span class="caption-large light">A hands-free vibrator for couples.</span>
                    <div class="price price--on-sale">
                      <span class="price-item price-item--sale">$129.00</span>
                      <span class="price-item price-item--regular">$149.00</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </article>
      </div>
      <div class="grid__item small--one-half medium-up--one-third product-card-wrapper">
        <article class="card-wrapper product-card card-wrapper--media">
          <div class="card__inner">
            <a href="/products/aloe-lube" class="full-unstyled-link">
              <img src="//cdn.shopify.com/lube.jpg" alt="Aloe Personal Lubricant" />
            </a>
            <div class="card__content">
              <h3 class="card__heading">
                <a href="/products/aloe-lube">Aloe Personal Lubricant</a>
              </h3>
              <p class="card__caption">Water-based lubricant.</p>
              <div class="price">
                <span class="price-item">$25.00</span>
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>
  `);

  assert.equal(result.length, 2);
  assert.deepEqual(result[0], {
    sourceUrl: 'https://dame.com/products/eva-ii',
    name: 'Eva Wearable Vibrator',
    subtitle: 'A hands-free vibrator for couples.',
    coverImage: 'https://cdn.shopify.com/eva.jpg?v=1',
    priceUsd: 129,
    originalPriceUsd: 149,
    priceCurrency: 'USD',
    categoryHints: [],
    genderHint: 'unisex',
    listPosition: 1,
  });
  assert.deepEqual(result[1], {
    sourceUrl: 'https://dame.com/products/aloe-lube',
    name: 'Aloe Personal Lubricant',
    subtitle: 'Water-based lubricant.',
    coverImage: 'https://cdn.shopify.com/lube.jpg',
    priceUsd: 25,
    originalPriceUsd: null,
    priceCurrency: 'USD',
    categoryHints: [],
    genderHint: 'unisex',
    listPosition: 2,
  });
});

test('extractListItemsFromHtml handles current Dame li-based product cards with card-product-v2 classes', () => {
  const result = extractListItemsFromHtml(`
    <ul id="product-grid" class="product-grid-v2">
      <li class="grid__item">
        <div class="card-product-v2">
          <a href="/products/eva-ii" class="card-product-v2__image-link" tabindex="-1" aria-hidden="true">
            <div class="card-product-v2__image-wrapper">
              <img
                src="//cdn.shopify.com/s/files/1/1027/2873/files/eva-1-ice.png?v=1776326231&amp;width=800"
                alt="Ice"
                class="card-product-v2__img"
              />
            </div>
          </a>
          <div class="card-product-v2__content">
            <a href="/products/eva-ii" class="card-product-v2__title-link">
              <p class="card-product-v2__title" id="title-eva">
                <span class="card-product-v2__title-text">Eva Wearable Vibrator</span>
              </p>
            </a>
            <p class="card-product-v2__variants">2 colors</p>
            <div class="card-product-v2__actions">
              <button class="card-product-v2__btn">
                <span class="card-product-v2__btn-label">Pre-order</span>
                <span class="card-product-v2__btn-sep">|</span>
                <span class="card-product-v2__btn-price">
                  <span class="card-product-v2__btn-price-current">$129</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </li>
      <li class="grid__item">
        <div class="card-product-v2">
          <a href="/products/aloe-lube" class="card-product-v2__image-link" tabindex="-1" aria-hidden="true">
            <div class="card-product-v2__image-wrapper">
              <img
                src="//cdn.shopify.com/s/files/1/1027/2873/files/aloe-lube.png?v=1774287547&amp;width=800"
                alt="Travel"
                class="card-product-v2__img"
              />
            </div>
          </a>
          <div class="card-product-v2__content">
            <a href="/products/aloe-lube" class="card-product-v2__title-link">
              <p class="card-product-v2__title" id="title-lube">
                <span class="card-product-v2__title-text">Aloe Lube</span>
              </p>
            </a>
            <p class="card-product-v2__variants">2 sizes</p>
            <div class="card-product-v2__actions">
              <button class="card-product-v2__btn">
                <span class="card-product-v2__btn-label">Add to cart</span>
                <span class="card-product-v2__btn-sep">|</span>
                <span class="card-product-v2__btn-price">
                  <span class="card-product-v2__btn-price-current">$19</span>
                  <span class="card-product-v2__btn-price-original">$24</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </li>
      <li class="grid__item">
        <div class="card-product-v2">
          <a href="/products/gonorrhea-chlamydia-sti-test-kit" class="card-product-v2__image-link">
            <div class="card-product-v2__image-wrapper">
              <img src="//cdn.shopify.com/sti.png" alt="Urine" class="card-product-v2__img" />
            </div>
          </a>
          <div class="card-product-v2__content">
            <a href="/products/gonorrhea-chlamydia-sti-test-kit" class="card-product-v2__title-link">
              <p class="card-product-v2__title">
                <span class="card-product-v2__title-text">Gonorrhea &amp; Chlamydia STI Kit - 3 Site</span>
              </p>
            </a>
            <p class="card-product-v2__variants">2 options</p>
            <div class="card-product-v2__actions">
              <button class="card-product-v2__btn">
                <span class="card-product-v2__btn-price-current">$140</span>
              </button>
            </div>
          </div>
        </div>
      </li>
    </ul>
  `);

  assert.equal(result.length, 2);
  assert.deepEqual(result[0], {
    sourceUrl: 'https://dame.com/products/eva-ii',
    name: 'Eva Wearable Vibrator',
    subtitle: '2 colors',
    coverImage: 'https://cdn.shopify.com/s/files/1/1027/2873/files/eva-1-ice.png?v=1776326231&width=800',
    priceUsd: 129,
    originalPriceUsd: null,
    priceCurrency: 'USD',
    categoryHints: [],
    genderHint: 'unisex',
    listPosition: 1,
  });
  assert.deepEqual(result[1], {
    sourceUrl: 'https://dame.com/products/aloe-lube',
    name: 'Aloe Lube',
    subtitle: '2 sizes',
    coverImage: 'https://cdn.shopify.com/s/files/1/1027/2873/files/aloe-lube.png?v=1774287547&width=800',
    priceUsd: 19,
    originalPriceUsd: 24,
    priceCurrency: 'USD',
    categoryHints: [],
    genderHint: 'unisex',
    listPosition: 2,
  });
});

test('mergeUniqueListItems deduplicates canonical product urls and preserves earliest position', () => {
  const result = mergeUniqueListItems([
    {
      sourceUrl: 'https://dame.com/products/eva-ii?variant=123#details',
      name: 'Eva Wearable Vibrator',
      subtitle: 'A hands-free vibrator for couples.',
      coverImage: 'https://cdn.shopify.com/eva.jpg',
      priceUsd: 129,
      originalPriceUsd: null,
      priceCurrency: 'USD',
      categoryHints: ['toy'],
      genderHint: 'unisex',
      listPosition: 3,
    },
    {
      sourceUrl: 'https://dame.com/products/eva-ii/',
      name: 'Eva Wearable Vibrator',
      subtitle: 'A hands-free vibrator for couples.',
      coverImage: 'https://cdn.shopify.com/eva-2.jpg',
      priceUsd: 129,
      originalPriceUsd: 149,
      priceCurrency: 'USD',
      categoryHints: ['wearable', 'toy'],
      genderHint: 'unisex',
      listPosition: 1,
    },
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].sourceUrl, 'https://dame.com/products/eva-ii');
  assert.equal(result[0].listPosition, 1);
  assert.equal(result[0].originalPriceUsd, 149);
  assert.deepEqual(result[0].categoryHints, ['toy', 'wearable']);
});

test('mergeUniqueListItems keeps richer optional fields when the earliest duplicate is sparse', () => {
  const result = mergeUniqueListItems([
    {
      sourceUrl: 'https://dame.com/products/dip',
      name: 'Dip Personal Lubricant',
      subtitle: '',
      coverImage: '',
      priceUsd: null,
      originalPriceUsd: null,
      priceCurrency: 'USD',
      categoryHints: ['lube'],
      genderHint: 'unisex',
      listPosition: 1,
    },
    {
      sourceUrl: 'https://dame.com/products/dip?variant=456',
      name: 'Dip Personal Lubricant',
      subtitle: 'Water-based lubricant.',
      coverImage: 'https://cdn.shopify.com/dip.jpg',
      priceUsd: 25,
      originalPriceUsd: 29,
      priceCurrency: 'USD',
      categoryHints: ['water-based', 'lube'],
      genderHint: 'unisex',
      listPosition: 4,
    },
  ] satisfies DameListItem[]);

  assert.equal(result.length, 1);
  assert.deepEqual(result[0], {
    sourceUrl: 'https://dame.com/products/dip',
    name: 'Dip Personal Lubricant',
    subtitle: 'Water-based lubricant.',
    coverImage: 'https://cdn.shopify.com/dip.jpg',
    priceUsd: 25,
    originalPriceUsd: 29,
    priceCurrency: 'USD',
    categoryHints: ['lube', 'water-based'],
    genderHint: 'unisex',
    listPosition: 1,
  });
});

test('buildDetailExtractionScript extracts accordion sections and gallery from a detail page', async () => {
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
          <div class="price price--compare">$149.00</div>
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

    const detail = (await page.evaluate(buildDetailExtractionScript())) as {
      [key: string]: unknown;
    };
    assert.equal(detail.title, 'Eva Wearable Vibrator');
    assert.equal(detail.subtitle, 'A hands-free, wearable vibrator that stays in place.');
    assert.equal(detail.metaDescription, 'Hands-free wearable vibrator for couples.');
    assert.equal(detail.priceUsd, 129);
    assert.equal(detail.originalPriceUsd, 149);
    assert.equal(detail.coverImage, 'https://cdn.shopify.com/eva-1.jpg');
    assert.deepEqual(detail.galleryImages, [
      'https://cdn.shopify.com/eva-1.jpg',
      'https://cdn.shopify.com/eva-2.jpg',
    ]);
    assert.deepEqual(detail.manualUrls, ['https://cdn.shopify.com/eva-manual.pdf']);
    assert.match(String(detail.rawDescription || ''), /How to Use/);
    assert.match(String(detail.rawDescription || ''), /Medical Grade Silicone/);
    assert.match(String(detail.rawDescription || ''), /eva-manual\.pdf/);
  } finally {
    await browser.close();
  }
});

test('crawlDetailItems continues after a PDP failure and preserves later successes', async () => {
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map((arg) => String(arg)).join(' '));
  };

  try {
    const rows = await crawlDetailItems(
      [
        {
          sourceUrl: 'https://dame.com/products/fail',
          name: 'Fail Item',
          subtitle: 'Should fail',
          coverImage: 'https://cdn.shopify.com/fail.jpg',
          priceUsd: 10,
          originalPriceUsd: null,
          priceCurrency: 'USD',
          categoryHints: [],
          genderHint: 'unisex',
          listPosition: 1,
        },
        {
          sourceUrl: 'https://dame.com/products/eva-ii',
          name: 'Eva Wearable Vibrator',
          subtitle: 'A hands-free vibrator for couples.',
          coverImage: 'https://cdn.shopify.com/eva.jpg',
          priceUsd: 129,
          originalPriceUsd: null,
          priceCurrency: 'USD',
          categoryHints: [],
          genderHint: 'unisex',
          listPosition: 2,
        },
      ],
      async (item) => {
        if (item.sourceUrl.endsWith('/fail')) {
          throw new Error('detail fetch failed');
        }

        return {
          title: item.name,
          subtitle: item.subtitle,
          metaTitle: item.name,
          metaDescription: item.subtitle,
          priceUsd: item.priceUsd,
          originalPriceUsd: item.originalPriceUsd,
          coverImage: item.coverImage,
          galleryImages: [item.coverImage],
          manualUrls: [],
          rawDescription: 'Wearable vibrator for couples.',
        };
      },
    );

    assert.equal(rows.length, 1);
    assert.equal(rows[0].sourceUrl, 'https://dame.com/products/eva-ii');
    assert.equal(rows[0].isReviewed, false);
    assert.match(warnings[0] || '', /详情抓取失败/);
    assert.match(warnings[0] || '', /detail fetch failed/);
  } finally {
    console.warn = originalWarn;
  }
});
