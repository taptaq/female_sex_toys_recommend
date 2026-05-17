import test from 'node:test';
import assert from 'node:assert/strict';
import {
  crawlCollectionPages,
  extractDetailFromShopifyProduct,
  extractListItemsFromHtml,
  extractListItemsFromShopifyJson,
  shouldKeepHelloNancyCandidate,
} from './crawler.ts';

test('shouldKeepHelloNancyCandidate keeps products and filters charging cables', () => {
  assert.equal(
    shouldKeepHelloNancyCandidate({
      name: 'Lem Clitoral Massager',
      subtitle: 'Personal Massager',
      categoryHints: ['Personal Massager'],
    }),
    true,
  );

  assert.equal(
    shouldKeepHelloNancyCandidate({
      name: 'Lem Magnetic Charging Cable',
      subtitle: 'Accessories',
      categoryHints: ['Accessories'],
    }),
    false,
  );

  assert.equal(
    shouldKeepHelloNancyCandidate({
      name: 'Berri USB-C to USB-A charging cable',
      subtitle: 'Accessories',
    }),
    false,
  );
});

test('extractListItemsFromHtml parses cards inside .product-list', () => {
  const result = extractListItemsFromHtml(`
    <div class="product-list">
      <div class="product-card">
        <a href="/zh-hans/products/lem" aria-label="Lem Clitoral Massager">
          <img src="//cdn.shopify.com/lem.jpg" alt="" />
        </a>
        <h3>Lem Clitoral Massager</h3>
        <p>Personal Massager</p>
        <span class="price">¥89.00</span>
      </div>
      <div class="product-card">
        <a href="/zh-hans/products/lem-magnetic-charging-cable" aria-label="Lem Magnetic Charging Cable">
          <img src="//cdn.shopify.com/cable.jpg" alt="" />
        </a>
        <h3>Lem Magnetic Charging Cable</h3>
        <p>Accessories</p>
        <span class="price">¥9.99</span>
      </div>
    </div>
  `);

  assert.equal(result.length, 1);
  assert.deepEqual(result[0], {
    sourceUrl: 'https://hellonancy.com/products/lem',
    name: 'Lem Clitoral Massager',
    subtitle: 'Personal Massager',
    coverImage: 'https://cdn.shopify.com/lem.jpg',
    priceSourceAmount: 89,
    originalPriceSourceAmount: null,
    priceCurrency: 'CNY',
    categoryHints: [],
    genderHint: 'unisex',
    listPosition: 1,
  });
});

test('extractListItemsFromShopifyJson preserves CNY prices and filters charging cables', () => {
  const result = extractListItemsFromShopifyJson({
    products: [
      {
        title: 'Lem Clitoral Massager',
        handle: 'lem',
        product_type: 'Personal Massager',
        body_html: '<p>Air suction bliss.</p>',
        tags: ['Quiet and discreet (Shhh!)'],
        variants: [{ price: '89.00', compare_at_price: '159.00' }],
        images: [{ src: '//cdn.shopify.com/lem.jpg' }],
      },
      {
        title: 'Uno Charging Cable',
        handle: 'uno-charger',
        product_type: 'Accessories',
        body_html: '<p>Charging cable for Just Uno</p>',
        variants: [{ price: '9.99', compare_at_price: null }],
        images: [{ src: '//cdn.shopify.com/cable.jpg' }],
      },
    ],
  });

  assert.equal(result.length, 1);
  assert.deepEqual(
    result.map((item) => ({ name: item.name, priceCurrency: item.priceCurrency })),
    [{ name: 'Lem Clitoral Massager', priceCurrency: 'CNY' }],
  );
});

test('crawlCollectionPages falls back to Shopify JSON when HTML is incomplete', async () => {
  const result = await crawlCollectionPages({
    maxItems: 10,
    fetchCollectionHtml: async () => '<html><body><div class="product-list"></div></body></html>',
    fetchCollectionJsonPage: async (page) =>
      page === 1
        ? {
            products: [
              {
                title: 'Berri Tapping Clitoral Massager',
                handle: 'berri',
                product_type: 'Personal Massager',
                body_html: '<p>Tapping clitoral massager.</p>',
                tags: ['Rechargeable Battery'],
                variants: [{ price: '95.00', compare_at_price: '189.00' }],
                images: [{ src: '//cdn.shopify.com/berri.jpg' }],
              },
            ],
          }
        : { products: [] },
  });

  assert.equal(result.length, 1);
  assert.equal(result[0]?.name, 'Berri Tapping Clitoral Massager');
  assert.equal(result[0]?.sourceUrl, 'https://hellonancy.com/products/berri');
});

test('extractDetailFromShopifyProduct keeps CNY prices as product source amounts', () => {
  const detail = extractDetailFromShopifyProduct({
    title: 'Lem Clitoral Massager',
    handle: 'lem',
    product_type: 'Personal Massager',
    body_html: '<p>Air suction bliss.</p>',
    variants: [{ price: '89.00', compare_at_price: '159.00' }],
    images: [{ src: '//cdn.shopify.com/lem.jpg' }],
  });

  assert.equal(detail.priceSourceAmount, 89);
  assert.equal(detail.originalPriceSourceAmount, 159);
  assert.equal(detail.priceCurrency, 'CNY');
});
