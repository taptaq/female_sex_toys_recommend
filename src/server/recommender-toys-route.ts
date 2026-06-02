import type { RequestHandler } from "express";

import { buildBrandBrief } from "../lib/brand-brief.js";
import { buildSafeDisplayName } from "../lib/product-display-name.js";
import {
  getParentLibraryTypeCodeForSubtype,
  type LibraryAudienceGender,
  type LibrarySelectableTypeCode,
  type LibrarySubtypeCode,
} from "../lib/library-product-types.js";
import {
  resolveLibraryAudienceGender,
  resolveLibrarySubtypeCode,
  resolveLibraryTypeCode,
} from "../lib/library-product-type-classifier.js";
import { createJsonEtag, requestHasMatchingEtag } from "./http-cache.js";

type QueryResultRow = {
  id: string;
  original_id: string | null;
  name: string;
  safe_display_name: string | null;
  price: string | number | null;
  max_db: number | null;
  waterproof: number | null;
  appearance: "high_disguise" | "normal";
  physical_form: "external" | "internal" | "composite";
  motor_type: "gentle" | "strong";
  gender: string | null;
  type_code: string | null;
  subtype_code: string | null;
  brand: string | null;
  material: string | null;
  image_url: string | null;
  resolved_raw_description: string | null;
  link: string | null;
  tags: string[] | null;
  persona_analysis: string | null;
  is_domestic: boolean | null;
  competitor_domain: string | null;
  competitor_country: string | null;
  competitor_description: string | null;
  competitor_focus: string | null;
  competitor_philosophy: string[] | null;
  competitor_major_user_group_profile: string | null;
};

type Queryable = {
  query: (sql: string) => Promise<{ rows: QueryResultRow[] }>;
};

type CachedPayload = {
  expiresAt: number;
  payload: ReturnType<typeof normalizeLibraryRows>;
  etag: string;
};

const CACHE_CONTROL_HEADER =
  "public, max-age=0, s-maxage=300, stale-while-revalidate=1800";
const DEFAULT_CACHE_TTL_MS = 5 * 60_000;

function isTransientDatabaseReadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /Connection terminated|ECONNRESET|server closed the connection|terminating connection|P1001|P1017/i.test(
    message,
  );
}

async function queryWithRetry(
  pool: Queryable,
  sql: string,
) {
  try {
    return await pool.query(sql);
  } catch (error) {
    if (!isTransientDatabaseReadError(error)) {
      throw error;
    }
    return await pool.query(sql);
  }
}

function isAudienceGender(value: string | null | undefined): value is Exclude<
  LibraryAudienceGender,
  "all"
> {
  return value === "female" || value === "male" || value === "unisex";
}

function isSelectableTypeCode(
  value: string | null | undefined,
): value is LibrarySelectableTypeCode {
  return [
    "suction",
    "external_vibe",
    "insertable",
    "dual_stimulation",
    "masturbator",
    "prostate",
    "cock_ring",
    "couples",
    "wearable_remote",
    "care_accessory",
    "unknown",
  ].includes(String(value || ""));
}

function normalizeStoredSubtypeCode(
  typeCode: LibrarySelectableTypeCode | null,
  subtypeCode: string | null | undefined,
) {
  if (!typeCode || !subtypeCode) {
    return null;
  }

  const parentTypeCode = getParentLibraryTypeCodeForSubtype(subtypeCode);
  if (parentTypeCode !== typeCode) {
    return null;
  }

  return subtypeCode as LibrarySubtypeCode;
}

