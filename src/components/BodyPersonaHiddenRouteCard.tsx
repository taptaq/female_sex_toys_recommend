import type { BodyPersonaFullReport } from "../lib/body-persona-report.ts";

export function BodyPersonaHiddenRouteCard({
  report,
}: {
  report: BodyPersonaFullReport;
}) {
  return (
    <section className="rounded-3xl border border-sky-100 bg-sky-50/72 p-5">
      <p className="text-[11px] font-black tracking-[0.24em] text-sky-700">隐藏路线显影</p>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="rounded-2xl border border-sky-100 bg-white/78 p-4">
          <p className="text-lg font-black text-slate-950">{report.hiddenRouteName}</p>
          <p className="mt-2 text-[13px] font-semibold leading-6 text-slate-600">
            {report.hiddenRouteSummaryLong}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-sky-100 bg-white/78 p-4">
            <p className="text-[11px] font-black tracking-wide text-sky-700">隐藏力</p>
            <p className="mt-2 text-xl font-black text-slate-950">{report.hiddenPowerGrade}</p>
          </div>
          <div className="rounded-2xl border border-sky-100 bg-white/78 p-4">
            <p className="text-[11px] font-black tracking-wide text-sky-700">共居安心度</p>
            <p className="mt-2 text-xl font-black text-slate-950">{report.coLivingComfortGrade}</p>
          </div>
          <div className="rounded-2xl border border-sky-100 bg-white/78 p-4">
            <p className="text-[11px] font-black tracking-wide text-sky-700">隐私需求</p>
            <p className="mt-2 text-xl font-black text-slate-950">{report.privacyNeedLevel}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
