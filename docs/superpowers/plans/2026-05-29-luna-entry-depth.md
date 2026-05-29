# Luna Entry Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Match Mode launch animation so Luna enters the active planet with arc speed and iris-warp depth.

**Architecture:** Keep the interaction state in `MatchModePage.tsx` unchanged and add only decorative DOM layers tied to `isLaunching`. Put all timing and visuals in `src/index.css`, reusing the existing 980ms handoff.

**Tech Stack:** React, CSS keyframes, existing Node test runner.

---

### Task 1: Test The Visual Contract

**Files:**
- Modify: `src/pages/MatchModePage.test.tsx`

- [ ] Add assertions that the page renders `female-mvp-mode-launch-warp`, `female-mvp-mode-launch-speedline`, and `female-mvp-mode-launch-iris`.
- [ ] Add CSS assertions for `female-mvp-mode-luna-dive` arc keyframes, `female-mvp-mode-launch-speedline-flight`, `female-mvp-mode-launch-iris-warp`, and launch-time active planet animation.
- [ ] Run `npx tsx --test src/pages/MatchModePage.test.tsx` and confirm the new assertions fail before implementation.

### Task 2: Add Decorative Launch Layers

**Files:**
- Modify: `src/pages/MatchModePage.tsx`

- [ ] Add an `aria-hidden` launch-warp span inside `female-mvp-mode-orbit-stage`.
- [ ] Include three speedline spans and one iris span.
- [ ] Gate active animation with the existing `isLaunching` state class.

### Task 3: Implement The Animation

**Files:**
- Modify: `src/index.css`

- [ ] Revise `female-mvp-mode-luna-dive` to use a rising arc and stronger shrink into the planet center.
- [ ] Add `female-mvp-mode-launch-speedline-flight`, `female-mvp-mode-launch-iris-warp`, and `female-mvp-mode-active-planet-warp` keyframes.
- [ ] Style launch-warp layers as decorative, pointer-events-none, and hidden until launch.
- [ ] Keep duration under the existing 980ms handoff.

### Task 4: Verify

**Files:**
- Test: `src/pages/MatchModePage.test.tsx`

- [ ] Run `npx tsx --test src/pages/MatchModePage.test.tsx`.
- [ ] Run `npm run lint`.
- [ ] Start or reuse the Vite dev server.
- [ ] Open the local app in the browser and visually verify the Match Mode launch is not flat.
