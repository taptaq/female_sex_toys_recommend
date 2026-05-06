import pg from 'pg';
import dotenv from 'dotenv';
import { buildSafeDisplayName } from '../lib/product-display-name.ts';

dotenv.config();

const { Pool } = pg;

async function backfillSafeDisplayName() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });

  const client = await pool.connect();

  try {
    console.log('[backfill-safe-display-name] 开始回填 safe_display_name ...');
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE public.recommender_toys
      ADD COLUMN IF NOT EXISTS safe_display_name TEXT
    `);

    const result = await client.query<{
      id: string;
      name: string;
    }>(`
      SELECT id, name
      FROM public.recommender_toys
      WHERE safe_display_name IS NULL
         OR NULLIF(BTRIM(safe_display_name), '') IS NULL
    `);

    let updatedCount = 0;

    for (const row of result.rows) {
      const safeDisplayName = buildSafeDisplayName(row.name);
      await client.query(
        `
          UPDATE public.recommender_toys
          SET safe_display_name = $2,
              updated_at = NOW()
          WHERE id = $1
        `,
        [row.id, safeDisplayName],
      );
      updatedCount += 1;
    }

    await client.query('COMMIT');

    console.log(
      JSON.stringify(
        {
          scanned: result.rowCount ?? 0,
          updated: updatedCount,
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

backfillSafeDisplayName().catch((error) => {
  console.error('[backfill-safe-display-name] 执行失败:', error);
  process.exitCode = 1;
});
