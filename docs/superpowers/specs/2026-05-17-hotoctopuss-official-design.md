# Hotoctopuss Official Scraper Design

## Goal

Create a dedicated `hotoctopuss-official` scraper that visits the Hot Octopuss male, female, and couples collection pages in sequence, collects product data into a shared review buffer, then cleans and syncs those products into `products` and `recommender_toys`.

## Scope

This work covers:

- one shared official-site scraper directory
- ordered collection crawling for male, female, and couples
- collection list extraction from `#filter-results`
- pagination handling via `.pagination` when present
- stable fallback to Shopify `products.json`
- product detail hydration
- cleaner with price conversion to RMB
- scripts and tests

This work does not cover:

- interactive login/session handling
- browser profile persistence
- scraper-specific UI work

## Architecture

Use one directory, `src/scraper/hotoctopuss-official/`, with a single crawler that knows about three collections:

- `male-sex-toys`
- `female-sex-toys`
- `couples-sex-toys`

The crawler should:

1. load the collection page
2. read product cards inside `#filter-results`
3. follow pagination when `.pagination` exists
4. merge and deduplicate list candidates by product URL
5. fetch product detail data from product HTML, with Shopify JSON fallback
6. append all rows into one shared `hotoctopuss-official-review-buffer.json`

The cleaner should:

1. read the shared review buffer
2. normalize names, descriptions, material, tags, and type/subtype codes
3. convert source price to RMB
4. write `hotoctopuss-official-cleaned-data.json`
5. sync rows into `products` and `recommender_toys`

## Collections

Use these collection roots:

- `https://www.hotoctopuss.com/collections/male-sex-toys`
- `https://www.hotoctopuss.com/collections/female-sex-toys`
- `https://www.hotoctopuss.com/collections/couples-sex-toys`

Assign `genderHint` by collection:

- male collection -> `male`
- female collection -> `female`
- couples collection -> `unisex`

## Extraction Strategy

### List pages

Primary source:

- parse product cards inside `#filter-results`

Expected signals:

- product links under `/products/...`
- image URLs from card media
- titles from card text / `aria-label`
- displayed price when available

Fallback source:

- Shopify collection JSON endpoint:
  `/collections/<handle>/products.json?limit=250&page=N`

This fallback is preferred for completeness and stable pagination even when the collection DOM changes.

### Detail pages

Primary source:

- product HTML page

Fallback source:

- `/products/<handle>.js`

Use both to build:

- canonical title
- meta title / description
- price / compare-at price
- gallery images
- raw description

## Price Handling

Hotoctopuss collection JSON currently exposes prices in `GBP`.

Cleaner requirements:

- preserve source currency as `GBP`
- convert `GBP -> CNY`
- persist both source amount and RMB amount

Use a GBP fallback rate and runtime refresh pattern similar to existing official-site cleaners, not a one-off hard-coded multiplication in the crawler.

## Output Files

- `src/data/hotoctopuss-official-review-buffer.json`
- `src/data/hotoctopuss-official-cleaned-data.json`
- optional translation cache:
  `src/data/hotoctopuss-official-raw-description-zh-cache.json`

## Tests

Add tests for:

- list parsing from `#filter-results`
- pagination discovery / collection JSON fallback
- gender hint assignment by collection
- cleaner price conversion from GBP to RMB
- classifier integration for male, female, and couples products

## Risks

### Card text may contain long marketing titles

Mitigation:

- prefer Shopify JSON title when deduplicating the same product URL

### Collection DOM may change

Mitigation:

- keep `products.json` fallback in the crawler

### Price currency may vary by market

Mitigation:

- store `price_source_currency`
- convert to RMB in cleaner based on the actual source currency
