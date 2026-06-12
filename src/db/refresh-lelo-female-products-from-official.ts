import dotenv from "dotenv";
import { execFile } from "node:child_process";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

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
const execFileAsync = promisify(execFile);
const LELO_FETCH_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

export const LELO_BRAND_NAME = "LELO";
export const LELO_WOMEN_LIST_URL =
  process.env.LELO_OFFICIAL_LIST_URL || "https://www.lelo.com/zh-hant/sex-toys-for-women";
export const LELO_REVIEW_BUFFER_PATH = "src/data/lelo-official-female-review-buffer.json";
export const LELO_TWD_TO_CNY_RATE = Number(process.env.LELO_TWD_CNY_RATE || "0.2140");
const LELO_REFRESH_BATCH_SIZE = Number(process.env.LELO_REFRESH_BATCH_SIZE || "30");
const LELO_OFFICIAL_MAX_ITEMS = Number(process.env.LELO_OFFICIAL_MAX_ITEMS || "120");

const LELO_COMPETITOR_CONFIG: CompetitorRegistryConfig = {
  canonicalName: LELO_BRAND_NAME,
  matchNames: ["lelo", "莱洛", "樂洛"],
  domain: "www.lelo.com",
  country: "瑞典",
  description: "LELO 是以高完成度工业设计、亲肤材质和女性/伴侣愉悦体验见长的高端情趣科技品牌。",
  focus: "Unisex",
  philosophy: [
    "以奢华设计、材质安全和低噪体验建立品牌识别。",
    "覆盖女性向、男性向与伴侣共玩场景，其中女性线强调阴蒂、G点、双刺激与声波技术。",
    "通过 SONA、SILA、ENIGMA、SORAYA、INA、GIGI 等系列形成清晰产品家族。",
  ],
  majorUserGroupProfile:
    "【核心人口】20-45 岁重视审美、材质和品牌可信度的女性用户及伴侣用户。\n【心理特征】关注高级感、低噪、防水、便携和不同刺激部位的细分体验。\n【核心痛点】希望快速区分声波阴蒂刺激、G点入体、兔耳双刺激、魔杖按摩和凯格尔训练等产品路线。",
  isDomestic: false,
};

type JsonRecord = Record<string, unknown>;

type LeloListItem = {
  position?: number | null;
  name: string;
  sourceUrl: string;
};

type LeloSourceRow = {
  sourceUrl?: string | null;
  name?: string | null;
  safeDisplayName?: string | null;
  sku?: string | null;
  schemaType?: string | null;
  price?: number | string | null;
  priceCurrency?: string | null;
  image?: string | null;
  rawDescription?: string | null;
  genderHint?: string | null;
  categoryHints?: string[] | null;
  detailImageUrls?: string[] | null;
  specs?: Record<string, unknown> | null;
};

type LeloFemaleRefreshPatch = {
  name: string;
  safeDisplayName: string;
  price: number;
  maxDb: number;
  waterproof: number;
  appearance: string;
  physicalForm: "external" | "internal" | "composite";
  motorType: "gentle" | "strong";
  gender: "female" | "unisex";
  brand: typeof LELO_BRAND_NAME;
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

function normalizeImageUrl(value: unknown) {
  const normalized = normalizeText(Array.isArray(value) ? value[0] : value);
  if (!normalized) return "";
  if (normalized.startsWith("//")) return `https:${normalized}`;
  if (normalized.startsWith("/")) return `https://www.lelo.com${normalized}`;
  return normalized;
}

function parsePositiveNumber(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/[^\d.]+/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizePositivePrice(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 1;
}

function normalizeRmbPrice(row: LeloSourceRow) {
  const currency = normalizeLower(row.priceCurrency || row.specs?.price_source_currency || "TWD");
  const sourceAmount = Number(row.price ?? row.specs?.price_source_amount);
  const currencyKey = currency.toUpperCase();
  const currencyRates = row.specs?.fx_rates_cny && typeof row.specs.fx_rates_cny === "object"
    ? (row.specs.fx_rates_cny as Record<string, unknown>)
    : {};
  const rate = currency === "cny"
    ? 1
    : Number(
        row.specs?.[`fx_rate_${currency}_cny`] ??
          currencyRates[currencyKey] ??
          (currency === "twd" ? row.specs?.fx_rate_twd_cny : null) ??
          LELO_TWD_TO_CNY_RATE,
      );
  if (currency === "twd") return normalizePositivePrice(sourceAmount * rate);
  if (currency === "cny") return normalizePositivePrice(sourceAmount);
  return normalizePositivePrice(sourceAmount * rate);
}

function normalizeProductUrl(href: unknown, baseUrl = LELO_WOMEN_LIST_URL) {
  const trimmed = normalizeText(href);
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed, baseUrl);
    url.protocol = "https:";
    url.host = "www.lelo.com";
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.replace(/\/$/, "");
    return url.toString();
  } catch {
    return "";
  }
}

