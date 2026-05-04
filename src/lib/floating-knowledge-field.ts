import type { LoadingFunFact } from "./loading-fun-facts.ts";

export type FloatingKnowledgeVariant = "loading" | "matching";
export type FloatingKnowledgeViewport = "desktop" | "mobile";
export type FloatingKnowledgeDepth = "near" | "far";
export type FloatingKnowledgeShapeClass =
  | "floating-knowledge-shard-1"
  | "floating-knowledge-shard-2"
  | "floating-knowledge-shard-3"
  | "floating-knowledge-shard-4"
  | "floating-knowledge-shard-5";
export type FloatingKnowledgeMotionClass =
  | "floating-knowledge-motion-drift"
  | "floating-knowledge-motion-tumble"
  | "floating-knowledge-motion-parallax";

export type FloatingKnowledgeSlot = {
  id: string;
  variant: FloatingKnowledgeVariant;
  depth: FloatingKnowledgeDepth;
  className: string;
  shapeClassName: FloatingKnowledgeShapeClass;
  motionClassName: FloatingKnowledgeMotionClass;
  delayMs: number;
  mobileHidden?: boolean;
};

export type FloatingKnowledgeItem = {
  fact: LoadingFunFact;
  slot: FloatingKnowledgeSlot;
};

type BuildFloatingKnowledgeItemsOptions = {
  variant: FloatingKnowledgeVariant;
  viewport: FloatingKnowledgeViewport;
  maxItems?: number;
};

type FloatingKnowledgeSlotInput = Omit<
  FloatingKnowledgeSlot,
  "shapeClassName" | "motionClassName"
>;

const SHAPE_CLASSES: FloatingKnowledgeShapeClass[] = [
  "floating-knowledge-shard-1",
  "floating-knowledge-shard-2",
  "floating-knowledge-shard-3",
  "floating-knowledge-shard-4",
  "floating-knowledge-shard-5",
];

const MOTION_CLASSES: FloatingKnowledgeMotionClass[] = [
  "floating-knowledge-motion-drift",
  "floating-knowledge-motion-tumble",
  "floating-knowledge-motion-parallax",
];

function withFragmentTraits(
  slots: FloatingKnowledgeSlotInput[],
): FloatingKnowledgeSlot[] {
  return slots.map((slot, index) => ({
    ...slot,
    shapeClassName: SHAPE_CLASSES[index % SHAPE_CLASSES.length],
    motionClassName: MOTION_CLASSES[index % MOTION_CLASSES.length],
  }));
}

const LOADING_SLOTS: FloatingKnowledgeSlot[] = withFragmentTraits([
  {
    id: "loading-far-top-left",
    variant: "loading",
    depth: "far",
    className: "floating-knowledge-slot-loading-1",
    delayMs: 0,
  },
  {
    id: "loading-near-top-right",
    variant: "loading",
    depth: "near",
    className: "floating-knowledge-slot-loading-2",
    delayMs: 140,
  },
  {
    id: "loading-far-mid-left",
    variant: "loading",
    depth: "far",
    className: "floating-knowledge-slot-loading-3",
    delayMs: 280,
  },
  {
    id: "loading-near-mid-right",
    variant: "loading",
    depth: "near",
    className: "floating-knowledge-slot-loading-4",
    delayMs: 420,
  },
  {
    id: "loading-far-bottom-left",
    variant: "loading",
    depth: "far",
    className: "floating-knowledge-slot-loading-5",
    delayMs: 560,
  },
  {
    id: "loading-near-bottom-right",
    variant: "loading",
    depth: "near",
    className: "floating-knowledge-slot-loading-6",
    delayMs: 700,
  },
  {
    id: "loading-far-upper-left",
    variant: "loading",
    depth: "far",
    className: "floating-knowledge-slot-loading-7",
    delayMs: 840,
    mobileHidden: true,
  },
  {
    id: "loading-near-lower-right",
    variant: "loading",
    depth: "near",
    className: "floating-knowledge-slot-loading-8",
    delayMs: 980,
    mobileHidden: true,
  },
  {
    id: "loading-far-top-center",
    variant: "loading",
    depth: "far",
    className: "floating-knowledge-slot-loading-9",
    delayMs: 1120,
    mobileHidden: true,
  },
  {
    id: "loading-near-edge-left",
    variant: "loading",
    depth: "near",
    className: "floating-knowledge-slot-loading-10",
    delayMs: 1260,
    mobileHidden: true,
  },
  {
    id: "loading-far-edge-right",
    variant: "loading",
    depth: "far",
    className: "floating-knowledge-slot-loading-11",
    delayMs: 1400,
    mobileHidden: true,
  },
  {
    id: "loading-far-upper-right",
    variant: "loading",
    depth: "far",
    className: "floating-knowledge-slot-loading-12",
    delayMs: 1540,
    mobileHidden: true,
  },
  {
    id: "loading-near-lower-left",
    variant: "loading",
    depth: "near",
    className: "floating-knowledge-slot-loading-13",
    delayMs: 1680,
    mobileHidden: true,
  },
]);

