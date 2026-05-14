import { LockKeyhole, Sparkles } from "lucide-react";

import type { BodyPersonaFullReport } from "../lib/body-persona-report.ts";
import type { BodyPersonaResult } from "../lib/body-persona.ts";

type BodyPersonaPanelStatus = "idle" | "completed_free" | "unlocking" | "unlocked";
type BodyPersonaFreeSummary = BodyPersonaResult["freeSummary"];

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function normalizeBodyPersonaFullReport(
  value: unknown,
): BodyPersonaFullReport | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const report = value as Record<string, unknown>;
  const legacyTitle = normalizeOptionalString(report.title);
  const legacyPortrait = normalizeOptionalString(report.portrait);
  const legacyHiddenRouteSummary = normalizeOptionalString(report.hiddenRouteSummary);

  const dimensionBreakdown = Array.isArray(report.dimensionBreakdown)
    ? report.dimensionBreakdown
        .map((item) =>
          item && typeof item === "object" && !Array.isArray(item)
            ? (item as Record<string, unknown>)
            : null,
        )
        .filter((item): item is Record<string, unknown> => !!item)
        .map((item) => ({
          id:
            normalizeOptionalString(item.id) as
              | BodyPersonaFullReport["dimensionBreakdown"][number]["id"]
              | null,
          label: normalizeOptionalString(item.label) ?? "维度",
          score: typeof item.score === "number" ? item.score : 0,
          summary: normalizeOptionalString(item.summary) ?? "",
        }))
        .filter(
          (
            item,
          ): item is BodyPersonaFullReport["dimensionBreakdown"][number] =>
            item.id !== null,
        )
    : [];

  const topCategoryMatches = Array.isArray(report.topCategoryMatches)
    ? report.topCategoryMatches
        .map((item) =>
          item && typeof item === "object" && !Array.isArray(item)
            ? (item as Record<string, unknown>)
            : null,
        )
        .filter((item): item is Record<string, unknown> => !!item)
        .map((item) => ({
          id: normalizeOptionalString(item.id) ?? "category",
          label: normalizeOptionalString(item.label) ?? "适配路线",
          fitScore: typeof item.fitScore === "number" ? item.fitScore : 0,
          reason: normalizeOptionalString(item.reason) ?? "",
        }))
    : [];

  const productPicks = Array.isArray(report.productPicks)
    ? report.productPicks
        .map((item) =>
          item && typeof item === "object" && !Array.isArray(item)
            ? (item as Record<string, unknown>)
            : null,
        )
        .filter((item): item is Record<string, unknown> => !!item)
        .map((item, index) => ({
          id: normalizeOptionalString(item.id) ?? `product-${index + 1}`,
          name: normalizeOptionalString(item.name) ?? "未命名产品",
          score: typeof item.score === "number" ? item.score : 0,
          personaScore: typeof item.personaScore === "number" ? item.personaScore : 0,
          reason: normalizeOptionalString(item.reason) ?? "",
          categoryLabel: normalizeOptionalString(item.categoryLabel) ?? undefined,
          tags: normalizeStringArray(item.tags),
          typeCode: normalizeOptionalString(item.typeCode),
          appearance: normalizeOptionalString(item.appearance),
          maxDb: typeof item.maxDb === "number" ? item.maxDb : null,
        }))
    : [];

  return {
    reportTitle:
      normalizeOptionalString(report.reportTitle) ??
      legacyTitle ??
      "完整星系人格档案",
    personaName:
      normalizeOptionalString(report.personaName) ?? legacyTitle ?? "身体人格画像",
    personaSubtitle:
      normalizeOptionalString(report.personaSubtitle) ?? "完整星系人格档案",
    personaManifesto:
      normalizeOptionalString(report.personaManifesto) ?? "你有一条属于自己的长期适配路线。",
    personaImageAsset: normalizeOptionalString(report.personaImageAsset),
    primaryPersonaCode:
      (normalizeOptionalString(report.primaryPersonaCode) as
        | BodyPersonaFullReport["primaryPersonaCode"]
        | null) ?? "soft_glow",
    secondaryPersonaCode:
      (normalizeOptionalString(report.secondaryPersonaCode) as
        | BodyPersonaFullReport["secondaryPersonaCode"]
        | null) ?? null,
    secondaryPersonaName: normalizeOptionalString(report.secondaryPersonaName),
    hiddenRouteCode:
      (normalizeOptionalString(report.hiddenRouteCode) as
        | BodyPersonaFullReport["hiddenRouteCode"]
        | null) ?? "zero_profile",
    hiddenRouteName:
      normalizeOptionalString(report.hiddenRouteName) ?? "低存在感型",
    hiddenPowerGrade:
      (normalizeOptionalString(report.hiddenPowerGrade) as
        | BodyPersonaFullReport["hiddenPowerGrade"]
        | null) ?? "B",
    coLivingComfortGrade:
      (normalizeOptionalString(report.coLivingComfortGrade) as
        | BodyPersonaFullReport["coLivingComfortGrade"]
        | null) ?? "medium",
    portraitShort:
      normalizeOptionalString(report.portraitShort) ??
      legacyPortrait ??
      "你有一套更适合自己身体节奏的进入方式。",
    portraitLong:
      normalizeOptionalString(report.portraitLong) ??
      legacyPortrait ??
      "完整档案会补充你的人格画像、隐藏路线与长期适配方向。",
    whyYouAreThis:
      normalizeOptionalString(report.whyYouAreThis) ?? "你的选择路径形成了稳定的身体偏好画像。",
    strengthTags: normalizeStringArray(report.strengthTags),
    growthTip:
      normalizeOptionalString(report.growthTip) ?? "先沿着适合自己的路线走，比盲目追求刺激更重要。",
    dimensionBreakdown,
    hiddenRouteSummaryShort:
      normalizeOptionalString(report.hiddenRouteSummaryShort) ??
      legacyHiddenRouteSummary ??
      "你有一条更贴合日常使用方式的隐藏路线。",
    hiddenRouteSummaryLong:
      normalizeOptionalString(report.hiddenRouteSummaryLong) ??
      legacyHiddenRouteSummary ??
      "这条路线会把边界、收纳、存在感和长期舒适度一起纳入考虑。",
    disguisePreference:
      normalizeOptionalString(report.disguisePreference) ?? "更偏好低存在感、低打扰的外观。",
    storagePreference:
      normalizeOptionalString(report.storagePreference) ?? "倾向优先选择更省心的收纳方式。",
    privacyNeedLevel: normalizeOptionalString(report.privacyNeedLevel) ?? "中",
    bestRouteSummary:
      normalizeOptionalString(report.bestRouteSummary) ?? "你更适合沿着低压力、长期可持续的路线去选。",
    goodFits: normalizeStringArray(report.goodFits),
    avoidNotes: normalizeStringArray(report.avoidNotes),
    sceneMatches: normalizeStringArray(report.sceneMatches),
    paceAdvice: normalizeStringArray(report.paceAdvice),
    parameterFocus: normalizeStringArray(report.parameterFocus),
    topCategoryMatches,
    pickReasonSummary:
      normalizeOptionalString(report.pickReasonSummary) ?? "这些方向更容易与你的身体人格形成长期匹配。",
    mismatchWarnings: normalizeStringArray(report.mismatchWarnings),
    productPicks,
    title:
      normalizeOptionalString(report.title) ??
      normalizeOptionalString(report.personaName) ??
      legacyTitle ??
      "身体人格画像",
    portrait:
      legacyPortrait ??
      normalizeOptionalString(report.portraitLong) ??
      normalizeOptionalString(report.portraitShort) ??
      "完整档案会补充你的人格画像、隐藏路线与长期适配方向。",
    hiddenRouteSummary:
      legacyHiddenRouteSummary ??
      normalizeOptionalString(report.hiddenRouteSummaryLong) ??
      normalizeOptionalString(report.hiddenRouteSummaryShort) ??
      "你有一条更适合自己的隐藏路线。",
  };
}

