# Loading Fun Facts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为推荐匹配页和装备库加载页增加自动轮播的中文趣味知识卡，在不影响现有加载流程的前提下降低等待感。

**Architecture:** 新增一个轻量知识数据模块，负责按场景提供趣味知识列表，并暴露一个可测试的轮播索引辅助函数。新增一个可复用展示组件处理定时轮播和过渡动画，再分别接入 `MatchingPage` 与 `LoadingPage`，样式延续现有玻璃拟态与青蓝科幻风格。

**Tech Stack:** React 19, TypeScript, motion/react, Tailwind CSS 4, Node test runner

---

### Task 1: 趣味知识数据与轮播辅助逻辑

**Files:**
- Create: `src/lib/loading-fun-facts.ts`
- Test: `src/lib/loading-fun-facts.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  getLoadingFunFacts,
  getNextLoadingFunFactIndex,
} from "./loading-fun-facts.ts";

test("getLoadingFunFacts returns matching-specific facts", () => {
  const facts = getLoadingFunFacts("matching");
  assert.ok(facts.length >= 4);
  assert.ok(facts.every((fact) => fact.surfaces.includes("matching")));
});

test("getLoadingFunFacts returns loading-specific facts", () => {
  const facts = getLoadingFunFacts("loading");
  assert.ok(facts.length >= 4);
  assert.ok(facts.every((fact) => fact.surfaces.includes("loading")));
});

test("getNextLoadingFunFactIndex wraps around safely", () => {
  assert.equal(getNextLoadingFunFactIndex(0, 0), 0);
  assert.equal(getNextLoadingFunFactIndex(0, 1), 0);
  assert.equal(getNextLoadingFunFactIndex(0, 3), 1);
  assert.equal(getNextLoadingFunFactIndex(2, 3), 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --loader ts-node/esm --test src/lib/loading-fun-facts.test.ts`
Expected: FAIL because `src/lib/loading-fun-facts.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export type LoadingFunFactSurface = "matching" | "loading";

export type LoadingFunFact = {
  id: string;
  title: string;
  description: string;
  surfaces: LoadingFunFactSurface[];
};

const LOADING_FUN_FACTS: LoadingFunFact[] = [
  {
    id: "matching-angle",
    title: "角度比蛮力更重要",
    description: "体感强弱不只看参数，接触角度、贴合区域和节奏变化通常更影响实际体验。",
    surfaces: ["matching"],
  },
];

export function getLoadingFunFacts(
  surface: LoadingFunFactSurface,
): LoadingFunFact[] {
  return LOADING_FUN_FACTS.filter((fact) => fact.surfaces.includes(surface));
}

export function getNextLoadingFunFactIndex(
  currentIndex: number,
  total: number,
): number {
  if (total <= 1) {
    return 0;
  }

  return (currentIndex + 1) % total;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --loader ts-node/esm --test src/lib/loading-fun-facts.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/loading-fun-facts.ts src/lib/loading-fun-facts.test.ts
git commit -m "feat: add loading fun fact data helpers"
```

### Task 2: 可复用趣味知识轮播组件

**Files:**
- Create: `src/components/LoadingFunFacts.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Add the reusable UI component**

```tsx
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  getNextLoadingFunFactIndex,
  type LoadingFunFact,
} from "../lib/loading-fun-facts.ts";

export function LoadingFunFacts({ facts }: { facts: LoadingFunFact[] }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [facts]);

  useEffect(() => {
    if (facts.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((currentIndex) =>
        getNextLoadingFunFactIndex(currentIndex, facts.length),
      );
    }, 3600);

    return () => window.clearInterval(timer);
  }, [facts]);

  const activeFact = facts[activeIndex];
  if (!activeFact) return null;

  return <div className="loading-fun-fact-card">{activeFact.title}</div>;
}
```

- [ ] **Step 2: Add stable card styling**

```css
.loading-fun-fact-card {
  min-height: 148px;
}
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/LoadingFunFacts.tsx src/index.css
git commit -m "feat: add reusable loading fun facts carousel"
```

### Task 3: 接入推荐匹配页与装备库加载页

**Files:**
- Modify: `src/pages/MatchingPage.tsx`
- Modify: `src/pages/LoadingPage.tsx`

- [ ] **Step 1: Wire fun facts into MatchingPage**

```tsx
import { LoadingFunFacts } from "../components/LoadingFunFacts";
import { getLoadingFunFacts } from "../lib/loading-fun-facts.ts";

const matchingFacts = getLoadingFunFacts("matching");
```

- [ ] **Step 2: Wire fun facts into LoadingPage**

```tsx
import { LoadingFunFacts } from "../components/LoadingFunFacts";
import { getLoadingFunFacts } from "../lib/loading-fun-facts.ts";

const loadingFacts = getLoadingFunFacts("loading");
```

- [ ] **Step 3: Run focused tests and production build**

Run: `node --loader ts-node/esm --test src/lib/loading-fun-facts.test.ts`
Expected: PASS

Run: `npx tsc --noEmit`
Expected: PASS

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/pages/MatchingPage.tsx src/pages/LoadingPage.tsx
git commit -m "feat: show rotating fun facts on loading screens"
```
