# Female Mobile MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first women-focused cute astronaut MVP experience while preserving hidden legacy modules for later reactivation.

**Architecture:** Add a small app-mode layer that defaults the product to female MVP and gates visible navigation, quiz branches, and recommendation candidates. Replace the main mobile surface with a cream-pink astronaut style, then add a focused GSAP animation layer that respects reduced motion. Keep route components, scraper code, DB scripts, and heavy modules in the repository.

**Tech Stack:** React 19, Vite, TypeScript, Tailwind CSS 4, existing `motion/react`, new `gsap`, Node test runner, existing app-shell/recommendation modules.

---

## File Structure

- Create `src/lib/app-mode.ts`: single source of truth for female MVP mode, visible navigation gates, default audience, and product eligibility.
- Create `src/lib/app-mode.test.ts`: focused tests for hidden modules, default answers, and product eligibility.
- Modify `src/data/mock.ts`: expose a female-only question flow and keep the old multi-audience `questionFlows` unchanged for tests and future reuse.
- Modify `src/App.tsx`: initialize answers with female defaults, use female-only active questions, and pass MVP mode into result/library decisions where needed.
- Modify `src/lib/app-result-flow.ts`: apply female MVP product filtering before ranking.
- Modify `src/lib/recommendation-local-ranking.test.ts`: prove male-only products cannot surface in MVP ranking.
- Create `src/components/CuteAstronaut.tsx`: reusable code-native mascot used by home and matching.
- Create `src/components/CuteAstronaut.test.tsx`: static-render tests for accessible/hidden mascot behavior.
- Create `src/lib/gsap-motion.ts`: small helpers for reduced-motion safe GSAP timeline setup.
- Create `src/lib/gsap-motion.test.ts`: pure tests for animation gating helpers.
- Modify `src/pages/HomePage.tsx`: replace default home presentation with mobile-first female MVP home and hide heavy entries.
- Modify `src/pages/HomePage.test.tsx`: update home assertions to expect one primary CTA and no heavy module links.
- Modify `src/pages/QuizPage.tsx`: restyle as mobile-first cream/pink question cards and add GSAP transition refs.
- Modify `src/pages/QuizPage.test.tsx`: update static output expectations for female MVP copy and reduced heavy-space language.
- Modify `src/pages/MatchingPage.tsx`: replace radar/deep-space loading with cute astronaut matching ritual.
- Modify `src/pages/ResultsPage.tsx`: hide body persona and knowledge nebula calls from MVP-visible result surface, restyle top hierarchy for mobile.
- Modify `src/pages/ResultsPage.test.tsx`: assert hidden knowledge/body-persona/profile surfaces and female-focused result framing.
- Modify `src/index.css`: add female MVP theme variables, mobile surfaces, astronaut CSS, GSAP target classes, and reduced-motion fallbacks.
- Modify `package.json` and lockfile: add `gsap`.

## Task 1: App Mode And Female Eligibility

**Files:**
- Create: `src/lib/app-mode.ts`
- Create: `src/lib/app-mode.test.ts`
- Modify: `src/data/mock.ts`

- [ ] **Step 1: Write failing app-mode tests**

Create `src/lib/app-mode.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import type { Product } from "../data/mock.ts";
import {
  APP_MODE,
  DEFAULT_MVP_ANSWERS,
  canShowMvpEntry,
  isFemaleMvpEligibleProduct,
  shouldUseFemaleMvp,
} from "./app-mode.ts";

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: overrides.id ?? "p1",
    name: overrides.name ?? "Test Product",
    price: overrides.price ?? 199,
    maxDb: overrides.maxDb ?? 45,
    waterproof: overrides.waterproof ?? 7,
    appearance: overrides.appearance ?? "normal",
    physicalForm: overrides.physicalForm ?? "external",
    motorType: overrides.motorType ?? "gentle",
    gender: overrides.gender ?? "female",
    typeCode: overrides.typeCode ?? "suction",
    subtypeCode: overrides.subtypeCode ?? "clitoral_suction",
    brand: overrides.brand ?? "Brand",
    material: overrides.material ?? "Silicone",
    imagePlaceholder: overrides.imagePlaceholder ?? "",
    rawDescription: overrides.rawDescription ?? null,
    tags: overrides.tags ?? [],
  };
}

test("female MVP mode is enabled by default with female answers", () => {
  assert.equal(APP_MODE, "female-mvp");
  assert.equal(shouldUseFemaleMvp(), true);
  assert.deepEqual(DEFAULT_MVP_ANSWERS, {
    gender: "female",
    tags: ["女性向"],
  });
});

test("female MVP hides heavy navigation entries from the main product surface", () => {
  assert.equal(canShowMvpEntry("start-match"), true);
  assert.equal(canShowMvpEntry("favorites"), true);
  assert.equal(canShowMvpEntry("library"), false);
  assert.equal(canShowMvpEntry("knowledge"), false);
  assert.equal(canShowMvpEntry("profiles"), false);
  assert.equal(canShowMvpEntry("body-persona"), false);
  assert.equal(canShowMvpEntry("theme-switcher"), false);
});

test("female MVP product eligibility excludes male-only products", () => {
  assert.equal(isFemaleMvpEligibleProduct(makeProduct({ gender: "female" })), true);
  assert.equal(
    isFemaleMvpEligibleProduct(
      makeProduct({
        gender: "unisex",
        rawDescription: "适合女性外部刺激和单人探索。",
        tags: ["女性向", "外部刺激"],
      }),
    ),
    true,
  );
  assert.equal(isFemaleMvpEligibleProduct(makeProduct({ gender: "male" })), false);
});

test("female MVP does not include male-coded unisex products", () => {
  assert.equal(
    isFemaleMvpEligibleProduct(
      makeProduct({
        gender: "unisex",
        rawDescription: "男性飞机杯互动设备，适合男士。",
        tags: ["男性向"],
      }),
    ),
    false,
  );
});
```

- [ ] **Step 2: Run the failing app-mode tests**

Run: `npx tsx --test src/lib/app-mode.test.ts`

Expected: FAIL with a module-not-found error for `./app-mode.ts`.

- [ ] **Step 3: Implement app-mode**

Create `src/lib/app-mode.ts`:

