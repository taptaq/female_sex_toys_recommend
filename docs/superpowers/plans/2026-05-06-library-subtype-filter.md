# Library Subtype Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a user-facing library subtype filter backed by a real `subtype_code` field and classifier, while preserving the existing top-level `type_code` filter.

**Architecture:** Extend the current type metadata and classifier stack with subtype-aware helpers that reuse the resolved top-level type. Then thread `subtypeCode` through the server payload, cached product normalization, app state, library UI, and the existing backfill script.

**Tech Stack:** TypeScript, React, Node test runner, Express, PostgreSQL maintenance scripts

---

### Task 1: Lock subtype vocabulary and filter behavior with tests

**Files:**
- Modify: `src/lib/library-product-types.test.ts`
- Modify: `src/lib/library-product-type-classifier.test.ts`
- Modify: `src/lib/app-shell.test.ts`
- Modify: `src/pages/LibraryPage.test.tsx`

- [ ] **Step 1: Write failing tests for subtype metadata and UI behavior**
- [ ] **Step 2: Run tests to verify they fail for missing subtype support**

### Task 2: Implement subtype metadata and classifier support

**Files:**
- Modify: `src/lib/library-product-types.ts`
- Modify: `src/lib/library-product-type-classifier.ts`
- Modify: `src/data/mock.ts`

- [ ] **Step 1: Add subtype types, labels, and sanitizers**
- [ ] **Step 2: Add subtype classification and resolution helpers**
- [ ] **Step 3: Run targeted tests to verify classifier behavior passes**

### Task 3: Thread subtype through app payloads and UI

**Files:**
- Modify: `src/lib/app-shell.ts`
- Modify: `src/server/index.ts`
- Modify: `src/App.tsx`
- Modify: `src/pages/LibraryPage.tsx`

- [ ] **Step 1: Preserve and derive `subtypeCode` in normalized product payloads**
- [ ] **Step 2: Return `subtypeCode` from the server**
- [ ] **Step 3: Add linked subtype filter state and rendering**
- [ ] **Step 4: Run integration-focused tests**

### Task 4: Backfill the database and verify live results

**Files:**
- Modify: `src/db/backfill-item-type-code.ts`
- Modify: `src/db/backfill-item-type-code.test.ts`
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Extend the backfill script to populate `subtype_code`**
- [ ] **Step 2: Run targeted tests and `npm run lint`**
- [ ] **Step 3: Re-run `npm run db:backfill:item-type-code` and spot-check live results**
