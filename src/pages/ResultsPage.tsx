import { motion } from "motion/react";
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowUpRight, LoaderCircle } from "lucide-react";
import { usePagePerformanceState } from "../lib/page-performance.ts";
import { useResultsPageAnimation } from "../hooks/useResultsPageAnimation.ts";
import { ProductImage } from "../components/ProductImage.tsx";
import { ResultsPrimaryRecommendationPanel } from "../components/results/ResultsPrimaryRecommendationPanel.tsx";
import { AnswerState } from "../data/mock.ts";
import { RankedProduct } from "../lib/app-shell.ts";
import { dedupeDisplayTags } from "../lib/display-tags.ts";
import { buildResultConfidenceSummary } from "../lib/recommendation-results.ts";
import { getProductDisplayName } from "../lib/product-display-name.ts";
import type { BackupCandidate } from "../lib/recommendation-results.ts";

type ResultsBackupProduct = BackupCandidate;

const MAX_RELAXATION_TIPS = 3;
const MAX_SHOPPING_GUIDANCE_WITH_RELAXATION = 3;
const MAX_SHOPPING_GUIDANCE_ONLY = 5;
const SHARE_CANVAS_WIDTH = 1080;
const SHARE_CANVAS_HEIGHT = 1440;

const SHARE_STICKER_ASSETS = [
  {
    id: "luna-result-sticker",
    label: "星球贴纸",
    src: "/assets/results/luna-result-sticker.png",
    size: 210,
    x: 72,
    y: 210,
  },
  {
    id: "luna-result-decoration-stars",
    label: "双星",
    src: "/assets/results/luna-result-decoration-stars.png",
    size: 190,
    x: 66,
    y: 238,
  },
  {
    id: "luna-result-decoration-planet",
    label: "小星球",
    src: "/assets/results/luna-result-decoration-planet.png",
    size: 150,
    x: 848,
    y: 246,
  },
  {
    id: "luna-result-decoration-orbit",
    label: "星环",
    src: "/assets/results/luna-result-decoration-orbit.png",
    size: 360,
    x: 120,
    y: 880,
  },
  {
    id: "luna-result-decoration-hearts",
    label: "爱心",
    src: "/assets/results/luna-result-decoration-hearts.png",
    size: 210,
    x: 96,
    y: 1054,
  },
  {
    id: "luna-result-decoration-cloud",
    label: "云朵",
    src: "/assets/results/luna-result-decoration-cloud.png",
    size: 245,
    x: 720,
    y: 930,
  },
  {
    id: "luna-result-decoration-sparkles",
    label: "散落星光",
    src: "/assets/results/luna-result-decoration-sparkles.png",
    size: 180,
    x: 782,
    y: 650,
  },
  {
    id: "luna-result-footer-flight",
    label: "飞行轨迹",
    src: "/assets/results/luna-result-footer-flight.png",
    size: 240,
    x: 724,
    y: 1068,
  },
  {
    id: "luna-result-sticker-badge",
    label: "Luna 徽章",
    src: "/assets/results/luna-result-sticker-badge.png",
    size: 190,
    x: 94,
    y: 1054,
  },
  {
    id: "luna-result-sticker-arrow",
    label: "指向箭头",
    src: "/assets/results/luna-result-sticker-arrow.png",
    size: 220,
    x: 648,
    y: 520,
  },
  {
    id: "luna-result-sticker-shield",
    label: "防水盾牌",
    src: "/assets/results/luna-result-sticker-shield.png",
    size: 190,
    x: 742,
    y: 760,
  },
  {
    id: "luna-result-sticker-magnifier",
    label: "Luna 放大镜",
    src: "/assets/results/luna-result-sticker-magnifier.png",
    size: 190,
    x: 708,
    y: 342,
  },
  {
    id: "luna-result-sticker-orbit-ring",
    label: "星环底座",
    src: "/assets/results/luna-result-sticker-orbit-ring.png",
    size: 300,
    x: 558,
    y: 980,
  },
] as const;
const DEFAULT_SHARE_STICKER_ASSET_IDS = [
  "luna-result-decoration-stars",
  "luna-result-decoration-planet",
  "luna-result-decoration-hearts",
] as const;

