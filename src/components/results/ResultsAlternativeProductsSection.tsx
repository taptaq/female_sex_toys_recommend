import { Boxes, Heart } from "lucide-react";
import type { ReactNode } from "react";

import type { RankedProduct } from "../../lib/app-shell.ts";
import { getProductDisplayName } from "../../lib/product-display-name.ts";

function getProductHref(product: Pick<RankedProduct, "sourceUrl" | "link">) {
  return product.sourceUrl || product.link || undefined;
}

export function ResultsAlternativeProductsSection({
  topProducts,
  canBrowseSimilarLibraryProducts,
  onBrowseLibrary,
  renderProductImage,
  renderClickableHint,
  favoriteProductIds,
  onToggleFavorite,
}: {
  topProducts: RankedProduct[];
  canBrowseSimilarLibraryProducts: boolean;
  onBrowseLibrary?: (product?: RankedProduct) => void;
  renderProductImage: (product: RankedProduct, iconClassName: string) => ReactNode;
  renderClickableHint: (label?: string) => ReactNode;
  favoriteProductIds?: Set<string>;
  onToggleFavorite?: (product: RankedProduct) => void | Promise<void>;
}) {
  return (
    <section className="relative z-10 rounded-2xl border border-sky-100 bg-white/72 p-4 sm:p-5">
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
                className="glass-panel group flex flex-col rounded-2xl p-3 transition-transform duration-200 hover:-translate-y-0.5 hover:border-cyan-300/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:p-4"
              >
                <div className="relative mb-3 aspect-[16/10] w-full overflow-hidden rounded-xl bg-sky-50/72">
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
                <div className="relative mb-3 aspect-[16/10] w-full overflow-hidden rounded-xl bg-sky-50/72">
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

      </div>
    </section>
  );
}
