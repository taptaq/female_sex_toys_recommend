import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { RankedProduct } from "../lib/app-shell.ts";
import { ResultsPage } from "./ResultsPage.tsx";

const authPanel = {
  isConfigured: true,
  userLabel: null,
  statusMessage: null,
  isSubmitting: false,
  onSubmit: async () => {},
  onSignOut: async () => {},
};

function makeProduct(overrides: Partial<RankedProduct>): RankedProduct {
  return {
    id: "p1",
    name: "Nebula Match",
    price: 269,
    score: 96,
    maxDb: 42,
    waterproof: 7,
    appearance: "high_disguise",
    physicalForm: "external",
    motorType: "gentle",
    gender: "female",
    brand: "Brand",
    material: "Silicone",
    imagePlaceholder: "",
    tags: ["静音"],
    matchSummary: ["适配当前使用方向", "价格落在预算区间内"],
    hardMisses: 0,
    budgetGap: 0,
    noiseGap: 0,
    ...overrides,
  };
}

test("results page shows confidence, fit reasons, and caveats for the primary recommendation", () => {
  const html = renderToStaticMarkup(
    <ResultsPage
      pageVariants={{}}
      answers={{
        tags: ["静音"],
        maxDb: 50,
        waterproof: 7,
        budget: [100, 300],
      }}
      topProducts={[
        makeProduct({
          id: "p1",
          name: "Primary Pick",
          reason: "42dB 更贴近静音需求，防水表现达到 IPX7。",
        }),
        makeProduct({ id: "p2", name: "Second Pick", score: 88 }),
      ]}
      backupProducts={[]}
      shoppingGuidance={[]}
      recommendationTips={[]}
      isRecalibratingResults={false}
      resultRecalibrationError={null}
      onRecalibrateResults={() => {}}
      onTuneResults={() => {}}
      onSaveRecommendationProfile={async () => {}}
      onOpenRecommendationProfiles={() => {}}
      onOpenKnowledgeNebula={() => {}}
      isSavingRecommendationProfile={false}
      saveRecommendationProfileMessage={null}
      authPanel={authPanel}
      onReset={() => {}}
    />,
  );

  assert.match(html, /高匹配/);
  assert.match(html, /为什么适合/);
  assert.match(html, /需要留意/);
  assert.match(html, /适配当前使用方向/);
  assert.match(html, /主要参数与当前偏好吻合/);
  assert.match(html, /42dB 更贴近静音需求/);
  assert.match(html, /防水表现达到 IPX7/);
});

test("results page mounts the body persona entry and free summary block", () => {
  const html = renderToStaticMarkup(
    <ResultsPage
      pageVariants={{}}
      answers={{ tags: ["静音"] }}
      topProducts={[makeProduct({ id: "p1", name: "Primary Pick" })]}
      backupProducts={[]}
      shoppingGuidance={[]}
      recommendationTips={[]}
      bodyPersonaState={{
        sessionId: "persona-session-1",
        status: "completed_free",
        freeSummary: {
          title: "星幕型·隐秘安全感者",
          blurb: "你更在意低压力进入。",
          why: "你在隐私与慢热维度更高。",
          hints: ["优先低存在感路线"],
        },
        fullReport: null,
      }}
      isStartingBodyPersona={false}
      isBodyPersonaQuizOpen={false}
      bodyPersonaQuestions={[]}
      bodyPersonaDraftAnswers={{}}
      isSubmittingBodyPersonaQuiz={false}
      isUnlockingBodyPersona={false}
      onStartBodyPersona={() => {}}
      onCloseBodyPersonaQuiz={() => {}}
      onChangeBodyPersonaAnswer={() => {}}
      onSubmitBodyPersonaQuiz={async () => {}}
      onUnlockBodyPersona={async () => {}}
      isRecalibratingResults={false}
      resultRecalibrationError={null}
      onRecalibrateResults={() => {}}
      onTuneResults={() => {}}
      onSaveRecommendationProfile={async () => {}}
      onOpenRecommendationProfiles={() => {}}
      onOpenKnowledgeNebula={() => {}}
      isSavingRecommendationProfile={false}
      saveRecommendationProfileMessage={null}
      authPanel={authPanel}
      onReset={() => {}}
    />,
  );

  assert.match(html, /身体人格测试/);
  assert.match(html, /解锁你的身体人格画像/);
  assert.match(html, /星幕型·隐秘安全感者/);
  assert.match(html, /完整星系人格档案已锁定/);
  assert.match(html, /登录后可解锁完整星系人格档案/);
  assert.match(html, /0\.5 元一次解锁，可随时回看/);
  assert.match(html, /登录并解锁完整档案|0.5 元解锁完整档案/);
});

