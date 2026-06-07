import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import type { Request, Response } from "express";

import {
  createDeleteUserRecommendationProfileHandler,
  createListUserRecommendationProfilesHandler,
  createSaveUserRecommendationProfileHandler,
} from "./user-recommendation-route.ts";
import { encryptPrivateJson } from "./user-recommendation-privacy.ts";

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

test("save recommendation profile handler requires an authenticated user id", async () => {
  let saveCount = 0;
  const handler = createSaveUserRecommendationProfileHandler({
    encryptionKey: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    jwtSecret: "test-jwt-secret",
    store: {
      saveEncryptedProfile: async () => {
        saveCount += 1;
        return { id: "profile-1" };
      },
    },
  });

  const mockResponse = createMockResponse();
  await handler(
    createMockRequest({ body: { answers: { tags: ["静音"] } } }),
    mockResponse.response,
  );

  assert.equal(saveCount, 0);
  assert.equal(mockResponse.readStatusCode(), 401);
  assert.deepEqual(mockResponse.readJsonPayload(), {
    error: "Login is required to save encrypted recommendation profiles",
  });
});

test("save recommendation profile handler encrypts payload before storing", async () => {
  let captured: unknown;
  const handler = createSaveUserRecommendationProfileHandler({
    encryptionKey: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    jwtSecret: "test-jwt-secret",
    store: {
      saveEncryptedProfile: async (userId, encryptedPayload, metadata) => {
        captured = { userId, encryptedPayload, metadata };
        return { id: "profile-1" };
      },
    },
  });

  const mockResponse = createMockResponse();
  await handler(
    createMockRequest({
      headers: {
        authorization: `Bearer ${createTestJwt(
          { sub: "6f78f6c4-6f1a-4d28-8f34-51ce2f10aa00" },
          "test-jwt-secret",
        )}`,
      },
      body: { answers: { tags: ["静音"] }, topProductIds: ["item-1"] },
    }),
    mockResponse.response,
  );

  assert.equal(mockResponse.readStatusCode(), 201);
  assert.deepEqual(mockResponse.readJsonPayload(), { id: "profile-1" });
  assert.match(JSON.stringify(captured), /6f78f6c4-6f1a-4d28-8f34-51ce2f10aa00/);
  assert.match(JSON.stringify(captured), /item-1/);
  assert.match(JSON.stringify(captured), /推荐档案/);
  assert.doesNotMatch(JSON.stringify(captured), /静音/);
  assert.match(JSON.stringify(captured), /aes-256-gcm/);
});

test("save recommendation profile handler can resolve the current user from Supabase access token", async () => {
  let captured: unknown;
  const handler = createSaveUserRecommendationProfileHandler({
    encryptionKey: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    jwtSecret: undefined,
    authVerifier: {
      verifyAccessToken: async (accessToken) =>
        accessToken === "supabase-access-token"
          ? "6f78f6c4-6f1a-4d28-8f34-51ce2f10aa00"
          : null,
    },
    store: {
      saveEncryptedProfile: async (userId, encryptedPayload, metadata) => {
        captured = { userId, encryptedPayload, metadata };
        return { id: "profile-1" };
      },
    },
  });

  const mockResponse = createMockResponse();
  await handler(
    createMockRequest({
      headers: { authorization: "Bearer supabase-access-token" },
      body: { title: "已保存方案", answers: { tags: ["静音"] } },
    }),
    mockResponse.response,
  );

  assert.equal(mockResponse.readStatusCode(), 201);
  assert.deepEqual(mockResponse.readJsonPayload(), { id: "profile-1" });
  assert.match(JSON.stringify(captured), /6f78f6c4-6f1a-4d28-8f34-51ce2f10aa00/);
  assert.match(JSON.stringify(captured), /已保存方案/);
  assert.doesNotMatch(JSON.stringify(captured), /静音/);
});

test("save recommendation profile handler rejects a forged user id header", async () => {
  let saveCount = 0;
  const handler = createSaveUserRecommendationProfileHandler({
    encryptionKey: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    jwtSecret: "test-jwt-secret",
    store: {
      saveEncryptedProfile: async () => {
        saveCount += 1;
        return { id: "profile-1" };
      },
    },
  });

  const mockResponse = createMockResponse();
  await handler(
    createMockRequest({
      headers: { "x-user-id": "6f78f6c4-6f1a-4d28-8f34-51ce2f10aa00" },
      body: { answers: { tags: ["静音"] } },
    }),
    mockResponse.response,
  );

  assert.equal(saveCount, 0);
  assert.equal(mockResponse.readStatusCode(), 401);
});

