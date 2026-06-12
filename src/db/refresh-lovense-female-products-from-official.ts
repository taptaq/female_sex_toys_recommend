import dotenv from "dotenv";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

import pg from "pg";

import {
  buildRecommendationFeatureBackfillPayload,
  type RecommendationFeatureBackfillRow,
} from "./backfill-recommendation-product-features.ts";
import { buildLovenseDerivedPatch } from "./backfill-lovense-derived-fields.ts";
import { buildSafeDisplayName } from "../lib/product-display-name.ts";
import { ensureCompetitorRecord, type CompetitorRegistryConfig } from "../scraper/shared/competitor-registry.ts";

dotenv.config();

const { Pool } = pg;

export const LOVENSE_BRAND_NAME = "Lovense";
export const LOVENSE_WOMEN_LIST_URL = "https://www.lovense.com/store/sex-toys-for-women";
export const LOVENSE_CLEANED_PATH = "src/data/lovense-official-cleaned-data.json";
export const LOVENSE_REVIEW_BUFFER_PATH = "src/data/lovense-official-review-buffer.json";
export const LOVENSE_BUFFER_USD_TO_CNY_RATE = Number(process.env.LOVENSE_USD_CNY_RATE || "6.7715");

const LOVENSE_COMPETITOR_CONFIG: CompetitorRegistryConfig = {
  canonicalName: LOVENSE_BRAND_NAME,
  matchNames: ["lovense", "洛文斯", "乐维斯"],
  domain: "www.lovense.com",
  country: "新加坡",
  description: "Lovense 是以 App 控制、远程互动和可穿戴设备见长的智能情趣科技品牌。",
  focus: "Unisex",
  philosophy: [
    "以 App 远程控制和跨距离互动作为核心产品能力。",
    "围绕女性、男性与情侣场景布局互联设备和配套产品。",
    "强调智能连接、可穿戴体验和异地亲密互动。",
  ],
  majorUserGroupProfile:
    "【核心人口】20-45 岁科技接受度较高的女性、情侣和异地关系用户。\n【心理特征】重视 App 稳定性、远程互动、隐私和可玩性，愿意为 connected toy 体验付费。\n【核心痛点】希望在单人探索、公共场景或异地关系中获得更稳定、更可控、更具互动感的体验。",
  isDomestic: false,
};

type LovenseCleanedRow = {
  name?: string | null;
  price?: number | string | null;
  priceUsd?: number | string | null;
  priceCurrency?: string | null;
  sourceUrl?: string | null;
  image?: string | null;
  coverImage?: string | null;
  rawDescription?: string | null;
  genderHint?: string | null;
  categoryHints?: string[] | null;
  detailImageUrls?: string[] | null;
  specs?: Record<string, unknown> | null;
};

type LovenseFemaleRefreshPatch = {
  name: string;
  safeDisplayName: string;
  price: number;
  maxDb: number;
  waterproof: number;
  appearance: string;
  physicalForm: "external" | "internal" | "composite";
  motorType: "gentle" | "strong";
  gender: "female" | "unisex";
  brand: typeof LOVENSE_BRAND_NAME;
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

function normalizePositivePrice(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 1;
}

function normalizeRmbPrice(row: LovenseCleanedRow) {
  if (normalizeLower(row.priceCurrency) === "usd") {
    const sourceUsdPrice = Number(row.priceUsd ?? row.price);
    return normalizePositivePrice(sourceUsdPrice * LOVENSE_BUFFER_USD_TO_CNY_RATE);
  }
  if (row.priceUsd != null && row.specs?.price_rmb == null) {
    return normalizePositivePrice(Number(row.priceUsd) * LOVENSE_BUFFER_USD_TO_CNY_RATE);
  }
  return normalizePositivePrice(row.price ?? row.specs?.price_rmb);
}

function normalizeNonEmpty(value: unknown, fallback: string) {
  const normalized = normalizeText(value);
  return normalized || fallback;
}

function buildLovenseTrustedSource(row: LovenseCleanedRow) {
  const rawDescription = normalizeText(row.rawDescription);
  const rawLead = rawDescription.split(/\n\[卖点摘要\]|\n\[英文正文摘录\]|\n\[FAQ\]|\n\[评论亮点\]/u, 1)[0] || rawDescription.slice(0, 900);
  const categoryHints = Array.isArray(row.categoryHints) ? row.categoryHints.join(" ") : "";
  return `${row.name ?? ""}\n${row.sourceUrl ?? ""}\n${categoryHints}\n${rawLead}`.toLowerCase();
}

function normalizePhysicalForm(value: unknown): "external" | "internal" | "composite" {
  const normalized = normalizeLower(value);
  if (normalized === "internal" || normalized === "composite") return normalized;
  return "external";
}

function normalizeMotorType(value: unknown): "gentle" | "strong" {
  const normalized = normalizeLower(value);
  return normalized === "strong" || normalized === "powerful" ? "strong" : "gentle";
}

function normalizeGender(value: unknown): "female" | "unisex" {
  return normalizeLower(value) === "unisex" ? "unisex" : "female";
}

function normalizeRowGender(row: LovenseCleanedRow): "female" | "unisex" {
  return normalizeGender(row.specs?.gender ?? row.genderHint);
}

function normalizeMaxDb(value: unknown, typeCode: string) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 0) return Math.round(parsed);
  return typeCode === "care_accessory" || typeCode === "bdsm" ? 0 : 40;
}

