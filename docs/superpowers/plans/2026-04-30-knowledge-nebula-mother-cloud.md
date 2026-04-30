# Knowledge Nebula Mother Cloud Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the `/knowledge` hub so it reads as one full deep-space mother nebula with five topic glow regions, rather than five separate glowing cloud balls.

**Architecture:** Keep the existing route, data, and `KnowledgeNebulaField` orchestration. Replace the scene internals with a layered R3F composition: procedural mother-cloud textures, foreground/midground/background star dust, five local topic glow regions, and a lighter DOM label layer.

**Tech Stack:** React 19, TypeScript, `three`, `@react-three/fiber`, `@react-three/drei`, `motion/react`, Tailwind, Node test runner with `ts-node/esm`, Vite.

**User Preference:** Do not create git commits automatically. Replace commit steps with checkpoint review and verification.

---

## File Structure

### Create

- `src/lib/knowledge-nebula-mother-cloud.ts`
  Pure configuration helpers for mother-cloud layers, star layers, and topic glow profiles.
- `src/lib/knowledge-nebula-mother-cloud.test.ts`
  Verifies the visual configuration contracts that should stay stable across refactors.
- `src/components/knowledge-nebula/NebulaTextures.ts`
  Canvas texture factories for soft radial glow, wispy cloud bands, star dust, and cache cleanup.
- `src/components/knowledge-nebula/MotherCloudField.tsx`
  Renders the full mother-cloud bands, core glow, and large nebula wash.
- `src/components/knowledge-nebula/NebulaStarField.tsx`
  Renders layered star dust and bright stars with different depth scales.

### Modify

- `src/components/knowledge-nebula/NebulaScene3D.tsx`
  Use the new mother-cloud scene layers and pass topic glow profiles to clusters.
- `src/components/knowledge-nebula/NebulaCluster.tsx`
  Rework from standalone cloud ball to local topic glow enhancer.
- `src/components/knowledge-nebula/NebulaLabelLayer.tsx`
  Reduce card feeling and shift toward thin floating mist labels.
- `src/components/KnowledgeNebulaField.tsx`
  Adjust copy and outer container treatment so the scene feels less boxed.
- `src/lib/knowledge-nebula-field.ts`
  Keep anchor helpers stable, only adjust label widths or focus camera if visual testing shows overlap.
- `src/lib/knowledge-nebula-field.test.ts`
  Update exact layout assertions only if anchor values are intentionally changed.

### Optional Assets

Start without downloaded bitmap assets. If the first visual pass still lacks the reference-image mist texture, download one or more public-domain or commercially safe nebula/smoke/star textures into `public/assets/knowledge-nebula/`, record the source in `public/assets/knowledge-nebula/SOURCES.md`, and load them through Vite public paths.

---

## Task 1: Add Mother-Cloud Visual Contracts

**Files:**
- Create: `src/lib/knowledge-nebula-mother-cloud.ts`
- Create: `src/lib/knowledge-nebula-mother-cloud.test.ts`

- [ ] **Step 1: Write failing tests for mother-cloud layer contracts**

