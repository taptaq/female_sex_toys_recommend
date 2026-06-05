/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  femaleMvpQuestionFlow,
  AnswerState,
  Product,
  Question,
} from "./data/mock.ts";
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
import {
  applyResultTuningModes,
  type ResultTuningMode,
} from "./lib/result-tuning";
import {
  buildRecommendationProfilePayload,
  listRecommendationProfiles,
  type SavedRecommendationProfile,
  saveRecommendationProfile,
} from "./lib/user-recommendation-profile";
import {
  addFavorite,
  listFavorites,
  removeFavorite,
} from "./lib/user-favorites";
import {
  BODY_PERSONA_QUESTIONS,
  resolveBodyPersonaResult,
  type BodyPersonaAnswers,
  type BodyPersonaResult,
} from "./lib/body-persona";
import {
  buildBodyPersonaFullReport,
  type BodyPersonaFullReport,
} from "./lib/body-persona-report";
import {
  confirmBodyPersonaUnlock,
  createBodyPersonaOrder,
  createBodyPersonaSession,
} from "./lib/body-persona-api";
import { getProductDisplayName } from "./lib/product-display-name.ts";
import {
  sanitizeLibrarySubtypeSelection,
  sanitizeLibraryTypeSelection,
  type LibraryAudienceGender,
} from "./lib/library-product-types.ts";
import { type StructuredRankedProduct } from "./lib/recommendation-local-ranking.ts";
import {
  BACKUP_SELECTION_COUNT,
  FINAL_SELECTION_COUNT,
  MAX_SHOPPING_GUIDANCE_COUNT,
  buildLocalResultComputation,
  finalizeBackupProducts,
  finalizeRankedProducts,
  serializeRecommendationTopProducts,
  type LocalResultComputation,
} from "./lib/app-result-flow.ts";
import {
  DEFAULT_MVP_ANSWERS,
  shouldUseFemaleMvp,
} from "./lib/app-mode.ts";
import {
  getCurrentSupabaseSession,
  isSupabaseAuthConfigured,
  onSupabaseAuthStateChange,
  registerUsernamePassword,
  signInWithUsernamePassword,
  signOutOfSupabase,
} from "./lib/supabase-auth";
import type { AuthPanelMode } from "./components/AuthPanel";
import { AuthPanel } from "./components/AuthPanel";
import {
  ThemeCosmosLayer,
  type ThemeCosmosVariant,
} from "./components/ThemeCosmosLayer";
import {
  buildProductDisguiseSignalsSummary,
} from "./lib/product-disguise-signals";
import { buildRecommendationPreferenceSignals } from "./lib/recommendation-preference-signals";
import { submitRecommendationFeedbackEvent } from "./lib/recommendation-feedback";
import type { RecommendationRerollReason } from "./lib/recommendation-reroll";
import {
  appendQuizAnswerPathEntry,
  createRecommendationSessionId,
  submitRecommendationSession,
  trimQuizAnswerPathFromStep,
  type QuizAnswerPathEntry,
} from "./lib/recommendation-session";
import { MatchingPage } from "./pages/MatchingPage";
import { MatchModePage } from "./pages/MatchModePage";
import type { MatchModeEntrance } from "./pages/MatchModePage";
import { NaturalLanguageMatchPage } from "./pages/NaturalLanguageMatchPage";
import {
  DEFAULT_LIBRARY_FILTER_MAX_DB,
  LibraryPage,
} from "./pages/LibraryPage";
import { HomeAuthOverlay } from "./pages/HomePage";
import { deriveAnswersFromNaturalLanguage } from "./lib/natural-language-matching";
import {
  buildKnowledgeNebulaPath,
  parseKnowledgeNebulaPath,
  resolveKnowledgeBackNavigation,
} from "./lib/knowledge-nebula-route";
import {
  buildShellRouteState,
  isInvalidKnowledgeDetailPath,
  pushAppRoute,
  pushKnowledgeRoute,
  pushProfilesRoute,
  readAppLocationSnapshot,
  type AppHistoryState,
  type ShellRouteState,
} from "./lib/app-route-state";
import { AppRouteRenderer } from "./components/AppRouteRenderer";
import {
  applyAppTheme,
  readStoredAppTheme,
  writeStoredAppTheme,
  type AppThemeId,
} from "./lib/app-theme";
import type { KnowledgeNebulaTopicSlug } from "./data/knowledge-nebula";

type AiReasonResult = {
  id: string;
  reason: string;
};

type BackupProduct = BackupCandidate;

type AiResultEnhancement = {
  backupProducts?: AiReasonResult[];
  shoppingGuidance?: string[];
};

const ROUTE_SHELL_EXIT_STABILIZE_MS = 480;
const DEBUG_FORCE_MATCHING_LOADING_PAGE = false;

type AppAiProxyResponse<T> = {
  data: T;
  modelName: string;
  provider: AppAiProvider;
};

type PersistedAppState = {
  step?: number;
  answers?: AnswerState;
  answerPath?: QuizAnswerPathEntry[];
  recommendationSessionId?: string;
  resultBaseAnswers?: AnswerState;
  appliedResultTuningModes?: ResultTuningMode[];
  topProducts?: RankedProduct[];
  backupProducts?: BackupProduct[];
  recommendationTips?: string[];
  shoppingGuidance?: string[];
  bodyPersonaState?: {
    sessionId: string;
    status: "idle" | "completed_free" | "unlocking" | "unlocked";
    freeSummary: BodyPersonaResult["freeSummary"] | null;
    fullReport: BodyPersonaFullReport | null;
  } | null;
  bodyPersonaDraftAnswers?: BodyPersonaAnswers;
  filterGender?: string;
  filterType?: string;
  filterSubtype?: string;
  filterBrand?: string;
  filterOrigin?: string;
  showFavoritesOnly?: boolean;
  filterMaxDb?: number;
  filterMaterial?: string;
  filterPriceRange?: string;
  currentResultProvider?: AppAiProvider;
  currentResultModelName?: string;
  matchInputMode?: "quiz" | "natural-language";
  naturalLanguageQuery?: string;
};

type QuizReturnToResultsState = {
  step: number;
  answers: AnswerState;
  answerPath: QuizAnswerPathEntry[];
  resultBaseAnswers: AnswerState | null;
  appliedResultTuningModes: ResultTuningMode[];
  topProducts: RankedProduct[];
  backupProducts: BackupProduct[];
  recommendationTips: string[];
  shoppingGuidance: string[];
  bodyPersonaState: {
    sessionId: string;
    status: "idle" | "completed_free" | "unlocking" | "unlocked";
    freeSummary: BodyPersonaResult["freeSummary"] | null;
    fullReport: BodyPersonaFullReport | null;
  } | null;
  bodyPersonaDraftAnswers: BodyPersonaAnswers;
  currentResultProvider?: AppAiProvider;
  currentResultModelName?: string;
  matchInputMode?: "quiz" | "natural-language";
  naturalLanguageQuery?: string;
};

function DataLoadingPage({ loadingStep }: { loadingStep: number }) {
  const statusText =
    loadingStep === -1
      ? "装备库连接暂时不稳定"
      : loadingStep >= 2
        ? "正在整理候选装备..."
        : "正在准备装备库...";

  return (
    <div className="female-mvp-data-loading relative left-1/2 flex min-h-[100svh] w-screen -translate-x-1/2 items-center justify-center overflow-hidden px-6">
      <div className="female-mvp-data-loading__panel relative z-10 w-full max-w-[20rem] text-center">
        <span className="female-mvp-data-loading__badge">LUNA 数据准备中</span>
        <h2 className="mt-5 text-xl font-black tracking-normal text-slate-900">
          {statusText}
        </h2>
        <p className="mt-3 text-xs font-semibold leading-6 text-slate-500">
          我们先把装备库准备好，稍后再进入 Luna 校准匹配。
        </p>
        <div className="female-mvp-data-loading__bar mt-6" aria-hidden="true">
          <span />
        </div>
      </div>
    </div>
  );
}

function normalizeLibraryAudienceGender(value: string): LibraryAudienceGender {
  if (value === "female" || value === "male" || value === "unisex") {
    return value;
  }

  return "all";
}

