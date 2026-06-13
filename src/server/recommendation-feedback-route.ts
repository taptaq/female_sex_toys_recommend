import {
  isRecommendationRerollReason,
} from "../lib/recommendation-reroll.js";
import type { Request, Response } from "express";

import type {
  RecommendationFeedbackStore,
  SaveRecommendationFeedbackEventInput,
} from "./recommendation-feedback-store.js";

const SUPPORTED_EVENT_TYPES = new Set(["reroll_recommendation"]);
const MAX_RECOMMENDATION_FEEDBACK_JSON_BYTES = 30_000;
const MAX_ANSWER_PATH_ITEMS = 30;

function normalizeEventType(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePageRoute(value: unknown) {
  const pageRoute = typeof value === "string" ? value.trim() : "";
  return pageRoute || "/";
}

function normalizeOptionalText(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function normalizeRerollAttempt(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, Math.round(value))
    : null;
}

function normalizeRerollReason(value: unknown) {
  return isRecommendationRerollReason(value) ? value : null;
}

function normalizeJsonObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeTopProducts(value: unknown) {
  return Array.isArray(value) ? value.slice(0, 10) : [];
}

function normalizeAnswerPath(value: unknown) {
  return Array.isArray(value) ? value.slice(0, MAX_ANSWER_PATH_ITEMS) : [];
}

function exceedsJsonByteLimit(value: unknown, maxBytes: number) {
  return Buffer.byteLength(JSON.stringify(value), "utf8") > maxBytes;
}

function resolveUserAgentHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function createSaveRecommendationFeedbackEventHandler({
  store,
}: {
  store: Pick<RecommendationFeedbackStore, "saveEvent">;
}) {
  return async (req: Request, res: Response) => {
    const requestBody = (req.body ?? {}) as Record<string, unknown>;
    const eventType = normalizeEventType(requestBody.eventType);

    if (!SUPPORTED_EVENT_TYPES.has(eventType)) {
      res.status(400).json({
        error: "Unsupported recommendation feedback event type",
      });
      return;
    }

    const answers = normalizeJsonObject(requestBody.answers);
    if (exceedsJsonByteLimit(answers, MAX_RECOMMENDATION_FEEDBACK_JSON_BYTES)) {
      res.status(413).json({ error: "Recommendation feedback answers are too large" });
      return;
    }

    const input: SaveRecommendationFeedbackEventInput = {
      eventType: eventType as SaveRecommendationFeedbackEventInput["eventType"],
      sessionId: normalizeOptionalText(requestBody.sessionId),
      answers,
      answerPath: normalizeAnswerPath(requestBody.answerPath),
      topProducts: normalizeTopProducts(requestBody.topProducts),
      rerollAttempt: normalizeRerollAttempt(requestBody.rerollAttempt),
      rerollReason: normalizeRerollReason(requestBody.rerollReason),
      resultProvider: normalizeOptionalText(requestBody.resultProvider),
      resultModelName: normalizeOptionalText(requestBody.resultModelName),
      pageRoute: normalizePageRoute(requestBody.pageRoute),
      userAgent: resolveUserAgentHeader(req.headers["user-agent"]),
    };

    try {
      const savedEvent = await store.saveEvent(input);
      res.status(201).json({ id: savedEvent.id });
    } catch (error) {
      console.error("❌ [Server/RecommendationFeedback] 保存推荐反馈事件失败:", error);
      res.status(500).json({
        error: "Recommendation feedback save failed",
        details: getErrorMessage(error),
      });
    }
  };
}