test("list recommendation profile handler decrypts current user's profiles", async () => {
  const encryptionKey =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const handler = createListUserRecommendationProfilesHandler({
    encryptionKey,
    jwtSecret: "test-jwt-secret",
    store: {
      listEncryptedProfiles: async (_userId) => [
        {
          id: "profile-1",
          title: "我的装备匹配档案",
          summary: "偏好：静音",
          topProductIds: ["item-1"],
          savedAt: "2026-05-02T12:00:00.000Z",
          encryptedPayload: encryptPrivateJson(
            {
              answers: { tags: ["静音"] },
              topProducts: [{ id: "item-1", name: "Nebula Pick", score: 96 }],
            },
            encryptionKey,
          ),
        },
      ],
    },
  });

  const mockResponse = createMockResponse();
  await handler(
    createMockRequest({
      headers: {
        authorization: `Bearer ${createTestJwt(
          { sub: "6f78f6c4-6f1a-4d28-8f34-51ce2f10aa00" },
          "test-jwt-secret",
        )}`,
      },
    }),
    mockResponse.response,
  );

  assert.equal(mockResponse.readStatusCode(), 200);
  assert.match(JSON.stringify(mockResponse.readJsonPayload()), /我的装备匹配档案/);
  assert.match(JSON.stringify(mockResponse.readJsonPayload()), /Nebula Pick/);
  assert.match(JSON.stringify(mockResponse.readJsonPayload()), /静音/);
});

test("list recommendation profile handler skips corrupted encrypted profiles instead of failing the whole list", async () => {
  const encryptionKey =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const handler = createListUserRecommendationProfilesHandler({
    encryptionKey,
    jwtSecret: "test-jwt-secret",
    store: {
      listEncryptedProfiles: async (_userId) => [
        {
          id: "profile-good",
          title: "可读取档案",
          summary: "偏好：静音",
          topProductIds: ["item-1"],
          savedAt: "2026-05-02T12:00:00.000Z",
          encryptedPayload: encryptPrivateJson(
            {
              answers: { tags: ["静音"] },
              topProducts: [{ id: "item-1", name: "Nebula Pick", score: 96 }],
            },
            encryptionKey,
          ),
        },
        {
          id: "profile-bad",
          title: "损坏档案",
          summary: "",
          topProductIds: [],
          savedAt: "2026-05-01T12:00:00.000Z",
          encryptedPayload: {
            algorithm: "aes-256-gcm",
            iv: "bad",
            authTag: "bad",
            ciphertext: "bad",
          },
        },
      ],
    },
  });

  const mockResponse = createMockResponse();
  await handler(
    createMockRequest({
      headers: {
        authorization: `Bearer ${createTestJwt(
          { sub: "6f78f6c4-6f1a-4d28-8f34-51ce2f10aa00" },
          "test-jwt-secret",
        )}`,
      },
    }),
    mockResponse.response,
  );

  assert.equal(mockResponse.readStatusCode(), 200);
  assert.match(JSON.stringify(mockResponse.readJsonPayload()), /可读取档案/);
  assert.doesNotMatch(JSON.stringify(mockResponse.readJsonPayload()), /损坏档案/);
});

test("list recommendation profile handler requires login", async () => {
  let listCount = 0;
  const handler = createListUserRecommendationProfilesHandler({
    encryptionKey: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    jwtSecret: "test-jwt-secret",
    store: {
      listEncryptedProfiles: async () => {
        listCount += 1;
        return [];
      },
    },
  });

  const mockResponse = createMockResponse();
  await handler(createMockRequest({}), mockResponse.response);

  assert.equal(listCount, 0);
  assert.equal(mockResponse.readStatusCode(), 401);
});

test("delete recommendation profile handler requires login", async () => {
  let deleteCount = 0;
  const handler = createDeleteUserRecommendationProfileHandler({
    jwtSecret: "test-jwt-secret",
    store: {
      deleteProfile: async () => {
        deleteCount += 1;
      },
    },
  });

  const mockResponse = createMockResponse();
  await handler(
    createMockRequest({ params: { profileId: "profile-1" } }),
    mockResponse.response,
  );

  assert.equal(deleteCount, 0);
  assert.equal(mockResponse.readStatusCode(), 401);
});

test("delete recommendation profile handler soft deletes the current user's profile", async () => {
  const calls: unknown[] = [];
  const handler = createDeleteUserRecommendationProfileHandler({
    jwtSecret: "test-jwt-secret",
    store: {
      deleteProfile: async (userId, profileId) => {
        calls.push({ userId, profileId });
      },
    },
  });

  const mockResponse = createMockResponse();
  await handler(
    createMockRequest({
      headers: {
        authorization: `Bearer ${createTestJwt(
          { sub: "6f78f6c4-6f1a-4d28-8f34-51ce2f10aa00" },
          "test-jwt-secret",
        )}`,
      },
      params: { profileId: "profile-1" },
    }),
    mockResponse.response,
  );

  assert.equal(mockResponse.readStatusCode(), 200);
  assert.deepEqual(mockResponse.readJsonPayload(), { ok: true });
  assert.deepEqual(calls, [
    {
      userId: "6f78f6c4-6f1a-4d28-8f34-51ce2f10aa00",
      profileId: "profile-1",
    },
  ]);
});
