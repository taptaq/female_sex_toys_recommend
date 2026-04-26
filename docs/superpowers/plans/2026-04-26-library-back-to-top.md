# Library Back To Top Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a scroll-aware back-to-top button to the holographic equipment library page that appears after the user scrolls down and smoothly returns the same page container to the top.

**Architecture:** Keep the feature local to `LibraryPage` and extract only the visibility-threshold logic into a tiny shared helper so we can test it with `node:test` first. The page component then owns the scroll ref, visibility state, and smooth-scroll interaction.

**Tech Stack:** React 19, TypeScript, lucide-react, node:test, Vite

---

### File Map

**Create:**
- `src/lib/library-back-to-top.ts` — helper for deciding when the button should appear
- `src/lib/library-back-to-top.test.ts` — focused tests for the visibility threshold logic

**Modify:**
- `src/pages/LibraryPage.tsx` — wire scroll tracking, floating button UI, and smooth scroll-to-top behavior

### Task 1: Add Failing Test For Visibility Logic

**Files:**
- Create: `src/lib/library-back-to-top.test.ts`
- Test: `src/lib/library-back-to-top.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  LIBRARY_BACK_TO_TOP_THRESHOLD,
  shouldShowLibraryBackToTop,
} from "./library-back-to-top.ts";

test("shouldShowLibraryBackToTop stays hidden at the threshold", () => {
  assert.equal(shouldShowLibraryBackToTop(0), false);
  assert.equal(
    shouldShowLibraryBackToTop(LIBRARY_BACK_TO_TOP_THRESHOLD),
    false,
  );
});

test("shouldShowLibraryBackToTop appears after the threshold", () => {
  assert.equal(
    shouldShowLibraryBackToTop(LIBRARY_BACK_TO_TOP_THRESHOLD + 1),
    true,
  );
  assert.equal(shouldShowLibraryBackToTop(960), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --loader ts-node/esm --test src/lib/library-back-to-top.test.ts`
Expected: FAIL because `src/lib/library-back-to-top.ts` does not exist yet

- [ ] **Step 3: Commit**

```bash
git add src/lib/library-back-to-top.test.ts
git commit -m "test: cover library back-to-top visibility"
```

### Task 2: Implement Threshold Helper

**Files:**
- Create: `src/lib/library-back-to-top.ts`
- Test: `src/lib/library-back-to-top.test.ts`

- [ ] **Step 1: Write minimal implementation**

```ts
export const LIBRARY_BACK_TO_TOP_THRESHOLD = 360;

export function shouldShowLibraryBackToTop(
  scrollTop: number,
  threshold = LIBRARY_BACK_TO_TOP_THRESHOLD,
) {
  return scrollTop > threshold;
}
```

- [ ] **Step 2: Run test to verify it passes**

Run: `node --loader ts-node/esm --test src/lib/library-back-to-top.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/library-back-to-top.ts src/lib/library-back-to-top.test.ts
git commit -m "feat: add library back-to-top threshold helper"
```

### Task 3: Wire Back-To-Top Button Into Library Page

**Files:**
- Modify: `src/pages/LibraryPage.tsx`
- Test: `src/lib/library-back-to-top.test.ts`

- [ ] **Step 1: Add local scroll state and handlers**

```tsx
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUp } from "lucide-react";
import { shouldShowLibraryBackToTop } from "../lib/library-back-to-top";

const containerRef = useRef<HTMLDivElement | null>(null);
const [showBackToTop, setShowBackToTop] = useState(false);

useEffect(() => {
  const container = containerRef.current;
  if (!container) return;

  const syncVisibility = () => {
    setShowBackToTop(shouldShowLibraryBackToTop(container.scrollTop));
  };

  syncVisibility();
  container.addEventListener("scroll", syncVisibility, { passive: true });

  return () => {
    container.removeEventListener("scroll", syncVisibility);
  };
}, []);

function handleBackToTop() {
  containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
}
```

- [ ] **Step 2: Attach the ref and render the floating button**

```tsx
<div
  ref={containerRef}
  className="min-h-screen flex flex-col items-center justify-start p-4 sm:p-6 md:p-8 relative overflow-hidden overflow-y-auto w-full"
>
  ...
  <button
    type="button"
    onClick={handleBackToTop}
    aria-label="回到顶部"
    className={`fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-slate-950/80 px-4 py-2 text-xs text-cyan-100 shadow-[0_0_30px_rgba(34,211,238,0.18)] backdrop-blur-md transition-all duration-300 hover:border-cyan-300/70 hover:bg-cyan-950/85 hover:text-white sm:bottom-8 sm:right-8 ${
      showBackToTop
        ? "translate-y-0 opacity-100 pointer-events-auto"
        : "translate-y-3 opacity-0 pointer-events-none"
    }`}
  >
    <ArrowUp className="h-4 w-4" />
    <span>回到顶部</span>
  </button>
</div>
```

- [ ] **Step 3: Run verification**

Run: `node --loader ts-node/esm --test src/lib/library-back-to-top.test.ts`
Expected: PASS

Run: `npx tsc --noEmit`
Expected: PASS

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/pages/LibraryPage.tsx
git commit -m "feat: add library back-to-top button"
```
