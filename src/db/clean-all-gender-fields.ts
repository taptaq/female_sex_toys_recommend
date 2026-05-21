import dotenv from "dotenv";
import pg from "pg";
import { pathToFileURL } from "node:url";

import { buildRecommendationProductFeatures } from "../lib/recommendation-product-features.ts";
import type { Product } from "../data/mock.ts";

dotenv.config();

const { Pool } = pg;

const READ_LIMIT = 10_000;

type Gender = "female" | "male" | "unisex";

type GenderAuditRow = {
  id: string;
  original_id: string | null;
  name: string;
  safe_display_name: string | null;
  price: string | null;
  max_db: number | null;
  waterproof: number | null;
  appearance: string | null;
  physical_form: string | null;
  motor_type: string | null;
  current_gender: string | null;
  brand: string | null;
  material: string | null;
  image_url: string | null;
  raw_description: string | null;
  type_code: string | null;
  subtype_code: string | null;
  product_gender: string | null;
  product_tags: string[] | null;
  product_raw_description: string | null;
  product_category: string | null;
};

type GenderPatch = {
  id: string;
  originalId: string | null;
  name: string;
  currentGender: string | null;
  currentProductGender: string | null;
  nextGender: Gender;
  reason: string;
  confidence: "high" | "medium";
  recommendationFeatures: Record<string, unknown>;
};

const VALID_GENDERS = new Set(["female", "male", "unisex"]);

function normalizeText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeGenderValue(value: unknown): Gender | null {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === "female" || normalized === "woman" || normalized === "women" || normalized === "her") return "female";
  if (normalized === "male" || normalized === "man" || normalized === "men" || normalized === "him") return "male";
  if (normalized === "unisex" || normalized === "all" || normalized === "couples" || normalized === "couple") return "unisex";
  return null;
}

function toProductGender(gender: Gender) {
  return gender.charAt(0).toUpperCase() + gender.slice(1);
}

