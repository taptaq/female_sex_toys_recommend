import type { BodyPersonaFullReport } from "../lib/body-persona-report.ts";

export function BodyPersonaProductMatchesCard({
  report,
}: {
  report: BodyPersonaFullReport;
}) {
  return (
    <section className="rounded-3xl border border-sky-100 bg-white/78 p-5">
      <p className="text-[11px] font-black tracking-[0.24em] text-sky-700">选品方向装载</p>
      <p className="mt-3 text-[13px] font-semibold leading-6 text-slate-600">
        {report.pickReasonSummary}
      </p>

      {report.topCategoryMatches.length > 0 ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {report.topCategoryMatches.map((match) => (
            <article
              key={match.id}
              className="rounded-2xl border border-sky-100 bg-sky-50/72 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black text-slate-800">{match.label}</p>
                <span className="text-sm font-black text-sky-700">{match.fitScore}</span>
              </div>
              <p className="mt-2 text-[13px] font-semibold leading-6 text-slate-600">{match.reason}</p>
            </article>
          ))}
        </div>
      ) : null}

      {report.productPicks.length > 0 ? (
        <div className="mt-4 grid gap-3">
          {report.productPicks.map((product) => (
            <article
              key={product.id}
              className="rounded-2xl border border-cyan-300/14 bg-cyan-300/[0.04] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
              <p className="text-sm font-black text-slate-800">{product.name}</p>
                  {product.categoryLabel ? (
                    <p className="mt-1 text-[11px] font-bold text-sky-700">
                      {product.categoryLabel}
                    </p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-sky-700">
                    人格匹配分 {product.personaScore}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-500">
                    基础分 {product.score}
                  </p>
                </div>
              </div>
              {product.reason ? (
                <p className="mt-3 text-[13px] font-semibold leading-6 text-slate-600">
                  {product.reason}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
