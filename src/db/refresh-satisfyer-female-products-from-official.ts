import dotenv from "dotenv";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

import pg from "pg";

import {
  buildRecommendationFeatureBackfillPayload,
  type RecommendationFeatureBackfillRow,
} from "./backfill-recommendation-product-features.ts";
import { buildSatisfyerDerivedPatch } from "./backfill-satisfyer-derived-fields.ts";
import { buildSafeDisplayName } from "../lib/product-display-name.ts";
import { ensureCompetitorRecord, type CompetitorRegistryConfig } from "../scraper/shared/competitor-registry.ts";

dotenv.config();

const { Pool } = pg;
const SATISFYER_REFRESH_BATCH_SIZE = Number(process.env.SATISFYER_REFRESH_BATCH_SIZE || "40");

export const SATISFYER_BRAND_NAME = "Satisfyer";
export const SATISFYER_WOMEN_LIST_URL = "https://www.satisfyer.com/int/products";
export const SATISFYER_OFFICIAL_SOURCE_URL =
  process.env.SATISFYER_OFFICIAL_LIST_URL || process.env.SATISFYER_SOURCE_LIST_URL || SATISFYER_WOMEN_LIST_URL;
export const SATISFYER_CLEANED_PATH = "src/data/satisfyer-official-cleaned-data.json";
export const SATISFYER_REVIEW_BUFFER_PATH = "src/data/satisfyer-official-review-buffer.json";
export const SATISFYER_BUFFER_USD_TO_CNY_RATE = Number(process.env.SATISFYER_USD_CNY_RATE || "6.7715");
export const SATISFYER_BUFFER_EUR_TO_CNY_RATE = Number(process.env.SATISFYER_EUR_CNY_RATE || "7.7620");

const SATISFYER_COMPETITOR_CONFIG: CompetitorRegistryConfig = {
  canonicalName: SATISFYER_BRAND_NAME,
  matchNames: ["satisfyer", "satisfyer.com"],
  domain: "www.satisfyer.com",
  country: "德国",
  description:
    "Satisfyer 是德国情趣科技品牌，产品覆盖空气脉冲、震动、双刺激、情侣互动与亲密护理用品。",
  focus: "Female",
  philosophy: [
    "以空气脉冲和压力波刺激作为核心技术识别。",
    "覆盖女性单人探索、情侣共玩和亲密护理场景。",
    "强调可负担价格、清洁防水和入门友好的产品体验。",
  ],
  majorUserGroupProfile:
    "【核心人口】20-45 岁女性用户为主，兼顾情侣和亲密护理消费场景。\n【心理特征】关注阴蒂刺激、G点探索、双刺激和产品易清洁性，偏好明确功能与高性价比。\n【核心痛点】希望快速区分吸吮、震动、入体和护理类产品，降低首次选择成本。",
  isDomestic: false,
};

