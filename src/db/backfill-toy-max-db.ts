import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const DEFAULT_TOY_MAX_DB = 50;

async function backfillToyMaxDb() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });

  const client = await pool.connect();

  try {
    console.log(`[backfill-toy-max-db] 开始回填 toy 默认 max_db=${DEFAULT_TOY_MAX_DB} ...`);
    await client.query('BEGIN');

    const toyResult = await client.query(
      `
        UPDATE public.recommender_toys
        SET max_db = $1,
            updated_at = NOW()
        WHERE max_db IS NULL
        RETURNING id
      `,
      [DEFAULT_TOY_MAX_DB],
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
      [DEFAULT_TOY_MAX_DB],
    );

    await client.query('COMMIT');

    console.log(
      JSON.stringify(
        {
          default_max_db: DEFAULT_TOY_MAX_DB,
          recommender_toys_updated: toyResult.rowCount,
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

backfillToyMaxDb().catch((error) => {
  console.error('[backfill-toy-max-db] 执行失败:', error);
  process.exitCode = 1;
});
