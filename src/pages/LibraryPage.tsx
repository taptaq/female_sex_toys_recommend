import { ArrowLeft } from "lucide-react";
import { Product } from "../data/mock";
import { ProductCardContent } from "../components/ProductCardContent";
import { PRICE_RANGE_OPTIONS, matchesPriceRange } from "../lib/app-shell";

export function LibraryPage({
  allProducts,
  filterGender,
  filterBrand,
  filterOrigin,
  filterMaterial,
  filterPriceRange,
  filterMaxDb,
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
  onFilterGenderChange: (value: string) => void;
  onFilterBrandChange: (value: string) => void;
  onFilterOriginChange: (value: string) => void;
  onFilterMaterialChange: (value: string) => void;
  onFilterPriceRangeChange: (value: string) => void;
  onFilterMaxDbChange: (value: number) => void;
  onBack: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 sm:p-6 md:p-8 relative overflow-hidden overflow-y-auto w-full">
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
                {Array.from(new Set(allProducts.map((product) => product.brand)))
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
                    allProducts.map((product) => {
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {allProducts
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
      </div>
    </div>
  );
}
