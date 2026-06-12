import dotenv from "dotenv";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

import pg from "pg";

import {
  buildRecommendationFeatureBackfillPayload,
  type RecommendationFeatureBackfillRow,
} from "./backfill-recommendation-product-features.ts";
import { buildSafeDisplayName } from "../lib/product-display-name.ts";
import { ensureCompetitorRecord, type CompetitorRegistryConfig } from "../scraper/shared/competitor-registry.ts";

dotenv.config();

const { Pool } = pg;

export const SVAKOM_BRAND_NAME = "SVAKOM";
export const SVAKOM_OFFICIAL_LIST_URL =
  process.env.SVAKOM_OFFICIAL_LIST_URL || "https://www.svakom.com/zh-hans-hk/collections/all";
export const SVAKOM_REVIEW_BUFFER_PATH = "src/data/svakom-official-review-buffer.json";
export const SVAKOM_HKD_TO_CNY_RATE = Number(process.env.SVAKOM_HKD_CNY_RATE || "0.9140");
export const SVAKOM_USD_TO_CNY_RATE = Number(process.env.SVAKOM_USD_CNY_RATE || "7.1200");
const SVAKOM_REFRESH_BATCH_SIZE = Number(process.env.SVAKOM_REFRESH_BATCH_SIZE || "40");
const SVAKOM_OFFICIAL_MAX_ITEMS = Number(process.env.SVAKOM_OFFICIAL_MAX_ITEMS || "300");

const SVAKOM_COMPETITOR_CONFIG: CompetitorRegistryConfig = {
  canonicalName: SVAKOM_BRAND_NAME,
  matchNames: ["svakom", "司沃康"],
  domain: "www.svakom.com",
  country: "美国",
  description: "SVAKOM 是主打设计感、智能互联与伴侣互动体验的情趣科技品牌。",
  focus: "Unisex",
  philosophy: [
    "以智能互联、远程控制和多刺激方式作为核心识别。",
    "覆盖女性向、男性向和伴侣共玩场景，并通过系列化命名降低选择成本。",
    "强调亲肤材质、防水清洁和可充电体验。",
  ],
  majorUserGroupProfile:
    "【核心人口】20-45 岁女性用户、情侣用户和智能玩具尝鲜用户。\n【心理特征】关注 App/远程互动、阴蒂/G点/双刺激类型、噪音与防水清洁。\n【核心痛点】希望快速区分兔耳双刺激、穿戴遥控、阴蒂外部刺激和入体震动等产品家族。",
  isDomestic: false,
};

type ShopifyVariant = {
  id?: number;
  title?: string | null;
  sku?: string | null;
  price?: number | string | null;
  available?: boolean;
  option1?: string | null;
};

type ShopifyProduct = {
  id?: number;
  title?: string | null;
  handle?: string | null;
  body_html?: string | null;
  description?: string | null;
  vendor?: string | null;
  product_type?: string | null;
  price?: number | string | null;
  tags?: string[] | string | null;
  variants?: ShopifyVariant[];
  images?: Array<string | { src?: string | null }>;
  featured_image?: string | { src?: string | null } | null;
  url?: string | null;
  updated_at?: string | null;
  published_at?: string | null;
};

type ProductPageMeta = {
  title?: string | null;
  description?: string | null;
  canonicalUrl?: string | null;
  image?: string | null;
};

type SvakomSourceRow = {
  shopifyId?: number | null;
  handle?: string | null;
  name?: string | null;
  safeDisplayName?: string | null;
  sourceUrl?: string | null;
  price?: number | string | null;
  priceCurrency?: string | null;
  image?: string | null;
  rawDescription?: string | null;
  gender?: string | null;
  genderHint?: string | null;
  material?: string | null;
  typeCode?: string | null;
  subtypeCode?: string | null;
  categoryHints?: string[] | null;
  detailImageUrls?: string[] | null;
  specs?: Record<string, unknown> | null;
};

