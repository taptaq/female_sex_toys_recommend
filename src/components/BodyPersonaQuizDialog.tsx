import { X } from "lucide-react";
import { createPortal } from "react-dom";

import type {
  BodyPersonaAnswers,
  BodyPersonaQuestion,
  BodyPersonaQuestionId,
  BodyPersonaAnswerValue,
} from "../lib/body-persona.ts";

export function BodyPersonaQuizDialog({
  questions,
  answers,
  onClose,
  onChangeAnswer,
  onSubmit,
  isSubmitting,
}: {
  questions: readonly BodyPersonaQuestion[];
  answers: BodyPersonaAnswers;
  onClose: () => void;
  onChangeAnswer: (
    questionId: BodyPersonaQuestionId,
    value: BodyPersonaAnswerValue,
  ) => void;
  onSubmit: () => void | Promise<void>;
  isSubmitting: boolean;
}) {
  const completedCount = questions.filter((question) => answers[question.id]).length;

  const dialogContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-sky-950/18 px-3 py-2 backdrop-blur-xl sm:px-4 sm:py-2">
      <div className="relative flex h-[calc(100dvh-1rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[1.5rem] border border-sky-100 bg-white/95 text-slate-900 shadow-[0_1.5rem_4rem_rgba(125,211,252,0.2)] sm:h-[calc(100dvh-1rem)] sm:rounded-[1.75rem]">
        <div className="shrink-0 px-4 pt-4 sm:px-6 sm:pt-6">
          <div className="relative flex items-start justify-between gap-4 overflow-hidden rounded-[1.125rem] border border-sky-100 bg-sky-50/72 px-4 py-4 shadow-[0_1rem_2.4rem_rgba(125,211,252,0.14)] ring-1 ring-white/80 backdrop-blur-2xl sm:rounded-[1.25rem] sm:px-6 sm:py-5">
            <div className="pointer-events-none absolute inset-x-4 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-100/30 to-transparent" />
            <div>
              <p className="text-[11px] font-black tracking-[0.24em] text-sky-500/76">
                身体人格测试
              </p>
              <h3 className="mt-2 text-lg font-black text-slate-950">
                {questions.length} 道题，定位你长期更适合的装备路线
              </h3>
              <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                已完成 {completedCount} / {questions.length}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-sky-200 bg-white/86 text-sky-500 transition-colors hover:bg-sky-50"
              aria-label="关闭身体人格测试"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          <div className="space-y-4">
            {questions.map((question, index) => (
              <section
                key={question.id}
                className="rounded-[1.125rem] border border-sky-100 bg-white/72 p-3.5 sm:rounded-2xl sm:p-4"
              >
                <div className="mb-3 flex items-start gap-3">
                  <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-sky-200 bg-sky-50 px-2 text-[11px] font-black text-sky-600">
                    {index + 1}
                  </span>
                  <div>
                    <h4 className="text-sm font-black leading-6 text-slate-800">
                      {question.title}
                    </h4>
                  </div>
                </div>
                <div className="grid gap-2">
                  {question.options.map((option) => {
                    const isSelected = answers[question.id] === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => onChangeAnswer(question.id, option.value)}
                        className={[
                          "rounded-[1rem] border px-3 py-3 text-left text-sm leading-6 transition-colors sm:rounded-2xl",
                          isSelected
                            ? "border-sky-300 bg-sky-100 text-sky-800"
                            : "border-sky-100 bg-white/78 text-slate-600 hover:border-sky-200 hover:bg-sky-50",
                        ].join(" ")}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>

        <div className="shrink-0 border-t border-sky-100 px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-semibold leading-5 text-slate-500">
              免费先看基础画像，再决定要不要解锁完整身体人格报告。
            </p>
            <button
              type="button"
              onClick={() => void onSubmit()}
              disabled={isSubmitting || completedCount < questions.length}
              className="inline-flex items-center justify-center rounded-full border border-sky-200 bg-sky-500 px-4 py-2 text-sm font-black text-white transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "正在生成中" : "生成我的身体人格结果"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return dialogContent;
  }

  return createPortal(dialogContent, document.body);
}
