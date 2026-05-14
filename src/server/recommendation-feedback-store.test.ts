import assert from "node:assert/strict";
import test from "node:test";

import {
  createRecommendationFeedbackStore,
  ensureRecommendationFeedbackSchema,
} from "./recommendation-feedback-store.ts";

test("ensureRecommendationFeedbackSchema creates recommendation feedback event storage", async () => {
  const queries: string[] = [];
  const pool = {
    async query(sql: string) {
      queries.push(sql);
      return { rows: [] };
    },
  };

  await ensureRecommendationFeedbackSchema(pool);

  const combinedSql = queries.join("\n");
  assert.match(
    combinedSql,
    /CREATE TABLE IF NOT EXISTS public\.recommendation_feedback_events/,
  );
  assert.match(combinedSql, /event_type text NOT NULL/);
  assert.match(combinedSql, /session_id text/);
  assert.match(combinedSql, /answers jsonb NOT NULL DEFAULT '\{\}'::jsonb/);
  assert.match(combinedSql, /answer_path jsonb NOT NULL DEFAULT '\[\]'::jsonb/);
  assert.match(combinedSql, /top_products jsonb NOT NULL DEFAULT '\[\]'::jsonb/);
  assert.match(combinedSql, /reroll_attempt integer/);
  assert.match(combinedSql, /reroll_reason text/);
  assert.match(combinedSql, /result_provider text/);
  assert.match(combinedSql, /result_model_name text/);
  assert.match(combinedSql, /page_route text NOT NULL DEFAULT '\//);
  assert.match(combinedSql, /user_agent text/);
});

test("createRecommendationFeedbackStore persists reroll feedback events", async () => {
  let capturedSql = "";
  let capturedValues: unknown[] = [];
  const store = createRecommendationFeedbackStore({
    pool: {
      async query(sql: string, values?: unknown[]) {
        capturedSql = sql;
        capturedValues = values ?? [];
        return { rows: [{ id: "event-1" }] };
      },
    },
  });

  const result = await store.saveEvent({
    sessionId: "session-1",
    eventType: "reroll_recommendation",
    answers: { gender: "male", tags: ["男性向"] },
    answerPath: [{ questionId: "q0", tag: "男性向" }],
    topProducts: [{ id: "p1", typeCode: "masturbator", score: 96 }],
    rerollAttempt: 2,
    rerollReason: "want_more_accurate",
    resultProvider: "dmxapi-qwen",
    resultModelName: "qwen3.5-27b",
    pageRoute: "/results",
    userAgent: "feedback-bot/1.0",
  });

  assert.equal(result.id, "event-1");
  assert.match(capturedSql, /INSERT INTO public\.recommendation_feedback_events/);
  assert.deepEqual(capturedValues, [
    "session-1",
    "reroll_recommendation",
    JSON.stringify({ gender: "male", tags: ["男性向"] }),
    JSON.stringify([{ questionId: "q0", tag: "男性向" }]),
    JSON.stringify([{ id: "p1", typeCode: "masturbator", score: 96 }]),
    2,
    "want_more_accurate",
    "dmxapi-qwen",
    "qwen3.5-27b",
    "/results",
    "feedback-bot/1.0",
  ]);
});
