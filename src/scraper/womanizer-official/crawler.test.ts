import test from 'node:test';
import assert from 'node:assert/strict';
import * as crawler from './crawler.ts';

test('extractListItems parses Womanizer listing cards with sale pricing', () => {
  const html = `
    <ol class="products products--grid">
      <li class="product product-item ">
        <div class="product__inner">
          <div class="product__info product-item-info" data-container="product-grid">
            <a
              href="https://www.womanizer.com/us/peach-toy"
              class="product__photo photo product product-item-photo"
              tabindex="-1"
              data-id="WZPC1SGA"
              data-simple-id="WZPC1SGA"
              data-name="Peach Toy"
              data-price="59"
              data-store="English"
              data-brand=""
              data-use-simple="0"
              data-quantity="1"
              data-dimension10="SOLD OUT"
              data-event="productClick"
              data-category="Sex Toys"
              data-list="Sex Toys"
              data-position="45"
              data-click=""
              data-attributes="[]"
            >
              <div class="photo__container product-image-container">
                <div class="photo__wrapper product-image-wrapper">
                  <img
                    class="photo__image product-image-photo lazyload"
                    src="https://www.womanizer.com/static/version1776934607/frontend/Interactiv4/womanizer/en_US/images/placeholder.png"
                    data-src="https://www.womanizer.com/media/catalog/product/cache/22858c641609ec6b1ca73cd5f575e920/w/m/wmz_peach_pdp_gallery_image_en_01.jpg"
                    width="500"
                    height="500"
                    alt="Peach Toy Raspberry Beginner-Friendly Clitoral Stimulator"
                  >
                </div>
              </div>
            </a>
            <div class="product__details product-item-details">
              <div class="product__name h3">
                <a class="product__link" href="https://www.womanizer.com/us/peach-toy">Womanizer Peach Toy</a>
              </div>
              <div class="product__description">
                <a href="https://www.womanizer.com/us/peach-toy"><span>Beginner-Friendly Clitoral Stimulator<span></span></span></a>
              </div>
              <div class="product__price">
                <a href="https://www.womanizer.com/us/peach-toy">
                  <div class="price-box price-final_price" data-role="priceBox" data-product-id="490" data-price-box="product-id-490">
                    <div class="price-box ">
                      <span class="normal-price special-price">
                        <span class="price-container price-final_price tax weee">
                          <span class="price-label">Special Price</span>
                          <span id="product-price-490" data-price-amount="59" data-price-type="finalPrice" class="price-wrapper ">
                            <span class="price">$59</span>
                          </span>
                        </span>
                      </span>
                      <span class="old-price">
                        <span class="price-container price-final_price tax weee">
                          <span class="price-label">Regular Price</span>
                          <span id="old-price-490" data-price-amount="69" data-price-type="oldPrice" class="price-wrapper ">
                            <span class="price">$69</span>
                          </span>
                        </span>
                      </span>
                    </div>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>
      </li>
    </ol>
  `;

  const result = crawler.extractListItems(html);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0], {
    sourceUrl: 'https://www.womanizer.com/us/peach-toy',
    name: 'Womanizer Peach Toy',
    subtitle: 'Beginner-Friendly Clitoral Stimulator',
    coverImage:
      'https://www.womanizer.com/media/catalog/product/cache/22858c641609ec6b1ca73cd5f575e920/w/m/wmz_peach_pdp_gallery_image_en_01.jpg',
    priceUsd: 59,
    originalPriceUsd: 69,
    genderHint: 'female',
    stock: 'SOLD OUT',
    categoryHints: ['Sex Toys', 'clitoral stimulation'],
    listPosition: 45,
    productId: '490',
    sku: 'WZPC1SGA',
  });
});