test("results page shows a reopen entry once the body persona full report is unlocked", () => {
  const html = renderToStaticMarkup(
    <ResultsPage
      pageVariants={{}}
      answers={{ tags: ["静音"] }}
      topProducts={[makeProduct({ id: "p1", name: "Primary Pick" })]}
      backupProducts={[]}
      shoppingGuidance={[]}
      recommendationTips={[]}
      bodyPersonaState={{
        sessionId: "persona-session-1",
        status: "unlocked",
        freeSummary: {
          title: "星幕型·隐秘安全感者",
          blurb: "你更在意低压力进入。",
          why: "你在隐私与慢热维度更高。",
          hints: ["优先低存在感路线"],
        },
        fullReport: {
          reportTitle: "完整星系人格档案",
          personaName: "隐私安全型",
          personaSubtitle: "隐私安全型 · M104 草帽星系",
          personaManifesto: "你不是退缩，你只是更需要边界清晰的靠近方式。",
          personaImageAsset: null,
          primaryPersonaCode: "starlit_guard",
          secondaryPersonaCode: "soft_glow",
          secondaryPersonaName: "慢热探索型",
          hiddenRouteCode: "daily_object",
          hiddenRouteName: "日常器物型",
          hiddenPowerGrade: "S",
          coLivingComfortGrade: "high",
          portraitShort: "短描述",
          portraitLong: "长描述",
          whyYouAreThis: "形成原因",
          strengthTags: ["边界清晰"],
          growthTip: "成长建议",
          dimensionBreakdown: [],
          hiddenRouteSummaryShort: "短隐藏路线",
          hiddenRouteSummaryLong: "长隐藏路线",
          disguisePreference: "更偏好伪装",
          storagePreference: "优先易收纳",
          privacyNeedLevel: "高",
          bestRouteSummary: "最适合路线",
          goodFits: ["低存在感路线"],
          avoidNotes: ["高存在感路线"],
          sceneMatches: ["同住环境"],
          paceAdvice: ["先低压进入"],
          parameterFocus: ["优先看静音"],
          topCategoryMatches: [],
          pickReasonSummary: "匹配原因总结",
          mismatchWarnings: ["别先看高噪音路线"],
          productPicks: [],
          title: "隐私安全型",
          portrait: "长描述",
          hiddenRouteSummary: "长隐藏路线",
        },
      }}
      isStartingBodyPersona={false}
      isBodyPersonaQuizOpen={false}
      bodyPersonaQuestions={[]}
      bodyPersonaDraftAnswers={{}}
      isSubmittingBodyPersonaQuiz={false}
      isUnlockingBodyPersona={false}
      onStartBodyPersona={() => {}}
      onCloseBodyPersonaQuiz={() => {}}
      onChangeBodyPersonaAnswer={() => {}}
      onSubmitBodyPersonaQuiz={async () => {}}
      onUnlockBodyPersona={async () => {}}
      onOpenBodyPersonaFullReport={() => {}}
      isRecalibratingResults={false}
      resultRecalibrationError={null}
      onRecalibrateResults={() => {}}
      onTuneResults={() => {}}
      onSaveRecommendationProfile={async () => {}}
      onOpenRecommendationProfiles={() => {}}
      onOpenKnowledgeNebula={() => {}}
      isSavingRecommendationProfile={false}
      saveRecommendationProfileMessage={null}
      authPanel={{ ...authPanel, userLabel: "taptaq" }}
      onReset={() => {}}
    />,
  );

  assert.match(html, /完整星系人格档案已解锁/);
  assert.match(html, /再次查看完整档案/);
});

test("results page shows a lightweight status while AI enhancement is still running", () => {
  const html = renderToStaticMarkup(
    <ResultsPage
      pageVariants={{}}
      answers={{ tags: ["静音"] }}
      topProducts={[makeProduct({ id: "p1", name: "Primary Pick" })]}
      backupProducts={[{
        ...makeProduct({ id: "b1", name: "Backup Pick" }),
        backupLabel: "更静音",
        backupReason: "本地备选说明先展示",
      }]}
      shoppingGuidance={["先用本地建议兜底"]}
      recommendationTips={[]}
      isEnhancingResults
      isRecalibratingResults={false}
      resultRecalibrationError={null}
      onRecalibrateResults={() => {}}
      onTuneResults={() => {}}
      onSaveRecommendationProfile={async () => {}}
      onOpenRecommendationProfiles={() => {}}
      onOpenKnowledgeNebula={() => {}}
      isSavingRecommendationProfile={false}
      saveRecommendationProfileMessage={null}
      authPanel={authPanel}
      onReset={() => {}}
    />,
  );

  assert.match(html, /AI 正在润色备选说明和选购建议/);
  assert.match(html, /主推荐已可先查看/);
  assert.match(html, /本地备选说明先展示/);
});

test("results page gives the core result shell roomier horizontal and panel padding", () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), "src/pages/ResultsPage.tsx"),
    "utf8",
  );

  assert.match(
    source,
    /results-report-shell relative isolate w-full space-y-6 overflow-x-hidden px-3 pt-3 pb-4 sm:px-4 sm:pt-4/,
  );
  assert.match(
    source,
    /results-report-panel relative z-10 overflow-hidden rounded-\[1\.75rem\] border border-cyan-200\/14 bg-slate-950\/56 p-5 shadow-\[0_24px_90px_rgba\(8,47,73,0\.2\)\] sm:p-6/,
  );
});

test("results page exposes a detail link for the primary recommendation when a product url is available", () => {
  const html = renderToStaticMarkup(
    <ResultsPage
      pageVariants={{}}
      answers={{ tags: ["静音"] }}
      topProducts={[
        makeProduct({
          id: "p1",
          name: "Primary Pick",
          sourceUrl: "https://example.com/primary-pick",
        }),
      ]}
      backupProducts={[]}
      shoppingGuidance={[]}
      recommendationTips={[]}
      isRecalibratingResults={false}
      resultRecalibrationError={null}
      onRecalibrateResults={() => {}}
      onTuneResults={() => {}}
      onSaveRecommendationProfile={async () => {}}
      onOpenRecommendationProfiles={() => {}}
      onOpenKnowledgeNebula={() => {}}
      isSavingRecommendationProfile={false}
      saveRecommendationProfileMessage={null}
      authPanel={authPanel}
      onReset={() => {}}
    />,
  );

  assert.match(html, /href="https:\/\/example.com\/primary-pick"/);
  assert.match(html, /点击查看详情/);
});

