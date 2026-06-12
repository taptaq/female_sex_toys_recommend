import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import pg from "pg";
import { chromium, type Browser, type BrowserContext, type Page, type Response } from "playwright";

import {
  buildRecommendationFeatureBackfillPayload,
  type RecommendationFeatureBackfillRow,
} from "./backfill-recommendation-product-features.ts";
import {
  classifyLibrarySubtypeCode,
  classifyLibraryTypeCode,
} from "../lib/library-product-type-classifier.ts";
import { buildSafeDisplayName } from "../lib/product-display-name.ts";
import { buildLovehoneyCookies } from "../scraper/lovehoney-official/cookies.ts";
import {
  resolveLovehoneyRuntimeConfig,
  shouldReuseCurrentInteractivePage,
  type LovehoneyRuntimeConfig,
} from "../scraper/lovehoney-official/runtime.ts";
import { resolveLovehoneySessionBootstrap } from "../scraper/lovehoney-official/session.ts";
import { ensureCompetitorRecord, type CompetitorRegistryConfig } from "../scraper/shared/competitor-registry.ts";

dotenv.config();

const { Pool } = pg;

export const LOVEHONEY_BRAND_NAME = "Lovehoney";
export const LOVEHONEY_WOMEN_LIST_URL =
  process.env.LOVEHONEY_OFFICIAL_LIST_URL || "https://www.lovehoney.co.uk/sex-toys/sex-toys-for-women/";
export const LOVEHONEY_REVIEW_BUFFER_PATH = "src/data/lovehoney-official-female-review-buffer.json";
export const LOVEHONEY_GBP_TO_CNY_RATE = Number(process.env.LOVEHONEY_GBP_CNY_RATE || "9.1200");
export const LOVEHONEY_USD_TO_CNY_RATE = Number(process.env.LOVEHONEY_USD_CNY_RATE || "7.1200");
export const LOVEHONEY_EUR_TO_CNY_RATE = Number(process.env.LOVEHONEY_EUR_CNY_RATE || "7.7600");
const LOVEHONEY_REFRESH_BATCH_SIZE = Number(process.env.LOVEHONEY_REFRESH_BATCH_SIZE || "35");
const LOVEHONEY_OFFICIAL_MAX_ITEMS = Number(process.env.LOVEHONEY_OFFICIAL_MAX_ITEMS || "240");
const LOVEHONEY_MAX_LOAD_MORE_CLICKS = Number(process.env.LOVEHONEY_MAX_LOAD_MORE_CLICKS || "80");
const LOVEHONEY_DETAIL_MODE = normalizeLower(process.env.LOVEHONEY_DETAIL_MODE || "detail");
const LOVEHONEY_CACHE_PROFILE_DIR =
  process.env.LOVEHONEY_CACHE_PROFILE_DIR || "src/data/lovehoney-real-chrome-profile/Default";
const LOVEHONEY_ORIGIN = "https://www.lovehoney.co.uk";

const LOVEHONEY_COMPETITOR_CONFIG: CompetitorRegistryConfig = {
  canonicalName: LOVEHONEY_BRAND_NAME,
  matchNames: ["lovehoney", "Lovehoney"],
  domain: "www.lovehoney.co.uk",
  country: "英国",
  description: "Lovehoney 是英国成人健康与情趣用品零售品牌，女性玩具线覆盖阴蒂刺激、G点入体、双刺激、魔杖、遥控穿戴和护理周边。",
  focus: "Unisex",
  philosophy: [
    "以多品牌零售和自有产品线覆盖从入门到进阶的愉悦探索场景。",
    "女性分类强调刺激部位、产品形态、材质安全、防水清洁和使用门槛。",
    "通过套装、遥控、双刺激和魔杖等细分路线帮助用户快速匹配偏好。",
  ],
  majorUserGroupProfile:
    "【核心人口】20-45 岁寻找女性向/伴侣共玩情趣用品的用户。\n【心理特征】关注刺激部位、易用性、材质安全、价格透明和是否适合新手。\n【核心痛点】希望快速区分阴蒂外部、G点入体、兔耳双刺激、穿戴遥控、魔杖按摩和护理周边等不同路线。",
  isDomestic: false,
};

type GenderHint = "female" | "unisex";
type CurrencyCode = "GBP" | "USD" | "EUR" | "CNY" | "UNKNOWN";

type LovehoneyListItem = {
  sourceUrl: string;
  name: string;
  subtitle?: string | null;
  coverImage?: string | null;
  genderHint: GenderHint;
  categoryHints: string[];
  price?: number | null;
  priceCurrency?: CurrencyCode | null;
  originalPrice?: number | null;
  originalPriceCurrency?: CurrencyCode | null;
  listPosition?: number | null;
};

type LovehoneySourceRow = {
  sourceUrl?: string | null;
  name?: string | null;
  safeDisplayName?: string | null;
  sku?: string | null;
  price?: number | string | null;
  priceCurrency?: CurrencyCode | string | null;
  originalPrice?: number | string | null;
  originalPriceCurrency?: CurrencyCode | string | null;
  image?: string | null;
  rawDescription?: string | null;
  genderHint?: string | null;
  categoryHints?: string[] | null;
  detailImageUrls?: string[] | null;
  specs?: Record<string, unknown> | null;
};

type LovehoneyFemaleRefreshPatch = {
  name: string;
  safeDisplayName: string;
  price: number;
  maxDb: number;
  waterproof: number;
  appearance: string;
  physicalForm: "external" | "internal" | "composite";
  motorType: "gentle" | "strong";
  gender: "female" | "unisex";
  brand: typeof LOVEHONEY_BRAND_NAME;
  material: string;
  link: string;
  imageUrl: string;
  rawDescription: string;
  typeCode: string;
  subtypeCode: string;
  productTags: string[];
  productSpecs: Record<string, unknown>;
  recommendationFeatures: Record<string, unknown>;
};

type ProductDetail = {
  title: string;
  subtitle: string;
  metaTitle: string;
  metaDescription: string;
  price: number | null;
  priceCurrency: CurrencyCode;
  originalPrice: number | null;
  originalPriceCurrency: CurrencyCode;
  featureHeadlines: string[];
  specPairs: Array<{ key: string; value: string }>;
  bodySummary: string;
  coverImage: string;
  imageUrls: string[];
  productCode: string;
};

type PageState = {
  title: string;
  bodyText: string;
  status: number | null;
  finalUrl: string;
  server: string;
};

