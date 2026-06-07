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
      className="relative min-h-screen w-full px-4 py-8 text-slate-900 sm:px-6 md:px-8"
    >
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8 flex items-center gap-3">
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/82 px-3 py-1.5 text-xs font-black text-sky-600 transition-colors hover:bg-sky-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回首页
          </button>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50/82 px-3 py-1.5 text-xs font-black text-rose-500 transition-colors hover:bg-rose-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回方式选择
          </button>
        </div>

        <div className="rounded-[1.8rem] border border-sky-100 bg-white/82 p-5 shadow-[0_1.4rem_3.5rem_rgba(125,211,252,0.16)] backdrop-blur-xl sm:p-7">
          <p className="mb-2 font-mono text-[10px] font-black tracking-[0.3em] text-sky-500/76">
            NATURAL LANGUAGE MATCH
          </p>
          <h1 className="text-2xl font-black tracking-wide text-slate-950 sm:text-3xl">
            自然语言匹配
          </h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
            直接描述你想要的感觉、场景或限制条件，我们会从现有装备库里帮你匹配。
          </p>

          <div className="mt-6 rounded-2xl border border-sky-100 bg-sky-50/58 p-4">
            <p className="text-xs font-black leading-6 text-slate-700">
              你可以从这些方向来描述：
            </p>
            <p className="mt-2 text-xs font-semibold leading-6 text-sky-700">
              最容易说清楚的方式是：先写 `必须要什么`，再写 `最好是什么`，最后补 `绝对不要什么`。
            </p>
            <ul className="mt-2 space-y-1 text-xs font-semibold leading-6 text-slate-600">
              <li>想要的感觉：温和、强烈、吮吸、外部、入体、双刺激</li>
              <li>使用场景：独处、情侣、异地、宿舍、夜晚</li>
              <li>现实限制：预算、静音、防水、便携、外观低调、不要入体、不要APP、不要太吵、不要情侣款</li>
              <li>经验状态：新手、怕刺激、想进阶、一步到位</li>
            </ul>
            <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50/72 px-3 py-3 text-xs font-semibold leading-6 text-rose-700">
              例如：
              <br />
              “必须是吮吸类，最好波形更多一点，不要入体，也不要 APP。”
              <br />
              “想要一个更静音、预算 300 以内、适合女生新手、最好容易清洁的产品。”
            </div>
          </div>

          <div className="mt-6">
            <textarea
              value={prompt}
              onChange={(event) => onPromptChange(event.target.value)}
              placeholder="直接描述你的需求..."
              className="min-h-[180px] w-full rounded-2xl border border-sky-100 bg-white/90 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-sky-300"
            />
          </div>

          {error ? (
            <p className="mt-3 text-sm font-semibold text-rose-600">{error}</p>
          ) : null}

          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-500 px-5 py-2.5 text-sm font-black text-white shadow-[0_0.9rem_2rem_rgba(14,165,233,0.18)] transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <SendHorizonal className="h-4 w-4" />
            {isSubmitting ? "正在分析描述..." : "开始自然语言匹配"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