type SatisfyerSourceRow = {
  name?: string | null;
  safeDisplayName?: string | null;
  price?: number | string | null;
  priceUsd?: number | string | null;
  priceCurrency?: string | null;
  sourceUrl?: string | null;
  image?: string | null;
  coverImage?: string | null;
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

type SatisfyerFemaleRefreshPatch = {
  name: string;
  safeDisplayName: string;
  price: number;
  maxDb: number;
  waterproof: number;
  appearance: string;
  physicalForm: "external" | "internal" | "composite";
  motorType: "gentle" | "strong";
  gender: "female" | "unisex";
  brand: typeof SATISFYER_BRAND_NAME;
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

function normalizePositivePrice(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 1;
}

function normalizeRmbPrice(row: SatisfyerSourceRow) {
  const currency = normalizeLower(row.priceCurrency);
  if (currency === "eur") {
    return normalizePositivePrice(Number(row.priceUsd ?? row.price) * SATISFYER_BUFFER_EUR_TO_CNY_RATE);
  }
  if (currency === "usd") {
    return normalizePositivePrice(Number(row.priceUsd ?? row.price) * SATISFYER_BUFFER_USD_TO_CNY_RATE);
  }
  if (row.priceUsd != null && row.specs?.price_rmb == null) {
    return normalizePositivePrice(Number(row.priceUsd) * SATISFYER_BUFFER_USD_TO_CNY_RATE);
  }
  return normalizePositivePrice(row.price ?? row.specs?.price_rmb);
}

function normalizeNameKey(value: unknown) {
  return normalizeLower(value).replace(/[^a-z0-9]+/g, " ").trim();
}

function inferFallbackRmbPrice(row: SatisfyerSourceRow) {
  const source = buildTrustedSource(row);
  if (/connect app|app/.test(source)) return 612;
  if (/rabbit|bunny|dual stimulation|g-?spot/.test(source)) return 503;
  if (/bullet|mini vibe|groove/.test(source)) return 388;
  if (/pro|air[-\s]?pulse|suction|pressure wave|din-?oooh|mochi/.test(source)) return 374;
  if (/lube|lubricant|cleaner|menstrual|bag|护理|清洁|润滑|月经杯/.test(source)) return 108;
  return 399;
}

function buildTrustedSource(row: SatisfyerSourceRow) {
  const categoryHints = Array.isArray(row.categoryHints) ? row.categoryHints.join(" ") : "";
  const rawDescription = normalizeText(row.rawDescription);
  const rawLead = rawDescription.split(/\n\[卖点摘要\]|\n\[英文正文摘录\]|\n\[规格参数\]/u, 1)[0] || rawDescription.slice(0, 1200);
  return `${row.name ?? ""}\n${row.sourceUrl ?? ""}\n${categoryHints}\n${rawLead}`.toLowerCase();
}

function hasFemaleOrSharedSignal(row: SatisfyerSourceRow) {
  const source = buildTrustedSource(row);
  const gender = normalizeLower(row.gender ?? row.genderHint ?? row.specs?.gender);
  return (
    gender === "female" ||
    gender === "unisex" ||
    /性别提示:\s*(female|女性|unisex)|for her|for women|woman|women|female|clit|clitoral|g-?spot|vaginal|rabbit|bunny|air[-\s]?pulse|suction|pressure wave|menstrual cup|toy cleaner|lubricant|lube|treasure bag|storage bag|couple|partner/.test(
      source,
    )
  );
}

function isObviousMaleOnly(row: SatisfyerSourceRow) {
  const source = buildTrustedSource(row);
  const titleSource = `${row.name ?? ""}\n${row.sourceUrl ?? ""}`.toLowerCase();
  if (/men[-\s]?vibration|men[-\s]?wand|power[-\s]?masturbator|masturbator|stroker|ring[-\s]?stroker/.test(titleSource)) {
    return true;
  }
  const femaleAnatomyOrAudience =
    /female|for her|for women|woman|women|clit|clitoral|g-?spot|vaginal|vulva|rabbit|bunny/.test(source);
  if (/male masturbator|suitable for:\s*men|stimulation:\s*penis|penis pleasure|grooved.{0,48}masturbator/.test(source)) {
    return !femaleAnatomyOrAudience;
  }
  const femaleOrShared = /female|for her|for women|woman|women|clit|clitoral|g-?spot|vaginal|rabbit|bunny|couple|partner|unisex/.test(source);
  const maleOnly =
    /性别提示:\s*(male|男性)|for him|male|men vibration|penis|cock ring|prostate|stroker|masturbator|masturbator egg|egg set|自慰蛋|飞机杯|男性自慰器|阴茎/.test(
      source,
    );
  return maleOnly && !femaleOrShared;
}

export function shouldKeepSatisfyerFemaleSourceRow(row: SatisfyerSourceRow) {
  return hasFemaleOrSharedSignal(row) && !isObviousMaleOnly(row);
}

export function shouldKeepSatisfyerSourceListRow(row: SatisfyerSourceRow, sourceListUrl = SATISFYER_OFFICIAL_SOURCE_URL) {
  if (!/\/products\/vibrators(?:[/?#]|$)/i.test(sourceListUrl)) {
    return true;
  }

  const source = buildTrustedSource(row);
  return /vibrat|vibe|air[-\s]?pulse|pressure wave|g-?spot|rabbit|bunny|clit|clitoral|wand|massager|bullet|insertable|plug|booty|阴蒂|阴道|振动|震动|空气脉冲|压力波|兔|按摩棒|跳蛋|G点/i.test(
    source,
  );
}

function normalizePhysicalForm(value: unknown, typeCode: string, source: string): "external" | "internal" | "composite" {
  const normalized = normalizeLower(value);
  if (normalized === "internal" || normalized === "composite") return normalized;
  if (typeCode === "dual_stimulation" || typeCode === "couples") return "composite";
  if (typeCode === "insertable" || /g-?spot|vaginal|insertable|plug|dildo|crystal|glass/.test(source)) return "internal";
  return "external";
}

function normalizeMotorType(value: unknown, typeCode: string, source: string): "gentle" | "strong" {
  const normalized = normalizeLower(value);
  if (normalized === "strong" || /strong|powerful|intense|强力|强劲/.test(source)) return "strong";
  if (typeCode === "care_accessory") return "gentle";
  return "gentle";
}

function normalizeGender(value: unknown): "female" | "unisex" {
  return normalizeLower(value) === "unisex" ? "unisex" : "female";
}

function isNonElectricType(typeCode: string) {
  return typeCode === "care_accessory" || typeCode === "bdsm";
}

function normalizeMaxDb(value: unknown, typeCode: string) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 0) return Math.round(parsed);
  return isNonElectricType(typeCode) ? 0 : 50;
}

function normalizeWaterproof(value: unknown, typeCode: string) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 0) return Math.round(parsed);
  return isNonElectricType(typeCode) ? 0 : 7;
}

