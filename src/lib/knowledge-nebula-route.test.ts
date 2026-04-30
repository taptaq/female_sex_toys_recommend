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
  });
});

test('parseKnowledgeNebulaPath("/knowledge/couples/") returns the matching topic slug', () => {
  assert.deepEqual(parseKnowledgeNebulaPath("/knowledge/couples/"), {
    route: "/knowledge",
    topicSlug: "couples",
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

test("KNOWLEDGE_NEBULA_TOPICS exposes the expected slugs in order", () => {
  assert.deepEqual(
    KNOWLEDGE_NEBULA_TOPICS.map((topic) => topic.slug),
    ["science", "people", "first-time", "couples", "care"],
  );
});

test('getKnowledgeNebulaTopicBySlug("science") returns the expected title', () => {
  assert.equal(getKnowledgeNebulaTopicBySlug("science")?.title, "正经科普");
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