```ts
import type { AnswerState, Product } from "../data/mock.ts";

export const APP_MODE = "female-mvp" as const;

export type AppMode = typeof APP_MODE;
export type MvpEntry =
  | "start-match"
  | "favorites"
  | "library"
  | "knowledge"
  | "profiles"
  | "body-persona"
  | "theme-switcher";

export const DEFAULT_MVP_ANSWERS: AnswerState = {
  gender: "female",
  tags: ["女性向"],
};

const VISIBLE_MVP_ENTRIES = new Set<MvpEntry>(["start-match", "favorites"]);
const FEMALE_SIGNALS = /女性|女生|女用|她|阴蒂|外部|吸吮|吮吸|跳蛋|震动棒|按摩棒|G点|盆底|凯格尔/i;
const MALE_ONLY_SIGNALS = /男性|男士|飞机杯|阴茎|前列腺|龟头|锁精|阴茎环/i;

export function shouldUseFemaleMvp(mode: AppMode = APP_MODE) {
  return mode === "female-mvp";
}

export function canShowMvpEntry(entry: MvpEntry, mode: AppMode = APP_MODE) {
  if (!shouldUseFemaleMvp(mode)) {
    return true;
  }

  return VISIBLE_MVP_ENTRIES.has(entry);
}

export function isFemaleMvpEligibleProduct(product: Product) {
  if (product.gender === "female") {
    return true;
  }

  if (product.gender === "male") {
    return false;
  }

  const text = [
    product.name,
    product.displayName,
    product.safeDisplayName,
    product.canonicalName,
    product.rawDescription,
    ...(product.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ");

  if (MALE_ONLY_SIGNALS.test(text)) {
    return false;
  }

  return FEMALE_SIGNALS.test(text);
}

export function filterFemaleMvpProducts(products: Product[]) {
  return products.filter(isFemaleMvpEligibleProduct);
}
```

- [ ] **Step 4: Expose female-only question flow**

Modify the bottom of `src/data/mock.ts` to add `femaleMvpQuestionFlow` and update `getActiveQuestions`:

```ts
export const questionFlows: Record<AudienceGender, Question[]> = {
  female: [OPENING_QUESTION, ...FEMALE_QUESTIONS],
  male: [OPENING_QUESTION, ...MALE_QUESTIONS],
  unisex: [OPENING_QUESTION, ...COUPLE_QUESTIONS],
};

export const femaleMvpQuestionFlow: Question[] = FEMALE_QUESTIONS;

export function getActiveQuestions(gender?: AudienceGender): Question[] {
  if (!gender) {
    return [OPENING_QUESTION];
  }

  return questionFlows[gender];
}
```

- [ ] **Step 5: Run app-mode tests**

Run: `npx tsx --test src/lib/app-mode.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit app-mode foundation**

```bash
git add src/lib/app-mode.ts src/lib/app-mode.test.ts src/data/mock.ts
git commit -m "feat: add female mvp app mode"
```

## Task 2: Female MVP Flow Wiring

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/lib/app-result-flow.ts`
- Modify: `src/lib/recommendation-local-ranking.test.ts`

- [ ] **Step 1: Add failing recommendation test for MVP filtering**

Append to `src/lib/recommendation-local-ranking.test.ts`:

```ts
test("female MVP result computation filters male-only products before ranking", async () => {
  const { buildLocalResultComputation } = await import("./app-result-flow.ts");

  const answers: AnswerState = {
    gender: "female",
    physicalForm: "external",
    motorType: "gentle",
    maxDb: 50,
    waterproof: 7,
    budget: [100, 300],
    appearance: "normal",
    tags: ["女性向"],
  };

  const result = buildLocalResultComputation(answers, [
    makeProduct({
      id: "female-good",
      gender: "female",
      name: "Female Good",
      rawDescription: "女性外部刺激，温和安静。",
    }),
    makeProduct({
      id: "male-only",
      gender: "male",
      name: "Male Only",
      rawDescription: "男性飞机杯。",
    }),
  ]);

  assert.deepEqual(
    result.rankedCandidates.map((product) => product.id),
    ["female-good"],
  );
});
```

- [ ] **Step 2: Run failing recommendation test**

Run: `npx tsx --test src/lib/recommendation-local-ranking.test.ts`

Expected: FAIL because `male-only` is still present in candidate results or affects filtered counts.

- [ ] **Step 3: Filter products in local result computation**

Modify `src/lib/app-result-flow.ts` imports:

```ts
import { filterFemaleMvpProducts, shouldUseFemaleMvp } from "./app-mode.ts";
```

Modify `buildLocalResultComputation` before calling `buildLocalRecommendationRanking`:

```ts
  const eligibleProducts = shouldUseFemaleMvp()
    ? filterFemaleMvpProducts(productsData)
    : productsData;
  const localRanking = buildLocalRecommendationRanking(
    currentAnswers,
    eligibleProducts,
    {
      rerankPoolSize: AI_RERANK_POOL_SIZE,
      finalSelectionCount: FINAL_SELECTION_COUNT,
      context,
    },
  );
```

- [ ] **Step 4: Wire App default answers and active questions**

Modify imports in `src/App.tsx`:

```ts
import { femaleMvpQuestionFlow, getActiveQuestions, AnswerState, Product, Question } from "./data/mock.ts";
import { DEFAULT_MVP_ANSWERS, shouldUseFemaleMvp } from "./lib/app-mode";
```

Modify the initial answers state to start with female MVP defaults. Locate the `useState<AnswerState>` for `answers` and use:

```ts
  const [answers, setAnswers] = useState<AnswerState>(() => ({
    ...DEFAULT_MVP_ANSWERS,
    ...(persistedState.answers ?? {}),
    gender: shouldUseFemaleMvp()
      ? DEFAULT_MVP_ANSWERS.gender
      : persistedState.answers?.gender,
    tags: Array.from(
      new Set([
        ...DEFAULT_MVP_ANSWERS.tags,
        ...(persistedState.answers?.tags ?? []),
      ]),
    ),
  }));
```

Modify active question selection:

```ts
  const activeQuestions: Question[] = shouldUseFemaleMvp()
    ? femaleMvpQuestionFlow
    : getActiveQuestions(answers.gender);
```

When code calls `getActiveQuestions(mergedAnswers.gender)` to decide completion for quiz flows, use:

```ts
      const targetQuestions = shouldUseFemaleMvp()
        ? femaleMvpQuestionFlow
        : getActiveQuestions(mergedAnswers.gender);
```

Use `targetQuestions.length` where the old expression used `getActiveQuestions(mergedAnswers.gender).length`.

