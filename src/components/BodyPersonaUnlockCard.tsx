import { ArrowRight, Sparkles } from "lucide-react";

export function BodyPersonaUnlockCard({
  onStart,
  isBusy,
  freeSummary,
}: {
  onStart: () => void;
  isBusy: boolean;
  freeSummary: { title: string; blurb: string } | null;
}) {
  return (
    <section className="relative overflow-hidden rounded-[1.75rem] border border-cyan-300/14 bg-cyan-300/[0.055] p-4 shadow-[0_18px_60px_rgba(8,47,73,0.16)] sm:p-5">
      <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/50 to-transparent" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-[11px] tracking-[0.24em] text-cyan-200/68">
            身体人格测试
          </p>
          <h3 className="mt-2 text-lg font-medium text-white">
            把这次结果再往长期适配方向补一层
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            这次推荐回答你现在该先看什么，身体人格会补充你长期更适合的节奏、隐私感和隐藏路线，不替代当前主推荐。
          </p>
          {freeSummary ? (
            <div className="mt-3 rounded-2xl border border-white/8 bg-white/[0.045] px-3 py-3">
              <div className="flex items-center gap-2 text-cyan-100/84">
                <Sparkles className="h-3.5 w-3.5" />
                <p className="text-[11px] tracking-wide">你上一次的长期画像</p>
              </div>
              <p className="mt-2 text-sm font-medium text-white">
                {freeSummary.title}
              </p>
              <p className="mt-1 text-[13px] leading-6 text-slate-300">
                {freeSummary.blurb}
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col items-start gap-3 lg:items-end">
          <button
            type="button"
            onClick={onStart}
            disabled={isBusy}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-300/22 bg-cyan-300/12 px-4 py-2 text-sm text-cyan-50 transition-colors hover:border-cyan-200/40 hover:bg-cyan-300/18 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>{freeSummary ? "更新长期画像" : "开始长期校准"}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
          <p className="text-xs leading-5 text-cyan-100/74">
            免费先看基础画像，完整报告 0.5 元解锁；它更像长期路线补充，不是重新做一轮主匹配。
          </p>
        </div>
      </div>
    </section>
  );
}
