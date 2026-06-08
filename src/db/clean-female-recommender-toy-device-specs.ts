import dotenv from "dotenv";
import pg from "pg";
import { pathToFileURL } from "node:url";

import {
  chunkItems,
  collectUniqueOriginalIds,
  hydratePoweredToyRows,
  isPoweredToyCandidate,
  type PoweredToyBaseRow,
  type PoweredToyCandidateRow,
} from "./backfill-powered-toy-default-specs.ts";

dotenv.config();

const { Pool } = pg;
const DEFAULT_POWERED_MAX_DB = 50;
const DEFAULT_POWERED_WATERPROOF = 7;
const READ_BATCH_SIZE = 100;
const UPDATE_BATCH_SIZE = 200;
const SIGNAL_TEXT_LIMIT = 1600;

type ProductSignalRow = {
  id: string;
  product_tags: string[] | null;
  product_raw_description: string | null;
};

export type FemaleToyDeviceSpecCleanupRow = PoweredToyCandidateRow;

export type FemaleToyDeviceSpecPatch = {
  max_db: number | null;
  waterproof: number | null;
  reason: "powered" | "non_powered";
};

function normalizeSpecText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function buildDeviceSpecSignalText(row: FemaleToyDeviceSpecCleanupRow) {
  return normalizeSpecText(
    [
      row.name,
      row.type_code,
      row.raw_description,
      row.product_raw_description,
      ...(Array.isArray(row.product_tags) ? row.product_tags : []),
    ]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .join("\n"),
  );
}

export function extractMaxDbFromDeviceSpecText(text: string | null | undefined) {
  if (!text) {
    return null;
  }

  const normalized = normalizeSpecText(text);
  const matches = [
    ...normalized.matchAll(
      /(?:低于|小于|小於|不超过|不超過|约|約|噪音|声音|音量|noise|quiet|less than|under|below)?\s*(\d{2})\s*dB\b/giu,
    ),
  ];
  const values = matches
    .map((match) => Number.parseInt(match[1] ?? "", 10))
    .filter((value) => Number.isInteger(value) && value >= 20 && value <= 80);

  return values.length > 0 ? Math.min(...values) : null;
}

export function extractWaterproofFromDeviceSpecText(text: string | null | undefined) {
  if (!text) {
    return null;
  }

  const normalized = normalizeSpecText(text);
  const explicitMatch = normalized.match(/\bIPX\s*([0-9])\b/iu);
  if (explicitMatch) {
    return Number.parseInt(explicitMatch[1] ?? "", 10);
  }

  if (/防水|水洗|可冲洗|可沖洗|全身水洗|waterproof|water-resistant/i.test(normalized)) {
    return DEFAULT_POWERED_WATERPROOF;
  }

  return null;
}

export function buildFemaleToyDeviceSpecPatch(
  row: FemaleToyDeviceSpecCleanupRow,
): FemaleToyDeviceSpecPatch {
  const signalText = buildDeviceSpecSignalText(row);

  if (!isPoweredToyCandidate(row)) {
    return {
      max_db: row.max_db == null ? null : null,
      waterproof: row.waterproof == null ? null : null,
      reason: "non_powered",
    };
  }

  const extractedMaxDb = extractMaxDbFromDeviceSpecText(signalText);
  const extractedWaterproof = extractWaterproofFromDeviceSpecText(signalText);

  return {
    max_db: row.max_db == null ? extractedMaxDb ?? DEFAULT_POWERED_MAX_DB : null,
    waterproof:
      row.waterproof == null
        ? extractedWaterproof ?? DEFAULT_POWERED_WATERPROOF
        : null,
    reason: "powered",
  };
}

export function shouldRunFemaleToyDeviceSpecCleanupScript(
  importMetaUrl: string,
  argvEntry?: string,
) {
  if (!argvEntry) {
    return false;
  }

  return importMetaUrl === pathToFileURL(argvEntry).href;
}

async function readFemaleToyBatch(
  client: pg.PoolClient,
  lastSeenId?: string,
) {
  const params: Array<number | string> = [SIGNAL_TEXT_LIMIT, READ_BATCH_SIZE];
  const cursorParts = [
    "(t.max_db IS NULL OR t.waterproof IS NULL)",
    typeof lastSeenId === "string" ? "t.id > $3::uuid" : null,
  ].filter(Boolean);

  if (typeof lastSeenId === "string") {
    params.push(lastSeenId);
  }

  const result = await client.query<PoweredToyBaseRow>(
    `
      SELECT
        t.id,
        t.original_id,
        t.name,
        t.type_code,
        LEFT(COALESCE(t.raw_description, ''), $1) AS raw_description,
        t.max_db,
        t.waterproof
      FROM public.female_recommender_toys AS t
      WHERE ${cursorParts.join(" AND ")}
      ORDER BY t.id
      LIMIT $2
    `,
    params,
  );

  return result.rows;
}

