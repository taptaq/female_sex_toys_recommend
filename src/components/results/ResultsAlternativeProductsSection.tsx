import { Boxes, ChevronDown, Heart } from "lucide-react";
import type { ReactNode } from "react";

import type { RankedProduct } from "../../lib/app-shell.ts";
import { getProductDisplayName } from "../../lib/product-display-name.ts";
import type { BackupCandidate } from "../../lib/recommendation-results.ts";
import { buildBackupDirectionTeaser } from "../../lib/recommendation-results.ts";

function getProductHref(product: Pick<RankedProduct, "sourceUrl" | "link">) {
  return product.sourceUrl || product.link || undefined;
}

export function ResultsAlternativeProductsSection({
  topProducts,
  canBrowseSimilarLibraryProducts,
  onBrowseLibrary,
  backupProducts,
  isBackupPanelOpen,
  onToggleBackupPanel,
  onOpenKnowledgeTopic,
  renderProductImage,
  renderClickableHint,
  getMetricChips,
  favoriteProductIds,
  onToggleFavorite,
}: {
  topProducts: RankedProduct[];
  canBrowseSimilarLibraryProducts: boolean;
  onBrowseLibrary?: (product?: RankedProduct) => void;
  backupProducts: BackupCandidate[];
  isBackupPanelOpen: boolean;
  onToggleBackupPanel: () => void;
  onOpenKnowledgeTopic: (
    topicSlug: "science" | "people" | "care",
    sectionId?: string,
  ) => void;
  renderProductImage: (product: RankedProduct, iconClassName: string) => ReactNode;
  renderClickableHint: (label?: string) => ReactNode;
  getMetricChips: (
    product: Pick<RankedProduct, "maxDb" | "waterproof" | "motorType">,
  ) => Array<{
    id: string;
    label: string;
    topicSlug: "science" | "people" | "care";
    sectionId?: string;
    icon: React.ComponentType<{ className?: string }>;
  }>;
  favoriteProductIds?: Set<string>;
  onToggleFavorite?: (product: RankedProduct) => void | Promise<void>;
}) {
  const backupDirectionTeaser = buildBackupDirectionTeaser(backupProducts);

  return (
    <section className="relative z-10 rounded-2xl border border-white/8 bg-white/[0.025] p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-1.5 border-b border-white/8 pb-4">
        <h3 className="text-sm font-medium text-white">如果你想换个方向，也可以看看这些</h3>
        <p className="text-xs leading-5 text-slate-400">
          主推荐已经能先做决定；这些是你想再比较时再展开看的备选方向。
        </p>
      </div>

      <div className="space-y-4">
        {canBrowseSimilarLibraryProducts ? (
          <div className="rounded-2xl border border-cyan-300/12 bg-cyan-400/[0.05] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="mb-1.5 flex items-center gap-2 text-cyan-100">
                  <Boxes className="h-4 w-4 shrink-0 text-cyan-200/80" />
                  <p className="text-sm font-medium">想自己再横向比一比？</p>
                </div>
                <p className="text-xs leading-5 text-slate-300">
                  把当前主推荐当作起点，去装备库继续看同类路线、价位区间和不同品牌差异。
                </p>
              </div>
              <button
                type="button"
                onClick={() => onBrowseLibrary?.(topProducts[0])}
                className="inline-flex shrink-0 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-medium tracking-[0.12em] text-cyan-50 transition-colors hover:border-cyan-200/35 hover:bg-cyan-300/16"
              >
                查看同类装备
              </button>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {topProducts.slice(1, 3).map((product, index) => {
            const productHref = getProductHref(product);

            return productHref ? (
              <a
                key={product.id}
                href={productHref}
                target="_blank"
                rel="noopener noreferrer"
                className="glass-panel group flex flex-col rounded-2xl p-3 transition-transform duration-200 hover:-translate-y-0.5 hover:border-cyan-300/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:p-4"
              >
                <div className="relative mb-3 aspect-[16/10] w-full overflow-hidden rounded-xl bg-black/20">
                  {renderProductImage(product, "h-5 w-5 text-white/30")}
                </div>
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <span className="inline-block rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-300">
                    {index === 0 ? "另一条更省心的路线" : "探索备选"}
                  </span>
                  <span className="text-[10px] text-cyan-500/70">{product.brand}</span>
                </div>
                <h3 className="mb-1 break-words text-sm font-medium leading-relaxed text-white">
                  {getProductDisplayName(product)}
                </h3>
                {product.tags && product.tags.length > 0 ? (
                  <div className="mb-2 flex flex-wrap gap-1">
                    {product.tags.slice(0, 2).map((tag, tagIndex) => (
                      <span
                        key={tagIndex}
                        className="break-words rounded border border-indigo-500/20 bg-indigo-500/10 px-1 py-0.5 text-[8px] text-indigo-300/80"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
                {product.reason ? (
                  <p className="mb-2 text-[11px] italic leading-relaxed text-slate-400">
                    “{product.reason}”
                  </p>
                ) : null}
                          <div className="mt-auto flex items-center justify-between gap-3 pt-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-cyan-400">¥{product.price}</span>
                              {onToggleFavorite ? (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    void onToggleFavorite(product);
                                  }}
                                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-mono transition-colors ${
                                    favoriteProductIds?.has(product.originalId || product.id)
                                      ? "border-rose-300/35 bg-rose-400/16 text-rose-100"
                                      : "border-cyan-300/18 bg-cyan-300/10 text-cyan-100 hover:border-cyan-200/35 hover:text-white"
                                  }`}
                                >
                                  <Heart className={`h-3 w-3 ${favoriteProductIds?.has(product.originalId || product.id) ? "fill-current" : ""}`} />
                                  {favoriteProductIds?.has(product.originalId || product.id) ? "已收藏" : "收藏"}
                                </button>
                              ) : null}
                            </div>
                            {renderClickableHint("点击查看")}
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
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <span className="inline-block rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-300">
                    {index === 0 ? "另一条更省心的路线" : "探索备选"}
                  </span>
                  <span className="text-[10px] text-cyan-500/70">{product.brand}</span>
                </div>
                <h3 className="mb-1 break-words text-sm font-medium leading-relaxed text-white">
                  {getProductDisplayName(product)}
                </h3>
                {product.tags && product.tags.length > 0 ? (
                  <div className="mb-2 flex flex-wrap gap-1">
                    {product.tags.slice(0, 2).map((tag, tagIndex) => (
                      <span
                        key={tagIndex}
                        className="break-words rounded border border-indigo-500/20 bg-indigo-500/10 px-1 py-0.5 text-[8px] text-indigo-300/80"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
                {product.reason ? (
                  <p className="mb-2 text-[11px] italic leading-relaxed text-slate-400">
                    “{product.reason}”
                  </p>
                ) : null}
                <div className="mt-auto flex items-center justify-between gap-3 pt-2">
                  <span className="text-sm text-cyan-400">¥{product.price}</span>
                </div>
              </div>
            );
          })}
        </div>

        {backupProducts.length > 0 ? (
          <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 sm:p-5">
            <button
              type="button"
              onClick={onToggleBackupPanel}
              aria-expanded={isBackupPanelOpen}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-medium text-white">换个侧重点看看</h3>
                  <span className="rounded-full border border-cyan-400/18 bg-cyan-400/8 px-2.5 py-1 text-[11px] text-cyan-100/80">
                    {backupDirectionTeaser.countText}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  {backupDirectionTeaser.directionText}，这些方向不会改动当前主推荐，只是在你想换重点时给你另一条路。
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
                    {backupProducts.map((product) => {
                      const productHref = getProductHref(product);
                      const backupCardContent = (
                        <div className="flex h-full flex-col md:flex-row">
                          <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-black/20 md:w-44">
                            {renderProductImage(product, "h-6 w-6 text-white/40")}
                            {onToggleFavorite ? (
                              <button
                                type="button"
                                aria-label={favoriteProductIds?.has(product.originalId || product.id) ? "取消收藏" : "收藏产品"}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  void onToggleFavorite(product);
                                }}
                                className={`absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
                                  favoriteProductIds?.has(product.originalId || product.id)
                                    ? "border-rose-300/45 bg-rose-400/18 text-rose-100"
                                    : "border-white/12 bg-slate-950/65 text-white/70 hover:border-cyan-300/35 hover:text-white"
                                }`}
                              >
                                <Heart className={`h-4 w-4 ${favoriteProductIds?.has(product.originalId || product.id) ? "fill-current" : ""}`} />
                              </button>
                            ) : null}
                          </div>

                          <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0 space-y-2">
                                <span className="inline-flex max-w-full items-center rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-[11px] text-cyan-200">
                                  <span className="break-words">{product.backupLabel}</span>
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
                                    onClick={() =>
                                      onOpenKnowledgeTopic(chip.topicSlug, chip.sectionId)
                                    }
                                    className="flex max-w-full cursor-pointer items-start gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300 transition-colors hover:border-cyan-300/24 hover:bg-cyan-300/[0.08]"
                                    title="了解这个参数"
                                  >
                                    <Icon className="mt-0.5 h-3 w-3 shrink-0" />
                                    <span className="break-words">{chip.label}</span>
                                  </button>
                                );
                              })}
                            </div>

                            {productHref ? <div className="pt-1">{renderClickableHint()}</div> : null}
                          </div>
                        </div>
                      );

                      return productHref ? (
                        <a
                          key={product.id}
                          href={productHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="glass-panel group block overflow-hidden rounded-2xl transition-transform duration-200 hover:-translate-y-0.5 hover:border-cyan-300/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                        >
                          {backupCardContent}
                        </a>
                      ) : (
                        <article
                          key={product.id}
                          className="glass-panel overflow-hidden rounded-2xl"
                        >
                          {backupCardContent}
                        </article>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}