function resolveManualTypePatch(row: SatisfyerSourceRow) {
  const source = buildTrustedSource(row);
  const titleSource = `${row.name ?? ""}\n${row.sourceUrl ?? ""}`.toLowerCase();

  if (/toy[-\s]?cleaner|cleanser|cleaning spray|cleaning foam|清洁剂|清洁液|玩具清洁/.test(titleSource)) {
    return { typeCode: "care_accessory", subtypeCode: "toy_cleaner", maxDb: 0, waterproof: 0 };
  }
  if (/lubricant|lube|润滑|gentle classic/.test(source)) {
    return { typeCode: "care_accessory", subtypeCode: "lube_care", maxDb: 0, waterproof: 0 };
  }
  if (/menstrual cup|feel secure|feel confident|feel good|月经杯/.test(source)) {
    return { typeCode: "care_accessory", subtypeCode: "menstrual_cup", maxDb: 0, waterproof: 0 };
  }
  if (/treasure bag|storage bag|收纳袋/.test(source)) {
    return { typeCode: "care_accessory", subtypeCode: "storage_bag", maxDb: 0, waterproof: 0 };
  }
  if (/rabbit|bunny|pearl bunny|dual stimulation|g-?spot.{0,24}clit|clit.{0,24}g-?spot/.test(source)) {
    return { typeCode: "dual_stimulation", subtypeCode: "rabbit_dual", maxDb: 50, waterproof: 7 };
  }
  if (/tongue genius|tongue expert|tri ball|love birds/.test(source)) {
    return { typeCode: "dual_stimulation", subtypeCode: "multi_head_dual", maxDb: 50, waterproof: 7 };
  }
  if (/g-?spot|vaginal|dildo|insertable|plug|booty|crystal|glass|高硼硅/.test(source)) {
    return { typeCode: "insertable", subtypeCode: /glass|crystal|dildo/.test(source) ? "gspot_insertable" : "insertable_vibe", maxDb: 50, waterproof: 7 };
  }
  if (/pro\s*\+|pro\s*\d|air[-\s]?pulse|suction|pressure wave|clitoral suction|satisfyer double joy/.test(source)) {
    return { typeCode: "suction", subtypeCode: "suction_pure", maxDb: 50, waterproof: 7 };
  }
  if (/wand|massager|bullet|mini vibe|clitoral vibrator|external vibrator/.test(source)) {
    return { typeCode: "external_vibe", subtypeCode: /wand|massager/.test(source) ? "wand_massager" : "bullet_vibe", maxDb: 50, waterproof: 7 };
  }
  if (/couple|partner|remote play/.test(source)) {
    return { typeCode: "couples", subtypeCode: "external_couples", maxDb: 50, waterproof: 7 };
  }

  return null;
}

function normalizeSubtypeCode(value: unknown, typeCode: string, source: string) {
  const normalized = normalizeText(value);
  if (normalized) return normalized;
  if (typeCode === "care_accessory") {
    if (/toy[-\s]?cleaner|cleanser|cleaning spray|cleaning foam|清洁剂|清洁液|玩具清洁/.test(source)) return "toy_cleaner";
    if (/menstrual|月经杯/.test(source)) return "menstrual_cup";
    if (/bag|收纳/.test(source)) return "storage_bag";
    return "lube_care";
  }
  if (typeCode === "suction") return "suction_pure";
  if (typeCode === "dual_stimulation") return /tongue|tri ball|love birds/.test(source) ? "multi_head_dual" : "rabbit_dual";
  if (typeCode === "external_vibe") return /wand|massager/.test(source) ? "wand_massager" : "bullet_vibe";
  if (typeCode === "couples") return "external_couples";
  if (typeCode === "bdsm") return "fetish_accessory";
  return "insertable_vibe";
}

