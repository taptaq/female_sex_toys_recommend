import dotenv from "dotenv";
import pg from "pg";
import { pathToFileURL } from "node:url";

import {
  buildRecommendationFeatureBackfillPayload,
  type RecommendationFeatureBackfillRow,
} from "./backfill-recommendation-product-features.ts";
import { buildSafeDisplayName } from "../lib/product-display-name.ts";
import {
  CLEANED_PATH,
  type CleanedRow,
} from "../scraper/kumocoom-official/cleaner.ts";
import { ensureCompetitorRecord } from "../scraper/shared/competitor-registry.ts";

dotenv.config();

const { Pool } = pg;
const BRAND_NAME = "KUMOCOOM";

type KumocoomRefreshPatch = {
  name: string;
  safeDisplayName: string;
  price: number;
  maxDb: number;
  waterproof: number;
  appearance: string;
  physicalForm: "external" | "internal" | "composite";
  motorType: "gentle" | "strong";
  gender: "female" | "unisex";
  brand: typeof BRAND_NAME;
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

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizePositivePrice(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 1;
}

function normalizeNonEmpty(value: unknown, fallback: string) {
  const normalized = normalizeText(value);
  return normalized || fallback;
}

function normalizePhysicalForm(value: unknown): "external" | "internal" | "composite" {
  const normalized = normalizeText(value);
  if (normalized === "internal" || normalized === "composite") return normalized;
  return "external";
}

function normalizeMotorType(value: unknown): "gentle" | "strong" {
  return normalizeText(value) === "strong" ? "strong" : "gentle";
}

function normalizeGender(value: unknown): "female" | "unisex" {
  return normalizeText(value) === "unisex" ? "unisex" : "female";
}

function normalizeTypeCode(value: unknown, physicalForm: string) {
  const normalized = normalizeText(value);
  if (normalized && normalized !== "unknown") return normalized;
  return physicalForm === "internal" ? "insertable" : "bdsm";
}

function normalizeSubtypeCode(value: unknown, typeCode: string) {
  const normalized = normalizeText(value);
  if (normalized) return normalized;
  return typeCode === "insertable" ? "gspot_insertable" : "fetish_accessory";
}

function normalizeMaxDb(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

function normalizeWaterproof(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

function buildRecommendationFeaturesForPatch(patch: Omit<KumocoomRefreshPatch, "recommendationFeatures">) {
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

export function buildKumocoomFemaleRefreshPatch(row: CleanedRow): KumocoomRefreshPatch {
  const name = normalizeNonEmpty(row.name, "KUMOCOOM 未命名商品");
  const physicalForm = normalizePhysicalForm(row.specs?.physical_form);
  const typeCode = normalizeTypeCode(row.typeCode ?? row.specs?.type_code, physicalForm);
  const subtypeCode = normalizeSubtypeCode(row.subtypeCode ?? row.specs?.subtype_code, typeCode);
  const rawDescription = normalizeNonEmpty(
    row.rawDescription,
    `${name}\nKUMOCOOM 官方商品，材质与价格来自官方独立站。`,
  );
  const productTags = Array.isArray(row.specs?.function_tags)
    ? row.specs.function_tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
    : [];

  const patchWithoutFeatures = {
    name,
    safeDisplayName: normalizeNonEmpty(row.safeDisplayName, buildSafeDisplayName(name)),
    price: normalizePositivePrice(row.price),
    maxDb: normalizeMaxDb(row.specs?.max_db),
    waterproof: normalizeWaterproof(row.specs?.waterproof),
    appearance: normalizeNonEmpty(row.specs?.appearance, "normal"),
    physicalForm,
    motorType: normalizeMotorType(row.specs?.motor_type),
    gender: normalizeGender(row.gender),
    brand: BRAND_NAME,
    material: normalizeNonEmpty(row.material, "硅胶"),
    link: normalizeNonEmpty(row.sourceUrl, "https://kumocoom.cn/collections/all"),
    imageUrl: normalizeNonEmpty(row.coverImage, "/assets/product-placeholder/gspot_insertable.png"),
    rawDescription,
    typeCode,
    subtypeCode,
    productTags: productTags.length > 0 ? productTags : ["幻想造型"],
    productSpecs: {
      ...(row.specs ?? {}),
      rawDescription,
      sourceUrl: normalizeNonEmpty(row.sourceUrl, "https://kumocoom.cn/collections/all"),
      officialCleanedAt: new Date().toISOString(),
    },
  } satisfies Omit<KumocoomRefreshPatch, "recommendationFeatures">;

  return {
    ...patchWithoutFeatures,
    recommendationFeatures: buildRecommendationFeaturesForPatch(patchWithoutFeatures),
  };
}

async function ensureKumocoomCompetitor(client: PgClientLike) {
  const prismaLike = {
    competitors: {
      findFirst: async (args: any) => {
        const names = args?.where?.OR?.flatMap((entry: any) => Object.values(entry ?? {})) ?? [BRAND_NAME];
        const result = await client.query(
          `
            SELECT id, name, domain, country, founded_date, description, is_domestic
            FROM public.competitors
            WHERE lower(name) = ANY($1::text[])
            LIMIT 1
          `,
          [names.map((name: unknown) => normalizeText(name).toLowerCase())],
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
            RETURNING id, name, domain, country, founded_date, description, is_domestic
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
            SET domain = $2,
                country = $3,
                founded_date = $4,
                description = $5,
                focus = $6,
                philosophy = $7::text[],
                major_user_group_profile = $8,
                is_domestic = $9,
                updated_at = NOW()
            WHERE id = $1::uuid
            RETURNING id, name, domain, country, founded_date, description, is_domestic
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
    brandName: BRAND_NAME,
  });
}

async function upsertProductAndFemaleToy(
  client: PgClientLike,
  patch: KumocoomRefreshPatch,
  competitorId: string | null,
) {
  const existingProduct = await client.query(
    `
      SELECT id
      FROM public.products
      WHERE name = $1
      ORDER BY created_at DESC NULLS LAST
      LIMIT 1
    `,
    [patch.name],
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

  const toyValues = [
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
    toyValues,
  );
}

export function shouldRunKumocoomFemaleRefreshScript(importMetaUrl: string, argvEntry?: string) {
  return Boolean(argvEntry && importMetaUrl === pathToFileURL(argvEntry).href);
}

async function refreshKumocoomFemaleProducts() {
  const fs = await import("node:fs");
  const rows = JSON.parse(fs.readFileSync(CLEANED_PATH, "utf8")) as CleanedRow[];
  const patches = rows.map(buildKumocoomFemaleRefreshPatch);
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  const client = await pool.connect();

  try {
    await client.query("SET statement_timeout TO 0");
    await client.query("SET lock_timeout TO '5s'");
    await client.query("BEGIN");
    const competitorId = await ensureKumocoomCompetitor(client);
    await client.query("DELETE FROM public.female_recommender_toys WHERE brand = $1", [BRAND_NAME]);

    for (const patch of patches) {
      await upsertProductAndFemaleToy(client, patch, competitorId);
    }

    const audit = await client.query(
      `
        SELECT
          COUNT(*)::int AS rows,
          COUNT(*) FILTER (
            WHERE NULLIF(BTRIM(COALESCE(name, '')), '') IS NULL
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
          )::int AS rows_with_missing_fields
        FROM public.female_recommender_toys
        WHERE brand = $1
      `,
      [BRAND_NAME],
    );

    await client.query("COMMIT");
    console.log(
      JSON.stringify(
        {
          brand: BRAND_NAME,
          refreshed: patches.length,
          ...audit.rows[0],
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

if (shouldRunKumocoomFemaleRefreshScript(import.meta.url, process.argv[1])) {
  refreshKumocoomFemaleProducts().catch((error) => {
    console.error("[refresh-kumocoom-female-products-from-official] 执行失败:", error);
    process.exitCode = 1;
  });
}
