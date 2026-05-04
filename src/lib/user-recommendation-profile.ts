import type { AnswerState } from "../data/mock.ts";
import type { RankedProduct } from "./app-shell.ts";
import { dedupeDisplayTags } from "./display-tags.ts";
import type { BackupCandidate } from "./recommendation-results.ts";

type RecommendationProfileProduct = {
  id: string;
  name: string;
  score: number;
};

type ApiErrorPayload = {
  error?: string;
  details?: string;
};

export type RecommendationProfilePayload = {
  createdAt: string;
  title: string;
  summary: string;
  topProductIds: string[];
  savedCandidateIds?: string[];
  answers: AnswerState;
  topProducts: RecommendationProfileProduct[];
  backupProducts: RecommendationProfileProduct[];
  savedCandidates?: RecommendationProfileProduct[];
  recommendationTips: string[];
  shoppingGuidance: string[];
};

export type SavedRecommendationProfile = {
  id: string;
  title: string;
  summary: string;
  topProductIds: string[];
  savedAt: string;
  payload: RecommendationProfilePayload;
};

async function readApiErrorMessage(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
  const detail = payload?.details || payload?.error;
  return detail ? `${fallback}：${detail}` : fallback;
}

function pickProductSnapshot(
  product: Pick<RankedProduct, "id" | "name" | "score">,
): RecommendationProfileProduct {
  return {
    id: product.id,
    name: product.name,
    score: product.score,
  };
}

export function buildRecommendationProfilePayload({
  answers,
  topProducts,
  backupProducts,
  savedCandidateIds = [],
  recommendationTips,
  shoppingGuidance,
}: {
  answers: AnswerState;
  topProducts: RankedProduct[];
  backupProducts: BackupCandidate[];
  savedCandidateIds?: string[];
  recommendationTips: string[];
  shoppingGuidance: string[];
}): RecommendationProfilePayload {
  const topProductSnapshots = topProducts.map(pickProductSnapshot);
  const backupProductSnapshots = backupProducts.map(pickProductSnapshot);
  const candidateSnapshotById = new Map(
    [...topProductSnapshots, ...backupProductSnapshots].map((product) => [
      product.id,
      product,
    ]),
  );
  const normalizedSavedCandidateIds = Array.from(
    new Set(
      savedCandidateIds
        .map((id) => String(id || "").trim())
        .filter((id) => candidateSnapshotById.has(id)),
    ),
  );
  const savedCandidateSnapshots = normalizedSavedCandidateIds.map(
    (id) => candidateSnapshotById.get(id)!,
  );
  const topProductNames = topProductSnapshots.map((product) => product.name);
  const normalizedAnswers: AnswerState = {
    ...answers,
    tags: dedupeDisplayTags(answers.tags),
  };
  const title =
    topProductNames.length > 0
      ? `${topProductNames[0]}${topProductNames.length > 1 ? ` 等 ${topProductNames.length} 个推荐` : ""}`
      : "推荐档案";
  const answerTags = normalizedAnswers.tags.join("、");
  const summaryParts = [
    answerTags ? `偏好：${answerTags}` : "",
    topProductNames.length > 0 ? `推荐：${topProductNames.slice(0, 3).join("、")}` : "",
  ].filter(Boolean);

  return {
    createdAt: new Date().toISOString(),
    title,
    summary: summaryParts.join("；") || "推荐档案",
    topProductIds: topProductSnapshots.map((product) => product.id),
    savedCandidateIds: normalizedSavedCandidateIds,
    answers: normalizedAnswers,
    topProducts: topProductSnapshots,
    backupProducts: backupProductSnapshots,
    savedCandidates: savedCandidateSnapshots,
    recommendationTips,
    shoppingGuidance,
  };
}

export async function saveRecommendationProfile({
  authToken,
  payload,
  fetcher = fetch,
}: {
  authToken: string;
  payload: RecommendationProfilePayload;
  fetcher?: typeof fetch;
}) {
  if (!authToken.trim()) {
    throw new Error("需要登录后才能保存推荐档案");
  }

  const response = await fetcher("/api/user/recommendation-profiles", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      await readApiErrorMessage(response, "保存推荐档案失败，请稍后重试"),
    );
  }

  return (await response.json()) as { id: string };
}

export async function listRecommendationProfiles({
  authToken,
  fetcher = fetch,
}: {
  authToken: string;
  fetcher?: typeof fetch;
}) {
  if (!authToken.trim()) {
    throw new Error("需要登录后才能查看装备匹配档案");
  }

  const response = await fetcher("/api/user/recommendation-profiles", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      await readApiErrorMessage(response, "读取装备匹配档案失败，请稍后重试"),
    );
  }

  return (await response.json()) as { profiles: SavedRecommendationProfile[] };
}