type SvakomFemaleRefreshPatch = {
  name: string;
  safeDisplayName: string;
  price: number;
  maxDb: number;
  waterproof: number;
  appearance: string;
  physicalForm: "external" | "internal" | "composite";
  motorType: "gentle" | "strong";
  gender: "female" | "unisex";
  brand: typeof SVAKOM_BRAND_NAME;
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeLower(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function normalizeNonEmpty(value: unknown, fallback: string) {
  const normalized = normalizeText(value);
  return normalized || fallback;
}

function normalizeInline(value: unknown) {
  return normalizeText(value)
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(value: unknown) {
  return normalizeText(value)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;/gi, "-")
    .replace(/&mdash;/gi, "-")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripTags(value: unknown) {
  return decodeHtml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueStrings(values: Array<unknown>, limit = 60) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeInline(value);
    if (!normalized || seen.has(normalized.toLowerCase())) continue;
    seen.add(normalized.toLowerCase());
    result.push(normalized);
    if (result.length >= limit) break;
  }
  return result;
}

function normalizeTagList(tags: ShopifyProduct["tags"] | string[] | null | undefined) {
  if (Array.isArray(tags)) return uniqueStrings(tags);
  return uniqueStrings(normalizeText(tags).split(","));
}

function normalizeImageUrl(value: unknown) {
  const source = typeof value === "object" && value != null && "src" in value ? (value as { src?: unknown }).src : value;
  const normalized = normalizeText(source);
  if (!normalized) return "";
  if (normalized.startsWith("//")) return `https:${normalized}`;
  if (normalized.startsWith("/")) return `https://www.svakom.com${normalized}`;
  return normalized;
}

function normalizePositivePrice(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 1;
}

function normalizeShopifyMajorPrice(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Number.isInteger(parsed) && parsed >= 1000 ? parsed / 100 : parsed;
}

function normalizeRmbPrice(row: SvakomSourceRow) {
  const currency = normalizeLower(row.priceCurrency || row.specs?.price_source_currency || "HKD");
  const sourceAmount = Number(row.price ?? row.specs?.price_source_amount);
  if (currency === "usd") return normalizePositivePrice(sourceAmount * SVAKOM_USD_TO_CNY_RATE);
  if (currency === "hkd") return normalizePositivePrice(sourceAmount * SVAKOM_HKD_TO_CNY_RATE);
  return normalizePositivePrice(row.price ?? row.specs?.price_rmb);
}

function productUrlForHandle(handle: string, listUrl = SVAKOM_OFFICIAL_LIST_URL) {
  const base = new URL(listUrl);
  const localeMatch = base.pathname.match(/^\/([^/]+-[^/]+)\//i) || base.pathname.match(/^\/([^/]+)\//i);
  const localePrefix = localeMatch?.[1] ? `/${localeMatch[1]}` : "";
  return `${base.origin}${localePrefix}/products/${handle}`;
}

function productsJsonUrlForPage(page: number, listUrl = SVAKOM_OFFICIAL_LIST_URL) {
  const parsed = new URL(listUrl);
  const pathname = parsed.pathname.replace(/\/$/, "");
  parsed.pathname = `${pathname}/products.json`;
  parsed.search = "";
  parsed.searchParams.set("limit", "250");
  parsed.searchParams.set("page", String(page));
  return parsed.toString();
}

function productJsUrlForHandle(handle: string, listUrl = SVAKOM_OFFICIAL_LIST_URL) {
  return `${productUrlForHandle(handle, listUrl)}.js`;
}

function extractMetaContent(html: string, key: string) {
  const pattern = new RegExp(
    `<meta\\s+[^>]*(?:name|property)=["']${key}["'][^>]*content=["']([^"']*)["'][^>]*>|<meta\\s+[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${key}["'][^>]*>`,
    "i",
  );
  const match = html.match(pattern);
  return decodeHtml(match?.[1] ?? match?.[2] ?? "");
}

function extractTitle(html: string) {
  return decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s*[-–]\s*SVAKOM\s*$/i, "");
}

function extractCanonicalUrl(html: string) {
  return decodeHtml(html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["'][^>]*>/i)?.[1] ?? "");
}

function extractPageMeta(html: string): ProductPageMeta {
  return {
    title: extractTitle(html) || extractMetaContent(html, "og:title"),
    description: extractMetaContent(html, "description") || extractMetaContent(html, "og:description"),
    canonicalUrl: extractCanonicalUrl(html) || extractMetaContent(html, "og:url"),
    image: extractMetaContent(html, "og:image:secure_url") || extractMetaContent(html, "og:image"),
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      accept: "application/json,text/plain,*/*",
      "user-agent": "Mozilla/5.0 female-toy-recommender official refresh",
    },
  });
  if (!response.ok) throw new Error(`GET ${url} failed: ${response.status} ${response.statusText}`);
  return (await response.json()) as T;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "user-agent": "Mozilla/5.0 female-toy-recommender official refresh",
    },
  });
  if (!response.ok) throw new Error(`GET ${url} failed: ${response.status} ${response.statusText}`);
  return await response.text();
}