- [ ] **Step 5: Run flow and recommendation tests**

Run:

```bash
npx tsx --test src/lib/app-mode.test.ts src/lib/recommendation-local-ranking.test.ts src/pages/QuizPage.test.tsx
```

Expected: PASS or only static copy failures in `QuizPage.test.tsx` that will be handled in Task 5.

- [ ] **Step 6: Commit MVP flow wiring**

```bash
git add src/App.tsx src/lib/app-result-flow.ts src/lib/recommendation-local-ranking.test.ts
git commit -m "feat: default app flow to female mvp"
```

## Task 3: Add GSAP Dependency And Motion Helpers

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/lib/gsap-motion.ts`
- Create: `src/lib/gsap-motion.test.ts`

- [ ] **Step 1: Install GSAP**

Run: `npm install gsap`

Expected: `package.json` and `package-lock.json` include `gsap`.

- [ ] **Step 2: Write motion helper tests**

Create `src/lib/gsap-motion.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  getGsapDuration,
  shouldRunGsapMotion,
} from "./gsap-motion.ts";

test("GSAP motion is disabled when reduced motion is requested", () => {
  assert.equal(shouldRunGsapMotion({ shouldAnimate: true, prefersReducedMotion: true }), false);
  assert.equal(getGsapDuration(0.8, { shouldAnimate: true, prefersReducedMotion: true }), 0);
});

test("GSAP motion is disabled when page animation is paused", () => {
  assert.equal(shouldRunGsapMotion({ shouldAnimate: false, prefersReducedMotion: false }), false);
  assert.equal(getGsapDuration(0.8, { shouldAnimate: false, prefersReducedMotion: false }), 0);
});

test("GSAP motion keeps requested duration only when animation is allowed", () => {
  assert.equal(shouldRunGsapMotion({ shouldAnimate: true, prefersReducedMotion: false }), true);
  assert.equal(getGsapDuration(0.8, { shouldAnimate: true, prefersReducedMotion: false }), 0.8);
});
```

- [ ] **Step 3: Run failing helper tests**

Run: `npx tsx --test src/lib/gsap-motion.test.ts`

Expected: FAIL with module-not-found error for `./gsap-motion.ts`.

- [ ] **Step 4: Implement motion helpers**

Create `src/lib/gsap-motion.ts`:

```ts
export type GsapMotionState = {
  shouldAnimate: boolean;
  prefersReducedMotion: boolean;
};

export function shouldRunGsapMotion({
  shouldAnimate,
  prefersReducedMotion,
}: GsapMotionState) {
  return shouldAnimate && !prefersReducedMotion;
}

export function getGsapDuration(
  duration: number,
  motionState: GsapMotionState,
) {
  return shouldRunGsapMotion(motionState) ? duration : 0;
}
```

- [ ] **Step 5: Run helper tests**

Run: `npx tsx --test src/lib/gsap-motion.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit GSAP setup**

```bash
git add package.json package-lock.json src/lib/gsap-motion.ts src/lib/gsap-motion.test.ts
git commit -m "feat: add gsap motion helpers"
```

## Task 4: Cute Astronaut Component

**Files:**
- Create: `src/components/CuteAstronaut.tsx`
- Create: `src/components/CuteAstronaut.test.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Write astronaut tests**

Create `src/components/CuteAstronaut.test.tsx`:

```tsx
import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { CuteAstronaut } from "./CuteAstronaut.tsx";

test("cute astronaut renders decorative mascot by default", () => {
  const html = renderToStaticMarkup(<CuteAstronaut />);

  assert.match(html, /cute-astronaut/);
  assert.match(html, /aria-hidden="true"/);
  assert.doesNotMatch(html, /role="img"/);
});

test("cute astronaut can expose an accessible label", () => {
  const html = renderToStaticMarkup(<CuteAstronaut label="Luna 小宇航员" />);

  assert.match(html, /role="img"/);
  assert.match(html, /aria-label="Luna 小宇航员"/);
});
```

- [ ] **Step 2: Run failing astronaut tests**

Run: `npx tsx --test src/components/CuteAstronaut.test.tsx`

Expected: FAIL with module-not-found error for `./CuteAstronaut.tsx`.

- [ ] **Step 3: Implement CuteAstronaut**

Create `src/components/CuteAstronaut.tsx`:

```tsx
type CuteAstronautProps = {
  className?: string;
  label?: string;
};

export function CuteAstronaut({ className = "", label }: CuteAstronautProps) {
  const accessibilityProps = label
    ? { role: "img", "aria-label": label }
    : { "aria-hidden": true };

  return (
    <div className={["cute-astronaut", className].filter(Boolean).join(" ")} {...accessibilityProps}>
      <div className="cute-astronaut__bubble cute-astronaut__bubble-a" />
      <div className="cute-astronaut__bubble cute-astronaut__bubble-b" />
      <div className="cute-astronaut__helmet">
        <div className="cute-astronaut__face">
          <span className="cute-astronaut__eye" />
          <span className="cute-astronaut__eye" />
          <span className="cute-astronaut__smile" />
        </div>
      </div>
      <div className="cute-astronaut__body">
        <span className="cute-astronaut__badge" />
      </div>
      <span className="cute-astronaut__arm cute-astronaut__arm-left" />
      <span className="cute-astronaut__arm cute-astronaut__arm-right" />
      <span className="cute-astronaut__leg cute-astronaut__leg-left" />
      <span className="cute-astronaut__leg cute-astronaut__leg-right" />
      <div className="cute-astronaut__star cute-astronaut__star-a" />
      <div className="cute-astronaut__star cute-astronaut__star-b" />
    </div>
  );
}
```

- [ ] **Step 4: Add astronaut CSS**

Append to `src/index.css`:

```css
.cute-astronaut {
  position: relative;
  width: min(46vw, 11rem);
  aspect-ratio: 1;
  transform-origin: 50% 55%;
}

