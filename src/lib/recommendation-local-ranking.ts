import type { AnswerState, Product } from "../data/mock.js";
import type { RankedProduct } from "./app-shell.js";
import {
  buildRecommendationCandidatePool,
  type RecommendationCandidatePoolContext,
} from "./recommendation-candidate-pool.js";
import {
  getBranchPreferenceAdjustments,
  selectScorePresetId,
  type ScorePresetId,
} from "./quiz-branching.js";
import { getDisguisePreferenceAdjustment } from "./product-disguise-signals.js";

export const DEFAULT_AI_RERANK_POOL_SIZE = 10;
export const DEFAULT_FINAL_SELECTION_COUNT = 3;

export type StructuredRankedProduct = RankedProduct & {
  matchSummary: string[];
  hardMisses: number;
  budgetGap: number;
  noiseGap: number;
};

type ScoreWeights = {
  genderExact: number;
  genderUnisex: number;
  genderMiss: number;
  physicalFormExact: number;
  physicalFormMiss: number;
  motorTypeExact: number;
  motorTypeMiss: number;
  appearanceExact: number;
  appearanceHighDisguiseMiss: number;
  waterproofUnknown: number;
  waterproofQualified: number;
  waterproofMiss: number;
  noiseUnknown: number;
  noiseQualified: number;
  noiseMissMin: number;
  noiseMissStep: number;
  noiseMissMax: number;
  noiseStepDb: number;
  budgetInRange: number;
  budgetMidpointBonusMax: number;
  budgetMidpointStepPrice: number;
  budgetMissBase: number;
  budgetMissStep: number;
  budgetMissMax: number;
  budgetMissStepPrice: number;
  tagsBonusMax: number;
};

type HardMissPolicy = {
  genderMismatch: boolean;
  physicalFormMismatch: boolean;
  motorTypeMismatch: boolean;
  appearanceMismatch: boolean;
  waterproofMismatch: boolean;
  noiseMismatch: boolean;
  budgetMismatch: boolean;
};

type ScorePreset = {
  id: ScorePresetId;
  label: string;
  weights: ScoreWeights;
  hardMissPolicy: HardMissPolicy;
};

type NaturalLanguagePreferenceAdjustment = {
  score: number;
  summary: string[];
  hardMisses: number;
};

const SCORE_PRESET_FEMALE: ScorePreset = {
  id: "female",
  label: "女性向场景",
  weights: {
    genderExact: 32,
    genderUnisex: 14,
    genderMiss: -36,
    physicalFormExact: 38,
    physicalFormMiss: -14,
    motorTypeExact: 24,
    motorTypeMiss: -10,
    appearanceExact: 24,
    appearanceHighDisguiseMiss: -22,
    waterproofUnknown: 2,
    waterproofQualified: 14,
    waterproofMiss: -14,
    noiseUnknown: 2,
    noiseQualified: 20,
    noiseMissMin: -8,
    noiseMissStep: -4,
    noiseMissMax: -20,
    noiseStepDb: 5,
    budgetInRange: 18,
    budgetMidpointBonusMax: 6,
    budgetMidpointStepPrice: 50,
    budgetMissBase: -8,
    budgetMissStep: -4,
    budgetMissMax: -20,
    budgetMissStepPrice: 50,
    tagsBonusMax: 4,
  },
  hardMissPolicy: {
    genderMismatch: true,
    physicalFormMismatch: true,
    motorTypeMismatch: false,
    appearanceMismatch: true,
    waterproofMismatch: true,
    noiseMismatch: true,
    budgetMismatch: true,
  },
};

const SCORE_PRESET_MALE: ScorePreset = {
  id: "male",
  label: "男性向场景",
  weights: {
    genderExact: 34,
    genderUnisex: 10,
    genderMiss: -40,
    physicalFormExact: 30,
    physicalFormMiss: -12,
    motorTypeExact: 28,
    motorTypeMiss: -12,
    appearanceExact: 8,
    appearanceHighDisguiseMiss: -8,
    waterproofUnknown: 4,
    waterproofQualified: 10,
    waterproofMiss: -8,
    noiseUnknown: 6,
    noiseQualified: 10,
    noiseMissMin: -4,
    noiseMissStep: -3,
    noiseMissMax: -12,
    noiseStepDb: 5,
    budgetInRange: 24,
    budgetMidpointBonusMax: 8,
    budgetMidpointStepPrice: 60,
    budgetMissBase: -10,
    budgetMissStep: -4,
    budgetMissMax: -24,
    budgetMissStepPrice: 60,
    tagsBonusMax: 5,
  },
  hardMissPolicy: {
    genderMismatch: true,
    physicalFormMismatch: true,
    motorTypeMismatch: true,
    appearanceMismatch: false,
    waterproofMismatch: true,
    noiseMismatch: false,
    budgetMismatch: true,
  },
};

