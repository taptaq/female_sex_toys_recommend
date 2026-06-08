type Queryable = {
  query: (sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
};

export type StoredFeedbackScreenshotFile = {
  bucket: string;
  path: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
};

export type SaveUserFeedbackInput = {
  id: string;
  message: string;
  screenshotFiles: StoredFeedbackScreenshotFile[];
  pageRoute: string;
  source?: string;
  userAgent?: string;
};

export type UserFeedbackStore = {
  saveFeedback: (
    input: SaveUserFeedbackInput,
  ) => Promise<{ id: string }>;
  markNotificationSent: (id: string) => Promise<void>;
  markNotificationFailed: (id: string, errorMessage: string) => Promise<void>;
  markNotificationSkipped: (id: string, reason: string) => Promise<void>;
};

export async function ensureUserFeedbackSchema(pool: Queryable) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.feedback_submissions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      message text NOT NULL,
      screenshot_files jsonb NOT NULL DEFAULT '[]'::jsonb,
      page_route text NOT NULL DEFAULT '/',
      source text NOT NULL DEFAULT 'home_feedback',
      user_agent text,
      notify_status text NOT NULL DEFAULT 'pending',
      notify_error text,
      notified_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    ALTER TABLE public.feedback_submissions
    ADD COLUMN IF NOT EXISTS screenshot_files jsonb NOT NULL DEFAULT '[]'::jsonb
  `);

  await pool.query(`
    ALTER TABLE public.feedback_submissions
    ADD COLUMN IF NOT EXISTS page_route text NOT NULL DEFAULT '/'
  `);

  await pool.query(`
    ALTER TABLE public.feedback_submissions
    ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'home_feedback'
  `);

  await pool.query(`
    ALTER TABLE public.feedback_submissions
    ADD COLUMN IF NOT EXISTS user_agent text
  `);

  await pool.query(`
    ALTER TABLE public.feedback_submissions
    ADD COLUMN IF NOT EXISTS notify_status text NOT NULL DEFAULT 'pending'
  `);

  await pool.query(`
    ALTER TABLE public.feedback_submissions
    ADD COLUMN IF NOT EXISTS notify_error text
  `);

  await pool.query(`
    ALTER TABLE public.feedback_submissions
    ADD COLUMN IF NOT EXISTS notified_at timestamptz
  `);

  await pool.query(`
    ALTER TABLE public.feedback_submissions
    ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_feedback_submissions_created_at
    ON public.feedback_submissions(created_at DESC)
  `);
}

export function createUserFeedbackStore({
  pool,
}: {
  pool: Queryable;
}): UserFeedbackStore {
  return {
    async saveFeedback({
      id,
      message,
      screenshotFiles,
      pageRoute,
      source = "home_feedback",
      userAgent,
    }) {
      const result = await pool.query(
        `
          INSERT INTO public.feedback_submissions (
            id,
            message,
            screenshot_files,
            page_route,
            source,
            user_agent
          )
          VALUES ($1::uuid, $2, $3::jsonb, $4, $5, $6)
          RETURNING id
        `,
        [
          id,
          message,
          JSON.stringify(screenshotFiles),
          pageRoute,
          source,
          userAgent ?? null,
        ],
      );

      const row = result.rows[0] as { id?: string } | undefined;
      if (!row?.id) {
        throw new Error("Feedback insert did not return an id");
      }

      return { id: row.id };
    },

    async markNotificationSent(id) {
      await pool.query(
        `
          UPDATE public.feedback_submissions
          SET notify_status = 'sent',
              notify_error = NULL,
              notified_at = now()
          WHERE id = $1::uuid
        `,
        [id],
      );
    },

    async markNotificationFailed(id, errorMessage) {
      await pool.query(
        `
          UPDATE public.feedback_submissions
          SET notify_status = 'failed',
              notify_error = $2,
              notified_at = now()
          WHERE id = $1::uuid
        `,
        [id, errorMessage],
      );
    },

    async markNotificationSkipped(id, reason) {
      await pool.query(
        `
          UPDATE public.feedback_submissions
          SET notify_status = 'skipped',
              notify_error = $2,
              notified_at = now()
          WHERE id = $1::uuid
        `,
        [id, reason],
      );
    },
  };
}
