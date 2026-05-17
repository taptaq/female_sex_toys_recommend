import test from 'node:test';
import assert from 'node:assert/strict';
import {
  crawlCollectionPages,
  extractDetailFromHtml,
  extractDetailFromShopifyProduct,
  extractListItemsFromHtml,
  extractListItemsFromShopifyJson,
  shouldKeepMagicMotionCandidate,
} from './crawler.ts';

test('shouldKeepMagicMotionCandidate keeps toys and filters charging accessories', () => {
  assert.equal(
    shouldKeepMagicMotionCandidate({
      name: 'Magic Flamingo Luxury Smart App Controlled Vibrator',
      subtitle: 'Smart Vibrator',
      categoryHints: ['App Control'],
    }),
    true,
  );

  assert.equal(
    shouldKeepMagicMotionCandidate({
      name: 'Replacement Charging Cable',
      subtitle: 'Charger',
      categoryHints: ['Accessories'],
    }),
    false,
  );
});

test('extractListItemsFromHtml parses cards inside #product-grid', () => {
  const result = extractListItemsFromHtml(`
    <ul id="product-grid">
      <li class="grid__item">
        <a href="/products/magic-flamingo" aria-label="Magic Flamingo Luxury Smart App Controlled Vibrator">
          <img src="//cdn.shopify.com/flamingo.jpg" alt="" />
        </a>
        <h3>Magic Flamingo Luxury Smart App Controlled Vibrator</h3>
        <p>Smart Vibrator</p>
        <span class="price">$129.99</span>
      </li>
      <li class="grid__item">
        <a href="/products/replacement-charging-cable" aria-label="Replacement Charging Cable">
          <img src="//cdn.shopify.com/cable.jpg" alt="" />
        </a>
        <h3>Replacement Charging Cable</h3>
        <p>Accessories</p>
        <span class="price">$9.99</span>
      </li>
    </ul>
  `);

  assert.equal(result.length, 1);
  assert.deepEqual(result[0], {
    sourceUrl: 'https://us.magicmotion.shop/products/magic-flamingo',
    name: 'Magic Flamingo Luxury Smart App Controlled Vibrator',
    subtitle: 'Smart Vibrator',
    coverImage: 'https://cdn.shopify.com/flamingo.jpg',
    priceSourceAmount: 129.99,
    originalPriceSourceAmount: null,
    priceCurrency: 'USD',
    categoryHints: [],
    genderHint: 'female',
    listPosition: 1,
  });
});

test('extractListItemsFromShopifyJson preserves USD prices and filters charging cables', () => {
  const result = extractListItemsFromShopifyJson({
    products: [
      {
        title: 'Magic Flamingo Luxury Smart App Controlled Vibrator',
        handle: 'magic-flamingo',
        product_type: 'Smart Vibrator',
        body_html: '<p>Smart app controlled vibrator.</p>',
        tags: ['App Control'],
        variants: [{ price: '129.99', compare_at_price: '159.99' }],
        images: [{ src: '//cdn.shopify.com/flamingo.jpg' }],
      },
      {
        title: 'Replacement Charging Cable',
        handle: 'replacement-charging-cable',
        product_type: 'Accessories',
        body_html: '<p>Replacement charging cable.</p>',
        variants: [{ price: '9.99', compare_at_price: null }],
        images: [{ src: '//cdn.shopify.com/cable.jpg' }],
      },
    ],
  });

  assert.equal(result.length, 1);
  assert.equal(result[0]?.priceCurrency, 'USD');
  assert.equal(result[0]?.name, 'Magic Flamingo Luxury Smart App Controlled Vibrator');
});

test('extractDetailFromHtml prefers accordion and section content over page noise', () => {
  const detail = extractDetailFromHtml(`
    <html>
      <head>
        <title>Magic Flamingo | Magic Motion</title>
        <meta name="description" content="Luxury smart app controlled vibrator." />
      </head>
      <body>
        <details class="product__accordion accordion quick-add-hidden">
          <summary>Features</summary>
          <div class="accordion__content rte">
            <p>10 vibration modes with app connectivity.</p>
          </div>
        </details>
        <details class="product__accordion accordion quick-add-hidden">
          <summary>Materials</summary>
          <div class="accordion__content rte">
            <p>Body-safe silicone with ABS handle.</p>
          </div>
        </details>
        <div class="shopify-section section">
          <h2>Why you'll love it</h2>
          <div class="rte">
            <p>Whisper quiet and splashproof for easy everyday use.</p>
          </div>
        </div>
        <details class="product__accordion accordion quick-add-hidden">
          <summary>Shipping</summary>
          <div class="accordion__content rte">
            <p>FREE SHIPPING on orders over $59.</p>
          </div>
        </details>
      </body>
    </html>
  `);

  assert.match(detail.rawDescription, /10 vibration modes with app connectivity/i);
  assert.match(detail.rawDescription, /Body-safe silicone with ABS handle/i);
  assert.match(detail.rawDescription, /Whisper quiet and splashproof/i);
  assert.doesNotMatch(detail.rawDescription, /FREE SHIPPING on orders over \$59/i);
});

test('extractDetailFromShopifyProduct preserves USD source amounts', () => {
  const detail = extractDetailFromShopifyProduct({
    title: 'Magic Flamingo Luxury Smart App Controlled Vibrator',
    handle: 'magic-flamingo',
    product_type: 'Smart Vibrator',
    body_html: '<p>Smart app controlled vibrator.</p>',
    variants: [{ price: '129.99', compare_at_price: '159.99' }],
    images: [{ src: '//cdn.shopify.com/flamingo.jpg' }],
  });

  assert.equal(detail.priceSourceAmount, 129.99);
  assert.equal(detail.originalPriceSourceAmount, 159.99);
  assert.equal(detail.priceCurrency, 'USD');
});

test('crawlCollectionPages falls back to Shopify JSON when HTML is incomplete', async () => {
  const result = await crawlCollectionPages({
    maxItems: 10,
    fetchCollectionHtml: async () => '<html><body><ul id="product-grid"></ul></body></html>',
    fetchCollectionJsonPage: async (page) =>
      page === 1
        ? {
            products: [
              {
                title: 'Eidolon Smart Kegel Trainer',
                handle: 'eidolon-smart-kegel-trainer',
                product_type: 'Kegel Trainer',
                body_html: '<p>Pelvic floor smart trainer.</p>',
                tags: ['Kegel'],
                variants: [{ price: '89.00', compare_at_price: '109.00' }],
                images: [{ src: '//cdn.shopify.com/eidolon.jpg' }],
              },
            ],
          }
        : { products: [] },
  });

  assert.equal(result.length, 1);
  assert.equal(result[0]?.name, 'Eidolon Smart Kegel Trainer');
  assert.equal(result[0]?.sourceUrl, 'https://us.magicmotion.shop/products/eidolon-smart-kegel-trainer');
});
