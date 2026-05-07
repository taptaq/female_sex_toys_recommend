import { useState } from "react";
import { ArrowLeft, Clock, FileText, LockKeyhole, PackageSearch, X } from "lucide-react";
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

export function ProfilesPage({
  profiles,
  isLoading,
  error,
  userLabel,
  initialSelectedProfile = null,
  onBack,
  onReload,
}: {
  profiles: SavedRecommendationProfile[];
  isLoading: boolean;
  error: string | null;
  userLabel: string | null;
  initialSelectedProfile?: SavedRecommendationProfile | null;
  onBack: () => void;
  onReload: () => void;
}) {
  const [selectedProfile, setSelectedProfile] =
    useState<SavedRecommendationProfile | null>(initialSelectedProfile);
  const selectedProfileSummary = selectedProfile
    ? buildProfileDecisionSummary(selectedProfile)
    : [];
  const selectedProfileSnapshot = selectedProfile
    ? buildProfileDecisionSnapshot(selectedProfile)
    : [];
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

  return (
    <div className="profiles-vault-shell relative isolate w-full overflow-hidden rounded-[2rem] border border-cyan-100/10 bg-slate-950/72 p-5 shadow-[0_24px_90px_rgba(8,47,73,0.22)] sm:p-7">
      <div className="profiles-vault-grid pointer-events-none absolute inset-0 -z-10 opacity-45" />
      <div className="pointer-events-none absolute -right-24 -top-24 -z-10 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 left-10 -z-10 h-72 w-72 rounded-full bg-indigo-400/10 blur-3xl" />

      <div className="mb-8 flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-white/[0.07] hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回
          </button>
          <p className="mb-2 font-mono text-[10px] tracking-[0.32em] text-cyan-200/48">
            EQUIPMENT MATCHING ARCHIVE
          </p>
          <h1 className="text-2xl font-light tracking-wide text-white">
            匹配档案
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            回看已加密保存的问卷偏好和推荐快照，方便换设备时继续比较。
          </p>
        </div>

        <div className="rounded-2xl border border-cyan-300/12 bg-cyan-300/[0.045] px-4 py-3 text-xs text-cyan-100/68">
          <div className="mb-1 flex items-center gap-2 text-cyan-50">
            <LockKeyhole className="h-3.5 w-3.5" />
            已加密同步
          </div>
          <div className="max-w-[12rem] truncate">{userLabel || "未登录"}</div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-300/18 bg-rose-400/10 p-4 text-sm text-rose-100">
          <p>{error}</p>
          <button
            type="button"
            onClick={onReload}
            className="mt-3 rounded-full border border-rose-200/20 bg-rose-100/8 px-3 py-1.5 text-xs transition-colors hover:bg-rose-100/14"
          >
            重新读取
          </button>
        </div>
      ) : isLoading ? (
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-8 text-center text-sm text-slate-400">
          正在读取匹配档案...
        </div>
      ) : profiles.length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-8 text-center">
          <PackageSearch className="mx-auto mb-3 h-8 w-8 text-cyan-200/45" />
          <p className="text-sm text-white">还没有保存过匹配档案</p>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            完成一次匹配后，在结果页点击保存，就会出现在这里。
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              onClick={() => setSelectedProfile(profile)}
              className="group rounded-2xl border border-white/8 bg-white/[0.035] p-4 text-left transition-all hover:-translate-y-0.5 hover:border-cyan-300/24 hover:bg-cyan-300/[0.055]"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/16 bg-cyan-300/8 px-2.5 py-1 text-[11px] text-cyan-100/75">
                      <Clock className="h-3 w-3" />
                      {formatSavedAt(profile.savedAt)}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[11px] text-slate-400">
                      {profile.topProductIds.length} 个推荐
                    </span>
                  </div>
                  <h2 className="truncate text-base font-medium text-white">
                    {profile.title}
                  </h2>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">
                    {profile.summary || "已保存的装备匹配快照"}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-cyan-300/18 bg-cyan-300/8 px-3 py-1.5 text-xs text-cyan-100/80 transition-colors group-hover:bg-cyan-300/12">
                  查看详情
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedProfile ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/86 px-4 py-6 backdrop-blur-xl">
          <div className="max-h-[92dvh] w-full max-w-4xl overflow-y-auto rounded-[1.75rem] border border-cyan-100/14 bg-slate-950 p-5 shadow-[0_24px_90px_rgba(8,47,73,0.34)] sm:p-6">
            <div className="sticky top-0 z-10 -mx-5 -mt-5 mb-5 flex items-start justify-between gap-4 border-b border-cyan-100/10 bg-slate-950/92 px-5 py-4 backdrop-blur-xl sm:-mx-6 sm:-mt-6 sm:px-6 sm:py-5">
              <div className="min-w-0">
                <p className="mb-2 text-[10px] tracking-[0.28em] text-cyan-200/45">
                  ARCHIVE DETAIL
                </p>
                <h2 className="text-lg font-medium text-white sm:text-xl">
                  {selectedProfile.title}
                </h2>
                <p className="mt-2 text-xs text-slate-500">
                  {formatSavedAt(selectedProfile.savedAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProfile(null)}
                className="inline-flex w-full sm:w-auto shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] p-2 text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div className="space-y-4">
                {selectedProfileSummary.length > 0 && (
                  <section className="rounded-2xl border border-cyan-300/12 bg-cyan-300/[0.055] p-4">
                    <h3 className="mb-3 text-sm font-medium text-cyan-50">
                      这次为什么会得到这组推荐
                    </h3>
                    <div className="space-y-2">
                      {selectedProfileSummary.map((line) => (
                        <p
                          key={line}
                          className="text-sm leading-6 text-cyan-50/78"
                        >
                          {line}
                        </p>
                      ))}
                    </div>
                  </section>
                )}

                <section className="rounded-2xl border border-cyan-300/12 bg-cyan-300/[0.045] p-4">
                  <h3 className="mb-3 text-sm font-medium text-cyan-50">
                    决策快照
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {selectedProfileSnapshot.map((item) => (
                      <div
                        key={item.label}
                        className="rounded-xl border border-cyan-200/10 bg-slate-950/30 px-3 py-3"
                      >
                        <p className="text-[10px] tracking-[0.2em] text-cyan-200/48">
                          {item.label}
                        </p>
                        <p className="mt-1.5 text-sm leading-6 text-cyan-50/82">
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
                    <LockKeyhole className="h-4 w-4 text-cyan-200/70" />
                    当时的条件
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {selectedAnswerEntries.map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2"
                      >
                        <p className="text-[10px] tracking-[0.2em] text-cyan-200/45">
                          {label}
                        </p>
                        <p className="mt-1 text-sm text-slate-100">
                          {formatAnswerCondition(label, value)}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="space-y-4 xl:space-y-3">
                <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
                    <FileText className="h-4 w-4 text-cyan-200/70" />
                    当时的偏好
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {dedupeDisplayTags(selectedProfile.payload.answers.tags || []).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-cyan-300/14 bg-cyan-300/8 px-2.5 py-1 text-xs text-cyan-100/75"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <h3 className="mb-3 text-sm font-medium text-white">推荐快照</h3>
                  <div className="space-y-2">
                    {selectedProfile.payload.topProducts.map((product, index) => (
                      <div
                        key={product.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm text-slate-100">
                            {index + 1}. {getProductDisplayName(product)}
                          </p>
                        </div>
                        <span className="text-xs text-cyan-100/65">
                          {Math.round(product.score)}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                {selectedProfile.payload.shoppingGuidance.length > 0 && (
                  <section className="rounded-2xl border border-amber-300/16 bg-amber-400/8 p-4">
                    <h3 className="mb-2 text-sm font-medium text-amber-100">
                      当时的选购提示
                    </h3>
                    <ul className="space-y-2">
                      {selectedProfile.payload.shoppingGuidance.map((item, index) => (
                        <li
                          key={index}
                          className="text-xs leading-5 text-amber-100/75"
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
      ) : null}
    </div>
  );
}
