import type { AnswerState, Product } from "../data/mock";

export type RecommendationAnswers = Pick<
  AnswerState,
  "tags" | "maxDb" | "appearance" | "budget" | "gender" | "physicalForm" | "motorType" | "waterproof"
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

type BackupDirection = {
  label: string;
  score: number;
  reason: string;
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
      reason:
        product.maxDb != null
          ? `噪音约 ${product.maxDb}dB，适合更安静的使用环境`
          : "噪音信息不足，但这条备选仍然偏向安静取向",
    });
  }

  const budgetScore = getDirectionScore(product.price, priceRange.min, priceRange.max, true);
  options.push({
    label: "更省预算",
    score: budgetScore,
    reason: `价格约 ${product.price} 元，作为预算替代更稳妥`,
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
      reason: `防水等级约 IPX${product.waterproof}，更适合需要冲洗的场景`,
    });
  }

  options.push({
    label: product.appearance === "high_disguise" ? "更隐蔽" : "更直观",
    score: product.appearance === "high_disguise" ? 0.7 : 0.3,
    reason:
      product.appearance === "high_disguise"
        ? "外观更利于日常收纳和隐蔽"
        : "造型更直接，适合不强调伪装的场景",
  });

  options.push({
    label: product.motorType === "strong" ? "更强劲" : "更温和",
    score: product.motorType === "strong" ? 0.7 : 0.55,
    reason:
      product.motorType === "strong"
        ? "输出更直接，适合想要更明显反馈的使用场景"
        : "节奏更温和，适合慢慢进入状态",
  });

  options.sort((a, b) => b.score - a.score);
  return options[0] ?? null;
}

export function buildLocalBackupReason(
  product: RecommendationRankedProduct,
  backupLabel?: string,
) {
  switch (backupLabel) {
    case "更静音":
      return product.maxDb != null
        ? `噪音约 ${product.maxDb}dB，适合更安静的环境`
        : "静音取向更明显，适合优先看噪音需求";
    case "更省预算":
      return `价格约 ${product.price} 元，预算压力更小`;
    case "更防水":
      return product.waterproof != null
        ? `防水约 IPX${product.waterproof}，清洁维护更省心`
        : "防水信息有限，但这条备选更偏向易清洁";
    case "更隐蔽":
      return "外观更利于日常收纳和隐蔽";
    case "更直观":
      return "造型更直接，适合不强调伪装的场景";
    case "更强劲":
      return "输出更直接，适合偏强反馈的使用场景";
    case "更温和":
      return "节奏更温和，适合慢慢进入状态";
    default:
      return "综合表现均衡，适合作为备选方向";
  }
}

export function buildBackupCandidates(
  ranked: RecommendationRankedProduct[],
  excludedIds: string[],
  count: number,
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
        backupReason: buildLocalBackupReason(product, direction.label),
        __directionScore: direction.score,
      };
    })
    .filter((item): item is BackupCandidate & { __directionScore: number } => item != null)
    .sort((a, b) => {
      return (
        b.__directionScore - a.__directionScore ||
        b.score - a.score ||
        a.price - b.price
      );
    });

  const selected: BackupCandidate[] = [];
  const usedLabels = new Set<string>();

  for (const candidate of candidates) {
    if (selected.length >= count) break;
    if (usedLabels.has(candidate.backupLabel)) continue;
    const { __directionScore, ...cleanCandidate } = candidate;
    selected.push(cleanCandidate);
    usedLabels.add(cleanCandidate.backupLabel);
  }

  if (selected.length < count) {
    for (const candidate of candidates) {
      if (selected.length >= count) break;
      if (selected.some((item) => item.id === candidate.id)) continue;
      const { __directionScore, ...cleanCandidate } = candidate;
      selected.push(cleanCandidate);
    }
  }

  return selected.slice(0, count);
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

  if (filteredCount <= 3) {
    lines.push("候选池比较窄，先看备选卡片，避免只盯着前三名。");
  } else {
    lines.push("当前结果已经收窄，可以重点看差异化备选。");
  }

  if (answers.maxDb != null) {
    lines.push("你在意静音，优先比较标注为更静音的备选。");
  }

  if (answers.appearance === "high_disguise") {
    lines.push("你也在意隐蔽性，可顺手看更隐蔽的替代方向。");
  }

  for (const candidate of backupCandidates.slice(0, 3)) {
    lines.push(`${candidate.backupLabel}：${candidate.backupReason}`);
  }

  return lines.slice(0, 5);
}
