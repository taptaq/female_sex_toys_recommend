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
  {
    id: "core-white",
    role: "core",
    position: [0, 0.06, -3.5],
    scale: [7.4, 3.9, 1],
    rotationZ: -0.06,
    opacity: 0.04,
    tint: "#fff7ff",
    driftSpeed: 0.018,
    pulse: 0.08,
  },
  {
    id: "core-violet",
    role: "core",
    position: [0.25, -0.08, -3.9],
    scale: [9.4, 4.8, 1],
    rotationZ: -0.12,
    opacity: 0.03,
    tint: "#f0abfc",
    driftSpeed: 0.022,
    pulse: 0.1,
  },
  {
    id: "upper-arm",
    role: "spiral-arm",
    position: [-0.72, 1.0, -4.4],
    scale: [15.6, 2.75, 1],
    rotationZ: -0.24,
    opacity: 0.04,
    tint: "#c084fc",
    driftSpeed: 0.028,
    pulse: 0.06,
  },
  {
    id: "lower-arm",
    role: "spiral-arm",
    position: [0.48, -1.25, -4.35],
    scale: [16.2, 3.1, 1],
    rotationZ: 0.18,
    opacity: 0.035,
    tint: "#8b5cf6",
    driftSpeed: 0.024,
    pulse: 0.07,
  },
  {
    id: "left-mist",
    role: "mist",
    position: [-3.85, 0.1, -5.0],
    scale: [8.6, 4.1, 1],
    rotationZ: 0.12,
    opacity: 0.03,
    tint: "#a78bfa",
    driftSpeed: 0.016,
    pulse: 0.05,
  },
  {
    id: "right-mist",
    role: "mist",
    position: [4.05, -0.22, -4.95],
    scale: [9.2, 4.25, 1],
    rotationZ: -0.1,
    opacity: 0.03,
    tint: "#93c5fd",
    driftSpeed: 0.018,
    pulse: 0.05,
  },
  {
    id: "outer-veil",
    role: "veil",
    position: [0, 0, -6.2],
    scale: [18.8, 9.8, 1],
    rotationZ: -0.04,
    opacity: 0.02,
    tint: "#f0abfc",
    driftSpeed: 0.012,
    pulse: 0.04,
  },
];

const MOBILE_BANDS: readonly MotherCloudBand[] = [
  {
    id: "core-white",
    role: "core",
    position: [0, 0.05, -3.6],
    scale: [5.5, 3.4, 1],
    rotationZ: -0.05,
    opacity: 0.035,
    tint: "#fff7ff",
    driftSpeed: 0.014,
    pulse: 0.06,
  },
  {
    id: "core-violet",
    role: "core",
    position: [0.15, -0.1, -3.9],
    scale: [6.8, 4.0, 1],
    rotationZ: -0.1,
    opacity: 0.03,
    tint: "#f0abfc",
    driftSpeed: 0.016,
    pulse: 0.07,
  },
  {
    id: "upper-arm",
    role: "spiral-arm",
    position: [-0.3, 0.86, -4.45],
    scale: [9.6, 2.15, 1],
    rotationZ: -0.22,
    opacity: 0.04,
    tint: "#c084fc",
    driftSpeed: 0.02,
    pulse: 0.05,
  },
  {
    id: "lower-arm",
    role: "spiral-arm",
    position: [0.32, -1.02, -4.5],
    scale: [10.2, 2.45, 1],
    rotationZ: 0.18,
    opacity: 0.035,
    tint: "#8b5cf6",
    driftSpeed: 0.018,
    pulse: 0.05,
  },
  {
    id: "outer-veil",
    role: "veil",
    position: [0, 0, -6.2],
    scale: [11.8, 7.8, 1],
    rotationZ: -0.04,
    opacity: 0.02,
    tint: "#f0abfc",
    driftSpeed: 0.01,
    pulse: 0.035,
  },
];

