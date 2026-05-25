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
        "rounded-2xl border border-cyan-300/12 bg-cyan-300/[0.05]",
        compact ? "p-3" : "p-4",
      ].join(" ")}
    >
      <p className="text-[10px] tracking-[0.2em] text-cyan-200/48">{title}</p>
      <h3 className="mt-2 text-sm font-medium text-cyan-50">
        {brief.brandName}
        {brief.countryLabel ? ` · ${brief.countryLabel}` : ""}
      </h3>
      <p className="mt-2 text-sm leading-6 text-cyan-50/82">{brief.positioning}</p>
      <p className="mt-2 text-xs leading-5 text-cyan-100/68">{brief.styleSummary}</p>
      {showKnowledgeLink && href ? (
        <a
          href={href}
          className="mt-3 inline-flex items-center rounded-full border border-cyan-300/18 bg-cyan-300/10 px-3 py-1.5 text-[11px] text-cyan-50 transition-colors hover:border-cyan-200/35 hover:bg-cyan-300/16"
        >
          去知识星云看完整品牌介绍
        </a>
      ) : null}
    </section>
  );
}