async function fetchProductDetail(product: ShopifyProduct) {
  const handle = normalizeText(product.handle);
  const [jsDetail, pageMeta] = await Promise.all([
    handle ? fetchJson<ShopifyProduct>(productJsUrlForHandle(handle)).catch(() => null) : Promise.resolve(null),
    handle ? fetchText(productUrlForHandle(handle)).then(extractPageMeta).catch(() => ({})) : Promise.resolve({}),
  ]);
  return { jsDetail, pageMeta };
}

function buildTrustedSource(row: SvakomSourceRow) {
  const categoryHints = Array.isArray(row.categoryHints) ? row.categoryHints.join(" ") : "";
  const rawDescription = normalizeText(row.rawDescription);
  const rawLead = rawDescription.split(/\n\[卖点摘要\]|\n\[规格参数\]|\n\[官方标签\]/u, 1)[0] || rawDescription.slice(0, 1600);
  return `${row.name ?? ""}\n${row.handle ?? ""}\n${row.sourceUrl ?? ""}\n${categoryHints}\n${rawLead}`.toLowerCase();
}

function isObviousNonToyAccessory(row: SvakomSourceRow) {
  const source = buildTrustedSource(row);
  return /charger|charging cable|cable|cap|socks|tote bag|storage bag|pride fan|mood light|\bpen\b|sleeve|配件|充电线|收纳袋|帽子|袜子|手提袋/.test(
    source,
  );
}

function isObviousMaleOnly(row: SvakomSourceRow) {
  const source = buildTrustedSource(row);
  const titleSource = `${row.name ?? ""}\n${row.handle ?? ""}\n${row.sourceUrl ?? ""}`.toLowerCase();
  if (/male|masturbator|stroker|sleeve|cock[-\s]?ring|prostate|penis|alex|hannes|sam neo|robin|kaotik|benedict|tammy|tyler|triooo/.test(titleSource)) {
    return true;
  }
  const femaleOrShared = /female|women|woman|clit|clitoral|g-?spot|vaginal|vulva|rabbit|panty|kegel|lesbian|for her|女|阴蒂|G点|兔|穿戴/.test(
    source,
  );
  const maleOnly = /male sex toys|for him|male|men|penis|cock|prostate|perineum|masturbator|stroker|sleeve|男性|男用|阴茎|自慰器|飞机杯/.test(
    source,
  );
  return maleOnly && !femaleOrShared;
}

function hasFemaleOrSharedSignal(row: SvakomSourceRow) {
  const source = buildTrustedSource(row);
  const gender = normalizeLower(row.gender ?? row.genderHint ?? row.specs?.gender);
  return (
    gender === "female" ||
    gender === "unisex" ||
    /female sex toys|female toys|for women|for her|women|woman|female|lesbian sex toys|clit|clitoral|g-?spot|vaginal|vulva|rabbit|bunny|panty vibrator|wearable vibrator|egg vibrator|bullet|wand vibrator|kegel|foreplay vibrators|couples.{0,80}(clit|vibrator|female)|性玩具.*女性|女性|女用|阴蒂|G点|兔|穿戴|跳蛋|按摩棒|凯格尔/.test(
      source,
    )
  );
}