function normalizeWaterproof(value: unknown, typeCode: string) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 0) return Math.round(parsed);
  return typeCode === "care_accessory" || typeCode === "bdsm" ? 0 : 7;
}

function hasWomenListSignal(row: LovenseCleanedRow) {
  const rawDescription = normalizeText(row.rawDescription);
  const specsGender = normalizeLower(row.specs?.gender);
  const genderHint = normalizeLower(row.genderHint);
  const categoryHints = Array.isArray(row.categoryHints) ? row.categoryHints.join(" ") : "";
  return (
    specsGender === "female" ||
    genderHint === "female" ||
    rawDescription.includes("性别提示: 女性") ||
    rawDescription.includes("性别提示: female") ||
    /sex toys for women|for her|女性情趣玩具|女性性玩具|女性用情趣玩具/i.test(categoryHints) ||
    /sex toys for women|for her|女性情趣玩具|女性性玩具|女性用情趣玩具/i.test(rawDescription)
  );
}

function isObviousNonToy(row: LovenseCleanedRow) {
  const rawLead = normalizeText(row.rawDescription).slice(0, 900);
  const source = `${row.name ?? ""}\n${row.sourceUrl ?? ""}\n${rawLead}`.toLowerCase();
  return /webcam|网络摄像头|bluetooth adapter|蓝牙适配器|usb adapter|cam model|live streaming/.test(source);
}

export function shouldKeepLovenseFemaleCleanedRow(row: LovenseCleanedRow) {
  return hasWomenListSignal(row) && !isObviousNonToy(row);
}

function normalizeSubtypeCode(value: unknown, typeCode: string, source: string) {
  const normalized = normalizeText(value);
  if (normalized) return normalized;
  if (typeCode === "care_accessory") {
    if (/lube|lubricant|润滑/.test(source)) return "lube_care";
    if (/condom|避孕套/.test(source)) return "condom";
    if (/lingerie|蕾丝|内衣/.test(source)) return "lingerie";
    return "intimate_care";
  }
  if (typeCode === "bdsm" || /harness|背带|strap/.test(source)) return "fetish_accessory";
  if (typeCode === "external_vibe") return /wand|domi|魔杖/.test(source) ? "wand_massager" : "bullet_vibe";
  if (typeCode === "dual_stimulation") return /gemini|nipple|乳头夹/.test(source) ? "multi_head_dual" : "rabbit_dual";
  if (typeCode === "suction") return "suction_pure";
  if (typeCode === "wearable_remote") return "insertable_remote";
  if (typeCode === "couples") return "external_couples";
  return "insertable_vibe";
}

function resolveLovenseName(row: LovenseCleanedRow) {
  const name = normalizeText(row.name);
  const url = normalizeLower(row.sourceUrl);
  if (/lovense-sex-toy-kits-shopping-guide/.test(url)) {
    if (/lush4_lushanal/.test(url)) return "Lush 4 & Lush Anal Wearable Vibrator Set";
  }
  return normalizeNonEmpty(name, "Lovense 未命名商品");
}

