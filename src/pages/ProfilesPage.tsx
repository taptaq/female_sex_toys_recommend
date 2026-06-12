import { useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Clock, FileText, LockKeyhole, PackageSearch, Trash2, X } from "lucide-react";
import { BrandBriefCard } from "../components/BrandBriefCard.tsx";
import type { Product } from "../data/mock.ts";
import { resolveBrandBrief } from "../lib/brand-brief.ts";
import type { SavedRecommendationProfile } from "../lib/user-recommendation-profile.ts";
import { dedupeDisplayTags } from "../lib/display-tags.ts";
import { getProductDisplayName } from "../lib/product-display-name.ts";

const ANSWER_VALUE_LABELS: Record<string, string> = {
  female: "女性向",
  male: "男性向",
  unisex: "情侣/通用",
  external: "外部刺激",
  internal: "纯入体",
  composite: "复合刺激",
  gentle: "温柔慢热",
  strong: "强刺激偏好",
  high_disguise: "高伪装",
  normal: "普通外观",
  sensitive: "敏感新手",
  balanced: "均衡体验",
  intense: "强烈体验",
  clitoral: "阴蒂/外部刺激",
  gspot: "G 点/阴道内探索",
  dual: "内外双刺激",
  nipple: "乳头/身体表面刺激",
  anal: "肛门/后庭探索",
  unsure: "部位待判断",
  required: "需要 APP/远控",
  avoid_app: "不需要 APP",
  neutral_app: "APP 不限定",
  manual: "手动控制",
  automatic: "自动模式",
  hybrid: "混合模式",
  soft: "柔和包裹",
  tight: "紧致压迫",
  slow: "慢热放松",
  daily: "日常愉悦",
  explosive: "强烈释放",
  sync: "同步互动",
  guided: "引导共玩",
  remote: "远程互动",
  wearable: "可穿戴",
  handheld: "手持",
  quiet: "安静隐蔽",
  bedroom: "卧室共玩",
  playful: "探索玩乐",
};

function formatSavedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "保存时间未知";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAnswerCondition(label: string, value: unknown) {
  if (Array.isArray(value)) {
    if (label === "预算" && value.length >= 2) {
      const [min, max] = value;
      if (typeof min === "number" && typeof max === "number") {
        if (max <= 100) return "100 元以内，先试方向";
        if (min >= 100 && max <= 300) return "100-300 元，兼顾稳定体验";
        if (min >= 300) return "300 元以上，偏一步到位";
      }
    }

    return value.length > 0
      ? value.map((item) => formatAnswerCondition(label, item)).join(" - ")
      : "未设置";
  }
  if (typeof value === "number") {
    if (label === "静音") {
      if (value <= 40) return "非常在意静音";
      if (value <= 50) return "希望尽量低打扰";
      return "声音不是主要约束";
    }
    if (label === "防水") {
      if (value >= 7) return `偏向更省心的清洁方式（约 IPX${value}）`;
      if (value >= 6) return `可接受常规清洁（约 IPX${value}）`;
    }
    return String(value);
  }
  if (typeof value === "string" && value.trim()) {
    return ANSWER_VALUE_LABELS[value.trim()] || value;
  }
  if (typeof value === "boolean") {
    return value ? "是" : "否";
  }
  return "未设置";
}

function buildProfileDecisionSummary(profile: SavedRecommendationProfile) {
  const answers = profile.payload.answers;
  const lines: string[] = [];

  const branchLabel = formatAnswerCondition("性别", answers.gender);
  const routeLabel = formatAnswerCondition("路线", answers.physicalForm);
  const motorLabel = formatAnswerCondition("电机", answers.motorType);
  const budgetLabel = formatAnswerCondition("预算", answers.budget);
  const noiseLabel = formatAnswerCondition("静音", answers.maxDb);

  if (answers.gender || answers.physicalForm || answers.motorType) {
    lines.push(
      `你当时更偏向${branchLabel}${
        answers.physicalForm ? `，想先围绕${routeLabel}来筛选` : ""
      }${answers.motorType ? `，整体也更适合${motorLabel}的反馈节奏` : ""}。`,
    );
  }

  if (answers.budget || answers.maxDb || answers.waterproof) {
    const conditionParts = [
      answers.budget ? budgetLabel : "",
      answers.maxDb != null ? noiseLabel : "",
      answers.waterproof != null
        ? formatAnswerCondition("防水", answers.waterproof)
        : "",
    ].filter(Boolean);

    if (conditionParts.length > 0) {
      lines.push(`当时的实际约束更接近：${conditionParts.join("、")}。`);
    }
  }

  if (profile.payload.topProducts.length > 0) {
    lines.push(
      `所以系统当时先把 ${profile.payload.topProducts
        .slice(0, 2)
        .map((product) => getProductDisplayName(product))
        .join("、")} 这类方向放在前面，更适合先回到那次判断继续比较。`,
    );
  }

  return lines.slice(0, 3);
}

