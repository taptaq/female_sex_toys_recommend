import type { LoadingFunFact } from "./loading-fun-facts.ts";

export type FloatingKnowledgeVariant = "loading" | "matching";
export type FloatingKnowledgeViewport = "desktop" | "mobile";
export type FloatingKnowledgeDepth = "near" | "far";

export type FloatingKnowledgeSlot = {
  id: string;
  variant: FloatingKnowledgeVariant;
  depth: FloatingKnowledgeDepth;
  className: string;
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
};

const LOADING_SLOTS: FloatingKnowledgeSlot[] = [
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
];

const MATCHING_SLOTS: FloatingKnowledgeSlot[] = [
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
];

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

  return facts.slice(0, slots.length).map((fact, index) => ({
    fact,
    slot: slots[index],
  }));
}