Create `src/lib/knowledge-nebula-mother-cloud.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { KNOWLEDGE_NEBULA_TOPICS } from "../data/knowledge-nebula.ts";
import { buildKnowledgeNebulaClusterAnchors } from "./knowledge-nebula-field.ts";
import {
  buildMotherCloudBands,
  buildStarFieldLayers,
  buildTopicGlowProfiles,
} from "./knowledge-nebula-mother-cloud.ts";

const topicSlugs = KNOWLEDGE_NEBULA_TOPICS.map((topic) => topic.slug);

test("buildMotherCloudBands creates a wide layered desktop mother cloud", () => {
  const bands = buildMotherCloudBands("desktop");

  assert.equal(bands.length, 7);
  assert.ok(bands.every((band) => band.scale[0] >= 5.2));
  assert.ok(bands.some((band) => band.role === "core"));
  assert.ok(bands.some((band) => band.role === "spiral-arm"));
  assert.ok(new Set(bands.map((band) => band.tint)).size >= 4);
});

test("buildMotherCloudBands creates a lighter mobile version without changing the visual language", () => {
  const desktop = buildMotherCloudBands("desktop");
  const mobile = buildMotherCloudBands("mobile");

  assert.equal(mobile.length, 5);
  assert.ok(mobile.length < desktop.length);
  assert.ok(mobile.every((band) => band.scale[0] >= 3.9));
  assert.ok(mobile.some((band) => band.role === "core"));
  assert.ok(mobile.some((band) => band.role === "spiral-arm"));
});

test("buildStarFieldLayers separates far, mid, and foreground stars", () => {
  const layers = buildStarFieldLayers("desktop");

  assert.deepEqual(
    layers.map((layer) => layer.depth),
    ["far", "mid", "near"],
  );
  assert.ok(layers[0].count > layers[2].count);
  assert.ok(layers[2].size > layers[0].size);
});

test("buildTopicGlowProfiles maps anchors into non-uniform mother-cloud glow regions", () => {
  const anchors = buildKnowledgeNebulaClusterAnchors({
    topicSlugs,
    viewport: "desktop",
  });
  const profiles = buildTopicGlowProfiles(anchors);

  assert.equal(profiles.length, 5);
  assert.deepEqual(
    profiles.map((profile) => profile.topicSlug),
    topicSlugs,
  );
  assert.ok(new Set(profiles.map((profile) => profile.shape)).size >= 3);
  assert.ok(profiles.every((profile) => profile.cloudScale[0] !== profile.cloudScale[1]));
});
```

- [ ] **Step 2: Run the new test and confirm it fails**

Run:

```bash
node --loader ts-node/esm --test src/lib/knowledge-nebula-mother-cloud.test.ts
```

Expected: FAIL because `src/lib/knowledge-nebula-mother-cloud.ts` does not exist.

- [ ] **Step 3: Implement the mother-cloud config helpers**

Create `src/lib/knowledge-nebula-mother-cloud.ts`:

```ts
import type { KnowledgeNebulaTopicSlug } from "../data/knowledge-nebula.ts";
import type {
  KnowledgeNebulaClusterAnchor,
  KnowledgeNebulaViewport,
} from "./knowledge-nebula-field.ts";

export type MotherCloudBandRole = "core" | "spiral-arm" | "mist" | "veil";
export type TopicGlowShape = "comet" | "rift" | "plume" | "halo" | "wake";

export type MotherCloudBand = {
  id: string;
  role: MotherCloudBandRole;
  position: [number, number, number];
  scale: [number, number, number];
  rotationZ: number;
  opacity: number;
  tint: string;
  driftSpeed: number;
  pulse: number;
};

export type StarFieldLayer = {
  id: string;
  depth: "far" | "mid" | "near";
  count: number;
  scale: [number, number, number];
  size: number;
  opacity: number;
  speed: number;
  color: string;
};

export type TopicGlowProfile = {
  topicSlug: KnowledgeNebulaTopicSlug;
  shape: TopicGlowShape;
  cloudOffset: [number, number, number];
  cloudScale: [number, number, number];
  tint: string;
  opacity: number;
  swirlSpeed: number;
  dustCount: number;
};

const DESKTOP_BANDS: readonly MotherCloudBand[] = [
  { id: "core-white", role: "core", position: [0, 0.05, -3.8], scale: [5.8, 3.1, 1], rotationZ: -0.06, opacity: 0.58, tint: "#fff7ff", driftSpeed: 0.018, pulse: 0.08 },
  { id: "core-violet", role: "core", position: [0.25, -0.08, -4.1], scale: [7.2, 3.8, 1], rotationZ: -0.12, opacity: 0.36, tint: "#d8b4fe", driftSpeed: 0.022, pulse: 0.1 },
  { id: "upper-arm", role: "spiral-arm", position: [-0.55, 0.95, -4.9], scale: [11.6, 2.1, 1], rotationZ: -0.24, opacity: 0.28, tint: "#c4b5fd", driftSpeed: 0.028, pulse: 0.06 },
  { id: "lower-arm", role: "spiral-arm", position: [0.4, -1.15, -4.7], scale: [12.4, 2.45, 1], rotationZ: 0.18, opacity: 0.24, tint: "#818cf8", driftSpeed: 0.024, pulse: 0.07 },
  { id: "left-mist", role: "mist", position: [-3.2, 0.15, -5.4], scale: [6.4, 3.3, 1], rotationZ: 0.12, opacity: 0.2, tint: "#a78bfa", driftSpeed: 0.016, pulse: 0.05 },
  { id: "right-mist", role: "mist", position: [3.35, -0.2, -5.2], scale: [6.8, 3.5, 1], rotationZ: -0.1, opacity: 0.18, tint: "#7dd3fc", driftSpeed: 0.018, pulse: 0.05 },
  { id: "outer-veil", role: "veil", position: [0, 0, -6.2], scale: [14.6, 8.2, 1], rotationZ: -0.04, opacity: 0.13, tint: "#f0abfc", driftSpeed: 0.012, pulse: 0.04 },
];

const MOBILE_BANDS: readonly MotherCloudBand[] = [
  { id: "core-white", role: "core", position: [0, 0.05, -3.8], scale: [4.4, 2.8, 1], rotationZ: -0.05, opacity: 0.54, tint: "#fff7ff", driftSpeed: 0.014, pulse: 0.06 },
  { id: "core-violet", role: "core", position: [0.15, -0.1, -4.1], scale: [5.4, 3.2, 1], rotationZ: -0.1, opacity: 0.34, tint: "#d8b4fe", driftSpeed: 0.016, pulse: 0.07 },
  { id: "upper-arm", role: "spiral-arm", position: [-0.25, 0.85, -4.9], scale: [7.2, 1.8, 1], rotationZ: -0.22, opacity: 0.24, tint: "#c4b5fd", driftSpeed: 0.02, pulse: 0.05 },
  { id: "lower-arm", role: "spiral-arm", position: [0.28, -1.0, -4.8], scale: [7.6, 2.05, 1], rotationZ: 0.18, opacity: 0.2, tint: "#818cf8", driftSpeed: 0.018, pulse: 0.05 },
  { id: "outer-veil", role: "veil", position: [0, 0, -6.2], scale: [9.4, 6.8, 1], rotationZ: -0.04, opacity: 0.12, tint: "#f0abfc", driftSpeed: 0.01, pulse: 0.035 },
];

const TOPIC_SHAPES: readonly TopicGlowShape[] = ["plume", "rift", "halo", "wake", "comet"];
const TOPIC_TINTS = ["#f5d0fe", "#bae6fd", "#ffffff", "#c4b5fd", "#93c5fd"] as const;

export function buildMotherCloudBands(viewport: KnowledgeNebulaViewport): MotherCloudBand[] {
  const bands = viewport === "mobile" ? MOBILE_BANDS : DESKTOP_BANDS;
  return bands.map((band) => ({
    ...band,
    position: [...band.position],
    scale: [...band.scale],
  }));
}

export function buildStarFieldLayers(viewport: KnowledgeNebulaViewport): StarFieldLayer[] {
  const mobile = viewport === "mobile";
  return [
    { id: "far-stars", depth: "far", count: mobile ? 70 : 140, scale: mobile ? [11, 8, 8] : [18, 11, 12], size: mobile ? 1.1 : 1.25, opacity: 0.42, speed: 0.035, color: "#dbeafe" },
    { id: "mid-stars", depth: "mid", count: mobile ? 36 : 76, scale: mobile ? [8, 6, 7] : [13, 8, 9], size: mobile ? 1.8 : 2.1, opacity: 0.38, speed: 0.07, color: "#f5d0fe" },
    { id: "near-stars", depth: "near", count: mobile ? 12 : 28, scale: mobile ? [6, 4.2, 5] : [10, 6, 7], size: mobile ? 3.0 : 3.6, opacity: 0.24, speed: 0.12, color: "#ffffff" },
  ];
}

export function buildTopicGlowProfiles(
  anchors: KnowledgeNebulaClusterAnchor[],
): TopicGlowProfile[] {
  return anchors.map((anchor, index) => {
    const shape = TOPIC_SHAPES[index % TOPIC_SHAPES.length];
    const width = anchor.viewport === "mobile" ? 2.7 + index * 0.12 : 3.25 + index * 0.18;
    const height = anchor.viewport === "mobile" ? 1.55 + (index % 2) * 0.18 : 1.85 + (index % 2) * 0.22;

    return {
      topicSlug: anchor.topicSlug,
      shape,
      cloudOffset: [index % 2 === 0 ? -0.16 : 0.18, index % 3 === 0 ? 0.12 : -0.08, -0.18],
      cloudScale: [width, height, 1],
      tint: TOPIC_TINTS[index % TOPIC_TINTS.length],
      opacity: anchor.depth === "near" ? 0.34 : anchor.depth === "mid" ? 0.28 : 0.22,
      swirlSpeed: 0.04 + index * 0.009,
      dustCount: anchor.viewport === "mobile" ? 8 + index : 13 + index * 2,
    };
  });
}
```

