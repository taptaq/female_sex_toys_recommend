# Match Mode GSAP Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Match Mode entrance and active-mode polish into GSAP while keeping the existing launch warp mostly intact.

**Architecture:** Add focused GSAP effects inside `MatchModePage.tsx` using the existing performance helpers. Keep CSS responsible for static orbit slot layout and launch warp visuals.

**Tech Stack:** React, TypeScript, GSAP, CSS, Node test runner via `tsx --test`.

---

### Task 1: Test Contract

**Files:**
- Modify: `src/pages/MatchModePage.test.tsx`

- [ ] Assert that `MatchModePage.tsx` imports GSAP and motion helpers.
- [ ] Assert that the page has a named GSAP entrance function and a named active-mode focus function.
- [ ] Assert that launch warp CSS animation contracts still exist.

### Task 2: GSAP Motion

**Files:**
- Modify: `src/pages/MatchModePage.tsx`

- [ ] Add `useEffect`, `gsap`, `usePagePerformanceState`, `getGsapDuration`, and `shouldRunGsapMotion`.
- [ ] Add a page ref and use `gsap.context`.
- [ ] Add a staged entrance timeline for the back button, hero, rings, planets, Luna, selected panel, and CTA.
- [ ] Add a short active-mode focus timeline when `activeModeId` changes.
- [ ] Respect reduced motion by immediately revealing elements without running GSAP.

### Task 3: Verify

**Files:**
- Test: `src/pages/MatchModePage.test.tsx`

- [ ] Run `npx tsc --noEmit`.
- [ ] Run `npx tsx --test src/pages/MatchModePage.test.tsx`.
- [ ] Browser smoke `http://127.0.0.1:3009/match-mode` or the app route that opens Match Mode, confirming elements remain in bounds.