test('mergeUniqueListItems deduplicates canonical urls and preserves earliest position', () => {
  const result = crawler.mergeUniqueListItems([
    {
      sourceUrl: 'https://www.womanizer.com/us/next?utm_source=test',
      name: 'Womanizer Next',
      subtitle: '3D Pleasure Air Clitoral Stimulator',
      coverImage: 'https://cdn.example.com/next.jpg',
      priceUsd: 229,
      originalPriceUsd: null,
      genderHint: 'female',
      stock: 'In stock',
      categoryHints: ['Sex Toys', 'clitoral stimulation'],
      listPosition: 5,
      productId: '474',
      sku: 'Next',
    },
    {
      sourceUrl: 'https://www.womanizer.com/us/next',
      name: 'Womanizer Next',
      subtitle: '3D Pleasure Air Clitoral Stimulator',
      coverImage: 'https://cdn.example.com/next-2.jpg',
      priceUsd: 229,
      originalPriceUsd: null,
      genderHint: 'female',
      stock: 'In stock',
      categoryHints: ['Sex Toys', 'clitoral stimulation', '3d pleasure air'],
      listPosition: 1,
      productId: '474',
      sku: 'Next',
    },
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].sourceUrl, 'https://www.womanizer.com/us/next');
  assert.equal(result[0].listPosition, 1);
  assert.deepEqual(result[0].categoryHints, ['Sex Toys', 'clitoral stimulation', '3d pleasure air']);
});

test('buildDetailReferer falls back to list page and strips query parameters', () => {
  assert.equal(crawler.buildDetailReferer(), crawler.LIST_URL);
  assert.equal(
    crawler.buildDetailReferer('https://www.womanizer.com/us/we-vibe-sync-go?utm_source=test'),
    'https://www.womanizer.com/us/we-vibe-sync-go',
  );
});

test('createFetchHtmlRunner prefers shared browser session for detail pages when requested', async () => {
  const calls: Array<{ url: string; referer: string; hasSession: boolean }> = [];
  const session = { id: 'shared-session' } as never;
  const runner = crawler.createFetchHtmlRunner({
    fetchImpl: async () => {
      throw new Error('fetch should not be called');
    },
    curlRunner: () => {
      throw new Error('curl should not be called');
    },
    playwrightFetcher: async (url, options) => {
      calls.push({
        url,
        referer: String(options.referer || ''),
        hasSession: Boolean(options.session),
      });
      return '<html>detail via session</html>';
    },
  });

  const html = await runner('https://www.womanizer.com/us/we-vibe-jive-lite', {
    preferBrowserSession: true,
    session,
    referer: crawler.LIST_URL,
  });

  assert.equal(html, '<html>detail via session</html>');
  assert.deepEqual(calls, [
    {
      url: 'https://www.womanizer.com/us/we-vibe-jive-lite',
      referer: crawler.LIST_URL,
      hasSession: true,
    },
  ]);
});

test('createFetchHtmlRunner falls back to browser fetch after fetch 406 and curl failure', async () => {
  const events: string[] = [];
  const session = { id: 'shared-session' } as never;
  const runner = crawler.createFetchHtmlRunner({
    fetchImpl: async () => {
      events.push('fetch');
      return new Response('blocked', { status: 406 });
    },
    curlRunner: () => {
      events.push('curl');
      throw new Error('curl 406');
    },
    playwrightFetcher: async (_url, options) => {
      events.push(`playwright:${options.session ? 'session' : 'ephemeral'}`);
      return '<html>playwright fallback</html>';
    },
  });

  const html = await runner('https://www.womanizer.com/us/we-vibe-chorus', {
    session,
    referer: crawler.LIST_URL,
  });

  assert.equal(html, '<html>playwright fallback</html>');
  assert.deepEqual(events, ['fetch', 'curl', 'playwright:session']);
});

