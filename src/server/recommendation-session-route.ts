import type { Request, Response } from "express";

import type {
  RecommendationSessionPrivatePayload,
  RecommendationSessionStore,
  SaveRecommendationSessionInput,
} from "./recommendation-session-store.js";

const DEFAULT_FLOW_VERSION = "quiz-flow-v1";
const DEFAULT_ALGORITHM_VERSION = "recommendation-v1";
const MAX_RECOMMENDATION_SESSION_JSON_BYTES = 30_000;
const MAX_ANSWER_PATH_ITEMS = 30;
const MAX_TOP_PRODUCTS = 20;

function normalizeRequiredText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalText(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function normalizePageRoute(value: unknown) {
  const pageRoute = typeof value === "string" ? value.trim() : "";
  return pageRoute || "/results";
}

function normalizeJsonObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeJsonArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function exceedsJsonByteLimit(value: unknown, maxBytes: number) {
  return Buffer.byteLength(JSON.stringify(value), "utf8") > maxBytes;
}

function pickPrimitiveObjectValues(input: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input).flatMap(([key, value]) => {
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        value === null
      ) {
        return [[key, value]];
      }

      if (Array.isArray(value)) {
        return [
          [
            key,
            value
              .filter((item) => ["string", "number", "boolean"].includes(typeof item))
              .slice(0, 12),
          ],
        ];
      }

      return [];
    }),
  );
}

function minimizeAnswerPath(answerPath: unknown[]) {
  return answerPath.map((entry) => {
    if (!entry || typeof entry !== "object") {
      return {};
    }

    const typedEntry = entry as Record<string, unknown>;
    return pickPrimitiveObjectValues({
      questionId: typedEntry.questionId,
      optionId: typedEntry.optionId,
      tag: typedEntry.tag,
      label: typedEntry.label,
    });
  });
}

function minimizeTopProducts(topProducts: unknown[]) {
  return topProducts.map((product) => {
    if (!product || typeof product !== "object") {
      return {};
    }

    const typedProduct = product as Record<string, unknown>;
    return pickPrimitiveObjectValues({
      id: typedProduct.id,
      originalId: typedProduct.originalId,
      brand: typedProduct.brand,
      typeCode: typedProduct.typeCode,
      subtypeCode: typedProduct.subtypeCode,
      score: typedProduct.score,
    });
  });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function createSaveRecommendationSessionHandler({
  store,
}: {
  store: Pick<RecommendationSessionStore, "saveSession">;
}) {
  return async (req: Request, res: Response) => {
    const requestBody = (req.body ?? {}) as Record<string, unknown>;
    const sessionId = normalizeRequiredText(requestBody.sessionId);

    if (!sessionId) {
      res.status(400).json({ error: "Recommendation session id is required" });
      return;
    }

    const answers = normalizeJsonObject(requestBody.answers);
    const answerPath = normalizeJsonArray(requestBody.answerPath).slice(
      0,
      MAX_ANSWER_PATH_ITEMS,
    );
    const topProducts = normalizeJsonArray(requestBody.topProducts).slice(
      0,
      MAX_TOP_PRODUCTS,
    );

    if (exceedsJsonByteLimit(answers, MAX_RECOMMENDATION_SESSION_JSON_BYTES)) {
      res.status(413).json({ error: "Recommendation answers are too large" });
      return;
    }

    const privatePayload: RecommendationSessionPrivatePayload = {
      answers,
      answerPath,
      topProducts,
    };

    const input: SaveRecommendationSessionInput = {
      sessionId,
      answers: pickPrimitiveObjectValues(answers),
      answerPath: minimizeAnswerPath(answerPath),
      topProducts: minimizeTopProducts(topProducts),
      flowVersion:
        normalizeOptionalText(requestBody.flowVersion) ?? DEFAULT_FLOW_VERSION,
      algorithmVersion:
        normalizeOptionalText(requestBody.algorithmVersion) ??
        DEFAULT_ALGORITHM_VERSION,
      resultProvider: normalizeOptionalText(requestBody.resultProvider),
      resultModelName: normalizeOptionalText(requestBody.resultModelName),
      pageRoute: normalizePageRoute(requestBody.pageRoute),
      privatePayload,
    };

    try {
      const savedSession = await store.saveSession(input);
      res.status(201).json({ id: savedSession.id });
    } catch (error) {
      console.error("❌ [Server/RecommendationSession] 保存推荐会话失败:", error);
      res.status(500).json({
        error: "Recommendation session save failed",
        details: getErrorMessage(error),
      });
    }
  };
}
