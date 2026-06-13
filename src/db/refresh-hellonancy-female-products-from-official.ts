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

export const HELLONANCY_BRAND_NAME = "Hello Nancy";
export const HELLONANCY_FEMALE_LIST_URL =
  process.env.HELLONANCY_OFFICIAL_LIST_URL || "https://hellonancy.com/zh-hans/collections/nancy-all-products";
export const HELLONANCY_REVIEW_BUFFER_PATH = "src/data/hellonancy-all-products-female-review-buffer.json";
export const HELLONANCY_USD_TO_CNY_RATE = Number(process.env.HELLONANCY_USD_CNY_RATE || "7.1200");
const HELLONANCY_REFRESH_BATCH_SIZE = Number(process.env.HELLONANCY_REFRESH_BATCH_SIZE || "30");
const HELLONANCY_OFFICIAL_MAX_ITEMS = Number(process.env.HELLONANCY_OFFICIAL_MAX_ITEMS || "200");
const HELLONANCY_ORIGIN = "https://hellonancy.com";

const REQUEST_HEADERS: HeadersInit = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
  accept: "application/json,text/plain;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9,zh-CN;q=0.7",
  pragma: "no-cache",
  "cache-control": "no-cache",
};

const HELLONANCY_COMPETITOR_CONFIG: CompetitorRegistryConfig = {
  canonicalName: HELLONANCY_BRAND_NAME,
  matchNames: ["hello nancy", "hellonancy", "nancy"],
  domain: "hellonancy.com",
  country: "中国",
  description: "Hello Nancy 是面向女性情趣场景的品牌，覆盖吸吮、震动、穿戴遥控、G 点/后庭探索与新手友好套装。",
  focus: "Female",
  philosophy: [
    "围绕女性向入门与轻松使用场景设计产品与沟通方式。",
    "强调直观命名、便携体积和更易理解的购买体验。",
    "通过内容与套装降低新手用户的羞耻感和试错成本。",
  ],
  majorUserGroupProfile:
    "【核心人口】20-35 岁女性新手用户为主，兼顾伴侣共玩和社媒种草型消费人群。\n【心理特征】希望快速理解产品差异，偏好小巧、便携、外观友好和不过度专业化的产品。\n【核心痛点】第一次购买时缺乏知识，担心选错、太刺激、不够隐私或配件不完整。",
  isDomestic: true,
};

type Gender = "female" | "unisex";

type ShopifyVariant = {
  title?: string | null;
  sku?: string | null;
  available?: boolean | null;
  price?: string | number | null;
  compare_at_price?: string | number | null;
};

type ShopifyImage = {
  src?: string | null;
};

type ShopifyProduct = {
  title?: string | null;
  handle?: string | null;
  body_html?: string | null;
  product_type?: string | null;
  vendor?: string | null;
  tags?: string[] | string | null;
  variants?: ShopifyVariant[] | null;
  images?: ShopifyImage[] | null;
  options?: Array<{ name?: string | null; values?: string[] | null }> | null;
};

type ShopifyCatalogResponse = {
  products?: ShopifyProduct[] | null;
};

type HelloNancySourceRow = {
  sourceUrl: string;
  name: string;
  safeDisplayName?: string | null;
  subtitle?: string | null;
  priceUsd: number | null;
  originalPriceUsd: number | null;
  coverImage: string;
  rawDescription: string;
  detailImageUrls: string[];
  colors: string[];
  skuList: string[];
  categoryHints: string[];
  genderHint: Gender;
  productType: string;
  vendor: string;
  handle: string;
  listPosition: number;
  specs?: Record<string, unknown> | null;
};

