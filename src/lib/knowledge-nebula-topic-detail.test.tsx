import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { KnowledgeNebulaTopicSections } from "../components/KnowledgeNebulaTopicSections.tsx";
import { KNOWLEDGE_NEBULA_TOPICS } from "../data/knowledge-nebula.js";

const scienceTopic = KNOWLEDGE_NEBULA_TOPICS[0];

test("knowledge topic sections render a cockpit console with paged knowledge screens", () => {
  const html = renderToStaticMarkup(
    <KnowledgeNebulaTopicSections topic={scienceTopic} />,
  );

  assert.match(html, /驾驶舱导航/);
  assert.match(html, /当前航线/);
  assert.match(html, /下一组/);
  assert.match(html, /23 项参数配置/);
  assert.match(html, /PARAM 06/);
  assert.match(html, /打开屏幕/);
  assert.match(html, /刺激路线先分清/);
  assert.doesNotMatch(html, /rounded-full blur-3xl/);
  assert.doesNotMatch(html, /radial-gradient\(circle,rgba/);
  assert.doesNotMatch(html, /主题星云核心/);
  assert.doesNotMatch(html, /进入主题云层/);
  assert.doesNotMatch(html, /内容碎片/);
  assert.doesNotMatch(html, /碎片轨道/);
  assert.doesNotMatch(html, /全部内容/);
  assert.doesNotMatch(html, /屏幕组 1\/1/);
  assert.doesNotMatch(html, /屏幕组/);
  assert.doesNotMatch(html, /跳转到正文章节/);
  assert.doesNotMatch(html, /href="#science-routes"/);
  assert.doesNotMatch(html, /新增卡片/);
});

test("knowledge topic sections can open a target section immediately when deep-linked", () => {
  const html = renderToStaticMarkup(
    <KnowledgeNebulaTopicSections
      topic={scienceTopic}
      initialOpenSectionId="science-routes"
    />,
  );

  assert.match(html, /主屏展开/);
  assert.match(html, /刺激路线先分清/);
});

test("knowledge topic sections only show editing affordances in admin mode", () => {
  const html = renderToStaticMarkup(
    <KnowledgeNebulaTopicSections topic={scienceTopic} isAdmin />,
  );

  assert.match(html, /新增卡片/);
  assert.match(html, /编辑卡片/);
});

test("knowledge topic sections include cockpit main-screen affordances and card editing fields", () => {
  const source = fs.readFileSync(
    path.resolve(
      process.cwd(),
      "src/components/KnowledgeNebulaTopicSections.tsx",
    ),
    "utf8",
  );

  assert.match(source, /主屏展开/);
  assert.match(source, /expanded-cockpit-main-screen/);
  assert.match(source, /可能关联的参数卡片/);
  assert.doesNotMatch(source, /本主题其他屏幕/);
  assert.match(source, /来源链接/);
  assert.match(source, /标签（逗号分隔）/);
  assert.match(source, /查看来源/);
  assert.match(source, /优先展示/);
  assert.match(source, /仅管理员可设置/);
  assert.doesNotMatch(source, /主题归属/);
  assert.doesNotMatch(source, /内容长度/);
  assert.doesNotMatch(source, /重点状态/);
  assert.doesNotMatch(source, /碎片已展开/);
});

test("default knowledge cards include richer detail paragraphs", () => {
  for (const topic of KNOWLEDGE_NEBULA_TOPICS) {
    assert.ok(
      topic.sections.length >= 23,
      `${topic.slug} should include at least 20 expanded knowledge cards`,
    );

    for (const section of topic.sections) {
      assert.ok(
        section.body.length >= 3,
        `${topic.slug}/${section.id} should have at least 3 detail paragraphs`,
      );
      assert.ok(
        Array.isArray(section.embedding) && section.embedding.length >= 12,
        `${topic.slug}/${section.id} should include a seed embedding`,
      );
    }
  }
});

test("default expanded knowledge cards avoid repeated placeholder body templates", () => {
  const allBodyText = KNOWLEDGE_NEBULA_TOPICS.flatMap((topic) =>
    topic.sections.flatMap((section) => section.body),
  ).join("\n");

  assert.doesNotMatch(allBodyText, /这类用户先看自己的限制条件/);
  assert.doesNotMatch(allBodyText, /第一次购买的目标不是一步到位/);
  assert.doesNotMatch(allBodyText, /情侣共玩的重点不是把设备用满/);
  assert.doesNotMatch(allBodyText, /维护不是额外负担/);
});

test("topic detail cockpit reduces label noise and supports partial screen loading", () => {
  const sectionsSource = fs.readFileSync(
    path.resolve(
      process.cwd(),
      "src/components/KnowledgeNebulaTopicSections.tsx",
    ),
    "utf8",
  );
  const nodeLayerSource = fs.readFileSync(
    path.resolve(
      process.cwd(),
      "src/components/knowledge-nebula/TopicDetailNodeLayer.tsx",
    ),
    "utf8",
  );

  assert.match(sectionsSource, /visibleScreenStart/);
  assert.match(sectionsSource, /COCKPIT_SCREEN_GROUP_SIZE/);
  assert.match(sectionsSource, /currentScreenGroupSize/);
  assert.match(sectionsSource, /desktop: 6/);
  assert.match(sectionsSource, /mobile: 4/);
  assert.match(sectionsSource, /驾驶舱中控台/);
  assert.match(sectionsSource, /expanded-cockpit-main-screen/);
  assert.match(sectionsSource, /主屏展开/);
  assert.match(sectionsSource, /模拟巡航/);
  assert.match(sectionsSource, /min-h-0/);
  assert.match(sectionsSource, /top-\[5\.2%\] z-20 w-\[min\(58rem,90vw\)\] -translate-x-1\/2 text-center sm:top-\[8%\]/);
  assert.match(sectionsSource, /top-\[8\.8dvh\]/);
  assert.match(sectionsSource, /h-\[72dvh\]/);
  assert.match(sectionsSource, /sm:top-\[10\.5dvh\]/);
  assert.match(sectionsSource, /sm:h-\[68dvh\]/);
  assert.match(sectionsSource, /mt-3 grid min-h-0 flex-1 gap-3 overflow-hidden/);
  assert.match(sectionsSource, /sm:mt-4 sm:gap-4 lg:grid-cols-\[1fr_16rem\]/);
  assert.match(sectionsSource, /absolute inset-x-3 bottom-3 z-40 mx-auto max-w-5xl/);
  assert.match(sectionsSource, /sm:inset-x-4 sm:bottom-7/);
  assert.match(sectionsSource, /rounded-\[1\.45rem\]/);
  assert.match(sectionsSource, /px-3\.5 py-3/);
  assert.match(sectionsSource, /sm:rounded-\[1\.75rem\] sm:px-5 sm:py-4/);
  assert.match(nodeLayerSource, /cockpit-screen/);
  assert.match(nodeLayerSource, /SCREEN_SLOT_STYLES/);
  assert.match(nodeLayerSource, /const floatY = 3 \+ \(index % 3\) \* 1\.4/);
  assert.match(nodeLayerSource, /usePagePerformanceState/);
  assert.match(nodeLayerSource, /shouldAnimate \? \[0, -floatY, 0\] : 0/);
  assert.match(nodeLayerSource, /repeat: isActive \? 0 : repeat/);
  assert.doesNotMatch(nodeLayerSource, /PHYSICAL_STRUCTURE_BY_INDEX/);
  assert.doesNotMatch(nodeLayerSource, /致密云核/);
  assert.doesNotMatch(nodeLayerSource, /电离气体/);
  assert.doesNotMatch(nodeLayerSource, /暗尘埃/);
});

test("topic detail 3d scene uses volumetric nebula layers instead of a flat sphere core", () => {
  const source = fs.readFileSync(
    path.resolve(
      process.cwd(),
      "src/components/knowledge-nebula/TopicDetailScene3D.tsx",
    ),
    "utf8",
  );

  assert.match(source, /emissionFilamentGeometry/);
  assert.match(source, /dustLaneGeometry/);
  assert.match(source, /H_ALPHA_COLOR/);
  assert.match(source, /OIII_COLOR/);
  assert.match(source, /SII_COLOR/);
  assert.match(source, /instancedMesh/);
  assert.match(source, /torusGeometry/);
  assert.match(source, /IonizedGasLayer/);
  assert.match(source, /DarkDustLane/);
  assert.match(source, /DenseCoreCluster/);
  assert.match(source, /YoungStarCluster/);
  assert.match(source, /ShockFrontArc/);
  assert.match(source, /SpectralEmissionLines/);
  assert.match(source, /getTopicDetailSceneComplexityBudget/);
  assert.match(source, /frameloop="demand"/);
  assert.match(source, /invalidate/);
  assert.match(source, /if \(!isVisible \|\| prefersReducedMotion\) \{/);
  assert.match(source, /\.dispose\(\)/);
  assert.match(source, /spectralTubes\.forEach/);
  assert.doesNotMatch(source, /SphereGeometry/);
  assert.doesNotMatch(source, /sphereGeometry/);
  assert.doesNotMatch(source, /nebulaCloudGeometry/);
  assert.doesNotMatch(source, /<mesh scale=\{\[1\.9, 0\.62, 1\]/);
  assert.doesNotMatch(source, /sphereGeometry args=\{\[1\.1/);
  assert.doesNotMatch(source, /sphereGeometry args=\{\[1\.9/);
});

test("topic detail nodes render knowledge shards as cockpit screens", () => {
  const source = fs.readFileSync(
    path.resolve(
      process.cwd(),
      "src/components/knowledge-nebula/TopicDetailNodeLayer.tsx",
    ),
    "utf8",
  );

  assert.match(source, /打开屏幕/);
  assert.match(source, /SCREEN/);
  assert.match(source, /PARAM/);
  assert.match(source, /COCKPIT_SCREEN_VISUAL_STYLE/);
  assert.match(source, /热度信号/);
  assert.match(source, /viewCount/);
  assert.match(source, /hotnessRank/);
  assert.match(source, /isHottest/);
  assert.match(source, /high-heat/);
  assert.match(source, /widthBoost/);
  assert.match(source, /heightBoost/);
  assert.match(source, /mobile:\s*\[/);
  assert.match(source, /width: "min\(16\.8rem, 68vw\)"/);
  assert.match(source, /top: "20%"/);
  assert.match(source, /top: "72%"/);
  assert.match(source, /line-clamp-1/);
  assert.match(source, /min-h-\[1\.6rem\]/);
  assert.match(source, /leading-\[1\.6\]/);
  assert.match(source, /cockpit-title-divider my-2\.5 h-px w-full bg-gradient-to-r from-cyan-100\/42 via-cyan-100\/18 to-transparent opacity-80/);
  assert.match(source, /my-2\.5/);
  assert.match(source, /whileHover=\{\{ y: -8, scale: 1\.018 \}\}/);
  assert.doesNotMatch(source, /top-1\/2 h-px/);
  assert.doesNotMatch(source, /主信号/);
  assert.doesNotMatch(source, /高热度/);
  assert.doesNotMatch(source, /巡航/);
  assert.doesNotMatch(source, /heatScale/);
  assert.match(source, /驾驶舱/);
  assert.doesNotMatch(source, /<span>\{anchor\.id\}<\/span>/);
  assert.doesNotMatch(source, /top: "59%"/);
  assert.doesNotMatch(source, /读取碎片/);
  assert.doesNotMatch(source, /border-rose/);
  assert.doesNotMatch(source, /border-amber/);
  assert.doesNotMatch(source, /border-indigo/);
  assert.doesNotMatch(source, /slot\.tone/);
  assert.doesNotMatch(source, /slot\.text/);
});

test("topic detail sections record cockpit parameter views", () => {
  const sectionsSource = fs.readFileSync(
    path.resolve(
      process.cwd(),
      "src/components/KnowledgeNebulaTopicSections.tsx",
    ),
    "utf8",
  );

  assert.match(sectionsSource, /recordCardView/);
  assert.match(sectionsSource, /getKnowledgeCardViewerKey/);
  assert.match(sectionsSource, /\/api\/knowledge\/cards\/\$\{sectionId\}\/view/);
  assert.match(sectionsSource, /viewerKey/);
  assert.match(sectionsSource, /viewedSectionIds/);
  assert.match(sectionsSource, /viewCount/);
  assert.match(sectionsSource, /已被查看/);
});

test("knowledge nebula store schema keeps unique card views per viewer", () => {
  const storeSource = fs.readFileSync(
    path.resolve(
      process.cwd(),
      "src/server/knowledge-nebula-store.ts",
    ),
    "utf8",
  );
  const prismaSource = fs.readFileSync(
    path.resolve(process.cwd(), "prisma/schema.prisma"),
    "utf8",
  );

  assert.match(storeSource, /knowledge_nebula_card_views/);
  assert.match(storeSource, /ON CONFLICT \(card_id, viewer_key\) DO NOTHING/);
  assert.match(storeSource, /counted/);
  assert.match(prismaSource, /model knowledge_nebula_card_views/);
  assert.match(prismaSource, /@@unique\(\[card_id, viewer_key\]/);
});
