import type { RecommendationRerollReason } from "./recommendation-reroll.ts";

type ApiErrorPayload = {
  error?: string;
  details?: string;
};

export type RecommendationFeedbackEventType = "reroll_recommendation";

export type SubmitRecommendationFeedbackEventInput = {
  eventType: RecommendationFeedbackEventType;
  sessionId?: string | null;
  answers: Record<string, unknown>;
  answerPath?: unknown[];
  topProducts: unknown[];
  rerollAttempt?: number | null;
  rerollReason?: RecommendationRerollReason | null;
  resultProvider?: string | null;
  resultModelName?: string | null;
  pageRoute: string;
  fetcher?: typeof fetch;
};

type SubmitRecommendationFeedbackEventResponse = {
  id: string;
};

async function readApiErrorMessage(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
  const detail = payload?.details || payload?.error;
  return detail ? `${fallback}：${detail}` : fallback;
}

async function readSubmitRecommendationFeedbackEventResponse(
  response: Response,
  fallback: string,
): Promise<SubmitRecommendationFeedbackEventResponse> {
  const payload = (await response.json().catch(() => null)) as { id?: unknown } | null;

  if (!payload || typeof payload.id !== "string") {
    throw new Error(fallback);
  }

  return { id: payload.id };
}

export async function submitRecommendationFeedbackEvent({
  eventType,
  sessionId,
  answers,
  answerPath,
  topProducts,
  rerollAttempt,
  rerollReason,
  resultProvider,
  resultModelName,
  pageRoute,
  fetcher = fetch,
}: SubmitRecommendationFeedbackEventInput) {
  const response = await fetcher("/api/recommendation-feedback/events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      eventType,
      sessionId,
      answers,
      answerPath,
      topProducts,
      rerollAttempt,
      rerollReason,
      resultProvider,
      resultModelName,
      pageRoute,
    }),
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, "记录推荐反馈失败"));
  }

  return await readSubmitRecommendationFeedbackEventResponse(
    response,
    "记录推荐反馈失败",
  );
}