function extractJsonLdScripts(html: string) {
  const scripts = Array.from(
    html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
  );
  return scripts.flatMap((match) => {
    try {
      return [JSON.parse(match[1] || "{}") as JsonRecord];
    } catch {
      return [];
    }
  });
}

function flattenJsonLdNodes(value: unknown): JsonRecord[] {
  if (!value || typeof value !== "object") return [];
  const node = value as JsonRecord;
  const graph = Array.isArray(node["@graph"]) ? node["@graph"] : [node];
  return graph.flatMap((entry) => (entry && typeof entry === "object" ? [entry as JsonRecord] : []));
}

export function extractLeloWomenListItems(html: string, listUrl = LELO_WOMEN_LIST_URL): LeloListItem[] {
  const items: LeloListItem[] = [];
  const seen = new Set<string>();
  for (const parsed of extractJsonLdScripts(html)) {
    for (const node of flattenJsonLdNodes(parsed)) {
      const mainEntity = node.mainEntity && typeof node.mainEntity === "object" ? (node.mainEntity as JsonRecord) : null;
      const itemListElement = Array.isArray(mainEntity?.itemListElement) ? mainEntity.itemListElement : [];
      for (const entry of itemListElement) {
        if (!entry || typeof entry !== "object") continue;
        const item = (entry as JsonRecord).item && typeof (entry as JsonRecord).item === "object"
          ? ((entry as JsonRecord).item as JsonRecord)
          : null;
        const sourceUrl = normalizeProductUrl(item?.url ?? item?.["@id"] ?? (entry as JsonRecord).url, listUrl);
        const name = normalizeInline(item?.name ?? (entry as JsonRecord).name);
        if (!sourceUrl || !name || seen.has(sourceUrl)) continue;
        seen.add(sourceUrl);
        items.push({
          position: Number((entry as JsonRecord).position) || null,
          name,
          sourceUrl,
        });
      }
    }
  }
  return items;
}

function extractProductSchema(html: string) {
  for (const parsed of extractJsonLdScripts(html)) {
    for (const node of flattenJsonLdNodes(parsed)) {
      const typeText = Array.isArray(node["@type"]) ? node["@type"].join(" ") : normalizeText(node["@type"]);
      if (/product/i.test(typeText) && normalizeText(node.name)) return node;
    }
  }
  return null;
}

