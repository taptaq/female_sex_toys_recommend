import assert from "node:assert/strict";
import test from "node:test";

import { addFavorite, listFavorites, removeFavorite } from "./user-favorites.ts";

test("favorites client requires login", async () => {
  await assert.rejects(() => listFavorites({ authToken: "" }), /需要登录后才能查看收藏/);
  await assert.rejects(() => addFavorite({ authToken: "", productId: "toy-1" }), /需要登录后才能收藏/);
  await assert.rejects(() => removeFavorite({ authToken: "", productId: "toy-1" }), /需要登录后才能取消收藏/);
});

test("favorites client forwards auth token and product id", async () => {
  const calls: Array<{ url: string; method: string; auth?: string; body?: string | null }> = [];
  const fetcher: typeof fetch = (async (input, init) => {
    calls.push({
      url: String(input),
      method: String(init?.method || "GET"),
      auth: String((init?.headers as Record<string, string>)?.Authorization || ""),
      body: typeof init?.body === "string" ? init.body : null,
    });

    return new Response(JSON.stringify({ productIds: ["toy-1"] }), { status: 200 });
  }) as typeof fetch;

  const listed = await listFavorites({ authToken: "token-1", fetcher });
  await addFavorite({ authToken: "token-1", productId: "toy-1", fetcher });
  await removeFavorite({ authToken: "token-1", productId: "toy-1", fetcher });

  assert.deepEqual(listed, { productIds: ["toy-1"] });
  assert.deepEqual(calls, [
    {
      url: "/api/user/favorites",
      method: "GET",
      auth: "Bearer token-1",
      body: null,
    },
    {
      url: "/api/user/favorites",
      method: "POST",
      auth: "Bearer token-1",
      body: JSON.stringify({ productId: "toy-1" }),
    },
    {
      url: "/api/user/favorites/toy-1",
      method: "DELETE",
      auth: "Bearer token-1",
      body: null,
    },
  ]);
});
