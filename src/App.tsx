/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { AnimatePresence } from "motion/react";
import OpenAI from "openai";
import { questions, AnswerState, Product, Question } from "./data/mock";
import {
  AppRoute,
  APP_STATE_STORAGE_KEY,
  RankedProduct,
  detectRoute,
  normalizeProductsPayload,
  readProductsCache,
  readJsonStorage,
  writeProductsCache,
} from "./lib/app-shell";
import {
  buildBackupCandidates,
  buildLocalBackupReason,
  buildLocalShoppingGuidance,
  type BackupCandidate,
} from "./lib/recommendation-results";
import { LoadingPage } from "./pages/LoadingPage";
import { HomePage } from "./pages/HomePage";
import { QuizPage } from "./pages/QuizPage";
import { MatchingPage } from "./pages/MatchingPage";
import { ResultsPage } from "./pages/ResultsPage";
import { LibraryPage } from "./pages/LibraryPage";

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

type PersistedAppState = {
  step?: number;
  answers?: AnswerState;
  topProducts?: RankedProduct[];
  backupProducts?: BackupProduct[];
  recommendationTips?: string[];
  shoppingGuidance?: string[];
  filterGender?: string;
  filterBrand?: string;
  filterOrigin?: string;
  filterMaxDb?: number;
  filterMaterial?: string;
  filterPriceRange?: string;
};

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
  id: "female" | "male_tenga" | "mixed";
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

