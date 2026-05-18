import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { ProfilesPage } from "./ProfilesPage.tsx";
import type { SavedRecommendationProfile } from "../lib/user-recommendation-profile.ts";

const profile: SavedRecommendationProfile = {
  id: "profile-1",
  title: "Nebula Pick 等 2 个推荐",
  summary: "偏好：静音、入门级；推荐：Nebula Pick",
  topProductIds: ["item-1", "item-2"],
  savedAt: "2026-05-02T12:00:00.000Z",
  payload: {
    createdAt: "2026-05-02T12:00:00.000Z",
    title: "Nebula Pick 等 2 个推荐",
    summary: "偏好：静音、入门级；推荐：Nebula Pick",
    topProductIds: ["item-1", "item-2"],
    answers: { tags: ["静音", "入门级"] },
    topProducts: [
      { id: "item-1", name: "Nebula Pick", score: 96 },
      { id: "item-2", name: "Second Pick", score: 88 },
    ],
    backupProducts: [],
    recommendationTips: [],
    shoppingGuidance: ["优先确认清洁便利性"],
  },
};

const detailedProfile: SavedRecommendationProfile = {
  ...profile,
  payload: {
    ...profile.payload,
    answers: {
      tags: ["女性向", "纯入体", "女性向", "  ≥ IPX7 防水  ", "≥ IPX7 防水"],
      gender: "female",
      physicalForm: "internal",
      motorType: "gentle",
      budget: [300, 10000],
      maxDb: 50,
      waterproof: 7,
    },
  },
};

const personaProfile: SavedRecommendationProfile = {
  ...detailedProfile,
  payload: {
    ...detailedProfile.payload,
    bodyPersona: {
      sessionId: "persona-1",
      title: "星幕型·隐秘安全感者",
      hiddenRouteSummary: "日常器物型，隐藏力 S，共居安心度 高",
      unlocked: true,
    },
  },
};

const naturalLanguageProfile: SavedRecommendationProfile = {
  ...detailedProfile,
  payload: {
    ...detailedProfile.payload,
    matchInputMode: "natural-language",
    naturalLanguageQuery:
      "想要一个更静音、预算 300 以内、适合女生新手、最好容易清洁的产品。",
  },
};

test("profiles page renders saved equipment matching profiles", () => {
  const html = renderToStaticMarkup(
    <ProfilesPage
      profiles={[profile]}
      isLoading={false}
      error={null}
      userLabel="taptaq"
      onBack={() => {}}
      onReload={() => {}}
    />,
  );

  assert.match(html, /匹配档案/);
  assert.match(html, /EQUIPMENT MATCHING ARCHIVE/);
  assert.match(html, /Nebula Pick 等 2 个推荐/);
  assert.match(html, /已加密同步/);
  assert.match(html, /回看这次判断/);
  assert.match(html, /当时更在意/);
  assert.match(html, /先看路线/);
  assert.doesNotMatch(html, /我的收藏/);
});

test("profiles page renders an empty state", () => {
  const html = renderToStaticMarkup(
    <ProfilesPage
      profiles={[]}
      isLoading={false}
      error={null}
      userLabel="taptaq"
      onBack={() => {}}
      onReload={() => {}}
    />,
  );

  assert.match(html, /还没有保存过匹配档案/);
  assert.match(html, /完成一次匹配后/);
});

test("profiles detail dedupes saved preference tags and localizes answer values", () => {
  const html = renderToStaticMarkup(
    <ProfilesPage
      profiles={[detailedProfile]}
      isLoading={false}
      error={null}
      userLabel="taptaq"
      initialSelectedProfile={detailedProfile}
      onBack={() => {}}
      onReload={() => {}}
    />,
  );

  assert.match(html, /那次决策的硬约束/);
  assert.match(html, /女性向/);
  assert.match(html, /纯入体/);
  assert.match(html, /温柔慢热/);
  assert.doesNotMatch(html, /female/);
  assert.doesNotMatch(html, /internal/);
  assert.doesNotMatch(html, /gentle/);
  assert.match(
    html,
    /那次留下的偏好线索[\s\S]*女性向[\s\S]*纯入体[\s\S]*≥ IPX7 防水/,
  );
  assert.equal(
    (
      html.match(
        /<span class="rounded-full border border-cyan-300\/14 bg-cyan-300\/8 px-2\.5 py-1 text-xs text-cyan-100\/75">≥ IPX7 防水<\/span>/g,
      ) || []
    ).length,
    1,
  );
});