- [ ] **Step 4: Run the new test and confirm it passes**

Run:

```bash
node --loader ts-node/esm --test src/lib/knowledge-nebula-mother-cloud.test.ts
```

Expected: PASS, 4 tests.

---

## Task 2: Add Procedural Nebula Textures

**Files:**
- Create: `src/components/knowledge-nebula/NebulaTextures.ts`

- [ ] **Step 1: Create reusable procedural texture factories**

Create `src/components/knowledge-nebula/NebulaTextures.ts`:

```ts
import { useEffect, useState } from "react";
import * as THREE from "three";

export type NebulaTextureSet = {
  softGlow: THREE.CanvasTexture;
  wispyCloud: THREE.CanvasTexture;
  starDust: THREE.CanvasTexture;
};

let cachedTextureSet: NebulaTextureSet | null = null;

function createCanvasTexture(
  size: number,
  paint: (context: CanvasRenderingContext2D, size: number) => void,
) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to create nebula texture canvas.");
  }

  paint(context, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

function paintSoftGlow(context: CanvasRenderingContext2D, size: number) {
  const center = size / 2;
  const gradient = context.createRadialGradient(center, center, 4, center, center, center);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.16, "rgba(255,255,255,0.82)");
  gradient.addColorStop(0.42, "rgba(255,255,255,0.22)");
  gradient.addColorStop(0.74, "rgba(255,255,255,0.06)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
}

function paintWispyCloud(context: CanvasRenderingContext2D, size: number) {
  context.clearRect(0, 0, size, size);

  const center = size / 2;
  const base = context.createRadialGradient(center, center, 18, center, center, center);
  base.addColorStop(0, "rgba(255,255,255,0.7)");
  base.addColorStop(0.38, "rgba(255,255,255,0.26)");
  base.addColorStop(0.76, "rgba(255,255,255,0.07)");
  base.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = base;
  context.fillRect(0, 0, size, size);

  context.globalCompositeOperation = "source-over";
  for (let index = 0; index < 42; index += 1) {
    const angle = index * 0.72;
    const radius = size * (0.12 + (index % 9) * 0.035);
    const x = center + Math.cos(angle) * radius;
    const y = center + Math.sin(angle * 0.86) * radius * 0.58;
    const gradient = context.createRadialGradient(x, y, 2, x, y, size * (0.08 + (index % 4) * 0.018));
    gradient.addColorStop(0, "rgba(255,255,255,0.22)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
}

function paintStarDust(context: CanvasRenderingContext2D, size: number) {
  context.clearRect(0, 0, size, size);

  for (let index = 0; index < 170; index += 1) {
    const x = (Math.sin(index * 91.7) * 0.5 + 0.5) * size;
    const y = (Math.sin(index * 37.3 + 1.4) * 0.5 + 0.5) * size;
    const radius = index % 17 === 0 ? 1.35 : index % 7 === 0 ? 0.95 : 0.52;
    const alpha = index % 17 === 0 ? 0.82 : index % 7 === 0 ? 0.52 : 0.32;

    context.beginPath();
    context.fillStyle = `rgba(255,255,255,${alpha})`;
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
}

export function createNebulaTextureSet(): NebulaTextureSet | null {
  if (cachedTextureSet) {
    return cachedTextureSet;
  }

  if (typeof document === "undefined") {
    return null;
  }

  cachedTextureSet = {
    softGlow: createCanvasTexture(256, paintSoftGlow),
    wispyCloud: createCanvasTexture(512, paintWispyCloud),
    starDust: createCanvasTexture(512, paintStarDust),
  };
  return cachedTextureSet;
}

export function useNebulaTextureSet() {
  const [textures, setTextures] = useState<NebulaTextureSet | null>(() => cachedTextureSet);

  useEffect(() => {
    setTextures(createNebulaTextureSet());
  }, []);

  return textures;
}
```