test("results page shows the primary recommendation brand above the product name", () => {
  const html = renderToStaticMarkup(
    <ResultsPage
      pageVariants={{}}
      answers={{ tags: ["静音"] }}
      topProducts={[
        makeProduct({
          id: "p1",
          name: "Primary Pick",
          brand: "We-Vibe",
        }),
      ]}
      backupProducts={[]}
      shoppingGuidance={[]}
      recommendationTips={[]}
      isRecalibratingResults={false}
      resultRecalibrationError={null}
      onRecalibrateResults={() => {}}
      onTuneResults={() => {}}
      onSaveRecommendationProfile={async () => {}}
      onOpenRecommendationProfiles={() => {}}
      onOpenKnowledgeNebula={() => {}}
      isSavingRecommendationProfile={false}
      saveRecommendationProfileMessage={null}
      authPanel={authPanel}
      onReset={() => {}}
    />,
  );

  assert.match(html, /本轮最贴合/);
  assert.match(
    html,
    /本轮最贴合<\/span><p[^>]*>We-Vibe<\/p><h3[^>]*>Primary Pick<\/h3>/,
  );
  assert.match(
    html,
    /<p[^>]*>We-Vibe<\/p><h3[^>]*>Primary Pick<\/h3>/,
  );
});

test("results page makes the primary image area and title share the same detail link hotspot", () => {
  const html = renderToStaticMarkup(
    <ResultsPage
      pageVariants={{}}
      answers={{ tags: ["静音"] }}
      topProducts={[
        makeProduct({
          id: "p1",
          name: "Primary Pick",
          sourceUrl: "https://example.com/primary-pick",
          imagePlaceholder: "",
        }),
      ]}
      backupProducts={[]}
      shoppingGuidance={[]}
      recommendationTips={[]}
      isRecalibratingResults={false}
      resultRecalibrationError={null}
      onRecalibrateResults={() => {}}
      onTuneResults={() => {}}
      onSaveRecommendationProfile={async () => {}}
      onOpenRecommendationProfiles={() => {}}
      onOpenKnowledgeNebula={() => {}}
      isSavingRecommendationProfile={false}
      saveRecommendationProfileMessage={null}
      authPanel={authPanel}
      onReset={() => {}}
    />,
  );

  assert.match(
    html,
    /<a[^>]*href="https:\/\/example\.com\/primary-pick"[\s\S]*Primary Pick 默认图片[\s\S]*Primary Pick[\s\S]*<\/a>/,
  );
});

test("results page shows what not to prioritize when the user still has strong constraints or uncertainty", () => {
  const html = renderToStaticMarkup(
    <ResultsPage
      pageVariants={{}}
      answers={{
        tags: ["路线待判断", "敏感度待判断"],
        maxDb: 40,
        experienceLevel: "sensitive",
      }}
      topProducts={[makeProduct({ id: "p1", name: "Primary Pick" })]}
      backupProducts={[]}
      shoppingGuidance={[]}
      recommendationTips={[]}
      isRecalibratingResults={false}
      resultRecalibrationError={null}
      onRecalibrateResults={() => {}}
      onTuneResults={() => {}}
      onSaveRecommendationProfile={async () => {}}
      onOpenRecommendationProfiles={() => {}}
      onOpenKnowledgeNebula={() => {}}
      isSavingRecommendationProfile={false}
      saveRecommendationProfileMessage={null}
      authPanel={authPanel}
      onReset={() => {}}
    />,
  );

  assert.match(html, /暂时不建议优先看/);
  assert.match(html, /高噪音路线/);
  assert.match(html, /强刺激路线/);
});

test("results page shows a save recommendation profile action", () => {
  const html = renderToStaticMarkup(
    <ResultsPage
      pageVariants={{}}
      answers={{ tags: ["静音"] }}
      topProducts={[makeProduct({ id: "p1", name: "Primary Pick" })]}
      backupProducts={[]}
      shoppingGuidance={[]}
      recommendationTips={[]}
      isRecalibratingResults={false}
      resultRecalibrationError={null}
      onRecalibrateResults={() => {}}
      onTuneResults={() => {}}
      onSaveRecommendationProfile={async () => {}}
      onOpenRecommendationProfiles={() => {}}
      onOpenKnowledgeNebula={() => {}}
      isSavingRecommendationProfile={false}
      saveRecommendationProfileMessage="登录后可加密保存到云端"
      authPanel={authPanel}
      onReset={() => {}}
    />,
  );

  assert.match(html, /保存推荐档案/);
  assert.match(html, /登录后可加密保存到云端/);
});

test("results page hides login action when the auth session is already active", () => {
  const html = renderToStaticMarkup(
    <ResultsPage
      pageVariants={{}}
      answers={{ tags: ["静音"] }}
      topProducts={[makeProduct({ id: "p1", name: "Primary Pick" })]}
      backupProducts={[]}
      shoppingGuidance={[]}
      recommendationTips={[]}
      isRecalibratingResults={false}
      resultRecalibrationError={null}
      onRecalibrateResults={() => {}}
      onTuneResults={() => {}}
      onSaveRecommendationProfile={async () => {}}
      onOpenRecommendationProfiles={() => {}}
      onOpenKnowledgeNebula={() => {}}
      isSavingRecommendationProfile={false}
      saveRecommendationProfileMessage="已登录，可加密保存并多端同步"
      authPanel={{ ...authPanel, userLabel: "taptaq" }}
      onReset={() => {}}
    />,
  );

  assert.match(html, /已登录/);
  assert.match(html, /taptaq/);
  assert.doesNotMatch(html, /登录 \/ 注册/);
  assert.doesNotMatch(html, /退出登录/);
  assert.doesNotMatch(html, /登录后可加密保存/);
});

