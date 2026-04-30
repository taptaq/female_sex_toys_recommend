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

type BuildKnowledgeNebulaClusterAnchorsOptions = {
  topicSlugs: KnowledgeNebulaTopicSlug[];
  viewport: KnowledgeNebulaViewport;
};

type KnowledgeNebulaClusterAnchorLayout = Omit<
  KnowledgeNebulaClusterAnchor,
  "topicSlug" | "viewport"
>;

const KNOWLEDGE_NEBULA_TOPIC_CLOUD_COUNT = 5;

const DESKTOP_LAYOUTS: readonly KnowledgeNebulaClusterAnchorLayout[] = [
  {
    xPercent: 16,
    yPercent: 51,
    position: [-6.1, 0.1, -2.2],
    scale: 1.02,
    depth: "far",
    driftAmplitude: 0.18,
    splitDelayMs: 120,
    labelWidthRem: 9,
  },
  {
    xPercent: 31,
    yPercent: 78,
    position: [-3.2, -2.5, -0.7],
    scale: 1.12,
    depth: "mid",
    driftAmplitude: 0.22,
    splitDelayMs: 280,
    labelWidthRem: 10,
  },
  {
    xPercent: 51,
    yPercent: 62,
    position: [0.1, -0.8, 1.1],
    scale: 1.28,
    depth: "near",
    driftAmplitude: 0.26,
    splitDelayMs: 420,
    labelWidthRem: 11,
  },
  {
    xPercent: 69,
    yPercent: 77,
    position: [3.1, -2.4, 0.2],
    scale: 1.12,
    depth: "mid",
    driftAmplitude: 0.21,
    splitDelayMs: 560,
    labelWidthRem: 10,
  },
  {
    xPercent: 84,
    yPercent: 49,
    position: [6.2, 0.3, -1.8],
    scale: 1.02,
    depth: "far",
    driftAmplitude: 0.17,
    splitDelayMs: 700,
    labelWidthRem: 9.25,
  },
];

const MOBILE_LAYOUTS: readonly KnowledgeNebulaClusterAnchorLayout[] = [
  {
    xPercent: 25,
    yPercent: 46,
    position: [-3.3, 0.35, -1.6],
    scale: 0.92,
    depth: "far",
    driftAmplitude: 0.12,
    splitDelayMs: 120,
    labelWidthRem: 7.75,
  },
  {
    xPercent: 30,
    yPercent: 75,
    position: [-2.0, -2.25, -0.3],
    scale: 0.98,
    depth: "mid",
    driftAmplitude: 0.15,
    splitDelayMs: 260,
    labelWidthRem: 8.1,
  },
  {
    xPercent: 51,
    yPercent: 60,
    position: [0.08, -0.55, 0.8],
    scale: 1.1,
    depth: "near",
    driftAmplitude: 0.18,
    splitDelayMs: 400,
    labelWidthRem: 8.5,
  },
  {
    xPercent: 70,
    yPercent: 75,
    position: [2.05, -2.18, -0.1],
    scale: 0.98,
    depth: "mid",
    driftAmplitude: 0.15,
    splitDelayMs: 540,
    labelWidthRem: 8.1,
  },
  {
    xPercent: 75,
    yPercent: 46,
    position: [3.35, 0.35, -1.3],
    scale: 0.9,
    depth: "far",
    driftAmplitude: 0.12,
    splitDelayMs: 680,
    labelWidthRem: 7.75,
  },
];

export const DEFAULT_KNOWLEDGE_NEBULA_CAMERA: KnowledgeNebulaCameraState = {
  position: [0, 0, 11.8],
  target: [0, 0, 0],
};

export function buildKnowledgeNebulaClusterAnchors({
  topicSlugs,
  viewport,
}: BuildKnowledgeNebulaClusterAnchorsOptions): KnowledgeNebulaClusterAnchor[] {
  const layouts = viewport === "mobile" ? MOBILE_LAYOUTS : DESKTOP_LAYOUTS;

  if (layouts.length !== KNOWLEDGE_NEBULA_TOPIC_CLOUD_COUNT) {
    throw new Error(
      `Knowledge nebula ${viewport} layout must define exactly ${KNOWLEDGE_NEBULA_TOPIC_CLOUD_COUNT} topic clouds.`,
    );
  }

  if (topicSlugs.length !== KNOWLEDGE_NEBULA_TOPIC_CLOUD_COUNT) {
    throw new Error(
      `Knowledge nebula ${viewport} expects exactly ${KNOWLEDGE_NEBULA_TOPIC_CLOUD_COUNT} topic clouds, received ${topicSlugs.length}.`,
    );
  }

  return topicSlugs.map((topicSlug, index) => ({
    ...cloneAnchorLayout(layouts[index]),
    topicSlug,
    viewport,
  }));
}

export function buildKnowledgeNebulaFocusCamera(
  anchor: KnowledgeNebulaClusterAnchor,
): KnowledgeNebulaCameraState {
  const depthOffset =
    anchor.depth === "near" ? 0.2 : anchor.depth === "mid" ? 0.55 : 0.9;

  return {
    position: [
      anchor.position[0] * 0.34,
      anchor.position[1] * 0.26,
      6.2 + depthOffset,
    ],
    target: [...anchor.position],
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

function cloneAnchorLayout(
  layout: KnowledgeNebulaClusterAnchorLayout,
): KnowledgeNebulaClusterAnchorLayout {
  return {
    ...layout,
    position: [...layout.position],
  };
}
