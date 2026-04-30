# Knowledge Nebula R3F Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the `/knowledge` hub from a Motion-based shard field into a true deep-space nebula scene with a mother-cloud entrance, five floating topic clouds, and a focus-camera transition into topic detail pages.

**Architecture:** Keep the existing knowledge data, routes, and detail-page content intact. Replace the hub-only rendering path with a hybrid stack: a `three` / `@react-three/fiber` scene for volumetric-feeling cloud bodies and depth, plus a DOM label layer for readable always-on topic titles and larger click targets. Reuse the current `KnowledgeNebulaField` and `KnowledgeNebulaPage` entry points so the rest of the app routing stays stable.

**Tech Stack:** React 19, TypeScript, `three`, `@react-three/fiber`, `@react-three/drei`, `motion/react`, Tailwind, Node test runner with `ts-node/esm`

---

## File Structure

### New files

- `src/components/knowledge-nebula/NebulaScene3D.tsx`
  Owns the R3F canvas, camera rig, fog, particle field, and topic-cloud scene graph.
- `src/components/knowledge-nebula/NebulaCluster.tsx`
  Renders one topic cloud using layered soft sprites, depth-aware drift, and selected-state brightening.
- `src/components/knowledge-nebula/NebulaLabelLayer.tsx`
  Renders always-visible DOM topic labels and click targets aligned to the scene anchors.

### Modified files

- `package.json`
  Adds the `three`, `@react-three/fiber`, and `@react-three/drei` dependencies.
- `package-lock.json`
  Captures the resolved dependency tree.
- `src/lib/knowledge-nebula-field.ts`
  Replaces shard-card layout helpers with topic-cloud anchor, camera, and timeline helpers for desktop/mobile.
- `src/lib/knowledge-nebula-field.test.ts`
  Verifies anchor spread, mobile-safe bounds, center breathing room, and focus-camera helpers.
- `src/components/KnowledgeNebulaField.tsx`
  Becomes the hub orchestrator that drives `aggregate -> split -> idle -> focus`, viewport switching, and delayed route transition.
- `src/pages/KnowledgeNebulaPage.tsx`
  Updates hub copy to match the new “5 团主题云” interaction and keeps the detail page path unchanged.

### Verification targets

- `node --loader ts-node/esm --test src/lib/knowledge-nebula-field.test.ts`
- `npm run lint`
- `npm run build`
- Manual browser check on `/knowledge` desktop and mobile widths

### Execution note

This repo preference is “do not auto-commit unless the user explicitly asks.” During execution, replace commit steps with checkpoint reviews.

---

### Task 1: Replace shard layout helpers with nebula anchor helpers

**Files:**
- Modify: `src/lib/knowledge-nebula-field.ts`
- Modify: `src/lib/knowledge-nebula-field.test.ts`

- [ ] **Step 1: Rewrite the failing helper tests for the new scene model**

`src/lib/knowledge-nebula-field.test.ts`

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { KNOWLEDGE_NEBULA_TOPICS } from "../data/knowledge-nebula.ts";
import {
  DEFAULT_KNOWLEDGE_NEBULA_CAMERA,
  buildKnowledgeNebulaClusterAnchors,
  buildKnowledgeNebulaFocusCamera,
  getKnowledgeNebulaTimeline,
} from "./knowledge-nebula-field.ts";

const topicSlugs = KNOWLEDGE_NEBULA_TOPICS.map((topic) => topic.slug);

test("buildKnowledgeNebulaClusterAnchors returns one anchor per topic in topic order", () => {
  const anchors = buildKnowledgeNebulaClusterAnchors({
    topicSlugs,
    viewport: "desktop",
  });

  assert.equal(anchors.length, topicSlugs.length);
  assert.deepEqual(
    anchors.map((anchor) => anchor.topicSlug),
    topicSlugs,
  );
});

test("mobile anchors stay inside readable label-safe bounds", () => {
  const anchors = buildKnowledgeNebulaClusterAnchors({
    topicSlugs,
    viewport: "mobile",
  });

  assert.ok(anchors.every((anchor) => anchor.xPercent >= 16 && anchor.xPercent <= 84));
  assert.ok(anchors.every((anchor) => anchor.yPercent >= 20 && anchor.yPercent <= 80));
  assert.ok(anchors.every((anchor) => anchor.labelWidthRem >= 7.5));
});

