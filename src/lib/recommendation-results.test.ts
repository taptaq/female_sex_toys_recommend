import test from "node:test";
import assert from "node:assert/strict";
import type {
  RecommendationAnswers,
  RecommendationRankedProduct,
} from "./recommendation-results.ts";
import {
  buildBackupDirectionTeaser,
  buildBackupCandidates,
  buildAnswerPathNarrativeSummary,
  buildResultConfidenceSummary,
  buildNaturalLanguageResultNarrative,
  buildQuizResultNarrative,
  buildResultRouteSummary,
  buildResultNextStepGroups,
  buildLocalBackupReason,
  buildLocalShoppingGuidance,
  buildResultAvoidanceTips,
  buildLocalPrimaryReason,
} from "./recommendation-results.ts";
import type { QuizAnswerPathEntry } from "./recommendation-session.ts";

function makeProduct(
  overrides: Partial<RecommendationRankedProduct> & Pick<RecommendationRankedProduct, "id" | "name" | "score" | "price">,
): RecommendationRankedProduct {
  return {
    id: overrides.id,
    name: overrides.name,
    score: overrides.score,
    price: overrides.price,
    maxDb: 50,
    waterproof: 5,
    appearance: "normal",
    physicalForm: "external",
    motorType: "gentle",
    gender: "female",
    brand: "A",
    material: "硅胶",
    imagePlaceholder: "",
    link: null,
    sourceUrl: null,
    tags: [],
    matchSummary: [],
    hardMisses: 0,
    budgetGap: 0,
    noiseGap: 0,
    ...overrides,
  };
}

test("buildBackupCandidates excludes top 3 and preserves overall quality order", () => {
  const ranked = [
    makeProduct({
      id: "p1",
      name: "Top 1",
      score: 98,
      price: 399,
      maxDb: 45,
      waterproof: 7,
      appearance: "high_disguise",
      motorType: "gentle",
      matchSummary: ["价格落在预算区间内"],
    }),
    makeProduct({
      id: "p2",
      name: "Top 2",
      score: 95,
      price: 299,
      maxDb: 48,
      waterproof: 7,
      motorType: "gentle",
      matchSummary: ["适配当前使用方向"],
    }),
    makeProduct({
      id: "p3",
      name: "Top 3",
      score: 91,
      price: 259,
      maxDb: 50,
      waterproof: 5,
      motorType: "strong",
      matchSummary: ["刺激形式与偏好一致"],
    }),
    makeProduct({
      id: "p5",
      name: "Higher Quality",
      score: 94,
      price: 169,
      maxDb: 52,
      waterproof: 5,
      motorType: "gentle",
    }),
    makeProduct({
      id: "p4",
      name: "More Extreme Quiet",
      score: 88,
      price: 349,
      maxDb: 30,
      waterproof: 5,
      motorType: "gentle",
    }),
    makeProduct({
      id: "p6",
      name: "Waterproof Pick",
      score: 87,
      price: 329,
      maxDb: 49,
      waterproof: 8,
      motorType: "strong",
    }),
  ];

  const result = buildBackupCandidates(ranked, ["p1", "p2", "p3"], 2);

  assert.deepEqual(result.map((item) => item.id), ["p5", "p4"]);
  assert.deepEqual(result.map((item) => item.backupLabel), ["更省预算", "更静音"]);
});

test("buildBackupDirectionTeaser summarizes secondary options without repeating labels", () => {
  const result = buildBackupDirectionTeaser([
    { backupLabel: "更静音" },
    { backupLabel: "更省预算" },
    { backupLabel: "更静音" },
    { backupLabel: "更防水" },
    { backupLabel: "更隐蔽" },
  ]);

  assert.equal(result.countText, "5 个备选方向");
  assert.equal(result.directionText, "更静音 / 更省预算 / 更防水等");
});

test("buildBackupDirectionTeaser handles empty secondary options", () => {
  const result = buildBackupDirectionTeaser([]);

  assert.equal(result.countText, "暂无备选方向");
  assert.equal(result.directionText, "先看主推荐即可");
});

test("buildResultConfidenceSummary labels clean matches as high confidence", () => {
  const result = buildResultConfidenceSummary(
    makeProduct({
      id: "p1",
      name: "Clean Match",
      score: 96,
      price: 269,
      matchSummary: ["适配当前使用方向", "价格落在预算区间内", "防水表现达到 IPX7"],
      hardMisses: 0,
      budgetGap: 0,
      noiseGap: 0,
      waterproof: 7,
      maxDb: 42,
    }),
    {
      tags: ["静音"],
      maxDb: 50,
      waterproof: 7,
      budget: [100, 300],
    },
  );

  assert.equal(result.levelLabel, "高匹配");
  assert.deepEqual(result.reasons, ["适配当前使用方向", "价格落在预算区间内"]);
  assert.deepEqual(result.caveats, [
    "主要参数与当前偏好吻合，优先比较价格、渠道和售后即可。",
  ]);
});

