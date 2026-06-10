import test from 'node:test';
import assert from 'node:assert/strict';
import {
  crawlCollectionPages,
  extractDetailFromHtml,
  extractDetailFromShopifyProduct,
  extractListItemsFromHtml,
  extractListItemsFromShopifyJson,
} from './crawler.ts';

test('extractListItemsFromHtml parses cards inside .product-grid without extra filtering', () => {
  const result = extractListItemsFromHtml(`
    <ul class="product-grid">
      <li class="grid__item">
        <a href="/products/abyssal-glow-silicone-toy" aria-label="Abyssal Glow Silicone Toy">
          <img src="//cdn.shopify.com/abyssal.jpg" alt="" />
        </a>
        <h3>Abyssal Glow Silicone Toy</h3>
        <p>Phosphorescent toy</p>
        <span class="price">$66.00</span>
      </li>
      <li class="grid__item">
        <a href="/products/forest-muse" aria-label="Forest Muse">
          <img src="//cdn.shopify.com/forest.jpg" alt="" />
        </a>
        <h3>Forest Muse</h3>
        <p>Fantasy toy</p>
        <span class="price">$72.00</span>
      </li>
    </ul>
  `);

  assert.equal(result.length, 2);
  assert.equal(result[0]?.sourceUrl, 'https://kumocoom.cn/products/abyssal-glow-silicone-toy');
  assert.equal(result[1]?.sourceUrl, 'https://kumocoom.cn/products/forest-muse');
});

test('extractListItemsFromShopifyJson preserves USD prices and keeps all products', () => {
  const result = extractListItemsFromShopifyJson({
    products: [
      {
        title: 'Abyssal Glow Silicone Toy',
        handle: 'abyssal-glow-silicone-toy',
        product_type: 'Fantasy toy',
        body_html: '<p>Glow in the dark silicone toy.</p>',
        tags: [],
        variants: [{ price: '66.00', compare_at_price: null }],
        images: [{ src: '//cdn.shopify.com/abyssal.jpg' }],
      },
      {
        title: 'Forest Muse',
        handle: 'forest-muse',
        product_type: 'Fantasy toy',
        body_html: '<p>Elegant forest-inspired fantasy toy.</p>',
        tags: [],
        variants: [{ price: '72.00', compare_at_price: '84.00' }],
        images: [{ src: '//cdn.shopify.com/forest.jpg' }],
      },
    ],
  });

  assert.equal(result.length, 2);
  assert.equal(result[0]?.priceCurrency, 'USD');
  assert.equal(result[1]?.originalPriceSourceAmount, 84);
});

test('extractDetailFromHtml prefers accordion content from grid__item blocks', () => {
  const detail = extractDetailFromHtml(`
    <html>
      <head>
        <title>Abyssal Glow Silicone Toy | KUMOCOOM</title>
        <meta name="description" content="Glow in the dark fantasy toy." />
      </head>
      <body>
        <div class="grid__item">
          <summary>Features</summary>
          <div class="accordion__content">
            <p>Phosphorescent platinum silicone with soft glow.</p>
          </div>
        </div>
        <div class="grid__item">
          <summary>Care</summary>
          <div class="accordion__content">
            <p>Wash with mild soap and water after use.</p>
          </div>
        </div>
        <div class="grid__item">
          <summary>Shipping</summary>
          <div class="accordion__content">
            <p>Free shipping on orders over $99.</p>
          </div>
        </div>
      </body>
    </html>
  `);

  assert.match(detail.rawDescription, /Phosphorescent platinum silicone/i);
  assert.match(detail.rawDescription, /Wash with mild soap and water/i);
  assert.doesNotMatch(detail.rawDescription, /Free shipping on orders over \$99/i);
});

test('extractDetailFromShopifyProduct preserves USD source amounts', () => {
  const detail = extractDetailFromShopifyProduct({
    title: 'Abyssal Glow Silicone Toy',
    handle: 'abyssal-glow-silicone-toy',
    product_type: 'Fantasy toy',
    body_html: '<p>Glow in the dark silicone toy.</p>',
    variants: [{ price: '66.00', compare_at_price: '80.00' }],
    images: [{ src: '//cdn.shopify.com/abyssal.jpg' }],
  });

  assert.equal(detail.priceSourceAmount, 66);
  assert.equal(detail.originalPriceSourceAmount, 80);
  assert.equal(detail.priceCurrency, 'USD');
});

test('crawlCollectionPages falls back to Shopify JSON when HTML is incomplete', async () => {
  const result = await crawlCollectionPages({
    maxItems: 10,
    fetchCollectionHtml: async () => '<html><body><ul class="product-grid"></ul></body></html>',
    fetchCollectionJsonPage: async (page) =>
      page === 1
        ? {
            products: [
              {
                title: 'Abyssal Glow Silicone Toy',
                handle: 'abyssal-glow-silicone-toy',
                product_type: 'Fantasy toy',
                body_html: '<p>Glow in the dark silicone toy.</p>',
                tags: [],
                variants: [{ price: '66.00', compare_at_price: null }],
                images: [{ src: '//cdn.shopify.com/abyssal.jpg' }],
              },
            ],
          }
        : { products: [] },
  });

  assert.equal(result.length, 1);
  assert.equal(result[0]?.name, 'Abyssal Glow Silicone Toy');
  assert.equal(result[0]?.sourceUrl, 'https://kumocoom.cn/products/abyssal-glow-silicone-toy');
});
