/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { AnimatePresence } from "motion/react";
import OpenAI from "openai";
import { questions, AnswerState, Product, Question } from "./data/mock";
import {
  AppRoute,
  APP_STATE_STORAGE_KEY,
  PRODUCTS_CACHE_STORAGE_KEY,
  RankedProduct,
  detectRoute,
  readJsonStorage,
} from "./lib/app-shell";
import { LoadingPage } from "./pages/LoadingPage";
import { HomePage } from "./pages/HomePage";
import { QuizPage } from "./pages/QuizPage";
import { MatchingPage } from "./pages/MatchingPage";
import { ResultsPage } from "./pages/ResultsPage";
import { LibraryPage } from "./pages/LibraryPage";

export default function App() {
  const persistedState = readJsonStorage<{
    step?: number;
    answers?: AnswerState;
    topProducts?: RankedProduct[];
    recommendationTips?: string[];
    filterGender?: string;
    filterBrand?: string;
    filterOrigin?: string;
    filterMaxDb?: number;
    filterMaterial?: string;
    filterPriceRange?: string;
  }>(APP_STATE_STORAGE_KEY, {});
  const cachedProducts = readJsonStorage<Product[]>(
    PRODUCTS_CACHE_STORAGE_KEY,
    [],
  );

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

  const [loadingStep, setLoadingStep] = useState(0);

  const [recommendationTips, setRecommendationTips] = useState<string[]>(
    persistedState.recommendationTips ?? [],
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
    if (currentRoute === "/library" && !hasFetched && !isLoading) {
      void fetchProducts();
    }
  }, [currentRoute, hasFetched, isLoading]);

  useEffect(() => {
    window.localStorage.setItem(
      APP_STATE_STORAGE_KEY,
      JSON.stringify({
        step,
        answers,
        topProducts,
        recommendationTips,
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
    recommendationTips,
    filterGender,
    filterBrand,
    filterOrigin,
    filterMaxDb,
    filterMaterial,
    filterPriceRange,
  ]);

  useEffect(() => {
    window.localStorage.setItem(
      PRODUCTS_CACHE_STORAGE_KEY,
      JSON.stringify(allProducts),
    );
  }, [allProducts]);

  const fetchProducts = () => {
    if (hasFetched && allProducts.length > 0) return Promise.resolve(allProducts);
    if (cachedProducts.length > 0) {
      setAllProducts(cachedProducts);
      setHasFetched(true);
      return Promise.resolve(cachedProducts);
    }
    setIsLoading(true);
    setLoadingStep(1); // 连接星港
    return new Promise<Product[]>((resolve) => {
      fetch("/api/recommender/toys")
        .then((response) => response.json())
        .then((data) => {
          setLoadingStep(2); // 数据解密
          setTimeout(() => {
            setLoadingStep(3); // 载入晶体
            setTimeout(() => {
              setAllProducts(data);
              setIsLoading(false);
              setHasFetched(true);
              resolve(data);
            }, 1200); // 仪式感时间
          }, 800);
        })
        .catch((error) => {
          console.error("Failed to fetch products:", error);
          setLoadingStep(-1); // 链路中断
          setIsLoading(false);
          resolve([]); // Resolve anyway to allow user to try again or see error state
        });
    });
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
   * AI 匹配逻辑：按顺序尝试多个模型
   */
  async function callAiMatching(
    userAnswers: AnswerState,
    candidates: Product[],
  ) {
    // 准备发送给 AI 的数据上下文 (脱敏并精简摘要)
    const context = {
      userPreferences: userAnswers.tags,
      candidateProducts: candidates.map((p) => ({
        id: p.id,
        name: p.name,
        brand: p.brand,
        gender: p.gender,
        specs: `${p.material}, ${p.waterproof == null ? "无防水参数" : `IPX${p.waterproof}`}, ${p.maxDb == null ? "无噪音参数" : `<${p.maxDb}dB`}, ${p.motorType}马达`,
        tags: p.tags?.join(", ") || "",
      })),
    };

    const prompt = `
你是一个专业的性健康装备选品专家。请根据用户的偏好标签和以下备选产品列表，挑选出最匹配的前 3 名产品，并为每一名提供一个极具说服力的“推荐理由”（30字以内）。

用户偏好标签: [${context.userPreferences.join(", ")}]

备选产品列表:
${JSON.stringify(context.candidateProducts, null, 2)}

请仅返回如下格式的 JSON 数组（不要包含任何 Markdown 格式或多余文字）：
[
  { "id": "产品ID", "reason": "在此填写推荐理由" },
  ...
]
`;

    // 1. 尝试 DeepSeek
    try {
      console.log("🤖 [AI] 正在启动首选引擎: DeepSeek...");
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
      return JSON.parse(
        response.choices[0].message.content
          ?.replace(/```json/g, "")
          .replace(/```/g, "")
          .trim() || "[]",
      );
    } catch (e) {
      console.warn(
        "⚠️ [AI] DeepSeek 链路中断，正在切换至齐天大圣模式 (Qwen)...",
        e,
      );
    }

    // 2. 尝试 Qwen
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
      return JSON.parse(
        response.choices[0].message.content
          ?.replace(/```json/g, "")
          .replace(/```/g, "")
          .trim() || "[]",
      );
    } catch (e) {
      console.warn(
        "⚠️ [AI] Qwen 链路中断，正在启动 GLM-4.6V-FLASHX 兜底...",
        e,
      );
    }

    // 3. 尝试 GLM
    try {
      const glmKey = process.env.GLM_API_KEY;
      if (!glmKey) throw new Error("Missing GLM Key");
      const openai = new OpenAI({
        apiKey: glmKey,
        baseURL: "https://open.bigmodel.cn/api/paas/v4/",
        dangerouslyAllowBrowser: true,
      });
      const response = await openai.chat.completions.create({
        model: "GLM-4.6V-FlashX",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      });
      return JSON.parse(
        response.choices[0].message.content
          ?.replace(/```json/g, "")
          .replace(/```/g, "")
          .trim() || "[]",
      );
    } catch (e) {
      console.error("❌ [AI] 所有模型链路全部中断，回退到本地启发式算法", e);
      throw e;
    }
  }

  const calculateResults = async (
    currentAnswers: AnswerState = answers,
    activeQs: Question[] = activeQuestions,
    productsData: Product[] = allProducts,
  ) => {
    setIsAiMatching(true);
    setRecommendationTips([]);

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

    // 候选池太小时使用全部产品（兜底）
    const candidates = filtered.length >= 3 ? filtered : productsData;

    try {
      const aiResults = await callAiMatching(currentAnswers, candidates);

      if (aiResults && Array.isArray(aiResults) && aiResults.length > 0) {
        const selected = aiResults.slice(0, 3).map((res) => {
          const product =
            candidates.find((p) => p.id === res.id) || candidates[0];
          return { ...product, reason: res.reason, score: 100 };
        });
        setTopProducts(selected);
      } else {
        throw new Error("Empty AI response");
      }
    } catch (e) {
      // Step 2 Fallback: Rule-based Weighted Scoring
      const scored = candidates.map((p) => {
        let score = 0;
        if (p.physicalForm === currentAnswers.physicalForm) score += 100;
        if (p.motorType === currentAnswers.motorType) score += 20;
        if (
          currentAnswers.waterproof &&
          p.waterproof != null &&
          p.waterproof >= currentAnswers.waterproof
        )
          score += 20;
        return { ...p, score, reason: "根据您的物理偏好进行精准匹配。" };
      });
      scored.sort((a, b) => b.score - a.score);
      setTopProducts(scored.slice(0, 3));
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
    setRecommendationTips([]);
    navigateTo("/quiz");
  };

  if (isLoading) {
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
                if (!hasFetched) {
                  fetchProducts().then(() => navigateTo("/library"));
                } else {
                  navigateTo("/library");
                }
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
              recommendationTips={recommendationTips}
              onReset={resetQuiz}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
