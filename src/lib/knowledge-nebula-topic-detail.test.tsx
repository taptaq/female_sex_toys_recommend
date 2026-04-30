import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { KnowledgeNebulaTopicSections } from "../components/KnowledgeNebulaTopicSections.tsx";
import { KNOWLEDGE_NEBULA_TOPICS } from "../data/knowledge-nebula.ts";
import { KnowledgeNebulaPage } from "../pages/KnowledgeNebulaPage.tsx";

const scienceTopic = KNOWLEDGE_NEBULA_TOPICS[0];

test("knowledge topic detail page no longer renders the TOPIC MAP navigator", () => {
  const html = renderToStaticMarkup(
    <KnowledgeNebulaPage
      pageVariants={{}}
      topicSlug="science"
      onBack={() => {}}
      onSelectTopic={() => {}}
    />,
  );

  assert.doesNotMatch(html, /TOPIC MAP/);
});

test("knowledge topic sections render fragment buttons instead of anchor jump cards", () => {
  const html = renderToStaticMarkup(
    <KnowledgeNebulaTopicSections topic={scienceTopic} />,
  );

  assert.match(html, /内容碎片/);
  assert.match(html, /button/);
  assert.doesNotMatch(html, /重点碎片/);
  assert.doesNotMatch(html, /全部内容/);
  assert.doesNotMatch(html, /跳转到正文章节/);
  assert.doesNotMatch(html, /href="#science-routes"/);
  assert.doesNotMatch(html, /clip-path/i);
  assert.doesNotMatch(html, /rotate-\[/);
  assert.doesNotMatch(html, /translate-y-/);
  assert.doesNotMatch(html, /新增卡片/);
  assert.doesNotMatch(html, /编辑卡片/);
});

test("knowledge topic sections only show editing affordances in admin mode", () => {
  const html = renderToStaticMarkup(
    <KnowledgeNebulaTopicSections topic={scienceTopic} isAdmin />,
  );

  assert.match(html, /新增卡片/);
  assert.match(html, /编辑卡片/);
});

test("knowledge topic sections include card metadata editing and source display affordances", () => {
  const source = fs.readFileSync(
    path.resolve(
      process.cwd(),
      "src/components/KnowledgeNebulaTopicSections.tsx",
    ),
    "utf8",
  );

  assert.match(source, /来源链接/);
  assert.match(source, /标签（逗号分隔）/);
  assert.match(source, /查看来源/);
  assert.match(source, /优先展示/);
  assert.match(source, /仅管理员可设置/);
  assert.doesNotMatch(source, /标记为 Featured/);
  assert.doesNotMatch(source, /FEATURED/);
  assert.doesNotMatch(source, /排序值/);
});

test("knowledge topic card hover glow no longer uses a laggy 300ms group-hover fade", () => {
  const source = fs.readFileSync(
    path.resolve(
      process.cwd(),
      "src/components/KnowledgeNebulaTopicSections.tsx",
    ),
    "utf8",
  );

  assert.match(source, /group-hover:opacity-100/);
  assert.doesNotMatch(source, /duration-300[^"]*group-hover:opacity-100/);
});
