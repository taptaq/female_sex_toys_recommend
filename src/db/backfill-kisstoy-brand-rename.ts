import pg from "pg";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const { Pool } = pg;

const OLD_BRAND_NAMES = ["KISTOY", "kistoy", "Kistoy"];
const NEW_BRAND_NAME = "KISSTOY";
const NEW_BRAND_DESCRIPTION =
  "KISSTOY（Kisstoy）是中国原创情趣品牌，致力于为女性提供高品质、审美感强的成人玩具。";

async function backfillKisstoyBrandRename() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });

  const client = await pool.connect();

  try {
    console.log(
      "[backfill-kisstoy-brand-rename] 开始统一数据库中的 KISTOY 品牌名 ...",
    );
    await client.query("BEGIN");

    const recommenderResult = await client.query(
      `
        UPDATE public.recommender_toys
        SET brand = $2,
            updated_at = NOW()
        WHERE LOWER(BTRIM(COALESCE(brand, ''))) = LOWER($1)
      `,
      [OLD_BRAND_NAMES[0], NEW_BRAND_NAME],
    );

    const competitorsResult = await client.query(
      `
        UPDATE public.competitors
        SET name = $2,
            description = COALESCE(NULLIF(description, ''), $3)
        WHERE LOWER(BTRIM(COALESCE(name, ''))) = LOWER($1)
      `,
      [OLD_BRAND_NAMES[0], NEW_BRAND_NAME, NEW_BRAND_DESCRIPTION],
    );

    await client.query("COMMIT");

    console.log(
      JSON.stringify(
        {
          brand_renamed_from: OLD_BRAND_NAMES[0],
          brand_renamed_to: NEW_BRAND_NAME,
          recommender_toys_updated: recommenderResult.rowCount ?? 0,
          competitors_updated: competitorsResult.rowCount ?? 0,
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

const isDirectRun =
  process.argv[1] != null &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  backfillKisstoyBrandRename().catch((error) => {
    console.error("[backfill-kisstoy-brand-rename] 执行失败:", error);
    process.exitCode = 1;
  });
}
