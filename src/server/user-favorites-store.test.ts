import assert from "node:assert/strict";
import test from "node:test";

import { createUserFavoritesStore } from "./user-favorites-store.ts";

test("user favorites store writes add/list/delete queries", async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const store = createUserFavoritesStore({
    pool: {
      query: async (sql: string, params?: unknown[]) => {
        calls.push({ sql, params: params ?? [] });
        if (sql.includes("SELECT product_id")) {
          return { rows: [{ product_id: "toy-1" }, { product_id: "toy-2" }] };
        }
        return { rows: [] };
      },
    } as never,
  });

  await store.addFavorite("user-1", "toy-1");
  const listed = await store.listFavorites("user-1");
  await store.deleteFavorite("user-1", "toy-1");

  assert.deepEqual(listed, ["toy-1", "toy-2"]);
  assert.match(calls[0]!.sql, /INSERT INTO public\.favorites/i);
  assert.match(calls[1]!.sql, /SELECT product_id/i);
  assert.match(calls[2]!.sql, /DELETE FROM public\.favorites/i);
});