export function shouldKeepSvakomFemaleSourceRow(row: SvakomSourceRow) {
  return hasFemaleOrSharedSignal(row) && !isObviousMaleOnly(row) && !isObviousNonToyAccessory(row);
}

function inferGender(row: SvakomSourceRow): "female" | "unisex" {
  const source = buildTrustedSource(row);
  if (/couples|partner|gender neutral|sex toys for couples|情侣|双人/.test(source) && !/rabbit|g-?spot|vaginal|panty/.test(source)) {
    return "unisex";
  }
  return "female";
}

function resolveTypePatch(row: SvakomSourceRow) {
  const source = buildTrustedSource(row);
  if (/real[-\s]?leather|bdsm|bondage|束缚/.test(source)) {
    return { typeCode: "bdsm", subtypeCode: "fetish_accessory", maxDb: 0, waterproof: 0 };
  }
  if (/toy[-\s]?cleaner|cleanser|clean stuff|清洁/.test(source)) {
    return { typeCode: "care_accessory", subtypeCode: "toy_cleaner", maxDb: 0, waterproof: 0 };
  }
  if (/water[-\s]?based[-\s]?lube|lubricant|fun stuff|润滑/.test(source)) {
    return { typeCode: "care_accessory", subtypeCode: "lube_care", maxDb: 0, waterproof: 0 };
  }
  if (/rabbit|bunny|dual.{0,24}stimulation|g-?spot.{0,40}clit|clit.{0,40}g-?spot|兔|双重刺激/.test(source)) {
    return { typeCode: "dual_stimulation", subtypeCode: "rabbit_dual", maxDb: 50, waterproof: 7 };
  }
  if (/panty|wearable|remote[-\s]?controlled|app[-\s]?controlled|bluetooth|interactive|远程|遥控|穿戴|蓝牙|app/.test(source)) {
    return {
      typeCode: "wearable_remote",
      subtypeCode: /panty|内裤|穿戴/.test(source) ? "panty_wearable" : "insertable_remote",
      maxDb: 50,
      waterproof: 7,
    };
  }
  if (/suction|clit sucker|pulse stimulator|tongue|air pulse|吸吮|吮吸|脉冲|舌尖/.test(source)) {
    return { typeCode: "suction", subtypeCode: "suction_pure", maxDb: 50, waterproof: 7 };
  }
  if (/g-?spot|vaginal|insertable|dildo|kegel|slim|阴道|入体|凯格尔/.test(source)) {
    return { typeCode: "insertable", subtypeCode: /kegel|凯格尔/.test(source) ? "kegel_ball" : "insertable_vibe", maxDb: 50, waterproof: 7 };
  }
  if (/wand|massager|bullet|egg|finger|clitoral vibrator|external vibrator|按摩棒|跳蛋|子弹|手指|阴蒂/.test(source)) {
    return { typeCode: "external_vibe", subtypeCode: /wand|massager|按摩棒/.test(source) ? "wand_massager" : "bullet_vibe", maxDb: 50, waterproof: 7 };
  }
  return { typeCode: "external_vibe", subtypeCode: "bullet_vibe", maxDb: 50, waterproof: 7 };
}

function normalizePhysicalForm(typeCode: string, source: string): "external" | "internal" | "composite" {
  if (typeCode === "dual_stimulation" || /rabbit|bunny|双重刺激/.test(source)) return "composite";
  if (typeCode === "insertable" || typeCode === "wearable_remote" || /g-?spot|vaginal|insertable|kegel|入体|阴道/.test(source)) {
    return "internal";
  }
  return "external";
}

