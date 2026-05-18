import type { ReactNode } from "react";
import { AlertCircle, Heart, Sparkles } from "lucide-react";

import type { RankedProduct } from "../../lib/app-shell.ts";
import {
  buildResultConfidenceSummary,
  buildResultRouteSummary,
} from "../../lib/recommendation-results.ts";

type ResultsPrimaryConfidenceSummary = ReturnType<
  typeof buildResultConfidenceSummary
>;
type ResultsPrimaryRouteSummary = ReturnType<typeof buildResultRouteSummary>;

function getConfidenceToneClassName(tone: "high" | "conditional" | "backup") {
  if (tone === "high") {
    return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
  }
  if (tone === "conditional") {
    return "border-amber-300/25 bg-amber-400/10 text-amber-100";
  }
  return "border-slate-300/20 bg-slate-400/10 text-slate-100";
}

function renderConfidenceSummary(summary: ResultsPrimaryConfidenceSummary) {
  return (
    <div className="mt-3 rounded-2xl border border-white/8 bg-white/[0.035] p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className={[
            "rounded-full border px-2.5 py-1 text-[11px]",
            getConfidenceToneClassName(summary.tone),
          ].join(" ")}
        >
          {summary.levelLabel}
        </span>
        <span className="text-[11px] text-slate-500">推荐信心与注意点</span>
      </div>

      {summary.reasons.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-[10px] font-mono tracking-wider text-cyan-300/70">
            为什么适合
          </p>
          <ul className="space-y-1">
            {summary.reasons.map((reason, index) => (
              <li
                key={`reason-${index}`}
                className="text-[11px] leading-5 text-slate-200"
              >
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="mb-1 text-[10px] font-mono tracking-wider text-amber-300/70">
          需要留意
        </p>
        <ul className="space-y-1">
          {summary.caveats.map((caveat, index) => (
            <li
              key={`caveat-${index}`}
              className="text-[11px] leading-5 text-slate-300"
            >
              {caveat}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function ResultsPrimaryRecommendationPanel({
  className,
  topProduct,
  primaryProductHref,
  primaryProductDisplayName,
  primaryProductBrandLabel,
  primaryConfidenceSummary,
  primaryRouteSummary,
  avoidanceTips,
  primaryNextStepGroupTitle,
  primaryNextStep,
  renderProductImage,
  renderClickableHint,
  isFavorited = false,
  onToggleFavorite,
}: {
  className: string;
  topProduct: RankedProduct;
  primaryProductHref?: string;
  primaryProductDisplayName: string;
  primaryProductBrandLabel: string;
  primaryConfidenceSummary: ResultsPrimaryConfidenceSummary | null;
  primaryRouteSummary: ResultsPrimaryRouteSummary | null;
  avoidanceTips: string[];
  primaryNextStepGroupTitle?: string;
  primaryNextStep?: string | null;
  renderProductImage: (product: RankedProduct, iconClassName: string) => ReactNode;
  renderClickableHint: (label?: string) => ReactNode;
  isFavorited?: boolean;
  onToggleFavorite?: (product: RankedProduct) => void | Promise<void>;
}) {
  return (
    <section className={className}>
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/45 to-transparent" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-stretch">
        <div className="relative min-h-56 overflow-hidden rounded-3xl border border-white/8 bg-black/20">
          {onToggleFavorite ? (
            <button
              type="button"
              aria-label={isFavorited ? "取消收藏" : "收藏产品"}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void onToggleFavorite(topProduct);
              }}
              className={`absolute right-4 top-4 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
                isFavorited
                  ? "border-rose-300/45 bg-rose-400/18 text-rose-100"
                  : "border-white/12 bg-slate-950/65 text-white/70 hover:border-cyan-300/35 hover:text-white"
              }`}
            >
              <Heart className={`h-4 w-4 ${isFavorited ? "fill-current" : ""}`} />
            </button>
          ) : null}
          {primaryProductHref ? (
            <>
              <a
                href={primaryProductHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`查看 ${primaryProductDisplayName} 详情`}
                className="group absolute inset-0 block overflow-hidden rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                {renderProductImage(topProduct, "h-8 w-8 text-white/50")}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent transition-opacity group-hover:opacity-90" />
                <div className="absolute bottom-4 left-4 right-24">
                  <span className="mb-2 inline-flex rounded-full border border-cyan-300/25 bg-cyan-300/12 px-2.5 py-1 font-mono text-[10px] tracking-[0.18em] text-cyan-100">
                    本轮最贴合
                  </span>
                  <p className="mb-1 text-[11px] text-cyan-200/72">
                    {primaryProductBrandLabel}
                  </p>
                  <h3 className="break-words text-xl font-medium leading-snug text-white transition-colors group-hover:text-cyan-50">
                    {primaryProductDisplayName}
                  </h3>
                </div>
              </a>
              <div className="pointer-events-none absolute bottom-4 right-4 z-10 flex shrink-0 flex-col items-end gap-2">
                <span className="text-xl font-semibold text-cyan-300">
                  ¥{topProduct.price}
                </span>
                <a
                  href={primaryProductHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pointer-events-auto group inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  {renderClickableHint()}
                </a>
              </div>
            </>
          ) : (
            <>
              {renderProductImage(topProduct, "h-8 w-8 text-white/50")}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
                <div>
                  <span className="mb-2 inline-flex rounded-full border border-cyan-300/25 bg-cyan-300/12 px-2.5 py-1 font-mono text-[10px] tracking-[0.18em] text-cyan-100">
                    本轮最贴合
                  </span>
                  <p className="mb-1 text-[11px] text-cyan-200/72">
                    {primaryProductBrandLabel}
                  </p>
                  <h3 className="break-words text-xl font-medium leading-snug text-white">
                    {primaryProductDisplayName}
                  </h3>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="text-xl font-semibold text-cyan-300">
                    ¥{topProduct.price}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col justify-between gap-4">
          <div>
            {topProduct.reason && (
              <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.055] p-3">
                <p className="text-sm leading-6 text-cyan-50/82">
                  <Sparkles className="mr-1 inline-block h-3.5 w-3.5 text-cyan-200" />
                  {topProduct.reason}
                </p>
              </div>
            )}

            {primaryConfidenceSummary && renderConfidenceSummary(primaryConfidenceSummary)}

            {primaryRouteSummary && (
              <div className="mt-3 rounded-2xl border border-cyan-300/12 bg-cyan-400/[0.05] p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-cyan-200/80" />
                  <p className="text-[11px] font-medium tracking-wide text-cyan-100/86">
                    为什么这条路线更适合你
                  </p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3">
                  <p className="text-[11px] font-medium text-cyan-100/84">
                    这次更适合先走 {primaryRouteSummary.routeLabel}
                  </p>
                  <p className="mt-1.5 text-[11px] leading-5 text-slate-200">
                    {primaryRouteSummary.summary}
                  </p>
                  <p className="mt-2 text-[11px] leading-5 text-slate-400">
                    {primaryRouteSummary.nextPriority}
                  </p>
                </div>
              </div>
            )}

            {avoidanceTips.length > 0 && (
              <div className="mt-3 rounded-2xl border border-rose-300/12 bg-rose-400/[0.05] p-3">
                <div className="mb-2 flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 text-rose-200/80" />
                  <p className="text-[11px] font-medium tracking-wide text-rose-100/88">
                    暂时不建议优先看
                  </p>
                </div>
                <ul className="space-y-1.5">
                  {avoidanceTips.map((tip, index) => (
                    <li
                      key={`avoidance-${index}`}
                      className="text-[11px] leading-5 text-rose-50/78"
                    >
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {primaryNextStep ? (
            <div className="rounded-2xl border border-amber-300/14 bg-amber-400/[0.06] p-3">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-amber-200/80" />
                <p className="text-[11px] font-medium tracking-wide text-amber-100/86">
                  下一步先做这件事
                </p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-black/10 px-3 py-3">
                <p className="text-[11px] font-medium text-amber-100/84">
                  {primaryNextStepGroupTitle}
                </p>
                <p className="mt-1.5 text-[11px] leading-5 text-slate-200">
                  {primaryNextStep}
                </p>
                <a
                  href="#result-next-steps"
                  className="mt-3 inline-flex items-center rounded-full border border-amber-300/18 bg-amber-300/10 px-2.5 py-1 text-[11px] text-amber-100/82 transition-colors hover:border-amber-200/30 hover:bg-amber-300/14"
                >
                  查看下一步建议
                </a>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
