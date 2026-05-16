# Lovecrave Official Scraper Design

## Goal
Add a new `lovecrave-official` scraper that can reliably collect product data from Lovecrave's independent storefront, filter out non-toy/non-recommendable items, capture all relevant product detail text, and convert USD prices into RMB during cleaning.

## Scope
- Add a new scraper directory: `src/scraper/lovecrave-official/`.
- Add crawler logic for Lovecrave's `all` collection.
- Support the user-provided list-page structure target: `#product-grid`.
- Add a resilient fallback path using Shopify product JSON when the collection HTML is unavailable or returns an error page.
- Extract detail-page text as a broad merged text body instead of highly structured section parsing.
- Filter out non-recommendable products such as gift cards, chargers, and pure jewelry/accessories.
- Convert USD prices to RMB in the cleaner using the existing independent-store cleaner pattern.
- Add tests and package scripts.

## Non-Goals
- No browser-interactive session flow like the special Lovehoney flow.
- No OCR pass for detail images in this first version.
- No database write/import step in this round.
- No attempt to preserve all collection merchandising metadata from the frontend page.

## Constraints and Observations

### Live Site Behavior
- The user-provided collection URL is:
  `https://lovecrave.com/collections/all?filter.v.price.gte=&filter.v.price.lte=&sort_by=best-selling`
- In live probing, direct collection HTML can intermittently return a Shopify generic error page instead of usable product markup.
- `https://lovecrave.com/products.json?limit=...` is available and returns rich Shopify product data.
- `https://lovecrave.com/collections/all/products.json?limit=...` is also available and can serve as a collection fallback source.

### Product Mix
The `all` collection includes both recommendable products and non-recommendable items:
- Keep: toy-like or adjacent recommendable intimacy products such as `Bullet`, `Wink`, `Vesper`, `Tease`.
- Remove: `Gift Card`, `Charger Cable`, and pure jewelry/accessory chain items that are not recommendation targets.

## Approaches Considered

### Approach 1: HTML-only scraper on `#product-grid`
Use the collection HTML as the only list source and parse cards from `#product-grid`.

Pros:
- Matches the user-provided DOM contract directly.
- Keeps the scraper close to visible merchandising order.

Cons:
- Not reliable when Shopify serves an error page.
- More fragile to theme changes.

### Approach 2: Shopify JSON-only scraper
Use collection or site product JSON as the sole source of product list and detail text.

Pros:
- Most reliable.
- Easier parsing.
- Gives direct access to `body_html`, variants, tags, and images.

Cons:
- Does not honor the user's requested DOM entrypoint as the primary path.
- Merchandising order may differ from the visible page in edge cases.

### Approach 3: HTML-first with JSON fallback
Try parsing `#product-grid` from the collection page first. If the page is unavailable, empty, or clearly an error page, fall back to Shopify JSON.

Pros:
- Honors the requested list-page structure.
- Remains resilient when HTML breaks.
- Best fit for this storefront's observed instability.

Cons:
- Slightly more code than a single-source scraper.

## Recommended Approach
Use **Approach 3: HTML-first with JSON fallback**.

This gives the best balance between respecting the requested page structure and avoiding a brittle scraper that fails whenever Shopify serves a generic error page.

## High-Level Design

### Files
- `src/scraper/lovecrave-official/crawler.ts`
- `src/scraper/lovecrave-official/cleaner.ts`
- `src/scraper/lovecrave-official/crawler.test.ts`
- `src/scraper/lovecrave-official/cleaner.test.ts`

### Package Scripts
Add:
- `scrape:lovecrave-official`
- `clean:lovecrave-official`

## Crawler Design

### Source URLs
- Primary list URL:
  `https://lovecrave.com/collections/all?filter.v.price.gte=&filter.v.price.lte=&sort_by=best-selling`
- Fallback JSON URLs:
  - `https://lovecrave.com/collections/all/products.json?limit=250&page=...`
  - If needed, `https://lovecrave.com/products.json?limit=250&page=...`

### Runtime Shape
Follow the same broad pattern as `dame-official` / `master4fancy-official`:
- fetch list items
- fetch detail for each item
- write review buffer JSON
- optionally hand off to cleaner

### List Extraction

