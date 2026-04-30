import { motion } from "motion/react";
import {
  AlertCircle,
  ArrowUpRight,
  LoaderCircle,
  Orbit,
  Sparkles,
  VolumeX,
  Droplets,
  Zap,
} from "lucide-react";
import { ProductImage } from "../components/ProductImage";
import { AnswerState } from "../data/mock";
import type { AppAiProvider } from "../lib/app-ai-chain";
import { RankedProduct } from "../lib/app-shell";
import { dedupeDisplayTags } from "../lib/display-tags";
import {
  RESULT_MODEL_OPTIONS,
  getResultModelOption,
} from "../lib/result-models";
import {
  RESULT_TUNING_OPTIONS,
  type ResultTuningMode,
} from "../lib/result-tuning";
import { buildResultComparisonRows } from "../lib/result-comparison";
import type { BackupCandidate } from "../lib/recommendation-results";
import { getResultLeadCopy } from "../lib/quiz-branching";

type ResultsBackupProduct = BackupCandidate;

const MAX_RELAXATION_TIPS = 3;
const MAX_SHOPPING_GUIDANCE_WITH_RELAXATION = 3;
const MAX_SHOPPING_GUIDANCE_ONLY = 5;

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
  product: Pick<RankedProduct, "imagePlaceholder" | "name">,
  iconClassName: string,
) {
  return (
    <ProductImage
      imageValue={product.imagePlaceholder}
      alt={product.name}
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
      label:
        product.maxDb == null ? "噪音参数缺失" : `噪音 < ${product.maxDb}dB`,
    },
    {
      id: "waterproof",
      icon: Droplets,
      label:
        product.waterproof == null
          ? "防水参数缺失"
          : `防水 IPX${product.waterproof}`,
    },
    {
      id: "motor-type",
      icon: Zap,
      label: product.motorType === "gentle" ? "温柔电机" : "强力电机",
    },
  ];
}

function getResultSourceSummary(
  currentResultProvider: AppAiProvider | undefined,
  currentResultModelName: string | undefined,
) {
  const currentOption = getResultModelOption(currentResultProvider);

  if (!currentOption) {
    return {
      providerLabel: "本地规则兜底",
      modelLabel: "未记录模型",
    };
  }

  return {
    providerLabel: currentOption.label,
    modelLabel: currentResultModelName || currentOption.model,
  };
}

function getRecalibrationButtonLabel(
  selectedResultProvider: AppAiProvider,
  currentResultProvider: AppAiProvider | undefined,
) {
  if (selectedResultProvider === currentResultProvider) {
    return "重新生成当前模型结果";
  }

  const selectedOption = getResultModelOption(selectedResultProvider);
  return `用 ${selectedOption?.label || "所选模型"} 重新校准结果`;
}

type ResultsPageProps = {
  pageVariants: any;
  answers: AnswerState;
  topProducts: RankedProduct[];
  backupProducts: ResultsBackupProduct[];
  shoppingGuidance: string[];
  recommendationTips: string[];
  currentResultProvider?: AppAiProvider;
  currentResultModelName?: string;
  selectedResultProvider: AppAiProvider;
  isRecalibratingResults: boolean;
  resultRecalibrationError: string | null;
  onSelectResultProvider: (provider: AppAiProvider) => void;
  onRecalibrateResults: () => void;
  onTuneResults: (mode: ResultTuningMode) => void;
  onReset: () => void;
};

