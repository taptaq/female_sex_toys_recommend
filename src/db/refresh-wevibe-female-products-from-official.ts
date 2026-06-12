import dotenv from "dotenv";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

import pg from "pg";

import {
  buildRecommendationFeatureBackfillPayload,
  type RecommendationFeatureBackfillRow,
} from "./backfill-recommendation-product-features.ts";
import {
  classifyLibrarySubtypeCode,
  classifyLibraryTypeCode,
} from "../lib/library-product-type-classifier.ts";
import { buildSafeDisplayName } from "../lib/product-display-name.ts";
import { ensureCompetitorRecord, type CompetitorRegistryConfig } from "../scraper/shared/competitor-registry.ts";

dotenv.config();

const { Pool } = pg;

export const WEVIBE_BRAND_NAME = "We-Vibe";
export const WEVIBE_WOMEN_LIST_URL =
  process.env.WEVIBE_OFFICIAL_LIST_URL || "https://www.we-vibe.com/us/sex-toys-for-her";
export const WEVIBE_REVIEW_BUFFER_PATH = "src/data/wevibe-official-female-review-buffer.json";
export const WEVIBE_USD_TO_CNY_RATE = Number(process.env.WEVIBE_USD_CNY_RATE || "7.1200");
const WEVIBE_REFRESH_BATCH_SIZE = Number(process.env.WEVIBE_REFRESH_BATCH_SIZE || "30");
const WEVIBE_OFFICIAL_MAX_ITEMS = Number(process.env.WEVIBE_OFFICIAL_MAX_ITEMS || "90");
const WEVIBE_ORIGIN = "https://www.we-vibe.com";

const REQUEST_HEADERS: HeadersInit = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9,zh-CN;q=0.7",
  pragma: "no-cache",
  "cache-control": "no-cache",
};

const WEVIBE_COMPETITOR_CONFIG: CompetitorRegistryConfig = {
  canonicalName: WEVIBE_BRAND_NAME,
  matchNames: ["we-vibe", "we vibe", "wevibe"],
  domain: "www.we-vibe.com",
  country: "加拿大",
  description: "We-Vibe 是加拿大高端情趣科技品牌，产品覆盖女性向、男性向与伴侣共玩系列。",
  focus: "Unisex",
  philosophy: [
    "以情侣互动、远程联动和智能控制体验作为核心品牌识别。",
    "强调亲密关系里的共同探索，兼顾单人使用和伴侣共玩。",
    "通过 App、穿戴式结构与人体工学设计降低互动场景的操作成本。",
  ],
  majorUserGroupProfile:
    "【核心人口】25-45 岁情侣、异地关系用户和接受智能情趣科技的女性用户。\n【心理特征】重视连接稳定性、互动感和品牌可信度，希望产品能自然进入亲密关系场景。\n【核心痛点】远程互动容易受连接、佩戴舒适度和操作复杂度影响，需要更成熟的品牌与生态。",
  isDomestic: false,
};

type Gender = "female" | "unisex";

type WeVibeListItem = {
  sourceUrl: string;
  name: string;
  priceUsd: number | null;
  originalPriceUsd?: number | null;
  coverImage?: string | null;
  genderHint: Gender;
  stock?: string | null;
  categoryHints: string[];
  listPosition: number | null;
  sku?: string | null;
};

type WeVibeSourceRow = WeVibeListItem & {
  safeDisplayName?: string | null;
  rawDescription?: string | null;
  detailImageUrls?: string[] | null;
  colors?: string[] | null;
  skuList?: string[] | null;
  appSupport?: boolean | null;
  specs?: Record<string, unknown> | null;
};

type WeVibeFemaleRefreshPatch = {
  name: string;
  safeDisplayName: string;
  price: number;
  maxDb: number;
  waterproof: number;
  appearance: string;
  physicalForm: "external" | "internal" | "composite";
  motorType: "gentle" | "strong";
  gender: Gender;
  brand: typeof WEVIBE_BRAND_NAME;
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

type PgClientLike = {
  query: (sql: string, values?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
};

type PrismaLike = Parameters<typeof ensureCompetitorRecord>[0]["prisma"];

type ProductDetail = {
  title: string;
  coverImage: string;
  galleryImages: string[];
  shortType: string;
  description: string;
  metaDescription: string;
  priceUsd: number | null;
  originalPriceUsd: number | null;
  colors: string[];
  skuList: string[];
  imageCaptions: string[];
  appSupport: boolean;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeLower(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function normalizeInline(value: unknown) {
  return normalizeText(value)
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeBlock(value: unknown) {
  return normalizeText(value)
    .replace(/\r/g, "\n")
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
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_match, code) => String.fromCharCode(parseInt(code, 16)));
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
    const normalized = normalizeInline(stripTags(value));
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= limit) break;
  }
  return result;
}

function parsePositiveNumber(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/[^\d.]+/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizePositivePrice(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 1;
}

function normalizeProductUrl(href: unknown, baseUrl = WEVIBE_WOMEN_LIST_URL) {
  const trimmed = normalizeText(href);
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed, baseUrl);
    url.protocol = "https:";
    url.host = "www.we-vibe.com";
    url.hash = "";
    url.search = "";
    return url.toString();
  } catch {
    return "";
  }
}

