import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUp, Check, ChevronDown } from "lucide-react";
import type { Product } from "../data/mock.ts";
import { ProductCardContent } from "../components/ProductCardContent.tsx";
import { PRICE_RANGE_OPTIONS, matchesPriceRange } from "../lib/app-shell.ts";
import { shouldShowLibraryBackToTop } from "../lib/library-back-to-top.ts";
import {
  getAllowedLibrarySubtypeCodes,
  getLibrarySubtypeLabel,
  getAllowedLibraryTypeCodes,
  getLibraryTypeLabel,
  sanitizeLibrarySubtypeSelection,
  sanitizeLibraryTypeSelection,
  type LibraryAudienceGender,
} from "../lib/library-product-types.ts";
import {
  resolveLibrarySubtypeCode,
  resolveLibraryTypeCode,
} from "../lib/library-product-type-classifier.ts";

const libraryFilterLabelClassName =
  "text-[10px] uppercase tracking-[0.24em] text-slate-500/90 font-mono";
const libraryFilterTriggerClassName =
  "library-filter-trigger flex w-full items-center justify-between gap-3 rounded-xl border border-cyan-400/15 bg-slate-950/70 px-3.5 py-2.5 text-left text-sm text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm transition-all hover:border-cyan-300/30 focus:border-cyan-300/45 focus:outline-none focus:ring-2 focus:ring-cyan-400/15";
const libraryFilterOptionsClassName =
  "library-filter-options absolute left-0 right-0 top-[calc(100%+0.55rem)] z-30 origin-top rounded-2xl border border-cyan-400/18 bg-slate-950/96 p-2 shadow-[0_18px_60px_rgba(2,12,27,0.72)] backdrop-blur-xl transition-all duration-150";
const libraryFilterOptionClassName =
  "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-200 transition-colors hover:bg-cyan-400/10 hover:text-white";
export const DEFAULT_LIBRARY_FILTER_MAX_DB = 70;

type LibraryFilterOption = {
  value: string;
  label: string;
};

function resolveProductLibraryTypeCode(product: Product) {
  return resolveLibraryTypeCode(product.typeCode, {
    gender: product.gender,
    physicalForm: product.physicalForm,
    name: product.canonicalName || product.name,
    rawDescription: product.rawDescription ?? null,
    tags: product.tags ?? [],
  });
}

function resolveProductLibrarySubtypeCode(product: Product, typeCode: string) {
  return resolveLibrarySubtypeCode(product.subtypeCode, {
    typeCode,
    gender: product.gender,
    physicalForm: product.physicalForm,
    name: product.canonicalName || product.name,
    rawDescription: product.rawDescription ?? null,
    tags: product.tags ?? [],
  });
}

function LibraryFilterSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: LibraryFilterOption[];
  onChange: (value: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption =
    options.find((option) => option.value === value) ?? options[0] ?? null;

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`${libraryFilterTriggerClassName} ${
          isOpen
            ? "border-cyan-300/45 bg-slate-950/88 ring-2 ring-cyan-400/15"
            : ""
        }`}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="truncate">
          {selectedOption?.label ?? options[0]?.label ?? ""}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-cyan-200/55 transition-all ${
            isOpen ? "rotate-180 text-cyan-100/80" : ""
          }`}
        />
      </button>

      <div
        role="listbox"
        aria-hidden={!isOpen}
        className={`${libraryFilterOptionsClassName} ${
          isOpen
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-1 opacity-0"
        }`}
      >
        <div className="max-h-72 overflow-y-auto">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`${libraryFilterOptionClassName} ${
                  isSelected
                    ? "bg-cyan-500/14 text-cyan-50 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.16)]"
                    : ""
                }`}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                <span className="truncate">{option.label}</span>
                <Check
                  className={`h-4 w-4 shrink-0 transition-opacity ${
                    isSelected ? "opacity-100 text-cyan-200" : "opacity-0"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function LibraryPage({
  allProducts,
  filterGender,
  filterType = "all",
  filterSubtype = "all",
  filterBrand,
  filterOrigin,
  filterMaterial,
  filterPriceRange,
  filterMaxDb,
  isLoading,
  error,
  onReload,
  onFilterGenderChange,
  onFilterTypeChange = () => {},
  onFilterSubtypeChange = () => {},
  onFilterBrandChange,
  onFilterOriginChange,
  onFilterMaterialChange,
  onFilterPriceRangeChange,
  onFilterMaxDbChange,
  onResetFilters = () => {},
  onBack,
}: {
  allProducts: Product[];
  filterGender: string;
  filterType?: string;
  filterSubtype?: string;
  filterBrand: string;
  filterOrigin: string;
  filterMaterial: string;
  filterPriceRange: string;
  filterMaxDb: number;
  isLoading: boolean;
  error: string | null;
  onReload: () => void;
  onFilterGenderChange: (value: string) => void;
  onFilterTypeChange?: (value: string) => void;
  onFilterSubtypeChange?: (value: string) => void;
  onFilterBrandChange: (value: string) => void;
  onFilterOriginChange: (value: string) => void;
  onFilterMaterialChange: (value: string) => void;
  onFilterPriceRangeChange: (value: string) => void;
  onFilterMaxDbChange: (value: number) => void;
  onResetFilters?: () => void;
  onBack: () => void;
}) {
  const products = Array.isArray(allProducts) ? allProducts : [];
  const normalizedFilterGender: LibraryAudienceGender =
    filterGender === "female" || filterGender === "male" || filterGender === "unisex"
      ? filterGender
      : "all";
  const allowedTypeCodes = getAllowedLibraryTypeCodes(normalizedFilterGender);
  const effectiveFilterType = sanitizeLibraryTypeSelection(
    filterType,
    normalizedFilterGender,
  );
  const allowedSubtypeCodes = getAllowedLibrarySubtypeCodes(
    normalizedFilterGender,
    effectiveFilterType,
  );
  const effectiveFilterSubtype = sanitizeLibrarySubtypeSelection(
    filterSubtype,
    normalizedFilterGender,
    effectiveFilterType,
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
  const hasActiveFilters =
    normalizedFilterGender !== "all" ||
    effectiveFilterType !== "all" ||
    effectiveFilterSubtype !== "all" ||
    filterBrand !== "all" ||
    filterOrigin !== "all" ||
    filterMaterial !== "all" ||
    filterPriceRange !== "all" ||
    filterMaxDb !== DEFAULT_LIBRARY_FILTER_MAX_DB;

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
      className="relative min-h-screen w-full overflow-hidden overflow-y-auto p-4 flex flex-col items-center justify-start sm:p-6 md:p-8"
    >
      <div className="fixed top-[-10%] left-[-10%] w-96 h-96 bg-cyan-900/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-96 h-96 bg-indigo-900/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-5xl pb-20 sm:pb-24">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 mb-8 transition-colors mt-4"
        >
          <ArrowLeft className="w-4 h-4" />
          返回指挥舱
        </button>

        <div className="text-center mb-8 sm:mb-10">
          <h1 className="text-2xl font-light tracking-[0.2em] text-white mb-2 sm:text-3xl sm:tracking-widest">
            全息装备库
          </h1>
          <p className="text-slate-400 text-sm">
            用来横向比较同类路线、参数和价位的装备工具层
          </p>
          <button
            onClick={onReload}
            disabled={isLoading}
            className="mt-4 inline-flex items-center justify-center rounded-full border border-cyan-400/50 bg-cyan-500/20 px-5 py-2 text-[12px] font-semibold tracking-[0.18em] text-cyan-100 shadow-[0_0_30px_rgba(34,211,238,0.16)] hover:border-cyan-300/70 hover:bg-cyan-400/25 hover:text-white disabled:border-slate-700 disabled:bg-slate-900/40 disabled:text-slate-500 transition-all"
          >
            {isLoading ? "正在同步装备库..." : "重新同步装备库"}
          </button>
        </div>

        <div className="glass-panel relative z-20 rounded-[1.35rem] p-4 mb-8 border border-white/5 bg-white/5 sm:rounded-2xl sm:p-6 sm:mb-10">
          <div className="mb-4 flex flex-col gap-3 border-b border-white/8 pb-4 sm:mb-5 sm:flex-row sm:items-center sm:justify-between sm:pb-5">
            <div>
              <h2 className="text-sm font-medium tracking-[0.18em] text-cyan-50">
                装备筛选
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                快速切回默认条件，重新浏览全量装备。
              </p>
            </div>
            <button
              type="button"
              disabled={!hasActiveFilters}
              onClick={() => {
                setIsAdvancedFiltersOpen(false);
                onResetFilters();
              }}
              className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-xs tracking-[0.18em] text-slate-300 transition-all hover:border-cyan-300/30 hover:bg-cyan-400/10 hover:text-cyan-100 disabled:cursor-not-allowed disabled:border-white/6 disabled:bg-white/[0.02] disabled:text-slate-600"
            >
              重置筛选
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <label className={libraryFilterLabelClassName}>
                适用对象
              </label>
              <LibraryFilterSelect
                value={filterGender}
                onChange={onFilterGenderChange}
                options={[
                  { value: "all", label: "全部性别" },
                  { value: "female", label: "女性向" },
                  { value: "male", label: "男性向" },
                  { value: "unisex", label: "通用型" },
                ]}
              />
            </div>

            <div className="space-y-2">
              <label className={libraryFilterLabelClassName}>
                类型
              </label>
              <LibraryFilterSelect
                value={effectiveFilterType}
                onChange={onFilterTypeChange}
                options={[
                  { value: "all", label: "全部类型" },
                  ...allowedTypeCodes.map((typeCode) => ({
                    value: typeCode,
                    label: getLibraryTypeLabel(typeCode),
                  })),
                ]}
              />
            </div>

            {allowedSubtypeCodes.length > 0 && (
              <div className="space-y-2">
                <label className={libraryFilterLabelClassName}>
                  类型细分
                </label>
                <LibraryFilterSelect
                  value={effectiveFilterSubtype}
                  onChange={onFilterSubtypeChange}
                  options={[
                    { value: "all", label: "全部细分" },
                    ...allowedSubtypeCodes.map((subtypeCode) => ({
                      value: subtypeCode,
                      label: getLibrarySubtypeLabel(subtypeCode),
                    })),
                  ]}
                />
              </div>
            )}

            <div className="space-y-2">
              <label className={libraryFilterLabelClassName}>
                价格区间
              </label>
              <LibraryFilterSelect
                value={filterPriceRange}
                onChange={onFilterPriceRangeChange}
                options={PRICE_RANGE_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
              />
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
                max={DEFAULT_LIBRARY_FILTER_MAX_DB}
                step="5"
                value={filterMaxDb}
                onChange={(e) => onFilterMaxDbChange(parseInt(e.target.value))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>
          </div>

          <div className="mt-4 border-t border-white/8 pt-4 sm:mt-5">
            <button
              type="button"
              onClick={() => setIsAdvancedFiltersOpen((isOpen) => !isOpen)}
              aria-expanded={isAdvancedFiltersOpen}
              className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-2 text-xs text-slate-300 transition-colors hover:border-cyan-300/25 hover:bg-cyan-400/8 hover:text-cyan-100"
            >
              <span>高级筛选</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${
                  isAdvancedFiltersOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {isAdvancedFiltersOpen && (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <label className={libraryFilterLabelClassName}>
                    品牌厂商
                  </label>
                  <LibraryFilterSelect
                    value={filterBrand}
                    onChange={onFilterBrandChange}
                    options={[
                      { value: "all", label: "所有品牌" },
                      ...Array.from(new Set(products.map((product) => product.brand)))
                        .sort()
                        .map((brand) => ({
                          value: brand,
                          label: brand,
                        })),
                    ]}
                  />
                </div>

                <div className="space-y-2">
                  <label className={libraryFilterLabelClassName}>
                    出品地区
                  </label>
                  <LibraryFilterSelect
                    value={filterOrigin}
                    onChange={onFilterOriginChange}
                    options={[
                      { value: "all", label: "不限产地" },
                      { value: "domestic", label: "国产品牌" },
                      { value: "international", label: "海外品牌" },
                    ]}
                  />
                </div>

                <div className="space-y-2">
                  <label className={libraryFilterLabelClassName}>
                    材质偏好
                  </label>
                  <LibraryFilterSelect
                    value={filterMaterial}
                    onChange={onFilterMaterialChange}
                    options={[
                      { value: "all", label: "所有材质" },
                      ...Array.from(
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
                        .map((material) => ({
                          value: material,
                          label: material,
                        })),
                    ]}
                  />
                </div>
              </div>
            )}
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
          <div className="relative z-0 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {products
            .filter((product) => {
              const resolvedProductTypeCode = resolveProductLibraryTypeCode(product);
              const resolvedProductSubtypeCode = resolveProductLibrarySubtypeCode(
                product,
                resolvedProductTypeCode,
              );
              const matchGender =
                filterGender === "all" || product.gender === filterGender;
              const matchType =
                effectiveFilterType === "all" ||
                resolvedProductTypeCode === effectiveFilterType;
              const matchSubtype =
                effectiveFilterSubtype === "all" ||
                resolvedProductSubtypeCode === effectiveFilterSubtype;
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
                matchType &&
                matchSubtype &&
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
                  className="glass-panel rounded-[1.35rem] overflow-hidden flex flex-col group hover:border-cyan-500/40 transition-all hover:bg-white/5 cursor-pointer sm:rounded-2xl"
                >
                  <ProductCardContent product={product} />
                </a>
              ) : (
                <div
                  key={product.id}
                  className="glass-panel rounded-[1.35rem] overflow-hidden flex flex-col group hover:border-cyan-500/40 transition-all hover:bg-white/5 sm:rounded-2xl"
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
        className={`fixed bottom-4 right-4 z-30 inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-slate-950/80 px-4 py-2 text-xs text-cyan-100 shadow-[0_0_30px_rgba(34,211,238,0.18)] backdrop-blur-md transition-all duration-300 hover:border-cyan-300/70 hover:bg-cyan-950/85 hover:text-white sm:bottom-8 sm:right-8 ${
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