test("results page prioritizes the primary recommendation before secondary controls", () => {
  const html = renderToStaticMarkup(
    <ResultsPage
      pageVariants={{}}
      answers={{ tags: ["静音", "入门级", "高伪装", "预算友好", "防水"] }}
      topProducts={[
        makeProduct({ id: "p1", name: "Primary Pick" }),
        makeProduct({ id: "p2", name: "Second Pick", score: 88 }),
        makeProduct({ id: "p3", name: "Third Pick", score: 82 }),
      ]}
      backupProducts={[]}
      shoppingGuidance={["优先确认清洁便利性"]}
      recommendationTips={[]}
      isRecalibratingResults={false}
      resultRecalibrationError={null}
      onRecalibrateResults={() => {}}
      onTuneResults={() => {}}
      onSaveRecommendationProfile={async () => {}}
      onOpenRecommendationProfiles={() => {}}
      onOpenKnowledgeNebula={() => {}}
      isSavingRecommendationProfile={false}
      saveRecommendationProfileMessage={null}
      authPanel={authPanel}
      onReset={() => {}}
    />,
  );

  assert.match(html, /results-report-shell/);
  assert.match(html, /匹配结果/);
  assert.match(html, /这次更贴近你的，是这条路线/);
  assert.match(html, /本轮最贴合/);
  assert.match(html, /登录后可加密保存/);
  assert.doesNotMatch(html, /用户名/);
  assert.ok(
    html.indexOf("本轮最贴合") < html.indexOf("登录后可加密保存"),
    "primary recommendation should be rendered before save/login controls",
  );
  assert.ok(
    html.indexOf("快速微调结果") < html.indexOf("身体人格测试"),
    "quick tuning should stay in the decision layer before body persona upsell",
  );
  assert.doesNotMatch(html, /算法最匹配（第 1 推荐）/);
});

test("results page groups comparison, alternatives, tuning, and regeneration into one assistive decision area", () => {
  const html = renderToStaticMarkup(
    <ResultsPage
      pageVariants={{}}
      answers={{ tags: ["静音", "高伪装"], appearance: "high_disguise" }}
      topProducts={[
        makeProduct({ id: "p1", name: "Primary Pick" }),
        makeProduct({ id: "p2", name: "Second Pick", score: 88 }),
        makeProduct({ id: "p3", name: "Third Pick", score: 82 }),
      ]}
      backupProducts={[
        {
          ...makeProduct({ id: "b1", name: "Backup Pick", score: 80 }),
          backupLabel: "更静音",
          backupReason: "更适合低打扰场景。",
        },
      ]}
      shoppingGuidance={["购买前优先确认是否有明确售后和材质说明。"]}
      recommendationTips={["如果同住，先优先比较更安静的路线。"]}
      isRecalibratingResults={false}
      resultRecalibrationError={null}
      onRecalibrateResults={() => {}}
      onTuneResults={() => {}}
      onSaveRecommendationProfile={async () => {}}
      onOpenRecommendationProfiles={() => {}}
      onOpenKnowledgeNebula={() => {}}
      isSavingRecommendationProfile={false}
      saveRecommendationProfileMessage={null}
      authPanel={authPanel}
      onReset={() => {}}
    />,
  );

  assert.match(html, /如果你想换个方向，也可以看看这些/);
  assert.ok(
    html.indexOf("身体人格测试") < html.indexOf("如果你想换个方向，也可以看看这些"),
    "body persona should appear before assistive alternative exploration",
  );
  assert.ok(
    html.indexOf("如果你想换个方向，也可以看看这些") < html.indexOf("换个侧重点看看"),
    "top-level alternative heading should lead the rational supplement area",
  );
  assert.ok(
    html.indexOf("换个侧重点看看") < html.indexOf("主推荐横向对比"),
    "alternatives should appear before detailed comparison",
  );
  assert.ok(
    html.indexOf("快速微调结果") < html.indexOf("主推荐横向对比"),
    "quick tuning should stay in the first decision layer before deeper comparison",
  );
  assert.ok(
    html.indexOf("快速微调结果") < html.indexOf("对当前结果不满意？"),
    "regeneration should be the last assistive decision option",
  );
  assert.ok(
    html.indexOf("购买前最终自检") < html.indexOf("登录后可加密保存"),
    "archive actions should come after final checks",
  );
});

test("results page adds a same-category library bridge for horizontal comparison after recommendation", () => {
  const html = renderToStaticMarkup(
    <ResultsPage
      pageVariants={{}}
      answers={{ tags: ["静音"], gender: "female" }}
      topProducts={[
        makeProduct({ id: "p1", name: "Primary Pick", typeCode: "external_vibe" }),
        makeProduct({ id: "p2", name: "Second Pick", score: 88 }),
      ]}
      backupProducts={[]}
      shoppingGuidance={[]}
      recommendationTips={[]}
      isRecalibratingResults={false}
      resultRecalibrationError={null}
      onRecalibrateResults={() => {}}
      onTuneResults={() => {}}
      onBrowseLibrary={() => {}}
      onSaveRecommendationProfile={async () => {}}
      onOpenRecommendationProfiles={() => {}}
      onOpenKnowledgeNebula={() => {}}
      isSavingRecommendationProfile={false}
      saveRecommendationProfileMessage={null}
      authPanel={authPanel}
      onReset={() => {}}
    />,
  );

  assert.match(html, /想自己再横向比一比？/);
  assert.match(html, /去装备库继续看同类路线、价位区间和不同品牌差异/);
  assert.match(html, /查看同类装备/);
  assert.ok(
    html.indexOf("如果你想换个方向，也可以看看这些") < html.indexOf("查看同类装备"),
    "library bridge should live inside the assistive comparison area",
  );
});

test("results page keeps comparison and backup headings in the same Chinese tone", () => {
  const html = renderToStaticMarkup(
    <ResultsPage
      pageVariants={{}}
      answers={{ tags: ["静音"] }}
      topProducts={[
        makeProduct({ id: "p1", name: "Primary Pick" }),
        makeProduct({ id: "p2", name: "Second Pick", score: 88 }),
        makeProduct({ id: "p3", name: "Third Pick", score: 82 }),
      ]}
      backupProducts={[
        {
          ...makeProduct({ id: "b1", name: "Backup Pick", score: 80 }),
          backupLabel: "更静音",
          backupReason: "更适合低打扰场景。",
        },
      ]}
      shoppingGuidance={[]}
      recommendationTips={[]}
      isRecalibratingResults={false}
      resultRecalibrationError={null}
      onRecalibrateResults={() => {}}
      onTuneResults={() => {}}
      onSaveRecommendationProfile={async () => {}}
      onOpenRecommendationProfiles={() => {}}
      onOpenKnowledgeNebula={() => {}}
      isSavingRecommendationProfile={false}
      saveRecommendationProfileMessage={null}
      authPanel={authPanel}
      onReset={() => {}}
    />,
  );

  assert.match(html, /主推荐横向对比/);
  assert.match(html, /换个侧重点看看/);
  assert.doesNotMatch(html, /Top 3 快速对比/);
});