function normalizeImageUrl(value: unknown) {
  const normalized = normalizeText(Array.isArray(value) ? value[0] : value);
  if (!normalized) return "";
  if (normalized.startsWith("//")) return `https:${normalized}`;
  if (normalized.startsWith("/")) return `${WEVIBE_ORIGIN}${normalized}`;
  return normalized;
}

function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of tag.matchAll(/([:@\w-]+)\s*=\s*"([^"]*)"/g)) {
    attrs[match[1] || ""] = decodeHtml(match[2] || "");
  }
  return attrs;
}

function splitCategoryHints(value: unknown) {
  return uniqueStrings(
    decodeHtml(value)
      .replace(/<br\s*\/?>/gi, "|")
      .split("|")
      .map((segment) => segment.trim()),
    80,
  );
}

function inferListGender(name: string, categoryHints: string[]): Gender {
  const source = `${name}\n${categoryHints.join("\n")}`.toLowerCase();
  if (/couples|partner|all sex toys for couples|worn during sex|long-distance|remote-controlled|sync|chorus|ditto/.test(source)) {
    return "unisex";
  }
  return "female";
}

function buildTrustedSource(row: Partial<WeVibeSourceRow>) {
  const hints = Array.isArray(row.categoryHints) ? row.categoryHints.join(" ") : "";
  const rawDescription = normalizeBlock(row.rawDescription);
  const rawLead = rawDescription.split(/\n\[规格参数\]|\n\[英文详情\]/u, 1)[0] || rawDescription.slice(0, 1800);
  return `${row.name ?? ""}\n${row.sourceUrl ?? ""}\n${hints}\n${rawLead}`.toLowerCase();
}

function isObviousOtherBrand(row: Partial<WeVibeSourceRow>) {
  const source = buildTrustedSource(row);
  return /womanizer|romp|lovehoney|satisfyer/.test(source);
}

function isObviousMaleOnly(row: Partial<WeVibeSourceRow>) {
  const source = buildTrustedSource(row);
  if (/ditto|anal plug|butt plug/.test(source)) return false;
  return /\bverge\b|\bpivot\b|\bvector\b|penis|prostate|p-spot|for him|\bmale\b|\bmen\b|cock ring|penis ring|masturbator|stroker|前列腺|阴茎|陰莖|男用|男性/.test(source);
}

function isObviousNonToy(row: Partial<WeVibeSourceRow>) {
  const source = buildTrustedSource(row);
  return /gift card|lube|lubricant|cleaner|condom|accessor(?:y|ies)|replacement|spare part/.test(source);
}

export function shouldKeepWeVibeFemaleSourceRow(row: Partial<WeVibeSourceRow>) {
  if (!normalizeText(row.name) || !normalizeProductUrl(row.sourceUrl)) return false;
  if (isObviousOtherBrand(row) || isObviousMaleOnly(row) || isObviousNonToy(row)) return false;
  const source = buildTrustedSource(row);
  return /all toys for her|for her|clitoral|g-?spot|rabbit|panty|wearable|vaginal|bullet|wand|air suction|suction|app-enabled|long-distance|remote-controlled|worn during sex|couples vibrator|nova|melt|touch|temp|moxie|jive|tango|wand|ditto|rave|chorus|sync/.test(source);
}

export function extractWeVibeWomenListItems(html: string, listUrl = WEVIBE_WOMEN_LIST_URL): WeVibeListItem[] {
  const items: WeVibeListItem[] = [];
  const seen = new Set<string>();

  for (const match of html.matchAll(/<a\b[^>]*class="[^"]*product-item-photo[^"]*"[^>]*>/gi)) {
    const attrs = parseAttributes(match[0] || "");
    const sourceUrl = normalizeProductUrl(attrs.href, listUrl);
    const name = normalizeInline(attrs["data-name"] || "");
    if (!sourceUrl || !name || seen.has(sourceUrl)) continue;

    const categoryHints = splitCategoryHints(attrs["data-category"] || attrs["data-list"] || "All Toys For Her");
    const row = {
      sourceUrl,
      name,
      priceUsd: parsePositiveNumber(attrs["data-price"]),
      originalPriceUsd: null,
      coverImage: null,
      genderHint: inferListGender(name, categoryHints),
      stock: normalizeInline(attrs["data-dimension10"] || ""),
      categoryHints,
      listPosition: parsePositiveNumber(attrs["data-position"]),
      sku: normalizeInline(attrs["data-id"] || ""),
    } satisfies WeVibeListItem;

    if (!shouldKeepWeVibeFemaleSourceRow(row)) continue;
    seen.add(sourceUrl);
    items.push(row);
  }

  return items.sort((a, b) => (a.listPosition ?? 1e9) - (b.listPosition ?? 1e9));
}

