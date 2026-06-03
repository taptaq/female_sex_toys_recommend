import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
});

const SHOULD_APPLY = process.argv.includes("--apply");

async function ensureLinkColumn() {
  await pool.query(`
    ALTER TABLE public.female_recommender_toys
    ADD COLUMN IF NOT EXISTS link TEXT
  `);
}

async function main() {
  await ensureLinkColumn();

  const preview = await pool.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (
        WHERE NULLIF(BTRIM(COALESCE(t.link, '')), '') IS NULL
      )::int AS missing_female_link,
      COUNT(*) FILTER (
        WHERE NULLIF(BTRIM(COALESCE(t.link, '')), '') IS NULL
          AND NULLIF(BTRIM(COALESCE(p.link, '')), '') IS NOT NULL
      )::int AS fillable_from_products
    FROM public.female_recommender_toys t
    LEFT JOIN public.products p ON t.original_id = p.id
  `);

  console.log("[backfill-female-recommender-toy-links] summary:");
  console.log(JSON.stringify(preview.rows, null, 2));

  if (!SHOULD_APPLY) {
    console.log("[backfill-female-recommender-toy-links] dry-run only. Pass --apply to update female_recommender_toys.link.");
    return;
  }

  const result = await pool.query(`
    UPDATE public.female_recommender_toys t
    SET link = p.link
    FROM public.products p
    WHERE t.original_id = p.id
      AND NULLIF(BTRIM(COALESCE(t.link, '')), '') IS NULL
      AND NULLIF(BTRIM(COALESCE(p.link, '')), '') IS NOT NULL
  `);

  console.log(
    `[backfill-female-recommender-toy-links] updated ${result.rowCount ?? 0} rows.`,
  );
}

main()
  .catch((error) => {
    console.error("[backfill-female-recommender-toy-links] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