function extractMetaContent(html: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<meta\\s+[^>]*(?:name|property)=["']${escaped}["'][^>]*content=["']([^"']*)["'][^>]*>|<meta\\s+[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${escaped}["'][^>]*>`,
    "i",
  );
  const match = html.match(pattern);
  return decodeHtml(match?.[1] ?? match?.[2] ?? "");
}

function extractCanonicalUrl(html: string) {
  return decodeHtml(html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i)?.[1] ?? "");
}

function extractTitle(html: string) {
  return stripTags(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s*\|.*$/u, "").trim();
}

function extractCurrencyRates(html: string) {
  const usdRates: Record<string, number> = {};
  for (const match of html.matchAll(/"USD([A-Z]{3})"\s*:\s*\[\s*"([0-9.]+)"/g)) {
    const currency = normalizeText(match[1]);
    const rate = Number(match[2]);
    if (currency && Number.isFinite(rate) && rate > 0) usdRates[currency] = rate;
  }
  const usdCny = usdRates.CNY;
  const usdTwd = usdRates.TWD;
  if (Number.isFinite(usdCny) && usdCny > 0 && Number.isFinite(usdTwd) && usdTwd > 0) {
    const currencyToCny = Object.fromEntries(
      Object.entries(usdRates).map(([currency, usdRate]) => [currency, currency === "CNY" ? 1 : usdCny / usdRate]),
    );
    return { usdCny, usdTwd, twdCny: usdCny / usdTwd, currencyToCny, source: "lelo_dataLayer" };
  }
  return {
    usdCny: null,
    usdTwd: null,
    twdCny: LELO_TWD_TO_CNY_RATE,
    currencyToCny: { CNY: 1, TWD: LELO_TWD_TO_CNY_RATE },
    source: "fallback",
  };
}

async function fetchText(url: string): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "zh-TW,zh;q=0.9,en;q=0.8",
          "user-agent": LELO_FETCH_USER_AGENT,
        },
      });
      if (!response.ok) throw new Error(`GET ${url} failed: ${response.status} ${response.statusText}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      await sleep(600 * attempt);
    }
  }

  try {
    const { stdout } = await execFileAsync(
      "curl",
      [
        "-fsSL",
        "--http1.1",
        "--compressed",
        "--retry",
        "3",
        "--retry-all-errors",
        "--retry-delay",
        "1",
        "--connect-timeout",
        "20",
        "--max-time",
        "90",
        "-A",
        LELO_FETCH_USER_AGENT,
        "-H",
        "accept-language: zh-TW,zh;q=0.9,en;q=0.8",
        url,
      ],
      { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    );
    return stdout;
  } catch (curlError) {
    throw new Error(
      `GET ${url} failed after fetch retries and curl fallback: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }; curl: ${curlError instanceof Error ? curlError.message : String(curlError)}`,
    );
  }
}

function buildTrustedSource(row: LeloSourceRow) {
  const hints = Array.isArray(row.categoryHints) ? row.categoryHints.join(" ") : "";
  const rawDescription = normalizeText(row.rawDescription);
  const rawLead = rawDescription.split(/\n\[规格参数\]|\n\[官方分类\]/u, 1)[0] || rawDescription.slice(0, 1600);
  return `${row.name ?? ""}\n${row.sourceUrl ?? ""}\n${row.schemaType ?? ""}\n${hints}\n${rawLead}`.toLowerCase();
}

function isObviousMaleOnly(row: LeloSourceRow) {
  const source = buildTrustedSource(row);
  const isWomenListCoupleBundle =
    /sex-toys-for-women|女性性愛玩具|女性性玩具/.test(source) &&
    /product bundle|bundle|kit|set|couple play|couples|partner|情侶|情侣|套裝|套装/.test(source) &&
    /tiani|sona|sila|enigma|soraya|ina|hex|moisturizer|lubricant|潤滑|润滑/.test(source);
  if (isWomenListCoupleBundle) return false;
  if (/hugo|loki|bruno|f1s|f1s v3|\btor\b|cock ring|penis ring|prostate|male masturbator|for men|男性|男用|前列腺|阴茎环|陰莖環/.test(source)) {
    return true;
  }
  return false;
}

function isNonProductPage(row: LeloSourceRow) {
  const type = normalizeLower(row.schemaType);
  return !type.includes("product") || !normalizeText(row.sourceUrl) || !normalizeText(row.name);
}

