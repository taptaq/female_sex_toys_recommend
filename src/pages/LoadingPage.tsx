import { motion } from "motion/react";
import { Hexagon } from "lucide-react";
import { FloatingKnowledgeField } from "../components/FloatingKnowledgeField";
import { getLoadingFunFacts } from "../lib/loading-fun-facts.ts";

const loadingFunFacts = getLoadingFunFacts("loading", {
  preferredThemes: ["care", "decision", "experience"],
});

export function LoadingPage({
  loadingStep,
}: {
  loadingStep: number;
}) {
  const loadingText = [
    "正在初始化神经链路...",
    "正在连接星港数据库...",
    "正在解码量子晶体...",
    "全息装备库载入中...",
  ];

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-8 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[140px] animate-pulse"></div>
      <FloatingKnowledgeField facts={loadingFunFacts} variant="loading" />
      <div className="relative z-10 flex w-full max-w-3xl flex-col items-center">
        <div className="relative w-32 h-32 mb-10">
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
              <p className="text-[10px] font-mono text-cyan-200/45 tracking-[0.22em] leading-none">
                正在建立通往全息装备库的安全链路...
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