test("results page groups formal candidates together before adjustment actions and final checks", () => {
  const html = renderToStaticMarkup(
    <ResultsPage
      pageVariants={{}}
      answers={{ tags: ["静音", "高伪装"], appearance: "high_disguise" }}
      topProducts={[
        makeProduct({ id: "p1", name: "Primary Pick" }),
        makeProduct({ id: "p2", name: "Second Pick", score: 88 }),
        makeProduct({ id: "p3", name: "Third Pick", score: 82 }),
      ]}
      backupProducts={[
        {
          ...makeProduct({ id: "b1", name: "Backup Pick", score: 80 }),
          backupLabel: "更静音",
          backupReason: "更适合低打扰场景。",
        },
      ]}
      shoppingGuidance={[
        "购买前优先确认是否有明确售后和材质说明。",
        "收到后先完成基础清洁，再进入第一次使用。",
      ]}
      recommendationTips={["如果同住，先优先比较更安静的路线。"]}
      isRecalibratingResults={false}
      resultRecalibrationError={null}
      onRecalibrateResults={() => {}}
      onTuneResults={() => {}}
      onSaveRecommendationProfile={async () => {}}
      onOpenRecommendationProfiles={() => {}}
      onOpenKnowledgeNebula={() => {}}
      isSavingRecommendationProfile={false}
      saveRecommendationProfileMessage={null}
      authPanel={authPanel}
      onReset={() => {}}
    />,
  );

  assert.ok(
    html.indexOf("探索备选") < html.indexOf("主推荐横向对比"),
    "secondary formal candidates should appear before the comparison section",
  );
  assert.ok(
    html.indexOf("快速微调结果") < html.indexOf("身体人格测试"),
    "quick tuning should stay above the body persona upgrade layer",
  );
  assert.ok(
    html.indexOf("购买前再确认这几件事") < html.indexOf("购买前最终自检"),
    "final self-check should close the page after the action-oriented next steps",
  );
  assert.ok(
    html.indexOf("这 3 个参数，和你这次更相关") < html.indexOf("购买前再确认这几件事"),
    "parameter interpretation should stay ahead of the final purchase guidance block",
  );
  assert.ok(
    html.indexOf("身体人格测试") < html.indexOf("如果你想换个方向，也可以看看这些"),
    "body persona should sit between the decision layer and rational supplement layer",
  );
});

test("results page shows tuning feedback and disables already applied tuning modes", () => {
  const html = renderToStaticMarkup(
    <ResultsPage
      pageVariants={{}}
      answers={{ tags: ["静音", "微调：更安静"] }}
      appliedResultTuningModes={["quieter"]}
      topProducts={[makeProduct({ id: "p1", name: "Primary Pick" })]}
      backupProducts={[]}
      shoppingGuidance={[]}
      recommendationTips={[]}
      isRecalibratingResults={false}
      resultRecalibrationError={null}
      onRecalibrateResults={() => {}}
      onTuneResults={() => {}}
      onSaveRecommendationProfile={async () => {}}
      onOpenRecommendationProfiles={() => {}}
      onOpenKnowledgeNebula={() => {}}
      isSavingRecommendationProfile={false}
      saveRecommendationProfileMessage={null}
      authPanel={authPanel}
      onReset={() => {}}
    />,
  );

  assert.match(html, /已应用更安静一点/);
  assert.match(html, /已应用：更安静一点/);
  assert.match(html, /disabled=""/);
});

test("results page does not disable tuning buttons just because stale tuning tags exist in answers", () => {
  const html = renderToStaticMarkup(
    <ResultsPage
      pageVariants={{}}
      answers={{
        tags: ["静音", "微调：更安静", "微调：预算更低", "微调：新手友好"],
      }}
      appliedResultTuningModes={[]}
      topProducts={[makeProduct({ id: "p1", name: "Primary Pick" })]}
      backupProducts={[]}
      shoppingGuidance={[]}
      recommendationTips={[]}
      isRecalibratingResults={false}
      resultRecalibrationError={null}
      onRecalibrateResults={() => {}}
      onTuneResults={() => {}}
      onSaveRecommendationProfile={async () => {}}
      onOpenRecommendationProfiles={() => {}}
      onOpenKnowledgeNebula={() => {}}
      isSavingRecommendationProfile={false}
      saveRecommendationProfileMessage={null}
      authPanel={authPanel}
      onReset={() => {}}
    />,
  );

  assert.doesNotMatch(html, /已应用更安静一点/);
  assert.doesNotMatch(html, /已应用预算低一点/);
  assert.doesNotMatch(html, /已应用更适合新手/);
  assert.match(
    html,
    /正在按所选方向重新计算推荐时，会保留当前问卷并更新结果。/,
  );
});

test("results page offers direct entry points to revise key quiz conditions", () => {
  const html = renderToStaticMarkup(
    <ResultsPage
      pageVariants={{}}
      answers={{ tags: ["静音", "进阶级"] }}
      topProducts={[makeProduct({ id: "p1", name: "Primary Pick" })]}
      backupProducts={[]}
      shoppingGuidance={[]}
      recommendationTips={[]}
      isRecalibratingResults={false}
      resultRecalibrationError={null}
      onRecalibrateResults={() => {}}
      onTuneResults={() => {}}
      onEditQuizCondition={() => {}}
      onSaveRecommendationProfile={async () => {}}
      onOpenRecommendationProfiles={() => {}}
      onOpenKnowledgeNebula={() => {}}
      isSavingRecommendationProfile={false}
      saveRecommendationProfileMessage={null}
      authPanel={authPanel}
      onReset={() => {}}
    />,
  );

  assert.match(html, /想改一个条件？/);
  assert.match(html, /改预算/);
  assert.match(html, /改静音/);
  assert.match(html, /改场景/);
});