test("desktop anchors preserve a center breathing zone and mixed depth", () => {
  const anchors = buildKnowledgeNebulaClusterAnchors({
    topicSlugs,
    viewport: "desktop",
  });

  assert.ok(
    anchors.every((anchor) => {
      const awayFromCenterX = Math.abs(anchor.xPercent - 50) >= 8;
      const awayFromCenterY = Math.abs(anchor.yPercent - 50) >= 10;
      return awayFromCenterX || awayFromCenterY;
    }),
  );

  assert.ok(new Set(anchors.map((anchor) => anchor.depth)).size >= 3);
});

test("buildKnowledgeNebulaFocusCamera pushes the camera toward the selected cloud", () => {
  const anchor = buildKnowledgeNebulaClusterAnchors({
    topicSlugs,
    viewport: "desktop",
  })[2];

  const focusCamera = buildKnowledgeNebulaFocusCamera(anchor);

  assert.notDeepEqual(focusCamera.position, DEFAULT_KNOWLEDGE_NEBULA_CAMERA.position);
  assert.deepEqual(focusCamera.target, anchor.position);
  assert.ok(focusCamera.position[2] < DEFAULT_KNOWLEDGE_NEBULA_CAMERA.position[2]);
});

test("getKnowledgeNebulaTimeline compacts timings for reduced motion", () => {
  const normal = getKnowledgeNebulaTimeline(false);
  const reduced = getKnowledgeNebulaTimeline(true);

  assert.ok(normal.aggregateMs > reduced.aggregateMs);
  assert.ok(normal.focusMs > reduced.focusMs);
});
```

- [ ] **Step 2: Run the helper test and confirm it fails against the old shard API**

Run:

```bash
node --loader ts-node/esm --test src/lib/knowledge-nebula-field.test.ts
```

Expected:

- FAIL with missing exports such as `buildKnowledgeNebulaClusterAnchors`

- [ ] **Step 3: Replace the old shard helper implementation with anchor, timeline, and camera helpers**

`src/lib/knowledge-nebula-field.ts`

```ts
import type { KnowledgeNebulaTopicSlug } from "../data/knowledge-nebula.ts";

export type KnowledgeNebulaViewport = "desktop" | "mobile";
export type KnowledgeNebulaClusterDepth = "near" | "mid" | "far";

export type KnowledgeNebulaClusterAnchor = {
  topicSlug: KnowledgeNebulaTopicSlug;
  viewport: KnowledgeNebulaViewport;
  xPercent: number;
  yPercent: number;
  position: [number, number, number];
  scale: number;
  depth: KnowledgeNebulaClusterDepth;
  driftAmplitude: number;
  splitDelayMs: number;
  labelWidthRem: number;
};

export type KnowledgeNebulaCameraState = {
  position: [number, number, number];
  target: [number, number, number];
};

export type KnowledgeNebulaTimeline = {
  aggregateMs: number;
  splitMs: number;
  focusMs: number;
};

const DESKTOP_LAYOUTS = [
  { xPercent: 18, yPercent: 28, position: [-5.4, 1.8, -2.2], scale: 1.04, depth: "far", driftAmplitude: 0.18, splitDelayMs: 120, labelWidthRem: 9 },
  { xPercent: 32, yPercent: 62, position: [-2.9, -1.7, -0.7], scale: 1.18, depth: "mid", driftAmplitude: 0.22, splitDelayMs: 280, labelWidthRem: 10 },
  { xPercent: 50, yPercent: 36, position: [0, 1.1, 1.1], scale: 1.42, depth: "near", driftAmplitude: 0.26, splitDelayMs: 420, labelWidthRem: 11 },
  { xPercent: 69, yPercent: 60, position: [3.2, -1.4, 0.2], scale: 1.2, depth: "mid", driftAmplitude: 0.21, splitDelayMs: 560, labelWidthRem: 10 },
  { xPercent: 82, yPercent: 31, position: [5.7, 1.6, -1.8], scale: 1.06, depth: "far", driftAmplitude: 0.17, splitDelayMs: 700, labelWidthRem: 9.25 },
] as const;

