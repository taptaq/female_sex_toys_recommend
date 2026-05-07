type ApiErrorPayload = {
  error?: string;
  details?: string;
};

type SubmitHomeFeedbackInput = {
  message: string;
  screenshots: string[];
  pageRoute: string;
  fetcher?: typeof fetch;
};

type SubmitHomeFeedbackResponse = {
  id: string;
};

async function readApiErrorMessage(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
  const detail = payload?.details || payload?.error;
  return detail ? `${fallback}：${detail}` : fallback;
}

async function readSubmitHomeFeedbackResponse(
  response: Response,
  fallback: string,
): Promise<SubmitHomeFeedbackResponse> {
  const payload = (await response.json().catch(() => null)) as { id?: unknown } | null;

  if (!payload || typeof payload.id !== "string") {
    throw new Error(fallback);
  }

  return { id: payload.id };
}

export async function submitHomeFeedback({
  message,
  screenshots,
  pageRoute,
  fetcher = fetch,
}: SubmitHomeFeedbackInput) {
  const response = await fetcher("/api/feedback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      screenshots,
      pageRoute,
    }),
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, "提交反馈失败，请稍后重试"));
  }

  return await readSubmitHomeFeedbackResponse(response, "提交反馈失败，请稍后重试");
}