test("results page provides a mobile-friendly stacked comparison view instead of only relying on a wide table", () => {
  const source = renderToStaticMarkup(
    <ResultsPage
      pageVariants={{}}
      answers={{ tags: ["静音", "进阶级", "预算友好"] }}
      topProducts={[
        makeProduct({ id: "p1", name: "Primary Pick" }),
        makeProduct({ id: "p2", name: "Second Pick", score: 88, price: 199 }),
        makeProduct({ id: "p3", name: "Third Pick", score: 84, price: 329 }),
      ]}
      backupProducts={[]}
      shoppingGuidance={[]}
      recommendationTips={[]}
      isRecalibratingResults={false}
      resultRecalibrationError={null}
      onRecalibrateResults={() => {}}
      onTuneResults={() => {}}
      onSaveRecommendationProfile={async () => {}}
      onOpenRecommendationProfiles={() => {}}
      onOpenKnowledgeNebula={() => {}}
      isSavingRecommendationProfile={false}
      saveRecommendationProfileMessage={null}
      authPanel={authPanel}
      onReset={() => {}}
    />,
  );

  assert.match(source, /手机快速对比/);
  assert.match(source, /第 1 推荐/);
  assert.match(source, /Primary Pick/);
  assert.match(source, /Second Pick/);
  assert.match(source, /Third Pick/);
  assert.match(source, /hidden md:block/);
  assert.match(source, /md:hidden/);
  assert.doesNotMatch(source, /min-w-\[44rem\]/);
});

test("results page turns archive actions into full-width mobile buttons before returning to inline desktop layout", () => {
  const html = renderToStaticMarkup(
    <ResultsPage
      pageVariants={{}}
      answers={{ tags: ["静音"] }}
      topProducts={[makeProduct({ id: "p1", name: "Primary Pick" })]}
      backupProducts={[]}
      shoppingGuidance={[]}
      recommendationTips={[]}
      isRecalibratingResults={false}
      resultRecalibrationError={null}
      onRecalibrateResults={() => {}}
      onTuneResults={() => {}}
      onSaveRecommendationProfile={async () => {}}
      onOpenRecommendationProfiles={() => {}}
      onOpenKnowledgeNebula={() => {}}
      isSavingRecommendationProfile={false}
      saveRecommendationProfileMessage={null}
      authPanel={authPanel}
      onReset={() => {}}
    />,
  );

  assert.match(html, /grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap/);
  assert.match(html, /w-full sm:w-auto/);
});

test("results page no longer exposes a later-comparison candidate picker", () => {
  const html = renderToStaticMarkup(
    <ResultsPage
      pageVariants={{}}
      answers={{ tags: ["静音"] }}
      topProducts={[
        makeProduct({ id: "p1", name: "Primary Pick" }),
        makeProduct({ id: "p2", name: "Second Pick", score: 88 }),
      ]}
      backupProducts={[
        {
          ...makeProduct({ id: "b1", name: "Budget Backup", score: 82 }),
          backupLabel: "更省预算",
          backupReason: "预算压力更小",
        },
      ]}
      shoppingGuidance={[]}
      recommendationTips={[]}
      isRecalibratingResults={false}
      resultRecalibrationError={null}
      onRecalibrateResults={() => {}}
      onTuneResults={() => {}}
      onSaveRecommendationProfile={async () => {}}
      onOpenRecommendationProfiles={() => {}}
      onOpenKnowledgeNebula={() => {}}
      isSavingRecommendationProfile={false}
      saveRecommendationProfileMessage={null}
      authPanel={authPanel}
      onReset={() => {}}
    />,
  );

  assert.doesNotMatch(html, /稍后比较/);
  assert.doesNotMatch(html, /已加入比较/);
  assert.doesNotMatch(html, /已选 1\/3/);
});

test("results page frames shopping guidance as next-step purchase guidance", () => {
  const html = renderToStaticMarkup(
    <ResultsPage
      pageVariants={{}}
      answers={{ tags: ["静音"] }}
      topProducts={[makeProduct({ id: "p1", name: "Primary Pick" })]}
      backupProducts={[]}
      shoppingGuidance={[
        "购买前优先确认是否有明确售后和材质说明。",
        "收到后先完成基础清洁，再进入第一次使用。",
      ]}
      recommendationTips={["如果同住，先优先比较更安静的路线。"]}
      isRecalibratingResults={false}
      resultRecalibrationError={null}
      onRecalibrateResults={() => {}}
      onTuneResults={() => {}}
      onSaveRecommendationProfile={async () => {}}
      onOpenRecommendationProfiles={() => {}}
      onOpenKnowledgeNebula={() => {}}
      isSavingRecommendationProfile={false}
      saveRecommendationProfileMessage={null}
      authPanel={authPanel}
      onReset={() => {}}
    />,
  );

  assert.match(html, /购买前再确认这几件事/);
  assert.match(html, /购买前优先确认是否有明确售后和材质说明/);
  assert.match(html, /收到后先完成基础清洁/);
  assert.doesNotMatch(html, /结果提示/);
});

