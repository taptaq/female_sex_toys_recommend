import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { BodyPersonaResultPanel } from "./BodyPersonaResultPanel.tsx";

test("BodyPersonaResultPanel shows free summary before unlock", () => {
  const html = renderToStaticMarkup(
    <BodyPersonaResultPanel
      status="completed_free"
      freeSummary={{
        title: "星幕型·隐秘安全感者",
        blurb: "你更在意低压力进入。",
        why: "你在隐私与慢热维度更高。",
        hints: ["优先低存在感路线"],
      }}
      fullReport={null}
      onUnlock={() => undefined}
      isUnlocking={false}
    />,
  );

  assert.match(html, /星幕型·隐秘安全感者/);
  assert.match(html, /优先低存在感路线/);
  assert.match(html, /完整星系人格档案已锁定/);
  assert.match(html, /对这次结果的补充提示/);
  assert.match(html, /不会替代这次主推荐/);
  assert.match(html, /登录并解锁完整档案|0.5 元解锁完整档案/);
});

test("BodyPersonaResultPanel shows unlocked report details", () => {
  const html = renderToStaticMarkup(
    <BodyPersonaResultPanel
      status="unlocked"
      freeSummary={{
        title: "星幕型·隐秘安全感者",
        blurb: "你更在意低压力进入。",
        why: "你在隐私与慢热维度更高。",
        hints: ["优先低存在感路线"],
      }}
      fullReport={{
        reportTitle: "完整星系人格档案",
        personaName: "隐私安全型",
        personaSubtitle: "隐私安全型 · M104 草帽星系",
        personaManifesto: "你不是退缩，你只是更需要边界清晰的靠近方式。",
        personaImageAsset: null,
        primaryPersonaCode: "starlit_guard",
        secondaryPersonaCode: null,
        secondaryPersonaName: null,
        hiddenRouteCode: "daily_object",
        hiddenRouteName: "日常器物型",
        hiddenPowerGrade: "S",
        coLivingComfortGrade: "high",
        portraitShort: "完整画像",
        portraitLong: "更长画像",
        whyYouAreThis: "形成原因",
        strengthTags: ["边界清晰"],
        growthTip: "成长建议",
        dimensionBreakdown: [],
        hiddenRouteSummaryShort: "日常器物型",
        hiddenRouteSummaryLong: "日常器物型，隐藏力 S，共居安心度 高",
        disguisePreference: "更偏好伪装",
        storagePreference: "优先易收纳",
        privacyNeedLevel: "高",
        bestRouteSummary: "长期更适合低存在感路线",
        sceneMatches: ["同住环境"],
        paceAdvice: ["先低压进入"],
        parameterFocus: ["优先看静音"],
        topCategoryMatches: [],
        pickReasonSummary: "匹配原因总结",
        mismatchWarnings: ["暂不优先高噪音路线"],
        title: "星幕型·隐秘安全感者",
        portrait: "完整画像",
        hiddenRouteSummary: "日常器物型，隐藏力 S，共居安心度 高",
        goodFits: ["更适合低存在感路线"],
        avoidNotes: ["暂不优先高噪音路线"],
        productPicks: [
          {
            id: "p1",
            name: "Quiet Orbit",
            score: 95,
            personaScore: 103,
            reason: "更适合你",
          },
        ],
      }}
      onUnlock={() => undefined}
      onOpenFullReport={() => undefined}
      isUnlocking={false}
    />,
  );

  assert.match(html, /完整星系人格档案已解锁/);
  assert.match(html, /长期更适合低存在感路线/);
  assert.match(html, /当前主推荐之外的长期补充/);
  assert.match(html, /再次查看完整档案/);
  assert.doesNotMatch(html, /登录并解锁完整档案/);
});