export function BodyPersonaResultPanel({
  status,
  freeSummary,
  fullReport,
  onUnlock,
  onOpenFullReport,
  isUnlocking,
  requiresLoginBeforeUnlock = false,
}: {
  status: BodyPersonaPanelStatus;
  freeSummary: BodyPersonaFreeSummary | null;
  fullReport: BodyPersonaFullReport | null;
  onUnlock: () => void | Promise<void>;
  onOpenFullReport?: () => void;
  isUnlocking: boolean;
  requiresLoginBeforeUnlock?: boolean;
}) {
  if (!freeSummary) {
    return null;
  }

  const isUnlocked = status === "unlocked" && !!fullReport;

  return (
    <section className="relative z-10 overflow-hidden rounded-[1.75rem] border border-cyan-200/14 bg-slate-950/56 p-5 shadow-[0_24px_90px_rgba(8,47,73,0.2)] sm:p-6">
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/45 to-transparent" />
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="rounded-3xl border border-cyan-300/14 bg-cyan-300/[0.055] p-4">
          <p className="text-[11px] tracking-[0.24em] text-cyan-200/68">
            身体人格画像
          </p>
          <h3 className="mt-2 text-xl font-medium text-white">
            {freeSummary.title}
          </h3>
          <p className="mt-3 text-sm leading-6 text-slate-200">
            {isUnlocked && fullReport?.portraitShort
              ? fullReport.portraitShort
              : freeSummary.blurb}
          </p>
          <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.045] p-3">
            <p className="text-[11px] tracking-wide text-cyan-100/80">
              为什么会是这个类型
            </p>
            <p className="mt-2 text-[13px] leading-6 text-slate-300">
              {isUnlocked && fullReport?.whyYouAreThis
                ? fullReport.whyYouAreThis
                : freeSummary.why}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <div className="mb-2 flex items-center gap-2 text-cyan-100/84">
              <Sparkles className="h-3.5 w-3.5" />
              <p className="text-[11px] tracking-wide">对这次结果的补充提示</p>
            </div>
            <ul className="space-y-1.5">
              {freeSummary.hints.map((hint, index) => (
                <li
                  key={`${hint}-${index}`}
                  className="text-[13px] leading-6 text-slate-300"
                >
                  {hint}
                </li>
              ))}
            </ul>
          </div>

          {isUnlocked && fullReport ? (
            <div className="rounded-2xl border border-cyan-300/14 bg-cyan-300/[0.05] p-4">
              <p className="text-[11px] tracking-wide text-cyan-100/82">
                完整星系人格档案已解锁
              </p>
              <p className="mt-2 text-[13px] leading-6 text-slate-200">
                {fullReport.bestRouteSummary}
              </p>
              <p className="mt-2 text-[12px] leading-5 text-cyan-100/70">
                可随时回看你的主人格画像、隐藏路线、副人格倾向与长期路线建议，作为当前主推荐之外的长期补充。
              </p>
              <button
                type="button"
                onClick={() => onOpenFullReport?.()}
                className="mt-4 inline-flex items-center justify-center rounded-full border border-cyan-300/22 bg-cyan-300/12 px-4 py-2 text-sm text-cyan-50 transition-colors hover:border-cyan-200/40 hover:bg-cyan-300/18"
              >
                再次查看完整档案
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-cyan-300/14 bg-cyan-300/[0.05] p-4">
              <div className="flex items-center gap-2 text-cyan-100/84">
                <LockKeyhole className="h-3.5 w-3.5" />
                <p className="text-[11px] tracking-wide">完整星系人格档案已锁定</p>
              </div>
              <p className="mt-2 text-[13px] leading-6 text-slate-300">
                {requiresLoginBeforeUnlock
                  ? "登录后可解锁完整星系人格档案，查看你的主人格画像、隐藏路线、副人格倾向，以及长期更适合的体验路线与产品方向。"
                  : "0.5 元解锁完整星系人格档案，查看主人格画像、隐藏路线、副人格倾向，以及长期更适合的体验路线与产品方向。"}
              </p>
              <p className="mt-2 text-[12px] leading-5 text-cyan-100/70">
                0.5 元一次解锁，可随时回看；它补充的是长期适配方向，不会替代这次主推荐。
              </p>
              <button
                type="button"
                onClick={() => void onUnlock()}
                disabled={isUnlocking}
                className="mt-4 inline-flex items-center justify-center rounded-full border border-cyan-300/22 bg-cyan-300/12 px-4 py-2 text-sm text-cyan-50 transition-colors hover:border-cyan-200/40 hover:bg-cyan-300/18 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isUnlocking
                  ? "正在解锁中"
                  : requiresLoginBeforeUnlock
                    ? "登录并解锁完整档案"
                    : "0.5 元解锁完整档案"}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
