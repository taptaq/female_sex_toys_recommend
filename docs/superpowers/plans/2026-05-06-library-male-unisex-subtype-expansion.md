# Library Male And Unisex Subtype Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend male and unisex library products with subtype metadata, subtype classification, linked frontend filtering, and `recommender_toys.subtype_code` backfill support using the same shared model already used for female products.

**Architecture:** Keep the current top-level `type_code` model unchanged and expand the shared subtype system in place. The work lands in three layers: subtype metadata in `library-product-types`, subtype derivation in `library-product-type-classifier` plus the DB backfill helper, and verification through library page tests plus a final full backfill run.

**Tech Stack:** TypeScript, React, Node test runner, tsx, PostgreSQL maintenance scripts

---

## File Map

- `src/lib/library-product-types.ts`
  Responsible for subtype vocabulary, labels, allowed subtype lists, and selection sanitization.
- `src/lib/library-product-types.test.ts`
  Locks the subtype vocabulary and filter linkage behavior at the metadata layer.
- `src/lib/library-product-type-classifier.ts`
  Resolves `subtypeCode` from product name, raw description, tags, and weak `physicalForm` hints after parent type resolution.
- `src/lib/library-product-type-classifier.test.ts`
  Protects subtype decisions for male, unisex, and contaminant inputs.
- `src/pages/LibraryPage.test.tsx`
  Verifies male and unisex subtype filters render and filter products like the existing female flow.
- `src/db/backfill-item-type-code.ts`
  Reuses the shared classifier to populate `recommender_toys.subtype_code` during maintenance runs.
- `src/db/backfill-item-type-code.test.ts`
  Verifies backfill joins still produce the expected subtype results from mixed toy/product metadata.
- `src/db/purge-recommender-toy-contaminants.ts`
  Deletes accessory, connector, adapter, replacement-head, and machine-platform rows from `public.recommender_toys` using the same normalized signal rules as the classifier.
- `src/db/purge-recommender-toy-contaminants.test.ts`
  Locks contaminant detection and row-selection behavior before the live delete script runs.
- `package.json`
  Exposes a dedicated maintenance command for contaminant purge runs.

### Task 1: Lock male and unisex subtype vocabulary with failing tests

**Files:**
- Modify: `src/lib/library-product-types.test.ts`
- Modify: `src/pages/LibraryPage.test.tsx`

- [ ] **Step 1: Add failing metadata tests for male and unisex subtype lists**

Add coverage like:

```ts
test("getAllowedLibrarySubtypeCodes returns male subtypes for supported parent types", () => {
  assert.deepEqual(
    getAllowedLibrarySubtypeCodes("male", "masturbator"),
    ["manual_masturbator", "vibrating_masturbator", "interactive_masturbator"],
  );
  assert.deepEqual(
    getAllowedLibrarySubtypeCodes("unisex", "wearable_remote"),
    ["panty_wearable", "insertable_remote", "dual_wearable_remote"],
  );
});

test("getLibrarySubtypeLabel returns user-facing labels for male and unisex subtypes", () => {
  assert.equal(getLibrarySubtypeLabel("interactive_masturbator"), "互动杯");
  assert.equal(getLibrarySubtypeLabel("dual_wearable_remote"), "双人远控");
});
```

- [ ] **Step 2: Add failing page tests for male and unisex subtype filtering**

Add coverage like:

```tsx
test("library page shows male subtype options for masturbator products", () => {
  const html = renderToStaticMarkup(
    <LibraryPage
      allProducts={[
        makeProduct({
          id: "m1",
          gender: "male",
          typeCode: "masturbator",
          subtypeCode: "interactive_masturbator",
          name: "Sync Cup",
        }),
      ]}
      filterGender="male"
      filterType="masturbator"
      filterSubtype="all"
      filterBrand="all"
      filterOrigin="all"
      filterMaterial="all"
      filterPriceRange="all"
      filterMaxDb={70}
      isLoading={false}
      error={null}
      onReload={() => {}}
      onFilterGenderChange={() => {}}
      onFilterTypeChange={() => {}}
      onFilterSubtypeChange={() => {}}
      onFilterBrandChange={() => {}}
      onFilterOriginChange={() => {}}
      onFilterMaterialChange={() => {}}
      onFilterPriceRangeChange={() => {}}
      onFilterMaxDbChange={() => {}}
      onBack={() => {}}
    />,
  );

  assert.match(html, /类型细分/);
  assert.match(html, /互动杯/);
  assert.match(html, /震动杯/);
});
```