function resolveLovenseManualTypePatch(row: LovenseCleanedRow) {
  const source = buildLovenseTrustedSource(row);

  if (/toy cleaner|sex-toy-cleaner|cleanser|清洁/.test(source)) {
    return { typeCode: "care_accessory", subtypeCode: "toy_cleaner", maxDb: 0, waterproof: 0 };
  }
  if (/water-based-lubricant|lubricant|lube|润滑/.test(source)) {
    return { typeCode: "care_accessory", subtypeCode: "lube_care", maxDb: 0, waterproof: 0 };
  }
  if (/harness|strap-on|背带/.test(source)) {
    return { typeCode: "bdsm", subtypeCode: "fetish_accessory", maxDb: 0, waterproof: 0 };
  }
  if (/domi2-wand-massager-attachments|attachment|附件/.test(source)) {
    return { typeCode: "bdsm", subtypeCode: "fetish_accessory", maxDb: 0, waterproof: 0 };
  }
  if (/ferri_lush|ferri.*lush|lush.*ferri|full-body|wearable.*set/.test(source)) {
    return { typeCode: "wearable_remote", subtypeCode: "dual_wearable_remote", maxDb: 40, waterproof: 7 };
  }
  if (/ferri|panty vibrator|vibrating panties|magnetic-panty/.test(source)) {
    return { typeCode: "wearable_remote", subtypeCode: "panty_wearable", maxDb: 40, waterproof: 7 };
  }
  if (/gemini|nipple clamp|nipple vibrator|乳头夹/.test(source)) {
    return { typeCode: "dual_stimulation", subtypeCode: "multi_head_dual", maxDb: 40, waterproof: 7 };
  }
  if (/nora|velvo|osci|rabbit|bunny/.test(source)) {
    return { typeCode: "dual_stimulation", subtypeCode: "rabbit_dual", maxDb: 40, waterproof: 7 };
  }
  if (/tenera|sucker|suction|clit-sucking|air pulse/.test(source)) {
    return { typeCode: "suction", subtypeCode: "suction_pure", maxDb: 40, waterproof: 7 };
  }
  if (/domi|wand/.test(source)) {
    return { typeCode: "external_vibe", subtypeCode: "wand_massager", maxDb: 40, waterproof: 7 };
  }
  if (/ambi|exomoon|bullet|lipstick/.test(source)) {
    return { typeCode: "external_vibe", subtypeCode: "bullet_vibe", maxDb: 40, waterproof: 7 };
  }
  if (/hush|lush anal|ridge|butt plug|anal beads/.test(source)) {
    return { typeCode: "insertable", subtypeCode: "insertable_vibe", maxDb: 40, waterproof: 7 };
  }
  if (/lush|dolce|flexer|lapis|mission|spinel|vulse|gravity|sex machine|dildo|g-spot/.test(source)) {
    return { typeCode: "insertable", subtypeCode: "insertable_vibe", maxDb: 40, waterproof: 7 };
  }

  return null;
}

function resolveLovenseTypePatch(row: LovenseCleanedRow) {
  const source = buildLovenseTrustedSource(row);
  const manualPatch = resolveLovenseManualTypePatch(row);
  if (manualPatch) return manualPatch;

  const currentTypeCode =
    typeof row.specs?.type_code === "string" ? row.specs.type_code : null;
  const currentSubtypeCode =
    typeof row.specs?.subtype_code === "string" ? row.specs.subtype_code : null;

  const patch = buildLovenseDerivedPatch({
    name: normalizeNonEmpty(row.name, "Lovense 未命名商品"),
    current_type_code: currentTypeCode,
    current_subtype_code: currentSubtypeCode,
    current_max_db: typeof row.specs?.max_db === "number" ? row.specs.max_db : null,
    current_waterproof: typeof row.specs?.waterproof === "number" ? row.specs.waterproof : null,
    raw_description: normalizeText(row.rawDescription) || null,
  });

  let typeCode = normalizeText(patch.type_code);
  if (!typeCode || typeCode === "unknown") {
    if (/harness|attachment|背带|附件|strap/.test(source)) typeCode = "bdsm";
    else if (/lube|lubricant|润滑|护理/.test(source)) typeCode = "care_accessory";
    else typeCode = normalizePhysicalForm(row.specs?.physical_form) === "internal" ? "insertable" : "external_vibe";
  }

  const subtypeCode = normalizeSubtypeCode(patch.subtype_code, typeCode, source);
  return { typeCode, subtypeCode, maxDb: patch.max_db, waterproof: patch.waterproof };
}

