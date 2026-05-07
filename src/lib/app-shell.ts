import { Product } from "../data/mock";
import { buildSafeDisplayName } from "./product-display-name.ts";
import {
  resolveLibraryAudienceGender,
  resolveLibrarySubtypeCode,
  resolveLibraryTypeCode,
} from "./library-product-type-classifier.ts";
import { getProductDisplayName } from "./product-display-name.ts";

export type AppRoute =
  | "/"
  | "/quiz"
  | "/results"
  | "/library"
  | "/knowledge"
  | "/profiles";

export const APP_STATE_STORAGE_KEY = "inner-space-recommender-app-state-v1";
export const PRODUCTS_CACHE_STORAGE_KEY =
  "inner-space-recommender-products-cache-v2";
const KNOWLEDGE_NEBULA_PATH_PATTERN = /^\/knowledge(?:\/|$)/;

type ProductsCachePayload = {
  updatedAt: number;
  products: Product[];
};

export const PRICE_RANGE_OPTIONS = [
  { value: "all", label: "全部价格" },
  { value: "under100", label: "100元以下" },
  { value: "100to300", label: "100-300元" },
  { value: "300to500", label: "300-500元" },
  { value: "500to1000", label: "500-1000元" },
  { value: "above1000", label: "1000元以上" },
] as const;

export function readJsonStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function readSessionJsonStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeSessionJsonStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
  window.sessionStorage.setItem(key, JSON.stringify(value));
}

export function readProductsCache(): Product[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PRODUCTS_CACHE_STORAGE_KEY);
    if (!raw) return [];
    return normalizeProductsPayload(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function normalizeProductsPayload(payload: unknown): Product[] {
  if (Array.isArray(payload)) {
    return payload.map((product) => {
      if (!product || typeof product !== "object") {
        return product as Product;
      }

      const typedProduct = product as Product;
      const canonicalName = typedProduct.canonicalName || typedProduct.name;
      const resolvedGender = resolveLibraryAudienceGender({
        gender: typedProduct.gender,
        physicalForm: typedProduct.physicalForm,
        name: canonicalName,
        rawDescription: typedProduct.rawDescription ?? null,
        tags: typedProduct.tags ?? [],
      });
      const resolvedTypeCode = resolveLibraryTypeCode(typedProduct.typeCode, {
        gender: resolvedGender,
        physicalForm: typedProduct.physicalForm,
        name: canonicalName,
        rawDescription: typedProduct.rawDescription ?? null,
        tags: typedProduct.tags ?? [],
      });
      const resolvedSubtypeCode = resolveLibrarySubtypeCode(
        typedProduct.subtypeCode,
        {
          typeCode: resolvedTypeCode,
          gender: resolvedGender,
          physicalForm: typedProduct.physicalForm,
          name: canonicalName,
          rawDescription: typedProduct.rawDescription ?? null,
          tags: typedProduct.tags ?? [],
        },
      );
      const safeDisplayName =
        typedProduct.safeDisplayName || buildSafeDisplayName(canonicalName);
      return {
        ...typedProduct,
        canonicalName,
        gender: resolvedGender,
        displayName: getProductDisplayName({
          name: canonicalName,
          safeDisplayName,
          displayName: typedProduct.displayName,
        }),
        typeCode: resolvedTypeCode,
        subtypeCode: resolvedSubtypeCode,
        safeDisplayName,
      };
    }) as Product[];
  }
  if (
    payload &&
    typeof payload === "object" &&
    Array.isArray((payload as ProductsCachePayload).products)
  ) {
    return normalizeProductsPayload((payload as ProductsCachePayload).products);
  }
  return [];
}

export function writeProductsCache(products: Product[]) {
  if (typeof window === "undefined" || products.length === 0) return;
  window.localStorage.setItem(
    PRODUCTS_CACHE_STORAGE_KEY,
    JSON.stringify({
      updatedAt: Date.now(),
      products,
    } satisfies ProductsCachePayload),
  );
}

export function detectRoute(pathname: string): AppRoute {
  if (KNOWLEDGE_NEBULA_PATH_PATTERN.test(pathname)) {
    return "/knowledge";
  }
  if (pathname === "/library") return "/library";
  if (pathname === "/profiles") return "/profiles";
  if (pathname === "/results") return "/results";
  if (pathname === "/quiz") return "/quiz";
  return "/";
}

export function resolveProfilesReturnRoute(
  originRoute: AppRoute | undefined,
): AppRoute {
  if (originRoute && originRoute !== "/profiles") {
    return originRoute;
  }
  return "/";
}

export function matchesPriceRange(price: number, range: string) {
  if (range === "all") return true;
  if (range === "under100") return price < 100;
  if (range === "100to300") return price >= 100 && price <= 300;
  if (range === "300to500") return price > 300 && price <= 500;
  if (range === "500to1000") return price > 500 && price <= 1000;
  if (range === "above1000") return price > 1000;
  return true;
}

export type RankedProduct = Product & {
  score: number;
  matchSummary?: string[];
  hardMisses?: number;
  budgetGap?: number;
  noiseGap?: number;
};