async function cleanFemaleRecommenderToyDeviceSpecs() {
  const shouldApply = process.argv.includes("--apply");
  const dryRun = !shouldApply;
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  const client = await pool.connect();

  try {
    console.log(
      `[clean-female-recommender-toy-device-specs] 开始${dryRun ? "预演" : "清洗"} female_recommender_toys 的 max_db / waterproof ...`,
    );
    if (dryRun) {
      console.log(
        "[clean-female-recommender-toy-device-specs] dry-run only. Pass --apply to update female_recommender_toys.",
      );
    }

    if (!dryRun) {
      await client.query("BEGIN");
    }
    await client.query("SET statement_timeout TO 0");
    await client.query("SET lock_timeout TO '5s'");

    let scanned = 0;
    let poweredRows = 0;
    let nonPoweredRows = 0;
    let updatedRows = 0;
    let lastSeenId: string | undefined;
    const sampleNames: string[] = [];

    while (true) {
      const toyBatch = await readFemaleToyBatch(client, lastSeenId);
      if (toyBatch.length === 0) {
        break;
      }

      scanned += toyBatch.length;
      lastSeenId = toyBatch[toyBatch.length - 1]?.id;

      const originalIds = collectUniqueOriginalIds(toyBatch);
      const productRowsById = new Map<string, ProductSignalRow>();

      for (const batch of chunkItems(originalIds, UPDATE_BATCH_SIZE)) {
        const productResult = await client.query<ProductSignalRow>(
          `
            SELECT
              p.id,
              p.tags AS product_tags,
              LEFT(COALESCE(p.specs::jsonb ->> 'rawDescription', ''), $2) AS product_raw_description
            FROM public.products AS p
            WHERE p.id = ANY($1::uuid[])
          `,
          [batch, SIGNAL_TEXT_LIMIT],
        );

        for (const row of productResult.rows) {
          productRowsById.set(row.id, row);
        }
      }

      const hydratedRows = hydratePoweredToyRows(toyBatch, productRowsById);
      const patchRows = hydratedRows.map((row) => ({
        row,
        patch: buildFemaleToyDeviceSpecPatch(row),
      }));

      for (const { row, patch } of patchRows) {
        if (patch.reason === "powered") {
          poweredRows += 1;
        } else {
          nonPoweredRows += 1;
        }

        if (sampleNames.length < 10) {
          sampleNames.push(`${patch.reason}: ${row.name}`);
        }
      }

      for (const batch of chunkItems(patchRows, UPDATE_BATCH_SIZE)) {
        if (dryRun) {
          continue;
        }

        for (const { row, patch } of batch) {
          const result = await client.query(
            `
              UPDATE public.female_recommender_toys
              SET
                max_db = $2,
                waterproof = $3,
                updated_at = NOW()
              WHERE id = $1::uuid
                AND (
                  max_db IS DISTINCT FROM $2::integer OR
                  waterproof IS DISTINCT FROM $3::integer
                )
              RETURNING id
            `,
            [
              row.id,
              patch.reason === "powered" ? row.max_db ?? patch.max_db : null,
              patch.reason === "powered"
                ? row.waterproof ?? patch.waterproof
                : null,
            ],
          );
          updatedRows += result.rowCount ?? 0;
        }
      }
    }

    if (!dryRun) {
      await client.query("COMMIT");
    }

    console.log(
      JSON.stringify(
        {
          dryRun,
          scanned,
          powered_rows: poweredRows,
          non_powered_rows: nonPoweredRows,
          updated_rows: updatedRows,
          default_max_db: DEFAULT_POWERED_MAX_DB,
          default_waterproof: DEFAULT_POWERED_WATERPROOF,
          sample_names: sampleNames,
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

if (shouldRunFemaleToyDeviceSpecCleanupScript(import.meta.url, process.argv[1])) {
  cleanFemaleRecommenderToyDeviceSpecs().catch((error) => {
    console.error("[clean-female-recommender-toy-device-specs] 执行失败:", error);
    process.exitCode = 1;
  });
}
