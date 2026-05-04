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

const KNOWLEDGE_NEBULA_TOPIC_CLOUD_COUNT = 6;

const DESKTOP_LAYOUTS: readonly KnowledgeNebulaClusterAnchorLayout[] = [
  {
    xPercent: 13,
    yPercent: 49,
    position: [-6.8, 0.4, -2.35],
    scale: 1.02,
    depth: "far",
    driftAmplitude: 0.18,
    splitDelayMs: 120,
    labelWidthRem: 9,
  },
  {
    xPercent: 27,
    yPercent: 83,
    position: [-4.0, -3.0, -0.85],
    scale: 1.12,
    depth: "mid",
    driftAmplitude: 0.22,
    splitDelayMs: 280,
    labelWidthRem: 10,
  },
  {
    xPercent: 41,
    yPercent: 38,
    position: [-1.35, 1.45, 0.3],
    scale: 1.08,
    depth: "mid",
    driftAmplitude: 0.2,
    splitDelayMs: 400,
    labelWidthRem: 9.75,
  },
  {
    xPercent: 58,
    yPercent: 61,
    position: [1.0, -0.7, 1.28],
    scale: 1.22,
    depth: "near",
    driftAmplitude: 0.25,
    splitDelayMs: 520,
    labelWidthRem: 10.5,
  },
  {
    xPercent: 76,
    yPercent: 80,
    position: [4.15, -2.7, 0.18],
    scale: 1.1,
    depth: "mid",
    driftAmplitude: 0.21,
    splitDelayMs: 640,
    labelWidthRem: 9.8,
  },
  {
    xPercent: 87,
    yPercent: 46,
    position: [6.8, 0.55, -1.85],
    scale: 1.02,
    depth: "far",
    driftAmplitude: 0.17,
    splitDelayMs: 760,
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
    xPercent: 49,
    yPercent: 28,
    position: [-0.15, 2.2, 0.28],
    scale: 0.96,
    depth: "mid",
    driftAmplitude: 0.14,
    splitDelayMs: 380,
    labelWidthRem: 7.95,
  },
  {
    xPercent: 52,
    yPercent: 61,
    position: [0.18, -0.7, 0.88],
    scale: 1.04,
    depth: "near",
    driftAmplitude: 0.18,
    splitDelayMs: 500,
    labelWidthRem: 8.35,
  },
  {
    xPercent: 72,
    yPercent: 75,
    position: [2.2, -2.1, -0.12],
    scale: 0.98,
    depth: "mid",
    driftAmplitude: 0.15,
    splitDelayMs: 620,
    labelWidthRem: 8.1,
  },
  {
    xPercent: 75,
    yPercent: 46,
    position: [3.35, 0.35, -1.3],
    scale: 0.9,
    depth: "far",
    driftAmplitude: 0.12,
    splitDelayMs: 740,
    labelWidthRem: 7.75,
  },
];

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
