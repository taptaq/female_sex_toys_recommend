import assert from "node:assert/strict";
import test from "node:test";

import { ensureRecommenderItemsSchema } from "./recommender-items-schema.ts";

test("ensureRecommenderItemsSchema creates the table before altering columns", async () => {
  const queries: string[] = [];
  const pool = {
    async query(sql: string) {
      queries.push(sql);
      return { rows: [], rowCount: 0 };
    },
  };

  await ensureRecommenderItemsSchema(pool);

  assert.ok(queries.length >= 2);
  assert.match(queries[0] ?? "", /CREATE TABLE IF NOT EXISTS public\.recommender_toys/i);
  assert.match(queries[1] ?? "", /ALTER TABLE public\.recommender_toys/i);
  assert.match(queries[1] ?? "", /safe_display_name/i);
  assert.ok(
    queries.some((query) =>
      /ALTER TABLE public\.recommender_toys[\s\S]*ADD COLUMN IF NOT EXISTS recommendation_features JSONB/i.test(
        query,
      ),
    ),
    "runtime schema should keep recommendation feature metadata available",
  );
});

test("ensureRecommenderItemsSchema creates and refreshes a female-only product table", async () => {
  const queries: string[] = [];
  const pool = {
    async query(sql: string) {
      queries.push(sql);
      return { rows: [], rowCount: 0 };
    },
  };

  await ensureRecommenderItemsSchema(pool);

  assert.ok(
    queries.some((query) =>
      /CREATE TABLE IF NOT EXISTS public\.female_recommender_toys\s*\(\s*LIKE public\.recommender_toys INCLUDING/i.test(
        query,
      ),
    ),
    "female table should mirror recommender_toys structure",
  );
  assert.ok(
    queries.some((query) =>
      /INSERT INTO public\.female_recommender_toys[\s\S]*FROM public\.recommender_toys[\s\S]*WHERE gender = 'female'/i.test(
        query,
      ),
    ),
    "female table should be populated from female recommender_toys rows",
  );
});

test("ensureRecommenderItemsSchema adds lookup indexes for the library API", async () => {
  const queries: string[] = [];
  const pool = {
    async query(sql: string) {
      queries.push(sql);
      return { rows: [], rowCount: 0 };
    },
  };

  await ensureRecommenderItemsSchema(pool);

  assert.ok(
    queries.some((query) =>
      /CREATE INDEX IF NOT EXISTS idx_recommender_toys_created_at/i.test(query),
    ),
    "created_at ordering should be indexed",
  );
  assert.ok(
    queries.some((query) =>
      /CREATE INDEX IF NOT EXISTS idx_recommender_toys_original_id/i.test(query),
    ),
    "product join key should be indexed",
  );
  assert.ok(
    queries.some((query) =>
      /CREATE INDEX IF NOT EXISTS idx_recommender_toys_filter_codes/i.test(query),
    ),
    "common library filters should be indexed together",
  );
  assert.ok(
    queries.some((query) =>
      /CREATE INDEX IF NOT EXISTS idx_female_recommender_toys_created_at/i.test(query),
    ),
    "female table created_at ordering should be indexed",
  );
  assert.ok(
    queries.some((query) =>
      /CREATE INDEX IF NOT EXISTS idx_female_recommender_toys_original_id/i.test(query),
    ),
    "female table product join key should be indexed",
  );
  assert.ok(
    queries.some((query) =>
      /CREATE INDEX IF NOT EXISTS idx_female_recommender_toys_filter_codes/i.test(query),
    ),
    "female table filters should be indexed together",
  );
});
