import pg from 'pg';
import dotenv from 'dotenv';
import { buildSafeDisplayName } from '../lib/product-display-name.ts';
import { recoverCanonicalProductName } from '../lib/product-name-recovery.ts';

dotenv.config();

const { Pool } = pg;

async function recleanItemNames() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });

  const client = await pool.connect();
  const tableName = "recommender_toys";

  try {
    await client.query('BEGIN');

    console.log(`[backfill-reclean-item-names] 开始回填 ${tableName}.name ...`);

    await client.query(`
      ALTER TABLE public.${tableName}
      ADD COLUMN IF NOT EXISTS safe_display_name TEXT
    `);

    const result = await client.query<{
      id: string;
      original_id: string | null;
      name: string;
      raw_description: string | null;
      product_name: string | null;
      product_raw_description: string | null;
    }>(`
      SELECT
        t.id,
        t.original_id,
        t.name,
        t.raw_description,
        p.name AS product_name,
        COALESCE(p.specs::jsonb ->> 'rawDescription', NULL) AS product_raw_description
      FROM public.${tableName} AS t
      LEFT JOIN public.products AS p
        ON t.original_id = p.id
      WHERE t.name ~* 'q{2,}'
         OR NULLIF(BTRIM(COALESCE(t.safe_display_name, '')), '') IS NULL
    `);

    let itemUpdates = 0;
    let productUpdates = 0;
    let qqRecoveries = 0;

    for (const row of result.rows) {
      const recoveredName = recoverCanonicalProductName({
        currentName: row.name,
        rawDescription: [row.raw_description, row.product_raw_description].filter(Boolean).join('\n'),
        productName: row.product_name,
      });
      const safeDisplayName = buildSafeDisplayName(recoveredName);
      const hadQqCorruption = /q{2,}/i.test(String(row.name || ''));

      if (recoveredName !== row.name || hadQqCorruption) {
        await client.query(
          `
            UPDATE public.${tableName}
            SET name = $2,
                safe_display_name = $3,
                updated_at = NOW()
            WHERE id = $1
          `,
          [row.id, recoveredName, safeDisplayName],
        );
        itemUpdates += 1;
        if (hadQqCorruption) {
          qqRecoveries += 1;
        }
      } else {
        await client.query(
          `
            UPDATE public.${tableName}
            SET safe_display_name = $2,
                updated_at = NOW()
            WHERE id = $1
          `,
          [row.id, safeDisplayName],
        );
        itemUpdates += 1;
      }

      if (row.original_id && (row.product_name === row.name || /q{2,}/i.test(String(row.product_name || '')))) {
        await client.query(
          `
            UPDATE public.products
            SET name = $2
            WHERE id = $1
          `,
          [row.original_id, recoveredName],
        );
        productUpdates += 1;
      }
    }

    await client.query('COMMIT');

    console.log(
      JSON.stringify(
        {
          table: tableName,
          scanned: result.rowCount ?? 0,
          item_updates: itemUpdates,
          product_updates: productUpdates,
          qq_recoveries: qqRecoveries,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}

recleanItemNames().catch((error) => {
  console.error('[backfill-reclean-item-names] 执行失败:', error);
  process.exitCode = 1;
});
