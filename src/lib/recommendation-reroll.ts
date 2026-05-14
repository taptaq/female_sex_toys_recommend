export const RECOMMENDATION_REROLL_REASON_OPTIONS = [
  {
    id: "want_more_accurate",
    label: "想更准一点",
    description: "这版方向接近了，但还不够贴合我现在的需求。",
  },
  {
    id: "want_different_style",
    label: "想换个风格",
    description: "我想看看同样条件下，另一种侧重点的推荐。",
  },
  {
    id: "did_not_understand",
    label: "这版没看懂",
    description: "我想看一版理由更直白、更容易做决定的结果。",
  },
] as const;

export type RecommendationRerollReason =
  (typeof RECOMMENDATION_REROLL_REASON_OPTIONS)[number]["id"];

export const DEFAULT_RECOMMENDATION_REROLL_REASON: RecommendationRerollReason =
  "want_more_accurate";

const RECOMMENDATION_REROLL_REASON_SET = new Set<string>(
  RECOMMENDATION_REROLL_REASON_OPTIONS.map((option) => option.id),
);

export function isRecommendationRerollReason(
  value: unknown,
): value is RecommendationRerollReason {
  return (
    typeof value === "string" &&
    RECOMMENDATION_REROLL_REASON_SET.has(value.trim())
  );
}

export function getRecommendationRerollReasonLabel(
  reason: RecommendationRerollReason,
) {
  return (
    RECOMMENDATION_REROLL_REASON_OPTIONS.find((option) => option.id === reason)
      ?.label ?? "想更准一点"
  );
}

export function getRecommendationRerollReasonPromptHint(
  reason: RecommendationRerollReason | null | undefined,
) {
  switch (reason) {
    case "want_more_accurate":
      return "用户觉得当前方向接近，但希望下一版更贴合当前偏好和场景约束。";
    case "want_different_style":
      return "用户希望在不推翻当前边界条件的前提下，看到另一种不同侧重点的推荐组织方式。";
    case "did_not_understand":
      return "用户觉得当前结果不够好懂，下一版要尽量给出更直白、更容易比较和决策的推荐理由。";
    default:
      return "用户希望再看一版更适合当前状态的推荐。";
  }
}
