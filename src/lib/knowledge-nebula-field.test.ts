import assert from "node:assert/strict";
import test from "node:test";

import { KNOWLEDGE_NEBULA_TOPICS } from "../data/knowledge-nebula.ts";
import {
  DEFAULT_KNOWLEDGE_NEBULA_CAMERA,
  buildKnowledgeNebulaClusterAnchors,
  buildKnowledgeNebulaFocusCamera,
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
        topicSlug: "people",
        viewport: "desktop",
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
        topicSlug: "first-time",
        viewport: "desktop",
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
        topicSlug: "couples",
        viewport: "desktop",
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
        topicSlug: "care",
        viewport: "desktop",
        xPercent: 84,
        yPercent: 49,
        position: [6.2, 0.3, -1.8],
        scale: 1.02,
        depth: "far",
        driftAmplitude: 0.17,
        splitDelayMs: 700,
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
        topicSlug: "first-time",
        viewport: "mobile",
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
        topicSlug: "couples",
        viewport: "mobile",
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
        topicSlug: "care",
        viewport: "mobile",
        xPercent: 75,
        yPercent: 46,
        position: [3.35, 0.35, -1.3],
        scale: 0.9,
        depth: "far",
        driftAmplitude: 0.12,
        splitDelayMs: 680,
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

  assert.deepEqual(second[0].position, [-6.1, 0.1, -2.2]);
});

test("buildKnowledgeNebulaClusterAnchors requires exactly five topic clouds for desktop", () => {
  assert.throws(
    () =>
      buildKnowledgeNebulaClusterAnchors({
        topicSlugs: topicSlugs.slice(0, 4),
        viewport: "desktop",
      }),
    /exactly 5|five/i,
  );

  assert.throws(
    () =>
      buildKnowledgeNebulaClusterAnchors({
        topicSlugs: [...topicSlugs, topicSlugs[0]],
        viewport: "desktop",
      }),
    /exactly 5|five/i,
  );
});

test("buildKnowledgeNebulaClusterAnchors requires exactly five topic clouds for mobile", () => {
  assert.throws(
    () =>
      buildKnowledgeNebulaClusterAnchors({
        topicSlugs: topicSlugs.slice(0, 4),
        viewport: "mobile",
      }),
    /exactly 5|five/i,
  );

  assert.throws(
    () =>
      buildKnowledgeNebulaClusterAnchors({
        topicSlugs: [...topicSlugs, topicSlugs[0]],
        viewport: "mobile",
      }),
    /exactly 5|five/i,
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
  assert.ok(Math.max(...yValues) - Math.min(...yValues) >= 28);
  assert.ok(anchors.filter((anchor) => anchor.yPercent >= 70).length >= 2);
});

test("buildKnowledgeNebulaFocusCamera returns a fresh target tuple aimed at the selected cloud", () => {
  const anchor = buildKnowledgeNebulaClusterAnchors({
    topicSlugs,
    viewport: "desktop",
  })[2];

  const focusCamera = buildKnowledgeNebulaFocusCamera(anchor);

  assert.notDeepEqual(
    focusCamera.position,
    DEFAULT_KNOWLEDGE_NEBULA_CAMERA.position,
  );
  assert.deepEqual(focusCamera.target, anchor.position);
  assert.notStrictEqual(focusCamera.target, anchor.position);
  assert.ok(
    focusCamera.position[2] < DEFAULT_KNOWLEDGE_NEBULA_CAMERA.position[2],
  );

  anchor.position[0] = 999;

  assert.deepEqual(focusCamera.target, [0.1, -0.8, 1.1]);
});

test("buildKnowledgeNebulaFocusCamera uses the mid-depth camera offset", () => {
  const anchor = buildKnowledgeNebulaClusterAnchors({
    topicSlugs,
    viewport: "desktop",
  })[1];

  const focusCamera = buildKnowledgeNebulaFocusCamera(anchor);

  assert.ok(Math.abs(focusCamera.position[0] - -1.088) < 1e-12);
  assert.ok(Math.abs(focusCamera.position[1] - -0.65) < 1e-12);
  assert.ok(Math.abs(focusCamera.position[2] - 6.75) < 1e-12);
  assert.deepEqual(focusCamera.target, [-3.2, -2.5, -0.7]);
});

test("buildKnowledgeNebulaFocusCamera uses the far-depth camera offset", () => {
  const anchor = buildKnowledgeNebulaClusterAnchors({
    topicSlugs,
    viewport: "desktop",
  })[0];

  const focusCamera = buildKnowledgeNebulaFocusCamera(anchor);

  assert.ok(Math.abs(focusCamera.position[0] - -2.074) < 1e-12);
  assert.ok(Math.abs(focusCamera.position[1] - 0.026) < 1e-12);
  assert.ok(Math.abs(focusCamera.position[2] - 7.1) < 1e-12);
  assert.deepEqual(focusCamera.target, [-6.1, 0.1, -2.2]);
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