function extractMetaContent(html: string, key: string) {
  const pattern = new RegExp(
    `<meta\\s+[^>]*(?:name|property)=["']${key}["'][^>]*content=["']([^"']*)["'][^>]*>|<meta\\s+[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${key}["'][^>]*>`,
    "i",
  );
  const match = html.match(pattern);
  return normalizeInline(match?.[1] || match?.[2] || "");
}

function extractJsonLdProduct(html: string): Record<string, unknown> | null {
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1] || "{}");
      if (parsed && typeof parsed === "object" && ((parsed as any)["@type"] === "Product" || (parsed as any).type === "Product")) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function extractBalancedJsonAfterMarker(source: string, marker: string): string | null {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) return null;
  const start = source.indexOf("{", markerIndex + marker.length);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  return null;
}

function extractBlockValue(
  html: string,
  blockClassFragment: string,
  valuePattern = 'div class="value[^"]*"[^>]*>([\\s\\S]*?)<\\/div>',
) {
  const blockRegex = new RegExp(
    `<div class="[^"]*${blockClassFragment}[^"]*"[^>]*>[\\s\\S]*?${valuePattern}`,
    "i",
  );
  const match = html.match(blockRegex);
  return normalizeBlock(stripTags(match?.[1] || ""));
}

function extractDetail(html: string, fallback: WeVibeListItem): ProductDetail {
  const jsonLd = extractJsonLdProduct(html);
  const jsonConfigRaw = extractBalancedJsonAfterMarker(html, '"jsonConfig":');
  let jsonConfig: any = null;
  if (jsonConfigRaw) {
    try {
      jsonConfig = JSON.parse(jsonConfigRaw);
    } catch {
      jsonConfig = null;
    }
  }

  const title =
    normalizeInline(jsonLd?.name) ||
    normalizeInline(html.match(/<span class="base"[^>]*>([\s\S]*?)<\/span>/i)?.[1] || "") ||
    fallback.name;
  const shortType =
    extractBlockValue(html, "product__attribute short_description") ||
    normalizeInline(jsonLd?.category);
  const description =
    extractBlockValue(html, "product__attribute description", 'itemprop="description"[^>]*>([\\s\\S]*?)<\\/div>') ||
    normalizeBlock(jsonLd?.description) ||
    extractMetaContent(html, "description");
  const metaDescription = extractMetaContent(html, "description") || extractMetaContent(html, "og:description");

  const galleryImages = uniqueStrings(
    [
      extractMetaContent(html, "og:image"),
      normalizeImageUrl(jsonLd?.image),
      normalizeImageUrl(html.match(/class="gallery-placeholder__image"[^>]+(?:src|data-src)=["']([^"']+)["']/i)?.[1] || ""),
      ...Object.values(jsonConfig?.images || {})
        .flatMap((rows: any) => (Array.isArray(rows) ? rows : []))
        .flatMap((item: any) => [item?.full, item?.img, item?.thumb].map(normalizeImageUrl)),
    ],
    30,
  );
  const imageCaptions = uniqueStrings(
    Object.values(jsonConfig?.images || {})
      .flatMap((rows: any) => (Array.isArray(rows) ? rows : []))
      .map((item: any) => item?.caption),
    20,
  );
  const colors = uniqueStrings(
    Object.values(jsonConfig?.attributes || {})
      .flatMap((attribute: any) => (Array.isArray(attribute?.options) ? attribute.options : []))
      .map((option: any) => option?.label),
    20,
  );
  const skuList = uniqueStrings([
    jsonLd?.sku,
    ...Object.values(jsonConfig?.sku || {}).map((value) => String(value || "")),
  ], 20);

  const offer = jsonLd?.offers && typeof jsonLd.offers === "object" ? (jsonLd.offers as Record<string, unknown>) : {};
  const priceUsd =
    parsePositiveNumber(offer.price) ||
    parsePositiveNumber(jsonConfig?.prices?.finalPrice?.amount) ||
    parsePositiveNumber(html.match(/data-price-amount=["']([^"']+)["']/i)?.[1]) ||
    fallback.priceUsd;
  const originalPriceUsd =
    parsePositiveNumber(jsonConfig?.prices?.oldPrice?.amount) ||
    parsePositiveNumber(jsonConfig?.prices?.baseOldPrice?.amount) ||
    null;

  return {
    title,
    coverImage: galleryImages[0] || normalizeImageUrl(fallback.coverImage),
    galleryImages,
    shortType,
    description,
    metaDescription,
    priceUsd,
    originalPriceUsd: originalPriceUsd && priceUsd && originalPriceUsd > priceUsd ? originalPriceUsd : null,
    colors,
    skuList,
    imageCaptions,
    appSupport: /class=["']app-badge-label|https:\/\/www\.we-vibe\.com\/app|app-enabled|app controlled/i.test(html),
  };
}

function buildRawDescription(item: WeVibeListItem, detail: ProductDetail) {
  return [
    "[基础信息]",
    `商品名: ${detail.title || item.name}`,
    detail.shortType ? `产品类型: ${detail.shortType}` : "",
    detail.priceUsd ? `页面价格(USD): ${detail.priceUsd}` : "",
    detail.originalPriceUsd ? `原价(USD): ${detail.originalPriceUsd}` : "",
    item.stock ? `库存状态: ${item.stock}` : "",
    detail.skuList.length ? `SKU: ${detail.skuList.join(" / ")}` : "",
    detail.colors.length ? `颜色选项: ${detail.colors.join(" / ")}` : "",
    item.categoryHints.length ? `站内分类提示: ${item.categoryHints.join(" | ")}` : "",
    `性别提示: ${item.genderHint}`,
    `APP支持: ${detail.appSupport ? "Yes" : "No"}`,
    "",
    "[英文详情]",
    detail.description || detail.metaDescription || "No description found.",
    "",
    detail.imageCaptions.length ? "[图片文案]" : "",
    detail.imageCaptions.join("\n"),
    "",
    `[来源链接] ${item.sourceUrl}`,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 12000)
    .trim();
}

function normalizeRmbPrice(row: Partial<WeVibeSourceRow>) {
  const direct = Number(row.specs?.price_rmb);
  if (Number.isFinite(direct) && direct > 0) return normalizePositivePrice(direct);
  const sourceAmount = Number(row.priceUsd ?? row.specs?.price_usd);
  return normalizePositivePrice((Number.isFinite(sourceAmount) && sourceAmount > 0 ? sourceAmount : 1) * WEVIBE_USD_TO_CNY_RATE);
}

function resolveTypePatch(row: Partial<WeVibeSourceRow>) {
  const source = buildTrustedSource(row);
  const tags = Array.isArray(row.categoryHints) ? row.categoryHints : [];
  const physicalForm = /nova|rabbit|sync|chorus|dual|worn during sex|vaginal.{0,20}clitoral|clitoral.{0,20}vaginal/.test(source)
    ? "composite"
    : /jive|rave|g-?spot|vaginal|insert|ditto|anal|plug/.test(source)
      ? "internal"
      : "external";
  const classifiedTypeCode = classifyLibraryTypeCode({
    gender: "female",
    physicalForm,
    name: row.name,
    rawDescription: row.rawDescription,
    tags,
  });
  const classifiedSubtypeCode = classifyLibrarySubtypeCode({
    gender: "female",
    physicalForm,
    name: row.name,
    rawDescription: row.rawDescription,
    tags,
    typeCode: classifiedTypeCode,
  });

  if (/melt|air suction|air pulse|suction/.test(source) && /nova|rabbit|g-?spot|vaginal|dual/.test(source)) {
    return { typeCode: "dual_stimulation", subtypeCode: "suction_dual", maxDb: 40, waterproof: 7 };
  }
  if (/nova|rabbit|dual stimulation/.test(source)) {
    return { typeCode: "dual_stimulation", subtypeCode: "rabbit_dual", maxDb: 40, waterproof: 7 };
  }
  if (/melt|air suction|air pulse|suction/.test(source)) {
    return { typeCode: "suction", subtypeCode: "suction_pure", maxDb: 40, waterproof: 7 };
  }
  if (/sync|chorus|couples vibrator|worn during sex/.test(source)) {
    return { typeCode: "couples", subtypeCode: "insertable_couples", maxDb: 40, waterproof: 7 };
  }
  if (/moxie|panty/.test(source)) {
    return { typeCode: "wearable_remote", subtypeCode: "panty_wearable", maxDb: 40, waterproof: 7 };
  }
  if (/jive|ditto|remote-controlled|long-distance|app-enabled/.test(source) && /g-?spot|anal|plug|wearable|insert/.test(source)) {
    return { typeCode: "wearable_remote", subtypeCode: "insertable_remote", maxDb: 40, waterproof: 7 };
  }
  if (/wand/.test(source)) {
    return { typeCode: "external_vibe", subtypeCode: "wand_massager", maxDb: 40, waterproof: 7 };
  }
  if (/rave|g-?spot|vaginal|insert/.test(source)) {
    return { typeCode: "insertable", subtypeCode: "insertable_vibe", maxDb: 40, waterproof: 7 };
  }
  if (/touch|tango|temp|bullet|clitoral|mini vibrator|lay-on|warming|heat/.test(source)) {
    return { typeCode: "external_vibe", subtypeCode: "bullet_vibe", maxDb: 40, waterproof: 7 };
  }
  if (classifiedTypeCode && classifiedTypeCode !== "unknown" && classifiedSubtypeCode) {
    return { typeCode: classifiedTypeCode, subtypeCode: classifiedSubtypeCode, maxDb: 40, waterproof: 7 };
  }
  return { typeCode: "external_vibe", subtypeCode: "bullet_vibe", maxDb: 40, waterproof: 7 };
}

function normalizePhysicalForm(typeCode: string, source: string): "external" | "internal" | "composite" {
  if (typeCode === "dual_stimulation" || typeCode === "couples" || /nova|rabbit|sync|chorus|worn during sex/.test(source)) return "composite";
  if (typeCode === "wearable_remote" || typeCode === "insertable" || /jive|ditto|rave|g-?spot|vaginal|anal|plug/.test(source)) return "internal";
  return "external";
}

function normalizeMotorType(source: string): "gentle" | "strong" {
  return /wand|rave|powerful|strong|intense|deep|rumbling/.test(source) ? "strong" : "gentle";
}

function normalizeAppearance(source: string) {
  return /moxie|jive|tango|touch|temp|mini|panty|wearable|discreet|compact|travel/.test(source) ? "high_disguise" : "normal";
}

function inferTagsFromText(row: Partial<WeVibeSourceRow>) {
  const source = buildTrustedSource(row);
  const tags: string[] = [];
  const push = (tag: string, pattern: RegExp) => {
    if (pattern.test(source) && !tags.includes(tag)) tags.push(tag);
  };

  push("APP支持", /app-enabled|app support|we-vibe app|app controlled|app/);
  push("远程遥控", /remote-controlled|remote control|long-distance|squeeze remote/);
  push("长距离互动", /long-distance/);
  push("情侣共玩", /couples|partner|worn during sex|sync|chorus/);
  push("阴蒂刺激", /clitoral|clit|touch|tango|melt|temp|wand/);
  push("G点刺激", /g-?spot|jive|rave|nova/);
  push("兔耳双刺激", /rabbit|nova/);
  push("空气脉冲", /air suction|air pulse|suction|melt/);
  push("可穿戴", /wearable|panty|worn during sex|moxie|jive|sync|chorus|ditto/);
  push("后庭探索", /anal|plug|ditto/);
  push("防水", /waterproof|ipx/);
  push("可充电", /rechargeable|usb/);
  push("加温", /warming|heat|temperature|temp/);

  return tags;
}

function inferGender(row: Partial<WeVibeSourceRow>): Gender {
  const source = buildTrustedSource(row);
  if (/sync|chorus|ditto|worn during sex/.test(source) && !/nova|rabbit|g-?spot|vaginal|melt|clitoral|air suction/.test(source)) {
    return "unisex";
  }
  return "female";
}

function inferMaterial(row: Partial<WeVibeSourceRow>) {
  const source = buildTrustedSource(row);
  if (/silicone/.test(source)) return "亲肤硅胶";
  if (/abs/.test(source)) return "ABS/亲肤硅胶";
  return "亲肤硅胶";
}

function placeholderImageForSubtype(subtypeCode: string) {
  const normalized = normalizeLower(subtypeCode);
  if (normalized.includes("wand")) return "/assets/product-placeholder/wand_massager.png";
  if (normalized.includes("suction")) return "/assets/product-placeholder/suction_pure.png";
  if (normalized.includes("rabbit")) return "/assets/product-placeholder/rabbit_dual.png";
  if (normalized.includes("wearable") || normalized.includes("remote") || normalized.includes("couples")) {
    return "/assets/product-placeholder/insertable_remote.png";
  }
  if (normalized.includes("insertable") || normalized.includes("gspot")) return "/assets/product-placeholder/gspot_insertable.png";
  return "/assets/product-placeholder/bullet_vibe.png";
}

function buildRecommendationFeaturesForPatch(patch: Omit<WeVibeFemaleRefreshPatch, "recommendationFeatures">) {
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
          signal: "app" as const,
          polarity: "positive" as const,
          text: "We-Vibe 官方资料显示该系列强调 App/远程互动或亲肤材质",
          source: "structured" as const,
        },
      ];

  return {
    featureVersion: payload.featureVersion,
    ...payload.features,
    evidence,
  };
}

