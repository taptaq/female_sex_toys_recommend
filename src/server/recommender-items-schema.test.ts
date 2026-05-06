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
});