And:

```tsx
test("library page filters unisex wearable remote products by subtype", () => {
  const html = renderToStaticMarkup(
    <LibraryPage
      allProducts={[
        makeProduct({
          id: "u1",
          gender: "unisex",
          typeCode: "wearable_remote",
          subtypeCode: "panty_wearable",
          name: "Panty One",
        }),
        makeProduct({
          id: "u2",
          gender: "unisex",
          typeCode: "wearable_remote",
          subtypeCode: "dual_wearable_remote",
          name: "Couple Link",
        }),
      ]}
      filterGender="unisex"
      filterType="wearable_remote"
      filterSubtype="dual_wearable_remote"
      filterBrand="all"
      filterOrigin="all"
      filterMaterial="all"
      filterPriceRange="all"
      filterMaxDb={70}
      isLoading={false}
      error={null}
      onReload={() => {}}
      onFilterGenderChange={() => {}}
      onFilterTypeChange={() => {}}
      onFilterSubtypeChange={() => {}}
      onFilterBrandChange={() => {}}
      onFilterOriginChange={() => {}}
      onFilterMaterialChange={() => {}}
      onFilterPriceRangeChange={() => {}}
      onFilterMaxDbChange={() => {}}
      onBack={() => {}}
    />,
  );

  assert.match(html, /Couple Link/);
  assert.doesNotMatch(html, /Panty One/);
});
```

- [ ] **Step 3: Run metadata and page tests to verify they fail**

Run:

```bash
node --import tsx --test src/lib/library-product-types.test.ts src/pages/LibraryPage.test.tsx
```

Expected:

- FAIL because the new subtype codes and labels do not exist yet
- FAIL because supported male/unisex parent types still return no subtype options

- [ ] **Step 4: Commit the red tests**

Run:

```bash
git add src/lib/library-product-types.test.ts src/pages/LibraryPage.test.tsx
git commit -m "test: add male and unisex library subtype coverage"
```

### Task 2: Implement shared subtype metadata for male and unisex types

**Files:**
- Modify: `src/lib/library-product-types.ts`
- Modify: `src/lib/library-product-types.test.ts`

- [ ] **Step 1: Extend the subtype union and labels**

Add subtype codes:

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
  | "dual_wearable_remote";
