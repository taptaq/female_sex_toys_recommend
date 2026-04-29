# Floating Knowledge Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the loading knowledge cards on `LoadingPage` and `MatchingPage` with ambient floating short-sentence capsules that feel like space debris while keeping central loading text readable.

**Architecture:** Add a small pure layout helper that turns loading facts into deterministic capsule slots for desktop and mobile. Add a shared `FloatingKnowledgeField` React component that renders those slots as non-interactive animated capsules, then replace `LoadingFunFacts` usage in the two loading pages. Styling lives in `src/index.css` and uses responsive slot variables plus reduced-motion safeguards.

**Tech Stack:** React 19, TypeScript, motion/react, Tailwind CSS 4, Node test runner, Vite

---

### Task 1: Floating Knowledge Layout Helper

**Files:**
- Create: `src/lib/floating-knowledge-field.ts`
- Test: `src/lib/floating-knowledge-field.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { buildFloatingKnowledgeItems } from "./floating-knowledge-field.ts";
import type { LoadingFunFact } from "./loading-fun-facts.ts";

const facts: LoadingFunFact[] = Array.from({ length: 12 }, (_, index) => ({
  id: `fact-${index + 1}`,
  title: `知识碎片 ${index + 1}`,
  description: `描述 ${index + 1}`,
  theme: index % 2 === 0 ? "care" : "decision",
  surfaces: ["loading", "matching"],
}));

test("buildFloatingKnowledgeItems returns medium desktop density", () => {
  const items = buildFloatingKnowledgeItems(facts, {
    variant: "loading",
    viewport: "desktop",
  });

  assert.equal(items.length, 9);
  assert.deepEqual(
    items.map((item) => item.fact.id),
    facts.slice(0, 9).map((fact) => fact.id),
  );
});

test("buildFloatingKnowledgeItems returns reduced mobile density", () => {
  const items = buildFloatingKnowledgeItems(facts, {
    variant: "matching",
    viewport: "mobile",
  });

  assert.equal(items.length, 5);
  assert.ok(items.every((item) => item.slot.mobileHidden !== true));
});

test("buildFloatingKnowledgeItems uses variant-specific slots", () => {
  const loadingItems = buildFloatingKnowledgeItems(facts, {
    variant: "loading",
    viewport: "desktop",
  });
  const matchingItems = buildFloatingKnowledgeItems(facts, {
    variant: "matching",
    viewport: "desktop",
  });

  assert.notEqual(loadingItems[0]?.slot.id, matchingItems[0]?.slot.id);
  assert.equal(loadingItems[0]?.slot.variant, "loading");
  assert.equal(matchingItems[0]?.slot.variant, "matching");
});

test("buildFloatingKnowledgeItems returns no items for empty facts", () => {
  assert.deepEqual(
    buildFloatingKnowledgeItems([], {
      variant: "loading",
      viewport: "desktop",
    }),
    [],
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --loader ts-node/esm --test src/lib/floating-knowledge-field.test.ts`

