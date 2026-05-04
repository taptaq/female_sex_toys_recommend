import assert from "node:assert/strict";
import test from "node:test";

import {
  KNOWLEDGE_NEBULA_TOPICS,
  getKnowledgeNebulaTopicBySlug,
} from "../data/knowledge-nebula.ts";
import {
  buildKnowledgeNebulaPath,
  parseKnowledgeNebulaPath,
} from "./knowledge-nebula-route.ts";
import { detectRoute } from "./app-shell.ts";

test('parseKnowledgeNebulaPath("/knowledge") returns the base route state', () => {
  assert.deepEqual(parseKnowledgeNebulaPath("/knowledge"), {
    route: "/knowledge",
    topicSlug: undefined,
  });
});

test('parseKnowledgeNebulaPath("/knowledge/") returns the base route state', () => {
  assert.deepEqual(parseKnowledgeNebulaPath("/knowledge/"), {
    route: "/knowledge",
    topicSlug: undefined,
  });
});

test('parseKnowledgeNebulaPath("/knowledge/first-time") returns the matching topic slug', () => {
  assert.deepEqual(parseKnowledgeNebulaPath("/knowledge/first-time"), {
    route: "/knowledge",
    topicSlug: "first-time",
    sectionId: undefined,
  });
});

test('parseKnowledgeNebulaPath("/knowledge/couples/") returns the matching topic slug', () => {
  assert.deepEqual(parseKnowledgeNebulaPath("/knowledge/couples/"), {
    route: "/knowledge",
    topicSlug: "couples",
    sectionId: undefined,
  });
});

test('parseKnowledgeNebulaPath("/knowledge/science/science-noise") returns the matching topic and section', () => {
  assert.deepEqual(parseKnowledgeNebulaPath("/knowledge/science/science-noise"), {
    route: "/knowledge",
    topicSlug: "science",
    sectionId: "science-noise",
  });
});

test('parseKnowledgeNebulaPath("/knowledge/not-found") falls back to the base route state', () => {
  assert.deepEqual(parseKnowledgeNebulaPath("/knowledge/not-found"), {
    route: "/knowledge",
    topicSlug: undefined,
  });
});

test("buildKnowledgeNebulaPath() returns the base knowledge path", () => {
  assert.equal(buildKnowledgeNebulaPath(), "/knowledge");
});

test('buildKnowledgeNebulaPath("couples") returns the topic path', () => {
  assert.equal(buildKnowledgeNebulaPath("couples"), "/knowledge/couples");
});

test('buildKnowledgeNebulaPath("science", "science-noise") returns the topic detail path with section id', () => {
  assert.equal(
    buildKnowledgeNebulaPath("science", "science-noise"),
    "/knowledge/science/science-noise",
  );
});

test("KNOWLEDGE_NEBULA_TOPICS exposes the expected slugs in order", () => {
  assert.deepEqual(
    KNOWLEDGE_NEBULA_TOPICS.map((topic) => topic.slug),
    ["science", "people", "lgbtq", "first-time", "couples", "care"],
  );
});

test("KNOWLEDGE_NEBULA_TOPICS uses topic names aligned with card content", () => {
  assert.deepEqual(
    KNOWLEDGE_NEBULA_TOPICS.map((topic) => topic.title),
    [
      "参数与体验原理",
      "人群与场景导航",
      "LGBT+ 友好探索",
      "新手第一台",
      "伴侣互动与边界",
      "清洁收纳与长期维护",
    ],
  );
});

test("people topic no longer carries the dedicated LGBT+ card cluster", () => {
  const peopleTopic = getKnowledgeNebulaTopicBySlug("people");

  assert.ok(peopleTopic);
  assert.ok(
    peopleTopic.sections.every(
      (section) => !section.tags?.some((tag) => tag.toLowerCase() === "lgbt+"),
    ),
  );
});

test("lgbtq topic exists as an independent nebula theme", () => {
  const topic = getKnowledgeNebulaTopicBySlug("lgbtq");

  assert.ok(topic);
  assert.equal(topic.title, "LGBT+ 友好探索");
  assert.ok(topic.sections.length >= 23);
  assert.ok(
    topic.sections.some((section) =>
      section.tags?.some((tag) => tag.toLowerCase() === "lgbt+"),
    ),
  );
});

test('getKnowledgeNebulaTopicBySlug("science") returns the expected title', () => {
  assert.equal(getKnowledgeNebulaTopicBySlug("science")?.title, "参数与体验原理");
});

test('detectRoute returns "/knowledge" for the knowledge hub', () => {
  assert.equal(detectRoute("/knowledge"), "/knowledge");
});

test('detectRoute returns "/knowledge" for knowledge topic paths', () => {
  assert.equal(detectRoute("/knowledge/couples"), "/knowledge");
});

test('detectRoute does not classify unrelated knowledge-prefixed paths as "/knowledge"', () => {
  assert.notEqual(detectRoute("/knowledge-archive"), "/knowledge");
});