function normalizeMotorType(source: string, typeCode: string): "gentle" | "strong" {
  if (typeCode === "care_accessory" || typeCode === "bdsm") return "gentle";
  return /strong|powerful|thrusting|wand|intense|强力|强劲|推送|按摩棒/.test(source) ? "strong" : "gentle";
}

function normalizeAppearance(source: string) {
  return /panty|wearable|bullet|egg|mini|finger|lipstick|便携|迷你|穿戴|跳蛋|子弹|手指/.test(source)
    ? "high_disguise"
    : "normal";
}

function inferTagsFromText(row: SvakomSourceRow) {
  const source = buildTrustedSource(row);
  const tags: string[] = [];
  const push = (tag: string, pattern: RegExp) => {
    if (pattern.test(source) && !tags.includes(tag)) tags.push(tag);
  };

  push("APP控制", /app[-\s]?controlled|apps controlled|interactive|bluetooth|video interactive|webcam interactive|app|蓝牙|远程/);
  push("远程遥控", /remote[-\s]?controlled|remote|遥控|远程/);
  push("阴蒂刺激", /clit|clitoral|suction|pulse stimulator|tongue|阴蒂|吸吮|吮吸|舌尖/);
  push("G点刺激", /g-?spot|g点/);
  push("兔耳双刺激", /rabbit|bunny|兔/);
  push("入体震动", /vaginal|insertable|g-?spot|kegel|入体|阴道|凯格尔/);
  push("穿戴", /panty|wearable|穿戴/);
  push("震动", /vibrat|vibe|震动|振动/);
  push("推进", /thrusting|推送|抽插/);
  push("加热", /heating|加热/);
  push("情侣共玩", /couples|partner|情侣|双人/);
  push("防水", /waterproof|ipx7|防水/);

  return tags;
}

function normalizeMaterial(row: SvakomSourceRow, typeCode: string) {
  const direct = row.material ?? row.specs?.material;
  if (normalizeText(direct)) return normalizeText(direct);
  const source = buildTrustedSource(row);
  if (/real[-\s]?leather|leather|皮革/.test(source)) return "真皮";
  if (typeCode === "care_accessory") return "身体安全护理材质";
  return "亲肤硅胶";
}

function buildRecommendationFeaturesForPatch(patch: Omit<SvakomFemaleRefreshPatch, "recommendationFeatures">) {
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
          text: "商品资料已补充为身体安全/亲肤材质",
          source: "structured" as const,
        },
      ];

  return {
    featureVersion: payload.featureVersion,
    ...payload.features,
    evidence,
  };
}

export function buildSvakomFemaleRefreshPatch(row: SvakomSourceRow): SvakomFemaleRefreshPatch {
  const name = normalizeNonEmpty(row.name, "SVAKOM 未命名商品");
  const source = buildTrustedSource(row);
  const typePatch = resolveTypePatch(row);
  const typeCode = normalizeNonEmpty(row.typeCode, typePatch.typeCode);
  const subtypeCode = normalizeNonEmpty(row.subtypeCode, typePatch.subtypeCode);
  const productTags = Array.isArray(row.specs?.function_tags)
    ? row.specs.function_tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
    : inferTagsFromText(row);
  const rawDescription = normalizeNonEmpty(
    row.rawDescription,
    `[基础信息]\n商品名: ${name}\n站内分类提示: ${productTags.join(" | ")}\n性别提示: female\n[卖点摘要]\nSVAKOM 官方女性/女性可用商品，来自 ${SVAKOM_OFFICIAL_LIST_URL}。`,
  );

  const patchWithoutFeatures = {
    name,
    safeDisplayName: normalizeNonEmpty(row.safeDisplayName, buildSafeDisplayName(name)),
    price: normalizeRmbPrice(row),
    maxDb: Number(row.specs?.max_db ?? typePatch.maxDb),
    waterproof: Number(row.specs?.waterproof ?? typePatch.waterproof),
    appearance: normalizeNonEmpty(row.specs?.appearance, normalizeAppearance(source)),
    physicalForm: normalizePhysicalForm(typeCode, source),
    motorType: normalizeMotorType(source, typeCode),
    gender: inferGender(row),
    brand: SVAKOM_BRAND_NAME,
    material: normalizeMaterial(row, typeCode),
    link: normalizeNonEmpty(row.sourceUrl, SVAKOM_OFFICIAL_LIST_URL),
    imageUrl: normalizeNonEmpty(row.image ?? row.detailImageUrls?.[0], "/assets/product-placeholder/gspot_insertable.png"),
    rawDescription,
    typeCode,
    subtypeCode,
    productTags: productTags.length > 0 ? productTags : ["女性友好"],
    productSpecs: {
      ...(row.specs ?? {}),
      rawDescription,
      sourceUrl: normalizeNonEmpty(row.sourceUrl, SVAKOM_OFFICIAL_LIST_URL),
      officialListUrl: SVAKOM_OFFICIAL_LIST_URL,
      officialCleanedAt: new Date().toISOString(),
    },
  } satisfies Omit<SvakomFemaleRefreshPatch, "recommendationFeatures">;

  return {
    ...patchWithoutFeatures,
    recommendationFeatures: buildRecommendationFeaturesForPatch(patchWithoutFeatures),
  };
}