function normalizeLibraryRows(rows: QueryResultRow[]) {
  return rows.map((toy) => {
    const rawDescription = toy.resolved_raw_description || null;
    const tags = Array.isArray(toy.tags) ? toy.tags : [];
    const storedGender = isAudienceGender(toy.gender) ? toy.gender : null;
    const storedTypeCode = isSelectableTypeCode(toy.type_code)
      ? toy.type_code
      : null;
    const storedSubtypeCode = normalizeStoredSubtypeCode(
      storedTypeCode,
      toy.subtype_code,
    );

    const resolvedGender =
      storedGender ??
      resolveLibraryAudienceGender({
        gender: toy.gender,
        physicalForm: toy.physical_form,
        name: toy.name,
        rawDescription,
        tags,
      });
    const resolvedTypeCode =
      storedTypeCode ??
      resolveLibraryTypeCode(toy.type_code, {
        gender: resolvedGender,
        physicalForm: toy.physical_form,
        name: toy.name,
        rawDescription,
        tags,
      });
    const resolvedSubtypeCode =
      storedSubtypeCode ??
      resolveLibrarySubtypeCode(toy.subtype_code, {
        typeCode: resolvedTypeCode,
        gender: resolvedGender,
        physicalForm: toy.physical_form,
        name: toy.name,
        rawDescription,
        tags,
      });
    const safeDisplayName =
      toy.safe_display_name || buildSafeDisplayName(toy.name);
    const brandBrief = buildBrandBrief({
      brand: toy.brand,
      country: toy.competitor_country,
      description: toy.competitor_description,
      focus: toy.competitor_focus,
      philosophy: toy.competitor_philosophy,
      majorUserGroupProfile: toy.competitor_major_user_group_profile,
      officialWebsiteUrl: toy.competitor_domain,
    });

    return {
      id: toy.id,
      originalId: toy.original_id || null,
      name: toy.name,
      canonicalName: toy.name,
      displayName: safeDisplayName,
      safeDisplayName,
      price: Number(toy.price || 0),
      maxDb: toy.max_db,
      waterproof: toy.waterproof,
      appearance: toy.appearance,
      physicalForm: toy.physical_form,
      motorType: toy.motor_type,
      gender: resolvedGender,
      typeCode: resolvedTypeCode,
      subtypeCode: resolvedSubtypeCode,
      brand: toy.brand || "探索品牌",
      material: toy.material || "亲肤材质",
      rawDescription,
      imagePlaceholder:
        toy.image_url || "bg-gradient-to-br from-indigo-900/40 to-blue-900/40",
      link: toy.link || undefined,
      sourceUrl: toy.link || undefined,
      tags,
      personaAnalysis: toy.persona_analysis || undefined,
      isDomestic: toy.is_domestic ?? undefined,
      brandBrief,
    };
  });
}

export function createListRecommenderToysHandler({
  pool,
  ensureLibraryRouteReady,
  now = () => Date.now(),
  cacheTtlMs = DEFAULT_CACHE_TTL_MS,
}: {
  pool: Queryable;
  ensureLibraryRouteReady: () => Promise<void>;
  now?: () => number;
  cacheTtlMs?: number;
}): RequestHandler {
  let cachedPayload: CachedPayload | null = null;

  return async (req, res) => {
    const shouldRefresh =
      typeof req.query?.refresh === "string" && req.query.refresh === "1";

    res.setHeader("Cache-Control", CACHE_CONTROL_HEADER);

    try {
      await ensureLibraryRouteReady();

      if (
        !shouldRefresh &&
        cachedPayload &&
        cachedPayload.expiresAt > now()
      ) {
        res.setHeader("ETag", cachedPayload.etag);
        if (
          requestHasMatchingEtag(req.headers?.["if-none-match"], cachedPayload.etag)
        ) {
          res.status(304).end();
          return;
        }

        res.json(cachedPayload.payload);
        return;
      }

      const result = await queryWithRetry(pool, `
        SELECT
          t.id,
          t.original_id,
          t.name,
          t.safe_display_name,
          t.price,
          t.max_db,
          t.waterproof,
          t.appearance,
          t.physical_form,
          t.motor_type,
          t.gender,
          t.type_code,
          t.subtype_code,
          t.brand,
          t.material,
          t.image_url,
          COALESCE(NULLIF(t.raw_description, ''), p.specs::jsonb ->> 'rawDescription', NULL) AS resolved_raw_description,
          p.link,
          p.tags,
          p.persona_\x61nalysis AS persona_analysis,
          c.is_domestic,
          c.domain AS competitor_domain,
          c.country AS competitor_country,
          c.description AS competitor_description,
          c.focus AS competitor_focus,
          c.philosophy AS competitor_philosophy,
          c.major_user_group_profile AS competitor_major_user_group_profile
        FROM public.female_recommender_toys t
        LEFT JOIN public.products p ON t.original_id = p.id
        LEFT JOIN public.competitors c ON p.competitor_id = c.id
        ORDER BY t.created_at DESC
      `);

      const normalized = normalizeLibraryRows(result.rows);
      const etag = createJsonEtag(normalized);
      cachedPayload = {
        expiresAt: now() + cacheTtlMs,
        payload: normalized,
        etag,
      };

      console.log(`✅ [Server] 已同步 ${normalized.length} 条晶体库数据`);
      res.setHeader("ETag", etag);
      if (requestHasMatchingEtag(req.headers?.["if-none-match"], etag)) {
        res.status(304).end();
        return;
      }

      res.json(normalized);
    } catch (error) {
      console.error("❌ [Server] 数据库同步中断:", error);
      res.status(500).json({
        error: "Database synchronization failed",
        details: String(error),
      });
    }
  };
}