Expected: FAIL because `src/lib/floating-knowledge-field.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { LoadingFunFact } from "./loading-fun-facts.ts";

export type FloatingKnowledgeVariant = "loading" | "matching";
export type FloatingKnowledgeViewport = "desktop" | "mobile";
export type FloatingKnowledgeDepth = "near" | "far";

export type FloatingKnowledgeSlot = {
  id: string;
  variant: FloatingKnowledgeVariant;
  depth: FloatingKnowledgeDepth;
  className: string;
  delayMs: number;
  mobileHidden?: boolean;
};

export type FloatingKnowledgeItem = {
  fact: LoadingFunFact;
  slot: FloatingKnowledgeSlot;
};

type BuildFloatingKnowledgeItemsOptions = {
  variant: FloatingKnowledgeVariant;
  viewport: FloatingKnowledgeViewport;
};

const LOADING_SLOTS: FloatingKnowledgeSlot[] = [
  { id: "loading-far-top-left", variant: "loading", depth: "far", className: "floating-knowledge-slot-loading-1", delayMs: 0 },
  { id: "loading-near-top-right", variant: "loading", depth: "near", className: "floating-knowledge-slot-loading-2", delayMs: 140 },
  { id: "loading-far-mid-left", variant: "loading", depth: "far", className: "floating-knowledge-slot-loading-3", delayMs: 280 },
  { id: "loading-near-mid-right", variant: "loading", depth: "near", className: "floating-knowledge-slot-loading-4", delayMs: 420 },
  { id: "loading-far-bottom-left", variant: "loading", depth: "far", className: "floating-knowledge-slot-loading-5", delayMs: 560 },
  { id: "loading-near-bottom-right", variant: "loading", depth: "near", className: "floating-knowledge-slot-loading-6", delayMs: 700 },
  { id: "loading-far-upper-left", variant: "loading", depth: "far", className: "floating-knowledge-slot-loading-7", delayMs: 840, mobileHidden: true },
  { id: "loading-near-lower-right", variant: "loading", depth: "near", className: "floating-knowledge-slot-loading-8", delayMs: 980, mobileHidden: true },
  { id: "loading-far-top-center", variant: "loading", depth: "far", className: "floating-knowledge-slot-loading-9", delayMs: 1120, mobileHidden: true },
];

const MATCHING_SLOTS: FloatingKnowledgeSlot[] = [
  { id: "matching-far-top-left", variant: "matching", depth: "far", className: "floating-knowledge-slot-matching-1", delayMs: 0 },
  { id: "matching-near-top-right", variant: "matching", depth: "near", className: "floating-knowledge-slot-matching-2", delayMs: 120 },
  { id: "matching-near-center-left", variant: "matching", depth: "near", className: "floating-knowledge-slot-matching-3", delayMs: 240 },
  { id: "matching-far-center-right", variant: "matching", depth: "far", className: "floating-knowledge-slot-matching-4", delayMs: 360 },
  { id: "matching-near-bottom-left", variant: "matching", depth: "near", className: "floating-knowledge-slot-matching-5", delayMs: 480 },
  { id: "matching-far-bottom-right", variant: "matching", depth: "far", className: "floating-knowledge-slot-matching-6", delayMs: 600, mobileHidden: true },
  { id: "matching-far-upper-right", variant: "matching", depth: "far", className: "floating-knowledge-slot-matching-7", delayMs: 720, mobileHidden: true },
  { id: "matching-near-lower-left", variant: "matching", depth: "near", className: "floating-knowledge-slot-matching-8", delayMs: 840, mobileHidden: true },
  { id: "matching-far-top-center", variant: "matching", depth: "far", className: "floating-knowledge-slot-matching-9", delayMs: 960, mobileHidden: true },
];

function getSlots(variant: FloatingKnowledgeVariant) {
  return variant === "loading" ? LOADING_SLOTS : MATCHING_SLOTS;
}

export function buildFloatingKnowledgeItems(
  facts: LoadingFunFact[],
  options: BuildFloatingKnowledgeItemsOptions,
): FloatingKnowledgeItem[] {
  if (facts.length === 0) return [];

  const slots = getSlots(options.variant).filter(
    (slot) => options.viewport === "desktop" || !slot.mobileHidden,
  );

  return facts.slice(0, slots.length).map((fact, index) => ({
    fact,
    slot: slots[index],
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --loader ts-node/esm --test src/lib/floating-knowledge-field.test.ts`

Expected: PASS

### Task 2: Shared Floating Component

**Files:**
- Create: `src/components/FloatingKnowledgeField.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Add the React component**

```tsx
import { motion, useReducedMotion } from "motion/react";
import {
  buildFloatingKnowledgeItems,
  type FloatingKnowledgeVariant,
  type FloatingKnowledgeViewport,
} from "../lib/floating-knowledge-field.ts";
import type { LoadingFunFact } from "../lib/loading-fun-facts.ts";