const MOBILE_LAYOUTS = [
  { xPercent: 24, yPercent: 29, position: [-3.5, 1.5, -1.6], scale: 0.92, depth: "far", driftAmplitude: 0.12, splitDelayMs: 120, labelWidthRem: 7.75 },
  { xPercent: 33, yPercent: 61, position: [-1.9, -1.5, -0.3], scale: 1.02, depth: "mid", driftAmplitude: 0.15, splitDelayMs: 260, labelWidthRem: 8.1 },
  { xPercent: 50, yPercent: 39, position: [0, 0.8, 0.8], scale: 1.2, depth: "near", driftAmplitude: 0.18, splitDelayMs: 400, labelWidthRem: 8.5 },
  { xPercent: 67, yPercent: 60, position: [2.1, -1.3, -0.1], scale: 1.01, depth: "mid", driftAmplitude: 0.15, splitDelayMs: 540, labelWidthRem: 8.1 },
  { xPercent: 76, yPercent: 30, position: [3.7, 1.4, -1.3], scale: 0.9, depth: "far", driftAmplitude: 0.12, splitDelayMs: 680, labelWidthRem: 7.75 },
] as const;

export const DEFAULT_KNOWLEDGE_NEBULA_CAMERA: KnowledgeNebulaCameraState = {
  position: [0, 0, 11.8],
  target: [0, 0, 0],
};

export function buildKnowledgeNebulaClusterAnchors({
  topicSlugs,
  viewport,
}: {
  topicSlugs: KnowledgeNebulaTopicSlug[];
  viewport: KnowledgeNebulaViewport;
}): KnowledgeNebulaClusterAnchor[] {
  const layouts = viewport === "mobile" ? MOBILE_LAYOUTS : DESKTOP_LAYOUTS;

  if (topicSlugs.length > layouts.length) {
    throw new Error(`Knowledge nebula ${viewport} layout only supports ${layouts.length} topic clouds.`);
  }

  return topicSlugs.map((topicSlug, index) => ({
    topicSlug,
    viewport,
    ...layouts[index],
  }));
}

export function buildKnowledgeNebulaFocusCamera(
  anchor: KnowledgeNebulaClusterAnchor,
): KnowledgeNebulaCameraState {
  return {
    position: [
      anchor.position[0] * 0.34,
      anchor.position[1] * 0.26,
      6.2 + (anchor.depth === "near" ? 0.2 : anchor.depth === "mid" ? 0.55 : 0.9),
    ],
    target: anchor.position,
  };
}

export function getKnowledgeNebulaTimeline(
  prefersReducedMotion: boolean,
): KnowledgeNebulaTimeline {
  if (prefersReducedMotion) {
    return {
      aggregateMs: 120,
      splitMs: 160,
      focusMs: 180,
    };
  }

  return {
    aggregateMs: 980,
    splitMs: 1680,
    focusMs: 960,
  };
}
```

- [ ] **Step 4: Re-run the helper test and confirm the new model passes**

Run:

```bash
node --loader ts-node/esm --test src/lib/knowledge-nebula-field.test.ts
```

Expected:

- PASS for all `knowledge-nebula-field` tests

- [ ] **Step 5: Checkpoint review**

Review:

- Desktop and mobile anchors both return exactly 5 topic clouds
- The center gap exists around the mother-cloud split area
- Focus camera math is usable before any React work begins

---

### Task 2: Add the R3F nebula scene primitives

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/components/knowledge-nebula/NebulaCluster.tsx`
- Create: `src/components/knowledge-nebula/NebulaScene3D.tsx`

- [ ] **Step 1: Add the rendering dependencies**

Run:

```bash
npm install three @react-three/fiber @react-three/drei
```

Expected:

- `package.json` includes the new dependencies
- `package-lock.json` updates accordingly

Dependency section target in `package.json`:

```json
"dependencies": {
  "@react-three/drei": "^10.0.0",
  "@react-three/fiber": "^9.0.0",
  "three": "^0.179.0"
}
```

- [ ] **Step 2: Create the single-cloud renderer with layered soft sprites**

`src/components/knowledge-nebula/NebulaCluster.tsx`

