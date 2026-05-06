import pg from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

dotenv.config();

const { Pool } = pg;

export type RecommenderMergeRow = {
  id: string;
  original_id: string | null;
  name: string;
  safe_display_name: string | null;
  price: string | number | null;
  max_db: number | null;
  waterproof: number | null;
  appearance: string | null;
  physical_form: string | null;
  motor_type: string | null;
  gender: string | null;
  brand: string | null;
  material: string | null;
  image_url: string | null;
  raw_description: string | null;
  type_code: string | null;
};

type MergeSummary = {
  matchedByOriginalId: number;
  matchedByNameBrand: number;
  inserted: number;
  fieldsBackfilled: number;
};

type MergeResult = {
  rows: RecommenderMergeRow[];
  summary: MergeSummary;
};

const MERGEABLE_FIELDS: (keyof RecommenderMergeRow)[] = [
  "safe_display_name",
  "price",
  "max_db",
  "waterproof",
  "appearance",
  "physical_form",
  "motor_type",
  "gender",
  "brand",
  "material",
  "image_url",
  "raw_description",
  "type_code",
];

function isBlank(value: unknown) {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  return false;
}

function normalizeLookupValue(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function getNameBrandKey(row: Pick<RecommenderMergeRow, "name" | "brand">) {
  const name = normalizeLookupValue(row.name);
  const brand = normalizeLookupValue(row.brand);
  return name && brand ? `${name}::${brand}` : "";
}

function mergeIntoToyRow(
  toy: RecommenderMergeRow,
  item: RecommenderMergeRow,
) {
  const merged: RecommenderMergeRow = { ...toy };
  let fieldsBackfilled = 0;

  for (const field of MERGEABLE_FIELDS) {
    if (isBlank(merged[field]) && !isBlank(item[field])) {
      (merged as Record<string, unknown>)[field] = item[field];
      fieldsBackfilled += 1;
    }
  }

  return { merged, fieldsBackfilled };
}

export function mergeRecommenderRows({
  toys,
  items,
}: {
  toys: RecommenderMergeRow[];
  items: RecommenderMergeRow[];
}): MergeResult {
  const rows = toys.map((row) => ({ ...row }));
  const byOriginalId = new Map<string, number>();
  const byNameBrand = new Map<string, number>();
  const summary: MergeSummary = {
    matchedByOriginalId: 0,
    matchedByNameBrand: 0,
    inserted: 0,
    fieldsBackfilled: 0,
  };

  rows.forEach((row, index) => {
    if (row.original_id) {
      byOriginalId.set(String(row.original_id), index);
    }
    const nameBrandKey = getNameBrandKey(row);
    if (nameBrandKey) {
      byNameBrand.set(nameBrandKey, index);
    }
  });

  for (const item of items) {
    const originalIdKey = item.original_id ? String(item.original_id) : "";
    const nameBrandKey = getNameBrandKey(item);
    const originalIdMatch =
      originalIdKey && byOriginalId.has(originalIdKey)
        ? byOriginalId.get(originalIdKey)
        : undefined;
    const nameBrandMatch =
      nameBrandKey && byNameBrand.has(nameBrandKey)
        ? byNameBrand.get(nameBrandKey)
        : undefined;

    if (originalIdMatch != null) {
      const result = mergeIntoToyRow(rows[originalIdMatch]!, item);
      rows[originalIdMatch] = result.merged;
      summary.matchedByOriginalId += 1;
      summary.fieldsBackfilled += result.fieldsBackfilled;
      continue;
    }

    if (nameBrandMatch != null) {
      const result = mergeIntoToyRow(rows[nameBrandMatch]!, item);
      rows[nameBrandMatch] = result.merged;
      summary.matchedByNameBrand += 1;
      summary.fieldsBackfilled += result.fieldsBackfilled;
      continue;
    }

    rows.push({ ...item });
    summary.inserted += 1;
  }

  return { rows, summary };
}

async function tableExists(client: pg.PoolClient, tableName: string) {
  const result = await client.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = $1
      ) AS exists
    `,
    [tableName],
  );

  return result.rows[0]?.exists === true;
}

async function ensureRecommenderToysSchema(client: pg.PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.recommender_toys (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      original_id UUID,
      name TEXT NOT NULL,
      safe_display_name TEXT,
      price DECIMAL(10, 2),
      max_db INTEGER,
      waterproof INTEGER,
      appearance TEXT,
      physical_form TEXT,
      motor_type TEXT,
      gender TEXT,
      brand TEXT,
      material TEXT,
      image_url TEXT,
      raw_description TEXT,
      type_code TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await client.query(`
    ALTER TABLE public.recommender_toys
    ADD COLUMN IF NOT EXISTS safe_display_name TEXT,
    ADD COLUMN IF NOT EXISTS brand TEXT,
    ADD COLUMN IF NOT EXISTS material TEXT,
    ADD COLUMN IF NOT EXISTS raw_description TEXT,
    ADD COLUMN IF NOT EXISTS type_code TEXT
  `);
}

async function getTableColumns(client: pg.PoolClient, tableName: string) {
  const result = await client.query<{ column_name: string }>(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
    `,
    [tableName],
  );

  return new Set(result.rows.map((row) => row.column_name));
}

