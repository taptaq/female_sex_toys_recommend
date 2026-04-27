import type {
  BackupCandidate,
  RecommendationAnswers,
  RecommendationRankedProduct,
} from "./recommendation-results.ts";
import type { AppAiProvider } from "./app-ai-chain.ts";
import {
  buildBackupCandidates,
  buildLocalBackupReason,
} from "./recommendation-results.ts";
import { getResultModelOption, getSafeSelectedResultProvider } from "./result-models.ts";

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

export type ResultRecalibrationRequest = {
  answers: RecommendationAnswers;
  targetProvider: AppAiProvider;
  rerankPool: ResultRecalibrationCandidate[];
  rankedCandidates: ResultRecalibrationCandidate[];
  filteredCount: number;
  recommendationTips: string[];
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
  currentSelectedResultProvider: AppAiProvider;
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
  const safeSelectedProvider = getSafeSelectedResultProvider(persistedProvider);

  return {
    currentResultProvider: hasValidPersistedProvider
      ? safeSelectedProvider
      : undefined,
    currentResultModelName: hasValidPersistedProvider
      ? normalizeModelName(persistedState?.currentResultModelName)
      : undefined,
    currentSelectedResultProvider: safeSelectedProvider,
  };
}

export function clearResultSourceState(
  currentSelectedResultProvider: string | null | undefined,
): ResultSourceState {
  return {
    currentResultProvider: undefined,
    currentResultModelName: undefined,
    currentSelectedResultProvider: getSafeSelectedResultProvider(
      currentSelectedResultProvider,
    ),
  };
}

export function resolveCurrentResultSourceState({
  selectedProvider,
  currentProvider,
  currentModelName,
}: {
  selectedProvider: string | null | undefined;
  currentProvider?: string | null;
  currentModelName?: string | null;
}): ResultSourceState {
  if (!getResultModelOption(currentProvider)) {
    return clearResultSourceState(selectedProvider);
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
    targetProvider: request.targetProvider,
    rerankPool: request.rerankPool.map(normalizeCandidate),
    rankedCandidates: request.rankedCandidates.map(normalizeCandidate),
    filteredCount: request.filteredCount,
    recommendationTips: request.recommendationTips,
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