test('extractProductDetail collects ld+json, swatch config, features, specs, and raw description', () => {
  const html = `
    <meta property="og:description" content="3D Pleasure Air Clitoral Stimulator" />
    <meta property="product:price:amount" content="229" />
    <meta property="product:price:currency" content="USD" />
    <script type="application/ld+json">
      {
        "@context": "https://schema.org/",
        "@type": "Product",
        "name": "Next",
        "image": "https://www.womanizer.com/media/catalog/product/cache/main.jpg",
        "offers": {
          "@type": "Offer",
          "priceCurrency": "USD",
          "price": "229",
          "availability": "https://schema.org/InStock",
          "url": "https://www.womanizer.com/us/next"
        },
        "description": "Womanizer Next delivers deeper, more natural stimulation.",
        "brand": {
          "@type": "Brand",
          "name": "Womanizer"
        },
        "sku": "Next"
      }
    </script>
    <div class="product__info info col-12 col-md-5 product-info-main">
      <div class="info__title">
        <div class="product__brand-title"><span>Womanizer</span></div>
        <div class="page-title-wrapper"><h1 class="page-title"><span class="base">Next</span></h1></div>
      </div>
      <div class="info__type product__attribute short_description">
        <div class="value" data-option="93_279">3D Pleasure Air Clitoral Stimulator</div>
      </div>
      <div class="info__short product__attribute description">
        <div class="value" data-option="93_279" itemprop="description">Womanizer Next delivers deeper, more natural stimulation for multiple orgasms with customizable depth levels and whisper-quiet performance.</div>
      </div>
      <div class="info__price product-info-price">
        <div class="product-info-stock-sku">
          <div class="stock available" title="Availability"><span>In stock</span></div>
          <div class="info__sku d-none product__attribute"><span class="type">SKU</span><div class="value" itemprop="sku">Next</div></div>
        </div>
        <div class="price-box price-final_price" data-role="priceBox" data-product-id="474">
          <span class="price-container price-final_price tax weee" itemprop="offers" itemscope itemtype="http://schema.org/Offer">
            <span id="product-price-474" data-price-amount="229" data-price-type="finalPrice" class="price-wrapper "><span class="price">$229</span></span>
            <meta itemprop="price" content="229"><meta itemprop="priceCurrency" content="USD">
          </span>
        </div>
      </div>
      <div class="trust-elements"><ul><li class="free-shipping">Free Shipping</li><li class="years-warranty">5 Years Warranty</li></ul></div>
    </div>
    <script type="text/x-magento-init">
      {
        "[data-role=swatch-options]": {
          "Magento_Swatches/js/swatch-renderer": {
            "jsonConfig": {
              "attributes": {
                "93": {
                  "id": "93",
                  "code": "color",
                  "label": "Color",
                  "options": [
                    {"id": "279", "label": "Dusky Pink", "products": ["531"]}
                  ]
                }
              },
              "optionPrices": {
                "531": {
                  "baseOldPrice": {"amount": 229},
                  "oldPrice": {"amount": 229},
                  "basePrice": {"amount": 229},
                  "finalPrice": {"amount": 229}
                }
              },
              "prices": {
                "baseOldPrice": {"amount": 229},
                "oldPrice": {"amount": 229},
                "basePrice": {"amount": 229},
                "finalPrice": {"amount": 229}
              },
              "images": {
                "531": [
                  {
                    "thumb": "https://www.womanizer.com/media/catalog/product/cache/thumb.jpg",
                    "img": "https://www.womanizer.com/media/catalog/product/cache/img.jpg",
                    "full": "https://www.womanizer.com/media/catalog/product/cache/full-1.jpg",
                    "caption": "Next 3D Pleasure Air Clitoral Stimulator",
                    "position": "0",
                    "isMain": true,
                    "type": "image",
                    "videoUrl": null
                  },
                  {
                    "thumb": "https://www.womanizer.com/media/catalog/product/cache/thumb-2.jpg",
                    "img": "https://www.womanizer.com/media/catalog/product/cache/img-2.jpg",
                    "full": "https://www.womanizer.com/media/catalog/product/cache/full-2.jpg",
                    "caption": "Next alternate view",
                    "position": "1",
                    "isMain": false,
                    "type": "image",
                    "videoUrl": null
                  }
                ]
              },
              "sku": {
                "531": "WZNE1SG4"
              }
            }
          }
        }
      }
    </script>
    <div class="tabs__content tabs__content-product" id="product.info.features" data-role="content">
      <div class="product-tabs product-tabs--product-features">
        <ul data-option="93_279" class="row product-features__list ">
          <li class="product-features__item">
            <div class="product-features__content">
              <div class="product-features__title">Waterproof IPX7</div>
              <p class="product-features__text">You want to dive deeper? Since your Womanizer is IPX7 waterproof, nothing stands in the way of a long, relaxing bath.</p>
            </div>
          </li>
          <li class="product-features__item">
            <div class="product-features__content">
              <div class="product-features__title">Smart Silence</div>
              <p class="product-features__text">The toy only starts when it meets your skin.</p>
            </div>
          </li>
        </ul>
      </div>
    </div>
    <div class="tabs__content tabs__content-product" id="product.info.box" data-role="content">
      <div class="product-tabs product-tabs--in-the-box">
        <div class="row product-in-the-box__list" data-option="93_279">
          <div class="in-the-box__content col-lg-6">
            <ul>
              <li>Womanizer Next</li>
              <li>USB cable with magnetic charging pins</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
    <div class="tabs__content tabs__content-product" id="product.info.specification" data-role="content">
      <div class="product-tabs product-tabs--specification">
        <div class="product-tabs--specification-list row" data-option="93_279">
          <ul class="specification__list col-lg-6">
            <li class="specification__item"><span class="label">Waterproof</span><span class="data">IPX 7</span></li>
            <li class="specification__item"><span class="label">Run Time</span><span class="data">240 min</span></li>
            <li class="specification__item"><span class="label">Materials</span><span class="data">Body-safe silicone</span></li>
          </ul>
        </div>
      </div>
    </div>
    <div class="tabs__content tabs__content-product" id="product.info.manual" data-role="content">
      <div class="product-tabs product-tabs--manual row">
        <a href="https://oum.womanizer.com/next" target="_blank" class="btn btn-primary desktop"><span>Online Manual</span></a>
      </div>
    </div>
  `;

  const detail = crawler.extractProductDetail(html, 'https://www.womanizer.com/us/next');
  assert.equal(detail.title, 'Next');
  assert.equal(detail.subtitle, '3D Pleasure Air Clitoral Stimulator');
  assert.equal(detail.productCode, 'Next');
  assert.equal(detail.priceUsd, 229);
  assert.equal(detail.priceCurrency, 'USD');
  assert.equal(detail.stock, 'In stock');
  assert.equal(detail.coverImage, 'https://www.womanizer.com/media/catalog/product/cache/full-1.jpg');
  assert.deepEqual(detail.galleryImages, [
    'https://www.womanizer.com/media/catalog/product/cache/full-1.jpg',
    'https://www.womanizer.com/media/catalog/product/cache/full-2.jpg',
  ]);
  assert.deepEqual(detail.variantSkus, ['WZNE1SG4']);
  assert.deepEqual(detail.featureHeadlines, ['Waterproof IPX7', 'Smart Silence']);
  assert.deepEqual(detail.inTheBox, ['Womanizer Next', 'USB cable with magnetic charging pins']);
  assert.deepEqual(detail.specPairs, [
    { key: 'Waterproof', value: 'IPX 7' },
    { key: 'Run Time', value: '240 min' },
    { key: 'Materials', value: 'Body-safe silicone' },
  ]);
  assert.equal(detail.manualUrl, 'https://oum.womanizer.com/next');
  assert.match(detail.rawDescription, /商品名: Next/);
  assert.match(detail.rawDescription, /卖点摘要: Waterproof IPX7 \| Smart Silence/);
  assert.match(detail.rawDescription, /规格: Waterproof: IPX 7/);
});