type HelloNancyFemaleRefreshPatch = {
  name: string;
  safeDisplayName: string;
  price: number;
  maxDb: number;
  waterproof: number;
  appearance: string;
  physicalForm: "external" | "internal" | "composite";
  motorType: "gentle" | "strong";
  gender: Gender;
  brand: typeof HELLONANCY_BRAND_NAME;
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
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function normalizeInline(value: unknown) {
  return stripTags(value).replace(/\s+/g, " ").trim();
}

function normalizeBlock(value: unknown) {
  return normalizeText(value)
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => stripTags(line).replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function normalizeNonEmpty(value: unknown, fallback: string) {
  const normalized = normalizeText(value);
  return normalized || fallback;
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

function parsePositiveNumber(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/[^\d.]+/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizePositivePrice(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 1;
}

function normalizeProductUrl(href: unknown, baseUrl = HELLONANCY_FEMALE_LIST_URL) {
  const trimmed = normalizeText(href);
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed, baseUrl);
    url.protocol = "https:";
    url.host = "hellonancy.com";
    url.hash = "";
    url.search = "";
    return url.toString();
  } catch {
    return "";
  }
}

function normalizeImageUrl(src: unknown) {
  const trimmed = normalizeText(src);
  if (!trimmed) return "";
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("/")) return `${HELLONANCY_ORIGIN}${trimmed}`;
  return trimmed;
}

function normalizeTags(tags: ShopifyProduct["tags"]) {
  if (Array.isArray(tags)) return uniqueStrings(tags, 80);
  return uniqueStrings(String(tags || "").split(","), 80);
}

function resolvePriceFromProduct(product: ShopifyProduct) {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const firstAvailable = variants.find((variant) => variant.available !== false && parsePositiveNumber(variant.price)) ?? variants[0];
  const priceUsd = parsePositiveNumber(firstAvailable?.price);
  const originalPriceUsd = parsePositiveNumber(firstAvailable?.compare_at_price);
  return {
    priceUsd,
    originalPriceUsd: originalPriceUsd && priceUsd && originalPriceUsd > priceUsd ? originalPriceUsd : null,
  };
}

function extractColors(product: ShopifyProduct) {
  const optionColors = (product.options ?? [])
    .filter((option) => /color|colour|shade/i.test(normalizeText(option.name)))
    .flatMap((option) => option.values ?? []);
  const variantTitles = (product.variants ?? [])
    .map((variant) => normalizeText(variant.title))
    .filter((title) => title && !/^default title$/i.test(title));
  return uniqueStrings([...optionColors, ...variantTitles], 40);
}

function buildProductUrlFromHandle(handle: unknown) {
  return normalizeProductUrl(`/products/${normalizeText(handle)}`);
}

function buildTrustedSource(row: Partial<HelloNancySourceRow>) {
  const hints = Array.isArray(row.categoryHints) ? row.categoryHints.join(" ") : "";
  const rawDescription = normalizeBlock(row.rawDescription);
  const rawLead = rawDescription.slice(0, 2400);
  return [
    row.name,
    row.subtitle,
    row.productType,
    row.vendor,
    row.sourceUrl,
    hints,
    rawLead,
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

function isToyBundle(row: Partial<HelloNancySourceRow>) {
  const source = `${buildTrustedSource(row)}\n${normalizeBlock(row.rawDescription)}`.toLowerCase();
  if (!/bundle|kit|set|套装/.test(source)) return false;
  return /uno|lolly|lem|avo|berri|massager|vibrator|clitoral|personal massager|个人按摩器|吸吮|震动|振动/.test(source);
}

function isObviousNonToy(row: Partial<HelloNancySourceRow>) {
  const source = buildTrustedSource(row);
  if (isToyBundle(row)) return false;
  return /storage bag|pleasure pouch|gift card|charger|charging cable|cord|adapter|replacement|merch|lube|lubricant|cleaner|oil|candle|condom|jelly|blanket|digital|masterclass|course|guide|ebook|card game|防水毯|数字|课程|指南|收纳|充电/.test(source);
}

function isObviousMaleOnly(row: Partial<HelloNancySourceRow>) {
  const source = buildTrustedSource(row);
  return /stroker|masturbator|sleeve|penis|\bmale\b|\bfor him\b|prostate|cock ring|男用|男性|阴茎|陰茎/.test(source);
}

export function shouldKeepHelloNancyFemaleSourceRow(row: Partial<HelloNancySourceRow>) {
  if (!normalizeText(row.name) || !normalizeProductUrl(row.sourceUrl)) return false;
  if (isObviousMaleOnly(row) || isObviousNonToy(row)) return false;
  const source = buildTrustedSource(row);
  return /massager|personal massager|vibrator|vibe|suction|air suction|clitoral|g-?spot|dildo|plug|anal|panty|remote|wearable|rabbit|wand|bullet|bundle|pleasure|toy|lem|berri|avo|namii|kalii|gii|anii|lumii|uno|pixie|lolly|tutti frutti|beginner bliss|oh-?oh-?oh|个人按摩器|阴蒂|吸吮|吮吸|震动|振动|按摩棒|后庭|套装/.test(source);
}

function inferGender(row: Partial<HelloNancySourceRow>): Gender {
  const source = buildTrustedSource(row);
  if (/couples|partner|panty|remote|anal|plug|后庭/.test(source)) return "unisex";
  return "female";
}

function resolveTypePatch(row: Partial<HelloNancySourceRow>) {
  const source = buildTrustedSource(row);
  const tags = Array.isArray(row.categoryHints) ? row.categoryHints : [];
  const physicalForm =
    isToyBundle(row) || /gii glow|gii|namii|g-?spot.{0,60}clitoral|clitoral.{0,60}g-?spot|inner and outer|内外双重|triple bundle|oh-?oh-?oh/.test(source)
      ? "composite"
      : /dildo|plug|anal|internal|insertable|g-?spot|kalii|anii|后庭|按摩棒/.test(source)
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

  if (/pixie|panty|remote-controlled|remote controlled|wearable|遥控|穿戴/.test(source)) {
    return { typeCode: "wearable_remote", subtypeCode: "panty_wearable", maxDb: 40, waterproof: 7 };
  }
  if (/gii glow|gii|namii|triple bundle|oh-?oh-?oh|inner and outer|内外双重|双重刺激/.test(source)) {
    return { typeCode: "dual_stimulation", subtypeCode: /suction|吸吮|吮吸/.test(source) ? "suction_dual" : "rabbit_dual", maxDb: 40, waterproof: 7 };
  }
  if (/lem clitoral|avo clitoral|lumii|suction|air suction|sucking|吸吮|吮吸/.test(source)) {
    return { typeCode: "suction", subtypeCode: "suction_pure", maxDb: 40, waterproof: 7 };
  }
  if (/kalii|anii|dildo|plug|anal|insertable|g-?spot|后庭|按摩棒/.test(source)) {
    return { typeCode: "insertable", subtypeCode: "gspot_insertable", maxDb: 0, waterproof: 7 };
  }
  if (/lolly|wand|mini wand/.test(source)) {
    return { typeCode: "external_vibe", subtypeCode: "wand_massager", maxDb: 40, waterproof: 7 };
  }
  if (/berri|tapping|tapsphere|bullet|uno|just uno|personal massager|个人按摩器/.test(source)) {
    return { typeCode: "external_vibe", subtypeCode: "bullet_vibe", maxDb: 40, waterproof: 7 };
  }
  if (isToyBundle(row)) {
    return { typeCode: "external_vibe", subtypeCode: "bullet_vibe", maxDb: 40, waterproof: 7 };
  }
  if (classifiedTypeCode && classifiedTypeCode !== "unknown" && classifiedSubtypeCode) {
    return { typeCode: classifiedTypeCode, subtypeCode: classifiedSubtypeCode, maxDb: 40, waterproof: 7 };
  }
  return { typeCode: "external_vibe", subtypeCode: "bullet_vibe", maxDb: 40, waterproof: 7 };
}

function normalizePhysicalForm(typeCode: string, source: string): "external" | "internal" | "composite" {
  if (typeCode === "dual_stimulation" || /gii glow|inner and outer|内外双重|triple bundle|oh-?oh-?oh/.test(source)) return "composite";
  if (typeCode === "insertable" || /dildo|plug|anal|internal|insertable|g-?spot|kalii|anii|后庭|按摩棒/.test(source)) {
    return "internal";
  }
  return "external";
}

function inferMaterial(row: Partial<HelloNancySourceRow>) {
  const source = buildTrustedSource(row);
  if (/glass|borosilicate/.test(source)) return "硼硅玻璃";
  if (/silicone|硅胶/.test(source)) return "亲肤硅胶";
  if (/vegan patent leather|leather/.test(source)) return "素皮革/金属五金";
  return "亲肤安全材质";
}

function normalizeMotorType(source: string, typeCode: string): "gentle" | "strong" {
  if (/glass|borosilicate|dildo|plug/.test(source) && !/vibrating|震动|振动/.test(source)) return "gentle";
  return /wand|powerful|deep|rumbly|strong|intense|gii|namii|avo|强劲|强烈|深沉/.test(source) ? "strong" : "gentle";
}

function normalizeAppearance(source: string) {
  return /lem|avo|berri|lumii|uno|pixie|lolly|compact|beginner|quiet|portable|small|discreet|低调|便携|静音|新手/.test(source)
    ? "high_disguise"
    : "normal";
}

function inferTagsFromText(row: Partial<HelloNancySourceRow>) {
  const source = `${buildTrustedSource(row)}\n${normalizeBlock(row.rawDescription)}`.toLowerCase();
  const tags: string[] = [];
  const push = (tag: string, pattern: RegExp) => {
    if (pattern.test(source) && !tags.includes(tag)) tags.push(tag);
  };

  push("吮吸刺激", /suction|air suction|sucking|吸吮|吮吸/);
  push("阴蒂刺激", /clitoral|external|lem|avo|berri|lumii|lolly|wand|阴蒂/);
  push("G点刺激", /g-?spot|kalii|gii|g点/);
  push("入体探索", /internal|insertable|dildo|plug|kalii|anii|按摩棒/);
  push("后庭探索", /anal|plug|anii|后庭/);
  push("穿戴遥控", /pixie|panty|remote|wearable|遥控|穿戴/);
  push("情侣共玩", /couples|partner|together|伴侣|情侣/);
  push("套装", /bundle|kit|set|套装/);
  push("多档模式", /speeds?|patterns?|multispeed|settings|intensities|modes|档|模式/);
  push("防水", /waterproof|splashproof|防水/);
  push("静音", /quiet|shhh|静音/);
  push("可充电", /rechargeable|charger included|usb|charging|可充电|充电/);
  push("震动刺激", /vibrator|vibe|vibrating|wand|tapping|震动|振动|敲击/);

  return tags;
}

function placeholderImageForSubtype(subtypeCode: string) {
  const normalized = normalizeLower(subtypeCode);
  if (normalized.includes("wand")) return "/assets/product-placeholder/wand_massager.png";
  if (normalized.includes("suction")) return "/assets/product-placeholder/suction_pure.png";
  if (normalized.includes("panty") || normalized.includes("wearable")) return "/assets/product-placeholder/panty_wearable.png";
  if (normalized.includes("restraint") || normalized.includes("bondage")) return "/assets/product-placeholder/fetish_accessory.png";
  if (normalized.includes("insertable") || normalized.includes("gspot")) return "/assets/product-placeholder/gspot_insertable.png";
  return "/assets/product-placeholder/bullet_vibe.png";
}

function normalizeRmbPrice(row: Partial<HelloNancySourceRow>) {
  const direct = Number(row.specs?.price_rmb);
  if (Number.isFinite(direct) && direct > 0) return normalizePositivePrice(direct);
  const priceUsd = Number(row.priceUsd ?? row.specs?.price_usd);
  return normalizePositivePrice((Number.isFinite(priceUsd) && priceUsd > 0 ? priceUsd : 1) * HELLONANCY_USD_TO_CNY_RATE);
}

function buildRecommendationFeaturesForPatch(patch: Omit<HelloNancyFemaleRefreshPatch, "recommendationFeatures">) {
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
          signal: "gentle" as const,
          polarity: "positive" as const,
          text: "Hello Nancy 官方资料显示该产品面向女性友好身体探索或伴侣亲密玩法",
          source: "structured" as const,
        },
      ];

  return {
    featureVersion: payload.featureVersion,
    ...payload.features,
    evidence,
  };
}

function buildRawDescription(product: ShopifyProduct, row: Omit<HelloNancySourceRow, "rawDescription">) {
  return [
    "[基础信息]",
    `商品名: ${row.name}`,
    row.productType ? `产品类型: ${row.productType}` : "",
    row.vendor ? `品牌/供应商: ${row.vendor}` : "",
    row.priceUsd ? `页面价格(USD): ${row.priceUsd}` : "",
    row.originalPriceUsd ? `原价(USD): ${row.originalPriceUsd}` : "",
    row.skuList.length ? `SKU: ${row.skuList.join(" / ")}` : "",
    row.colors.length ? `颜色选项: ${row.colors.join(" / ")}` : "",
    row.categoryHints.length ? `站内分类提示: ${row.categoryHints.join(" | ")}` : "",
    `性别提示: ${row.genderHint}`,
    "",
    "[英文详情]",
    normalizeBlock(product.body_html) || `${row.name} official Hello Nancy product.`,
    "",
    `[来源链接] ${row.sourceUrl}`,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 12000)
    .trim();
}

function sourceRowFromShopifyProduct(product: ShopifyProduct, listPosition: number): HelloNancySourceRow | null {
  const handle = normalizeText(product.handle);
  const sourceUrl = buildProductUrlFromHandle(handle);
  const name = normalizeNonEmpty(product.title, "Hello Nancy 未命名商品");
  const { priceUsd, originalPriceUsd } = resolvePriceFromProduct(product);
  const categoryHints = uniqueStrings([product.product_type, ...normalizeTags(product.tags), "Hello Nancy All Products"], 80);
  const detailImageUrls = uniqueStrings((product.images ?? []).map((image) => normalizeImageUrl(image.src)), 40);
  const rowWithoutDescription = {
    sourceUrl,
    name,
    safeDisplayName: buildSafeDisplayName(name),
    subtitle: normalizeInline(product.product_type),
    priceUsd,
    originalPriceUsd,
    coverImage: detailImageUrls[0] || "",
    detailImageUrls,
    colors: extractColors(product),
    skuList: uniqueStrings((product.variants ?? []).map((variant) => variant.sku), 40),
    categoryHints,
    genderHint: "female" as const,
    productType: normalizeInline(product.product_type),
    vendor: normalizeInline(product.vendor),
    handle,
    listPosition,
    specs: {
      price_source_currency: "USD",
      price_usd: priceUsd,
      original_price_usd: originalPriceUsd,
      price_rmb: normalizePositivePrice((priceUsd ?? 1) * HELLONANCY_USD_TO_CNY_RATE),
      fx_rate_usd_cny: HELLONANCY_USD_TO_CNY_RATE,
      fx_rate_source: "fixed",
    },
  } satisfies Omit<HelloNancySourceRow, "rawDescription">;
  const row = {
    ...rowWithoutDescription,
    rawDescription: buildRawDescription(product, rowWithoutDescription),
  } satisfies HelloNancySourceRow;
  return shouldKeepHelloNancyFemaleSourceRow(row) ? { ...row, genderHint: inferGender(row) } : null;
}

export function extractHelloNancyFemaleRowsFromShopifyCatalog(payload: ShopifyCatalogResponse | ShopifyProduct[]) {
  const products = Array.isArray(payload) ? payload : payload.products ?? [];
  return products
    .map((product, index) => sourceRowFromShopifyProduct(product, index + 1))
    .filter((row): row is HelloNancySourceRow => Boolean(row));
}

export function buildHelloNancyFemaleRefreshPatch(row: Partial<HelloNancySourceRow>): HelloNancyFemaleRefreshPatch {
  const name = normalizeNonEmpty(row.name, "Hello Nancy 未命名商品");
  const rawDescription = normalizeNonEmpty(
    row.rawDescription,
    `[基础信息]\n商品名: ${name}\n站内分类提示: Hello Nancy All Products\n性别提示: female/unisex\n[英文详情]\nHello Nancy official female-friendly product from ${HELLONANCY_FEMALE_LIST_URL}.\n[来源链接] ${normalizeProductUrl(row.sourceUrl) || HELLONANCY_FEMALE_LIST_URL}`,
  );
  const typePatch = resolveTypePatch({ ...row, rawDescription });
  const source = buildTrustedSource({ ...row, rawDescription });
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
    maxDb: Number.isFinite(maxDb) ? maxDb : 40,
    waterproof: Number.isFinite(waterproof) ? waterproof : 7,
    appearance: normalizeNonEmpty(row.specs?.appearance, normalizeAppearance(source)),
    physicalForm: normalizePhysicalForm(typeCode, source),
    motorType: normalizeMotorType(source, typeCode),
    gender: inferGender({ ...row, rawDescription }),
    brand: HELLONANCY_BRAND_NAME,
    material: normalizeNonEmpty(row.specs?.material, inferMaterial({ ...row, rawDescription })),
    link: normalizeNonEmpty(normalizeProductUrl(row.sourceUrl), HELLONANCY_FEMALE_LIST_URL),
    imageUrl: normalizeNonEmpty(normalizeImageUrl(row.coverImage ?? row.detailImageUrls?.[0]), placeholderImageForSubtype(subtypeCode)),
    rawDescription,
    typeCode,
    subtypeCode,
    productTags: productTags.length > 0 ? productTags : ["女性友好", "身体探索"],
    productSpecs: {
      ...(row.specs ?? {}),
      rawDescription,
      sourceUrl: normalizeProductUrl(row.sourceUrl),
      officialListUrl: HELLONANCY_FEMALE_LIST_URL,
      price_source_currency: "USD",
      price_usd: row.priceUsd ?? row.specs?.price_usd ?? null,
      original_price_usd: row.originalPriceUsd ?? row.specs?.original_price_usd ?? null,
      price_rmb: normalizeRmbPrice(row),
      fx_rate_usd_cny: HELLONANCY_USD_TO_CNY_RATE,
      fx_rate_source: "fixed",
      colors: row.colors ?? [],
      sku_list: row.skuList ?? [],
      product_type: row.productType ?? "",
      vendor: row.vendor ?? "",
      type_code: typeCode,
      subtype_code: subtypeCode,
      officialCleanedAt: new Date().toISOString(),
    },
  } satisfies Omit<HelloNancyFemaleRefreshPatch, "recommendationFeatures">;

  return {
    ...patchWithoutFeatures,
    recommendationFeatures: buildRecommendationFeaturesForPatch(patchWithoutFeatures),
  };
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, { headers: REQUEST_HEADERS, redirect: "follow" });
  if (!response.ok) throw new Error(`GET ${url} failed: ${response.status}`);
  return (await response.json()) as T;
}

