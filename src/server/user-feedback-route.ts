import crypto from "node:crypto";
import type { Request, Response } from "express";

import type {
  SaveUserFeedbackInput,
  UserFeedbackStore,
  StoredFeedbackScreenshotFile,
} from "./user-feedback-store.js";

const SCREENSHOT_DATA_URL_PATTERN =
  /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_FEEDBACK_MESSAGE_LENGTH = 2_000;
const MAX_SCREENSHOT_DATA_URL_LENGTH = 5_000_000;

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

type FeedbackScreenshotStorage = {
  saveScreenshots: (input: {
    feedbackId: string;
    screenshots: string[];
  }) => Promise<StoredFeedbackScreenshotFile[]>;
};

type FeedbackNotifier = {
  notifyFeedback: (input: {
    id: string;
    message: string;
    pageRoute: string;
    userAgent?: string;
    screenshots: string[];
  }) => Promise<
    | { status: "sent" }
    | { status: "failed"; error: string }
    | { status: "skipped"; reason: string }
  >;
};

function createDefaultFeedbackId() {
  return crypto.randomUUID();
}

async function saveNoopScreenshots({
  screenshots,
}: {
  screenshots: string[];
}): Promise<StoredFeedbackScreenshotFile[]> {
  if (screenshots.length > 0) {
    throw new Error("Feedback screenshot storage is not configured");
  }

  return [];
}

async function notifySkipped() {
  return {
    status: "skipped",
    reason: "Feedback notifier is not configured",
  } as const;
}

async function saveScreenshotsSafely({
  screenshotStorage,
  feedbackId,
  screenshots,
}: {
  screenshotStorage: FeedbackScreenshotStorage;
  feedbackId: string;
  screenshots: string[];
}) {
  try {
    return await screenshotStorage.saveScreenshots({
      feedbackId,
      screenshots,
    });
  } catch (error) {
    console.error("❌ [Server/UserFeedback] 截图存储失败，继续保存文字反馈:", error);
    return [];
  }
}

async function markNotificationStatus({
  store,
  feedbackId,
  notificationResult,
}: {
  store: Partial<
    Pick<
      UserFeedbackStore,
      "markNotificationSent" | "markNotificationFailed" | "markNotificationSkipped"
    >
  >;
  feedbackId: string;
  notificationResult: Awaited<ReturnType<FeedbackNotifier["notifyFeedback"]>>;
}) {
  try {
    if (notificationResult.status === "sent") {
      await store.markNotificationSent?.(feedbackId);
      return;
    }

    if (notificationResult.status === "failed") {
      await store.markNotificationFailed?.(feedbackId, notificationResult.error);
      return;
    }

    await store.markNotificationSkipped?.(feedbackId, notificationResult.reason);
  } catch (error) {
    console.error("❌ [Server/UserFeedback] 更新反馈通知状态失败:", error);
  }
}

export function createSaveUserFeedbackHandler({
  store,
  screenshotStorage = { saveScreenshots: saveNoopScreenshots },
  notifier = { notifyFeedback: notifySkipped },
  createFeedbackId = createDefaultFeedbackId,
}: {
  store: Pick<UserFeedbackStore, "saveFeedback"> &
    Partial<
      Pick<
        UserFeedbackStore,
        "markNotificationSent" | "markNotificationFailed" | "markNotificationSkipped"
      >
    >;
  screenshotStorage?: FeedbackScreenshotStorage;
  notifier?: FeedbackNotifier;
  createFeedbackId?: () => string;
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

    if (message.length > MAX_FEEDBACK_MESSAGE_LENGTH) {
      res.status(413).json({ error: "Feedback message is too large" });
      return;
    }

    if (screenshots.length > 2) {
      res.status(400).json({ error: "At most 2 screenshots are allowed" });
      return;
    }

    if (isInvalidShape) {
      res.status(400).json({ error: "Screenshots must be an array" });
      return;
    }

    if (
      hasInvalidEntry ||
      screenshots.some(
        (screenshot) =>
          screenshot.length > MAX_SCREENSHOT_DATA_URL_LENGTH ||
          !SCREENSHOT_DATA_URL_PATTERN.test(screenshot),
      )
    ) {
      res.status(400).json({
        error: "Only PNG, JPEG, or WebP base64 screenshots are allowed",
      });
      return;
    }

    const feedbackId = createFeedbackId();
    const userAgent = resolveUserAgentHeader(req.headers["user-agent"]);
    const pageRoute = normalizePageRoute(requestBody.pageRoute);

    const input: Omit<SaveUserFeedbackInput, "screenshotFiles"> = {
      id: feedbackId,
      message,
      pageRoute,
      source: "home_feedback",
      userAgent,
    };

    try {
      const screenshotFiles = await saveScreenshotsSafely({
        screenshotStorage,
        feedbackId,
        screenshots,
      });
      const savedFeedback = await store.saveFeedback({
        ...input,
        screenshotFiles,
      });

      const notificationResult = await notifier.notifyFeedback({
        id: savedFeedback.id,
        message,
        pageRoute,
        userAgent,
        screenshots,
      });
      await markNotificationStatus({
        store,
        feedbackId: savedFeedback.id,
        notificationResult,
      });

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
