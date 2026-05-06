# Recommender Toys Single-Table Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the entire project back to `recommender_toys` as the only canonical recommender table, merge `recommender_items` data into it with destination-first conflict rules, and remove runtime dependence on `recommender_items`.

**Architecture:** First flip repository-level invariants and schema/bootstrap helpers so the runtime only recognizes `recommender_toys`. Then add a dedicated merge script that copies `recommender_items` data into `recommender_toys` without overwriting existing non-empty toy values. Finally, switch every maintenance script and scraper write path to `recommender_toys` and verify the server starts against the single-table shape.

**Tech Stack:** TypeScript, Prisma schema mirror, Express, PostgreSQL, `node:test`, `tsx`

---

### File Map

**Create:**
- `src/db/merge-recommender-items-into-toys.ts` — one-shot merge script from `recommender_items` to `recommender_toys`
- `src/db/merge-recommender-items-into-toys.test.ts` — focused tests for destination-first merge semantics

**Modify:**
- `prisma/schema.prisma` — make `recommender_toys` the canonical Prisma model, keep current field set
- `src/server/index.ts` — read from `public.recommender_toys`
- `src/server/recommender-items-schema.ts` — retarget bootstrap helper to `recommender_toys`
- `src/server/recommender-items-schema.test.ts` — assert helper creates/upgrades `recommender_toys`
- `src/lib/repository-neutralization.test.ts` — flip repo naming invariant from `recommender_items` to `recommender_toys`
- `src/db/backfill-safe-display-name.ts` — update to `recommender_toys`
- `src/db/backfill-item-max-db.ts` — update to `recommender_toys`
- `src/db/backfill-reclean-item-names.ts` — remove dual-table runtime fallback and target `recommender_toys`
- `src/db/syncMock.ts` — read from `recommender_toys`
- `src/db/migrateToRecommender.ts` — build/populate `recommender_toys`
- `package.json` — add merge script command if needed
- `src/scraper/*/cleaner.ts` and `src/scraper/lovense-official/translate-raw-description.ts` — swap `prisma.recommender_items` to `prisma.recommender_toys`

### Task 1: Flip Repository Naming Invariants To recommender_toys

**Files:**
- Modify: `src/lib/repository-neutralization.test.ts`
- Test: `src/lib/repository-neutralization.test.ts`

- [ ] **Step 1: Write the failing test updates**

Change the canonical assertions so they require `recommender_toys` in schema/runtime/script sources and reject `recommender_items` as the primary table name. Keep the existing `/api/recommender/toys` route assertions.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/lib/repository-neutralization.test.ts`
Expected: FAIL because the repo still encodes `recommender_items` as canonical.

- [ ] **Step 3: Commit**

```bash
git add src/lib/repository-neutralization.test.ts
git commit -m "test: require recommender_toys as canonical table"
```

### Task 2: Switch Prisma And Bootstrap Helper To recommender_toys

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/server/recommender-items-schema.ts`
- Modify: `src/server/recommender-items-schema.test.ts`
- Modify: `src/server/index.ts`
- Test: `src/server/recommender-items-schema.test.ts`
- Test: `src/lib/repository-neutralization.test.ts`

- [ ] **Step 1: Write the failing helper test**

Update `src/server/recommender-items-schema.test.ts` so it expects:

- first query contains `CREATE TABLE IF NOT EXISTS public.recommender_toys`
- second query contains `ALTER TABLE public.recommender_toys`
- helper keeps `safe_display_name`

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/server/recommender-items-schema.test.ts`
Expected: FAIL because the helper still creates/alters `recommender_items`.

- [ ] **Step 3: Write minimal implementation**

Change the helper and server usage to point at `recommender_toys`. Update `prisma/schema.prisma` so the canonical model is `recommender_toys` and it preserves the modern field set, including `safe_display_name`, `brand`, `material`, `raw_description`, and `type_code` if that field already exists in schema work.

- [ ] **Step 4: Run focused tests to verify they pass**

Run: `node --import tsx --test src/server/recommender-items-schema.test.ts src/lib/repository-neutralization.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma src/server/recommender-items-schema.ts src/server/recommender-items-schema.test.ts src/server/index.ts src/lib/repository-neutralization.test.ts
git commit -m "refactor: make recommender_toys the canonical runtime table"
```

### Task 3: Add Merge-Script Tests For Destination-First Conflict Policy

**Files:**
- Create: `src/db/merge-recommender-items-into-toys.test.ts`
- Test: `src/db/merge-recommender-items-into-toys.test.ts`

- [ ] **Step 1: Write the failing tests**

Add focused pure-function tests for:

- matching by `original_id`
- fallback matching by `name + brand`
- keeping non-empty `recommender_toys` values
- filling blank `recommender_toys` values from `recommender_items`
- inserting unmatched `recommender_items` rows

Model the merge as pure rows first so the policy can be verified without a real database.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/db/merge-recommender-items-into-toys.test.ts`
Expected: FAIL because the merge helper/module does not exist yet.

- [ ] **Step 3: Commit**

```bash
git add src/db/merge-recommender-items-into-toys.test.ts
git commit -m "test: cover recommender table merge policy"
```

### Task 4: Implement Merge Helper And One-Shot Consolidation Script

**Files:**
- Create: `src/db/merge-recommender-items-into-toys.ts`
- Test: `src/db/merge-recommender-items-into-toys.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write minimal implementation**

Implement:

- a pure merge helper that applies the approved field-priority rules
- a script that:
  - ensures `recommender_toys` schema is up to date
  - reads both tables when they exist
  - merges `recommender_items` into `recommender_toys`
  - prints counts for matched-by-id, matched-by-name-brand, inserted, and backfilled fields

Keep destructive cleanup out of this script.

- [ ] **Step 2: Run test to verify it passes**

Run: `node --import tsx --test src/db/merge-recommender-items-into-toys.test.ts`
Expected: PASS

- [ ] **Step 3: Add runnable package script and re-run tests**

Run: `node --import tsx --test src/db/merge-recommender-items-into-toys.test.ts src/server/recommender-items-schema.test.ts src/lib/repository-neutralization.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/db/merge-recommender-items-into-toys.ts src/db/merge-recommender-items-into-toys.test.ts package.json
git commit -m "feat: add recommender table consolidation script"
```

### Task 5: Move Maintenance Scripts To recommender_toys

**Files:**
- Modify: `src/db/backfill-safe-display-name.ts`
- Modify: `src/db/backfill-item-max-db.ts`
- Modify: `src/db/backfill-reclean-item-names.ts`
- Modify: `src/db/syncMock.ts`
- Modify: `src/db/migrateToRecommender.ts`
- Test: `src/lib/repository-neutralization.test.ts`

- [ ] **Step 1: Write the failing assertion updates**

Extend `src/lib/repository-neutralization.test.ts` so maintenance scripts now require `public.recommender_toys` and no longer encode `public.recommender_items` as canonical update targets.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/lib/repository-neutralization.test.ts`
Expected: FAIL because the maintenance scripts still point at `recommender_items`.

- [ ] **Step 3: Write minimal implementation**

Retarget all listed scripts to `recommender_toys`. In `backfill-reclean-item-names.ts`, remove the runtime dual-table selector so normal maintenance only uses `recommender_toys`; leave the cross-table logic inside the dedicated merge script instead.

- [ ] **Step 4: Run focused tests**

Run: `node --import tsx --test src/lib/repository-neutralization.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/db/backfill-safe-display-name.ts src/db/backfill-item-max-db.ts src/db/backfill-reclean-item-names.ts src/db/syncMock.ts src/db/migrateToRecommender.ts src/lib/repository-neutralization.test.ts
git commit -m "refactor: move recommender maintenance scripts to toys table"
```

