import { ArrowRight, Heart, VolumeX, Droplets, Zap } from "lucide-react";
import { Product } from "../data/mock.ts";
import { getProductDisplayName } from "../lib/product-display-name.ts";
import { ProductImage } from "./ProductImage.tsx";

export function ProductCardContent({
  product,
  isFavorited = false,
  onToggleFavorite,
  onViewDetails,
}: {
  product: Product;
  isFavorited?: boolean;
  onToggleFavorite?: (product: Product) => void;
  onViewDetails?: (product: Product) => void;
}) {
  const displayName = getProductDisplayName(product);
  const audienceLabel =
    product.gender === "male"
      ? "男性向"
      : product.gender === "female"
        ? "女性向"
        : "通用型";
  const audienceToneClassName =
    product.gender === "male"
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : product.gender === "female"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-violet-200 bg-violet-50 text-violet-700";
  const typeLabel =
    product.physicalForm === "internal"
      ? "入体"
      : product.physicalForm === "composite"
        ? "复合"
        : "外部";

  return (
    <>
      <div className="aspect-square w-full overflow-hidden relative border-b border-sky-50 bg-slate-50 sm:aspect-[4/3]">
        <ProductImage
          imageValue={product.imagePlaceholder}
          typeCode={product.typeCode}
          subtypeCode={product.subtypeCode}
          gender={product.gender}
          physicalForm={product.physicalForm}
          alt={displayName}
          iconClassName="w-8 h-8 text-slate-300"
          imageClassName="w-full h-full object-cover opacity-95 group-hover:opacity-100 transition-all duration-700 group-hover:scale-105"
        />
        <div className="absolute right-2 top-2 flex flex-col gap-1 items-end sm:right-3 sm:top-3">
          {onToggleFavorite ? (
            <button
              type="button"
              aria-label={isFavorited ? "取消收藏" : "收藏产品"}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onToggleFavorite(product);
              }}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border shadow-[0_10px_24px_rgba(15,23,42,0.28)] transition-colors sm:h-9 sm:w-9 ${
                isFavorited
                  ? "border-rose-200 bg-white/90 text-rose-500"
                  : "border-white/70 bg-white/82 text-slate-500 hover:border-rose-200 hover:text-rose-500"
              }`}
            >
              <Heart className={`h-4 w-4 sm:h-4.5 sm:w-4.5 ${isFavorited ? "fill-current" : ""}`} />
            </button>
          ) : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <div className="mb-1.5 min-w-0 sm:mb-2">
          <div className="min-w-0">
            <span className="block truncate text-[9px] font-black uppercase tracking-[0.14em] text-sky-600 sm:text-[10px] sm:tracking-[0.18em]">
              {product.brand}
            </span>
            <h3 className="mt-1 line-clamp-2 text-sm font-black leading-snug text-slate-900 transition-colors group-hover:text-sky-700 sm:text-base">
              {displayName}
            </h3>
          </div>
        </div>
        <span className="mb-2 text-lg font-black tracking-wide text-rose-500 sm:mb-3 sm:text-xl">
          ¥{product.price}
        </span>

        <div className="mb-2 flex flex-wrap gap-1 sm:mb-3 sm:gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black tracking-[0.04em] sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-[11px] sm:tracking-[0.06em] ${audienceToneClassName}`}
          >
            <span>{audienceLabel}</span>
          </span>
          <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-black text-sky-800 sm:px-2.5 sm:py-1 sm:text-[11px]">
            {typeLabel}
          </span>
        </div>

        <div className="mt-auto flex flex-wrap gap-1.5 pt-1.5 sm:gap-2 sm:pt-2">
          {onToggleFavorite ? (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onToggleFavorite(product);
              }}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-mono transition-colors sm:gap-1.5 sm:px-2.5 sm:py-1.5 sm:text-[10px] ${
                isFavorited
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300 hover:text-sky-800"
              }`}
            >
              <Heart className={`h-3 w-3 ${isFavorited ? "fill-current" : ""}`} />
              {isFavorited ? "已收藏" : "收藏"}
            </button>
          ) : null}
          <div className="flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-1 text-[9px] font-mono font-semibold text-slate-600 sm:gap-1.5 sm:px-2 sm:text-[10px]">
            <VolumeX className="w-3 h-3 text-sky-600" />
            {product.maxDb == null ? "无噪音参数" : `<${product.maxDb}dB`}
          </div>
          <div className="flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-1 text-[9px] font-mono font-semibold text-slate-600 sm:gap-1.5 sm:px-2 sm:text-[10px]">
            <Droplets className="w-3 h-3 text-sky-600" />
            {product.waterproof == null ? "无防水参数" : `IPX${product.waterproof}`}
          </div>
          <div className="flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-1 text-[9px] font-mono font-semibold text-slate-600 sm:gap-1.5 sm:px-2 sm:text-[10px]">
            <Zap className="w-3 h-3 text-sky-600" />
            {product.motorType === "gentle" ? "柔和波段" : "强感波段"}
          </div>
        </div>

        {onViewDetails ? (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onViewDetails(product);
            }}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-sky-200 bg-white px-2 py-1.5 text-[10px] font-black tracking-[0.04em] text-sky-700 shadow-[0_0.7rem_1.4rem_rgba(125,211,252,0.12)] transition-colors hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800 sm:mt-4 sm:gap-2 sm:px-3 sm:py-2 sm:text-xs sm:tracking-[0.08em]"
          >
            查看详情信息
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </>
  );
}
