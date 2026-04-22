# Satisfyer Official Scraper Design

## Goal

Add a full `satisfyer-official` scraper pipeline for the Satisfyer US independent site, starting from:

- `https://us.satisfyer.com/us/products?p=1`

The pipeline should:

- crawl the waterfall-style product listing
- collect product list and detail data into a review buffer
- clean and normalize the data into the repo's standard product shape
- convert USD prices into CNY during cleaning
- translate `rawDescription` content into Chinese
- avoid duplicate database inserts when a product with the same name already exists

## Confirmed Site Behavior

Browser simulation confirmed:

- the real list container is `.listing[data-infinite-scrolling="true"]`
- the page uses `p` as the page parameter
- scrolling can advance the URL from `p=1` to `p=2`
- the listing advertises `data-pages="26"`
- the site also exposes a `Load more articles` loading pattern

This means the scraper should not rely on a single interaction model. It should support deterministic page-based crawling first and use browser-driven loading as a fallback when needed.

## Chosen Approach

Recommended implementation: `page-first with browser fallback`

Why this approach:

- it is more stable than pure infinite-scroll automation
- it matches the existing `*-official` scraper patterns in this repo
- it still preserves resilience if some items only appear after scroll or load-more interactions

Alternatives that were considered but not chosen:

- pure browser waterfall crawl: closer to the UX, but slower and easier to break
- pure HTTP page crawl: simpler, but risky if some listing or detail content depends on client rendering

## Scope

The feature will be fully integrated and include:

- `src/scraper/satisfyer-official/crawler.ts`
- `src/scraper/satisfyer-official/cleaner.ts`
- `package.json` script entry for running the scraper
- review buffer output under `src/data/`
- cleaned output under `src/data/`

Brand naming:

- internal brand slug: `satisfyer-official`
- display brand: `Satisfyer`

## Architecture

### 1. Crawler

The crawler will own site access and raw extraction.

Responsibilities:

- open the products listing and discover total pages
- iterate `https://us.satisfyer.com/us/products?p=N`
- parse product cards from the listing
- deduplicate list items by canonical detail URL
- visit each detail page and extract richer structured content
- write the merged results to `src/data/satisfyer-official-review-buffer.json`
- invoke the cleaner at the end

Expected list-level fields:

- `sourceUrl`
- `name`
- `coverImage`
- `priceUsd`
- `originalPriceUsd` if available
- `categoryHints`
- `listPosition`

Expected detail-level enrichment:

- title and subtitle-like marketing text when available
- meta title and meta description
- body description / feature text
- spec pairs
- image gallery URLs
- any product code / SKU-like identifier that is discoverable
- raw text segments useful for downstream translation and cleaning

### 2. Cleaner

The cleaner will own normalization, translation, currency conversion, and database writes.

Responsibilities:

- read the review buffer
- normalize strings, images, and product metadata
- translate `rawDescription` into Chinese
- convert USD prices into CNY
- map data into the repo's `products` and `recommender_toys` shapes
- skip duplicate inserts when an existing product with the same name is already present
- emit `src/data/satisfyer-official-cleaned-data.json`
- write non-duplicate records into the database

## Data Flow

1. Start from `/us/products?p=1`
2. Detect page count from listing metadata when available
3. Crawl list pages by `p`
4. For each list page, collect product cards
5. For each unique product URL, fetch detail data
6. Merge list and detail data into review-buffer entries
7. Run cleaner
8. Translate `rawDescription` to Chinese
9. Convert USD prices to CNY
10. Skip same-name duplicates during DB insertion
11. Write cleaned JSON and insert remaining records

## Pagination and Loading Strategy

Primary strategy:

- page-by-page iteration using `p`

Fallback strategy:

- if the current page yields too few cards or inconsistent card counts, use Playwright to:
  - scroll the listing container
  - wait for appended product cards
  - click `Load more articles` when visible

The crawler should prefer deterministic page navigation first and only pay the browser-interaction cost when needed.

## Duplicate Handling

Duplicate protection will be name-based at database insertion time.

Behavior:

- if a normalized product name is empty, the record is invalid and should be skipped
- if a product with the same normalized name already exists, do not insert a second record
- crawler-side URL deduplication still applies so the buffer itself remains clean

This matches the user's requirement that same-name products should not be inserted.

## Price Conversion

Source site prices are in USD. The cleaner will convert them into CNY.

Planned behavior:

- use a live USD/CNY exchange rate when available
- fall back to a fixed rate if the live rate request fails
- store the converted CNY value in the cleaned output used for insertion
- preserve the original USD value in raw data when helpful for traceability

## Translation

`rawDescription` must be fully converted to Chinese.

Planned behavior:

- reuse the existing shared translation pattern already used by other official-site cleaners
- cache translations to avoid repeated model cost for unchanged content
- keep the translated result in `rawDescription`
- preserve enough source context elsewhere in raw review data for debugging if needed

## Error Handling

Crawler safeguards:

- tolerate single-product detail failures and continue
- log failed URLs clearly
- skip malformed URLs or empty names
- deduplicate aggressively before visiting details

Cleaner safeguards:

- retry transient database failures
- continue processing if individual translation calls fail, using sensible fallback text
- tolerate missing price, missing cover image, or partial specs

## Verification Plan

Before claiming completion:

- run the new scraper entrypoint against a small item limit
- confirm `review-buffer.json` is produced with real Satisfyer products
- confirm cleaned JSON is produced
- confirm same-name duplicates are skipped
- run `npx tsc --noEmit`

## Out of Scope

This change does not include:

- frontend presentation changes
- retroactive cleanup of previously inserted Satisfyer data
- support for non-US Satisfyer regional storefronts

## Implementation Notes

- prefer the existing `lovense-official`, `wevibe-official`, and `nomitang-official` patterns
- keep selectors and parsing logic local to `satisfyer-official`
- keep the crawler and cleaner independently runnable and debuggable