export function shouldKeepLeloFemaleSourceRow(row: LeloSourceRow) {
  const source = buildTrustedSource(row);
  const femaleSignal =
    normalizeLower(row.genderHint) === "female" ||
    /sex-toys-for-women|女性性愛玩具|female collection|for women|clitoral|g-?spot|vaginal|rabbit|sona|sila|enigma|soraya|ina|gigi|mia|lily|siri|tiani|beads|陰蒂|女性|g 點|兔子/.test(source);
  return femaleSignal && !isNonProductPage(row) && !isObviousMaleOnly(row);
}

function resolveTypePatch(row: LeloSourceRow) {
  const source = buildTrustedSource(row);
  const classifierTags = Array.isArray(row.categoryHints) ? row.categoryHints : [];
  const classifiedTypeCode = classifyLibraryTypeCode({
    gender: "female",
    physicalForm: /dual|rabbit|soraya|ina|enigma|雙|双/.test(source)
      ? "composite"
      : /g-?spot|vaginal|insertable|beads|hula|ben wa|gina|陰道|入体|入體/.test(source)
        ? "internal"
        : "external",
    name: row.name,
    rawDescription: row.rawDescription,
    tags: classifierTags,
  });
  const classifiedSubtypeCode = classifyLibrarySubtypeCode({
    gender: "female",
    physicalForm: /dual|rabbit|soraya|ina|enigma|雙|双/.test(source) ? "composite" : undefined,
    name: row.name,
    rawDescription: row.rawDescription,
    tags: classifierTags,
    typeCode: classifiedTypeCode,
  });

  if (/condom|避孕套|保險套/.test(source)) return { typeCode: "care_accessory", subtypeCode: "condom", maxDb: 0, waterproof: 0 };
  if (/lubricant|lube|moisturizer|cleaner|cleaning spray|candle|gel|潤滑|润滑|清潔|清洁|蠟燭|蜡烛/.test(source) && !/sona|sila|enigma|soraya|ina|gigi|vibrat|stimulator|beads|wave/.test(source)) {
    return { typeCode: "care_accessory", subtypeCode: "lube_care", maxDb: 0, waterproof: 0 };
  }
  if (/suction|sonic|sensonic|sona|sila|clitoral stimulator|air pulse|吮吸|声波|聲波|陰蒂刺激/.test(source) && /g-?spot|insertable|soraya|enigma|ina|dual|雙|双/.test(source)) {
    return { typeCode: "dual_stimulation", subtypeCode: "suction_dual", maxDb: 50, waterproof: 7 };
  }
  if (/rabbit|ina|soraya|dual stimulation|雙重|双重|兔/.test(source)) {
    return { typeCode: "dual_stimulation", subtypeCode: "rabbit_dual", maxDb: 50, waterproof: 7 };
  }
  if (/suction|sonic|sensonic|sona|sila|clitoral stimulator|air pulse|吮吸|声波|聲波|陰蒂刺激/.test(source)) {
    return { typeCode: "suction", subtypeCode: "suction_pure", maxDb: 50, waterproof: 7 };
  }
  if (/tiani|ida|lyla|remote|wearable|couples|partner|遙控|遥控|穿戴|情侶|情侣/.test(source)) {
    return { typeCode: "wearable_remote", subtypeCode: "insertable_remote", maxDb: 50, waterproof: 7 };
  }
  if (/beads|ben wa|hula|smart bead|kegel|g-?spot|gigi|liv|mona|elise|vaginal|insertable|陰道|入體|入体|g 點/.test(source)) {
    return { typeCode: "insertable", subtypeCode: "gspot_insertable", maxDb: 50, waterproof: 7 };
  }
  if (/wand|massager|smart wand|按摩棒|魔杖/.test(source)) {
    return { typeCode: "external_vibe", subtypeCode: "wand_massager", maxDb: 50, waterproof: 7 };
  }
  if (classifiedTypeCode && classifiedTypeCode !== "unknown" && classifiedSubtypeCode) {
    return { typeCode: classifiedTypeCode, subtypeCode: classifiedSubtypeCode, maxDb: classifiedTypeCode === "care_accessory" ? 0 : 50, waterproof: classifiedTypeCode === "care_accessory" ? 0 : 7 };
  }
  return { typeCode: "external_vibe", subtypeCode: "bullet_vibe", maxDb: 50, waterproof: 7 };
}