function buildRecommendationFeaturesForPatch(patch: Omit<LovenseFemaleRefreshPatch, "recommendationFeatures">) {
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

  return {
    featureVersion: payload.featureVersion,
    ...payload.features,
  };
}

function inferTagsFromText(row: LovenseCleanedRow) {
  const source = `${row.name ?? ""}\n${row.rawDescription ?? ""}`.toLowerCase();
  const tags: string[] = [];
  const push = (tag: string, pattern: RegExp) => {
    if (pattern.test(source) && !tags.includes(tag)) tags.push(tag);
  };

  push("APP控制", /app[-\s]?controlled|app support|lovense remote|app支持|应用/);
  push("远程遥控", /remote|遥控|远程/);
  push("长距离互动", /long[-\s]?distance|异地/);
  push("静音", /quiet|discreet|whisper|静音|隐秘/);
  push("防水", /waterproof|ipx|防水/);
  push("可穿戴", /wearable|panty|可穿戴|内裤/);
  push("G点刺激", /g[-\s]?spot|g点/);
  push("阴蒂刺激", /clit|clitoral|阴蒂/);
  push("兔耳双刺激", /rabbit|bunny|兔/);
  push("空气脉冲", /suction|sucker|air pulse|吸吮|吮吸/);
  push("护理耗材", /lube|lubricant|cleaner|清洁|润滑/);

  return tags;
}

function normalizeLovenseSourceRows(rows: LovenseCleanedRow[]) {
  return rows.map((row) => {
    const existingSpecs = row.specs ?? {};
    const priceUsd = Number(row.priceUsd ?? (normalizeLower(row.priceCurrency) === "usd" ? row.price : existingSpecs.price_usd));
    const inferredTags = inferTagsFromText(row);
    const functionTags = Array.isArray(existingSpecs.function_tags)
      ? existingSpecs.function_tags
      : inferredTags;

    return {
      ...row,
      price: normalizeRmbPrice(row),
      image: row.image ?? row.coverImage ?? row.detailImageUrls?.[0] ?? null,
      specs: {
        ...existingSpecs,
        function_tags: functionTags.length > 0 ? functionTags : ["APP控制", "远程遥控"],
        gender: existingSpecs.gender ?? row.genderHint ?? "female",
        material: existingSpecs.material ?? "亲肤硅胶",
        price_usd: Number.isFinite(priceUsd) && priceUsd > 0 ? priceUsd : null,
        price_rmb: normalizeRmbPrice(row),
        fx_rate_usd_cny: LOVENSE_BUFFER_USD_TO_CNY_RATE,
        fx_rate_source: existingSpecs.fx_rate_source ?? "lovense-review-buffer",
        fx_rate_date: existingSpecs.fx_rate_date ?? "2026-06-09",
      },
    } satisfies LovenseCleanedRow;
  });
}