.cute-astronaut__helmet {
  position: absolute;
  left: 22%;
  top: 9%;
  width: 56%;
  height: 52%;
  border: 0.22rem solid #f8a9c5;
  border-radius: 999px;
  background: radial-gradient(circle at 36% 24%, #ffffff 0 18%, #ffe4ee 19% 100%);
  box-shadow: 0 1.2rem 2.8rem rgba(255, 122, 164, 0.22);
}

.cute-astronaut__face {
  position: absolute;
  left: 18%;
  top: 31%;
  width: 64%;
  height: 38%;
  border-radius: 999px;
  background: #59465b;
}

.cute-astronaut__eye {
  position: absolute;
  top: 36%;
  width: 0.36rem;
  height: 0.36rem;
  border-radius: 999px;
  background: #fff7fb;
}

.cute-astronaut__eye:first-child {
  left: 30%;
}

.cute-astronaut__eye:nth-child(2) {
  right: 30%;
}

.cute-astronaut__smile {
  position: absolute;
  left: 42%;
  bottom: 22%;
  width: 16%;
  height: 0.18rem;
  border-radius: 999px;
  background: #ffc7dc;
}

.cute-astronaut__body {
  position: absolute;
  left: 30%;
  top: 55%;
  width: 40%;
  height: 31%;
  border-radius: 1.4rem 1.4rem 1.1rem 1.1rem;
  background: linear-gradient(180deg, #ffffff, #ffe9f1);
  border: 0.18rem solid #f8a9c5;
}

.cute-astronaut__badge {
  position: absolute;
  left: 50%;
  top: 31%;
  width: 0.72rem;
  height: 0.72rem;
  transform: translateX(-50%);
  border-radius: 999px;
  background: #8fd3ff;
  box-shadow: 0 0 0 0.24rem rgba(143, 211, 255, 0.2);
}

.cute-astronaut__arm,
.cute-astronaut__leg {
  position: absolute;
  border-radius: 999px;
  background: #fff7fb;
  border: 0.16rem solid #f8a9c5;
}

.cute-astronaut__arm {
  top: 59%;
  width: 18%;
  height: 12%;
}

.cute-astronaut__arm-left {
  left: 15%;
  transform: rotate(-22deg);
}

.cute-astronaut__arm-right {
  right: 15%;
  transform: rotate(22deg);
}

.cute-astronaut__leg {
  top: 81%;
  width: 15%;
  height: 10%;
}

.cute-astronaut__leg-left {
  left: 34%;
}

.cute-astronaut__leg-right {
  right: 34%;
}

.cute-astronaut__bubble,
.cute-astronaut__star {
  position: absolute;
  border-radius: 999px;
  pointer-events: none;
}

.cute-astronaut__bubble-a {
  right: 4%;
  top: 15%;
  width: 0.62rem;
  height: 0.62rem;
  background: #8fd3ff;
}

.cute-astronaut__bubble-b {
  left: 8%;
  bottom: 18%;
  width: 0.48rem;
  height: 0.48rem;
  background: #ffc7dc;
}

.cute-astronaut__star {
  width: 0.42rem;
  height: 0.42rem;
  background: #ffd66b;
  box-shadow: 0 0 1.4rem rgba(255, 214, 107, 0.45);
}

.cute-astronaut__star-a {
  left: 6%;
  top: 8%;
}

.cute-astronaut__star-b {
  right: 10%;
  bottom: 8%;
}
```

- [ ] **Step 5: Run astronaut tests**

Run: `npx tsx --test src/components/CuteAstronaut.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit mascot component**

```bash
git add src/components/CuteAstronaut.tsx src/components/CuteAstronaut.test.tsx src/index.css
git commit -m "feat: add cute astronaut mascot"
```

## Task 5: Mobile Female MVP Home

**Files:**
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/pages/HomePage.test.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Replace home test expectations**

Replace the first home page test in `src/pages/HomePage.test.tsx` with:

```ts
test("female MVP home exposes one clear mobile matching path", () => {
  const html = renderHomePage();

  assert.match(html, /Luna 小宇航员/);
  assert.match(html, /找到适合你的第一颗小星球/);
  assert.match(html, /开始匹配/);
  assert.match(html, /3 分钟轻问答/);
  assert.match(html, /女性向/);
  assert.doesNotMatch(html, /还没准备开始，也可以先快速看看/);
  assert.doesNotMatch(html, /装备库/);
  assert.doesNotMatch(html, /知识星云/);
  assert.doesNotMatch(html, /匹配档案/);
  assert.doesNotMatch(html, /SELECTION GUIDE/);
});
```

Replace the auth consolidation test with:

```ts
test("female MVP home keeps privacy reassurance without login pressure", () => {
  const html = renderHomePage();

  assert.match(html, /本地先体验/);
  assert.match(html, /隐私友好/);
  assert.doesNotMatch(html, /登录后可加密保存推荐档案，支持多端同步，也可随时删除/);
  assert.doesNotMatch(html, /登录 \/ 注册/);
  assert.doesNotMatch(html, /placeholder="用户名"/);
  assert.doesNotMatch(html, /placeholder="密码"/);
});
```

- [ ] **Step 2: Run failing home tests**

Run: `npx tsx --test src/pages/HomePage.test.tsx`

Expected: FAIL because the old home still renders deep-space copy and heavy entries.

- [ ] **Step 3: Import mode and astronaut in HomePage**

Modify imports in `src/pages/HomePage.tsx`:

```ts
import { CuteAstronaut } from "../components/CuteAstronaut.tsx";
import { canShowMvpEntry, shouldUseFemaleMvp } from "../lib/app-mode.ts";
```

- [ ] **Step 4: Add female MVP branch in HomePage render**

Inside `HomePage`, before the existing deep-space JSX return, add:

```tsx
  if (shouldUseFemaleMvp()) {
    return (
      <motion.div
        key="female-mvp-home"
        variants={pageVariants}
        initial={false}
        animate="in"
        exit="out"
        className={[
          "female-mvp-home relative left-1/2 min-h-[100svh] w-screen -translate-x-1/2 overflow-hidden px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-6",
          shouldAnimate ? "" : "ambient-motion-paused",
        ].join(" ")}
      >
        <div className="female-mvp-stars" aria-hidden="true" />
        <header className="relative z-10 flex items-center justify-between">
          <span className="rounded-full bg-white/72 px-3 py-1.5 text-xs font-semibold text-rose-500 shadow-sm">
            Luna 小宇航员
          </span>
          {canShowMvpEntry("favorites") ? (
            <button
              type="button"
              onClick={onOpenFavorites}
              className="rounded-full border border-rose-100 bg-white/70 px-3 py-1.5 text-xs font-semibold text-[#6d5361] shadow-sm"
            >
              收藏
            </button>
          ) : null}
        </header>

        <main className="relative z-10 flex min-h-[calc(100svh-5rem)] flex-col justify-between">
          <section className="pt-8">
            <div className="mx-auto mb-5 flex justify-center">
              <CuteAstronaut label="Luna 小宇航员" className="female-mvp-astronaut" />
            </div>
            <p className="mb-3 text-sm font-semibold text-rose-500">女性向 · 萌系宇航员推荐舱</p>
            <h1 className="max-w-[19rem] text-[2.35rem] font-black leading-[1.04] text-[#342936]">
              找到适合你的第一颗小星球
            </h1>
            <p className="mt-4 max-w-[20rem] text-[0.95rem] leading-7 text-[#7d6574]">
              3 分钟轻问答，从新手友好、静音隐私、清洁安全和预算出发，帮你缩小选择范围。
            </p>
          </section>

          <section className="pb-2">
            <div className="mb-4 grid grid-cols-3 gap-2">
              {["本地先体验", "隐私友好", "女性向"].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/70 bg-white/62 px-2.5 py-3 text-center text-xs font-semibold text-[#765d6c] shadow-sm"
                >
                  {item}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={onStart}
              className="female-mvp-primary-button w-full rounded-[1.35rem] bg-[#ff6f9f] px-5 py-4 text-base font-black text-white shadow-[0_1rem_2.2rem_rgba(255,111,159,0.28)]"
            >
              开始匹配
            </button>
          </section>
        </main>

        <HomeFeedbackModal
          isOpen={isFeedbackModalOpen}
          message={feedbackMessage}
          screenshotPreviews={feedbackScreenshotPreviews}
          isSubmitting={isFeedbackSubmitting}
          submitError={feedbackSubmitError}
          submitSuccess={feedbackSubmitSuccess}
          onMessageChange={(message) => {
            clearFeedbackCloseTimeout();
            setFeedbackMessage(message);
            setFeedbackSubmitError(null);
            setFeedbackSubmitSuccess(null);
          }}
          onFileSelect={handleFeedbackFileSelect}
          onRemoveScreenshot={handleFeedbackScreenshotRemove}
          onClose={closeFeedbackModal}
          onSubmit={handleFeedbackSubmit}
        />
      </motion.div>
    );
  }
```

- [ ] **Step 5: Add female MVP home CSS**

Append to `src/index.css`:

```css
.female-mvp-home {
  background:
    radial-gradient(circle at 78% 14%, rgba(143, 211, 255, 0.42), transparent 22rem),
    radial-gradient(circle at 12% 28%, rgba(255, 199, 220, 0.58), transparent 18rem),
    linear-gradient(155deg, #fff9fb 0%, #fff0f5 48%, #eef8ff 100%);
  color: #342936;
}

.female-mvp-stars {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    radial-gradient(circle, rgba(255, 111, 159, 0.22) 0 1px, transparent 1.5px),
    radial-gradient(circle, rgba(90, 180, 235, 0.2) 0 1px, transparent 1.5px);
  background-position: 16px 24px, 82px 118px;
  background-size: 110px 110px, 168px 168px;
  mask-image: linear-gradient(180deg, #000 0%, transparent 92%);
}

.female-mvp-astronaut {
  width: min(58vw, 12.25rem);
}

.female-mvp-primary-button {
  min-height: 3.5rem;
  transition: transform 180ms ease, box-shadow 180ms ease, background 180ms ease;
}

.female-mvp-primary-button:active {
  transform: translateY(1px) scale(0.99);
}
```

- [ ] **Step 6: Run home tests**

Run: `npx tsx --test src/pages/HomePage.test.tsx`

Expected: PASS after updating any old tests that explicitly assert `APP_THEME_OPTIONS` theme switcher appears on the default home. Keep auth overlay helper tests unchanged.

- [ ] **Step 7: Commit mobile MVP home**

```bash
git add src/pages/HomePage.tsx src/pages/HomePage.test.tsx src/index.css
git commit -m "feat: simplify home for female mobile mvp"
```

## Task 6: Quiz Restyle And GSAP Transitions

**Files:**
- Modify: `src/pages/QuizPage.tsx`
- Modify: `src/pages/QuizPage.test.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Update quiz tests for female MVP copy**

In `src/pages/QuizPage.test.tsx`, add or replace a static render test with:

```tsx
test("quiz page uses mobile female MVP presentation", () => {
  const html = renderToStaticMarkup(
    <QuizPage
      pageVariants={{}}
      step={0}
      activeQuestions={[
        {
          id: "female-route",
          title: "刺激路径",
          subtitle: "你更期待哪种身体反馈路线？",
          field: "experienceLevel",
          options: [
            { label: "外部细节优先", value: "sensitive", tag: "外部震动/吮吸" },
          ],
        },
      ]}
      onSelectOption={() => {}}
      onBackQuestion={() => {}}
      onBackHome={() => {}}
    />,
  );

  assert.match(html, /female-mvp-quiz/);
  assert.match(html, /Luna 正在帮你校准/);
  assert.match(html, /刺激路径/);
  assert.doesNotMatch(html, /SCAN PHASE/);
  assert.doesNotMatch(html, /SIGNAL CHANNEL/);
});
```

- [ ] **Step 2: Run failing quiz tests**

Run: `npx tsx --test src/pages/QuizPage.test.tsx`

Expected: FAIL because the old quiz uses deep-space scan styling and copy.

- [ ] **Step 3: Add refs and GSAP transition**

Modify imports in `src/pages/QuizPage.tsx`:

```tsx
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { CuteAstronaut } from "../components/CuteAstronaut.tsx";
import { getGsapDuration } from "../lib/gsap-motion.ts";
```

Inside `QuizPage`, add:

```tsx
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!cardRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        cardRef.current,
        { autoAlpha: 0, y: 18, scale: 0.98 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: getGsapDuration(0.34, {
            shouldAnimate,
            prefersReducedMotion,
          }),
          ease: "power2.out",
        },
      );
    }, cardRef);

    return () => ctx.revert();
  }, [step, shouldAnimate, prefersReducedMotion]);
