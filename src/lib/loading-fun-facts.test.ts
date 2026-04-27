import test from "node:test";
import assert from "node:assert/strict";
import {
  getLoadingFunFacts,
  getNextLoadingFunFactIndex,
} from "./loading-fun-facts.ts";

test("getLoadingFunFacts returns matching-specific facts", () => {
  const facts = getLoadingFunFacts("matching");
  assert.ok(facts.length >= 10);
  assert.ok(facts.every((fact) => fact.surfaces.includes("matching")));
  assert.ok(
    new Set(facts.map((fact) => fact.theme)).size >= 3,
    "matching facts should cover multiple themes",
  );
});

test("getLoadingFunFacts returns loading-specific facts", () => {
  const facts = getLoadingFunFacts("loading");
  assert.ok(facts.length >= 10);
  assert.ok(facts.every((fact) => fact.surfaces.includes("loading")));
  assert.ok(
    new Set(facts.map((fact) => fact.theme)).size >= 3,
    "loading facts should cover multiple themes",
  );
});

test("getLoadingFunFacts prioritizes facts that match current tags", () => {
  const facts = getLoadingFunFacts("matching", {
    preferredTags: ["< 45dB", "高伪装"],
  });
  const firstFourIds = facts.slice(0, 4).map((fact) => fact.id);

  assert.ok(
    firstFourIds.includes("matching-noise"),
    "noise-related fact should be surfaced early for quietness tags",
  );
  assert.ok(
    firstFourIds.includes("matching-appearance"),
    "appearance-related fact should be surfaced early for disguise tags",
  );
});

test("getLoadingFunFacts can prefer practical themes first", () => {
  const facts = getLoadingFunFacts("loading", {
    preferredThemes: ["care", "decision", "experience"],
  });

  assert.equal(facts[0]?.theme, "care");
  assert.ok(
    facts.slice(0, 3).every((fact) => fact.theme !== "experience"),
    "first few loading facts should stay practical before experience-oriented ones",
  );
});

test("getNextLoadingFunFactIndex wraps around safely", () => {
  assert.equal(getNextLoadingFunFactIndex(0, 0), 0);
  assert.equal(getNextLoadingFunFactIndex(0, 1), 0);
  assert.equal(getNextLoadingFunFactIndex(0, 3), 1);
  assert.equal(getNextLoadingFunFactIndex(2, 3), 0);
});