type ShareStickerAsset = (typeof SHARE_STICKER_ASSETS)[number];
type ShareStickerInstance = {
  id: string;
  assetId: ShareStickerAsset["id"];
  label: string;
  src: string;
  x: number;
  y: number;
  size: number;
};
type ShareStickerDragState = {
  id: string;
  pointerId: number;
  offsetX: number;
  offsetY: number;
};

function createShareStickerFromAsset(
  asset: ShareStickerAsset,
  idSuffix = `${Date.now()}-${Math.round(Math.random() * 1000)}`,
): ShareStickerInstance {
  return {
    id: `${asset.id}-${idSuffix}`,
    assetId: asset.id,
    label: asset.label,
    src: asset.src,
    x: asset.x,
    y: asset.y,
    size: asset.size,
  };
}

function createDefaultShareStickers(): ShareStickerInstance[] {
  return DEFAULT_SHARE_STICKER_ASSET_IDS.flatMap((assetId, index) => {
    const asset = SHARE_STICKER_ASSETS.find((item) => item.id === assetId);
    return asset ? [createShareStickerFromAsset(asset, `default-${index}`)] : [];
  });
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

function getShareCanvasPoint(
  event: ReactPointerEvent<HTMLElement>,
  canvasElement: HTMLElement,
) {
  const rect = canvasElement.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * SHARE_CANVAS_WIDTH;
  const y = ((event.clientY - rect.top) / rect.height) * SHARE_CANVAS_HEIGHT;

  return { x, y };
}

function clampShareStickerPosition(
  x: number,
  y: number,
  size: number,
) {
  return {
    x: Math.max(0, Math.min(SHARE_CANVAS_WIDTH - size, x)),
    y: Math.max(0, Math.min(SHARE_CANVAS_HEIGHT - size, y)),
  };
}

function buildShareFitReasons(
  product: RankedProduct,
  summary: ReturnType<typeof buildResultConfidenceSummary> | null,
  fallbackReasons: string[],
) {
  const parameterReasons = [
    typeof product.maxDb === "number"
      ? `${product.maxDb}dB，适合先确认真实使用环境里的声音边界。`
      : "",
    typeof product.waterproof === "number"
      ? `IPX${product.waterproof}，清洁方式和防水边界更容易提前判断。`
      : "",
    `¥${product.price}，适合和预算、渠道、售后一起比较。`,
  ];
  const reasons = [
    ...(summary?.reasons ?? []),
    ...fallbackReasons,
    product.reason ?? "",
    ...product.matchSummary,
    ...parameterReasons,
  ]
    .map(normalizeGuidanceItem)
    .filter(Boolean);
  const seen = new Set<string>();

  return reasons
    .filter((reason) => {
      if (seen.has(reason)) return false;
      seen.add(reason);
      return true;
    })
    .slice(0, 3);
}

type ResultsPageProps = {
  pageVariants: any;
  answers: AnswerState;
  topProducts: RankedProduct[];
  backupProducts: ResultsBackupProduct[];
  shoppingGuidance: string[];
  recommendationTips: string[];
  isEnhancingResults?: boolean;
  isRecalibratingResults: boolean;
  onBackHome?: () => void;
  onReset: () => void;
  matchInputMode?: "quiz" | "natural-language";
  naturalLanguageQuery?: string;
  favoriteProductIds?: Set<string>;
  onToggleFavorite?: (product: RankedProduct) => void | Promise<void>;
};

export function ResultsPage({
  pageVariants,
  answers,
  topProducts,
  backupProducts,
  shoppingGuidance,
  recommendationTips,
  isEnhancingResults = false,
  isRecalibratingResults,
  onBackHome,
  onReset,
  matchInputMode = "quiz",
  naturalLanguageQuery = "",
  favoriteProductIds = new Set(),
  onToggleFavorite,
}: ResultsPageProps) {
  const performanceState = usePagePerformanceState();
  const gsapMotionState = {
    shouldAnimate: performanceState.shouldAnimate,
    prefersReducedMotion: performanceState.prefersReducedMotion,
  };
  const { pageContainerRef, headerRef, primaryPanelRef } =
    useResultsPageAnimation(gsapMotionState);

  const [areResultTagsExpanded, setAreResultTagsExpanded] = useState(false);
  const [isCreatingShareImage, setIsCreatingShareImage] = useState(false);
  const [isShareEditorOpen, setIsShareEditorOpen] = useState(false);
  const [shareStickers, setShareStickers] = useState<ShareStickerInstance[]>([]);
  const [selectedShareStickerId, setSelectedShareStickerId] = useState<string | null>(null);
  const [shareStickerDragState, setShareStickerDragState] =
    useState<ShareStickerDragState | null>(null);
  const shareCardRef = useRef<HTMLElement | null>(null);
  const shareCanvasRef = useRef<HTMLDivElement | null>(null);
  const resetButtonLabel =
    matchInputMode === "natural-language"
      ? "重新输入需求描述"
      : "重新回答偏好问题";
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
  const resultTags = dedupeDisplayTags(answers.tags);
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
  const isNaturalLanguageResult =
    matchInputMode === "natural-language" &&
    naturalLanguageQuery.trim().length > 0;
  const visibleResultTags = areResultTagsExpanded ? resultTags : resultTags.slice(0, 3);
  const hiddenResultTagCount = Math.max(resultTags.length - visibleResultTags.length, 0);
  const shareFitReasons = topProducts[0]
    ? buildShareFitReasons(topProducts[0], primaryConfidenceSummary, [
        ...relaxationTips,
        ...shoppingGuidanceItems,
      ])
    : [];

  async function handleCreateShareImage() {
    if (shareStickers.length === 0) {
      setShareStickers(createDefaultShareStickers());
      setSelectedShareStickerId(null);
    }
    setIsShareEditorOpen(true);
  }

  function handleAddShareSticker(asset: ShareStickerAsset) {
    const nextSticker = createShareStickerFromAsset(asset);

    setShareStickers((stickers) => [...stickers, nextSticker]);
    setSelectedShareStickerId(nextSticker.id);
  }

  function handleResetShareStickers() {
    setShareStickerDragState(null);
    setShareStickers(createDefaultShareStickers());
    setSelectedShareStickerId(null);
  }

  function handleClearShareStickers() {
    setShareStickerDragState(null);
    setShareStickers([]);
    setSelectedShareStickerId(null);
  }

  function handleDeleteSelectedShareSticker() {
    if (!selectedShareStickerId) return;

    setShareStickers((stickers) =>
      stickers.filter((sticker) => sticker.id !== selectedShareStickerId),
    );
    setShareStickerDragState(null);
    setSelectedShareStickerId(null);
  }

  function handleShareStickerPointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    sticker: ShareStickerInstance,
  ) {
    const canvasElement = shareCanvasRef.current;
    if (!canvasElement) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getShareCanvasPoint(event, canvasElement);
    setSelectedShareStickerId(sticker.id);
    setShareStickerDragState({
      id: sticker.id,
      pointerId: event.pointerId,
      offsetX: point.x - sticker.x,
      offsetY: point.y - sticker.y,
    });
  }

  function handleShareCanvasPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!shareStickerDragState) return;
    const canvasElement = shareCanvasRef.current;
    if (!canvasElement) return;

    const point = getShareCanvasPoint(event, canvasElement);
    setShareStickers((stickers) =>
      stickers.map((sticker) => {
        if (sticker.id !== shareStickerDragState.id) return sticker;

        const position = clampShareStickerPosition(
          point.x - shareStickerDragState.offsetX,
          point.y - shareStickerDragState.offsetY,
          sticker.size,
        );

        return { ...sticker, ...position };
      }),
    );
  }

  function handleShareStickerPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!shareStickerDragState || shareStickerDragState.pointerId !== event.pointerId) return;

    setShareStickerDragState(null);
  }

  async function handleDownloadEditedShareImage() {
    if (!shareCanvasRef.current || isCreatingShareImage) return;

    setIsCreatingShareImage(true);
    setSelectedShareStickerId(null);
    try {
      const { toPng } = await import("html-to-image");
      shareCanvasRef.current.classList.add("female-mvp-share-editor__canvas--exporting");
      const dataUrl = await toPng(shareCanvasRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#fff7fb",
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = "luna-result-edited-share.png";
      link.click();
    } catch (error) {
      console.error("Failed to create Luna share image", error);
      window.alert("生成分享图失败，可以先截图分享这张编辑图。");
    } finally {
      shareCanvasRef.current?.classList.remove("female-mvp-share-editor__canvas--exporting");
      setIsCreatingShareImage(false);
    }
  }
  const resultsPrimaryPanelClassName =
    "results-report-panel relative z-10 overflow-hidden rounded-[1.75rem] border border-cyan-200/14 bg-slate-950/56 p-5 shadow-[0_24px_90px_rgba(8,47,73,0.2)] sm:p-6";

  return (
    <motion.div
      ref={pageContainerRef}
      key="result"
      variants={pageVariants}
      initial="initial"
      animate="in"
      exit="out"
      className={[
        "results-report-shell female-mvp-results relative isolate min-h-[100svh] w-full space-y-6 overflow-x-hidden px-4 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-7",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-x-[-12vw] top-[-8rem] -z-10 h-[30rem] bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.12),transparent_42%),radial-gradient(circle_at_12%_48%,rgba(59,130,246,0.09),transparent_34%),radial-gradient(circle_at_88%_58%,rgba(99,102,241,0.11),transparent_36%)]" />
      <div className="results-report-grid pointer-events-none absolute inset-0 -z-10 opacity-45" />

      <div ref={headerRef} className="relative z-10 mb-6 text-center">
        <p
          className="results-header-animate mb-3 text-[10px] font-bold tracking-[0.24em] text-rose-500"
        >
          LUNA RESULT
        </p>
        <h2
          className="results-header-animate mb-2 text-2xl font-black text-[#342936]"
        >
          为你匹配到这件装备
        </h2>
        <div className="results-header-animate mx-auto mb-4 flex max-w-xl flex-wrap justify-center gap-1.5">
          {visibleResultTags.map((tag, index) => (
            <span
              key={index}
              className="px-2 py-0.5 rounded border border-white/10 bg-white/5 text-[10px] text-slate-300"
            >
              {tag}
            </span>
          ))}
          {hiddenResultTagCount > 0 ? (
            <button
              type="button"
              onClick={() => setAreResultTagsExpanded(true)}
              aria-label={`展开剩余 ${hiddenResultTagCount} 个匹配标签`}
              className="rounded border border-cyan-300/20 bg-cyan-300/12 px-2 py-0.5 text-[10px] font-bold text-cyan-100/80 transition-colors hover:border-cyan-300/35 hover:bg-cyan-300/18"
            >
              +{hiddenResultTagCount}
            </button>
          ) : areResultTagsExpanded && resultTags.length > 3 ? (
            <button
              type="button"
              onClick={() => setAreResultTagsExpanded(false)}
              aria-label="收起匹配标签"
              className="rounded border border-cyan-300/20 bg-white/40 px-2 py-0.5 text-[10px] font-bold text-cyan-100/80 transition-colors hover:border-cyan-300/35 hover:bg-white/58"
            >
              收起
            </button>
          ) : null}
        </div>
        {isNaturalLanguageResult ? (
          <div className="results-header-animate mx-auto mt-4 max-w-3xl rounded-2xl border border-violet-300/14 bg-violet-300/[0.06] px-4 py-3 text-left shadow-[0_14px_40px_rgba(67,56,202,0.12)]">
            <p className="text-[11px] font-medium tracking-[0.18em] text-violet-100/86">
              你的原始描述
            </p>
            <p className="mt-2 text-sm leading-6 text-violet-50/82">
              {naturalLanguageQuery}
            </p>
          </div>
        ) : null}
        {isEnhancingResults ? (
          <div className="mx-auto mt-4 flex max-w-xl items-start gap-3 rounded-2xl border border-cyan-300/14 bg-cyan-300/[0.055] px-4 py-3 text-left shadow-[0_14px_40px_rgba(8,47,73,0.12)]">
            <LoaderCircle className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-cyan-200/80" />
            <div>
              <p className="text-xs font-medium text-cyan-50/88">
                本地备选说明先展示，AI 正在润色备选说明和选购建议
              </p>
              <p className="mt-1 text-[11px] leading-5 text-cyan-100/55">
                主推荐已可先查看，下面的备选说明会在分析完成后自动更新。
                {backupProducts[0]?.backupReason
                  ? ` 当前先展示：${backupProducts[0].backupReason}`
                  : ""}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {topProducts[0] ? (
        <div ref={primaryPanelRef}>
          <ResultsPrimaryRecommendationPanel
            className={resultsPrimaryPanelClassName}
            topProduct={topProducts[0]}
            primaryProductHref={primaryProductHref}
            primaryProductDisplayName={primaryProductDisplayName}
            primaryProductBrandLabel={primaryProductBrandLabel}
            primaryConfidenceSummary={primaryConfidenceSummary}
            renderProductImage={renderProductImage}
            renderClickableHint={renderClickableHint}
            isFavorited={favoriteProductIds.has(topProducts[0].originalId || topProducts[0].id)}
            onToggleFavorite={onToggleFavorite}
            femaleMvpShareCardRef={shareCardRef}
            onCreateFemaleMvpShareImage={handleCreateShareImage}
            isCreatingFemaleMvpShareImage={isCreatingShareImage}
            gsapMotionState={gsapMotionState}
          />
        </div>
      ) : null}

      {topProducts[0] && isShareEditorOpen ? (
        <div className="female-mvp-share-editor" role="dialog" aria-modal="true" aria-label="分享图编辑弹窗">
          <button
            type="button"
            className="female-mvp-share-editor__scrim"
            aria-label="关闭分享图编辑弹窗"
            onClick={() => setIsShareEditorOpen(false)}
          />
          <div className="female-mvp-share-editor__modal">
            <div className="female-mvp-share-editor__panel">
              <div className="female-mvp-share-editor__toolbar">
                <div>
                  <p className="female-mvp-share-editor__eyebrow">LUNA SHARE STUDIO</p>
                  <h3>编辑你的分享图</h3>
                  <p>点击贴纸加入画布，拖动到你喜欢的位置。</p>
                </div>
                <button
                  type="button"
                  className="female-mvp-share-editor__close"
                  onClick={() => setIsShareEditorOpen(false)}
                >
                  关闭
                </button>
              </div>

              <div
                ref={shareCanvasRef}
                className="female-mvp-share-editor__canvas"
                onPointerMove={handleShareCanvasPointerMove}
                onPointerUp={handleShareStickerPointerUp}
                onPointerCancel={handleShareStickerPointerUp}
              >
                <div className="female-mvp-share-editor__canvas-glow" />
                <header className="female-mvp-share-editor__canvas-header">
                  <span>Luna Result</span>
                  <strong>匹配完成</strong>
                </header>

                <section className="female-mvp-share-editor__result-card">
                  <p className="female-mvp-share-editor__result-kicker">主推荐</p>
                  <h4>{primaryProductDisplayName}</h4>
                  <div className="female-mvp-share-editor__meta-row">
                    <span>{primaryProductBrandLabel}</span>
                    <strong>¥{topProducts[0].price}</strong>
                  </div>
                  <div className="female-mvp-share-editor__reason-list">
                    {shareFitReasons.map((reason, index) => (
                      <p key={`share-reason-${index}`}>
                        <span>{index + 1}</span>
                        {reason}
                      </p>
                    ))}
                  </div>
                </section>

                <footer className="female-mvp-share-editor__canvas-footer">
                  <span>Generated by Luna</span>
                  <strong>Shareable match card</strong>
                </footer>

                {shareStickers.map((sticker) => (
                  <button
                    key={sticker.id}
                    type="button"
                    className={[
                      "female-mvp-share-editor__sticker",
                      selectedShareStickerId === sticker.id
                        ? "female-mvp-share-editor__sticker--selected"
                        : "",
                    ].join(" ")}
                    aria-label={`拖动 ${sticker.label}`}
                    onPointerDown={(event) => handleShareStickerPointerDown(event, sticker)}
                    style={{
                      left: `${(sticker.x / SHARE_CANVAS_WIDTH) * 100}%`,
                      top: `${(sticker.y / SHARE_CANVAS_HEIGHT) * 100}%`,
                      width: `${(sticker.size / SHARE_CANVAS_WIDTH) * 100}%`,
                    }}
                  >
                    <img src={sticker.src} alt="" draggable={false} />
                  </button>
                ))}
              </div>
            </div>

            <aside className="female-mvp-share-editor__side">
              <div>
                <p className="female-mvp-share-editor__side-title">贴纸库</p>
                <div className="female-mvp-share-editor__sticker-library">
                  {SHARE_STICKER_ASSETS.map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => handleAddShareSticker(asset)}
                      className="female-mvp-share-editor__sticker-option"
                    >
                      <img src={asset.src} alt="" />
                      <span>{asset.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="female-mvp-share-editor__actions">
                <button
                  type="button"
                  onClick={handleDeleteSelectedShareSticker}
                  disabled={!selectedShareStickerId}
                >
                  删除选中
                </button>
                <button
                  type="button"
                  onClick={handleResetShareStickers}
                >
                  恢复初始
                </button>
                <button
                  type="button"
                  onClick={handleClearShareStickers}
                  disabled={shareStickers.length === 0}
                >
                  清空贴纸
                </button>
                <button
                  type="button"
                  className="female-mvp-share-editor__download"
                  onClick={() => void handleDownloadEditedShareImage()}
                  disabled={isCreatingShareImage}
                >
                  {isCreatingShareImage ? "下载中..." : "下载分享图"}
                </button>
              </div>
            </aside>
          </div>
        </div>
      ) : null}

      {topProducts.length === 0 ? (
        <div className="glass-panel rounded-3xl p-8 text-center">
          <p className="text-base font-medium text-white">
            当前没有完全符合条件的玩具
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            我们没有自动放宽你的限制。可以尝试放宽下面这些条件，再重新匹配。
          </p>
          {relaxationTips.length > 0 ? (
            <ul className="mx-auto mt-4 max-w-xl space-y-2 text-left">
              {relaxationTips.map((tip) => (
                <li
                  key={tip}
                  className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2 text-sm leading-6 text-slate-200"
                >
                  {tip}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div
        className={[
          "mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2",
          "female-mvp-result-actions",
        ].filter(Boolean).join(" ")}
      >
        {onBackHome ? (
          <button
            onClick={onBackHome}
            disabled={isRecalibratingResults}
            className={[
              "w-full rounded-xl border border-white/10 bg-transparent py-4 text-sm text-slate-300 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent",
              "female-mvp-result-actions__button female-mvp-result-actions__button--ghost",
            ].filter(Boolean).join(" ")}
          >
            返回首页
          </button>
        ) : null}
        <button
          onClick={onReset}
          disabled={isRecalibratingResults}
          className={[
            "w-full rounded-xl bg-white/5 py-4 text-sm text-slate-300 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white/5",
            "female-mvp-result-actions__button female-mvp-result-actions__button--soft",
          ].filter(Boolean).join(" ")}
        >
          {resetButtonLabel}
        </button>
      </div>
    </motion.div>
  );
}
