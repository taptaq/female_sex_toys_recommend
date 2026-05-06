import { motion } from "motion/react";
import { useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  ChevronDown,
  LoaderCircle,
  Sparkles,
  VolumeX,
  Droplets,
  Zap,
  LockKeyhole,
} from "lucide-react";
import { ProductImage } from "../components/ProductImage.tsx";
import { ResultParameterGuide } from "../components/ResultParameterGuide.tsx";
import { AnswerState } from "../data/mock.ts";
import { RankedProduct } from "../lib/app-shell.ts";
import { dedupeDisplayTags } from "../lib/display-tags.ts";
import {
  RESULT_TUNING_OPTIONS,
  type ResultTuningMode,
  getResultTuningAppliedTag,
} from "../lib/result-tuning.ts";
import {
  buildResultComparisonRows,
  buildResultComparisonTeaser,
} from "../lib/result-comparison.ts";
import {
  buildBackupDirectionTeaser,
  buildResultAvoidanceTips,
  buildResultConfidenceSummary,
  buildResultNextStepGroups,
  buildResultRouteSummary,
} from "../lib/recommendation-results.ts";
import { getProductDisplayName } from "../lib/product-display-name.ts";
import type { BackupCandidate } from "../lib/recommendation-results.ts";
import { getResultLeadCopy } from "../lib/quiz-branching.ts";
import { AuthPanel, type AuthPanelMode } from "../components/AuthPanel.tsx";
import { buildKnowledgeNebulaPath } from "../lib/knowledge-nebula-route.ts";

type ResultsBackupProduct = BackupCandidate;
export type ResultEditableCondition = "budget" | "quietness" | "scene";

const MAX_RELAXATION_TIPS = 3;
const MAX_SHOPPING_GUIDANCE_WITH_RELAXATION = 3;
const MAX_SHOPPING_GUIDANCE_ONLY = 5;

const PARAMETER_PREVIEW_ITEMS = [
  {
    id: "max-db",
    title: "静音参数",
    preview: "分贝数不是唯一答案，夜晚、床架和贴近硬物时，体感会被放大。",
    topicSlug: "people" as const,
    sectionId: "science-noise",
  },
  {
    id: "waterproof",
    title: "防水边界",
    preview: "防水更像是在说明清洁边界，不代表可以长期随意进水。",
    topicSlug: "care" as const,
    sectionId: "care-waterproof",
  },
  {
    id: "motor-type",
    title: "电机体感",
    preview: "温和和强力不是绝对高低，关键是它跟你的进入节奏是否匹配。",
    topicSlug: "science" as const,
    sectionId: "science-body",
  },
] as const;

function getSortedParameterPreviewItems(answers: AnswerState) {
  const scoredItems = PARAMETER_PREVIEW_ITEMS.map((item, index) => {
    let score = 0;

    if (item.id === "max-db") {
      if (answers.maxDb != null && answers.maxDb <= 50) score += 5;
      if (answers.tags.some((tag) => /静音|同住|宿舍/.test(tag))) score += 4;
    }

    if (item.id === "waterproof") {
      if (answers.waterproof != null && answers.waterproof >= 6) score += 5;
      if (answers.tags.some((tag) => /清洁|护理|收纳/.test(tag))) score += 4;
    }

    if (item.id === "motor-type") {
      if (answers.motorType != null) score += 5;
      if (
        answers.experienceLevel === "sensitive" ||
        answers.experienceLevel === "intense"
      ) {
        score += 4;
      }
      if (answers.tags.some((tag) => /敏感度|强刺激|温柔慢热|平衡进阶/.test(tag))) {
        score += 4;
      }
    }

    return {
      ...item,
      score,
      index,
    };
  });

  return scoredItems
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 3);
}

function normalizeGuidanceItem(item: string) {
  return item.replace(/\s+/g, " ").trim();
}

function dedupeGuidanceItems(items: string[]) {
  const seen = new Set<string>();

  return items.reduce<string[]>((result, item) => {
    const normalizedItem = normalizeGuidanceItem(item);
    if (!normalizedItem || seen.has(normalizedItem)) {
      return result;
    }

    seen.add(normalizedItem);
    result.push(normalizedItem);
    return result;
  }, []);
}

function renderProductImage(
  product: Pick<RankedProduct, "imagePlaceholder" | "name" | "displayName" | "safeDisplayName">,
  iconClassName: string,
) {
  return (
    <ProductImage
      imageValue={product.imagePlaceholder}
      alt={getProductDisplayName(product)}
      iconClassName={iconClassName}
      imageClassName="h-full w-full object-cover opacity-90"
    />
  );
}

function getProductHref(
  product: Pick<RankedProduct, "sourceUrl" | "link">,
) {
  return product.sourceUrl || product.link || undefined;
}

function renderClickableHint(label = "点击查看详情") {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] text-cyan-100/85 transition-colors group-hover:border-cyan-300/35 group-hover:bg-cyan-300/12 group-hover:text-cyan-50">
      <span>{label}</span>
      <ArrowUpRight className="h-3 w-3 shrink-0" />
    </span>
  );
}

