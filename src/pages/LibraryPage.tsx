import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUp } from "lucide-react";
import { Product } from "../data/mock";
import { ProductCardContent } from "../components/ProductCardContent";
import { PRICE_RANGE_OPTIONS, matchesPriceRange } from "../lib/app-shell";
import { shouldShowLibraryBackToTop } from "../lib/library-back-to-top";

export function LibraryPage({
  allProducts,
  filterGender,
  filterBrand,
  filterOrigin,
  filterMaterial,
  filterPriceRange,
  filterMaxDb,
  isLoading,
  error,
  onReload,
  onFilterGenderChange,
  onFilterBrandChange,
  onFilterOriginChange,
  onFilterMaterialChange,
  onFilterPriceRangeChange,
  onFilterMaxDbChange,
  onBack,
}: {
  allProducts: Product[];
  filterGender: string;
  filterBrand: string;
  filterOrigin: string;
  filterMaterial: string;
  filterPriceRange: string;
  filterMaxDb: number;
  isLoading: boolean;
  error: string | null;
  onReload: () => void;
  onFilterGenderChange: (value: string) => void;
  onFilterBrandChange: (value: string) => void;
  onFilterOriginChange: (value: string) => void;
  onFilterMaterialChange: (value: string) => void;
  onFilterPriceRangeChange: (value: string) => void;
  onFilterMaxDbChange: (value: number) => void;
  onBack: () => void;
}) {
  const products = Array.isArray(allProducts) ? allProducts : [];
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const syncVisibility = () => {
      setShowBackToTop(shouldShowLibraryBackToTop(container.scrollTop));
    };

    syncVisibility();
    container.addEventListener("scroll", syncVisibility, { passive: true });

    return () => {
      container.removeEventListener("scroll", syncVisibility);
    };
  }, []);

  function handleBackToTop() {
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div
      ref={containerRef}
      className="min-h-screen flex flex-col items-center justify-start p-4 sm:p-6 md:p-8 relative overflow-hidden overflow-y-auto w-full"
    >
      <div className="fixed top-[-10%] left-[-10%] w-96 h-96 bg-cyan-900/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-96 h-96 bg-indigo-900/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-5xl relative z-10 pb-20">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 mb-8 transition-colors mt-4"
        >
          <ArrowLeft className="w-4 h-4" />
          返回指挥舱
        </button>

        <div className="text-center mb-10">
          <h1 className="text-3xl font-light tracking-widest text-white mb-2">
            全息装备库
          </h1>
          <p className="text-slate-400 text-sm">
            收录当前系统链接的所有真实物理装备
          </p>
          <button
            onClick={onReload}
            disabled={isLoading}
            className="mt-4 inline-flex items-center justify-center rounded-full border border-cyan-400/50 bg-cyan-500/20 px-5 py-2 text-[12px] font-semibold tracking-[0.18em] text-cyan-100 shadow-[0_0_30px_rgba(34,211,238,0.16)] hover:border-cyan-300/70 hover:bg-cyan-400/25 hover:text-white disabled:border-slate-700 disabled:bg-slate-900/40 disabled:text-slate-500 transition-all"
          >
            {isLoading ? "正在同步装备库..." : "重新同步装备库"}
          </button>
        </div>

        <div className="glass-panel rounded-2xl p-6 mb-10 border border-white/5 bg-white/5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
                适用对象
              </label>
              <select
                value={filterGender}
                onChange={(e) => onFilterGenderChange(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-cyan-500/50 appearance-none"
              >
                <option value="all">全部性别</option>
                <option value="female">女性向</option>
                <option value="male">男性向</option>
                <option value="unisex">通用型</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
                品牌厂商
              </label>
              <select
                value={filterBrand}
                onChange={(e) => onFilterBrandChange(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-cyan-500/50 appearance-none"
              >
                <option value="all">所有品牌</option>
                {Array.from(new Set(products.map((product) => product.brand)))
                  .sort()
                  .map((brand) => (
                    <option key={brand} value={brand}>
                      {brand}
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
                出品地区
              </label>
              <select
                value={filterOrigin}
                onChange={(e) => onFilterOriginChange(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-cyan-500/50 appearance-none"
              >
                <option value="all">不限产地</option>
                <option value="domestic">国产品牌</option>
                <option value="international">海外品牌</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
                材质偏好
              </label>
              <select
                value={filterMaterial}
                onChange={(e) => onFilterMaterialChange(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-cyan-500/50 appearance-none"
              >
                <option value="all">所有材质</option>
                {Array.from(
                  new Set(
                    products.map((product) => {
                      if (product.material.includes("硅胶")) return "硅胶";
                      if (product.material.includes("ABS")) return "ABS";
                      if (product.material.includes("TPE")) return "TPE";
                      return product.material;
                    }),
                  ),
                )
                  .sort()
                  .map((material) => (
                    <option key={material} value={material}>
                      {material}
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
                价格区间
              </label>
              <select
                value={filterPriceRange}
                onChange={(e) => onFilterPriceRangeChange(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-cyan-500/50 appearance-none"
              >
                {PRICE_RANGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
                  静音阈值
                </label>
                <span className="text-[10px] text-cyan-400 font-mono">
                  &lt;{filterMaxDb}dB
                </span>
              </div>
              <input
                type="range"
                min="30"
                max="70"
                step="5"
                value={filterMaxDb}
                onChange={(e) => onFilterMaxDbChange(parseInt(e.target.value))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>
          </div>
        </div>

        {isLoading && products.length === 0 ? (
          <div className="glass-panel rounded-2xl p-10 text-center border border-cyan-500/20 bg-cyan-500/5">
            <div className="text-cyan-300 text-sm tracking-widest mb-2">
              正在加载全息装备库
            </div>
            <div className="text-slate-500 text-xs">
              仅在首次进入页面或手动同步时请求数据库
            </div>
          </div>
        ) : error ? (
          <div className="glass-panel rounded-2xl p-10 text-center border border-red-500/20 bg-red-500/5">
            <div className="text-red-300 text-sm tracking-widest mb-3">
              {error}
            </div>
            <button
              onClick={onReload}
              className="text-xs text-cyan-300 hover:text-cyan-200 transition-colors"
            >
              重新尝试连接
            </button>
          </div>
        ) : products.length === 0 ? (
          <div className="glass-panel rounded-2xl p-10 text-center border border-white/5 bg-white/5">
            <div className="text-slate-300 text-sm tracking-widest mb-2">
              暂无装备数据
            </div>
            <button
              onClick={onReload}
              className="text-xs text-cyan-300 hover:text-cyan-200 transition-colors"
            >
              同步装备库
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products
            .filter((product) => {
              const matchGender =
                filterGender === "all" || product.gender === filterGender;
              const matchBrand =
                filterBrand === "all" || product.brand === filterBrand;
              const matchOrigin =
                filterOrigin === "all" ||
                (filterOrigin === "domestic"
                  ? product.isDomestic === true
                  : product.isDomestic === false);
              const matchDb =
                product.maxDb == null || product.maxDb <= filterMaxDb;
              const matchMaterial =
                filterMaterial === "all" ||
                product.material.includes(filterMaterial);
              const matchPrice = matchesPriceRange(
                product.price,
                filterPriceRange,
              );

              return (
                matchGender &&
                matchBrand &&
                matchOrigin &&
                matchDb &&
                matchMaterial &&
                matchPrice
              );
            })
              .map((product) => {
              const productUrl = product.sourceUrl || product.link;
              return productUrl ? (
                <a
                  key={product.id}
                  href={productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glass-panel rounded-2xl overflow-hidden flex flex-col group hover:border-cyan-500/40 transition-all hover:bg-white/5 cursor-pointer"
                >
                  <ProductCardContent product={product} />
                </a>
              ) : (
                <div
                  key={product.id}
                  className="glass-panel rounded-2xl overflow-hidden flex flex-col group hover:border-cyan-500/40 transition-all hover:bg-white/5"
                >
                  <ProductCardContent product={product} />
                </div>
              );
              })}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleBackToTop}
        aria-label="回到顶部"
        className={`fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-slate-950/80 px-4 py-2 text-xs text-cyan-100 shadow-[0_0_30px_rgba(34,211,238,0.18)] backdrop-blur-md transition-all duration-300 hover:border-cyan-300/70 hover:bg-cyan-950/85 hover:text-white sm:bottom-8 sm:right-8 ${
          showBackToTop
            ? "translate-y-0 opacity-100 pointer-events-auto"
            : "translate-y-3 opacity-0 pointer-events-none"
        }`}
      >
        <ArrowUp className="h-4 w-4" />
        <span>回到顶部</span>
      </button>
    </div>
  );
}
