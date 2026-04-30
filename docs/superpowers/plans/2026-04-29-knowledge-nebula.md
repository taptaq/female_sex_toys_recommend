# Knowledge Nebula Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new “知识星云” exploration surface with a homepage entry, a nebula-style category hub, and topic detail views that preserve the space-theme interaction model on both desktop and mobile.

**Architecture:** Add a new `/knowledge` route family backed by a static topic data model, a tested shard-layout engine, and a dedicated page/component stack. Reuse the project’s existing Motion-based animation patterns and floating-knowledge vocabulary where helpful, but keep the new knowledge hub isolated so it does not regress quiz, matching, or results flows.

**Tech Stack:** React 19, TypeScript, `motion/react`, Tailwind utility classes, Node test runner with `ts-node/esm`

---

## File Structure

### New files

- `src/data/knowledge-nebula.ts`
  Defines the five first-version knowledge topics, their labels, summaries, featured blocks, and detailed sections.
- `src/lib/knowledge-nebula-route.ts`
  Parses `/knowledge` and `/knowledge/:slug`, validates topic slugs, and builds outbound knowledge URLs.
- `src/lib/knowledge-nebula-route.test.ts`
  Verifies route parsing, slug validation, and URL builders.
- `src/lib/knowledge-nebula-field.ts`
  Generates deterministic shard positions, depth layers, and mobile-safe distributions for the hub animation.
- `src/lib/knowledge-nebula-field.test.ts`
  Verifies shard density, safe viewport bounds, and topic-to-slot mapping for desktop/mobile layouts.
- `src/components/KnowledgeNebulaField.tsx`
  Renders the animated whole-cloud-to-shards hub field and handles topic click targets.
- `src/components/KnowledgeNebulaTopicNav.tsx`
  Renders the compact persistent mini-nebula navigation for detail pages.
- `src/components/KnowledgeNebulaTopicSections.tsx`
  Renders featured knowledge shards plus the long-form section content beneath them.
- `src/pages/KnowledgeNebulaPage.tsx`
  Owns the `/knowledge` hub and detail layout, including back navigation and page-level transitions.

### Modified files

- `src/lib/app-shell.ts`
  Expands route detection to include `/knowledge` while keeping current route handling stable.
- `src/pages/HomePage.tsx`
  Adds the third homepage entry for the knowledge nebula.
- `src/App.tsx`
  Wires the new route family, selected topic state, page rendering, and return navigation.

### Verification targets

- `src/lib/knowledge-nebula-route.test.ts`
- `src/lib/knowledge-nebula-field.test.ts`
- `npm run lint`
- `npm run build`

### Execution note

This repo preference is “do not auto-commit unless the user explicitly asks.” During execution, replace commit steps with checkpoint reviews unless the user requests a commit.

---

### Task 1: Define knowledge topic data and route helpers

**Files:**
- Create: `src/data/knowledge-nebula.ts`
- Create: `src/lib/knowledge-nebula-route.ts`
- Test: `src/lib/knowledge-nebula-route.test.ts`
- Modify: `src/lib/app-shell.ts`

- [ ] **Step 1: Write the failing route/data tests**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildKnowledgeNebulaPath,
  parseKnowledgeNebulaPath,
} from "./knowledge-nebula-route.ts";
import {
  KNOWLEDGE_NEBULA_TOPICS,
  getKnowledgeNebulaTopicBySlug,
} from "../data/knowledge-nebula.ts";

test("parseKnowledgeNebulaPath resolves hub and valid topic slugs", () => {
  assert.deepEqual(parseKnowledgeNebulaPath("/knowledge"), {
    route: "/knowledge",
    topicSlug: undefined,
  });

  assert.deepEqual(parseKnowledgeNebulaPath("/knowledge/first-time"), {
    route: "/knowledge",
    topicSlug: "first-time",
  });
});

test("parseKnowledgeNebulaPath rejects unknown topic slugs", () => {
  assert.deepEqual(parseKnowledgeNebulaPath("/knowledge/not-found"), {
    route: "/knowledge",
    topicSlug: undefined,
  });
});

test("buildKnowledgeNebulaPath creates stable paths", () => {
  assert.equal(buildKnowledgeNebulaPath(), "/knowledge");
  assert.equal(buildKnowledgeNebulaPath("couples"), "/knowledge/couples");
});