```

Use `const { shouldAnimate, prefersReducedMotion } = usePagePerformanceState();`.

- [ ] **Step 4: Replace quiz JSX shell**

Replace deep-space shell classes with a female MVP shell:

```tsx
className={[
  "female-mvp-quiz relative left-1/2 flex min-h-[100svh] w-screen -translate-x-1/2 flex-col overflow-hidden px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4",
  shouldAnimate ? "" : "ambient-motion-paused",
].join(" ")}
```

Replace the main card with a `div ref={cardRef}` using:

```tsx
<div
  ref={cardRef}
  className="relative mx-auto mt-5 w-full max-w-[28rem] rounded-[1.6rem] border border-white/74 bg-white/72 p-5 shadow-[0_1rem_3rem_rgba(255,132,170,0.16)] backdrop-blur"
>
  <div className="mb-4 flex items-center gap-3">
    <CuteAstronaut className="w-14 shrink-0" />
    <div>
      <p className="text-xs font-bold text-rose-500">Luna 正在帮你校准</p>
      <p className="text-[11px] text-[#8d7483]">
        第 {step + 1} / {activeQuestions.length} 题
      </p>
    </div>
  </div>
  <h2 className="text-2xl font-black leading-tight text-[#342936]">
    {currentQuestion.title}
  </h2>
  <p className="mt-2 text-sm leading-6 text-[#806878]">
    {currentQuestion.subtitle}
  </p>
  <div className="mt-6 space-y-3">
    {currentQuestion.options.map((option, index) => (
      <button
        key={index}
        onClick={() =>
          onSelectOption(
            currentQuestion.field,
            option.value,
            option.tag,
            option.answerPatch,
            option.label,
          )
        }
        className="female-mvp-option group flex w-full items-center gap-3 rounded-[1.15rem] border border-rose-100 bg-white/78 p-4 text-left text-sm font-semibold leading-6 text-[#5f4b5a] shadow-sm"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#fff0f5] text-xs font-black text-rose-500">
          {index + 1}
        </span>
        <span>{option.label}</span>
      </button>
    ))}
  </div>
