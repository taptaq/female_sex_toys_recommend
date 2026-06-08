import dotenv from "dotenv";
import pg from "pg";
import { pathToFileURL } from "node:url";

import {
  collectUniqueOriginalIds,
  hydratePoweredToyRows,
  isPoweredToyCandidate,
  type PoweredToyBaseRow,
  type PoweredToyCandidateRow,
} from "./backfill-powered-toy-default-specs.ts";
import {
  buildRecommendationFeatureBackfillPayload,
  type RecommendationFeatureBackfillRow,
} from "./backfill-recommendation-product-features.ts";
import {
  extractMaxDbFromDeviceSpecText,
  extractWaterproofFromDeviceSpecText,
} from "./clean-female-recommender-toy-device-specs.ts";

dotenv.config();

const { Pool } = pg;
const BRAND_NAME = "小怪兽";
const DEFAULT_POWERED_MAX_DB = 50;
const DEFAULT_POWERED_WATERPROOF = 7;
const SIGNAL_TEXT_LIMIT = 1600;

type ProductSignalRow = {
  id: string;
  product_tags: string[] | null;
  product_raw_description: string | null;
};

export type XiaoguaishouDeviceSpecAndFeatureRow =
  RecommendationFeatureBackfillRow &
    PoweredToyCandidateRow;

export type XiaoguaishouDeviceSpecAndFeaturePatch = {
  max_db: number | null;
  waterproof: number | null;
  reason: "powered" | "non_powered";
  recommendation_features: Record<string, unknown>;
};

function normalizeSignalText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function buildSignalText(row: XiaoguaishouDeviceSpecAndFeatureRow) {
  return normalizeSignalText(
    [
      row.name,
      row.type_code,
      row.subtype_code,
      row.raw_description,
      row.product_raw_description,
      ...(Array.isArray(row.product_tags) ? row.product_tags : []),
    ]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .join("\n"),
  );
}

export function buildXiaoguaishouDeviceSpecAndFeaturePatch(
  row: XiaoguaishouDeviceSpecAndFeatureRow,
): XiaoguaishouDeviceSpecAndFeaturePatch {
  const poweredRow = {
    ...row,
    max_db: null,
    waterproof: null,
  };
  const isPowered = isPoweredToyCandidate(poweredRow);
  const signalText = buildSignalText(row);
  const featuresPayload = buildRecommendationFeatureBackfillPayload(row);

  return {
    max_db: isPowered
      ? extractMaxDbFromDeviceSpecText(signalText) ?? DEFAULT_POWERED_MAX_DB
      : null,
    waterproof: isPowered
      ? extractWaterproofFromDeviceSpecText(signalText) ?? DEFAULT_POWERED_WATERPROOF
      : null,
    reason: isPowered ? "powered" : "non_powered",
    recommendation_features: {
      featureVersion: featuresPayload.featureVersion,
      ...featuresPayload.features,
    },
  };
}

export function shouldRunXiaoguaishouDeviceSpecRefreshScript(
  importMetaUrl: string,
  argvEntry?: string,
) {
  if (!argvEntry) return false;
  return importMetaUrl === pathToFileURL(argvEntry).href;
}

function assertRefreshTableName(tableName: string) {
  if (tableName !== "recommender_toys" && tableName !== "female_recommender_toys") {
    throw new Error(`Unsupported table: ${tableName}`);
  }
}

async function readXiaoguaishouRows(client: pg.PoolClient, tableName: string) {
  assertRefreshTableName(tableName);
  const result = await client.query<PoweredToyBaseRow & RecommendationFeatureBackfillRow>(
    `
      SELECT
        t.id,
        t.original_id,
        t.name,
        t.safe_display_name,
        t.price::text AS price,
        t.max_db,
        t.waterproof,
        t.appearance,
        t.physical_form,
        t.motor_type,
        t.gender,
        t.brand,
        t.material,
        t.image_url,
        LEFT(COALESCE(t.raw_description, ''), $2) AS raw_description,
        t.type_code,
        t.subtype_code
      FROM public.${tableName} AS t
      WHERE t.brand = $1
      ORDER BY t.id
    `,
    [BRAND_NAME, SIGNAL_TEXT_LIMIT],
  );

  return result.rows;
}

