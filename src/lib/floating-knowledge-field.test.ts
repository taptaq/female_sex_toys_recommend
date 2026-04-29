import test from "node:test";
import assert from "node:assert/strict";
import { buildFloatingKnowledgeItems } from "./floating-knowledge-field.ts";
import type { LoadingFunFact } from "./loading-fun-facts.ts";

const facts: LoadingFunFact[] = Array.from({ length: 12 }, (_, index) => ({
  id: `fact-${index + 1}`,
  title: `知识碎片 ${index + 1}`,
  description: `描述 ${index + 1}`,
  theme: index % 2 === 0 ? "care" : "decision",
  surfaces: ["loading", "matching"],
}));

test("buildFloatingKnowledgeItems returns medium desktop density", () => {
  const items = buildFloatingKnowledgeItems(facts, {
    variant: "loading",
    viewport: "desktop",
  });

  assert.equal(items.length, 9);
  assert.deepEqual(
    items.map((item) => item.fact.id),
    facts.slice(0, 9).map((fact) => fact.id),
  );
});

test("buildFloatingKnowledgeItems returns reduced mobile density", () => {
  const items = buildFloatingKnowledgeItems(facts, {
    variant: "matching",
    viewport: "mobile",
  });

  assert.equal(items.length, 5);
  assert.ok(items.every((item) => item.slot.mobileHidden !== true));
});

test("buildFloatingKnowledgeItems uses variant-specific slots", () => {
  const loadingItems = buildFloatingKnowledgeItems(facts, {
    variant: "loading",
    viewport: "desktop",
  });
  const matchingItems = buildFloatingKnowledgeItems(facts, {
    variant: "matching",
    viewport: "desktop",
  });

  assert.notEqual(loadingItems[0]?.slot.id, matchingItems[0]?.slot.id);
  assert.equal(loadingItems[0]?.slot.variant, "loading");
  assert.equal(matchingItems[0]?.slot.variant, "matching");
});

test("buildFloatingKnowledgeItems returns no items for empty facts", () => {
  assert.deepEqual(
    buildFloatingKnowledgeItems([], {
      variant: "loading",
      viewport: "desktop",
    }),
    [],
  );
});
