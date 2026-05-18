import { motion } from "motion/react";
import { ArrowLeft, MessageSquareText, ScrollText } from "lucide-react";

export function MatchModePage({
  pageVariants,
  onSelectQuizMode,
  onSelectNaturalLanguageMode,
  onBackHome,
}: {
  pageVariants: any;
  onSelectQuizMode: () => void;
  onSelectNaturalLanguageMode: () => void;
  onBackHome: () => void;
}) {
  return (
    <motion.div
      key="match-mode"
      variants={pageVariants}
      initial="initial"
      animate="in"
      exit="out"
      className="relative min-h-screen w-full px-4 py-8 sm:px-6 md:px-8"
    >
      <div className="mx-auto w-full max-w-4xl">
        <button
          type="button"
          onClick={onBackHome}
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-white/[0.07] hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回首页
        </button>

        <div className="mb-8 text-center">
          <p className="mb-2 font-mono text-[10px] tracking-[0.3em] text-cyan-200/48">
            MATCH MODE
          </p>
          <h1 className="text-2xl font-light tracking-wide text-white sm:text-3xl">
            开始匹配
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            你可以通过结构化答题，也可以直接用自然语言描述需求，我们都会在现有装备库中帮你匹配。
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={onSelectQuizMode}
            className="rounded-[1.6rem] border border-cyan-300/18 bg-cyan-400/[0.05] p-6 text-left transition-all hover:-translate-y-0.5 hover:border-cyan-300/35 hover:bg-cyan-300/[0.08]"
          >
            <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
              <ScrollText className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-medium text-white">答题匹配</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              逐步回答场景、静音、预算和刺激路线等问题，得到更结构化的匹配结果。
            </p>
          </button>

          <button
            type="button"
            onClick={onSelectNaturalLanguageMode}
            className="rounded-[1.6rem] border border-violet-300/18 bg-violet-400/[0.05] p-6 text-left transition-all hover:-translate-y-0.5 hover:border-violet-300/35 hover:bg-violet-300/[0.08]"
          >
            <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-violet-300/20 bg-violet-300/10 text-violet-100">
              <MessageSquareText className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-medium text-white">自然语言匹配</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              直接描述你想要的感觉、场景或限制条件，我们会从现有装备库里帮你匹配。
            </p>
            <p className="mt-4 text-xs leading-5 text-slate-500">
              你可以从这些方向来描述：想要的感觉、使用场景、预算静音、防水便携、经验状态。
            </p>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
