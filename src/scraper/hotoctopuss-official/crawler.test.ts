import test from 'node:test';
import assert from 'node:assert/strict';
import {
  crawlCollectionPages,
  extractDetailFromHtml,
  extractDetailFromShopifyProduct,
  extractListItemsFromHtml,
  extractListItemsFromShopifyJson,
  formatCollectionLogLabel,
  mergeDetailSources,
  shouldKeepHotoctopussCandidate,
} from './crawler.ts';

test('formatCollectionLogLabel formats collection prefixes for runtime logging', () => {
  assert.equal(formatCollectionLogLabel('male'), '[male]');
  assert.equal(formatCollectionLogLabel('female'), '[female]');
  assert.equal(formatCollectionLogLabel('couples'), '[couples]');
});

test('shouldKeepHotoctopussCandidate keeps toy rows and rejects obvious non-toy rows', () => {
  assert.equal(
    shouldKeepHotoctopussCandidate({
      name: 'PULSE SOLO ESSENTIAL',
      subtitle: 'Vibrating Penis Masturbator',
      categoryHints: ['H.O. Sex Toys'],
    }),
    true,
  );

  assert.equal(
    shouldKeepHotoctopussCandidate({
      name: 'His & Hers, The Amplified Intimacy Bundle',
      subtitle: 'Bundle',
      categoryHints: ['Bundle'],
      rawDescription: 'Includes one toy for him and one for her.',
    }),
    true,
  );

  assert.equal(
    shouldKeepHotoctopussCandidate({
      name: 'Shipping Protection',
      subtitle: 'Add protection to your order',
    }),
    false,
  );
});

test('shouldKeepHotoctopussCandidate keeps real products even when long detail text mentions warranty or shipping', () => {
  assert.equal(
    shouldKeepHotoctopussCandidate({
      name: 'PULSE SOLO ESSENTIAL',
      subtitle: 'Vibrating Penis Masturbator',
      rawDescription:
        'Award-winning vibrating penis masturbator with PulsePlate Technology. Includes product page furniture such as Secure Payment & 1 Year Warranty and Free shipping on orders over 120.',
      categoryHints: ['H.O. Sex Toys'],
    }),
    true,
  );
});

test('extractListItemsFromHtml parses product cards inside #filter-results', () => {
  const result = extractListItemsFromHtml(`
    <div id="filter-results">
      <ul>
        <li class="js-pagination-result">
          <a href="/collections/male-sex-toys/products/pulse-solo-essential" aria-label="PULSE SOLO ESSENTIAL - Vibrating Penis Masturbator">
            <img src="//cdn.shopify.com/pulse.jpg" alt="" />
          </a>
          <h3>PULSE SOLO ESSENTIAL</h3>
          <p>Vibrating Penis Masturbator</p>
          <span class="price-item">£99.99</span>
        </li>
        <li class="js-pagination-result">
          <a href="/collections/couples-sex-toys/products/his-hers-bundle" aria-label="His & Hers, The Amplified Intimacy Bundle">
            <img src="//cdn.shopify.com/bundle.jpg" alt="" />
          </a>
          <h3>His & Hers, The Amplified Intimacy Bundle</h3>
          <p>Bundle</p>
          <span class="price-item price-item--sale">£206.99</span>
          <span class="price-item price-item--regular">£229.99</span>
        </li>
      </ul>
    </div>
  `, 'male');

  assert.equal(result.length, 2);
  assert.deepEqual(result[0], {
    sourceUrl: 'https://www.hotoctopuss.com/products/pulse-solo-essential',
    name: 'PULSE SOLO ESSENTIAL',
    subtitle: 'Vibrating Penis Masturbator',
    coverImage: 'https://cdn.shopify.com/pulse.jpg',
    priceSourceAmount: 99.99,
    originalPriceSourceAmount: null,
    priceCurrency: 'GBP',
    categoryHints: [],
    genderHint: 'male',
    listPosition: 1,
  });
});

test('extractListItemsFromShopifyJson preserves GBP prices and collection gender', () => {
  const result = extractListItemsFromShopifyJson({
    products: [
      {
        title: 'PULSE QUEEN',
        handle: 'pulse-queen',
        product_type: 'H.O. Sex Toys',
        body_html: '<p>Clitoral stimulator.</p>',
        tags: ['Best Seller'],
        variants: [{ price: '119.95', compare_at_price: null }],
        images: [{ src: '//cdn.shopify.com/queen.jpg' }],
      },
      {
        title: 'Stainless Steel 3 Ring Set',
        handle: 'ring-set',
        product_type: 'BDSM & Bondage',
        body_html: '<p>Cock ring set.</p>',
        variants: [{ price: '9.95', compare_at_price: null }],
        images: [{ src: '//cdn.shopify.com/ring.jpg' }],
      },
    ],
  }, 'female');

  assert.equal(result.length, 2);
  assert.deepEqual(
    result.map((item) => ({ name: item.name, genderHint: item.genderHint, priceCurrency: item.priceCurrency })),
    [
      { name: 'PULSE QUEEN', genderHint: 'female', priceCurrency: 'GBP' },
      { name: 'Stainless Steel 3 Ring Set', genderHint: 'female', priceCurrency: 'GBP' },
    ],
  );
});