```tsx
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, CanvasTexture, Group } from "three";
import type { KnowledgeNebulaClusterAnchor } from "../../lib/knowledge-nebula-field.ts";

const LAYERS = [
  { x: -0.7, y: 0.15, scale: 2.8, opacity: 0.24 },
  { x: -0.15, y: 0.5, scale: 2.2, opacity: 0.19 },
  { x: 0.48, y: 0.2, scale: 2.95, opacity: 0.22 },
  { x: 0.3, y: -0.38, scale: 2.35, opacity: 0.18 },
  { x: -0.44, y: -0.3, scale: 2.55, opacity: 0.16 },
];

const textureCache = new Map<string, CanvasTexture>();

function getNebulaTexture(key: string, color: string) {
  const cached = textureCache.get(key);
  if (cached) {
    return cached;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not create nebula sprite canvas context.");
  }

  const gradient = context.createRadialGradient(128, 128, 18, 128, 128, 128);
  gradient.addColorStop(0, "rgba(255,255,255,0.9)");
  gradient.addColorStop(0.22, color);
  gradient.addColorStop(0.62, "rgba(56,189,248,0.14)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);

  const texture = new CanvasTexture(canvas);
  textureCache.set(key, texture);
  return texture;
}

function getClusterTint(accent: "cyan" | "sky" | "indigo") {
  if (accent === "indigo") return "#9fb0ff";
  if (accent === "sky") return "#8fe6ff";
  return "#7bf9ff";
}

export function NebulaCluster({
  anchor,
  accent,
  phase,
  isFocused,
}: {
  anchor: KnowledgeNebulaClusterAnchor;
  accent: "cyan" | "sky" | "indigo";
  phase: "aggregate" | "split" | "idle" | "focus";
  isFocused: boolean;
}) {
  const groupRef = useRef<Group | null>(null);
  const texture = getNebulaTexture(accent, getClusterTint(accent));

  useFrame(({ clock }) => {
    if (!groupRef.current) return;

    const t = clock.getElapsedTime();
    const drift = anchor.driftAmplitude;
    const phaseLift = phase === "focus" && isFocused ? 0.16 : 0;

    groupRef.current.position.x = anchor.position[0] + Math.sin(t * 0.26 + anchor.position[1]) * drift;
    groupRef.current.position.y = anchor.position[1] + Math.cos(t * 0.22 + anchor.position[0]) * drift + phaseLift;
    groupRef.current.rotation.z = Math.sin(t * 0.15 + anchor.position[0]) * 0.06;
  });

  return (
    <group ref={groupRef} position={anchor.position} scale={anchor.scale}>
      {LAYERS.map((layer, index) => (
        <sprite
          key={`${anchor.topicSlug}-${index}`}
          position={[layer.x, layer.y, index * 0.04]}
          scale={[layer.scale, layer.scale, 1]}
        >
          <spriteMaterial
            map={texture}
            color={getClusterTint(accent)}
            transparent
            depthWrite={false}
            blending={AdditiveBlending}
            opacity={(isFocused ? 1.14 : 0.92) * layer.opacity}
          />
        </sprite>
      ))}
    </group>
  );
}
```

- [ ] **Step 3: Create the scene shell with camera rig, fog, and particle field**

`src/components/knowledge-nebula/NebulaScene3D.tsx`

