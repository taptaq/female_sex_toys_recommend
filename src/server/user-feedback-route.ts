import type { Request, Response } from "express";

import type {
  SaveUserFeedbackInput,
  UserFeedbackStore,
} from "./user-feedback-store.ts";

const SCREENSHOT_DATA_URL_PATTERN =
  /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

function normalizeMessage(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePageRoute(value: unknown) {
  const pageRoute = typeof value === "string" ? value.trim() : "";
  return pageRoute || "/";
}

function readScreenshots(value: unknown) {
  if (typeof value === "undefined") {
    return { screenshots: [], hasInvalidEntry: false };
  }

  if (!Array.isArray(value)) {
    return { screenshots: [], hasInvalidEntry: true, isInvalidShape: true };
  }

  const screenshots: string[] = [];
  let hasInvalidEntry = false;

  for (const item of value) {
    if (typeof item !== "string") {
      hasInvalidEntry = true;
      continue;
    }

    const normalizedItem = item.trim();
    if (!normalizedItem) {
      hasInvalidEntry = true;
      continue;
    }

    screenshots.push(normalizedItem);
  }

  return { screenshots, hasInvalidEntry, isInvalidShape: false };
}

function resolveUserAgentHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function createSaveUserFeedbackHandler({
  store,
}: {
  store: Pick<UserFeedbackStore, "saveFeedback">;
}) {
  return async (req: Request, res: Response) => {
    const requestBody = (req.body ?? {}) as Record<string, unknown>;
    const message = normalizeMessage(requestBody.message);
    const { screenshots, hasInvalidEntry, isInvalidShape } = readScreenshots(
      requestBody.screenshots,
    );

    if (!message) {
      res.status(400).json({ error: "Feedback message is required" });
      return;
    }

    if (screenshots.length > 3) {
      res.status(400).json({ error: "At most 3 screenshots are allowed" });
      return;
    }

    if (isInvalidShape) {
      res.status(400).json({ error: "Screenshots must be an array" });
      return;
    }

    if (
      hasInvalidEntry ||
      screenshots.some(
        (screenshot) => !SCREENSHOT_DATA_URL_PATTERN.test(screenshot),
      )
    ) {
      res.status(400).json({
        error: "Only PNG, JPEG, or WebP base64 screenshots are allowed",
      });
      return;
    }

    const input: SaveUserFeedbackInput = {
      message,
      screenshots,
      pageRoute: normalizePageRoute(requestBody.pageRoute),
      userAgent: resolveUserAgentHeader(req.headers["user-agent"]),
    };

    try {
      const savedFeedback = await store.saveFeedback(input);
      res.status(201).json({ id: savedFeedback.id });
    } catch (error) {
      console.error("❌ [Server/UserFeedback] 保存反馈失败:", error);
      res.status(500).json({
        error: "Feedback save failed",
        details: getErrorMessage(error),
      });
    }
  };
}
