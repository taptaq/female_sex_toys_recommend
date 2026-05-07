import { motion } from "motion/react";
import { Orbit } from "lucide-react";
import { FloatingKnowledgeField } from "../components/FloatingKnowledgeField.tsx";
import { getLoadingFunFacts } from "../lib/loading-fun-facts.ts";
import { usePagePerformanceState } from "../lib/page-performance.ts";

export function MatchingPage({
  pageVariants,
  mode = "matching",
  loadingStep = 0,
  isAiMatching,
  tags,
}: {
  pageVariants: any;
  mode?: "loading" | "matching";
  loadingStep?: number;
  isAiMatching: boolean;
  tags: string[];
}) {
  const { repeat, shouldAnimate } = usePagePerformanceState();
  const loadingText = [
    "正在初始化神经链路...",
    "正在连接星港数据库...",
    "正在解码量子晶体...",
    "正在统一分析环境...",
  ];
  const isLoadingMode = mode === "loading";
  const matchingFunFacts = getLoadingFunFacts(isLoadingMode ? "loading" : "matching", {
    preferredTags: tags,
    preferredThemes: isLoadingMode
      ? ["care", "decision", "experience"]
      : ["decision", "care", "experience"],
  });
  const statusText =
    isLoadingMode
      ? loadingStep === -1
        ? "链路通信中断"
        : loadingText[loadingStep] || "载入中"
      : isAiMatching
      ? "AI 专家深度匹配中..."
      : "解析物理标签中...";
  const helperText = isLoadingMode
    ? "正在统一分析环境..."
    : "正在把你的偏好转译成可比较的装备信号...";

  return (
    <motion.div
      key="loading"
      variants={pageVariants}
      initial="initial"
      animate="in"
      exit="out"
      className={[
        "relative flex min-h-[calc(100vh-1.25rem)] w-full flex-col items-center justify-center overflow-visible px-4 py-10 sm:min-h-[calc(100vh-3rem)] sm:py-12 md:min-h-[calc(100vh-4rem)]",
        shouldAnimate ? "" : "ambient-motion-paused",
      ].join(" ")}
    >
      <FloatingKnowledgeField
        facts={matchingFunFacts}
        variant={isLoadingMode ? "loading" : "matching"}
      />

      <div className="radar-container relative z-10 mb-9 sm:mb-12">
        <div className="radar-sweep"></div>
        <Orbit className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-cyan-500/50" />
      </div>

      <div className="relative z-10 min-h-[11.25rem] w-full max-w-[19rem] space-y-3 text-center sm:min-h-[11rem] sm:max-w-md sm:space-y-4">
        <h2 className="text-lg font-light tracking-[0.18em] text-white sm:text-xl">
          链路解析中
        </h2>
        <p className="text-xs font-mono text-cyan-500/70 tracking-widest">
          {statusText}
        </p>
        {loadingStep === -1 && isLoadingMode ? (
          <button
            onClick={() => window.location.reload()}
            className="text-xs text-red-400 font-mono underline cursor-pointer"
          >
            重试链接
          </button>
        ) : tags.length > 0 && !isLoadingMode ? (
          tags.slice(0, 3).map((tag, index) => (
            <motion.div
              key={tag}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.8 }}
              className="text-lg font-light text-white tag-flash"
            >
              {tag}
            </motion.div>
          ))
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-48 h-[1px] bg-white/10 relative overflow-hidden">
              <motion.div
                initial={{ left: "-100%" }}
                animate={{ left: "100%" }}
                transition={{
                  duration: shouldAnimate ? 1.5 : 0.2,
                  repeat,
                  ease: "linear",
                }}
                className="absolute top-0 bottom-0 w-1/3 bg-cyan-500 shadow-[0_0_10px_#06b6d4]"
              />
            </div>
            <p className="text-[10px] font-mono text-cyan-200/45 tracking-[0.22em] leading-none">
              {helperText}
            </p>
          </div>
        )}
      </div>

    </motion.div>
  );
}