- [ ] **Step 2: Run TypeScript verification**

Run:

```bash
npm run lint
```

Expected: PASS.

---

## Task 3: Render the Full Mother-Cloud Field

**Files:**
- Create: `src/components/knowledge-nebula/MotherCloudField.tsx`
- Create: `src/components/knowledge-nebula/NebulaStarField.tsx`
- Modify: `src/components/knowledge-nebula/NebulaScene3D.tsx`

- [ ] **Step 1: Add `MotherCloudField`**

Create `src/components/knowledge-nebula/MotherCloudField.tsx`:

```tsx
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { MotherCloudBand } from "../../lib/knowledge-nebula-mother-cloud.ts";
import type { NebulaTextureSet } from "./NebulaTextures.ts";

type MotherCloudFieldProps = {
  bands: MotherCloudBand[];
  textures: NebulaTextureSet;
  phase: number;
  isFocused: boolean;
};

export function MotherCloudField({
  bands,
  textures,
  phase,
  isFocused,
}: MotherCloudFieldProps) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) {
      return;
    }

    const elapsed = state.clock.getElapsedTime();
    group.rotation.z = Math.sin(elapsed * 0.025) * 0.018;
    group.position.z = isFocused ? -0.28 : 0;
  });

  return (
    <group ref={groupRef}>
      {bands.map((band, index) => {
        const texture = band.role === "core" ? textures.softGlow : textures.wispyCloud;
        const phaseOpacity = band.opacity * (0.42 + phase * 0.58);
        const focusFade = isFocused && band.role === "veil" ? 0.72 : 1;

        return (
          <sprite
            key={band.id}
            position={band.position}
            rotation={[0, 0, band.rotationZ]}
            scale={band.scale}
            renderOrder={index}
          >
            <spriteMaterial
              map={texture}
              color={band.tint}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              opacity={phaseOpacity * focusFade}
            />
          </sprite>
        );
      })}
    </group>
  );
}
```

- [ ] **Step 2: Add `NebulaStarField`**

Create `src/components/knowledge-nebula/NebulaStarField.tsx`:

```tsx
import { Sparkles } from "@react-three/drei";
import type { StarFieldLayer } from "../../lib/knowledge-nebula-mother-cloud.ts";

type NebulaStarFieldProps = {
  layers: StarFieldLayer[];
};

export function NebulaStarField({ layers }: NebulaStarFieldProps) {
  return (
    <>
      {layers.map((layer) => (
        <Sparkles
          key={layer.id}
          count={layer.count}
          color={layer.color}
          size={layer.size}
          scale={layer.scale}
          speed={layer.speed}
          opacity={layer.opacity}
          noise={layer.depth === "far" ? 0.9 : layer.depth === "mid" ? 0.55 : 0.25}
        />
      ))}
    </>
  );
}
```

- [ ] **Step 3: Integrate mother-cloud layers into `NebulaScene3D`**

Modify `src/components/knowledge-nebula/NebulaScene3D.tsx`:

```tsx
import { AdaptiveDpr } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { KnowledgeNebulaTopic, KnowledgeNebulaTopicSlug } from "../../data/knowledge-nebula.ts";
import {
  buildMotherCloudBands,
  buildStarFieldLayers,
  buildTopicGlowProfiles,
} from "../../lib/knowledge-nebula-mother-cloud.ts";
import type {
  KnowledgeNebulaCameraState,
  KnowledgeNebulaClusterAnchor,
  KnowledgeNebulaViewport,
} from "../../lib/knowledge-nebula-field.ts";
import { MotherCloudField } from "./MotherCloudField.tsx";
import { NebulaCluster } from "./NebulaCluster.tsx";
import { NebulaStarField } from "./NebulaStarField.tsx";
import { useNebulaTextureSet } from "./NebulaTextures.ts";
```

Then replace the old `NebulaBackdrop` usage and two ad hoc `Sparkles` blocks inside `NebulaContent` with:

```tsx
const bands = useMemo(() => buildMotherCloudBands(viewport), [viewport]);
const starLayers = useMemo(() => buildStarFieldLayers(viewport), [viewport]);
const topicGlowProfiles = useMemo(() => buildTopicGlowProfiles(anchors), [anchors]);
const textures = useNebulaTextureSet();
const isFocused = focusedTopicSlug != null;
```

Render order inside `NebulaContent` should be:

```tsx
<AdaptiveDpr />
<color attach="background" args={["#02030a"]} />
<fog attach="fog" args={["#04030d", 8, viewport === "mobile" ? 18 : 25]} />
<CameraRig cameraState={cameraState} phase={phase} />

<ambientLight intensity={0.72} color="#f5d0fe" />
<directionalLight position={[5, 7, 8]} intensity={0.85} color="#bae6fd" />
<pointLight position={[0, 0.2, 4.5]} intensity={1.35} color="#fff7ff" />

<NebulaStarField layers={starLayers} />
{textures ? (
  <>
    <MotherCloudField
      bands={bands}
      textures={textures}
      phase={phase}
      isFocused={isFocused}
    />

    <group>
      {anchors.map((anchor, index) => (
        <NebulaCluster
          key={`${anchor.viewport}-${anchor.topicSlug}`}
          anchor={anchor}
          glowProfile={topicGlowProfiles[index]}
          accent={accentBySlug[anchor.topicSlug] ?? "cyan"}
          phase={phase}
          isFocused={anchor.topicSlug === focusedTopicSlug}
          textures={textures}
        />
      ))}
    </group>
  </>
) : null}
```

Remove the old `NebulaBackdrop` component and the old inline sparkle blocks.

- [ ] **Step 4: Run TypeScript verification**

Run:

```bash
npm run lint
```

Expected: PASS.

---

## Task 4: Rework Topic Regions from Cloud Balls to Glow Enhancers

**Files:**
- Modify: `src/components/knowledge-nebula/NebulaCluster.tsx`

- [ ] **Step 1: Update `NebulaCluster` props**

Change the props to:

```tsx
type NebulaClusterProps = {
  anchor: KnowledgeNebulaClusterAnchor;
  glowProfile: TopicGlowProfile;
  accent: KnowledgeNebulaTopic["accent"];
  phase: number;
  isFocused: boolean;
  textures: NebulaTextureSet;
};
```

Add imports:

```tsx
import type { TopicGlowProfile } from "../../lib/knowledge-nebula-mother-cloud.ts";
import type { NebulaTextureSet } from "./NebulaTextures.ts";
```

- [ ] **Step 2: Replace the uniform layer arrays with shape-specific local mist**

Inside `NebulaCluster`, use this shape map:

```tsx
const SHAPE_ROTATION: Record<TopicGlowProfile["shape"], number> = {
  comet: -0.32,
  rift: 0.18,
  plume: -0.08,
  halo: 0.04,
  wake: 0.28,
};
```

Render three sprites per topic:

