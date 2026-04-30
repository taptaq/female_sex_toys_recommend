import assert from "node:assert/strict";
import test from "node:test";

import { KNOWLEDGE_NEBULA_TOPICS } from "../data/knowledge-nebula.ts";
import { buildKnowledgeNebulaClusterAnchors } from "./knowledge-nebula-field.ts";
import {
  buildMotherCloudBands,
  buildStarFieldLayers,
  buildTopicGlowProfiles,
} from "./knowledge-nebula-mother-cloud.ts";

const topicSlugs = KNOWLEDGE_NEBULA_TOPICS.map((topic) => topic.slug);

test("buildMotherCloudBands creates a wide layered desktop mother cloud", () => {
  const bands = buildMotherCloudBands("desktop");

  assert.equal(bands.length, 7);
  assert.ok(bands.every((band) => band.scale[0] >= 5.2));
  assert.ok(bands.some((band) => band.role === "core"));
  assert.ok(bands.some((band) => band.role === "spiral-arm"));
  assert.ok(new Set(bands.map((band) => band.tint)).size >= 4);
});

test("buildMotherCloudBands creates a lighter mobile version without changing the visual language", () => {
  const desktop = buildMotherCloudBands("desktop");
  const mobile = buildMotherCloudBands("mobile");

  assert.equal(mobile.length, 5);
  assert.ok(mobile.length < desktop.length);
  assert.ok(mobile.every((band) => band.scale[0] >= 3.9));
  assert.ok(mobile.some((band) => band.role === "core"));
  assert.ok(mobile.some((band) => band.role === "spiral-arm"));
});

test("buildStarFieldLayers separates far, mid, and foreground stars", () => {
  const layers = buildStarFieldLayers("desktop");

  assert.deepEqual(
    layers.map((layer) => layer.depth),
    ["far", "mid", "near"],
  );
  assert.ok(layers[0].count > layers[2].count);
  assert.ok(layers[2].size > layers[0].size);
});

test("buildStarFieldLayers creates an obvious full-page particle starfield", () => {
  const desktop = buildStarFieldLayers("desktop");
  const mobile = buildStarFieldLayers("mobile");

  assert.ok(desktop.reduce((sum, layer) => sum + layer.count, 0) >= 900);
  assert.ok(mobile.reduce((sum, layer) => sum + layer.count, 0) >= 420);
  assert.ok(desktop.every((layer) => layer.opacity >= 0.45));
});

test("buildTopicGlowProfiles maps anchors into non-uniform mother-cloud glow regions", () => {
  const anchors = buildKnowledgeNebulaClusterAnchors({
    topicSlugs,
    viewport: "desktop",
  });
  const profiles = buildTopicGlowProfiles(anchors);

  assert.equal(profiles.length, 5);
  assert.deepEqual(
    profiles.map((profile) => profile.topicSlug),
    topicSlugs,
  );
  assert.ok(new Set(profiles.map((profile) => profile.shape)).size >= 3);
  assert.ok(
    profiles.every((profile) => profile.cloudScale[0] !== profile.cloudScale[1]),
  );
});

test("buildTopicGlowProfiles keeps topic nebulae airy and visibly distinct", () => {
  const anchors = buildKnowledgeNebulaClusterAnchors({
    topicSlugs,
    viewport: "desktop",
  });
  const profiles = buildTopicGlowProfiles(anchors);

  assert.ok(profiles.every((profile) => profile.opacity <= 0.3));
  assert.equal(
    new Set(
      profiles.map((profile) =>
        [profile.cloudScale[0], profile.cloudScale[1], profile.cloudOffset[0]].join(":"),
      ),
    ).size,
    profiles.length,
  );
  assert.ok(
    profiles.some(
      (profile) => profile.cloudScale[0] / profile.cloudScale[1] > 2.15,
    ),
  );
});
