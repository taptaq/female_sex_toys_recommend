# Recommendation Results Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a separate backup-candidate card section and richer shopping guidance to the recommendation results page, while preserving the existing top-3 ranking flow.

**Architecture:** Keep the current structured scoring and AI top-3 rerank pipeline intact, then add an enhancement layer that derives differentiated backup candidates and shopping guidance after top-3 finalization. Move the new selection and fallback logic into a small pure helper module so it can be tested with `node:test`, then update `App.tsx` to persist the expanded result payload and `ResultsPage.tsx` to render the new sections responsively on mobile and desktop.

**Tech Stack:** React 19, TypeScript, existing localStorage app-state helpers, `node:test` with `ts-node/esm`, existing OpenAI-compatible browser clients in `src/App.tsx`

---

## File Structure

### Existing files to modify

- `src/App.tsx`
  - Keep the current top-3 selection flow.
  - Add result-state fields for backup cards and shopping guidance.
  - Call a new enhancement helper after top-3 finalization.
  - Add AI explanation generation with local fallback.
- `src/pages/ResultsPage.tsx`
  - Render a separate backup-card section.
  - Split “guidance” from “top 3” more clearly.
  - Make the new sections responsive on mobile and desktop.
- `src/lib/app-shell.ts`
  - Extend the shared result types used by localStorage hydration if needed.

### New files to create

- `src/lib/recommendation-results.ts`
  - Pure helper functions for selecting backup candidates, deriving backup labels, and generating local fallback guidance/reasons.
- `src/lib/recommendation-results.test.ts`
  - `node:test` coverage for candidate selection, deduplication, differentiation, and fallback output.

## Task 1: Add Pure Recommendation-Enhancement Logic

**Files:**
- Create: `src/lib/recommendation-results.ts`
- Create: `src/lib/recommendation-results.test.ts`
- Reference: `src/App.tsx`

- [ ] **Step 1: Write the failing test for differentiated backup selection**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBackupCandidates,
  buildLocalShoppingGuidance,
} from "./recommendation-results.ts";

