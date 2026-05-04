export type KnowledgeNebulaPerformanceBudget = {
  demandFrameIntervalMs: number;
  idleFrameIntervalMs: number;
  focusFrameIntervalMs: number;
  maxStarCountDesktop: number;
  maxStarCountMobile: number;
  maxFloatingKnowledgeDesktop: number;
  maxFloatingKnowledgeMobile: number;
};

export const KNOWLEDGE_NEBULA_PERFORMANCE_BUDGET: KnowledgeNebulaPerformanceBudget = {
  demandFrameIntervalMs: 96,
  idleFrameIntervalMs: 144,
  focusFrameIntervalMs: 72,
  maxStarCountDesktop: 760,
  maxStarCountMobile: 420,
  maxFloatingKnowledgeDesktop: 18,
  maxFloatingKnowledgeMobile: 6,
};

export type PerformanceViewport = "desktop" | "mobile";
export type FloatingKnowledgePerformanceVariant = "loading" | "matching";
export type TopicDetailSceneComplexityBudget = {
  dpr: [number, number];
  emissionFilaments: number;
  spectralTubes: number;
  dustLanes: number;
  starCount: number;
};

export function getKnowledgeNebulaSceneFrameIntervalMs({
  isFocused,
  isVisible,
}: {
  isFocused: boolean;
  isVisible: boolean;
}) {
  if (!isVisible) {
    return KNOWLEDGE_NEBULA_PERFORMANCE_BUDGET.idleFrameIntervalMs;
  }

  return isFocused
    ? KNOWLEDGE_NEBULA_PERFORMANCE_BUDGET.focusFrameIntervalMs
    : KNOWLEDGE_NEBULA_PERFORMANCE_BUDGET.demandFrameIntervalMs;
}

export function getKnowledgeNebulaStarCountBudget({
  viewport,
  isFocused,
}: {
  viewport: "desktop" | "mobile";
  isFocused: boolean;
}) {
  const maxStarCount =
    viewport === "desktop"
      ? KNOWLEDGE_NEBULA_PERFORMANCE_BUDGET.maxStarCountDesktop
      : KNOWLEDGE_NEBULA_PERFORMANCE_BUDGET.maxStarCountMobile;

  return isFocused ? maxStarCount : Math.max(90, Math.round(maxStarCount * 0.7));
}

export function getKnowledgeNebulaDprBudget({
  viewport,
  isVisible,
  prefersReducedMotion,
}: {
  viewport: PerformanceViewport;
  isVisible: boolean;
  prefersReducedMotion: boolean;
}): [number, number] {
  if (!isVisible || prefersReducedMotion) {
    return [1, 1];
  }

  return viewport === "desktop" ? [1, 1.25] : [1, 1.05];
}

export function getTopicDetailSceneComplexityBudget({
  viewport,
  isVisible,
  prefersReducedMotion,
}: {
  viewport: PerformanceViewport;
  isVisible: boolean;
  prefersReducedMotion: boolean;
}): TopicDetailSceneComplexityBudget {
  const mobile = viewport === "mobile";
  const reduction = !isVisible || prefersReducedMotion;

  return {
    dpr: getKnowledgeNebulaDprBudget({
      viewport,
      isVisible,
      prefersReducedMotion,
    }),
    emissionFilaments: reduction ? (mobile ? 24 : 38) : mobile ? 46 : 74,
    spectralTubes: reduction ? (mobile ? 2 : 4) : mobile ? 4 : 8,
    dustLanes: reduction ? (mobile ? 4 : 7) : mobile ? 7 : 12,
    starCount: reduction ? (mobile ? 42 : 72) : mobile ? 92 : 160,
  };
}

export function getFloatingKnowledgeItemBudget({
  variant,
  viewport,
  isVisible,
  prefersReducedMotion,
}: {
  variant: FloatingKnowledgePerformanceVariant;
  viewport: PerformanceViewport;
  isVisible: boolean;
  prefersReducedMotion: boolean;
}) {
  if (!isVisible) {
    return 0;
  }

  if (prefersReducedMotion) {
    return viewport === "desktop" ? 8 : 4;
  }

  if (viewport === "mobile") {
    return KNOWLEDGE_NEBULA_PERFORMANCE_BUDGET.maxFloatingKnowledgeMobile;
  }

  return variant === "matching"
    ? KNOWLEDGE_NEBULA_PERFORMANCE_BUDGET.maxFloatingKnowledgeDesktop
    : 12;
}
