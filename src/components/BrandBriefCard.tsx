import type { BrandBrief } from "../lib/brand-brief.ts";
import { buildKnowledgeNebulaPath } from "../lib/knowledge-nebula-route.ts";

export function BrandBriefCard({
  brief,
  title = "当前品牌",
  compact = false,
  showKnowledgeLink = true,
}: {
  brief: BrandBrief | null | undefined;
  title?: string;
  compact?: boolean;
  showKnowledgeLink?: boolean;
}) {
  if (!brief) return null;
  const href = buildKnowledgeNebulaPath("brand", brief.brandSlug);

  return (
    <section
      className={[
        "rounded-2xl border border-sky-200/70 bg-white/72 shadow-[0_0.8rem_2rem_rgba(125,211,252,0.12)]",
        compact ? "p-3" : "p-4",
      ].join(" ")}
    >
      <p className="text-[10px] font-black tracking-[0.2em] text-sky-500/80">{title}</p>
      <h3 className="mt-2 text-sm font-black text-slate-900">
        {brief.brandName}
        {brief.countryLabel ? ` · ${brief.countryLabel}` : ""}
      </h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{brief.positioning}</p>
      <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{brief.styleSummary}</p>
      {showKnowledgeLink && href ? (
        <a
          href={href}
          className="mt-3 inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-[11px] font-black text-sky-600 transition-colors hover:border-sky-300 hover:bg-sky-100"
        >
          去知识星云看完整品牌介绍
        </a>
      ) : null}
    </section>
  );
}
