import type { Request, Response } from "express";
import { getResultModelOption } from "../lib/result-models.ts";
import type {
  ResultRecalibrationRequest,
  ResultRecalibrationResponse,
} from "../lib/result-recalibration.ts";

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
    const targetProvider = getResultModelOption(
      String(body.targetProvider || ""),
    )?.provider;

    if (!targetProvider) {
      res.status(400).json({ error: "A valid targetProvider is required" });
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
        targetProvider,
        rerankPool: body.rerankPool,
        rankedCandidates: body.rankedCandidates,
        filteredCount: isFiniteNumber(body.filteredCount) ? body.filteredCount : 0,
        recommendationTips: Array.isArray(body.recommendationTips)
          ? body.recommendationTips
          : [],
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
