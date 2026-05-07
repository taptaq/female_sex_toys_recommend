import dotenv from "dotenv";
import pg from "pg";
import { pathToFileURL } from "node:url";

import { isLibraryContaminantInput } from "../lib/library-product-type-classifier.ts";

dotenv.config();

const { Pool } = pg;

const PURGE_READ_BATCH_SIZE = 500;
const PURGE_DELETE_BATCH_SIZE = 200;
const SIGNAL_TEXT_LIMIT = 1200;

export type PurgeContaminantToyRow = {
  id: string;
  name: string;
  gender: string | null;
  physical_form: string | null;
  raw_description: string | null;
  product_tags: string[] | null;
  product_raw_description: string | null;
};

function normalizeRowSignals(row: PurgeContaminantToyRow) {
  return {
    gender: row.gender,
    physicalForm: row.physical_form,
    name: row.name,
    rawDescription:
      [row.raw_description, row.product_raw_description]
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .join("\n") || null,
    tags: Array.isArray(row.product_tags)
      ? row.product_tags.filter(
          (value): value is string => typeof value === "string" && value.trim().length > 0,
        )
      : [],
  };
}

export function selectContaminantToyIds(rows: PurgeContaminantToyRow[]) {
  return rows
    .filter((row) => isLibraryContaminantInput(normalizeRowSignals(row)))
    .map((row) => row.id);
}

export function shouldRunContaminantPurgeScript(
  importMetaUrl: string,
  argvEntry?: string,
) {
  if (!argvEntry) {
    return false;
  }

  return importMetaUrl === pathToFileURL(argvEntry).href;
}

function chunkItems<T>(items: T[], chunkSize: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}

async function readToyBatch(
  client: pg.PoolClient,
  lastSeenId?: string,
) {
  const params: Array<number | string> = [
    SIGNAL_TEXT_LIMIT,
    PURGE_READ_BATCH_SIZE,
  ];
  const cursorClause =
    typeof lastSeenId === "string"
      ? "WHERE t.id > $3::uuid"
      : "";

  if (typeof lastSeenId === "string") {
    params.push(lastSeenId);
  }

  const result = await client.query<PurgeContaminantToyRow>(
    `
      SELECT
        t.id,
        t.name,
        t.gender,
        t.physical_form,
        LEFT(COALESCE(t.raw_description, ''), $1) AS raw_description,
        p.tags AS product_tags,
        LEFT(COALESCE(p.specs::jsonb ->> 'rawDescription', ''), $1) AS product_raw_description
      FROM public.recommender_toys AS t
      LEFT JOIN public.products AS p
        ON t.original_id = p.id
      ${cursorClause}
      ORDER BY t.id
      LIMIT $2
    `,
    params,
  );

  return result.rows;
}

async function purgeRecommenderToyContaminants() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });

  const client = await pool.connect();

  try {
    console.log("[purge-recommender-toy-contaminants] 开始扫描 recommender_toys ...");
    await client.query("BEGIN");
    await client.query("SET statement_timeout TO 0");
    await client.query("SET lock_timeout TO '5s'");

    let scanned = 0;
    let deleted = 0;
    let lastSeenId: string | undefined;
    const deletedSamples: string[] = [];

    while (true) {
      const rows = await readToyBatch(client, lastSeenId);

      if (rows.length === 0) {
        break;
      }

      scanned += rows.length;
      lastSeenId = rows[rows.length - 1]?.id;

      const contaminantIds = new Set(selectContaminantToyIds(rows));

      if (contaminantIds.size === 0) {
        continue;
      }

      const contaminantRows = rows.filter((row) => contaminantIds.has(row.id));

      for (const row of contaminantRows) {
        if (deletedSamples.length >= 10) {
          break;
        }

        deletedSamples.push(row.name);
      }

      for (const batch of chunkItems(contaminantRows, PURGE_DELETE_BATCH_SIZE)) {
        const ids = batch.map((row) => row.id);

        await client.query(
          `
            DELETE FROM public.recommender_toys
            WHERE id = ANY($1::uuid[])
          `,
          [ids],
        );

        deleted += batch.length;
      }
    }

    await client.query("COMMIT");

    console.log(
      JSON.stringify(
        {
          scanned,
          deleted,
          deleted_samples: deletedSamples,
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

if (shouldRunContaminantPurgeScript(import.meta.url, process.argv[1])) {
  purgeRecommenderToyContaminants().catch((error) => {
    console.error("[purge-recommender-toy-contaminants] 执行失败:", error);
    process.exitCode = 1;
  });
}
