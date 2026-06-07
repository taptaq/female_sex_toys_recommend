type Queryable = {
  query: (sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
};

export type UserRecommendationStore = {
  saveEncryptedProfile: (
    userId: string,
    encryptedPayload: unknown,
    metadata: UserRecommendationProfileMetadata,
  ) => Promise<{ id: string }>;
  listEncryptedProfiles: (
    userId: string,
  ) => Promise<UserRecommendationProfileRow[]>;
  deleteProfile: (userId: string, profileId: string) => Promise<void>;
};

export type UserRecommendationProfileMetadata = {
  title: string;
  summary: string;
  topProductIds: string[];
};

export type UserRecommendationProfileRow = {
  id: string;
  title: string;
  summary: string;
  topProductIds: string[];
  savedAt: string;
  encryptedPayload: unknown;
};

export async function ensureUserRecommendationSchema(
  pool: Queryable,
) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.user_recommendation_profiles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      title text NOT NULL DEFAULT '推荐档案',
      summary text NOT NULL DEFAULT '',
      top_product_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
      saved_at timestamptz NOT NULL DEFAULT now(),
      encrypted_payload jsonb NOT NULL,
      encryption_version integer NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    )
  `);

  await pool.query(`
    ALTER TABLE public.user_recommendation_profiles
    ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '推荐档案'
  `);

  await pool.query(`
    ALTER TABLE public.user_recommendation_profiles
    ADD COLUMN IF NOT EXISTS summary text NOT NULL DEFAULT ''
  `);

  await pool.query(`
    ALTER TABLE public.user_recommendation_profiles
    ADD COLUMN IF NOT EXISTS top_product_ids jsonb NOT NULL DEFAULT '[]'::jsonb
  `);

  await pool.query(`
    ALTER TABLE public.user_recommendation_profiles
    ADD COLUMN IF NOT EXISTS saved_at timestamptz NOT NULL DEFAULT now()
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_recommendation_profiles_user_updated
    ON public.user_recommendation_profiles(user_id, updated_at DESC)
    WHERE deleted_at IS NULL
  `);
}

export function createUserRecommendationStore({
  pool,
}: {
  pool: Queryable;
}): UserRecommendationStore {
  return {
    async saveEncryptedProfile(userId, encryptedPayload, metadata) {
      const result = await pool.query(
        `
          INSERT INTO public.user_recommendation_profiles (
            user_id,
            title,
            summary,
            top_product_ids,
            saved_at,
            encrypted_payload
          )
          VALUES ($1, $2, $3, $4::jsonb, now(), $5::jsonb)
          RETURNING id
        `,
        [
          userId,
          metadata.title,
          metadata.summary,
          JSON.stringify(metadata.topProductIds),
          JSON.stringify(encryptedPayload),
        ],
      );
      const row = result.rows[0] as { id?: string } | undefined;
      return { id: row?.id ?? "" };
    },
    async listEncryptedProfiles(userId) {
      const result = await pool.query(
        `
          SELECT
            id,
            title,
            summary,
            top_product_ids,
            saved_at,
            encrypted_payload
          FROM public.user_recommendation_profiles
          WHERE user_id = $1
            AND deleted_at IS NULL
          ORDER BY saved_at DESC
          LIMIT 50
        `,
        [userId],
      );

      return result.rows.map((row) => {
        const profileRow = row as {
          id?: string;
          title?: string;
          summary?: string;
          top_product_ids?: unknown;
          saved_at?: string | Date;
          encrypted_payload?: unknown;
        };
        return {
          id: profileRow.id ?? "",
          title: profileRow.title ?? "推荐档案",
          summary: profileRow.summary ?? "",
          topProductIds: Array.isArray(profileRow.top_product_ids)
            ? profileRow.top_product_ids.filter(
                (item): item is string => typeof item === "string",
              )
            : [],
          savedAt:
            profileRow.saved_at instanceof Date
              ? profileRow.saved_at.toISOString()
              : String(profileRow.saved_at ?? ""),
          encryptedPayload: profileRow.encrypted_payload,
        };
      });
    },
    async deleteProfile(userId, profileId) {
      await pool.query(
        `
          UPDATE public.user_recommendation_profiles
          SET
            deleted_at = now(),
            updated_at = now()
          WHERE user_id = $1
            AND id = $2
            AND deleted_at IS NULL
        `,
        [userId, profileId],
      );
    },
  };
}