function normalizePhysicalForm(typeCode: string, source: string): "external" | "internal" | "composite" {
  if (typeCode === "dual_stimulation" || /dual|rabbit|soraya|ina|enigma|雙|双/.test(source)) return "composite";
  if (typeCode === "insertable" || typeCode === "wearable_remote" || /g-?spot|vaginal|beads|insertable|入體|入体|陰道/.test(source)) return "internal";
  return "external";
}

function normalizeMotorType(source: string, typeCode: string): "gentle" | "strong" {
  if (typeCode === "care_accessory") return "gentle";
  return /cruise|wave|thrust|wand|smart wand|powerful|intense|strong|深層|強力|强力|魔杖/.test(source) ? "strong" : "gentle";
}

function normalizeAppearance(source: string) {
  return /mia|lily|nea|siri|dot|travel|beads|mini|compact|旅行|便攜|便携|迷你/.test(source) ? "high_disguise" : "normal";
}

function inferGender(row: LeloSourceRow): "female" | "unisex" {
  const source = buildTrustedSource(row);
  if (/couples|partner|tiani|ida|lyla|情侶|情侣/.test(source) && !/g-?spot|vaginal|rabbit|ina|soraya/.test(source)) {
    return "unisex";
  }
  return "female";
}

function inferMaterial(row: LeloSourceRow, typeCode: string) {
  const direct = row.specs?.material;
  if (normalizeText(direct)) return normalizeText(direct);
  const source = buildTrustedSource(row);
  if (/abs|plastic/.test(source)) return "ABS/亲肤硅胶";
  if (/condom|latex|保險套|避孕套/.test(source)) return "乳胶/聚异戊二烯";
  if (typeCode === "care_accessory") return "身体安全护理材质";
  return "亲肤硅胶";
}

function inferTagsFromText(row: LeloSourceRow) {
  const source = buildTrustedSource(row);
  const tags: string[] = [];
  const push = (tag: string, pattern: RegExp) => {
    if (pattern.test(source) && !tags.includes(tag)) tags.push(tag);
  };

  push("声波刺激", /sonic|sensonic|sona|sila|声波|聲波/);
  push("吮吸刺激", /suction|air pulse|吮吸|吸吮/);
  push("阴蒂刺激", /clit|clitoral|dot|siri|sona|sila|陰蒂|阴蒂/);
  push("G点刺激", /g-?spot|gigi|mona|liv|g 點|g点/);
  push("兔耳双刺激", /rabbit|ina|soraya|兔|双重|雙重/);
  push("入体震动", /vaginal|insertable|beads|hula|陰道|入體|入体/);
  push("魔杖按摩", /wand|massager|按摩棒|魔杖/);
  push("遥控", /remote|tiani|ida|lyla|遙控|遥控/);
  push("APP支持", /app|love bridge|long-distance|远程|遠距/);
  push("情侣共玩", /couples|partner|tiani|ida|lyla|情侶|情侣/);
  push("防水", /waterproof|防水/);
  push("可充电", /rechargeable|usb|charging|充電|充电/);
  push("套装", /bundle|kit|set|捆套|套裝|套装/);

  return tags;
}

function buildRecommendationFeaturesForPatch(patch: Omit<LeloFemaleRefreshPatch, "recommendationFeatures">) {
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
          text: "LELO 官方资料已补充为身体安全/亲肤材质",
          source: "structured" as const,
        },
      ];

  return {
    featureVersion: payload.featureVersion,
    ...payload.features,
    evidence,
  };
}