function buildRawDescription(
  product: ShopifyProduct,
  detail: ShopifyProduct | null,
  pageMeta: ProductPageMeta,
  sourceUrl: string,
  priceAmount: number,
  tags: string[],
) {
  const name = normalizeNonEmpty(product.title ?? detail?.title, "SVAKOM 未命名商品");
  const handle = normalizeText(product.handle ?? detail?.handle);
  const variant = (detail?.variants?.[0] ?? product.variants?.[0]) as ShopifyVariant | undefined;
  const body = stripTags(detail?.description ?? detail?.body_html ?? product.body_html);
  const categoryHints = tags.join(" | ");
  const appSupport = /app[-\s]?controlled|apps controlled|interactive|bluetooth|video interactive|webcam interactive/i.test(categoryHints)
    ? "Yes"
    : "No";
  const genderHint = /couples|gender neutral|sex toys for couples/i.test(categoryHints) ? "unisex" : "female";

  return [
    "[基础信息]",
    `商品名: ${name}`,
    pageMeta.title ? `页面标题: ${normalizeInline(pageMeta.title)}` : "",
    pageMeta.description ? `页面描述: ${normalizeInline(pageMeta.description)}` : "",
    `页面价格(HKD): ${priceAmount}`,
    categoryHints ? `站内分类提示: ${categoryHints}` : "",
    `性别提示: ${genderHint}`,
    `APP支持: ${appSupport}`,
    "",
    "[规格参数]",
    handle ? `Handle: ${handle}` : "",
    variant?.sku ? `SKU: ${variant.sku}` : "",
    variant?.title ? `颜色/款式: ${variant.title}` : "",
    typeof variant?.available === "boolean" ? `官网库存: ${variant.available ? "available" : "sold_out"}` : "",
    "材质: 亲肤硅胶",
    "",
    "[卖点摘要]",
    pageMeta.description ? normalizeInline(pageMeta.description) : "",
    body ? normalizeInline(body).slice(0, 1200) : "",
    "",
    "[官方标签]",
    categoryHints,
    "",
    `[来源链接] ${sourceUrl}`,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 9000)
    .trim();
}

