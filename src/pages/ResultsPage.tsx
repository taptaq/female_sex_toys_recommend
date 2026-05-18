import { motion } from "motion/react";
import { useState } from "react";
import {
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
import { BodyPersonaQuizDialog } from "../components/BodyPersonaQuizDialog.tsx";
import {
  BodyPersonaResultPanel,
  normalizeBodyPersonaFullReport,
} from "../components/BodyPersonaResultPanel.tsx";
import { BodyPersonaFullReportDialog } from "../components/BodyPersonaFullReportDialog.tsx";
import { BodyPersonaUnlockCard } from "../components/BodyPersonaUnlockCard.tsx";
import { ResultsAlternativeProductsSection } from "../components/results/ResultsAlternativeProductsSection.tsx";
import { ResultsNextStepsPanel } from "../components/results/ResultsNextStepsPanel.tsx";
import { ResultsParameterEducationSection } from "../components/results/ResultsParameterEducationSection.tsx";
import { ResultsPrimaryRecommendationPanel } from "../components/results/ResultsPrimaryRecommendationPanel.tsx";
import { ResultsRecalibrationPanel } from "../components/results/ResultsRecalibrationPanel.tsx";
import { AnswerState } from "../data/mock.ts";
import { RankedProduct } from "../lib/app-shell.ts";
import type { BodyPersonaFullReport } from "../lib/body-persona-report.ts";
import type {
  BodyPersonaAnswerValue,
  BodyPersonaAnswers,
  BodyPersonaQuestion,
  BodyPersonaQuestionId,
  BodyPersonaResult,
} from "../lib/body-persona.ts";
import { dedupeDisplayTags } from "../lib/display-tags.ts";
import {
  RESULT_TUNING_OPTIONS,
  type ResultTuningMode,
} from "../lib/result-tuning.ts";
import {
  buildResultComparisonRows,
  buildResultComparisonTeaser,
} from "../lib/result-comparison.ts";
import {
  buildResultAvoidanceTips,
  buildResultConfidenceSummary,
  buildResultNextStepGroups,
  buildResultRouteSummary,
} from "../lib/recommendation-results.ts";
import { getProductDisplayName } from "../lib/product-display-name.ts";
import type { BackupCandidate } from "../lib/recommendation-results.ts";
import { getResultLeadCopy } from "../lib/quiz-branching.ts";
import {
  DEFAULT_RECOMMENDATION_REROLL_REASON,
  type RecommendationRerollReason,
} from "../lib/recommendation-reroll.ts";
import { AuthPanel, type AuthPanelMode } from "../components/AuthPanel.tsx";
import { buildKnowledgeNebulaPath } from "../lib/knowledge-nebula-route.ts";

type ResultsBackupProduct = BackupCandidate;
export type ResultEditableCondition = "budget" | "quietness" | "scene";
type BodyPersonaPageState = {
  sessionId: string;
  status: "idle" | "completed_free" | "unlocking" | "unlocked";
  freeSummary: BodyPersonaResult["freeSummary"] | null;
  fullReport: BodyPersonaFullReport | null;
};

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

function getProductBrandLabel(product: Pick<RankedProduct, "brand">) {
  return String(product.brand || "").trim() || "探索品牌";
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

type ResultsPageProps = {
  pageVariants: any;
  answers: AnswerState;
  appliedResultTuningModes?: ResultTuningMode[];
  topProducts: RankedProduct[];
  backupProducts: ResultsBackupProduct[];
  shoppingGuidance: string[];
  recommendationTips: string[];
  bodyPersonaState?: BodyPersonaPageState | null;
  isStartingBodyPersona?: boolean;
  isBodyPersonaQuizOpen?: boolean;
  bodyPersonaQuestions?: readonly BodyPersonaQuestion[];
  bodyPersonaDraftAnswers?: BodyPersonaAnswers;
  isSubmittingBodyPersonaQuiz?: boolean;
  isUnlockingBodyPersona?: boolean;
  isBodyPersonaUnlockLoginRequired?: boolean;
  isBodyPersonaFullReportOpen?: boolean;
  isEnhancingResults?: boolean;
  isRecalibratingResults: boolean;
  resultRecalibrationError: string | null;
  onStartBodyPersona?: () => void;
  onCloseBodyPersonaQuiz?: () => void;
  onChangeBodyPersonaAnswer?: (
    questionId: BodyPersonaQuestionId,
    value: BodyPersonaAnswerValue,
  ) => void;
  onSubmitBodyPersonaQuiz?: () => void | Promise<void>;
  onUnlockBodyPersona?: () => void | Promise<void>;
  onOpenBodyPersonaFullReport?: () => void;
  onCloseBodyPersonaFullReport?: () => void;
  onRecalibrateResults: (reason: RecommendationRerollReason) => void;
  onTuneResults: (mode: ResultTuningMode) => void;
  onEditQuizCondition?: (condition: ResultEditableCondition) => void;
  onBrowseLibrary?: (product?: RankedProduct) => void;
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
  onBackHome?: () => void;
  onReset: () => void;
  favoriteProductIds?: Set<string>;
  onToggleFavorite?: (product: RankedProduct) => void | Promise<void>;
};

export function ResultsPage({
  pageVariants,
  answers,
  appliedResultTuningModes = [],
  topProducts,
  backupProducts,
  shoppingGuidance,
  recommendationTips,
  bodyPersonaState = null,
  isStartingBodyPersona = false,
  isBodyPersonaQuizOpen = false,
  bodyPersonaQuestions = [],
  bodyPersonaDraftAnswers = {},
  isSubmittingBodyPersonaQuiz = false,
  isUnlockingBodyPersona = false,
  isBodyPersonaUnlockLoginRequired,
  isBodyPersonaFullReportOpen = false,
  isEnhancingResults = false,
  isRecalibratingResults,
  resultRecalibrationError,
  onStartBodyPersona,
  onCloseBodyPersonaQuiz,
  onChangeBodyPersonaAnswer,
  onSubmitBodyPersonaQuiz,
  onUnlockBodyPersona,
  onOpenBodyPersonaFullReport,
  onCloseBodyPersonaFullReport,
  onRecalibrateResults,
  onTuneResults,
  onEditQuizCondition,
  onBrowseLibrary,
  onSaveRecommendationProfile,
  onOpenRecommendationProfiles,
  onOpenKnowledgeNebula,
  isSavingRecommendationProfile,
  saveRecommendationProfileMessage,
  authPanel,
  onBackHome,
  onReset,
  favoriteProductIds = new Set(),
  onToggleFavorite,
}: ResultsPageProps) {
  const [isRecalibrationPanelOpen, setIsRecalibrationPanelOpen] = useState(false);
  const [isBackupPanelOpen, setIsBackupPanelOpen] = useState(false);
  const [isComparisonPanelOpen, setIsComparisonPanelOpen] = useState(false);
  const [isSavePanelOpen, setIsSavePanelOpen] = useState(false);
  const [isParameterGuideOpen, setIsParameterGuideOpen] = useState(false);
  const [selectedRerollReason, setSelectedRerollReason] = useState<RecommendationRerollReason>(
    DEFAULT_RECOMMENDATION_REROLL_REASON,
  );
  const bodyPersonaUnlockNeedsLogin =
    isBodyPersonaUnlockLoginRequired ?? authPanel.userLabel == null;
  const normalizedBodyPersonaFullReport = normalizeBodyPersonaFullReport(
    bodyPersonaState?.fullReport ?? null,
  );
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
  const recalibrationButtonLabel = (() => {
    switch (selectedRerollReason) {
      case "want_more_accurate":
        return "再给我一版更贴合现在需求的推荐";
      case "want_different_style":
        return "换一组不同侧重点的推荐";
      case "did_not_understand":
        return "换一版更好理解的推荐";
    }
  })();
  const canShowRecalibrationModule = topProducts.length > 0;
  const resultTags = dedupeDisplayTags(answers.tags);
  const resultLeadCopy = getResultLeadCopy(answers);
  const comparisonProducts = topProducts.slice(0, 3);
  const comparisonRows = buildResultComparisonRows(comparisonProducts, answers.gender);
  const comparisonTeaser = buildResultComparisonTeaser(
    comparisonRows,
    comparisonProducts.length,
  );
  const primaryProductHref = topProducts[0]
    ? getProductHref(topProducts[0])
    : undefined;
  const primaryProductDisplayName = topProducts[0]
    ? getProductDisplayName(topProducts[0])
    : "";
  const primaryProductBrandLabel = topProducts[0]
    ? getProductBrandLabel(topProducts[0])
    : "";
  const primaryConfidenceSummary = topProducts[0]
    ? buildResultConfidenceSummary(topProducts[0], answers)
    : null;
  const primaryRouteSummary = topProducts[0]
    ? buildResultRouteSummary(topProducts[0], answers)
    : null;
  const prePurchaseChecklist = buildPrePurchaseChecklist(answers, topProducts[0]);
  const avoidanceTips = buildResultAvoidanceTips(answers);
  const visibleResultTags = resultTags.slice(0, 3);
  const hiddenResultTagCount = Math.max(resultTags.length - visibleResultTags.length, 0);
  const appliedTuningOptions = RESULT_TUNING_OPTIONS.filter((option) =>
    appliedResultTuningModes.includes(option.mode),
  );
  const isSignedIn = Boolean(authPanel.userLabel);
  const sortedParameterPreviewItems = getSortedParameterPreviewItems(answers);
  const nextStepGroups = buildResultNextStepGroups({
    answers,
    relaxationTips,
    shoppingGuidanceItems,
  });
  const primaryNextStepGroup = nextStepGroups[0] ?? null;
  const primaryNextStep = primaryNextStepGroup?.items[0] ?? null;
  const canBrowseSimilarLibraryProducts = Boolean(onBrowseLibrary && topProducts[0]);
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
  const resultsPrimaryPanelClassName =
    "results-report-panel relative z-10 overflow-hidden rounded-[1.75rem] border border-cyan-200/14 bg-slate-950/56 p-5 shadow-[0_24px_90px_rgba(8,47,73,0.2)] sm:p-6";

  return (
    <motion.div
      key="result"
      variants={pageVariants}
      initial="initial"
      animate="in"
      exit="out"
      className="results-report-shell relative isolate w-full space-y-6 overflow-x-hidden px-3 pt-3 pb-4 sm:px-4 sm:pt-4"
    >
      <div className="pointer-events-none absolute inset-x-[-12vw] top-[-8rem] -z-10 h-[30rem] bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.12),transparent_42%),radial-gradient(circle_at_12%_48%,rgba(59,130,246,0.09),transparent_34%),radial-gradient(circle_at_88%_58%,rgba(99,102,241,0.11),transparent_36%)]" />
      <div className="results-report-grid pointer-events-none absolute inset-0 -z-10 opacity-45" />

      <div className="relative z-10 mb-6 text-center">
        <p className="mb-3 font-mono text-[10px] tracking-[0.34em] text-cyan-200/50">
          匹配结果
        </p>
        <h2 className="mb-2 text-2xl font-light text-white">
          这次更贴近你的，是这条路线
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
        <p className="mx-auto mt-2 max-w-2xl text-xs leading-6 text-slate-500">
          先看主推荐，如果你想换个方向，再往下微调、比较备选，或者补一层长期人格画像。
        </p>
        {isEnhancingResults ? (
          <div className="mx-auto mt-4 flex max-w-xl items-start gap-3 rounded-2xl border border-cyan-300/14 bg-cyan-300/[0.055] px-4 py-3 text-left shadow-[0_14px_40px_rgba(8,47,73,0.12)]">
            <LoaderCircle className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-cyan-200/80" />
            <div>
              <p className="text-xs font-medium text-cyan-50/88">
                AI 正在润色备选说明和选购建议
              </p>
              <p className="mt-1 text-[11px] leading-5 text-cyan-100/55">
                主推荐已可先查看，下面的备选说明会在分析完成后自动更新。
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {topProducts[0] ? (
        <ResultsPrimaryRecommendationPanel
          className={resultsPrimaryPanelClassName}
          topProduct={topProducts[0]}
          primaryProductHref={primaryProductHref}
          primaryProductDisplayName={primaryProductDisplayName}
          primaryProductBrandLabel={primaryProductBrandLabel}
          primaryConfidenceSummary={primaryConfidenceSummary}
          primaryRouteSummary={primaryRouteSummary}
          avoidanceTips={avoidanceTips}
          primaryNextStepGroupTitle={primaryNextStepGroup?.title}
          primaryNextStep={primaryNextStep}
          renderProductImage={renderProductImage}
          renderClickableHint={renderClickableHint}
          isFavorited={favoriteProductIds.has(topProducts[0].originalId || topProducts[0].id)}
          onToggleFavorite={onToggleFavorite}
        />
      ) : null}

      {isBodyPersonaQuizOpen ? (
        <BodyPersonaQuizDialog
          questions={bodyPersonaQuestions}
          answers={bodyPersonaDraftAnswers}
          onClose={onCloseBodyPersonaQuiz ?? (() => undefined)}
          onChangeAnswer={
            onChangeBodyPersonaAnswer ?? (() => undefined)
          }
          onSubmit={onSubmitBodyPersonaQuiz ?? (() => undefined)}
          isSubmitting={isSubmittingBodyPersonaQuiz}
        />
      ) : null}

      <BodyPersonaFullReportDialog
        isOpen={isBodyPersonaFullReportOpen}
        report={normalizedBodyPersonaFullReport}
        onClose={onCloseBodyPersonaFullReport ?? (() => undefined)}
      />

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
                  const isApplied = appliedResultTuningModes.includes(option.mode);
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
          </div>
        </section>
      )}

      {canShowRecalibrationModule && (
        <ResultsRecalibrationPanel
          isOpen={isRecalibrationPanelOpen}
          onToggle={() => setIsRecalibrationPanelOpen((isOpen) => !isOpen)}
          selectedReason={selectedRerollReason}
          onSelectReason={setSelectedRerollReason}
          buttonLabel={recalibrationButtonLabel}
          isRecalibrating={isRecalibratingResults}
          errorMessage={resultRecalibrationError}
          onRecalibrate={onRecalibrateResults}
        />
      )}

      <BodyPersonaUnlockCard
        onStart={onStartBodyPersona ?? (() => undefined)}
        isBusy={isStartingBodyPersona || isSubmittingBodyPersonaQuiz}
        freeSummary={
          bodyPersonaState?.freeSummary
            ? {
                title: bodyPersonaState.freeSummary.title,
                blurb: bodyPersonaState.freeSummary.blurb,
              }
            : null
        }
      />

      {bodyPersonaState ? (
        <BodyPersonaResultPanel
          status={bodyPersonaState.status}
          freeSummary={bodyPersonaState.freeSummary}
          fullReport={normalizedBodyPersonaFullReport}
          onUnlock={onUnlockBodyPersona ?? (() => undefined)}
          onOpenFullReport={onOpenBodyPersonaFullReport}
          isUnlocking={isUnlockingBodyPersona}
          requiresLoginBeforeUnlock={bodyPersonaUnlockNeedsLogin}
        />
      ) : null}

      {topProducts.length > 0 ? (
        <ResultsAlternativeProductsSection
          topProducts={topProducts}
          canBrowseSimilarLibraryProducts={canBrowseSimilarLibraryProducts}
          onBrowseLibrary={onBrowseLibrary}
          backupProducts={backupProducts}
          isBackupPanelOpen={isBackupPanelOpen}
          onToggleBackupPanel={() => setIsBackupPanelOpen((isOpen) => !isOpen)}
          onOpenKnowledgeTopic={handleOpenKnowledgeTopic}
          renderProductImage={renderProductImage}
          renderClickableHint={renderClickableHint}
          getMetricChips={getMetricChips}
          favoriteProductIds={favoriteProductIds}
          onToggleFavorite={onToggleFavorite}
        />
      ) : (
        <div className="glass-panel rounded-3xl p-8 text-center">
          <p className="text-slate-300">未找到完全匹配的装备，请尝试放宽条件。</p>
        </div>
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
                <h3 className="text-sm font-medium text-white">主推荐横向对比</h3>
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
        <ResultsParameterEducationSection
          isGuideOpen={isParameterGuideOpen}
          onToggleGuide={() => setIsParameterGuideOpen((isOpen) => !isOpen)}
          onOpenTopic={handleOpenKnowledgeTopic}
          previewItems={sortedParameterPreviewItems}
          metricChips={getMetricChips(topProducts[0])}
        />
      )}

      <ResultsNextStepsPanel nextStepGroups={nextStepGroups} />

      {topProducts[0] && (
        <section className="relative z-10 overflow-hidden rounded-2xl border border-emerald-300/12 bg-emerald-300/[0.045] p-4 sm:p-5">
          <div id="result-final-check" />
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

      {topProducts.length > 0 && (
        <section className="relative z-10 rounded-2xl border border-cyan-400/12 bg-cyan-400/[0.04] p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
            <p className="mt-3 text-xs leading-5 text-cyan-100/65">
              {saveRecommendationProfileMessage}
            </p>
          )}

          {!isSignedIn && isSavePanelOpen && (
            <div className="mt-4">
              <AuthPanel {...authPanel} />
            </div>
          )}
        </section>
      )}

      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {onBackHome ? (
          <button
            onClick={onBackHome}
            disabled={isRecalibratingResults}
            className="w-full rounded-xl border border-white/10 bg-transparent py-4 text-sm text-slate-300 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
          >
            返回首页
          </button>
        ) : null}
        <button
          onClick={onReset}
          disabled={isRecalibratingResults}
          className="w-full rounded-xl bg-white/5 py-4 text-sm text-slate-300 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white/5"
        >
          重新回答偏好问题
        </button>
      </div>
    </motion.div>
  );
}