type PgClientLike = {
  query: (sql: string, values?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
};

type PrismaLike = Parameters<typeof ensureCompetitorRecord>[0]["prisma"];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeLower(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function isTruthyFlag(value: unknown) {
  return ["1", "true", "yes", "on"].includes(normalizeLower(value));
}

function normalizeInline(value: unknown) {
  return normalizeText(value)
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeBlock(value: unknown) {
  return normalizeText(value)
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function normalizeNonEmpty(value: unknown, fallback: string) {
  const normalized = normalizeText(value);
  return normalized || fallback;
}

function decodeHtml(value: unknown) {
  return normalizeText(value)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;|&mdash;/gi, "-")
    .replace(/&trade;|™/gi, "™")
    .replace(/&reg;|®/gi, "®")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripTags(value: unknown) {
  return decodeHtml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueStrings(values: Array<unknown>, limit = 80) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeInline(value);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= limit) break;
  }
  return result;
}

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function normalizeProductUrl(href: unknown, baseUrl = LOVEHONEY_WOMEN_LIST_URL) {
  const trimmed = normalizeText(href);
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed, baseUrl);
    url.protocol = "https:";
    url.host = "www.lovehoney.co.uk";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function normalizeCacheProductUrl(href: unknown, baseUrl = LOVEHONEY_WOMEN_LIST_URL) {
  const normalized = normalizeProductUrl(href, baseUrl);
  if (!normalized) return "";
  try {
    const url = new URL(normalized);
    url.search = "";
    url.hash = "";
    if (!/\/p\/[^/]+\/a\d+g\d+\.html$/i.test(url.pathname)) return "";
    if (/male-sex-toys|for-him/i.test(url.pathname)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function nameFromLovehoneyUrl(url: string) {
  const slug = normalizeText(url.match(/\/p\/([^/]+)\/a\d+g\d+\.html/i)?.[1] || "");
  if (!slug) return "Lovehoney 未命名商品";
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => (part.length <= 2 ? part.toUpperCase() : `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`))
    .join(" ")
    .replace(/\bG Spot\b/g, "G-Spot")
    .replace(/\bRom p\b/g, "ROMP")
    .replace(/\bBasics\b/g, "BASICS")
    .trim();
}

function walkCacheFiles(dir: string, files: string[] = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkCacheFiles(target, files);
      continue;
    }
    try {
      const stat = fs.statSync(target);
      if (stat.size > 0 && stat.size <= 80 * 1024 * 1024) files.push(target);
    } catch {
      // Browser cache files can disappear while Chrome is open.
    }
  }
  return files;
}

export function extractLovehoneyCachedListItemsFromProfile(profileDir = LOVEHONEY_CACHE_PROFILE_DIR) {
  const productUrlPattern =
    /https:\/\/www\.lovehoney\.co\.uk\/sex-toys\/[\x20-\x7E]{0,220}?\/p\/[\x20-\x7E]{1,220}?\/a\d+g\d+\.html/g;
  const productWithNamePattern =
    /(https:\/\/www\.lovehoney\.co\.uk\/sex-toys\/[\s\S]{0,220}?\/p\/[\s\S]{1,220}?\/a\d+g\d+\.html)[\s\S]{0,220}?([A-Z][A-Za-z0-9 xX'’.,&+\-()]+(?:Vibrator|Dildo|Stimulator|Plug|Kit|Wand|Massager|Egg|Bullet|Harness|Douche|Beads|Exerciser|Shorts|Attachment|Set))/g;
  const records = new Map<string, { sourceUrl: string; names: Set<string> }>();

  for (const file of walkCacheFiles(path.resolve(profileDir))) {
    let buffer: Buffer;
    try {
      buffer = fs.readFileSync(file);
    } catch {
      continue;
    }
    for (const encoding of ["utf8", "latin1", "utf16le"] as const) {
      const text = buffer.toString(encoding);
      for (const match of text.matchAll(productUrlPattern)) {
        const sourceUrl = normalizeCacheProductUrl(match[0].replace(/[\u0000\s]+/g, ""));
        if (!sourceUrl) continue;
        records.set(sourceUrl, records.get(sourceUrl) ?? { sourceUrl, names: new Set<string>() });
      }
      for (const match of text.matchAll(productWithNamePattern)) {
        const sourceUrl = normalizeCacheProductUrl(match[1].replace(/[\u0000\s]+/g, ""));
        if (!sourceUrl) continue;
        const record = records.get(sourceUrl) ?? { sourceUrl, names: new Set<string>() };
        const name = normalizeInline(match[2]);
        if (name) record.names.add(name);
        records.set(sourceUrl, record);
      }
    }
  }

  return Array.from(records.values())
    .map((record, index) => ({
      sourceUrl: record.sourceUrl,
      name: Array.from(record.names)[0] || nameFromLovehoneyUrl(record.sourceUrl),
      subtitle: "",
      coverImage: "",
      genderHint: "female" as const,
      categoryHints: ["sex-toys-for-women", "Lovehoney women list", record.sourceUrl],
      price: null,
      priceCurrency: "GBP" as const,
      originalPrice: null,
      originalPriceCurrency: "UNKNOWN" as const,
      listPosition: index + 1,
    }))
    .filter((item) => item.sourceUrl && item.name)
    .slice(0, LOVEHONEY_OFFICIAL_MAX_ITEMS);
}

function normalizeImageUrl(value: unknown) {
  const normalized = normalizeText(Array.isArray(value) ? value[0] : value);
  if (!normalized) return "";
  if (normalized.startsWith("//")) return `https:${normalized}`;
  if (normalized.startsWith("/")) return `${LOVEHONEY_ORIGIN}${normalized}`;
  return normalized;
}

function shouldSkipDetailUrl(url: string) {
  const normalized = normalizeProductUrl(url);
  return !normalized.startsWith(LOVEHONEY_ORIGIN) || !/\/p\//i.test(normalized);
}

function parseCurrencyCode(text: unknown): CurrencyCode {
  const value = normalizeText(text);
  if (value.includes("£") || /\bgbp\b/i.test(value)) return "GBP";
  if (value.includes("$") || /\busd\b/i.test(value)) return "USD";
  if (value.includes("€") || /\beur\b/i.test(value)) return "EUR";
  if (/\bcny\b|¥|￥/i.test(value)) return "CNY";
  return "UNKNOWN";
}

function parsePositiveNumber(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/,/g, "").replace(/[^\d.]+/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseMoney(value: unknown): { amount: number | null; currency: CurrencyCode } {
  return {
    amount: parsePositiveNumber(value),
    currency: parseCurrencyCode(value),
  };
}

function normalizePositivePrice(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 1;
}

function isBlockedPage(title: string, bodyText: string) {
  const joined = `${title}\n${bodyText}`.toLowerCase();
  return (
    joined.includes("blocked request") ||
    joined.includes("technical difficulties with our website") ||
    joined.includes("reference number:") ||
    joined.includes("access denied") ||
    joined.includes("akamai") ||
    joined.includes("host: www.lovehoney.co.uk")
  );
}

function buildTrustedSource(row: LovehoneySourceRow) {
  const hints = Array.isArray(row.categoryHints) ? row.categoryHints.join(" ") : "";
  const rawDescription = normalizeText(row.rawDescription);
  const rawLead = rawDescription.split(/\n\[规格参数\]|\n\[英文正文摘录\]/u, 1)[0] || rawDescription.slice(0, 1800);
  return `${row.name ?? ""}\n${row.sourceUrl ?? ""}\n${hints}\n${rawLead}`.toLowerCase();
}

function isObviousMaleOnly(row: LovehoneySourceRow) {
  const source = buildTrustedSource(row);
  if (
    /male masturbator|for men|penis pump|prostate|stroker|masturbation sleeve|fleshlight|pocket pussy|cock ring|penis ring|male sex toy|男性|男用|前列腺|阴茎环|陰莖環/.test(
      source,
    )
  ) {
    return !/sex-toys-for-women|for women|vaginal|g-?spot|clitoral|rabbit|bullet|wand|dildo|female|女性|阴蒂|陰蒂/.test(
      source,
    );
  }
  return false;
}

export function shouldKeepLovehoneyFemaleSourceRow(row: LovehoneySourceRow) {
  const source = buildTrustedSource(row);
  const femaleSignal =
    normalizeLower(row.genderHint) === "female" ||
    /sex-toys-for-women|for women|female|woman|women|clitoral|g-?spot|vaginal|rabbit|bullet|wand|dildo|suction|strapless|panty|wearable|女性|阴蒂|陰蒂|g点|g 點/.test(
      source,
    );
  return Boolean(femaleSignal && normalizeText(row.name) && normalizeText(row.sourceUrl) && !isObviousMaleOnly(row));
}

function resolveTypePatch(row: LovehoneySourceRow) {
  const source = buildTrustedSource(row);
  const classifierTags = Array.isArray(row.categoryHints) ? row.categoryHints : [];
  const classifiedTypeCode = classifyLibraryTypeCode({
    gender: "female",
    physicalForm: /rabbit|dual|g-?spot.{0,16}clit|clit.{0,16}g-?spot/.test(source)
      ? "composite"
      : /dildo|g-?spot|vaginal|insertable|beads|egg|plug/.test(source)
        ? "internal"
        : "external",
    name: row.name,
    rawDescription: row.rawDescription,
    tags: classifierTags,
  });
  const classifiedSubtypeCode = classifyLibrarySubtypeCode({
    gender: "female",
    physicalForm: /rabbit|dual|g-?spot.{0,16}clit|clit.{0,16}g-?spot/.test(source) ? "composite" : undefined,
    name: row.name,
    rawDescription: row.rawDescription,
    tags: classifierTags,
    typeCode: classifiedTypeCode,
  });

  if (/condom|dental dam/.test(source)) return { typeCode: "care_accessory", subtypeCode: "condom", maxDb: 0, waterproof: 0 };
  if (/lingerie|stockings|basque|bodysuit|babydoll|knickers|briefs|thong/.test(source)) {
    return { typeCode: "care_accessory", subtypeCode: "lingerie", maxDb: 0, waterproof: 0 };
  }
  if (/lube|lubricant|cleaner|toy cleaner|massage oil|arousal gel|moisturiser|moisturizer|wipe/.test(source) && !/vibrator|wand|rabbit|dildo|suction/.test(source)) {
    return { typeCode: "care_accessory", subtypeCode: "lube_care", maxDb: 0, waterproof: 0 };
  }
  if (/bondage|restraint|cuffs|blindfold|paddle|whip|flogger|nipple clamp|collar|leash|gag/.test(source)) {
    if (/nipple/.test(source)) return { typeCode: "bdsm", subtypeCode: "nipple_play", maxDb: 0, waterproof: 0 };
    if (/paddle|whip|flogger|crop/.test(source)) return { typeCode: "bdsm", subtypeCode: "impact_play", maxDb: 0, waterproof: 0 };
    if (/blindfold|tickler|feather|sensory/.test(source)) return { typeCode: "bdsm", subtypeCode: "sensory_play", maxDb: 0, waterproof: 0 };
    if (/gag|mask/.test(source)) return { typeCode: "bdsm", subtypeCode: "gag_mask", maxDb: 0, waterproof: 0 };
    if (/collar|leash/.test(source)) return { typeCode: "bdsm", subtypeCode: "collar_leash", maxDb: 0, waterproof: 0 };
    return { typeCode: "bdsm", subtypeCode: "bondage_restraint", maxDb: 0, waterproof: 0 };
  }
  if (/suction|air pulse|pressure wave|womanizer|rose|clitoral stimulator|clit suction/.test(source) && /rabbit|g-?spot|dual|insertable|internal/.test(source)) {
    return { typeCode: "dual_stimulation", subtypeCode: "suction_dual", maxDb: 55, waterproof: 7 };
  }
  if (/rabbit|dual stimulation|dual vibrator|g-?spot.{0,16}clit|clit.{0,16}g-?spot/.test(source)) {
    return { typeCode: "dual_stimulation", subtypeCode: "rabbit_dual", maxDb: 55, waterproof: 7 };
  }
  if (/suction|air pulse|pressure wave|rose|clitoral stimulator|clit suction/.test(source)) {
    return { typeCode: "suction", subtypeCode: "suction_pure", maxDb: 50, waterproof: 7 };
  }
  if (/remote|wearable|panty|knicker|app controlled|app-controlled|wireless|lovense|we-vibe|couples vibrator/.test(source)) {
    if (/panty|knicker|underwear/.test(source)) return { typeCode: "wearable_remote", subtypeCode: "panty_wearable", maxDb: 50, waterproof: 7 };
    return { typeCode: "wearable_remote", subtypeCode: "insertable_remote", maxDb: 50, waterproof: 7 };
  }
  if (/wand|massager|magic wand|body massager/.test(source)) {
    return { typeCode: "external_vibe", subtypeCode: "wand_massager", maxDb: 60, waterproof: 5 };
  }
  if (/dildo|g-?spot|vaginal|insertable|glass dildo|realistic dildo|strapless|ben wa|kegel|beads|butt plug|anal plug/.test(source)) {
    if (/vibrat|bullet|motor|powered/.test(source)) {
      return { typeCode: "insertable", subtypeCode: "insertable_vibe", maxDb: 50, waterproof: 7 };
    }
    return { typeCode: "insertable", subtypeCode: "gspot_insertable", maxDb: 0, waterproof: 7 };
  }
  if (classifiedTypeCode && classifiedTypeCode !== "unknown" && classifiedSubtypeCode) {
    return {
      typeCode: classifiedTypeCode,
      subtypeCode: classifiedSubtypeCode,
      maxDb: classifiedTypeCode === "care_accessory" || classifiedTypeCode === "bdsm" ? 0 : 50,
      waterproof: classifiedTypeCode === "care_accessory" || classifiedTypeCode === "bdsm" ? 0 : 7,
    };
  }
  return { typeCode: "external_vibe", subtypeCode: "bullet_vibe", maxDb: 50, waterproof: 7 };
}

function normalizePhysicalForm(typeCode: string, subtypeCode: string, source: string): "external" | "internal" | "composite" {
  if (typeCode === "dual_stimulation" || subtypeCode === "rabbit_dual" || subtypeCode === "suction_dual") return "composite";
  if (typeCode === "insertable" || typeCode === "wearable_remote" || /dildo|g-?spot|vaginal|insertable|beads|plug/.test(source)) return "internal";
  return "external";
}

function normalizeMotorType(source: string, typeCode: string): "gentle" | "strong" {
  if (typeCode === "care_accessory" || typeCode === "bdsm") return "gentle";
  return /wand|powerful|extra powerful|deep rumbly|mains powered|mega|turbo|strong|intense/.test(source) ? "strong" : "gentle";
}

function normalizeAppearance(source: string) {
  return /lipstick|mini|bullet|egg|panty|wearable|discreet|pocket|travel|rose/.test(source) ? "high_disguise" : "normal";
}

function inferGender(row: LovehoneySourceRow, typeCode: string): "female" | "unisex" {
  const source = buildTrustedSource(row);
  if (typeCode === "bdsm" || typeCode === "care_accessory" || /couples|partner|strap-on|strap on/.test(source)) return "unisex";
  return "female";
}

function inferMaterial(row: LovehoneySourceRow, typeCode: string) {
  const direct = row.specs?.material;
  if (normalizeText(direct)) return normalizeText(direct);
  const source = buildTrustedSource(row);
  if (/silicone/.test(source)) return "亲肤硅胶";
  if (/glass/.test(source)) return "硼硅玻璃";
  if (/stainless steel|metal/.test(source)) return "不锈钢/金属";
  if (/abs|plastic/.test(source)) return "ABS/亲肤硅胶";
  if (/latex|rubber/.test(source)) return "乳胶/橡胶";
  if (/leather|faux leather|pu/.test(source)) return "皮革/PU";
  if (typeCode === "care_accessory") return "身体安全护理材质";
  if (typeCode === "bdsm") return "身体安全配件材质";
  return "亲肤硅胶";
}

function inferTagsFromText(row: LovehoneySourceRow) {
  const source = buildTrustedSource(row);
  const tags: string[] = [];
  const push = (tag: string, pattern: RegExp) => {
    if (pattern.test(source) && !tags.includes(tag)) tags.push(tag);
  };

  push("吮吸刺激", /suction|air pulse|pressure wave|rose|吸吮|吮吸/);
  push("阴蒂刺激", /clit|clitoral|rose|bullet|wand|阴蒂|陰蒂/);
  push("G点刺激", /g-?spot|g 点|g点/);
  push("兔耳双刺激", /rabbit|dual stimulation|兔耳|双刺激/);
  push("入体探索", /dildo|vaginal|insertable|beads|butt plug|anal plug|入体/);
  push("魔杖按摩", /wand|massager|魔杖|按摩棒/);
  push("遥控", /remote|wireless|遥控/);
  push("APP支持", /app controlled|app-controlled|bluetooth|lovense|we-vibe|app/);
  push("穿戴", /wearable|panty|knicker|穿戴/);
  push("情侣共玩", /couples|partner|strap-on|strap on|情侣|情侶/);
  push("新手友好", /beginner|starter|first vibrator|newbie|入门|新手/);
  push("防水", /waterproof|submersible|防水/);
  push("可充电", /rechargeable|usb|charging|充电|充電/);
  push("护理周边", /lube|cleaner|condom|lingerie|lubricant|护理/);
  push("BDSM", /bondage|restraint|cuffs|blindfold|paddle|whip|nipple clamp|bdsm/);

  return tags;
}

function currencyToCnyRate(currency: unknown) {
  const code = normalizeText(currency).toUpperCase();
  if (code === "CNY") return 1;
  if (code === "USD") return LOVEHONEY_USD_TO_CNY_RATE;
  if (code === "EUR") return LOVEHONEY_EUR_TO_CNY_RATE;
  return LOVEHONEY_GBP_TO_CNY_RATE;
}

function normalizeRmbPrice(row: LovehoneySourceRow) {
  const sourceAmount = parsePositiveNumber(row.price ?? row.specs?.price_source_amount) ?? 1;
  const currency = normalizeText(row.priceCurrency || row.specs?.price_source_currency || "GBP").toUpperCase();
  const rate = Number(row.specs?.[`fx_rate_${currency.toLowerCase()}_cny`] ?? currencyToCnyRate(currency));
  return normalizePositivePrice(sourceAmount * rate);
}

function buildRecommendationFeaturesForPatch(patch: Omit<LovehoneyFemaleRefreshPatch, "recommendationFeatures">) {
  const payload = buildRecommendationFeatureBackfillPayload({
    id: "00000000-0000-0000-0000-000000000000",
    original_id: null,
    name: patch.name,
    safe_display_name: patch.safeDisplayName,
    price: patch.price,
    max_db: patch.maxDb,
    waterproof: patch.waterproof,
    appearance: patch.appearance,
    physical_form: patch.physicalForm,
    motor_type: patch.motorType,
    gender: patch.gender,
    brand: patch.brand,
    material: patch.material,
    image_url: patch.imageUrl,
    raw_description: patch.rawDescription,
    type_code: patch.typeCode,
    subtype_code: patch.subtypeCode,
    product_tags: patch.productTags,
    product_raw_description: patch.rawDescription,
  } satisfies RecommendationFeatureBackfillRow);

  const evidence = payload.features.evidence.length > 0
    ? payload.features.evidence
    : [
        {
          signal: "material" as const,
          polarity: "positive" as const,
          text: "Lovehoney 官方资料已补充为身体安全/亲肤材质",
          source: "structured" as const,
        },
      ];

  return {
    featureVersion: payload.featureVersion,
    ...payload.features,
    evidence,
  };
}

export function buildLovehoneyFemaleRefreshPatch(row: LovehoneySourceRow): LovehoneyFemaleRefreshPatch {
  const name = normalizeNonEmpty(row.name, "Lovehoney 未命名商品");
  const source = buildTrustedSource(row);
  const typePatch = resolveTypePatch(row);
  const typeCode = normalizeNonEmpty(row.specs?.type_code, typePatch.typeCode);
  const subtypeCode = normalizeNonEmpty(row.specs?.subtype_code, typePatch.subtypeCode);
  const productTags = inferTagsFromText(row);
  const rawDescription = normalizeNonEmpty(
    row.rawDescription,
    `[基础信息]\n商品名: ${name}\n站内分类提示: sex-toys-for-women\n性别提示: female\n[卖点摘要]\nLovehoney 官方女性商品，来自 ${LOVEHONEY_WOMEN_LIST_URL}。`,
  );

  const patchWithoutFeatures = {
    name,
    safeDisplayName: normalizeNonEmpty(row.safeDisplayName, buildSafeDisplayName(name)),
    price: normalizeRmbPrice(row),
    maxDb: Number(row.specs?.max_db ?? typePatch.maxDb),
    waterproof: Number(row.specs?.waterproof ?? typePatch.waterproof),
    appearance: normalizeNonEmpty(row.specs?.appearance, normalizeAppearance(source)),
    physicalForm: normalizePhysicalForm(typeCode, subtypeCode, source),
    motorType: normalizeMotorType(source, typeCode),
    gender: inferGender(row, typeCode),
    brand: LOVEHONEY_BRAND_NAME,
    material: inferMaterial(row, typeCode),
    link: normalizeNonEmpty(row.sourceUrl, LOVEHONEY_WOMEN_LIST_URL),
    imageUrl: normalizeNonEmpty(row.image ?? row.detailImageUrls?.[0], "/assets/product-placeholder/bullet_vibe.png"),
    rawDescription,
    typeCode,
    subtypeCode,
    productTags: productTags.length > 0 ? productTags : ["女性友好"],
    productSpecs: {
      ...(row.specs ?? {}),
      rawDescription,
      sourceUrl: normalizeNonEmpty(row.sourceUrl, LOVEHONEY_WOMEN_LIST_URL),
      officialListUrl: LOVEHONEY_WOMEN_LIST_URL,
      officialCleanedAt: new Date().toISOString(),
    },
  } satisfies Omit<LovehoneyFemaleRefreshPatch, "recommendationFeatures">;

  return {
    ...patchWithoutFeatures,
    recommendationFeatures: buildRecommendationFeaturesForPatch(patchWithoutFeatures),
  };
}

export function extractLovehoneyWomenListItemsFromHtml(html: string, listUrl = LOVEHONEY_WOMEN_LIST_URL) {
  const seen = new Set<string>();
  const items: LovehoneyListItem[] = [];
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']*\/p\/[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const sourceUrl = normalizeProductUrl(decodeHtml(match[1]), listUrl);
    if (!sourceUrl || seen.has(sourceUrl)) continue;
    const label =
      decodeHtml(match[0].match(/\baria-label=["']([^"']+)["']/i)?.[1] ?? "") ||
      decodeHtml(match[0].match(/\btitle=["']([^"']+)["']/i)?.[1] ?? "") ||
      stripTags(match[2]);
    const name = normalizeInline(label).replace(/\s*£\s*\d.*$/u, "");
    if (!name) continue;
    seen.add(sourceUrl);
    items.push({
      sourceUrl,
      name,
      genderHint: "female",
      categoryHints: ["sex-toys-for-women", "Lovehoney women list"],
      listPosition: items.length + 1,
    });
  }
  return items;
}

async function createContext() {
  const runtime = resolveLovehoneyRuntimeConfig(process.env);
  const sessionBootstrap = resolveLovehoneySessionBootstrap(process.env);
  const contextOptions = {
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 2200 },
    locale: "en-GB" as const,
    ...(sessionBootstrap.storageStatePath ? { storageState: sessionBootstrap.storageStatePath } : {}),
    extraHTTPHeaders: {
      "accept-language": "en-GB,en;q=0.9",
    },
  };

  let browser: Browser | null = null;
  let context: BrowserContext;

  if (runtime.mode === "cdp") {
    console.log(`[refresh-lovehoney-female-products-from-official] 连接本机 Chrome: ${runtime.cdpEndpoint}`);
    browser = await chromium.connectOverCDP(runtime.cdpEndpoint);
    const existingContext = browser.contexts()[0];
    if (!existingContext) throw new Error(`CDP 已连接，但未找到可复用的浏览器上下文: ${runtime.cdpEndpoint}`);
    context = existingContext;
  } else if (runtime.mode === "interactive") {
    if (!fs.existsSync(runtime.persistentProfileDir)) fs.mkdirSync(runtime.persistentProfileDir, { recursive: true });
    context = await chromium.launchPersistentContext(runtime.persistentProfileDir, {
      channel: "chrome",
      headless: false,
      args: ["--no-sandbox"],
      ignoreDefaultArgs: ["--enable-automation"],
      ...contextOptions,
    });
  } else {
    browser = await chromium.launch({
      headless: true,
      args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
      ignoreDefaultArgs: ["--enable-automation"],
    });
    context = await browser.newContext(contextOptions);
  }

  if (sessionBootstrap.source === "cookie") {
    const cookies = buildLovehoneyCookies(sessionBootstrap.cookieHeader, [".lovehoney.co.uk", "www.lovehoney.co.uk"]);
    if (cookies.length > 0) await context.addCookies(cookies);
  }

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  return {
    context,
    runtime,
    cleanup: async () => {
      if (runtime.mode !== "cdp") await context.close();
      if (browser && runtime.mode !== "cdp") await browser.close();
    },
  };
}

async function getOrCreatePage(context: BrowserContext) {
  const existingPage =
    context.pages().find((candidate) => candidate.url().includes("lovehoney.co.uk") && !candidate.isClosed()) ||
    context.pages()[0];
  if (existingPage) {
    await existingPage.bringToFront().catch(() => {});
    return existingPage;
  }
  return context.newPage();
}

async function gotoAndSettle(page: Page, url: string, waitMs = 4500): Promise<Response | null> {
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(waitMs);
  return response;
}

async function inspectPageState(page: Page, response?: Response | null): Promise<PageState> {
  const payload = await page.evaluate(() => ({
    title: String(document.title || "").trim(),
    bodyText: String(document.body?.innerText || "").trim(),
  }));
  return {
    title: normalizeBlock(payload.title),
    bodyText: normalizeBlock(payload.bodyText),
    status: response?.status() ?? null,
    finalUrl: page.url(),
    server: response?.headers()["server"] || "",
  };
}

async function tryOpenListPage(page: Page, runtime: LovehoneyRuntimeConfig) {
  const reuseCurrentPage = shouldReuseCurrentInteractivePage(runtime.interactive, page.url(), LOVEHONEY_WOMEN_LIST_URL);
  const response = reuseCurrentPage ? null : await gotoAndSettle(page, LOVEHONEY_WOMEN_LIST_URL, 5500);
  await dismissCookieConsent(page);
  await page.mouse.wheel(0, 1200).catch(() => {});
  await page.waitForTimeout(1200);
  const state = await inspectPageState(page, response);
  return {
    blocked: isBlockedPage(state.title, state.bodyText),
    state,
  };
}

async function dismissCookieConsent(page: Page) {
  const selectors = [
    "#onetrust-accept-btn-handler",
    "#onetrust-reject-all-handler",
    "button:has-text('Accept All')",
    "button:has-text('Accept all')",
    "button:has-text('Reject All')",
    "button:has-text('Reject all')",
    ".onetrust-close-btn-handler",
    "#close-pc-btn-handler",
  ];

  for (const selector of selectors) {
    const button = page.locator(selector).first();
    const visible = await button.isVisible().catch(() => false);
    if (!visible) continue;
    await button.click({ timeout: 3000 }).catch(async () => {
      await button.evaluate((node) => (node as HTMLElement).click()).catch(() => {});
    });
    await page.waitForTimeout(800);
    break;
  }

  await page.evaluate(() => {
    for (const selector of ["#onetrust-consent-sdk", ".onetrust-pc-dark-filter"]) {
      document.querySelectorAll(selector).forEach((node) => {
        (node as HTMLElement).style.pointerEvents = "none";
        (node as HTMLElement).style.display = "none";
      });
    }
  }).catch(() => {});
}

async function extractListItemsFromPage(page: Page, pageOffset: number): Promise<LovehoneyListItem[]> {
  const payload = await page.evaluate(
    ({ origin, pageOffset: offset }) => {
      const normalize = (value: unknown) => String(value || "").replace(/\s+/g, " ").trim();
      const resolveUrl = (value: unknown) => {
        try {
          return new URL(String(value || "").trim(), origin).toString();
        } catch {
          return "";
        }
      };
      const parseCardPrice = (cardText: string) => {
        const lines = cardText
          .split(/(?=£|\$|€)/)
          .map((line) => normalize(line))
          .filter(Boolean);
        return lines.find((line) => /[£$€]\s*\d/.test(line)) || "";
      };
      const pickCard = (anchor: HTMLAnchorElement) =>
        anchor.closest("article") ||
        anchor.closest("li") ||
        anchor.closest("[data-testid]") ||
        anchor.closest(".product-tile") ||
        anchor.parentElement;

      const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"));
      const seen = new Set<string>();
      const rows: Array<Record<string, unknown>> = [];
      for (const anchor of anchors) {
        const href = resolveUrl(anchor.getAttribute("href") || anchor.href || "");
        if (!href || !/\/p\//.test(href) || seen.has(href)) continue;
        seen.add(href);
        const card = pickCard(anchor);
        const cardText = normalize(card?.textContent || anchor.textContent || "");
        const title =
          normalize(anchor.getAttribute("aria-label")) ||
          normalize(anchor.getAttribute("title")) ||
          normalize(anchor.querySelector("img")?.getAttribute("alt")) ||
          normalize(anchor.textContent);
        if (!title || /reviews?|stars?|quick view/i.test(title)) continue;
        const image = card?.querySelector("img") || anchor.querySelector("img");
        const imageUrl = normalize(
          image?.getAttribute("src") ||
            image?.getAttribute("data-src") ||
            image?.getAttribute("srcset")?.split(",")[0]?.trim().split(/\s+/)[0] ||
            "",
        );
        const priceText = parseCardPrice(cardText);
        const categoryHints = cardText
          .split(/\n|(?=£|\$|€)/)
          .map((line) => normalize(line))
          .filter(Boolean)
          .filter((line) => line !== title && !/[£$€]\s*\d/.test(line))
          .slice(0, 8);
        rows.push({
          sourceUrl: href,
          name: title,
          subtitle: categoryHints[0] || "",
          coverImage: imageUrl,
          categoryHints,
          priceText,
          listPosition: offset + rows.length + 1,
        });
      }
      return rows;
    },
    { origin: LOVEHONEY_ORIGIN, pageOffset },
  );

  return (Array.isArray(payload) ? payload : [])
    .map((row) => {
      const money = parseMoney(row.priceText);
      return {
        sourceUrl: normalizeProductUrl(row.sourceUrl),
        name: normalizeInline(row.name),
        subtitle: normalizeInline(row.subtitle),
        coverImage: normalizeImageUrl(row.coverImage),
        genderHint: "female" as const,
        categoryHints: uniqueStrings(["sex-toys-for-women", "Lovehoney women list", ...(Array.isArray(row.categoryHints) ? row.categoryHints : [])], 10),
        price: money.amount,
        priceCurrency: money.currency,
        originalPrice: null,
        originalPriceCurrency: "UNKNOWN" as const,
        listPosition: parsePositiveNumber(row.listPosition),
      };
    })
    .filter((item) => item.name && item.sourceUrl && !shouldSkipDetailUrl(item.sourceUrl));
}

async function clickLoadMore(page: Page) {
  await dismissCookieConsent(page);
  const selectors = [
    ".infinite--actions .btn-secondary",
    "button.btn-secondary",
    "a.btn-secondary",
    "[class*='btn-secondary']",
  ];

  for (const selector of selectors) {
    const candidates = page.locator(selector);
    const count = await candidates.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const candidate = candidates.nth(index);
      const text = normalizeInline(await candidate.textContent().catch(() => ""));
      const visible = await candidate.isVisible().catch(() => false);
      const enabled = await candidate.isEnabled().catch(() => false);
      if (!visible || !enabled) continue;
      if (!/load more|show more|view more|more|加载|更多/i.test(text) && !selector.includes("infinite--actions")) continue;
      await candidate.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(300);
      await candidate.click({ timeout: 15000 }).catch(async () => {
        await dismissCookieConsent(page);
        await candidate.evaluate((node) => (node as HTMLElement).click()).catch(() => {});
      });
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(1800);
      return true;
    }
  }

  return false;
}

async function extractNextPageUrl(page: Page) {
  const payload = await page.evaluate(() => {
    const nextLink = document.querySelector<HTMLAnchorElement>('a[rel="next"], a.pagination-next, a[aria-label="Next"]');
    return String(nextLink?.getAttribute("href") || nextLink?.href || "").trim();
  });
  return normalizeProductUrl(payload);
}

async function collectWomenListItems(page: Page, runtime: LovehoneyRuntimeConfig) {
  console.log(`[refresh-lovehoney-female-products-from-official] 进入女性列表: ${LOVEHONEY_WOMEN_LIST_URL}`);
  const { blocked, state } = await tryOpenListPage(page, runtime);
  if (blocked) {
    throw new Error(
      `Lovehoney 列表页被拦截: title=${state.title || "N/A"} status=${state.status ?? "null"} finalUrl=${state.finalUrl}`,
    );
  }

  const seen = new Set<string>();
  const results: LovehoneyListItem[] = [];
  let stagnantClicks = 0;

  for (let clickIndex = 0; clickIndex <= LOVEHONEY_MAX_LOAD_MORE_CLICKS && results.length < LOVEHONEY_OFFICIAL_MAX_ITEMS; clickIndex += 1) {
    await page.mouse.wheel(0, 1800).catch(() => {});
    await page.waitForTimeout(900);
    const pageItems = await extractListItemsFromPage(page, results.length);
    const previousCount = results.length;
    for (const item of pageItems) {
      if (seen.has(item.sourceUrl)) continue;
      seen.add(item.sourceUrl);
      results.push({ ...item, listPosition: results.length + 1 });
      if (results.length >= LOVEHONEY_OFFICIAL_MAX_ITEMS) break;
    }
    console.log(`[refresh-lovehoney-female-products-from-official] 列表累计 ${results.length} 条候选商品`);
    if (results.length >= LOVEHONEY_OFFICIAL_MAX_ITEMS) break;

    const clicked = await clickLoadMore(page);
    if (clicked) {
      stagnantClicks = results.length === previousCount ? stagnantClicks + 1 : 0;
      if (stagnantClicks >= 3) break;
      continue;
    }

    const nextUrl = await extractNextPageUrl(page);
    if (!nextUrl || nextUrl === page.url()) break;
    await gotoAndSettle(page, nextUrl, 3500);
  }

  return results.slice(0, LOVEHONEY_OFFICIAL_MAX_ITEMS);
}

async function extractDetail(page: Page, fallback: LovehoneyListItem): Promise<ProductDetail | null> {
  const state = await inspectPageState(page);
  if (isBlockedPage(state.title, state.bodyText)) {
    console.warn(`[refresh-lovehoney-female-products-from-official] 详情页被拦截: ${fallback.sourceUrl}`);
    return null;
  }

  const payload = await page.evaluate(() => {
    const normalize = (value: unknown) => String(value || "").replace(/\s+/g, " ").trim();
    const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));
    const lines = String(document.body?.innerText || "")
      .split("\n")
      .map((line) => normalize(line))
      .filter(Boolean);
    const images = unique(
      Array.from(document.querySelectorAll<HTMLImageElement>("img"))
        .map((img) =>
          normalize(
            img.getAttribute("src") ||
              img.getAttribute("data-src") ||
              img.getAttribute("srcset")?.split(",")[0]?.trim().split(/\s+/)[0] ||
              "",
          ),
        )
        .filter(Boolean),
    );
    const title =
      normalize(document.querySelector("h1")?.textContent) ||
      normalize(document.querySelector('[data-testid="product-title"]')?.textContent);
    const metaDescription = normalize(document.querySelector('meta[name="description"]')?.getAttribute("content"));
    const headings = Array.from(document.querySelectorAll("h2, h3"))
      .map((node) => normalize(node.textContent))
      .filter(Boolean);
    const priceLines = lines.filter((line) => /[£$€]\s*\d/.test(line)).slice(0, 8);
    const specPairs: Array<{ key: string; value: string }> = [];
    for (const node of Array.from(document.querySelectorAll("table tr, dl, .specifications li, .product-specifications li, [data-testid*='spec'] li"))) {
      const text = normalize(node.textContent);
      if (!text) continue;
      if (text.includes(":")) {
        const [key, ...rest] = text.split(":");
        const value = normalize(rest.join(":"));
        if (key && value) specPairs.push({ key: normalize(key), value });
      }
    }
    return {
      title,
      metaTitle: normalize(document.title),
      metaDescription,
      lines,
      bodyText: lines.join("\n"),
      priceLines,
      headings,
      specPairs,
      images,
    };
  });

  const title = normalizeInline(payload.title || fallback.name);
  if (!title) return null;

  const primaryMoney = parseMoney(payload.priceLines?.[0] || "");
  const originalMoney = parseMoney(payload.priceLines?.[1] || "");
  const imageUrls = uniqueStrings((payload.images || []).map(normalizeImageUrl), 30);
  const productCode =
    normalizeInline(payload.bodyText.match(/\b(?:sku|product code|item code)\b[:\s#-]*([a-z0-9-]+)/i)?.[1] || "") ||
    normalizeInline(payload.bodyText.match(/\b[a-z]\d{4,}g\d+\b/i)?.[0] || "");

  return {
    title,
    subtitle: uniqueStrings(payload.headings || [], 4).join(" | "),
    metaTitle: normalizeInline(payload.metaTitle || ""),
    metaDescription: normalizeInline(payload.metaDescription || ""),
    price: fallback.price ?? primaryMoney.amount ?? null,
    priceCurrency: fallback.priceCurrency && fallback.priceCurrency !== "UNKNOWN"
      ? fallback.priceCurrency
      : primaryMoney.currency !== "UNKNOWN"
        ? primaryMoney.currency
        : "GBP",
    originalPrice: originalMoney.amount ?? fallback.originalPrice ?? null,
    originalPriceCurrency: originalMoney.currency !== "UNKNOWN" ? originalMoney.currency : fallback.originalPriceCurrency || "UNKNOWN",
    featureHeadlines: uniqueStrings(payload.headings || [], 10),
    specPairs: Array.isArray(payload.specPairs)
      ? payload.specPairs.map((pair) => ({ key: normalizeInline(pair.key), value: normalizeInline(pair.value) })).filter((pair) => pair.key && pair.value)
      : [],
    bodySummary: normalizeBlock(payload.bodyText).slice(0, 14000),
    coverImage: fallback.coverImage || imageUrls[0] || "",
    imageUrls,
    productCode,
  };
}

function buildRawDescription(item: LovehoneyListItem, detail: ProductDetail) {
  return [
    "[基础信息]",
    `商品名: ${detail.title || item.name}`,
    detail.subtitle ? `副标题: ${detail.subtitle}` : "",
    detail.metaTitle ? `页面标题: ${detail.metaTitle}` : "",
    detail.metaDescription ? `页面描述: ${detail.metaDescription}` : "",
    detail.price ? `页面价格(${detail.priceCurrency}): ${detail.price}` : "",
    detail.originalPrice ? `划线价格(${detail.originalPriceCurrency}): ${detail.originalPrice}` : "",
    "站内分类提示: sex-toys-for-women | Lovehoney women list",
    "性别提示: female",
    /app controlled|app-controlled|bluetooth|app/i.test(`${detail.metaDescription}\n${detail.bodySummary}`) ? "APP支持: Yes" : "APP支持: No",
    detail.productCode ? `产品代码: ${detail.productCode}` : "",
    "",
    detail.specPairs.length ? "[规格参数]" : "",
    ...detail.specPairs.map((pair) => `${pair.key}: ${pair.value}`),
    "",
    detail.featureHeadlines.length ? "[卖点摘要]" : "",
    ...detail.featureHeadlines,
    "",
    detail.bodySummary ? "[英文正文摘录]" : "",
    detail.bodySummary,
    "",
    `[来源链接] ${item.sourceUrl}`,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 18000)
    .trim();
}

function buildSourceRow(item: LovehoneyListItem, detail: ProductDetail): LovehoneySourceRow {
  const rawDescription = buildRawDescription(item, detail);
  const sourceUrl = normalizeProductUrl(item.sourceUrl);
  const priceCurrency = detail.priceCurrency !== "UNKNOWN" ? detail.priceCurrency : item.priceCurrency || "GBP";
  const price = detail.price ?? item.price ?? 1;
  const sourceRow: LovehoneySourceRow = {
    sourceUrl,
    name: detail.title || item.name,
    safeDisplayName: buildSafeDisplayName(detail.title || item.name),
    sku: detail.productCode,
    price,
    priceCurrency,
    originalPrice: detail.originalPrice,
    originalPriceCurrency: detail.originalPriceCurrency,
    image: detail.coverImage || item.coverImage || detail.imageUrls[0] || "",
    rawDescription,
    genderHint: "female",
    categoryHints: uniqueStrings(["sex-toys-for-women", "Lovehoney women list", ...item.categoryHints, ...detail.featureHeadlines], 16),
    detailImageUrls: uniqueStrings([detail.coverImage, ...detail.imageUrls], 30),
  };
  const typePatch = resolveTypePatch(sourceRow);
  sourceRow.specs = {
    sku: detail.productCode || null,
    official_category: "sex-toys-for-women",
    function_tags: inferTagsFromText(sourceRow),
    gender: "female",
    material: inferMaterial(sourceRow, typePatch.typeCode),
    type_code: typePatch.typeCode,
    subtype_code: typePatch.subtypeCode,
    max_db: typePatch.maxDb,
    waterproof: typePatch.waterproof,
    appearance: normalizeAppearance(buildTrustedSource(sourceRow)),
    motor_type: normalizeMotorType(buildTrustedSource(sourceRow), typePatch.typeCode),
    physical_form: normalizePhysicalForm(typePatch.typeCode, typePatch.subtypeCode, buildTrustedSource(sourceRow)),
    price_source_currency: priceCurrency,
    price_source_amount: price,
    fx_rate_gbp_cny: LOVEHONEY_GBP_TO_CNY_RATE,
    fx_rate_usd_cny: LOVEHONEY_USD_TO_CNY_RATE,
    fx_rate_eur_cny: LOVEHONEY_EUR_TO_CNY_RATE,
    [`fx_rate_${normalizeText(priceCurrency).toLowerCase()}_cny`]: currencyToCnyRate(priceCurrency),
    fx_rate_source: "fallback_env",
    fx_rate_date: "2026-06-11",
    price_rmb: normalizePositivePrice(Number(price) * currencyToCnyRate(priceCurrency)),
  };
  return sourceRow;
}

function buildFallbackDetailFromListItem(item: LovehoneyListItem): ProductDetail {
  const categoryText = item.categoryHints.join(" | ");
  const bodySummary = [
    `${item.name} is listed in Lovehoney's sex toys for women collection.`,
    categoryText ? `List-card context: ${categoryText}.` : "",
    item.price ? `Observed list price: ${item.priceCurrency || "GBP"} ${item.price}.` : "",
    "Detail page was unavailable during this refresh, so structured fields are inferred from the official list card and product URL.",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    title: item.name,
    subtitle: normalizeInline(item.subtitle || ""),
    metaTitle: item.name,
    metaDescription: `${item.name} on Lovehoney sex toys for women collection.`,
    price: item.price ?? null,
    priceCurrency: item.priceCurrency || "GBP",
    originalPrice: item.originalPrice ?? null,
    originalPriceCurrency: item.originalPriceCurrency || "UNKNOWN",
    featureHeadlines: uniqueStrings([item.subtitle, ...item.categoryHints], 10),
    specPairs: [
      { key: "Official list category", value: "sex-toys-for-women" },
      { key: "Detail source", value: "Lovehoney list card fallback" },
    ],
    bodySummary,
    coverImage: item.coverImage || "",
    imageUrls: uniqueStrings([item.coverImage], 10),
    productCode: normalizeInline(item.sourceUrl.match(/\/(a\d+g\d+)\.html/i)?.[1] || ""),
  };
}

function persistBuffer(rows: LovehoneySourceRow[]) {
  ensureDir(LOVEHONEY_REVIEW_BUFFER_PATH);
  fs.writeFileSync(LOVEHONEY_REVIEW_BUFFER_PATH, `${JSON.stringify(rows, null, 2)}\n`);
}

export async function fetchLovehoneyOfficialSourceRows() {
  const bundle = await createContext();
  const page = await getOrCreatePage(bundle.context);
  const rows: LovehoneySourceRow[] = [];
  persistBuffer(rows);

  try {
    const listItems = await collectWomenListItems(page, bundle.runtime);
    console.log(`[refresh-lovehoney-female-products-from-official] 去重后候选商品数: ${listItems.length}`);

    if (LOVEHONEY_DETAIL_MODE === "list" || LOVEHONEY_DETAIL_MODE === "fallback") {
      rows.push(...listItems.map((item) => buildSourceRow(item, buildFallbackDetailFromListItem(item))));
      persistBuffer(rows);
      console.log(`[refresh-lovehoney-female-products-from-official] 已使用列表 fallback 生成 ${rows.length} 条记录`);
      return rows;
    }

    for (let index = 0; index < listItems.length; index += 1) {
      const item = listItems[index];
      console.log(`[refresh-lovehoney-female-products-from-official] 详情 ${index + 1}/${listItems.length}: ${item.name}`);
      try {
        await gotoAndSettle(page, item.sourceUrl, 4200);
        const detail = await extractDetail(page, item);
        const row = buildSourceRow(item, detail ?? buildFallbackDetailFromListItem(item));
        rows.push(row);
        persistBuffer(rows);
        if (!detail) {
          console.warn(`[refresh-lovehoney-female-products-from-official] 使用列表 fallback 补齐: ${item.sourceUrl}`);
        }
        await sleep(350);
      } catch (error) {
        console.error(`[refresh-lovehoney-female-products-from-official] 详情失败: ${item.sourceUrl}`, error);
        rows.push(buildSourceRow(item, buildFallbackDetailFromListItem(item)));
        persistBuffer(rows);
      }
    }
  } finally {
    await bundle.cleanup();
  }

  return rows;
}

async function ensureLovehoneyCompetitor(client: PgClientLike) {
  const prismaLike = {
    competitors: {
      findFirst: async (args: any) => {
        const names = args?.where?.OR?.flatMap((entry: any) => {
          const nameFilter = entry?.name;
          const value = typeof nameFilter === "object" ? nameFilter?.contains : nameFilter;
          return value ? [value] : [];
        }) ?? [LOVEHONEY_BRAND_NAME];
        const result = await client.query(
          `
            SELECT id, name, domain, country, founded_date, description, focus,
                   philosophy, major_user_group_profile, is_domestic
            FROM public.competitors
            WHERE lower(name) = ANY($1::text[])
               OR lower(coalesce(name, '')) LIKE ANY($2::text[])
            LIMIT 1
          `,
          [
            names.map((name: unknown) => normalizeText(name).toLowerCase()),
            names.map((name: unknown) => `%${normalizeText(name).toLowerCase()}%`),
          ],
        );
        return result.rows[0] ?? null;
      },
      create: async (args: any) => {
        const data = args.data ?? {};
        const result = await client.query(
          `
            INSERT INTO public.competitors (
              name, domain, country, founded_date, description, focus, philosophy,
              major_user_group_profile, is_domestic
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7::text[], $8, $9)
            RETURNING id, name, domain, country, founded_date, description, focus,
                      philosophy, major_user_group_profile, is_domestic
          `,
          [
            data.name,
            data.domain,
            data.country,
            data.founded_date,
            data.description,
            data.focus,
            data.philosophy ?? [],
            data.major_user_group_profile,
            data.is_domestic,
          ],
        );
        return result.rows[0];
      },
      update: async (args: any) => {
        const data = args.data ?? {};
        const result = await client.query(
          `
            UPDATE public.competitors
            SET domain = COALESCE($2, domain),
                country = COALESCE($3, country),
                founded_date = COALESCE($4, founded_date),
                description = COALESCE($5, description),
                focus = COALESCE($6, focus),
                philosophy = CASE WHEN cardinality($7::text[]) > 0 THEN $7::text[] ELSE philosophy END,
                major_user_group_profile = COALESCE($8, major_user_group_profile),
                is_domestic = COALESCE($9, is_domestic)
            WHERE id = $1::uuid
            RETURNING id, name, domain, country, founded_date, description, focus,
                      philosophy, major_user_group_profile, is_domestic
          `,
          [
            args.where.id,
            data.domain,
            data.country,
            data.founded_date,
            data.description,
            data.focus,
            data.philosophy ?? [],
            data.major_user_group_profile,
            data.is_domestic,
          ],
        );
        return result.rows[0];
      },
    },
  } satisfies PrismaLike;

  return await ensureCompetitorRecord({
    prisma: prismaLike,
    withDbRetry: async (_label, action) => await action(),
    brandName: LOVEHONEY_BRAND_NAME,
    overrideConfig: LOVEHONEY_COMPETITOR_CONFIG,
  });
}

async function upsertProductAndFemaleToy(
  client: PgClientLike,
  patch: LovehoneyFemaleRefreshPatch,
  competitorId: string | null,
) {
  const existingProduct = await client.query(
    `
      SELECT id
      FROM public.products
      WHERE lower(name) = lower($1)
        AND (competitor_id = $2::uuid OR $2::uuid IS NULL OR lower(coalesce(link, '')) = lower($3))
      ORDER BY
        CASE WHEN lower(coalesce(link, '')) = lower($3) THEN 0 ELSE 1 END,
        created_at DESC NULLS LAST
      LIMIT 1
    `,
    [patch.name, competitorId, patch.link],
  );

  const productResult = existingProduct.rows[0]?.id
    ? await client.query(
        `
          UPDATE public.products
          SET competitor_id = $2::uuid,
              price = $3,
              category = 'female_toy',
              tags = $4::text[],
              link = $5,
              image = $6,
              gender = CASE WHEN $7 = 'female' THEN 'Female' ELSE 'Unisex' END,
              specs = $8::jsonb
          WHERE id = $1::uuid
          RETURNING id
        `,
        [
          existingProduct.rows[0].id,
          competitorId,
          patch.price,
          patch.productTags,
          patch.link,
          patch.imageUrl,
          patch.gender,
          JSON.stringify(patch.productSpecs),
        ],
      )
    : await client.query(
        `
          INSERT INTO public.products (
            competitor_id, name, price, category, tags, link, image, gender, specs
          )
          VALUES (
            $1::uuid, $2, $3, 'female_toy', $4::text[], $5, $6,
            CASE WHEN $7 = 'female' THEN 'Female' ELSE 'Unisex' END,
            $8::jsonb
          )
          RETURNING id
        `,
        [
          competitorId,
          patch.name,
          patch.price,
          patch.productTags,
          patch.link,
          patch.imageUrl,
          patch.gender,
          JSON.stringify(patch.productSpecs),
        ],
      );

  const productId = productResult.rows[0]?.id;
  if (!productId) throw new Error(`products upsert failed: ${patch.name}`);

  const existingFemaleToy = await client.query(
    `
      SELECT id
      FROM public.female_recommender_toys
      WHERE lower(brand) = lower($3)
        AND (
          original_id = $1::uuid
          OR lower(coalesce(link, '')) = lower($2)
          OR lower(name) = lower($4)
        )
      ORDER BY
        CASE
          WHEN original_id = $1::uuid THEN 0
          WHEN lower(coalesce(link, '')) = lower($2) THEN 1
          ELSE 2
        END,
        updated_at DESC NULLS LAST,
        created_at DESC NULLS LAST
      LIMIT 1
    `,
    [productId, patch.link, patch.brand, patch.name],
  );

  const values = [
    productId,
    patch.name,
    patch.safeDisplayName,
    patch.price,
    patch.maxDb,
    patch.waterproof,
    patch.appearance,
    patch.physicalForm,
    patch.motorType,
    patch.gender,
    patch.brand,
    patch.material,
    patch.link,
    patch.imageUrl,
    patch.rawDescription,
    patch.typeCode,
    patch.subtypeCode,
    JSON.stringify(patch.recommendationFeatures),
  ];

  if (existingFemaleToy.rows[0]?.id) {
    await client.query(
      `
        UPDATE public.female_recommender_toys
        SET original_id = $1::uuid,
            name = $2,
            safe_display_name = $3,
            price = $4,
            max_db = $5,
            waterproof = $6,
            appearance = $7,
            physical_form = $8,
            motor_type = $9,
            gender = $10,
            brand = $11,
            material = $12,
            link = $13,
            image_url = $14,
            raw_description = $15,
            type_code = $16,
            subtype_code = $17,
            recommendation_features = $18::jsonb,
            updated_at = NOW()
        WHERE id = $19::uuid
      `,
      [...values, existingFemaleToy.rows[0].id],
    );
    return;
  }

  await client.query(
    `
      INSERT INTO public.female_recommender_toys (
        original_id, name, safe_display_name, price, max_db, waterproof,
        appearance, physical_form, motor_type, gender, brand, material, link,
        image_url, raw_description, type_code, subtype_code, recommendation_features
      )
      VALUES (
        $1::uuid, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18::jsonb
      )
    `,
    values,
  );
}

async function ensureProductForLovehoneyPatch(
  client: PgClientLike,
  patch: LovehoneyFemaleRefreshPatch,
  competitorId: string | null,
) {
  const existingProduct = await client.query(
    `
      SELECT id
      FROM public.products
      WHERE lower(name) = lower($1)
        AND (competitor_id = $2::uuid OR $2::uuid IS NULL OR lower(coalesce(link, '')) = lower($3))
      ORDER BY
        CASE WHEN lower(coalesce(link, '')) = lower($3) THEN 0 ELSE 1 END,
        created_at DESC NULLS LAST
      LIMIT 1
    `,
    [patch.name, competitorId, patch.link],
  );

  const result = existingProduct.rows[0]?.id
    ? await client.query(
        `
          UPDATE public.products
          SET competitor_id = $2::uuid,
              price = $3,
              category = 'female_toy',
              tags = $4::text[],
              link = $5,
              image = $6,
              gender = CASE WHEN $7 = 'female' THEN 'Female' ELSE 'Unisex' END,
              specs = $8::jsonb
          WHERE id = $1::uuid
          RETURNING id
        `,
        [
          existingProduct.rows[0].id,
          competitorId,
          patch.price,
          patch.productTags,
          patch.link,
          patch.imageUrl,
          patch.gender,
          JSON.stringify(patch.productSpecs),
        ],
      )
    : await client.query(
        `
          INSERT INTO public.products (
            competitor_id, name, price, category, tags, link, image, gender, specs
          )
          VALUES (
            $1::uuid, $2, $3, 'female_toy', $4::text[], $5, $6,
            CASE WHEN $7 = 'female' THEN 'Female' ELSE 'Unisex' END,
            $8::jsonb
          )
          RETURNING id
        `,
        [
          competitorId,
          patch.name,
          patch.price,
          patch.productTags,
          patch.link,
          patch.imageUrl,
          patch.gender,
          JSON.stringify(patch.productSpecs),
        ],
      );

  const productId = result.rows[0]?.id;
  if (!productId) throw new Error(`products backfill failed: ${patch.name}`);
  return productId as string;
}

async function backfillIncompleteLovehoneyRows(
  client: PgClientLike,
  competitorId: string | null,
) {
  const incomplete = await client.query(
    `
      SELECT id, original_id, name, safe_display_name, price, brand, material, link,
             image_url, raw_description, type_code, subtype_code, recommendation_features
      FROM public.female_recommender_toys
      WHERE lower(brand) = lower($1)
        AND (
          original_id IS NULL
          OR NULLIF(BTRIM(COALESCE(name, '')), '') IS NULL
          OR NULLIF(BTRIM(COALESCE(safe_display_name, '')), '') IS NULL
          OR price IS NULL
          OR max_db IS NULL
          OR waterproof IS NULL
          OR NULLIF(BTRIM(COALESCE(appearance, '')), '') IS NULL
          OR NULLIF(BTRIM(COALESCE(physical_form, '')), '') IS NULL
          OR NULLIF(BTRIM(COALESCE(motor_type, '')), '') IS NULL
          OR NULLIF(BTRIM(COALESCE(gender, '')), '') IS NULL
          OR NULLIF(BTRIM(COALESCE(brand, '')), '') IS NULL
          OR NULLIF(BTRIM(COALESCE(material, '')), '') IS NULL
          OR NULLIF(BTRIM(COALESCE(link, '')), '') IS NULL
          OR NULLIF(BTRIM(COALESCE(image_url, '')), '') IS NULL
          OR NULLIF(BTRIM(COALESCE(raw_description, '')), '') IS NULL
          OR NULLIF(BTRIM(COALESCE(type_code, '')), '') IS NULL
          OR NULLIF(BTRIM(COALESCE(subtype_code, '')), '') IS NULL
          OR recommendation_features IS NULL
          OR jsonb_array_length(coalesce(recommendation_features->'evidence', '[]'::jsonb)) = 0
        )
    `,
    [LOVEHONEY_BRAND_NAME],
  );

  if (incomplete.rows.length === 0) return 0;

  for (const row of incomplete.rows) {
    const name = normalizeNonEmpty(row.name ?? row.safe_display_name, "Lovehoney 未命名商品");
    const link = normalizeNonEmpty(row.link, `${LOVEHONEY_WOMEN_LIST_URL}#${row.id}`);
    const sourceRow: LovehoneySourceRow = {
      sourceUrl: link,
      name,
      safeDisplayName: normalizeNonEmpty(row.safe_display_name, buildSafeDisplayName(name)),
      price: row.price ?? 1,
      priceCurrency: "GBP",
      image: normalizeNonEmpty(row.image_url, "/assets/product-placeholder/bullet_vibe.png"),
      rawDescription: normalizeNonEmpty(
        row.raw_description,
        `[基础信息]\n商品名: ${name}\n站内分类提示: sex-toys-for-women | Lovehoney women list\n性别提示: female\n[卖点摘要]\nLovehoney 官方女性商品记录，字段由清洗兜底流程补齐。\n[来源链接] ${link}`,
      ),
      genderHint: "female",
      categoryHints: ["sex-toys-for-women", "Lovehoney women list", link],
      specs: {
        type_code: normalizeText(row.type_code) || undefined,
        subtype_code: normalizeText(row.subtype_code) || undefined,
        material: normalizeText(row.material) || undefined,
      },
    };
    const patch = buildLovehoneyFemaleRefreshPatch(sourceRow);
    const productId = row.original_id ?? (await ensureProductForLovehoneyPatch(client, patch, competitorId));

    await client.query(
      `
        UPDATE public.female_recommender_toys
        SET original_id = $1::uuid,
            name = $2,
            safe_display_name = $3,
            price = $4,
            max_db = $5,
            waterproof = $6,
            appearance = $7,
            physical_form = $8,
            motor_type = $9,
            gender = $10,
            brand = $11,
            material = $12,
            link = $13,
            image_url = $14,
            raw_description = $15,
            type_code = $16,
            subtype_code = $17,
            recommendation_features = $18::jsonb,
            updated_at = NOW()
        WHERE id = $19::uuid
      `,
      [
        productId,
        patch.name,
        patch.safeDisplayName,
        patch.price,
        patch.maxDb,
        patch.waterproof,
        patch.appearance,
        patch.physicalForm,
        patch.motorType,
        patch.gender,
        patch.brand,
        patch.material,
        patch.link,
        patch.imageUrl,
        patch.rawDescription,
        patch.typeCode,
        patch.subtypeCode,
        JSON.stringify(patch.recommendationFeatures),
        row.id,
      ],
    );
  }

  console.log(`[refresh-lovehoney-female-products-from-official] 已兜底修复不完整行 ${incomplete.rows.length} 条`);
  return incomplete.rows.length;
}

export function shouldRunLovehoneyFemaleRefreshScript(importMetaUrl: string, argvEntry?: string) {
  return Boolean(argvEntry && importMetaUrl === pathToFileURL(argvEntry).href);
}

async function loadLovehoneySourceRows() {
  const sourceMode = normalizeLower(process.env.LOVEHONEY_REFRESH_SOURCE || "live");
  if (sourceMode === "buffer") {
    return {
      sourceMode,
      rows: JSON.parse(fs.readFileSync(LOVEHONEY_REVIEW_BUFFER_PATH, "utf8")) as LovehoneySourceRow[],
    };
  }
  if (sourceMode === "cache") {
    const listItems = extractLovehoneyCachedListItemsFromProfile();
    const rows = listItems.map((item) => buildSourceRow(item, buildFallbackDetailFromListItem(item)));
    persistBuffer(rows);
    console.log(`[refresh-lovehoney-female-products-from-official] 已从本地 Chrome 缓存生成 ${rows.length} 条记录`);
    return {
      sourceMode,
      rows,
    };
  }
  return {
    sourceMode,
    rows: await fetchLovehoneyOfficialSourceRows(),
  };
}

async function runLovehoneyFemaleProductsRefreshAttempt() {
  const { sourceMode, rows } = await loadLovehoneySourceRows();
  let patches = rows.filter(shouldKeepLovehoneyFemaleSourceRow).map(buildLovehoneyFemaleRefreshPatch);
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  let client: pg.PoolClient | null = null;

  try {
    let lastConnectError: unknown;
    for (let attempt = 1; attempt <= 8; attempt += 1) {
      try {
        client = await pool.connect();
        break;
      } catch (error) {
        lastConnectError = error;
        await sleep(1000 * attempt);
      }
    }
    if (!client) throw lastConnectError;
    client.on("error", (error) => {
      console.warn("[refresh-lovehoney-female-products-from-official] 数据库连接 error event:", error);
    });

    await client.query("SET statement_timeout TO 0");
    await client.query("SET lock_timeout TO '5s'");

    const competitorId = await ensureLovehoneyCompetitor(client);
    const refreshMode = normalizeLower(process.env.LOVEHONEY_REFRESH_MODE || "incremental");
    if (isTruthyFlag(process.env.LOVEHONEY_BACKFILL_INCOMPLETE_ONLY)) {
      patches = [];
      console.log("[refresh-lovehoney-female-products-from-official] 跳过商品 upsert，仅执行不完整行兜底修复");
    }
    if (isTruthyFlag(process.env.LOVEHONEY_ONLY_INCOMPLETE)) {
      const incompleteLinks = await client.query(
        `
          SELECT lower(coalesce(link, '')) AS link
          FROM public.female_recommender_toys
          WHERE lower(brand) = lower($1)
            AND lower(coalesce(link, '')) = ANY($2::text[])
            AND (
              original_id IS NULL
              OR NULLIF(BTRIM(COALESCE(name, '')), '') IS NULL
              OR NULLIF(BTRIM(COALESCE(safe_display_name, '')), '') IS NULL
              OR price IS NULL
              OR max_db IS NULL
              OR waterproof IS NULL
              OR NULLIF(BTRIM(COALESCE(appearance, '')), '') IS NULL
              OR NULLIF(BTRIM(COALESCE(physical_form, '')), '') IS NULL
              OR NULLIF(BTRIM(COALESCE(motor_type, '')), '') IS NULL
              OR NULLIF(BTRIM(COALESCE(gender, '')), '') IS NULL
              OR NULLIF(BTRIM(COALESCE(brand, '')), '') IS NULL
              OR NULLIF(BTRIM(COALESCE(material, '')), '') IS NULL
              OR NULLIF(BTRIM(COALESCE(link, '')), '') IS NULL
              OR NULLIF(BTRIM(COALESCE(image_url, '')), '') IS NULL
              OR NULLIF(BTRIM(COALESCE(raw_description, '')), '') IS NULL
              OR NULLIF(BTRIM(COALESCE(type_code, '')), '') IS NULL
              OR NULLIF(BTRIM(COALESCE(subtype_code, '')), '') IS NULL
              OR recommendation_features IS NULL
              OR jsonb_array_length(coalesce(recommendation_features->'evidence', '[]'::jsonb)) = 0
            )
        `,
        [LOVEHONEY_BRAND_NAME, patches.map((patch) => patch.link.toLowerCase())],
      );
      const incompleteLinkSet = new Set(incompleteLinks.rows.map((row) => normalizeLower(row.link)));
      patches = patches.filter((patch) => incompleteLinkSet.has(patch.link.toLowerCase()));
      console.log(`[refresh-lovehoney-female-products-from-official] 只覆盖不完整链接，待处理 ${patches.length} 条`);
    }

    if (isTruthyFlag(process.env.LOVEHONEY_SKIP_EXISTING_LINKS)) {
      const existingLinks = await client.query(
        `
          SELECT lower(coalesce(link, '')) AS link
          FROM public.female_recommender_toys
          WHERE lower(brand) = lower($1)
            AND lower(coalesce(link, '')) = ANY($2::text[])
        `,
        [LOVEHONEY_BRAND_NAME, patches.map((patch) => patch.link.toLowerCase())],
      );
      const existingLinkSet = new Set(existingLinks.rows.map((row) => normalizeLower(row.link)));
      patches = patches.filter((patch) => !existingLinkSet.has(patch.link.toLowerCase()));
      console.log(`[refresh-lovehoney-female-products-from-official] 已跳过现有链接，待新增/覆盖 ${patches.length} 条`);
    }
    if (refreshMode === "replace") {
      await client.query("BEGIN");
      await client.query("DELETE FROM public.female_recommender_toys WHERE lower(brand) = lower($1)", [LOVEHONEY_BRAND_NAME]);
      await client.query("COMMIT");
    }

    for (let index = 0; index < patches.length; index += LOVEHONEY_REFRESH_BATCH_SIZE) {
      const batch = patches.slice(index, index + LOVEHONEY_REFRESH_BATCH_SIZE);
      await client.query("BEGIN");
      try {
        for (const patch of batch) {
          await upsertProductAndFemaleToy(client, patch, competitorId);
        }
        await client.query("COMMIT");
        console.log(
          `[refresh-lovehoney-female-products-from-official] 已提交 ${Math.min(index + batch.length, patches.length)}/${patches.length}`,
        );
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      }
    }

    await backfillIncompleteLovehoneyRows(client, competitorId);

    const audit = await client.query(
      `
        SELECT
          COUNT(*)::int AS rows,
          COUNT(*) FILTER (
            WHERE original_id IS NULL
               OR NULLIF(BTRIM(COALESCE(name, '')), '') IS NULL
               OR NULLIF(BTRIM(COALESCE(safe_display_name, '')), '') IS NULL
               OR price IS NULL
               OR max_db IS NULL
               OR waterproof IS NULL
               OR NULLIF(BTRIM(COALESCE(appearance, '')), '') IS NULL
               OR NULLIF(BTRIM(COALESCE(physical_form, '')), '') IS NULL
               OR NULLIF(BTRIM(COALESCE(motor_type, '')), '') IS NULL
               OR NULLIF(BTRIM(COALESCE(gender, '')), '') IS NULL
               OR NULLIF(BTRIM(COALESCE(brand, '')), '') IS NULL
               OR NULLIF(BTRIM(COALESCE(material, '')), '') IS NULL
               OR NULLIF(BTRIM(COALESCE(link, '')), '') IS NULL
               OR NULLIF(BTRIM(COALESCE(image_url, '')), '') IS NULL
               OR NULLIF(BTRIM(COALESCE(raw_description, '')), '') IS NULL
               OR NULLIF(BTRIM(COALESCE(type_code, '')), '') IS NULL
               OR NULLIF(BTRIM(COALESCE(subtype_code, '')), '') IS NULL
               OR recommendation_features IS NULL
          )::int AS rows_with_missing_fields,
          COUNT(*) FILTER (
            WHERE jsonb_array_length(coalesce(recommendation_features->'evidence', '[]'::jsonb)) = 0
          )::int AS rows_with_empty_evidence
        FROM public.female_recommender_toys
        WHERE lower(brand) = lower($1)
      `,
      [LOVEHONEY_BRAND_NAME],
    );

    console.log(
      JSON.stringify(
        {
          brand: LOVEHONEY_BRAND_NAME,
          source: LOVEHONEY_WOMEN_LIST_URL,
          sourceMode,
          refreshMode,
          inputRows: rows.length,
          refreshed: patches.length,
          ...audit.rows[0],
        },
        null,
        2,
      ),
    );
  } finally {
    client?.release();
    await pool.end().catch(() => {});
  }
}

async function runLovehoneyFemaleProductsRefresh() {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await runLovehoneyFemaleProductsRefreshAttempt();
      return;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!/Connection terminated|ECONNRESET|server closed the connection|terminating connection|Can't reach database|P1001|P1017/i.test(message) || attempt === 3) {
        break;
      }
      console.warn(`[refresh-lovehoney-female-products-from-official] 遇到瞬断，重试 ${attempt}/3...`, error);
      await sleep(1500 * attempt);
    }
  }
  throw lastError;
}

if (shouldRunLovehoneyFemaleRefreshScript(import.meta.url, process.argv[1])) {
  runLovehoneyFemaleProductsRefresh().catch((error) => {
    console.error("[refresh-lovehoney-female-products-from-official] 执行失败:", error);
    process.exitCode = 1;
  });
}
