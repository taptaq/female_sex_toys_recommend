/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { AnimatePresence } from "motion/react";
import type { Session } from "@supabase/supabase-js";
import { getActiveQuestions, AnswerState, Product, Question } from "./data/mock";
import {
  AppRoute,
  APP_STATE_STORAGE_KEY,
  RankedProduct,
  detectRoute,
  normalizeProductsPayload,
  readProductsCache,
  readSessionJsonStorage,
  resolveProfilesReturnRoute,
  writeProductsCache,
  writeSessionJsonStorage,
} from "./lib/app-shell";
import {
  buildBackupCandidates,
  buildLocalBackupReason,
  buildLocalPrimaryReason,
  buildLocalShoppingGuidance,
  type BackupCandidate,
} from "./lib/recommendation-results";
import {
  createClearedQuizSessionState,
  removeQuizAnswersFromQuestionIndex,
  removeQuizQuestionAnswer,
  rewindQuizAnswer,
} from "./lib/quiz-session";
import type { AppAiProvider } from "./lib/app-ai-chain";
import {
  buildResultRecalibrationPayload,
  clearResultSourceState,
  readResultSourceState,
  resolveCurrentResultSourceState,
  type ResultRecalibrationResponse,
} from "./lib/result-recalibration";
import { tuneResultAnswers, type ResultTuningMode } from "./lib/result-tuning";
import {
  buildRecommendationProfilePayload,
  listRecommendationProfiles,
  type SavedRecommendationProfile,
  saveRecommendationProfile,
} from "./lib/user-recommendation-profile";
import { getProductDisplayName } from "./lib/product-display-name.ts";
import {
  sanitizeLibrarySubtypeSelection,
  sanitizeLibraryTypeSelection,
  type LibraryAudienceGender,
} from "./lib/library-product-types.ts";
import {
  getCurrentSupabaseSession,
  isSupabaseAuthConfigured,
  onSupabaseAuthStateChange,
  registerUsernamePassword,
  signInWithUsernamePassword,
  signOutOfSupabase,
} from "./lib/supabase-auth";
import type { AuthPanelMode } from "./components/AuthPanel";
import {
  getBranchPreferenceAdjustments,
  selectScorePresetId,
  type ScorePresetId,
} from "./lib/quiz-branching";
import { HomePage } from "./pages/HomePage";
import { QuizPage } from "./pages/QuizPage";
import { MatchingPage } from "./pages/MatchingPage";
import {
  ResultsPage,
  type ResultEditableCondition,
} from "./pages/ResultsPage";
import { LibraryPage } from "./pages/LibraryPage";
import { KnowledgeNebulaPage } from "./pages/KnowledgeNebulaPage";
import { ProfilesPage } from "./pages/ProfilesPage";
import {
  buildKnowledgeNebulaPath,
  parseKnowledgeNebulaPath,
} from "./lib/knowledge-nebula-route";
import type { KnowledgeNebulaTopicSlug } from "./data/knowledge-nebula";

type StructuredRankedProduct = RankedProduct & {
  matchSummary: string[];
  hardMisses: number;
  budgetGap: number;
  noiseGap: number;
};

type AiReasonResult = {
  id: string;
  reason: string;
};

type BackupProduct = BackupCandidate;

type AiResultEnhancement = {
  backupProducts?: AiReasonResult[];
  shoppingGuidance?: string[];
};

type AppHistoryState = {
  knowledgeOriginRoute?: AppRoute;
  profilesOriginRoute?: AppRoute;
};

type AppAiProxyResponse<T> = {
  data: T;
  modelName: string;
  provider: AppAiProvider;
};

type PersistedAppState = {
  step?: number;
  answers?: AnswerState;
  topProducts?: RankedProduct[];
  backupProducts?: BackupProduct[];
  recommendationTips?: string[];
  shoppingGuidance?: string[];
  filterGender?: string;
  filterType?: string;
  filterSubtype?: string;
  filterBrand?: string;
  filterOrigin?: string;
  filterMaxDb?: number;
  filterMaterial?: string;
  filterPriceRange?: string;
  currentResultProvider?: AppAiProvider;
  currentResultModelName?: string;
};

function normalizeLibraryAudienceGender(value: string): LibraryAudienceGender {
  if (value === "female" || value === "male" || value === "unisex") {
    return value;
  }

  return "all";
}

const AI_RERANK_POOL_SIZE = 10;
const FINAL_SELECTION_COUNT = 3;
const BACKUP_SELECTION_COUNT = 3;
const MAX_SHOPPING_GUIDANCE_COUNT = 5;

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

// 结构化打分预设。
// 目标不是“数学最优”，而是按当前业务场景给出更贴近真实选品思路的权重分配。
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

function selectScorePreset(
  answers: AnswerState,
  products: Product[],
): ScorePreset {
  return SCORE_PRESETS[selectScorePresetId(answers, products)];
}

// 并列时的优先级：
// 1. 先看总分
// 2. 再看踩雷项 hardMisses
// 3. 再看预算/噪音偏差
// 4. 最后才用防水和价格做细排
const TIEBREAKER_PRIORITY = {
  preferHigherWaterproof: true,
  preferLowerPrice: true,
} as const;

function getBudgetGap(price: number, budget?: [number, number]) {
  if (!budget) return 0;
  const [min, max] = budget;
  if (price < min) return min - price;
  if (price > max) return price - max;
  return 0;
}