async function readTableRows(client: pg.PoolClient, tableName: string) {
  const columns = await getTableColumns(client, tableName);
  const optionalColumn = (
    columnName: keyof RecommenderMergeRow,
    fallbackSql: string,
  ) =>
    columns.has(String(columnName))
      ? String(columnName)
      : `${fallbackSql} AS ${String(columnName)}`;

  const result = await client.query<RecommenderMergeRow>(`
    SELECT
      id,
      original_id,
      name,
      ${optionalColumn("safe_display_name", "NULL::text")},
      ${optionalColumn("price", "NULL::numeric")},
      ${optionalColumn("max_db", "NULL::integer")},
      ${optionalColumn("waterproof", "NULL::integer")},
      ${optionalColumn("appearance", "NULL::text")},
      ${optionalColumn("physical_form", "NULL::text")},
      ${optionalColumn("motor_type", "NULL::text")},
      ${optionalColumn("gender", "NULL::text")},
      ${optionalColumn("brand", "NULL::text")},
      ${optionalColumn("material", "NULL::text")},
      ${optionalColumn("image_url", "NULL::text")},
      ${optionalColumn("raw_description", "NULL::text")},
      ${optionalColumn("type_code", "NULL::text")}
    FROM public.${tableName}
    ORDER BY created_at ASC, id ASC
  `);

  return result.rows;
}

async function persistMergeRows(client: pg.PoolClient, rows: RecommenderMergeRow[]) {
  await client.query(`DELETE FROM public.recommender_toys`);

  for (const row of rows) {
    await client.query(
      `
        INSERT INTO public.recommender_toys (
          id,
          original_id,
          name,
          safe_display_name,
          price,
          max_db,
          waterproof,
          appearance,
          physical_form,
          motor_type,
          gender,
          brand,
          material,
          image_url,
          raw_description,
          type_code,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14, $15, $16, NOW()
        )
      `,
      [
        row.id,
        row.original_id,
        row.name,
        row.safe_display_name,
        row.price,
        row.max_db,
        row.waterproof,
        row.appearance,
        row.physical_form,
        row.motor_type,
        row.gender,
        row.brand,
        row.material,
        row.image_url,
        row.raw_description,
        row.type_code,
      ],
    );
  }
}

async function mergeRecommenderItemsIntoToys() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await ensureRecommenderToysSchema(client);

    const toys = await readTableRows(client, "recommender_toys");
    const itemsExists = await tableExists(client, "recommender_items");
    const items = itemsExists
      ? await readTableRows(client, "recommender_items")
      : [];

    const result = mergeRecommenderRows({ toys, items });
    await persistMergeRows(client, result.rows);
    await client.query("COMMIT");

    console.log(
      JSON.stringify(
        {
          recommender_toys_rows: result.rows.length,
          matched_by_original_id: result.summary.matchedByOriginalId,
          matched_by_name_brand: result.summary.matchedByNameBrand,
          inserted: result.summary.inserted,
          fields_backfilled: result.summary.fieldsBackfilled,
          items_source_present: itemsExists,
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

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mergeRecommenderItemsIntoToys().catch((error) => {
    console.error("[merge-recommender-items-into-toys] 执行失败:", error);
    process.exitCode = 1;
  });
}