function resolveTypePatch(row: SatisfyerSourceRow) {
  const source = buildTrustedSource(row);
  const manualPatch = resolveManualTypePatch(row);
  if (manualPatch) return manualPatch;

  const currentTypeCode =
    typeof row.typeCode === "string" ? row.typeCode : typeof row.specs?.type_code === "string" ? row.specs.type_code : null;
  const currentSubtypeCode =
    typeof row.subtypeCode === "string"
      ? row.subtypeCode
      : typeof row.specs?.subtype_code === "string"
        ? row.specs.subtype_code
        : null;

  const patch = buildSatisfyerDerivedPatch({
    name: normalizeNonEmpty(row.name, "Satisfyer 未命名商品"),
    gender: normalizeText(row.gender ?? row.genderHint ?? row.specs?.gender) || null,
    physical_form: typeof row.specs?.physical_form === "string" ? row.specs.physical_form : null,
    current_type_code: currentTypeCode,
    current_subtype_code: currentSubtypeCode,
    current_max_db: typeof row.specs?.max_db === "number" ? row.specs.max_db : null,
    current_waterproof: typeof row.specs?.waterproof === "number" ? row.specs.waterproof : null,
    raw_description: normalizeText(row.rawDescription) || null,
  });

  let typeCode = normalizeText(patch.type_code);
  if (!typeCode || typeCode === "unknown") {
    typeCode = /g-?spot|vaginal|insertable|dildo/.test(source) ? "insertable" : "external_vibe";
  }

  const subtypeCode = normalizeSubtypeCode(patch.subtype_code, typeCode, source);
  return { typeCode, subtypeCode, maxDb: patch.max_db, waterproof: patch.waterproof };
}

function inferTagsFromText(row: SatisfyerSourceRow) {
  const source = buildTrustedSource(row);
  const tags: string[] = [];
  const push = (tag: string, pattern: RegExp) => {
    if (pattern.test(source) && !tags.includes(tag)) tags.push(tag);
  };

  push("空气脉冲", /air[-\s]?pulse|suction|pressure wave|吮吸|吸吮/);
  push("阴蒂刺激", /clit|clitoral|阴蒂/);
  push("G点刺激", /g-?spot|g点/);
  push("兔耳双刺激", /rabbit|bunny|dual stimulation/);
  push("震动", /vibrat|震动|振动/);
  push("情侣共玩", /couple|partner|情侣|双人/);
  push("防水", /waterproof|防水/);
  push("APP控制", /app|connect app|remotyca/);
  push("护理耗材", /lube|lubricant|cleaner|menstrual|润滑|清洁|月经杯/);

  return tags;
}

function normalizeMaterial(row: SatisfyerSourceRow, typeCode: string) {
  const direct = row.material ?? row.specs?.material;
  if (normalizeText(direct)) return normalizeText(direct);
  const source = buildTrustedSource(row);
  if (/glass|crystal|高硼硅/.test(source)) return "硼硅玻璃";
  if (/abs|plastic/.test(source)) return "ABS 与亲肤硅胶";
  if (typeCode === "care_accessory") return "身体安全护理材质";
  return "亲肤硅胶";
}

