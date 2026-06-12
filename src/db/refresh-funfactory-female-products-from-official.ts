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
import {
  buildNormalizedSpecs,
  inferFunFactoryGender,
  normalizeFunFactorySourceAmount,
  type FxSnapshot,
} from "../scraper/funfactory-official/cleaner.ts";
import {
  COLLECTION_JSON_URL,
  crawlCollectionPages,
  extractDetailFromHtml,
  extractDetailFromShopifyProduct,
  LIST_URL,
  ORIGIN,
  type FunFactoryListItem,
  type FunFactoryProductDetail,
  type FunFactoryReviewBufferItem,
  type ShopifyCatalogResponse,
  type ShopifyProduct,
} from "../scraper/funfactory-official/crawler.ts";
import { ensureCompetitorRecord, type CompetitorRegistryConfig } from "../scraper/shared/competitor-registry.ts";

dotenv.config();

const { Pool } = pg;

export const FUNFACTORY_BRAND_NAME = "Fun Factory";
export const FUNFACTORY_OFFICIAL_LIST_URL =
  process.env.FUNFACTORY_OFFICIAL_LIST_URL || LIST_URL;
export const FUNFACTORY_REVIEW_BUFFER_PATH = "src/data/funfactory-official-female-review-buffer.json";
export const FUNFACTORY_EUR_TO_CNY_RATE = Number(process.env.FUNFACTORY_EUR_CNY_RATE || "7.8000");
const FUNFACTORY_REFRESH_BATCH_SIZE = Number(process.env.FUNFACTORY_REFRESH_BATCH_SIZE || "35");
const FUNFACTORY_OFFICIAL_MAX_ITEMS = Number(process.env.FUNFACTORY_OFFICIAL_MAX_ITEMS || "250");

const REQUEST_HEADERS: HeadersInit = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "de-DE,de;q=0.9,en;q=0.8,zh-CN;q=0.7",
  pragma: "no-cache",
  "cache-control": "no-cache",
};

const FUNFACTORY_COMPETITOR_CONFIG: CompetitorRegistryConfig = {
  canonicalName: FUNFACTORY_BRAND_NAME,
  matchNames: ["Fun Factory", "funFactory", "FUN FACTORY"],
  domain: "www.funfactory.com",
  country: "德国",
  description: "Fun Factory 是德国情趣用品品牌，女性向产品覆盖阴蒂外部、G点入体、双刺激、肛塞和情侣共玩等路线。",
  focus: "Unisex",
  philosophy: [
    "以亲肤硅胶、鲜明色彩和人体工学造型形成品牌识别。",
    "女性与情侣产品强调刺激部位、可清洁防水、可充电和易上手体验。",
    "通过外部震动、入体探索、双刺激和后庭产品满足不同愉悦偏好。",
  ],
  majorUserGroupProfile:
    "【核心人口】20-45 岁寻找女性向/伴侣共玩情趣用品的用户。\n【心理特征】关注材质安全、刺激部位、造型友好、防水清洁和是否适合新手。\n【核心痛点】希望快速区分阴蒂外部刺激、G点入体、双刺激、肛塞和情侣共玩等产品类型。",
  isDomestic: false,
};

type Gender = "female" | "unisex";

type FunFactorySourceRow = Partial<FunFactoryReviewBufferItem> & {
  safeDisplayName?: string | null;
  detailImageUrls?: string[] | null;
  specs?: Record<string, unknown> | null;
};

