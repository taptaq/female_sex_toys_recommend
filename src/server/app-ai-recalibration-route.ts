import {
  isRecommendationRerollReason,
} from "../lib/recommendation-reroll.js";
import type { Request, Response } from "express";
import type {
  ResultRecalibrationRequest,
  ResultRecalibrationResponse,
} from "../lib/result-recalibration.js";

type RecalibrationRouteAiService = {
  runResultRecalibration: (
    request: ResultRecalibrationRequest,
  ) => Promise<ResultRecalibrationResponse>;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function createRecalibrateResultsHandler({
  appAiService,
}: {
  appAiService: RecalibrationRouteAiService;
}) {
  return async function recalibrateResultsHandler(req: Request, res: Response) {
    const body = req.body ?? {};

    if (body.strategy != null && body.strategy !== "auto") {
      res.status(400).json({ error: "Only auto recalibration strategy is supported" });
      return;
    }

    if (!body.answers || typeof body.answers !== "object") {
      res.status(400).json({ error: "answers is required" });
      return;
    }

    if (!Array.isArray(body.rerankPool) || body.rerankPool.length === 0) {
      res.status(400).json({ error: "rerankPool is required" });
      return;
    }

    if (!Array.isArray(body.rankedCandidates) || body.rankedCandidates.length === 0) {
      res.status(400).json({ error: "rankedCandidates is required" });
      return;
    }

    try {
      const result = await appAiService.runResultRecalibration({
        answers: body.answers,
        strategy: "auto",
        rerankPool: body.rerankPool,
        rankedCandidates: body.rankedCandidates,
        filteredCount: isFiniteNumber(body.filteredCount) ? body.filteredCount : 0,
        recommendationTips: Array.isArray(body.recommendationTips)
          ? body.recommendationTips
          : [],
        recalibrationContext:
          body.recalibrationContext &&
          typeof body.recalibrationContext === "object"
            ? {
                attemptCount: isFiniteNumber(body.recalibrationContext.attemptCount)
                  ? body.recalibrationContext.attemptCount
                  : 1,
                rerollReason: isRecommendationRerollReason(
                  body.recalibrationContext.rerollReason,
                )
                  ? body.recalibrationContext.rerollReason
                  : undefined,
                currentResultProvider:
                  typeof body.recalibrationContext.currentResultProvider === "string"
                    ? body.recalibrationContext.currentResultProvider
                    : undefined,
                currentResultModelName:
                  typeof body.recalibrationContext.currentResultModelName === "string"
                    ? body.recalibrationContext.currentResultModelName
                    : undefined,
                previousTopProducts: Array.isArray(
                  body.recalibrationContext.previousTopProducts,
                )
                  ? body.recalibrationContext.previousTopProducts
                      .filter(
                        (product: unknown) =>
                          product &&
                          typeof product === "object" &&
                          typeof (product as { id?: unknown }).id === "string",
                      )
                      .map((product: { id: string; reason?: string }) => ({
                        id: product.id,
                        reason: String(product.reason || "").trim(),
                      }))
                  : [],
                previousShoppingGuidanceCount: isFiniteNumber(
                  body.recalibrationContext.previousShoppingGuidanceCount,
                )
                  ? body.recalibrationContext.previousShoppingGuidanceCount
                  : 0,
              }
            : undefined,
      });
      res.json(result);
    } catch (error) {
      console.error("❌ [Server/AI] 结果重校准失败:", error);
      res
        .status(500)
        .json({ error: "AI recalibration failed", details: String(error) });
    }
  };
}