test("buildResultConfidenceSummary surfaces caveats for conditional matches", () => {
  const result = buildResultConfidenceSummary(
    makeProduct({
      id: "p2",
      name: "Conditional Match",
      score: 82,
      price: 360,
      maxDb: 55,
      waterproof: null,
      matchSummary: ["刺激形式与偏好一致"],
      hardMisses: 1,
      budgetGap: 60,
      noiseGap: 5,
    }),
    {
      tags: ["安静"],
      maxDb: 50,
      waterproof: 7,
      budget: [100, 300],
    },
  );

  assert.equal(result.levelLabel, "有条件匹配");
  assert.ok(result.caveats.some((item) => item.includes("超出预算约 60 元")));
  assert.ok(result.caveats.some((item) => item.includes("高约 5dB")));
  assert.ok(result.caveats.some((item) => item.includes("缺少防水参数")));
});

test("buildResultConfidenceSummary explains when the quiz is using safer defaults for uncertain answers", () => {
  const result = buildResultConfidenceSummary(
    makeProduct({
      id: "p3",
      name: "Safer Default Pick",
      score: 90,
      price: 229,
      maxDb: 43,
      waterproof: 7,
      matchSummary: ["更适合温和慢热的进入节奏", "价格落在预算区间内"],
      hardMisses: 0,
      budgetGap: 0,
      noiseGap: 0,
    }),
    {
      tags: ["路线待判断", "敏感度待判断", "预算待判断"],
      budget: undefined,
      maxDb: undefined,
      waterproof: undefined,
    },
  );

  assert.equal(result.levelLabel, "高匹配");
  assert.ok(
    result.caveats.some((item) => item.includes("你还有几项偏好暂未确定")),
  );
});

test("buildResultRouteSummary uses male-facing route wording for male answers", () => {
  const result = buildResultRouteSummary(
    makeProduct({
      id: "p-route",
      name: "Male Auto Pick",
      score: 88,
      price: 199,
      physicalForm: "internal",
      motorType: "strong",
      gender: "male",
    }),
    {
      gender: "male",
      tags: ["男性向"],
      physicalForm: "internal",
      appearance: "normal",
      maxDb: 55,
    },
  );

  assert.equal(result.routeLabel, "自动包裹 / 强反馈路线");
});

test("buildResultAvoidanceTips highlights high-noise and high-intensity routes for sensitive uncertain answers", () => {
  const result = buildResultAvoidanceTips({
    tags: ["路线待判断", "敏感度待判断"],
    maxDb: 40,
    gender: "female",
    experienceLevel: "sensitive",
  });

  assert.equal(result.length, 2);
  assert.ok(result.some((item) => item.includes("高噪音")));
  assert.ok(result.some((item) => item.includes("强刺激")));
});

test("buildResultAvoidanceTips warns couple users away from overly complex routes when preferences are still unclear", () => {
  const result = buildResultAvoidanceTips({
    tags: ["互动方式待判断", "双方偏好待判断"],
    gender: "unisex",
    sharedIntensity: "gentle",
  });

  assert.ok(result.some((item) => item.includes("控制复杂")));
});

test("buildLocalPrimaryReason prioritizes the most important parameter signals in the main recommendation copy", () => {
  const result = buildLocalPrimaryReason(
    makeProduct({
      id: "p3",
      name: "Quiet Clean Pick",
      score: 94,
      price: 269,
      maxDb: 42,
      waterproof: 7,
      matchSummary: [
        "42dB 更贴近静音需求",
        "防水表现达到 IPX7",
        "价格落在预算区间内",
        "更适合温和慢热的进入节奏",
      ],
    }),
    {
      tags: ["静音待判断", "清洁待判断"],
      maxDb: 45,
      waterproof: 7,
      budget: [100, 300],
    },
  );

  assert.match(result, /42dB 更贴近静音需求/);
  assert.match(result, /防水表现达到 IPX7/);
  assert.doesNotMatch(result, /价格落在预算区间内.*更适合温和慢热/);
});

