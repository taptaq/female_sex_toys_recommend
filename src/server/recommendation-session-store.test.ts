import assert from "node:assert/strict";
import test from "node:test";

import {
  createRecommendationSessionStore,
  ensureRecommendationSessionSchema,
} from "./recommendation-session-store.ts";

test("ensureRecommendationSessionSchema creates dedicated recommendation session storage", async () => {
  const queries: string[] = [];
  const pool = {
    async query(sql: string) {
      queries.push(sql);
      return { rows: [] };
    },
  };

  await ensureRecommendationSessionSchema(pool);

  const combinedSql = queries.join("\n");
  assert.match(combinedSql, /CREATE TABLE IF NOT EXISTS public\.recommendation_sessions/);
  assert.match(combinedSql, /session_id text NOT NULL UNIQUE/);
  assert.match(combinedSql, /answers jsonb NOT NULL DEFAULT '\{\}'::jsonb/);
  assert.match(combinedSql, /answer_path jsonb NOT NULL DEFAULT '\[\]'::jsonb/);
  assert.match(combinedSql, /top_products jsonb NOT NULL DEFAULT '\[\]'::jsonb/);
  assert.match(combinedSql, /flow_version text NOT NULL DEFAULT 'quiz-flow-v1'/);
  assert.match(combinedSql, /algorithm_version text NOT NULL DEFAULT 'recommendation-v1'/);
  assert.match(combinedSql, /result_provider text/);
  assert.match(combinedSql, /result_model_name text/);
  assert.match(combinedSql, /encrypted_payload jsonb/);
  assert.match(combinedSql, /expires_at timestamptz NOT NULL DEFAULT \(now\(\) \+ interval '90 days'\)/);
  assert.match(combinedSql, /created_at timestamptz NOT NULL DEFAULT now\(\)/);
  assert.match(combinedSql, /completed_at timestamptz NOT NULL DEFAULT now\(\)/);
  assert.match(combinedSql, /idx_recommendation_sessions_completed_at/);
  assert.match(combinedSql, /idx_recommendation_sessions_expires_at/);
});

test("createRecommendationSessionStore upserts completed recommendation sessions", async () => {
  let capturedSql = "";
  let capturedValues: unknown[] = [];
  const store = createRecommendationSessionStore({
    pool: {
      async query(sql: string, values?: unknown[]) {
        capturedSql = sql;
        capturedValues = values ?? [];
        return { rows: [{ id: "session-row-1" }] };
      },
    },
  });

  const result = await store.saveSession({
    sessionId: "session-1",
    answers: { gender: "female", tags: ["女性向"] },
    answerPath: [{ questionId: "q0", tag: "女性向" }],
    topProducts: [{ id: "p1", score: 98 }],
    flowVersion: "quiz-flow-v1",
    algorithmVersion: "recommendation-v1",
    resultProvider: "qwen",
    resultModelName: "qwen3.5-27b",
    pageRoute: "/results",
  });

  assert.equal(result.id, "session-row-1");
  assert.match(capturedSql, /INSERT INTO public\.recommendation_sessions/);
  assert.match(capturedSql, /ON CONFLICT \(session_id\) DO UPDATE/);
  assert.deepEqual(capturedValues, [
    "session-1",
    JSON.stringify({ gender: "female", tags: ["女性向"] }),
    JSON.stringify([{ questionId: "q0", tag: "女性向" }]),
    JSON.stringify([{ id: "p1", score: 98 }]),
    "quiz-flow-v1",
    "recommendation-v1",
    "qwen",
    "qwen3.5-27b",
    "/results",
    90,
    null,
  ]);
});

test("createRecommendationSessionStore encrypts private session payloads when configured", async () => {
  let capturedSql = "";
  let capturedValues: unknown[] = [];
  const store = createRecommendationSessionStore({
    pool: {
      async query(sql: string, values?: unknown[]) {
        capturedSql = sql;
        capturedValues = values ?? [];
        return { rows: [{ id: "session-row-1" }] };
      },
    },
    encryptionKey: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    retentionDays: 30,
  });

  await store.saveSession({
    sessionId: "session-1",
    answers: { tags: ["quiet"] },
    answerPath: [],
    topProducts: [{ id: "p1", score: 98 }],
    privatePayload: {
      answers: { freeText: "private note" },
      answerPath: [{ questionId: "q1", label: "private" }],
      topProducts: [{ id: "p1", rawDescription: "private detail" }],
    },
    flowVersion: "quiz-flow-v1",
    algorithmVersion: "recommendation-v1",
    resultProvider: null,
    resultModelName: null,
    pageRoute: "/results",
  });

  assert.match(capturedSql, /encrypted_payload/);
  assert.match(capturedSql, /expires_at/);
  assert.equal(capturedValues[9], 30);
  const encryptedPayload = JSON.parse(String(capturedValues[10]));
  assert.equal(encryptedPayload.algorithm, "aes-256-gcm");
  assert.equal(typeof encryptedPayload.iv, "string");
  assert.equal(typeof encryptedPayload.authTag, "string");
  assert.equal(typeof encryptedPayload.ciphertext, "string");
  assert.doesNotMatch(String(capturedValues[10]), /private note/);
});

test("createRecommendationSessionStore can delete expired recommendation sessions", async () => {
  let capturedSql = "";
  const store = createRecommendationSessionStore({
    pool: {
      async query(sql: string) {
        capturedSql = sql;
        return { rows: [{ id: "expired-1" }, { id: "expired-2" }] };
      },
    },
  });

  const result = await store.deleteExpiredSessions();

  assert.equal(result.deletedCount, 2);
  assert.match(capturedSql, /DELETE FROM public\.recommendation_sessions/);
  assert.match(capturedSql, /WHERE expires_at < now\(\)/);
});
