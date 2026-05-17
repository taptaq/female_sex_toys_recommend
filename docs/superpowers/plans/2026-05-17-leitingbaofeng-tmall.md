# Leitingbaofeng Tmall Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a new `leitingbaofeng` Tmall scraper from the existing waterfall-shelf Tmall template and wire it into package scripts.

**Architecture:** Reuse the `xiaoguaishou` Tmall shelf-flow structure as the starting point, then replace store URL, environment variable names, data paths, logging labels, and brand metadata while preserving the proven `product_shelf -> detail click -> param extraction -> cleaner` chain.

**Tech Stack:** TypeScript, Playwright, Tmall storefront DOM, OpenAI/GLM fallback chain, Prisma/pg

---

### Task 1: Scaffold the new scraper directory
- [ ] Copy the existing waterfall-shelf Tmall template directory
- [ ] Rename paths and brand-specific constants
- [ ] Add package scripts

### Task 2: Replace brand/store-specific crawler values
- [ ] Update target store URL
- [ ] Update environment variable names and output file paths
- [ ] Update crawler log labels and OCR-injected brand fallback

### Task 3: Replace cleaner brand metadata
- [ ] Update competitor lookup/create logic
- [ ] Update cleaner prompt brand references
- [ ] Update recommender brand writeback

### Task 4: Replace debug entrypoint defaults
- [ ] Update debug script help text
- [ ] Update default shop URL

### Task 5: Verify compile and references
- [ ] Run targeted grep checks for stale `xiaoguaishou` / `小怪兽`
- [ ] Run `npx tsc --noEmit` if needed for the new directory only