const SCORE_PRESET_COUPLE: ScorePreset = {
  id: "couple",
  label: "情侣共玩场景",
  weights: {
    genderExact: 18,
    genderUnisex: 32,
    genderMiss: -36,
    physicalFormExact: 28,
    physicalFormMiss: -10,
    motorTypeExact: 18,
    motorTypeMiss: -8,
    appearanceExact: 20,
    appearanceHighDisguiseMiss: -12,
    waterproofUnknown: 4,
    waterproofQualified: 14,
    waterproofMiss: -12,
    noiseUnknown: 8,
    noiseQualified: 22,
    noiseMissMin: -8,
    noiseMissStep: -4,
    noiseMissMax: -22,
    noiseStepDb: 5,
    budgetInRange: 22,
    budgetMidpointBonusMax: 8,
    budgetMidpointStepPrice: 50,
    budgetMissBase: -8,
    budgetMissStep: -4,
    budgetMissMax: -24,
    budgetMissStepPrice: 50,
    tagsBonusMax: 4,
  },
  hardMissPolicy: {
    genderMismatch: true,
    physicalFormMismatch: false,
    motorTypeMismatch: false,
    appearanceMismatch: true,
    waterproofMismatch: true,
    noiseMismatch: true,
    budgetMismatch: true,
  },
};

const SCORE_PRESETS = {
  female: SCORE_PRESET_FEMALE,
  male: SCORE_PRESET_MALE,
  couple: SCORE_PRESET_COUPLE,
} as const;

const TIEBREAKER_PRIORITY = {
  preferHigherWaterproof: true,
  preferLowerPrice: true,
} as const;

export type LocalRecommendationRanking = {
  filteredProducts: Product[];
  relaxedProducts: Product[];
  rankedInputProducts: Product[];
  scorePresetId: ScorePresetId;
  rankedCandidates: StructuredRankedProduct[];
  rerankPool: StructuredRankedProduct[];
  fallbackTopProducts: StructuredRankedProduct[];
};

function selectScorePreset(answers: AnswerState, products: Product[]): ScorePreset {
  return SCORE_PRESETS[selectScorePresetId(answers, products)];
}

function getBudgetGap(price: number, budget?: [number, number]) {
  if (!budget) return 0;
  const [min, max] = budget;
  if (price < min) return min - price;
  if (price > max) return price - max;
  return 0;
}

function hasPositiveSuctionSignal(text: string) {
  const normalized = String(text || "").toLowerCase();
  if (!normalized) return false;
  if (/不是吮吸|非吮吸|不带吮吸|无吮吸|not suction|non-suction/.test(normalized)) {
    return false;
  }
  return /吮吸|吸感|吸吮|小海豚|阴蒂吸|air ?pulse|suction/.test(normalized);
}

