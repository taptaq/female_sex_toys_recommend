import type pg from "pg";

export type UserProfileStore = {
  upsertProfile: (input: { userId: string; username: string }) => Promise<void>;
};

export async function ensureUserProfileSchema(pool: {
  query: (sql: string) => Promise<unknown>;
}) {
  await pool.query(`
    ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS username TEXT
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_unique
    ON public.profiles (LOWER(username))
    WHERE username IS NOT NULL
  `);
}

export function createUserProfileStore({
  pool,
}: {
  pool: Pick<pg.Pool, "query">;
}): UserProfileStore {
  return {
    async upsertProfile({ userId, username }) {
      await pool.query(
        `
          INSERT INTO public.profiles (id, username)
          VALUES ($1::uuid, $2::text)
          ON CONFLICT (id)
          DO UPDATE SET username = EXCLUDED.username
        `,
        [userId, username],
      );
    },
  };
}