export function buildWeVibeFemaleRefreshPatch(row: Partial<WeVibeSourceRow>): WeVibeFemaleRefreshPatch {
  const name = normalizeNonEmpty(row.name, "We-Vibe 未命名商品");
  const source = buildTrustedSource(row);
  const typePatch = resolveTypePatch(row);
  const rawDescription = normalizeNonEmpty(
    row.rawDescription,
    `[基础信息]\n商品名: ${name}\n站内分类提示: All Toys For Her\n性别提示: female/unisex\nAPP支持: ${row.appSupport ? "Yes" : "Unknown"}\n[英文详情]\nWe-Vibe official female/shared product from ${WEVIBE_WOMEN_LIST_URL}.\n[来源链接] ${normalizeProductUrl(row.sourceUrl) || WEVIBE_WOMEN_LIST_URL}`,
  );
  const typeCode = normalizeNonEmpty(row.specs?.type_code && row.specs.type_code !== "unknown" ? row.specs.type_code : typePatch.typeCode, "external_vibe");
  const subtypeCode = normalizeNonEmpty(row.specs?.subtype_code ?? typePatch.subtypeCode, "bullet_vibe");
  const productTags = uniqueStrings([
    ...(Array.isArray(row.specs?.function_tags) ? row.specs.function_tags : []),
    ...inferTagsFromText({ ...row, rawDescription }),
  ]);
  const maxDb = Number(row.specs?.max_db ?? typePatch.maxDb);
  const waterproof = Number(row.specs?.waterproof ?? typePatch.waterproof);

  const patchWithoutFeatures = {
    name,
    safeDisplayName: normalizeNonEmpty(row.safeDisplayName, buildSafeDisplayName(name)),
    price: normalizeRmbPrice(row),
    maxDb: Number.isFinite(maxDb) ? maxDb : typePatch.maxDb,
    waterproof: Number.isFinite(waterproof) ? waterproof : typePatch.waterproof,
    appearance: normalizeNonEmpty(row.specs?.appearance, normalizeAppearance(source)),
    physicalForm: normalizePhysicalForm(typeCode, source),
    motorType: normalizeMotorType(source),
    gender: inferGender({ ...row, rawDescription }),
    brand: WEVIBE_BRAND_NAME,
    material: normalizeNonEmpty(row.specs?.material, inferMaterial({ ...row, rawDescription })),
    link: normalizeNonEmpty(normalizeProductUrl(row.sourceUrl), WEVIBE_WOMEN_LIST_URL),
    imageUrl: normalizeNonEmpty(
      normalizeImageUrl(row.coverImage ?? row.detailImageUrls?.[0]),
      placeholderImageForSubtype(subtypeCode),
    ),
    rawDescription,
    typeCode,
    subtypeCode,
    productTags: productTags.length > 0 ? productTags : ["APP支持", "女性友好"],
    productSpecs: {
      ...(row.specs ?? {}),
      rawDescription,
      sourceUrl: normalizeProductUrl(row.sourceUrl),
      officialListUrl: WEVIBE_WOMEN_LIST_URL,
      price_usd: row.priceUsd ?? row.specs?.price_usd ?? null,
      original_price_usd: row.originalPriceUsd ?? row.specs?.original_price_usd ?? null,
      price_rmb: normalizeRmbPrice(row),
      fx_rate_usd_cny: WEVIBE_USD_TO_CNY_RATE,
      fx_rate_source: "fallback",
      app_support: Boolean(row.appSupport ?? /APP支持:\s*Yes/i.test(rawDescription)),
      colors: row.colors ?? [],
      sku_list: row.skuList ?? [],
      officialCleanedAt: new Date().toISOString(),
    },
  } satisfies Omit<WeVibeFemaleRefreshPatch, "recommendationFeatures">;

  return {
    ...patchWithoutFeatures,
    recommendationFeatures: buildRecommendationFeaturesForPatch(patchWithoutFeatures),
  };
}

