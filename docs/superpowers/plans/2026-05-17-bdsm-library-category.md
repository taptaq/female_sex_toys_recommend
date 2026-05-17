# BDSM Library Category Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-class `bdsm` category plus BDSM subtypes to the shared library taxonomy, then backfill `recommender_toys` so existing BDSM items are reclassified consistently.

**Architecture:** Extend the shared taxonomy definitions in `src/lib/library-product-types.ts`, teach the shared classifier in `src/lib/library-product-type-classifier.ts` how to recognize BDSM signals and subtypes, then reuse the existing database backfill flow in `src/db/backfill-item-type-code.ts` so the cleanup happens centrally instead of per scraper.

**Tech Stack:** TypeScript, Node test runner via `tsx --test`, PostgreSQL via `pg`, Prisma-adjacent shared DB scripts

---

### Task 1: Extend Shared Type Definitions

**Files:**
- Modify: `src/lib/library-product-types.ts`
- Test: `src/lib/library-product-type-classifier.test.ts`

- [ ] **Step 1: Write the failing taxonomy test expectations**

Add assertions to `src/lib/library-product-type-classifier.test.ts` that expect:

```ts
assert.equal(
  classifyLibraryTypeCode({
    name: "Leather Wrist Cuffs",
    gender: "unisex",
    rawDescription: "adjustable bondage restraint cuffs for roleplay",
    tags: ["bondage", "restraint"],
  }),
  "bdsm",
);
```

and subtype expectations like:

```ts
assert.equal(
  classifyLibrarySubtypeCode({
    name: "Leather Wrist Cuffs",
    gender: "unisex",
    rawDescription: "adjustable bondage restraint cuffs for roleplay",
    tags: ["bondage", "restraint"],
    typeCode: "bdsm",
  }),
  "bondage_restraint",
);
```

- [ ] **Step 2: Run the targeted classifier test to verify it fails**

Run: `npx tsx --test src/lib/library-product-type-classifier.test.ts`
Expected: FAIL because `bdsm` and its subtypes do not exist yet.

- [ ] **Step 3: Add the new shared type/subtype definitions**

Modify `src/lib/library-product-types.ts` to add:

```ts
export type LibraryTypeCode =
  | "suction"
  | "external_vibe"
  | "insertable"
  | "dual_stimulation"
  | "masturbator"
  | "prostate"
  | "cock_ring"
  | "couples"
  | "wearable_remote"
  | "care_accessory"
  | "bdsm"
  | "unknown";
```

and:

```ts
export type LibrarySubtypeCode =
  | "suction_pure"
  | "suction_dual"
  | "rabbit_dual"
  | "multi_head_dual"
  | "bullet_vibe"
  | "wand_massager"
  | "gspot_insertable"
  | "insertable_vibe"
  | "manual_masturbator"
  | "vibrating_masturbator"
  | "interactive_masturbator"
  | "prostate_vibe"
  | "prostate_plug"
  | "classic_cock_ring"
  | "vibrating_cock_ring"
  | "insertable_couples"
  | "external_couples"
  | "panty_wearable"
  | "insertable_remote"
  | "dual_wearable_remote"
  | "lube_care"
  | "condom"
  | "lingerie"
  | "bondage_restraint"
  | "impact_play"
  | "sensory_play"
  | "gag_mask"
  | "collar_leash"
  | "anal_hook_probe"
  | "nipple_play"
  | "fetish_accessory";
```

Also update:

- `TYPE_LABELS`
- `SUBTYPE_LABELS`
- `GENDER_TO_TYPES`
- `TYPE_TO_SUBTYPES`
- `SUBTYPE_TO_PARENT_TYPE`

- [ ] **Step 4: Run the targeted classifier test again**

Run: `npx tsx --test src/lib/library-product-type-classifier.test.ts`
Expected: still FAIL, but now at classifier logic rather than missing type definitions.

### Task 2: Teach the Shared Classifier BDSM Signals

**Files:**
- Modify: `src/lib/library-product-type-classifier.ts`
- Test: `src/lib/library-product-type-classifier.test.ts`

- [ ] **Step 1: Add failing classifier coverage for BDSM type and subtype boundaries**

Add tests for:

```ts
classifyLibraryTypeCode({
  name: "Silicone Ball Gag",
  gender: "unisex",
  rawDescription: "soft ball gag for bdsm roleplay",
  tags: ["gag", "bdsm"],
}) === "bdsm";
```

```ts
classifyLibrarySubtypeCode({
  name: "Silicone Ball Gag",
  gender: "unisex",
  rawDescription: "soft ball gag for bdsm roleplay",
  tags: ["gag", "bdsm"],
  typeCode: "bdsm",
}) === "gag_mask";
```

Also add negative cases like:

```ts
classifyLibraryTypeCode({
  name: "Metal Butt Plug",
  gender: "female",
  rawDescription: "stainless steel butt plug",
  tags: ["anal", "plug"],
}) !== "bdsm";
```

- [ ] **Step 2: Run the targeted test to verify the new BDSM cases fail**

Run: `npx tsx --test src/lib/library-product-type-classifier.test.ts`
Expected: FAIL on the new BDSM cases.

- [ ] **Step 3: Implement minimal BDSM signal recognition**

In `src/lib/library-product-type-classifier.ts`, add dedicated pattern groups similar to the existing ones:

```ts
const BDSM_RESTRAINT_PATTERNS = [
  /bondage/u,
  /restraint/u,
  /cuffs?/u,
  /shackles?/u,
  /hogtie/u,
  /rope/u,
  /束缚/u,
  /拘束/u,
  /手铐/u,
  /脚铐/u,
];
```

and parallel groups for:

- impact tools
- blindfold / sensory play
- gags / masks
- collars / leashes
- nipple clamps
- anal hooks
- generic fetish accessory wording

Then add a `bdsm` branch in `classifyLibraryTypeCode()` that:

- beats `care_accessory`
- does not absorb plain plugs or prostate toys

And add subtype routing in `classifyLibrarySubtypeCode()` that maps strong BDSM signals to the new subtype codes.

- [ ] **Step 4: Run the classifier suite**

Run: `npx tsx --test src/lib/library-product-type-classifier.test.ts`
Expected: PASS with all old and new classifier cases green.

### Task 3: Cover Backfill Integration

**Files:**
- Modify: `src/db/backfill-item-type-code.test.ts`
- Test: `src/db/backfill-item-type-code.test.ts`

- [ ] **Step 1: Add failing backfill-level cases**

Add representative rows such as:

```ts
assert.equal(
  classifyTypeCodeBackfillRow({
    id: "toy-bdsm-1",
    name: "Leather Bondage Kit",
    gender: "unisex",
    physical_form: "external",
    raw_description: null,
    product_tags: ["bondage", "cuffs", "collar"],
    product_raw_description: "restraint kit for bdsm beginners",
  }),
  "bdsm",
);
```

and:

```ts
assert.equal(
  classifySubtypeCodeBackfillRow({
    id: "toy-bdsm-2",
    name: "Metal Nipple Clamps",
    gender: "unisex",
    physical_form: "external",
    raw_description: null,
    product_tags: ["nipple clamp", "fetish"],
    product_raw_description: "adjustable pressure clamps",
  }),
  "nipple_play",
);
```

- [ ] **Step 2: Run the backfill test file to verify it fails**

Run: `npx tsx --test src/db/backfill-item-type-code.test.ts`
Expected: FAIL because the shared classifier has not yet covered all integration cases.

- [ ] **Step 3: Adjust any integration mismatches minimally**

If the shared classifier already makes these pass, do not add extra backfill-only logic.
If there is an integration mismatch, keep the fix in the shared classifier rather than creating a backfill-specific BDSM fork.

- [ ] **Step 4: Re-run the backfill test file**

Run: `npx tsx --test src/db/backfill-item-type-code.test.ts`
Expected: PASS.

### Task 4: Run Full Verification

**Files:**
- Modify: none
- Test: `src/lib/library-product-type-classifier.test.ts`, `src/db/backfill-item-type-code.test.ts`

- [ ] **Step 1: Run the classifier suite**

Run: `npx tsx --test src/lib/library-product-type-classifier.test.ts`
Expected: PASS

- [ ] **Step 2: Run the type-code backfill suite**

Run: `npx tsx --test src/db/backfill-item-type-code.test.ts`
Expected: PASS

- [ ] **Step 3: Run the database backfill**

Run: `npm run db:backfill:item-type-code`
Expected: script completes and reports updated `type_code` / `subtype_code` rows for BDSM products.

- [ ] **Step 4: Spot-check the result**

Run a read-only query or log summary verifying BDSM rows now classify into:

- `bdsm / bondage_restraint`
- `bdsm / impact_play`
- `bdsm / sensory_play`
- `bdsm / gag_mask`
- `bdsm / collar_leash`
- `bdsm / anal_hook_probe`
- `bdsm / nipple_play`
- `bdsm / fetish_accessory`

- [ ] **Step 5: Commit**

```bash
git add src/lib/library-product-types.ts src/lib/library-product-type-classifier.ts src/lib/library-product-type-classifier.test.ts src/db/backfill-item-type-code.test.ts docs/superpowers/specs/2026-05-17-bdsm-library-category-design.md docs/superpowers/plans/2026-05-17-bdsm-library-category.md
git commit -m "feat: add bdsm library category"
```
