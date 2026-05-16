import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUnboundRawDescription,
  extractDetailFromHtml,
  extractListItemsFromHtml,
  extractListItemsFromShopifyJson,
  extractRelevantDetailTextFromHtml,
  isShopifyErrorPage,
  shouldKeepUnboundCandidate,
} from './crawler.ts';

test('shouldKeepUnboundCandidate keeps intimate products and rejects obvious non-product rows', () => {
  assert.equal(
    shouldKeepUnboundCandidate({
      name: 'Puff',
      subtitle: 'Compact suction vibe',
      categoryHints: ['Vibrator'],
    }),
    true,
  );

  assert.equal(
    shouldKeepUnboundCandidate({
      name: 'Best Sellers',
      subtitle: 'Bundle set with Puff and Bender',
      categoryHints: ['Sets'],
      rawDescription: 'Includes two vibrators and a storage bag.',
    }),
    true,
  );

  assert.equal(
    shouldKeepUnboundCandidate({
      name: 'Gift Card',
      subtitle: 'Digital gift card',
    }),
    false,
  );

  assert.equal(
    shouldKeepUnboundCandidate({
      name: 'Sticker Pack',
      subtitle: 'Lifestyle merch',
    }),
    false,
  );
});

test('extractListItemsFromHtml parses collection-grid__items cards', () => {
  const result = extractListItemsFromHtml(`
    <div class="collection-grid__items">
      <div class="grid__item">
        <a href="/products/unbound-puff-suction-vibe">
          <img src="//cdn.shopify.com/puff.jpg" alt="Puff" />
          <h3>Puff</h3>
        </a>
        <p>Compact suction vibe</p>
        <span class="price-item">$48.00</span>
      </div>
      <div class="grid__item">
        <a href="/products/sticker-pack">
          <img src="//cdn.shopify.com/sticker.jpg" alt="Sticker Pack" />
          <h3>Sticker Pack</h3>
        </a>
        <p>Lifestyle merch</p>
        <span class="price-item">$12.00</span>
      </div>
      <div class="grid__item">
        <a href="/products/best-sellers">
          <img src="//cdn.shopify.com/bundle.jpg" alt="Best Sellers" />
          <h3>Best Sellers</h3>
        </a>
        <p>Bundle set with Puff and Bender</p>
        <span class="price-item price-item--sale">$102.00</span>
        <span class="price-item price-item--regular">$138.00</span>
      </div>
    </div>
  `);

  assert.equal(result.length, 2);
  assert.deepEqual(result[0], {
    sourceUrl: 'https://unboundbabes.com/products/unbound-puff-suction-vibe',
    name: 'Puff',
    subtitle: 'Compact suction vibe',
    coverImage: 'https://cdn.shopify.com/puff.jpg',
    priceUsd: 48,
    originalPriceUsd: null,
    priceCurrency: 'USD',
    categoryHints: [],
    genderHint: 'female',
    listPosition: 1,
  });
  assert.deepEqual(result[1], {
    sourceUrl: 'https://unboundbabes.com/products/best-sellers',
    name: 'Best Sellers',
    subtitle: 'Bundle set with Puff and Bender',
    coverImage: 'https://cdn.shopify.com/bundle.jpg',
    priceUsd: 102,
    originalPriceUsd: 138,
    priceCurrency: 'USD',
    categoryHints: [],
    genderHint: 'female',
    listPosition: 3,
  });
});

test('extractListItemsFromShopifyJson preserves order and product metadata', () => {
  const result = extractListItemsFromShopifyJson({
    products: [
      {
        title: 'Dex',
        handle: 'dex',
        product_type: 'Vibrator',
        body_html: '<p>Compact wand with deep rumbly vibrations.</p>',
        tags: ['External', 'Waterproof'],
        variants: [{ price: '40.00', compare_at_price: null }],
        images: [{ src: '//cdn.shopify.com/dex.jpg' }],
      },
      {
        title: 'Gift Card',
        handle: 'gift-card',
        product_type: 'Gift Card',
        body_html: '<p>Digital gift card.</p>',
        variants: [{ price: '50.00', compare_at_price: null }],
        images: [{ src: '//cdn.shopify.com/gift-card.jpg' }],
      },
      {
        title: 'Best Sellers',
        handle: 'best-sellers',
        product_type: 'Sets',
        body_html: '<p>Includes Puff and Bender.</p>',
        tags: ['Couples', 'Vibrating'],
        variants: [{ price: '102.00', compare_at_price: '138.00' }],
        images: [{ src: '//cdn.shopify.com/best-sellers.jpg' }],
      },
    ],
  });

  assert.equal(result.length, 2);
  assert.deepEqual(
    result.map((item) => ({ name: item.name, listPosition: item.listPosition })),
    [
      { name: 'Dex', listPosition: 1 },
      { name: 'Best Sellers', listPosition: 3 },
    ],
  );
});

test('isShopifyErrorPage detects storefront error pages', () => {
  assert.equal(isShopifyErrorPage('<html><body>Something went wrong Shopify</body></html>'), true);
  assert.equal(isShopifyErrorPage('<html><body><h1>Puff</h1></body></html>'), false);
});

test('extractRelevantDetailTextFromHtml and extractDetailFromHtml merge main description and drawer text', () => {
  const html = `
    <html>
      <head>
        <title>Puff | Unbound</title>
        <meta name="description" content="Compact suction vibe with 5 intensities." />
      </head>
      <body>
        <main id="MainContent">
          <h1>Puff</h1>
          <div class="product-info__text t-sink t-sink--small">
            <p>Puff is Unbound's best-selling suction vibe.</p>
            <p>5 intensities in a compact body.</p>
          </div>
          <div class="image-with-text__text-item grid__item">
            Body-safe silicone with a soft outer ring.
          </div>
          <img src="//cdn.shopify.com/puff-1.jpg" alt="Puff" />
        </main>
      </body>
    </html>
  `;

  const relevantText = extractRelevantDetailTextFromHtml(html);
  assert.match(relevantText, /best-selling suction vibe/i);
  assert.match(relevantText, /body-safe silicone/i);

  const detail = extractDetailFromHtml(html, [
    'How it works\nCreates rhythmic suction with 5 intensity settings.',
    'Shipping & Returns\nShips discreetly.',
  ]);
  assert.equal(detail.title, 'Puff');
  assert.equal(detail.coverImage, 'https://cdn.shopify.com/puff-1.jpg');
  assert.match(detail.rawDescription, /best-selling suction vibe/i);
  assert.match(detail.rawDescription, /creates rhythmic suction/i);
  assert.match(detail.rawDescription, /ships discreetly/i);
});

test('buildUnboundRawDescription deduplicates repeated blocks', () => {
  assert.equal(
    buildUnboundRawDescription(['Puff', 'Compact suction vibe', 'Compact suction vibe', 'Ships discreetly']),
    'Puff\nCompact suction vibe\nShips discreetly',
  );
});