async function fetchText(url: string) {
  const response = await fetch(url, { headers: REQUEST_HEADERS, redirect: "follow" });
  if (!response.ok) throw new Error(`GET ${url} failed: ${response.status}`);
  return await response.text();
}

export async function fetchWeVibeOfficialSourceRows() {
  const listHtml = await fetchText(WEVIBE_WOMEN_LIST_URL);
  const listItems = extractWeVibeWomenListItems(listHtml).slice(0, WEVIBE_OFFICIAL_MAX_ITEMS);
  const rows: WeVibeSourceRow[] = [];

  for (let index = 0; index < listItems.length; index += 6) {
    const batch = listItems.slice(index, index + 6);
    const batchRows = await Promise.all(
      batch.map(async (item) => {
        const detailHtml = await fetchText(item.sourceUrl);
        const detail = extractDetail(detailHtml, item);
        return {
          ...item,
          name: detail.title || item.name,
          safeDisplayName: buildSafeDisplayName(detail.title || item.name),
          priceUsd: detail.priceUsd ?? item.priceUsd,
          originalPriceUsd: detail.originalPriceUsd,
          coverImage: detail.coverImage || item.coverImage,
          rawDescription: buildRawDescription(item, detail),
          detailImageUrls: detail.galleryImages,
          colors: detail.colors,
          skuList: detail.skuList,
          appSupport: detail.appSupport,
          specs: {
            price_source_currency: "USD",
            price_usd: detail.priceUsd ?? item.priceUsd,
            original_price_usd: detail.originalPriceUsd,
            price_rmb: normalizePositivePrice((detail.priceUsd ?? item.priceUsd ?? 1) * WEVIBE_USD_TO_CNY_RATE),
            function_tags: inferTagsFromText({
              ...item,
              name: detail.title || item.name,
              rawDescription: buildRawDescription(item, detail),
            }),
            app_support: detail.appSupport,
          },
        } satisfies WeVibeSourceRow;
      }),
    );
    rows.push(...batchRows);
    console.log(`[refresh-wevibe-female-products-from-official] 已抓取详情 ${rows.length}/${listItems.length}`);
  }

  fs.writeFileSync(WEVIBE_REVIEW_BUFFER_PATH, `${JSON.stringify(rows, null, 2)}\n`);
  return rows;
}