type FunFactoryFemaleRefreshPatch = {
  name: string;
  safeDisplayName: string;
  price: number;
  maxDb: number;
  waterproof: number;
  appearance: string;
  physicalForm: "external" | "internal" | "composite";
  motorType: "gentle" | "strong";
  gender: Gender;
  brand: typeof FUNFACTORY_BRAND_NAME;
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

function uniqueStrings(values: Array<unknown>, limit = 60) {
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

function normalizeProductUrl(value: unknown) {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  try {
    const url = new URL(normalized, ORIGIN);
    url.protocol = "https:";
    url.host = "www.funfactory.com";
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
  if (normalized.startsWith("/")) return `${ORIGIN}${normalized}`;
  return normalized;
}

function normalizePositivePrice(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 1;
}

function normalizeRmbPrice(row: FunFactorySourceRow) {
  const sourceAmount = normalizeFunFactorySourceAmount(
    row.priceSourceAmount ?? row.specs?.price_source_amount,
    String(row.priceCurrency || row.specs?.price_source_currency || "EUR"),
  );
  const priceRmb = Number(row.specs?.price_rmb);
  if (Number.isFinite(priceRmb) && priceRmb > 0) return normalizePositivePrice(priceRmb);
  return normalizePositivePrice((sourceAmount ?? 1) * FUNFACTORY_EUR_TO_CNY_RATE);
}

function buildTrustedSource(row: FunFactorySourceRow) {
  const hints = Array.isArray(row.categoryHints) ? row.categoryHints.join(" ") : "";
  const rawDescription = normalizeBlock(row.rawDescription);
  const rawLead = rawDescription.split(/\n\[规格参数\]|\n\[官方分类\]/u, 1)[0] || rawDescription.slice(0, 1800);
  return `${row.name ?? ""}\n${row.subtitle ?? ""}\n${row.sourceUrl ?? ""}\n${hints}\n${rawLead}`.toLowerCase();
}

function isObviousMaleOnly(row: FunFactorySourceRow) {
  const source = buildTrustedSource(row);
  if (/\bmanta\b|cobra\s*libre|mr\.?\s*boss|\bcobra\b|penis|prostate|p-spot|for him|\bmale\b|\bmen\b|männer|herren|cock|stroker|masturbator|penisvibrator|前列腺|阴茎|陰莖|男用|男性|男士/.test(source)) {
    return true;
  }
  return false;
}

function isObviousNonToy(row: FunFactorySourceRow) {
  const source = buildTrustedSource(row);
  return /gift\s*card|gutschein|ersatzteil|replacement|accessor(?:y|ies)|usb\s*cable|toy\s*bag|cleaner|lubricant|lube|massage\s*oil/.test(source);
}

export function shouldKeepFunFactoryFemaleSourceRow(row: FunFactorySourceRow) {
  if (!normalizeText(row.name) || !normalizeProductUrl(row.sourceUrl)) return false;
  if (isObviousNonToy(row) || isObviousMaleOnly(row)) return false;

  const source = buildTrustedSource(row);
  const gender = inferFunFactoryGender(source);
  const femaleOrSharedSignal =
    gender === "female" ||
    gender === "unisex" ||
    /clitoral|clitoris|klitoris|g-?spot|g-punkt|vaginal|rabbit|auflegevibrator|druckwellen|bi\s*stronic|miss\s*bi|lady\s*bi|stronic|laya|volta|sundaze|limba|bootie|b-ball|plug|anal|couple|couples|partner|for two|阴蒂|陰蒂|g点|女性|情侣|情侶|后庭|肛塞/.test(
      source,
    );

  return femaleOrSharedSignal;
}

function resolveTypePatch(row: FunFactorySourceRow) {
  const source = buildTrustedSource(row);
  const tags = Array.isArray(row.categoryHints) ? row.categoryHints : [];
  const hasPoweredSignal =
    /vibrat|vibe|motor|rechargeable|stronic|pulsator|thrust|震动|振动/.test(source) &&
    !/without\s+vibration|no\s+vibration|non[-\s]*vibration|keine\s+vibration|manual|手动|無震|无震/.test(source);
  const physicalForm = /dual|rabbit|bi\s*stronic|miss\s*bi|lady\s*bi|g-?spot.{0,20}clit|clit.{0,20}g-?spot|双刺激|雙刺激|兔/.test(source)
    ? "composite"
    : /g-?spot|g-punkt|vaginal|insert|dildo|stronic|pulsator|anal|plug|bootie|b-ball|入体|插入|后庭|肛塞/.test(source)
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

  if (/suction|druckwellen|air\s*pulse|pressure\s*wave|wave\s*stimulation|volta|吮吸|压力波|氣脈衝|气脉冲/.test(source) && /g-?spot|insert|vaginal|dual|bi\s*stronic|miss\s*bi|lady\s*bi/.test(source)) {
    return { typeCode: "dual_stimulation", subtypeCode: "suction_dual", maxDb: 50, waterproof: 7 };
  }
  if (/rabbit|miss\s*bi|lady\s*bi|bi\s*stronic|dual|双刺激|雙刺激|兔/.test(source)) {
    return { typeCode: "dual_stimulation", subtypeCode: "rabbit_dual", maxDb: 50, waterproof: 7 };
  }
  if (/suction|druckwellen|air\s*pulse|pressure\s*wave|volta|吮吸|压力波|氣脈衝|气脉冲/.test(source)) {
    return { typeCode: "suction", subtypeCode: "suction_pure", maxDb: 50, waterproof: 7 };
  }
  if (/couple|couples|partner|for two|partner toy|情侣|情侶/.test(source)) {
    return { typeCode: "couples", subtypeCode: physicalForm === "internal" ? "insertable_couples" : "external_couples", maxDb: 50, waterproof: 7 };
  }
  if (/remote|app|bluetooth|wearable|遥控|遙控|穿戴/.test(source)) {
    return { typeCode: "wearable_remote", subtypeCode: physicalForm === "composite" ? "dual_wearable_remote" : "insertable_remote", maxDb: 50, waterproof: 7 };
  }
  if (/wand|massager|massage\s*wand|魔杖|按摩棒/.test(source)) {
    return { typeCode: "external_vibe", subtypeCode: "wand_massager", maxDb: 50, waterproof: 7 };
  }
  if (/anal|plug|bootie|b-ball|butt|后庭|肛塞/.test(source)) {
    return { typeCode: "insertable", subtypeCode: hasPoweredSignal ? "insertable_vibe" : "gspot_insertable", maxDb: hasPoweredSignal ? 50 : 0, waterproof: 7 };
  }
  if (/g-?spot|g-punkt|vaginal|dildo|insert|stronic|pulsator|入体|插入|g点|陰道|阴道/.test(source)) {
    return { typeCode: "insertable", subtypeCode: hasPoweredSignal ? "insertable_vibe" : "gspot_insertable", maxDb: hasPoweredSignal ? 50 : 0, waterproof: 7 };
  }
  if (/clitoral|clit|klitoris|auflegevibrator|laya|yoni|sundaze|limba|bullet|mini|阴蒂|陰蒂/.test(source)) {
    return { typeCode: "external_vibe", subtypeCode: "bullet_vibe", maxDb: 50, waterproof: 7 };
  }
  if (classifiedTypeCode && classifiedTypeCode !== "unknown" && classifiedSubtypeCode) {
    return {
      typeCode: classifiedTypeCode,
      subtypeCode: classifiedSubtypeCode,
      maxDb: classifiedTypeCode === "bdsm" || classifiedTypeCode === "care_accessory" ? 0 : 50,
      waterproof: classifiedTypeCode === "care_accessory" ? 0 : 7,
    };
  }
  return { typeCode: "external_vibe", subtypeCode: "bullet_vibe", maxDb: 50, waterproof: 7 };
}

function normalizePhysicalForm(typeCode: string, source: string): "external" | "internal" | "composite" {
  if (typeCode === "dual_stimulation" || /dual|rabbit|bi\s*stronic|miss\s*bi|lady\s*bi|双刺激|雙刺激|兔/.test(source)) return "composite";
  if (typeCode === "insertable" || typeCode === "wearable_remote" || /g-?spot|g-punkt|vaginal|insert|stronic|anal|plug|入体|插入|后庭|肛塞/.test(source)) return "internal";
  return "external";
}

function normalizeMotorType(source: string, typeCode: string): "gentle" | "strong" {
  if (/stronic|pulsator|thrust|powerful|intense|strong|deep|rumbly|wand|强劲|強力/.test(source)) return "strong";
  if (typeCode === "insertable" && /manual|non-vibration|no vibration|dildo|plug/.test(source) && !/vibrat|motor|rechargeable/.test(source)) return "gentle";
  return "gentle";
}

function normalizeAppearance(source: string) {
  return /laya|layaspot|mini|small|compact|travel|discreet|quiet|便携|便攜|迷你|静音/.test(source) ? "high_disguise" : "normal";
}

function normalizeGender(row: FunFactorySourceRow): Gender {
  const source = buildTrustedSource(row);
  if (/couple|couples|partner|for two|anal|plug|bootie|b-ball|情侣|情侶|后庭|肛塞/.test(source) && !/clitoral|g-?spot|g-punkt|vaginal|rabbit|female|女性|阴蒂|陰蒂/.test(source)) {
    return "unisex";
  }
  return "female";
}

function inferTagsFromText(row: FunFactorySourceRow) {
  const source = buildTrustedSource(row);
  const tags: string[] = [];
  const push = (tag: string, pattern: RegExp) => {
    if (pattern.test(source) && !tags.includes(tag)) tags.push(tag);
  };

  push("阴蒂刺激", /clit|clitoral|klitoris|auflegevibrator|laya|sundaze|limba|陰蒂|阴蒂/);
  push("G点刺激", /g-?spot|g-punkt|g点|g 點/);
  push("入体震动", /vaginal|insert|stronic|pulsator|dildo|入体|入體|插入/);
  push("兔耳双刺激", /rabbit|miss\s*bi|lady\s*bi|雙刺激|双刺激|兔/);
  push("吮吸刺激", /suction|druckwellen|air\s*pulse|pressure\s*wave|volta|吮吸|压力波/);
  push("后庭探索", /anal|plug|bootie|b-ball|butt|后庭|肛塞/);
  push("情侣共玩", /couple|couples|partner|for two|情侣|情侶/);
  push("防水", /waterproof|wasserdicht|防水|ipx/);
  push("可充电", /rechargeable|usb|charging|wiederaufladbar|充电|充電/);
  push("硅胶材质", /silicone|silikon|硅胶|矽膠/);

  return tags;
}

function buildRecommendationFeaturesForPatch(patch: Omit<FunFactoryFemaleRefreshPatch, "recommendationFeatures">) {
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
          text: "Fun Factory 官方资料已补充为亲肤硅胶/身体安全材质",
          source: "structured" as const,
        },
      ];

  return {
    featureVersion: payload.featureVersion,
    ...payload.features,
    evidence,
  };
}

export function buildFunFactoryFemaleRefreshPatch(row: FunFactorySourceRow): FunFactoryFemaleRefreshPatch {
  const name = normalizeNonEmpty(row.name, "Fun Factory 未命名商品");
  const source = buildTrustedSource(row);
  const fx: FxSnapshot = { rate: FUNFACTORY_EUR_TO_CNY_RATE, source: "fallback", date: null, currency: "EUR" };
  const normalizedSpecs = buildNormalizedSpecs(row, fx);
  const typePatch = resolveTypePatch(row);
  const rawDescription = normalizeNonEmpty(
    row.rawDescription,
    `[基础信息]\n商品名: ${name}\n站内分类提示: alle-sextoys\n性别提示: female/unisex\n[卖点摘要]\nFun Factory 官方女性/伴侣友好商品，来自 ${FUNFACTORY_OFFICIAL_LIST_URL}。\n[来源链接] ${normalizeProductUrl(row.sourceUrl) || FUNFACTORY_OFFICIAL_LIST_URL}`,
  );
  const typeCode = normalizeNonEmpty(row.specs?.type_code && row.specs.type_code !== "unknown" ? row.specs.type_code : typePatch.typeCode, normalizedSpecs.type_code || "external_vibe");
  const subtypeCode = normalizeNonEmpty(row.specs?.subtype_code ?? typePatch.subtypeCode, normalizedSpecs.subtype_code || "bullet_vibe");
  const productTags = uniqueStrings([
    ...(Array.isArray(row.specs?.function_tags) ? row.specs.function_tags : []),
    ...normalizedSpecs.function_tags,
    ...inferTagsFromText(row),
  ]);
  const maxDb = Number(row.specs?.max_db ?? normalizedSpecs.max_db ?? typePatch.maxDb);
  const waterproof = Number(row.specs?.waterproof ?? normalizedSpecs.waterproof ?? typePatch.waterproof);

  const patchWithoutFeatures = {
    name,
    safeDisplayName: normalizeNonEmpty(row.safeDisplayName, buildSafeDisplayName(name)),
    price: normalizeRmbPrice(row),
    maxDb: Number.isFinite(maxDb) ? maxDb : typePatch.maxDb,
    waterproof: Number.isFinite(waterproof) ? waterproof : typePatch.waterproof,
    appearance: normalizeNonEmpty(row.specs?.appearance ?? normalizedSpecs.appearance, normalizeAppearance(source)),
    physicalForm: normalizePhysicalForm(typeCode, source),
    motorType: normalizeMotorType(source, typeCode),
    gender: normalizeGender(row),
    brand: FUNFACTORY_BRAND_NAME,
    material: normalizeNonEmpty(row.specs?.material ?? normalizedSpecs.material, "亲肤硅胶"),
    link: normalizeNonEmpty(normalizeProductUrl(row.sourceUrl), FUNFACTORY_OFFICIAL_LIST_URL),
    imageUrl: normalizeNonEmpty(
      normalizeImageUrl(row.coverImage ?? row.detailImageUrls?.[0] ?? row.galleryImages?.[0]),
      "/assets/product-placeholder/bullet_vibe.png",
    ),
    rawDescription,
    typeCode,
    subtypeCode,
    productTags: productTags.length > 0 ? productTags : ["女性友好", "亲肤硅胶"],
    productSpecs: {
      ...(row.specs ?? {}),
      ...normalizedSpecs,
      rawDescription,
      sourceUrl: normalizeProductUrl(row.sourceUrl),
      officialListUrl: FUNFACTORY_OFFICIAL_LIST_URL,
      officialCleanedAt: new Date().toISOString(),
    },
  } satisfies Omit<FunFactoryFemaleRefreshPatch, "recommendationFeatures">;

  return {
    ...patchWithoutFeatures,
    recommendationFeatures: buildRecommendationFeaturesForPatch(patchWithoutFeatures),
  };
}

async function fetchText(url: string) {
  const response = await fetch(url, { headers: REQUEST_HEADERS });
  if (!response.ok) throw new Error(`GET ${url} failed: ${response.status}`);
  return await response.text();
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, {
    headers: { ...REQUEST_HEADERS, accept: "application/json,text/plain;q=0.9,*/*;q=0.8" },
  });
  if (!response.ok) throw new Error(`GET ${url} failed: ${response.status}`);
  return (await response.json()) as T;
}

