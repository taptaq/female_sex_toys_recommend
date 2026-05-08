import express from "express";
import dotenv from "dotenv";
import pg from "pg";
import type { RequestHandler } from "express";

import { createRecalibrateResultsHandler } from "./app-ai-recalibration-route.js";
import { createAppAiService } from "./app-ai-service.js";
import {
  createKnowledgeNebulaCreateCardHandler,
  createKnowledgeNebulaRecordCardViewHandler,
  createKnowledgeNebulaTopicHandler,
  createKnowledgeNebulaUpdateCardHandler,
} from "./knowledge-nebula-route.js";
import { createKnowledgeEmbeddingService } from "./knowledge-embedding-service.js";
import {
  createKnowledgeNebulaStore,
  ensureKnowledgeNebulaSchema,
} from "./knowledge-nebula-store.js";
import { ensureRecommenderItemsSchema } from "./recommender-items-schema.js";
import { createListRecommenderToysHandler } from "./recommender-toys-route.js";
import {
  createLazyValue,
  createLazyRouteInitializer,
  getRequiredServerEnv,
} from "./server-runtime.js";
import { createSupabaseAccessTokenVerifier } from "./user-auth.js";
import { createSaveUserFeedbackHandler } from "./user-feedback-route.js";
import {
  createUserFeedbackStore,
  ensureUserFeedbackSchema,
} from "./user-feedback-store.js";
import {
  createListUserRecommendationProfilesHandler,
  createSaveUserRecommendationProfileHandler,
} from "./user-recommendation-route.js";
import {
  createUserRecommendationStore,
  ensureUserRecommendationSchema,
} from "./user-recommendation-store.js";
import { createUsernameRegistrationHandler } from "./user-register-route.js";
import { createUsernameRegistrationService } from "./user-register-service.js";

dotenv.config();

const { Pool } = pg;
const app = express();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

const ensureRouteInitialized = createLazyRouteInitializer();
const getAppAiService = createLazyValue(() => createAppAiService());
const getRecalibrateResultsHandler = createLazyValue(() =>
  createRecalibrateResultsHandler({
    appAiService: getAppAiService(),
  }),
);
const getKnowledgeEmbeddingService = createLazyValue(() =>
  createKnowledgeEmbeddingService(),
);
const getKnowledgeNebulaStore = createLazyValue(() =>
  createKnowledgeNebulaStore({
    pool,
    embeddingService: getKnowledgeEmbeddingService(),
  }),
);
const getKnowledgeTopicHandler = createLazyValue(() =>
  createKnowledgeNebulaTopicHandler({ store: getKnowledgeNebulaStore() }),
);
const getKnowledgeCreateCardHandler = createLazyValue(() =>
  createKnowledgeNebulaCreateCardHandler({ store: getKnowledgeNebulaStore() }),
);
const getKnowledgeUpdateCardHandler = createLazyValue(() =>
  createKnowledgeNebulaUpdateCardHandler({ store: getKnowledgeNebulaStore() }),
);
const getKnowledgeRecordCardViewHandler = createLazyValue(() =>
  createKnowledgeNebulaRecordCardViewHandler({ store: getKnowledgeNebulaStore() }),
);
const getUserRecommendationStore = createLazyValue(() =>
  createUserRecommendationStore({ pool }),
);
const getUserFeedbackStore = createLazyValue(() =>
  createUserFeedbackStore({ pool }),
);
const getUsernameRegistrationService = createLazyValue(() =>
  createUsernameRegistrationService({
    supabaseUrl: process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  }),
);
const getSupabaseAccessTokenVerifier = createLazyValue(() =>
  createSupabaseAccessTokenVerifier({
    supabaseUrl: process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  }),
);
const getRegisterUsernameHandler = createLazyValue(() =>
  createUsernameRegistrationHandler({
    service: getUsernameRegistrationService(),
  }),
);
const getSaveUserFeedbackHandler = createLazyValue(() =>
  createSaveUserFeedbackHandler({
    store: getUserFeedbackStore(),
  }),
);
const getSaveRecommendationProfileHandler = createLazyValue(() =>
  createSaveUserRecommendationProfileHandler({
    encryptionKey: process.env.PRIVATE_DATA_ENCRYPTION_KEY,
    jwtSecret: process.env.JWT_SECRET,
    authVerifier: getSupabaseAccessTokenVerifier(),
    store: getUserRecommendationStore(),
  }),
);
const getListRecommendationProfilesHandler = createLazyValue(() =>
  createListUserRecommendationProfilesHandler({
    encryptionKey: process.env.PRIVATE_DATA_ENCRYPTION_KEY,
    jwtSecret: process.env.JWT_SECRET,
    authVerifier: getSupabaseAccessTokenVerifier(),
    store: getUserRecommendationStore(),
  }),
);

app.use(express.json({ limit: "1mb" }));

pool.on("error", (error) => {
  console.error("💥 [Server/DB] 数据库连接池发生灾难性错误:", error);
});