export async function fetchHelloNancyOfficialSourceRows() {
  const rows: HelloNancySourceRow[] = [];
  for (let page = 1; rows.length < HELLONANCY_OFFICIAL_MAX_ITEMS; page += 1) {
    const url = new URL(`${HELLONANCY_FEMALE_LIST_URL.replace(/\/$/, "")}/products.json`);
    url.searchParams.set("limit", "250");
    url.searchParams.set("page", String(page));
    const payload = await fetchJson<ShopifyCatalogResponse>(url.toString());
    const products = Array.isArray(payload.products) ? payload.products : [];
    if (products.length === 0) break;
    rows.push(...extractHelloNancyFemaleRowsFromShopifyCatalog(products));
    console.log(`[refresh-hellonancy-female-products-from-official] 已抓取列表页 ${page}，累计 ${rows.length}`);
    if (products.length < 250) break;
  }
  const limited = rows.slice(0, HELLONANCY_OFFICIAL_MAX_ITEMS);
  fs.writeFileSync(HELLONANCY_REVIEW_BUFFER_PATH, `${JSON.stringify(limited, null, 2)}\n`);
  return limited;
}

async function ensureHelloNancyCompetitor(client: PgClientLike) {
  const prismaLike = {
    competitors: {
      findFirst: async (args: any) => {
        const names = args?.where?.OR?.flatMap((entry: any) => {
          const nameFilter = entry?.name;
          const value = typeof nameFilter === "object" ? nameFilter?.contains : nameFilter;
          return value ? [value] : [];
        }) ?? [HELLONANCY_BRAND_NAME];
        const result = await client.query(
          `
            SELECT id, name, domain, country, founded_date, description, focus,
                   philosophy, major_user_group_profile, is_domestic
            FROM public.competitors
            WHERE lower(name) = ANY($1::text[])
               OR lower(coalesce(name, '')) LIKE ANY($2::text[])
               OR lower(coalesce(domain, '')) LIKE '%hellonancy%'
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
          [args.where.id, data.domain, data.country, data.founded_date, data.description, data.focus, data.philosophy ?? [], data.major_user_group_profile, data.is_domestic],
        );
        return result.rows[0];
      },
    },
  } satisfies PrismaLike;

  return await ensureCompetitorRecord({
    prisma: prismaLike,
    withDbRetry: async (_label, action) => await action(),
    brandName: HELLONANCY_BRAND_NAME,
    overrideConfig: HELLONANCY_COMPETITOR_CONFIG,
  });
}

async function ensureProductForPatch(client: PgClientLike, patch: HelloNancyFemaleRefreshPatch, competitorId: string | null) {
  const existing = await client.query(
    `
      SELECT id
      FROM public.products
      WHERE lower(name) = lower($1)
        AND (competitor_id = $2::uuid OR $2::uuid IS NULL OR lower(coalesce(link, '')) = lower($3))
      ORDER BY CASE WHEN lower(coalesce(link, '')) = lower($3) THEN 0 ELSE 1 END, created_at DESC NULLS LAST
      LIMIT 1
    `,
    [patch.name, competitorId, patch.link],
  );
  const values = [competitorId, patch.name, patch.price, patch.productTags, patch.link, patch.imageUrl, patch.gender, JSON.stringify(patch.productSpecs)];
  const result = existing.rows[0]?.id
    ? await client.query(
        `
          UPDATE public.products
          SET competitor_id = $2::uuid, price = $3, category = 'female_toy', tags = $4::text[],
              link = $5, image = $6, gender = CASE WHEN $7 = 'female' THEN 'Female' ELSE 'Unisex' END,
              specs = $8::jsonb
          WHERE id = $1::uuid
          RETURNING id
        `,
        [
          existing.rows[0].id,
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
          INSERT INTO public.products (competitor_id, name, price, category, tags, link, image, gender, specs)
          VALUES ($1::uuid, $2, $3, 'female_toy', $4::text[], $5, $6,
                  CASE WHEN $7 = 'female' THEN 'Female' ELSE 'Unisex' END, $8::jsonb)
          RETURNING id
        `,
        values,
      );
  const productId = result.rows[0]?.id;
  if (!productId) throw new Error(`products upsert failed: ${patch.name}`);
  return productId as string;
}

async function upsertFemaleToy(client: PgClientLike, patch: HelloNancyFemaleRefreshPatch, competitorId: string | null) {
  const productId = await ensureProductForPatch(client, patch, competitorId);
  const existing = await client.query(
    `
      SELECT id
      FROM public.female_recommender_toys
      WHERE lower(brand) = lower($3)
        AND (original_id = $1::uuid OR lower(coalesce(link, '')) = lower($2) OR lower(name) = lower($4))
      ORDER BY CASE WHEN original_id = $1::uuid THEN 0 WHEN lower(coalesce(link, '')) = lower($2) THEN 1 ELSE 2 END,
               updated_at DESC NULLS LAST, created_at DESC NULLS LAST
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
  if (existing.rows[0]?.id) {
    await client.query(
      `
        UPDATE public.female_recommender_toys
        SET original_id = $1::uuid, name = $2, safe_display_name = $3, price = $4,
            max_db = $5, waterproof = $6, appearance = $7, physical_form = $8,
            motor_type = $9, gender = $10, brand = $11, material = $12, link = $13,
            image_url = $14, raw_description = $15, type_code = $16, subtype_code = $17,
            recommendation_features = $18::jsonb, updated_at = NOW()
        WHERE id = $19::uuid
      `,
      [...values, existing.rows[0].id],
    );
    return;
  }
  await client.query(
    `
      INSERT INTO public.female_recommender_toys (
        original_id, name, safe_display_name, price, max_db, waterproof, appearance,
        physical_form, motor_type, gender, brand, material, link, image_url,
        raw_description, type_code, subtype_code, recommendation_features
      )
      VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb)
    `,
    values,
  );
}

async function backfillIncompleteHelloNancyRows(client: PgClientLike, competitorId: string | null) {
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
    [HELLONANCY_BRAND_NAME],
  );

  if (incomplete.rows.length === 0) return 0;

  for (const row of incomplete.rows) {
    const name = normalizeNonEmpty(row.name ?? row.safe_display_name, "Hello Nancy 未命名商品");
    const sourceRow: Partial<HelloNancySourceRow> = {
      sourceUrl: normalizeNonEmpty(row.link, `${HELLONANCY_FEMALE_LIST_URL}#${row.id}`),
      name,
      safeDisplayName: normalizeNonEmpty(row.safe_display_name, buildSafeDisplayName(name)),
      subtitle: normalizeNonEmpty(row.subtype_code, "Hello Nancy official female-friendly product"),
      coverImage: normalizeNonEmpty(row.image_url, placeholderImageForSubtype(row.subtype_code || "")),
      rawDescription: normalizeNonEmpty(
        row.raw_description,
        `[基础信息]\n商品名: ${name}\n站内分类提示: Hello Nancy official female-friendly product\n性别提示: ${normalizeText(row.gender) || "female"}\n价格: 历史记录价格\n[英文详情]\nHello Nancy 官方女性/伴侣友好产品记录，字段由兜底清洗流程补齐。\n[来源链接] ${normalizeNonEmpty(row.link, HELLONANCY_FEMALE_LIST_URL)}`,
      ),
      detailImageUrls: [],
      colors: [],
      skuList: [],
      categoryHints: uniqueStrings([row.type_code, row.subtype_code, row.physical_form, row.link, "Hello Nancy official"], 30),
      genderHint: normalizeLower(row.gender) === "unisex" ? "unisex" : "female",
      productType: normalizeText(row.type_code),
      vendor: HELLONANCY_BRAND_NAME,
      handle: "",
      listPosition: 0,
      specs: {
        price_rmb: Number(row.price) || 1,
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
    const patch = buildHelloNancyFemaleRefreshPatch(sourceRow);
    const productId = row.original_id ?? (await ensureProductForPatch(client, patch, competitorId));
    await client.query(
      `
        UPDATE public.female_recommender_toys
        SET original_id = $1::uuid, name = $2, safe_display_name = $3, price = $4,
            max_db = $5, waterproof = $6, appearance = $7, physical_form = $8,
            motor_type = $9, gender = $10, brand = $11, material = $12, link = $13,
            image_url = $14, raw_description = $15, type_code = $16, subtype_code = $17,
            recommendation_features = $18::jsonb, updated_at = NOW()
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
  console.log(`[refresh-hellonancy-female-products-from-official] 已兜底修复不完整行 ${incomplete.rows.length} 条`);
  return incomplete.rows.length;
}

export function shouldRunHelloNancyFemaleRefreshScript(importMetaUrl: string, argvEntry?: string) {
  return Boolean(argvEntry && importMetaUrl === pathToFileURL(argvEntry).href);
}

async function loadHelloNancyRows() {
  const sourceMode = normalizeLower(process.env.HELLONANCY_REFRESH_SOURCE || "live");
  if (sourceMode === "buffer") {
    return {
      sourceMode,
      rows: JSON.parse(fs.readFileSync(HELLONANCY_REVIEW_BUFFER_PATH, "utf8")) as HelloNancySourceRow[],
    };
  }
  return { sourceMode, rows: await fetchHelloNancyOfficialSourceRows() };
}

async function runHelloNancyFemaleRefreshAttempt() {
  const { sourceMode, rows } = await loadHelloNancyRows();
  const patches = rows.filter(shouldKeepHelloNancyFemaleSourceRow).map(buildHelloNancyFemaleRefreshPatch);
  const pool = new Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
  let client: pg.PoolClient | null = null;
  try {
    client = await pool.connect();
    await client.query("SET statement_timeout TO 0");
    await client.query("SET lock_timeout TO '5s'");
    const competitorId = await ensureHelloNancyCompetitor(client);
    for (let index = 0; index < patches.length; index += HELLONANCY_REFRESH_BATCH_SIZE) {
      const batch = patches.slice(index, index + HELLONANCY_REFRESH_BATCH_SIZE);
      await client.query("BEGIN");
      try {
        for (const patch of batch) await upsertFemaleToy(client!, patch, competitorId);
        await client.query("COMMIT");
        console.log(`[refresh-hellonancy-female-products-from-official] 已提交 ${Math.min(index + batch.length, patches.length)}/${patches.length}`);
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      }
    }

    await backfillIncompleteHelloNancyRows(client, competitorId);

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
          COUNT(*) FILTER (WHERE jsonb_array_length(coalesce(recommendation_features->'evidence', '[]'::jsonb)) = 0)::int AS rows_with_empty_evidence,
          COUNT(*) FILTER (WHERE lower(COALESCE(type_code, '')) = 'unknown')::int AS rows_with_unknown_type,
          COUNT(*) FILTER (WHERE lower(COALESCE(subtype_code, '')) = 'unknown')::int AS rows_with_unknown_subtype
        FROM public.female_recommender_toys
        WHERE lower(brand) = lower($1)
      `,
      [HELLONANCY_BRAND_NAME],
    );
    console.log(JSON.stringify({ brand: HELLONANCY_BRAND_NAME, source: HELLONANCY_FEMALE_LIST_URL, sourceMode, inputRows: rows.length, refreshed: patches.length, ...audit.rows[0] }, null, 2));
  } finally {
    client?.release();
    await pool.end().catch(() => {});
  }
}

async function runHelloNancyFemaleRefresh() {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await runHelloNancyFemaleRefreshAttempt();
      return;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!/Connection terminated|ECONNRESET|server closed the connection|terminating connection|Can't reach database|P1001|P1017/i.test(message) || attempt === 3) break;
      console.warn(`[refresh-hellonancy-female-products-from-official] 遇到瞬断，重试 ${attempt}/3...`, error);
      await sleep(1500 * attempt);
    }
  }
  throw lastError;
}

if (shouldRunHelloNancyFemaleRefreshScript(import.meta.url, process.argv[1])) {
  runHelloNancyFemaleRefresh().catch((error) => {
    console.error("[refresh-hellonancy-female-products-from-official] 执行失败:", error);
    process.exitCode = 1;
  });
}