async function fetchProductJson(handle: string) {
  return await fetchJson<ShopifyProduct>(`${ORIGIN}/products/${handle}.js`);
}

function mergeDetail(item: FunFactoryListItem, htmlDetail: FunFactoryProductDetail | null, jsonDetail: FunFactoryProductDetail | null): FunFactorySourceRow {
  const detail = {
    ...(htmlDetail || {
      title: item.name,
      subtitle: item.subtitle,
      metaTitle: item.name,
      metaDescription: "",
      priceSourceAmount: item.priceSourceAmount,
      originalPriceSourceAmount: item.originalPriceSourceAmount,
      priceCurrency: "EUR" as const,
      coverImage: item.coverImage,
      galleryImages: [],
      rawDescription: "",
    }),
    ...jsonDetail,
    rawDescription: uniqueStrings([jsonDetail?.rawDescription, htmlDetail?.rawDescription, item.subtitle], 120).join("\n"),
    galleryImages: uniqueStrings([...(jsonDetail?.galleryImages || []), ...(htmlDetail?.galleryImages || [])], 30),
    coverImage: jsonDetail?.coverImage || htmlDetail?.coverImage || item.coverImage,
    title: jsonDetail?.title || htmlDetail?.title || item.name,
    subtitle: jsonDetail?.subtitle || htmlDetail?.subtitle || item.subtitle,
    metaTitle: jsonDetail?.metaTitle || htmlDetail?.metaTitle || item.name,
    metaDescription: htmlDetail?.metaDescription || "",
    priceSourceAmount: jsonDetail?.priceSourceAmount ?? htmlDetail?.priceSourceAmount ?? item.priceSourceAmount,
    originalPriceSourceAmount:
      jsonDetail?.originalPriceSourceAmount ?? htmlDetail?.originalPriceSourceAmount ?? item.originalPriceSourceAmount,
    priceCurrency: "EUR" as const,
  };

  return {
    ...item,
    ...detail,
    name: normalizeNonEmpty(detail.title, item.name),
    safeDisplayName: buildSafeDisplayName(normalizeNonEmpty(detail.title, item.name)),
    detailImageUrls: detail.galleryImages,
    isReviewed: false,
  };
}

