import { useEffect, useRef } from "react";
import gsap from "gsap";
import { motion } from "motion/react";
import { ArrowLeft, CircleDashed, Hexagon, Sparkles, Triangle } from "lucide-react";
import type { AnswerState, Question } from "../data/mock.ts";
import { getGsapDuration } from "../lib/gsap-motion.ts";
import { usePagePerformanceState } from "../lib/page-performance.ts";

const QUIZ_PROMPT_ART = [
  "/assets/quiz-art/prompt-orbit.png",
  "/assets/quiz-art/prompt-star.png",
  "/assets/quiz-art/prompt-cloud.png",
] as const;

export function QuizPage({
  pageVariants,
  step,
  activeQuestions,
  onSelectOption,
  onBackQuestion,
  onBackHome,
  onBackResults,
  onJumpToQuestion,
  shouldPlayLanding = false,
}: {
  pageVariants: any;
  step: number;
  activeQuestions: Question[];
  shouldPlayLanding?: boolean;
  onSelectOption: (
    field: keyof AnswerState,
    value: AnswerState[keyof AnswerState],
    tag: string,
    answerPatch?: Partial<Omit<AnswerState, "tags">>,
    optionLabel?: string,
  ) => void;
  onBackQuestion: () => void;
  onBackHome: () => void;
  onBackResults?: () => void;
  onJumpToQuestion?: (questionIndex: number) => void;
}) {
  const currentQuestion = activeQuestions[step];
  const promptArtSrc = QUIZ_PROMPT_ART[step % QUIZ_PROMPT_ART.length];
  const { shouldAnimate, prefersReducedMotion } = usePagePerformanceState();
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!cardRef.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        cardRef.current,
        { autoAlpha: 0, y: 18, scale: 0.98 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: getGsapDuration(0.34, { shouldAnimate, prefersReducedMotion }),
          ease: "power2.out",
        },
      );
    }, cardRef);

    return () => ctx.revert();
  }, [step, shouldAnimate, prefersReducedMotion]);

  return (
    <motion.div
      key={`q-${step}`}
      variants={pageVariants}
      initial="initial"
      animate="in"
      exit="out"
      className={[
        "female-mvp-quiz relative left-1/2 flex min-h-[100svh] w-screen -translate-x-1/2 flex-col overflow-x-hidden overflow-y-auto px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4",
        shouldAnimate ? "" : "ambient-motion-paused",
      ].join(" ")}
    >
      <div className="female-mvp-quiz__stars" aria-hidden="true" />
      <div className="female-mvp-quiz__orb female-mvp-quiz__orb-rose" aria-hidden="true" />
      <div className="female-mvp-quiz__orb female-mvp-quiz__orb-blue" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex w-full max-w-xl items-center justify-between gap-3 px-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/62 px-3 py-1.5 text-xs font-semibold tracking-normal text-slate-600 shadow-[0_10px_26px_rgba(196,124,146,0.14)] backdrop-blur-md transition-colors hover:bg-white/86 hover:text-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200/90"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>返回</span>
          </button>
          {onBackResults ? (
            <button
              type="button"
              onClick={onBackResults}
              className="inline-flex items-center gap-2 rounded-full border border-sky-100/80 bg-white/58 px-3 py-1.5 text-xs font-semibold tracking-normal text-sky-600 shadow-[0_10px_26px_rgba(117,181,214,0.14)] backdrop-blur-md transition-colors hover:bg-white/86 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/80"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>返回结果页</span>
            </button>
          ) : null}
        </div>
        {step > 0 ? (
          <button
            type="button"
            onClick={onBackQuestion}
            className="inline-flex items-center gap-2 rounded-full border border-rose-100/90 bg-white/54 px-3 py-1.5 text-xs font-semibold tracking-normal text-rose-500 shadow-[0_10px_26px_rgba(244,114,182,0.12)] backdrop-blur-md transition-colors hover:bg-white/86 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200/90"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>上一题</span>
          </button>
        ) : null}
      </div>

      <div className="relative z-10 mx-auto mt-5 flex w-full max-w-xl items-center justify-between gap-4 px-1">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/72 bg-white/58 px-3 py-1.5 text-[11px] font-bold tracking-[0.08em] text-sky-600 shadow-[0_10px_28px_rgba(117,181,214,0.14)]">
          <Sparkles className="h-3.5 w-3.5 text-rose-400" />
          第 {step + 1} / {activeQuestions.length} 题
        </span>
        <div className="flex flex-1 justify-end gap-1.5">
          {activeQuestions.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => {
                if (index < step) {
                  onJumpToQuestion?.(index);
                }
              }}
              disabled={index >= step}
              title={index < step ? `返回修改第 ${index + 1} 题` : undefined}
              className={[
                "h-2 rounded-full transition-all duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200/90",
                index === step
                  ? "w-9 bg-rose-400 shadow-[0_8px_18px_rgba(244,114,182,0.32)]"
                  : index < step
                    ? "w-4 cursor-pointer bg-sky-300 hover:bg-sky-400"
                    : "w-4 bg-white/62",
                index >= step ? "cursor-default" : "",
              ].join(" ")}
            />
          ))}
        </div>
      </div>

      <div
        ref={cardRef}
        className="female-mvp-quiz-card relative z-10 mx-auto mt-4 w-full max-w-xl shrink-0 rounded-[2rem] border border-white/78 bg-white/70 p-5 text-slate-800 shadow-[0_24px_80px_rgba(196,124,146,0.2)] backdrop-blur-xl sm:mt-6 sm:rounded-[2.4rem] sm:p-8"
      >
        <div className="female-mvp-quiz-card__clip" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
        <div className="pointer-events-none absolute -right-14 -top-16 h-40 w-40 rounded-full bg-sky-200/42 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-14 h-44 w-44 rounded-full bg-rose-200/46 blur-3xl" />
        <div className="female-mvp-quiz__prompt-art" aria-hidden="true">
          <img
            src={promptArtSrc}
            alt=""
            className="female-mvp-quiz__prompt-art-image"
          />
        </div>
        <div className="relative z-10">
          <div className="flex flex-col items-center text-center">
            <div
              className={[
                "female-mvp-quiz__astronaut",
                shouldPlayLanding ? "female-mvp-quiz__astronaut-landing" : "",
              ].join(" ")}
              role="img"
              aria-label="Luna 正在帮你校准"
            >
              {shouldPlayLanding ? (
                <span className="female-mvp-quiz__entry-glow" aria-hidden="true" />
              ) : null}
              <span className="female-mvp-quiz__astronaut-figure">
                <img
                  src="/assets/quiz-art/luna.png"
                  alt=""
                  className="female-mvp-quiz__astronaut-image"
                />
                <img
                  src="/assets/quiz-art/luna-eyes-closed.png"
                  alt=""
                  className="female-mvp-quiz__astronaut-image female-mvp-quiz__astronaut-blink-patch"
                />
              </span>
            </div>
            <span className="mt-5 inline-flex items-center rounded-full border border-white/76 bg-white/64 px-3.5 py-1.5 text-xs font-bold tracking-[0.12em] text-rose-500 shadow-[0_10px_26px_rgba(244,114,182,0.14)]">
              Luna 正在帮你校准
            </span>
          </div>
          <div className="mt-5 rounded-[1.35rem] border border-rose-100/82 bg-white/58 px-4 py-3">
            <p className="text-[12px] leading-6 tracking-normal text-slate-600">
              拿不准也没关系，可先让系统帮你判断，再从结果里回看哪条路线更贴近你。
            </p>
          </div>
          <h2 className="mt-6 text-2xl font-black leading-tight tracking-normal text-slate-900 sm:text-3xl">
            {currentQuestion.title}
          </h2>
          <p className="mt-3 text-[15px] leading-7 tracking-normal text-slate-600">
            {currentQuestion.subtitle}
          </p>
        </div>

        <div className="relative z-10 mt-7 space-y-3">
          {currentQuestion.options.map((option, index) => (
            <button
              key={index}
              onClick={() =>
                onSelectOption(
                  currentQuestion.field,
                  option.value,
                  option.tag,
                  option.answerPatch,
                  option.label,
                )
              }
              className="female-mvp-option group relative flex w-full items-center gap-4 overflow-hidden rounded-[1.35rem] border p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-200/90 sm:p-5"
            >
              <span className="pointer-events-none absolute inset-y-3 left-0 w-1 rounded-full bg-rose-200/74 transition-colors group-hover:bg-rose-400" />
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/76 bg-white/68 text-rose-400 shadow-[0_10px_24px_rgba(244,114,182,0.14)] transition-colors group-hover:text-sky-500">
                {index === 0 ? (
                  <CircleDashed className="h-4 w-4" />
                ) : index === 1 ? (
                  <Hexagon className="h-4 w-4" />
                ) : (
                  <Triangle className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0">
                <span className="mb-1 block text-[11px] font-bold tracking-[0.1em] text-sky-500">
                  选项 {index + 1}
                </span>
                <span className="block text-sm font-semibold leading-relaxed tracking-normal text-slate-700 transition-colors group-hover:text-slate-900">
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