export function buildLeloFemaleRefreshPatch(row: LeloSourceRow): LeloFemaleRefreshPatch {
  const name = normalizeNonEmpty(row.name, "LELO 未命名商品");
  const source = buildTrustedSource(row);
  const typePatch = resolveTypePatch(row);
  const productTags = inferTagsFromText(row);
  const rawDescription = normalizeNonEmpty(
    row.rawDescription,
    `[基础信息]\n商品名: ${name}\n站内分类提示: 女性性愛玩具\n性别提示: female\n[卖点摘要]\nLELO 官方女性商品，来自 ${LELO_WOMEN_LIST_URL}。`,
  );
  const typeCode = normalizeNonEmpty(row.specs?.type_code, typePatch.typeCode);
  const subtypeCode = normalizeNonEmpty(row.specs?.subtype_code, typePatch.subtypeCode);

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
    brand: LELO_BRAND_NAME,
    material: inferMaterial(row, typeCode),
    link: normalizeNonEmpty(row.sourceUrl, LELO_WOMEN_LIST_URL),
    imageUrl: normalizeNonEmpty(row.image ?? row.detailImageUrls?.[0], "/assets/product-placeholder/bullet_vibe.png"),
    rawDescription,
    typeCode,
    subtypeCode,
    productTags: productTags.length > 0 ? productTags : ["女性友好"],
    productSpecs: {
      ...(row.specs ?? {}),
      rawDescription,
      sourceUrl: normalizeNonEmpty(row.sourceUrl, LELO_WOMEN_LIST_URL),
      officialListUrl: LELO_WOMEN_LIST_URL,
      officialCleanedAt: new Date().toISOString(),
    },
  } satisfies Omit<LeloFemaleRefreshPatch, "recommendationFeatures">;

  return {
    ...patchWithoutFeatures,
    recommendationFeatures: buildRecommendationFeaturesForPatch(patchWithoutFeatures),
  };
}

function buildRawDescription(
  item: LeloListItem,
  schema: JsonRecord,
  html: string,
  sourceUrl: string,
  priceAmount: number,
  priceCurrency: string,
) {
  const schemaDescription = normalizeInline(schema.description);
  const metaDescription = normalizeInline(extractMetaContent(html, "description") || extractMetaContent(html, "og:description"));
  const title = normalizeInline(extractTitle(html) || extractMetaContent(html, "og:title"));
  const schemaType = Array.isArray(schema["@type"]) ? schema["@type"].join(" | ") : normalizeText(schema["@type"]);
  const sku = normalizeText(schema.sku);
  const appSupport = /app|love bridge|long-distance|remote/i.test(`${schemaDescription}\n${metaDescription}`) ? "Yes" : "No";

  return [
    "[基础信息]",
    `商品名: ${normalizeNonEmpty(schema.name, item.name)}`,
    title ? `页面标题: ${title}` : "",
    metaDescription ? `页面描述: ${metaDescription}` : "",
    `页面价格(${priceCurrency}): ${priceAmount}`,
    "站内分类提示: sex-toys-for-women | 女性性愛玩具",
    "性别提示: female",
    `APP支持: ${appSupport}`,
    "",
    "[规格参数]",
    sku ? `SKU: ${sku}` : "",
    schemaType ? `Schema类型: ${schemaType}` : "",
    "材质: 亲肤硅胶",
    "",
    "[卖点摘要]",
    schemaDescription || metaDescription,
    "",
    `[来源链接] ${sourceUrl}`,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 9000)
    .trim();
}

