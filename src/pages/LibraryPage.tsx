import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUp, Check, ChevronDown, ExternalLink, X } from "lucide-react";
import type { Product } from "../data/mock.ts";
import { ProductCardContent } from "../components/ProductCardContent.tsx";
import { ProductImage } from "../components/ProductImage.tsx";
import { PRICE_RANGE_OPTIONS, matchesPriceRange } from "../lib/app-shell.ts";
import { resolveBrandBrief } from "../lib/brand-brief.ts";
import { shouldShowLibraryBackToTop } from "../lib/library-back-to-top.ts";
import {
  getAllowedLibrarySubtypeCodes,
  getLibrarySubtypeLabel,
  getAllowedLibraryTypeCodes,
  getLibraryTypeLabel,
  sanitizeLibrarySubtypeSelection,
  sanitizeLibraryTypeSelection,
  type LibraryAudienceGender,
  type LibrarySelectableTypeCode,
  type LibrarySubtypeCode,
  type LibrarySubtypeSelection,
  type LibraryTypeSelection,
} from "../lib/library-product-types.ts";
import {
  resolveLibrarySubtypeCode,
  resolveLibraryTypeCode,
} from "../lib/library-product-type-classifier.ts";
import { getProductDisplayName } from "../lib/product-display-name.ts";

const libraryFilterLabelClassName =
  "text-[10px] uppercase tracking-[0.22em] text-slate-500/90 font-mono";
const libraryFilterTriggerClassName =
  "library-filter-trigger flex w-full items-center justify-between gap-3 rounded-xl border border-sky-100/90 bg-white/75 px-3.5 py-2.5 text-left text-sm font-semibold text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.74),0_0.65rem_1.35rem_rgba(125,211,252,0.08)] backdrop-blur-sm transition-all hover:border-sky-200 hover:bg-white/90 focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-200/55";
const libraryFilterOptionsClassName =
  "library-filter-options absolute left-0 right-0 top-[calc(100%+0.55rem)] z-30 origin-top rounded-2xl border border-sky-100/90 bg-white/95 p-2 shadow-[0_18px_44px_rgba(148,163,184,0.22)] backdrop-blur-xl transition-all duration-150";
const libraryFilterOptionClassName =
  "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-600 transition-colors hover:bg-sky-50 hover:text-slate-950";
export const DEFAULT_LIBRARY_FILTER_MAX_DB = 70;

const libraryProductCardClassName =
  "rounded-[1rem] overflow-hidden flex flex-col group border border-white/70 bg-white/75 shadow-[0_0.8rem_1.7rem_rgba(148,163,184,0.12)] backdrop-blur-xl transition-all hover:border-sky-200 hover:bg-white/90 hover:-translate-y-0.5 sm:rounded-2xl sm:shadow-[0_1rem_2.4rem_rgba(148,163,184,0.12)]";

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

function getProductsMatchingLibraryGender(
  products: Product[],
  gender: LibraryAudienceGender,
) {
  if (gender === "all") return products;
  return products.filter((product) => product.gender === gender);
}

function getAvailableLibraryTypeCodes(
  products: Product[],
  gender: LibraryAudienceGender,
): LibrarySelectableTypeCode[] {
  const allowedTypeCodes = getAllowedLibraryTypeCodes(gender);
  const allowedTypeCodeSet = new Set<string>(allowedTypeCodes);
  const presentTypeCodeSet = new Set<string>();

  for (const product of getProductsMatchingLibraryGender(products, gender)) {
    const typeCode = resolveProductLibraryTypeCode(product);
    if (allowedTypeCodeSet.has(typeCode)) {
      presentTypeCodeSet.add(typeCode);
    }
  }

  return allowedTypeCodes.filter((typeCode) => presentTypeCodeSet.has(typeCode));
}

function sanitizeAvailableLibraryTypeSelection(
  type: string,
  gender: LibraryAudienceGender,
  availableTypeCodes: LibrarySelectableTypeCode[],
): LibraryTypeSelection {
  const sanitizedType = sanitizeLibraryTypeSelection(type, gender);
  if (sanitizedType === "all") return "all";
  return availableTypeCodes.includes(sanitizedType) ? sanitizedType : "all";
}