test("knowledge topic data exposes the first-version five-topic constellation", () => {
  assert.deepEqual(
    KNOWLEDGE_NEBULA_TOPICS.map((topic) => topic.slug),
    ["science", "people", "first-time", "couples", "care"],
  );

  assert.equal(
    getKnowledgeNebulaTopicBySlug("science")?.title,
    "正经科普",
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
node --loader ts-node/esm --test src/lib/knowledge-nebula-route.test.ts
```

Expected:

- FAIL because `knowledge-nebula-route.ts` and `knowledge-nebula.ts` do not exist yet

- [ ] **Step 3: Write the minimal topic data and route implementation**

`src/data/knowledge-nebula.ts`

```ts
export type KnowledgeNebulaTopicSlug =
  | "science"
  | "people"
  | "first-time"
  | "couples"
  | "care";

export type KnowledgeNebulaSection = {
  id: string;
  title: string;
  summary: string;
  body: string[];
};

export type KnowledgeNebulaTopic = {
  slug: KnowledgeNebulaTopicSlug;
  title: string;
  shortLabel: string;
  summary: string;
  accent: "cyan" | "sky" | "indigo";
  featuredSectionIds: string[];
  sections: KnowledgeNebulaSection[];
};

export const KNOWLEDGE_NEBULA_TOPICS: KnowledgeNebulaTopic[] = [
  {
    slug: "science",
    title: "正经科普",
    shortLabel: "正经科普",
    summary: "先补齐基础认知，再判断自己真正需要什么。",
    accent: "cyan",
    featuredSectionIds: ["science-routes", "science-terms", "science-body"],
    sections: [
      {
        id: "science-routes",
        title: "刺激路线先分清",
        summary: "震动、吮吸、穿戴和共振体验并不是一回事。",
        body: [
          "先理解路线差异，再谈品牌和型号，通常更不容易被营销词带偏。",
          "外部刺激、入体刺激、复合刺激对应的感受门槛和反馈方式都不同。",
        ],
      },
      {
        id: "science-terms",
        title: "常见术语别被绕晕",
        summary: "把真正影响体验的词和纯包装词拆开看。",
        body: [
          "像远控、穿戴、防水、静音这类词有较高决策价值。",
          "像旗舰、黑科技、升级版这类词需要落回实际参数和场景判断。",
        ],
      },
      {
        id: "science-body",
        title: "身体反馈差异很正常",
        summary: "敏感度、节奏耐受和进入状态方式本来就因人而异。",
        body: [
          "不要拿别人的强反馈偏好直接套到自己身上。",
        ],
      },
    ],
  },
  {
    slug: "people",
    title: "人群指南",
    shortLabel: "人群指南",
    summary: "按状态找答案，比按大而全知识库检索更快。",
    accent: "sky",
    featuredSectionIds: ["people-beginner", "people-quiet", "people-intense"],
    sections: [
      {
        id: "people-beginner",
        title: "新手慢热型",
        summary: "先降低刺激门槛，再找节奏。",
        body: ["新手通常更适合先看温和、低压、低噪和好清洁的路线。"],
      },
      {
        id: "people-quiet",
        title: "重静音 / 重隐蔽型",
        summary: "先把环境约束摆在前面。",
        body: ["如果环境限制强，静音和收纳压力比强刺激更先决定可用性。"],
      },
      {
        id: "people-intense",
        title: "偏强反馈型",
        summary: "高耐受人群更需要看路线和结构，而不是只看“强”。",
        body: ["强反馈不是统一答案，路线错误时只会更容易不适。"],
      },
    ],
  },
  {
    slug: "first-time",
    title: "第一次买",
    shortLabel: "第一次买",
    summary: "先决定路线，再看预算和约束，少走弯路。",
    accent: "indigo",
    featuredSectionIds: ["first-route", "first-budget", "first-pitfalls"],
    sections: [
      {
        id: "first-route",
        title: "先看刺激路线，不先看营销词",
        summary: "路线不对，参数再漂亮也不一定适合。",
        body: ["先判断是外部、入体还是复合，再考虑品牌和造型。"],
      },
      {
        id: "first-budget",
        title: "预算不是越高越对",
        summary: "第一台更该验证方向，而不是一步到顶。",
        body: ["入门预算适合试方向，中段预算适合平衡体验与稳定性。"],
      },
      {
        id: "first-pitfalls",
        title: "新手最常踩的坑",
        summary: "过分追求强刺激、忽视清洁、忽视静音都很常见。",
        body: ["第一台要优先看可接受度和复用率，而不是极端参数。"],
      },
    ],
  },
  {
    slug: "couples",
    title: "情侣共玩",
    shortLabel: "情侣共玩",
    summary: "真正重要的是互动节奏、环境和沟通方式。",
    accent: "cyan",
    featuredSectionIds: ["couples-scene", "couples-remote", "couples-boundary"],
    sections: [
      {
        id: "couples-scene",
        title: "先定义互动场景",
        summary: "安静、日常、玩乐感强，方向完全不同。",
        body: ["场景比参数更先决定共玩体验是不是顺。"],
      },
      {
        id: "couples-remote",
        title: "远控不是必选项",
        summary: "远控更适合某些互动方式，不是所有情侣都需要。",
        body: ["如果更重现场配合，贴合感和静音往往比远控更优先。"],
      },
      {
        id: "couples-boundary",
        title: "边界与节奏沟通",
        summary: "共玩体验的稳定感来自协同，不只来自设备。",
        body: ["共玩前先说清楚偏好和不适边界，通常能减少挫败感。"],
      },
    ],
  },
  {
    slug: "care",
    title: "清洁维护",
    shortLabel: "清洁维护",
    summary: "清洁、收纳和维护决定长期可用性。",
    accent: "sky",
    featuredSectionIds: ["care-clean", "care-storage", "care-waterproof"],
    sections: [
      {
        id: "care-clean",
        title: "材质不同，清洁方式不同",
        summary: "不要用一个方法处理所有材质。",
        body: ["先确认材质和接口结构，再决定冲洗或擦拭方式。"],
      },
      {
        id: "care-storage",
        title: "收纳不是附属问题",
        summary: "收纳压力大会直接影响复用率。",
        body: ["高伪装和低存在感方案通常能提升长期保留意愿。"],
      },
      {
        id: "care-waterproof",
        title: "防水等级要看清边界",
        summary: "可水洗不等于所有部位都能直接冲。",
        body: ["接口、充电口和结构拼接处都需要按说明处理。"],
      },
    ],
  },
];

export function getKnowledgeNebulaTopicBySlug(
  slug: string | null | undefined,
) {
  return KNOWLEDGE_NEBULA_TOPICS.find((topic) => topic.slug === slug);
}
```

`src/lib/knowledge-nebula-route.ts`

```ts
import {
  KNOWLEDGE_NEBULA_TOPICS,
  type KnowledgeNebulaTopicSlug,
  getKnowledgeNebulaTopicBySlug,
} from "../data/knowledge-nebula.ts";

export type KnowledgeNebulaRouteState = {
  route: "/knowledge";
  topicSlug?: KnowledgeNebulaTopicSlug;
};

const KNOWLEDGE_BASE_PATH = "/knowledge";

export function buildKnowledgeNebulaPath(topicSlug?: KnowledgeNebulaTopicSlug) {
  return topicSlug ? `${KNOWLEDGE_BASE_PATH}/${topicSlug}` : KNOWLEDGE_BASE_PATH;
}

export function parseKnowledgeNebulaPath(pathname: string): KnowledgeNebulaRouteState {
  const normalized = String(pathname || "").replace(/\/+$/, "") || "/";
  if (normalized === KNOWLEDGE_BASE_PATH) {
    return { route: "/knowledge", topicSlug: undefined };
  }

  const prefix = `${KNOWLEDGE_BASE_PATH}/`;
  if (!normalized.startsWith(prefix)) {
    return { route: "/knowledge", topicSlug: undefined };
  }

  const candidate = normalized.slice(prefix.length);
  const topic = getKnowledgeNebulaTopicBySlug(candidate);
  return { route: "/knowledge", topicSlug: topic?.slug };
}

export const KNOWLEDGE_NEBULA_TOPIC_SLUGS = KNOWLEDGE_NEBULA_TOPICS.map(
  (topic) => topic.slug,
);
```

`src/lib/app-shell.ts`

```ts
export type AppRoute = "/" | "/quiz" | "/results" | "/library" | "/knowledge";

export function detectRoute(pathname: string): AppRoute {
  if (pathname.startsWith("/knowledge")) return "/knowledge";
  if (pathname === "/library") return "/library";
  if (pathname === "/results") return "/results";
  if (pathname === "/quiz") return "/quiz";
  return "/";
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
node --loader ts-node/esm --test src/lib/knowledge-nebula-route.test.ts
```

Expected:

- PASS with 4 passing tests

- [ ] **Step 5: Review the checkpoint diff**

Run:

```bash
git diff -- src/data/knowledge-nebula.ts src/lib/knowledge-nebula-route.ts src/lib/knowledge-nebula-route.test.ts src/lib/app-shell.ts
```

Expected:

- Only the new knowledge topic model, route helper, tests, and `AppRoute` expansion appear

---

### Task 2: Build the nebula shard layout engine with desktop/mobile-safe positioning

**Files:**
- Create: `src/lib/knowledge-nebula-field.ts`
- Test: `src/lib/knowledge-nebula-field.test.ts`

- [ ] **Step 1: Write the failing layout tests**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildKnowledgeNebulaShards,
  type KnowledgeNebulaViewport,
} from "./knowledge-nebula-field.ts";
import { KNOWLEDGE_NEBULA_TOPICS } from "../data/knowledge-nebula.ts";

function getTopicSlugs() {
  return KNOWLEDGE_NEBULA_TOPICS.map((topic) => topic.slug);
}

test("buildKnowledgeNebulaShards returns one shard per topic on desktop", () => {
  const items = buildKnowledgeNebulaShards({
    topicSlugs: getTopicSlugs(),
    viewport: "desktop",
  });

  assert.equal(items.length, 5);
  assert.ok(items.every((item) => item.viewport === "desktop"));
});

test("buildKnowledgeNebulaShards keeps mobile shards inside a safer central band", () => {
  const items = buildKnowledgeNebulaShards({
    topicSlugs: getTopicSlugs(),
    viewport: "mobile",
  });

  assert.equal(items.length, 5);
  assert.ok(items.every((item) => item.x >= 12 && item.x <= 88));
  assert.ok(items.every((item) => item.y >= 14 && item.y <= 82));
});

test("buildKnowledgeNebulaShards assigns mixed depth and phase timing", () => {
  const items = buildKnowledgeNebulaShards({
    topicSlugs: getTopicSlugs(),
    viewport: "desktop",
  });

  assert.ok(new Set(items.map((item) => item.depth)).size >= 2);
  assert.ok(items[0].revealDelayMs < items[4].revealDelayMs);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
node --loader ts-node/esm --test src/lib/knowledge-nebula-field.test.ts
```

Expected:

- FAIL because `knowledge-nebula-field.ts` does not exist yet

- [ ] **Step 3: Write the minimal shard-layout implementation**

`src/lib/knowledge-nebula-field.ts`

```ts
import type { KnowledgeNebulaTopicSlug } from "../data/knowledge-nebula.ts";

export type KnowledgeNebulaViewport = "desktop" | "mobile";
export type KnowledgeNebulaShardDepth = "near" | "mid" | "far";
export type KnowledgeNebulaShardShape =
  | "nebula-shard-a"
  | "nebula-shard-b"
  | "nebula-shard-c"
  | "nebula-shard-d";

export type KnowledgeNebulaShard = {
  topicSlug: KnowledgeNebulaTopicSlug;
  viewport: KnowledgeNebulaViewport;
  x: number;
  y: number;
  z: number;
  rotateX: number;
  rotateY: number;
  depth: KnowledgeNebulaShardDepth;
  shape: KnowledgeNebulaShardShape;
  revealDelayMs: number;
};

const DESKTOP_LAYOUT = [
  { x: 14, y: 18, z: -14, rotateX: -7, rotateY: 10, depth: "far" },
  { x: 76, y: 16, z: 10, rotateX: 6, rotateY: -10, depth: "near" },
  { x: 22, y: 48, z: 8, rotateX: -4, rotateY: 8, depth: "mid" },
  { x: 70, y: 54, z: -10, rotateX: 5, rotateY: -7, depth: "far" },
  { x: 40, y: 76, z: 12, rotateX: -3, rotateY: 5, depth: "near" },
];

const MOBILE_LAYOUT = [
  { x: 18, y: 20, z: -8, rotateX: -4, rotateY: 7, depth: "far" },
  { x: 58, y: 18, z: 8, rotateX: 4, rotateY: -7, depth: "near" },
  { x: 14, y: 46, z: 4, rotateX: -3, rotateY: 5, depth: "mid" },
  { x: 56, y: 48, z: -4, rotateX: 4, rotateY: -5, depth: "far" },
  { x: 34, y: 72, z: 10, rotateX: -2, rotateY: 4, depth: "near" },
];

const SHAPES: KnowledgeNebulaShardShape[] = [
  "nebula-shard-a",
  "nebula-shard-b",
  "nebula-shard-c",
  "nebula-shard-d",
];

export function buildKnowledgeNebulaShards({
  topicSlugs,
  viewport,
}: {
  topicSlugs: KnowledgeNebulaTopicSlug[];
  viewport: KnowledgeNebulaViewport;
}) {
  const layout = viewport === "mobile" ? MOBILE_LAYOUT : DESKTOP_LAYOUT;

  return topicSlugs.slice(0, layout.length).map((topicSlug, index) => ({
    topicSlug,
    viewport,
    ...layout[index],
    shape: SHAPES[index % SHAPES.length],
    revealDelayMs: 180 + index * 110,
  }));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
node --loader ts-node/esm --test src/lib/knowledge-nebula-field.test.ts
```

Expected:

- PASS with 3 passing tests

- [ ] **Step 5: Review the checkpoint diff**

Run:

```bash
git diff -- src/lib/knowledge-nebula-field.ts src/lib/knowledge-nebula-field.test.ts
```

Expected:

- Only the deterministic shard layout generator and its tests appear

---

### Task 3: Build the knowledge nebula page and components

**Files:**
- Create: `src/components/KnowledgeNebulaField.tsx`
- Create: `src/components/KnowledgeNebulaTopicNav.tsx`
- Create: `src/components/KnowledgeNebulaTopicSections.tsx`
- Create: `src/pages/KnowledgeNebulaPage.tsx`

- [ ] **Step 1: Sketch the component contracts before implementation**

Use these component signatures as the target API:

```tsx
export function KnowledgeNebulaField({
  topics,
  selectedTopicSlug,
  onSelectTopic,
}: {
  topics: KnowledgeNebulaTopic[];
  selectedTopicSlug?: KnowledgeNebulaTopicSlug;
  onSelectTopic: (slug: KnowledgeNebulaTopicSlug) => void;
}) {}

export function KnowledgeNebulaTopicNav({
  topics,
  currentTopicSlug,
  onSelectTopic,
}: {
  topics: KnowledgeNebulaTopic[];
  currentTopicSlug: KnowledgeNebulaTopicSlug;
  onSelectTopic: (slug: KnowledgeNebulaTopicSlug) => void;
}) {}

export function KnowledgeNebulaTopicSections({
  topic,
}: {
  topic: KnowledgeNebulaTopic;
}) {}
```

- [ ] **Step 2: Implement the hub field with “whole cloud -> loosen -> settle” animation**

`src/components/KnowledgeNebulaField.tsx`

```tsx
import { motion, useReducedMotion } from "motion/react";
import {
  buildKnowledgeNebulaShards,
  type KnowledgeNebulaViewport,
} from "../lib/knowledge-nebula-field.ts";
import type {
  KnowledgeNebulaTopic,
  KnowledgeNebulaTopicSlug,
} from "../data/knowledge-nebula.ts";

function getViewport(): KnowledgeNebulaViewport {
  return window.innerWidth < 768 ? "mobile" : "desktop";
}

export function KnowledgeNebulaField({
  topics,
  selectedTopicSlug,
  onSelectTopic,
}: {
  topics: KnowledgeNebulaTopic[];
  selectedTopicSlug?: KnowledgeNebulaTopicSlug;
  onSelectTopic: (slug: KnowledgeNebulaTopicSlug) => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const viewport = typeof window === "undefined" ? "desktop" : getViewport();
  const shards = buildKnowledgeNebulaShards({
    topicSlugs: topics.map((topic) => topic.slug),
    viewport,
  });

  return (
    <div className="relative min-h-[520px] overflow-hidden rounded-[32px] border border-cyan-400/10 bg-[#07111f]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(34,211,238,0.18),transparent_24%),radial-gradient(circle_at_22%_28%,rgba(99,102,241,0.16),transparent_22%),radial-gradient(circle_at_70%_70%,rgba(6,182,212,0.14),transparent_26%)]" />

      <motion.div
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0.92, scale: 0.92, filter: "blur(18px)" }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: prefersReducedMotion ? 0.2 : 0.8, ease: "easeOut" }}
        className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300/10 shadow-[0_0_120px_rgba(34,211,238,0.28)]"
      />

      {shards.map((shard) => {
        const topic = topics.find((item) => item.slug === shard.topicSlug);
        if (!topic) return null;

        const isActive = topic.slug === selectedTopicSlug;
        return (
          <motion.button
            key={topic.slug}
            type="button"
            onClick={() => onSelectTopic(topic.slug)}
            initial={
              prefersReducedMotion
                ? { opacity: 1 }
                : { opacity: 0, x: "-50%", y: "-50%", scale: 0.8, filter: "blur(12px)" }
            }
            animate={{
              opacity: isActive ? 1 : 0.9,
              x: "-50%",
              y: "-50%",
              left: `${shard.x}%`,
              top: `${shard.y}%`,
              scale: isActive ? 1.06 : 1,
              filter: "blur(0px)",
              rotateX: shard.rotateX,
              rotateY: shard.rotateY,
              z: shard.z,
            }}
            transition={{
              duration: prefersReducedMotion ? 0.2 : 1.05,
              delay: prefersReducedMotion ? 0 : shard.revealDelayMs / 1000,
              ease: "easeOut",
            }}
            className="absolute min-w-[120px] rounded-[22px] border border-cyan-300/15 bg-slate-950/60 px-4 py-3 text-left text-slate-100 backdrop-blur-xl"
          >
            <div className="text-sm font-medium tracking-[0.08em]">{topic.shortLabel}</div>
            <div className="mt-1 text-xs leading-5 text-slate-300/80">{topic.summary}</div>
          </motion.button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Implement the detail navigation and mixed content layout**

`src/components/KnowledgeNebulaTopicNav.tsx`

```tsx
import type {
  KnowledgeNebulaTopic,
  KnowledgeNebulaTopicSlug,
} from "../data/knowledge-nebula.ts";

export function KnowledgeNebulaTopicNav({
  topics,
  currentTopicSlug,
  onSelectTopic,
}: {
  topics: KnowledgeNebulaTopic[];
  currentTopicSlug: KnowledgeNebulaTopicSlug;
  onSelectTopic: (slug: KnowledgeNebulaTopicSlug) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {topics.map((topic) => {
        const active = topic.slug === currentTopicSlug;
        return (
          <button
            key={topic.slug}
            type="button"
            onClick={() => onSelectTopic(topic.slug)}
            className={
              active
                ? "rounded-full border border-cyan-300/40 bg-cyan-300/14 px-3 py-1.5 text-xs text-cyan-50"
                : "rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300"
            }
          >
            {topic.shortLabel}
          </button>
        );
      })}
    </div>
  );
}
```

`src/components/KnowledgeNebulaTopicSections.tsx`

```tsx
import type { KnowledgeNebulaTopic } from "../data/knowledge-nebula.ts";

export function KnowledgeNebulaTopicSections({ topic }: { topic: KnowledgeNebulaTopic }) {
  const featuredSections = topic.featuredSectionIds
    .map((id) => topic.sections.find((section) => section.id === id))
    .filter((section): section is NonNullable<typeof section> => Boolean(section));

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-3">
        {featuredSections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="rounded-[24px] border border-cyan-300/10 bg-slate-950/45 p-5 text-left"
          >
            <div className="text-sm font-medium text-white">{section.title}</div>
            <div className="mt-2 text-sm leading-6 text-slate-300/80">
              {section.summary}
            </div>
          </a>
        ))}
      </div>

      <div className="space-y-6">
        {topic.sections.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className="rounded-[28px] border border-white/8 bg-white/5 p-6"
          >
            <h3 className="text-lg font-medium text-white">{section.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300/82">{section.summary}</p>
            <div className="mt-4 space-y-3 text-sm leading-7 text-slate-200/82">
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
```

`src/pages/KnowledgeNebulaPage.tsx`

```tsx
import { motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import {
  KNOWLEDGE_NEBULA_TOPICS,
  type KnowledgeNebulaTopicSlug,
  getKnowledgeNebulaTopicBySlug,
} from "../data/knowledge-nebula.ts";
import { KnowledgeNebulaField } from "../components/KnowledgeNebulaField";
import { KnowledgeNebulaTopicNav } from "../components/KnowledgeNebulaTopicNav";
import { KnowledgeNebulaTopicSections } from "../components/KnowledgeNebulaTopicSections";

export function KnowledgeNebulaPage({
  pageVariants,
  topicSlug,
  onBack,
  onSelectTopic,
}: {
  pageVariants: any;
  topicSlug?: KnowledgeNebulaTopicSlug;
  onBack: () => void;
  onSelectTopic: (slug?: KnowledgeNebulaTopicSlug) => void;
}) {
  const topic = topicSlug ? getKnowledgeNebulaTopicBySlug(topicSlug) : undefined;

  return (
    <motion.div
      key={topicSlug ? `knowledge-${topicSlug}` : "knowledge-hub"}
      variants={pageVariants}
      initial="initial"
      animate="in"
      exit="out"
      className="w-full space-y-6"
    >
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-cyan-300 hover:text-cyan-200"
      >
        <ArrowLeft className="h-4 w-4" />
        返回指挥舱
      </button>

      {!topic ? (
        <KnowledgeNebulaField
          topics={KNOWLEDGE_NEBULA_TOPICS}
          onSelectTopic={(slug) => onSelectTopic(slug)}
        />
      ) : (
        <div className="space-y-6">
          <div className="rounded-[30px] border border-cyan-300/10 bg-slate-950/45 p-6">
            <p className="text-[11px] tracking-[0.22em] text-cyan-300/70">KNOWLEDGE NEBULA</p>
            <h1 className="mt-2 text-3xl font-light text-white">{topic.title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300/82">
              {topic.summary}
            </p>
            <div className="mt-5">
              <KnowledgeNebulaTopicNav
                topics={KNOWLEDGE_NEBULA_TOPICS}
                currentTopicSlug={topic.slug}
                onSelectTopic={(slug) => onSelectTopic(slug)}
              />
            </div>
          </div>

          <KnowledgeNebulaTopicSections topic={topic} />
        </div>
      )}
    </motion.div>
  );
}
```

- [ ] **Step 4: Verify the new page compiles cleanly**

Run:

```bash
npm run lint
```

Expected:

- PASS with no TypeScript errors from the new knowledge components

- [ ] **Step 5: Review the checkpoint diff**

Run:

```bash
git diff -- src/components/KnowledgeNebulaField.tsx src/components/KnowledgeNebulaTopicNav.tsx src/components/KnowledgeNebulaTopicSections.tsx src/pages/KnowledgeNebulaPage.tsx
```

Expected:

- Only the new knowledge hub/detail components appear

---

### Task 4: Wire the new route into the app shell and polish responsive behavior

**Files:**
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/pages/KnowledgeNebulaPage.tsx`

- [ ] **Step 1: Add the homepage entry callback and button**

`src/pages/HomePage.tsx`

```tsx
import { Orbit, ChevronRight, ShieldCheck, Zap, Sparkles } from "lucide-react";

export function HomePage({
  pageVariants,
  onStart,
  onBrowseLibrary,
  onOpenKnowledgeNebula,
}: {
  pageVariants: any;
  onStart: () => void;
  onBrowseLibrary: () => void;
  onOpenKnowledgeNebula: () => void;
}) {
  return (
    <>
      {/* existing content */}
      <button
        onClick={onOpenKnowledgeNebula}
        className="w-full py-4 mt-4 rounded-2xl bg-slate-950/30 hover:bg-slate-900/44 border border-cyan-300/20 text-cyan-100 transition-all text-sm tracking-widest flex items-center justify-center gap-2"
      >
        <Sparkles className="h-4 w-4" />
        知识星云
      </button>
    </>
  );
}
```

- [ ] **Step 2: Track the selected knowledge topic in `App.tsx` and render the new page**

`src/App.tsx`

```tsx
import { KnowledgeNebulaPage } from "./pages/KnowledgeNebulaPage";
import {
  buildKnowledgeNebulaPath,
  parseKnowledgeNebulaPath,
} from "./lib/knowledge-nebula-route";
import type { KnowledgeNebulaTopicSlug } from "./data/knowledge-nebula";

const [selectedKnowledgeTopicSlug, setSelectedKnowledgeTopicSlug] = useState<
  KnowledgeNebulaTopicSlug | undefined
>(() => parseKnowledgeNebulaPath(window.location.pathname).topicSlug);

useEffect(() => {
  if (currentRoute === "/knowledge") {
    setSelectedKnowledgeTopicSlug(
      parseKnowledgeNebulaPath(window.location.pathname).topicSlug,
    );
  }
}, [currentRoute]);

function navigateToKnowledgeNebula(topicSlug?: KnowledgeNebulaTopicSlug) {
  const nextPath = buildKnowledgeNebulaPath(topicSlug);
  if (window.location.pathname !== nextPath) {
    window.history.pushState({}, "", nextPath);
  }
  setSelectedKnowledgeTopicSlug(topicSlug);
  setCurrentRoute("/knowledge");
  window.scrollTo({ top: 0, behavior: "auto" });
}
```

Add the route render:

```tsx
{currentRoute === "/" && (
  <HomePage
    pageVariants={pageVariants}
    onStart={() => {
      setStep(0);
      navigateTo("/quiz");
    }}
    onBrowseLibrary={() => {
      navigateTo("/library");
    }}
    onOpenKnowledgeNebula={() => {
      navigateToKnowledgeNebula();
    }}
  />
)}

{currentRoute === "/knowledge" && (
  <KnowledgeNebulaPage
    pageVariants={pageVariants}
    topicSlug={selectedKnowledgeTopicSlug}
    onBack={() => navigateTo("/")}
    onSelectTopic={(slug) => navigateToKnowledgeNebula(slug)}
  />
)}
```

Adjust shell width handling:

```tsx
const shellContainerClassName =
  currentRoute === "/results" || currentRoute === "/knowledge"
    ? "max-w-6xl"
    : currentRoute === "/quiz" && step === activeQuestions.length
      ? "max-w-none"
      : "max-w-md";
```

- [ ] **Step 3: Add mobile-first containment polish to the knowledge page**

Use the following responsive constraints in `src/pages/KnowledgeNebulaPage.tsx` and `src/components/KnowledgeNebulaField.tsx`:

```tsx
className="relative min-h-[460px] sm:min-h-[520px] overflow-hidden rounded-[28px] sm:rounded-[32px]"
```

```tsx
className="absolute min-w-[112px] max-w-[148px] sm:min-w-[120px] sm:max-w-[180px]"
```

```tsx
className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
```

These limits are intentional:

- mobile shards stay inside the central safe band
- desktop gains more breathing room without text clipping
- detail cards remain readable before the layout reaches large screens

- [ ] **Step 4: Run the full focused verification set**

Run:

```bash
node --loader ts-node/esm --test src/lib/knowledge-nebula-route.test.ts src/lib/knowledge-nebula-field.test.ts
npm run lint
npm run build
git diff --check
```

Expected:

- All tests PASS
- `npm run lint` exits 0
- `npm run build` exits 0
- `git diff --check` prints no whitespace errors

- [ ] **Step 5: Manual browser verification checkpoint**

Run:

```bash
npm run dev
```

Verify in the browser:

- homepage shows a third “知识星云” entry
- `/knowledge` opens the whole-cloud-to-shards hub
- `/knowledge/first-time` opens the first-time-buy detail page
- desktop shards feel spread out without becoming “一坨”
- mobile layout keeps all labels fully visible and easy to tap

If the user has not requested a commit, stop after this checkpoint and report the verification results plus any remaining polish gaps.

---

## Self-Review

### Spec coverage

- Third homepage entry: covered in Task 4
- New route family and category detail routing: covered in Tasks 1 and 4
- Five-topic constellation: covered in Task 1
- Whole-cloud -> loosen -> settle entry animation: covered in Task 3
- Mixed “featured blocks + long-form content” topic layout: covered in Task 3
- Desktop/mobile split behavior: covered in Tasks 2 and 4
- Light 3D / particle-space feel without heavy 3D engine: covered in Task 3

No uncovered spec sections remain for first-version scope.

### Placeholder scan

- No `TBD` / `TODO`
- No “implement later”
- No unnamed files
- No generic “write tests” steps without concrete test code

### Type consistency

- Topic slug type is `KnowledgeNebulaTopicSlug` everywhere
- Route family uses `/knowledge` everywhere
- Hub/detail selection always flows through `topicSlug?: KnowledgeNebulaTopicSlug`

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-29-knowledge-nebula.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