export async function fetchFunFactoryOfficialSourceRows() {
  const listItems = await crawlCollectionPages({
    maxItems: FUNFACTORY_OFFICIAL_MAX_ITEMS,
    fetchCollectionHtml: (url) => fetchText(url),
    fetchCollectionJsonPage: (page) =>
      fetchJson<ShopifyCatalogResponse>(`${COLLECTION_JSON_URL}?limit=250&page=${page}`),
  });

  const rows: FunFactorySourceRow[] = [];
  for (let index = 0; index < listItems.length; index += 8) {
    const batch = listItems.slice(index, index + 8);
    const batchRows = await Promise.all(
      batch.map(async (item) => {
        const handle = item.sourceUrl.match(/\/products\/([^/?#]+)/i)?.[1] || "";
        const [jsonDetail, htmlDetail] = await Promise.all([
          handle ? fetchProductJson(handle).then(extractDetailFromShopifyProduct).catch(() => null) : Promise.resolve(null),
          fetchText(item.sourceUrl).then((html) => extractDetailFromHtml(html, item.sourceUrl)).catch(() => null),
        ]);
        return mergeDetail(item, htmlDetail, jsonDetail);
      }),
    );
    rows.push(...batchRows);
    console.log(`[refresh-funfactory-female-products-from-official] 已抓取详情 ${rows.length}/${listItems.length}`);
  }

  fs.writeFileSync(FUNFACTORY_REVIEW_BUFFER_PATH, `${JSON.stringify(rows, null, 2)}\n`);
  return rows;
}

async function ensureFunFactoryCompetitor(client: PgClientLike) {
  const prismaLike = {
    competitors: {
      findFirst: async (args: any) => {
        const names = args?.where?.OR?.flatMap((entry: any) => {
          const nameFilter = entry?.name;
          const value = typeof nameFilter === "object" ? nameFilter?.contains : nameFilter;
          return value ? [value] : [];
        }) ?? [FUNFACTORY_BRAND_NAME];
        const result = await client.query(
          `
            SELECT id, name, domain, country, founded_date, description, focus,
                   philosophy, major_user_group_profile, is_domestic
            FROM public.competitors
            WHERE lower(name) = ANY($1::text[])
               OR lower(coalesce(name, '')) LIKE ANY($2::text[])
               OR lower(coalesce(domain, '')) LIKE '%funfactory.com%'
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
    brandName: FUNFACTORY_BRAND_NAME,
    overrideConfig: FUNFACTORY_COMPETITOR_CONFIG,
  });
}

async function upsertProductAndFemaleToy(
  client: PgClientLike,
  patch: FunFactoryFemaleRefreshPatch,
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

async function backfillIncompleteFunFactoryRows(
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
    [FUNFACTORY_BRAND_NAME],
  );

  if (incomplete.rows.length === 0) return 0;

  for (const row of incomplete.rows) {
    const name = normalizeNonEmpty(row.name ?? row.safe_display_name, "Fun Factory 未命名商品");
    const link = normalizeNonEmpty(row.link, `${FUNFACTORY_OFFICIAL_LIST_URL}#${row.id}`);
    const sourceRow: FunFactorySourceRow = {
      sourceUrl: link,
      name,
      safeDisplayName: normalizeNonEmpty(row.safe_display_name, buildSafeDisplayName(name)),
      subtitle: normalizeNonEmpty(row.type_code, "Fun Factory official female/shared product"),
      priceSourceAmount: Number(row.price) / FUNFACTORY_EUR_TO_CNY_RATE,
      priceCurrency: "EUR",
      coverImage: normalizeNonEmpty(row.image_url, "/assets/product-placeholder/bullet_vibe.png"),
      rawDescription: normalizeNonEmpty(
        row.raw_description,
        `[基础信息]\n商品名: ${name}\n站内分类提示: alle-sextoys\n性别提示: female/unisex\n[卖点摘要]\nFun Factory 官方女性/伴侣友好商品记录，字段由清洗兜底流程补齐。\n[来源链接] ${link}`,
      ),
      categoryHints: uniqueStrings([row.type_code, row.subtype_code, row.physical_form, link]),
      genderHint: "unisex",
      specs: {
        price_rmb: Number(row.price) || undefined,
        type_code: normalizeText(row.type_code) && normalizeLower(row.type_code) !== "unknown" ? row.type_code : undefined,
        subtype_code: normalizeText(row.subtype_code) || undefined,
        max_db: Number(row.max_db) || undefined,
        waterproof: Number(row.waterproof) || undefined,
        appearance: normalizeText(row.appearance) || undefined,
        physical_form: normalizeText(row.physical_form) || undefined,
        motor_type: normalizeText(row.motor_type) || undefined,
        gender: normalizeText(row.gender) || undefined,
        material: normalizeText(row.material) || undefined,
      },
    };
    const patch = buildFunFactoryFemaleRefreshPatch(sourceRow);
    await upsertProductAndFemaleToy(client, patch, competitorId);
  }

  console.log(`[refresh-funfactory-female-products-from-official] 已兜底修复不完整行 ${incomplete.rows.length} 条`);
  return incomplete.rows.length;
}

export function shouldRunFunFactoryFemaleRefreshScript(importMetaUrl: string, argvEntry?: string) {
  return Boolean(argvEntry && importMetaUrl === pathToFileURL(argvEntry).href);
}

async function loadFunFactorySourceRows() {
  const sourceMode = normalizeLower(process.env.FUNFACTORY_REFRESH_SOURCE || "live");
  if (sourceMode === "buffer") {
    return {
      sourceMode,
      rows: JSON.parse(fs.readFileSync(FUNFACTORY_REVIEW_BUFFER_PATH, "utf8")) as FunFactorySourceRow[],
    };
  }
  return {
    sourceMode,
    rows: await fetchFunFactoryOfficialSourceRows(),
  };
}

async function runFunFactoryFemaleProductsRefreshAttempt() {
  const { sourceMode, rows } = await loadFunFactorySourceRows();
  const patches = rows.filter(shouldKeepFunFactoryFemaleSourceRow).map(buildFunFactoryFemaleRefreshPatch);
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
      console.warn("[refresh-funfactory-female-products-from-official] 数据库连接 error event:", error);
    });

    await client.query("SET statement_timeout TO 0");
    await client.query("SET lock_timeout TO '5s'");

    const competitorId = await ensureFunFactoryCompetitor(client);
    const refreshMode = normalizeLower(process.env.FUNFACTORY_REFRESH_MODE || "incremental");
    if (refreshMode === "replace") {
      await client.query("BEGIN");
      await client.query("DELETE FROM public.female_recommender_toys WHERE lower(brand) = lower($1)", [FUNFACTORY_BRAND_NAME]);
      await client.query("COMMIT");
    }

    for (let index = 0; index < patches.length; index += FUNFACTORY_REFRESH_BATCH_SIZE) {
      const batch = patches.slice(index, index + FUNFACTORY_REFRESH_BATCH_SIZE);
      await client.query("BEGIN");
      try {
        for (const patch of batch) {
          await upsertProductAndFemaleToy(client, patch, competitorId);
        }
        await client.query("COMMIT");
        console.log(
          `[refresh-funfactory-female-products-from-official] 已提交 ${Math.min(index + batch.length, patches.length)}/${patches.length}`,
        );
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      }
    }

    await backfillIncompleteFunFactoryRows(client, competitorId);

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
      [FUNFACTORY_BRAND_NAME],
    );

    console.log(
      JSON.stringify(
        {
          brand: FUNFACTORY_BRAND_NAME,
          source: FUNFACTORY_OFFICIAL_LIST_URL,
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

async function runFunFactoryFemaleProductsRefresh() {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await runFunFactoryFemaleProductsRefreshAttempt();
      return;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!/Connection terminated|ECONNRESET|server closed the connection|terminating connection|Can't reach database|P1001|P1017/i.test(message) || attempt === 3) {
        break;
      }
      console.warn(`[refresh-funfactory-female-products-from-official] 遇到瞬断，重试 ${attempt}/3...`, error);
      await sleep(1500 * attempt);
    }
  }
  throw lastError;
}

if (shouldRunFunFactoryFemaleRefreshScript(import.meta.url, process.argv[1])) {
  runFunFactoryFemaleProductsRefresh().catch((error) => {
    console.error("[refresh-funfactory-female-products-from-official] 执行失败:", error);
    process.exitCode = 1;
  });
}