function buildSvakomSourceRow(product: ShopifyProduct, detail: ShopifyProduct | null, pageMeta: ProductPageMeta): SvakomSourceRow {
  const handle = normalizeText(product.handle ?? detail?.handle);
  const tags = uniqueStrings([...normalizeTagList(product.tags), ...normalizeTagList(detail?.tags)]);
  const sourceUrl = normalizeNonEmpty(pageMeta.canonicalUrl, productUrlForHandle(handle));
  const images = uniqueStrings([
    pageMeta.image,
    product.featured_image,
    detail?.featured_image,
    ...(product.images ?? []),
    ...(detail?.images ?? []),
  ].map(normalizeImageUrl));
  const sourcePrice = normalizeShopifyMajorPrice(product.variants?.[0]?.price ?? product.price ?? detail?.variants?.[0]?.price ?? detail?.price) ?? 1;
  const rawDescription = buildRawDescription(product, detail, pageMeta, sourceUrl, sourcePrice, tags);
  const source = `${product.title ?? ""}\n${handle}\n${tags.join(" ")}\n${rawDescription}`.toLowerCase();
  const typePatch = resolveTypePatch({
    name: product.title,
    handle,
    sourceUrl,
    rawDescription,
    categoryHints: tags,
  });
  const functionTags = inferTagsFromText({
    name: product.title,
    handle,
    sourceUrl,
    rawDescription,
    categoryHints: tags,
  });

  return {
    shopifyId: product.id ?? detail?.id ?? null,
    handle,
    name: normalizeNonEmpty(product.title ?? detail?.title, "SVAKOM 未命名商品"),
    sourceUrl,
    price: sourcePrice,
    priceCurrency: "HKD",
    image: images[0] ?? null,
    rawDescription,
    genderHint: /couples|gender neutral|sex toys for couples|partner/.test(source) ? "unisex" : "female",
    categoryHints: tags,
    detailImageUrls: images,
    specs: {
      shopify_id: product.id ?? detail?.id ?? null,
      shopify_handle: handle,
      shopify_variant_id: product.variants?.[0]?.id ?? detail?.variants?.[0]?.id ?? null,
      sku: product.variants?.[0]?.sku ?? detail?.variants?.[0]?.sku ?? null,
      official_tags: tags,
      function_tags: functionTags.length > 0 ? functionTags : ["女性友好"],
      gender: /couples|gender neutral|sex toys for couples|partner/.test(source) ? "unisex" : "female",
      material: "亲肤硅胶",
      type_code: typePatch.typeCode,
      subtype_code: typePatch.subtypeCode,
      max_db: typePatch.maxDb,
      waterproof: typePatch.waterproof,
      appearance: normalizeAppearance(source),
      motor_type: normalizeMotorType(source, typePatch.typeCode),
      physical_form: normalizePhysicalForm(typePatch.typeCode, source),
      price_source_currency: "HKD",
      price_source_amount: sourcePrice,
      fx_rate_hkd_cny: SVAKOM_HKD_TO_CNY_RATE,
      fx_rate_usd_cny: SVAKOM_USD_TO_CNY_RATE,
      fx_rate_date: "2026-06-11",
      price_rmb: normalizePositivePrice(sourcePrice * SVAKOM_HKD_TO_CNY_RATE),
    },
  };
}

export async function fetchSvakomOfficialSourceRows() {
  const products: ShopifyProduct[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const payload = await fetchJson<{ products?: ShopifyProduct[] }>(productsJsonUrlForPage(page));
    const pageProducts = payload.products ?? [];
    if (pageProducts.length === 0) break;
    products.push(...pageProducts);
    if (products.length >= SVAKOM_OFFICIAL_MAX_ITEMS) break;
  }

  const limitedProducts = products.slice(0, SVAKOM_OFFICIAL_MAX_ITEMS);
  const rows: SvakomSourceRow[] = [];
  for (let index = 0; index < limitedProducts.length; index += 8) {
    const batch = limitedProducts.slice(index, index + 8);
    const batchRows = await Promise.all(
      batch.map(async (product) => {
        const detail = await fetchProductDetail(product);
        return buildSvakomSourceRow(product, detail.jsDetail, detail.pageMeta);
      }),
    );
    rows.push(...batchRows);
    console.log(`[refresh-svakom-female-products-from-official] 已抓取详情 ${rows.length}/${limitedProducts.length}`);
  }

  fs.writeFileSync(SVAKOM_REVIEW_BUFFER_PATH, `${JSON.stringify(rows, null, 2)}\n`);
  return rows;
}