</div>
```

Keep back buttons and progress dots, but restyle them with light classes.

- [ ] **Step 5: Add quiz CSS**

Append to `src/index.css`:

```css
.female-mvp-quiz {
  background:
    radial-gradient(circle at 85% 10%, rgba(143, 211, 255, 0.34), transparent 16rem),
    linear-gradient(180deg, #fff9fb, #fff0f5 58%, #f1f9ff);
}

.female-mvp-option {
  transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
}

.female-mvp-option:active {
  transform: scale(0.99);
}

.female-mvp-option:hover {
  border-color: rgba(255, 111, 159, 0.42);
  box-shadow: 0 0.85rem 1.8rem rgba(255, 111, 159, 0.12);
}
```

- [ ] **Step 6: Run quiz tests**

Run: `npx tsx --test src/pages/QuizPage.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit quiz restyle**

```bash
git add src/pages/QuizPage.tsx src/pages/QuizPage.test.tsx src/index.css
git commit -m "feat: restyle quiz for female mvp"
```

## Task 7: Matching Ritual With GSAP

**Files:**
- Modify: `src/pages/MatchingPage.tsx`
- Modify: `src/index.css`
- Add test if no existing static matching test is present: `src/pages/MatchingPage.test.tsx`

- [ ] **Step 1: Add matching test**

Create or append to `src/pages/MatchingPage.test.tsx`:

```tsx
import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { MatchingPage } from "./MatchingPage.tsx";

test("matching page renders cute astronaut MVP ritual", () => {
  const html = renderToStaticMarkup(
    <MatchingPage
      pageVariants={{}}
      isAiMatching={false}
      tags={["女性向", "静音"]}
    />,
  );

  assert.match(html, /female-mvp-matching/);
  assert.match(html, /Luna 正在整理你的星球坐标/);
  assert.match(html, /女性向/);
  assert.doesNotMatch(html, /链路解析中/);
  assert.doesNotMatch(html, /雷达/);
});
```

- [ ] **Step 2: Run failing matching test**

Run: `npx tsx --test src/pages/MatchingPage.test.tsx`

Expected: FAIL because current matching page is radar/deep-space themed.

- [ ] **Step 3: Replace matching presentation**

Modify imports in `src/pages/MatchingPage.tsx`:

```tsx
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { CuteAstronaut } from "../components/CuteAstronaut.tsx";
import { getGsapDuration } from "../lib/gsap-motion.ts";
```

Use refs:

```tsx
  const astronautRef = useRef<HTMLDivElement | null>(null);
  const { shouldAnimate, prefersReducedMotion } = usePagePerformanceState();

  useEffect(() => {
    if (!astronautRef.current) return;
    const ctx = gsap.context(() => {
      gsap.to(astronautRef.current, {
        y: -10,
        duration: getGsapDuration(1.6, { shouldAnimate, prefersReducedMotion }),
        repeat: shouldAnimate && !prefersReducedMotion ? -1 : 0,
        yoyo: true,
        ease: "sine.inOut",
      });
    }, astronautRef);

    return () => ctx.revert();
  }, [shouldAnimate, prefersReducedMotion]);
```

Replace return body with:

```tsx
<motion.div
  key="loading"
  variants={pageVariants}
  initial="initial"
  animate="in"
  exit="out"
  className="female-mvp-matching relative left-1/2 flex min-h-[100svh] w-screen -translate-x-1/2 flex-col items-center justify-center overflow-hidden px-5 py-10 text-center"
>
  <div className="female-mvp-stars" aria-hidden="true" />
  <div ref={astronautRef} className="relative z-10 mb-6">
    <CuteAstronaut label="Luna 小宇航员正在匹配" />
  </div>
  <div className="relative z-10 max-w-[20rem]">
    <h2 className="text-2xl font-black leading-tight text-[#342936]">
      Luna 正在整理你的星球坐标
    </h2>
    <p className="mt-3 text-sm leading-7 text-[#806878]">
      正在把你的偏好转成可比较的选择线索，很快给你一个更好下手的方向。
    </p>
    <div className="mt-6 flex flex-wrap justify-center gap-2">
      {tags.slice(0, 3).map((tag) => (
        <span
          key={tag}
          className="rounded-full bg-white/72 px-3 py-1.5 text-xs font-bold text-rose-500 shadow-sm"
        >
          {tag}
        </span>
      ))}
    </div>
  </div>
</motion.div>
```

- [ ] **Step 4: Add matching CSS**

Append to `src/index.css`:

```css
.female-mvp-matching {
  background:
    radial-gradient(circle at 50% 24%, rgba(255, 199, 220, 0.66), transparent 16rem),
    radial-gradient(circle at 78% 72%, rgba(143, 211, 255, 0.34), transparent 15rem),
    linear-gradient(180deg, #fff9fb, #fff0f5 58%, #eef8ff);
}
```

- [ ] **Step 5: Run matching test**

Run: `npx tsx --test src/pages/MatchingPage.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit matching ritual**

```bash
git add src/pages/MatchingPage.tsx src/pages/MatchingPage.test.tsx src/index.css
git commit -m "feat: add cute matching ritual"
```

## Task 8: Results Surface Simplification

**Files:**
- Modify: `src/pages/ResultsPage.tsx`
- Modify: `src/pages/ResultsPage.test.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Add result surface test**

Add to `src/pages/ResultsPage.test.tsx`:

```tsx
test("female MVP results hide heavy secondary modules", () => {
  const html = renderResultsPage({
    topProducts: [
      makeRankedProduct({
        id: "female-good",
        gender: "female",
        reason: "适合女性向新手外部探索。",
      }),
    ],
  });

  assert.match(html, /female-mvp-results/);
  assert.match(html, /这颗小星球可以先看/);
  assert.doesNotMatch(html, /身体人格/);
  assert.doesNotMatch(html, /知识星云/);
  assert.doesNotMatch(html, /去知识星云/);
  assert.doesNotMatch(html, /完整星系人格/);
});
```

Use existing test helpers in the file. If helpers are named differently, adapt only the helper call while preserving the assertions.

- [ ] **Step 2: Run failing results test**

Run: `npx tsx --test src/pages/ResultsPage.test.tsx`

Expected: FAIL because current results page still renders heavy secondary modules and dark styling.

- [ ] **Step 3: Import app mode in ResultsPage**

Modify imports:

```ts
import { shouldUseFemaleMvp } from "../lib/app-mode.ts";
```

Inside `ResultsPage`, define:

```ts
  const isFemaleMvp = shouldUseFemaleMvp();
```

- [ ] **Step 4: Gate heavy result modules**

Replace the body persona dialog block:

```tsx
      {isBodyPersonaQuizOpen ? (
        <BodyPersonaQuizDialog
          questions={bodyPersonaQuestions}
          answers={bodyPersonaDraftAnswers}
          onClose={onCloseBodyPersonaQuiz ?? (() => undefined)}
          onChangeAnswer={
            onChangeBodyPersonaAnswer ?? (() => undefined)
          }
          onSubmit={onSubmitBodyPersonaQuiz ?? (() => undefined)}
          isSubmitting={isSubmittingBodyPersonaQuiz}
        />
      ) : null}
```

with:

```tsx
      {!isFemaleMvp && isBodyPersonaQuizOpen ? (
        <BodyPersonaQuizDialog
          questions={bodyPersonaQuestions}
          answers={bodyPersonaDraftAnswers}
          onClose={onCloseBodyPersonaQuiz ?? (() => undefined)}
          onChangeAnswer={onChangeBodyPersonaAnswer ?? (() => undefined)}
          onSubmit={onSubmitBodyPersonaQuiz ?? (() => undefined)}
          isSubmitting={isSubmittingBodyPersonaQuiz}
        />
      ) : null}
```

Replace the full report dialog:

```tsx
      <BodyPersonaFullReportDialog
        isOpen={isBodyPersonaFullReportOpen}
        report={normalizedBodyPersonaFullReport}
        onClose={onCloseBodyPersonaFullReport ?? (() => undefined)}
      />
```

with:

```tsx
      {!isFemaleMvp ? (
        <BodyPersonaFullReportDialog
          isOpen={isBodyPersonaFullReportOpen}
          report={normalizedBodyPersonaFullReport}
          onClose={onCloseBodyPersonaFullReport ?? (() => undefined)}
        />
      ) : null}
```

Replace the body persona unlock/result block:

```tsx
      <BodyPersonaUnlockCard
        onStart={onStartBodyPersona ?? (() => undefined)}
        isBusy={isStartingBodyPersona || isSubmittingBodyPersonaQuiz}
        freeSummary={
          bodyPersonaState?.freeSummary
            ? {
                title: bodyPersonaState.freeSummary.title,
                blurb: bodyPersonaState.freeSummary.blurb,
              }
            : null
        }
      />

      {bodyPersonaState ? (
        <BodyPersonaResultPanel
          status={bodyPersonaState.status}
          freeSummary={bodyPersonaState.freeSummary}
          fullReport={normalizedBodyPersonaFullReport}
          onUnlock={onUnlockBodyPersona ?? (() => undefined)}
          onOpenFullReport={onOpenBodyPersonaFullReport}
          isUnlocking={isUnlockingBodyPersona}
          requiresLoginBeforeUnlock={bodyPersonaUnlockNeedsLogin}
        />
      ) : null}
```

with:

```tsx
      {!isFemaleMvp ? (
        <>
          <BodyPersonaUnlockCard
            onStart={onStartBodyPersona ?? (() => undefined)}
            isBusy={isStartingBodyPersona || isSubmittingBodyPersonaQuiz}
            freeSummary={
              bodyPersonaState?.freeSummary
                ? {
                    title: bodyPersonaState.freeSummary.title,
                    blurb: bodyPersonaState.freeSummary.blurb,
                  }
                : null
            }
          />

          {bodyPersonaState ? (
            <BodyPersonaResultPanel
              status={bodyPersonaState.status}
              freeSummary={bodyPersonaState.freeSummary}
              fullReport={normalizedBodyPersonaFullReport}
              onUnlock={onUnlockBodyPersona ?? (() => undefined)}
              onOpenFullReport={onOpenBodyPersonaFullReport}
              isUnlocking={isUnlockingBodyPersona}
              requiresLoginBeforeUnlock={bodyPersonaUnlockNeedsLogin}
            />
          ) : null}
        </>
      ) : null}
```

Replace the parameter education section:

```tsx
      {topProducts[0] && (
        <ResultsParameterEducationSection
          isGuideOpen={isParameterGuideOpen}
          onToggleGuide={() => setIsParameterGuideOpen((isOpen) => !isOpen)}
          onOpenTopic={handleOpenKnowledgeTopic}
          previewItems={sortedParameterPreviewItems}
          metricChips={getMetricChips(topProducts[0])}
        />
      )}
```

with:

```tsx
      {!isFemaleMvp && topProducts[0] ? (
        <ResultsParameterEducationSection
          isGuideOpen={isParameterGuideOpen}
          onToggleGuide={() => setIsParameterGuideOpen((isOpen) => !isOpen)}
          onOpenTopic={handleOpenKnowledgeTopic}
          previewItems={sortedParameterPreviewItems}
          metricChips={getMetricChips(topProducts[0])}
        />
      ) : null}
```

Keep tuning, alternatives, save/favorite, next-step panels, and final checklist available.

- [ ] **Step 5: Add female MVP result shell classes and copy**

Change the top-level results wrapper class from:

```tsx
className="results-report-shell relative isolate w-full space-y-6 overflow-x-hidden px-3 pt-3 pb-4 sm:px-4 sm:pt-4"
```

to:

```tsx
className={[
  "results-report-shell relative isolate w-full space-y-6 overflow-x-hidden px-3 pt-3 pb-4 sm:px-4 sm:pt-4",
  isFemaleMvp ? "female-mvp-results" : "",
].join(" ")}
```

Replace the header eyebrow and heading:

```tsx
        <p className="mb-3 font-mono text-[10px] tracking-[0.34em] text-cyan-200/50">
          匹配结果
        </p>
        <h2 className="mb-2 text-2xl font-light text-white">
          这次更贴近你的，是这条路线
        </h2>
```

with:

```tsx
        <p
          className={[
            "mb-3 text-[10px] font-bold tracking-[0.24em]",
            isFemaleMvp ? "text-rose-500" : "font-mono text-cyan-200/50",
          ].join(" ")}
        >
          {isFemaleMvp ? "LUNA RESULT" : "匹配结果"}
        </p>
        <h2
          className={[
            "mb-2 text-2xl",
            isFemaleMvp ? "font-black text-[#342936]" : "font-light text-white",
          ].join(" ")}
        >
          {isFemaleMvp ? "这颗小星球可以先看" : "这次更贴近你的，是这条路线"}
        </h2>
```

Replace the secondary paragraph:

```tsx
        <p className="mx-auto mt-2 max-w-2xl text-xs leading-6 text-slate-500">
          先看主推荐，如果你想换个方向，再往下微调、比较备选，或者补一层长期人格画像。
        </p>
```

with:

```tsx
        <p className="mx-auto mt-2 max-w-2xl text-xs leading-6 text-slate-500">
          {isFemaleMvp
            ? "先看主推荐和购买前检查；如果想换个方向，可以用下面的轻量微调。"
            : "先看主推荐，如果你想换个方向，再往下微调、比较备选，或者补一层长期人格画像。"}
        </p>
```

Keep existing data and product rendering.

- [ ] **Step 6: Add result CSS**

Append to `src/index.css`:

```css
.female-mvp-results {
  min-height: 100svh;
  background:
    radial-gradient(circle at 82% 8%, rgba(143, 211, 255, 0.3), transparent 18rem),
    linear-gradient(180deg, #fff9fb, #fff3f7 42%, #f3fbff);
  color: #342936;
}

.female-mvp-results .glass-panel,
.female-mvp-results [class*="bg-slate-"],
.female-mvp-results [class*="bg-cyan-"] {
  background-color: rgba(255, 255, 255, 0.74) !important;
  color: #342936;
}
```

- [ ] **Step 7: Run results tests**

Run: `npx tsx --test src/pages/ResultsPage.test.tsx`

Expected: PASS after updating stale assertions that specifically required knowledge/body persona CTAs on the default result surface.

- [ ] **Step 8: Commit result simplification**

```bash
git add src/pages/ResultsPage.tsx src/pages/ResultsPage.test.tsx src/index.css
git commit -m "feat: simplify results for female mvp"
```

## Task 9: Full Verification And Mobile Browser Check

**Files:**
- Modify only if verification reveals small defects.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npx tsx --test src/lib/app-mode.test.ts src/lib/gsap-motion.test.ts src/components/CuteAstronaut.test.tsx src/pages/HomePage.test.tsx src/pages/QuizPage.test.tsx src/pages/MatchingPage.test.tsx src/pages/ResultsPage.test.tsx src/lib/recommendation-local-ranking.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run TypeScript lint**

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 3: Build production bundle**

Run: `npm run build`

Expected: PASS and Vite outputs `dist`.

- [ ] **Step 4: Start dev server**

Run: `npm run dev`

Expected: Vite starts on `http://localhost:3009`.

- [ ] **Step 5: Verify mobile home manually**

Open `http://localhost:3009` at a mobile viewport such as 390x844.

Expected visible checks:

- cute astronaut visible in first viewport
- text says `找到适合你的第一颗小星球`
- one primary `开始匹配` button
- no `装备库`
- no `知识星云`
- no theme switcher
- no login/register prompt

- [ ] **Step 6: Verify quiz and matching flow manually**

Tap `开始匹配`, choose one answer per question, and proceed to matching.

Expected visible checks:

- first question is female-focused, not `航向选择`
- no male/couples options
- quiz card animates softly
- matching page shows cute astronaut and female MVP copy
- layout fits without horizontal scrolling

- [ ] **Step 7: Verify results manually**

Wait for results or use available local/mock product path if server data is empty.

Expected visible checks:

- result surface uses light female MVP theme
- no body persona CTA
- no knowledge nebula CTA
- no male-only product appears
- tuning/favorite/next-step controls remain usable

- [ ] **Step 8: Verify reduced motion**

In browser dev tools or OS setting, emulate `prefers-reduced-motion: reduce`, reload the app, and repeat home and quiz checks.

Expected: no continuous astronaut bobbing or looping GSAP motion.

- [ ] **Step 9: Stop dev server and commit verification fixes**

If verification required fixes, add the exact files changed by those fixes. For example, if the home mobile check needed spacing polish:

```bash
git add src/pages/HomePage.tsx src/index.css
git commit -m "fix: polish female mvp verification issues"
```

If no fixes were needed, do not create an empty commit.

## Self-Review

- Spec coverage: Tasks cover product-level hiding, female default, mobile-first home/quiz/matching/results, cute astronaut IP, GSAP dependency, reduced-motion handling, female product eligibility, and verification.
- Placeholder scan: No `TBD`, `TODO`, or unspecified “add tests” steps remain.
- Type consistency: New symbols are consistently named `APP_MODE`, `DEFAULT_MVP_ANSWERS`, `shouldUseFemaleMvp`, `canShowMvpEntry`, `isFemaleMvpEligibleProduct`, `filterFemaleMvpProducts`, `CuteAstronaut`, `shouldRunGsapMotion`, and `getGsapDuration`.
