import type { AnswerState, Product } from "../data/mock.ts";
import type { RankedProduct } from "./app-shell.ts";
import { getProductDisplayName } from "./product-display-name.ts";
import {
  buildLocalBackupReason,
  buildLocalPrimaryReason,
  type BackupCandidate,
} from "./recommendation-results.ts";
import {
  buildLocalRecommendationRanking,
  type StructuredRankedProduct,
} from "./recommendation-local-ranking.ts";
import {
  filterFemaleMvpProducts,
  shouldUseFemaleMvp,
} from "./app-mode.ts";

export const AI_RERANK_POOL_SIZE = 10;
export const FINAL_SELECTION_COUNT = 3;
export const BACKUP_SELECTION_COUNT = 3;
export const MAX_SHOPPING_GUIDANCE_COUNT = 5;

export type LocalResultComputation = {
  filteredCount: number;
  recommendationTips: string[];
  rankedCandidates: StructuredRankedProduct[];
  rerankPool: StructuredRankedProduct[];
  fallbackTopProducts: StructuredRankedProduct[];
};

export type LocalResultComputationContext = {
  naturalLanguageQuery?: string;
};

export function finalizeRankedProducts(
  products: StructuredRankedProduct[],
  reasonMap: Map<string, string>,
  answers: AnswerState,
): RankedProduct[] {
  return products.map(
    ({ matchSummary, hardMisses, budgetGap, noiseGap, ...product }) => ({
      ...product,
      matchSummary,
      hardMisses,
      budgetGap,
      noiseGap,
      reason:
        reasonMap.get(product.id) ||
        buildLocalPrimaryReason(
          { ...product, matchSummary, hardMisses, budgetGap, noiseGap },
          answers,
        ),
    }),
  );
}

export function finalizeBackupProducts(
  products: BackupCandidate[],
  reasonMap: Map<string, string>,
  answers?: AnswerState,
) {
  return products.map((product) => ({
    ...product,
    backupReason:
      reasonMap.get(product.id) ||
      buildLocalBackupReason(product, product.backupLabel, answers),
  }));
}

export function buildLocalResultComputation(
  currentAnswers: AnswerState,
  productsData: Product[],
  context?: LocalResultComputationContext,
): LocalResultComputation {
  const eligibleProducts = shouldUseFemaleMvp()
    ? filterFemaleMvpProducts(productsData)
    : productsData;
  const localRanking = buildLocalRecommendationRanking(
    currentAnswers,
    eligibleProducts,
    {
      rerankPoolSize: AI_RERANK_POOL_SIZE,
      finalSelectionCount: FINAL_SELECTION_COUNT,
      context,
    },
  );
  const filtered = localRanking.filteredProducts;
  const relaxedProducts = localRanking.relaxedProducts;

  const recommendationTips: string[] = [];

  if (filtered.length < 3) {
    if (currentAnswers.budget) {
      const potentialByBudget = relaxedProducts.filter((p) => {
        const matchOther =
          (!currentAnswers.maxDb ||
            p.maxDb == null ||
            p.maxDb <= currentAnswers.maxDb) &&
          (currentAnswers.appearance !== "high_disguise" ||
            p.appearance === "high_disguise");
        return (
          matchOther &&
          (p.price < currentAnswers.budget[0] ||
            p.price > currentAnswers.budget[1])
        );
      });
      if (potentialByBudget.length > 0) {
        recommendationTips.push(
          `适当调高预算（如增至 ¥${Math.round(currentAnswers.budget[1] * 1.5)} 左右）可大幅增加匹配成功率。`,
        );
      }
    }

    if (currentAnswers.appearance === "high_disguise") {
      const potentialByAppearance = relaxedProducts.filter((p) => {
        const matchOther =
          (!currentAnswers.maxDb ||
            p.maxDb == null ||
            p.maxDb <= currentAnswers.maxDb) &&
          (!currentAnswers.budget ||
            (p.price >= currentAnswers.budget[0] &&
              p.price <= currentAnswers.budget[1]));
        return matchOther && p.appearance !== "high_disguise";
      });
      if (potentialByAppearance.length > 0) {
        recommendationTips.push(
          "若能接受常规或科技感造型（不拘泥于高伪装），可选性能范围将显著扩大。",
        );
      }
    }

    if (currentAnswers.maxDb && currentAnswers.maxDb < 60) {
      const potentialByNoise = relaxedProducts.filter((p) => {
        const matchOther =
          (currentAnswers.appearance !== "high_disguise" ||
            p.appearance === "high_disguise") &&
          (!currentAnswers.budget ||
            (p.price >= currentAnswers.budget[0] &&
              p.price <= currentAnswers.budget[1]));
        return (
          matchOther && p.maxDb != null && p.maxDb > currentAnswers.maxDb
        );
      });
      if (potentialByNoise.length > 0) {
        recommendationTips.push(
          "对噪音阈值的微调（如调至 55dB 左右）可能会带给您更细腻的震动体验。",
        );
      }
    }
  }

  return {
    filteredCount: filtered.length,
    recommendationTips,
    rankedCandidates: localRanking.rankedCandidates,
    rerankPool: localRanking.rerankPool,
    fallbackTopProducts: localRanking.fallbackTopProducts,
  };
}

export function serializeRecommendationTopProducts(products: RankedProduct[]) {
  return products.slice(0, FINAL_SELECTION_COUNT).map((product) => ({
    id: product.id,
    name: getProductDisplayName(product),
    gender: product.gender,
    typeCode: product.typeCode ?? null,
    subtypeCode: product.subtypeCode ?? null,
    score: product.score,
    reason: String(product.reason || "").trim(),
  }));
}