export function ResultsPage({
  pageVariants,
  answers,
  topProducts,
  backupProducts,
  shoppingGuidance,
  recommendationTips,
  currentResultProvider,
  currentResultModelName,
  selectedResultProvider,
  isRecalibratingResults,
  resultRecalibrationError,
  onSelectResultProvider,
  onRecalibrateResults,
  onTuneResults,
  onReset,
}: ResultsPageProps) {
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
  const resultSourceSummary = getResultSourceSummary(
    currentResultProvider,
    currentResultModelName,
  );
  const recalibrationButtonLabel = getRecalibrationButtonLabel(
    selectedResultProvider,
    currentResultProvider,
  );
  const canShowRecalibrationModule = topProducts.length > 0;
  const primaryProductHref = topProducts[0] ? getProductHref(topProducts[0]) : undefined;
  const resultTags = dedupeDisplayTags(answers.tags);
  const resultLeadCopy = getResultLeadCopy(answers);
  const comparisonProducts = topProducts.slice(0, 3);
  const comparisonRows = buildResultComparisonRows(comparisonProducts);

  return (
    <motion.div
      key="result"
      variants={pageVariants}
      initial="initial"
      animate="in"
      exit="out"
      className="w-full space-y-6 overflow-x-hidden"
    >
      <div className="text-center mb-6">
        <h2 className="text-2xl font-light text-white mb-2">匹配完成</h2>
        <div className="flex flex-wrap justify-center gap-1.5 mb-4 max-w-sm mx-auto">
          {resultTags.map((tag, index) => (
            <span
              key={index}
              className="px-2 py-0.5 rounded border border-white/10 bg-white/5 text-[10px] text-slate-300"
            >
              {tag}
            </span>
          ))}
        </div>
        <p className="text-sm text-slate-400">
          {resultLeadCopy}
        </p>
      </div>

      {topProducts.length > 0 && (
        <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-medium text-white">快速微调结果</h3>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                保留当前问卷，只轻微调整一个侧重点。
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {RESULT_TUNING_OPTIONS.map((option) => (
                <button
                  key={option.mode}
                  type="button"
                  onClick={() => onTuneResults(option.mode)}
                  disabled={isRecalibratingResults}
                  className="rounded-xl border border-cyan-400/18 bg-cyan-400/8 px-3 py-2 text-xs text-cyan-100 transition-colors hover:border-cyan-300/35 hover:bg-cyan-400/14 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {comparisonProducts.length >= 2 && (
        <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 sm:p-5">
          <div className="mb-4">
            <h3 className="text-sm font-medium text-white">Top 3 快速对比</h3>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              直接看三款在关键决策点上的差异。
            </p>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[44rem]">
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
                      {product.name}
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
        </section>
      )}

      {canShowRecalibrationModule && (
        <motion.section
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl border border-cyan-500/20 bg-slate-950/45 p-4 backdrop-blur-xl sm:p-5"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.14),transparent_34%)]" />
          <div className="relative space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/15 bg-cyan-400/10 px-3 py-1 text-[11px] tracking-[0.18em] text-cyan-200/80">
                  <Orbit className="h-3.5 w-3.5" />
                  <span>模型二次校准</span>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-white">换个模型，再看一版结果</h3>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
                    先选择想尝试的模型，再手动触发重算。未点击按钮前，当前结果不会变化。
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-left sm:max-w-xs">
                <p className="text-[11px] text-slate-500">当前结果来源</p>
                <p className="mt-1 text-sm text-slate-200">
                  {resultSourceSummary.providerLabel}
                </p>
                <p className="mt-1 break-all text-[11px] text-cyan-200/60">
                  {resultSourceSummary.modelLabel}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {RESULT_MODEL_OPTIONS.map((option) => {
                const isSelected = option.provider === selectedResultProvider;
                const isCurrent = option.provider === currentResultProvider;

                return (
                  <button
                    key={option.provider}
                    type="button"
                    onClick={() => onSelectResultProvider(option.provider)}
                    disabled={isRecalibratingResults}
                    aria-pressed={isSelected}
                    className={[
                      "group rounded-2xl border px-4 py-3 text-left transition-all",
                      "bg-white/[0.03] backdrop-blur-sm",
                      isSelected
                        ? "border-cyan-400/50 bg-cyan-400/12 shadow-[0_0_0_1px_rgba(34,211,238,0.14),0_12px_30px_rgba(8,47,73,0.25)]"
                        : "border-white/8 hover:border-cyan-400/25 hover:bg-white/[0.05]",
                      isRecalibratingResults
                        ? "cursor-not-allowed opacity-60"
                        : "cursor-pointer",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-white">
                            {option.label}
                          </span>
                          {isCurrent && (
                            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] text-cyan-200/75">
                              当前结果
                            </span>
                          )}
                        </div>
                        <p className="mt-2 break-all text-[11px] leading-5 text-slate-400">
                          {option.model}
                        </p>
                        <p className="mt-2 text-[11px] leading-5 text-slate-300/80">
                          {option.description}
                        </p>
                      </div>
                      <span
                        className={[
                          "mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full transition-colors",
                          isSelected ? "bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.7)]" : "bg-slate-600 group-hover:bg-cyan-500/60",
                        ].join(" ")}
                      />
                    </div>
                  </button>
                );
              })}
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
                    <span>模型校准中，请稍候</span>
                  </>
                ) : (
                  <span>{recalibrationButtonLabel}</span>
                )}
              </button>

              {resultRecalibrationError && (
                <div className="flex items-start gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100/90">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                  <div>
                    <p>模型校准失败，当前结果已保留。</p>
                    <p className="mt-1 text-rose-100/75">{resultRecalibrationError}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.section>
      )}

      {hasGuidance && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-3xl rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 sm:p-5"
        >
          <div className="flex items-center gap-2 mb-2 text-amber-400">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium tracking-wide">结果提示</span>
          </div>
          <div className="space-y-4">
            {relaxationTips.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-amber-200">
                  放宽条件建议
                </h3>
                <ul className="space-y-2">
                  {relaxationTips.map((tip, index) => (
                    <li
                      key={`relaxation-${index}`}
                      className="flex items-start gap-2 text-sm leading-6 text-amber-100/85"
                    >
                      <span className="mt-1 shrink-0 text-amber-300">•</span>
                      <span className="break-words">{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {shoppingGuidanceItems.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-amber-200">
                  选购建议
                </h3>
                <ul className="space-y-2">
                  {shoppingGuidanceItems.map((tip, index) => (
                    <li
                      key={`shopping-${index}`}
                      className="flex items-start gap-2 text-sm leading-6 text-amber-100/85"
                    >
                      <span className="mt-1 shrink-0 text-amber-300">•</span>
                      <span className="break-words">{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {topProducts.length > 0 ? (
        <div className="space-y-4">
          {primaryProductHref ? (
            <a
              href={primaryProductHref}
              target="_blank"
              rel="noopener noreferrer"
              className="group block rounded-3xl transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              <div className="relative overflow-hidden rounded-3xl border border-cyan-500/30 bg-cyan-950/20 backdrop-blur-xl p-[3px] transition-colors duration-200 group-hover:border-cyan-300/45">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-500"></div>

                <div className="relative mb-3 aspect-[16/9] w-full overflow-hidden rounded-2xl bg-black/20 sm:aspect-[2.6/1]">
                  {renderProductImage(topProducts[0], "h-8 w-8 text-white/50")}
                </div>

                <div className="px-3 pb-3 sm:px-4 sm:pb-4">
                  <div className="mb-2 flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <span className="inline-block rounded-md bg-cyan-500/20 px-2 py-1 text-[10px] font-mono text-cyan-300 mb-2">
                        算法最匹配（第 1 推荐）
                      </span>
                      <h3 className="break-words text-lg font-medium leading-snug text-white">
                        {topProducts[0].name}
                      </h3>
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                      <span className="text-lg font-semibold text-cyan-400">
                        ¥{topProducts[0].price}
                      </span>
                      <span className="mt-1">{renderClickableHint()}</span>
                    </div>
                  </div>

                  {topProducts[0].tags && topProducts[0].tags.length > 0 && (
                    <div className="mt-2 mb-3 flex flex-wrap gap-1.5">
                      {topProducts[0].tags.map((tag, index) => (
                        <span
                          key={index}
                          className="break-words rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-400"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {topProducts[0].reason && (
                    <div className="mt-3 rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-2.5">
                      <p className="text-[11px] italic leading-relaxed text-cyan-200/80">
                        <Sparkles className="w-3 h-3 inline-block mr-1 mb-0.5 text-cyan-400" />
                        “ {topProducts[0].reason} ”
                      </p>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {getMetricChips(topProducts[0]).map((chip) => {
                      const Icon = chip.icon;
                      return (
                        <div
                          key={chip.id}
                          className="flex max-w-full items-start gap-1 rounded bg-white/5 px-2 py-1 text-xs text-slate-300"
                        >
                          <Icon className="mt-0.5 h-3 w-3 shrink-0" />
                          <span className="break-words">{chip.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </a>
          ) : (
            <div className="relative overflow-hidden rounded-3xl border border-cyan-500/30 bg-cyan-950/20 backdrop-blur-xl p-[3px]">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-500"></div>

              <div className="relative mb-3 aspect-[16/9] w-full overflow-hidden rounded-2xl bg-black/20 sm:aspect-[2.6/1]">
                {renderProductImage(topProducts[0], "h-8 w-8 text-white/50")}
              </div>

              <div className="px-3 pb-3 sm:px-4 sm:pb-4">
                <div className="mb-2 flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <span className="inline-block px-2 py-1 rounded-md bg-cyan-500/20 text-cyan-300 text-[10px] font-mono mb-2">
                      算法最匹配（第 1 推荐）
                    </span>
                    <h3 className="break-words text-lg font-medium leading-snug text-white">
                      {topProducts[0].name}
                    </h3>
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                    <span className="text-lg font-semibold text-cyan-400">
                      ¥{topProducts[0].price}
                    </span>
                  </div>
                </div>

                {topProducts[0].tags && topProducts[0].tags.length > 0 && (
                  <div className="mt-2 mb-3 flex flex-wrap gap-1.5">
                    {topProducts[0].tags.map((tag, index) => (
                      <span
                        key={index}
                        className="break-words rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-400"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {topProducts[0].reason && (
                  <div className="mt-3 rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-2.5">
                    <p className="text-[11px] text-cyan-200/80 leading-relaxed italic">
                      <Sparkles className="w-3 h-3 inline-block mr-1 mb-0.5 text-cyan-400" />
                      “ {topProducts[0].reason} ”
                    </p>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {getMetricChips(topProducts[0]).map((chip) => {
                    const Icon = chip.icon;
                    return (
                      <div
                        key={chip.id}
                        className="flex max-w-full items-start gap-1 rounded bg-white/5 px-2 py-1 text-xs text-slate-300"
                      >
                        <Icon className="mt-0.5 h-3 w-3 shrink-0" />
                        <span className="break-words">{chip.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

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
                    {product.name}
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
                    {product.name}
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
            <section className="space-y-3 pt-2">
              <div className="space-y-1">
                <h3 className="text-lg font-medium text-white">
                  如果你想换一种侧重点
                </h3>
                <p className="max-w-3xl text-sm leading-6 text-slate-400">
                  这些备选不会改动主推荐排序，但能帮你快速切换到更静音、更省预算或更偏特定体验的方向。
                </p>
              </div>

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
                                {product.name}
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
                                <div
                                  key={chip.id}
                                  className="flex max-w-full items-start gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300"
                                >
                                  <Icon className="mt-0.5 h-3 w-3 shrink-0" />
                                  <span className="break-words">{chip.label}</span>
                                </div>
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
                                {product.name}
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
                                <div
                                  key={chip.id}
                                  className="flex max-w-full items-start gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300"
                                >
                                  <Icon className="mt-0.5 h-3 w-3 shrink-0" />
                                  <span className="break-words">{chip.label}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </article>
                  )
                ))}
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