function buildSourceRow(item: LeloListItem, html: string): LeloSourceRow {
  const schema = extractProductSchema(html) ?? {};
  const offers = schema.offers && typeof schema.offers === "object" ? (schema.offers as JsonRecord) : {};
  const rates = extractCurrencyRates(html);
  const sourceUrl = normalizeProductUrl((offers as JsonRecord).url ?? extractCanonicalUrl(html) ?? item.sourceUrl);
  const priceCurrency = normalizeNonEmpty((offers as JsonRecord).priceCurrency, "TWD");
  const priceAmount = parsePositiveNumber((offers as JsonRecord).price) ?? 1;
  const priceCurrencyToCny =
    rates.currencyToCny[priceCurrency.toUpperCase()] ?? (priceCurrency.toUpperCase() === "CNY" ? 1 : rates.twdCny);
  const name = normalizeNonEmpty(schema.name, item.name);
  const schemaType = Array.isArray(schema["@type"]) ? schema["@type"].join(" | ") : normalizeText(schema["@type"]);
  const images = uniqueStrings([
    schema.image,
    extractMetaContent(html, "og:image"),
  ].map(normalizeImageUrl));
  const rawDescription = buildRawDescription(item, schema, html, sourceUrl, priceAmount, priceCurrency);
  const typePatch = resolveTypePatch({
    sourceUrl,
    name,
    schemaType,
    price: priceAmount,
    priceCurrency,
    image: images[0],
    rawDescription,
    genderHint: "female",
    categoryHints: ["sex-toys-for-women", "女性性愛玩具", schemaType],
  });

  return {
    sourceUrl,
    name,
    safeDisplayName: buildSafeDisplayName(name),
    sku: normalizeText(schema.sku),
    schemaType,
    price: priceAmount,
    priceCurrency,
    image: images[0] ?? null,
    rawDescription,
    genderHint: "female",
    categoryHints: uniqueStrings(["sex-toys-for-women", "女性性愛玩具", schemaType]),
    detailImageUrls: images,
    specs: {
      schema_type: schemaType,
      sku: normalizeText(schema.sku) || null,
      official_category: "sex-toys-for-women",
      function_tags: inferTagsFromText({ name, sourceUrl, schemaType, rawDescription, genderHint: "female" }),
      gender: "female",
      material: "亲肤硅胶",
      type_code: typePatch.typeCode,
      subtype_code: typePatch.subtypeCode,
      max_db: typePatch.maxDb,
      waterproof: typePatch.waterproof,
      appearance: normalizeAppearance(buildTrustedSource({ name, sourceUrl, schemaType, rawDescription })),
      motor_type: normalizeMotorType(buildTrustedSource({ name, sourceUrl, schemaType, rawDescription }), typePatch.typeCode),
      physical_form: normalizePhysicalForm(typePatch.typeCode, buildTrustedSource({ name, sourceUrl, schemaType, rawDescription })),
      price_source_currency: priceCurrency,
      price_source_amount: priceAmount,
      fx_rate_usd_cny: rates.usdCny,
      fx_rate_usd_twd: rates.usdTwd,
      fx_rate_twd_cny: rates.twdCny,
      [`fx_rate_${priceCurrency.toLowerCase()}_cny`]: priceCurrencyToCny,
      fx_rates_cny: rates.currencyToCny,
      fx_rate_source: rates.source,
      fx_rate_date: "2026-06-11",
      price_rmb: normalizePositivePrice(priceAmount * priceCurrencyToCny),
    },
  };
}

export async function fetchLeloOfficialSourceRows() {
  const listHtml = await fetchText(LELO_WOMEN_LIST_URL);
  const listItems = extractLeloWomenListItems(listHtml).slice(0, LELO_OFFICIAL_MAX_ITEMS);
  const rows: LeloSourceRow[] = [];
  for (let index = 0; index < listItems.length; index += 6) {
    const batch = listItems.slice(index, index + 6);
    const batchRows = await Promise.all(
      batch.map(async (item) => {
        const detailHtml = await fetchText(item.sourceUrl);
        return buildSourceRow(item, detailHtml);
      }),
    );
    rows.push(...batchRows);
    console.log(`[refresh-lelo-female-products-from-official] 已抓取详情 ${rows.length}/${listItems.length}`);
  }

  fs.writeFileSync(LELO_REVIEW_BUFFER_PATH, `${JSON.stringify(rows, null, 2)}\n`);
  return rows;
}

