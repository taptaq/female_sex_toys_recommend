import { Heart, VolumeX, Droplets, Zap } from "lucide-react";
import { Product } from "../data/mock.ts";
import { resolveBrandBrief } from "../lib/brand-brief.ts";
import { getProductDisplayName } from "../lib/product-display-name.ts";
import { BrandBriefCard } from "./BrandBriefCard.tsx";
import { ProductImage } from "./ProductImage.tsx";

export function ProductCardContent({
  product,
  isFavorited = false,
  onToggleFavorite,
}: {
  product: Product;
  isFavorited?: boolean;
  onToggleFavorite?: (product: Product) => void;
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
      ? "border-blue-400/25 bg-blue-500/12 text-blue-100"
      : product.gender === "female"
        ? "border-rose-300/28 bg-rose-400/14 text-rose-50"
        : "border-violet-300/24 bg-violet-400/14 text-violet-50";
  const resolvedBrandBrief = resolveBrandBrief(product.brandBrief, product.brand);

  return (
    <>
      <div className="aspect-[4/3] w-full overflow-hidden relative border-b border-white/5 bg-black/20">
        <ProductImage
          imageValue={product.imagePlaceholder}
          typeCode={product.typeCode}
          subtypeCode={product.subtypeCode}
          gender={product.gender}
          physicalForm={product.physicalForm}
          alt={displayName}
          iconClassName="w-8 h-8 text-white/20"
          imageClassName="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all duration-700 group-hover:scale-105"
        />
        <div className="absolute top-3 right-3 flex flex-col gap-1 items-end">
          {onToggleFavorite ? (
            <button
              type="button"
              aria-label={isFavorited ? "取消收藏" : "收藏产品"}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onToggleFavorite(product);
              }}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-[0_10px_24px_rgba(15,23,42,0.28)] transition-colors ${
                isFavorited
                  ? "border-rose-300/45 bg-rose-400/18 text-rose-100"
                  : "border-white/18 bg-slate-950/78 text-white/85 hover:border-cyan-300/45 hover:text-white"
              }`}
            >
              <Heart className={`h-4.5 w-4.5 ${isFavorited ? "fill-current" : ""}`} />
            </button>
          ) : null}
        </div>
      </div>
      <div className="p-5 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-1">
          <h3 className="text-lg font-medium text-white leading-tight group-hover:text-cyan-100 transition-colors">
            {displayName}
          </h3>
          <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-slate-400 shrink-0 ml-2">
            {product.brand}
          </span>
        </div>
        <span className="text-xl font-semibold text-cyan-400/90 mb-4 tracking-wide">
          ¥{product.price}
        </span>

        <div className="text-[10px] text-slate-500 mb-2 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-500/40"></div>
          <span>材质: {product.material}</span>
        </div>

        <div className="mb-3">
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-[0.08em] ${audienceToneClassName}`}
          >
            <span className="text-[10px] uppercase tracking-[0.18em] opacity-70">
              适用对象
            </span>
            <span>{audienceLabel}</span>
          </span>
        </div>

        <div className="mb-3">
          <BrandBriefCard brief={resolvedBrandBrief} compact />
        </div>

        {product.personaAnalysis && (
          <div className="mb-3 p-2 rounded bg-cyan-950/40 border border-cyan-500/20 group/tooltip relative cursor-help">
            <h4 className="text-[9px] text-cyan-500 mb-0.5 tracking-wider font-mono">
              适用人群
            </h4>
            <p className="text-[10px] text-cyan-100/70 leading-relaxed line-clamp-3">
              {product.personaAnalysis}
            </p>
            <div className="opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-300 absolute z-50 bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 w-[calc(100%+32px)] p-3 bg-slate-900/95 border border-cyan-500/50 rounded-lg shadow-2xl shadow-cyan-900/30 backdrop-blur-md pointer-events-none">
              <p className="text-[10.5px] text-cyan-50 leading-relaxed">
                {product.personaAnalysis}
              </p>
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-cyan-500/50"></div>
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-slate-900"></div>
            </div>
          </div>
        )}

        {product.tags && product.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {product.tags.map((tag, index) => (
              <span
                key={index}
                className="text-[9px] bg-indigo-500/10 text-indigo-300/70 border border-indigo-500/20 px-1.5 py-0.5 rounded-md"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-auto pt-2">
          {onToggleFavorite ? (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onToggleFavorite(product);
              }}
              className={`inline-flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1.5 rounded-full border transition-colors ${
                isFavorited
                  ? "border-rose-300/35 bg-rose-400/16 text-rose-100"
                  : "border-cyan-300/18 bg-cyan-300/10 text-cyan-100 hover:border-cyan-200/35 hover:text-white"
              }`}
            >
              <Heart className={`w-3 h-3 ${isFavorited ? "fill-current" : ""}`} />
              {isFavorited ? "已收藏" : "收藏"}
            </button>
          ) : null}
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-300 bg-white/5 border border-white/5 px-2 py-1 rounded">
            <VolumeX className="w-3 h-3 text-cyan-500/70" />
            {product.maxDb == null ? "无噪音参数" : `<${product.maxDb}dB`}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-300 bg-white/5 border border-white/5 px-2 py-1 rounded">
            <Droplets className="w-3 h-3 text-cyan-500/70" />
            {product.waterproof == null ? "无防水参数" : `IPX${product.waterproof}`}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-300 bg-white/5 border border-white/5 px-2 py-1 rounded">
            <Zap className="w-3 h-3 text-cyan-500/70" />
            {product.motorType === "gentle" ? "柔和波段" : "强感波段"}
          </div>
        </div>
      </div>
    </>
  );
}