function buildSignalText(row: GenderAuditRow) {
  return [
    row.name,
    row.brand,
    row.type_code,
    row.subtype_code,
    row.product_category,
    row.raw_description,
    row.product_raw_description,
    ...(Array.isArray(row.product_tags) ? row.product_tags : []),
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n")
    .toLowerCase();
}

function buildNameCategoryText(row: GenderAuditRow) {
  return [
    row.name,
    row.safe_display_name,
    row.brand,
    row.type_code,
    row.subtype_code,
    row.product_category,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n")
    .toLowerCase();
}

function buildTrustedCatalogText(row: GenderAuditRow) {
  return [
    row.name,
    row.brand,
    row.type_code,
    row.subtype_code,
    row.product_category,
    ...(Array.isArray(row.product_tags) ? row.product_tags : []),
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n")
    .toLowerCase();
}

function buildRawLeadText(row: GenderAuditRow) {
  return [row.raw_description, row.product_raw_description]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.slice(0, 1_200))
    .join("\n")
    .toLowerCase();
}

function has(text: string, pattern: RegExp) {
  return pattern.test(text);
}

function hasAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

const CARE_PATTERNS = [
  /润滑液/u,
  /润滑剂/u,
  /人体润滑/u,
  /水基/u,
  /玻尿酸/u,
  /按摩油/u,
  /按摩蜡烛/u,
  /香薰蜡烛/u,
  /蜡烛/u,
  /护理液/u,
  /清洁液/u,
  /湿巾/u,
  /安全套/u,
  /避孕套/u,
  /\blube\b/i,
  /\blubricant\b/i,
  /\bmassage\s+candle\b/i,
  /\bmassage\s+oil\b/i,
  /\bcondoms?\b/i,
  /\bwipes?\b/i,
];

const LINGERIE_PATTERNS = [
  /情趣内衣/u,
  /内衣/u,
  /睡衣/u,
  /睡裙/u,
  /连体衣/u,
  /蕾丝/u,
  /吊带/u,
  /制服/u,
  /\blingerie\b/i,
  /\bbodysuit\b/i,
  /\bsleepwear\b/i,
];

const FEMALE_STRONG_PATTERNS = [
  /女性/u,
  /女用/u,
  /女生/u,
  /女士/u,
  /阴蒂/u,
  /外阴/u,
  /阴道/u,
  /g点/u,
  /g-spot/i,
  /c点/u,
  /跳蛋/u,
  /震动棒/u,
  /振动棒/u,
  /按摩棒/u,
  /吮吸器/u,
  /兔耳/u,
  /兔嘴/u,
  /兔子/u,
  /口红/u,
  /yoni/i,
  /clit/i,
  /clitoral/i,
  /vaginal/i,
  /for\s+(women|her)/i,
];

const MALE_STRONG_PATTERNS = [
  /男性/u,
  /男用/u,
  /男士/u,
  /飞机杯/u,
  /自慰杯/u,
  /手冲杯/u,
  /男性自慰器/u,
  /男用自慰器/u,
  /阴茎/u,
  /龟头/u,
  /前列腺/u,
  /睾丸/u,
  /倒模/u,
  /名器/u,
  /锁精环/u,
  /阴茎环/u,
  /cock\s*ring/i,
  /\bpenis\b/i,
  /\bprostate\b/i,
  /fleshlight/i,
  /stroker/i,
  /masturbator/i,
  /for\s+(men|him)/i,
];

const UNISEX_STRONG_PATTERNS = [
  /情侣/u,
  /夫妻/u,
  /双人/u,
  /共玩/u,
  /男女通用/u,
  /双方/u,
  /strap-on/i,
  /harness/i,
  /pegging/i,
  /for\s+two/i,
  /couples?/i,
  /unisex/i,
];

const FEMALE_LABELED_PATTERNS = [
  /(?:性别(?:提示)?|适用(?:人群|对象)?|适合(?:人群|对象)?|面向|人群|audience)\s*[:：-]?\s*(?:女性|女用|女生|女士|women|woman|female|her)/i,
  /(?:女性|女用|女生|女士)\s*(?:专用|适用|使用|玩具|用品)/u,
];

const MALE_LABELED_PATTERNS = [
  /(?:性别(?:提示)?|适用(?:人群|对象)?|适合(?:人群|对象)?|面向|人群|audience)\s*[:：-]?\s*(?:男性|男用|男士|men|man|male|him)/i,
  /(?:男性|男用|男士)\s*(?:专用|适用|使用|玩具|用品)/u,
];

const UNISEX_LABELED_PATTERNS = [
  /(?:性别(?:提示)?|适用(?:人群|对象)?|适合(?:人群|对象)?|面向|人群|audience)\s*[:：-]?\s*(?:情侣|夫妻|双人|男女(?:通用)?|unisex|couples?)/i,
  /(?:情侣|夫妻|双人|男女通用)\s*(?:专用|适用|使用|玩具|用品)?/u,
];

const MALE_TYPES = new Set(["masturbator", "prostate", "cock_ring"]);
const FEMALE_TYPES = new Set(["suction", "external_vibe", "insertable", "dual_stimulation", "wearable_remote"]);
const UNISEX_TYPES = new Set(["couples", "bdsm"]);

const MALE_SUBTYPES = new Set([
  "manual_masturbator",
  "vibrating_masturbator",
  "interactive_masturbator",
  "prostate_vibe",
  "prostate_plug",
  "classic_cock_ring",
  "vibrating_cock_ring",
]);

const COUPLES_SUBTYPES = new Set([
  "insertable_couples",
  "external_couples",
  "dual_wearable_remote",
]);

const FEMALE_DEFAULT_BRANDS = new Set([
  "womanizer",
  "iroha",
  "kisstoy",
  "lelo",
  "we-vibe",
  "svakom",
  "dame",
]);

const MALE_DEFAULT_BRANDS = new Set([
  "tenga",
  "arcwave",
  "雷霆暴风",
]);

function normalizeBrand(value: string | null) {
  return normalizeText(value).toLowerCase();
}

function resolveGender(row: GenderAuditRow): Pick<GenderPatch, "nextGender" | "reason" | "confidence"> {
  const signalText = buildSignalText(row);
  const nameCategoryText = buildNameCategoryText(row);
  const trustedCatalogText = buildTrustedCatalogText(row);
  const rawLeadText = buildRawLeadText(row);
  const currentGender = normalizeGenderValue(row.current_gender);
  const productGender = normalizeGenderValue(row.product_gender);
  const typeCode = normalizeText(row.type_code).toLowerCase();
  const subtypeCode = normalizeText(row.subtype_code).toLowerCase();
  const brand = normalizeBrand(row.brand);

  const hasCare = typeCode === "care_accessory" || subtypeCode === "lube_care" || subtypeCode === "condom" || hasAny(trustedCatalogText, CARE_PATTERNS);
  const hasLingerie = subtypeCode === "lingerie" || hasAny(nameCategoryText, LINGERIE_PATTERNS);
  const catalogHasFemale = hasAny(nameCategoryText, FEMALE_STRONG_PATTERNS);
  const catalogHasMale = hasAny(nameCategoryText, MALE_STRONG_PATTERNS);
  const catalogHasUnisex = hasAny(nameCategoryText, UNISEX_STRONG_PATTERNS);
  const rawHasFemaleLabel = hasAny(rawLeadText, FEMALE_LABELED_PATTERNS);
  const rawHasMaleLabel = hasAny(rawLeadText, MALE_LABELED_PATTERNS);
  const rawHasUnisexLabel = hasAny(rawLeadText, UNISEX_LABELED_PATTERNS);
  const hasFemale = catalogHasFemale || (!currentGender && rawHasFemaleLabel);
  const hasMale = catalogHasMale || (!currentGender && rawHasMaleLabel);
  const hasUnisex = catalogHasUnisex || (!currentGender && rawHasUnisexLabel);

  if (brand === "lovense" && /lush\s+mini\s*&\s*gush\s*2/i.test(nameCategoryText)) {
    return { nextGender: "unisex", reason: "lovense_lush_gush_combo", confidence: "high" };
  }

  if (brand === "lovense" && /max\s*2\s+and\s+edge\s*2/i.test(nameCategoryText)) {
    return { nextGender: "male", reason: "lovense_max_edge_male_combo", confidence: "high" };
  }

  if (brand === "tenga" && /iroha/i.test(signalText)) {
    return { nextGender: "female", reason: "tenga_iroha_female_line", confidence: "high" };
  }

  if (MALE_SUBTYPES.has(subtypeCode)) {
    return { nextGender: "male", reason: `male_subtype:${subtypeCode}`, confidence: "high" };
  }

  if (MALE_TYPES.has(typeCode)) {
    return { nextGender: "male", reason: `male_type:${typeCode}`, confidence: "high" };
  }

  if (hasCare && !hasLingerie) {
    return { nextGender: "unisex", reason: "care_or_consumable", confidence: "high" };
  }

  if (hasLingerie) {
    if (has(nameCategoryText, /男士|男性|男用|men'?s|\bmale\b/i)) {
      return { nextGender: "male", reason: "male_lingerie_signal", confidence: "high" };
    }
    return { nextGender: "female", reason: "lingerie_default_female", confidence: "high" };
  }

  if (COUPLES_SUBTYPES.has(subtypeCode)) {
    if (hasMale && !hasFemale) return { nextGender: "male", reason: "couple_subtype_but_male_signal", confidence: "high" };
    if (hasFemale && !hasMale) return { nextGender: "female", reason: "couple_subtype_but_female_signal", confidence: "high" };
    if (currentGender && currentGender !== "unisex") return { nextGender: currentGender, reason: "couple_subtype_keep_current", confidence: "medium" };
    return { nextGender: "unisex", reason: `couple_subtype:${subtypeCode}`, confidence: "high" };
  }

  if (UNISEX_TYPES.has(typeCode)) {
    if (currentGender && currentGender !== "unisex" && typeCode === "bdsm") {
      return { nextGender: currentGender, reason: "bdsm_type_keep_current", confidence: "medium" };
    }
    return { nextGender: "unisex", reason: `unisex_type:${typeCode}`, confidence: "high" };
  }

  if (hasUnisex && !hasMale && !hasFemale && !currentGender) {
    return { nextGender: "unisex", reason: "explicit_unisex_signal", confidence: "high" };
  }

  if (hasMale && !hasFemale) {
    return { nextGender: "male", reason: "explicit_male_signal", confidence: "high" };
  }

  if (hasFemale && !hasMale) {
    return { nextGender: "female", reason: "explicit_female_signal", confidence: "high" };
  }

  if (hasMale && hasFemale) {
    if (currentGender) return { nextGender: currentGender, reason: "mixed_gender_keep_current", confidence: "medium" };
    if (productGender) return { nextGender: productGender, reason: "mixed_gender_product_gender_fallback", confidence: "medium" };
    if (hasUnisex) return { nextGender: "unisex", reason: "mixed_gender_with_unisex_signal", confidence: "medium" };
  }

  if (FEMALE_TYPES.has(typeCode)) {
    if (brand === "arcwave") return { nextGender: "male", reason: "arcwave_brand_override", confidence: "high" };
    if (currentGender && currentGender !== "unisex") return { nextGender: currentGender, reason: "female_type_keep_current", confidence: "medium" };
    if (productGender && productGender !== "unisex") return { nextGender: productGender, reason: "female_type_product_gender", confidence: "medium" };
    return { nextGender: "female", reason: `female_type:${typeCode}`, confidence: "medium" };
  }

  if (MALE_DEFAULT_BRANDS.has(brand)) {
    return { nextGender: "male", reason: `male_brand:${brand}`, confidence: "medium" };
  }

  if (FEMALE_DEFAULT_BRANDS.has(brand)) {
    return { nextGender: "female", reason: `female_brand:${brand}`, confidence: "medium" };
  }

  if (currentGender && VALID_GENDERS.has(currentGender)) {
    return { nextGender: currentGender, reason: "keep_current", confidence: "medium" };
  }

  if (productGender && VALID_GENDERS.has(productGender)) {
    return { nextGender: productGender, reason: "product_gender_fallback", confidence: "medium" };
  }

  return { nextGender: "unisex", reason: "unknown_default_unisex", confidence: "medium" };
}

function normalizeAppearance(value: string | null): Product["appearance"] {
  return value === "high_disguise" ? "high_disguise" : "normal";
}

function normalizePhysicalForm(value: string | null): Product["physicalForm"] {
  if (value === "internal" || value === "composite") return value;
  return "external";
}

function normalizeMotorType(value: string | null): Product["motorType"] {
  return value === "strong" ? "strong" : "gentle";
}

function buildFeatures(row: GenderAuditRow, gender: Gender) {
  const product: Product = {
    id: row.id,
    originalId: row.original_id,
    name: row.name,
    displayName: row.safe_display_name ?? undefined,
    safeDisplayName: row.safe_display_name ?? undefined,
    price: Number(row.price) || 0,
    maxDb: row.max_db,
    waterproof: row.waterproof,
    appearance: normalizeAppearance(row.appearance),
    physicalForm: normalizePhysicalForm(row.physical_form),
    motorType: normalizeMotorType(row.motor_type),
    gender,
    typeCode: row.type_code,
    subtypeCode: row.subtype_code,
    brand: row.brand ?? "",
    material: row.material ?? "",
    imagePlaceholder: row.image_url ?? "",
    rawDescription: [row.raw_description, row.product_raw_description].filter(Boolean).join("\n"),
    tags: Array.isArray(row.product_tags) ? row.product_tags : [],
  };
  const features = buildRecommendationProductFeatures(product);

  return {
    featureVersion: "recommendation-product-features-v1",
    isSuctionLike: features.isSuctionLike,
    isInsertableLike: features.isInsertableLike,
    supportsAppOrRemote: features.supportsAppOrRemote,
    isCoupleOriented: features.isCoupleOriented,
    hasManyPatterns: features.hasManyPatterns,
    hasStrongSuctionSignal: features.hasStrongSuctionSignal,
    hasGentleSignal: features.hasGentleSignal,
    hasStrongIntensitySignal: features.hasStrongIntensitySignal,
    evidence: features.evidence,
  };
}

export function buildGenderPatch(row: GenderAuditRow): GenderPatch | null {
  const resolved = resolveGender(row);
  const currentGender = normalizeGenderValue(row.current_gender);
  const productGender = normalizeGenderValue(row.product_gender);

  if (currentGender === resolved.nextGender && productGender === resolved.nextGender) {
    return null;
  }

  return {
    id: row.id,
    originalId: row.original_id,
    name: row.name,
    currentGender: row.current_gender,
    currentProductGender: row.product_gender,
    nextGender: resolved.nextGender,
    reason: resolved.reason,
    confidence: resolved.confidence,
    recommendationFeatures: buildFeatures(row, resolved.nextGender),
  };
}

export function shouldRunCleanAllGenderFieldsScript(importMetaUrl: string, argvEntry?: string) {
  return Boolean(argvEntry) && importMetaUrl === pathToFileURL(argvEntry).href;
}

async function readRows(client: pg.PoolClient) {
  const result = await client.query<GenderAuditRow>(
    `
      SELECT
        t.id,
        t.original_id,
        t.name,
        t.safe_display_name,
        t.price::text,
        t.max_db,
        t.waterproof,
        t.appearance,
        t.physical_form,
        t.motor_type,
        t.gender AS current_gender,
        t.brand,
        t.material,
        t.image_url,
        t.raw_description,
        t.type_code,
        t.subtype_code,
        p.gender AS product_gender,
        p.tags AS product_tags,
        p.specs::jsonb ->> 'rawDescription' AS product_raw_description,
        p.category AS product_category
      FROM public.recommender_toys AS t
      LEFT JOIN public.products AS p
        ON p.id = t.original_id
      ORDER BY t.name
      LIMIT $1
    `,
    [READ_LIMIT],
  );

  return result.rows;
}

async function applyPatch(client: pg.PoolClient, patch: GenderPatch) {
  await client.query(
    `
      UPDATE public.recommender_toys
      SET gender = $2,
          recommendation_features = $3::jsonb,
          updated_at = NOW()
      WHERE id = $1::uuid
    `,
    [patch.id, patch.nextGender, JSON.stringify(patch.recommendationFeatures)],
  );

  if (!patch.originalId) return;

  await client.query(
    `
      UPDATE public.products
      SET gender = $2,
          specs = jsonb_set(
            COALESCE(specs::jsonb, '{}'::jsonb),
            '{gender}',
            to_jsonb($3::text),
            true
          )
      WHERE id = $1::uuid
    `,
    [patch.originalId, toProductGender(patch.nextGender), patch.nextGender],
  );
}

async function cleanAllGenderFields() {
  const dryRun = process.argv.includes("--dry-run");
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  const client = await pool.connect();

  try {
    await client.query("SET statement_timeout TO 0");
    await client.query("SET lock_timeout TO '5s'");

    const rows = await readRows(client);
    const patches = rows
      .map(buildGenderPatch)
      .filter((patch): patch is GenderPatch => patch !== null);

    const byReason = patches.reduce<Record<string, number>>((acc, patch) => {
      acc[patch.reason] = (acc[patch.reason] ?? 0) + 1;
      return acc;
    }, {});

    if (!dryRun) {
      await client.query("BEGIN");
      for (const patch of patches) {
        await applyPatch(client, patch);
      }
      await client.query("COMMIT");
    }

    console.log(
      JSON.stringify(
        {
          dryRun,
          scanned: rows.length,
          updates: patches.length,
          byReason,
          sample: patches.slice(0, 80).map((patch) => ({
            name: patch.name,
            current: patch.currentGender,
            productGender: patch.currentProductGender,
            next: patch.nextGender,
            reason: patch.reason,
            confidence: patch.confidence,
          })),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}

if (shouldRunCleanAllGenderFieldsScript(import.meta.url, process.argv[1])) {
  cleanAllGenderFields().catch((error) => {
    console.error("[clean-all-gender-fields] 执行失败:", error);
    process.exitCode = 1;
  });
}