```tsx
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import { Vector3 } from "three";
import type {
  KnowledgeNebulaCameraState,
  KnowledgeNebulaClusterAnchor,
} from "../../lib/knowledge-nebula-field.ts";
import { DEFAULT_KNOWLEDGE_NEBULA_CAMERA } from "../../lib/knowledge-nebula-field.ts";
import { NebulaCluster } from "./NebulaCluster.tsx";

const targetPosition = new Vector3();
const targetLookAt = new Vector3();

function CameraRig({
  cameraState,
}: {
  cameraState: KnowledgeNebulaCameraState;
}) {
  const { camera } = useThree();

  useFrame(() => {
    targetPosition.set(...cameraState.position);
    targetLookAt.set(...cameraState.target);
    camera.position.lerp(targetPosition, 0.06);
    camera.lookAt(targetLookAt);
  });

  return null;
}

export function NebulaScene3D({
  anchors,
  accentBySlug,
  phase,
  focusedTopicSlug,
  viewport,
  cameraState = DEFAULT_KNOWLEDGE_NEBULA_CAMERA,
}: {
  anchors: KnowledgeNebulaClusterAnchor[];
  accentBySlug: Map<string, "cyan" | "sky" | "indigo">;
  phase: "aggregate" | "split" | "idle" | "focus";
  focusedTopicSlug?: string;
  viewport: "desktop" | "mobile";
  cameraState?: KnowledgeNebulaCameraState;
}) {
  return (
    <Canvas
      dpr={viewport === "mobile" ? [1, 1.35] : [1, 1.8]}
      camera={{ position: DEFAULT_KNOWLEDGE_NEBULA_CAMERA.position, fov: viewport === "mobile" ? 40 : 34 }}
      className="absolute inset-0"
    >
      <color attach="background" args={["#020617"]} />
      <fog attach="fog" args={["#020617", 7, 18]} />
      <ambientLight intensity={0.9} />
      <pointLight position={[0, 0, 8]} intensity={0.8} color="#8eefff" />

      <CameraRig cameraState={cameraState} />

      <group rotation={[-0.08, 0, 0]}>
        {anchors.map((anchor) => (
          <NebulaCluster
            key={anchor.topicSlug}
            anchor={anchor}
            accent={accentBySlug.get(anchor.topicSlug) ?? "cyan"}
            phase={phase}
            isFocused={focusedTopicSlug === anchor.topicSlug}
          />
        ))}
      </group>

      <Sparkles
        count={viewport === "mobile" ? 42 : 88}
        size={viewport === "mobile" ? 2.2 : 3}
        scale={viewport === "mobile" ? [10, 6, 10] : [16, 10, 14]}
        speed={0.22}
        color="#c8f9ff"
      />
    </Canvas>
  );
}
```

- [ ] **Step 4: Run the typecheck to catch missing imports or incorrect R3F signatures early**

Run:

```bash
npm run lint
```

Expected:

- PASS, or a focused set of type errors only in the new nebula files that can be fixed before integration

- [ ] **Step 5: Checkpoint review**

Review:

- The scene can render without relying on external image assets
- Mobile DPR is capped lower than desktop
- Cluster code contains the cloud body logic, not `KnowledgeNebulaField`

---

### Task 3: Rebuild the hub orchestrator with DOM labels and focus navigation

**Files:**
- Create: `src/components/knowledge-nebula/NebulaLabelLayer.tsx`
- Modify: `src/components/KnowledgeNebulaField.tsx`
- Modify: `src/pages/KnowledgeNebulaPage.tsx`

- [ ] **Step 1: Create the DOM label layer aligned to cloud anchors**

`src/components/knowledge-nebula/NebulaLabelLayer.tsx`

```tsx
import type {
  KnowledgeNebulaTopic,
  KnowledgeNebulaTopicSlug,
} from "../../data/knowledge-nebula.ts";
import type { KnowledgeNebulaClusterAnchor } from "../../lib/knowledge-nebula-field.ts";

export function NebulaLabelLayer({
  anchors,
  topicsBySlug,
  focusedTopicSlug,
  onSelectTopic,
}: {
  anchors: KnowledgeNebulaClusterAnchor[];
  topicsBySlug: Map<KnowledgeNebulaTopicSlug, KnowledgeNebulaTopic>;
  focusedTopicSlug?: KnowledgeNebulaTopicSlug;
  onSelectTopic: (slug: KnowledgeNebulaTopicSlug) => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {anchors.map((anchor) => {
        const topic = topicsBySlug.get(anchor.topicSlug);
        if (!topic) return null;

        const isFocused = focusedTopicSlug === topic.slug;

        return (
          <button
            key={topic.slug}
            type="button"
            onClick={() => onSelectTopic(topic.slug)}
            className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-3 py-2 text-center transition-all duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80"
            style={{
              left: `${anchor.xPercent}%`,
              top: `${anchor.yPercent}%`,
              width: `${anchor.labelWidthRem}rem`,
            }}
          >
            <span className="block text-[10px] font-mono tracking-[0.22em] text-cyan-200/62">
              THEME CLOUD
            </span>
            <span
              className={`mt-1 block text-sm font-light tracking-[0.16em] ${
                isFocused ? "text-white" : "text-white/82"
              }`}
            >
              {topic.title}
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Replace the old shard-button hub with a phase-driven scene orchestrator**

Core target in `src/components/KnowledgeNebulaField.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type {
  KnowledgeNebulaTopic,
  KnowledgeNebulaTopicSlug,
} from "../data/knowledge-nebula.ts";
import {
  DEFAULT_KNOWLEDGE_NEBULA_CAMERA,
  buildKnowledgeNebulaClusterAnchors,
  buildKnowledgeNebulaFocusCamera,
  getKnowledgeNebulaTimeline,
  type KnowledgeNebulaCameraState,
  type KnowledgeNebulaViewport,
} from "../lib/knowledge-nebula-field.ts";
import { NebulaLabelLayer } from "./knowledge-nebula/NebulaLabelLayer.tsx";
import { NebulaScene3D } from "./knowledge-nebula/NebulaScene3D.tsx";

