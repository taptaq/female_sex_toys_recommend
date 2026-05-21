import dotenv from "dotenv";
import pg from "pg";
import { pathToFileURL } from "node:url";

dotenv.config();

const { Pool } = pg;

export type ObviousNonGearToyRow = {
  toy_id: string;
  product_id: string | null;
  name: string;
  brand: string | null;
  deep_reports: number;
  favorites: number;
  standardization_tests: number;
  toy_refs: number;
};

function normalizeText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

export function isObviousNonGearToyName(name: string) {
  const normalized = normalizeText(name);
  return (
    /\bwebcam\b/u.test(normalized) ||
    /\bbluetooth\s+adapter\b/u.test(normalized) ||
    /\bdiscount\s+sale\b/u.test(normalized) ||
    /购物金/u.test(name) ||
    /摄像头/u.test(name)
  );
}

export function selectObviousNonGearToyRows(rows: ObviousNonGearToyRow[]) {
  return rows.filter((row) => {
    if (!isObviousNonGearToyName(row.name)) return false;
    if (!row.product_id) return true;
    return (
      row.toy_refs === 1 &&
      row.deep_reports === 0 &&
      row.favorites === 0 &&
      row.standardization_tests === 0
    );
  });
}

export function shouldRunObviousNonGearPurgeScript(importMetaUrl: string, argvEntry?: string) {
  return Boolean(argvEntry) && importMetaUrl === pathToFileURL(argvEntry).href;
}

async function readCandidates(client: pg.PoolClient) {
  const result = await client.query<ObviousNonGearToyRow>(`
    WITH target AS (
      SELECT
        t.id AS toy_id,
        t.original_id AS product_id,
        t.name,
        t.brand
      FROM public.recommender_toys AS t
      WHERE lower(t.name) ~ '(webcam|bluetooth adapter|discount sale)'
        OR t.name ~ '(购物金|摄像头)'
    )
    SELECT
      target.*,
      (
        SELECT count(*)
        FROM public.deep_reports AS d
        WHERE d.product_id = target.product_id
      )::int AS deep_reports,
      (
        SELECT count(*)
        FROM public.favorites AS f
        WHERE f.product_id = target.product_id
      )::int AS favorites,
      (
        SELECT count(*)
        FROM public.standardization_tests AS s
        WHERE s.product_id = target.product_id
      )::int AS standardization_tests,
      (
        SELECT count(*)
        FROM public.recommender_toys AS rt
        WHERE rt.original_id = target.product_id
      )::int AS toy_refs
    FROM target
    ORDER BY target.brand, target.name
  `);

  return result.rows;
}

async function purgeObviousNonGear() {
  const dryRun = process.argv.includes("--dry-run");
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  const client = await pool.connect();

  try {
    await client.query(`SET statement_timeout TO 0`);
    await client.query(`SET lock_timeout TO '5s'`);

    const candidates = await readCandidates(client);
    const selected = selectObviousNonGearToyRows(candidates);
    const toyIds = selected.map((row) => row.toy_id);
    const productIds = selected
      .map((row) => row.product_id)
      .filter((value): value is string => typeof value === "string" && value.length > 0);

    let deletedToys: Array<{ id: string; name: string }> = [];
    let deletedProducts: Array<{ id: string; name: string }> = [];

    if (!dryRun && selected.length > 0) {
      await client.query("BEGIN");
      const toyResult = await client.query<{ id: string; name: string }>(
        `
          DELETE FROM public.recommender_toys
          WHERE id = ANY($1::uuid[])
          RETURNING id, name
        `,
        [toyIds],
      );
      deletedToys = toyResult.rows;

      if (productIds.length > 0) {
        const productResult = await client.query<{ id: string; name: string }>(
          `
            DELETE FROM public.products
            WHERE id = ANY($1::uuid[])
              AND NOT EXISTS (
                SELECT 1 FROM public.recommender_toys AS t WHERE t.original_id = products.id
              )
              AND NOT EXISTS (
                SELECT 1 FROM public.deep_reports AS d WHERE d.product_id = products.id
              )
              AND NOT EXISTS (
                SELECT 1 FROM public.favorites AS f WHERE f.product_id = products.id
              )
              AND NOT EXISTS (
                SELECT 1 FROM public.standardization_tests AS s WHERE s.product_id = products.id
              )
            RETURNING id, name
          `,
          [productIds],
        );
        deletedProducts = productResult.rows;
      }
      await client.query("COMMIT");
    }

    console.log(
      JSON.stringify(
        {
          dryRun,
          candidates: candidates.length,
          selected: selected.length,
          selected_samples: selected.map((row) => ({
            toy_id: row.toy_id,
            product_id: row.product_id,
            name: row.name,
            brand: row.brand,
          })),
          deleted_toys: deletedToys,
          deleted_products: deletedProducts,
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

if (shouldRunObviousNonGearPurgeScript(import.meta.url, process.argv[1])) {
  purgeObviousNonGear().catch((error) => {
    console.error("[purge-obvious-non-gear] 执行失败:", error);
    process.exitCode = 1;
  });
}