function getAvailableLibrarySubtypeCodes(
  products: Product[],
  gender: LibraryAudienceGender,
  type: LibraryTypeSelection,
): LibrarySubtypeCode[] {
  if (type === "all") return [];

  const allowedSubtypeCodes = getAllowedLibrarySubtypeCodes(gender, type);
  const allowedSubtypeCodeSet = new Set<string>(allowedSubtypeCodes);
  const presentSubtypeCodeSet = new Set<string>();

  for (const product of getProductsMatchingLibraryGender(products, gender)) {
    const productTypeCode = resolveProductLibraryTypeCode(product);
    if (productTypeCode !== type) continue;

    const subtypeCode = resolveProductLibrarySubtypeCode(product, productTypeCode);
    if (allowedSubtypeCodeSet.has(subtypeCode)) {
      presentSubtypeCodeSet.add(subtypeCode);
    }
  }

  return allowedSubtypeCodes.filter((subtypeCode) =>
    presentSubtypeCodeSet.has(subtypeCode),
  );
}

function sanitizeAvailableLibrarySubtypeSelection(
  subtype: string,
  gender: LibraryAudienceGender,
  type: LibraryTypeSelection,
  availableSubtypeCodes: LibrarySubtypeCode[],
): LibrarySubtypeSelection {
  const sanitizedSubtype = sanitizeLibrarySubtypeSelection(subtype, gender, type);
  if (sanitizedSubtype === "all") return "all";
  return availableSubtypeCodes.includes(sanitizedSubtype)
    ? sanitizedSubtype
    : "all";
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
            ? "border-sky-300 bg-white ring-2 ring-sky-200/55"
            : ""
        }`}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="truncate">
          {selectedOption?.label ?? options[0]?.label ?? ""}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-sky-400 transition-all ${
            isOpen ? "rotate-180 text-sky-500" : ""
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
                    ? "bg-sky-50 text-sky-700 shadow-[inset_0_0_0_1px_rgba(125,211,252,0.22)]"
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
                    isSelected ? "opacity-100 text-sky-500" : "opacity-0"
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

function getAudienceLabel(product: Product) {
  if (product.gender === "male") return "男性向";
  if (product.gender === "female") return "女性向";
  return "通用型";
}

function getPhysicalFormLabel(product: Product) {
  if (product.physicalForm === "internal") return "入体";
  if (product.physicalForm === "composite") return "复合";
  return "外部";
}

function getMotorLabel(product: Product) {
  return product.motorType === "gentle" ? "柔和波段" : "强感波段";
}

function getCompactRawDescription(value: string | null | undefined) {
  const normalized = String(value || "")
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return "";
  return normalized.length > 220 ? `${normalized.slice(0, 220)}...` : normalized;
}

function LibraryDetailField({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  const displayValue =
    value == null || value === "" ? "暂无数据" : String(value);

  return (
    <div className="rounded-2xl border border-sky-100/80 bg-sky-50/45 px-3 py-2.5">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-sm font-black leading-snug text-slate-800">
        {displayValue}
      </div>
    </div>
  );
}

export function LibraryProductDetailModal({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const displayName = getProductDisplayName(product);
  const typeCode = resolveProductLibraryTypeCode(product);
  const subtypeCode = resolveProductLibrarySubtypeCode(product, typeCode);
  const brandBrief = resolveBrandBrief(product.brandBrief, product.brand);
  const productUrl = product.sourceUrl || product.link || "";
  const rawDescription = getCompactRawDescription(product.rawDescription);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/32 px-3 py-3 backdrop-blur-sm sm:items-center sm:px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="library-product-detail-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="max-h-[88svh] w-full max-w-3xl overflow-hidden rounded-[1.6rem] border border-white/80 bg-white/92 shadow-[0_2rem_4rem_rgba(15,23,42,0.22)] backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4 border-b border-sky-100/80 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-sky-400">
              产品详情信息
            </p>
            <h2
              id="library-product-detail-title"
              className="mt-1 line-clamp-2 text-xl font-black leading-tight text-slate-950"
            >
              {displayName}
            </h2>
            <p className="mt-1 text-xs font-bold text-slate-500">
              {product.brand}
              {brandBrief?.countryLabel ? ` · ${brandBrief.countryLabel}` : ""}
            </p>
          </div>
          <button
            type="button"
            aria-label="关闭产品详情信息"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-[0_0.75rem_1.5rem_rgba(148,163,184,0.14)] transition-colors hover:border-sky-200 hover:text-sky-600"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="max-h-[calc(88svh-5.25rem)] overflow-y-auto px-5 py-5 sm:px-6">
          <div className="grid gap-5 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="overflow-hidden rounded-[1.25rem] border border-sky-100 bg-white shadow-[0_1rem_2.4rem_rgba(148,163,184,0.12)]">
              <div className="aspect-[4/3] bg-slate-50">
                <ProductImage
                  imageValue={product.imagePlaceholder}
                  typeCode={product.typeCode}
                  subtypeCode={product.subtypeCode}
                  gender={product.gender}
                  physicalForm={product.physicalForm}
                  alt={displayName}
                  iconClassName="h-8 w-8 text-slate-300"
                  imageClassName="h-full w-full object-cover"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {[getAudienceLabel(product), getLibraryTypeLabel(typeCode), getLibrarySubtypeLabel(subtypeCode), getPhysicalFormLabel(product)].map((label) => (
                  <span
                    key={label}
                    className="inline-flex items-center rounded-full border border-sky-100 bg-sky-50 px-3 py-1.5 text-xs font-black text-sky-700"
                  >
                    {label}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <LibraryDetailField label="价格" value={`¥${product.price}`} />
                <LibraryDetailField label="材质" value={product.material} />
                <LibraryDetailField
                  label="噪音"
                  value={product.maxDb == null ? null : `<${product.maxDb}dB`}
                />
                <LibraryDetailField
                  label="防水"
                  value={product.waterproof == null ? null : `IPX${product.waterproof}`}
                />
                <LibraryDetailField label="动力" value={getMotorLabel(product)} />
                <LibraryDetailField
                  label="产地"
                  value={
                    product.isDomestic == null
                      ? null
                      : product.isDomestic
                        ? "中国大陆"
                        : "海外品牌"
                  }
                />
              </div>

              {product.tags && product.tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {product.tags.slice(0, 8).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-rose-100 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}

              {productUrl ? (
                <a
                  href={productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-3 text-sm font-black tracking-[0.08em] text-white shadow-[0_1rem_2rem_rgba(15,23,42,0.22)] transition-colors hover:bg-slate-800"
                >
                  打开产品详情链接
                  <ExternalLink className="h-4 w-4" />
                </a>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-xs font-bold text-slate-500">
                  暂无外部产品详情链接
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {brandBrief ? (
              <section className="rounded-[1.25rem] border border-sky-100/80 bg-white/78 p-4">
                <h3 className="text-xs font-black tracking-[0.16em] text-slate-700">
                  品牌信息
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {brandBrief.positioning}
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  {brandBrief.styleSummary}
                </p>
              </section>
            ) : null}

            {product.personaAnalysis ? (
              <section className="rounded-[1.25rem] border border-rose-100/80 bg-rose-50/52 p-4">
                <h3 className="text-xs font-black tracking-[0.16em] text-slate-700">
                  适配提示
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {product.personaAnalysis}
                </p>
              </section>
            ) : null}

            {rawDescription ? (
              <section className="rounded-[1.25rem] border border-slate-200/80 bg-slate-50/78 p-4">
                <h3 className="text-xs font-black tracking-[0.16em] text-slate-700">
                  产品详情摘要
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {rawDescription}
                </p>
              </section>
            ) : null}
          </div>
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
  showFavoritesOnly = false,
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
  onShowFavoritesOnlyChange = () => {},
  onFilterMaterialChange,
  onFilterPriceRangeChange,
  onFilterMaxDbChange,
  onResetFilters = () => {},
  onBack,
  favoriteProductIds = new Set<string>(),
  onToggleFavorite,
}: {
  allProducts: Product[];
  filterGender: string;
  filterType?: string;
  filterSubtype?: string;
  filterBrand: string;
  filterOrigin: string;
  showFavoritesOnly?: boolean;
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
  onShowFavoritesOnlyChange?: (value: boolean) => void;
  onFilterMaterialChange: (value: string) => void;
  onFilterPriceRangeChange: (value: string) => void;
  onFilterMaxDbChange: (value: number) => void;
  onResetFilters?: () => void;
  onBack: () => void;
  favoriteProductIds?: Set<string>;
  onToggleFavorite?: (product: Product) => void | Promise<void>;
}) {
  const products = Array.isArray(allProducts) ? allProducts : [];
  const [selectedDetailProduct, setSelectedDetailProduct] =
    useState<Product | null>(null);
  const normalizedFilterGender: LibraryAudienceGender = "all";
  const availableTypeCodes = getAvailableLibraryTypeCodes(
    products,
    normalizedFilterGender,
  );
  const effectiveFilterType = sanitizeAvailableLibraryTypeSelection(
    filterType,
    normalizedFilterGender,
    availableTypeCodes,
  );
  const availableSubtypeCodes = getAvailableLibrarySubtypeCodes(
    products,
    normalizedFilterGender,
    effectiveFilterType,
  );
  const effectiveFilterSubtype = sanitizeAvailableLibrarySubtypeSelection(
    filterSubtype,
    normalizedFilterGender,
    effectiveFilterType,
    availableSubtypeCodes,
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
  const hasActiveFilters =
    effectiveFilterType !== "all" ||
    effectiveFilterSubtype !== "all" ||
    filterBrand !== "all" ||
    filterOrigin !== "all" ||
    showFavoritesOnly ||
    filterMaterial !== "all" ||
    filterPriceRange !== "all" ||
    filterMaxDb !== DEFAULT_LIBRARY_FILTER_MAX_DB;

  const brandOptionProducts = products.filter((product) => {
    if (filterOrigin === "all") return true;
    if (filterOrigin === "domestic") return product.isDomestic === true;
    return product.isDomestic === false;
  });

  const availableBrandOptions = Array.from(
    new Set(brandOptionProducts.map((product) => product.brand).filter(Boolean)),
  )
    .sort()
    .map((brand) => ({
      value: brand,
      label: brand,
    }));

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

  useEffect(() => {
    if (!selectedDetailProduct) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedDetailProduct(null);
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [selectedDetailProduct]);

  function handleBackToTop() {
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div
      ref={containerRef}
      className="female-mvp-library-page relative min-h-screen w-full overflow-hidden overflow-y-auto bg-[#fff7fb] px-4 py-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))] flex flex-col items-center justify-start text-slate-800 sm:px-6 sm:py-6 md:px-8"
    >
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(251,207,232,0.58),transparent_34%),radial-gradient(circle_at_84%_10%,rgba(186,230,253,0.62),transparent_32%),linear-gradient(165deg,#fff7fb_0%,#fdf2f8_42%,#eaf8ff_100%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-60 bg-[radial-gradient(circle_at_12%_18%,rgba(255,255,255,0.92)_0_1px,transparent_1.6px),radial-gradient(circle_at_78%_16%,rgba(125,211,252,0.5)_0_1px,transparent_1.6px),radial-gradient(circle_at_88%_72%,rgba(251,113,133,0.28)_0_1px,transparent_1.6px),radial-gradient(circle_at_34%_86%,rgba(255,255,255,0.8)_0_1px,transparent_1.6px)]" />

      <div className="relative z-10 w-full max-w-5xl pb-20 sm:pb-24">
        <button
          onClick={onBack}
          className="mt-2 mb-6 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/62 px-4 py-2 text-xs font-black tracking-[0.1em] text-sky-500 shadow-[0_0.75rem_1.8rem_rgba(125,211,252,0.12)] backdrop-blur-md transition-all hover:border-sky-200 hover:bg-white hover:text-sky-600"
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </button>

        <div className="female-mvp-library-hero mb-7 rounded-[1.55rem] border border-white/72 bg-white/58 px-5 py-5 shadow-[0_1.2rem_3rem_rgba(148,163,184,0.12)] backdrop-blur-xl sm:mb-8 sm:flex sm:items-end sm:justify-between sm:gap-5 sm:px-6 sm:py-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-sky-300">
              Luna Library
            </p>
            <h1 className="mt-2 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
              Luna 产品库
            </h1>
            <p className="mt-2 max-w-[28rem] text-sm leading-6 text-slate-500">
              按类型、品牌和预算慢慢筛选
            </p>
          </div>
          <button
            onClick={onReload}
            disabled={isLoading}
            className="mt-4 inline-flex items-center justify-center rounded-full border border-sky-200 bg-sky-50/82 px-4 py-2 text-[12px] font-black tracking-[0.12em] text-sky-600 shadow-[0_0.8rem_1.7rem_rgba(125,211,252,0.16)] transition-all hover:border-sky-300 hover:bg-white hover:text-sky-700 disabled:border-slate-200 disabled:bg-white/45 disabled:text-slate-400 sm:mt-0"
          >
            {isLoading ? "正在同步最新产品库..." : "同步最新产品库"}
          </button>
        </div>

        <div className="female-mvp-library-filter-panel relative z-20 rounded-[1.35rem] border border-white/70 bg-white/70 p-4 mb-8 shadow-[0_1.2rem_3.2rem_rgba(148,163,184,0.12)] backdrop-blur-xl sm:rounded-2xl sm:p-6 sm:mb-10">
          <div className="mb-4 flex flex-col gap-3 border-b border-sky-100/80 pb-4 sm:mb-5 sm:flex-row sm:items-center sm:justify-between sm:pb-5">
            <div>
              <h2 className="text-sm font-black tracking-[0.16em] text-slate-800">
                筛选条件
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                保留常用条件，慢慢缩小选择范围。
              </p>
            </div>
            <button
              type="button"
              disabled={!hasActiveFilters}
              onClick={() => {
                setIsAdvancedFiltersOpen(false);
                onResetFilters();
              }}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white/70 px-4 py-2 text-xs font-black tracking-[0.14em] text-slate-500 transition-all hover:border-sky-200 hover:bg-sky-50 hover:text-sky-600 disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-white/40 disabled:text-slate-300"
            >
              重置筛选
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <label className={libraryFilterLabelClassName}>
                类型
              </label>
              <LibraryFilterSelect
                value={effectiveFilterType}
                onChange={onFilterTypeChange}
                options={[
                  { value: "all", label: "全部类型" },
                  ...availableTypeCodes.map((typeCode) => ({
                    value: typeCode,
                    label: getLibraryTypeLabel(typeCode),
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

            {availableSubtypeCodes.length > 0 && (
              <div className="space-y-2">
                <label className={libraryFilterLabelClassName}>
                  类型细分
                </label>
                <LibraryFilterSelect
                  value={effectiveFilterSubtype}
                  onChange={onFilterSubtypeChange}
                  options={[
                    { value: "all", label: "全部细分" },
                    ...availableSubtypeCodes.map((subtypeCode) => ({
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
                <label className={libraryFilterLabelClassName}>
                  静音阈值
                </label>
                <span className="text-[10px] text-sky-500 font-mono font-black">
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
                className="w-full h-1 bg-sky-100 rounded-lg appearance-none cursor-pointer accent-sky-400"
              />
            </div>
          </div>

          <div className="mt-4 border-t border-sky-100/80 pt-4 sm:mt-5">
            <button
              type="button"
              onClick={() => setIsAdvancedFiltersOpen((isOpen) => !isOpen)}
              aria-expanded={isAdvancedFiltersOpen}
              className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-white/68 px-3 py-2 text-xs font-black text-slate-500 shadow-[0_0.55rem_1.2rem_rgba(148,163,184,0.08)] transition-colors hover:border-sky-200 hover:bg-sky-50 hover:text-sky-600"
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
                      ...availableBrandOptions,
                    ]}
                  />
                </div>

                <div className="space-y-2">
                  <label className={libraryFilterLabelClassName}>
                    收藏视图
                  </label>
                  <LibraryFilterSelect
                    value={showFavoritesOnly ? "favorites" : "all"}
                    onChange={(value) => onShowFavoritesOnlyChange(value === "favorites")}
                    options={[
                      { value: "all", label: "显示全部产品" },
                      { value: "favorites", label: "只看已收藏" },
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
          <div className="rounded-2xl border border-white/70 bg-white/70 p-10 text-center shadow-[0_1.2rem_3rem_rgba(148,163,184,0.12)] backdrop-blur-xl">
            <div className="text-sky-500 text-sm font-black tracking-[0.16em] mb-2">
              正在加载产品库
            </div>
            <div className="text-slate-400 text-xs">
              仅在首次进入页面或手动同步时请求数据库
            </div>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200/70 bg-white/72 p-10 text-center shadow-[0_1.2rem_3rem_rgba(244,114,182,0.1)] backdrop-blur-xl">
            <div className="text-rose-500 text-sm font-black tracking-[0.14em] mb-3">
              {error}
            </div>
            <button
              onClick={onReload}
              className="text-xs font-black text-sky-500 hover:text-sky-600 transition-colors"
            >
              重新尝试连接
            </button>
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-2xl border border-white/70 bg-white/70 p-10 text-center shadow-[0_1.2rem_3rem_rgba(148,163,184,0.12)] backdrop-blur-xl">
            <div className="text-slate-500 text-sm font-black tracking-[0.14em] mb-2">
              暂无装备数据
            </div>
            <button
              onClick={onReload}
              className="text-xs font-black text-sky-500 hover:text-sky-600 transition-colors"
            >
              同步装备库
            </button>
          </div>
        ) : (
          <div className="female-mvp-library-grid relative z-0 grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
            {products
            .filter((product) => {
              const resolvedProductTypeCode = resolveProductLibraryTypeCode(product);
              const resolvedProductSubtypeCode = resolveProductLibrarySubtypeCode(
                product,
                resolvedProductTypeCode,
              );
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
              const favoriteKey = product.originalId || product.id;
              const matchFavorite =
                !showFavoritesOnly || favoriteProductIds.has(favoriteKey);
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
                matchType &&
                matchSubtype &&
                matchBrand &&
                matchOrigin &&
                matchFavorite &&
                matchDb &&
                matchMaterial &&
                matchPrice
              );
            })
              .map((product) => {
              return (
                <div
                  key={product.id}
                  className={libraryProductCardClassName}
                >
                  <ProductCardContent
                    product={product}
                    isFavorited={favoriteProductIds.has(product.originalId || product.id)}
                    onToggleFavorite={onToggleFavorite}
                    onViewDetails={setSelectedDetailProduct}
                  />
                </div>
              );
              })}
          </div>
        )}
      </div>

      {selectedDetailProduct ? (
        <LibraryProductDetailModal
          product={selectedDetailProduct}
          onClose={() => setSelectedDetailProduct(null)}
        />
      ) : null}

      <button
        type="button"
        onClick={handleBackToTop}
        aria-label="回到顶部"
        className={`fixed bottom-4 right-4 z-30 inline-flex items-center gap-2 rounded-full border border-white/30 bg-slate-950/70 px-4 py-2 text-xs font-black text-white shadow-[0_1rem_2rem_rgba(15,23,42,0.18)] backdrop-blur-md transition-all duration-300 hover:border-sky-200/70 hover:bg-slate-900/78 sm:bottom-8 sm:right-8 ${
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
