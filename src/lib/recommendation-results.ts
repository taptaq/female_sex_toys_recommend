import type { AnswerState, Product } from "../data/mock.js";
import type { QuizAnswerPathEntry } from "./recommendation-session.js";
import {
  buildBranchFallbackReason,
  buildBranchBackupReason,
  getBranchShoppingGuidanceLead,
  getBranchShoppingPreferenceHints,
} from "./quiz-branching.js";
import { formatPhysicalFormLabel } from "./result-comparison.js";

export type RecommendationAnswers = Pick<
  AnswerState,
  | "tags"
  | "maxDb"
  | "appearance"
  | "budget"
  | "gender"
  | "physicalForm"
  | "motorType"
  | "waterproof"
  | "experienceLevel"
  | "driveMode"
  | "channelFeel"
  | "sessionGoal"
  | "interactionMode"
  | "partnerComposition"
  | "fitPreference"
  | "coupleScene"
  | "sharedIntensity"
>;

export type RecommendationRankedProduct = Product & {
  score: number;
  matchSummary?: string[];
  hardMisses?: number;
  budgetGap?: number;
  noiseGap?: number;
};

export type BackupCandidate = RecommendationRankedProduct & {
  backupLabel: string;
  backupReason: string;
};

export type BackupDirectionTeaser = {
  countText: string;
  directionText: string;
};

export type ResultConfidenceSummary = {
  levelLabel: "高匹配" | "有条件匹配" | "备选匹配";
  tone: "high" | "conditional" | "backup";
  reasons: string[];
  caveats: string[];
};

export type ResultRouteSummary = {
  routeLabel: string;
  summary: string;
  nextPriority: string;
};

export type ResultNextStepGroup = {
  id: "hesitation" | "pre-purchase" | "first-receive" | "first-start" | "purchase-focus";
  title: string;
  items: string[];
};

export type ResultNarrativeContext = {
  matchInputMode?: "quiz" | "natural-language";
  naturalLanguageQuery?: string;
};

type AnswerPathNarrativeSummary = {
  keyLabels: string[];
  keyTags: string[];
};

export function buildAnswerPathNarrativeSummary(
  answerPath: QuizAnswerPathEntry[] | undefined,
): AnswerPathNarrativeSummary {
  const safePath = Array.isArray(answerPath) ? answerPath : [];
  const keyEntries = safePath.slice(-3);

  return {
    keyLabels: keyEntries
      .map((entry) => String(entry.optionLabel || "").trim())
      .filter(Boolean),
    keyTags: keyEntries
      .map((entry) => String(entry.tag || "").trim())
      .filter(Boolean),
  };
}

function hasPendingPreferenceTag(
  answers: Pick<RecommendationAnswers, "tags">,
  keyword: string,
) {
  return (answers.tags ?? []).some((tag) => tag.includes(keyword));
}

function getBudgetGap(price: number, budget?: [number, number]) {
  if (!budget) return 0;
  if (price < budget[0]) return budget[0] - price;
  if (price > budget[1]) return price - budget[1];
  return 0;
}