export function KnowledgeNebulaField({
  topics,
  onSelectTopic,
}: {
  topics: KnowledgeNebulaTopic[];
  selectedTopicSlug?: KnowledgeNebulaTopicSlug;
  onSelectTopic: (slug: KnowledgeNebulaTopicSlug) => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<"aggregate" | "split" | "idle" | "focus">("aggregate");
  const [focusedTopicSlug, setFocusedTopicSlug] = useState<KnowledgeNebulaTopicSlug>();
  const [viewport, setViewport] = useState<KnowledgeNebulaViewport>("desktop");
  const [cameraState, setCameraState] = useState<KnowledgeNebulaCameraState>(
    DEFAULT_KNOWLEDGE_NEBULA_CAMERA,
  );
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    const syncViewport = () => setViewport(window.innerWidth < 768 ? "mobile" : "desktop");
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  const timeline = getKnowledgeNebulaTimeline(Boolean(prefersReducedMotion));
  const anchors = useMemo(
    () =>
      buildKnowledgeNebulaClusterAnchors({
        topicSlugs: topics.map((topic) => topic.slug),
        viewport,
      }),
    [topics, viewport],
  );

  const topicsBySlug = useMemo(
    () => new Map(topics.map((topic) => [topic.slug, topic])),
    [topics],
  );

  useEffect(() => {
    timersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    timersRef.current = [
      window.setTimeout(() => setPhase("split"), timeline.aggregateMs),
      window.setTimeout(() => setPhase("idle"), timeline.aggregateMs + timeline.splitMs),
    ];

    return () => {
      timersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    };
  }, [timeline.aggregateMs, timeline.splitMs]);

  const handleSelect = (slug: KnowledgeNebulaTopicSlug) => {
    const anchor = anchors.find((item) => item.topicSlug === slug);
    if (!anchor) return;

    setFocusedTopicSlug(slug);
    setPhase("focus");
    setCameraState(buildKnowledgeNebulaFocusCamera(anchor));

    const timeoutId = window.setTimeout(() => onSelectTopic(slug), timeline.focusMs);
    timersRef.current.push(timeoutId);
  };

  return (
    <div className="relative isolate overflow-hidden rounded-[2rem] border border-cyan-500/15 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.14),transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,6,23,0.88))] px-4 py-8 shadow-[0_32px_120px_rgba(2,6,23,0.5)] sm:px-6 sm:py-10">
      <div className="relative z-10 mb-6 flex flex-col gap-3 text-center">
        <span className="mx-auto inline-flex items-center rounded-full border border-cyan-400/15 bg-cyan-400/8 px-3 py-1 text-[10px] font-mono tracking-[0.24em] text-cyan-200/75">
          KNOWLEDGE NEBULA
        </span>
        <h2 className="text-2xl font-light tracking-[0.24em] text-white sm:text-3xl">知识星云</h2>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-slate-300/88">
          先看到一整团母云，再缓慢散开成 5 团主题云。点击任意云团，沿着镜头推进进入对应详情。
        </p>
      </div>

      <div className="relative mx-auto h-[31rem] w-full max-w-5xl overflow-hidden rounded-[1.75rem] sm:h-[34rem]">
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300/10 blur-3xl"
          animate={phase === "aggregate" ? { opacity: [0.2, 0.75, 0.4], scale: [0.72, 1.06, 0.94] } : { opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.15 : timeline.aggregateMs / 1000, ease: "easeInOut" }}
        />

        <NebulaScene3D
          anchors={anchors}
          accentBySlug={new Map(topics.map((topic) => [topic.slug, topic.accent]))}
          phase={phase}
          focusedTopicSlug={focusedTopicSlug}
          viewport={viewport}
          cameraState={cameraState}
        />

        <NebulaLabelLayer
          anchors={anchors}
          topicsBySlug={topicsBySlug}
          focusedTopicSlug={focusedTopicSlug}
          onSelectTopic={handleSelect}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Adjust the hub-page copy so it matches the new cloud-only interaction**

Target change in `src/pages/KnowledgeNebulaPage.tsx`:

```tsx
<p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-300/86 sm:text-base">
  这是匹配向导之外的知识探索层。首页只展示 5 团主题云，点击后再进入对应主题的细分知识内容。
</p>
```

- [ ] **Step 4: Run the typecheck again after integration**

Run:

```bash
npm run lint
```

Expected:

- PASS with the new R3F field integrated into the existing page stack

- [ ] **Step 5: Checkpoint review**

Review:

- Titles stay always visible in the DOM layer
- Scene and click targets remain aligned on both viewport modes
- Route transition still happens through `onSelectTopic`, not a local router fork

---

### Task 4: Finish focus transition, trim old shard assumptions, and verify in browser

**Files:**
- Modify: `src/components/KnowledgeNebulaField.tsx`
- Modify: `src/pages/KnowledgeNebulaPage.tsx`
- Modify: `src/lib/knowledge-nebula-field.ts`

- [ ] **Step 1: Make focus transition cancel-safe and reset when returning from detail**

Target additions in `src/components/KnowledgeNebulaField.tsx`:

```tsx
useEffect(() => {
  return () => {
    timersRef.current.forEach((timerId) => window.clearTimeout(timerId));
  };
}, []);

useEffect(() => {
  setFocusedTopicSlug(undefined);
  setCameraState(DEFAULT_KNOWLEDGE_NEBULA_CAMERA);
  setPhase("aggregate");
}, [viewport]);
```

And guard repeated taps:

```tsx
const isFocusingRef = useRef(false);

const handleSelect = (slug: KnowledgeNebulaTopicSlug) => {
  if (isFocusingRef.current) return;

  const anchor = anchors.find((item) => item.topicSlug === slug);
  if (!anchor) return;

  isFocusingRef.current = true;
  setFocusedTopicSlug(slug);
  setPhase("focus");
  setCameraState(buildKnowledgeNebulaFocusCamera(anchor));

  const timeoutId = window.setTimeout(() => {
    onSelectTopic(slug);
    isFocusingRef.current = false;
  }, timeline.focusMs);

  timersRef.current.push(timeoutId);
};
```

- [ ] **Step 2: Remove leftover shard terminology from helper copy and types**

Target cleanup in `src/lib/knowledge-nebula-field.ts`:

```ts
throw new Error(`Knowledge nebula ${viewport} layout only supports ${layouts.length} topic clouds.`);
```

Target cleanup in `src/pages/KnowledgeNebulaPage.tsx` hub copy:

```tsx
<p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-300/86 sm:text-base">
  这是匹配向导之外的知识探索层。先在整片星云里锁定一团主题云，再进入对应知识区继续深入。
</p>
```

- [ ] **Step 3: Run the automated verification suite**

Run:

```bash
node --loader ts-node/esm --test src/lib/knowledge-nebula-field.test.ts
npm run lint
npm run build
```

Expected:

- PASS for the helper tests
- PASS for TypeScript
- PASS for production build

- [ ] **Step 4: Run a manual browser pass**

Check on `/knowledge`:

```text
Desktop:
- First load shows one central mother cloud before the five topic clouds settle into a shallow arc
- Titles remain readable and do not clip out of the visible area
- Clicking a cloud visibly pushes the camera forward before detail navigation

Mobile:
- The same five-cloud composition is visible with slightly lower density
- Labels stay readable without overlap
- No cloud title leaves the viewport bounds
```

- [ ] **Step 5: Final checkpoint review**

Review:

- The hub is now cloud-first, not card-first
- Existing `/knowledge/:slug` detail content still works unchanged
- Performance knobs are isolated to scene files for later tuning
