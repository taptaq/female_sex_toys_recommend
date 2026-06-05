import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";

import { createEmailRegistrationHandler } from "./email-register-route.ts";

function createMockRequest(body: unknown) {
  return { body } as Request;
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
    readStatusCode: () => statusCode,
    readJsonPayload: () => jsonPayload,
  };
}

test("email registration handler creates a confirmed email user", async () => {
  let captured: unknown;
  let profileUpsert: unknown;
  const handler = createEmailRegistrationHandler({
    service: {
      createEmailUser: async (email, password) => {
        captured = { email, password };
        return { success: true, userId: "6f78f6c4-6f1a-4d28-8f34-51ce2f10aa00" };
      },
    },
    profileStore: {
      upsertProfile: async (input) => {
        profileUpsert = input;
      },
    },
  });

  const mockResponse = createMockResponse();
  await handler(
    createMockRequest({ email: " Taptaq@example.COM ", password: "secret-pass" }),
    mockResponse.response,
  );

  assert.equal(mockResponse.readStatusCode(), 201);
  assert.deepEqual(mockResponse.readJsonPayload(), { success: true });
  assert.deepEqual(captured, { email: "taptaq@example.com", password: "secret-pass" });
  assert.deepEqual(profileUpsert, {
    userId: "6f78f6c4-6f1a-4d28-8f34-51ce2f10aa00",
    username: "taptaq@example.com",
  });
});

test("email registration handler rejects missing credentials", async () => {
  const handler = createEmailRegistrationHandler({
    service: {
      createEmailUser: async () => ({
        success: true,
        userId: "6f78f6c4-6f1a-4d28-8f34-51ce2f10aa00",
      }),
    },
  });

  const mockResponse = createMockResponse();
  await handler(
    createMockRequest({ email: "", password: "" }),
    mockResponse.response,
  );

  assert.equal(mockResponse.readStatusCode(), 400);
  assert.deepEqual(mockResponse.readJsonPayload(), {
    error: "Email and password are required",
  });
});