### Task 6: Move Scraper Write Paths To Prisma recommender_toys

**Files:**
- Modify: `src/scraper/darentang/cleaner.ts`
- Modify: `src/scraper/iroha/cleaner.ts`
- Modify: `src/scraper/kistoy/cleaner.ts`
- Modify: `src/scraper/lelo/cleaner.ts`
- Modify: `src/scraper/lovehoney-official/cleaner.ts`
- Modify: `src/scraper/lovense-official/cleaner.ts`
- Modify: `src/scraper/lovense-official/translate-raw-description.ts`
- Modify: `src/scraper/nomitang-official/cleaner.ts`
- Modify: `src/scraper/romp/cleaner.ts`
- Modify: `src/scraper/satisfyer-official/cleaner.ts`
- Modify: `src/scraper/svakom-official/cleaner.ts`
- Modify: `src/scraper/tenga/cleaner.ts`
- Modify: `src/scraper/wangyichunfeng/cleaner.ts`
- Modify: `src/scraper/wevibe/cleaner.ts`
- Modify: `src/scraper/wevibe-official/cleaner.ts`
- Modify: `src/scraper/womanizer-official/cleaner.ts`
- Modify: `src/scraper/xiaoguaishou/cleaner.ts`
- Modify: `src/scraper/zalo-official/cleaner.ts`
- Modify: `src/scraper/zuiqingfeng/cleaner.ts`
- Test: `src/lib/repository-neutralization.test.ts`

- [ ] **Step 1: Add the failing repository-level assertion**

Update the repo constraint test so scraper sources must no longer contain `prisma.recommender_items`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/lib/repository-neutralization.test.ts`
Expected: FAIL because scraper cleaners still call `prisma.recommender_items`.

- [ ] **Step 3: Write minimal implementation**

Replace the Prisma accessors with `prisma.recommender_toys` consistently across the listed files, keeping the existing delete/recreate behavior otherwise unchanged.

- [ ] **Step 4: Run focused tests**

Run: `node --import tsx --test src/lib/repository-neutralization.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/scraper/darentang/cleaner.ts src/scraper/iroha/cleaner.ts src/scraper/kistoy/cleaner.ts src/scraper/lelo/cleaner.ts src/scraper/lovehoney-official/cleaner.ts src/scraper/lovense-official/cleaner.ts src/scraper/lovense-official/translate-raw-description.ts src/scraper/nomitang-official/cleaner.ts src/scraper/romp/cleaner.ts src/scraper/satisfyer-official/cleaner.ts src/scraper/svakom-official/cleaner.ts src/scraper/tenga/cleaner.ts src/scraper/wangyichunfeng/cleaner.ts src/scraper/wevibe/cleaner.ts src/scraper/wevibe-official/cleaner.ts src/scraper/womanizer-official/cleaner.ts src/scraper/xiaoguaishou/cleaner.ts src/scraper/zalo-official/cleaner.ts src/scraper/zuiqingfeng/cleaner.ts src/lib/repository-neutralization.test.ts
git commit -m "refactor: point scraper cleaners at recommender_toys"
```

### Task 7: Run Final Focused Verification

**Files:**
- Verify only

- [ ] **Step 1: Run targeted tests**

Run: `node --import tsx --test src/server/recommender-items-schema.test.ts src/db/merge-recommender-items-into-toys.test.ts src/lib/repository-neutralization.test.ts`
Expected: PASS

- [ ] **Step 2: Run server startup verification**

Run: `npm run server`
Expected: the server starts without crashing because it expects `recommender_items`

- [ ] **Step 3: Stop the verification server process cleanly**

If a temporary process was started for verification, stop it before reporting completion.

- [ ] **Step 4: Commit**

```bash
git status --short
```

Expected: only the planned single-table consolidation changes remain staged/committed, with no accidental unrelated rewrites.
