# Leitingbaofeng Tmall Scraper Design

## Goal

Generate a new Tmall scraper directory for 雷霆暴风 / LETEN using the existing lazy-loaded waterfall shelf pattern already proven on other `shop/view_shop.htm` storefronts.

## Scope

This work covers:

- a new `src/scraper/leitingbaofeng/` directory
- waterfall shelf list extraction from `product_shelf`
- detail-page click-through from shelf cards to preserve final `sourceUrl`
- parameter extraction, OCR enrichment, and cleaner-based DB sync
- package scripts for scraping and param-chain debugging

## Structure

New directory:

- `src/scraper/leitingbaofeng/crawler.ts`
- `src/scraper/leitingbaofeng/cleaner.ts`
- `src/scraper/leitingbaofeng/debug-param-chain.ts`
- `src/scraper/leitingbaofeng/param-extraction.ts`
- `src/scraper/leitingbaofeng/tmall-param-ui.ts`

Data files:

- `src/data/leitingbaofeng-review-buffer.json`
- `src/data/leitingbaofeng-cleaned-data.json`
- `src/data/leitingbaofeng-list-price-cache.json`

## List Strategy

Target URL:

- `https://leten.tmall.com/shop/view_shop.htm?appUid=RAzN8HWScNUQgh2LxJzFPCm3wEt9AcUhVZFYCfHdSqfya87nYCj&spm=a21n57.1.hoverItem.1`

Primary shelf selectors:

- `.product_shelf`
- `[class*="ProductShelf"]`
- `[class*="product_shelf"]`

Primary card selectors:

- `.product_shelf [class*="cardContainer"]`
- `[class*="ProductShelf"] [class*="cardContainer"]`
- `[class*="product_shelf"] [class*="cardContainer"]`

This shop should be treated as a waterfall / lazy-load shelf first, not a classic `.J_TItems` list.

## Detail Strategy

Keep the existing Tmall pattern:

- click real shelf card/media to obtain the final detail URL
- preserve `listUrl`, `listPageUrl`, and final `sourceUrl`
- collect detail images
- merge compact parameter text, page HTML pairs, OCR text, and in-page extracted params

## Cleaner Strategy

Cleaner should remain aligned with the established Tmall pattern:

- infer canonical name from raw description when available
- map into `products` and `recommender_toys`
- preserve brand as `雷霆暴风`
- rely on local explicit gender signals over generic defaults

## Scripts

Add:

- `npm run scrape:leitingbaofeng`
- `npm run debug:param-chain:leitingbaofeng`

## Risks

- login / bot wall if `TMALL_COOKIE` is stale
- lazy shelf growth requiring repeated scroll
- shelf cards may need click simulation instead of plain `href`