async function ensureWeVibeCompetitor(client: PgClientLike) {
  const prismaLike = {
    competitors: {
      findFirst: async (args: any) => {
        const names = args?.where?.OR?.flatMap((entry: any) => {
          const nameFilter = entry?.name;
          const value = typeof nameFilter === "object" ? nameFilter?.contains : nameFilter;
          return value ? [value] : [];
        }) ?? [WEVIBE_BRAND_NAME];
        const result = await client.query(
          `
            SELECT id, name, domain, country, founded_date, description, focus,
                   philosophy, major_user_group_profile, is_domestic
            FROM public.competitors
            WHERE lower(name) = ANY($1::text[])
               OR lower(coalesce(name, '')) LIKE ANY($2::text[])
               OR lower(coalesce(domain, '')) LIKE '%we-vibe.com%'
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
    brandName: WEVIBE_BRAND_NAME,
    overrideConfig: WEVIBE_COMPETITOR_CONFIG,
  });
}

async function upsertProductAndFemaleToy(
  client: PgClientLike,
  patch: WeVibeFemaleRefreshPatch,
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

async function ensureProductForWeVibePatch(
  client: PgClientLike,
  patch: WeVibeFemaleRefreshPatch,
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

async function backfillIncompleteWeVibeRows(
  client: PgClientLike,
  competitorId: string | null,
) {
  const incomplete = await client.query(
    `
      SELECT id, original_id, name, safe_display_name, price, max_db, waterproof,
             appearance, physical_form, motor_type, gender, brand, material, link,
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
          OR lower(COALESCE(type_code, '')) = 'unknown'
          OR NULLIF(BTRIM(COALESCE(subtype_code, '')), '') IS NULL
          OR recommendation_features IS NULL
          OR jsonb_array_length(coalesce(recommendation_features->'evidence', '[]'::jsonb)) = 0
        )
    `,
    [WEVIBE_BRAND_NAME],
  );

  if (incomplete.rows.length === 0) return 0;

  for (const row of incomplete.rows) {
    const name = normalizeNonEmpty(row.name ?? row.safe_display_name, "We-Vibe 未命名商品");
    const link = normalizeNonEmpty(row.link, `${WEVIBE_WOMEN_LIST_URL}#${row.id}`);
    const sourceRow: Partial<WeVibeSourceRow> = {
      sourceUrl: link,
      name,
      safeDisplayName: normalizeNonEmpty(row.safe_display_name, buildSafeDisplayName(name)),
      priceUsd: Number(row.price) / WEVIBE_USD_TO_CNY_RATE,
      coverImage: normalizeNonEmpty(row.image_url, "/assets/product-placeholder/bullet_vibe.png"),
      rawDescription: normalizeNonEmpty(
        row.raw_description,
        `[基础信息]\n商品名: ${name}\n站内分类提示: All Toys For Her\n性别提示: female/unisex\nAPP支持: Unknown\n[英文详情]\nWe-Vibe official female/shared product record, completed by fallback cleaning.\n[来源链接] ${link}`,
      ),
      categoryHints: uniqueStrings([row.type_code, row.subtype_code, row.physical_form, link]),
      genderHint: normalizeLower(row.gender) === "unisex" ? "unisex" : "female",
      listPosition: null,
      specs: {
        price_rmb: Number(row.price) || undefined,
        type_code: normalizeText(row.type_code) && normalizeLower(row.type_code) !== "unknown" ? row.type_code : undefined,
        subtype_code: normalizeText(row.subtype_code) || undefined,
        max_db: Number.isFinite(Number(row.max_db)) ? Number(row.max_db) : 40,
        waterproof: Number.isFinite(Number(row.waterproof)) ? Number(row.waterproof) : 7,
        appearance: normalizeText(row.appearance) || undefined,
        physical_form: normalizeText(row.physical_form) || undefined,
        motor_type: normalizeText(row.motor_type) || undefined,
        gender: normalizeText(row.gender) || undefined,
        material: normalizeText(row.material) || undefined,
      },
    };
    const patch = buildWeVibeFemaleRefreshPatch(sourceRow);
    const productId = row.original_id ?? (await ensureProductForWeVibePatch(client, patch, competitorId));

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

  console.log(`[refresh-wevibe-female-products-from-official] 已兜底修复不完整行 ${incomplete.rows.length} 条`);
  return incomplete.rows.length;
}

export function shouldRunWeVibeFemaleRefreshScript(importMetaUrl: string, argvEntry?: string) {
  return Boolean(argvEntry && importMetaUrl === pathToFileURL(argvEntry).href);
}

async function loadWeVibeSourceRows() {
  const sourceMode = normalizeLower(process.env.WEVIBE_REFRESH_SOURCE || "live");
  if (sourceMode === "buffer") {
    return {
      sourceMode,
      rows: JSON.parse(fs.readFileSync(WEVIBE_REVIEW_BUFFER_PATH, "utf8")) as WeVibeSourceRow[],
    };
  }
  return {
    sourceMode,
    rows: await fetchWeVibeOfficialSourceRows(),
  };
}

async function runWeVibeFemaleProductsRefreshAttempt() {
  const { sourceMode, rows } = await loadWeVibeSourceRows();
  const patches = rows.filter(shouldKeepWeVibeFemaleSourceRow).map(buildWeVibeFemaleRefreshPatch);
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
      console.warn("[refresh-wevibe-female-products-from-official] 数据库连接 error event:", error);
    });

    await client.query("SET statement_timeout TO 0");
    await client.query("SET lock_timeout TO '5s'");

    const competitorId = await ensureWeVibeCompetitor(client);
    const refreshMode = normalizeLower(process.env.WEVIBE_REFRESH_MODE || "incremental");
    if (refreshMode === "replace") {
      await client.query("BEGIN");
      await client.query("DELETE FROM public.female_recommender_toys WHERE lower(brand) = lower($1)", [WEVIBE_BRAND_NAME]);
      await client.query("COMMIT");
    }

    for (let index = 0; index < patches.length; index += WEVIBE_REFRESH_BATCH_SIZE) {
      const batch = patches.slice(index, index + WEVIBE_REFRESH_BATCH_SIZE);
      await client.query("BEGIN");
      try {
        for (const patch of batch) {
          await upsertProductAndFemaleToy(client, patch, competitorId);
        }
        await client.query("COMMIT");
        console.log(
          `[refresh-wevibe-female-products-from-official] 已提交 ${Math.min(index + batch.length, patches.length)}/${patches.length}`,
        );
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      }
    }

    await backfillIncompleteWeVibeRows(client, competitorId);

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
               OR lower(COALESCE(type_code, '')) = 'unknown'
               OR NULLIF(BTRIM(COALESCE(subtype_code, '')), '') IS NULL
               OR recommendation_features IS NULL
          )::int AS rows_with_missing_fields,
          COUNT(*) FILTER (
            WHERE jsonb_array_length(coalesce(recommendation_features->'evidence', '[]'::jsonb)) = 0
          )::int AS rows_with_empty_evidence,
          COUNT(*) FILTER (WHERE lower(COALESCE(type_code, '')) = 'unknown')::int AS rows_with_unknown_type,
          COUNT(*) FILTER (WHERE lower(COALESCE(subtype_code, '')) = 'unknown')::int AS rows_with_unknown_subtype
        FROM public.female_recommender_toys
        WHERE lower(brand) = lower($1)
      `,
      [WEVIBE_BRAND_NAME],
    );

    console.log(
      JSON.stringify(
        {
          brand: WEVIBE_BRAND_NAME,
          source: WEVIBE_WOMEN_LIST_URL,
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

async function runWeVibeFemaleProductsRefresh() {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await runWeVibeFemaleProductsRefreshAttempt();
      return;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!/Connection terminated|ECONNRESET|server closed the connection|terminating connection|Can't reach database|P1001|P1017/i.test(message) || attempt === 3) {
        break;
      }
      console.warn(`[refresh-wevibe-female-products-from-official] 遇到瞬断，重试 ${attempt}/3...`, error);
      await sleep(1500 * attempt);
    }
  }
  throw lastError;
}

if (shouldRunWeVibeFemaleRefreshScript(import.meta.url, process.argv[1])) {
  runWeVibeFemaleProductsRefresh().catch((error) => {
    console.error("[refresh-wevibe-female-products-from-official] 执行失败:", error);
    process.exitCode = 1;
  });
}