test('crawlCollectionPages falls back to Shopify JSON pages when HTML is incomplete', async () => {
  const result = await crawlCollectionPages({
    collectionCode: 'couples',
    maxItems: 10,
    fetchCollectionHtml: async () => '<html><body><div id="filter-results"></div></body></html>',
    fetchCollectionJsonPage: async (page) =>
      page === 1
        ? {
            products: [
              {
                title: 'PULSE DUO',
                handle: 'pulse-duo',
                product_type: 'H.O. Sex Toys',
                body_html: '<p>Couples toy.</p>',
                tags: ['Best Seller'],
                variants: [{ price: '129.00', compare_at_price: null }],
                images: [{ src: '//cdn.shopify.com/duo.jpg' }],
              },
            ],
          }
        : { products: [] },
  });

  assert.equal(result.length, 1);
  assert.equal(result[0]?.name, 'PULSE DUO');
  assert.equal(result[0]?.sourceUrl, 'https://www.hotoctopuss.com/products/pulse-duo');
});

test('mergeDetailSources keeps plausible JSON price when HTML price is clearly corrupted', () => {
  const merged = mergeDetailSources(
    {
      title: 'PULSE SOLO ESSENTIAL',
      subtitle: '',
      metaTitle: 'PULSE SOLO ESSENTIAL',
      metaDescription: 'HTML detail',
      priceSourceAmount: -28709978997063,
      originalPriceSourceAmount: null,
      priceCurrency: 'GBP',
      coverImage: 'https://cdn.shopify.com/html.jpg',
      galleryImages: ['https://cdn.shopify.com/html.jpg'],
      rawDescription: 'html detail',
    },
    {
      title: 'PULSE SOLO ESSENTIAL',
      subtitle: 'H.O. Sex Toys',
      metaTitle: 'PULSE SOLO ESSENTIAL',
      metaDescription: 'JSON detail',
      priceSourceAmount: 99.99,
      originalPriceSourceAmount: null,
      priceCurrency: 'GBP',
      coverImage: 'https://cdn.shopify.com/json.jpg',
      galleryImages: ['https://cdn.shopify.com/json.jpg'],
      rawDescription: 'json detail',
    },
  );

  assert.equal(merged.priceSourceAmount, 99.99);
});

test('extractDetailFromShopifyProduct converts cent-based Shopify JS prices to GBP amounts', () => {
  const detail = extractDetailFromShopifyProduct({
    title: 'PULSE SOLO ESSENTIAL',
    handle: 'pulse-solo-essential',
    product_type: 'H.O. Sex Toys',
    body_html: '<p>Vibrating penis masturbator.</p>',
    variants: [{ price: 9999, compare_at_price: 12995 }],
    images: [{ src: '//cdn.shopify.com/pulse.jpg' }],
  });

  assert.equal(detail.priceSourceAmount, 99.99);
  assert.equal(detail.originalPriceSourceAmount, 129.95);
});

test('extractDetailFromHtml prefers product-details__block tab panels over noisy page-wide text', () => {
  const detail = extractDetailFromHtml(`
    <html>
      <head>
        <title>PULSE SOLO ESSENTIAL | Hot Octopuss</title>
        <meta name="description" content="Award-winning male toy." />
      </head>
      <body>
        <div class="product-details__block product-details__highlight text-center">
          <p class="h4">With over 2 MILLION SOLD</p>
          <div class="rte large-text"><p>Essential is the Toy That Changed Everything for Male Sex Toys</p></div>
        </div>
        <div class="product-details__block">
          <div class="tablist" role="tablist">
            <button type="button" class="tablist__tab font-bold" id="tab-0" aria-controls="panel-0">Description</button>
            <button type="button" class="tablist__tab font-bold" id="tab-1" aria-controls="panel-1">Includes</button>
            <button type="button" class="tablist__tab font-bold" id="tab-2" aria-controls="panel-2">Specifications</button>
          </div>
          <div id="panel-0" role="tabpanel" aria-labelledby="tab-0">
            <div class="rte product-description">
              <p>PULSE SOLO ESSENTIAL - the revolutionary Guybrator.</p>
              <p>Delivers powerful oscillations without the need for stroking.</p>
            </div>
          </div>
          <div id="panel-1" role="tabpanel" aria-labelledby="tab-1" hidden>
            <div class="rte">
              <p>1 x PULSE SOLO ESSENTIAL</p>
              <p>1 x Charging cable</p>
            </div>
          </div>
          <div id="panel-2" role="tabpanel" aria-labelledby="tab-2" hidden>
            <div class="rte">
              <p>Material: Silicone, ABS</p>
              <p>Noise Level: &lt; 55dB</p>
            </div>
          </div>
        </div>
        <section>
          <p>Secure Payment &amp; 1 Year Warranty</p>
          <p>Free shipping on orders over 120</p>
        </section>
        <img src="//cdn.shopify.com/pulse.jpg" alt="" />
      </body>
    </html>
  `);

  assert.equal(detail.title, 'PULSE SOLO ESSENTIAL | Hot Octopuss');
  assert.match(detail.rawDescription, /PULSE SOLO ESSENTIAL - the revolutionary Guybrator/i);
  assert.match(detail.rawDescription, /1 x Charging cable/i);
  assert.match(detail.rawDescription, /Noise Level: < 55dB/i);
  assert.doesNotMatch(detail.rawDescription, /Free shipping on orders over 120/i);
  assert.doesNotMatch(detail.rawDescription, /Secure Payment & 1 Year Warranty/i);
});
