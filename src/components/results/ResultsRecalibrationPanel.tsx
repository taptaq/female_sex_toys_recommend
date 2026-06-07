import { motion } from "motion/react";
import { AlertCircle, ChevronDown, LoaderCircle } from "lucide-react";
import {
  RECOMMENDATION_REROLL_REASON_OPTIONS,
  type RecommendationRerollReason,
} from "../../lib/recommendation-reroll.ts";

function getSelectedRerollOptionLabel(reason: RecommendationRerollReason) {
  return (
    RECOMMENDATION_REROLL_REASON_OPTIONS.find((option) => option.id === reason)
      ?.label ?? RECOMMENDATION_REROLL_REASON_OPTIONS[0].label
  );
}

type ResultsRecalibrationPanelProps = {
  isOpen: boolean;
  onToggle: () => void;
  selectedReason: RecommendationRerollReason;
  onSelectReason: (reason: RecommendationRerollReason) => void;
  buttonLabel: string;
  isRecalibrating: boolean;
  errorMessage: string | null;
  onRecalibrate: (reason: RecommendationRerollReason) => void;
};

export function ResultsRecalibrationPanel({
  isOpen,
  onToggle,
  selectedReason,
  onSelectReason,
  buttonLabel,
  isRecalibrating,
  errorMessage,
  onRecalibrate,
}: ResultsRecalibrationPanelProps) {
  const selectedOptionLabel = getSelectedRerollOptionLabel(selectedReason);

  return (
    <motion.section
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-[1.75rem] border border-cyan-300/18 bg-cyan-400/[0.055] p-4 shadow-[0_18px_70px_rgba(8,145,178,0.12)] sm:p-5"
    >
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/35 to-transparent" />
      <div className="relative space-y-4">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-white">
              对当前结果不满意？可以直接换一组
            </h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              先告诉我们你想怎么换，这会被记录成一次轻量反馈，帮助后续校准结果。
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {RECOMMENDATION_REROLL_REASON_OPTIONS.map((option) => (
                <span
                  key={`reroll-preview-${option.id}`}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-300"
                >
                  {option.label}
                </span>
              ))}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full border border-cyan-300/28 bg-cyan-300/14 px-2.5 py-1 text-[11px] text-cyan-50">
              {buttonLabel}
            </span>
            <ChevronDown
              className={[
                "h-4 w-4 shrink-0 text-slate-400 transition-transform",
                isOpen ? "rotate-180" : "",
              ].join(" ")}
            />
          </div>
        </button>

        {isOpen ? (
          <div className="space-y-4 border-t border-white/8 pt-4">
            <div className="rounded-2xl border border-sky-100 bg-white/72 px-4 py-3">
              <p className="text-sm text-white">这次你更想怎么换一版？</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {RECOMMENDATION_REROLL_REASON_OPTIONS.map((option) => {
                  const isSelected = option.id === selectedReason;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => onSelectReason(option.id)}
                  className={[
                    "rounded-2xl border px-3 py-3 text-left transition-colors",
                    isSelected
                      ? "border-cyan-300/35 bg-cyan-300/14 text-cyan-50"
                      : "border-sky-100 bg-white/72 text-slate-600 hover:border-cyan-300/24 hover:bg-cyan-50",
                  ].join(" ")}
                    >
                      <p className="text-xs font-medium">{option.label}</p>
                      <p className="mt-1 text-[11px] leading-5 text-slate-400">
                        {option.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-sky-100 bg-white/72 px-4 py-3 text-left">
              <p className="text-sm text-slate-200">
                这次会保留当前问卷和候选范围，只重新整理推荐顺序、说明理由和选购建议。
              </p>
              <p className="mt-2 text-[11px] leading-5 text-slate-500">
                当前已选：{selectedOptionLabel}。如果你只是想改一个条件，优先用上面的微调或回题修改会更直接。
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => onRecalibrate(selectedReason)}
                disabled={isRecalibrating}
                className={[
                  "inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition-all sm:w-auto sm:self-start",
                  isRecalibrating
                    ? "cursor-wait border border-cyan-300/20 bg-cyan-300/10 text-cyan-100/80"
                    : "border border-cyan-300/35 bg-cyan-300/18 text-cyan-50 hover:border-cyan-200/45 hover:bg-cyan-300/24",
                ].join(" ")}
              >
                {isRecalibrating ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    <span>正在重新整理这一版推荐，请稍候</span>
                  </>
                ) : (
                  <span>{buttonLabel}</span>
                )}
              </button>

              {errorMessage ? (
                <div className="flex items-start gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100/90">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                  <div>
                    <p>重新生成失败，当前结果已保留。</p>
                    <p className="mt-1 text-rose-100/75">{errorMessage}</p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </motion.section>
  );
}
