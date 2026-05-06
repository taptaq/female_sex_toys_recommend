import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const DEFAULT_DEVICE_MAX_DB = 50;

async function backfillDeviceMaxDb() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });

  const client = await pool.connect();

  try {
    console.log(`[backfill-item-max-db] 开始回填 device 默认 max_db=${DEFAULT_DEVICE_MAX_DB} ...`);
    await client.query('BEGIN');

    const deviceResult = await client.query(
      `
        UPDATE public.recommender_toys
        SET max_db = $1,
            updated_at = NOW()
        WHERE max_db IS NULL
        RETURNING id
      `,
      [DEFAULT_DEVICE_MAX_DB],
    );

    const productResult = await client.query(
      `
        UPDATE public.products AS p
        SET specs = jsonb_set(
          COALESCE(p.specs::jsonb, '{}'::jsonb),
          '{max_db}',
          to_jsonb(COALESCE(t.max_db, $1)),
          true
        )
        FROM public.recommender_toys AS t
        WHERE t.original_id = p.id
          AND (
            p.specs IS NULL
            OR NULLIF(BTRIM(COALESCE(p.specs::jsonb ->> 'max_db', '')), '') IS NULL
            OR LOWER(COALESCE(p.specs::jsonb ->> 'max_db', '')) = 'null'
          )
        RETURNING p.id
      `,
      [DEFAULT_DEVICE_MAX_DB],
    );

    await client.query('COMMIT');

    console.log(
      JSON.stringify(
        {
          default_max_db: DEFAULT_DEVICE_MAX_DB,
          recommender_toys_updated: deviceResult.rowCount,
          products_updated: productResult.rowCount,
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

backfillDeviceMaxDb().catch((error) => {
  console.error('[backfill-item-max-db] 执行失败:', error);
  process.exitCode = 1;
});