function buildProfileDecisionSnapshot(profile: SavedRecommendationProfile) {
  const answers = profile.payload.answers;
  const topProduct = profile.payload.topProducts[0];
  const preferenceTags = dedupeDisplayTags(answers.tags || []).slice(0, 4);
  const concernParts = [
    answers.budget ? `预算：${formatAnswerCondition("预算", answers.budget)}` : "",
    answers.maxDb != null
      ? `静音：${formatAnswerCondition("静音", answers.maxDb)}`
      : "",
    answers.waterproof != null
      ? `清洁：${formatAnswerCondition("防水", answers.waterproof)}`
      : "",
    answers.appSupportPreference
      ? `APP：${formatAnswerCondition("APP", answers.appSupportPreference)}`
      : "",
    answers.appearance
      ? `收纳：${formatAnswerCondition("外观", answers.appearance)}`
      : "",
  ].filter(Boolean);

  const routeParts = [
    answers.gender ? formatAnswerCondition("性别", answers.gender) : "",
    answers.physicalForm
      ? formatAnswerCondition("路线", answers.physicalForm)
      : "",
    answers.motorType ? formatAnswerCondition("电机", answers.motorType) : "",
  ].filter(Boolean);

  const reasonParts = [
    topProduct?.name ? `主推荐是 ${getProductDisplayName(topProduct)}` : "",
    profile.summary ? profile.summary : "",
  ].filter(Boolean);

  return [
    {
      label: "当时更在意",
      value:
        concernParts.join("、") ||
        (preferenceTags.length > 0
          ? preferenceTags.join("、")
          : "当时更像是一次整体探索，没有留下特别强的单一约束。"),
    },
    {
      label: "主推荐路线",
      value:
        routeParts.join(" / ") ||
        (topProduct?.name
          ? `先围绕 ${getProductDisplayName(topProduct)} 这类方向继续看`
          : "先从系统筛出的主推荐方向继续看。"),
    },
    {
      label: "推荐原因",
      value:
        reasonParts.join("，") ||
        "这组推荐综合了当时的偏好标签、预算、清洁和使用场景，更适合作为一次决策快照回看。",
    },
    {
      label: "如果现在重看",
      value:
        "优先比较静音、清洁和预算是否仍然符合现在的使用环境，再决定要不要重新匹配。",
    },
  ];
}

function buildProfileListPreview(profile: SavedRecommendationProfile) {
  const snapshot = buildProfileDecisionSnapshot(profile);

  return {
    focus:
      snapshot.find((item) => item.label === "当时更在意")?.value ||
      "当时更像是一次整体探索，没有留下特别强的单一约束。",
    route:
      snapshot.find((item) => item.label === "主推荐路线")?.value ||
      "先从系统筛出的主推荐方向继续看。",
  };
}

function buildProfileRecommendedRouteItems(profile: SavedRecommendationProfile) {
  return profile.payload.topProducts.slice(0, 3).map((product, index) => ({
    id: product.id,
    label: index === 0 ? "主推荐" : `备选 ${index}`,
    name: getProductDisplayName(product),
    reason:
      index === 0
        ? "当时系统先把它放在最前面，适合作为那次决策的起点。"
        : "它更适合拿来横向比较价位、刺激路径或静音边界。",
  }));
}

