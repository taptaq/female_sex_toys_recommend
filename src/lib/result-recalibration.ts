import type {
  BackupCandidate,
  RecommendationAnswers,
  RecommendationRankedProduct,
} from "./recommendation-results.js";
import type { AppAiProvider } from "./app-ai-chain.js";
import {
  buildBackupCandidates,
  buildLocalBackupReason,
} from "./recommendation-results.js";
import type { RecommendationRerollReason } from "./recommendation-reroll.ts";
import { getResultModelOption } from "./result-models.js";

export type ResultRecalibrationCandidate = Pick<
  RecommendationRankedProduct,
  | "id"
  | "name"
  | "price"
  | "maxDb"
  | "waterproof"
  | "appearance"
  | "physicalForm"
  | "motorType"
  | "gender"
  | "brand"
  | "material"
  | "imagePlaceholder"
  | "link"
  | "sourceUrl"
  | "tags"
  | "score"
  | "matchSummary"
>;

export type RecalibratedResultTopProduct = ResultRecalibrationCandidate & {
  reason: string;
};

export type ResultRecalibrationContext = {
  attemptCount: number;
  rerollReason?: RecommendationRerollReason;
  currentResultProvider?: AppAiProvider;
  currentResultModelName?: string;
  previousTopProducts: Array<Pick<RecalibratedResultTopProduct, "id" | "reason">>;
  previousShoppingGuidanceCount: number;
};

export type ResultRecalibrationRequest = {
  answers: RecommendationAnswers;
  strategy: "auto";
  rerankPool: ResultRecalibrationCandidate[];
  rankedCandidates: ResultRecalibrationCandidate[];
  filteredCount: number;
  recommendationTips: string[];
  recalibrationContext?: ResultRecalibrationContext;
};

export type ResultRecalibrationResponse = {
  topProducts: RecalibratedResultTopProduct[];
  backupProducts: BackupCandidate[];
  shoppingGuidance: string[];
  recommendationTips: string[];
  modelName: string;
  provider: AppAiProvider;
};

export type PersistedResultSourceState = {
  currentResultProvider?: string | null;
  currentResultModelName?: string | null;
};

export type ResultSourceState = {
  currentResultProvider?: AppAiProvider;
  currentResultModelName?: string;
};

function normalizeModelName(modelName: string | null | undefined) {
  const normalized = String(modelName || "").trim();
  return normalized || undefined;
}

export function readResultSourceState(
  persistedState: PersistedResultSourceState | null | undefined,
): ResultSourceState {
  const persistedProvider = persistedState?.currentResultProvider;
  const hasValidPersistedProvider = Boolean(getResultModelOption(persistedProvider));

  return {
    currentResultProvider: hasValidPersistedProvider
      ? (persistedProvider as AppAiProvider)
      : undefined,
    currentResultModelName: hasValidPersistedProvider
      ? normalizeModelName(persistedState?.currentResultModelName)
      : undefined,
  };
}

export function clearResultSourceState(): ResultSourceState {
  return {
    currentResultProvider: undefined,
    currentResultModelName: undefined,
  };
}

export function resolveCurrentResultSourceState({
  currentProvider,
  currentModelName,
}: {
  currentProvider?: string | null;
  currentModelName?: string | null;
}): ResultSourceState {
  if (!getResultModelOption(currentProvider)) {
    return clearResultSourceState();
  }

  return readResultSourceState({
    currentResultProvider: currentProvider,
    currentResultModelName: currentModelName,
  });
}

export function buildResultRecalibrationPayload(
  request: ResultRecalibrationRequest,
): ResultRecalibrationRequest {
  const normalizeCandidate = (
    candidate: RecommendationRankedProduct,
  ): ResultRecalibrationCandidate => ({
    id: candidate.id,
    name: candidate.name,
    price: candidate.price,
    maxDb: candidate.maxDb,
    waterproof: candidate.waterproof,
    appearance: candidate.appearance,
    physicalForm: candidate.physicalForm,
    motorType: candidate.motorType,
    gender: candidate.gender,
    brand: candidate.brand,
    material: candidate.material,
    imagePlaceholder: candidate.imagePlaceholder,
    link: candidate.link,
    sourceUrl: candidate.sourceUrl,
    tags: candidate.tags,
    score: candidate.score,
    matchSummary: candidate.matchSummary,
  });

  return {
    answers: request.answers,
    strategy: "auto",
    rerankPool: request.rerankPool.map(normalizeCandidate),
    rankedCandidates: request.rankedCandidates.map(normalizeCandidate),
    filteredCount: request.filteredCount,
    recommendationTips: request.recommendationTips,
    recalibrationContext: request.recalibrationContext
      ? {
          attemptCount: Math.max(1, request.recalibrationContext.attemptCount || 1),
          rerollReason: request.recalibrationContext.rerollReason,
          currentResultProvider: request.recalibrationContext.currentResultProvider,
          currentResultModelName: normalizeModelName(
            request.recalibrationContext.currentResultModelName,
          ),
          previousTopProducts: request.recalibrationContext.previousTopProducts.map(
            (product) => ({
              id: product.id,
              reason: String(product.reason || "").trim(),
            }),
          ),
          previousShoppingGuidanceCount: Math.max(
            0,
            request.recalibrationContext.previousShoppingGuidanceCount || 0,
          ),
        }
      : undefined,
  };
}

export function normalizeRecalibratedBackupProducts({
  rankedCandidates,
  topProducts,
  backupProducts,
  count,
}: {
  rankedCandidates: RecommendationRankedProduct[];
  topProducts: Pick<RecommendationRankedProduct, "id">[];
  backupProducts: BackupCandidate[];
  count: number;
}): BackupCandidate[] {
  const backupReasonMap = new Map<string, string>();

  for (const product of backupProducts) {
    const normalizedReason = String(product.backupReason || "").trim();
    if (!normalizedReason) continue;
    backupReasonMap.set(product.id, normalizedReason);
  }

  return buildBackupCandidates(
    rankedCandidates,
    topProducts.map((product) => product.id),
    count,
  ).map((product) => ({
    ...product,
    backupReason:
      backupReasonMap.get(product.id) ||
      buildLocalBackupReason(product, product.backupLabel),
  }));
}