export function FloatingKnowledgeField({
  facts,
  variant,
  className = "",
}: {
  facts: LoadingFunFact[];
  variant: FloatingKnowledgeVariant;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  const desktopItems = buildFloatingKnowledgeItems(facts, {
    variant,
    viewport: "desktop" satisfies FloatingKnowledgeViewport,
  });
  const mobileItems = buildFloatingKnowledgeItems(facts, {
    variant,
    viewport: "mobile" satisfies FloatingKnowledgeViewport,
  });

  if (desktopItems.length === 0) return null;

  return (
    <div
      className={`floating-knowledge-field floating-knowledge-field-${variant} ${className}`.trim()}
      aria-hidden="true"
    >
      {[...desktopItems, ...mobileItems].map((item, index) => {
        const isMobileLayer = index >= desktopItems.length;
        const layerClassName = isMobileLayer
          ? "floating-knowledge-mobile-only"
          : "floating-knowledge-desktop-only";

        return (
          <motion.div
            key={`${layerClassName}-${item.fact.id}-${item.slot.id}`}
            className={[
              "floating-knowledge-capsule",
              `floating-knowledge-capsule-${item.slot.depth}`,
              item.slot.className,
              layerClassName,
            ].join(" ")}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={{
              duration: 0.7,
              delay: item.slot.delayMs / 1000,
              ease: "easeOut",
            }}
          >
            <span>{item.fact.title}</span>
          </motion.div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Add floating field styles**

Add this CSS after the existing loading fun fact styles in `src/index.css`:

```css
.floating-knowledge-field {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.floating-knowledge-capsule {
  position: absolute;
  max-width: min(240px, 38vw);
  border: 1px solid rgba(125, 211, 252, 0.24);
  border-radius: 999px;
  background:
    linear-gradient(135deg, rgba(15, 23, 42, 0.5), rgba(2, 6, 23, 0.34)),
    radial-gradient(circle at 15% 30%, rgba(34, 211, 238, 0.22), transparent 42%);
  box-shadow:
    0 14px 34px rgba(2, 6, 23, 0.34),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  color: rgba(226, 232, 240, 0.86);
  font-size: 11px;
  line-height: 1.45;
  letter-spacing: 0;
  padding: 8px 12px;
  text-wrap: balance;
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  animation: floating-knowledge-drift 8s ease-in-out infinite alternate;
}

.floating-knowledge-capsule-near {
  border-color: rgba(103, 232, 249, 0.34);
  color: rgba(248, 250, 252, 0.9);
  opacity: 0.88;
  animation-duration: 7s;
}

.floating-knowledge-capsule-far {
  transform: scale(0.92);
  opacity: 0.58;
  animation-duration: 11s;
}

.floating-knowledge-mobile-only {
  display: none;
}

.floating-knowledge-slot-loading-1 { top: 10%; left: 7%; transform: rotate(-8deg); }
.floating-knowledge-slot-loading-2 { top: 13%; right: 8%; transform: rotate(7deg); }
.floating-knowledge-slot-loading-3 { top: 43%; left: 5%; transform: rotate(5deg); }
.floating-knowledge-slot-loading-4 { top: 47%; right: 6%; transform: rotate(-6deg); }
.floating-knowledge-slot-loading-5 { bottom: 13%; left: 10%; transform: rotate(8deg); }
.floating-knowledge-slot-loading-6 { bottom: 12%; right: 10%; transform: rotate(-5deg); }
.floating-knowledge-slot-loading-7 { top: 25%; left: 18%; transform: rotate(10deg); }
.floating-knowledge-slot-loading-8 { bottom: 25%; right: 18%; transform: rotate(-10deg); }
.floating-knowledge-slot-loading-9 { top: 7%; left: 42%; transform: rotate(3deg); }

.floating-knowledge-slot-matching-1 { top: 7%; left: 7%; transform: rotate(-7deg); }
.floating-knowledge-slot-matching-2 { top: 10%; right: 7%; transform: rotate(8deg); }
.floating-knowledge-slot-matching-3 { top: 36%; left: 3%; transform: rotate(5deg); }
.floating-knowledge-slot-matching-4 { top: 41%; right: 3%; transform: rotate(-7deg); }
.floating-knowledge-slot-matching-5 { bottom: 16%; left: 8%; transform: rotate(-4deg); }
.floating-knowledge-slot-matching-6 { bottom: 14%; right: 8%; transform: rotate(6deg); }
.floating-knowledge-slot-matching-7 { top: 24%; right: 19%; transform: rotate(-10deg); }
.floating-knowledge-slot-matching-8 { bottom: 29%; left: 18%; transform: rotate(9deg); }
.floating-knowledge-slot-matching-9 { top: 4%; left: 43%; transform: rotate(2deg); }

@keyframes floating-knowledge-drift {
  0% {
    translate: 0 0;
    filter: brightness(0.96);
  }
  50% {
    filter: brightness(1.1);
  }
  100% {
    translate: 10px -12px;
    filter: brightness(1);
  }
}

@media (max-width: 640px) {
  .floating-knowledge-desktop-only {
    display: none;
  }

  .floating-knowledge-mobile-only {
    display: block;
  }

  .floating-knowledge-capsule {
    max-width: min(178px, 44vw);
    padding: 7px 10px;
    font-size: 10px;
    opacity: 0.72;
    animation-duration: 10s;
  }

  .floating-knowledge-slot-loading-1 { top: 8%; left: 4%; }
  .floating-knowledge-slot-loading-2 { top: 12%; right: 4%; }
  .floating-knowledge-slot-loading-3 { top: 34%; left: 2%; }
  .floating-knowledge-slot-loading-4 { top: 59%; right: 2%; }
  .floating-knowledge-slot-loading-5 { bottom: 8%; left: 7%; }

  .floating-knowledge-slot-matching-1 { top: 5%; left: 4%; }
  .floating-knowledge-slot-matching-2 { top: 12%; right: 3%; }
  .floating-knowledge-slot-matching-3 { top: 34%; left: 2%; }
  .floating-knowledge-slot-matching-4 { top: 56%; right: 2%; }
  .floating-knowledge-slot-matching-5 { bottom: 7%; left: 7%; }
}

@media (prefers-reduced-motion: reduce) {
  .floating-knowledge-capsule {
    animation: none;
  }
}
```

- [ ] **Step 3: Run type check**

Run: `npm run lint`

Expected: PASS

### Task 3: Replace Card Usage On Loading Surfaces

**Files:**
- Modify: `src/pages/LoadingPage.tsx`
- Modify: `src/pages/MatchingPage.tsx`

- [ ] **Step 1: Update `LoadingPage`**

Change the imports:

```tsx
import { FloatingKnowledgeField } from "../components/FloatingKnowledgeField";
import { getLoadingFunFacts } from "../lib/loading-fun-facts.ts";
```

Remove:

```tsx
import { LoadingFunFacts } from "../components/LoadingFunFacts";
```

Render the floating field as the first child inside the page root:

```tsx
<FloatingKnowledgeField facts={loadingFunFacts} variant="loading" />
```

Keep the existing centered loading content above the floating field with `relative z-10`.

- [ ] **Step 2: Update `MatchingPage`**

Change the imports:

```tsx
import { FloatingKnowledgeField } from "../components/FloatingKnowledgeField";
import { getLoadingFunFacts } from "../lib/loading-fun-facts.ts";
```

Remove:

```tsx
import { LoadingFunFacts } from "../components/LoadingFunFacts";
```

Update the root motion wrapper class to include `relative overflow-hidden px-4`, then render:

```tsx
<FloatingKnowledgeField facts={matchingFunFacts} variant="matching" />
```

Keep the radar, status, and tag list in `relative z-10` wrappers so the floating layer stays behind readable content.

- [ ] **Step 3: Run focused tests**

Run: `node --loader ts-node/esm --test src/lib/loading-fun-facts.test.ts src/lib/floating-knowledge-field.test.ts`

Expected: PASS

- [ ] **Step 4: Run final verification**

Run: `npm run lint`

Expected: PASS

Run: `npm run build`

Expected: PASS
