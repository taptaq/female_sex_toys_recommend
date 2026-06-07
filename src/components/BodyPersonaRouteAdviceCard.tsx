import type { BodyPersonaFullReport } from "../lib/body-persona-report.ts";

function renderList(title: string, items: string[], toneClassName: string) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className={`rounded-2xl border border-sky-100 p-4 ${toneClassName}`}>
      <p className="text-[11px] font-black tracking-wide text-sky-700">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item} className="text-[13px] font-semibold leading-6 text-slate-600">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BodyPersonaRouteAdviceCard({
  report,
}: {
  report: BodyPersonaFullReport;
}) {
  return (
    <section className="rounded-3xl border border-sky-100 bg-white/78 p-5">
      <p className="text-[11px] font-black tracking-[0.24em] text-sky-700">长期路线建议</p>
      <p className="mt-3 text-sm font-black leading-7 text-slate-800">{report.bestRouteSummary}</p>
      <p className="mt-2 text-[13px] font-semibold leading-6 text-slate-600">{report.growthTip}</p>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {renderList("更适合的路线", report.goodFits, "bg-emerald-400/[0.05]")}
        {renderList("暂不优先", report.avoidNotes, "bg-rose-400/[0.05]")}
        {renderList("适配场景", report.sceneMatches, "bg-cyan-300/[0.05]")}
        {renderList("节奏建议", report.paceAdvice, "bg-white/78")}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {renderList("优先关注参数", report.parameterFocus, "bg-white/78")}
        {renderList("可能错配的信号", report.mismatchWarnings, "bg-amber-400/[0.05]")}
      </div>
    </section>
  );
}
