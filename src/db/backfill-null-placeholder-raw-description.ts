import dotenv from "dotenv";
import pg from "pg";
import { pathToFileURL } from "node:url";

dotenv.config();

const { Pool } = pg;

export const PLACEHOLDER_RAW_DESCRIPTION_VALUES = ["信息未获取"] as const;

export function normalizePlaceholderRawDescription(
  value: string | null | undefined,
) {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    return null;
  }

  return PLACEHOLDER_RAW_DESCRIPTION_VALUES.includes(
    normalized as (typeof PLACEHOLDER_RAW_DESCRIPTION_VALUES)[number],
  )
    ? null
    : normalized;
}

export function shouldRunNullPlaceholderRawDescriptionScript(
  importMetaUrl: string,
  argvEntry?: string,
) {
  if (!argvEntry) {
    return false;
  }

  return importMetaUrl === pathToFileURL(argvEntry).href;
}

async function backfillNullPlaceholderRawDescription() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  const client = await pool.connect();

  try {
    console.log(
      "[backfill-null-placeholder-raw-description] 开始清洗 raw_description 占位值 ...",
    );

    await client.query("BEGIN");
    await client.query("SET statement_timeout TO 0");
    await client.query("SET lock_timeout TO '5s'");

    const placeholders = [...PLACEHOLDER_RAW_DESCRIPTION_VALUES];

    const toyResult = await client.query<{ id: string; name: string }>(
      `
        UPDATE public.recommender_toys
        SET raw_description = NULL,
            updated_at = NOW()
        WHERE BTRIM(COALESCE(raw_description, '')) = ANY($1::text[])
        RETURNING id, name
      `,
      [placeholders],
    );

    const productResult = await client.query<{ id: string; name: string }>(
      `
        UPDATE public.products
        SET specs = CASE
          WHEN specs ? 'rawDescription' THEN specs - 'rawDescription'
          ELSE specs
        END
        WHERE BTRIM(COALESCE(specs::jsonb ->> 'rawDescription', '')) = ANY($1::text[])
        RETURNING id, name
      `,
      [placeholders],
    );

    await client.query("COMMIT");

    console.log(
      JSON.stringify(
        {
          placeholder_values: placeholders,
          recommender_toys_updated: toyResult.rowCount ?? 0,
          products_updated: productResult.rowCount ?? 0,
          recommender_toys_samples: toyResult.rows.slice(0, 10).map((row) => row.name),
          products_samples: productResult.rows.slice(0, 10).map((row) => row.name),
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

if (
  shouldRunNullPlaceholderRawDescriptionScript(import.meta.url, process.argv[1])
) {
  backfillNullPlaceholderRawDescription().catch((error) => {
    console.error(
      "[backfill-null-placeholder-raw-description] 执行失败:",
      error,
    );
    process.exitCode = 1;
  });
}
