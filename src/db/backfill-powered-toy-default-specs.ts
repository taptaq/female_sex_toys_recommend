import dotenv from "dotenv";
import pg from "pg";
import { pathToFileURL } from "node:url";

dotenv.config();

const { Pool } = pg;
const DEFAULT_POWERED_MAX_DB = 50;
const DEFAULT_POWERED_WATERPROOF = 7;
const READ_BATCH_SIZE = 100;
const UPDATE_BATCH_SIZE = 200;
const SIGNAL_TEXT_LIMIT = 1200;

export type PoweredToyBaseRow = {
  id: string;
  original_id: string | null;
  name: string;
  type_code: string | null;
  raw_description: string | null;
  max_db: number | null;
  waterproof: number | null;
};

type ProductSignalRow = {
  id: string;
  product_tags: string[] | null;
  product_raw_description: string | null;
};

export type PoweredToyCandidateRow = PoweredToyBaseRow & {
  product_tags: string[] | null;
  product_raw_description: string | null;
};

const NON_TOY_TYPE_CODES = new Set([
  "care_accessory",
  "bdsm",
  "unknown",
  "apparel",
]);

const POWERED_SIGNAL_PATTERNS = [
  /震动/u,
  /振动/u,
  /吮吸/u,
  /吸吮/u,
  /气脉冲/u,
  /脉冲/u,
  /电动/u,
  /加热/u,
  /充电/u,
  /可充电/u,
  /app/u,
  /遥控/u,
  /马达/u,
  /rechargeable/u,
  /\bcharging\b/u,
  /\bcharged\b/u,
  /\bcharged\b/u,
  /\bapp\b/u,
  /\bremote\b/u,
  /\bmotor\b/u,
  /\bpowered\b/u,
  /\belectric\b/u,
  /\bpulse\b/u,
  /\bsuction\b/u,
  /\bvibrat/i,
  /\bsmart silence\b/u,
];

const STRONG_POWERED_SIGNAL_PATTERNS = [
  /震动/u,
  /振动/u,
  /吮吸/u,
  /吸吮/u,
  /气脉冲/u,
  /脉冲/u,
  /电动/u,
  /加热/u,
  /充电/u,
  /可充电/u,
  /马达/u,
  /rechargeable/u,
  /\bmotor\b/u,
  /\bpowered\b/u,
  /\belectric\b/u,
  /\bsuction\b/u,
  /\bvibrat/i,
  /\bautomatic\b/i,
  /\bsmart silence\b/u,
];

const NEGATIVE_SIGNAL_PATTERNS = [
  /\bmanual\b/u,
  /手动(?!模式)/u,
  /\bnon[-\s]?powered\b/u,
  /\bwithout motor\b/u,
  /\bwithout battery\b/u,
  /\bno motor\b/u,
  /\bno battery\b/u,
  /非振动/u,
  /无振动/u,
  /(?:没有|无|不含)[^。.!?\n]*(?:震动|振动|马达|充电|电动)/u,
  /\bglass dildo\b/u,
  /玻璃/u,
];

const STATIC_NON_POWERED_SIGNAL_PATTERNS = [
  /\bstainless steel\b/i,
  /不锈钢/u,
  /\bmetal\b/i,
  /金属/u,
  /\bjewelled\b/i,
  /\bglass\b/i,
  /玻璃/u,
  /\bclassic silicone beads?\b/i,
  /\bsilicone beads?\b/i,
  /肛门串珠/u,
  /\bfleshlight\b/i,
  /\bstroker\b/i,
  /自慰套/u,
  /\brealistic vagina\b/i,
  /\bpocket pussy\b/i,
  /真实(?:阴道|名器)/u,
  /\bstrap-on harness\b/i,
  /\bharness kit\b/i,
  /绑带式穿戴工具/u,
];

const STRICT_POWERED_TYPE_CODES = new Set([
  "insertable",
  "masturbator",
  "prostate",
]);

const BOILERPLATE_POWERED_SIGNAL_PATTERNS = [
  /页面(?:模板|附近)[^\n。.!?]*(?:app|充电|遥控|remote|charging)[^\n。.!?]*/giu,
  /(?:app|充电|遥控|remote|charging)\s*(?:支持|信息)\s*[:：]?\s*(?:是|yes)?/giu,
  /\bcharging information\b/giu,
];

