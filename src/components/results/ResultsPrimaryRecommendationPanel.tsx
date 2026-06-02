import type { ReactNode, Ref } from "react";
import { AlertCircle, Heart, Sparkles } from "lucide-react";

import { BrandBriefCard } from "../BrandBriefCard.tsx";
import type { RankedProduct } from "../../lib/app-shell.ts";
import { resolveBrandBrief } from "../../lib/brand-brief.ts";
import {
  buildResultConfidenceSummary,
  buildResultRouteSummary,
} from "../../lib/recommendation-results.ts";

type ResultsPrimaryConfidenceSummary = ReturnType<
  typeof buildResultConfidenceSummary
>;
type ResultsPrimaryRouteSummary = ReturnType<typeof buildResultRouteSummary>;

function getConfidenceToneClassName(tone: "high" | "conditional" | "backup") {
  if (tone === "high") {
    return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
  }
  if (tone === "conditional") {
    return "border-amber-300/25 bg-amber-400/10 text-amber-100";
  }
  return "border-slate-300/20 bg-slate-400/10 text-slate-100";
}

function renderConfidenceSummary(summary: ResultsPrimaryConfidenceSummary) {
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
        <span className="text-[11px] text-slate-500">推荐信心与注意点</span>
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

function buildFemaleMvpPracticalChecks(product: RankedProduct) {
  const checks: Array<{ title: string; detail: string }> = [];

  if (typeof product.maxDb === "number") {
    checks.push({
      title: "声音",
      detail:
        product.maxDb <= 45
          ? `${product.maxDb}dB，更适合静音、同住或夜间场景。`
          : `${product.maxDb}dB 不算特别安静，同住时要先确认真实噪音反馈。`,
    });
  }

  if (typeof product.waterproof === "number") {
    checks.push({
      title: "清洁",
      detail:
        product.waterproof >= 7
          ? `IPX${product.waterproof}，清洁边界更宽。`
          : `IPX${product.waterproof}，先确认能不能水洗、哪些部位不能冲。`,
    });
  } else {
    checks.push({
      title: "清洁",
      detail: "防水等级不明确，先问清清洁方式和售后边界。",
    });
  }

  if (product.physicalForm === "external") {
    checks.push({
      title: "上手",
      detail: "外部路线更适合先找身体反馈，不用一开始就把强度拉满。",
    });
  } else if (product.physicalForm === "internal") {
    checks.push({
      title: "上手",
      detail: "入体路线先确认尺寸、材质和润滑方式，再从低档位开始。",
    });
  } else if (product.physicalForm === "composite") {
    checks.push({
      title: "上手",
      detail: "双通道更吃姿势和反馈，适合偏好更明确后再比较。",
    });
  }

  if (checks.length < 3) {
    checks.push({
      title: "价格",
      detail: `¥${product.price}，和渠道、售后、材质说明一起看。`,
    });
  }

  return checks.slice(0, 3);
}

function getFemaleMvpGuideNote(summary: ResultsPrimaryConfidenceSummary | null) {
  return summary?.caveats.find(
    (item) => !item.includes("主要参数与当前偏好吻合"),
  ) ?? null;
}

function buildFemaleMvpAskItems(
  checks: Array<{ title: string; detail: string }>,
  guideNote: string | null,
) {
  const soundCheck = checks.find((check) => check.title === "声音");
  const cleanCheck = checks.find((check) => check.title === "清洁");
  const handoffCheck = checks.find(
    (check) => check.title !== "声音" && check.title !== "清洁",
  );

  return [
    {
      question: "为什么先推荐这一款？",
      answer:
        guideNote ||
        handoffCheck?.detail ||
        "它不是参数最多，但更贴近你现在的使用状态，适合作为第一眼选择。",
      isOpen: true,
    },
    {
      question: "声音够安静吗？",
      answer:
        soundCheck?.detail ||
        "如果你很在意同住或夜间使用，先看买家反馈里的真实噪音描述。",
      isOpen: false,
    },
    {
      question: "买前要确认什么？",
      answer:
        cleanCheck?.detail ||
        "下单前先确认材质、清洁方式、售后和真实渠道，别只看价格。",
      isOpen: false,
    },
  ];
}

function getUrlOrigin(value: string | null | undefined) {
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function isMarketplaceUrl(value: string | null | undefined) {
  const origin = getUrlOrigin(value);
  if (!origin) return false;

  return /(?:tmall|taobao|jd|pinduoduo)\./i.test(origin);
}

export function ResultsPrimaryRecommendationPanel({
  className,
  topProduct,
  primaryProductHref,
  primaryProductDisplayName,
  primaryProductBrandLabel,
  primaryConfidenceSummary,
  primaryRouteSummary,
  avoidanceTips,
  primaryNextStepGroupTitle,
  primaryNextStep,
  renderProductImage,
  renderClickableHint,
  isFavorited = false,
  onToggleFavorite,
  isFemaleMvp = false,
  femaleMvpShareCardRef,
  onCreateFemaleMvpShareImage,
  isCreatingFemaleMvpShareImage = false,
}: {
  className: string;
  topProduct: RankedProduct;
  primaryProductHref?: string;
  primaryProductDisplayName: string;
  primaryProductBrandLabel: string;
  primaryConfidenceSummary: ResultsPrimaryConfidenceSummary | null;
  primaryRouteSummary: ResultsPrimaryRouteSummary | null;
  avoidanceTips: string[];
  primaryNextStepGroupTitle?: string;
  primaryNextStep?: string | null;
  renderProductImage: (product: RankedProduct, iconClassName: string) => ReactNode;
  renderClickableHint: (label?: string) => ReactNode;
  isFavorited?: boolean;
  onToggleFavorite?: (product: RankedProduct) => void | Promise<void>;
  isFemaleMvp?: boolean;
  femaleMvpShareCardRef?: Ref<HTMLElement>;
  onCreateFemaleMvpShareImage?: () => void | Promise<void>;
  isCreatingFemaleMvpShareImage?: boolean;
}) {
  const resolvedBrandBrief = resolveBrandBrief(topProduct.brandBrief, topProduct.brand);
  const femaleMvpPracticalChecks = isFemaleMvp
    ? buildFemaleMvpPracticalChecks(topProduct)
    : [];
  const femaleMvpGuideNote = isFemaleMvp
    ? getFemaleMvpGuideNote(primaryConfidenceSummary)
    : null;
  const femaleMvpAskItems = isFemaleMvp
    ? buildFemaleMvpAskItems(femaleMvpPracticalChecks, femaleMvpGuideNote)
    : [];
  const femaleMvpBrandHref =
    resolvedBrandBrief?.officialWebsiteUrl ?? getUrlOrigin(primaryProductHref);
  const femaleMvpBrandHrefLabel = isMarketplaceUrl(femaleMvpBrandHref)
    ? "查看品牌渠道"
    : "品牌官网";

  return (
    <section
      ref={isFemaleMvp ? femaleMvpShareCardRef : undefined}
      className={[className, isFemaleMvp ? "female-mvp-result-share-card" : ""].join(" ")}
    >
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/45 to-transparent" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-stretch">
        <div className="female-mvp-result-share-card__product-column">
          <div className="female-mvp-result-share-card__media relative min-h-56 overflow-hidden rounded-3xl border border-white/8 bg-black/20">
            {onToggleFavorite ? (
              <button
                type="button"
                aria-label={isFavorited ? "取消收藏" : "收藏产品"}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void onToggleFavorite(topProduct);
                }}
                className={`absolute right-4 top-4 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
                  isFavorited
                    ? "border-rose-300/45 bg-rose-400/18 text-rose-100"
                    : "border-white/12 bg-slate-950/65 text-white/70 hover:border-cyan-300/35 hover:text-white"
                }`}
              >
                <Heart className={`h-4 w-4 ${isFavorited ? "fill-current" : ""}`} />
              </button>
            ) : null}
            {primaryProductHref && !isFemaleMvp ? (
              <>
                <a
                  href={primaryProductHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`查看 ${primaryProductDisplayName} 详情`}
                  className="group absolute inset-0 block overflow-hidden rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  {renderProductImage(topProduct, "h-8 w-8 text-white/50")}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent transition-opacity group-hover:opacity-90" />
                  <div className="absolute bottom-4 left-4 right-24">
                    <span className="mb-2 inline-flex rounded-full border border-cyan-300/25 bg-cyan-300/12 px-2.5 py-1 font-mono text-[10px] tracking-[0.18em] text-cyan-100">
                      本轮最贴合
                    </span>
                    <p className="mb-1 text-[11px] text-cyan-200/72">
                      {primaryProductBrandLabel}
                    </p>
                    <h3 className="break-words text-xl font-medium leading-snug text-white transition-colors group-hover:text-cyan-50">
                      {primaryProductDisplayName}
                    </h3>
                  </div>
                </a>
                <div className="pointer-events-none absolute bottom-4 right-4 z-10 flex shrink-0 flex-col items-end gap-2">
                  <span className="text-xl font-semibold text-cyan-300">
                    ¥{topProduct.price}
                  </span>
                  <a
                    href={primaryProductHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pointer-events-auto group inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  >
                    {renderClickableHint()}
                  </a>
                </div>
              </>
            ) : (
              <>
                {renderProductImage(topProduct, "h-8 w-8 text-white/50")}
                {!isFemaleMvp ? (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
                      <div>
                        <span className="mb-2 inline-flex rounded-full border border-cyan-300/25 bg-cyan-300/12 px-2.5 py-1 font-mono text-[10px] tracking-[0.18em] text-cyan-100">
                          本轮最贴合
                        </span>
                        <p className="mb-1 text-[11px] text-cyan-200/72">
                          {primaryProductBrandLabel}
                        </p>
                        <h3 className="break-words text-xl font-medium leading-snug text-white">
                          {primaryProductDisplayName}
                        </h3>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span className="text-xl font-semibold text-cyan-300">
                          ¥{topProduct.price}
                        </span>
                      </div>
                    </div>
                  </>
                ) : null}
              </>
            )}
          </div>

          {isFemaleMvp ? (
            <div className="female-mvp-result-share-card__product-info">
              <span>本轮最贴合</span>
              <p>{primaryProductBrandLabel}</p>
              <div className="female-mvp-result-share-card__product-title-row">
                <h3>{primaryProductDisplayName}</h3>
                <strong>¥{topProduct.price}</strong>
              </div>
              {primaryProductHref ? (
                <a
                  href={primaryProductHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="female-mvp-result-share-card__detail-link group"
                >
                  {renderClickableHint()}
                </a>
              ) : null}
            </div>
          ) : null}

          {isFemaleMvp && resolvedBrandBrief ? (
            <div className="female-mvp-result-share-card__brand-brief">
              <div>
                <p className="female-mvp-result-share-card__brand-eyebrow">
                  BRAND NOTE
                </p>
                <h3>
                  {resolvedBrandBrief.brandName}
                  {resolvedBrandBrief.countryLabel
                    ? ` · ${resolvedBrandBrief.countryLabel}`
                    : ""}
                </h3>
              </div>
              <p>{resolvedBrandBrief.positioning}</p>
              <p>{resolvedBrandBrief.styleSummary}</p>
              {femaleMvpBrandHref ? (
                <a
                  href={femaleMvpBrandHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {femaleMvpBrandHrefLabel}
                </a>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="female-mvp-result-share-card__content flex flex-col justify-between gap-4">
          <div>
            {topProduct.reason && (
              <div
                className={[
                  "rounded-2xl border p-3",
                  isFemaleMvp
                    ? "border-sky-200/70 bg-sky-50/70"
                    : "border-cyan-300/15 bg-cyan-300/[0.055]",
                ].join(" ")}
              >
                <p className="text-sm leading-6 text-cyan-50/82">
                  <Sparkles className="mr-1 inline-block h-3.5 w-3.5 text-cyan-200" />
                  {topProduct.reason}
                </p>
              </div>
            )}

            {isFemaleMvp ? (
              <div className="female-mvp-result-share-card__stage">
                <div className="female-mvp-result-share-card__stage-scene">
                  <div className="female-mvp-result-share-card__stage-light" />
                  <div className="female-mvp-result-share-card__luna-orbit">
                    <span
                      className="female-mvp-result-share-card__luna-halo"
                      aria-hidden="true"
                    />
                    <img
                      src="/assets/results/luna-result-guide.png"
                      alt="Luna 结果讲解员"
                      className="female-mvp-result-share-card__luna"
                    />
                    <span
                      className="female-mvp-result-share-card__luna-signal"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="female-mvp-result-share-card__stage-caption">
                    <p>LUNA STAGE</p>
                    <h3>这一款可以先看</h3>
                    <span>少看参数堆叠，先跟 Luna 确认 3 个问题。</span>
                  </div>
                </div>

                <div className="female-mvp-result-share-card__ask">
                  <div className="female-mvp-result-share-card__ask-head">
                    <div>
                      <p>KEY SIGNALS</p>
                      <h3>关键判断</h3>
                    </div>
                    {primaryConfidenceSummary ? (
                      <span
                        className={[
                          "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-black",
                          getConfidenceToneClassName(primaryConfidenceSummary.tone),
                        ].join(" ")}
                      >
                        {primaryConfidenceSummary.levelLabel}
                      </span>
                    ) : null}
                  </div>

                  <div className="female-mvp-result-share-card__ask-list">
                    {femaleMvpAskItems.map((item) => (
                      <details
                        key={item.question}
                        className="female-mvp-result-share-card__ask-item"
                        open={item.isOpen}
                      >
                        <summary>
                          <span className="female-mvp-result-share-card__ask-status">
                            <img
                              src="/assets/results/luna-result-sticker-check.png"
                              alt=""
                              aria-hidden="true"
                            />
                          </span>
                          {item.question}
                        </summary>
                        <p>{item.answer}</p>
                      </details>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <BrandBriefCard brief={resolvedBrandBrief} showKnowledgeLink />

                {primaryConfidenceSummary && renderConfidenceSummary(primaryConfidenceSummary)}

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
              </>
            )}
          </div>

          {!isFemaleMvp && primaryNextStep ? (
            <div className="rounded-2xl border border-amber-300/14 bg-amber-400/[0.06] p-3">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-amber-200/80" />
                <p className="text-[11px] font-medium tracking-wide text-amber-100/86">
                  下一步先做这件事
                </p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-black/10 px-3 py-3">
                <p className="text-[11px] font-medium text-amber-100/84">
                  {primaryNextStepGroupTitle}
                </p>
                <p className="mt-1.5 text-[11px] leading-5 text-slate-200">
                  {primaryNextStep}
                </p>
                <a
                  href="#result-next-steps"
                  className="mt-3 inline-flex items-center rounded-full border border-amber-300/18 bg-amber-300/10 px-2.5 py-1 text-[11px] text-amber-100/82 transition-colors hover:border-amber-200/30 hover:bg-amber-300/14"
                >
                  查看下一步建议
                </a>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {isFemaleMvp ? (
        <div className="female-mvp-result-share-card__footer">
          <span>Generated by Luna</span>
          {onCreateFemaleMvpShareImage ? (
            <button
              type="button"
              onClick={() => void onCreateFemaleMvpShareImage()}
              disabled={isCreatingFemaleMvpShareImage}
              className="female-mvp-result-share-card__share-button"
            >
              <img
                src="/assets/results/luna-result-sticker-share-seal.png"
                alt=""
                aria-hidden="true"
              />
              <span>{isCreatingFemaleMvpShareImage ? "生成中..." : "生成分享图"}</span>
            </button>
          ) : (
            <strong>截图分享给朋友一起参考</strong>
          )}
        </div>
      ) : null}
    </section>
  );
}
