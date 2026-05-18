import type pg from "pg";

export type UserFavoritesStore = {
  addFavorite: (userId: string, productId: string) => Promise<void>;
  listFavorites: (userId: string) => Promise<string[]>;
  deleteFavorite: (userId: string, productId: string) => Promise<void>;
};

export async function ensureUserFavoritesSchema(pool: {
  query: (sql: string) => Promise<unknown>;
}) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.favorites (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      created_at timestamptz DEFAULT now()
    )
  `);

  await pool.query(`
    ALTER TABLE public.favorites
    ADD COLUMN IF NOT EXISTS user_id uuid
  `);

  await pool.query(`
    ALTER TABLE public.favorites
    ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now()
  `);

  await pool.query(`
    ALTER TABLE public.favorites
    ALTER COLUMN user_id SET NOT NULL
  `).catch(() => {});

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_favorites_user_product_unique
    ON public.favorites(user_id, product_id)
  `);
}

export function createUserFavoritesStore({
  pool,
}: {
  pool: Pick<pg.Pool, "query">;
}): UserFavoritesStore {
  return {
    async addFavorite(userId, productId) {
      await pool.query(
        `
          INSERT INTO public.favorites (user_id, product_id)
          VALUES ($1::uuid, $2::uuid)
          ON CONFLICT (user_id, product_id) DO NOTHING
        `,
        [userId, productId],
      );
    },

    async listFavorites(userId) {
      const result = await pool.query<{ product_id: string }>(
        `
          SELECT product_id
          FROM public.favorites
          WHERE user_id = $1::uuid
          ORDER BY created_at DESC
        `,
        [userId],
      );

      return result.rows.map((row) => row.product_id).filter(Boolean);
    },

    async deleteFavorite(userId, productId) {
      await pool.query(
        `
          DELETE FROM public.favorites
          WHERE user_id = $1::uuid
            AND product_id = $2::uuid
        `,
        [userId, productId],
      );
    },
  };
}