test("buildLocalBackupReason returns the local backup reason for a label", () => {
  assert.equal(
    buildLocalBackupReason(
      makeProduct({ id: "p4", name: "Quiet Pick", score: 90, price: 349, maxDb: 40 }),
      "更静音",
    ),
    "噪音约 40dB，更适合安静、慢慢进入状态的环境",
  );
  assert.equal(
    buildLocalBackupReason(
      makeProduct({ id: "p5", name: "Budget Pick", score: 89, price: 169, maxDb: 52 }),
      "更省预算",
    ),
    "价格约 169 元，适合作为更轻负担的尝鲜或补位选择",
  );
});

test("buildLocalBackupReason can adapt the wording for couple flow", () => {
  assert.match(
    buildLocalBackupReason(
      makeProduct({
        id: "p10",
        name: "Couple Quiet Pick",
        score: 92,
        price: 299,
        maxDb: 38,
        gender: "unisex",
      }),
      "更静音",
      {
        gender: "unisex",
        interactionMode: "sync",
        tags: [],
      },
    ),
    /互动氛围|共玩/,
  );
});

test("buildLocalShoppingGuidance returns concise advice for narrow candidate pools", () => {
  const answers: RecommendationAnswers = {
    tags: ["安静", "低调"],
    maxDb: 50,
    appearance: "high_disguise",
  };

  const result = buildLocalShoppingGuidance({
    answers,
    filteredCount: 2,
    backupCandidates: [
      { id: "p4", backupLabel: "更静音", backupReason: "噪音约 40dB，适合更安静的环境" },
      { id: "p5", backupLabel: "更省预算", backupReason: "价格约 169 元，预算压力更小" },
      { id: "p6", backupLabel: "更防水", backupReason: "防水约 IPX8，清洁维护更省心" },
      { id: "p7", backupLabel: "更隐蔽", backupReason: "外观更利于日常收纳和隐蔽" },
      { id: "p8", backupLabel: "更强劲", backupReason: "输出更直接，适合偏强反馈的使用场景" },
      { id: "p9", backupLabel: "更温和", backupReason: "节奏更温和，适合慢慢进入状态" },
    ],
  });

  assert.equal(result[0], "候选池比较窄，先看备选卡片，补足不同刺激路线。");
  assert.ok(result.some((line) => line.includes("静音")));
  assert.equal(result.length, 5);
  assert.deepEqual(result, [
    "候选池比较窄，先看备选卡片，补足不同刺激路线。",
    "你在意静音，优先比较更安静、更不打断进入状态的备选。",
    "你也在意隐蔽性，可顺手看更利于日常收纳的替代方向。",
    "更静音：噪音约 40dB，适合更安静的环境",
    "更省预算：价格约 169 元，预算压力更小",
  ]);
});

test("buildResultNextStepGroups preserves unmatched shopping guidance instead of dropping it", () => {
  const groups = buildResultNextStepGroups({
    answers: {
      tags: ["静音"],
      maxDb: 50,
    },
    relaxationTips: [],
    shoppingGuidanceItems: [
      "先比较主推和备选的静音差异。",
      "预算接近时，可优先看刺激方向差异。",
    ],
  });

  assert.ok(
    groups.some(
      (group) =>
        group.title === "选购时重点看" &&
        group.items.includes("先比较主推和备选的静音差异。") &&
        group.items.includes("预算接近时，可优先看刺激方向差异。"),
    ),
  );
});

test("buildLocalShoppingGuidance uses branch-specific guidance for male flow", () => {
  const answers: RecommendationAnswers = {
    tags: ["男性向"],
    gender: "male",
    maxDb: 50,
    appearance: "high_disguise",
    sessionGoal: "daily",
  };

  const result = buildLocalShoppingGuidance({
    answers,
    filteredCount: 2,
    backupCandidates: [
      { id: "p4", backupLabel: "更静音", backupReason: "噪音约 40dB，日常使用时存在感更低" },
      { id: "p5", backupLabel: "更省预算", backupReason: "价格约 169 元，适合作为更顺手的日常备选" },
    ],
  });

  assert.match(result[0], /顺手|备选/);
  assert.ok(result.some((line) => /日常|顺手/.test(line)));
});

test("buildLocalShoppingGuidance uses branch-specific guidance for couple flow", () => {
  const answers: RecommendationAnswers = {
    tags: ["情侣共玩"],
    gender: "unisex",
    maxDb: 40,
    appearance: "high_disguise",
    interactionMode: "sync",
  };

  const result = buildLocalShoppingGuidance({
    answers,
    filteredCount: 6,
    backupCandidates: [
      { id: "p4", backupLabel: "更静音", backupReason: "噪音约 40dB，更不容易打断互动氛围" },
      { id: "p5", backupLabel: "更省预算", backupReason: "价格约 169 元，适合作为更轻松的共玩备选" },
    ],
  });

  assert.match(result[0], /互动|共玩/);
  assert.ok(result.some((line) => /氛围|共玩/.test(line)));
});

