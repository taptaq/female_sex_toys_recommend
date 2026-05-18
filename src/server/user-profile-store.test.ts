import assert from "node:assert/strict";
import test from "node:test";

import { createUserProfileStore } from "./user-profile-store.ts";

test("user profile store upserts username into profiles", async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const store = createUserProfileStore({
    pool: {
      query: async (sql: string, params?: unknown[]) => {
        calls.push({ sql, params: params ?? [] });
        return { rows: [] };
      },
    } as never,
  });

  await store.upsertProfile({
    userId: "6f78f6c4-6f1a-4d28-8f34-51ce2f10aa00",
    username: "taptaq",
  });

  assert.match(calls[0]!.sql, /INSERT INTO public\.profiles/i);
  assert.deepEqual(calls[0]!.params, [
    "6f78f6c4-6f1a-4d28-8f34-51ce2f10aa00",
    "taptaq",
  ]);
});
