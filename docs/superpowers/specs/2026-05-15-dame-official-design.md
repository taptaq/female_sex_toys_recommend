# Dame Official Scraper Design

## Goal

Add a full `dame-official` scraper pipeline for the Dame US independent site, starting from:

- `https://dame.com/collections/shop-all?sort_by=best-selling`

The pipeline should:

- crawl the live storefront through Playwright-driven page interaction
- collect list and detail product data into a review buffer
- keep device-like sex toys as the primary product class
- also keep eligible care consumables that should be part of the library, specifically lubricant and wipes
- also keep eligible intimate-use apparel sold as part of the storefront assortment
- automatically filter out non-target merchandise such as STI kits, gift cards, and ordinary non-intimate accessories
- clean and normalize the data into the repo's standard product shape
- convert USD prices into CNY during cleaning
- preserve original USD price data for traceability
- write cleaned records into the existing database tables

## Confirmed Site Behavior

Live inspection on May 15, 2026 confirmed:

- `dame.com` is a Shopify storefront
- the `shop-all` page includes a mixed catalog rather than toy-only inventory
- the catalog currently contains:
  - device-like sex toys such as suction vibrators, palm vibrators, wearable vibrators, G-spot vibrators, and mini wand vibrators
  - care consumables such as lubricant and wipes
  - apparel-style intimate merchandise
  - non-target products such as STI kits and lifestyle merchandise
- detail pages expose visible DOM sections including:
  - `How to Use`
  - `Specifications`
  - `Manual`
  - `FAQs`
- detail pages also embed product config objects that can serve as fallback context, but the requested implementation should still treat visible page extraction as primary

This means the scraper should be designed around:

- Playwright-first DOM extraction
- two-stage product filtering
- detail-page enrichment from visible sections

## Chosen Approach

Chosen implementation: `pure Playwright DOM crawler with detail-page filtering and cleaner normalization`

Why this approach:

- it matches the requested direction to avoid leaning on Shopify `.json` or `.js` endpoints as the primary data source
- it keeps the scraper honest to what a real user-visible page exposes
- it fits the repo's official-site scraper pattern, where the crawler captures raw storefront context and the cleaner normalizes it
- it lets us make filtering decisions using richer visible signals than a shallow list feed alone

Alternatives considered but not chosen:

- Shopify JSON-first crawling: lighter and faster, but not the requested implementation style
- embedded-script parsing first: workable as fallback material, but less aligned with the user's preference than DOM-first extraction

## Scope

The feature will be fully integrated and include:

- `src/scraper/dame-official/crawler.ts`
- `src/scraper/dame-official/cleaner.ts`
- parser-focused tests for core filtering and price conversion behavior
- `package.json` script entry for running the scraper
- review buffer output under `src/data/`
- cleaned output under `src/data/`

Brand naming:

- internal brand slug: `dame-official`
- display brand: `Dame`

## Product Inclusion Rules

The Dame storefront mixes several product families, so inclusion rules must be explicit.

### Keep

The scraper should keep products that clearly belong to any of these three groups:

1. Device-like intimate products

- suction vibrators
- palm vibrators
- wearable vibrators
- external vibrators
- wand vibrators
- insertable or G-spot vibrators
- couples toys
- other clearly toy-like vibrating or stimulation devices

2. Eligible care consumables

- lubricant
- lube
- personal wipes
- intimate wipes

These care consumables should remain eligible because they fit the repo's broader `care_accessory` / intimate-use product universe and the user explicitly asked to include them.

3. Eligible intimate apparel

- lingerie
- panties or underwear sold as intimate-use apparel
- other apparel-like products that clearly belong to the sexual-wellness storefront assortment rather than generic merch

These apparel products should remain eligible because the user explicitly asked to include apparel from this storefront rather than filtering it out.

### Exclude

The scraper should automatically exclude products that fall into these groups unless later requirements change:

- STI testing kits
- condoms, if they appear on this storefront later and are not currently requested as part of this integration
- gift cards
- ordinary lifestyle merchandise
- generic accessories that are not intimate-use consumables or actual devices
- educational content pages, collections, blog posts, or support pages

## Architecture

### 1. Crawler

The crawler owns browser automation, visible DOM extraction, candidate filtering, detail enrichment, deduplication, and review-buffer creation.

Responsibilities:

- open the `shop-all` listing page with Playwright
- wait for the product grid to render
- collect visible product cards in best-selling order
- continue revealing products using the real storefront interaction pattern, such as pagination, load-more behavior, or controlled scrolling
- extract list-level fields from the visible DOM
- apply a first-pass list filter to remove obvious non-target items
- visit each surviving detail page
- extract richer content from visible DOM sections
- apply a second-pass detail filter using the full page context
- merge list and detail fields into raw buffer entries
- write `src/data/dame-official-review-buffer.json`
- invoke the cleaner at the end

Expected list-level fields:

- `sourceUrl`
- `name`
- `subtitle`
- `coverImage`
- `priceUsd`
- `originalPriceUsd`
- `priceCurrency`
- `categoryHints`
- `genderHint`
- `listPosition`

Expected detail-level enrichment:

- title and subtitle-like marketing text
- meta title and meta description when available from the DOM or metadata
- current displayed price and original displayed price
- `How to Use` content
- `Specifications` content
- `Manual` links
- FAQ text
- gallery image URLs
- product code or SKU when visible
- raw text segments useful for translation and downstream classification

### 2. Cleaner

The cleaner owns normalization, translation, currency conversion, classification, duplicate protection, and database writes.

Responsibilities:

- read the review buffer
- normalize strings, URLs, image arrays, and metadata
- translate `rawDescription` into Chinese using the shared translation flow used by existing official-site cleaners
- convert USD prices into CNY
- map data into the repo's standard `products` and `recommender_items` shapes
- infer type, material, function tags, and other standard product metadata
- skip invalid or duplicate records
- emit `src/data/dame-official-cleaned-data.json`
- write valid non-duplicate records into the database

## Data Flow

1. Start from `https://dame.com/collections/shop-all?sort_by=best-selling`
2. Load visible product cards in storefront order
3. Continue loading additional cards until no new canonical product URLs appear or configured limits are reached
4. Extract list-level fields
5. Remove obvious non-target products using a first-pass filter
6. Visit each surviving detail page
7. Extract visible product sections and richer raw text
8. Re-evaluate inclusion using full detail context
9. Merge list and detail data into review-buffer entries
10. Run cleaner
11. Translate `rawDescription` into Chinese
12. Convert USD prices to CNY
13. Normalize standard metadata and persist valid rows

## Listing Strategy

Primary strategy:

- parse the visible card DOM directly from the live storefront
- detect the least fragile way the storefront reveals more products
- prefer deterministic controls such as pagination or load-more when present
- fall back to controlled scrolling only when necessary

Planned stop condition:

- stop when no new canonical product URLs are discovered
- also stop when configured item or page limits are reached

This keeps the crawler aligned with the user's requested Playwright-first approach while still controlling crawl cost.

## Parsing Strategy

List pages:

- use visible card DOM for product name, detail URL, image, short descriptive text, and displayed prices
- normalize URLs against `https://dame.com`
- capture enough card context to support first-pass inclusion filtering

Detail pages:

- use visible DOM as the primary source for title, marketing copy, specs, FAQ, manual links, gallery, and price
- gather accordion-style content such as `How to Use`, `Specifications`, and `Manual`
- keep embedded product config only as fallback context when visible nodes are missing

Fallback order:

1. visible product DOM
2. metadata and embedded config visible in page source
3. list-page fallback values already captured

## Filtering Strategy

Filtering should happen twice, because list cards alone are not reliable enough on a mixed catalog page.

### First-pass list filter

Use `name`, `subtitle`, card badges, and visible collection hints to remove obvious non-target items early.

Strong keep indicators:

- `vibrator`
- `wand`
- `wearable`
- `suction`
- `g-spot`
- `toy`
- `couples`
- `clitoral`
- `lube`
- `lubricant`
- `wipe`
- `wipes`
- `lingerie`
- `panty`
- `underwear`
- `brief`

Strong exclude indicators:

- `sti`
- `test kit`
- `kit`
- `gift card`
- `hat`
- `sticker`
- `mug`

### Second-pass detail filter

Use full-page context from:

- title
- subtitle
- `How to Use`
- `Specifications`
- FAQ text
- manual section
- raw description
- visible breadcrumb or category hints

Decision model:

- keep if the page clearly describes a device-like intimate product
- keep if the page clearly describes lubricant or intimate wipes
- keep if the page clearly describes intimate-use apparel that belongs in the library
- exclude if the page clearly resolves to testing, general merch, or non-intimate accessory content
- when signals conflict, prefer exclusion unless intimate-use intent is explicit

## Price Conversion

Source prices are expected to be in USD on the Dame storefront.

Planned behavior:

- crawler stores raw values as `priceUsd` and `originalPriceUsd`
- crawler also preserves `priceCurrency = 'USD'` when that is the visible source currency
- cleaner refreshes a live USD/CNY exchange rate when possible
- cleaner falls back to a fixed USD/CNY rate if the live request fails
- final persisted `price` uses the RMB value
- cleaned specs preserve:
  - `price_usd`
  - `price_rmb`
  - `original_price_usd`
  - `original_price_rmb`
  - `fx_rate_usd_cny`
  - `fx_rate_source`
  - `fx_rate_date`

This keeps the result compatible with the rest of the app, which already expects RMB-facing product prices while still preserving source-price traceability.

## Classification and Normalization

The cleaner should infer and normalize the same core fields used by other official-site modules, including:

- `gender`
- `function_tags`
- `material`
- `appearance`
- `physical_form`
- `motor_type`
- `waterproof`
- `max_db`
- `type_code`
- `subtype_code` when the evidence is strong enough

Special handling for this storefront:

- device-like products should map into the existing toy taxonomy
- lubricant and wipes should map into the care-accessory family instead of being dropped
- apparel products should map into the existing `care_accessory` / `lingerie` family instead of being filtered out as merch
- product-type inference should use explicit text first, then practical heuristics from title, subtitle, tags, and raw description

## Error Handling

Crawler safeguards:

- continue when a single detail page fails
- log failed URLs with enough context for later debugging
- skip malformed URLs or cards without meaningful names
- tolerate missing image, subtitle, or price on individual products
- tolerate partially expanded accordions by using best-effort extraction instead of failing the whole record

Cleaner safeguards:

- retry transient database failures
- continue processing if an individual translation call fails, using the best available text
- allow partial specs when some fields cannot be confidently inferred
- keep care consumables and eligible apparel as valid products rather than dropping them for not looking like devices

## Testing and Verification

Before claiming completion:

- add parser-oriented tests where they provide stable value
- at minimum, cover:
  - inclusion and exclusion filtering
  - RMB conversion from USD values
  - URL normalization or deduplication behavior where practical
- run the new scraper with a small item cap and confirm that:
  - `dame-official-review-buffer.json` is produced
  - `dame-official-cleaned-data.json` is produced
  - retained records include device-like products, eligible care consumables, and eligible apparel
  - excluded records include obvious non-target merchandise
- run `npx tsc --noEmit`

## Out of Scope

This change does not include:

- using Shopify collection JSON as the primary list source
- scraping every non-toy lifestyle product on the site
- bulk historical backfill for old Dame data outside the new scraper pipeline
- frontend changes for displaying newly imported Dame products

## Open Decisions Resolved

The following decisions are now fixed for implementation:

- implementation style: pure Playwright DOM-first crawling
- currency behavior: preserve USD source values and convert to RMB during cleaning
- inclusion scope: device-like intimate products plus lubricant, wipes, and eligible intimate apparel
- exclusion scope: STI kits, gift cards, ordinary merch, and other non-target products
