# Library Card Detail Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify product cards and add a separate in-app product detail modal with external links clearly labeled.

**Architecture:** `LibraryPage` owns selected product state and modal rendering. `ProductCardContent` remains reusable, exposes an optional detail button callback, and no longer renders dense detail blocks on the surface.

**Tech Stack:** React, TypeScript, Tailwind utility classes, existing product helpers.

---

### Task 1: Product Card Surface

**Files:**
- Modify: `src/components/ProductCardContent.tsx`
- Modify: `src/components/ProductCardContent.test.tsx`

- [ ] Keep image, favorite, brand/name, price, audience chip, and compact specs.
- [ ] Add `查看详情信息` button via optional `onViewDetails`.
- [ ] Remove brand brief, persona, and tag blocks from the card surface.

### Task 2: Library Detail Modal

**Files:**
- Modify: `src/pages/LibraryPage.tsx`
- Modify: `src/pages/LibraryPage.test.tsx`

- [ ] Replace product card anchors with non-link cards.
- [ ] Add selected product state and modal.
- [ ] Put external `打开产品详情链接` only in the modal.

### Task 3: Verify

- [ ] Run `npx tsc --noEmit`.
- [ ] Run product card and library tests.
- [ ] Browser smoke library card detail modal.