export function ProfilesPage({
  profiles,
  products = [],
  isLoading,
  error,
  userLabel,
  initialSelectedProfile = null,
  onBack,
  onReload,
  onDeleteProfile,
}: {
  profiles: SavedRecommendationProfile[];
  products?: Product[];
  isLoading: boolean;
  error: string | null;
  userLabel: string | null;
  initialSelectedProfile?: SavedRecommendationProfile | null;
  onBack: () => void;
  onReload: () => void;
  onDeleteProfile?: (profileId: string) => void | Promise<void>;
}) {
  const [selectedProfile, setSelectedProfile] =
    useState<SavedRecommendationProfile | null>(initialSelectedProfile);
  const selectedProfileSummary = selectedProfile
    ? buildProfileDecisionSummary(selectedProfile)
    : [];
  const selectedProfileSnapshot = selectedProfile
    ? buildProfileDecisionSnapshot(selectedProfile)
    : [];
  const selectedProfileRecommendedRouteItems = selectedProfile
    ? buildProfileRecommendedRouteItems(selectedProfile)
    : [];
  const selectedProfilePrimaryProduct = selectedProfile
    ? products.find((product) =>
        product.id === selectedProfile.topProductIds[0] ||
        product.originalId === selectedProfile.topProductIds[0],
      )
    : undefined;
  const selectedProfileBrandBrief = selectedProfile
    ? resolveBrandBrief(
        selectedProfile.payload.topProducts[0]?.brandBrief ??
          selectedProfilePrimaryProduct?.brandBrief ??
          null,
        selectedProfilePrimaryProduct?.brand ??
          selectedProfile.payload.topProducts[0]?.name ??
          null,
      )
    : null;
  const selectedAnswerEntries = selectedProfile
    ? ([
        ["性别", selectedProfile.payload.answers.gender],
        ["预算", selectedProfile.payload.answers.budget],
        ["静音", selectedProfile.payload.answers.maxDb],
        ["防水", selectedProfile.payload.answers.waterproof],
        ["路线", selectedProfile.payload.answers.physicalForm],
        ["电机", selectedProfile.payload.answers.motorType],
      ] as const)
    : [];
  const selectedProfileDetail = selectedProfile ? (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[linear-gradient(165deg,rgba(255,248,250,0.98),rgba(239,249,255,0.96)_52%,rgba(253,242,248,0.94))] text-slate-900">
      <div className="min-h-dvh w-full px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col rounded-[1.75rem] border border-white/70 bg-white/72 p-4 shadow-[0_1.4rem_4rem_rgba(125,211,252,0.18)] backdrop-blur-2xl sm:p-6">
          <div className="sticky top-0 z-10 mb-5 flex flex-col gap-3 border-b border-sky-100 bg-white/78 px-1 py-4 backdrop-blur-xl sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-1 sm:py-5">
          <div className="min-w-0">
            <p className="mb-2 text-[10px] font-black tracking-[0.28em] text-sky-500/76">
              ARCHIVE DETAIL
            </p>
            <h2 className="text-lg font-black text-slate-950 sm:text-xl">
              {selectedProfile.title}
            </h2>
            <p className="mt-2 text-xs font-bold text-slate-500">
              {formatSavedAt(selectedProfile.savedAt)}
            </p>
            <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">
              这里保留的是那次做决定时的语境，不只是字段记录。
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSelectedProfile(null)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center self-end rounded-full border border-sky-200 bg-white/86 p-2 text-sky-500 transition-colors hover:bg-sky-50 sm:self-start"
            aria-label="关闭档案详情"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid flex-1 content-start gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-4">
            {selectedProfileSummary.length > 0 && (
              <section className="rounded-2xl border border-sky-200 bg-sky-50/72 p-4">
                <h3 className="mb-3 text-sm font-black text-slate-900">
                  这次为什么会得到这组推荐
                </h3>
                <div className="space-y-2">
                  {selectedProfileSummary.map((line) => (
                    <p
                      key={line}
                      className="text-sm font-semibold leading-6 text-slate-700"
                    >
                      {line}
                    </p>
                  ))}
                </div>
              </section>
            )}

            <BrandBriefCard brief={selectedProfileBrandBrief} />

            {selectedProfile.payload.matchInputMode === "natural-language" &&
            typeof selectedProfile.payload.naturalLanguageQuery === "string" &&
            selectedProfile.payload.naturalLanguageQuery.trim() ? (
              <section className="rounded-2xl border border-fuchsia-100 bg-fuchsia-50/72 p-4">
                <h3 className="mb-3 text-sm font-black text-slate-900">
                  当时原始描述
                </h3>
                <p className="text-sm font-semibold leading-6 text-slate-700">
                  {selectedProfile.payload.naturalLanguageQuery}
                </p>
              </section>
            ) : null}

            <section className="rounded-2xl border border-sky-100 bg-white/72 p-4">
              <h3 className="mb-3 text-sm font-black text-slate-900">
                决策快照
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {selectedProfileSnapshot.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-sky-100 bg-sky-50/58 px-3 py-3"
                  >
                    <p className="text-[10px] font-black tracking-[0.2em] text-sky-500/78">
                      {item.label}
                    </p>
                    <p className="mt-1.5 text-sm font-semibold leading-6 text-slate-700">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-sky-100 bg-white/72 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900">
                <LockKeyhole className="h-4 w-4 text-sky-500" />
                那次决策的硬约束
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {selectedAnswerEntries.map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-sky-100 bg-sky-50/50 px-3 py-2"
                  >
                    <p className="text-[10px] font-black tracking-[0.2em] text-sky-500/72">
                      {label}
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-700">
                      {formatAnswerCondition(label, value)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-4 xl:space-y-3">
            <section className="rounded-2xl border border-sky-100 bg-white/72 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900">
                <FileText className="h-4 w-4 text-sky-500" />
                那次留下的偏好线索
              </h3>
              <div className="flex flex-wrap gap-2">
                {dedupeDisplayTags(selectedProfile.payload.answers.tags || []).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-black text-sky-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-sky-100 bg-white/72 p-4">
              <h3 className="mb-3 text-sm font-black text-slate-900">
                那次先看这几条路线
              </h3>
              <div className="space-y-2">
                {selectedProfileRecommendedRouteItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-sky-100 bg-sky-50/50 px-3 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-rose-100 bg-rose-50 px-2 py-0.5 text-[10px] font-black text-rose-500">
                        {item.label}
                      </span>
                      <p className="text-sm font-bold text-slate-900">
                        {item.name}
                      </p>
                    </div>
                    <p className="mt-1.5 text-xs font-semibold leading-5 text-slate-500">
                      {item.reason}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {selectedProfile.payload.bodyPersona ? (
              <section className="rounded-2xl border border-sky-100 bg-sky-50/72 p-4">
                <p className="text-[11px] font-black tracking-[0.22em] text-sky-500/78">
                  身体人格快照
                </p>
                <h3 className="mt-2 text-base font-black text-slate-900">
                  {selectedProfile.payload.bodyPersona.title}
                </h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                  {selectedProfile.payload.bodyPersona.hiddenRouteSummary}
                </p>
              </section>
            ) : null}

            {selectedProfile.payload.shoppingGuidance.length > 0 && (
              <section className="rounded-2xl border border-amber-100 bg-amber-50/72 p-4">
                <h3 className="mb-2 text-sm font-black text-slate-900">
                  那次下单前提醒
                </h3>
                <ul className="space-y-2">
                  {selectedProfile.payload.shoppingGuidance.map((item, index) => (
                    <li
                      key={index}
                      className="text-xs font-semibold leading-5 text-slate-600"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="profiles-vault-shell relative isolate flex min-h-dvh w-full flex-col overflow-hidden rounded-[1.7rem] border border-white/70 bg-white/76 p-5 text-slate-900 shadow-[0_1.4rem_4rem_rgba(125,211,252,0.16)] backdrop-blur-2xl sm:p-7">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_8%,rgba(251,207,232,0.44),transparent_34%),radial-gradient(circle_at_88%_10%,rgba(186,230,253,0.56),transparent_34%),linear-gradient(165deg,rgba(255,255,255,0.86),rgba(240,249,255,0.68))]" />

      <div className="mb-8 flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/76 px-3 py-1.5 text-xs font-black text-sky-500 shadow-[0_0.5rem_1.4rem_rgba(125,211,252,0.13)] transition-colors hover:border-sky-300 hover:bg-sky-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回
          </button>
          <p className="mb-2 text-[10px] font-black tracking-[0.32em] text-sky-500/78">
            EQUIPMENT MATCHING ARCHIVE
          </p>
          <h1 className="text-2xl font-black tracking-wide text-slate-950">
            匹配档案
          </h1>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
            回看当时怎么选、为什么先看这类，以及现在重看该先比较什么。
          </p>
        </div>

        <div className="rounded-2xl border border-sky-200 bg-sky-50/76 px-4 py-3 text-xs font-bold text-slate-500">
          <div className="mb-1 flex items-center gap-2 font-black text-sky-600">
            <LockKeyhole className="h-3.5 w-3.5" />
            已加密同步
          </div>
          <div className="max-w-[12rem] truncate">{userLabel || "未登录"}</div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/82 p-4 text-sm font-semibold text-rose-600">
          <p>{error}</p>
          <button
            type="button"
            onClick={onReload}
            className="mt-3 rounded-full border border-rose-200 bg-white/80 px-3 py-1.5 text-xs font-black transition-colors hover:bg-rose-100"
          >
            重新读取
          </button>
        </div>
      ) : isLoading ? (
        <div className="rounded-2xl border border-sky-100 bg-white/70 p-8 text-center text-sm font-bold text-slate-500">
          正在读取匹配档案...
        </div>
      ) : profiles.length === 0 ? (
        <div className="rounded-2xl border border-sky-100 bg-white/70 p-8 text-center">
          <PackageSearch className="mx-auto mb-3 h-8 w-8 text-sky-400" />
          <p className="text-sm font-black text-slate-900">还没有保存过匹配档案</p>
          <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
            完成一次匹配后，在结果页点击保存，就会出现在这里。
          </p>
        </div>
      ) : (
        <div className="grid flex-1 content-start gap-3">
          {profiles.map((profile) => {
            const preview = buildProfileListPreview(profile);

            return (
            <article
              key={profile.id}
              className="group rounded-2xl border border-sky-100 bg-white/78 p-4 text-left shadow-[0_0.75rem_2.2rem_rgba(125,211,252,0.11)] transition-all hover:-translate-y-0.5 hover:border-sky-200 hover:bg-white"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-black text-sky-600">
                      <Clock className="h-3 w-3" />
                      {formatSavedAt(profile.savedAt)}
                    </span>
                    <span className="rounded-full border border-rose-100 bg-rose-50/70 px-2.5 py-1 text-[11px] font-black text-rose-500">
                      {profile.topProductIds.length} 个推荐
                    </span>
                  </div>
                  <h2 className="truncate text-base font-black text-slate-950">
                    {profile.title}
                  </h2>
                  <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">
                    {profile.summary || "已保存的装备匹配快照"}
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-sky-100 bg-sky-50/58 px-3 py-2">
                      <p className="text-[10px] font-black tracking-[0.18em] text-sky-500/72">
                        当时更在意
                      </p>
                      <p className="mt-1 text-xs font-bold leading-5 text-slate-700">
                        {preview.focus}
                      </p>
                    </div>
                    <div className="rounded-xl border border-rose-100 bg-rose-50/48 px-3 py-2">
                      <p className="text-[10px] font-black tracking-[0.18em] text-rose-400/78">
                        先看路线
                      </p>
                      <p className="mt-1 text-xs font-bold leading-5 text-slate-700">
                        {preview.route}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedProfile(profile)}
                    className="inline-flex items-center justify-center gap-1 rounded-full border border-sky-200 bg-white/86 px-3 py-1.5 text-xs font-black text-sky-600 transition-colors hover:bg-sky-50"
                  >
                    回看这次判断
                  </button>
                  {onDeleteProfile ? (
                    <button
                      type="button"
                      onClick={() => void onDeleteProfile(profile.id)}
                      className="inline-flex items-center justify-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-500 transition-colors hover:bg-rose-100"
                      aria-label={`删除档案：${profile.title}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      删除档案
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
        </div>
      )}

      {selectedProfileDetail
        ? typeof document === "undefined"
          ? selectedProfileDetail
          : createPortal(selectedProfileDetail, document.body)
        : null}
    </div>
  );
}
