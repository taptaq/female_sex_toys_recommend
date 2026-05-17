# Hotoctopuss Official Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `hotoctopuss-official` scraper and cleaner that crawl male, female, and couples collections in sequence and convert source prices to RMB during cleaning.

**Architecture:** Build one shared Shopify-style crawler with three configured collection URLs and one cleaner that normalizes Hot Octopuss data into the existing `products` and `recommender_toys` flow. Use collection HTML parsing from `#filter-results` plus `products.json` fallback for stable pagination and list completeness.

**Tech Stack:** TypeScript, Playwright, Shopify collection/product JSON, Prisma/pg, Node test runner via `tsx --test`

---

### Task 1: Scaffold Scripts and Tests

**Files:**
- Modify: `package.json`
- Create: `src/scraper/hotoctopuss-official/crawler.ts`
- Create: `src/scraper/hotoctopuss-official/cleaner.ts`
- Create: `src/scraper/hotoctopuss-official/crawler.test.ts`
- Create: `src/scraper/hotoctopuss-official/cleaner.test.ts`

- [ ] Write failing crawler and cleaner tests first
- [ ] Run those tests and verify red
- [ ] Add package scripts for scrape and clean

### Task 2: Implement Collection Crawler

**Files:**
- Modify: `src/scraper/hotoctopuss-official/crawler.ts`
- Test: `src/scraper/hotoctopuss-official/crawler.test.ts`

- [ ] Implement male/female/couples collection config
- [ ] Implement `#filter-results` card extraction
- [ ] Implement `.pagination` discovery and Shopify `products.json` fallback
- [ ] Merge duplicate rows by URL and prefer Shopify JSON titles
- [ ] Verify crawler tests pass

### Task 3: Implement Detail Hydration

**Files:**
- Modify: `src/scraper/hotoctopuss-official/crawler.ts`
- Test: `src/scraper/hotoctopuss-official/crawler.test.ts`

- [ ] Add product HTML detail extraction
- [ ] Add `/products/<handle>.js` fallback
- [ ] Write review-buffer output to `src/data/hotoctopuss-official-review-buffer.json`
- [ ] Verify tests remain green

### Task 4: Implement Cleaner with GBP to RMB

**Files:**
- Modify: `src/scraper/hotoctopuss-official/cleaner.ts`
- Test: `src/scraper/hotoctopuss-official/cleaner.test.ts`

- [ ] Add GBP source-currency support and RMB conversion
- [ ] Normalize material, gender, tags, type/subtype codes
- [ ] Write cleaned output to `src/data/hotoctopuss-official-cleaned-data.json`
- [ ] Keep product and recommender sync aligned with existing official-site cleaners
- [ ] Verify cleaner tests pass

### Task 5: Run Verification

**Files:**
- Modify: none
- Test: `src/scraper/hotoctopuss-official/crawler.test.ts`, `src/scraper/hotoctopuss-official/cleaner.test.ts`

- [ ] Run `npx tsx --test src/scraper/hotoctopuss-official/crawler.test.ts`
- [ ] Run `npx tsx --test src/scraper/hotoctopuss-official/cleaner.test.ts`
- [ ] If site access is stable, run `npm run scrape:hotoctopuss-official`
- [ ] If cleaner succeeds, run `npm run clean:hotoctopuss-official`
