type Queryable = {
  query: (sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
};

export type SaveUserFeedbackInput = {
  message: string;
  screenshots: string[];
  pageRoute: string;
  userAgent?: string;
};

export type UserFeedbackStore = {
  saveFeedback: (
    input: SaveUserFeedbackInput,
  ) => Promise<{ id: string }>;
};

export async function ensureUserFeedbackSchema(pool: Queryable) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.user_feedback (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      message text NOT NULL,
      screenshots jsonb NOT NULL DEFAULT '[]'::jsonb,
      page_route text NOT NULL DEFAULT '/',
      user_agent text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    ALTER TABLE public.user_feedback
    ADD COLUMN IF NOT EXISTS screenshots jsonb NOT NULL DEFAULT '[]'::jsonb
  `);

  await pool.query(`
    ALTER TABLE public.user_feedback
    ADD COLUMN IF NOT EXISTS page_route text NOT NULL DEFAULT '/'
  `);

  await pool.query(`
    ALTER TABLE public.user_feedback
    ADD COLUMN IF NOT EXISTS user_agent text
  `);

  await pool.query(`
    ALTER TABLE public.user_feedback
    ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()
  `);
}

export function createUserFeedbackStore({
  pool,
}: {
  pool: Queryable;
}): UserFeedbackStore {
  return {
    async saveFeedback({ message, screenshots, pageRoute, userAgent }) {
      const result = await pool.query(
        `
          INSERT INTO public.user_feedback (
            message,
            screenshots,
            page_route,
            user_agent
          )
          VALUES ($1, $2::jsonb, $3, $4)
          RETURNING id
        `,
        [
          message,
          JSON.stringify(screenshots),
          pageRoute,
          userAgent ?? null,
        ],
      );

      const row = result.rows[0] as { id?: string } | undefined;
      if (!row?.id) {
        throw new Error("Feedback insert did not return an id");
      }

      return { id: row.id };
    },
  };
}
