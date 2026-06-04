# Home Luna Starmap Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strengthen the Female MVP homepage Luna/star-map intro with a staged scan, planet pop, Luna float-in, and delayed label reveal.

**Architecture:** Keep the animation in the existing `HomePage.tsx` GSAP context. CSS only provides restrained visual primitives; GSAP remains the owner of homepage Luna and planet wrapper transforms.

**Tech Stack:** React, TypeScript, GSAP, CSS, Node test runner via `tsx --test`.

---

### Task 1: Lock The Stronger Entry Contract

**Files:**
- Modify: `src/pages/HomePage.test.tsx`

- [ ] **Step 1: Update assertions**

Add source-level assertions that the homepage intro has named phases for orbit scan, planet pop, Luna float-in, and delayed labels.

- [ ] **Step 2: Run the focused test**

Run: `npx tsx --test src/pages/HomePage.test.tsx`

Expected: it fails until the source contains the stronger entry contract.

### Task 2: Implement The GSAP Starmap Intro

**Files:**
- Modify: `src/pages/HomePage.tsx`

- [ ] **Step 1: Add timeline labels**

Add labels such as `orbitScan`, `planetDiscovery`, `lunaArrival`, and `labelReveal` to the existing timeline.

- [ ] **Step 2: Strengthen planet reveal**

Change the planet intro from a plain fade to a staggered scale pop with a short brightness/glow lift that settles before idle motion starts.

- [ ] **Step 3: Strengthen Luna reveal**

Move Luna reveal later in the timeline and animate from a softer lower `y`, smaller `scale`, and mild rotation into its final position.

### Task 3: Add A Quiet Scan Detail

**Files:**
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Add decorative scan layer**

Add an `aria-hidden` scan layer inside the homepage intro stage.

- [ ] **Step 2: Style the scan layer**

Use a subtle radial/linear gradient sweep that can be animated by GSAP opacity/scale without adding assets.

### Task 4: Verify

**Files:**
- Test: `src/pages/HomePage.test.tsx`

- [ ] **Step 1: Run TypeScript**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 2: Run homepage tests**

Run: `npx tsx --test src/pages/HomePage.test.tsx`

Expected: all tests pass.

- [ ] **Step 3: Browser smoke**

Open `http://127.0.0.1:3009/` at a mobile viewport and confirm Luna, planets, copy, and four mode nodes remain in bounds after the stronger entry animation.
