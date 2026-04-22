# Lovehoney Official Scraper Design

## Goal

Add a full `lovehoney-official` scraper pipeline for the Lovehoney UK independent site, starting from these three gender-scoped list pages:

- `https://www.lovehoney.co.uk/sex-toys/sex-toys-for-women/`
- `https://www.lovehoney.co.uk/sex-toys/male-sex-toys/`
- `https://www.lovehoney.co.uk/sex-toys/sex-toys-for-couples/`

The pipeline should:

- crawl the three list pages in order
- assign gender directly from the source list:
  - women → `female`
  - male → `male`
  - couples → `unisex`
- collect list and detail product data into a review buffer
- clean and normalize the data into the repo's standard product shape
- convert site prices into CNY during cleaning
- translate `rawDescription` content into Chinese
- avoid duplicate database inserts when a product with the same name already exists

## Confirmed Site Behavior

Initial browser simulation against all three category URLs currently returns a blocking page instead of product cards.

Observed behavior:

- page title becomes `Blocked request`
- body text says the site is experiencing technical difficulties
- no product links or pagination links are exposed in that blocked response

This means the scraper design must account for anti-bot protection as a first-class concern rather than assuming plain page access will work reliably.

## Chosen Approach

Recommended implementation: `category-first crawler with anti-bot fallback`

Why this approach:

- it matches the user's requested source of truth: three separate gender entry pages
- it keeps gender assignment deterministic and simple
- it allows us to reuse the existing official-site crawler and cleaner pattern
- it leaves room for progressively stronger browser-driven fallback if the first attempt is blocked

Alternatives that were considered but not chosen:

- pure HTTP scraping first: simpler when accessible, but currently more likely to fail against site protection
- manual product seed list first: faster to prototype, but does not satisfy the requested category-driven crawl

## Scope

The feature will be fully integrated and include:

- `src/scraper/lovehoney-official/crawler.ts`
- `src/scraper/lovehoney-official/cleaner.ts`
- `package.json` script entry for running the scraper
- review buffer output under `src/data/`
- cleaned output under `src/data/`

Brand naming:

- internal brand slug: `lovehoney-official`
- display brand: `Lovehoney`

## Architecture

### 1. Crawler

The crawler will own site access, anti-bot handling, list parsing, and detail enrichment.

Responsibilities:

- define the three category entry pages with fixed `genderHint` values
- open each category page and detect whether the site returned a blocked page or a real product listing
- attempt progressively stronger access strategies when blocked
- parse product cards from each successful category page
- deduplicate list items by canonical detail URL across all three sources
- visit each detail page and extract richer structured content
- write merged results to `src/data/lovehoney-official-review-buffer.json`
- invoke the cleaner at the end

Expected list-level fields:

- `sourceUrl`
- `name`
- `coverImage`
- `price`
- `priceCurrency`
- `categoryHints`
- `listPosition`
- `genderHint`

Expected detail-level enrichment:

- title and subtitle-like marketing text when available
- meta title and meta description
- body description / feature text
- spec pairs
- image gallery URLs
- SKU or product code if discoverable
- raw text segments suitable for translation and cleaning

### 2. Cleaner

The cleaner will own normalization, translation, currency conversion, duplicate protection, and database writes.

Responsibilities:

- read the review buffer
- normalize strings, images, prices, and metadata
- translate `rawDescription` into Chinese
- convert source prices into CNY
- map data into the repo's `products` and `recommender_toys` shapes
- skip inserts when a same-name product already exists
- emit `src/data/lovehoney-official-cleaned-data.json`
- write non-duplicate records into the database

## Category and Gender Mapping

Gender mapping is controlled by list source, not inferred from text.

Mappings:

- `sex-toys-for-women` → `female`
- `male-sex-toys` → `male`
- `sex-toys-for-couples` → `unisex`

If a product appears in more than one category:

- the crawler should deduplicate by canonical URL
- the first seen record wins unless a later record adds clearly better missing metadata

