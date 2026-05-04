import { motion } from "motion/react";
import { ArrowLeft, CircleDashed, Hexagon, Radar, Triangle } from "lucide-react";
import type { AnswerState, Question } from "../data/mock";
import { usePagePerformanceState } from "../lib/page-performance.ts";

export function QuizPage({
  pageVariants,
  step,
  activeQuestions,
  onSelectOption,
  onBackQuestion,
  onBackHome,
}: {
  pageVariants: any;
  step: number;
  activeQuestions: Question[];
  onSelectOption: (
    field: keyof AnswerState,
    value: AnswerState[keyof AnswerState],
    tag: string,
    answerPatch?: Partial<Omit<AnswerState, "tags">>,
  ) => void;
  onBackQuestion: () => void;
  onBackHome: () => void;
}) {
  const currentQuestion = activeQuestions[step];
  const { shouldAnimate } = usePagePerformanceState();

  return (
    <motion.div
      key={`q-${step}`}
      variants={pageVariants}
      initial="initial"
      animate="in"
      exit="out"
      className={[
        "quiz-scan-shell relative isolate left-1/2 flex w-screen -translate-x-1/2 flex-col items-center justify-center overflow-hidden px-4 py-3 sm:px-6",
        shouldAnimate ? "" : "ambient-motion-paused",
      ].join(" ")}
    >
      <div className="quiz-starfield pointer-events-none absolute inset-0 -z-10 opacity-75" />
      <div className="pointer-events-none absolute -right-20 top-20 -z-10 h-56 w-56 rounded-full bg-cyan-400/8 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-8rem] left-[-4rem] -z-10 h-64 w-64 rounded-full bg-indigo-400/10 blur-3xl" />
      <div className="pointer-events-none absolute left-[10%] top-[18%] -z-10 h-1.5 w-1.5 rounded-full bg-cyan-100/70 shadow-[0_0_16px_rgba(186,230,253,0.5)]" />
      <div className="pointer-events-none absolute right-[18%] top-[26%] -z-10 h-1 w-1 rounded-full bg-slate-100/60 shadow-[0_0_12px_rgba(255,255,255,0.35)]" />
      <div className="pointer-events-none absolute left-[24%] bottom-[24%] -z-10 h-1 w-1 rounded-full bg-indigo-200/50 shadow-[0_0_14px_rgba(165,180,252,0.35)]" />

      <div className="mb-4 flex w-full max-w-xl items-center justify-between gap-3 px-1 sm:px-2">
        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex items-center gap-2 rounded-full border border-cyan-300/18 bg-slate-950/50 px-3 py-1.5 text-xs text-cyan-100/85 shadow-[0_0_24px_rgba(8,47,73,0.18)] backdrop-blur-md transition-colors hover:border-cyan-200/36 hover:bg-cyan-300/10 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>返回首页</span>
        </button>
        {step > 0 ? (
          <button
            type="button"
            onClick={onBackQuestion}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/42 px-3 py-1.5 text-xs text-slate-300 backdrop-blur-md transition-colors hover:border-cyan-200/24 hover:bg-cyan-300/8 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>上一题</span>
          </button>
        ) : null}
      </div>

      <div className="mb-6 flex w-full max-w-xl items-center justify-between gap-4 px-1 sm:px-2">
        <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/16 bg-cyan-300/8 px-3 py-1.5 font-mono text-[10px] tracking-[0.22em] text-cyan-100/78">
          <Radar className="h-3.5 w-3.5" />
          SCAN PHASE {String(step + 1).padStart(2, "0")}
        </span>
        <div className="flex flex-1 justify-end gap-1.5">
          {activeQuestions.map((_, index) => (
            <div
              key={index}
              className={`h-1.5 rounded-full transition-all duration-500 ${index === step ? "w-8 bg-cyan-200 shadow-[0_0_14px_rgba(103,232,249,0.62)]" : index < step ? "w-3 bg-cyan-700/70" : "w-3 bg-white/10"}`}
            />
          ))}
        </div>
      </div>

      <div className="relative w-full max-w-xl overflow-hidden rounded-[1.8rem] border border-cyan-100/14 bg-[linear-gradient(180deg,rgba(4,18,34,0.88),rgba(1,7,18,0.96))] p-5 shadow-[0_0_70px_rgba(8,47,73,0.22)] sm:rounded-[2.2rem] sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),transparent_30%),repeating-linear-gradient(180deg,rgba(125,211,252,0.045)_0_1px,transparent_1px_8px)]" />
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/55 to-transparent" />
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="relative z-10">
          <div className="mb-5 flex items-center justify-between gap-3">
            <span className="text-[10px] tracking-[0.24em] text-cyan-100/55">
              信号校准中
            </span>
            <span className="h-px flex-1 bg-gradient-to-r from-cyan-100/20 to-transparent" />
          </div>
          <h2 className="mb-2 text-xl font-medium tracking-[0.04em] text-white sm:text-2xl">
            {currentQuestion.title}
          </h2>
          <p className="mb-8 text-sm leading-relaxed text-slate-300/72">
            {currentQuestion.subtitle}
          </p>
        </div>

        <div className="relative z-10 space-y-3">
          {currentQuestion.options.map((option, index) => (
            <button
              key={index}
              onClick={() =>
                onSelectOption(
                  currentQuestion.field,
                  option.value,
                  option.tag,
                  option.answerPatch,
                )
              }
              className="group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-white/8 bg-white/[0.035] p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-200/28 hover:bg-cyan-300/[0.075] hover:shadow-[0_0_34px_rgba(34,211,238,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/65 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:p-5"
            >
              <span className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-cyan-200/18 transition-colors group-hover:bg-cyan-100/70" />
              <span className="pointer-events-none absolute inset-0 translate-x-[-120%] bg-gradient-to-r from-transparent via-cyan-100/8 to-transparent transition-transform duration-700 group-hover:translate-x-[120%]" />
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-100/12 bg-slate-950/56 text-cyan-100/75 transition-colors group-hover:border-cyan-100/28 group-hover:bg-cyan-300/12 group-hover:text-white">
                {index === 0 ? (
                  <CircleDashed className="h-4 w-4" />
                ) : index === 1 ? (
                  <Hexagon className="h-4 w-4" />
                ) : (
                  <Triangle className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0">
                <span className="mb-1 block font-mono text-[9px] tracking-[0.22em] text-cyan-100/38">
                  SIGNAL CHANNEL {String(index + 1).padStart(2, "0")}
                </span>
                <span className="block text-sm leading-relaxed text-slate-200 transition-colors group-hover:text-white">
                  {option.label}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