const SCORE_PRESET_MALE_TENGA: ScorePreset = {
  id: "male_tenga",
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

const SCORE_PRESET_MIXED: ScorePreset = {
  id: "mixed",
  label: "通用混合商品池",
  weights: {
    genderExact: 28,
    genderUnisex: 18,
    genderMiss: -30,

    physicalFormExact: 34,
    physicalFormMiss: -10,

    motorTypeExact: 22,
    motorTypeMiss: -8,

    appearanceExact: 18,
    appearanceHighDisguiseMiss: -16,

    waterproofUnknown: 4,
    waterproofQualified: 16,
    waterproofMiss: -12,

    noiseUnknown: 6,
    noiseQualified: 16,
    noiseMissMin: -6,
    noiseMissStep: -4,
    noiseMissMax: -18,
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
  male_tenga: SCORE_PRESET_MALE_TENGA,
  mixed: SCORE_PRESET_MIXED,
} as const;

function looksLikeTengaPool(products: Product[]) {
  if (products.length === 0) return false;
  const tengaCount = products.filter((product) =>
    /tenga|iroha/i.test(`${product.brand || ""} ${product.name || ""}`),
  ).length;
  return tengaCount / products.length >= 0.35;
}

function selectScorePreset(
  answers: AnswerState,
  products: Product[],
): ScorePreset {
  if (answers.gender === "female") return SCORE_PRESETS.female;
  if (answers.gender === "male") return SCORE_PRESETS.male_tenga;
  if (looksLikeTengaPool(products)) return SCORE_PRESETS.male_tenga;
  return SCORE_PRESETS.mixed;
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

function normalizeJsonResponse(content: string | null | undefined) {
  return String(content || "")
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
}

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

function buildLocalReason(
  product: StructuredRankedProduct,
  answers: AnswerState,
) {
  const summary = product.matchSummary.slice(0, 3);
  if (summary.length > 0) return summary.join("，");

  if (answers.physicalForm && product.physicalForm === answers.physicalForm) {
    return "结构取向贴近你的核心刺激偏好";
  }
  if (answers.motorType && product.motorType === answers.motorType) {
    return answers.motorType === "gentle"
      ? "节奏更温和，适合慢慢进入状态"
      : "输出更直接，适合追求强反馈体验";
  }
  if (answers.budget && getBudgetGap(product.price, answers.budget) === 0) {
    return "预算友好，能更稳地落在你的预期区间";
  }
  return "综合表现均衡，适合作为当前偏好的稳妥选择";
}

function finalizeRankedProducts(
  products: StructuredRankedProduct[],
  reasonMap: Map<string, string>,
  answers: AnswerState,
): RankedProduct[] {
  return products.map(
    ({ matchSummary, hardMisses, budgetGap, noiseGap, ...product }) => ({
      ...product,
      reason:
        reasonMap.get(product.id) ||
        buildLocalReason(
          { ...product, matchSummary, hardMisses, budgetGap, noiseGap },
          answers,
        ),
    }),
  );
}

function finalizeBackupProducts(
  products: BackupCandidate[],
  reasonMap: Map<string, string>,
): BackupProduct[] {
  return products.map((product) => ({
    ...product,
    backupReason:
      reasonMap.get(product.id) ||
      buildLocalBackupReason(product, product.backupLabel),
  }));
}

export default function App() {
  const persistedState = readJsonStorage<PersistedAppState>(
    APP_STATE_STORAGE_KEY,
    {},
  );
  const cachedProducts = readProductsCache();

  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() =>
    detectRoute(window.location.pathname),
  );
  const [step, setStep] = useState<number>(persistedState.step ?? -1);
  const [answers, setAnswers] = useState<AnswerState>(
    persistedState.answers ?? { tags: [] },
  );
  const [allProducts, setAllProducts] = useState<Product[]>(cachedProducts);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(cachedProducts.length > 0);
  const [productsError, setProductsError] = useState<string | null>(null);
  const productsFetchRef = useRef<Promise<Product[]> | null>(null);

  // 过滤器状态
  const [filterGender, setFilterGender] = useState<string>(
    persistedState.filterGender ?? "all",
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

  const activeQuestions: Question[] = questions.filter(
    (q) =>
      !q.applicableGenders ||
      (answers.gender && q.applicableGenders.includes(answers.gender)),
  );

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

  const navigateTo = (route: AppRoute, replace = false) => {
    if (window.location.pathname !== route) {
      window.history[replace ? "replaceState" : "pushState"]({}, "", route);
    }
    setCurrentRoute(route);
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
    const handlePopState = () => {
      setCurrentRoute(detectRoute(window.location.pathname));
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
    if (currentRoute === "/library" && allProducts.length === 0 && !isLoading) {
      void fetchProducts();
    }
  }, [currentRoute, allProducts.length, isLoading]);

  useEffect(() => {
    window.localStorage.setItem(
      APP_STATE_STORAGE_KEY,
      JSON.stringify({
        step,
        answers,
        topProducts,
        backupProducts,
        recommendationTips,
        shoppingGuidance,
        filterGender,
        filterBrand,
        filterOrigin,
        filterMaxDb,
        filterMaterial,
        filterPriceRange,
      }),
    );
  }, [
    step,
    answers,
    topProducts,
    backupProducts,
    recommendationTips,
    shoppingGuidance,
    filterGender,
    filterBrand,
    filterOrigin,
    filterMaxDb,
    filterMaterial,
    filterPriceRange,
  ]);

  useEffect(() => {
    writeProductsCache(allProducts);
  }, [allProducts]);

  const fetchProducts = (options?: { force?: boolean }) => {
    const force = options?.force === true;
    if (!force && allProducts.length > 0) {
      setHasFetched(true);
      return Promise.resolve(allProducts);
    }

    const latestCachedProducts = readProductsCache();
    if (!force && latestCachedProducts.length > 0) {
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

  const handleOptionSelect = (field: string, value: any, tag: string) => {
    const newAnswers = {
      ...answers,
      [field]: value,
      tags: [...answers.tags, tag],
    };
    setAnswers(newAnswers);

    const activeQs = questions.filter(
      (q) =>
        !q.applicableGenders ||
        (newAnswers.gender && q.applicableGenders.includes(newAnswers.gender)),
    );

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

  const [isAiMatching, setIsAiMatching] = useState(false);

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
        name: p.name,
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
你是一个专业的性健康装备选品专家。
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

    try {
      console.log("🤖 [AI] 正在启动首选引擎: DeepSeek，在结构化候选池中重排 Top3...");
      const dsKey = process.env.DEEPSEEK_API_KEY;
      if (!dsKey) throw new Error("Missing DeepSeek Key");
      const openai = new OpenAI({
        apiKey: dsKey,
        baseURL: "https://api.deepseek.com/v1",
        dangerouslyAllowBrowser: true,
      });
      const response = await openai.chat.completions.create({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      });
      return JSON.parse(normalizeJsonResponse(response.choices[0].message.content) || "[]");
    } catch (e) {
      console.warn(
        "⚠️ [AI] DeepSeek 重排失败，正在切换至齐天大圣模式 (Qwen)...",
        e,
      );
    }

    try {
      const qwenKey = process.env.QWEN_API_KEY;
      if (!qwenKey) throw new Error("Missing Qwen Key");
      const openai = new OpenAI({
        apiKey: qwenKey,
        baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        dangerouslyAllowBrowser: true,
      });
      const response = await openai.chat.completions.create({
        model: "qwen-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      });
      return JSON.parse(normalizeJsonResponse(response.choices[0].message.content) || "[]");
    } catch (e) {
      console.warn(
        "⚠️ [AI] Qwen 重排失败，正在启动 GLM-4.6V 兜底...",
        e,
      );
    }

    try {
      const glmKey = process.env.GLM_API_KEY;
      if (!glmKey) throw new Error("Missing GLM Key");
      const openai = new OpenAI({
        apiKey: glmKey,
        baseURL: "https://open.bigmodel.cn/api/paas/v4/",
        dangerouslyAllowBrowser: true,
      });
      const response = await openai.chat.completions.create({
        model: "glm-4.6v",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      });
      return JSON.parse(normalizeJsonResponse(response.choices[0].message.content) || "[]");
    } catch (e) {
      console.error("❌ [AI] 所有模型链路全部中断，回退到本地结构化 Top3", e);
      throw e;
    }
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
        name: product.name,
        brand: product.brand,
        price: product.price,
        reason: product.reason || "",
      })),
      backupCandidates: backupCandidates.map((product, index) => ({
        rank: index + 1,
        id: product.id,
        name: product.name,
        brand: product.brand,
        price: product.price,
        backupLabel: product.backupLabel,
        structuredScore: product.score,
        matchSummary: product.matchSummary?.join("、") || "",
        localReason: buildLocalBackupReason(product, product.backupLabel),
      })),
    };

    const prompt = `
你是一个专业的性健康装备选品专家。
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

    try {
      console.log("🤖 [AI] 正在为备选结果与选购建议生成增强文案: DeepSeek...");
      const dsKey = process.env.DEEPSEEK_API_KEY;
      if (!dsKey) throw new Error("Missing DeepSeek Key");
      const openai = new OpenAI({
        apiKey: dsKey,
        baseURL: "https://api.deepseek.com/v1",
        dangerouslyAllowBrowser: true,
      });
      const response = await openai.chat.completions.create({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      });
      return JSON.parse(
        normalizeJsonResponse(response.choices[0].message.content) || "{}",
      ) as AiResultEnhancement;
    } catch (e) {
      console.warn("⚠️ [AI] DeepSeek 结果增强失败，切换至 Qwen...", e);
    }

    try {
      const qwenKey = process.env.QWEN_API_KEY;
      if (!qwenKey) throw new Error("Missing Qwen Key");
      const openai = new OpenAI({
        apiKey: qwenKey,
        baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        dangerouslyAllowBrowser: true,
      });
      const response = await openai.chat.completions.create({
        model: "qwen-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      });
      return JSON.parse(
        normalizeJsonResponse(response.choices[0].message.content) || "{}",
      ) as AiResultEnhancement;
    } catch (e) {
      console.warn("⚠️ [AI] Qwen 结果增强失败，切换至 GLM-4.6V...", e);
    }

    try {
      const glmKey = process.env.GLM_API_KEY;
      if (!glmKey) throw new Error("Missing GLM Key");
      const openai = new OpenAI({
        apiKey: glmKey,
        baseURL: "https://open.bigmodel.cn/api/paas/v4/",
        dangerouslyAllowBrowser: true,
      });
      const response = await openai.chat.completions.create({
        model: "glm-4.6v",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      });
      return JSON.parse(
        normalizeJsonResponse(response.choices[0].message.content) || "{}",
      ) as AiResultEnhancement;
    } catch (e) {
      console.error("❌ [AI] 结果增强链路全部中断，回退到本地说明与建议", e);
      throw e;
    }
  }

  const calculateResults = async (
    currentAnswers: AnswerState = answers,
    activeQs: Question[] = activeQuestions,
    productsData: Product[] = allProducts,
  ) => {
    setIsAiMatching(true);
    setBackupProducts([]);
    setRecommendationTips([]);
    setShoppingGuidance([]);

    // Step 1: Base Filter (物理硬指标过滤)
    const filtered = productsData.filter((p) => {
      if (
        currentAnswers.budget &&
        (p.price < currentAnswers.budget[0] ||
          p.price > currentAnswers.budget[1])
      )
        return false;
      if (
        currentAnswers.maxDb &&
        p.maxDb != null &&
        p.maxDb > currentAnswers.maxDb
      )
        return false;
      if (
        currentAnswers.appearance === "high_disguise" &&
        p.appearance !== "high_disguise"
      )
        return false;
      if (
        currentAnswers.gender &&
        p.gender !== "unisex" &&
        p.gender !== currentAnswers.gender
      )
        return false;
      return true;
    });

    // --- 约束敏感度分析 (Optimization Tips) ---
    if (filtered.length < 3) {
      const tips: string[] = [];

      // 检查预算
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
            (p.price < currentAnswers.budget![0] ||
              p.price > currentAnswers.budget![1])
          );
        });
        if (potentialByBudget.length > 0) {
          tips.push(
            `适当调高预算（如增至 ¥${Math.round(currentAnswers.budget[1]! * 1.5)} 左右）可大幅增加匹配成功率。`,
          );
        }
      }

      // 检查外观
      if (currentAnswers.appearance === "high_disguise") {
        const potentialByAppearance = productsData.filter((p) => {
          const matchOther =
            (!currentAnswers.maxDb ||
              p.maxDb == null ||
              p.maxDb <= currentAnswers.maxDb) &&
            (!currentAnswers.budget ||
              (p.price >= currentAnswers.budget[0]! &&
                p.price <= currentAnswers.budget[1]!)) &&
            (!currentAnswers.gender ||
              p.gender === "unisex" ||
              p.gender === currentAnswers.gender);
          return matchOther && p.appearance !== "high_disguise";
        });
        if (potentialByAppearance.length > 0) {
          tips.push(
            "若能接受常规或科技感造型（不拘泥于高伪装），可选性能范围将显著扩大。",
          );
        }
      }

      // 检查静音
      if (currentAnswers.maxDb && currentAnswers.maxDb < 60) {
        const potentialByNoise = productsData.filter((p) => {
          const matchOther =
            (currentAnswers.appearance !== "high_disguise" ||
              p.appearance === "high_disguise") &&
            (!currentAnswers.budget ||
              (p.price >= currentAnswers.budget[0]! &&
                p.price <= currentAnswers.budget[1]!)) &&
            (!currentAnswers.gender ||
              p.gender === "unisex" ||
              p.gender === currentAnswers.gender);
          return (
            matchOther && p.maxDb != null && p.maxDb > currentAnswers.maxDb!
          );
        });
        if (potentialByNoise.length > 0) {
          tips.push(
            "对噪音阈值的微调（如调至 55dB 左右）可能会带给您更细腻的震动体验。",
          );
        }
      }

      setRecommendationTips(tips);
    }
    // ----------------------------------------

    // 候选池太小时使用全部产品（兜底），但排序始终先走结构化打分
    const candidates = filtered.length >= 3 ? filtered : productsData;
    const scorePreset = selectScorePreset(currentAnswers, candidates);
    const rankedCandidates = candidates
      .map((product) => scoreStructuredProduct(product, currentAnswers, scorePreset))
      .sort(compareStructuredProducts);
    const rerankPool = rankedCandidates.slice(0, AI_RERANK_POOL_SIZE);
    const fallbackTopProducts = rerankPool.slice(0, FINAL_SELECTION_COUNT);

    if (rerankPool.length === 0) {
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

    try {
      const aiResults = await callAiRerank(currentAnswers, rerankPool);

      if (aiResults && Array.isArray(aiResults) && aiResults.length > 0) {
        const reasonMap = new Map<string, string>();
        const poolById = new Map(rerankPool.map((product) => [product.id, product]));
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

        for (const product of rerankPool) {
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
      } else {
        throw new Error("Empty AI response");
      }
    } catch (e) {
      finalTopProducts = finalizeRankedProducts(
        fallbackTopProducts,
        new Map(),
        currentAnswers,
      );
    }

    const backupCandidates = buildBackupCandidates(
      rankedCandidates,
      finalTopProducts.map((product) => product.id),
      BACKUP_SELECTION_COUNT,
    );
    const localBackupProducts = finalizeBackupProducts(
      backupCandidates,
      new Map(),
    );
    const localShoppingGuidance = buildLocalShoppingGuidance({
      answers: currentAnswers,
      filteredCount: filtered.length,
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
          filtered.length,
        );
        const backupReasonMap = new Map<string, string>();
        const backupPoolIds = new Set(
          backupCandidates.map((product) => product.id),
        );

        if (Array.isArray(enhancement.backupProducts)) {
          enhancement.backupProducts.forEach((item) => {
            if (!item?.id || !backupPoolIds.has(item.id)) return;
            const normalizedReason = String(item.reason || "").trim();
            if (normalizedReason) {
              backupReasonMap.set(item.id, normalizedReason);
            }
          });
        }

        const aiShoppingGuidance = Array.isArray(enhancement.shoppingGuidance)
          ? enhancement.shoppingGuidance
              .map((line) => String(line || "").trim())
              .filter(Boolean)
              .slice(0, MAX_SHOPPING_GUIDANCE_COUNT)
          : [];

        setBackupProducts(
          finalizeBackupProducts(backupCandidates, backupReasonMap),
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
      setIsAiMatching(false);
      // 延迟跳转以供展示动画
      setTimeout(() => {
        setStep(activeQs.length + 1);
        navigateTo("/results");
      }, 3000);
    }
  };

  const resetQuiz = () => {
    setStep(0);
    setAnswers({ tags: [] });
    setTopProducts([]);
    setBackupProducts([]);
    setRecommendationTips([]);
    setShoppingGuidance([]);
    navigateTo("/quiz");
  };

  if (isLoading && currentRoute !== "/library") {
    return <LoadingPage loadingStep={loadingStep} />;
  }

  if (currentRoute === "/library") {
    return (
      <LibraryPage
        allProducts={allProducts}
        filterGender={filterGender}
        filterBrand={filterBrand}
        filterOrigin={filterOrigin}
        filterMaterial={filterMaterial}
        filterPriceRange={filterPriceRange}
        filterMaxDb={filterMaxDb}
        isLoading={isLoading}
        error={productsError}
        onReload={() => fetchProducts({ force: true })}
        onFilterGenderChange={setFilterGender}
        onFilterBrandChange={setFilterBrand}
        onFilterOriginChange={setFilterOrigin}
        onFilterMaterialChange={setFilterMaterial}
        onFilterPriceRangeChange={setFilterPriceRange}
        onFilterMaxDbChange={setFilterMaxDb}
        onBack={() => navigateTo(getReturnRoute())}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 relative overflow-hidden">
      {/* Background ambient elements */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-cyan-900/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-indigo-900/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10">
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
              onSelectOption={(value, tag) =>
                handleOptionSelect(activeQuestions[step].field, value, tag)
              }
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
              onReset={resetQuiz}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
