import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildJeJoueRawDescription,
  extractDetailFromHtml,
  extractListItemsFromHtml,
  extractListItemsFromShopifyJson,
  extractRelevantDetailTextFromHtml,
  isShopifyErrorPage,
  shouldKeepJeJoueCandidate,
} from './crawler.ts';

test('shouldKeepJeJoueCandidate keeps sexual wellness products and rejects obvious non-product rows', () => {
  assert.equal(
    shouldKeepJeJoueCandidate({
      name: 'Mimi Soft Clitoral Vibrator - Award Winning',
      subtitle: 'Deep rumbly clitoral vibrations',
      categoryHints: ['Vibrator'],
    }),
    true,
  );

  assert.equal(
    shouldKeepJeJoueCandidate({
      name: 'Je Joue Luxury Massage Candle - Ylang Ylang & Mandarin',
      subtitle: 'Sensual massage candle',
      rawDescription: 'Warm massage oil candle for intimate touch.',
    }),
    true,
  );

  assert.equal(
    shouldKeepJeJoueCandidate({
      name: 'Gift Card',
      subtitle: 'Digital gift card',
    }),
    false,
  );
});

test('extractListItemsFromHtml parses product-list cards', () => {
  const result = extractListItemsFromHtml(`
    <product-list>
      <product-card class="product-card" handle="mimi-soft-clitoral-vibrator">
        <div class="product-card__figure">
          <a href="/products/mimi-soft-clitoral-vibrator" class="product-card__media">
            <img src="//cdn.shopify.com/mimi.jpg" alt="Mimi Soft Clitoral Vibrator - Award Winning" />
          </a>
        </div>
        <div class="product-card__info">
          <div class="v-stack justify-items-center gap-2">
            <div class="v-stack justify-items-center gap-1">
              <a href="/products/mimi-soft-clitoral-vibrator" class="product-title h6">Mimi Soft Clitoral Vibrator - Award Winning</a>
              <price-list class="price-list">
                <sale-price class="h6 text-on-sale">$89.10</sale-price>
                <compare-at-price class="h6 text-subdued line-through">$99.00</compare-at-price>
              </price-list>
            </div>
          </div>
        </div>
      </product-card>
      <product-card class="product-card" handle="gift-card">
        <a href="/products/gift-card" class="product-card__media">
          <img src="//cdn.shopify.com/gift-card.jpg" alt="Gift Card" />
        </a>
        <div class="product-card__info">
          <a href="/products/gift-card" class="product-title h6">Gift Card</a>
          <price-list class="price-list">
            <sale-price class="h6 text-subdued">$50.00</sale-price>
          </price-list>
        </div>
      </product-card>
    </product-list>
  `);

  assert.equal(result.length, 1);
  assert.deepEqual(result[0], {
    sourceUrl: 'https://www.jejoue.com/products/mimi-soft-clitoral-vibrator',
    name: 'Mimi Soft Clitoral Vibrator - Award Winning',
    subtitle: '',
    coverImage: 'https://cdn.shopify.com/mimi.jpg',
    priceUsd: 89.1,
    originalPriceUsd: 99,
    priceCurrency: 'USD',
    categoryHints: [],
    genderHint: 'female',
    listPosition: 1,
  });
});

test('extractListItemsFromShopifyJson preserves order and wellness products', () => {
  const result = extractListItemsFromShopifyJson({
    products: [
      {
        title: 'Hera Flex Rabbit Vibrator with Dual Stimulation',
        handle: 'hera-flex-rabbit-vibrator',
        body_html: '<p>Flexible rabbit vibrator for G-spot and clitoral pleasure.</p>',
        tags: ['Recharge-icon', 'Quiet-icon'],
        variants: [{ price: '116.10', compare_at_price: '129.00' }],
        images: [{ src: '//cdn.shopify.com/hera.jpg' }],
      },
      {
        title: 'Gift Card',
        handle: 'gift-card',
        body_html: '<p>Digital gift card.</p>',
        variants: [{ price: '50.00', compare_at_price: null }],
        images: [{ src: '//cdn.shopify.com/gift-card.jpg' }],
      },
      {
        title: 'Je Joue Luxury Massage Candle - Jasmine & Lily',
        handle: 'je-joue-luxury-massage-candle-jasmine-lily',
        body_html: '<p>Massage candle for sensual body-safe touch.</p>',
        tags: ['sensual', 'massage candle'],
        variants: [{ price: '22.50', compare_at_price: '25.00' }],
        images: [{ src: '//cdn.shopify.com/candle.jpg' }],
      },
    ],
  });

  assert.equal(result.length, 2);
  assert.deepEqual(
    result.map((item) => ({ name: item.name, listPosition: item.listPosition })),
    [
      { name: 'Hera Flex Rabbit Vibrator with Dual Stimulation', listPosition: 1 },
      { name: 'Je Joue Luxury Massage Candle - Jasmine & Lily', listPosition: 3 },
    ],
  );
});

test('isShopifyErrorPage detects storefront error pages', () => {
  assert.equal(isShopifyErrorPage('<html><body>Something went wrong Shopify</body></html>'), true);
  assert.equal(isShopifyErrorPage('<html><body><h1>Mimi Soft</h1></body></html>'), false);
});

test('extractRelevantDetailTextFromHtml and extractDetailFromHtml merge prose and feature stack text', () => {
  const html = `
    <html>
      <head>
        <title>Mimi Soft Clitoral Vibrator with Ultra Deep Vibrations - Award Winning</title>
        <meta name="description" content="Perfect clitoral vibrator with a deep rumbly motor." />
      </head>
      <body>
        <section id="shopify-section-template--main">
          <div class="product-info__block-list">
            <div class="product-info__block-item" data-block-type="description">
              <div class="prose">
                <p>Embark on a journey of unparalleled pleasure with the best-selling Mimi Soft.</p>
                <p>Deep, rumbly vibrations transfer deep into the body.</p>
              </div>
            </div>
          </div>
          <img src="//cdn.shopify.com/mimi-soft.jpg" alt="Mimi Soft Clitoral Vibrator - Award Winning" />
        </section>
        <section class="shopify-section--text-with-icons">
          <div class="v-stack gap-8">
            <div class="text-with-icons__item"><p class="h6">5 Speeds & 7 Patterns</p></div>
            <div class="text-with-icons__item"><p class="h6">USB Rechargeable</p></div>
            <div class="text-with-icons__item"><p class="h6">100% Waterproof</p></div>
          </div>
        </section>
      </body>
    </html>
  `;

  const relevantText = extractRelevantDetailTextFromHtml(html);
  assert.match(relevantText, /best-selling mimi soft/i);
  assert.match(relevantText, /usb rechargeable/i);

  const detail = extractDetailFromHtml(html);
  assert.equal(detail.coverImage, 'https://cdn.shopify.com/mimi-soft.jpg');
  assert.match(detail.rawDescription, /deep, rumbly vibrations/i);
  assert.match(detail.rawDescription, /100% waterproof/i);
});

test('buildJeJoueRawDescription deduplicates repeated blocks', () => {
  assert.equal(
    buildJeJoueRawDescription(['Mimi Soft', 'USB Rechargeable', 'USB Rechargeable', '100% Waterproof']),
    'Mimi Soft\nUSB Rechargeable\n100% Waterproof',
  );
});