```tsx
<sprite position={glowProfile.cloudOffset} rotation={[0, 0, SHAPE_ROTATION[glowProfile.shape]]} scale={glowProfile.cloudScale}>
  <spriteMaterial
    map={textures.wispyCloud}
    color={glowProfile.tint}
    transparent
    depthWrite={false}
    blending={THREE.AdditiveBlending}
    opacity={glowProfile.opacity * (0.24 + visiblePhase * 0.76 + focusBoost * 0.35)}
  />
</sprite>

<sprite position={[glowProfile.cloudOffset[0] * -0.4, glowProfile.cloudOffset[1] * 0.6, 0.08]} scale={[glowProfile.cloudScale[0] * 0.52, glowProfile.cloudScale[1] * 0.58, 1]}>
  <spriteMaterial
    map={textures.softGlow}
    color={palette.core}
    transparent
    depthWrite={false}
    blending={THREE.AdditiveBlending}
    opacity={(0.1 + visiblePhase * 0.14 + focusBoost * 0.18)}
  />
</sprite>

<sprite position={[0, 0, -0.12]} scale={[glowProfile.cloudScale[0] * 0.72, glowProfile.cloudScale[1] * 0.44, 1]}>
  <spriteMaterial
    map={textures.starDust}
    color={palette.edge}
    transparent
    depthWrite={false}
    blending={THREE.AdditiveBlending}
    opacity={0.05 + visiblePhase * 0.1 + focusBoost * 0.08}
  />
</sprite>
```

- [ ] **Step 3: Keep drift but reduce standalone-ball behavior**

Keep the existing `useFrame` drift, but set `settle` and scale so the topic region remains part of the mother cloud:

```ts
const settle = 0.34 + visiblePhase * 0.66;
const focusScale = 1 + focusBoost * 0.16;
scaleTargetRef.current.setScalar(anchor.scale * settle * focusScale);
```

- [ ] **Step 4: Run TypeScript verification**

Run:

```bash
npm run lint
```

Expected: PASS.

---

## Task 5: Make Labels Feel Like Floating Mist Markers

**Files:**
- Modify: `src/components/knowledge-nebula/NebulaLabelLayer.tsx`
- Modify: `src/components/KnowledgeNebulaField.tsx`
- Modify: `src/pages/KnowledgeNebulaPage.tsx`

- [ ] **Step 1: Thin the DOM label layer**

In `src/components/knowledge-nebula/NebulaLabelLayer.tsx`, change button classes so labels use a near-transparent backing:

```tsx
className={[
  "group absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl border px-3 py-2.5 text-center transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-100/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:px-3.5",
  "bg-slate-950/8 backdrop-blur-[2px]",
  DEPTH_Z_INDEX[anchor.depth],
  accent.border,
  isFocused
    ? "scale-105 border-white/35 bg-white/8 opacity-100 shadow-[0_0_44px_rgba(245,208,254,0.24)]"
    : "opacity-[0.78] shadow-[0_0_30px_rgba(255,255,255,0.08)] hover:-translate-y-[calc(50%+3px)] hover:border-white/28 hover:bg-white/7 hover:opacity-100",
].join(" ")}
```

Change the badge to a softer mist chip:

```tsx
<span className="inline-flex rounded-full border border-white/12 bg-white/7 px-2.5 py-1 text-[10px] font-mono tracking-[0.16em] text-white/78">
  {topic.shortLabel}
</span>
```

Change the helper text to:

```tsx
{isFocused ? "正在穿入这片星云" : "进入主题"}
```

- [ ] **Step 2: Unbox the main scene more aggressively**

In `src/components/KnowledgeNebulaField.tsx`, adjust the scene wrapper from a clearly framed card to a softer viewport:

```tsx
<div className="relative mx-auto h-[31rem] w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/5 bg-black/20 shadow-[0_32px_140px_rgba(0,0,0,0.58)] sm:h-[34rem]">
```

Update the description copy:

```tsx
整片母星云先在深空里聚亮，再让 5 个主题亮区从雾中慢慢显形。选择任意亮区，镜头会穿入那片星云并进入详情。
```

Update the bottom status copy:

