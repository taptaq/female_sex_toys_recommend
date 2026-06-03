import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
});

const SHOULD_APPLY = process.argv.includes("--apply");

type SummaryRow = {
  brand: string | null;
  competitor_name: string | null;
  competitor_domain: string | null;
  product_count: string;
};

async function main() {
  const preview = await pool.query<SummaryRow>(`
    SELECT
      t.brand,
      c.name AS competitor_name,
      c.domain AS competitor_domain,
      COUNT(DISTINCT p.id)::text AS product_count
    FROM public.female_recommender_toys t
    JOIN public.products p ON t.original_id = p.id
    JOIN public.competitors c ON lower(c.name) = lower(NULLIF(t.brand, ''))
    WHERE p.competitor_id IS NULL
    GROUP BY t.brand, c.name, c.domain
    ORDER BY t.brand
  `);

  console.log("[backfill-female-toy-product-competitors] candidates:");
  console.log(JSON.stringify(preview.rows, null, 2));

  if (!SHOULD_APPLY) {
    console.log("[backfill-female-toy-product-competitors] dry-run only. Pass --apply to update products.competitor_id.");
    return;
  }

  const result = await pool.query(`
    UPDATE public.products p
    SET competitor_id = c.id
    FROM public.female_recommender_toys t
    JOIN public.competitors c ON lower(c.name) = lower(NULLIF(t.brand, ''))
    WHERE t.original_id = p.id
      AND p.competitor_id IS NULL
  `);

  console.log(
    `[backfill-female-toy-product-competitors] updated ${result.rowCount ?? 0} products.`,
  );
}

main()
  .catch((error) => {
    console.error("[backfill-female-toy-product-competitors] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