const MATCHING_SLOTS: FloatingKnowledgeSlot[] = withFragmentTraits([
  {
    id: "matching-far-top-left",
    variant: "matching",
    depth: "far",
    className: "floating-knowledge-slot-matching-1",
    delayMs: 0,
  },
  {
    id: "matching-near-top-right",
    variant: "matching",
    depth: "near",
    className: "floating-knowledge-slot-matching-2",
    delayMs: 120,
  },
  {
    id: "matching-near-center-left",
    variant: "matching",
    depth: "near",
    className: "floating-knowledge-slot-matching-3",
    delayMs: 240,
  },
  {
    id: "matching-far-center-right",
    variant: "matching",
    depth: "far",
    className: "floating-knowledge-slot-matching-4",
    delayMs: 360,
  },
  {
    id: "matching-near-bottom-left",
    variant: "matching",
    depth: "near",
    className: "floating-knowledge-slot-matching-5",
    delayMs: 480,
  },
  {
    id: "matching-far-bottom-right",
    variant: "matching",
    depth: "far",
    className: "floating-knowledge-slot-matching-6",
    delayMs: 600,
  },
  {
    id: "matching-far-upper-right",
    variant: "matching",
    depth: "far",
    className: "floating-knowledge-slot-matching-7",
    delayMs: 720,
    mobileHidden: true,
  },
  {
    id: "matching-near-lower-left",
    variant: "matching",
    depth: "near",
    className: "floating-knowledge-slot-matching-8",
    delayMs: 840,
    mobileHidden: true,
  },
  {
    id: "matching-far-top-center",
    variant: "matching",
    depth: "far",
    className: "floating-knowledge-slot-matching-9",
    delayMs: 960,
    mobileHidden: true,
  },
  {
    id: "matching-near-edge-left",
    variant: "matching",
    depth: "near",
    className: "floating-knowledge-slot-matching-10",
    delayMs: 1080,
    mobileHidden: true,
  },
  {
    id: "matching-far-edge-right",
    variant: "matching",
    depth: "far",
    className: "floating-knowledge-slot-matching-11",
    delayMs: 1200,
    mobileHidden: true,
  },
  {
    id: "matching-far-outer-left",
    variant: "matching",
    depth: "far",
    className: "floating-knowledge-slot-matching-12",
    delayMs: 1320,
    mobileHidden: true,
  },
  {
    id: "matching-near-outer-right",
    variant: "matching",
    depth: "near",
    className: "floating-knowledge-slot-matching-13",
    delayMs: 1440,
    mobileHidden: true,
  },
  {
    id: "matching-far-top-inner-left",
    variant: "matching",
    depth: "far",
    className: "floating-knowledge-slot-matching-14",
    delayMs: 1560,
    mobileHidden: true,
  },
  {
    id: "matching-near-top-inner-right",
    variant: "matching",
    depth: "near",
    className: "floating-knowledge-slot-matching-15",
    delayMs: 1680,
    mobileHidden: true,
  },
  {
    id: "matching-far-lower-edge-left",
    variant: "matching",
    depth: "far",
    className: "floating-knowledge-slot-matching-16",
    delayMs: 1800,
    mobileHidden: true,
  },
  {
    id: "matching-near-lower-edge-right",
    variant: "matching",
    depth: "near",
    className: "floating-knowledge-slot-matching-17",
    delayMs: 1920,
    mobileHidden: true,
  },
  {
    id: "matching-far-bottom-inner-left",
    variant: "matching",
    depth: "far",
    className: "floating-knowledge-slot-matching-18",
    delayMs: 2040,
    mobileHidden: true,
  },
  {
    id: "matching-near-bottom-inner-right",
    variant: "matching",
    depth: "near",
    className: "floating-knowledge-slot-matching-19",
    delayMs: 2160,
    mobileHidden: true,
  },
  {
    id: "matching-far-inner-left",
    variant: "matching",
    depth: "far",
    className: "floating-knowledge-slot-matching-20",
    delayMs: 2280,
    mobileHidden: true,
  },
  {
    id: "matching-near-inner-right",
    variant: "matching",
    depth: "near",
    className: "floating-knowledge-slot-matching-21",
    delayMs: 2400,
    mobileHidden: true,
  },
  {
    id: "matching-far-upper-middle-left",
    variant: "matching",
    depth: "far",
    className: "floating-knowledge-slot-matching-22",
    delayMs: 2520,
    mobileHidden: true,
  },
  {
    id: "matching-near-upper-middle-right",
    variant: "matching",
    depth: "near",
    className: "floating-knowledge-slot-matching-23",
    delayMs: 2640,
    mobileHidden: true,
  },
  {
    id: "matching-far-lower-middle",
    variant: "matching",
    depth: "far",
    className: "floating-knowledge-slot-matching-24",
    delayMs: 2760,
    mobileHidden: true,
  },
]);

function getSlots(variant: FloatingKnowledgeVariant) {
  return variant === "loading" ? LOADING_SLOTS : MATCHING_SLOTS;
}

export function buildFloatingKnowledgeItems(
  facts: LoadingFunFact[],
  options: BuildFloatingKnowledgeItemsOptions,
): FloatingKnowledgeItem[] {
  if (facts.length === 0) {
    return [];
  }

  const slots = getSlots(options.variant).filter(
    (slot) => options.viewport === "desktop" || !slot.mobileHidden,
  );
  const maxItems = options.maxItems ?? slots.length;

  return facts.slice(0, Math.min(slots.length, maxItems)).map((fact, index) => ({
    fact,
    slot: slots[index],
  }));
}