```tsx
stage === "aggregate" ? "母星云正在聚亮" :
stage === "split" ? "主题亮区正在从雾中显形" :
"选择任意星云亮区，进入对应内容层"
```

- [ ] **Step 3: Update hub page copy**

In `src/pages/KnowledgeNebulaPage.tsx`, change the hub copy to:

```tsx
在一整片母星云中选择你想先进入的主题亮区。进入后，再沿着该主题继续浏览细分知识。
```

- [ ] **Step 4: Run TypeScript verification**

Run:

```bash
npm run lint
```

Expected: PASS.

---

## Task 6: Asset Enhancement Branch, Only If Needed

**Files:**
- Optional create: `public/assets/knowledge-nebula/`
- Optional create: `public/assets/knowledge-nebula/SOURCES.md`
- Optional modify: `src/components/knowledge-nebula/NebulaTextures.ts`

- [ ] **Step 1: Inspect the procedural visual pass before downloading assets**

Start the dev server:

```bash
source ~/.nvm/nvm.sh && nvm use 20.19.0 >/dev/null && npm run dev
```

Open `/knowledge` and compare against the reference direction:

- The mother cloud should fill most of the scene.
- The center should feel white-violet and luminous.
- The outer arms should read as mist bands, not separate blobs.
- The five topics should feel like glow regions within the same cloud.

If these criteria are met, skip the rest of Task 6.

- [ ] **Step 2: Download only safe texture assets if procedural mist is not enough**

Use public-domain, CC0, or clearly commercially usable texture sources only. Save any chosen files under:

```text
public/assets/knowledge-nebula/
```

Record each source in:

```text
public/assets/knowledge-nebula/SOURCES.md
```

Required source note format:

```md
# Knowledge Nebula Asset Sources

- `filename.png`
  Source: <source URL>
  License: <license name>
  Downloaded: 2026-04-30
  Usage: Soft nebula mist texture for `/knowledge` hub.
```

- [ ] **Step 3: Wire downloaded textures as optional overrides**

In `NebulaTextures.ts`, add optional loading only if files exist in `public/assets/knowledge-nebula/`. Keep procedural textures as fallback if an image fails.

- [ ] **Step 4: Run verification**

Run:

```bash
npm run lint
npm run build
```

Expected: both PASS.

---

## Task 7: Full Verification and Visual QA

**Files:**
- No required code changes unless QA finds issues.

- [ ] **Step 1: Run helper tests**

Run:

```bash
node --loader ts-node/esm --test src/lib/knowledge-nebula-field.test.ts src/lib/knowledge-nebula-mother-cloud.test.ts
```

Expected: all tests PASS.

- [ ] **Step 2: Run TypeScript and production build**

Run:

```bash
npm run lint
npm run build
```

Expected: both PASS. Vite may still warn about large chunks because R3F/Three are already part of this route; record but do not treat that warning as a failure.

- [ ] **Step 3: Manual desktop visual check**

Start the dev server:

```bash
source ~/.nvm/nvm.sh && nvm use 20.19.0 >/dev/null && npm run dev
```

Open `/knowledge` around `1440x900` and verify:

- It reads as one mother nebula.
- The scene is not blank while textures initialize.
- Five labels remain readable and clickable.
- Hover increases local clarity without making a card pop.
- Click pushes toward the selected region and then routes to detail.

- [ ] **Step 4: Manual mobile visual check**

Open `/knowledge` around `390x844` and verify:

- The mother cloud still fills the scene.
- Labels are readable without hover.
- No label is clipped by the viewport.
- Animation is calmer than desktop.
- Click enters the selected detail page.

- [ ] **Step 5: Check reduced-motion behavior**

Enable reduced motion in the browser or emulate it with DevTools, then verify:

- No first-frame aggregate flash.
- Labels appear in their settled positions.
- Selecting a topic navigates immediately or near-immediately.

- [ ] **Step 6: Check git status without committing**

Run:

```bash
git status --short
```

Expected: changed files are limited to the mother-cloud refresh and related docs/assets.