function ensureDatabaseConfigured() {
  getRequiredServerEnv("DATABASE_URL");
}

function withRouteInitialization(
  ensureReady: () => Promise<void>,
  handler: RequestHandler,
): RequestHandler {
  return async (req, res, next) => {
    try {
      await ensureReady();
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

function withLazyRouteHandler(
  ensureReady: () => Promise<void>,
  getHandler: () => RequestHandler,
): RequestHandler {
  return withRouteInitialization(ensureReady, (req, res, next) =>
    getHandler()(req, res, next),
  );
}

function ensureLibraryRouteReady() {
  return ensureRouteInitialized("library", async () => {
    ensureDatabaseConfigured();
    await ensureRecommenderItemsSchema(pool);
  });
}

function ensureKnowledgeRouteReady() {
  return ensureRouteInitialized("knowledge", async () => {
    ensureDatabaseConfigured();
    await ensureKnowledgeNebulaSchema(pool);
  });
}

function ensureFeedbackRouteReady() {
  return ensureRouteInitialized("feedback", async () => {
    ensureDatabaseConfigured();
    await ensureUserFeedbackSchema(pool);
  });
}

function ensureUserRecommendationRouteReady() {
  return ensureRouteInitialized("user-recommendation", async () => {
    ensureDatabaseConfigured();
    await ensureUserRecommendationSchema(pool);
  });
}

app.get(
  "/api/recommender/toys",
  createListRecommenderToysHandler({
    pool,
    ensureLibraryRouteReady,
  }),
);

app.post("/api/ai/rerank", async (req, res) => {
  const prompt = String(req.body?.prompt || "").trim();
  if (!prompt) {
    res.status(400).json({ error: "Prompt is required" });
    return;
  }

  try {
    const result = await getAppAiService().runServerAiProxy<unknown[]>({
      prompt,
      temperature: 0.1,
      emptyJson: "[]",
      logContext: "Top3 重排",
    });
    res.json(result);
  } catch (error) {
    console.error("❌ [Server/AI] Top3 重排链路全部中断:", error);
    res.status(500).json({ error: "AI rerank failed", details: String(error) });
  }
});

app.post("/api/ai/result-enhancement", async (req, res) => {
  const prompt = String(req.body?.prompt || "").trim();
  if (!prompt) {
    res.status(400).json({ error: "Prompt is required" });
    return;
  }

  try {
    const result = await getAppAiService().runServerAiProxy<Record<string, unknown>>({
      prompt,
      temperature: 0.3,
      emptyJson: "{}",
      logContext: "结果增强",
    });
    res.json(result);
  } catch (error) {
    console.error("❌ [Server/AI] 结果增强链路全部中断:", error);
    res.status(500).json({
      error: "AI result enhancement failed",
      details: String(error),
    });
  }
});

app.post("/api/ai/recalibrate-results", (req, res) =>
  getRecalibrateResultsHandler()(req, res),
);
app.post(
  "/api/auth/register",
  (req, res) => getRegisterUsernameHandler()(req, res),
);
app.get(
  "/api/knowledge/topics/:slug",
  withLazyRouteHandler(
    ensureKnowledgeRouteReady,
    getKnowledgeTopicHandler,
  ),
);
app.post(
  "/api/knowledge/topics/:slug/cards",
  withLazyRouteHandler(
    ensureKnowledgeRouteReady,
    getKnowledgeCreateCardHandler,
  ),
);
app.patch(
  "/api/knowledge/cards/:cardId",
  withLazyRouteHandler(
    ensureKnowledgeRouteReady,
    getKnowledgeUpdateCardHandler,
  ),
);
app.post(
  "/api/knowledge/cards/:cardId/view",
  withLazyRouteHandler(
    ensureKnowledgeRouteReady,
    getKnowledgeRecordCardViewHandler,
  ),
);
app.post(
  "/api/feedback",
  withLazyRouteHandler(
    ensureFeedbackRouteReady,
    getSaveUserFeedbackHandler,
  ),
);
app.post(
  "/api/user/recommendation-profiles",
  withLazyRouteHandler(
    ensureUserRecommendationRouteReady,
    getSaveRecommendationProfileHandler,
  ),
);
app.get(
  "/api/user/recommendation-profiles",
  withLazyRouteHandler(
    ensureUserRecommendationRouteReady,
    getListRecommendationProfilesHandler,
  ),
);

export function ensureServerReady() {
  return Promise.resolve().then(() => {
    ensureDatabaseConfigured();
    console.log("🪐 [Server] 后端运行时配置已就绪");
  });
}

app.use(((error, _req, res, _next) => {
  console.error("💥 [Server] 路由初始化或处理中断:", error);

  if (res.headersSent) {
    return;
  }

  res.status(500).json({
    error: "Server request failed",
    details: error instanceof Error ? error.message : String(error),
  });
}) as RequestHandler);

export { app, pool };