function getMetricChips(product: Pick<RankedProduct, "maxDb" | "waterproof" | "motorType">) {
  return [
    {
      id: "max-db",
      icon: VolumeX,
      topicSlug: "people" as const,
      sectionId: "science-noise",
      label:
        product.maxDb == null ? "噪音参数缺失" : `噪音 < ${product.maxDb}dB`,
    },
    {
      id: "waterproof",
      icon: Droplets,
      topicSlug: "care" as const,
      sectionId: "care-waterproof",
      label:
        product.waterproof == null
          ? "防水参数缺失"
          : `防水 IPX${product.waterproof}`,
    },
    {
      id: "motor-type",
      icon: Zap,
      topicSlug: "science" as const,
      sectionId: "science-body",
      label: product.motorType === "gentle" ? "温柔电机" : "强力电机",
    },
  ];
}

function getConfidenceToneClassName(tone: "high" | "conditional" | "backup") {
  if (tone === "high") {
    return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
  }
  if (tone === "conditional") {
    return "border-amber-300/25 bg-amber-400/10 text-amber-100";
  }
  return "border-slate-300/20 bg-slate-400/10 text-slate-100";
}

function getTuningProgressLabel(mode: ResultTuningMode) {
  if (mode === "quieter") return "正在按更安静方向重新计算推荐...";
  if (mode === "cheaper") return "正在按更低预算方向重新计算推荐...";
  return "正在按新手友好方向重新计算推荐...";
}

function buildPrePurchaseChecklist(
  answers: AnswerState,
  primaryProduct: RankedProduct | undefined,
) {
  const answerTags = answers.tags || [];
  const isQuietSensitive =
    answers.maxDb != null ||
    answerTags.some((tag) => /静音|同住|宿舍|深夜/.test(tag));
  const isStorageSensitive =
    answers.appearance === "high_disguise" ||
    answerTags.some((tag) => /隐蔽|伪装|收纳|同住/.test(tag));
  const isSensitiveUser =
    answers.experienceLevel === "sensitive" ||
    answerTags.some((tag) => /新手|敏感|不确定|待判断/.test(tag));

  return [
    {
      title: "声音环境",
      detail:
        isQuietSensitive && primaryProduct?.maxDb != null
          ? `确认 ${primaryProduct.maxDb}dB 左右在你的同住/夜间环境里可接受。`
          : "确认实际使用时的房间、床架和时间段不会放大声音打扰。",
    },
    {
      title: "清洁边界",
      detail:
        answers.waterproof != null || primaryProduct?.waterproof != null
          ? `确认防水约 IPX${primaryProduct?.waterproof ?? answers.waterproof} 的清洁方式、充电口和售后说明。`
          : "确认材质、清洁方式和充电口防护说明清楚，不只看外观图。",
    },
    {
      title: "收纳隐私",
      detail: isStorageSensitive
        ? "确认尺寸、外观伪装和收纳位置都适合你的真实居住场景。"
        : "确认包装、收纳和取用方式不会给自己增加尴尬压力。",
    },
    {
      title: "经验节奏",
      detail: isSensitiveUser
        ? "第一次或敏感体质先按温和档位开始，不急着追求强度。"
        : "确认这款的刺激路线和控制方式，确实符合你这次想要的节奏。",
    },
  ];
}

