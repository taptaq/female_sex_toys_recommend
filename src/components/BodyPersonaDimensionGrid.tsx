import type { BodyPersonaFullReport } from "../lib/body-persona-report.ts";

export function BodyPersonaDimensionGrid({
  report,
}: {
  report: BodyPersonaFullReport;
}) {
  if (report.dimensionBreakdown.length === 0) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-sky-100 bg-white/78 p-5">
      <p className="text-[11px] font-black tracking-[0.24em] text-sky-700">人格维度拆解</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {report.dimensionBreakdown.map((dimension) => (
          <article
            key={dimension.id}
            className="rounded-2xl border border-sky-100 bg-sky-50/72 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-black text-slate-800">{dimension.label}</p>
              <span className="text-sm font-black text-sky-700">{dimension.score}</span>
            </div>
            <p className="mt-2 text-[13px] font-semibold leading-6 text-slate-600">
              {dimension.summary}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