const TOPIC_SHAPES: readonly TopicGlowShape[] = [
  "plume",
  "rift",
  "halo",
  "wake",
  "comet",
  "plume",
];
const TOPIC_TINTS = [
  "#f0abfc",
  "#bae6fd",
  "#ffffff",
  "#c084fc",
  "#a5b4fc",
  "#67e8f9",
] as const;

export function buildMotherCloudBands(
  viewport: KnowledgeNebulaViewport,
): MotherCloudBand[] {
  const bands = viewport === "mobile" ? MOBILE_BANDS : DESKTOP_BANDS;

  return bands.map((band) => ({
    ...band,
    position: [...band.position],
    scale: [...band.scale],
  }));
}

export function buildStarFieldLayers(
  viewport: KnowledgeNebulaViewport,
  maxTotalCount?: number,
): StarFieldLayer[] {
  const mobile = viewport === "mobile";
  const layers: StarFieldLayer[] = [
    {
      id: "far-stars",
      depth: "far",
      count: mobile ? 250 : 560,
      scale: mobile ? [12, 10, 8] : [22, 14, 12],
      size: mobile ? 1.15 : 1.3,
      opacity: 0.62,
      speed: 0.035,
      color: "#dbeafe",
    },
    {
      id: "mid-stars",
      depth: "mid",
      count: mobile ? 125 : 280,
      scale: mobile ? [9, 7.4, 7] : [15, 9.8, 9],
      size: mobile ? 1.95 : 2.2,
      opacity: 0.56,
      speed: 0.07,
      color: "#f5d0fe",
    },
    {
      id: "near-stars",
      depth: "near",
      count: mobile ? 52 : 96,
      scale: mobile ? [7, 5.4, 5] : [12, 7.4, 7],
      size: mobile ? 3.2 : 3.8,
      opacity: 0.48,
      speed: 0.12,
      color: "#ffffff",
    },
  ];

  if (!maxTotalCount) {
    return layers;
  }

  const totalCount = layers.reduce((sum, layer) => sum + layer.count, 0);
  const ratio = Math.min(1, maxTotalCount / totalCount);

  return layers.map((layer) => ({
    ...layer,
    count: Math.max(18, Math.round(layer.count * ratio)),
  }));
}

export function buildTopicGlowProfiles(
  anchors: KnowledgeNebulaClusterAnchor[],
): TopicGlowProfile[] {
  return anchors.map((anchor, index) => {
    const shape = TOPIC_SHAPES[index % TOPIC_SHAPES.length];
    const shapeScaleByIndex = [
      [1.28, 0.82],
      [0.9, 1.12],
      [1.04, 1.04],
      [1.44, 0.72],
      [1.12, 0.92],
      [1.18, 0.8],
    ] as const;
    const baseWidth = anchor.viewport === "mobile" ? 3.05 : 4.2;
    const baseHeight = anchor.viewport === "mobile" ? 1.74 : 2.1;
    const [widthScale, heightScale] = shapeScaleByIndex[index % shapeScaleByIndex.length];
    const width = baseWidth * widthScale + index * 0.16;
    const height = baseHeight * heightScale + (index % 2) * 0.12;

    return {
      topicSlug: anchor.topicSlug,
      shape,
      cloudOffset: [
        [-0.28, 0.18, -0.08, 0.26, -0.18, 0.12][index % 6],
        [0.16, -0.14, 0.08, -0.1, 0.12, -0.18][index % 6],
        -0.18,
      ],
      cloudScale: [width, height, 1],
      tint: TOPIC_TINTS[index % TOPIC_TINTS.length],
      opacity: anchor.depth === "near" ? 0.18 : anchor.depth === "mid" ? 0.15 : 0.12,
      swirlSpeed: 0.034 + index * 0.011,
      dustCount: anchor.viewport === "mobile" ? 10 + index : 16 + index * 2,
    };
  });
}