function getNaturalLanguagePreferenceAdjustment(
  product: Product,
  naturalLanguageQuery?: string,
): NaturalLanguagePreferenceAdjustment {
  const query = String(naturalLanguageQuery || "").trim();
  if (!query) {
    return { score: 0, summary: [], hardMisses: 0 };
  }

  const lowerQuery = query.toLowerCase();
  const haystack = [
    product.name,
    product.displayName,
    product.safeDisplayName,
    product.canonicalName,
    product.rawDescription,
    ...(product.tags ?? []),
    product.typeCode,
    product.subtypeCode,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  let score = 0;
  let hardMisses = 0;
  const summary: string[] = [];

  const wantsSuction =
    /吮吸|吸感|吸吮|小海豚|阴蒂吸|air ?pulse|suction/.test(lowerQuery);
  const wantsStrongSuction =
    /吮吸感更强|更强吮吸|更强吸感|吸力更强|吸感更强/.test(lowerQuery);
  const allowsInsertable =
    /入体|插入|深入|内外|双刺激|双通道|g点|g\s*点/.test(lowerQuery);
  if (wantsSuction) {
    const productSupportsSuction =
      hasPositiveSuctionSignal(haystack) ||
      product.typeCode === "suction";
    if (productSupportsSuction) {
      score += 42;
      summary.push("原始描述明确偏向吮吸路线");
    } else {
      score -= 28;
      hardMisses += 1;
    }

    if (!allowsInsertable && product.physicalForm === "external") {
      score += 18;
      summary.push("更贴近外部使用路径");
    }

    if (wantsStrongSuction) {
      if (/强劲|强力|高能|爆发|大吸力|强吸/.test(haystack)) {
        score += 24;
        summary.push("更贴近强吮吸诉求");
      } else if (productSupportsSuction) {
        score += 8;
      }
    }
  }

  const wantsMorePatterns =
    /波形.*多|模式.*多|档位.*多|变化.*多|花样.*多/.test(lowerQuery);
  if (wantsMorePatterns) {
    const productHasPatternSignals =
      /波形|模式|档位|频率|节奏|变化/.test(haystack);
    if (productHasPatternSignals) {
      score += 16;
      summary.push("模式变化更贴近你的原话");
    }
  }

  const wantsStrongIntensity =
    /更强|强一点|吸力强|力度强|刺激强/.test(lowerQuery) && !wantsStrongSuction;
  if (wantsStrongIntensity) {
    if (product.motorType === "strong" || /强劲|强力|高能|爆发/.test(haystack)) {
      score += 18;
      summary.push("强度表达更贴近你的描述");
    } else if (product.motorType === "gentle") {
      score -= 8;
    }
  }

  const wantsModerateNoise = /噪音适中|声音适中|别太吵|不要太吵|静音|夜晚|宿舍|同住/.test(
    lowerQuery,
  );
  if (wantsModerateNoise && product.maxDb != null) {
    if (product.maxDb <= 50) {
      score += 14;
      summary.push("噪音表现更贴近原始场景");
    } else if (product.maxDb > 58) {
      score -= 12;
    }
  }

  return {
    score,
    summary,
    hardMisses,
  };
}

export function scoreStructuredProduct(
  product: Product,
  answers: AnswerState,
  preset: ScorePreset,
  context?: RecommendationCandidatePoolContext,
): StructuredRankedProduct {
  const weights = preset.weights;
  const hardMissPolicy = preset.hardMissPolicy;
  let score = 0;
  let hardMisses = 0;
  const matchSummary: string[] = [];
  const budgetGap = getBudgetGap(product.price, answers.budget);
  const noiseGap =
    answers.maxDb && product.maxDb != null
      ? Math.max(product.maxDb - answers.maxDb, 0)
      : 0;

  if (answers.gender) {
    const isCoupleCompatibleGender =
      answers.gender === "unisex" &&
      ((answers.partnerComposition === "male_male" && product.gender === "male") ||
        (answers.partnerComposition === "female_female" && product.gender === "female") ||
        (answers.partnerComposition === "mixed" && product.gender !== "unisex"));

    if (isCoupleCompatibleGender) {
      score += weights.genderUnisex;
      matchSummary.push("适配当前互动对象关系");
    } else if (product.gender === answers.gender) {
      score += weights.genderExact;
      matchSummary.push(
        "适配当前使用方向",
      );
    } else if (product.gender === "unisex") {
      score += weights.genderUnisex;
      matchSummary.push("支持通用/情侣场景");
    } else {
      score += weights.genderMiss;
      if (hardMissPolicy.genderMismatch) hardMisses += 1;
    }
  }

  if (answers.physicalForm) {
    if (product.physicalForm === answers.physicalForm) {
      score += weights.physicalFormExact;
      matchSummary.push("刺激形式与偏好一致");
    } else {
      score += weights.physicalFormMiss;
      if (hardMissPolicy.physicalFormMismatch) hardMisses += 1;
    }
  }

  if (answers.motorType) {
    if (product.motorType === answers.motorType) {
      score += weights.motorTypeExact;
      matchSummary.push(
        product.motorType === "gentle" ? "力度更偏温柔稳定" : "力度更偏强劲直接",
      );
    } else {
      score += weights.motorTypeMiss;
      if (hardMissPolicy.motorTypeMismatch) hardMisses += 1;
    }
  }

  if (answers.appearance) {
    if (product.appearance === answers.appearance) {
      score += weights.appearanceExact;
      if (product.appearance === "high_disguise") {
        matchSummary.push("外观更利于隐蔽收纳");
      }
    } else if (answers.appearance === "high_disguise") {
      score += weights.appearanceHighDisguiseMiss;
      if (hardMissPolicy.appearanceMismatch) hardMisses += 1;
    }
  }

  if (answers.waterproof) {
    if (product.waterproof == null) {
      score += weights.waterproofUnknown;
    } else if (product.waterproof >= answers.waterproof) {
      score += weights.waterproofQualified;
      matchSummary.push(`防水表现达到 IPX${product.waterproof}`);
    } else {
      score += weights.waterproofMiss;
      if (hardMissPolicy.waterproofMismatch) hardMisses += 1;
    }
  }

  if (answers.maxDb) {
    if (product.maxDb == null) {
      score += weights.noiseUnknown;
    } else if (product.maxDb <= answers.maxDb) {
      score += weights.noiseQualified;
      matchSummary.push(`${product.maxDb}dB 更贴近静音需求`);
    } else {
      const noisePenalty = Math.max(
        Math.abs(weights.noiseMissMin),
        Math.ceil(noiseGap / weights.noiseStepDb) *
          Math.abs(weights.noiseMissStep),
      );
      score -= Math.min(Math.abs(weights.noiseMissMax), noisePenalty);
      if (hardMissPolicy.noiseMismatch) hardMisses += 1;
    }
  }

  if (answers.budget) {
    if (budgetGap === 0) {
      const [min, max] = answers.budget;
      const midpoint = (min + max) / 2;
      const midpointGap = Math.abs(product.price - midpoint);
      score += weights.budgetInRange;
      score += Math.max(
        0,
        weights.budgetMidpointBonusMax -
          Math.round(midpointGap / weights.budgetMidpointStepPrice),
      );
      matchSummary.push("价格落在预算区间内");
    } else {
      const budgetPenalty =
        Math.abs(weights.budgetMissBase) +
        Math.ceil(budgetGap / weights.budgetMissStepPrice) *
          Math.abs(weights.budgetMissStep);
      score -= Math.min(Math.abs(weights.budgetMissMax), budgetPenalty);
      if (hardMissPolicy.budgetMismatch) hardMisses += 1;
    }
  }

  if (Array.isArray(product.tags) && product.tags.length > 0) {
    score += Math.min(product.tags.length, weights.tagsBonusMax);
  }

  const branchAdjustments = getBranchPreferenceAdjustments(
    product,
    answers,
    preset.id,
  );
  score += branchAdjustments.score;
  matchSummary.push(...branchAdjustments.summary);

  const disguiseAdjustments = getDisguisePreferenceAdjustment(product, answers);
  score += disguiseAdjustments.score;
  matchSummary.push(...disguiseAdjustments.summary);

  const naturalLanguageAdjustments = getNaturalLanguagePreferenceAdjustment(
    product,
    context?.naturalLanguageQuery,
  );
  score += naturalLanguageAdjustments.score;
  hardMisses += naturalLanguageAdjustments.hardMisses;
  matchSummary.push(...naturalLanguageAdjustments.summary);

  return {
    ...product,
    score: Math.max(0, Math.round(score)),
    matchSummary: Array.from(new Set(matchSummary)).slice(0, 4),
    hardMisses,
    budgetGap,
    noiseGap,
  };
}

export function compareStructuredProducts(
  a: StructuredRankedProduct,
  b: StructuredRankedProduct,
) {
  return (
    b.score - a.score ||
    a.hardMisses - b.hardMisses ||
    a.budgetGap - b.budgetGap ||
    a.noiseGap - b.noiseGap ||
    (TIEBREAKER_PRIORITY.preferHigherWaterproof
      ? (b.waterproof ?? -1) - (a.waterproof ?? -1)
      : 0) ||
    (TIEBREAKER_PRIORITY.preferLowerPrice ? a.price - b.price : 0)
  );
}

export function buildLocalRecommendationRanking(
  answers: AnswerState,
  products: Product[],
  options: {
    rerankPoolSize?: number;
    finalSelectionCount?: number;
    context?: RecommendationCandidatePoolContext;
  } = {},
): LocalRecommendationRanking {
  const recommendationPool = buildRecommendationCandidatePool(
    answers,
    products,
    options.context,
  );
  const candidates = recommendationPool.rankedInputProducts;
  const scorePreset = selectScorePreset(answers, candidates);
  const rerankPoolSize = options.rerankPoolSize ?? DEFAULT_AI_RERANK_POOL_SIZE;
  const finalSelectionCount =
    options.finalSelectionCount ?? DEFAULT_FINAL_SELECTION_COUNT;
  const rankedCandidates = candidates
    .map((product) =>
      scoreStructuredProduct(product, answers, scorePreset, options.context),
    )
    .sort(compareStructuredProducts);
  const rerankPool = rankedCandidates.slice(0, rerankPoolSize);

  return {
    ...recommendationPool,
    scorePresetId: scorePreset.id,
    rankedCandidates,
    rerankPool,
    fallbackTopProducts: rerankPool.slice(0, finalSelectionCount),
  };
}