export function buildLovenseFemaleRefreshPatch(row: LovenseCleanedRow): LovenseFemaleRefreshPatch {
  const name = resolveLovenseName(row);
  const rawDescription = normalizeNonEmpty(
    row.rawDescription,
    `${name}\nLovense 官方女性列表商品，来自 ${LOVENSE_WOMEN_LIST_URL}。`,
  );
  const typePatch = resolveLovenseTypePatch(row);
  const typeCode = typePatch.typeCode;
  const subtypeCode = typePatch.subtypeCode;
  const productTags = Array.isArray(row.specs?.function_tags)
    ? row.specs.function_tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
    : [];

  const patchWithoutFeatures = {
    name,
    safeDisplayName: buildSafeDisplayName(name),
    price: normalizeRmbPrice(row),
    maxDb: normalizeMaxDb(typePatch.maxDb ?? row.specs?.max_db, typeCode),
    waterproof: normalizeWaterproof(typePatch.waterproof ?? row.specs?.waterproof, typeCode),
    appearance: normalizeNonEmpty(row.specs?.appearance, "normal"),
    physicalForm: normalizePhysicalForm(row.specs?.physical_form),
    motorType: normalizeMotorType(row.specs?.motor_type),
    gender: normalizeRowGender(row),
    brand: LOVENSE_BRAND_NAME,
    material: normalizeNonEmpty(row.specs?.material, typeCode === "bdsm" ? "亲肤面料" : "亲肤硅胶"),
    link: normalizeNonEmpty(row.sourceUrl, LOVENSE_WOMEN_LIST_URL),
    imageUrl: normalizeNonEmpty(row.image ?? row.coverImage, "/assets/product-placeholder/gspot_insertable.png"),
    rawDescription,
    typeCode,
    subtypeCode,
    productTags: productTags.length > 0 ? productTags : ["APP控制", "远程遥控"],
    productSpecs: {
      ...(row.specs ?? {}),
      rawDescription,
      sourceUrl: normalizeNonEmpty(row.sourceUrl, LOVENSE_WOMEN_LIST_URL),
      officialListUrl: LOVENSE_WOMEN_LIST_URL,
      officialCleanedAt: new Date().toISOString(),
    },
  } satisfies Omit<LovenseFemaleRefreshPatch, "recommendationFeatures">;

  return {
    ...patchWithoutFeatures,
    recommendationFeatures: buildRecommendationFeaturesForPatch(patchWithoutFeatures),
  };
}

async function ensureLovenseCompetitor(client: PgClientLike) {
  const prismaLike = {
    competitors: {
      findFirst: async (args: any) => {
        const names = args?.where?.OR?.flatMap((entry: any) => {
          const nameFilter = entry?.name;
          const value = typeof nameFilter === "object" ? nameFilter?.contains : nameFilter;
          return value ? [value] : [];
        }) ?? [LOVENSE_BRAND_NAME];
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
    brandName: LOVENSE_BRAND_NAME,
    overrideConfig: LOVENSE_COMPETITOR_CONFIG,
  });
}

async function upsertProductAndFemaleToy(
  client: PgClientLike,
  patch: LovenseFemaleRefreshPatch,
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
    ],
  );
}

export function shouldRunLovenseFemaleRefreshScript(importMetaUrl: string, argvEntry?: string) {
  return Boolean(argvEntry && importMetaUrl === pathToFileURL(argvEntry).href);
}

async function refreshLovenseFemaleProducts() {
  const sourceMode = normalizeLower(process.env.LOVENSE_REFRESH_SOURCE || "cleaned");
  const sourcePath = sourceMode === "buffer" ? LOVENSE_REVIEW_BUFFER_PATH : LOVENSE_CLEANED_PATH;
  const rows = normalizeLovenseSourceRows(JSON.parse(fs.readFileSync(sourcePath, "utf8")) as LovenseCleanedRow[]);
  const patches = rows.filter(shouldKeepLovenseFemaleCleanedRow).map(buildLovenseFemaleRefreshPatch);
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.DIRECT_URL,
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

    await client.query("SET statement_timeout TO 0");
    await client.query("SET lock_timeout TO '5s'");
    await client.query("BEGIN");

    const competitorId = await ensureLovenseCompetitor(client);
    await client.query("DELETE FROM public.female_recommender_toys WHERE lower(brand) = lower($1)", [LOVENSE_BRAND_NAME]);

    for (const patch of patches) {
      await upsertProductAndFemaleToy(client, patch, competitorId);
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
      [LOVENSE_BRAND_NAME],
    );

    await client.query("COMMIT");
    console.log(
      JSON.stringify(
        {
          brand: LOVENSE_BRAND_NAME,
          source: LOVENSE_WOMEN_LIST_URL,
          sourceMode,
          sourcePath,
          inputRows: rows.length,
          refreshed: patches.length,
          ...audit.rows[0],
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client?.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client?.release();
    await pool.end().catch(() => {});
  }
}

if (shouldRunLovenseFemaleRefreshScript(import.meta.url, process.argv[1])) {
  refreshLovenseFemaleProducts().catch((error) => {
    console.error("[refresh-lovense-female-products-from-official] 执行失败:", error);
    process.exitCode = 1;
  });
}
