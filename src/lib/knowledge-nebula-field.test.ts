import assert from "node:assert/strict";
import test from "node:test";

import { KNOWLEDGE_NEBULA_TOPICS } from "../data/knowledge-nebula.ts";
import {
  buildKnowledgeNebulaClusterAnchors,
  getKnowledgeNebulaTimeline,
} from "./knowledge-nebula-field.ts";

const topicSlugs = KNOWLEDGE_NEBULA_TOPICS.map((topic) => topic.slug);

test("buildKnowledgeNebulaClusterAnchors returns the exact desktop layout contract", () => {
  const anchors = buildKnowledgeNebulaClusterAnchors({
    topicSlugs,
    viewport: "desktop",
  });

  assert.deepEqual(
    anchors.map((anchor) => ({
      topicSlug: anchor.topicSlug,
      viewport: anchor.viewport,
      xPercent: anchor.xPercent,
      yPercent: anchor.yPercent,
      position: anchor.position,
      scale: anchor.scale,
      depth: anchor.depth,
      driftAmplitude: anchor.driftAmplitude,
      splitDelayMs: anchor.splitDelayMs,
      labelWidthRem: anchor.labelWidthRem,
    })),
    [
      {
        topicSlug: "science",
        viewport: "desktop",
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
        topicSlug: "people",
        viewport: "desktop",
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
        topicSlug: "lgbtq",
        viewport: "desktop",
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
        topicSlug: "first-time",
        viewport: "desktop",
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
        topicSlug: "couples",
        viewport: "desktop",
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
        topicSlug: "care",
        viewport: "desktop",
        xPercent: 87,
        yPercent: 46,
        position: [6.8, 0.55, -1.85],
        scale: 1.02,
        depth: "far",
        driftAmplitude: 0.17,
        splitDelayMs: 760,
        labelWidthRem: 9.25,
      },
    ],
  );
});

test("buildKnowledgeNebulaClusterAnchors returns the exact mobile layout contract", () => {
  const anchors = buildKnowledgeNebulaClusterAnchors({
    topicSlugs,
    viewport: "mobile",
  });

  assert.deepEqual(
    anchors.map((anchor) => ({
      topicSlug: anchor.topicSlug,
      viewport: anchor.viewport,
      xPercent: anchor.xPercent,
      yPercent: anchor.yPercent,
      position: anchor.position,
      scale: anchor.scale,
      depth: anchor.depth,
      driftAmplitude: anchor.driftAmplitude,
      splitDelayMs: anchor.splitDelayMs,
      labelWidthRem: anchor.labelWidthRem,
    })),
    [
      {
        topicSlug: "science",
        viewport: "mobile",
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
        topicSlug: "people",
        viewport: "mobile",
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
        topicSlug: "lgbtq",
        viewport: "mobile",
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
        topicSlug: "first-time",
        viewport: "mobile",
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
        topicSlug: "couples",
        viewport: "mobile",
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
        topicSlug: "care",
        viewport: "mobile",
        xPercent: 75,
        yPercent: 46,
        position: [3.35, 0.35, -1.3],
        scale: 0.9,
        depth: "far",
        driftAmplitude: 0.12,
        splitDelayMs: 740,
        labelWidthRem: 7.75,
      },
    ],
  );
});

test("buildKnowledgeNebulaClusterAnchors returns fresh position tuples on each call", () => {
  const first = buildKnowledgeNebulaClusterAnchors({
    topicSlugs,
    viewport: "desktop",
  });
  const second = buildKnowledgeNebulaClusterAnchors({
    topicSlugs,
    viewport: "desktop",
  });

  assert.notStrictEqual(first[0].position, second[0].position);

  first[0].position[0] = 999;

  assert.deepEqual(second[0].position, [-6.8, 0.4, -2.35]);
});

test("buildKnowledgeNebulaClusterAnchors requires exactly six topic clouds for desktop", () => {
  assert.throws(
    () =>
      buildKnowledgeNebulaClusterAnchors({
        topicSlugs: topicSlugs.slice(0, 5),
        viewport: "desktop",
      }),
    /exactly 6|six/i,
  );

  assert.throws(
    () =>
      buildKnowledgeNebulaClusterAnchors({
        topicSlugs: [...topicSlugs, topicSlugs[0]],
        viewport: "desktop",
      }),
    /exactly 6|six/i,
  );
});

test("buildKnowledgeNebulaClusterAnchors requires exactly six topic clouds for mobile", () => {
  assert.throws(
    () =>
      buildKnowledgeNebulaClusterAnchors({
        topicSlugs: topicSlugs.slice(0, 5),
        viewport: "mobile",
      }),
    /exactly 6|six/i,
  );

  assert.throws(
    () =>
      buildKnowledgeNebulaClusterAnchors({
        topicSlugs: [...topicSlugs, topicSlugs[0]],
        viewport: "mobile",
      }),
    /exactly 6|six/i,
  );
});

test("mobile anchors stay inside readable label-safe bounds", () => {
  const anchors = buildKnowledgeNebulaClusterAnchors({
    topicSlugs,
    viewport: "mobile",
  });

  assert.ok(
    anchors.every((anchor) => anchor.xPercent >= 16 && anchor.xPercent <= 84),
  );
  assert.ok(
    anchors.every((anchor) => anchor.yPercent >= 20 && anchor.yPercent <= 80),
  );
  assert.ok(anchors.every((anchor) => anchor.labelWidthRem >= 7.5));
});

test("desktop anchors preserve a center breathing zone and mixed depth", () => {
  const anchors = buildKnowledgeNebulaClusterAnchors({
    topicSlugs,
    viewport: "desktop",
  });

  assert.ok(
    anchors.every((anchor) => {
      const awayFromCenterX = Math.abs(anchor.xPercent - 50) >= 8;
      const awayFromCenterY = Math.abs(anchor.yPercent - 50) >= 10;
      return awayFromCenterX || awayFromCenterY;
    }),
  );
  assert.deepEqual(
    new Set(anchors.map((anchor) => anchor.depth)),
    new Set(["near", "mid", "far"]),
  );
});

test("desktop anchors spread topic clouds across the full starfield", () => {
  const anchors = buildKnowledgeNebulaClusterAnchors({
    topicSlugs,
    viewport: "desktop",
  });

  const xValues = anchors.map((anchor) => anchor.xPercent);
  const yValues = anchors.map((anchor) => anchor.yPercent);

  assert.ok(Math.max(...xValues) - Math.min(...xValues) >= 68);
  assert.ok(Math.max(...yValues) - Math.min(...yValues) >= 40);
  assert.ok(anchors.filter((anchor) => anchor.yPercent >= 70).length >= 2);
  assert.ok(anchors.filter((anchor) => anchor.yPercent <= 38).length >= 1);
});

test("getKnowledgeNebulaTimeline returns the full-motion contract", () => {
  assert.deepEqual(getKnowledgeNebulaTimeline(false), {
    aggregateMs: 980,
    splitMs: 1680,
    focusMs: 960,
  });
});

test("getKnowledgeNebulaTimeline returns the reduced-motion contract", () => {
  assert.deepEqual(getKnowledgeNebulaTimeline(true), {
    aggregateMs: 120,
    splitMs: 160,
    focusMs: 180,
  });
});