```

And labels:

```ts
const SUBTYPE_LABELS: Record<LibrarySubtypeCode, string> = {
  suction_pure: "纯吮吸",
  suction_dual: "吮吸双刺激",
  rabbit_dual: "兔耳双刺激",
  multi_head_dual: "双头多点",
  bullet_vibe: "跳蛋/子弹",
  wand_massager: "魔杖按摩",
  gspot_insertable: "G点探索",
  insertable_vibe: "入体震动",
  manual_masturbator: "手动杯",
  vibrating_masturbator: "震动杯",
  interactive_masturbator: "互动杯",
  prostate_vibe: "震动前列腺",
  prostate_plug: "前列腺塞",
  classic_cock_ring: "基础环",
  vibrating_cock_ring: "震动环",
  insertable_couples: "双人入体",
  external_couples: "双人外用",
  panty_wearable: "隐形穿戴",
  insertable_remote: "入体远控",
  dual_wearable_remote: "双人远控",
};
```

- [ ] **Step 2: Wire the new parent-to-subtype mappings**

Update the mapping:

```ts
const TYPE_TO_SUBTYPES: Partial<Record<Exclude<LibrarySelectableTypeCode, "unknown">, LibrarySubtypeCode[]>> = {
  suction: ["suction_pure"],
  dual_stimulation: ["suction_dual", "rabbit_dual", "multi_head_dual"],
  external_vibe: ["bullet_vibe", "wand_massager"],
  insertable: ["gspot_insertable", "insertable_vibe"],
  masturbator: ["manual_masturbator", "vibrating_masturbator", "interactive_masturbator"],
  prostate: ["prostate_vibe", "prostate_plug"],
  cock_ring: ["classic_cock_ring", "vibrating_cock_ring"],
  couples: ["insertable_couples", "external_couples"],
  wearable_remote: ["panty_wearable", "insertable_remote", "dual_wearable_remote"],
};
```

No changes are needed to `LibraryPage.tsx` if `getAllowedLibrarySubtypeCodes` and labels stay the single metadata source.

- [ ] **Step 3: Run the task-1 test command to verify it turns green**

Run:

```bash
node --import tsx --test src/lib/library-product-types.test.ts src/pages/LibraryPage.test.tsx
```

Expected:

- PASS for subtype label rendering
- PASS for male/unisex subtype list rendering
- PASS for library page subtype filtering driven by metadata

- [ ] **Step 4: Commit the metadata implementation**

Run:

```bash
git add src/lib/library-product-types.ts src/lib/library-product-types.test.ts src/pages/LibraryPage.test.tsx
git commit -m "feat: add male and unisex library subtype metadata"
```

### Task 3: Lock classifier and backfill behavior with failing tests

**Files:**
- Modify: `src/lib/library-product-type-classifier.test.ts`
- Modify: `src/db/backfill-item-type-code.test.ts`
- Create: `src/db/purge-recommender-toy-contaminants.test.ts`

- [ ] **Step 1: Add failing classifier tests for male and unisex subtype resolution**

Add representative tests:

```ts
test("classifyLibrarySubtypeCode recognizes interactive masturbators", () => {
  assert.equal(
    classifyLibrarySubtypeCode({
      typeCode: "masturbator",
      gender: "male",
      physicalForm: "external",
      name: "Sync Interactive Cup",
      rawDescription: "APP 互动同步，远控联动体验",
      tags: ["互动", "远控", "app"],
    }),
    "interactive_masturbator",
  );
});

test("classifyLibrarySubtypeCode recognizes couple remote wearables before generic panty wearables", () => {
  assert.equal(
    classifyLibrarySubtypeCode({
      typeCode: "wearable_remote",
      gender: "unisex",
      physicalForm: "external",
      name: "Couple Link",
      rawDescription: "情侣双人共玩，远控穿戴设计",
      tags: ["情侣", "双人", "远控", "穿戴"],
    }),
    "dual_wearable_remote",
  );
});
```

Also add conservative cases:

```ts
test("classifyLibrarySubtypeCode returns null when male parent evidence is weak", () => {
  assert.equal(
    classifyLibrarySubtypeCode({
      typeCode: "masturbator",
      gender: "male",
      physicalForm: "external",
      name: "Series One",
      rawDescription: null,
      tags: [],
    }),
    null,
  );
});
```

Also add contaminant coverage:

```ts
test("isLibraryContaminantInput recognizes adapter-style rows", () => {
  assert.equal(
    isLibraryContaminantInput({
      gender: "unisex",
      physicalForm: "external",
      name: "USB Bluetooth Adapter",
      rawDescription: "用于连接远控穿戴设备与 app 的蓝牙适配器",
      tags: ["远控", "蓝牙", "适配器"],
    }),
    true,
  );
});
```

- [ ] **Step 2: Add failing backfill tests for joined male and unisex subtype derivation**

Add coverage like:

```ts
test("classifySubtypeCodeBackfillRow derives vibrating cock ring from joined metadata", () => {
  assert.equal(
    classifySubtypeCodeBackfillRow({
      id: "toy-ring-1",
      name: "Vibe Ring",
      gender: "male",
      physical_form: "external",
      raw_description: null,
      product_tags: ["震动环"],
      product_raw_description: "柔软环体，震动刺激",
    }),
    "vibrating_cock_ring",
  );
});

