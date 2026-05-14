import type { RecommendationRerollReason } from "../lib/recommendation-reroll.js";

type Queryable = {
  query: (sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
};

export type SaveRecommendationFeedbackEventInput = {
  sessionId?: string | null;
  eventType: "reroll_recommendation";
  answers: Record<string, unknown>;
  answerPath?: unknown[];
  topProducts: unknown[];
  rerollAttempt?: number | null;
  rerollReason?: RecommendationRerollReason | null;
  resultProvider?: string | null;
  resultModelName?: string | null;
  pageRoute: string;
  userAgent?: string;
};

export type RecommendationFeedbackStore = {
  saveEvent: (
    input: SaveRecommendationFeedbackEventInput,
  ) => Promise<{ id: string }>;
};

export async function ensureRecommendationFeedbackSchema(pool: Queryable) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.recommendation_feedback_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id text,
      event_type text NOT NULL,
      answers jsonb NOT NULL DEFAULT '{}'::jsonb,
      answer_path jsonb NOT NULL DEFAULT '[]'::jsonb,
      top_products jsonb NOT NULL DEFAULT '[]'::jsonb,
      reroll_attempt integer,
      reroll_reason text,
      result_provider text,
      result_model_name text,
      page_route text NOT NULL DEFAULT '/',
      user_agent text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    ALTER TABLE public.recommendation_feedback_events
    ADD COLUMN IF NOT EXISTS session_id text
  `);

  await pool.query(`
    ALTER TABLE public.recommendation_feedback_events
    ADD COLUMN IF NOT EXISTS answers jsonb NOT NULL DEFAULT '{}'::jsonb
  `);

  await pool.query(`
    ALTER TABLE public.recommendation_feedback_events
    ADD COLUMN IF NOT EXISTS answer_path jsonb NOT NULL DEFAULT '[]'::jsonb
  `);

  await pool.query(`
    ALTER TABLE public.recommendation_feedback_events
    ADD COLUMN IF NOT EXISTS top_products jsonb NOT NULL DEFAULT '[]'::jsonb
  `);

  await pool.query(`
    ALTER TABLE public.recommendation_feedback_events
    ADD COLUMN IF NOT EXISTS reroll_attempt integer
  `);

  await pool.query(`
    ALTER TABLE public.recommendation_feedback_events
    ADD COLUMN IF NOT EXISTS reroll_reason text
  `);

  await pool.query(`
    ALTER TABLE public.recommendation_feedback_events
    ADD COLUMN IF NOT EXISTS result_provider text
  `);

  await pool.query(`
    ALTER TABLE public.recommendation_feedback_events
    ADD COLUMN IF NOT EXISTS result_model_name text
  `);

  await pool.query(`
    ALTER TABLE public.recommendation_feedback_events
    ADD COLUMN IF NOT EXISTS page_route text NOT NULL DEFAULT '/'
  `);

  await pool.query(`
    ALTER TABLE public.recommendation_feedback_events
    ADD COLUMN IF NOT EXISTS user_agent text
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_recommendation_feedback_events_created_at
    ON public.recommendation_feedback_events(created_at DESC)
  `);
}

export function createRecommendationFeedbackStore({
  pool,
}: {
  pool: Queryable;
}): RecommendationFeedbackStore {
  return {
    async saveEvent({
      sessionId,
      eventType,
      answers,
      answerPath,
      topProducts,
      rerollAttempt,
      rerollReason,
      resultProvider,
      resultModelName,
      pageRoute,
      userAgent,
    }) {
      const result = await pool.query(
        `
          INSERT INTO public.recommendation_feedback_events (
            session_id,
            event_type,
            answers,
            answer_path,
            top_products,
            reroll_attempt,
            reroll_reason,
            result_provider,
            result_model_name,
            page_route,
            user_agent
          )
          VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6, $7, $8, $9, $10, $11)
          RETURNING id
        `,
        [
          sessionId ?? null,
          eventType,
          JSON.stringify(answers),
          JSON.stringify(answerPath ?? []),
          JSON.stringify(topProducts),
          rerollAttempt ?? null,
          rerollReason ?? null,
          resultProvider ?? null,
          resultModelName ?? null,
          pageRoute,
          userAgent ?? null,
        ],
      );

      const row = result.rows[0] as { id?: string } | undefined;
      if (!row?.id) {
        throw new Error("Recommendation feedback insert did not return an id");
      }

      return { id: row.id };
    },
  };
}
