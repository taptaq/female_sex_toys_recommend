import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import type { Request, Response } from "express";

import {
  createAddFavoriteHandler,
  createDeleteFavoriteHandler,
  createListFavoritesHandler,
} from "./user-favorites-route.ts";

function base64UrlEncode(value: Buffer | string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function createTestJwt(payload: Record<string, unknown>, secret: string) {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = base64UrlEncode(
    crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest(),
  );

  return `${header}.${body}.${signature}`;
}

function createMockRequest({
  headers = {},
  body = {},
  params = {},
}: {
  headers?: Record<string, string | undefined>;
  body?: unknown;
  params?: Record<string, string | undefined>;
}) {
  return { headers, body, params } as Request;
}

function createMockResponse() {
  let statusCode = 200;
  let jsonPayload: unknown;

  const response = {
    status(code: number) {
      statusCode = code;
      return response;
    },
    json(payload: unknown) {
      jsonPayload = payload;
      return response;
    },
  } as unknown as Response;

  return {
    response,
    readStatusCode() {
      return statusCode;
    },
    readJsonPayload() {
      return jsonPayload;
    },
  };
}

test("favorites handlers require login", async () => {
  let addCount = 0;
  let listCount = 0;
  let removeCount = 0;

  const addHandler = createAddFavoriteHandler({
    jwtSecret: "test-jwt-secret",
    store: {
      addFavorite: async () => {
        addCount += 1;
      },
    },
  });
  const listHandler = createListFavoritesHandler({
    jwtSecret: "test-jwt-secret",
    store: {
      listFavorites: async () => {
        listCount += 1;
        return [];
      },
    },
  });
  const deleteHandler = createDeleteFavoriteHandler({
    jwtSecret: "test-jwt-secret",
    store: {
      deleteFavorite: async () => {
        removeCount += 1;
      },
    },
  });

  const addRes = createMockResponse();
  await addHandler(createMockRequest({ body: { productId: "toy-1" } }), addRes.response);
  assert.equal(addRes.readStatusCode(), 401);

  const listRes = createMockResponse();
  await listHandler(createMockRequest({}), listRes.response);
  assert.equal(listRes.readStatusCode(), 401);

  const deleteRes = createMockResponse();
  await deleteHandler(createMockRequest({ params: { productId: "toy-1" } }), deleteRes.response);
  assert.equal(deleteRes.readStatusCode(), 401);

  assert.equal(addCount, 0);
  assert.equal(listCount, 0);
  assert.equal(removeCount, 0);
});

test("favorites handlers add, list, and delete with authenticated user", async () => {
  const calls: Array<Record<string, string>> = [];
  const authHeader = {
    authorization: `Bearer ${createTestJwt(
      { sub: "6f78f6c4-6f1a-4d28-8f34-51ce2f10aa00" },
      "test-jwt-secret",
    )}`,
  };

  const addHandler = createAddFavoriteHandler({
    jwtSecret: "test-jwt-secret",
    store: {
      addFavorite: async (userId, productId) => {
        calls.push({ type: "add", userId, productId });
      },
    },
  });
  const listHandler = createListFavoritesHandler({
    jwtSecret: "test-jwt-secret",
    store: {
      listFavorites: async (userId) => {
        calls.push({ type: "list", userId, productId: "" });
        return ["toy-1", "toy-2"];
      },
    },
  });
  const deleteHandler = createDeleteFavoriteHandler({
    jwtSecret: "test-jwt-secret",
    store: {
      deleteFavorite: async (userId, productId) => {
        calls.push({ type: "delete", userId, productId });
      },
    },
  });

  const addRes = createMockResponse();
  await addHandler(
    createMockRequest({ headers: authHeader, body: { productId: "toy-1" } }),
    addRes.response,
  );
  assert.equal(addRes.readStatusCode(), 201);

  const listRes = createMockResponse();
  await listHandler(createMockRequest({ headers: authHeader }), listRes.response);
  assert.equal(listRes.readStatusCode(), 200);
  assert.deepEqual(listRes.readJsonPayload(), { productIds: ["toy-1", "toy-2"] });

  const deleteRes = createMockResponse();
  await deleteHandler(
    createMockRequest({ headers: authHeader, params: { productId: "toy-1" } }),
    deleteRes.response,
  );
  assert.equal(deleteRes.readStatusCode(), 200);

  assert.deepEqual(calls, [
    {
      type: "add",
      userId: "6f78f6c4-6f1a-4d28-8f34-51ce2f10aa00",
      productId: "toy-1",
    },
    {
      type: "list",
      userId: "6f78f6c4-6f1a-4d28-8f34-51ce2f10aa00",
      productId: "",
    },
    {
      type: "delete",
      userId: "6f78f6c4-6f1a-4d28-8f34-51ce2f10aa00",
      productId: "toy-1",
    },
  ]);
});
