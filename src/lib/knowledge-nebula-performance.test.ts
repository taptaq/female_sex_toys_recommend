import assert from "node:assert/strict";
import test from "node:test";

import {
  KNOWLEDGE_NEBULA_PERFORMANCE_BUDGET,
  getFloatingKnowledgeItemBudget,
  getKnowledgeNebulaDprBudget,
  getKnowledgeNebulaStarCountBudget,
  getKnowledgeNebulaSceneFrameIntervalMs,
  getTopicDetailSceneComplexityBudget,
} from "./knowledge-nebula-performance.ts";

test("knowledge nebula performance budget lowers update frequency when the scene is not focused or visible", () => {
  assert.equal(
    getKnowledgeNebulaSceneFrameIntervalMs({ isFocused: true, isVisible: true }),
    KNOWLEDGE_NEBULA_PERFORMANCE_BUDGET.focusFrameIntervalMs,
  );
  assert.equal(
    getKnowledgeNebulaSceneFrameIntervalMs({ isFocused: false, isVisible: true }),
    KNOWLEDGE_NEBULA_PERFORMANCE_BUDGET.demandFrameIntervalMs,
  );
  assert.equal(
    getKnowledgeNebulaSceneFrameIntervalMs({ isFocused: false, isVisible: false }),
    KNOWLEDGE_NEBULA_PERFORMANCE_BUDGET.idleFrameIntervalMs,
  );
});

test("knowledge nebula performance budget keeps hidden scenes on the slowest refresh path", () => {
  assert.equal(
    getKnowledgeNebulaSceneFrameIntervalMs({ isFocused: true, isVisible: false }),
    KNOWLEDGE_NEBULA_PERFORMANCE_BUDGET.idleFrameIntervalMs,
  );
});

test("knowledge nebula performance budget reduces star density when the scene is not focused", () => {
  assert.ok(
    getKnowledgeNebulaStarCountBudget({
      viewport: "desktop",
      isFocused: false,
    }) < KNOWLEDGE_NEBULA_PERFORMANCE_BUDGET.maxStarCountDesktop,
  );
  assert.ok(
    getKnowledgeNebulaStarCountBudget({
      viewport: "mobile",
      isFocused: true,
    }) <= KNOWLEDGE_NEBULA_PERFORMANCE_BUDGET.maxStarCountMobile,
  );
});

test("knowledge nebula performance budget uses lower dpr on mobile and paused scenes", () => {
  assert.deepEqual(
    getKnowledgeNebulaDprBudget({
      viewport: "desktop",
      isVisible: true,
      prefersReducedMotion: false,
    }),
    [1, 1.25],
  );
  assert.deepEqual(
    getKnowledgeNebulaDprBudget({
      viewport: "mobile",
      isVisible: true,
      prefersReducedMotion: false,
    }),
    [1, 1.05],
  );
  assert.deepEqual(
    getKnowledgeNebulaDprBudget({
      viewport: "desktop",
      isVisible: false,
      prefersReducedMotion: false,
    }),
    [1, 1],
  );
});

test("topic detail scene complexity budget drops expensive layers outside the ideal case", () => {
  const fullDesktop = getTopicDetailSceneComplexityBudget({
    viewport: "desktop",
    isVisible: true,
    prefersReducedMotion: false,
  });
  const pausedDesktop = getTopicDetailSceneComplexityBudget({
    viewport: "desktop",
    isVisible: false,
    prefersReducedMotion: false,
  });
  const mobile = getTopicDetailSceneComplexityBudget({
    viewport: "mobile",
    isVisible: true,
    prefersReducedMotion: false,
  });

  assert.ok(pausedDesktop.starCount < fullDesktop.starCount);
  assert.ok(pausedDesktop.emissionFilaments < fullDesktop.emissionFilaments);
  assert.ok(mobile.spectralTubes < fullDesktop.spectralTubes);
});

test("floating knowledge fragments are capped by viewport and visibility budgets", () => {
  assert.equal(
    getFloatingKnowledgeItemBudget({
      variant: "matching",
      viewport: "desktop",
      isVisible: true,
      prefersReducedMotion: false,
    }),
    18,
  );
  assert.equal(
    getFloatingKnowledgeItemBudget({
      variant: "matching",
      viewport: "mobile",
      isVisible: true,
      prefersReducedMotion: false,
    }),
    6,
  );
  assert.equal(
    getFloatingKnowledgeItemBudget({
      variant: "matching",
      viewport: "desktop",
      isVisible: false,
      prefersReducedMotion: false,
    }),
    0,
  );
});
