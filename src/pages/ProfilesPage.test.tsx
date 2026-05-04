import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { ProfilesPage } from "./ProfilesPage.tsx";
import type { SavedRecommendationProfile } from "../lib/user-recommendation-profile.ts";

const profile: SavedRecommendationProfile = {
  id: "profile-1",
  title: "Nebula Pick 等 2 个推荐",
  summary: "偏好：静音、入门级；推荐：Nebula Pick",
  topProductIds: ["toy-1", "toy-2"],
  savedAt: "2026-05-02T12:00:00.000Z",
  payload: {
    createdAt: "2026-05-02T12:00:00.000Z",
    title: "Nebula Pick 等 2 个推荐",
    summary: "偏好：静音、入门级；推荐：Nebula Pick",
    topProductIds: ["toy-1", "toy-2"],
    answers: { tags: ["静音", "入门级"] },
    topProducts: [
      { id: "toy-1", name: "Nebula Pick", score: 96 },
      { id: "toy-2", name: "Second Pick", score: 88 },
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

  assert.match(html, /我的装备匹配档案/);
  assert.match(html, /EQUIPMENT MATCHING ARCHIVE/);
  assert.match(html, /Nebula Pick 等 2 个推荐/);
  assert.match(html, /已加密同步/);
  assert.match(html, /查看详情/);
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

  assert.match(html, /还没有保存过装备匹配档案/);
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

  assert.match(html, /当时的条件/);
  assert.match(html, /女性向/);
  assert.match(html, /纯入体/);
  assert.match(html, /温柔慢热/);
  assert.doesNotMatch(html, /female/);
  assert.doesNotMatch(html, /internal/);
  assert.doesNotMatch(html, /gentle/);
  assert.match(
    html,
    /当时的偏好[\s\S]*女性向[\s\S]*纯入体[\s\S]*≥ IPX7 防水/,
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

test("profiles detail shows candidates saved for later comparison", () => {
  const profileWithSavedCandidates: SavedRecommendationProfile = {
    ...detailedProfile,
    payload: {
      ...detailedProfile.payload,
      savedCandidateIds: ["toy-2", "toy-3"],
      savedCandidates: [
        { id: "toy-2", name: "Second Pick", score: 88 },
        { id: "toy-3", name: "Budget Backup", score: 82 },
      ],
    },
  };

  const html = renderToStaticMarkup(
    <ProfilesPage
      profiles={[profileWithSavedCandidates]}
      isLoading={false}
      error={null}
      userLabel="taptaq"
      initialSelectedProfile={profileWithSavedCandidates}
      onBack={() => {}}
      onReload={() => {}}
    />,
  );

  assert.match(html, /稍后比较/);
  assert.match(html, /当时特意留下来想继续看的候选/);
  assert.match(html, /Second Pick/);
  assert.match(html, /Budget Backup/);
});
