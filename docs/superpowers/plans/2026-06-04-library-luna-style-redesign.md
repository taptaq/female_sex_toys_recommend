# Library Luna Style Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the product library page so it feels like part of the Luna app while preserving all filter/data behavior.

**Architecture:** Keep `LibraryPage.tsx` as the owner of the page shell and filters. Update class names and light Luna surface styling; keep `ProductCardContent` and filtering helpers unchanged.

**Tech Stack:** React, TypeScript, Tailwind utility classes, existing CSS helpers, Node test runner via `tsx --test`.

---

### Task 1: Update Visual Contract Tests

**Files:**
- Modify: `src/pages/LibraryPage.test.tsx`

- [ ] Update assertions for a soft Luna library shell, simplified header copy, primary filter panel, and mobile-friendly grid.

### Task 2: Restyle Library Page

**Files:**
- Modify: `src/pages/LibraryPage.tsx`
- Modify: `src/index.css`

- [ ] Replace dark cockpit wrapper with light pastel Luna shell.
- [ ] Simplify header and sync button.
- [ ] Restyle filter dropdown constants and filter panel.
- [ ] Restyle loading, error, empty, product grid, and back-to-top affordances.

### Task 3: Verify

**Files:**
- Test: `src/pages/LibraryPage.test.tsx`

- [ ] Run `npx tsc --noEmit`.
- [ ] Run `npx tsx --test src/pages/LibraryPage.test.tsx`.
- [ ] Browser smoke the library route on mobile viewport.
