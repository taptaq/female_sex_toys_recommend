# Library Type Classification Precision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve `recommender_toys.type_code` accuracy by replacing female type precedence rules with score-based classification and contaminant guards, without adding new type codes.

**Architecture:** Keep the current type-code vocabulary and API contract intact. Refactor only the classifier internals so each candidate type accumulates weighted evidence from normalized fields, while obvious accessories or machine-like rows fall back to `unknown`.

**Tech Stack:** TypeScript, Node test runner, existing backfill script, PostgreSQL-backed maintenance script

---

### Task 1: Lock in failing classification cases

**Files:**
- Modify: `src/lib/library-product-type-classifier.test.ts`
- Test: `src/lib/library-product-type-classifier.test.ts`

- [ ] **Step 1: Write failing tests for overlapping female signals and contaminants**

Add tests that cover:

- an external wand-like product that mentions `G-spot` but should stay `external_vibe`
- a machine-like product that mentions multiple zones but should be `unknown`
- an accessory/adaptor remote-wearable contaminant that should be `unknown`

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/lib/library-product-type-classifier.test.ts`
Expected: FAIL on the newly added cases because the current classifier still uses precedence-heavy logic.

### Task 2: Refactor the classifier

**Files:**
- Modify: `src/lib/library-product-type-classifier.ts`
- Test: `src/lib/library-product-type-classifier.test.ts`

- [ ] **Step 1: Implement weighted signal scoring for female categories**

Refactor the female branch so `suction`, `external_vibe`, `insertable`, and `dual_stimulation` each receive weighted evidence from:

- `physicalForm`
- `name`
- `rawDescription`
- `tags`

- [ ] **Step 2: Add contaminant guards**

Return `unknown` early for clearly non-handheld taxonomy contaminants such as:

- adapters
- accessories
- camera-like items
- machine platforms

- [ ] **Step 3: Run classifier tests to verify the new logic passes**

Run: `node --import tsx --test src/lib/library-product-type-classifier.test.ts`
Expected: PASS

### Task 3: Verify backfill integration

**Files:**
- Test: `src/db/backfill-item-type-code.test.ts`
- Run: `src/db/backfill-item-type-code.ts`

- [ ] **Step 1: Run targeted type/backfill tests**

Run: `node --import tsx --test src/lib/library-product-type-classifier.test.ts src/db/backfill-item-type-code.test.ts src/lib/app-shell.test.ts src/pages/LibraryPage.test.tsx`
Expected: PASS

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 3: Re-run the full type-code backfill**

Run: `npm run db:backfill:item-type-code`
Expected: script completes, reports updated distribution counts, and writes fresh `type_code` values to `recommender_toys`.
