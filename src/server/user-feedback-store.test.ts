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
  assert.match(combinedSql, /CREATE TABLE IF NOT EXISTS public\.feedback_submissions/);
  assert.match(
    combinedSql,
    /id uuid PRIMARY KEY DEFAULT gen_random_uuid\(\)/,
  );
  assert.match(combinedSql, /message text NOT NULL/);
  assert.match(
    combinedSql,
    /screenshot_files jsonb NOT NULL DEFAULT '\[\]'::jsonb/,
  );
  assert.match(combinedSql, /page_route text NOT NULL DEFAULT '\//);
  assert.match(combinedSql, /source text NOT NULL DEFAULT 'home_feedback'/);
  assert.match(combinedSql, /user_agent text/);
  assert.match(combinedSql, /notify_status text NOT NULL DEFAULT 'pending'/);
  assert.match(combinedSql, /notify_error text/);
  assert.match(combinedSql, /notified_at timestamptz/);
  assert.match(combinedSql, /created_at timestamptz NOT NULL DEFAULT now\(\)/);
  assert.match(
    combinedSql,
    /ALTER TABLE public\.feedback_submissions\s+ADD COLUMN IF NOT EXISTS screenshot_files jsonb NOT NULL DEFAULT '\[\]'::jsonb/,
  );
  assert.match(
    combinedSql,
    /ALTER TABLE public\.feedback_submissions\s+ADD COLUMN IF NOT EXISTS page_route text NOT NULL DEFAULT '\//,
  );
  assert.match(
    combinedSql,
    /ALTER TABLE public\.feedback_submissions\s+ADD COLUMN IF NOT EXISTS user_agent text/,
  );
  assert.match(
    combinedSql,
    /ALTER TABLE public\.feedback_submissions\s+ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now\(\)/,
  );
  assert.match(combinedSql, /idx_feedback_submissions_created_at/);
});

test("createUserFeedbackStore persists feedback and returns its id", async () => {
  let capturedSql = "";
  let capturedValues: unknown[] = [];
  const store = createUserFeedbackStore({
    pool: {
      async query(sql: string, values?: unknown[]) {
        capturedSql = sql;
        capturedValues = values ?? [];
        return { rows: [{ id: capturedValues[0] }] };
      },
    },
  });

  const result = await store.saveFeedback({
    id: "11111111-1111-4111-8111-111111111111",
    message: "页面加载后按钮状态有点奇怪",
    screenshotFiles: [
      {
        bucket: "feedback-screenshots",
        path: "feedback-submissions/11111111-1111-4111-8111-111111111111/1.png",
        filename: "1.png",
        mimeType: "image/png",
        sizeBytes: 17,
      },
    ],
    pageRoute: "/nebula",
    userAgent: "feedback-bot/1.0",
  });

  assert.equal(result.id, "11111111-1111-4111-8111-111111111111");
  assert.match(capturedSql, /INSERT INTO public\.feedback_submissions/);
  assert.deepEqual(capturedValues, [
    "11111111-1111-4111-8111-111111111111",
    "页面加载后按钮状态有点奇怪",
    JSON.stringify([
      {
        bucket: "feedback-screenshots",
        path: "feedback-submissions/11111111-1111-4111-8111-111111111111/1.png",
        filename: "1.png",
        mimeType: "image/png",
        sizeBytes: 17,
      },
    ]),
    "/nebula",
    "home_feedback",
    "feedback-bot/1.0",
  ]);
});

test("createUserFeedbackStore records notification success and failures", async () => {
  const captured: Array<{ sql: string; values: unknown[] }> = [];
  const store = createUserFeedbackStore({
    pool: {
      async query(sql: string, values?: unknown[]) {
        captured.push({ sql, values: values ?? [] });
        return { rows: [{ id: "feedback-1" }] };
      },
    },
  });

  await store.markNotificationSent("feedback-1");
  await store.markNotificationFailed("feedback-2", "Resend API failed");

  assert.match(captured[0].sql, /UPDATE public\.feedback_submissions/);
  assert.match(captured[0].sql, /notify_status = 'sent'/);
  assert.deepEqual(captured[0].values, ["feedback-1"]);
  assert.match(captured[1].sql, /UPDATE public\.feedback_submissions/);
  assert.match(captured[1].sql, /notify_status = 'failed'/);
  assert.deepEqual(captured[1].values, ["feedback-2", "Resend API failed"]);
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
        id: "11111111-1111-4111-8111-111111111111",
        message: "缺少返回 id",
        screenshotFiles: [],
        pageRoute: "/",
      }),
    /Feedback insert did not return an id/,
  );
});
