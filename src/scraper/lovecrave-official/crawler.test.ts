import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLovecraveRawDescription,
  crawlListingPages,
  extractDetailFromHtml,
  extractDetailFromShopifyProduct,
  extractListItemsFromHtml,
  extractListItemsFromShopifyJson,
  extractRelevantDetailTextFromHtml,
  isShopifyErrorPage,
  shouldKeepLovecraveCandidate,
} from './crawler.ts';

test('shouldKeepLovecraveCandidate keeps wearable and toy-like Lovecrave products but rejects non-toy accessories', () => {
  assert.equal(
    shouldKeepLovecraveCandidate({
      name: 'Bullet',
      subtitle: 'Compact personal vibrator',
      categoryHints: ['Bedside Products'],
    }),
    true,
  );

  assert.equal(
    shouldKeepLovecraveCandidate({
      name: 'Vesper',
      subtitle: 'A wearable necklace vibrator for discreet pleasure',
      categoryHints: ['Jewelry Vibrators'],
    }),
    true,
  );

  assert.equal(
    shouldKeepLovecraveCandidate({
      name: 'CRAVE Gift Card',
      subtitle: 'Gift card',
    }),
    false,
  );

  assert.equal(
    shouldKeepLovecraveCandidate({
      name: 'Charger Cable',
      subtitle: 'USB charging cable',
    }),
    false,
  );

  assert.equal(
    shouldKeepLovecraveCandidate({
      name: 'Cuban Chain',
      subtitle: 'Jewelry accessory chain',
    }),
    false,
  );

  assert.equal(
    shouldKeepLovecraveCandidate({
      name: 'Tease Chain',
      subtitle: 'Necklace attachment',
      rawDescription: 'Only compatible with the Tease Ring vibrator. Only necklace included.',
    }),
    false,
  );
});

test('extractListItemsFromHtml parses #product-grid and filters non-toy items', () => {
  const result = extractListItemsFromHtml(`
    <div id="product-grid">
      <div class="grid__item">
        <a href="/products/bullet">
          <img src="//cdn.shopify.com/bullet.jpg" alt="Bullet" />
          <h3>Bullet</h3>
        </a>
        <p>Compact personal vibrator.</p>
        <span class="price-item">$48.00</span>
      </div>
      <div class="grid__item">
        <a href="/products/cuban-chain">
          <img src="//cdn.shopify.com/chain.jpg" alt="Cuban Chain" />
          <h3>Cuban Chain</h3>
        </a>
        <p>Jewelry accessory chain.</p>
        <span class="price-item">$110.00</span>
      </div>
      <div class="grid__item">
        <a href="/products/vesper">
          <img src="//cdn.shopify.com/vesper.jpg" alt="Vesper" />
          <h3>Vesper</h3>
        </a>
        <p>Wearable necklace vibrator.</p>
        <span class="price-item price-item--sale">$69.00</span>
        <span class="price-item price-item--regular">$79.00</span>
      </div>
    </div>
  `);

  assert.equal(result.length, 2);
  assert.deepEqual(result[0], {
    sourceUrl: 'https://lovecrave.com/products/bullet',
    name: 'Bullet',
    subtitle: 'Compact personal vibrator.',
    coverImage: 'https://cdn.shopify.com/bullet.jpg',
    priceUsd: 48,
    originalPriceUsd: null,
    priceCurrency: 'USD',
    categoryHints: [],
    genderHint: 'female',
    listPosition: 1,
  });
  assert.deepEqual(result[1], {
    sourceUrl: 'https://lovecrave.com/products/vesper',
    name: 'Vesper',
    subtitle: 'Wearable necklace vibrator.',
    coverImage: 'https://cdn.shopify.com/vesper.jpg',
    priceUsd: 69,
    originalPriceUsd: 79,
    priceCurrency: 'USD',
    categoryHints: [],
    genderHint: 'female',
    listPosition: 3,
  });
});

test('extractListItemsFromShopifyJson keeps toy-like product rows and preserves JSON order', () => {
  const result = extractListItemsFromShopifyJson({
    products: [
      {
        title: 'Bullet',
        handle: 'bullet',
        product_type: 'Bedside Products',
        body_html: '<p>Compact personal vibrator.</p>',
        tags: 'vibrator,bullet',
        variants: [{ price: '48.00', compare_at_price: null }],
        images: [{ src: '//cdn.shopify.com/bullet.jpg' }],
      },
      {
        title: 'Charger Cable',
        handle: 'charger-cable',
        product_type: 'Accessories',
        body_html: '<p>Replacement charging cable.</p>',
        tags: 'charger,accessory',
        variants: [{ price: '18.00', compare_at_price: null }],
        images: [{ src: '//cdn.shopify.com/cable.jpg' }],
      },
      {
        title: 'Vesper',
        handle: 'vesper',
        product_type: 'Jewelry Vibrators',
        body_html: '<p>A wearable necklace vibrator.</p>',
        tags: 'wearable,vibrator,necklace',
        variants: [{ price: '69.00', compare_at_price: '79.00' }],
        images: [{ src: '//cdn.shopify.com/vesper.jpg' }],
      },
    ],
  });

  assert.equal(result.length, 2);
  assert.deepEqual(
    result.map((item) => ({ name: item.name, listPosition: item.listPosition })),
    [
      { name: 'Bullet', listPosition: 1 },
      { name: 'Vesper', listPosition: 3 },
    ],
  );
});