function buildRecommendationFeaturesForPatch(patch: Omit<SatisfyerFemaleRefreshPatch, "recommendationFeatures">) {
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

export function normalizeSatisfyerSourceRows(rows: SatisfyerSourceRow[]) {
  const legacyRows = (() => {
    try {
      return JSON.parse(fs.readFileSync(SATISFYER_CLEANED_PATH, "utf8")) as SatisfyerSourceRow[];
    } catch {
      return [];
    }
  })();
  const legacyRowsByName = new Map(
    legacyRows
      .filter((row) => normalizeNameKey(row.name) && Number(row.price) > 0)
      .map((row) => [normalizeNameKey(row.name), row]),
  );

  return rows.map((row) => {
    const legacyRow = legacyRowsByName.get(normalizeNameKey(row.name));
    const existingSpecs = row.specs ?? {};
    const currency = normalizeLower(row.priceCurrency);
    const sourcePrice = row.price ?? row.priceUsd ?? null;
    const rmbPrice =
      sourcePrice != null || row.specs?.price_rmb != null
        ? normalizeRmbPrice(row)
        : normalizePositivePrice(legacyRow?.price ?? inferFallbackRmbPrice(row));
    const priceUsd = Number(row.priceUsd ?? (currency === "usd" ? row.price : existingSpecs.price_usd));
    const inferredTags = inferTagsFromText(row);
    const functionTags = Array.isArray(existingSpecs.function_tags)
      ? existingSpecs.function_tags
      : inferredTags;

    return {
      ...row,
      price: rmbPrice,
      image: row.image ?? row.coverImage ?? row.detailImageUrls?.[0] ?? null,
      specs: {
        ...existingSpecs,
        function_tags: functionTags.length > 0 ? functionTags : ["女性友好"],
        gender: existingSpecs.gender ?? row.gender ?? row.genderHint ?? "female",
        material: existingSpecs.material ?? row.material ?? "亲肤硅胶",
        price_usd: Number.isFinite(priceUsd) && priceUsd > 0 ? priceUsd : null,
        price_rmb: rmbPrice,
        fx_rate_usd_cny: SATISFYER_BUFFER_USD_TO_CNY_RATE,
        fx_rate_eur_cny: SATISFYER_BUFFER_EUR_TO_CNY_RATE,
        fx_rate_source: existingSpecs.fx_rate_source ?? "satisfyer-review-buffer",
        fx_rate_date: existingSpecs.fx_rate_date ?? "2026-06-10",
        legacy_price_source: legacyRow?.sourceUrl ?? null,
      },
    } satisfies SatisfyerSourceRow;
  });
}

export function buildSatisfyerFemaleRefreshPatch(row: SatisfyerSourceRow): SatisfyerFemaleRefreshPatch {
  const name = normalizeNonEmpty(row.name, "Satisfyer 未命名商品");
  const rawDescription = normalizeNonEmpty(
    row.rawDescription,
    `${name}\nSatisfyer 官方女性/女性可用商品，来自 ${SATISFYER_OFFICIAL_SOURCE_URL}。`,
  );
  const typePatch = resolveTypePatch(row);
  const typeCode = normalizeNonEmpty(typePatch.typeCode, "external_vibe");
  const subtypeCode = normalizeSubtypeCode(typePatch.subtypeCode, typeCode, buildTrustedSource(row));
  const productTags = Array.isArray(row.specs?.function_tags)
    ? row.specs.function_tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
    : inferTagsFromText(row);

  const source = buildTrustedSource(row);
  const patchWithoutFeatures = {
    name,
    safeDisplayName: normalizeNonEmpty(row.safeDisplayName, buildSafeDisplayName(name)),
    price: normalizeRmbPrice(row),
    maxDb: normalizeMaxDb(typePatch.maxDb ?? row.specs?.max_db, typeCode),
    waterproof: normalizeWaterproof(typePatch.waterproof ?? row.specs?.waterproof, typeCode),
    appearance: normalizeNonEmpty(row.specs?.appearance, "normal"),
    physicalForm: normalizePhysicalForm(row.specs?.physical_form, typeCode, source),
    motorType: normalizeMotorType(row.specs?.motor_type, typeCode, source),
    gender: normalizeGender(row.gender ?? row.genderHint ?? row.specs?.gender),
    brand: SATISFYER_BRAND_NAME,
    material: normalizeMaterial(row, typeCode),
    link: normalizeNonEmpty(row.sourceUrl, SATISFYER_WOMEN_LIST_URL),
    imageUrl: normalizeNonEmpty(row.image ?? row.coverImage ?? row.detailImageUrls?.[0], "/assets/product-placeholder/gspot_insertable.png"),
    rawDescription,
    typeCode,
    subtypeCode,
    productTags: productTags.length > 0 ? productTags : ["女性友好"],
    productSpecs: {
      ...(row.specs ?? {}),
      rawDescription,
      sourceUrl: normalizeNonEmpty(row.sourceUrl, SATISFYER_WOMEN_LIST_URL),
      officialListUrl: SATISFYER_OFFICIAL_SOURCE_URL,
      officialCleanedAt: new Date().toISOString(),
    },
  } satisfies Omit<SatisfyerFemaleRefreshPatch, "recommendationFeatures">;

  return {
    ...patchWithoutFeatures,
    recommendationFeatures: buildRecommendationFeaturesForPatch(patchWithoutFeatures),
  };
}

async function ensureSatisfyerCompetitor(client: PgClientLike) {
  const prismaLike = {
    competitors: {
      findFirst: async (args: any) => {
        const names = args?.where?.OR?.flatMap((entry: any) => {
          const nameFilter = entry?.name;
          const value = typeof nameFilter === "object" ? nameFilter?.contains : nameFilter;
          return value ? [value] : [];
        }) ?? [SATISFYER_BRAND_NAME];
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
    brandName: SATISFYER_BRAND_NAME,
    overrideConfig: SATISFYER_COMPETITOR_CONFIG,
  });
}

async function upsertProductAndFemaleToy(
  client: PgClientLike,
  patch: SatisfyerFemaleRefreshPatch,
  competitorId: string | null,
) {
  const existingProduct = await client.query(
    `
      SELECT id
      FROM public.products
      WHERE lower(name) = lower($1)
        AND (competitor_id = $2::uuid OR $2::uuid IS NULL)
      ORDER BY created_at DESC NULLS LAST
      LIMIT 1
    `,
    [patch.name, competitorId],
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

export const SATISFYER_INCREMENTAL_REFRESH_MODE = "incremental";
export const SATISFYER_REPLACE_REFRESH_MODE = "replace";

export function shouldRunSatisfyerFemaleRefreshScript(importMetaUrl: string, argvEntry?: string) {
  return Boolean(argvEntry && importMetaUrl === pathToFileURL(argvEntry).href);
}

function buildSatisfyerRefreshPatches() {
  const sourceMode = normalizeLower(process.env.SATISFYER_REFRESH_SOURCE || "buffer");
  const sourcePath = sourceMode === "cleaned" ? SATISFYER_CLEANED_PATH : SATISFYER_REVIEW_BUFFER_PATH;
  const rows = normalizeSatisfyerSourceRows(JSON.parse(fs.readFileSync(sourcePath, "utf8")) as SatisfyerSourceRow[]);
  const patches = rows
    .filter((row) => shouldKeepSatisfyerSourceListRow(row))
    .filter(shouldKeepSatisfyerFemaleSourceRow)
    .map(buildSatisfyerFemaleRefreshPatch);

  return { sourceMode, sourcePath, rows, patches };
}

async function runSatisfyerFemaleProductsRefreshAttempt() {
  const { sourceMode, sourcePath, rows, patches } = buildSatisfyerRefreshPatches();
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
      console.warn("[refresh-satisfyer-female-products-from-official] 数据库连接 error event:", error);
    });

    await client.query("SET statement_timeout TO 0");
    await client.query("SET lock_timeout TO '5s'");

    const competitorId = await ensureSatisfyerCompetitor(client);
    const refreshMode = normalizeLower(process.env.SATISFYER_REFRESH_MODE || "incremental");
    if (refreshMode === "replace") {
      await client.query("BEGIN");
      await client.query("DELETE FROM public.female_recommender_toys WHERE lower(brand) = lower($1)", [SATISFYER_BRAND_NAME]);
      await client.query("COMMIT");
    }

    for (let index = 0; index < patches.length; index += SATISFYER_REFRESH_BATCH_SIZE) {
      const batch = patches.slice(index, index + SATISFYER_REFRESH_BATCH_SIZE);
      await client.query("BEGIN");
      try {
        for (const patch of batch) {
          await upsertProductAndFemaleToy(client, patch, competitorId);
        }
        await client.query("COMMIT");
        console.log(
          `[refresh-satisfyer-female-products-from-official] 已提交 ${Math.min(index + batch.length, patches.length)}/${patches.length}`,
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
      [SATISFYER_BRAND_NAME],
    );

    console.log(
      JSON.stringify(
        {
          brand: SATISFYER_BRAND_NAME,
          source: SATISFYER_OFFICIAL_SOURCE_URL,
          sourceMode,
          sourcePath,
          refreshMode,
          inputRows: rows.length,
          refreshed: patches.length,
          ...audit.rows[0],
        },
        null,
        2,
      ),
    );
  } catch (error) {
    throw error;
  } finally {
    client?.release();
    await pool.end().catch(() => {});
  }
}

async function refreshSatisfyerFemaleProducts() {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await runSatisfyerFemaleProductsRefreshAttempt();
    } catch (error) {
      lastError = error;
      if (attempt === 4) break;
      console.warn(`[refresh-satisfyer-female-products-from-official] 第 ${attempt} 次刷新失败，稍后重试:`, error);
      await sleep(2000 * attempt);
    }
  }

  throw lastError;
}

if (shouldRunSatisfyerFemaleRefreshScript(import.meta.url, process.argv[1])) {
  refreshSatisfyerFemaleProducts().catch((error) => {
    console.error("[refresh-satisfyer-female-products-from-official] 执行失败:", error);
    process.exitCode = 1;
  });
}