test("profiles detail summarizes the saved session in natural language instead of exposing raw internal fields", () => {
  const html = renderToStaticMarkup(
    <ProfilesPage
      profiles={[detailedProfile]}
      isLoading={false}
      error={null}
      userLabel="taptaq"
      initialSelectedProfile={detailedProfile}
      onBack={() => {}}
      onReload={() => {}}
    />,
  );

  assert.match(html, /这次为什么会得到这组推荐/);
  assert.match(html, /你当时更偏向女性向/);
  assert.match(html, /纯入体/);
  assert.match(html, /温柔慢热/);
  assert.match(html, /更适合先回到那次判断继续比较/);
  assert.doesNotMatch(html, />50</);
  assert.doesNotMatch(html, />7</);
});

test("profiles detail frames the archive as a decision snapshot with next comparison guidance", () => {
  const html = renderToStaticMarkup(
    <ProfilesPage
      profiles={[detailedProfile]}
      isLoading={false}
      error={null}
      userLabel="taptaq"
      initialSelectedProfile={detailedProfile}
      onBack={() => {}}
      onReload={() => {}}
    />,
  );

  assert.match(html, /当时更在意/);
  assert.match(html, /主推荐路线/);
  assert.match(html, /推荐原因/);
  assert.match(html, /如果现在重看/);
  assert.match(html, /优先比较静音、清洁和预算是否仍然符合现在的使用环境/);
  assert.doesNotMatch(html, /score/);
});

test("profiles detail no longer renders a later-comparison candidate section", () => {
  const html = renderToStaticMarkup(
    <ProfilesPage
      profiles={[detailedProfile]}
      isLoading={false}
      error={null}
      userLabel="taptaq"
      initialSelectedProfile={detailedProfile}
      onBack={() => {}}
      onReload={() => {}}
    />,
  );

  assert.doesNotMatch(html, /稍后比较/);
  assert.doesNotMatch(html, /当时特意留下来想继续看的候选/);
});

test("profiles detail shows original natural language request when the archive came from free-text matching", () => {
  const html = renderToStaticMarkup(
    <ProfilesPage
      profiles={[naturalLanguageProfile]}
      isLoading={false}
      error={null}
      userLabel="taptaq"
      initialSelectedProfile={naturalLanguageProfile}
      onBack={() => {}}
      onReload={() => {}}
    />,
  );

  assert.match(html, /当时原始描述/);
  assert.match(html, /想要一个更静音、预算 300 以内、适合女生新手、最好容易清洁的产品。/);
});

test("profiles page gives mobile users a calmer stacked archive layout and a wider detail sheet", () => {
  const html = renderToStaticMarkup(
    <ProfilesPage
      profiles={[detailedProfile]}
      isLoading={false}
      error={null}
      userLabel="taptaq"
      initialSelectedProfile={detailedProfile}
      onBack={() => {}}
      onReload={() => {}}
    />,
  );

  assert.match(html, /gap-3 sm:gap-4/);
  assert.match(html, /max-h-\[92dvh\] w-full max-w-4xl/);
  assert.match(html, /grid gap-3 xl:grid-cols-\[minmax\(0,1\.1fr\)_minmax\(0,0\.9fr\)\]/);
  assert.match(html, /sticky top-0 z-10 -mx-5 -mt-5/);
  assert.match(html, /w-full sm:w-auto/);
});

test("profiles detail keeps dense secondary sections in a separate right rail on large screens while staying single-column on mobile", () => {
  const html = renderToStaticMarkup(
    <ProfilesPage
      profiles={[detailedProfile]}
      isLoading={false}
      error={null}
      userLabel="taptaq"
      initialSelectedProfile={detailedProfile}
      onBack={() => {}}
      onReload={() => {}}
    />,
  );

  assert.match(html, /那次决策的硬约束/);
  assert.match(html, /那次留下的偏好线索/);
  assert.match(html, /那次先看这几条路线/);
  assert.match(html, /space-y-4 xl:space-y-3/);
});

test("profiles detail presents saved recommendations as decision routes instead of raw score rows", () => {
  const html = renderToStaticMarkup(
    <ProfilesPage
      profiles={[detailedProfile]}
      isLoading={false}
      error={null}
      userLabel="taptaq"
      initialSelectedProfile={detailedProfile}
      onBack={() => {}}
      onReload={() => {}}
    />,
  );

  assert.match(html, /那次先看这几条路线/);
  assert.match(html, /主推荐/);
  assert.match(html, /备选 1/);
  assert.match(html, /当时系统先把它放在最前面/);
  assert.doesNotMatch(html, /<span class="text-xs text-cyan-100\/65">/);
});

test("ProfilesPage shows saved body persona summary when present", () => {
  const html = renderToStaticMarkup(
    <ProfilesPage
      profiles={[personaProfile]}
      isLoading={false}
      error={null}
      userLabel="tester"
      initialSelectedProfile={personaProfile}
      onBack={() => undefined}
      onReload={() => undefined}
    />,
  );

  assert.match(html, /身体人格快照/);
  assert.match(html, /星幕型·隐秘安全感者/);
  assert.match(html, /隐藏力 S/);
});