test('crawlListingPages falls back to Shopify JSON when collection HTML is a Shopify error page', async () => {
  const result = await crawlListingPages({
    maxItems: 10,
    fetchCollectionHtml: async () => `
      <html>
        <head><title>Something went wrong</title></head>
        <body><main><h1>Something went wrong</h1><p>Shopify storefront error.</p></main></body>
      </html>
    `,
    fetchCollectionJsonPage: async (page) =>
      page === 1
        ? {
            products: [
              {
                title: 'Wink',
                handle: 'wink',
                product_type: 'Bedside Products',
                body_html: '<p>Finger vibrator for clitoral play.</p>',
                tags: 'vibrator,clitoral',
                variants: [{ price: '55.00', compare_at_price: null }],
                images: [{ src: '//cdn.shopify.com/wink.jpg' }],
              },
            ],
          }
        : { products: [] },
  });

  assert.equal(result.length, 1);
  assert.equal(result[0]?.name, 'Wink');
  assert.equal(result[0]?.sourceUrl, 'https://lovecrave.com/products/wink');
});

test('extractRelevantDetailTextFromHtml and extractDetailFromHtml keep broad description content', () => {
  const html = `
    <html>
      <head>
        <title>Vesper Necklace Vibrator</title>
        <meta name="description" content="A discreet necklace vibrator for personal pleasure." />
      </head>
      <body>
        <main id="MainContent">
          <h1>Vesper</h1>
          <div class="product__description rte">
            <p>Wear it as a necklace and keep pleasure close.</p>
            <p>Vesper is a wearable vibrator with powerful yet quiet vibrations.</p>
          </div>
          <div class="image-with-text__text-item grid__item">
            Crafted to feel like jewelry first, with discreet body-safe pleasure built in.
          </div>
          <details class="product__accordion">
            <summary>Details</summary>
            <ul>
              <li>USB rechargeable</li>
              <li>Discreet pendant silhouette</li>
            </ul>
          </details>
          <img src="//cdn.shopify.com/vesper-1.jpg" alt="Vesper" />
        </main>
      </body>
    </html>
  `;

  const relevantText = extractRelevantDetailTextFromHtml(html);
  assert.match(relevantText, /wear it as a necklace/i);
  assert.match(relevantText, /crafted to feel like jewelry first/i);
  assert.match(relevantText, /usb rechargeable/i);

  const detail = extractDetailFromHtml(html);
  assert.equal(detail.title, 'Vesper');
  assert.equal(detail.coverImage, 'https://cdn.shopify.com/vesper-1.jpg');
  assert.match(detail.rawDescription, /wearable vibrator/i);
  assert.match(detail.rawDescription, /crafted to feel like jewelry first/i);
  assert.match(detail.rawDescription, /discreet pendant silhouette/i);
});

test('buildLovecraveRawDescription deduplicates repeated text segments', () => {
  assert.equal(
    buildLovecraveRawDescription(['Vesper', 'Wearable vibrator', 'Wearable vibrator', 'USB rechargeable']),
    'Vesper\nWearable vibrator\nUSB rechargeable',
  );
});

test('extractDetailFromShopifyProduct falls back to Shopify description field when body_html is absent', () => {
  const detail = extractDetailFromShopifyProduct({
    title: 'Bullet',
    description: '<h4>Superior materials and design choices bring a sleek update to the classic bullet vibe.</h4>',
    variants: [{ price: '48.00', compare_at_price: '58.00' }],
    images: [{ src: '//cdn.shopify.com/bullet.jpg', alt: 'Bullet' }],
  });

  assert.equal(detail.title, 'Bullet');
  assert.equal(detail.priceUsd, 48);
  assert.equal(detail.originalPriceUsd, 58);
  assert.equal(detail.coverImage, 'https://cdn.shopify.com/bullet.jpg');
  assert.match(detail.rawDescription, /bullet vibe/i);
});

test('isShopifyErrorPage detects generic storefront error pages', () => {
  assert.equal(
    isShopifyErrorPage('<html><body><h1>Something went wrong</h1><p>Shopify failed to load this page.</p></body></html>'),
    true,
  );
  assert.equal(isShopifyErrorPage('<div id="product-grid"><div class="grid__item">ok</div></div>'), false);
});