async function ensureLeloCompetitor(client: PgClientLike) {
  const prismaLike = {
    competitors: {
      findFirst: async (args: any) => {
        const names = args?.where?.OR?.flatMap((entry: any) => {
          const nameFilter = entry?.name;
          const value = typeof nameFilter === "object" ? nameFilter?.contains : nameFilter;
          return value ? [value] : [];
        }) ?? [LELO_BRAND_NAME];
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
    brandName: LELO_BRAND_NAME,
    overrideConfig: LELO_COMPETITOR_CONFIG,
  });
}

async function upsertProductAndFemaleToy(
  client: PgClientLike,
  patch: LeloFemaleRefreshPatch,
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

export function shouldRunLeloFemaleRefreshScript(importMetaUrl: string, argvEntry?: string) {
  return Boolean(argvEntry && importMetaUrl === pathToFileURL(argvEntry).href);
}

async function loadLeloSourceRows() {
  const sourceMode = normalizeLower(process.env.LELO_REFRESH_SOURCE || "live");
  if (sourceMode === "buffer") {
    return {
      sourceMode,
      rows: JSON.parse(fs.readFileSync(LELO_REVIEW_BUFFER_PATH, "utf8")) as LeloSourceRow[],
    };
  }
  return {
    sourceMode,
    rows: await fetchLeloOfficialSourceRows(),
  };
}

async function runLeloFemaleProductsRefreshAttempt() {
  const { sourceMode, rows } = await loadLeloSourceRows();
  const patches = rows.filter(shouldKeepLeloFemaleSourceRow).map(buildLeloFemaleRefreshPatch);
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
      console.warn("[refresh-lelo-female-products-from-official] 数据库连接 error event:", error);
    });

    await client.query("SET statement_timeout TO 0");
    await client.query("SET lock_timeout TO '5s'");

    const competitorId = await ensureLeloCompetitor(client);
    const refreshMode = normalizeLower(process.env.LELO_REFRESH_MODE || "incremental");
    if (refreshMode === "replace") {
      await client.query("BEGIN");
      await client.query("DELETE FROM public.female_recommender_toys WHERE lower(brand) = lower($1)", [LELO_BRAND_NAME]);
      await client.query("COMMIT");
    }

    for (let index = 0; index < patches.length; index += LELO_REFRESH_BATCH_SIZE) {
      const batch = patches.slice(index, index + LELO_REFRESH_BATCH_SIZE);
      await client.query("BEGIN");
      try {
        for (const patch of batch) {
          await upsertProductAndFemaleToy(client, patch, competitorId);
        }
        await client.query("COMMIT");
        console.log(
          `[refresh-lelo-female-products-from-official] 已提交 ${Math.min(index + batch.length, patches.length)}/${patches.length}`,
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
      [LELO_BRAND_NAME],
    );

    console.log(
      JSON.stringify(
        {
          brand: LELO_BRAND_NAME,
          source: LELO_WOMEN_LIST_URL,
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

async function runLeloFemaleProductsRefresh() {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await runLeloFemaleProductsRefreshAttempt();
      return;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!/Connection terminated|ECONNRESET|server closed the connection|terminating connection|Can't reach database|P1001|P1017/i.test(message) || attempt === 3) {
        break;
      }
      console.warn(`[refresh-lelo-female-products-from-official] 遇到瞬断，重试 ${attempt}/3...`, error);
      await sleep(1500 * attempt);
    }
  }
  throw lastError;
}

if (shouldRunLeloFemaleRefreshScript(import.meta.url, process.argv[1])) {
  runLeloFemaleProductsRefresh().catch((error) => {
    console.error("[refresh-lelo-female-products-from-official] 执行失败:", error);
    process.exitCode = 1;
  });
}
