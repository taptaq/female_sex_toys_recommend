import assert from "node:assert/strict";
import test from "node:test";

import {
  createUserFeedbackStore,
  ensureUserFeedbackSchema,
} from "./user-feedback-store.ts";

test("ensureUserFeedbackSchema creates anonymous feedback storage", async () => {
  const queries: string[] = [];
  const pool = {
    async query(sql: string) {
      queries.push(sql);
      return { rows: [] };
    },
  };

  await ensureUserFeedbackSchema(pool);

  const combinedSql = queries.join("\n");
  assert.match(combinedSql, /CREATE TABLE IF NOT EXISTS public\.user_feedback/);
  assert.match(
    combinedSql,
    /id uuid PRIMARY KEY DEFAULT gen_random_uuid\(\)/,
  );
  assert.match(combinedSql, /message text NOT NULL/);
  assert.match(
    combinedSql,
    /screenshots jsonb NOT NULL DEFAULT '\[\]'::jsonb/,
  );
  assert.match(combinedSql, /page_route text NOT NULL DEFAULT '\//);
  assert.match(combinedSql, /user_agent text/);
  assert.match(combinedSql, /created_at timestamptz NOT NULL DEFAULT now\(\)/);
  assert.match(
    combinedSql,
    /ALTER TABLE public\.user_feedback\s+ADD COLUMN IF NOT EXISTS screenshots jsonb NOT NULL DEFAULT '\[\]'::jsonb/,
  );
  assert.match(
    combinedSql,
    /ALTER TABLE public\.user_feedback\s+ADD COLUMN IF NOT EXISTS page_route text NOT NULL DEFAULT '\//,
  );
  assert.match(
    combinedSql,
    /ALTER TABLE public\.user_feedback\s+ADD COLUMN IF NOT EXISTS user_agent text/,
  );
  assert.match(
    combinedSql,
    /ALTER TABLE public\.user_feedback\s+ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now\(\)/,
  );
});

test("createUserFeedbackStore persists feedback and returns its id", async () => {
  let capturedSql = "";
  let capturedValues: unknown[] = [];
  const store = createUserFeedbackStore({
    pool: {
      async query(sql: string, values?: unknown[]) {
        capturedSql = sql;
        capturedValues = values ?? [];
        return { rows: [{ id: "feedback-1" }] };
      },
    },
  });

  const result = await store.saveFeedback({
    message: "页面加载后按钮状态有点奇怪",
    screenshots: [
      "data:image/png;base64,ZmFrZS1zY3JlZW5zaG90LTE=",
      "data:image/webp;base64,ZmFrZS1zY3JlZW5zaG90LTI=",
    ],
    pageRoute: "/nebula",
    userAgent: "feedback-bot/1.0",
  });

  assert.equal(result.id, "feedback-1");
  assert.match(capturedSql, /INSERT INTO public\.user_feedback/);
  assert.deepEqual(capturedValues, [
    "页面加载后按钮状态有点奇怪",
    JSON.stringify([
      "data:image/png;base64,ZmFrZS1zY3JlZW5zaG90LTE=",
      "data:image/webp;base64,ZmFrZS1zY3JlZW5zaG90LTI=",
    ]),
    "/nebula",
    "feedback-bot/1.0",
  ]);
});

test("createUserFeedbackStore throws when insert does not return an id", async () => {
  const store = createUserFeedbackStore({
    pool: {
      async query() {
        return { rows: [{}] };
      },
    },
  });

  await assert.rejects(
    () =>
      store.saveFeedback({
        message: "缺少返回 id",
        screenshots: [],
        pageRoute: "/",
      }),
    /Feedback insert did not return an id/,
  );
});
