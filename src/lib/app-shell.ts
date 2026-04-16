import { Product } from "../data/mock";

export type AppRoute = "/" | "/quiz" | "/results" | "/library";

export const APP_STATE_STORAGE_KEY = "inner-space-recommender-app-state-v1";
export const PRODUCTS_CACHE_STORAGE_KEY =
  "inner-space-recommender-products-cache-v1";

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

export function detectRoute(pathname: string): AppRoute {
  if (pathname === "/library") return "/library";
  if (pathname === "/results") return "/results";
  if (pathname === "/quiz") return "/quiz";
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

export type RankedProduct = Product & { score: number };
