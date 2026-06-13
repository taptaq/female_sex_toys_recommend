import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";

import {
  createCorsAllowlistMiddleware,
  createOriginGuardMiddleware,
  createRateLimitMiddleware,
  createSecurityHeadersMiddleware,
  getPublicErrorDetails,
  resetRateLimitBucketsForTests,
} from "./server-security.ts";

function createMockRequest({
  method = "POST",
  headers = {},
  ip = "127.0.0.1",
}: {
  method?: string;
  headers?: Record<string, string | undefined>;
  ip?: string;
} = {}) {
  return {
    method,
    ip,
    socket: { remoteAddress: ip },
    get(name: string) {
      return headers[name.toLowerCase()];
    },
  } as unknown as Request;
}

function createMockResponse() {
  let statusCode = 200;
  let jsonPayload: unknown;
  const headers = new Map<string, string>();

  const response = {
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
      return response;
    },
    status(code: number) {
      statusCode = code;
      return response;
    },
    json(payload: unknown) {
      jsonPayload = payload;
      return response;
    },
    end() {
      return response;
    },
  } as unknown as Response;

  return {
    response,
    readStatusCode: () => statusCode,
    readJsonPayload: () => jsonPayload,
    readHeader: (name: string) => headers.get(name.toLowerCase()),
  };
}

test("security headers middleware sets production browser protections", () => {
  const middleware = createSecurityHeadersMiddleware();
  const mockResponse = createMockResponse();
  let nextCalled = false;

  middleware(createMockRequest(), mockResponse.response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(mockResponse.readHeader("x-content-type-options"), "nosniff");
  assert.equal(mockResponse.readHeader("x-frame-options"), "DENY");
  assert.match(
    mockResponse.readHeader("content-security-policy") || "",
    /frame-ancestors 'none'/,
  );
});

test("cors middleware allows configured origins and answers preflight", () => {
  const previousAllowedOrigins = process.env.ALLOWED_ORIGINS;
  process.env.ALLOWED_ORIGINS = "https://app.example";

  try {
    const middleware = createCorsAllowlistMiddleware();
    const mockResponse = createMockResponse();
    let nextCalled = false;

    middleware(
      createMockRequest({
        method: "OPTIONS",
        headers: {
          origin: "https://app.example",
          host: "api.example",
        },
      }),
      mockResponse.response,
      () => {
        nextCalled = true;
      },
    );

    assert.equal(nextCalled, false);
    assert.equal(mockResponse.readStatusCode(), 204);
    assert.equal(
      mockResponse.readHeader("access-control-allow-origin"),
      "https://app.example",
    );
    assert.equal(mockResponse.readHeader("vary"), "Origin");
    assert.match(
      mockResponse.readHeader("access-control-allow-headers") || "",
      /Authorization/,
    );
  } finally {
    process.env.ALLOWED_ORIGINS = previousAllowedOrigins;
  }
});

test("cors middleware rejects disallowed preflight origins", () => {
  const previousAllowedOrigins = process.env.ALLOWED_ORIGINS;
  process.env.ALLOWED_ORIGINS = "https://app.example";

  try {
    const middleware = createCorsAllowlistMiddleware();
    const mockResponse = createMockResponse();
    let nextCalled = false;

    middleware(
      createMockRequest({
        method: "OPTIONS",
        headers: {
          origin: "https://attacker.example",
          host: "api.example",
        },
      }),
      mockResponse.response,
      () => {
        nextCalled = true;
      },
    );

    assert.equal(nextCalled, false);
    assert.equal(mockResponse.readStatusCode(), 403);
    assert.deepEqual(mockResponse.readJsonPayload(), {
      error: "Request origin is not allowed",
    });
  } finally {
    process.env.ALLOWED_ORIGINS = previousAllowedOrigins;
  }
});

test("origin guard rejects cross-site state-changing requests", () => {
  const previousAllowedOrigins = process.env.ALLOWED_ORIGINS;
  delete process.env.ALLOWED_ORIGINS;

  try {
    const middleware = createOriginGuardMiddleware();
    const mockResponse = createMockResponse();
    let nextCalled = false;

    middleware(
      createMockRequest({
        headers: {
          origin: "https://attacker.example",
          host: "app.example",
        },
      }),
      mockResponse.response,
      () => {
        nextCalled = true;
      },
    );

    assert.equal(nextCalled, false);
    assert.equal(mockResponse.readStatusCode(), 403);
    assert.deepEqual(mockResponse.readJsonPayload(), {
      error: "Request origin is not allowed",
    });
  } finally {
    process.env.ALLOWED_ORIGINS = previousAllowedOrigins;
  }
});

test("origin guard allows configured deployment origins", () => {
  const previousAllowedOrigins = process.env.ALLOWED_ORIGINS;
  process.env.ALLOWED_ORIGINS = "https://app.example";

  try {
    const middleware = createOriginGuardMiddleware();
    const mockResponse = createMockResponse();
    let nextCalled = false;

    middleware(
      createMockRequest({
        headers: {
          origin: "https://app.example",
          host: "api.example",
        },
      }),
      mockResponse.response,
      () => {
        nextCalled = true;
      },
    );

    assert.equal(nextCalled, true);
    assert.equal(mockResponse.readStatusCode(), 200);
  } finally {
    process.env.ALLOWED_ORIGINS = previousAllowedOrigins;
  }
});

test("origin guard treats forwarded https host as same origin behind proxies", () => {
  const previousAllowedOrigins = process.env.ALLOWED_ORIGINS;
  delete process.env.ALLOWED_ORIGINS;

  try {
    const middleware = createOriginGuardMiddleware();
    const mockResponse = createMockResponse();
    let nextCalled = false;

    middleware(
      createMockRequest({
        headers: {
          origin: "https://www.inner-space.icu",
          host: "127.0.0.1:3010",
          "x-forwarded-host": "www.inner-space.icu",
          "x-forwarded-proto": "https",
        },
      }),
      mockResponse.response,
      () => {
        nextCalled = true;
      },
    );

    assert.equal(nextCalled, true);
    assert.equal(mockResponse.readStatusCode(), 200);
  } finally {
    process.env.ALLOWED_ORIGINS = previousAllowedOrigins;
  }
});

test("rate limiter blocks repeated requests from the same client", () => {
  resetRateLimitBucketsForTests();
  const middleware = createRateLimitMiddleware({
    windowMs: 60_000,
    maxRequests: 2,
    keyPrefix: "test",
  });
  const first = createMockResponse();
  const second = createMockResponse();
  const third = createMockResponse();
  let nextCount = 0;

  middleware(createMockRequest(), first.response, () => {
    nextCount += 1;
  });
  middleware(createMockRequest(), second.response, () => {
    nextCount += 1;
  });
  middleware(createMockRequest(), third.response, () => {
    nextCount += 1;
  });

  assert.equal(nextCount, 2);
  assert.equal(third.readStatusCode(), 429);
  assert.deepEqual(third.readJsonPayload(), {
    error: "Too many requests, please try again later",
  });
});

test("public error details are hidden in production", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";

  try {
    assert.equal(getPublicErrorDetails(new Error("database secret")), undefined);
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
  }
});