const COCK_RING_POWERED_SIGNAL_PATTERNS = [
  /震动/u,
  /振动/u,
  /马达/u,
  /充电/u,
  /app/u,
  /遥控/u,
  /\bvibrat/i,
  /\bmotor\b/u,
  /\brechargeable\b/u,
  /\bremote\b/u,
];

function stripBoilerplatePoweredSignals(text: string) {
  return BOILERPLATE_POWERED_SIGNAL_PATTERNS.reduce(
    (cleanText, pattern) => cleanText.replace(pattern, " "),
    text,
  );
}

function hasStrongPoweredSignal(text: string) {
  return STRONG_POWERED_SIGNAL_PATTERNS.some((pattern) => pattern.test(text));
}

export function buildPoweredToySignalText(row: PoweredToyCandidateRow) {
  return [
    row.name,
    row.type_code,
    row.raw_description,
    row.product_raw_description,
    ...(Array.isArray(row.product_tags) ? row.product_tags : []),
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n");
}

export function buildStrictPoweredToySignalText(row: PoweredToyCandidateRow) {
  return [
    row.name,
    row.type_code,
    row.raw_description,
    row.product_raw_description,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n");
}

export function isPoweredToyCandidate(row: PoweredToyCandidateRow) {
  if (row.max_db != null && row.waterproof != null) {
    return false;
  }

  if (row.type_code && NON_TOY_TYPE_CODES.has(row.type_code)) {
    return false;
  }

  const signalText = buildPoweredToySignalText(row);
  if (!signalText.trim()) {
    return false;
  }

  if (NEGATIVE_SIGNAL_PATTERNS.some((pattern) => pattern.test(signalText))) {
    return false;
  }

  if (row.type_code === "cock_ring") {
    const strictSignalText = stripBoilerplatePoweredSignals(
      buildStrictPoweredToySignalText(row),
    );
    return COCK_RING_POWERED_SIGNAL_PATTERNS.some((pattern) =>
      pattern.test(strictSignalText),
    );
  }

  if (row.type_code && STRICT_POWERED_TYPE_CODES.has(row.type_code)) {
    const strictSignalText = stripBoilerplatePoweredSignals(
      buildStrictPoweredToySignalText(row),
    );
    if (
      STATIC_NON_POWERED_SIGNAL_PATTERNS.some((pattern) =>
        pattern.test(strictSignalText),
      )
    ) {
      return false;
    }

    return hasStrongPoweredSignal(strictSignalText);
  }

  return POWERED_SIGNAL_PATTERNS.some((pattern) => pattern.test(signalText));
}

export function buildPoweredToySpecPatch(row: PoweredToyCandidateRow) {
  return {
    max_db: row.max_db == null ? DEFAULT_POWERED_MAX_DB : null,
    waterproof: row.waterproof == null ? DEFAULT_POWERED_WATERPROOF : null,
  };
}

export function collectUniqueOriginalIds(rows: PoweredToyBaseRow[]) {
  return [
    ...new Set(
      rows
        .map((row) => row.original_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  ];
}

export function chunkItems<T>(items: T[], chunkSize: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

export function hydratePoweredToyRows(
  toyRows: PoweredToyBaseRow[],
  productRowsById: Map<string, ProductSignalRow>,
) {
  return toyRows.map((row) => {
    const productRow = row.original_id
      ? productRowsById.get(row.original_id)
      : undefined;

    return {
      ...row,
      product_tags: productRow?.product_tags ?? [],
      product_raw_description: productRow?.product_raw_description ?? null,
    };
  });
}

export function shouldRunPoweredToyDefaultSpecsScript(
  importMetaUrl: string,
  argvEntry?: string,
) {
  if (!argvEntry) {
    return false;
  }

  return importMetaUrl === pathToFileURL(argvEntry).href;
}

async function readToyBatch(
  client: pg.PoolClient,
  lastSeenId?: string,
) {
  const params: Array<number | string> = [
    SIGNAL_TEXT_LIMIT,
    READ_BATCH_SIZE,
  ];
  const cursorClause =
    typeof lastSeenId === "string"
      ? "WHERE t.id > $3::uuid"
      : "";

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
      FROM public.recommender_toys AS t
      ${cursorClause}
      ORDER BY t.id
      LIMIT $2
    `,
    params,
  );

  return result.rows;
}

async function backfillPoweredToyDefaultSpecs() {
  const dryRun = process.argv.includes("--dry-run");
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });

  const client = await pool.connect();

  try {
    console.log(
      `[backfill-powered-toy-default-specs] 开始${dryRun ? "预演" : "回填"}电动玩具默认参数 max_db=${DEFAULT_POWERED_MAX_DB}, waterproof=${DEFAULT_POWERED_WATERPROOF} ...`,
    );
    if (!dryRun) {
      await client.query("BEGIN");
    }
    await client.query("SET statement_timeout TO 0");
    await client.query("SET lock_timeout TO '5s'");

    let scanned = 0;
    let toyUpdates = 0;
    let productUpdates = 0;
    let candidateCount = 0;
    let lastSeenId: string | undefined;
    const sampleNames: string[] = [];

    while (true) {
      const toyBatch = await readToyBatch(client, lastSeenId);
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
      const rowsToPatch = hydratedRows
        .filter(isPoweredToyCandidate)
        .map((row) => ({ row, patch: buildPoweredToySpecPatch(row) }))
        .filter(({ patch }) => patch.max_db != null || patch.waterproof != null);
      candidateCount += rowsToPatch.length;

      for (const { row } of rowsToPatch) {
        if (sampleNames.length >= 10) {
          break;
        }
        sampleNames.push(row.name);
      }

      for (const batch of chunkItems(rowsToPatch, UPDATE_BATCH_SIZE)) {
        if (dryRun) {
          continue;
        }

        for (const { row, patch } of batch) {
          const toyResult = await client.query(
            `
              UPDATE public.recommender_toys
              SET
                max_db = COALESCE(max_db, $2),
                waterproof = COALESCE(waterproof, $3),
                updated_at = NOW()
              WHERE id = $1::uuid
                AND (
                  (max_db IS NULL AND $2::integer IS NOT NULL) OR
                  (waterproof IS NULL AND $3::integer IS NOT NULL)
                )
              RETURNING id
            `,
            [row.id, patch.max_db, patch.waterproof],
          );
          toyUpdates += toyResult.rowCount ?? 0;

          if (row.original_id) {
            const productResult = await client.query(
              `
                UPDATE public.products AS p
                SET specs = jsonb_set(
                  jsonb_set(
                    COALESCE(p.specs::jsonb, '{}'::jsonb),
                    '{max_db}',
                    to_jsonb(COALESCE((p.specs::jsonb ->> 'max_db')::integer, $2)),
                    true
                  ),
                  '{waterproof}',
                  to_jsonb(COALESCE((p.specs::jsonb ->> 'waterproof')::integer, $3)),
                  true
                )
                WHERE p.id = $1::uuid
                  AND (
                    (($2::integer IS NOT NULL) AND (
                      p.specs IS NULL OR
                      NULLIF(BTRIM(COALESCE(p.specs::jsonb ->> 'max_db', '')), '') IS NULL OR
                      LOWER(COALESCE(p.specs::jsonb ->> 'max_db', '')) = 'null'
                    )) OR
                    (($3::integer IS NOT NULL) AND (
                      p.specs IS NULL OR
                      NULLIF(BTRIM(COALESCE(p.specs::jsonb ->> 'waterproof', '')), '') IS NULL OR
                      LOWER(COALESCE(p.specs::jsonb ->> 'waterproof', '')) = 'null'
                    ))
                  )
                RETURNING p.id
              `,
              [row.original_id, patch.max_db, patch.waterproof],
            );
            productUpdates += productResult.rowCount ?? 0;
          }
        }
      }
    }

    if (!dryRun) {
      await client.query("COMMIT");
    }

    console.log(
      JSON.stringify(
        {
          scanned,
          dryRun,
          candidates: candidateCount,
          recommender_toys_updated: toyUpdates,
          products_updated: productUpdates,
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

if (shouldRunPoweredToyDefaultSpecsScript(import.meta.url, process.argv[1])) {
  backfillPoweredToyDefaultSpecs().catch((error) => {
    console.error("[backfill-powered-toy-default-specs] 执行失败:", error);
    process.exitCode = 1;
  });
}
