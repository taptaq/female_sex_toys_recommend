import { motion } from "motion/react";
import { ArrowLeft, SendHorizonal } from "lucide-react";

export function NaturalLanguageMatchPage({
  pageVariants,
  prompt,
  isSubmitting,
  error,
  onPromptChange,
  onSubmit,
  onBack,
  onBackHome,
}: {
  pageVariants: any;
  prompt: string;
  isSubmitting: boolean;
  error: string | null;
  onPromptChange: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  onBackHome: () => void;
}) {
  return (
    <motion.div
      key="natural-language-match"
      variants={pageVariants}
      initial="initial"
      animate="in"
      exit="out"
      className="relative min-h-screen w-full px-4 py-8 sm:px-6 md:px-8"
    >
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8 flex items-center gap-3">
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-white/[0.07] hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回首页
          </button>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-300/16 bg-cyan-300/8 px-3 py-1.5 text-xs text-cyan-100 transition-colors hover:bg-cyan-300/14"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回方式选择
          </button>
        </div>

        <div className="rounded-[1.8rem] border border-cyan-100/14 bg-slate-950/72 p-5 shadow-[0_24px_90px_rgba(8,47,73,0.22)] sm:p-7">
          <p className="mb-2 font-mono text-[10px] tracking-[0.3em] text-cyan-200/48">
            NATURAL LANGUAGE MATCH
          </p>
          <h1 className="text-2xl font-light tracking-wide text-white sm:text-3xl">
            自然语言匹配
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            直接描述你想要的感觉、场景或限制条件，我们会从现有装备库里帮你匹配。
          </p>

          <div className="mt-6 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <p className="text-xs leading-6 text-slate-300">
              你可以从这些方向来描述：
            </p>
            <ul className="mt-2 space-y-1 text-xs leading-6 text-slate-400">
              <li>想要的感觉：温和、强烈、外部、入体、双刺激</li>
              <li>使用场景：独处、情侣、异地、宿舍、夜晚</li>
              <li>现实限制：预算、静音、防水、便携、外观低调</li>
              <li>经验状态：新手、怕刺激、想进阶、一步到位</li>
            </ul>
            <div className="mt-4 rounded-xl border border-cyan-300/10 bg-cyan-300/[0.05] px-3 py-3 text-xs leading-6 text-cyan-50/78">
              例如：
              <br />
              “想要一个更静音、预算 300 以内、适合女生新手、最好容易清洁的产品。”
              <br />
              “想找情侣共用、异地也能互动的产品，不要太吵，外观别太高调。”
            </div>
          </div>

          <div className="mt-6">
            <textarea
              value={prompt}
              onChange={(event) => onPromptChange(event.target.value)}
              placeholder="直接描述你的需求..."
              className="min-h-[180px] w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-300/35"
            />
          </div>

          {error ? (
            <p className="mt-3 text-sm text-rose-300">{error}</p>
          ) : null}

          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/22 bg-cyan-300/10 px-5 py-2.5 text-sm text-cyan-50 transition-colors hover:bg-cyan-300/16 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <SendHorizonal className="h-4 w-4" />
            {isSubmitting ? "正在分析描述..." : "开始自然语言匹配"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