test("classifySubtypeCodeBackfillRow keeps ambiguous unisex rows empty", () => {
  assert.equal(
    classifySubtypeCodeBackfillRow({
      id: "toy-unisex-1",
      name: "Remote Series",
      gender: "unisex",
      physical_form: "external",
      raw_description: null,
      product_tags: ["远控"],
      product_raw_description: "支持 app 控制",
    }),
    null,
  );
});
```

- [ ] **Step 3: Add failing purge-script tests for contaminant row selection**

Create `src/db/purge-recommender-toy-contaminants.test.ts` with coverage like:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  selectContaminantToyIds,
  type PurgeContaminantToyRow,
} from "./purge-recommender-toy-contaminants.ts";

test("selectContaminantToyIds returns adapter and machine rows only", () => {
  const rows: PurgeContaminantToyRow[] = [
    {
      id: "toy-1",
      name: "USB Bluetooth Adapter",
      gender: "unisex",
      physical_form: "external",
      raw_description: "用于连接远控穿戴设备",
      product_tags: ["蓝牙", "适配器"],
      product_raw_description: null,
    },
    {
      id: "toy-2",
      name: "Couple Link",
      gender: "unisex",
      physical_form: "external",
      raw_description: "情侣双人共玩，远控穿戴设计",
      product_tags: ["情侣", "远控", "穿戴"],
      product_raw_description: null,
    },
  ];

  assert.deepEqual(selectContaminantToyIds(rows), ["toy-1"]);
});
```

- [ ] **Step 4: Run classifier, backfill, and purge tests to verify they fail**

Run:

```bash
node --import tsx --test src/lib/library-product-type-classifier.test.ts src/db/backfill-item-type-code.test.ts src/db/purge-recommender-toy-contaminants.test.ts
```

Expected:

- FAIL because the new subtype constants are unknown
- FAIL because subtype classification still returns existing female-only results or `null`
- FAIL because contaminant helper exports and purge script do not exist yet

- [ ] **Step 5: Commit the red tests**

Run:

```bash
git add src/lib/library-product-type-classifier.test.ts src/db/backfill-item-type-code.test.ts src/db/purge-recommender-toy-contaminants.test.ts
git commit -m "test: cover subtype and contaminant maintenance flows"
```

### Task 4: Implement subtype classification and contaminant helpers

**Files:**
- Modify: `src/lib/library-product-type-classifier.ts`
- Modify: `src/lib/library-product-type-classifier.test.ts`
- Modify: `src/db/backfill-item-type-code.test.ts`
- Modify: `src/db/purge-recommender-toy-contaminants.test.ts`

- [ ] **Step 1: Add subtype pattern groups for male and unisex products**

Near the existing pattern tables, add focused pattern arrays:

```ts
const INTERACTIVE_PATTERNS = [/互动/u, /远控/u, /app/u, /同步/u, /联动/u];
const POWERED_MASTURBATOR_PATTERNS = [/震动/u, /加温/u, /旋转/u, /抽动/u, /自动/u, /电动/u];
const PROSTATE_PLUG_PATTERNS = [/plug/u, /肛塞/u, /后庭塞/u, /前列腺塞/u, /塞/u];
const RING_POWER_PATTERNS = [/震动/u, /遥控/u, /远控/u, /app/u];
const COUPLES_PATTERNS = [/情侣/u, /双人/u, /共玩/u, /互动/u, /共享/u, /\bcouple/u];
const PANTY_WEARABLE_PATTERNS = [/内裤/u, /隐形佩戴/u, /贴身穿戴/u, /外出穿戴/u];
```

- [ ] **Step 2: Extend `classifyLibrarySubtypeCode` with parent-specific branches**

Add branches before the existing fallback return:

```ts
if (resolvedTypeCode === "masturbator") {
  if (hasAnySignal(corpus.signalText, INTERACTIVE_PATTERNS)) {
    return "interactive_masturbator";
  }
  if (hasAnySignal(corpus.signalText, POWERED_MASTURBATOR_PATTERNS)) {
    return "vibrating_masturbator";
  }
  if (hasAnySignal(corpus.signalText, MASTURBATOR_PATTERNS)) {
    return "manual_masturbator";
  }
  return null;
}
```

And equivalent branches:

```ts
if (resolvedTypeCode === "prostate") {
  if (hasAnySignal(corpus.signalText, VIBRATION_PATTERNS)) return "prostate_vibe";
  if (hasAnySignal(corpus.signalText, PROSTATE_PLUG_PATTERNS)) return "prostate_plug";
  return null;
}

if (resolvedTypeCode === "cock_ring") {
  if (hasAnySignal(corpus.signalText, RING_POWER_PATTERNS)) return "vibrating_cock_ring";
  if (hasAnySignal(corpus.signalText, COCK_RING_PATTERNS)) return "classic_cock_ring";
  return null;
}

if (resolvedTypeCode === "couples") {
  if (insertableStrongScore > 0) return "insertable_couples";
  if (hasAnySignal(corpus.signalText, COUPLES_PATTERNS)) return "external_couples";
  return null;
}

if (resolvedTypeCode === "wearable_remote") {
  const hasCouples = hasAnySignal(corpus.signalText, COUPLES_PATTERNS);
  const hasRemote = hasAnySignal(corpus.signalText, REMOTE_PATTERNS);
  const hasWearable = hasAnySignal(corpus.signalText, WEARABLE_PATTERNS);
  if (hasCouples && hasRemote && hasWearable) return "dual_wearable_remote";
  if (hasRemote && insertableStrongScore > 0) return "insertable_remote";
  if (hasAnySignal(corpus.signalText, PANTY_WEARABLE_PATTERNS)) return "panty_wearable";
  return null;
}
```

Keep the existing contaminant guard intact so accessories and adapters still fall back to `unknown` at the parent layer.

- [ ] **Step 3: Export a reusable contaminant helper for purge logic**

Add a shared helper such as:

```ts
export function isLibraryContaminantInput(
  input: LibraryTypeClassifierInput,
): boolean {
  const corpus = buildSignalCorpus(input);
  return isAccessoryOrMachineLike(corpus);
}
```

Keep the helper intentionally narrow so it reuses the exact same contaminant rules already trusted by type classification.

- [ ] **Step 4: Re-run classifier, backfill, and purge tests to verify they pass**

Run:

```bash
node --import tsx --test src/lib/library-product-type-classifier.test.ts src/db/backfill-item-type-code.test.ts src/db/purge-recommender-toy-contaminants.test.ts
```

Expected:

- PASS for interactive, vibrating, prostate, ring, couples, and wearable subtype cases
- PASS for conservative `null` subtype cases
- PASS for contaminant helper coverage

- [ ] **Step 5: Commit the classifier implementation**

Run:

```bash
git add src/lib/library-product-type-classifier.ts src/lib/library-product-type-classifier.test.ts src/db/backfill-item-type-code.test.ts src/db/purge-recommender-toy-contaminants.test.ts
git commit -m "feat: classify male unisex subtypes and contaminants"
```

### Task 5: Add a dedicated contaminant purge script for recommender_toys

**Files:**
- Create: `src/db/purge-recommender-toy-contaminants.ts`
- Create: `src/db/purge-recommender-toy-contaminants.test.ts`
- Modify: `package.json`
- Modify: `src/lib/repository-neutralization.test.ts`

- [ ] **Step 1: Implement a reusable row shape and ID selector**

In `src/db/purge-recommender-toy-contaminants.ts`, add:

```ts
export type PurgeContaminantToyRow = {
  id: string;
  name: string;
  gender: string | null;
  physical_form: string | null;
  raw_description: string | null;
  product_tags: string[] | null;
  product_raw_description: string | null;
};

export function selectContaminantToyIds(rows: PurgeContaminantToyRow[]) {
  return rows
    .filter((row) =>
      isLibraryContaminantInput({
        gender: row.gender,
        physicalForm: row.physical_form,
        name: row.name,
        rawDescription: [row.raw_description, row.product_raw_description]
          .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
          .join("\n") || null,
        tags: Array.isArray(row.product_tags) ? row.product_tags : [],
      }),
    )
    .map((row) => row.id);
}
```

- [ ] **Step 2: Add the live delete flow and package script**

Implement the script body so it:

- reads joined rows from `public.recommender_toys` plus `products`
- computes contaminant IDs with `selectContaminantToyIds`
- deletes matching rows in batches from `public.recommender_toys`
- logs scanned count, delete count, and a small sample of deleted names

Add the package command:

```json
"db:purge:contaminant-toys": "tsx -r dotenv/config src/db/purge-recommender-toy-contaminants.ts"
```

Also extend `src/lib/repository-neutralization.test.ts` to assert the new script exists and targets `public.recommender_toys`.

- [ ] **Step 3: Run purge-focused tests**

Run:

```bash
node --import tsx --test src/db/purge-recommender-toy-contaminants.test.ts src/lib/repository-neutralization.test.ts
```

Expected:

- PASS for contaminant row selection
- PASS for repository naming expectations around the new purge script

- [ ] **Step 4: Commit the purge script**

Run:

```bash
git add src/db/purge-recommender-toy-contaminants.ts src/db/purge-recommender-toy-contaminants.test.ts package.json src/lib/repository-neutralization.test.ts
git commit -m "feat: add recommender contaminant purge script"
```

### Task 6: Run full verification and refresh the database

**Files:**
- Modify: `src/lib/library-product-types.ts`
- Modify: `src/lib/library-product-type-classifier.ts`
- Modify: `src/lib/library-product-types.test.ts`
- Modify: `src/lib/library-product-type-classifier.test.ts`
- Modify: `src/pages/LibraryPage.test.tsx`
- Modify: `src/db/backfill-item-type-code.test.ts`
- Modify: `src/db/purge-recommender-toy-contaminants.test.ts`
- Modify: `src/lib/repository-neutralization.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Run the full focused verification suite**

Run:

```bash
node --import tsx --test src/db/backfill-item-type-code.test.ts src/db/purge-recommender-toy-contaminants.test.ts src/lib/library-product-types.test.ts src/lib/library-product-type-classifier.test.ts src/lib/app-shell.test.ts src/lib/repository-neutralization.test.ts src/pages/LibraryPage.test.tsx
```

Expected:

- PASS with `0 fail`

- [ ] **Step 2: Run the type checker**

Run:

```bash
npm run lint
```

Expected:

- `tsc --noEmit` exits with code `0`

- [ ] **Step 3: Purge live contaminant rows from `recommender_toys`**

Run:

```bash
npm run db:purge:contaminant-toys
```

Expected:

- script logs show scanned rows and deleted contaminant count
- deleted rows include adapter / connector / machine-platform style products

- [ ] **Step 4: Backfill live subtype data into `recommender_toys`**

Run:

```bash
npm run db:backfill:item-type-code
```

Expected:

- script logs show `recommender_toys.type_code` / `subtype_code` scan progress
- updated rows include male and unisex subtype changes where evidence is strong enough

- [ ] **Step 5: Spot-check representative database results**

Run:

```bash
node --input-type=module -e "import pg from 'pg'; import dotenv from 'dotenv'; dotenv.config(); const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }); const q = `select gender, type_code, subtype_code, name from public.recommender_toys where gender in ('male','unisex') order by gender, type_code, subtype_code nulls last, name limit 40`; const contaminants = `select name from public.recommender_toys where lower(name) ~ '(adapter|connector|replacement|sex machine)' or name ~ '(适配器|连接器|配件|机座)' limit 20`; const [res, contaminantRes] = await Promise.all([pool.query(q), pool.query(contaminants)]); console.log(JSON.stringify({ sample: res.rows, contaminants: contaminantRes.rows }, null, 2)); await pool.end();"
```

Expected:

- male `masturbator`, `prostate`, and `cock_ring` rows show a mix of new subtype codes
- unisex `couples` and `wearable_remote` rows show targeted subtype codes
- ambiguous rows may keep `subtype_code = null`
- contaminant sample comes back empty or close to empty after the purge

- [ ] **Step 6: Commit the finished implementation**

Run:

```bash
git add src/lib/library-product-types.ts src/lib/library-product-types.test.ts src/lib/library-product-type-classifier.ts src/lib/library-product-type-classifier.test.ts src/pages/LibraryPage.test.tsx src/db/backfill-item-type-code.test.ts src/db/purge-recommender-toy-contaminants.ts src/db/purge-recommender-toy-contaminants.test.ts src/lib/repository-neutralization.test.ts package.json
git commit -m "feat: expand subtypes and purge contaminant toys"
```
