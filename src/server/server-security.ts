import type { Request, RequestHandler } from "express";

const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 60;

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  windowMs?: number;
  maxRequests?: number;
  keyPrefix?: string;
};

const rateLimitBuckets = new Map<string, RateLimitBucket>();

function splitEnvList(value: string | undefined) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveAllowedOrigins() {
  return splitEnvList(process.env.ALLOWED_ORIGINS);
}

function isSameOriginRequest(req: Request) {
  const origin = req.get("origin");
  if (!origin) {
    return true;
  }

  const forwardedHost = req.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = forwardedHost || req.get("host");
  if (!host) {
    return false;
  }

  if (forwardedProto) {
    return origin === `${forwardedProto}://${host}`;
  }

  return origin === `http://${host}` || origin === `https://${host}`;
}

function isAllowedOrigin(req: Request) {
  const origin = req.get("origin");
  if (!origin || isSameOriginRequest(req)) {
    return true;
  }

  return resolveAllowedOrigins().includes(origin);
}

function getAllowedOriginForCors(req: Request) {
  const origin = req.get("origin");
  if (!origin) {
    return null;
  }

  if (isAllowedOrigin(req)) {
    return origin;
  }

  return null;
}

function buildConnectSrc() {
  const configuredOrigins = resolveAllowedOrigins();
  return ["connect-src 'self' https:", ...configuredOrigins].join(" ");
}

function readClientIp(req: Request) {
  const forwardedFor = req.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || req.ip || "unknown";
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}

export function createSecurityHeadersMiddleware(): RequestHandler {
  return (_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
        "object-src 'none'",
        "img-src 'self' data: https:",
        "font-src 'self' data:",
        "style-src 'self' 'unsafe-inline'",
        "script-src 'self'",
        buildConnectSrc(),
      ].join("; "),
    );
    next();
  };
}

export function createCorsAllowlistMiddleware(): RequestHandler {
  return (req, res, next) => {
    const allowedOrigin = getAllowedOriginForCors(req);
    if (allowedOrigin) {
      res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
      res.setHeader("Vary", "Origin");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization",
      );
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET,POST,PATCH,DELETE,OPTIONS",
      );
      res.setHeader("Access-Control-Max-Age", "600");
    }

    if (req.method === "OPTIONS") {
      if (!allowedOrigin && req.get("origin")) {
        res.status(403).json({ error: "Request origin is not allowed" });
        return;
      }

      res.status(204).end();
      return;
    }

    next();
  };
}

export function createOriginGuardMiddleware(): RequestHandler {
  return (req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      next();
      return;
    }

    if (!isAllowedOrigin(req)) {
      res.status(403).json({ error: "Request origin is not allowed" });
      return;
    }

    next();
  };
}

export function createRateLimitMiddleware({
  windowMs = DEFAULT_RATE_LIMIT_WINDOW_MS,
  maxRequests = DEFAULT_RATE_LIMIT_MAX_REQUESTS,
  keyPrefix = "global",
}: RateLimitOptions = {}): RequestHandler {
  return (req, res, next) => {
    const now = Date.now();
    const key = `${keyPrefix}:${readClientIp(req)}`;
    const existingBucket = rateLimitBuckets.get(key);
    const bucket =
      existingBucket && existingBucket.resetAt > now
        ? existingBucket
        : { count: 0, resetAt: now + windowMs };

    bucket.count += 1;
    rateLimitBuckets.set(key, bucket);

    const remaining = Math.max(0, maxRequests - bucket.count);
    res.setHeader("RateLimit-Limit", String(maxRequests));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > maxRequests) {
      res.status(429).json({ error: "Too many requests, please try again later" });
      return;
    }

    next();
  };
}

export function resetRateLimitBucketsForTests() {
  rateLimitBuckets.clear();
}

export function createSensitiveRouteRateLimitMiddleware(): RequestHandler {
  return createRateLimitMiddleware({
    windowMs: 60_000,
    maxRequests: 30,
    keyPrefix: "sensitive",
  });
}

export function createAiRouteRateLimitMiddleware(): RequestHandler {
  return createRateLimitMiddleware({
    windowMs: 60_000,
    maxRequests: 12,
    keyPrefix: "ai",
  });
}

export function isProductionRuntime() {
  return process.env.NODE_ENV === "production";
}

export function getPublicErrorDetails(error: unknown) {
  if (isProductionRuntime()) {
    return undefined;
  }
  return error instanceof Error ? error.message : String(error);
}
