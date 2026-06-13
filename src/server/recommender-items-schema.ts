type Queryable = {
  query: (sql: string) => Promise<unknown>;
};

export async function ensureRecommenderItemsSchema(
  pool: Queryable,
  { refreshFemaleTable = false }: { refreshFemaleTable?: boolean } = {},
) {
  await pool.query(`
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
      link TEXT,
      image_url TEXT,
      raw_description TEXT,
      type_code TEXT,
      subtype_code TEXT,
      recommendation_features JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE public.recommender_toys
    ADD COLUMN IF NOT EXISTS safe_display_name TEXT
  `);

  await pool.query(`
    ALTER TABLE public.recommender_toys
    ADD COLUMN IF NOT EXISTS subtype_code TEXT
  `);

  await pool.query(`
    ALTER TABLE public.recommender_toys
    ADD COLUMN IF NOT EXISTS recommendation_features JSONB
  `);

  await pool.query(`
    ALTER TABLE public.recommender_toys
    ADD COLUMN IF NOT EXISTS link TEXT
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_recommender_toys_created_at
    ON public.recommender_toys(created_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_recommender_toys_original_id
    ON public.recommender_toys(original_id)
    WHERE original_id IS NOT NULL
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_recommender_toys_filter_codes
    ON public.recommender_toys(gender, type_code, subtype_code)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.female_recommender_toys (
      LIKE public.recommender_toys INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES
    )
  `);

  await pool.query(`
    ALTER TABLE public.female_recommender_toys
    ADD COLUMN IF NOT EXISTS link TEXT
  `);

  if (refreshFemaleTable) {
    await pool.query(`
      TRUNCATE TABLE public.female_recommender_toys
    `);

    await pool.query(`
      INSERT INTO public.female_recommender_toys
      SELECT *
      FROM public.recommender_toys
      WHERE gender = 'female'
    `);
  }

  await pool.query(`
    UPDATE public.female_recommender_toys t
    SET link = p.link
    FROM public.products p
    WHERE t.original_id = p.id
      AND NULLIF(BTRIM(COALESCE(t.link, '')), '') IS NULL
      AND NULLIF(BTRIM(COALESCE(p.link, '')), '') IS NOT NULL
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_female_recommender_toys_created_at
    ON public.female_recommender_toys(created_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_female_recommender_toys_original_id
    ON public.female_recommender_toys(original_id)
    WHERE original_id IS NOT NULL
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_female_recommender_toys_filter_codes
    ON public.female_recommender_toys(gender, type_code, subtype_code)
  `);
}