function renderConfidenceSummary(
  summary: ReturnType<typeof buildResultConfidenceSummary>,
) {
  return (
    <div className="mt-3 rounded-2xl border border-white/8 bg-white/[0.035] p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className={[
            "rounded-full border px-2.5 py-1 text-[11px]",
            getConfidenceToneClassName(summary.tone),
          ].join(" ")}
        >
          {summary.levelLabel}
        </span>
        <span className="text-[11px] text-slate-500">
          推荐信心与注意点
        </span>
      </div>

      {summary.reasons.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-[10px] font-mono tracking-wider text-cyan-300/70">
            为什么适合
          </p>
          <ul className="space-y-1">
            {summary.reasons.map((reason, index) => (
              <li
                key={`reason-${index}`}
                className="text-[11px] leading-5 text-slate-200"
              >
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="mb-1 text-[10px] font-mono tracking-wider text-amber-300/70">
          需要留意
        </p>
        <ul className="space-y-1">
          {summary.caveats.map((caveat, index) => (
            <li
              key={`caveat-${index}`}
              className="text-[11px] leading-5 text-slate-300"
            >
              {caveat}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

type ResultsPageProps = {
  pageVariants: any;
  answers: AnswerState;
  topProducts: RankedProduct[];
  backupProducts: ResultsBackupProduct[];
  shoppingGuidance: string[];
  recommendationTips: string[];
  isRecalibratingResults: boolean;
  resultRecalibrationError: string | null;
  onRecalibrateResults: () => void;
  onTuneResults: (mode: ResultTuningMode) => void;
  onEditQuizCondition?: (condition: ResultEditableCondition) => void;
  onSaveRecommendationProfile: () => Promise<void>;
  onOpenRecommendationProfiles: () => void;
  onOpenKnowledgeNebula?: (path?: string) => void;
  isSavingRecommendationProfile: boolean;
  saveRecommendationProfileMessage: string | null;
  authPanel: {
    isConfigured: boolean;
    userLabel: string | null;
    statusMessage: string | null;
    isSubmitting: boolean;
    onSubmit: (mode: AuthPanelMode, username: string, password: string) => Promise<void>;
    onSignOut: () => Promise<void>;
  };
  onReset: () => void;
};

export function ResultsPage({
  pageVariants,
  answers,
  topProducts,
  backupProducts,
  shoppingGuidance,
  recommendationTips,
  isRecalibratingResults,
  resultRecalibrationError,
  onRecalibrateResults,
  onTuneResults,
  onEditQuizCondition,
  onSaveRecommendationProfile,
  onOpenRecommendationProfiles,
  onOpenKnowledgeNebula,
  isSavingRecommendationProfile,
  saveRecommendationProfileMessage,
  authPanel,
  onReset,
}: ResultsPageProps) {
  const [isRecalibrationPanelOpen, setIsRecalibrationPanelOpen] = useState(false);
  const [isBackupPanelOpen, setIsBackupPanelOpen] = useState(false);
  const [isComparisonPanelOpen, setIsComparisonPanelOpen] = useState(false);
  const [isSavePanelOpen, setIsSavePanelOpen] = useState(false);
  const [isParameterGuideOpen, setIsParameterGuideOpen] = useState(false);
  const [activeTuningMode, setActiveTuningMode] = useState<ResultTuningMode | null>(null);
  const relaxationTips = dedupeGuidanceItems(recommendationTips).slice(
    0,
    MAX_RELAXATION_TIPS,
  );
  const relaxationTipSet = new Set(relaxationTips.map(normalizeGuidanceItem));
  const shoppingGuidanceItems = dedupeGuidanceItems(shoppingGuidance)
    .filter((item) => !relaxationTipSet.has(normalizeGuidanceItem(item)))
    .slice(
      0,
      relaxationTips.length > 0
        ? MAX_SHOPPING_GUIDANCE_WITH_RELAXATION
        : MAX_SHOPPING_GUIDANCE_ONLY,
    );
  const hasGuidance =
    relaxationTips.length > 0 || shoppingGuidanceItems.length > 0;
  const recalibrationButtonLabel = "重新生成推荐";
  const canShowRecalibrationModule = topProducts.length > 0;
  const resultTags = dedupeDisplayTags(answers.tags);
  const resultLeadCopy = getResultLeadCopy(answers);
  const comparisonProducts = topProducts.slice(0, 3);
  const comparisonRows = buildResultComparisonRows(comparisonProducts);
  const comparisonTeaser = buildResultComparisonTeaser(
    comparisonRows,
    comparisonProducts.length,
  );
  const backupDirectionTeaser = buildBackupDirectionTeaser(backupProducts);
  const primaryConfidenceSummary = topProducts[0]
    ? buildResultConfidenceSummary(topProducts[0], answers)
    : null;
  const primaryRouteSummary = topProducts[0]
    ? buildResultRouteSummary(topProducts[0], answers)
    : null;
  const prePurchaseChecklist = buildPrePurchaseChecklist(answers, topProducts[0]);
  const avoidanceTips = buildResultAvoidanceTips(answers);
  const visibleResultTags = resultTags.slice(0, 4);
  const hiddenResultTagCount = Math.max(resultTags.length - visibleResultTags.length, 0);
  const appliedTuningOptions = RESULT_TUNING_OPTIONS.filter((option) =>
    answers.tags.includes(getResultTuningAppliedTag(option.mode)),
  );
  const isSignedIn = Boolean(authPanel.userLabel);
  const sortedParameterPreviewItems = getSortedParameterPreviewItems(answers);
  const nextStepGroups = buildResultNextStepGroups({
    answers,
    relaxationTips,
    shoppingGuidanceItems,
  });
  const handleOpenKnowledgeTopic = (
    topicSlug: "science" | "people" | "care",
    sectionId?: string,
  ) => {
    onOpenKnowledgeNebula?.(buildKnowledgeNebulaPath(topicSlug, sectionId));
  };
  const handleTuneResultClick = (mode: ResultTuningMode) => {
    setActiveTuningMode(mode);
    onTuneResults(mode);
    window.setTimeout(() => {
      setActiveTuningMode((currentMode) => (currentMode === mode ? null : currentMode));
    }, 650);
  };

  return (
    <motion.div
      key="result"
      variants={pageVariants}
      initial="initial"
      animate="in"
      exit="out"
      className="results-report-shell relative isolate w-full space-y-6 overflow-x-hidden px-1 pb-4"
    >
      <div className="pointer-events-none absolute inset-x-[-12vw] top-[-8rem] -z-10 h-[30rem] bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.12),transparent_42%),radial-gradient(circle_at_12%_48%,rgba(59,130,246,0.09),transparent_34%),radial-gradient(circle_at_88%_58%,rgba(99,102,241,0.11),transparent_36%)]" />
      <div className="results-report-grid pointer-events-none absolute inset-0 -z-10 opacity-45" />

      <div className="relative z-10 mb-6 text-center">
        <p className="mb-3 font-mono text-[10px] tracking-[0.34em] text-cyan-200/50">
          DEEP SPACE REPORT
        </p>
        <h2 className="mb-2 text-2xl font-light text-white">
          已锁定 {Math.min(topProducts.length, 3)} 个高匹配方案
        </h2>
        <div className="mx-auto mb-4 flex max-w-xl flex-wrap justify-center gap-1.5">
          {visibleResultTags.map((tag, index) => (
            <span
              key={index}
              className="px-2 py-0.5 rounded border border-white/10 bg-white/5 text-[10px] text-slate-300"
            >
              {tag}
            </span>
          ))}
          {hiddenResultTagCount > 0 && (
            <span className="rounded border border-cyan-300/15 bg-cyan-300/8 px-2 py-0.5 text-[10px] text-cyan-100/70">
              +{hiddenResultTagCount}
            </span>
          )}
        </div>
        <p className="text-sm text-slate-400">
          {resultLeadCopy}
        </p>
      </div>

      {topProducts[0] && (
        <section className="results-report-panel relative z-10 overflow-hidden rounded-[1.75rem] border border-cyan-200/14 bg-slate-950/56 p-4 shadow-[0_24px_90px_rgba(8,47,73,0.2)] sm:p-5">
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/45 to-transparent" />
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-stretch">
            <div className="relative min-h-56 overflow-hidden rounded-3xl border border-white/8 bg-black/20">
              {renderProductImage(topProducts[0], "h-8 w-8 text-white/50")}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
                <div>
                  <span className="mb-2 inline-flex rounded-full border border-cyan-300/25 bg-cyan-300/12 px-2.5 py-1 font-mono text-[10px] tracking-[0.18em] text-cyan-100">
                    主推荐方案
                  </span>
                  <h3 className="break-words text-xl font-medium leading-snug text-white">
                    {getProductDisplayName(topProducts[0])}
                  </h3>
                </div>
                <span className="shrink-0 text-xl font-semibold text-cyan-300">
                  ¥{topProducts[0].price}
                </span>
              </div>
            </div>

            <div className="flex flex-col justify-between gap-4">
              <div>
                {topProducts[0].reason && (
                  <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.055] p-3">
                    <p className="text-sm leading-6 text-cyan-50/82">
                      <Sparkles className="mr-1 inline-block h-3.5 w-3.5 text-cyan-200" />
                      {topProducts[0].reason}
                    </p>
                  </div>
                )}

                {primaryConfidenceSummary &&
                  renderConfidenceSummary(primaryConfidenceSummary)}

                {primaryRouteSummary && (
                  <div className="mt-3 rounded-2xl border border-cyan-300/12 bg-cyan-400/[0.05] p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-cyan-200/80" />
                      <p className="text-[11px] font-medium tracking-wide text-cyan-100/86">
                        为什么这条路线更适合你
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3">
                      <p className="text-[11px] font-medium text-cyan-100/84">
                        这次更适合先走 {primaryRouteSummary.routeLabel}
                      </p>
                      <p className="mt-1.5 text-[11px] leading-5 text-slate-200">
                        {primaryRouteSummary.summary}
                      </p>
                      <p className="mt-2 text-[11px] leading-5 text-slate-400">
                        {primaryRouteSummary.nextPriority}
                      </p>
                    </div>
                  </div>
                )}

                {avoidanceTips.length > 0 && (
                  <div className="mt-3 rounded-2xl border border-rose-300/12 bg-rose-400/[0.05] p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <AlertCircle className="h-3.5 w-3.5 text-rose-200/80" />
                      <p className="text-[11px] font-medium tracking-wide text-rose-100/88">
                        暂时不建议优先看
                      </p>
                    </div>
                    <ul className="space-y-1.5">
                      {avoidanceTips.map((tip, index) => (
                        <li
                          key={`avoidance-${index}`}
                          className="text-[11px] leading-5 text-rose-50/78"
                        >
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <ResultParameterGuide
                  isOpen={isParameterGuideOpen}
                  onToggle={() => setIsParameterGuideOpen((isOpen) => !isOpen)}
                  onOpenTopic={handleOpenKnowledgeTopic}
                />

                <div className="rounded-2xl border border-cyan-400/12 bg-cyan-400/[0.05] p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-medium text-cyan-100/82">
                        参数速览
                      </p>
                      <p className="mt-1 text-[11px] leading-5 text-slate-400">
                        先看一眼核心判断，再决定要不要进知识星云深读。
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenKnowledgeTopic("science", "science-body")}
                      className="inline-flex shrink-0 items-center rounded-full border border-cyan-400/18 bg-cyan-400/10 px-2.5 py-1 text-[11px] text-cyan-100/82 transition-colors hover:border-cyan-300/32 hover:bg-cyan-300/14"
                    >
                      去知识星云深读
                    </button>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    {sortedParameterPreviewItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleOpenKnowledgeTopic(item.topicSlug, item.sectionId)}
                        className="rounded-2xl border border-white/8 bg-white/[0.035] px-3 py-3 text-left transition-colors hover:border-cyan-300/24 hover:bg-cyan-300/[0.08]"
                      >
                        <p className="text-[11px] font-medium text-cyan-100/84">
                          {item.title}
                        </p>
                        <p className="mt-1.5 text-[11px] leading-5 text-slate-300">
                          {item.preview}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                {getMetricChips(topProducts[0]).map((chip) => {
                  const Icon = chip.icon;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => handleOpenKnowledgeTopic(chip.topicSlug, chip.sectionId)}
                      className="flex max-w-full cursor-pointer items-start gap-1 rounded-full border border-white/10 bg-white/[0.045] px-2.5 py-1 text-[11px] text-slate-300 transition-colors hover:border-cyan-300/24 hover:bg-cyan-300/[0.08]"
                      title="了解这个参数"
                    >
                      <Icon className="mt-0.5 h-3 w-3 shrink-0" />
                      <span className="break-words">{chip.label}</span>
                    </button>
                  );
                })}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {topProducts.length > 0 && (
        <section className="relative z-10 rounded-2xl border border-white/8 bg-white/[0.028] p-4 sm:p-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-medium text-white">快速微调结果</h3>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                保留当前问卷，只轻微调整一个侧重点。
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {RESULT_TUNING_OPTIONS.map((option) => {
                const isApplied = answers.tags.includes(getResultTuningAppliedTag(option.mode));
                const isActive = activeTuningMode === option.mode;

                return (
                  <button
                    key={option.mode}
                    type="button"
                    onClick={() => handleTuneResultClick(option.mode)}
                    disabled={isRecalibratingResults || isApplied || activeTuningMode != null}
                    className={[
                      "inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs transition-colors",
                      isApplied
                        ? "border-emerald-300/18 bg-emerald-400/8 text-emerald-100/70"
                        : "border-cyan-400/18 bg-cyan-400/8 text-cyan-100 hover:border-cyan-300/35 hover:bg-cyan-400/14",
                      isRecalibratingResults || isApplied || activeTuningMode != null
                        ? "cursor-not-allowed opacity-65"
                        : "",
                    ].join(" ")}
                  >
                    {isActive && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                    <span>{isApplied ? `已应用${option.label}` : option.label}</span>
                  </button>
                );
              })}
            </div>
            </div>

            <div className="min-h-5 text-xs leading-5 text-cyan-100/62">
              {activeTuningMode
                ? getTuningProgressLabel(activeTuningMode)
                : appliedTuningOptions.length > 0
                  ? `已应用：${appliedTuningOptions.map((option) => option.label).join("、")}`
                  : "正在按所选方向重新计算推荐时，会保留当前问卷并更新结果。"}
            </div>

            {onEditQuizCondition && (
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">
                      想改一个条件？
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      不用重做整套问卷，直接回到关键题重新选择。
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      ["budget", "改预算"],
                      ["quietness", "改静音"],
                      ["scene", "改场景"],
                    ].map(([condition, label]) => (
                      <button
                        key={condition}
                        type="button"
                        onClick={() =>
                          onEditQuizCondition(condition as ResultEditableCondition)
                        }
                        className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-200 transition-colors hover:border-cyan-300/24 hover:bg-cyan-300/[0.08] hover:text-white"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 rounded-2xl border border-cyan-400/12 bg-cyan-400/[0.045] p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-2">
                <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300/75" />
                <div>
                  <p className="text-sm font-medium text-cyan-50">
                    {isSignedIn ? "已登录，可加密保存" : "登录后可加密保存"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-cyan-100/55">
                    {isSignedIn
                      ? `${authPanel.userLabel} 的推荐档案会加密同步，方便多端继续比较。`
                      : "保存问卷偏好和推荐快照，方便多端继续比较。"}
                  </p>
                </div>
              </div>
              <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap">
                {!isSignedIn && (
                  <button
                    type="button"
                    onClick={() => setIsSavePanelOpen((isOpen) => !isOpen)}
                    className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-200 transition-colors hover:bg-white/[0.07]"
                  >
                    {isSavePanelOpen ? "收起登录" : "登录 / 注册"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void onSaveRecommendationProfile()}
                  disabled={isSavingRecommendationProfile}
                  className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-300/12 px-3 py-2 text-xs text-cyan-50 transition-colors hover:border-cyan-200/45 hover:bg-cyan-300/18 disabled:cursor-wait disabled:opacity-60"
                >
                  {isSavingRecommendationProfile ? "保存中..." : "保存推荐档案"}
                </button>
                <button
                  type="button"
                  onClick={onOpenRecommendationProfiles}
                  className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-200 transition-colors hover:bg-white/[0.07]"
                >
                  查看档案
                </button>
              </div>
          </div>

            {saveRecommendationProfileMessage && (
              <p className="text-xs leading-5 text-cyan-100/65">
                {saveRecommendationProfileMessage}
              </p>
            )}

            {!isSignedIn && isSavePanelOpen && <AuthPanel {...authPanel} />}
          </div>
        </section>
      )}

      {comparisonProducts.length >= 2 && (
        <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 sm:p-5">
          <button
            type="button"
            onClick={() => setIsComparisonPanelOpen((isOpen) => !isOpen)}
            aria-expanded={isComparisonPanelOpen}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-medium text-white">Top 3 快速对比</h3>
                <span className="rounded-full border border-cyan-400/18 bg-cyan-400/8 px-2.5 py-1 text-[11px] text-cyan-100/80">
                  {comparisonTeaser.countText}
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                {comparisonTeaser.dimensionText}，需要纠结时再展开看差异。
              </p>
            </div>
            <ChevronDown
              className={[
                "h-4 w-4 shrink-0 text-slate-400 transition-transform",
                isComparisonPanelOpen ? "rotate-180" : "",
              ].join(" ")}
            />
          </button>

          <div
            className={[
              "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
              isComparisonPanelOpen
                ? "grid-rows-[1fr] opacity-100"
                : "grid-rows-[0fr] opacity-0",
            ].join(" ")}
          >
            <div className="overflow-hidden">
              <div className="border-t border-white/8 pt-4">
                <div className="space-y-3 md:hidden">
                  <div className="rounded-2xl border border-cyan-400/12 bg-cyan-400/[0.05] px-3 py-3">
                    <p className="text-[11px] font-medium text-cyan-100/82">
                      手机快速对比
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-400">
                      不用横向大表格，先快速看每个候选的关键差异。
                    </p>
                  </div>

                  {comparisonProducts.map((product, index) => (
                    <div
                      key={`mobile-comparison-${product.id}`}
                      className="rounded-2xl border border-white/8 bg-white/[0.03] p-3"
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] text-cyan-200/70">
                            第 {index + 1} 推荐
                          </p>
                          <p className="mt-1 break-words text-sm font-medium text-white">
                            {getProductDisplayName(product)}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full border border-cyan-400/18 bg-cyan-400/8 px-2.5 py-1 text-[11px] text-cyan-100/80">
                          匹配 {Math.round(product.score)}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {comparisonRows.map((row) => (
                          <div
                            key={`mobile-${product.id}-${row.id}`}
                            className="rounded-xl border border-white/8 bg-black/10 px-3 py-2.5"
                          >
                            <p className="text-[10px] text-slate-500">{row.label}</p>
                            <p className="mt-1 text-[11px] leading-5 text-slate-200">
                              {row.values[index]}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden md:block overflow-x-auto">
                  <div>
                    <div
                      className="grid gap-2 border-b border-white/8 pb-3"
                      style={{
                        gridTemplateColumns: `8rem repeat(${comparisonProducts.length}, minmax(0, 1fr))`,
                      }}
                    >
                      <div className="text-xs text-slate-500">维度</div>
                      {comparisonProducts.map((product, index) => (
                        <div key={product.id} className="min-w-0">
                          <div className="mb-1 text-[10px] text-cyan-200/70">
                            第 {index + 1} 推荐
                          </div>
                          <div className="truncate text-xs font-medium text-white">
                            {getProductDisplayName(product)}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="divide-y divide-white/8">
                      {comparisonRows.map((row) => (
                        <div
                          key={row.id}
                          className="grid gap-2 py-3"
                          style={{
                            gridTemplateColumns: `8rem repeat(${comparisonProducts.length}, minmax(0, 1fr))`,
                          }}
                        >
                          <div className="text-xs text-slate-400">{row.label}</div>
                          {row.values.map((value, index) => (
                            <div
                              key={`${row.id}-${comparisonProducts[index]?.id ?? index}`}
                              className="text-xs leading-5 text-slate-200"
                            >
                              {value}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {topProducts[0] && (
        <section className="relative z-10 overflow-hidden rounded-2xl border border-emerald-300/12 bg-emerald-300/[0.045] p-4 sm:p-5">
          <div className="pointer-events-none absolute inset-y-4 left-0 w-px bg-gradient-to-b from-transparent via-emerald-200/35 to-transparent" />
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-medium text-white">
                购买前最终自检
              </h3>
              <p className="mt-1 text-xs leading-5 text-emerald-100/58">
                下单前快速过一遍，把推荐放回真实使用场景里确认。
              </p>
            </div>
            <span className="inline-flex shrink-0 self-start rounded-full border border-emerald-300/18 bg-emerald-300/10 px-3 py-1.5 text-[11px] text-emerald-100/78">
              FINAL CHECK
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {prePurchaseChecklist.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-white/8 bg-slate-950/22 px-3 py-3"
              >
                <p className="text-[11px] font-medium text-emerald-100/88">
                  {item.title}
                </p>
                <p className="mt-1.5 text-xs leading-5 text-slate-300">
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {canShowRecalibrationModule && (
        <motion.section
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03] p-4 sm:p-5"
        >
          <div className="relative space-y-4">
            <button
              type="button"
              onClick={() => setIsRecalibrationPanelOpen((isOpen) => !isOpen)}
              aria-expanded={isRecalibrationPanelOpen}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <div className="min-w-0">
                <h3 className="text-sm font-medium text-white">
                  对当前结果不满意？
                </h3>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  我们会基于当前问卷和候选池，再重新生成一版更适合你的推荐结果。
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full border border-cyan-400/18 bg-cyan-400/10 px-2.5 py-1 text-[11px] text-cyan-100/82">
                  重新生成推荐
                </span>
                <ChevronDown
                  className={[
                    "h-4 w-4 shrink-0 text-slate-400 transition-transform",
                    isRecalibrationPanelOpen ? "rotate-180" : "",
                  ].join(" ")}
                />
              </div>
            </button>

            {isRecalibrationPanelOpen ? (
              <div className="space-y-4 border-t border-white/8 pt-4">
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-left">
                  <p className="text-sm text-slate-200">
                    重新生成时会保留当前问卷和候选范围，只重新整理推荐顺序、说明理由和选购建议。
                  </p>
                  <p className="mt-2 text-[11px] leading-5 text-slate-500">
                    如果你觉得当前结果不够贴合，这里更适合先试一次重新生成，而不是重新答题。
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={onRecalibrateResults}
                    disabled={isRecalibratingResults}
                    className={[
                      "inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition-all sm:w-auto sm:self-start",
                      isRecalibratingResults
                        ? "cursor-wait border border-cyan-300/20 bg-cyan-300/10 text-cyan-100/80"
                        : "border border-cyan-400/30 bg-cyan-400/15 text-cyan-100 hover:bg-cyan-400/20",
                    ].join(" ")}
                  >
                    {isRecalibratingResults ? (
                      <>
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        <span>正在重新生成推荐，请稍候</span>
                      </>
                    ) : (
                      <span>{recalibrationButtonLabel}</span>
                    )}
                  </button>

                  {resultRecalibrationError && (
                    <div className="flex items-start gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100/90">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                      <div>
                        <p>重新生成失败，当前结果已保留。</p>
                        <p className="mt-1 text-rose-100/75">{resultRecalibrationError}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </motion.section>
      )}

      {nextStepGroups.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-3xl rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 sm:p-5"
        >
          <div className="flex items-center gap-2 mb-2 text-amber-400">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium tracking-wide">下一步建议</span>
          </div>
          <div className="space-y-4">
            {nextStepGroups.map((group) => (
              <div
                key={group.id}
                className="rounded-2xl border border-white/8 bg-black/10 p-3"
              >
                <h3 className="mb-2 text-sm font-medium text-amber-200">
                  {group.title}
                </h3>
                <ul className="space-y-2">
                  {group.items.map((tip, index) => (
                    <li
                      key={`${group.id}-${index}`}
                      className="flex items-start gap-2 text-sm leading-6 text-amber-100/85"
                    >
                      <span className="mt-1 shrink-0 text-amber-300">•</span>
                      <span className="break-words">{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {topProducts.length > 0 ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {topProducts.slice(1, 3).map((product, index) => (
              getProductHref(product) ? (
                <a
                  key={product.id}
                  href={getProductHref(product)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glass-panel group flex flex-col rounded-2xl p-3 transition-transform duration-200 hover:-translate-y-0.5 hover:border-cyan-300/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:p-4"
                >
                  <div className="relative mb-3 aspect-[16/10] w-full overflow-hidden rounded-xl bg-black/20">
                    {renderProductImage(product, "h-5 w-5 text-white/30")}
                  </div>
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    <span className="inline-block px-1.5 py-0.5 rounded bg-white/10 text-slate-300 text-[10px]">
                      {index === 0 ? "最具性价比" : "探索备选"}
                    </span>
                    <span className="text-[10px] text-cyan-500/70">
                      {product.brand}
                    </span>
                  </div>
                  <h3 className="mb-1 break-words text-sm font-medium leading-relaxed text-white">
                    {getProductDisplayName(product)}
                  </h3>
                  {product.tags && product.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {product.tags.slice(0, 2).map((tag, tagIndex) => (
                        <span
                          key={tagIndex}
                          className="rounded border border-indigo-500/20 bg-indigo-500/10 px-1 py-0.5 text-[8px] text-indigo-300/80 break-words"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {product.reason && (
                    <p className="mb-2 text-[11px] italic leading-relaxed text-slate-400">
                      “{product.reason}”
                    </p>
                  )}
                  <div className="mt-auto flex items-center justify-between gap-3 pt-2">
                    <>
                      <span className="text-sm text-cyan-400">
                        ¥{product.price}
                      </span>
                      {renderClickableHint("点击查看")}
                    </>
                  </div>
                </a>
              ) : (
                <div
                  key={product.id}
                  className="glass-panel flex flex-col rounded-2xl p-3 sm:p-4"
                >
                  <div className="relative mb-3 aspect-[16/10] w-full overflow-hidden rounded-xl bg-black/20">
                    {renderProductImage(product, "h-5 w-5 text-white/30")}
                  </div>
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    <span className="inline-block px-1.5 py-0.5 rounded bg-white/10 text-slate-300 text-[10px]">
                      {index === 0 ? "最具性价比" : "探索备选"}
                    </span>
                    <span className="text-[10px] text-cyan-500/70">
                      {product.brand}
                    </span>
                  </div>
                  <h3 className="mb-1 break-words text-sm font-medium leading-relaxed text-white">
                    {getProductDisplayName(product)}
                  </h3>
                  {product.tags && product.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {product.tags.slice(0, 2).map((tag, tagIndex) => (
                        <span
                          key={tagIndex}
                          className="rounded border border-indigo-500/20 bg-indigo-500/10 px-1 py-0.5 text-[8px] text-indigo-300/80 break-words"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {product.reason && (
                    <p className="mb-2 text-[11px] italic leading-relaxed text-slate-400">
                      “{product.reason}”
                    </p>
                  )}
                  <div className="mt-auto flex items-center justify-between gap-3 pt-2">
                    <span className="text-sm text-cyan-400">
                      ¥{product.price}
                    </span>
                  </div>
                </div>
              )
            ))}
          </div>

          {backupProducts.length > 0 && (
            <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 sm:p-5">
              <button
                type="button"
                onClick={() => setIsBackupPanelOpen((isOpen) => !isOpen)}
                aria-expanded={isBackupPanelOpen}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-medium text-white">
                      想换一种侧重点？
                    </h3>
                    <span className="rounded-full border border-cyan-400/18 bg-cyan-400/8 px-2.5 py-1 text-[11px] text-cyan-100/80">
                      {backupDirectionTeaser.countText}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    {backupDirectionTeaser.directionText}，不影响当前主推荐排序。
                  </p>
                </div>
                <ChevronDown
                  className={[
                    "h-4 w-4 shrink-0 text-slate-400 transition-transform",
                    isBackupPanelOpen ? "rotate-180" : "",
                  ].join(" ")}
                />
              </button>

              <div
                className={[
                  "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
                  isBackupPanelOpen
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0",
                ].join(" ")}
              >
                <div className="overflow-hidden">
                  <div className="space-y-4 border-t border-white/8 pt-4">
                    <p className="max-w-3xl text-sm leading-6 text-slate-400">
                      这些备选不会改动主推荐排序，只是在你想更静音、更省预算或更偏特定体验时，提供几个可快速切换的方向。
                    </p>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      {backupProducts.map((product) => (
                        getProductHref(product) ? (
                          <a
                            key={product.id}
                            href={getProductHref(product)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="glass-panel group block overflow-hidden rounded-2xl transition-transform duration-200 hover:-translate-y-0.5 hover:border-cyan-300/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                          >
                            <div className="flex h-full flex-col md:flex-row">
                              <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-black/20 md:w-44">
                                {renderProductImage(product, "h-6 w-6 text-white/40")}
                              </div>

                              <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="min-w-0 space-y-2">
                                    <span className="inline-flex max-w-full items-center rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-[11px] text-cyan-200">
                                      <span className="break-words">
                                        {product.backupLabel}
                                      </span>
                                    </span>
                                    <h4 className="break-words text-base font-medium leading-6 text-white">
                                      {getProductDisplayName(product)}
                                    </h4>
                                  </div>

                                  <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                                    <span className="text-base font-semibold text-cyan-400">
                                      ¥{product.price}
                                    </span>
                                    <span className="text-[11px] text-slate-500">
                                      {product.brand}
                                    </span>
                                  </div>
                                </div>

                                <p className="text-sm leading-6 text-slate-300">
                                  {product.backupReason}
                                </p>

                                <div className="flex flex-wrap gap-2">
                                  {getMetricChips(product).map((chip) => {
                                    const Icon = chip.icon;
                                    return (
                                      <button
                                        key={chip.id}
                                        type="button"
                                        onClick={() => handleOpenKnowledgeTopic(chip.topicSlug, chip.sectionId)}
                                        className="flex max-w-full cursor-pointer items-start gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300 transition-colors hover:border-cyan-300/24 hover:bg-cyan-300/[0.08]"
                                        title="了解这个参数"
                                      >
                                        <Icon className="mt-0.5 h-3 w-3 shrink-0" />
                                        <span className="break-words">{chip.label}</span>
                                      </button>
                                    );
                                  })}
                                </div>

                                <div className="pt-1">{renderClickableHint()}</div>
                              </div>
                            </div>
                          </a>
                        ) : (
                          <article
                            key={product.id}
                            className="glass-panel overflow-hidden rounded-2xl"
                          >
                            <div className="flex h-full flex-col md:flex-row">
                              <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-black/20 md:w-44">
                                {renderProductImage(product, "h-6 w-6 text-white/40")}
                              </div>

                              <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="min-w-0 space-y-2">
                                    <span className="inline-flex max-w-full items-center rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-[11px] text-cyan-200">
                                      <span className="break-words">
                                        {product.backupLabel}
                                      </span>
                                    </span>
                                    <h4 className="break-words text-base font-medium leading-6 text-white">
                                      {getProductDisplayName(product)}
                                    </h4>
                                  </div>

                                  <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                                    <span className="text-base font-semibold text-cyan-400">
                                      ¥{product.price}
                                    </span>
                                    <span className="text-[11px] text-slate-500">
                                      {product.brand}
                                    </span>
                                  </div>
                                </div>

                                <p className="text-sm leading-6 text-slate-300">
                                  {product.backupReason}
                                </p>

                                <div className="flex flex-wrap gap-2">
                                  {getMetricChips(product).map((chip) => {
                                    const Icon = chip.icon;
                                    return (
                                      <button
                                        key={chip.id}
                                        type="button"
                                        onClick={() => handleOpenKnowledgeTopic(chip.topicSlug, chip.sectionId)}
                                        className="flex max-w-full cursor-pointer items-start gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300 transition-colors hover:border-cyan-300/24 hover:bg-cyan-300/[0.08]"
                                        title="了解这个参数"
                                      >
                                        <Icon className="mt-0.5 h-3 w-3 shrink-0" />
                                        <span className="break-words">{chip.label}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </article>
                        )
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="glass-panel rounded-3xl p-8 text-center">
          <p className="text-slate-300">未找到完全匹配的装备，请尝试放宽条件。</p>
        </div>
      )}

      <button
        onClick={onReset}
        disabled={isRecalibratingResults}
        className="w-full py-4 mt-8 rounded-xl bg-white/5 text-slate-300 transition-colors text-sm hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white/5"
      >
        重新回答偏好问题
      </button>
    </motion.div>
  );
}
