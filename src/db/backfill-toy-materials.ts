import pg from "pg";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const { Pool } = pg;

const MATERIAL_NORMALIZATION_MAP = new Map<string, string>([
  ["超柔軟矽膠", "硅胶"],
]);

export function normalizeRecommenderToyMaterial(
  material: string | null | undefined,
) {
  const trimmed = String(material ?? "").trim();
  if (!trimmed) return null;
  return MATERIAL_NORMALIZATION_MAP.get(trimmed) ?? trimmed;
}

async function backfillToyMaterials() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });

  const client = await pool.connect();

  try {
    console.log(
      "[backfill-toy-materials] 开始清洗 recommender_toys.material ...",
    );
    await client.query("BEGIN");

    const targetMaterial = "超柔軟矽膠";
    const normalizedMaterial = normalizeRecommenderToyMaterial(targetMaterial);

    if (!normalizedMaterial) {
      throw new Error("Normalized material should not be empty");
    }

    const result = await client.query(
      `
        UPDATE public.recommender_toys
        SET material = $2,
            updated_at = NOW()
        WHERE BTRIM(COALESCE(material, '')) = $1
        RETURNING id
      `,
      [targetMaterial, normalizedMaterial],
    );

    await client.query("COMMIT");

    console.log(
      JSON.stringify(
        {
          normalized_from: targetMaterial,
          normalized_to: normalizedMaterial,
          recommender_toys_updated: result.rowCount ?? 0,
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
  backfillToyMaterials().catch((error) => {
    console.error("[backfill-toy-materials] 执行失败:", error);
    process.exitCode = 1;
  });
}