#### Primary HTML Path
- Fetch collection HTML.
- Verify the response is not a Shopify generic error page.
- Parse `#product-grid`.
- Extract product cards and normalize:
  - `sourceUrl`
  - `name`
  - `coverImage`
  - `priceUsd`
  - `originalPriceUsd`
  - `priceCurrency = 'USD'`
  - `categoryHints`
  - `genderHint`
  - `listPosition`

#### JSON Fallback Path
If HTML is missing, unusable, or yields zero valid cards:
- Read product rows from Shopify JSON.
- Derive list items from:
  - `title`
  - `handle`
  - `product_type`
  - `tags`
  - first available variant price
  - first product image
- Preserve page order from returned JSON sequence.

### Product Filtering
Apply a keep-filter tuned for option `A`.

#### Remove
- gift cards
- chargers / cables
- pure jewelry chains
- pure accessory-only items with no recommendation value

Concrete signal examples:
- `gift card`
- `charger`
- `cable`
- `chain`
- `jewelry` when not paired with clear toy signals

#### Keep
- bullets
- vibrators
- wearable or necklace-style vibrators
- recommendable bedside/intimacy toys

Concrete signal examples:
- `bullet`
- `vibrator`
- `vibe`
- `vesper`
- `tease`
- `wink`
- product text indicating intimate stimulation or wearable vibrator behavior

### Detail Extraction
Per user instruction, detail parsing should be broad and simple:
- fetch the product page HTML when available
- merge all relevant visible product text into `rawDescription`
- include:
  - product title
  - meta description
  - product description block text
  - accordion / info section text if present
  - variant option labels
  - tags or product type when useful

If the product page is also unstable:
- fall back to Shopify JSON `body_html`
- merge `body_html`, `product_type`, variant titles, and image alts into `rawDescription`

The goal is not structural perfection; it is broad textual coverage.

### Images
- Capture `coverImage`.
- Capture `galleryImages` from product images when available.
- No OCR or image-detail semantic pass in this version.

## Cleaner Design

### Input/Output
- Input: `src/data/lovecrave-official-review-buffer.json`
- Output: `src/data/lovecrave-official-cleaned-data.json`

### Price Conversion
Follow the independent-store cleaner pattern already used in this repo:
- source prices remain in USD fields
- convert into RMB in cleaned specs
- prefer live FX lookup
- fallback to a fixed USD/CNY rate when FX lookup fails

Expected spec fields:
- `price_usd`
- `price_rmb`
- `original_price_usd`
- `original_price_rmb`
- `fx_rate_usd_cny`
- `fx_rate_source`
- `fx_rate_date`

### Classification
Reuse existing cleaner heuristics and library classifiers where possible:
- infer gender
- infer appearance
- infer physical form
- infer motor type
- infer waterproof / max_db when signals exist
- infer `type_code` and `subtype_code`

Because Lovecrave contains hybrid “wearable jewelry vibrator” products, the cleaner should prefer toy classifications when product text clearly signals stimulation / vibrator behavior, even if the storefront product type uses jewelry-like language.

## Testing Strategy

### `crawler.test.ts`
Cover:
- HTML list extraction from `#product-grid`
- fallback to JSON when HTML is an error page or empty
- product filter removes chargers, gift cards, and pure chains
- product filter keeps Lovecrave toy lines like `Bullet`, `Wink`, `Vesper`, `Tease`
- detail text merge includes broad description content

### `cleaner.test.ts`
Cover:
- USD to RMB conversion
- fallback exchange-rate behavior
- toy-vs-accessory classification heuristics for Lovecrave products
- exclusion of filtered-out non-toy items from final cleaned output when relevant

## Risks
- Lovecrave product naming can blur the line between jewelry and wearable vibrator products.
- The storefront HTML may continue to be unstable, so the JSON fallback must be treated as first-class rather than emergency-only.
- Some products may have sparse `body_html`; in those cases the merged detail text may still be thinner than ideal, but it should remain acceptable for this round.

## Acceptance Criteria
- `npm run scrape:lovecrave-official` produces a review buffer file.
- The crawler can still produce results when collection HTML fails, by falling back to Shopify JSON.
- Filtered output excludes gift cards, chargers, and pure jewelry/accessory items.
- Product detail text is captured broadly into `rawDescription`.
- USD prices are converted into RMB in the cleaned output.
- Tests cover both the list-source fallback behavior and the filtering behavior.

## Notes
- Per current user preference, do not auto-commit this design doc or subsequent implementation work.