async function hydrateRows(
  client: pg.PoolClient,
  rows: Array<PoweredToyBaseRow & RecommendationFeatureBackfillRow>,
) {
  const productRowsById = new Map<string, ProductSignalRow>();
  const originalIds = collectUniqueOriginalIds(rows);

  if (originalIds.length > 0) {
    const productResult = await client.query<ProductSignalRow>(
      `
        SELECT
          p.id,
          p.tags AS product_tags,
          LEFT(COALESCE(p.specs::jsonb ->> 'rawDescription', ''), $2) AS product_raw_description
        FROM public.products AS p
        WHERE p.id = ANY($1::uuid[])
      `,
      [originalIds, SIGNAL_TEXT_LIMIT],
    );

    for (const row of productResult.rows) {
      productRowsById.set(row.id, row);
    }
  }

  return hydratePoweredToyRows(rows, productRowsById) as XiaoguaishouDeviceSpecAndFeatureRow[];
}

async function refreshTable(
  client: pg.PoolClient,
  tableName: "recommender_toys" | "female_recommender_toys",
  dryRun: boolean,
) {
  const baseRows = await readXiaoguaishouRows(client, tableName);
  const hydratedRows = await hydrateRows(client, baseRows);
  const rowsWithPatch = hydratedRows.map((row) => ({
    row,
    patch: buildXiaoguaishouDeviceSpecAndFeaturePatch(row),
  }));

  let updatedRows = 0;
  let poweredRows = 0;
  let nonPoweredRows = 0;

  for (const { patch } of rowsWithPatch) {
    if (patch.reason === "powered") poweredRows += 1;
    else nonPoweredRows += 1;
  }

  if (!dryRun) {
    for (const { row, patch } of rowsWithPatch) {
      const result = await client.query(
        `
          UPDATE public.${tableName}
          SET
            max_db = $2,
            waterproof = $3,
            recommendation_features = $4::jsonb,
            updated_at = NOW()
          WHERE id = $1::uuid
            AND (
              max_db IS DISTINCT FROM $2::integer OR
              waterproof IS DISTINCT FROM $3::integer OR
              recommendation_features IS DISTINCT FROM $4::jsonb
            )
          RETURNING id
        `,
        [
          row.id,
          patch.max_db,
          patch.waterproof,
          JSON.stringify(patch.recommendation_features),
        ],
      );
      updatedRows += result.rowCount ?? 0;
    }
  }

  return {
    table: tableName,
    scanned: hydratedRows.length,
    powered_rows: poweredRows,
    non_powered_rows: nonPoweredRows,
    updated_rows: updatedRows,
    sample: rowsWithPatch.slice(0, 8).map(({ row, patch }) => ({
      name: row.name,
      reason: patch.reason,
      max_db: patch.max_db,
      waterproof: patch.waterproof,
      featureVersion: patch.recommendation_features.featureVersion,
    })),
  };
}

async function refreshXiaoguaishouDeviceSpecsAndFeatures() {
  const shouldApply = process.argv.includes("--apply");
  const dryRun = !shouldApply;
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  const client = await pool.connect();

  try {
    console.log(
      `[refresh-xiaoguaishou-device-specs-and-features] 开始${dryRun ? "预演" : "覆盖"}小怪兽 max_db / waterproof / recommendation_features ...`,
    );
    if (dryRun) {
      console.log(
        "[refresh-xiaoguaishou-device-specs-and-features] dry-run only. Pass --apply to update DB.",
      );
    }

    await client.query("SET statement_timeout TO 0");
    await client.query("SET lock_timeout TO '5s'");
    if (!dryRun) await client.query("BEGIN");

    const results = [
      await refreshTable(client, "recommender_toys", dryRun),
      await refreshTable(client, "female_recommender_toys", dryRun),
    ];

    if (!dryRun) await client.query("COMMIT");

    console.log(
      JSON.stringify(
        {
          dryRun,
          brand: BRAND_NAME,
          default_max_db: DEFAULT_POWERED_MAX_DB,
          default_waterproof: DEFAULT_POWERED_WATERPROOF,
          results,
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

if (shouldRunXiaoguaishouDeviceSpecRefreshScript(import.meta.url, process.argv[1])) {
  refreshXiaoguaishouDeviceSpecsAndFeatures().catch((error) => {
    console.error("[refresh-xiaoguaishou-device-specs-and-features] 执行失败:", error);
    process.exitCode = 1;
  });
}