test("buildLocalShoppingGuidance does not treat maxDb 100 as a quietness preference", () => {
  const answers: RecommendationAnswers = {
    tags: ["安静"],
    maxDb: 100,
    appearance: "high_disguise",
  };

  const result = buildLocalShoppingGuidance({
    answers,
    filteredCount: 8,
    backupCandidates: [
      { id: "p4", backupLabel: "更静音", backupReason: "噪音约 40dB，适合更安静的环境" },
      { id: "p5", backupLabel: "更省预算", backupReason: "价格约 169 元，预算压力更小" },
      { id: "p6", backupLabel: "更防水", backupReason: "防水约 IPX8，清洁维护更省心" },
      { id: "p7", backupLabel: "更隐蔽", backupReason: "外观更利于日常收纳和隐蔽" },
      { id: "p8", backupLabel: "更强劲", backupReason: "输出更直接，适合偏强反馈的使用场景" },
      { id: "p9", backupLabel: "更温和", backupReason: "节奏更温和，适合慢慢进入状态" },
    ],
  });

  assert.equal(result[0], "当前结果已经收窄，可以重点比较更适合进入状态的差异化备选。");
  assert.equal(result.length, 5);
  assert.ok(!result.some((line) => line.includes("你在意静音")));
  assert.deepEqual(result, [
    "当前结果已经收窄，可以重点比较更适合进入状态的差异化备选。",
    "你也在意隐蔽性，可顺手看更利于日常收纳的替代方向。",
    "更静音：噪音约 40dB，适合更安静的环境",
    "更省预算：价格约 169 元，预算压力更小",
    "更防水：防水约 IPX8，清洁维护更省心",
  ]);
});

test("buildNaturalLanguageResultNarrative reflects the original prompt in a user-facing summary", () => {
  const result = buildNaturalLanguageResultNarrative({
    answers: {
      tags: ["女性向", "静音"],
      maxDb: 50,
      waterproof: 7,
      budget: [100, 300],
      gender: "female",
      physicalForm: "external",
      motorType: "gentle",
    },
    naturalLanguageQuery:
      "我是女生，想找一个吮吸感更强一点的，波形更多的，噪音适中的。",
  });

  assert.match(result.summary, /静音/);
  assert.match(result.summary, /女性向/);
  assert.match(result.nextPriority, /静音|清洁|预算/);
  assert.match(result.routeLabel, /女性向/);
});

test("buildAnswerPathNarrativeSummary keeps the most recent quiz choices", () => {
  const result = buildAnswerPathNarrativeSummary([
    {
      step: 0,
      questionId: "q1",
      questionTitle: "路线",
      field: "physicalForm",
      optionLabel: "外部细节优先",
      optionValue: "external",
      tag: "外部震动/吮吸",
      selectedAt: "2026-05-18T00:00:00.000Z",
    },
    {
      step: 1,
      questionId: "q2",
      questionTitle: "静音",
      field: "maxDb",
      optionLabel: "一般可接受",
      optionValue: 50,
      tag: "< 50dB",
      selectedAt: "2026-05-18T00:00:01.000Z",
    },
  ] satisfies QuizAnswerPathEntry[]);

  assert.deepEqual(result.keyLabels, ["外部细节优先", "一般可接受"]);
  assert.deepEqual(result.keyTags, ["外部震动/吮吸", "< 50dB"]);
});

test("buildQuizResultNarrative reflects recent answer path choices", () => {
  const result = buildQuizResultNarrative({
    answers: {
      tags: ["女性向", "< 50dB"],
      gender: "female",
      maxDb: 50,
    },
    answerPath: [
      {
        step: 0,
        questionId: "q1",
        questionTitle: "路线",
        field: "physicalForm",
        optionLabel: "外部细节优先",
        optionValue: "external",
        tag: "外部震动/吮吸",
        selectedAt: "2026-05-18T00:00:00.000Z",
      },
      {
        step: 1,
        questionId: "q2",
        questionTitle: "静音",
        field: "maxDb",
        optionLabel: "一般可接受",
        optionValue: 50,
        tag: "< 50dB",
        selectedAt: "2026-05-18T00:00:01.000Z",
      },
    ],
  });

  assert.match(result.summary, /外部细节优先|一般可接受/);
  assert.match(result.nextPriority, /静音/);
});
