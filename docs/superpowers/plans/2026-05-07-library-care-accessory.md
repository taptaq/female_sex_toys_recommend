# Library Care Accessory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated `护理与周边` library branch for lubricant, condom, and lingerie products without weakening contaminant deletion.

**Architecture:** Extend the existing shared library type/subtype model in place. Reuse the current linked frontend filter flow and the current backfill path so the new category is handled consistently in metadata, runtime classification, and stored `recommender_toys` rows.

**Tech Stack:** TypeScript, React, Node test runner, tsx, PostgreSQL maintenance scripts

---

## File Map

- `src/lib/library-product-types.ts`
  Adds the new parent type, labels, and subtype metadata.
- `src/lib/library-product-type-classifier.ts`
  Adds care/apparel detection ahead of device routing while preserving contaminant guards.
- `src/pages/LibraryPage.tsx`
  Reuses the shared type metadata automatically once the new parent/subtypes exist.
- `src/db/backfill-item-type-code.ts`
  Reuses the shared classifier and needs no structural change beyond passing tests.
- `src/lib/library-product-types.test.ts`
  Locks the new labels and allowed type/subtype mappings.
- `src/lib/library-product-type-classifier.test.ts`
  Locks type and subtype decisions for lube, condom, lingerie, and contaminant coexistence.
- `src/pages/LibraryPage.test.tsx`
  Verifies the new type appears and filters correctly.
- `src/db/backfill-item-type-code.test.ts`
  Verifies backfill derives the new parent/subtype.
- `src/db/purge-recommender-toy-contaminants.test.ts`
  Verifies care rows are preserved by contaminant selection.

## Tasks

- [ ] Add failing tests for metadata, classifier, page filtering, backfill derivation, and contaminant preservation
- [ ] Implement `care_accessory` parent type plus `lube_care`, `condom`, and `lingerie` subtypes
- [ ] Verify focused tests and `npm run lint`
- [ ] Run live `npm run db:backfill:item-type-code`