## Anti-Bot Strategy

The crawler should not assume that one access pattern will always work.

Planned sequence:

1. open category page with the standard Playwright context used by other official-site scrapers
2. check for blocked-page markers such as:
   - title `Blocked request`
   - blocking body text
3. if blocked:
   - retry with a more conservative wait pattern
   - preserve realistic browser headers and locale
   - avoid unnecessary resource patterns that might trigger protection
4. if still blocked:
   - inspect whether pagination or product data can be discovered from embedded HTML, scripts, or API calls
5. if all access strategies fail:
   - log the blocked category clearly and continue without crashing the full pipeline

The goal is resilient crawling, not perfect bypass guarantees on the first attempt.

## Data Flow

1. Start from the women category page
2. Crawl list pages and mark all list items as `female`
3. Crawl the male category page and mark all list items as `male`
4. Crawl the couples category page and mark all list items as `unisex`
5. Deduplicate all discovered items by canonical detail URL
6. Visit each detail page and extract richer data
7. Merge list and detail data into review-buffer entries
8. Run cleaner
9. Translate `rawDescription` to Chinese
10. Convert source prices to CNY
11. Skip same-name duplicates during DB insertion
12. Write cleaned JSON and insert remaining records

## Pagination Strategy

Primary strategy:

- use the real pagination model exposed by Lovehoney category pages when accessible

Fallback strategy:

- if pagination controls are hidden or blocked, inspect whether page numbers, next links, or embedded state can be extracted from the DOM or scripts

The implementation should prefer deterministic page-by-page crawling over infinite scroll assumptions unless the site proves otherwise.

## Price Handling

Lovehoney UK category pages are expected to expose local storefront prices, likely in GBP.

Planned behavior:

- parse the source price and preserve the detected currency in raw review data
- convert the source price into CNY during cleaning
- use a live FX rate when available
- fall back to a fixed conversion path when live FX lookup fails
- store the converted CNY value in cleaned output used for insertion

If the source currency is not GBP for a specific product page, the cleaner should still preserve the original currency value and convert based on the parsed source currency when possible.

## Translation

`rawDescription` must be fully converted to Chinese.

Planned behavior:

- reuse the existing shared raw-description translation helper
- cache translations to reduce repeated model cost
- keep the translated result in `rawDescription`
- preserve enough raw context in review-buffer fields for debugging

## Duplicate Handling

Duplicate protection will be name-based at database insertion time.

Behavior:

- if a normalized product name is empty, the record is invalid and should be skipped
- if a product with the same normalized name already exists, do not insert a duplicate row
- crawler-side URL deduplication still applies so the buffer itself remains clean

This matches the user's explicit requirement pattern already used for other official-site scrapers.

## Error Handling

Crawler safeguards:

- tolerate category-level blocking without crashing the process
- tolerate single-product detail failures and continue
- log blocked categories, malformed URLs, and failed detail URLs clearly
- skip items with empty names or unusable detail URLs

Cleaner safeguards:

- retry transient database failures
- continue processing if translation calls fail, using a fallback path instead of crashing the full cleaned output
- tolerate missing price, missing cover image, or partial specs

## Verification Plan

Before claiming completion:

- run the new scraper entrypoint against a small item limit
- confirm review-buffer output is produced when at least one category is accessible
- confirm cleaned JSON is produced even if database insertion is unavailable
- confirm same-name duplicate logic is preserved
- run `npx tsc --noEmit`

## Out of Scope

This change does not include:

- frontend presentation changes
- retroactive cleanup of previously inserted Lovehoney data
- support for non-UK Lovehoney regional storefronts

## Implementation Notes

- prefer the existing `lovense-official`, `nomitang-official`, and `satisfyer-official` patterns
- keep Lovehoney-specific selectors and anti-bot handling local to `lovehoney-official`
- keep crawler and cleaner independently runnable and debuggable