test("buildBackupCandidates excludes top 3 and prefers differentiated directions", () => {
  const ranked = [
    { id: "p1", name: "Top 1", score: 98, price: 399, maxDb: 45, waterproof: 7, appearance: "high_disguise", motorType: "gentle", gender: "female", brand: "A", material: "硅胶", imagePlaceholder: "", tags: [], link: null, sourceUrl: null, matchSummary: ["价格落在预算区间内"], hardMisses: 0, budgetGap: 0, noiseGap: 0, physicalForm: "external" },
    { id: "p2", name: "Top 2", score: 95, price: 299, maxDb: 48, waterproof: 7, appearance: "normal", motorType: "gentle", gender: "female", brand: "A", material: "硅胶", imagePlaceholder: "", tags: [], link: null, sourceUrl: null, matchSummary: ["适配当前使用方向"], hardMisses: 0, budgetGap: 0, noiseGap: 0, physicalForm: "external" },
    { id: "p3", name: "Top 3", score: 91, price: 259, maxDb: 50, waterproof: 5, appearance: "normal", motorType: "strong", gender: "female", brand: "A", material: "硅胶", imagePlaceholder: "", tags: [], link: null, sourceUrl: null, matchSummary: ["刺激形式与偏好一致"], hardMisses: 0, budgetGap: 0, noiseGap: 0, physicalForm: "external" },
    { id: "p4", name: "Quiet Pick", score: 90, price: 349, maxDb: 40, waterproof: 5, appearance: "normal", motorType: "gentle", gender: "female", brand: "B", material: "硅胶", imagePlaceholder: "", tags: [], link: null, sourceUrl: null, matchSummary: [], hardMisses: 0, budgetGap: 0, noiseGap: 0, physicalForm: "external" },
    { id: "p5", name: "Budget Pick", score: 89, price: 169, maxDb: 52, waterproof: 5, appearance: "normal", motorType: "gentle", gender: "female", brand: "C", material: "硅胶", imagePlaceholder: "", tags: [], link: null, sourceUrl: null, matchSummary: [], hardMisses: 0, budgetGap: 0, noiseGap: 2, physicalForm: "external" },
    { id: "p6", name: "Waterproof Pick", score: 88, price: 329, maxDb: 49, waterproof: 8, appearance: "normal", motorType: "strong", gender: "female", brand: "D", material: "硅胶", imagePlaceholder: "", tags: [], link: null, sourceUrl: null, matchSummary: [], hardMisses: 0, budgetGap: 0, noiseGap: 0, physicalForm: "external" },
  ] as any;

  const result = buildBackupCandidates(ranked, ["p1", "p2", "p3"], 2);

  assert.deepEqual(result.map((item) => item.id), ["p4", "p5"]);
  assert.deepEqual(result.map((item) => item.backupLabel), ["更静音", "更省预算"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --loader ts-node/esm --test src/lib/recommendation-results.test.ts
```

Expected:

- FAIL with missing exports like `buildBackupCandidates`

- [ ] **Step 3: Write minimal helper implementation**

```ts
export type RecommendationRankedProduct = RankedProduct & {
  matchSummary: string[];
  hardMisses: number;
  budgetGap: number;
  noiseGap: number;
};

export type BackupCandidate = RecommendationRankedProduct & {
  backupLabel: string;
  backupReason: string;
};

function pickBackupLabel(product: RecommendationRankedProduct): string {
  if (product.maxDb != null && product.maxDb <= 45) return "更静音";
  if (product.price <= 199) return "更省预算";
  if ((product.waterproof ?? 0) >= 7) return "更高防水";
  if (product.appearance === "high_disguise") return "更低存在感";
  return "也值得看";
}

export function buildBackupCandidates(
  ranked: RecommendationRankedProduct[],
  topIds: string[],
  limit = 2,
): BackupCandidate[] {
  const seenLabels = new Set<string>();
  const topIdSet = new Set(topIds);
  const result: BackupCandidate[] = [];

  for (const product of ranked) {
    if (topIdSet.has(product.id)) continue;
    const backupLabel = pickBackupLabel(product);
    if (seenLabels.has(backupLabel)) continue;
    seenLabels.add(backupLabel);
    result.push({ ...product, backupLabel, backupReason: "" });
    if (result.length >= limit) break;
  }

  return result;
}
```

- [ ] **Step 4: Add fallback shopping-guidance tests**

```ts
test("buildLocalShoppingGuidance returns concise advice for narrow candidate pools", () => {
  const result = buildLocalShoppingGuidance({
    answers: { tags: ["安静", "低调"], maxDb: 50, appearance: "high_disguise" } as any,
    filteredCount: 2,
    backupCandidates: [{ id: "p4", backupLabel: "更静音" }, { id: "p5", backupLabel: "更省预算" }] as any,
  });

  assert.ok(result.length >= 2);
  assert.ok(result.some((line) => line.includes("静音")));
});
```

- [ ] **Step 5: Implement local fallback guidance and backup reasons**

```ts
export function buildLocalBackupReason(candidate: BackupCandidate): string {
  switch (candidate.backupLabel) {
    case "更静音":
      return "如果你更在意安静感受，这一款比主推荐更值得优先比较。";
    case "更省预算":
      return "如果你想把预算压得更稳，这一款会更容易做决定。";
    case "更高防水":
      return "如果你更看重清洁便利和防水余量，这一款更值得留意。";
    default:
      return "如果你想换一种侧重点，它会是当前结果里更稳妥的备选。";
  }
}

export function buildLocalShoppingGuidance(input: {
  answers: AnswerState;
  filteredCount: number;
  backupCandidates: BackupCandidate[];
}): string[] {
  const lines: string[] = [];
  if (input.filteredCount < 3) lines.push("这轮筛选条件偏严格，候选池已经明显收窄。");
  if (input.answers.maxDb && input.answers.maxDb <= 50) lines.push("你当前更偏向静音取向，建议优先比较噪音和动力的平衡。");
  if (input.answers.appearance === "high_disguise") lines.push("你对低存在感的要求较高，造型取舍会直接影响可选范围。");
  if (input.backupCandidates.some((item) => item.backupLabel === "更省预算")) {
    lines.push("如果你想保留核心体验同时控制预算，可以优先看“更省预算”的备选。");
  }
  return lines.slice(0, 5);
}
```

- [ ] **Step 6: Run test to verify it passes**

Run:

```bash
node --loader ts-node/esm --test src/lib/recommendation-results.test.ts
```

Expected:

- PASS with backup-selection and local-guidance tests green

- [ ] **Step 7: Commit**

```bash
git add src/lib/recommendation-results.ts src/lib/recommendation-results.test.ts
git commit -m "feat: add recommendation result enhancement helpers"
```

## Task 2: Wire Backup Candidates and Guidance Into App State

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/lib/app-shell.ts`
- Test: `src/lib/recommendation-results.test.ts`

- [ ] **Step 1: Extend persisted result state with explicit fields**

```ts
type PersistedAppState = {
  step?: number;
  answers?: AnswerState;
  topProducts?: RankedProduct[];
  backupProducts?: BackupProduct[];
  recommendationTips?: string[];
  shoppingGuidance?: string[];
  filterGender?: string;
  filterBrand?: string;
  filterOrigin?: string;
  filterMaxDb?: number;
  filterMaterial?: string;
  filterPriceRange?: string;
};
```

- [ ] **Step 1.5: Define the shared backup-product type before using it**

```ts
export type BackupProduct = RankedProduct & {
  backupLabel: string;
  backupReason: string;
};
```

- [ ] **Step 2: Run type check to capture missing names**

Run:

```bash
npx tsc --noEmit
```

Expected:

- FAIL with unknown names like `BackupProduct` or missing state setters

- [ ] **Step 3: Add result-state hooks and localStorage persistence**

```ts
const [backupProducts, setBackupProducts] = useState<BackupProduct[]>(
  persistedState.backupProducts ?? [],
);
const [shoppingGuidance, setShoppingGuidance] = useState<string[]>(
  persistedState.shoppingGuidance ?? persistedState.recommendationTips ?? [],
);

window.localStorage.setItem(
  APP_STATE_STORAGE_KEY,
  JSON.stringify({
    step,
    answers,
    topProducts,
    backupProducts,
    recommendationTips,
    shoppingGuidance,
    filterGender,
    filterBrand,
    filterOrigin,
    filterMaxDb,
    filterMaterial,
    filterPriceRange,
  }),
);
```

- [ ] **Step 4: Add AI enhancement request for backup-card reasons and shopping guidance**

```ts
async function callAiResultEnhancement(input: {
  userAnswers: AnswerState;
  topProducts: RankedProduct[];
  backupProducts: BackupProduct[];
}) {
  const prompt = `
你是一个专业的性健康装备选品顾问。
请基于用户偏好、Top3 主推荐和备选装备，生成：
1. 每个备选装备一句中文说明
2. 3-5 条简短的选购建议

请只返回 JSON：
{
  "backupReasons": [
    { "id": "产品ID", "reason": "20字以内说明" }
  ],
  "shoppingGuidance": ["建议1", "建议2"]
}`;
}
```

- [ ] **Step 5: Integrate enhancement layer after top-3 finalization**

```ts
const finalizedTopProducts = finalizeRankedProducts(
  orderedProducts.slice(0, FINAL_SELECTION_COUNT),
  reasonMap,
  currentAnswers,
);

const backupCandidates = buildBackupCandidates(
  rankedCandidates,
  finalizedTopProducts.map((item) => item.id),
  2,
);

try {
  const enhanced = await callAiResultEnhancement({
    userAnswers: currentAnswers,
    topProducts: finalizedTopProducts,
    backupProducts: backupCandidates,
  });

  setBackupProducts(
    backupCandidates.map((item) => ({
      ...item,
      backupReason:
        enhanced.backupReasons.find((entry) => entry.id === item.id)?.reason ||
        buildLocalBackupReason(item),
    })),
  );
  setShoppingGuidance(
    enhanced.shoppingGuidance?.length
      ? enhanced.shoppingGuidance
      : buildLocalShoppingGuidance({
          answers: currentAnswers,
          filteredCount: filtered.length,
          backupCandidates,
        }),
  );
} catch {
  setBackupProducts(
    backupCandidates.map((item) => ({
      ...item,
      backupReason: buildLocalBackupReason(item),
    })),
  );
  setShoppingGuidance(
    buildLocalShoppingGuidance({
      answers: currentAnswers,
      filteredCount: filtered.length,
      backupCandidates,
    }),
  );
}
```

- [ ] **Step 6: Reset all new result state on quiz restart**

```ts
const resetQuiz = () => {
  setStep(0);
  setAnswers({ tags: [] });
  setTopProducts([]);
  setBackupProducts([]);
  setRecommendationTips([]);
  setShoppingGuidance([]);
  navigateTo("/quiz");
};
```

- [ ] **Step 7: Run tests and type check**

Run:

```bash
node --loader ts-node/esm --test src/lib/recommendation-results.test.ts
npx tsc --noEmit
```

Expected:

- helper tests still PASS
- type check PASS with new state fields and imports resolved

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx src/lib/app-shell.ts src/lib/recommendation-results.ts src/lib/recommendation-results.test.ts
git commit -m "feat: add backup candidates to recommendation state"
```

## Task 3: Render Backup Cards and Guidance Responsively

**Files:**
- Modify: `src/pages/ResultsPage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Update ResultsPage props to accept backup cards and shopping guidance**

```ts
export function ResultsPage({
  pageVariants,
  answers,
  topProducts,
  backupProducts,
  recommendationTips,
  shoppingGuidance,
  onReset,
}: {
  pageVariants: any;
  answers: AnswerState;
  topProducts: RankedProduct[];
  backupProducts: BackupProduct[];
  recommendationTips: string[];
  shoppingGuidance: string[];
  onReset: () => void;
}) {
```

- [ ] **Step 2: Run type check to catch render callsites**

Run:

```bash
npx tsc --noEmit
```

Expected:

- FAIL because `ResultsPage` callsite in `src/App.tsx` has not passed the new props yet

- [ ] **Step 3: Pass new props from App to ResultsPage**

```tsx
<ResultsPage
  pageVariants={pageVariants}
  answers={answers}
  topProducts={topProducts}
  backupProducts={backupProducts}
  recommendationTips={recommendationTips}
  shoppingGuidance={shoppingGuidance}
  onReset={resetQuiz}
/>
```

- [ ] **Step 4: Replace the current guidance block with a richer shopping-guidance section**

```tsx
const visibleGuidance =
  shoppingGuidance.length > 0 ? shoppingGuidance : recommendationTips;

{visibleGuidance.length > 0 && (
  <motion.div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 sm:p-5">
    <div className="mb-3 flex items-center gap-2 text-amber-400">
      <Sparkles className="h-4 w-4" />
      <span className="text-xs font-medium uppercase tracking-wider">
        选购建议
      </span>
    </div>
    <ul className="space-y-2">
      {visibleGuidance.map((tip, index) => (
        <li key={index} className="flex gap-2 text-xs leading-relaxed text-amber-100/80 sm:text-sm">
          <span className="shrink-0">•</span>
          <span>{tip}</span>
        </li>
      ))}
    </ul>
  </motion.div>
)}
```

- [ ] **Step 5: Add the new backup-card section with responsive layout**

```tsx
{backupProducts.length > 0 && (
  <section className="space-y-3">
    <div className="space-y-1">
      <h3 className="text-sm font-medium text-white sm:text-base">
        如果你想换一种侧重点
      </h3>
      <p className="text-xs leading-relaxed text-slate-400 sm:text-sm">
        这几款没有进入前三，但在静音、预算或使用场景上更值得横向比较。
      </p>
    </div>

    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {backupProducts.map((product) => (
        <article
          key={product.id}
          className="rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-4"
        >
          <div className="mb-3 aspect-[4/3] overflow-hidden rounded-xl bg-black/20">
            {product.imagePlaceholder.startsWith("http") ? (
              <img
                src={product.imagePlaceholder}
                alt={product.name}
                className="h-full w-full object-cover opacity-90"
              />
            ) : (
              <div
                className={`flex h-full w-full items-center justify-center ${product.imagePlaceholder}`}
              >
                <Sparkles className="h-6 w-6 text-white/40" />
              </div>
            )}
          </div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-cyan-500/15 px-2 py-1 text-[10px] text-cyan-300 sm:text-xs">
              {product.backupLabel}
            </span>
            <span className="text-[10px] text-slate-400 sm:text-xs">
              {product.brand}
            </span>
          </div>
          <h4 className="mb-1 text-sm font-medium text-white sm:text-base">
            {product.name}
          </h4>
          <p className="mb-3 text-xs leading-relaxed text-slate-300 sm:text-sm">
            {product.backupReason}
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            <span className="rounded bg-white/5 px-2 py-1 text-[10px] text-slate-300 sm:text-xs">
              {product.maxDb == null ? "无噪音参数" : `<${product.maxDb}dB`}
            </span>
            <span className="rounded bg-white/5 px-2 py-1 text-[10px] text-slate-300 sm:text-xs">
              {product.waterproof == null ? "无防水参数" : `IPX${product.waterproof}`}
            </span>
            <span className="rounded bg-white/5 px-2 py-1 text-[10px] text-slate-300 sm:text-xs">
              {product.motorType === "gentle" ? "温柔" : "强力"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-cyan-400 sm:text-base">
              ¥{product.price}
            </span>
            {product.sourceUrl || product.link ? (
              <a
                href={product.sourceUrl || product.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-cyan-400 underline"
              >
                查看备选
              </a>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  </section>
)}
```

- [ ] **Step 6: Apply mobile/desktop spacing and wrapping polish**

```tsx
className="w-full space-y-6 sm:space-y-7"
className="grid grid-cols-1 gap-4 sm:grid-cols-2"
className="flex flex-wrap gap-2"
className="text-xs sm:text-sm leading-relaxed"
```

Use these concrete checks while editing:

- backup cards stack on mobile
- backup cards can sit in 2 columns on desktop
- no metric chip causes horizontal overflow
- long product names wrap to 2 lines without breaking the card

- [ ] **Step 7: Run type check**

Run:

```bash
npx tsc --noEmit
```

Expected:

- PASS with no prop-shape or JSX type errors

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx src/pages/ResultsPage.tsx
git commit -m "feat: render backup recommendation cards"
```

## Task 4: Verify End-to-End Result Behavior

**Files:**
- Verify: `src/App.tsx`
- Verify: `src/pages/ResultsPage.tsx`
- Verify: `src/lib/recommendation-results.ts`
- Test: `src/lib/recommendation-results.test.ts`

- [ ] **Step 1: Run automated verification**

Run:

```bash
node --loader ts-node/esm --test src/lib/recommendation-results.test.ts
npx tsc --noEmit
```

Expected:

- all helper tests PASS
- type check PASS

- [ ] **Step 2: Run the app and verify results manually on mobile and desktop widths**

Run:

```bash
npm run dev
```

Manual checks:

- run one quiz path that yields a normal top 3 and visible backup cards
- verify backup cards do not repeat top 3 products
- verify shopping guidance appears above the main recommendation block
- verify mobile width around `390px`
- verify desktop width around `1280px`
- verify long product names and missing image/link cases do not break layout

- [ ] **Step 3: Confirm fallback behavior by forcing AI failure locally if needed**

Temporary verification approach:

```ts
// inside App.tsx during local verification only
throw new Error("force local fallback");
```

Expected:

- page still renders top 3
- backup cards still render with local fallback reasons
- shopping guidance still renders from local rules

Remove the temporary forced error after verification.

- [ ] **Step 4: Commit final polish**

```bash
git add src/App.tsx src/pages/ResultsPage.tsx src/lib/recommendation-results.ts src/lib/recommendation-results.test.ts src/lib/app-shell.ts
git commit -m "test: verify recommendation result enhancements"
```

## Spec Coverage Check

- top 3 preserved: covered in Task 2 and Task 3
- separate backup-card section: covered in Task 1, Task 2, Task 3
- rule-selected cards plus AI-written guidance: covered in Task 1 and Task 2
- local fallback when AI fails: covered in Task 1, Task 2, Task 4
- responsive mobile and desktop rendering: covered in Task 3 and Task 4
- meaningful shopping guidance: covered in Task 1, Task 2, Task 3

## Notes For Implementation

- Do not rewrite the top-3 ranking model.
- Do not add a new frontend test framework just for this change.
- Keep the new helper module pure and easy to test.
- Prefer additive changes over broad refactors in `src/App.tsx`.