function withFemaleMvpDefaults(answers: AnswerState): AnswerState {
  if (!shouldUseFemaleMvp()) {
    return answers;
  }

  return {
    ...DEFAULT_MVP_ANSWERS,
    ...answers,
    gender: DEFAULT_MVP_ANSWERS.gender,
    tags: Array.from(
      new Set([...(answers.tags ?? []), ...DEFAULT_MVP_ANSWERS.tags]),
    ),
  };
}

export default function App() {
  const initialPathname = window.location.pathname;
  const initialLocationSnapshot = readAppLocationSnapshot(
    initialPathname,
    window.history.state as AppHistoryState | null,
  );
  const persistedState = readSessionJsonStorage<PersistedAppState>(
    APP_STATE_STORAGE_KEY,
    {},
  );
  const persistedResultSourceState = readResultSourceState(persistedState);
  const cachedProducts = readProductsCache();
  const isFemaleMvp = shouldUseFemaleMvp();

  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() =>
    initialLocationSnapshot.route,
  );
  const [selectedKnowledgeTopicSlug, setSelectedKnowledgeTopicSlug] = useState<
    KnowledgeNebulaTopicSlug | undefined
  >(initialLocationSnapshot.knowledgeTopicSlug);
  const [selectedKnowledgeSectionId, setSelectedKnowledgeSectionId] = useState<
    string | undefined
  >(initialLocationSnapshot.knowledgeSectionId);
  const [knowledgeOriginRoute, setKnowledgeOriginRoute] = useState<
    AppRoute | undefined
  >(initialLocationSnapshot.knowledgeOriginRoute);
  const [shellRouteState, setShellRouteState] = useState<ShellRouteState>(() =>
    buildShellRouteState(
      initialLocationSnapshot.route,
      initialLocationSnapshot.knowledgeTopicSlug,
    ),
  );
  const shellRouteStateRef = useRef(shellRouteState);
  const shellRouteStabilizeTimeoutRef = useRef<number | null>(null);
  const [profilesOriginRoute, setProfilesOriginRoute] = useState<
    AppRoute | undefined
  >(initialLocationSnapshot.profilesOriginRoute);
  const [step, setStep] = useState<number>(persistedState.step ?? -1);
  const [answers, setAnswers] = useState<AnswerState>(() =>
    isFemaleMvp
      ? withFemaleMvpDefaults(persistedState.answers ?? DEFAULT_MVP_ANSWERS)
      : persistedState.answers ?? { tags: [] },
  );
  const [answerPath, setAnswerPath] = useState<QuizAnswerPathEntry[]>(
    persistedState.answerPath ?? [],
  );
  const [recommendationSessionId, setRecommendationSessionId] =
    useState<string>(
      persistedState.recommendationSessionId ??
        createRecommendationSessionId(),
    );
  const [resultBaseAnswers, setResultBaseAnswers] = useState<AnswerState | null>(
    persistedState.resultBaseAnswers ?? null,
  );
  const [appliedResultTuningModes, setAppliedResultTuningModes] = useState<
    ResultTuningMode[]
  >(persistedState.appliedResultTuningModes ?? []);
  const [allProducts, setAllProducts] = useState<Product[]>(cachedProducts);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(cachedProducts.length > 0);
  const [productsError, setProductsError] = useState<string | null>(null);
  const productsFetchRef = useRef<Promise<Product[]> | null>(null);
  const hasAutoRefreshedLibraryProductsRef = useRef(false);
  const resultEnhancementRunRef = useRef(0);

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
  const [showFavoritesOnly, setShowFavoritesOnly] = useState<boolean>(
    persistedState.showFavoritesOnly ?? false,
  );
  const [filterMaxDb, setFilterMaxDb] = useState<number>(
    persistedState.filterMaxDb ?? DEFAULT_LIBRARY_FILTER_MAX_DB,
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
  const [bodyPersonaState, setBodyPersonaState] = useState<{
    sessionId: string;
    status: "idle" | "completed_free" | "unlocking" | "unlocked";
    freeSummary: BodyPersonaResult["freeSummary"] | null;
    fullReport: BodyPersonaFullReport | null;
  } | null>(persistedState.bodyPersonaState ?? null);
  const [bodyPersonaDraftAnswers, setBodyPersonaDraftAnswers] =
    useState<BodyPersonaAnswers>(
      persistedState.bodyPersonaDraftAnswers ?? {},
    );
  const [isBodyPersonaQuizOpen, setIsBodyPersonaQuizOpen] = useState(false);
  const [isSubmittingBodyPersonaQuiz, setIsSubmittingBodyPersonaQuiz] =
    useState(false);
  const [isUnlockingBodyPersona, setIsUnlockingBodyPersona] = useState(false);
  const [isBodyPersonaFullReportOpen, setIsBodyPersonaFullReportOpen] =
    useState(false);
  const [
    shouldContinueBodyPersonaUnlockAfterAuth,
    setShouldContinueBodyPersonaUnlockAfterAuth,
  ] = useState(false);
  const [currentResultProvider, setCurrentResultProvider] = useState<
    AppAiProvider | undefined
  >(persistedResultSourceState.currentResultProvider);
  const [currentResultModelName, setCurrentResultModelName] = useState<
    string | undefined
  >(persistedResultSourceState.currentResultModelName);
  const [matchInputMode, setMatchInputMode] = useState<
    "quiz" | "natural-language"
  >(persistedState.matchInputMode ?? "quiz");
  const [naturalLanguageQuery, setNaturalLanguageQuery] = useState(
    persistedState.naturalLanguageQuery ?? "",
  );
  const [quizReturnToResultsState, setQuizReturnToResultsState] =
    useState<QuizReturnToResultsState | null>(null);
  const [isRecalibratingResults, setIsRecalibratingResults] = useState(false);
  const [isEnhancingResults, setIsEnhancingResults] = useState(false);
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
  const [favoriteProductIds, setFavoriteProductIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [favoriteActionError, setFavoriteActionError] = useState<string | null>(null);
  const [isFavoriteAuthOpen, setIsFavoriteAuthOpen] = useState(false);
  const [isFavoritesModalOpen, setIsFavoritesModalOpen] = useState(false);
  const [naturalLanguagePrompt, setNaturalLanguagePrompt] = useState("");
  const [naturalLanguageError, setNaturalLanguageError] = useState<string | null>(null);
  const [recommendationProfiles, setRecommendationProfiles] = useState<
    SavedRecommendationProfile[]
  >([]);
  const [isLoadingRecommendationProfiles, setIsLoadingRecommendationProfiles] =
    useState(false);
  const [recommendationProfilesError, setRecommendationProfilesError] =
    useState<string | null>(null);
  const [themeId, setThemeId] = useState<AppThemeId>(() => readStoredAppTheme());
  const themeSwitchRunRef = useRef(0);
  const themeSwitchStabilizeTimeoutRef = useRef<number | null>(null);
  const [shouldPlayQuizLanding, setShouldPlayQuizLanding] = useState(false);
  const [matchModeEntrance, setMatchModeEntrance] =
    useState<MatchModeEntrance>("home");

  const activeQuestions: Question[] = femaleMvpQuestionFlow;

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

  useEffect(() => {
    shellRouteStateRef.current = shellRouteState;
  }, [shellRouteState]);

  useEffect(() => {
    if (shellRouteStabilizeTimeoutRef.current !== null) {
      window.clearTimeout(shellRouteStabilizeTimeoutRef.current);
      shellRouteStabilizeTimeoutRef.current = null;
    }

    const nextShellRouteState = buildShellRouteState(
      currentRoute,
      selectedKnowledgeTopicSlug,
    );
    const isReturningFromKnowledgeToHome =
      shellRouteStateRef.current.route === "/knowledge" && currentRoute === "/";

    if (!isReturningFromKnowledgeToHome) {
      setShellRouteState(nextShellRouteState);
      return undefined;
    }

    shellRouteStabilizeTimeoutRef.current = window.setTimeout(() => {
      setShellRouteState(nextShellRouteState);
      shellRouteStabilizeTimeoutRef.current = null;
    }, ROUTE_SHELL_EXIT_STABILIZE_MS);

    return () => {
      if (shellRouteStabilizeTimeoutRef.current !== null) {
        window.clearTimeout(shellRouteStabilizeTimeoutRef.current);
        shellRouteStabilizeTimeoutRef.current = null;
      }
    };
  }, [currentRoute, selectedKnowledgeTopicSlug]);

  const navigateTo = (route: AppRoute, replace = false) => {
    pushAppRoute(route, replace);
    setCurrentRoute(route);
    if (route !== "/quiz") {
      setShouldPlayQuizLanding(false);
    }
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
    const nextKnowledgeOriginRoute = pushKnowledgeRoute({
      topicSlug,
      sectionId,
      replace,
      currentRoute,
      knowledgeOriginRoute,
    });
    setCurrentRoute("/knowledge");
    setSelectedKnowledgeTopicSlug(topicSlug);
    setSelectedKnowledgeSectionId(sectionId);
    setKnowledgeOriginRoute(nextKnowledgeOriginRoute);
  };

  const navigateToProfiles = () => {
    const nextProfilesOriginRoute = pushProfilesRoute({
      currentRoute,
      profilesOriginRoute,
    });
    setCurrentRoute("/profiles");
    setSelectedKnowledgeTopicSlug(undefined);
    setKnowledgeOriginRoute(undefined);
    setProfilesOriginRoute(nextProfilesOriginRoute);
  };

  const getReturnRoute = (): AppRoute => {
    if (topProducts.length > 0 || step === activeQuestions.length + 1) {
      return "/results";
    }
    if (step >= 0) return "/quiz";
    return "/";
  };

  const handleBrowseLibraryFromResults = (product?: RankedProduct) => {
    const nextFilterGender = normalizeLibraryAudienceGender(
      product?.gender ?? answers.gender ?? "all",
    );
    const nextFilterType = sanitizeLibraryTypeSelection(
      String(product?.typeCode ?? "all"),
      nextFilterGender,
    );

    setFilterGender(nextFilterGender);
    setFilterType(nextFilterType);
    setFilterSubtype("all");
    setFilterBrand("all");
    setFilterOrigin("all");
    setFilterMaterial("all");
    setFilterPriceRange("all");
    setFilterMaxDb(DEFAULT_LIBRARY_FILTER_MAX_DB);
    navigateTo("/library");
  };

  const clearResultTuningTracking = () => {
    setResultBaseAnswers(null);
    setAppliedResultTuningModes([]);
  };

  const clearQuizReturnToResultsState = () => {
    setQuizReturnToResultsState(null);
  };

  const resetResultViewState = () => {
    resultEnhancementRunRef.current += 1;
    setTopProducts([]);
    setBackupProducts([]);
    setRecommendationTips([]);
    setShoppingGuidance([]);
    setResultRecalibrationError(null);
    setIsRecalibratingResults(false);
    setIsEnhancingResults(false);
    setResultRecalibrationAttemptCount(0);
    applyResultSourceState(clearResultSourceState());
  };

  const clearBodyPersonaFlow = () => {
    setBodyPersonaState(null);
    setBodyPersonaDraftAnswers({});
    setIsBodyPersonaQuizOpen(false);
    setIsSubmittingBodyPersonaQuiz(false);
    setIsUnlockingBodyPersona(false);
    setIsBodyPersonaFullReportOpen(false);
    setShouldContinueBodyPersonaUnlockAfterAuth(false);
  };

  const startFreshQuizSession = () => {
    clearQuizReturnToResultsState();
    clearResultTuningTracking();
    resetResultViewState();
    clearBodyPersonaFlow();
    setRecommendationSessionId(createRecommendationSessionId());
    setAnswerPath([]);
    setAnswers(isFemaleMvp ? withFemaleMvpDefaults({ tags: [] }) : { tags: [] });
    setStep(0);
    setMatchInputMode("quiz");
    setNaturalLanguagePrompt("");
    setNaturalLanguageQuery("");
    setNaturalLanguageError(null);
    setMatchModeEntrance("home");
    navigateTo("/match-mode");
  };

  const handleStartQuizMode = () => {
    setMatchInputMode("quiz");
    setNaturalLanguagePrompt("");
    setNaturalLanguageQuery("");
    setNaturalLanguageError(null);
    setStep(0);
    setShouldPlayQuizLanding(true);
    navigateTo("/quiz");
  };

  const handleStartNaturalLanguageMode = () => {
    setMatchInputMode("natural-language");
    setNaturalLanguageError(null);
    navigateTo("/match-text");
  };

  const handleStartLuckyMode = () => {
    const luckyAnswers = withFemaleMvpDefaults({
      tags: ["幸运抽取", "轻松探索", "女性向"],
      budget: [100, 500],
      maxDb: 45,
      appearance: "high_disguise",
      experienceLevel: "balanced",
    });
    const targetQuestions = femaleMvpQuestionFlow;

    setMatchInputMode("quiz");
    setNaturalLanguagePrompt("");
    setNaturalLanguageQuery("");
    setNaturalLanguageError(null);
    setAnswers(luckyAnswers);
    setAnswerPath([]);
    setStep(targetQuestions.length);
    setIsAiMatching(false);

    if (!hasFetched) {
      fetchProducts().then((data) =>
        calculateResults(luckyAnswers, targetQuestions, data, []),
      );
    } else {
      calculateResults(luckyAnswers, targetQuestions, allProducts, []);
    }

    navigateTo("/quiz");
  };

  const handleSubmitNaturalLanguageMatch = async () => {
    const trimmedPrompt = naturalLanguagePrompt.trim();
    if (trimmedPrompt.length < 10) {
      setNaturalLanguageError("请再多描述一点，比如感觉、场景、预算或静音要求。");
      return;
    }

    const { answers: derivedAnswers } = deriveAnswersFromNaturalLanguage(trimmedPrompt);
    const mergedAnswers: AnswerState = withFemaleMvpDefaults({
      ...derivedAnswers,
      tags: derivedAnswers.tags ?? [],
    });
    const targetQuestions = femaleMvpQuestionFlow;

    setMatchInputMode("natural-language");
    setNaturalLanguageQuery(trimmedPrompt);
    setNaturalLanguageError(null);
    setAnswers(mergedAnswers);
    setAnswerPath([]);
    setStep(targetQuestions.length);
    setIsAiMatching(false);
    navigateTo("/quiz");

    const data =
      allProducts.length > 0 ? allProducts : await fetchProducts({ preferCachedResult: true });
    void calculateResults(
      mergedAnswers,
      targetQuestions,
      data,
      [],
      trimmedPrompt,
    );
  };

  const clearThemeSwitchStabilizeTimeout = () => {
    if (themeSwitchStabilizeTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(themeSwitchStabilizeTimeoutRef.current);
    themeSwitchStabilizeTimeoutRef.current = null;
  };

  const releaseThemeSwitchStabilization = (runId: number) => {
    clearThemeSwitchStabilizeTimeout();
    themeSwitchStabilizeTimeoutRef.current = window.setTimeout(() => {
      if (themeSwitchRunRef.current === runId) {
        document.documentElement.classList.remove("theme-switch-stabilizing");
      }
      themeSwitchStabilizeTimeoutRef.current = null;
    }, 1040);
  };

  const handleThemeChange = (nextThemeId: AppThemeId) => {
    if (nextThemeId === themeId) {
      return;
    }

    const runId = themeSwitchRunRef.current + 1;
    themeSwitchRunRef.current = runId;
    clearThemeSwitchStabilizeTimeout();
    document.documentElement.classList.add("theme-switch-stabilizing");

    applyAppTheme(nextThemeId);
    setThemeId(nextThemeId);
    releaseThemeSwitchStabilization(runId);
  };

  useEffect(() => {
    if (currentRoute === "/knowledge" && isInvalidKnowledgeDetailPath(window.location.pathname)) {
      navigateToKnowledgeNebula(undefined, undefined, true);
    }
  }, [currentRoute]);

  useEffect(() => {
    applyAppTheme(themeId);
    writeStoredAppTheme(themeId);
  }, [themeId]);

  useEffect(() => {
    return () => {
      if (shellRouteStabilizeTimeoutRef.current !== null) {
        window.clearTimeout(shellRouteStabilizeTimeoutRef.current);
        shellRouteStabilizeTimeoutRef.current = null;
      }
      clearThemeSwitchStabilizeTimeout();
      document.documentElement.classList.remove("theme-switch-stabilizing");
    };
  }, []);

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
      setRecommendationProfilesError("需要登录后才能查看匹配档案。");
      return;
    }

    setIsLoadingRecommendationProfiles(true);
    setRecommendationProfilesError(null);

    try {
      const result = await listRecommendationProfiles({ authToken });
      setRecommendationProfiles(result.profiles);
    } catch (error) {
      setRecommendationProfilesError(
        error instanceof Error ? error.message : "读取匹配档案失败，请稍后重试。",
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
    const authToken = supabaseSession?.access_token || "";
    if (!authToken) {
      setFavoriteProductIds(new Set());
      return;
    }

    void listFavorites({ authToken })
      .then((result) => {
        setFavoriteProductIds(new Set(result.productIds));
      })
      .catch((error) => {
        setFavoriteActionError(
          error instanceof Error ? error.message : "读取收藏失败，请稍后重试。",
        );
      });
  }, [supabaseSession?.access_token]);

  useEffect(() => {
    if (!supabaseSession?.user?.id || !shouldContinueBodyPersonaUnlockAfterAuth) {
      return;
    }

    setShouldContinueBodyPersonaUnlockAfterAuth(false);
    void handleUnlockBodyPersona();
  }, [supabaseSession?.user?.id, shouldContinueBodyPersonaUnlockAfterAuth]);

  useEffect(() => {
    const handlePopState = () => {
      const nextPathname = window.location.pathname;
      const nextRoute = detectRoute(nextPathname);
      if (nextRoute === "/knowledge" && isInvalidKnowledgeDetailPath(nextPathname)) {
        window.history.replaceState(
          window.history.state,
          "",
          buildKnowledgeNebulaPath(),
        );
      }
      const snapshot = readAppLocationSnapshot(
        window.location.pathname,
        window.history.state as AppHistoryState | null,
      );
      setCurrentRoute(snapshot.route);
      setSelectedKnowledgeTopicSlug(snapshot.knowledgeTopicSlug);
      setSelectedKnowledgeSectionId(snapshot.knowledgeSectionId);
      setKnowledgeOriginRoute(snapshot.knowledgeOriginRoute);
      setProfilesOriginRoute(snapshot.profilesOriginRoute);
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

    if (
      isLoading ||
      hasAutoRefreshedLibraryProductsRef.current ||
      hasFetched ||
      allProducts.length > 0
    ) {
      return;
    }

    hasAutoRefreshedLibraryProductsRef.current = true;
    void fetchProducts({
      preferCachedResult: true,
    });
  }, [currentRoute, isLoading, allProducts.length, hasFetched]);

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
    if (filterBrand === "all") {
      return;
    }

    const brandStillAllowed = allProducts.some((product) => {
      if (product.brand !== filterBrand) return false;
      if (filterOrigin === "all") return true;
      if (filterOrigin === "domestic") return product.isDomestic === true;
      return product.isDomestic === false;
    });

    if (!brandStillAllowed) {
      setFilterBrand("all");
    }
  }, [allProducts, filterBrand, filterOrigin]);

  useEffect(() => {
    writeSessionJsonStorage(
      APP_STATE_STORAGE_KEY,
      {
        step,
        answers,
        answerPath,
        recommendationSessionId,
        resultBaseAnswers,
        appliedResultTuningModes,
        topProducts,
        backupProducts,
        recommendationTips,
        shoppingGuidance,
        bodyPersonaState,
        bodyPersonaDraftAnswers,
        filterGender,
        filterType,
        filterSubtype,
        filterBrand,
        filterOrigin,
        showFavoritesOnly,
        filterMaxDb,
        filterMaterial,
        filterPriceRange,
        currentResultProvider,
        currentResultModelName,
        matchInputMode,
        naturalLanguageQuery,
      },
    );
  }, [
    step,
    answers,
    answerPath,
    recommendationSessionId,
    resultBaseAnswers,
    appliedResultTuningModes,
    topProducts,
    backupProducts,
    recommendationTips,
    shoppingGuidance,
    bodyPersonaState,
    bodyPersonaDraftAnswers,
    filterGender,
    filterType,
    filterSubtype,
    filterBrand,
    filterOrigin,
    showFavoritesOnly,
    filterMaxDb,
    filterMaterial,
    filterPriceRange,
    currentResultProvider,
    currentResultModelName,
    matchInputMode,
    naturalLanguageQuery,
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
      const requestUrl = force
        ? "/api/recommender/toys?refresh=1"
        : "/api/recommender/toys";

      fetch(requestUrl)
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
          setLoadingStep(3); // 载入晶体
          setAllProducts(data);
          setIsLoading(false);
          setHasFetched(true);
          setProductsError(null);
          resolve(data);
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
    optionLabel = tag,
  ) => {
    const currentQuestion = activeQuestions[step];
    const nextAnswerPath = currentQuestion
      ? appendQuizAnswerPathEntry(answerPath, {
          step,
          question: currentQuestion,
          optionLabel,
          optionValue: value,
          tag,
          answerPatch,
        })
      : answerPath;
    const newAnswers = withFemaleMvpDefaults({
      ...answers,
      ...(answerPatch ?? {}),
      ...(value === undefined ? {} : { [field]: value }),
      tags: [...answers.tags, tag],
    });
    setAnswerPath(nextAnswerPath);
    setAnswers(newAnswers);

    const activeQs = femaleMvpQuestionFlow;

    if (step < activeQs.length - 1) {
      setStep(step + 1);
    } else {
      setStep(activeQs.length); // Loading state
      if (!hasFetched) {
        fetchProducts().then((data) =>
          calculateResults(newAnswers, activeQs, data, nextAnswerPath),
        );
      } else {
        calculateResults(newAnswers, activeQs, allProducts, nextAnswerPath);
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
    setAnswerPath((currentPath) => currentPath.slice(0, -1));
    setStep(step - 1);
  };

  const handleBackToResultsFromQuiz = () => {
    if (!quizReturnToResultsState) {
      return;
    }

    resultEnhancementRunRef.current += 1;
    setIsEnhancingResults(false);
    setStep(quizReturnToResultsState.step);
    setAnswers(quizReturnToResultsState.answers);
    setAnswerPath(quizReturnToResultsState.answerPath);
    setResultBaseAnswers(quizReturnToResultsState.resultBaseAnswers);
    setAppliedResultTuningModes(
      quizReturnToResultsState.appliedResultTuningModes,
    );
    setTopProducts(quizReturnToResultsState.topProducts);
    setBackupProducts(quizReturnToResultsState.backupProducts);
    setRecommendationTips(quizReturnToResultsState.recommendationTips);
    setShoppingGuidance(quizReturnToResultsState.shoppingGuidance);
    setBodyPersonaState(quizReturnToResultsState.bodyPersonaState);
    setBodyPersonaDraftAnswers(quizReturnToResultsState.bodyPersonaDraftAnswers);
    setResultRecalibrationError(null);
    setIsRecalibratingResults(false);
    setIsBodyPersonaQuizOpen(false);
    setIsSubmittingBodyPersonaQuiz(false);
    setIsUnlockingBodyPersona(false);
    setIsBodyPersonaFullReportOpen(false);
    setShouldContinueBodyPersonaUnlockAfterAuth(false);
    applyResultSourceState({
      currentResultProvider: quizReturnToResultsState.currentResultProvider,
      currentResultModelName: quizReturnToResultsState.currentResultModelName,
    });
    clearQuizReturnToResultsState();
    navigateTo("/results");
  };

  const handleJumpToQuizQuestion = (questionIndex: number) => {
    if (questionIndex < 0 || questionIndex >= step) return;

    const editableAnswers = resultBaseAnswers ?? answers;

    clearResultTuningTracking();
    clearBodyPersonaFlow();
    setAnswerPath((currentPath) =>
      trimQuizAnswerPathFromStep(currentPath, questionIndex),
    );
    setAnswers(
      removeQuizAnswersFromQuestionIndex(
        editableAnswers,
        activeQuestions.slice(questionIndex),
        0,
      ),
    );
    resetResultViewState();
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
      preferenceSignals: buildRecommendationPreferenceSignals(userAnswers).map(
        (signal) => signal.label,
      ),
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
        disguiseSignals: buildProductDisguiseSignalsSummary(p),
      })),
    };

    const prompt = `
你是一个专业的个人护理设备选品助手。
当前候选池已经由结构化规则筛到较小范围。请你在这些候选商品中，重新挑选最匹配的前 3 名，并给出每个商品的推荐理由。

用户偏好标签: [${context.userPreferences.join(", ")}]
本次匹配方式: ${matchInputMode === "natural-language" ? "自然语言匹配" : "答题匹配"}
${matchInputMode === "natural-language" && naturalLanguageQuery ? `用户原始描述: ${naturalLanguageQuery}` : ""}
用户结构化偏好信号: ${JSON.stringify({ preferenceSignals: context.preferenceSignals })}

候选商品列表（已按结构化分数从高到低排序，仅可从中选择）:
${JSON.stringify(context.rankedProducts)}

请仅返回如下格式的 JSON 数组（不要包含任何 Markdown 格式或多余文字）：
[
  { "id": "产品ID", "reason": "30字以内的推荐理由" },
  ...
]

要求：
1. 只能从候选商品列表中选择，严禁输出列表外的 id。
2. 最多返回 3 个，顺序就是你最终认定的 Top1 到 Top3。
3. 推荐理由只抓一个最关键的适配取舍，避免把噪音、防水、价格、刺激形式全部罗列一遍。
4. 不要罗列参数，不要复述多个参数；如果必须提参数，只保留一个最能帮助决策的点。
5. 用中文输出，像 Luna 给用户的一句轻建议，简洁自然，不要重复同一句话。
6. 请综合用户标签、preferenceSignals、结构化分数、matchSummary、disguiseSignals、价格、噪音、防水、刺激形式来判断，不要只看单一字段。
7. 高伪装偏好下，优先考虑明确非传统设备外观、日用品/装饰物造型、口红/玫瑰/香水/挂件等伪装信号；不要仅凭抽象“高伪装”标签自由发挥。`;

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
        disguiseSignals: buildProductDisguiseSignalsSummary(product),
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
        disguiseSignals: buildProductDisguiseSignalsSummary(product),
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
本次匹配方式: ${matchInputMode === "natural-language" ? "自然语言匹配" : "答题匹配"}
${matchInputMode === "natural-language" && naturalLanguageQuery ? `用户原始描述: ${naturalLanguageQuery}` : ""}
候选池数量: ${context.filteredCount}

已确定 Top 3（仅供参考，不需要重排）:
${JSON.stringify(context.topProducts)}

备选候选（只能基于这些 id 输出说明）:
${JSON.stringify(context.backupCandidates)}

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

  async function recalibrateCurrentResults(
    rerollReason: RecommendationRerollReason,
  ) {
    resultEnhancementRunRef.current += 1;
    setIsEnhancingResults(false);
    const localResult = buildLocalResultComputation(answers, allProducts, {
      naturalLanguageQuery:
        matchInputMode === "natural-language" ? naturalLanguageQuery : undefined,
    });

    if (localResult.rerankPool.length === 0) {
      setResultRecalibrationError("暂无可用于重校准的候选结果。");
      return;
    }

    setIsRecalibratingResults(true);
    setResultRecalibrationError(null);
    const nextAttemptCount = resultRecalibrationAttemptCount + 1;
    void submitRecommendationFeedbackEvent({
      eventType: "reroll_recommendation",
      sessionId: recommendationSessionId,
      answers: answers as unknown as Record<string, unknown>,
      answerPath,
      topProducts: serializeRecommendationTopProducts(topProducts),
      rerollAttempt: nextAttemptCount,
      rerollReason,
      resultProvider: currentResultProvider,
      resultModelName: currentResultModelName,
      pageRoute: window.location.pathname || "/results",
    }).catch((error) => {
      console.warn("⚠️ [Feedback] 推荐重生成反馈记录失败", error);
    });

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
            rerollReason,
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

  function saveCompletedRecommendationSession({
    currentAnswers,
    currentAnswerPath,
    finalTopProducts,
    resultSourceState,
  }: {
    currentAnswers: AnswerState;
    currentAnswerPath: QuizAnswerPathEntry[];
    finalTopProducts: RankedProduct[];
    resultSourceState: ReturnType<typeof readResultSourceState>;
  }) {
    void submitRecommendationSession({
      sessionId: recommendationSessionId,
      answers: currentAnswers as unknown as Record<string, unknown>,
      answerPath: currentAnswerPath,
      topProducts: serializeRecommendationTopProducts(finalTopProducts),
      resultProvider: resultSourceState.currentResultProvider,
      resultModelName: resultSourceState.currentResultModelName,
      pageRoute: "/results",
    }).catch((error) => {
      console.warn("⚠️ [Feedback] 推荐会话保存失败", error);
    });
  }

  function applyLocalResultSet(
    currentAnswers: AnswerState,
    localResult: LocalResultComputation,
  ) {
    resultEnhancementRunRef.current += 1;
    setIsEnhancingResults(false);
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
    saveCompletedRecommendationSession({
      currentAnswers,
      currentAnswerPath: answerPath,
      finalTopProducts,
      resultSourceState: clearResultSourceState(),
    });
  }

  function handleTuneResults(mode: ResultTuningMode) {
    const baseAnswers = resultBaseAnswers ?? answers;
    const nextAppliedModes = appliedResultTuningModes.includes(mode)
      ? appliedResultTuningModes
      : [...appliedResultTuningModes, mode];
    const tunedAnswers = applyResultTuningModes(baseAnswers, nextAppliedModes);
    const localResult = buildLocalResultComputation(tunedAnswers, allProducts, {
      naturalLanguageQuery:
        matchInputMode === "natural-language" ? naturalLanguageQuery : undefined,
    });

    setResultBaseAnswers(baseAnswers);
    setAppliedResultTuningModes(nextAppliedModes);
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
        setAuthStatusMessage(
          shouldContinueBodyPersonaUnlockAfterAuth
            ? "注册成功，正在继续解锁完整星系人格档案。"
            : "注册成功，已自动登录。",
        );
        return;
      }

      const data = await signInWithUsernamePassword(normalizedUsername, password);

      if (data.session) {
        setSupabaseSession(data.session);
      }
      setAuthStatusMessage(
        shouldContinueBodyPersonaUnlockAfterAuth
          ? "登录成功，正在继续解锁完整星系人格档案。"
          : "登录成功，可以加密保存推荐档案了。",
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
      setFavoriteProductIds(new Set());
      setShouldContinueBodyPersonaUnlockAfterAuth(false);
      setIsBodyPersonaFullReportOpen(false);
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

  async function handleToggleFavorite(product: Product) {
    const authToken =
      supabaseSession?.access_token ||
      (await getCurrentSupabaseSession())?.access_token ||
      "";

    if (!authToken) {
      setFavoriteActionError("需要登录后才能收藏产品。");
      setIsFavoriteAuthOpen(true);
      return;
    }

    const favoriteKey = product.originalId || product.id;
    const isFavorited = favoriteProductIds.has(favoriteKey);
    setFavoriteActionError(null);
    setFavoriteProductIds((current) => {
      const next = new Set(current);
      if (isFavorited) {
        next.delete(favoriteKey);
      } else {
        next.add(favoriteKey);
      }
      return next;
    });

    try {
      if (isFavorited) {
        await removeFavorite({ authToken, productId: favoriteKey });
      } else {
        await addFavorite({ authToken, productId: favoriteKey });
      }
    } catch (error) {
      setFavoriteProductIds((current) => {
        const rollback = new Set(current);
        if (isFavorited) {
          rollback.add(favoriteKey);
        } else {
          rollback.delete(favoriteKey);
        }
        return rollback;
      });
      setFavoriteActionError(
        error instanceof Error ? error.message : "收藏操作失败，请稍后重试。",
      );
    }
  }

  async function handleRemoveFavoriteFromModal(product: Product) {
    const favoriteKey = product.originalId || product.id;
    const authToken =
      supabaseSession?.access_token ||
      (await getCurrentSupabaseSession())?.access_token ||
      "";

    if (!authToken) {
      setFavoriteActionError("需要登录后才能取消收藏。");
      setIsFavoriteAuthOpen(true);
      return;
    }

    setFavoriteActionError(null);
    setFavoriteProductIds((current) => {
      const next = new Set(current);
      next.delete(favoriteKey);
      return next;
    });

    try {
      await removeFavorite({ authToken, productId: favoriteKey });
    } catch (error) {
      setFavoriteProductIds((current) => {
        const rollback = new Set(current);
        rollback.add(favoriteKey);
        return rollback;
      });
      setFavoriteActionError(
        error instanceof Error ? error.message : "取消收藏失败，请稍后重试。",
      );
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
          matchInputMode,
          naturalLanguageQuery: matchInputMode === "natural-language" ? naturalLanguageQuery : undefined,
          bodyPersona:
            bodyPersonaState?.status === "unlocked" &&
            bodyPersonaState.fullReport &&
            typeof bodyPersonaState.fullReport.hiddenRouteSummary === "string"
              ? {
                  sessionId: bodyPersonaState.sessionId,
                  title:
                    bodyPersonaState.freeSummary?.title ||
                    (typeof bodyPersonaState.fullReport.title === "string"
                      ? bodyPersonaState.fullReport.title
                      : "身体人格结果"),
                  hiddenRouteSummary:
                    bodyPersonaState.fullReport.hiddenRouteSummary,
                  unlocked: true,
                }
              : undefined,
        }),
      });
      setSaveRecommendationProfileMessage(
        "已加密保存到匹配档案，可随时回看。",
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
    currentAnswerPath: QuizAnswerPathEntry[] = answerPath,
    currentNaturalLanguageQuery?: string,
  ) => {
    const enhancementRunId = resultEnhancementRunRef.current + 1;
    resultEnhancementRunRef.current = enhancementRunId;
    clearQuizReturnToResultsState();
    setResultBaseAnswers(currentAnswers);
    setAppliedResultTuningModes([]);
    const localResult = buildLocalResultComputation(currentAnswers, productsData, {
      naturalLanguageQuery:
        currentNaturalLanguageQuery ??
        (matchInputMode === "natural-language" ? naturalLanguageQuery : undefined),
    });

    setIsAiMatching(true);
    setResultRecalibrationError(null);
    setBackupProducts([]);
    setRecommendationTips(localResult.recommendationTips);
    setShoppingGuidance([]);
    setIsEnhancingResults(false);

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
    setBackupProducts(localBackupProducts);
    setShoppingGuidance(localShoppingGuidance);
    applyResultSourceState(latestResultSourceState);
    saveCompletedRecommendationSession({
      currentAnswers,
      currentAnswerPath,
      finalTopProducts,
      resultSourceState: latestResultSourceState,
    });
    setIsEnhancingResults(backupCandidates.length > 0);
    setIsAiMatching(false);
    // 先进入结果页；备选说明和选购建议在后台增强，避免阻塞主推荐展示。
    setTimeout(() => {
      setStep(activeQs.length + 1);
      navigateTo("/results");
    }, 3000);

    if (backupCandidates.length > 0) {
      void (async () => {
        try {
          const enhancement = await callAiResultEnhancement(
            currentAnswers,
            finalTopProducts,
            backupCandidates,
            localResult.filteredCount,
          );
          if (resultEnhancementRunRef.current !== enhancementRunId) {
            return;
          }

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
            finalizeBackupProducts(
              backupCandidates,
              backupReasonMap,
              currentAnswers,
            ),
          );
          setShoppingGuidance(
            aiShoppingGuidance.length > 0
              ? aiShoppingGuidance
              : localShoppingGuidance,
          );
          setIsEnhancingResults(false);
        } catch (enhancementError) {
          console.warn(
            "⚠️ [AI] 结果增强失败，使用本地备选说明与购物建议",
            enhancementError,
          );
          if (resultEnhancementRunRef.current !== enhancementRunId) {
            return;
          }
          setBackupProducts(localBackupProducts);
          setShoppingGuidance(localShoppingGuidance);
          setIsEnhancingResults(false);
        }
      })();
    }
  };

  const buildBodyPersonaCandidatePool = () =>
    [...topProducts, ...backupProducts].slice(0, 8).map((product) => ({
      id: product.id,
      name: getProductDisplayName(product),
      score: product.score,
      tags: product.tags,
      typeCode: product.typeCode ?? null,
      appearance: product.appearance ?? null,
      maxDb: product.maxDb ?? null,
    }));

  const handleStartBodyPersona = () => {
    setBodyPersonaDraftAnswers({});
    setIsBodyPersonaQuizOpen(true);
  };

  const handleCloseBodyPersonaQuiz = () => {
    if (isSubmittingBodyPersonaQuiz) {
      return;
    }

    setIsBodyPersonaQuizOpen(false);
  };

  const handleChangeBodyPersonaAnswer = (
    questionId: keyof BodyPersonaAnswers,
    value: BodyPersonaAnswers[keyof BodyPersonaAnswers],
  ) => {
    if (!value) {
      return;
    }

    setBodyPersonaDraftAnswers((current) => ({
      ...current,
      [questionId]: value,
    }));
  };

  const handleSubmitBodyPersonaQuiz = async () => {
    const completedCount = BODY_PERSONA_QUESTIONS.filter(
      (question) => bodyPersonaDraftAnswers[question.id],
    ).length;

    if (completedCount < BODY_PERSONA_QUESTIONS.length) {
      return;
    }

    setIsSubmittingBodyPersonaQuiz(true);

    try {
      const personaResult = resolveBodyPersonaResult({
        answers: bodyPersonaDraftAnswers,
      });
      const candidatePool = buildBodyPersonaCandidatePool();
      const fullReport = buildBodyPersonaFullReport({
        persona: personaResult,
        candidatePool,
      });
      const saved = await createBodyPersonaSession({
        payload: {
          recommendationSessionId,
          userId: supabaseSession?.user?.id ?? null,
          sourcePageRoute: "/results",
          questionVersion: "body-persona-question-v1",
          scoringVersion: "body-persona-scoring-v1",
          answers: bodyPersonaDraftAnswers as Record<string, unknown>,
          answerPath: BODY_PERSONA_QUESTIONS.map((question, index) => ({
            step: index,
            questionId: question.id,
            questionTitle: question.title,
            selectedValue: bodyPersonaDraftAnswers[question.id] ?? null,
          })),
          candidatePool,
          primaryPersonaCode: personaResult.primaryPersonaCode,
          secondaryPersonaCode: personaResult.secondaryPersonaCode,
          hiddenRouteCode: personaResult.hiddenRouteCode,
          hiddenPowerGrade: personaResult.hiddenPowerGrade,
          coLivingComfortGrade: personaResult.coLivingComfortGrade,
          freeSummary: personaResult.freeSummary,
          fullReport,
        },
      });

      setBodyPersonaState({
        sessionId: saved.id,
        status: "completed_free",
        freeSummary: personaResult.freeSummary,
        fullReport: null,
      });
      setIsBodyPersonaQuizOpen(false);
    } catch (error) {
      console.error("Body persona session create failed", error);
    } finally {
      setIsSubmittingBodyPersonaQuiz(false);
    }
  };

  const handleUnlockBodyPersona = async () => {
    if (!bodyPersonaState) {
      return;
    }

    if (!supabaseSession?.user?.id) {
      setShouldContinueBodyPersonaUnlockAfterAuth(true);
      setAuthStatusMessage("登录后可解锁完整星系人格档案");
      return;
    }

    setIsUnlockingBodyPersona(true);
    setBodyPersonaState((current) =>
      current
        ? {
            ...current,
            status: "unlocking",
          }
        : current,
    );

    try {
      const order = await createBodyPersonaOrder({
        sessionId: bodyPersonaState.sessionId,
        amountCent: 50,
        paymentProvider: "mock",
      });
      const unlocked = await confirmBodyPersonaUnlock({
        orderId: order.id,
        confirmationToken: order.confirmationToken,
      });

      setBodyPersonaState((current) =>
        current
          ? {
              ...current,
              status: "unlocked",
              fullReport: unlocked.report,
            }
          : current,
      );
      setIsBodyPersonaFullReportOpen(true);
    } catch (error) {
      console.error("Body persona unlock failed", error);
      setBodyPersonaState((current) =>
        current
          ? {
              ...current,
              status: "completed_free",
            }
          : current,
      );
    } finally {
      setIsUnlockingBodyPersona(false);
    }
  };

  const handleOpenBodyPersonaFullReport = () => {
    setIsBodyPersonaFullReportOpen(true);
  };

  const handleCloseBodyPersonaFullReport = () => {
    setIsBodyPersonaFullReportOpen(false);
  };

  const resetQuiz = () => {
    resultEnhancementRunRef.current += 1;
    setIsEnhancingResults(false);
    clearQuizReturnToResultsState();
    clearResultTuningTracking();
    clearBodyPersonaFlow();
    applyResultSourceState(clearResultSourceState());
    setRecommendationSessionId(createRecommendationSessionId());
    setAnswerPath([]);
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
    resultEnhancementRunRef.current += 1;
    setIsEnhancingResults(false);
    clearQuizReturnToResultsState();
    const clearedState = createClearedQuizSessionState();
    clearResultTuningTracking();
    clearBodyPersonaFlow();
    applyResultSourceState(clearResultSourceState());
    setRecommendationSessionId(createRecommendationSessionId());
    setAnswerPath([]);
    setStep(clearedState.step);
    setAnswers(clearedState.answers);
    setTopProducts(clearedState.topProducts);
    setBackupProducts(clearedState.backupProducts);
    setRecommendationTips(clearedState.recommendationTips);
    setShoppingGuidance(clearedState.shoppingGuidance);
    setResultRecalibrationError(null);
    setIsRecalibratingResults(false);
    setMatchModeEntrance("planet");
    navigateTo("/match-mode");
  };

  const handleBackFromProfiles = () => {
    navigateTo(resolveProfilesReturnRoute(profilesOriginRoute));
  };

  const handleOpenFavoritesFromHome = () => {
    setIsFavoritesModalOpen(true);
  };

  const handleBackFromKnowledge = () => {
    const backNavigation = resolveKnowledgeBackNavigation(
      knowledgeOriginRoute,
      selectedKnowledgeTopicSlug,
    );

    if (backNavigation.kind === "knowledge-hub") {
      navigateToKnowledgeNebula(undefined, undefined, true);
      return;
    }

    navigateTo(backNavigation.route);
  };

  const favoriteProducts = allProducts.filter((product) =>
    favoriteProductIds.has(product.originalId || product.id),
  );

  useEffect(() => {
    if (
      !isFavoritesModalOpen ||
      favoriteProductIds.size === 0 ||
      allProducts.length > 0 ||
      isLoading
    ) {
      return;
    }

    void fetchProducts({ preferCachedResult: true });
  }, [isFavoritesModalOpen, favoriteProductIds.size, allProducts.length, isLoading]);

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

  const favoriteAuthOverlay = isFavoriteAuthOpen ? (
    <HomeAuthOverlay variant="femaleMvp" onClose={() => setIsFavoriteAuthOpen(false)}>
      <div className="female-mvp-auth-modal-shell">
        <span className="female-mvp-auth-orbit-glow" aria-hidden="true" />
        <div className="female-mvp-auth-modal-header">
          <span> Luna 私密舱 </span>
          <p>{authPanel.userLabel ? "同步你的收藏记录" : "登录后即可收藏喜欢的装备"}</p>
        </div>
        <AuthPanel {...authPanel} surface="modal" />
        <p className="mt-3 text-center text-xs font-semibold leading-5 text-slate-500">
          登录后即可收藏全息装备库和匹配结果中的产品。
        </p>
        {favoriteActionError ? (
          <p className="mt-2 text-center text-xs font-semibold leading-5 text-rose-500">
            {favoriteActionError}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => setIsFavoriteAuthOpen(false)}
          className="female-mvp-auth-modal-close"
        >
          暂时不用
        </button>
      </div>
    </HomeAuthOverlay>
  ) : null;

  if (DEBUG_FORCE_MATCHING_LOADING_PAGE) {
    return (
      <MatchingPage
        pageVariants={pageVariants}
        mode="matching"
        loadingStep={2}
        isAiMatching
        tags={["静音", "新手友好", "温柔慢热"]}
      />
    );
  }

  if (isLoading && currentRoute !== "/library") {
    return (
      <div className="theme-synced-page female-mvp-soft-shell relative min-h-screen overflow-hidden">
        <DataLoadingPage loadingStep={loadingStep} />
      </div>
    );
  }

  if (currentRoute === "/match-mode") {
    return (
      <div className="theme-synced-page female-mvp-soft-shell relative min-h-screen overflow-hidden">
        <div className="relative z-10">
          <MatchModePage
            pageVariants={pageVariants}
            entrance={matchModeEntrance}
            onSelectQuizMode={handleStartQuizMode}
            onSelectNaturalLanguageMode={handleStartNaturalLanguageMode}
            onSelectLuckyMode={handleStartLuckyMode}
            onSelectLibraryMode={() => {
              setMatchModeEntrance("planet");
              navigateTo("/library");
            }}
            onBackHome={() => navigateTo("/")}
          />
        </div>
      </div>
    );
  }

  if (currentRoute === "/match-text") {
    return (
      <div className="theme-synced-page female-mvp-soft-shell relative min-h-screen overflow-hidden">
        <div className="relative z-10">
          <NaturalLanguageMatchPage
            pageVariants={pageVariants}
            prompt={naturalLanguagePrompt}
            isSubmitting={isLoading}
            error={naturalLanguageError}
            onPromptChange={setNaturalLanguagePrompt}
            onSubmit={handleSubmitNaturalLanguageMatch}
            onBack={() => {
              setMatchModeEntrance("planet");
              navigateTo("/match-mode");
            }}
            onBackHome={() => navigateTo("/")}
          />
        </div>
      </div>
    );
  }

  if (currentRoute === "/library") {
    return (
      <div className="theme-synced-page relative min-h-screen overflow-hidden">
        <ThemeCosmosLayer variant="library" />
        <div className="relative z-10">
          <LibraryPage
            allProducts={allProducts}
            filterGender={filterGender}
            filterType={filterType}
            filterSubtype={filterSubtype}
            filterBrand={filterBrand}
            filterOrigin={filterOrigin}
            showFavoritesOnly={showFavoritesOnly}
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
            onShowFavoritesOnlyChange={setShowFavoritesOnly}
            onFilterMaterialChange={setFilterMaterial}
            onFilterPriceRangeChange={setFilterPriceRange}
            onFilterMaxDbChange={setFilterMaxDb}
            onResetFilters={() => {
              setFilterGender("all");
              setFilterType("all");
              setFilterSubtype("all");
              setFilterBrand("all");
              setFilterOrigin("all");
              setShowFavoritesOnly(false);
              setFilterMaterial("all");
              setFilterPriceRange("all");
              setFilterMaxDb(DEFAULT_LIBRARY_FILTER_MAX_DB);
            }}
            onBack={() => navigateTo(getReturnRoute())}
            favoriteProductIds={favoriteProductIds}
            onToggleFavorite={handleToggleFavorite}
          />
        </div>
        {favoriteAuthOverlay}
      </div>
    );
  }

  const shellRoute = shellRouteState.route;
  const shellKnowledgeTopicSlug = shellRouteState.knowledgeTopicSlug;
  const effectiveShellRoute = currentRoute === "/" ? currentRoute : shellRoute;
  const effectiveShellKnowledgeTopicSlug =
    effectiveShellRoute === "/knowledge" ? shellKnowledgeTopicSlug : undefined;
  const isShellKnowledgeDetailRoute =
    effectiveShellRoute === "/knowledge" && effectiveShellKnowledgeTopicSlug != null;
  const isKnowledgeHubRoute =
    effectiveShellRoute === "/knowledge" && effectiveShellKnowledgeTopicSlug == null;
  const isFemaleMvpHomeRoute = effectiveShellRoute === "/" && isFemaleMvp;
  const isFemaleMvpQuizRoute =
    currentRoute === "/quiz" && step < activeQuestions.length && isFemaleMvp;
  const isFemaleMvpResultsRoute = effectiveShellRoute === "/results" && isFemaleMvp;
  const isFemaleMvpSoftShellRoute =
    isFemaleMvpHomeRoute || isFemaleMvpQuizRoute || isFemaleMvpResultsRoute;
  const shellContainerClassName =
    isFemaleMvpHomeRoute
      ? "max-w-none"
      : isFemaleMvpResultsRoute
      ? "max-w-none"
      : isKnowledgeHubRoute
      ? "max-w-none"
      : isShellKnowledgeDetailRoute
        ? "max-w-none"
      : effectiveShellRoute === "/profiles"
      ? "max-w-5xl"
      : effectiveShellRoute === "/results" || effectiveShellRoute === "/knowledge"
      ? "max-w-6xl"
      : effectiveShellRoute === "/quiz" && step === activeQuestions.length
        ? "max-w-none"
        : "max-w-xl";
  const shellOverflowClassName =
    isKnowledgeHubRoute
      ? "overflow-hidden"
      : isShellKnowledgeDetailRoute
        ? "overflow-hidden"
      : effectiveShellRoute === "/profiles"
      ? "overflow-visible"
      : effectiveShellRoute === "/knowledge" ||
        (effectiveShellRoute === "/quiz" && step === activeQuestions.length)
      ? "overflow-visible"
      : effectiveShellRoute === "/quiz" && isFemaleMvp
        ? "overflow-y-auto overflow-x-hidden"
      : "overflow-hidden";
  const shellAlignmentClassName =
    effectiveShellRoute === "/quiz" && isFemaleMvp
      ? "justify-start"
      : "justify-center";
  const shellViewportClassName = isKnowledgeHubRoute
    ? "h-dvh min-h-dvh p-0"
    : isShellKnowledgeDetailRoute
      ? "h-dvh min-h-dvh p-0"
    : effectiveShellRoute === "/quiz"
      ? "h-dvh min-h-dvh p-0"
    : isFemaleMvpResultsRoute
      ? "min-h-screen p-0"
    : isFemaleMvpHomeRoute
      ? "h-dvh min-h-dvh p-0"
    : "min-h-screen p-4 sm:p-6 md:p-8";
  const themeCosmosVariant: ThemeCosmosVariant =
    shellRoute === "/"
      ? "home"
      : shellRoute === "/quiz" && step === activeQuestions.length
        ? "matching"
      : shellRoute === "/quiz"
        ? "quiz"
      : shellRoute === "/results"
        ? "results"
      : shellRoute === "/profiles"
        ? "profiles"
      : isShellKnowledgeDetailRoute
        ? "knowledge-detail"
      : shellRoute === "/knowledge"
        ? "knowledge-hub"
      : "home";
  const shouldRenderThemeCosmosLayer =
    currentRoute !== "/" &&
    shellRoute !== "/" &&
    !isFemaleMvpQuizRoute &&
    !isFemaleMvpResultsRoute;

  return (
    <div
      className={[
        "theme-synced-page relative flex flex-col items-center",
        shellAlignmentClassName,
        effectiveShellRoute === "/" ? "theme-home-route" : "",
        isFemaleMvpSoftShellRoute ? "female-mvp-soft-shell" : "",
        isFemaleMvpHomeRoute ? "female-mvp-home-route" : "",
        isFemaleMvpResultsRoute ? "female-mvp-results-route" : "",
        shellViewportClassName,
        shellOverflowClassName,
      ].filter(Boolean).join(" ")}
    >
      {shouldRenderThemeCosmosLayer ? (
        <ThemeCosmosLayer variant={themeCosmosVariant} />
      ) : null}

      <div className={`relative z-10 w-full ${shellContainerClassName}`}>
        <AppRouteRenderer
          currentRoute={currentRoute}
          pageVariants={pageVariants}
          step={step}
          activeQuestions={activeQuestions}
          isAiMatching={isAiMatching}
          answers={answers}
          topProducts={topProducts}
          backupProducts={backupProducts}
          shoppingGuidance={shoppingGuidance}
          recommendationTips={recommendationTips}
          isEnhancingResults={isEnhancingResults}
          isRecalibratingResults={isRecalibratingResults}
          onStart={startFreshQuizSession}
          onBrowseLibraryHome={() => {
            navigateTo("/library");
          }}
          onOpenKnowledgeNebula={(path) => {
            navigateToKnowledgeNebula(
              parseKnowledgeNebulaPath(path || buildKnowledgeNebulaPath()).topicSlug,
              parseKnowledgeNebulaPath(path || buildKnowledgeNebulaPath()).sectionId,
            );
          }}
          onOpenProfiles={navigateToProfiles}
          onOpenFavorites={handleOpenFavoritesFromHome}
          onBackProfiles={handleBackFromProfiles}
          onSelectOption={handleOptionSelect}
          onBackQuestion={handleBackQuestion}
          onBackHome={handleBackHomeFromQuiz}
          onBackResults={
            quizReturnToResultsState ? handleBackToResultsFromQuiz : undefined
          }
          onJumpToQuestion={handleJumpToQuizQuestion}
          onReloadRecommendationProfiles={() => void fetchRecommendationProfiles()}
          authPanel={authPanel}
          recommendationProfiles={recommendationProfiles}
          isLoadingRecommendationProfiles={isLoadingRecommendationProfiles}
          recommendationProfilesError={recommendationProfilesError}
          allProducts={allProducts}
          selectedKnowledgeTopicSlug={selectedKnowledgeTopicSlug}
          selectedKnowledgeSectionId={selectedKnowledgeSectionId}
          onBackKnowledge={handleBackFromKnowledge}
          onSelectKnowledgeTopic={(topicSlug) => {
            navigateToKnowledgeNebula(topicSlug, undefined);
          }}
          themeId={themeId}
          onThemeChange={handleThemeChange}
          onReset={resetQuiz}
          matchInputMode={matchInputMode}
          naturalLanguageQuery={naturalLanguageQuery}
          shouldPlayQuizLanding={shouldPlayQuizLanding && step === 0}
          favoriteProductIds={favoriteProductIds}
          onToggleFavorite={handleToggleFavorite}
        />
      </div>

      {favoriteAuthOverlay}

      {isFavoritesModalOpen ? (
        <HomeAuthOverlay onClose={() => setIsFavoritesModalOpen(false)}>
          <div className="w-full max-w-4xl rounded-[1.7rem] border border-cyan-300/18 bg-slate-950 p-5 text-left shadow-[0_0_90px_rgba(8,47,73,0.38)] sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4 border-b border-cyan-100/10 pb-4">
              <div className="min-w-0">
                <p className="mb-2 text-[10px] tracking-[0.28em] text-cyan-200/45">
                  FAVORITES
                </p>
                <h2 className="text-lg font-medium text-white sm:text-xl">
                  我的收藏
                </h2>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  这里会集中展示你在全息装备库和匹配结果中收藏过的产品。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFavoritesModalOpen(false)}
                className="inline-flex w-full sm:w-auto shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] p-2 text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white"
              >
                关闭
              </button>
            </div>

            {isLoading && favoriteProducts.length === 0 ? (
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-8 text-center text-sm text-slate-400">
                正在读取收藏产品...
              </div>
            ) : favoriteProducts.length === 0 ? (
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-8 text-center">
                <p className="text-sm text-white">还没有收藏产品</p>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  你可以在全息装备库或匹配结果中点击收藏，之后会显示在这里。
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {favoriteProducts.map((product) => {
                  const productUrl = product.sourceUrl || product.link;
                  const card = (
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 transition-all hover:border-cyan-300/24 hover:bg-cyan-300/[0.05]">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="rounded-full border border-cyan-300/16 bg-cyan-300/8 px-2.5 py-1 text-[11px] text-cyan-100/75">
                          {product.brand}
                        </span>
                        <span className="text-sm text-cyan-300">¥{product.price}</span>
                      </div>
                      <h3 className="text-base font-medium leading-6 text-white">
                        {getProductDisplayName(product)}
                      </h3>
                      <p className="mt-2 text-xs leading-5 text-slate-400">
                        材质：{product.material} · {product.gender === "male" ? "男性向" : product.gender === "female" ? "女性向" : "通用型"}
                      </p>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          void handleRemoveFavoriteFromModal(product);
                        }}
                        className="mt-4 inline-flex items-center gap-1 rounded-full border border-rose-300/18 bg-rose-400/10 px-3 py-1.5 text-xs text-rose-100 transition-colors hover:bg-rose-400/16"
                      >
                        取消收藏
                      </button>
                    </div>
                  );

                  return productUrl ? (
                    <a
                      key={product.id}
                      href={productUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      {card}
                    </a>
                  ) : (
                    <div key={product.id}>{card}</div>
                  );
                })}
              </div>
            )}
          </div>
        </HomeAuthOverlay>
      ) : null}
    </div>
  );
}
