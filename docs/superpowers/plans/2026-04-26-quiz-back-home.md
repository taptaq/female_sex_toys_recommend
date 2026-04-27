# Quiz Back Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a left-top back-to-home button to the quiz flow that clears the in-progress quiz session and returns the user to the home page.

**Architecture:** Extract the cleared quiz-session payload into a tiny helper so it can be tested with `node:test` first, then wire a dedicated `handleBackHomeFromQuiz` callback through `App` into `QuizPage`. Keep the UI scoped to the quiz page and keep the existing “重新校准/重新开始” behavior unchanged.

**Tech Stack:** React 19, TypeScript, lucide-react, node:test, Vite

---

### File Map

**Create:**
- `src/lib/quiz-session.ts` — helper that returns a cleared quiz-session state
- `src/lib/quiz-session.test.ts` — focused test for the cleared quiz-session state

**Modify:**
- `src/App.tsx` — use the helper in a new back-home handler and pass the callback to the quiz page
- `src/pages/QuizPage.tsx` — render the left-top back-home button

### Task 1: Add Failing Test For Cleared Quiz Session State

**Files:**
- Create: `src/lib/quiz-session.test.ts`
- Test: `src/lib/quiz-session.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { createClearedQuizSessionState } from "./quiz-session.ts";

test("createClearedQuizSessionState resets quiz progress and recommendations", () => {
  assert.deepEqual(createClearedQuizSessionState(), {
    step: -1,
    answers: { tags: [] },
    topProducts: [],
    backupProducts: [],
    recommendationTips: [],
    shoppingGuidance: [],
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --loader ts-node/esm --test src/lib/quiz-session.test.ts`
Expected: FAIL because `src/lib/quiz-session.ts` does not exist yet

- [ ] **Step 3: Commit**

```bash
git add src/lib/quiz-session.test.ts
git commit -m "test: cover cleared quiz session state"
```

### Task 2: Implement The Cleared Session Helper

**Files:**
- Create: `src/lib/quiz-session.ts`
- Test: `src/lib/quiz-session.test.ts`

- [ ] **Step 1: Write minimal implementation**

```ts
export function createClearedQuizSessionState() {
  return {
    step: -1,
    answers: { tags: [] as string[] },
    topProducts: [],
    backupProducts: [],
    recommendationTips: [],
    shoppingGuidance: [],
  };
}
```

- [ ] **Step 2: Run test to verify it passes**

Run: `node --loader ts-node/esm --test src/lib/quiz-session.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/quiz-session.ts src/lib/quiz-session.test.ts
git commit -m "feat: add cleared quiz session helper"
```

### Task 3: Wire The Button Into The Quiz Flow

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/pages/QuizPage.tsx`
- Test: `src/lib/quiz-session.test.ts`

- [ ] **Step 1: Add the dedicated back-home handler in `App`**

```ts
import { createClearedQuizSessionState } from "./lib/quiz-session";

const handleBackHomeFromQuiz = () => {
  const clearedState = createClearedQuizSessionState();
  setStep(clearedState.step);
  setAnswers(clearedState.answers);
  setTopProducts(clearedState.topProducts);
  setBackupProducts(clearedState.backupProducts);
  setRecommendationTips(clearedState.recommendationTips);
  setShoppingGuidance(clearedState.shoppingGuidance);
  navigateTo("/");
};
```

- [ ] **Step 2: Pass the callback and render the left-top button in `QuizPage`**

```tsx
import { ArrowLeft, CircleDashed, Hexagon, Triangle } from "lucide-react";

<div className="mb-4 px-2">
  <button
    type="button"
    onClick={onBackHome}
    className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-200 transition-colors hover:border-cyan-400/40 hover:bg-cyan-500/15 hover:text-white"
  >
    <ArrowLeft className="h-3.5 w-3.5" />
    <span>返回首页</span>
  </button>
</div>
```

- [ ] **Step 3: Run verification**

Run: `node --loader ts-node/esm --test src/lib/quiz-session.test.ts`
Expected: PASS

Run: `npx tsc --noEmit`
Expected: PASS

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/pages/QuizPage.tsx
git commit -m "feat: add quiz back-home button"
```