async function ensureSvakomCompetitor(client: PgClientLike) {
  const prismaLike = {
    competitors: {
      findFirst: async (args: any) => {
        const names = args?.where?.OR?.flatMap((entry: any) => {
          const nameFilter = entry?.name;
          const value = typeof nameFilter === "object" ? nameFilter?.contains : nameFilter;
          return value ? [value] : [];
        }) ?? [SVAKOM_BRAND_NAME];
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
                is_domestic = COALESCE($9, is_domestic),
                updated_at = NOW()
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
    brandName: SVAKOM_BRAND_NAME,
    overrideConfig: SVAKOM_COMPETITOR_CONFIG,
  });
}

async function upsertProductAndFemaleToy(
  client: PgClientLike,
  patch: SvakomFemaleRefreshPatch,
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
            competitor_id,
            name,
            price,
            category,
            tags,
            link,
            image,
            gender,
            specs
          )
          VALUES (
            $1::uuid,
            $2,
            $3,
            'female_toy',
            $4::text[],
            $5,
            $6,
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

export function shouldRunSvakomFemaleRefreshScript(importMetaUrl: string, argvEntry?: string) {
  return Boolean(argvEntry && importMetaUrl === pathToFileURL(argvEntry).href);
}

async function loadSvakomSourceRows() {
  const sourceMode = normalizeLower(process.env.SVAKOM_REFRESH_SOURCE || "live");
  if (sourceMode === "buffer") {
    return {
      sourceMode,
      rows: JSON.parse(fs.readFileSync(SVAKOM_REVIEW_BUFFER_PATH, "utf8")) as SvakomSourceRow[],
    };
  }

  return {
    sourceMode,
    rows: await fetchSvakomOfficialSourceRows(),
  };
}

async function runSvakomFemaleProductsRefreshAttempt() {
  const { sourceMode, rows } = await loadSvakomSourceRows();
  const patches = rows.filter(shouldKeepSvakomFemaleSourceRow).map(buildSvakomFemaleRefreshPatch);
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
      console.warn("[refresh-svakom-female-products-from-official] 数据库连接 error event:", error);
    });

    await client.query("SET statement_timeout TO 0");
    await client.query("SET lock_timeout TO '5s'");

    const competitorId = await ensureSvakomCompetitor(client);
    const refreshMode = normalizeLower(process.env.SVAKOM_REFRESH_MODE || "incremental");
    if (refreshMode === "replace") {
      await client.query("BEGIN");
      await client.query("DELETE FROM public.female_recommender_toys WHERE lower(brand) = lower($1)", [SVAKOM_BRAND_NAME]);
      await client.query("COMMIT");
    }

    for (let index = 0; index < patches.length; index += SVAKOM_REFRESH_BATCH_SIZE) {
      const batch = patches.slice(index, index + SVAKOM_REFRESH_BATCH_SIZE);
      await client.query("BEGIN");
      try {
        for (const patch of batch) {
          await upsertProductAndFemaleToy(client, patch, competitorId);
        }
        await client.query("COMMIT");
        console.log(
          `[refresh-svakom-female-products-from-official] 已提交 ${Math.min(index + batch.length, patches.length)}/${patches.length}`,
        );
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      }
    }

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
      [SVAKOM_BRAND_NAME],
    );

    console.log(
      JSON.stringify(
        {
          brand: SVAKOM_BRAND_NAME,
          source: SVAKOM_OFFICIAL_LIST_URL,
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

async function refreshSvakomFemaleProducts() {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await runSvakomFemaleProductsRefreshAttempt();
    } catch (error) {
      lastError = error;
      if (attempt === 4) break;
      console.warn(`[refresh-svakom-female-products-from-official] 第 ${attempt} 次刷新失败，稍后重试:`, error);
      await sleep(2000 * attempt);
    }
  }
  throw lastError;
}

if (shouldRunSvakomFemaleRefreshScript(import.meta.url, process.argv[1])) {
  refreshSvakomFemaleProducts().catch((error) => {
    console.error("[refresh-svakom-female-products-from-official] 执行失败:", error);
    process.exitCode = 1;
  });
}