test("results page renders general shopping guidance even when it does not match a specific next-step bucket", () => {
  const html = renderToStaticMarkup(
    <ResultsPage
      pageVariants={{}}
      answers={{ tags: ["静音"] }}
      topProducts={[makeProduct({ id: "p1", name: "Primary Pick" })]}
      backupProducts={[]}
      shoppingGuidance={[
        "先比较主推和备选的静音差异。",
        "预算接近时，可优先看刺激方向差异。",
      ]}
      recommendationTips={[]}
      isRecalibratingResults={false}
      resultRecalibrationError={null}
      onRecalibrateResults={() => {}}
      onTuneResults={() => {}}
      onSaveRecommendationProfile={async () => {}}
      onOpenRecommendationProfiles={() => {}}
      onOpenKnowledgeNebula={() => {}}
      isSavingRecommendationProfile={false}
      saveRecommendationProfileMessage={null}
      authPanel={authPanel}
      onReset={() => {}}
    />,
  );

  assert.match(html, /选购时重点看/);
  assert.match(html, /先比较主推和备选的静音差异/);
  assert.match(html, /预算接近时，可优先看刺激方向差异/);
});

test("results page shows a final pre-purchase checklist before the user decides", () => {
  const html = renderToStaticMarkup(
    <ResultsPage
      pageVariants={{}}
      answers={{
        tags: ["同住", "新手友好", "高伪装"],
        maxDb: 45,
        waterproof: 7,
        appearance: "high_disguise",
        experienceLevel: "sensitive",
      }}
      topProducts={[makeProduct({ id: "p1", name: "Primary Pick" })]}
      backupProducts={[]}
      shoppingGuidance={[]}
      recommendationTips={[]}
      isRecalibratingResults={false}
      resultRecalibrationError={null}
      onRecalibrateResults={() => {}}
      onTuneResults={() => {}}
      onSaveRecommendationProfile={async () => {}}
      onOpenRecommendationProfiles={() => {}}
      onOpenKnowledgeNebula={() => {}}
      isSavingRecommendationProfile={false}
      saveRecommendationProfileMessage={null}
      authPanel={authPanel}
      onReset={() => {}}
    />,
  );

  assert.match(html, /购买前最终自检/);
  assert.match(html, /声音环境/);
  assert.match(html, /清洁边界/);
  assert.match(html, /收纳隐私/);
  assert.match(html, /经验节奏/);
  assert.match(html, /下单前快速过一遍/);
});

test("results page closes the decision loop with route summary and structured next steps", () => {
  const html = renderToStaticMarkup(
    <ResultsPage
      pageVariants={{}}
      answers={{
        tags: ["同住", "新手友好", "高伪装"],
        maxDb: 45,
        waterproof: 7,
        appearance: "high_disguise",
        physicalForm: "external",
        experienceLevel: "sensitive",
      }}
      topProducts={[
        makeProduct({
          id: "p1",
          name: "Primary Pick",
          reason: "42dB 更贴近静音需求，外部路线也更适合先找节奏。",
        }),
      ]}
      backupProducts={[]}
      shoppingGuidance={[
        "购买前优先确认是否有明确售后和材质说明。",
        "收到后先完成基础清洁，再进入第一次使用。",
        "第一次开始时先从更低档位与更短时长试起。",
      ]}
      recommendationTips={["如果同住，先优先比较更安静的路线。"]}
      isRecalibratingResults={false}
      resultRecalibrationError={null}
      onRecalibrateResults={() => {}}
      onTuneResults={() => {}}
      onSaveRecommendationProfile={async () => {}}
      onOpenRecommendationProfiles={() => {}}
      onOpenKnowledgeNebula={() => {}}
      isSavingRecommendationProfile={false}
      saveRecommendationProfileMessage={null}
      authPanel={authPanel}
      onReset={() => {}}
    />,
  );

  assert.match(html, /为什么这条路线更适合你/);
  assert.match(html, /这次更适合先走/);
  assert.match(html, /下单前确认/);
  assert.match(html, /收货后第一步/);
  assert.match(html, /第一次开始时/);
});

test("results page shows lightweight parameter explanation entry near metric chips", () => {
  const html = renderToStaticMarkup(
    <ResultsPage
      pageVariants={{}}
      answers={{ tags: ["静音"] }}
      topProducts={[makeProduct({ id: "p1", name: "Primary Pick" })]}
      backupProducts={[]}
      shoppingGuidance={[]}
      recommendationTips={[]}
      isRecalibratingResults={false}
      resultRecalibrationError={null}
      onRecalibrateResults={() => {}}
      onTuneResults={() => {}}
      onSaveRecommendationProfile={async () => {}}
      onOpenRecommendationProfiles={() => {}}
      onOpenKnowledgeNebula={() => {}}
      isSavingRecommendationProfile={false}
      saveRecommendationProfileMessage={null}
      authPanel={authPanel}
      onReset={() => {}}
    />,
  );

  assert.match(html, /了解参数怎么看/);
  assert.match(html, /噪音 &lt; 42dB/);
  assert.match(html, /防水 IPX7/);
  assert.match(html, /看静音与场景/);
  assert.match(html, /看清洁与护理/);
  assert.match(html, /看参数原理/);
});

test("results page renders metric chips as direct knowledge entry points", () => {
  const html = renderToStaticMarkup(
    <ResultsPage
      pageVariants={{}}
      answers={{ tags: ["静音"] }}
      topProducts={[makeProduct({ id: "p1", name: "Primary Pick" })]}
      backupProducts={[]}
      shoppingGuidance={[]}
      recommendationTips={[]}
      isRecalibratingResults={false}
      resultRecalibrationError={null}
      onRecalibrateResults={() => {}}
      onTuneResults={() => {}}
      onSaveRecommendationProfile={async () => {}}
      onOpenRecommendationProfiles={() => {}}
      onOpenKnowledgeNebula={() => {}}
      isSavingRecommendationProfile={false}
      saveRecommendationProfileMessage={null}
      authPanel={authPanel}
      onReset={() => {}}
    />,
  );

  assert.match(html, /了解这个参数/);
  assert.match(html, /cursor-pointer/);
  assert.match(html, /噪音 &lt; 42dB/);
  assert.match(html, /防水 IPX7/);
  assert.match(html, /温柔电机/);
});