function scorePrimaryReasonLine(
  line: string,
  answers: RecommendationAnswers,
  index: number,
) {
  let score = Math.max(0, 6 - index);

  if (
    answers.maxDb != null ||
    hasPendingPreferenceTag(answers, "静音") ||
    hasPendingPreferenceTag(answers, "共玩场景")
  ) {
    if (/db|dB|静音|噪音|安静/.test(line)) {
      score += 18;
    }
  }

  if (
    answers.waterproof != null ||
    hasPendingPreferenceTag(answers, "清洁") ||
    hasPendingPreferenceTag(answers, "护理")
  ) {
    if (/防水|IPX|清洁|冲洗|护理/.test(line)) {
      score += 16;
    }
  }

  if (
    answers.motorType != null ||
    answers.experienceLevel != null ||
    answers.sharedIntensity != null ||
    hasPendingPreferenceTag(answers, "敏感度") ||
    hasPendingPreferenceTag(answers, "双方偏好") ||
    hasPendingPreferenceTag(answers, "刺激")
  ) {
    if (/温和|慢热|节奏|刺激|电机|反馈|体感|强劲|档位/.test(line)) {
      score += 14;
    }
  }

  if (
    answers.physicalForm != null ||
    answers.driveMode != null ||
    answers.channelFeel != null ||
    answers.fitPreference != null ||
    hasPendingPreferenceTag(answers, "路线") ||
    hasPendingPreferenceTag(answers, "驱动") ||
    hasPendingPreferenceTag(answers, "姿态")
  ) {
    if (/外部|入体|双通道|路径|路线|驱动|贴合|结构/.test(line)) {
      score += 12;
    }
  }

  if (
    answers.appearance != null ||
    hasPendingPreferenceTag(answers, "收纳")
  ) {
    if (/隐蔽|收纳|伪装|存在感/.test(line)) {
      score += 10;
    }
  }

  if (answers.budget != null || hasPendingPreferenceTag(answers, "预算")) {
    if (/预算|价格|价位|性价比/.test(line)) {
      score += 8;
    }
  }

  return score;
}