function scoreStructuredProduct(
  product: Product,
  answers: AnswerState,
  preset: ScorePreset,
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
    if (product.gender === answers.gender) {
      score += weights.genderExact;
      matchSummary.push("适配当前使用方向");
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

  return {
    ...product,
    score: Math.max(0, Math.round(score)),
    matchSummary: Array.from(new Set(matchSummary)).slice(0, 4),
    hardMisses,
    budgetGap,
    noiseGap,
  };
}

function compareStructuredProducts(
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

function finalizeRankedProducts(
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

function finalizeBackupProducts(
  products: BackupCandidate[],
  reasonMap: Map<string, string>,
  answers?: AnswerState,
): BackupProduct[] {
  return products.map((product) => ({
    ...product,
    backupReason:
      reasonMap.get(product.id) ||
      buildLocalBackupReason(product, product.backupLabel, answers),
  }));
}

type LocalResultComputation = {
  filteredCount: number;
  recommendationTips: string[];
  rankedCandidates: StructuredRankedProduct[];
  rerankPool: StructuredRankedProduct[];
  fallbackTopProducts: StructuredRankedProduct[];
};

export default function App() {
  const initialPathname = window.location.pathname;
  const initialKnowledgeRouteState =
    detectRoute(initialPathname) === "/knowledge"
      ? parseKnowledgeNebulaPath(initialPathname)
      : undefined;
  const initialKnowledgeOriginRoute =
    detectRoute(initialPathname) === "/knowledge"
      ? (window.history.state as AppHistoryState | null)?.knowledgeOriginRoute
      : undefined;
  const initialProfilesOriginRoute =
    detectRoute(initialPathname) === "/profiles"
      ? (window.history.state as AppHistoryState | null)?.profilesOriginRoute
      : undefined;
  const persistedState = readSessionJsonStorage<PersistedAppState>(
    APP_STATE_STORAGE_KEY,
    {},
  );
  const persistedResultSourceState = readResultSourceState(persistedState);
  const cachedProducts = readProductsCache();

  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() =>
    detectRoute(initialPathname),
  );
  const [selectedKnowledgeTopicSlug, setSelectedKnowledgeTopicSlug] = useState<
    KnowledgeNebulaTopicSlug | undefined
  >(initialKnowledgeRouteState?.topicSlug);
  const [selectedKnowledgeSectionId, setSelectedKnowledgeSectionId] = useState<
    string | undefined
  >(initialKnowledgeRouteState?.sectionId);
  const [knowledgeOriginRoute, setKnowledgeOriginRoute] = useState<
    AppRoute | undefined
  >(initialKnowledgeOriginRoute);
  const [profilesOriginRoute, setProfilesOriginRoute] = useState<
    AppRoute | undefined
  >(initialProfilesOriginRoute);
  const [step, setStep] = useState<number>(persistedState.step ?? -1);
  const [answers, setAnswers] = useState<AnswerState>(
    persistedState.answers ?? { tags: [] },
  );
  const [allProducts, setAllProducts] = useState<Product[]>(cachedProducts);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(cachedProducts.length > 0);
  const [productsError, setProductsError] = useState<string | null>(null);
  const productsFetchRef = useRef<Promise<Product[]> | null>(null);
  const hasAutoRefreshedLibraryProductsRef = useRef(false);

  // 过滤器状态
  const [filterGender, setFilterGender] = useState<string>(
    normalizeLibraryAudienceGender(persistedState.filterGender ?? "all"),
  );
  const [filterType, setFilterType] = useState<string>(() =>
    sanitizeLibraryTypeSelection(
      persistedState.filterType ?? "all",
      normalizeLibraryAudienceGender(persistedState.filterGender ?? "all"),
    ),
  );
  const [filterSubtype, setFilterSubtype] = useState<string>(() =>
    sanitizeLibrarySubtypeSelection(
      persistedState.filterSubtype ?? "all",
      normalizeLibraryAudienceGender(persistedState.filterGender ?? "all"),
      sanitizeLibraryTypeSelection(
        persistedState.filterType ?? "all",
        normalizeLibraryAudienceGender(persistedState.filterGender ?? "all"),
      ),
    ),
  );
  const [filterBrand, setFilterBrand] = useState<string>(
    persistedState.filterBrand ?? "all",
  );
  const [filterOrigin, setFilterOrigin] = useState<string>(
    persistedState.filterOrigin ?? "all",
  );
  const [filterMaxDb, setFilterMaxDb] = useState<number>(
    persistedState.filterMaxDb ?? 100,
  );
  const [filterMaterial, setFilterMaterial] = useState<string>(
    persistedState.filterMaterial ?? "all",
  );
  const [filterPriceRange, setFilterPriceRange] = useState<string>(
    persistedState.filterPriceRange ?? "all",
  );

  const [topProducts, setTopProducts] = useState<RankedProduct[]>(
    persistedState.topProducts ?? [],
  );
  const [backupProducts, setBackupProducts] = useState<BackupProduct[]>(
    persistedState.backupProducts ?? [],
  );

  const [loadingStep, setLoadingStep] = useState(0);

  const [recommendationTips, setRecommendationTips] = useState<string[]>(
    persistedState.recommendationTips ?? [],
  );
  const [shoppingGuidance, setShoppingGuidance] = useState<string[]>(
    persistedState.shoppingGuidance ?? [],
  );
  const [currentResultProvider, setCurrentResultProvider] = useState<
    AppAiProvider | undefined
  >(persistedResultSourceState.currentResultProvider);
  const [currentResultModelName, setCurrentResultModelName] = useState<
    string | undefined
  >(persistedResultSourceState.currentResultModelName);
  const [isRecalibratingResults, setIsRecalibratingResults] = useState(false);
  const [resultRecalibrationError, setResultRecalibrationError] = useState<
    string | null
  >(null);
  const [resultRecalibrationAttemptCount, setResultRecalibrationAttemptCount] =
    useState(0);
  const [isSavingRecommendationProfile, setIsSavingRecommendationProfile] =
    useState(false);
  const [
    saveRecommendationProfileMessage,
    setSaveRecommendationProfileMessage,
  ] = useState<string | null>("登录后可加密保存到云端");
  const [supabaseSession, setSupabaseSession] = useState<Session | null>(null);
  const [authStatusMessage, setAuthStatusMessage] = useState<string | null>(null);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [recommendationProfiles, setRecommendationProfiles] = useState<
    SavedRecommendationProfile[]
  >([]);
  const [isLoadingRecommendationProfiles, setIsLoadingRecommendationProfiles] =
    useState(false);
  const [recommendationProfilesError, setRecommendationProfilesError] =
    useState<string | null>(null);

  const activeQuestions: Question[] = getActiveQuestions(answers.gender);

  const pageVariants: any = {
    initial: { opacity: 0, x: 20, scale: 0.95 },
    in: {
      opacity: 1,
      x: 0,
      scale: 1,
      transition: { duration: 0.5, ease: "easeInOut" },
    },
    out: {
      opacity: 0,
      x: -20,
      scale: 0.95,
      transition: { duration: 0.4, ease: "easeInOut" },
    },
  };

  const isInvalidKnowledgeDetailPath = (pathname: string) => {
    if (detectRoute(pathname) !== "/knowledge") {
      return false;
    }

    const normalizedPathname =
      pathname === "/" ? pathname : pathname.replace(/\/+$/, "");
    if (normalizedPathname === "/knowledge") {
      return false;
    }

    return parseKnowledgeNebulaPath(pathname).topicSlug === undefined;
  };

  const navigateTo = (route: AppRoute, replace = false) => {
    if (window.location.pathname !== route) {
      window.history[replace ? "replaceState" : "pushState"]({}, "", route);
    }
    setCurrentRoute(route);
    if (route !== "/knowledge") {
      setSelectedKnowledgeTopicSlug(undefined);
      setSelectedKnowledgeSectionId(undefined);
      setKnowledgeOriginRoute(undefined);
    }
    if (route !== "/profiles") {
      setProfilesOriginRoute(undefined);
    }
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const navigateToKnowledgeNebula = (
    topicSlug?: KnowledgeNebulaTopicSlug,
    sectionId?: string,
    replace = false,
  ) => {
    const knowledgePath = buildKnowledgeNebulaPath(topicSlug, sectionId);
    const nextKnowledgeOriginRoute =
      currentRoute === "/knowledge" ? knowledgeOriginRoute : currentRoute;
    if (window.location.pathname !== knowledgePath) {
      window.history[replace ? "replaceState" : "pushState"](
        { knowledgeOriginRoute: nextKnowledgeOriginRoute } satisfies AppHistoryState,
        "",
        knowledgePath,
      );
    } else if (replace) {
      window.history.replaceState(
        { knowledgeOriginRoute: nextKnowledgeOriginRoute } satisfies AppHistoryState,
        "",
        knowledgePath,
      );
    }
    setCurrentRoute("/knowledge");
    setSelectedKnowledgeTopicSlug(topicSlug);
    setSelectedKnowledgeSectionId(sectionId);
    setKnowledgeOriginRoute(nextKnowledgeOriginRoute);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const navigateToProfiles = () => {
    const nextProfilesOriginRoute =
      currentRoute === "/profiles" ? profilesOriginRoute : currentRoute;
    if (window.location.pathname !== "/profiles") {
      window.history.pushState(
        { profilesOriginRoute: nextProfilesOriginRoute } satisfies AppHistoryState,
        "",
        "/profiles",
      );
    }
    setCurrentRoute("/profiles");
    setSelectedKnowledgeTopicSlug(undefined);
    setKnowledgeOriginRoute(undefined);
    setProfilesOriginRoute(nextProfilesOriginRoute);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const getReturnRoute = (): AppRoute => {
    if (topProducts.length > 0 || step === activeQuestions.length + 1) {
      return "/results";
    }
    if (step >= 0) return "/quiz";
    return "/";
  };

  useEffect(() => {
    if (currentRoute === "/knowledge" && isInvalidKnowledgeDetailPath(window.location.pathname)) {
      navigateToKnowledgeNebula(undefined, undefined, true);
    }
  }, [currentRoute]);

  useEffect(() => {
    let isMounted = true;

    void getCurrentSupabaseSession().then((session) => {
      if (!isMounted) return;
      setSupabaseSession(session);
      setSaveRecommendationProfileMessage(
        session ? "已登录，可加密保存并多端同步" : "登录后可加密保存到云端",
      );
    });

    const unsubscribe = onSupabaseAuthStateChange((session) => {
      setSupabaseSession(session);
      setSaveRecommendationProfileMessage(
        session ? "已登录，可加密保存并多端同步" : "登录后可加密保存到云端",
      );
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  async function fetchRecommendationProfiles(session = supabaseSession) {
    const authToken =
      session?.access_token ||
      (await getCurrentSupabaseSession())?.access_token ||
      "";

    if (!authToken) {
      setRecommendationProfiles([]);
      setRecommendationProfilesError("需要登录后才能查看我的装备匹配档案。");
      return;
    }

    setIsLoadingRecommendationProfiles(true);
    setRecommendationProfilesError(null);

    try {
      const result = await listRecommendationProfiles({ authToken });
      setRecommendationProfiles(result.profiles);
    } catch (error) {
      setRecommendationProfilesError(
        error instanceof Error ? error.message : "读取装备匹配档案失败，请稍后重试。",
      );
    } finally {
      setIsLoadingRecommendationProfiles(false);
    }
  }

  useEffect(() => {
    if (currentRoute === "/profiles") {
      void fetchRecommendationProfiles();
    }
  }, [currentRoute, supabaseSession?.access_token]);

  useEffect(() => {
    const handlePopState = () => {
      const nextRoute = detectRoute(window.location.pathname);
      if (nextRoute === "/knowledge" && isInvalidKnowledgeDetailPath(window.location.pathname)) {
        window.history.replaceState(
          window.history.state,
          "",
          buildKnowledgeNebulaPath(),
        );
      }
      setCurrentRoute(nextRoute);
      setSelectedKnowledgeTopicSlug(
        nextRoute === "/knowledge"
          ? parseKnowledgeNebulaPath(window.location.pathname).topicSlug
          : undefined,
      );
      setSelectedKnowledgeSectionId(
        nextRoute === "/knowledge"
          ? parseKnowledgeNebulaPath(window.location.pathname).sectionId
          : undefined,
      );
      setKnowledgeOriginRoute(
        nextRoute === "/knowledge"
          ? (window.history.state as AppHistoryState | null)?.knowledgeOriginRoute
          : undefined,
      );
      setProfilesOriginRoute(
        nextRoute === "/profiles"
          ? (window.history.state as AppHistoryState | null)?.profilesOriginRoute
          : undefined,
      );
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (currentRoute === "/quiz" && step < 0) {
      setStep(0);
    }
    if (currentRoute === "/quiz" && step >= activeQuestions.length + 1) {
      setStep(Math.max(activeQuestions.length - 1, 0));
    }
  }, [currentRoute, step, activeQuestions.length]);

  useEffect(() => {
    if (currentRoute !== "/library") {
      hasAutoRefreshedLibraryProductsRef.current = false;
      return;
    }

    if (isLoading || hasAutoRefreshedLibraryProductsRef.current) {
      return;
    }

    hasAutoRefreshedLibraryProductsRef.current = true;
    void fetchProducts({
      preferCachedResult: allProducts.length === 0,
    });
  }, [currentRoute, isLoading, allProducts.length]);

  useEffect(() => {
    const nextGender = normalizeLibraryAudienceGender(filterGender);
    const nextType = sanitizeLibraryTypeSelection(filterType, nextGender);

    if (nextType !== filterType) {
      setFilterType(nextType);
    }

    setFilterSubtype((currentSubtype) =>
      sanitizeLibrarySubtypeSelection(currentSubtype, nextGender, nextType),
    );
  }, [filterGender, filterType]);

  useEffect(() => {
    writeSessionJsonStorage(
      APP_STATE_STORAGE_KEY,
      {
        step,
        answers,
        topProducts,
        backupProducts,
        recommendationTips,
        shoppingGuidance,
        filterGender,
        filterType,
        filterSubtype,
        filterBrand,
        filterOrigin,
        filterMaxDb,
        filterMaterial,
        filterPriceRange,
        currentResultProvider,
        currentResultModelName,
      },
    );
  }, [
    step,
    answers,
    topProducts,
    backupProducts,
    recommendationTips,
    shoppingGuidance,
    filterGender,
    filterType,
    filterSubtype,
    filterBrand,
    filterOrigin,
    filterMaxDb,
    filterMaterial,
    filterPriceRange,
    currentResultProvider,
    currentResultModelName,
  ]);

  useEffect(() => {
    writeProductsCache(allProducts);
  }, [allProducts]);

  const fetchProducts = (options?: { force?: boolean; preferCachedResult?: boolean }) => {
    const force = options?.force === true;
    const preferCachedResult = options?.preferCachedResult !== false;

    if (!force && preferCachedResult && allProducts.length > 0) {
      setHasFetched(true);
      return Promise.resolve(allProducts);
    }

    const latestCachedProducts = readProductsCache();
    if (!force && preferCachedResult && latestCachedProducts.length > 0) {
      setAllProducts(latestCachedProducts);
      setHasFetched(true);
      setProductsError(null);
      return Promise.resolve(latestCachedProducts);
    }

    if (force) {
      setAllProducts([]);
      setHasFetched(false);
    }

    if (productsFetchRef.current) return productsFetchRef.current;

    setIsLoading(true);
    setProductsError(null);
    setLoadingStep(1); // 连接星港
    productsFetchRef.current = new Promise<Product[]>((resolve) => {
      fetch("/api/recommender/toys")
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data?.error || data?.details || "装备库接口异常");
          }
          return normalizeProductsPayload(data);
        })
        .then((data) => {
          if (!Array.isArray(data)) {
            throw new Error("装备库接口返回格式异常");
          }
          setLoadingStep(2); // 数据解密
          setTimeout(() => {
            setLoadingStep(3); // 载入晶体
            setTimeout(() => {
              setAllProducts(data);
              setIsLoading(false);
              setHasFetched(true);
              setProductsError(null);
              resolve(data);
            }, 1200); // 仪式感时间
          }, 800);
        })
        .catch((error) => {
          console.error("Failed to fetch products:", error);
          setLoadingStep(-1); // 链路中断
          setProductsError("装备库数据加载失败，请稍后重试。");
          setIsLoading(false);
          resolve([]); // Resolve anyway to allow user to try again or see error state
        })
        .finally(() => {
          productsFetchRef.current = null;
        });
    });
    return productsFetchRef.current;
  };

  const handleOptionSelect = (
    field: keyof AnswerState,
    value: AnswerState[keyof AnswerState],
    tag: string,
    answerPatch?: Partial<Omit<AnswerState, "tags">>,
  ) => {
    const newAnswers = {
      ...answers,
      ...(answerPatch ?? {}),
      ...(value === undefined ? {} : { [field]: value }),
      tags: [...answers.tags, tag],
    };
    setAnswers(newAnswers);

    const activeQs = getActiveQuestions(newAnswers.gender);

    if (step < activeQs.length - 1) {
      setStep(step + 1);
    } else {
      setStep(activeQs.length); // Loading state
      if (!hasFetched) {
        fetchProducts().then((data) =>
          calculateResults(newAnswers, activeQs, data),
        );
      } else {
        calculateResults(newAnswers, activeQs, allProducts);
      }
    }
  };

  const handleBackQuestion = () => {
    if (step <= 0) return;

    const previousQuestion = activeQuestions[step - 1];
    setAnswers(
      rewindQuizAnswer(answers, {
        field: previousQuestion.field,
        answerPatchFields: Object.keys(
          previousQuestion.options.find((option) =>
            answers.tags.includes(option.tag),
          )?.answerPatch ?? {},
        ) as (keyof Omit<AnswerState, "tags">)[],
      }),
    );
    setStep(step - 1);
  };

  const handleEditQuizCondition = (condition: ResultEditableCondition) => {
    const questionByCondition = activeQuestions.find((question) => {
      if (condition === "budget") return question.field === "budget";
      if (condition === "quietness") return question.field === "maxDb";
      return (
        question.field === "coupleScene" ||
        question.field === "appearance" ||
        question.field === "sessionGoal"
      );
    });

    if (!questionByCondition) {
      resetQuiz();
      return;
    }

    const questionIndex = activeQuestions.findIndex(
      (question) => question.id === questionByCondition.id,
    );

    setAnswers(removeQuizQuestionAnswer(answers, questionByCondition));
    setTopProducts([]);
    setBackupProducts([]);
    setRecommendationTips([]);
    setShoppingGuidance([]);
    setResultRecalibrationError(null);
    setIsRecalibratingResults(false);
    setResultRecalibrationAttemptCount(0);
    applyResultSourceState(clearResultSourceState());
    setStep(questionIndex);
    navigateTo("/quiz");
  };

  const handleJumpToQuizQuestion = (questionIndex: number) => {
    if (questionIndex < 0 || questionIndex >= step) return;

    setAnswers(
      removeQuizAnswersFromQuestionIndex(
        answers,
        activeQuestions.slice(questionIndex),
        0,
      ),
    );
    setTopProducts([]);
    setBackupProducts([]);
    setRecommendationTips([]);
    setShoppingGuidance([]);
    setResultRecalibrationError(null);
    setIsRecalibratingResults(false);
    setResultRecalibrationAttemptCount(0);
    applyResultSourceState(clearResultSourceState());
    setStep(questionIndex);
  };

  const [isAiMatching, setIsAiMatching] = useState(false);
  const isDev = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env
    ?.DEV;

  function applyResultSourceState(
    nextState: ReturnType<typeof readResultSourceState>,
  ) {
    setCurrentResultProvider(nextState.currentResultProvider);
    setCurrentResultModelName(nextState.currentResultModelName);
  }

  function buildLocalResultComputation(
    currentAnswers: AnswerState,
    productsData: Product[],
  ): LocalResultComputation {
    const filtered = productsData.filter((p) => {
      if (
        currentAnswers.budget &&
        (p.price < currentAnswers.budget[0] ||
          p.price > currentAnswers.budget[1])
      ) {
        return false;
      }
      if (
        currentAnswers.maxDb &&
        p.maxDb != null &&
        p.maxDb > currentAnswers.maxDb
      ) {
        return false;
      }
      if (
        currentAnswers.appearance === "high_disguise" &&
        p.appearance !== "high_disguise"
      ) {
        return false;
      }
      if (
        currentAnswers.gender &&
        p.gender !== "unisex" &&
        p.gender !== currentAnswers.gender
      ) {
        return false;
      }
      return true;
    });

    const recommendationTips: string[] = [];

    if (filtered.length < 3) {
      if (currentAnswers.budget) {
        const potentialByBudget = productsData.filter((p) => {
          const matchOther =
            (!currentAnswers.maxDb ||
              p.maxDb == null ||
              p.maxDb <= currentAnswers.maxDb) &&
            (currentAnswers.appearance !== "high_disguise" ||
              p.appearance === "high_disguise") &&
            (!currentAnswers.gender ||
              p.gender === "unisex" ||
              p.gender === currentAnswers.gender);
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
        const potentialByAppearance = productsData.filter((p) => {
          const matchOther =
            (!currentAnswers.maxDb ||
              p.maxDb == null ||
              p.maxDb <= currentAnswers.maxDb) &&
            (!currentAnswers.budget ||
              (p.price >= currentAnswers.budget[0] &&
                p.price <= currentAnswers.budget[1])) &&
            (!currentAnswers.gender ||
              p.gender === "unisex" ||
              p.gender === currentAnswers.gender);
          return matchOther && p.appearance !== "high_disguise";
        });
        if (potentialByAppearance.length > 0) {
          recommendationTips.push(
            "若能接受常规或科技感造型（不拘泥于高伪装），可选性能范围将显著扩大。",
          );
        }
      }

      if (currentAnswers.maxDb && currentAnswers.maxDb < 60) {
        const potentialByNoise = productsData.filter((p) => {
          const matchOther =
            (currentAnswers.appearance !== "high_disguise" ||
              p.appearance === "high_disguise") &&
            (!currentAnswers.budget ||
              (p.price >= currentAnswers.budget[0] &&
                p.price <= currentAnswers.budget[1])) &&
            (!currentAnswers.gender ||
              p.gender === "unisex" ||
              p.gender === currentAnswers.gender);
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

    const candidates = filtered.length >= 3 ? filtered : productsData;
    const scorePreset = selectScorePreset(currentAnswers, candidates);
    const rankedCandidates = candidates
      .map((product) =>
        scoreStructuredProduct(product, currentAnswers, scorePreset),
      )
      .sort(compareStructuredProducts);
    const rerankPool = rankedCandidates.slice(0, AI_RERANK_POOL_SIZE);

    return {
      filteredCount: filtered.length,
      recommendationTips,
      rankedCandidates,
      rerankPool,
      fallbackTopProducts: rerankPool.slice(0, FINAL_SELECTION_COUNT),
    };
  }

  async function postAppAiProxy<T>(
    path: string,
    prompt: string,
  ): Promise<AppAiProxyResponse<T>>;
  async function postAppAiProxy<T>(
    path: string,
    body: Record<string, unknown>,
    options: { expectEnvelope: false },
  ): Promise<T>;
  async function postAppAiProxy<T>(
    path: string,
    requestBody: string | Record<string, unknown>,
    options?: { expectEnvelope?: boolean },
  ): Promise<AppAiProxyResponse<T> | T> {
    const response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        typeof requestBody === "string" ? { prompt: requestBody } : requestBody,
      ),
    });

    if (!response.ok) {
      let details = `HTTP ${response.status}`;
      try {
        const payload = await response.json();
        details = payload?.details || payload?.error || details;
      } catch {
        // ignore JSON parse failure and keep HTTP status detail
      }
      throw new Error(details);
    }

    const payload = await response.json();
    if (options?.expectEnvelope === false) {
      return payload as T;
    }

    if (
      typeof payload !== "object" ||
      payload == null ||
      !("data" in payload)
    ) {
      throw new Error("Invalid AI proxy response envelope");
    }

    return payload as AppAiProxyResponse<T>;
  }

  /**
   * AI 在结构化候选池中进行最终 Top3 重排，并生成理由。
   */
  async function callAiRerank(
    userAnswers: AnswerState,
    rankedProducts: StructuredRankedProduct[],
  ) {
    const context = {
      userPreferences: userAnswers.tags,
      rankedProducts: rankedProducts.map((p, index) => ({
        rank: index + 1,
        id: p.id,
        name: getProductDisplayName(p),
        brand: p.brand,
        price: p.price,
        gender: p.gender,
        physicalForm: p.physicalForm,
        appearance: p.appearance,
        specs: `${p.material}, ${p.waterproof == null ? "无防水参数" : `IPX${p.waterproof}`}, ${p.maxDb == null ? "无噪音参数" : `<${p.maxDb}dB`}, ${p.motorType}马达`,
        tags: p.tags?.join(", ") || "",
        structuredScore: p.score,
        matchSummary: p.matchSummary.join("、"),
      })),
    };

    const prompt = `
你是一个专业的个人护理设备选品助手。
当前候选池已经由结构化规则筛到较小范围。请你在这些候选商品中，重新挑选最匹配的前 3 名，并给出每个商品的推荐理由。

用户偏好标签: [${context.userPreferences.join(", ")}]

候选商品列表（已按结构化分数从高到低排序，仅可从中选择）:
${JSON.stringify(context.rankedProducts, null, 2)}

请仅返回如下格式的 JSON 数组（不要包含任何 Markdown 格式或多余文字）：
[
  { "id": "产品ID", "reason": "30字以内的推荐理由" },
  ...
]

要求：
1. 只能从候选商品列表中选择，严禁输出列表外的 id。
2. 最多返回 3 个，顺序就是你最终认定的 Top1 到 Top3。
3. 推荐理由必须体现该商品为什么适合当前偏好，避免空泛夸张。
4. 用中文输出，简洁自然，不要重复同一句话。
5. 请综合用户标签、结构化分数、matchSummary、价格、噪音、防水、刺激形式来判断，不要只看单一字段。`;

    console.log("🤖 [AI] 正在通过本地后端代理执行 Top3 重排...");
    const response = await postAppAiProxy<AiReasonResult[]>(
      "/api/ai/rerank",
      prompt,
    );
    if (isDev) {
      console.log(
        `[AI] rerank model: ${response.modelName} (${response.provider})`,
      );
    }
    return response;
  }

  async function callAiResultEnhancement(
    userAnswers: AnswerState,
    finalTopProducts: RankedProduct[],
    backupCandidates: BackupCandidate[],
    filteredCount: number,
  ) {
    const context = {
      userPreferences: userAnswers.tags,
      filteredCount,
      topProducts: finalTopProducts.map((product, index) => ({
        rank: index + 1,
        id: product.id,
        name: getProductDisplayName(product),
        brand: product.brand,
        price: product.price,
        reason: product.reason || "",
      })),
      backupCandidates: backupCandidates.map((product, index) => ({
        rank: index + 1,
        id: product.id,
        name: getProductDisplayName(product),
        brand: product.brand,
        price: product.price,
        backupLabel: product.backupLabel,
        structuredScore: product.score,
        matchSummary: product.matchSummary?.join("、") || "",
        localReason: buildLocalBackupReason(
          product,
          product.backupLabel,
          userAnswers,
        ),
      })),
    };

    const prompt = `
你是一个专业的个人护理设备选品助手。
Top 3 主推荐已经确定，请只补充两个结果区域：
1. 为备选卡片写一句简短说明
2. 为结果页写 3-5 条选购建议

用户偏好标签: [${context.userPreferences.join(", ")}]
候选池数量: ${context.filteredCount}

已确定 Top 3（仅供参考，不需要重排）:
${JSON.stringify(context.topProducts, null, 2)}

备选候选（只能基于这些 id 输出说明）:
${JSON.stringify(context.backupCandidates, null, 2)}

请仅返回如下格式的 JSON 对象（不要包含任何 Markdown 格式或多余文字）：
{
  "backupProducts": [
    { "id": "产品ID", "reason": "20字以内的备选说明" }
  ],
  "shoppingGuidance": ["建议1", "建议2", "建议3"]
}

要求：
1. 不要改动 Top 3 排名，也不要输出列表外的 id。
2. backupProducts 只为备选卡片补一句简短说明，语气自然，不要和 Top 3 推荐理由重复。
3. shoppingGuidance 返回 3-5 条中文建议，尽量具体，帮助用户做最终购买判断。
4. 建议可以参考静音、预算、防水、外观隐蔽、刺激方向、清洁维护等维度。
5. 如果备选数量不足，也只返回实际存在的备选说明。`;

    console.log("🤖 [AI] 正在通过本地后端代理生成备选说明与选购建议...");
    const response = await postAppAiProxy<AiResultEnhancement>(
      "/api/ai/result-enhancement",
      prompt,
    );
    if (isDev) {
      console.log(
        `[AI] result-enhancement model: ${response.modelName} (${response.provider})`,
      );
    }
    return response;
  }

  async function recalibrateCurrentResults() {
    const localResult = buildLocalResultComputation(answers, allProducts);

    if (localResult.rerankPool.length === 0) {
      setResultRecalibrationError("暂无可用于重校准的候选结果。");
      return;
    }

    setIsRecalibratingResults(true);
    setResultRecalibrationError(null);
    const nextAttemptCount = resultRecalibrationAttemptCount + 1;

    try {
      const response = await postAppAiProxy<ResultRecalibrationResponse>(
        "/api/ai/recalibrate-results",
        buildResultRecalibrationPayload({
          answers,
          strategy: "auto",
          rerankPool: localResult.rerankPool,
          rankedCandidates: localResult.rankedCandidates,
          filteredCount: localResult.filteredCount,
          recommendationTips: localResult.recommendationTips,
          recalibrationContext: {
            attemptCount: nextAttemptCount,
            currentResultProvider,
            currentResultModelName,
            previousTopProducts: topProducts.map((product) => ({
              id: product.id,
              reason: String(product.reason || "").trim(),
            })),
            previousShoppingGuidanceCount: shoppingGuidance.length,
          },
        }),
        { expectEnvelope: false },
      );

      setTopProducts(response.topProducts);
      setBackupProducts(response.backupProducts);
      setShoppingGuidance(response.shoppingGuidance);
      setRecommendationTips(response.recommendationTips);
      setResultRecalibrationAttemptCount(nextAttemptCount);
      applyResultSourceState(
        readResultSourceState({
          currentResultProvider: response.provider,
          currentResultModelName: response.modelName,
        }),
      );
    } catch (error) {
      console.warn("⚠️ [AI] 结果重校准失败，保留现有结果", error);
      setResultRecalibrationError(
        error instanceof Error ? error.message : "结果重校准失败，请稍后重试。",
      );
    } finally {
      setIsRecalibratingResults(false);
    }
  }

  function applyLocalResultSet(
    currentAnswers: AnswerState,
    localResult: LocalResultComputation,
  ) {
    const finalTopProducts = finalizeRankedProducts(
      localResult.fallbackTopProducts,
      new Map(),
      currentAnswers,
    );
    const backupCandidates = buildBackupCandidates(
      localResult.rankedCandidates,
      finalTopProducts.map((product) => product.id),
      BACKUP_SELECTION_COUNT,
      currentAnswers,
    );
    const localBackupProducts = finalizeBackupProducts(
      backupCandidates,
      new Map(),
      currentAnswers,
    );

    setTopProducts(finalTopProducts);
    setBackupProducts(localBackupProducts);
    setRecommendationTips(localResult.recommendationTips);
    setShoppingGuidance(
      buildLocalShoppingGuidance({
        answers: currentAnswers,
        filteredCount: localResult.filteredCount,
        backupCandidates: localBackupProducts,
      }),
    );
    setResultRecalibrationAttemptCount(0);
    applyResultSourceState(clearResultSourceState());
  }

  function handleTuneResults(mode: ResultTuningMode) {
    const tunedAnswers = tuneResultAnswers(answers, mode);
    const localResult = buildLocalResultComputation(tunedAnswers, allProducts);

    setAnswers(tunedAnswers);
    setResultRecalibrationError(null);
    setIsRecalibratingResults(false);
    applyLocalResultSet(tunedAnswers, localResult);
  }

  async function handleAuthSubmit(
    mode: AuthPanelMode,
    username: string,
    password: string,
  ) {
    const normalizedUsername = username.trim();
    if (!normalizedUsername || !password.trim()) {
      setAuthStatusMessage("请先填写用户名和密码。");
      return;
    }

    setIsSubmittingAuth(true);
    setAuthStatusMessage(null);

    try {
      if (mode === "signup") {
        await registerUsernamePassword({
          username: normalizedUsername,
          password,
        });
        const loginResult = await signInWithUsernamePassword(
          normalizedUsername,
          password,
        );

        if (loginResult.session) {
          setSupabaseSession(loginResult.session);
        }
        setAuthStatusMessage("注册成功，已自动登录。");
        return;
      }

      const data = await signInWithUsernamePassword(normalizedUsername, password);

      if (data.session) {
        setSupabaseSession(data.session);
      }
      setAuthStatusMessage(
        "登录成功，可以加密保存推荐档案了。",
      );
    } catch (error) {
      setAuthStatusMessage(
        error instanceof Error ? error.message : "登录处理失败，请稍后重试。",
      );
    } finally {
      setIsSubmittingAuth(false);
    }
  }

  async function handleSignOut() {
    setIsSubmittingAuth(true);
    setAuthStatusMessage(null);

    try {
      await signOutOfSupabase();
      setSupabaseSession(null);
      setRecommendationProfiles([]);
      setAuthStatusMessage("已退出登录。");
      setSaveRecommendationProfileMessage("登录后可加密保存到云端");
    } catch (error) {
      setAuthStatusMessage(
        error instanceof Error ? error.message : "退出登录失败，请稍后重试。",
      );
    } finally {
      setIsSubmittingAuth(false);
    }
  }

  async function handleSaveRecommendationProfile() {
    const authToken =
      supabaseSession?.access_token ||
      (await getCurrentSupabaseSession())?.access_token ||
      "";

    if (!authToken) {
      setSaveRecommendationProfileMessage("需要登录后才能加密保存推荐档案。");
      return;
    }

    setIsSavingRecommendationProfile(true);
    setSaveRecommendationProfileMessage(null);

    try {
      await saveRecommendationProfile({
        authToken,
        payload: buildRecommendationProfilePayload({
          answers,
          topProducts,
          backupProducts,
          recommendationTips,
          shoppingGuidance,
        }),
      });
      setSaveRecommendationProfileMessage(
        "已加密保存到我的装备匹配档案，可随时回看。",
      );
      void fetchRecommendationProfiles();
    } catch (error) {
      setSaveRecommendationProfileMessage(
        error instanceof Error ? error.message : "保存推荐档案失败，请稍后重试。",
      );
    } finally {
      setIsSavingRecommendationProfile(false);
    }
  }

  const calculateResults = async (
    currentAnswers: AnswerState = answers,
    activeQs: Question[] = activeQuestions,
    productsData: Product[] = allProducts,
  ) => {
    const localResult = buildLocalResultComputation(currentAnswers, productsData);

    setIsAiMatching(true);
    setResultRecalibrationError(null);
    setBackupProducts([]);
    setRecommendationTips(localResult.recommendationTips);
    setShoppingGuidance([]);

    if (localResult.rerankPool.length === 0) {
      applyResultSourceState(
        clearResultSourceState(),
      );
      setTopProducts([]);
      setBackupProducts([]);
      setShoppingGuidance([]);
      setIsAiMatching(false);
      setTimeout(() => {
        setStep(activeQs.length + 1);
        navigateTo("/results");
      }, 3000);
      return;
    }

    let finalTopProducts: RankedProduct[];
    let latestResultSourceState = clearResultSourceState();

    try {
      const rerankResponse = await callAiRerank(
        currentAnswers,
        localResult.rerankPool,
      );
      const aiResults = rerankResponse.data;

      if (aiResults && Array.isArray(aiResults) && aiResults.length > 0) {
        const reasonMap = new Map<string, string>();
        const poolById = new Map(
          localResult.rerankPool.map((product) => [product.id, product]),
        );
        const orderedProducts: StructuredRankedProduct[] = [];
        const seen = new Set<string>();

        aiResults.forEach((res: AiReasonResult) => {
          if (!res?.id) return;
          const matched = poolById.get(res.id);
          if (!matched || seen.has(res.id)) return;
          seen.add(res.id);
          orderedProducts.push(matched);
          const normalizedReason = String(res.reason || "").trim();
          if (normalizedReason) reasonMap.set(res.id, normalizedReason);
        });

        for (const product of localResult.rerankPool) {
          if (orderedProducts.length >= FINAL_SELECTION_COUNT) break;
          if (seen.has(product.id)) continue;
          seen.add(product.id);
          orderedProducts.push(product);
        }

        finalTopProducts = finalizeRankedProducts(
          orderedProducts.slice(0, FINAL_SELECTION_COUNT),
          reasonMap,
          currentAnswers,
        );
        latestResultSourceState = resolveCurrentResultSourceState({
          currentProvider: rerankResponse.provider,
          currentModelName: rerankResponse.modelName,
        });
      } else {
        throw new Error("Empty AI response");
      }
    } catch (e) {
      finalTopProducts = finalizeRankedProducts(
        localResult.fallbackTopProducts,
        new Map(),
        currentAnswers,
      );
    }

    const backupCandidates = buildBackupCandidates(
      localResult.rankedCandidates,
      finalTopProducts.map((product) => product.id),
      BACKUP_SELECTION_COUNT,
      currentAnswers,
    );
    const localBackupProducts = finalizeBackupProducts(
      backupCandidates,
      new Map(),
      currentAnswers,
    );
    const localShoppingGuidance = buildLocalShoppingGuidance({
      answers: currentAnswers,
      filteredCount: localResult.filteredCount,
      backupCandidates: localBackupProducts,
    });

    setTopProducts(finalTopProducts);

    try {
      if (backupCandidates.length === 0) {
        setBackupProducts([]);
        setShoppingGuidance(localShoppingGuidance);
      } else {
        const enhancement = await callAiResultEnhancement(
          currentAnswers,
          finalTopProducts,
          backupCandidates,
          localResult.filteredCount,
        );
        const backupReasonMap = new Map<string, string>();
        const backupPoolIds = new Set(
          backupCandidates.map((product) => product.id),
        );

        if (Array.isArray(enhancement.data.backupProducts)) {
          enhancement.data.backupProducts.forEach((item) => {
            if (!item?.id || !backupPoolIds.has(item.id)) return;
            const normalizedReason = String(item.reason || "").trim();
            if (normalizedReason) {
              backupReasonMap.set(item.id, normalizedReason);
            }
          });
        }

        const aiShoppingGuidance = Array.isArray(
          enhancement.data.shoppingGuidance,
        )
          ? enhancement.data.shoppingGuidance
              .map((line) => String(line || "").trim())
              .filter(Boolean)
              .slice(0, MAX_SHOPPING_GUIDANCE_COUNT)
          : [];

        setBackupProducts(
          finalizeBackupProducts(backupCandidates, backupReasonMap, currentAnswers),
        );
        setShoppingGuidance(
          aiShoppingGuidance.length > 0
            ? aiShoppingGuidance
            : localShoppingGuidance,
        );
      }
    } catch (enhancementError) {
      console.warn(
        "⚠️ [AI] 结果增强失败，使用本地备选说明与购物建议",
        enhancementError,
      );
      setBackupProducts(localBackupProducts);
      setShoppingGuidance(localShoppingGuidance);
    } finally {
      applyResultSourceState(latestResultSourceState);
      setIsAiMatching(false);
      // 延迟跳转以供展示动画
      setTimeout(() => {
        setStep(activeQs.length + 1);
        navigateTo("/results");
      }, 3000);
    }
  };

  const resetQuiz = () => {
    applyResultSourceState(clearResultSourceState());
    setStep(0);
    setAnswers({ tags: [] });
    setTopProducts([]);
    setBackupProducts([]);
    setRecommendationTips([]);
    setShoppingGuidance([]);
    setResultRecalibrationError(null);
    setIsRecalibratingResults(false);
    navigateTo("/quiz");
  };

  const handleBackHomeFromQuiz = () => {
    const clearedState = createClearedQuizSessionState();
    applyResultSourceState(clearResultSourceState());
    setStep(clearedState.step);
    setAnswers(clearedState.answers);
    setTopProducts(clearedState.topProducts);
    setBackupProducts(clearedState.backupProducts);
    setRecommendationTips(clearedState.recommendationTips);
    setShoppingGuidance(clearedState.shoppingGuidance);
    setResultRecalibrationError(null);
    setIsRecalibratingResults(false);
    navigateTo("/");
  };

  if (isLoading && currentRoute !== "/library") {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-4 sm:p-6 md:p-8">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-cyan-900/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-indigo-900/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 w-full max-w-md">
          <MatchingPage
            pageVariants={pageVariants}
            mode="loading"
            loadingStep={loadingStep}
            isAiMatching={false}
            tags={answers.tags}
          />
        </div>
      </div>
    );
  }

  if (currentRoute === "/library") {
    return (
      <LibraryPage
        allProducts={allProducts}
        filterGender={filterGender}
        filterType={filterType}
        filterSubtype={filterSubtype}
        filterBrand={filterBrand}
        filterOrigin={filterOrigin}
        filterMaterial={filterMaterial}
        filterPriceRange={filterPriceRange}
        filterMaxDb={filterMaxDb}
        isLoading={isLoading}
        error={productsError}
        onReload={() => fetchProducts({ force: true })}
        onFilterGenderChange={(value) =>
          setFilterGender(normalizeLibraryAudienceGender(value))
        }
        onFilterTypeChange={(value) =>
          setFilterType(
            sanitizeLibraryTypeSelection(
              value,
              normalizeLibraryAudienceGender(filterGender),
            ),
          )
        }
        onFilterSubtypeChange={(value) =>
          setFilterSubtype(
            sanitizeLibrarySubtypeSelection(
              value,
              normalizeLibraryAudienceGender(filterGender),
              sanitizeLibraryTypeSelection(
                filterType,
                normalizeLibraryAudienceGender(filterGender),
              ),
            ),
          )
        }
        onFilterBrandChange={setFilterBrand}
        onFilterOriginChange={setFilterOrigin}
        onFilterMaterialChange={setFilterMaterial}
        onFilterPriceRangeChange={setFilterPriceRange}
        onFilterMaxDbChange={setFilterMaxDb}
        onBack={() => navigateTo(getReturnRoute())}
      />
    );
  }

  const isKnowledgeHubRoute =
    currentRoute === "/knowledge" && selectedKnowledgeTopicSlug == null;
  const authPanel = {
    isConfigured: isSupabaseAuthConfigured(),
    userLabel:
      (typeof supabaseSession?.user?.user_metadata?.username === "string"
        ? supabaseSession.user.user_metadata.username
        : "") || (supabaseSession?.user?.email ?? null),
    statusMessage: authStatusMessage,
    isSubmitting: isSubmittingAuth,
    onSubmit: handleAuthSubmit,
    onSignOut: handleSignOut,
  };
  const shellContainerClassName =
    isKnowledgeHubRoute
      ? "max-w-none"
      : currentRoute === "/knowledge" && selectedKnowledgeTopicSlug != null
        ? "max-w-none"
      : currentRoute === "/profiles"
      ? "max-w-5xl"
      : currentRoute === "/results" || currentRoute === "/knowledge"
      ? "max-w-6xl"
      : currentRoute === "/quiz" && step === activeQuestions.length
        ? "max-w-none"
        : "max-w-xl";
  const shellOverflowClassName =
    isKnowledgeHubRoute
      ? "overflow-hidden"
      : currentRoute === "/knowledge" && selectedKnowledgeTopicSlug != null
        ? "overflow-hidden"
      : currentRoute === "/profiles"
      ? "overflow-visible"
      : currentRoute === "/knowledge" ||
        (currentRoute === "/quiz" && step === activeQuestions.length)
      ? "overflow-visible"
      : "overflow-hidden";
  const shellViewportClassName = isKnowledgeHubRoute
    ? "h-dvh min-h-dvh p-0"
    : currentRoute === "/knowledge" && selectedKnowledgeTopicSlug != null
      ? "h-dvh min-h-dvh p-0"
    : currentRoute === "/quiz"
      ? "h-dvh min-h-dvh p-0"
    : "min-h-screen p-4 sm:p-6 md:p-8";

  return (
    <div
      className={`relative flex flex-col items-center justify-center ${shellViewportClassName} ${shellOverflowClassName}`}
    >
      {/* Background ambient elements */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-cyan-900/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-indigo-900/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className={`relative z-10 w-full ${shellContainerClassName}`}>
        <AnimatePresence mode="wait">
          {/* Welcome Screen */}
          {currentRoute === "/" && (
            <HomePage
              pageVariants={pageVariants}
              onStart={() => {
                setStep(0);
                navigateTo("/quiz");
              }}
              onBrowseLibrary={() => {
                navigateTo("/library");
              }}
              onOpenKnowledgeNebula={() => {
                navigateToKnowledgeNebula();
              }}
              onOpenProfiles={navigateToProfiles}
              authPanel={authPanel}
            />
          )}

          {/* Question Cards */}
          {currentRoute === "/quiz" &&
            step >= 0 &&
            step < activeQuestions.length && (
            <QuizPage
              pageVariants={pageVariants}
              step={step}
              activeQuestions={activeQuestions}
              onSelectOption={handleOptionSelect}
              onBackQuestion={handleBackQuestion}
              onBackHome={handleBackHomeFromQuiz}
              onJumpToQuestion={handleJumpToQuizQuestion}
            />
          )}

          {/* Loading State */}
          {currentRoute === "/quiz" && step === activeQuestions.length && (
            <MatchingPage
              pageVariants={pageVariants}
              isAiMatching={isAiMatching}
              tags={answers.tags}
            />
          )}

          {/* Results Screen */}
          {currentRoute === "/results" && (
            <ResultsPage
              pageVariants={pageVariants}
              answers={answers}
              topProducts={topProducts}
              backupProducts={backupProducts}
              shoppingGuidance={shoppingGuidance}
              recommendationTips={recommendationTips}
              isRecalibratingResults={isRecalibratingResults}
              resultRecalibrationError={resultRecalibrationError}
              onRecalibrateResults={recalibrateCurrentResults}
              onTuneResults={handleTuneResults}
              onEditQuizCondition={handleEditQuizCondition}
              onSaveRecommendationProfile={handleSaveRecommendationProfile}
              onOpenRecommendationProfiles={navigateToProfiles}
              onOpenKnowledgeNebula={(path) => {
                navigateToKnowledgeNebula(
                  parseKnowledgeNebulaPath(path || buildKnowledgeNebulaPath()).topicSlug,
                  parseKnowledgeNebulaPath(path || buildKnowledgeNebulaPath()).sectionId,
                );
              }}
              isSavingRecommendationProfile={isSavingRecommendationProfile}
              saveRecommendationProfileMessage={saveRecommendationProfileMessage}
              authPanel={authPanel}
              onReset={resetQuiz}
            />
          )}

          {currentRoute === "/profiles" && (
            <ProfilesPage
              profiles={recommendationProfiles}
              isLoading={isLoadingRecommendationProfiles}
              error={recommendationProfilesError}
              userLabel={authPanel.userLabel}
              onBack={() => navigateTo(resolveProfilesReturnRoute(profilesOriginRoute))}
              onReload={() => void fetchRecommendationProfiles()}
            />
          )}

          {currentRoute === "/knowledge" && (
            <KnowledgeNebulaPage
              pageVariants={pageVariants}
              topicSlug={selectedKnowledgeTopicSlug}
              sectionId={selectedKnowledgeSectionId}
              onBack={() => {
                if (selectedKnowledgeTopicSlug) {
                  navigateToKnowledgeNebula(undefined, undefined, true);
                  return;
                }
                navigateTo(knowledgeOriginRoute ?? "/");
              }}
              onSelectTopic={(topicSlug) => {
                navigateToKnowledgeNebula(topicSlug, undefined);
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