test("results page includes an inline parameter preview layer for chip explanations", () => {
  const html = renderToStaticMarkup(
    <ResultsPage
      pageVariants={{}}
      answers={{ tags: ["静音"] }}
      topProducts={[makeProduct({ id: "p1", name: "Primary Pick" })]}
      backupProducts={[]}
      shoppingGuidance={[]}
      recommendationTips={[]}
      isRecalibratingResults={false}
      resultRecalibrationError={null}
      onRecalibrateResults={() => {}}
      onTuneResults={() => {}}
      onSaveRecommendationProfile={async () => {}}
      onOpenRecommendationProfiles={() => {}}
      onOpenKnowledgeNebula={() => {}}
      isSavingRecommendationProfile={false}
      saveRecommendationProfileMessage={null}
      authPanel={authPanel}
      onReset={() => {}}
    />,
  );

  assert.match(html, /看懂这次推荐，不用把参数全背下来/);
  assert.match(html, /先看一眼核心判断/);
  assert.match(html, /去知识星云深读/);
});

test("results page prioritizes parameter previews that match the user's current constraints", () => {
  const html = renderToStaticMarkup(
    <ResultsPage
      pageVariants={{}}
      answers={{
        tags: ["静音待判断", "清洁待判断"],
        maxDb: 40,
        waterproof: 7,
      }}
      topProducts={[makeProduct({ id: "p1", name: "Primary Pick" })]}
      backupProducts={[]}
      shoppingGuidance={[]}
      recommendationTips={[]}
      isRecalibratingResults={false}
      resultRecalibrationError={null}
      onRecalibrateResults={() => {}}
      onTuneResults={() => {}}
      onSaveRecommendationProfile={async () => {}}
      onOpenRecommendationProfiles={() => {}}
      onOpenKnowledgeNebula={() => {}}
      isSavingRecommendationProfile={false}
      saveRecommendationProfileMessage={null}
      authPanel={authPanel}
      onReset={() => {}}
    />,
  );

  assert.ok(
    html.indexOf("静音参数") < html.indexOf("电机体感"),
    "quietness-sensitive users should see quietness guidance earlier",
  );
  assert.ok(
    html.indexOf("防水边界") < html.indexOf("电机体感"),
    "cleanup-sensitive users should see waterproof guidance earlier",
  );
});

test("results page can prioritize motor guidance when the user's current concern is more about body feedback", () => {
  const html = renderToStaticMarkup(
    <ResultsPage
      pageVariants={{}}
      answers={{
        tags: ["敏感度待判断"],
        motorType: "gentle",
        experienceLevel: "sensitive",
      }}
      topProducts={[makeProduct({ id: "p1", name: "Primary Pick" })]}
      backupProducts={[]}
      shoppingGuidance={[]}
      recommendationTips={[]}
      isRecalibratingResults={false}
      resultRecalibrationError={null}
      onRecalibrateResults={() => {}}
      onTuneResults={() => {}}
      onSaveRecommendationProfile={async () => {}}
      onOpenRecommendationProfiles={() => {}}
      onOpenKnowledgeNebula={() => {}}
      isSavingRecommendationProfile={false}
      saveRecommendationProfileMessage={null}
      authPanel={authPanel}
      onReset={() => {}}
    />,
  );

  assert.ok(
    html.indexOf("电机体感") < html.indexOf("静音参数"),
    "body-feedback-sensitive users should see motor guidance before quietness",
  );
});

test("results page hides model selection details and only exposes a regenerate recommendation entry", () => {
  const html = renderToStaticMarkup(
    <ResultsPage
      pageVariants={{}}
      answers={{ tags: ["静音"] }}
      topProducts={[makeProduct({ id: "p1", name: "Primary Pick" })]}
      backupProducts={[]}
      shoppingGuidance={[]}
      recommendationTips={[]}
      isRecalibratingResults={false}
      resultRecalibrationError={null}
      onRecalibrateResults={() => {}}
      onTuneResults={() => {}}
      onSaveRecommendationProfile={async () => {}}
      onOpenRecommendationProfiles={() => {}}
      onOpenKnowledgeNebula={() => {}}
      isSavingRecommendationProfile={false}
      saveRecommendationProfileMessage={null}
      authPanel={authPanel}
      onReset={() => {}}
    />,
  );

  assert.match(html, /对当前结果不满意？/);
  assert.match(html, /再给我一版更贴合现在需求的推荐/);
  assert.match(html, /一次轻量反馈/);
  assert.match(html, /想更准一点/);
  assert.match(html, /想换个风格/);
  assert.match(html, /这版没看懂/);
  assert.doesNotMatch(html, /换个模型再试/);
  assert.doesNotMatch(html, /当前模型/);
  assert.doesNotMatch(html, /Mimo（DMX）/);
  assert.doesNotMatch(html, /Qwen（DMX）/);
  assert.doesNotMatch(html, /mimo-v2\.5-free/);
});

test("results page offers separate restart and return-home actions", () => {
  const html = renderToStaticMarkup(
    <ResultsPage
      pageVariants={{}}
      answers={{ tags: ["静音"] }}
      topProducts={[makeProduct({ id: "p1", name: "Primary Pick" })]}
      backupProducts={[]}
      shoppingGuidance={[]}
      recommendationTips={[]}
      isRecalibratingResults={false}
      resultRecalibrationError={null}
      onRecalibrateResults={() => {}}
      onTuneResults={() => {}}
      onSaveRecommendationProfile={async () => {}}
      onOpenRecommendationProfiles={() => {}}
      onOpenKnowledgeNebula={() => {}}
      isSavingRecommendationProfile={false}
      saveRecommendationProfileMessage={null}
      authPanel={authPanel}
      onReset={() => {}}
      onBackHome={() => {}}
    />,
  );

  assert.match(html, /重新回答偏好问题/);
  assert.match(html, /返回首页/);
});
