/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import OpenAI from "openai";
import axios from "axios";
import { questions, AnswerState, Product } from "./data/mock";
import {
  Orbit,
  Hexagon,
  Triangle,
  CircleDashed,
  Sparkles,
  ShieldCheck,
  VolumeX,
  Droplets,
  Zap,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";

function ProductCardContent({ product }: { product: Product }) {
  const isImage = product.imagePlaceholder.startsWith("http");
  return (
    <>
      <div className="aspect-[4/3] w-full overflow-hidden relative border-b border-white/5 bg-black/20">
        {isImage ? (
          <img
            src={product.imagePlaceholder}
            alt={product.name}
            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all duration-700 group-hover:scale-105"
          />
        ) : (
          <div
            className={`w-full h-full ${product.imagePlaceholder} flex justify-center items-center`}
          >
            <Hexagon className="w-8 h-8 text-white/10" />
          </div>
        )}
        <div className="absolute top-3 right-3 flex flex-col gap-1 items-end">
          <div
            className={`px-2 py-0.5 rounded border text-[9px] font-mono ${product.gender === "male" ? "bg-blue-500/20 border-blue-500/30 text-blue-300" : product.gender === "female" ? "bg-pink-500/20 border-pink-500/30 text-pink-300" : "bg-purple-500/20 border-purple-500/30 text-purple-300"}`}
          >
            {product.gender === "male"
              ? "男用"
              : product.gender === "female"
                ? "女用"
                : "通用"}
          </div>
        </div>
      </div>
      <div className="p-5 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-1">
          <h3 className="text-lg font-medium text-white leading-tight group-hover:text-cyan-100 transition-colors">
            {product.name}
          </h3>
          <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-slate-400 shrink-0 ml-2">
            {product.brand}
          </span>
        </div>
        <span className="text-xl font-semibold text-cyan-400/90 mb-4 tracking-wide">
          ¥{product.price}
        </span>

        <div className="text-[10px] text-slate-500 mb-2 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-500/40"></div>
          <span>材质: {product.material}</span>
        </div>

        {product.personaAnalysis && (
          <div className="mb-3 p-2 rounded bg-cyan-950/40 border border-cyan-500/20 group/tooltip relative cursor-help">
            <h4 className="text-[9px] text-cyan-500 mb-0.5 tracking-wider font-mono">
              适用人群
            </h4>
            <p className="text-[10px] text-cyan-100/70 leading-relaxed line-clamp-3">
              {product.personaAnalysis}
            </p>

            {/* 自定义全息浮窗提示 */}
            <div className="opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-300 absolute z-50 bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 w-[calc(100%+32px)] p-3 bg-slate-900/95 border border-cyan-500/50 rounded-lg shadow-2xl shadow-cyan-900/30 backdrop-blur-md pointer-events-none">
              <p className="text-[10.5px] text-cyan-50 leading-relaxed">
                {product.personaAnalysis}
              </p>
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-cyan-500/50"></div>
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-slate-900"></div>
            </div>
          </div>
        )}

        {product.tags && product.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {product.tags.slice(0, 3).map((tag, i) => (
              <span
                key={i}
                className="text-[9px] bg-indigo-500/10 text-indigo-300/70 border border-indigo-500/20 px-1.5 py-0.5 rounded-md"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-auto pt-2">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-300 bg-white/5 border border-white/5 px-2 py-1 rounded">
            <VolumeX className="w-3 h-3 text-cyan-500/70" /> &lt;{product.maxDb}
            dB
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-300 bg-white/5 border border-white/5 px-2 py-1 rounded">
            <Droplets className="w-3 h-3 text-cyan-500/70" /> IPX
            {product.waterproof}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-300 bg-white/5 border border-white/5 px-2 py-1 rounded">
            <Zap className="w-3 h-3 text-cyan-500/70" />{" "}
            {product.motorType === "gentle" ? "柔和波段" : "强感波段"}
          </div>
        </div>
      </div>
    </>
  );
}

export default function App() {
  const [step, setStep] = useState(-1);
  const [answers, setAnswers] = useState<AnswerState>({ tags: [] });
  const [showLibrary, setShowLibrary] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  // 过滤器状态
  const [filterGender, setFilterGender] = useState<string>("all");
  const [filterBrand, setFilterBrand] = useState<string>("all");
  const [filterMaxDb, setFilterMaxDb] = useState<number>(100);
  const [filterMaterial, setFilterMaterial] = useState<string>("all");

  const [topProducts, setTopProducts] = useState<
    (Product & { score: number })[]
  >([]);

  const [loadingStep, setLoadingStep] = useState(0);

  const [recommendationTips, setRecommendationTips] = useState<string[]>([]);

  const activeQuestions = questions.filter(
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

  const fetchProducts = () => {
    if (hasFetched) return Promise.resolve(allProducts);
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
        specs: `${p.material}, IPX${p.waterproof}, <${p.maxDb}dB, ${p.motorType}马达`,
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
        "⚠️ [AI] Qwen 链路中断，正在启动终极全息补偿 (Minimax)...",
        e,
      );
    }

    // 3. 尝试 Minimax
    try {
      const mmKey = process.env.MINIMAX_API_KEY;
      if (!mmKey) throw new Error("Missing Minimax Key");
      const response = await axios.post(
        "https://api.minimax.io/v1/text/chatcompletion_v2",
        {
          model: process.env.MINIMAX_MODEL || "MiniMax-M2.5-highspeed",
          messages: [{ role: "user", content: prompt }],
          bot_setting: [
            { bot_name: "专家助手", content: "你是一个专业的选品助手。" },
          ],
          temperature: 0.1,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${mmKey}`,
          },
          timeout: 30000,
        },
      );
      return JSON.parse(
        response.data.choices[0].message.content
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
    activeQs: any[] = activeQuestions,
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
      if (currentAnswers.maxDb && p.maxDb > currentAnswers.maxDb) return false;
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
            (!currentAnswers.maxDb || p.maxDb <= currentAnswers.maxDb) &&
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
            (!currentAnswers.maxDb || p.maxDb <= currentAnswers.maxDb) &&
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
          return matchOther && p.maxDb > currentAnswers.maxDb!;
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
      }, 3000);
    }
  };

  const resetQuiz = () => {
    setStep(0);
    setAnswers({ tags: [] });
    setTopProducts([]);
  };

  if (isLoading) {
    const loadingText = [
      "正在初始化神经链路...",
      "正在连接星港数据库...",
      "正在解码量子晶体...",
      "全息装备库载入中...",
    ];

    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-8 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[140px] animate-pulse"></div>
        <div className="relative z-10 flex flex-col items-center">
          <div className="relative w-32 h-32 mb-10">
            {/* 多重环绕动画 */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 border-[1px] border-dashed border-cyan-500/20 rounded-full"
            />
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
              className="absolute inset-3 border-[1px] border-cyan-500/40 rounded-full"
            />
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-10 border-2 border-indigo-500/60 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(79,70,229,0.4)]"
            >
              <Hexagon className="w-6 h-6 text-cyan-400 animate-pulse" />
            </motion.div>
          </div>

          <div className="text-center space-y-3">
            <h2 className="text-xl font-light tracking-[0.4em] text-white uppercase mb-2">
              {loadingStep === -1
                ? "链路通信中断"
                : loadingText[loadingStep] || "载入中"}
            </h2>
            {loadingStep === -1 ? (
              <button
                onClick={() => window.location.reload()}
                className="text-xs text-red-400 font-mono underline cursor-pointer"
              >
                重试链接
              </button>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="w-48 h-[1px] bg-white/10 relative overflow-hidden">
                  <motion.div
                    initial={{ left: "-100%" }}
                    animate={{ left: "100%" }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    className="absolute top-0 bottom-0 w-1/3 bg-cyan-500 shadow-[0_0_10px_#06b6d4]"
                  />
                </div>
                <p className="text-[9px] font-mono text-cyan-800 uppercase tracking-widest leading-none">
                  Establishing secure portal to inner_space_db_v2...
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (showLibrary) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-start p-4 sm:p-6 md:p-8 relative overflow-hidden overflow-y-auto w-full">
        <div className="fixed top-[-10%] left-[-10%] w-96 h-96 bg-cyan-900/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="fixed bottom-[-10%] right-[-10%] w-96 h-96 bg-indigo-900/20 rounded-full blur-3xl pointer-events-none"></div>

        <div className="w-full max-w-5xl relative z-10 pb-20">
          <button
            onClick={() => setShowLibrary(false)}
            className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 mb-8 transition-colors mt-4"
          >
            <ArrowLeft className="w-4 h-4" /> 返回指挥舱
          </button>

          <div className="text-center mb-10">
            <h1 className="text-3xl font-light tracking-widest text-white mb-2">
              全息装备晶体库
            </h1>
            <p className="text-slate-400 text-sm">
              收录当前系统链接的所有真实物理装备
            </p>
          </div>

          {/* 过滤器面板 */}
          <div className="glass-panel rounded-2xl p-6 mb-10 border border-white/5 bg-white/5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
                  适用对象
                </label>
                <select
                  value={filterGender}
                  onChange={(e) => setFilterGender(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-cyan-500/50 appearance-none"
                >
                  <option value="all">全部性别</option>
                  <option value="female">女性向</option>
                  <option value="male">男性向</option>
                  <option value="unisex">通用型</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
                  品牌厂商
                </label>
                <select
                  value={filterBrand}
                  onChange={(e) => setFilterBrand(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-cyan-500/50 appearance-none"
                >
                  <option value="all">所有品牌</option>
                  {Array.from(new Set(allProducts.map((p) => p.brand)))
                    .sort()
                    .map((brand) => (
                      <option key={brand} value={brand}>
                        {brand}
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
                  材质偏好
                </label>
                <select
                  value={filterMaterial}
                  onChange={(e) => setFilterMaterial(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-cyan-500/50 appearance-none"
                >
                  <option value="all">所有材质</option>
                  {Array.from(
                    new Set(
                      allProducts.map((p) => {
                        if (p.material.includes("硅胶")) return "硅胶";
                        if (p.material.includes("ABS")) return "ABS";
                        if (p.material.includes("TPE")) return "TPE";
                        return p.material;
                      }),
                    ),
                  )
                    .sort()
                    .map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
                    静音阈值
                  </label>
                  <span className="text-[10px] text-cyan-400 font-mono">
                    &lt;{filterMaxDb}dB
                  </span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="70"
                  step="5"
                  value={filterMaxDb}
                  onChange={(e) => setFilterMaxDb(parseInt(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {allProducts
              .filter((p) => {
                const matchGender =
                  filterGender === "all" || p.gender === filterGender;
                const matchBrand =
                  filterBrand === "all" || p.brand === filterBrand;
                const matchDb = p.maxDb <= filterMaxDb;
                const matchMaterial =
                  filterMaterial === "all" ||
                  p.material.includes(filterMaterial);
                return matchGender && matchBrand && matchDb && matchMaterial;
              })
              .map((product) => {
                return product.link ? (
                  <a
                    key={product.id}
                    href={product.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="glass-panel rounded-2xl overflow-hidden flex flex-col group hover:border-cyan-500/40 transition-all hover:bg-white/5 cursor-pointer"
                  >
                    <ProductCardContent product={product} />
                  </a>
                ) : (
                  <div
                    key={product.id}
                    className="glass-panel rounded-2xl overflow-hidden flex flex-col group hover:border-cyan-500/40 transition-all hover:bg-white/5"
                  >
                    <ProductCardContent product={product} />
                  </div>
                );
              })}
          </div>
        </div>
      </div>
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
          {step === -1 && (
            <motion.div
              key="welcome"
              variants={pageVariants}
              initial="initial"
              animate="in"
              exit="out"
              className="w-full flex flex-col items-center"
            >
              <div className="relative mb-12 flex justify-center items-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 20,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  className="absolute w-32 h-32 border border-cyan-500/20 rounded-full"
                />
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{
                    duration: 30,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  className="absolute w-40 h-40 border border-indigo-500/20 rounded-full border-dashed"
                />
                <div className="w-20 h-20 glass-panel rounded-full flex items-center justify-center relative z-10">
                  <Orbit className="w-10 h-10 text-cyan-300 opacity-90" />
                </div>
              </div>

              <div className="glass-panel rounded-3xl p-8 w-full text-center relative overflow-hidden flex flex-col items-center">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent opacity-50"></div>

                <h1 className="text-3xl font-light tracking-widest mb-2 text-white">
                  内太空装备智能选品向导
                </h1>
                <h2 className="text-xs tracking-widest text-cyan-500/80 mb-8 font-mono">
                  SELECTION GUIDE
                </h2>

                <p className="text-sm text-slate-300 mb-10 leading-relaxed max-w-[260px]">
                  跳过复杂难懂的参数陷阱与营销词汇。只需回答几个简单的偏好问题，我们将基于严密的过滤体系，为你精准匹配出最契合自身需求的私密设备。
                </p>

                <button
                  onClick={() => setStep(0)}
                  className="group relative w-full py-4 rounded-2xl bg-cyan-900/30 hover:bg-cyan-800/50 border border-cyan-500/30 text-cyan-50 transition-all overflow-hidden flex items-center justify-center gap-2"
                >
                  <motion.div
                    className="absolute inset-0 bg-cyan-400/5"
                    animate={{ scale: [1, 1.2, 1], opacity: [0, 0.8, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                  />
                  <span className="relative z-10 flex items-center gap-2 tracking-widest text-sm font-medium">
                    开始匹配{" "}
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </button>

                <button
                  onClick={() => {
                    if (!hasFetched) {
                      fetchProducts().then(() => setShowLibrary(true));
                    } else {
                      setShowLibrary(true);
                    }
                  }}
                  className="w-full py-4 mt-4 rounded-2xl bg-indigo-900/10 hover:bg-indigo-800/30 border border-indigo-500/20 text-indigo-200 transition-all text-sm tracking-widest flex items-center justify-center"
                >
                  浏览全息装备库
                </button>

                <div className="mt-6 flex justify-center items-center gap-6 text-[10px] text-slate-500 font-mono tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-800" />{" "}
                    绝对隐秘
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-cyan-800" /> 量化推荐
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Question Cards */}
          {step >= 0 && step < activeQuestions.length && (
            <motion.div
              key={`q-${step}`}
              variants={pageVariants}
              initial="initial"
              animate="in"
              exit="out"
              className="w-full"
            >
              <div className="mb-8 flex justify-between items-center px-2">
                <span className="text-xs font-mono text-cyan-500/70 tracking-widest">
                  PHASE 0{step + 1}
                </span>
                <div className="flex gap-1">
                  {activeQuestions.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 rounded-full transition-all duration-500 ${i === step ? "w-6 bg-cyan-400" : i < step ? "w-2 bg-cyan-800" : "w-2 bg-white/10"}`}
                    />
                  ))}
                </div>
              </div>

              <div className="glass-panel rounded-3xl p-6 sm:p-8">
                <h2 className="text-xl font-medium text-white mb-2">
                  {activeQuestions[step].title}
                </h2>
                <p className="text-sm text-slate-400 mb-8">
                  {activeQuestions[step].subtitle}
                </p>

                <div className="space-y-3">
                  {activeQuestions[step].options.map((option, idx) => (
                    <button
                      key={idx}
                      onClick={() =>
                        handleOptionSelect(
                          activeQuestions[step].field,
                          option.value,
                          option.tag,
                        )
                      }
                      className="w-full text-left glass-button rounded-2xl p-5 flex items-center gap-4 group"
                    >
                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
                        {idx === 0 ? (
                          <CircleDashed className="w-4 h-4 text-cyan-300" />
                        ) : idx === 1 ? (
                          <Hexagon className="w-4 h-4 text-indigo-300" />
                        ) : (
                          <Triangle className="w-4 h-4 text-purple-300" />
                        )}
                      </div>
                      <span className="text-sm text-slate-200 group-hover:text-white transition-colors">
                        {option.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Loading State */}
          {step === activeQuestions.length && (
            <motion.div
              key="loading"
              variants={pageVariants}
              initial="initial"
              animate="in"
              exit="out"
              className="flex flex-col items-center justify-center py-12"
            >
              <div className="radar-container mb-12">
                <div className="radar-sweep"></div>
                <Orbit className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-cyan-500/50" />
              </div>

              <div className="text-center space-y-4 h-24">
                <p className="text-xs font-mono text-cyan-500/70 tracking-widest mb-4">
                  {isAiMatching ? "AI 专家深度匹配中..." : "解析物理标签中..."}
                </p>
                {answers.tags.slice(0, 3).map((tag, i) => (
                  <motion.div
                    key={tag}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.8 }}
                    className="text-lg font-light text-white tag-flash"
                  >
                    {tag}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Results Screen */}
          {step === activeQuestions.length + 1 && (
            <motion.div
              key="result"
              variants={pageVariants}
              initial="initial"
              animate="in"
              exit="out"
              className="w-full space-y-6"
            >
              <div className="text-center mb-6">
                <h2 className="text-2xl font-light text-white mb-2">
                  匹配完成
                </h2>
                <div className="flex flex-wrap justify-center gap-1.5 mb-4 max-w-sm mx-auto">
                  {answers.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded border border-white/10 bg-white/5 text-[10px] text-slate-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-slate-400">
                  基于你的以上偏好，我们找到了如下装备
                </p>
              </div>

              {/* AI 优化建议横幅 */}
              {recommendationTips.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-8"
                >
                  <div className="flex items-center gap-2 mb-2 text-amber-400">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-xs font-medium tracking-wider uppercase">
                      AI 匹配建议
                    </span>
                  </div>
                  <ul className="space-y-1.5">
                    {recommendationTips.map((tip, i) => (
                      <li
                        key={i}
                        className="text-[11px] text-amber-200/70 leading-relaxed flex gap-2"
                      >
                        <span className="shrink-0">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}

              {topProducts.length > 0 ? (
                <div className="space-y-4">
                  {/* Top 1 Product */}
                  <div className="relative overflow-hidden rounded-3xl border border-cyan-500/30 bg-cyan-950/20 backdrop-blur-xl p-1">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-500"></div>

                    <div className="h-36 w-full rounded-2xl overflow-hidden mb-4 relative bg-black/20">
                      {topProducts[0].imagePlaceholder.startsWith("http") ? (
                        <img
                          src={topProducts[0].imagePlaceholder}
                          className="w-full h-full object-cover opacity-90"
                        />
                      ) : (
                        <div
                          className={`w-full h-full ${topProducts[0].imagePlaceholder} flex items-center justify-center`}
                        >
                          <Sparkles className="w-8 h-8 text-white/50" />
                        </div>
                      )}
                    </div>
                    <div className="px-5 pb-5">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="inline-block px-2 py-1 rounded-md bg-cyan-500/20 text-cyan-300 text-[10px] font-mono mb-2">
                            算法最匹配 (TOP 1)
                          </span>
                          <h3 className="text-lg font-medium text-white">
                            {topProducts[0].name}
                          </h3>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-lg font-semibold text-cyan-400">
                            ¥{topProducts[0].price}
                          </span>
                          {topProducts[0].link && (
                            <a
                              href={topProducts[0].link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-cyan-500/80 underline mt-1"
                            >
                              立即探索
                            </a>
                          )}
                        </div>
                      </div>

                      {topProducts[0].tags &&
                        topProducts[0].tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-4 mt-2">
                            {topProducts[0].tags.map((tag, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-slate-400"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                      {topProducts[0].reason && (
                        <div className="mt-4 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                          <p className="text-[11px] text-cyan-200/80 leading-relaxed italic">
                            <Sparkles className="w-3 h-3 inline-block mr-1 mb-0.5 text-cyan-400" />
                            “ {topProducts[0].reason} ”
                          </p>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 mt-4">
                        <div className="flex items-center gap-1 text-xs text-slate-300 bg-white/5 px-2 py-1 rounded">
                          <VolumeX className="w-3 h-3" /> &lt;
                          {topProducts[0].maxDb}dB
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-300 bg-white/5 px-2 py-1 rounded">
                          <Droplets className="w-3 h-3" /> IPX
                          {topProducts[0].waterproof}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-300 bg-white/5 px-2 py-1 rounded">
                          <Zap className="w-3 h-3" />{" "}
                          {topProducts[0].motorType === "gentle"
                            ? "温柔"
                            : "强力"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Top 2 & 3 Products */}
                  <div className="grid grid-cols-2 gap-4">
                    {topProducts.slice(1, 3).map((product, idx) => (
                      <div
                        key={product.id}
                        className="glass-panel rounded-2xl p-3 flex flex-col"
                      >
                        <div className="h-24 w-full rounded-xl overflow-hidden mb-3 relative bg-black/20">
                          {product.imagePlaceholder.startsWith("http") ? (
                            <img
                              src={product.imagePlaceholder}
                              className="w-full h-full object-cover opacity-90"
                            />
                          ) : (
                            <div
                              className={`w-full h-full ${product.imagePlaceholder} flex items-center justify-center`}
                            >
                              <Hexagon className="w-5 h-5 text-white/30" />
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className="inline-block px-1.5 py-0.5 rounded bg-white/10 text-slate-300 text-[10px]">
                            {idx === 0 ? "最具性价比" : "探索备选"}
                          </span>
                          <span className="text-[10px] text-cyan-500/70">
                            {product.brand}
                          </span>
                        </div>
                        <h3 className="text-sm font-medium text-white mb-1 truncate leading-tight">
                          {product.name}
                        </h3>
                        {product.tags && product.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {product.tags.slice(0, 2).map((tag, i) => (
                              <span
                                key={i}
                                className="text-[8px] bg-indigo-500/10 text-indigo-300/80 border border-indigo-500/20 px-1 py-0.5 rounded"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        {product.reason && (
                          <p className="text-[9px] text-slate-400 mb-2 line-clamp-2 italic leading-tight">
                            “{product.reason}”
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-auto pt-2">
                          {product.link ? (
                            <>
                              <span className="text-sm text-cyan-400">
                                ¥{product.price}
                              </span>
                              <a
                                href={product.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-cyan-500/80 underline hover:text-cyan-400 transition-colors"
                              >
                                立即探索
                              </a>
                            </>
                          ) : (
                            <span className="text-sm text-cyan-400">
                              ¥{product.price}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="glass-panel rounded-3xl p-8 text-center">
                  <p className="text-slate-300">
                    未找到完全匹配的装备，请尝试放宽条件。
                  </p>
                </div>
              )}

              <button
                onClick={resetQuiz}
                className="w-full py-4 mt-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition-colors text-sm"
              >
                重新校准
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