export function buildLocalPrimaryReason(
  product: RecommendationRankedProduct,
  answers: RecommendationAnswers,
) {
  const summary = Array.from(new Set((product.matchSummary ?? []).filter(Boolean)));
  if (summary.length > 0) {
    const prioritized = summary
      .map((line, index) => ({
        line,
        index,
        score: scorePrimaryReasonLine(line, answers, index),
      }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, 2)
      .map((item) => item.line);

    if (prioritized.length > 0) {
      return prioritized.join("，");
    }
  }

  if (answers.budget && getBudgetGap(product.price, answers.budget) === 0) {
    return `${buildBranchFallbackReason(product, answers)} 价格也更稳地落在你的预算区间。`;
  }

  return buildBranchFallbackReason(product, answers);
}

export function buildResultAvoidanceTips(
  answers: Pick<
    RecommendationAnswers,
    | "tags"
    | "gender"
    | "maxDb"
    | "experienceLevel"
    | "sharedIntensity"
  >,
) {
  const tips: string[] = [];
  const tags = answers.tags ?? [];
  const hasPendingDecision = (keyword: string) =>
    tags.some((tag) => tag.includes(keyword));

  if (answers.maxDb != null && answers.maxDb <= 45) {
    tips.push("当前不建议优先看高噪音路线，尤其是同住、深夜或怕打断氛围的场景。");
  }

  if (
    answers.experienceLevel === "sensitive" ||
    answers.sharedIntensity === "gentle" ||
    hasPendingDecision("敏感度待判断") ||
    hasPendingDecision("双方偏好待判断")
  ) {
    tips.push("还没摸清身体反馈前，不建议一上来优先看强刺激路线，先从温和稳定的反馈更安心。");
  }

  if (
    answers.gender === "unisex" &&
    (hasPendingDecision("互动方式待判断") || hasPendingDecision("共玩场景待判断"))
  ) {
    tips.push("互动方式还没定下来时，不建议优先看控制复杂、上手门槛高的共玩路线。");
  }

  return Array.from(new Set(tips)).slice(0, 2);
}

type BackupDirection = {
  label: string;
  score: number;
};

function getMinMax(values: number[]) {
  if (values.length === 0) {
    return { min: 0, max: 0 };
  }
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function getDirectionScore(
  value: number | null | undefined,
  min: number,
  max: number,
  preferLower = false,
) {
  if (value == null) return -1;
  if (min === max) return 0.5;
  const raw = preferLower ? max - value : value - min;
  return raw / (max - min);
}

function buildDirection(product: RecommendationRankedProduct, pool: RecommendationRankedProduct[]): BackupDirection | null {
  const priceRange = getMinMax(pool.map((item) => item.price));
  const dbRange = getMinMax(
    pool
      .map((item) => item.maxDb)
      .filter((value): value is number => value != null),
  );
  const waterproofRange = getMinMax(
    pool
      .map((item) => item.waterproof)
      .filter((value): value is number => value != null),
  );

  const options: BackupDirection[] = [];

  const quietnessScore = getDirectionScore(
    product.maxDb,
    dbRange.min,
    dbRange.max,
    true,
  );
  if (quietnessScore >= 0) {
    options.push({
      label: "更静音",
      score: quietnessScore,
    });
  }

  const budgetScore = getDirectionScore(product.price, priceRange.min, priceRange.max, true);
  options.push({
    label: "更省预算",
    score: budgetScore,
  });

  if (product.waterproof != null) {
    const waterproofScore = getDirectionScore(
      product.waterproof,
      waterproofRange.min,
      waterproofRange.max,
    );
    options.push({
      label: "更防水",
      score: waterproofScore,
    });
  }

  options.push({
    label: product.appearance === "high_disguise" ? "更隐蔽" : "更直观",
    score: product.appearance === "high_disguise" ? 0.7 : 0.3,
  });

  options.push({
    label: product.motorType === "strong" ? "更强劲" : "更温和",
    score: product.motorType === "strong" ? 0.7 : 0.55,
  });

  options.sort((a, b) => b.score - a.score);
  return options[0] ?? null;
}

export function buildLocalBackupReason(
  product: RecommendationRankedProduct,
  backupLabel?: string,
  answers?: RecommendationAnswers,
) {
  return buildBranchBackupReason(product, backupLabel, answers);
}

export function buildBackupCandidates(
  ranked: RecommendationRankedProduct[],
  excludedIds: string[],
  count: number,
  answers?: RecommendationAnswers,
): BackupCandidate[] {
  const excluded = new Set(excludedIds);
  const pool = ranked.filter((item) => !excluded.has(item.id));
  const candidates = pool
    .map((product) => {
      const direction = buildDirection(product, pool);
      if (!direction) return null;
      return {
        ...product,
        backupLabel: direction.label,
        backupReason: buildLocalBackupReason(product, direction.label, answers),
      };
    })
    .filter((item): item is BackupCandidate => item != null);

  const selected: BackupCandidate[] = [];
  const usedLabels = new Set<string>();

  for (const candidate of candidates) {
    if (selected.length >= count) break;
    if (usedLabels.has(candidate.backupLabel)) continue;
    selected.push(candidate);
    usedLabels.add(candidate.backupLabel);
  }

  if (selected.length < count) {
    for (const candidate of candidates) {
      if (selected.length >= count) break;
      if (selected.some((item) => item.id === candidate.id)) continue;
      selected.push(candidate);
    }
  }

  return selected.slice(0, count);
}

export function buildBackupDirectionTeaser(
  backupCandidates: Pick<BackupCandidate, "backupLabel">[],
): BackupDirectionTeaser {
  if (backupCandidates.length === 0) {
    return {
      countText: "暂无备选方向",
      directionText: "先看主推荐即可",
    };
  }

  const uniqueLabels = Array.from(
    new Set(
      backupCandidates
        .map((candidate) => candidate.backupLabel.trim())
        .filter(Boolean),
    ),
  );
  const visibleLabels = uniqueLabels.slice(0, 3);
  const suffix = uniqueLabels.length > visibleLabels.length ? "等" : "";

  return {
    countText: `${backupCandidates.length} 个备选方向`,
    directionText:
      visibleLabels.length > 0
        ? `${visibleLabels.join(" / ")}${suffix}`
        : "先看主推荐即可",
  };
}

export function buildResultConfidenceSummary(
  product: Pick<
    RecommendationRankedProduct,
    | "matchSummary"
    | "hardMisses"
    | "budgetGap"
    | "noiseGap"
    | "waterproof"
    | "score"
  >,
  answers: Pick<RecommendationAnswers, "budget" | "maxDb" | "waterproof" | "tags">,
): ResultConfidenceSummary {
  const hardMisses = product.hardMisses ?? 0;
  const budgetGap = product.budgetGap ?? 0;
  const noiseGap = product.noiseGap ?? 0;
  const reasons = (product.matchSummary ?? []).filter(Boolean).slice(0, 2);
  const caveats: string[] = [];
  const unresolvedPreferenceCount = (answers.tags ?? []).filter((tag) =>
    /待判断|需要系统判断/.test(tag),
  ).length;

  if (answers.budget && budgetGap > 0) {
    caveats.push(`超出预算约 ${budgetGap} 元，适合你愿意为体验稳定性多留一点空间时考虑。`);
  }

  if (answers.maxDb != null && answers.maxDb < 100 && noiseGap > 0) {
    caveats.push(`噪音比你的目标高约 ${noiseGap}dB，同住或深夜场景建议谨慎。`);
  }

  if (answers.waterproof != null && product.waterproof == null) {
    caveats.push("缺少防水参数，购买前建议确认清洁方式和售后说明。");
  } else if (
    answers.waterproof != null &&
    product.waterproof != null &&
    product.waterproof < answers.waterproof
  ) {
    caveats.push(`防水等级为 IPX${product.waterproof}，低于你偏好的 IPX${answers.waterproof}。`);
  }

  if (hardMisses > 0 && caveats.length === 0) {
    caveats.push("存在少量条件不完全吻合，建议把它当作备选而不是唯一答案。");
  }

  if (unresolvedPreferenceCount > 0) {
    caveats.push(
      `你还有几项偏好暂未确定，这版结果会先偏向更稳妥、低踩雷的默认路线。`,
    );
  }

  if (caveats.length === 0) {
    caveats.push("主要参数与当前偏好吻合，优先比较价格、渠道和售后即可。");
  }

  if (hardMisses >= 2 || product.score < 70) {
    return {
      levelLabel: "备选匹配",
      tone: "backup",
      reasons,
      caveats: caveats.slice(0, 3),
    };
  }

  if (hardMisses > 0 || budgetGap > 0 || noiseGap > 0) {
    return {
      levelLabel: "有条件匹配",
      tone: "conditional",
      reasons,
      caveats: caveats.slice(0, 3),
    };
  }

  return {
    levelLabel: "高匹配",
    tone: "high",
    reasons,
    caveats: caveats.slice(0, 3),
  };
}

export function buildLocalShoppingGuidance({
  answers,
  filteredCount,
  backupCandidates,
}: {
  answers: RecommendationAnswers;
  filteredCount: number;
  backupCandidates: Pick<BackupCandidate, "id" | "backupLabel" | "backupReason">[];
}) {
  const lines: string[] = [];

  lines.push(getBranchShoppingGuidanceLead(answers, filteredCount));
  lines.push(...getBranchShoppingPreferenceHints(answers));

  for (const candidate of backupCandidates.slice(0, 3)) {
    lines.push(`${candidate.backupLabel}：${candidate.backupReason}`);
  }

  return lines.slice(0, 5);
}

export function buildResultRouteSummary(
  product: Pick<RecommendationRankedProduct, "physicalForm" | "motorType" | "maxDb" | "appearance">,
  answers: Pick<
    RecommendationAnswers,
    "tags" | "appearance" | "physicalForm" | "experienceLevel" | "maxDb" | "gender"
  >,
): ResultRouteSummary {
  const routeParts: string[] = [];
  const tags = answers.tags ?? [];
  const isSensitiveUser =
    answers.experienceLevel === "sensitive" ||
    tags.some((tag) => /新手|敏感|待判断/.test(tag));
  const isQuietSensitive =
    (answers.maxDb != null && answers.maxDb <= 50) ||
    tags.some((tag) => /静音|同住|宿舍|深夜/.test(tag));
  const isStorageSensitive =
    answers.appearance === "high_disguise" ||
    product.appearance === "high_disguise" ||
    tags.some((tag) => /收纳|隐蔽|伪装/.test(tag));

  routeParts.push(
    formatPhysicalFormLabel(product.physicalForm, answers.gender)
      .replace("体验", "")
      .replace("刺激", "")
      .trim(),
  );
  routeParts.push(product.motorType === "strong" ? "强反馈" : "温和探索");
  if (isQuietSensitive) routeParts.push("低打扰");
  if (isStorageSensitive) routeParts.push("易收纳");

  const routeLabel = `${routeParts.join(" / ")}路线`;
  const summaryParts = [
    isSensitiveUser
      ? "你现在更适合先走反馈稳定、进入门槛更低的路线。"
      : "你这次更适合先走和当前偏好匹配度更高、节奏更顺手的路线。",
    isQuietSensitive
      ? "静音和使用环境对你很重要，所以不需要先追求更猛的参数。"
      : "重点不是盲目堆参数，而是先确认体感路线和使用节奏对不对。",
  ];

  const nextPriority = isStorageSensitive
    ? "下一步优先确认静音、收纳和清洁边界，再决定是否下单。"
    : "下一步优先确认静音、清洁和第一次上手的节奏是否安心。";

  return {
    routeLabel,
    summary: summaryParts.join(" "),
    nextPriority,
  };
}

export function buildResultNextStepGroups({
  answers,
  relaxationTips,
  shoppingGuidanceItems,
}: {
  answers: Pick<RecommendationAnswers, "tags" | "experienceLevel" | "maxDb">;
  relaxationTips: string[];
  shoppingGuidanceItems: string[];
}): ResultNextStepGroup[] {
  const remainingGuidance = [...shoppingGuidanceItems];
  const consumeMatches = (pattern: RegExp) => {
    const matched = remainingGuidance.filter((item) => pattern.test(item));
    for (const item of matched) {
      const index = remainingGuidance.indexOf(item);
      if (index >= 0) remainingGuidance.splice(index, 1);
    }
    return matched;
  };

  const isSensitiveUser =
    answers.experienceLevel === "sensitive" ||
    (answers.tags ?? []).some((tag) => /新手|敏感|待判断/.test(tag));
  const isQuietSensitive =
    (answers.maxDb != null && answers.maxDb <= 50) ||
    (answers.tags ?? []).some((tag) => /静音|同住|宿舍|深夜/.test(tag));

  const groups: ResultNextStepGroup[] = [];

  if (relaxationTips.length > 0) {
    groups.push({
      id: "hesitation",
      title: "如果还在犹豫",
      items: relaxationTips,
    });
  }

  const prePurchaseItems = consumeMatches(/购买前|下单前|确认|售后|材质|渠道|参数说明/);
  if (prePurchaseItems.length > 0) {
    groups.push({
      id: "pre-purchase",
      title: "下单前确认",
      items: prePurchaseItems,
    });
  }

  const firstReceiveItems = consumeMatches(/收到|开箱|基础清洁|先完成清洁|充电|到手/);
  if (firstReceiveItems.length > 0) {
    groups.push({
      id: "first-receive",
      title: "收货后第一步",
      items: firstReceiveItems,
    });
  }

  const firstStartItems = [
    ...consumeMatches(/第一次|开始时|低档位|时长|节奏|慢慢/),
  ];
  if (firstStartItems.length === 0) {
    firstStartItems.push(
      isSensitiveUser
        ? "第一次开始时先从更低档位与更短时长试起，先找舒服的节奏。"
        : "第一次开始时先确认最顺手的档位和姿势，不用急着把参数拉满。",
    );
  }
  if (isQuietSensitive) {
    firstStartItems.push("如果是同住或夜间场景，第一次也顺手确认真实噪音会不会被床架和环境放大。");
  }
  groups.push({
    id: "first-start",
    title: "第一次开始时",
    items: Array.from(new Set(firstStartItems)).slice(0, 3),
  });

  if (remainingGuidance.length > 0) {
    groups.push({
      id: "purchase-focus",
      title: "选购时重点看",
      items: Array.from(new Set(remainingGuidance)).slice(0, 3),
    });
  }

  return groups.filter((group) => group.items.length > 0);
}

export function buildNaturalLanguageResultNarrative({
  answers,
  naturalLanguageQuery,
}: {
  answers: RecommendationAnswers;
  naturalLanguageQuery?: string;
}) {
  const query = String(naturalLanguageQuery || "").trim();
  const matchedTokens = [
    /静音|安静|低调|不吵/.test(query) ? "静音" : null,
    /预算|价格|价位/.test(query) ? "预算" : null,
    /防水|清洁|好打理/.test(query) ? "清洁" : null,
    /女生|女性|女用|女性向/.test(query) ? "女性向" : null,
    /男生|男性|男用|男性向/.test(query) ? "男性向" : null,
    /情侣|异地|双人|共用/.test(query) ? "情侣共玩" : null,
    /新手|第一次|怕刺激|慢热/.test(query) ? "新手慢热" : null,
    /强刺激|强烈|更猛/.test(query) ? "强刺激" : null,
  ].filter((item): item is string => Boolean(item));

  const userSummary = query
    ? `你这次的描述里最明显的是：${matchedTokens.length > 0 ? matchedTokens.join("、") : "整体需求"}。`
    : "这次是通过结构化问卷来匹配的。";

  const parameterFocus = [
    answers.maxDb != null ? "静音" : null,
    answers.waterproof != null ? "清洁" : null,
    answers.budget != null ? "预算" : null,
    answers.experienceLevel ? "节奏" : null,
    answers.physicalForm ? "路线" : null,
  ].filter((item): item is string => Boolean(item));

  const nextPriority = query
    ? `下一步先确认${parameterFocus.slice(0, 2).join("、") || "最关键的体验约束"}，再回头看主推荐是否和你的原话一致。`
    : "下一步先确认静音、清洁和预算是否还符合你的真实使用环境。";

  const routeLabel =
    /情侣|异地|双人|共用/.test(query)
      ? "双人共玩路线"
      : /男性|男用|男生/.test(query)
        ? "男性向体验路线"
        : "女性向体验路线";

  const summary = query
    ? `${userSummary} 这次更适合先看${parameterFocus.slice(0, 3).join(" / ") || "核心参数"}。`
    : "这次更适合先看静音 / 清洁 / 预算这三项核心参数。";

  return {
    routeLabel,
    summary,
    nextPriority,
    parameterFocus,
    matchedTokens,
  };
}

export function buildQuizResultNarrative({
  answers,
  answerPath,
}: {
  answers: RecommendationAnswers;
  answerPath?: QuizAnswerPathEntry[];
}) {
  const summary = buildAnswerPathNarrativeSummary(answerPath);
  const keySignalText =
    summary.keyLabels.slice(0, 2).join("、") ||
    summary.keyTags.slice(0, 2).join("、") ||
    "你刚才选中的偏好";

  const routeLabel =
    answers.gender === "male"
      ? "男性向体验路线"
      : answers.gender === "unisex"
        ? "双人共玩路线"
        : "女性向体验路线";

  return {
    routeLabel,
    summary: `这次更适合先沿着 ${keySignalText} 这条方向往下看，而不是把所有参数一次看满。`,
    nextPriority:
      answers.maxDb != null
        ? "下一步先确认静音和第一次上手节奏，再比较价格与清洁边界。"
        : "下一步先确认你刚才最在意的那两个条件，在主推荐上是否真的成立。",
  };
}
