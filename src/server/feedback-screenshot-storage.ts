import { createClient } from "@supabase/supabase-js";

import type { StoredFeedbackScreenshotFile } from "./user-feedback-store.js";

type SupabaseStorageBucket = {
  upload: (
    path: string,
    body: Buffer,
    options?: { contentType?: string; upsert?: boolean },
  ) => Promise<{ data: unknown; error: { message?: string } | null }>;
};

type SupabaseStorageClient = {
  storage: {
    createBucket?: (
      bucket: string,
      options?: { public?: boolean },
    ) => Promise<{ data: unknown; error: { message?: string } | null }>;
    from: (bucket: string) => SupabaseStorageBucket;
  };
};

export type ParsedFeedbackScreenshot = {
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  extension: "png" | "jpg" | "webp";
  filename: string;
  base64Content: string;
  bytes: Buffer;
  sizeBytes: number;
};

const FEEDBACK_SCREENSHOT_DATA_URL_PATTERN =
  /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;

function getScreenshotExtension(mimeType: ParsedFeedbackScreenshot["mimeType"]) {
  return mimeType === "image/jpeg" ? "jpg" : mimeType.replace("image/", "");
}

export function parseFeedbackScreenshotDataUrl(
  screenshot: string,
  index: number,
): ParsedFeedbackScreenshot {
  const match = screenshot.match(FEEDBACK_SCREENSHOT_DATA_URL_PATTERN);
  if (!match) {
    throw new Error("Invalid feedback screenshot data URL");
  }

  const mimeType = match[1] as ParsedFeedbackScreenshot["mimeType"];
  const base64Content = match[2];
  const extension = getScreenshotExtension(mimeType) as ParsedFeedbackScreenshot["extension"];
  const bytes = Buffer.from(base64Content, "base64");

  return {
    mimeType,
    extension,
    filename: `feedback-screenshot-${index + 1}.${extension}`,
    base64Content,
    bytes,
    sizeBytes: bytes.byteLength,
  };
}

export function createFeedbackScreenshotStorage({
  supabaseUrl,
  serviceRoleKey,
  bucket = "feedback-screenshots",
  client,
}: {
  supabaseUrl?: string;
  serviceRoleKey?: string;
  bucket?: string;
  client?: SupabaseStorageClient;
}) {
  const configuredClient =
    client ??
    (supabaseUrl && serviceRoleKey
      ? createClient(supabaseUrl, serviceRoleKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        })
      : null);

  async function ensurePrivateBucket() {
    if (!configuredClient?.storage.createBucket) {
      return;
    }

    const { error } = await configuredClient.storage.createBucket(bucket, {
      public: false,
    });

    if (!error) {
      return;
    }

    const message = error.message || "";
    if (/already exists|already owned|duplicate/i.test(message)) {
      return;
    }

    throw new Error(message || "Feedback screenshot bucket creation failed");
  }

  return {
    async saveScreenshots({
      feedbackId,
      screenshots,
    }: {
      feedbackId: string;
      screenshots: string[];
    }): Promise<StoredFeedbackScreenshotFile[]> {
      if (screenshots.length === 0) {
        return [];
      }

      if (!configuredClient) {
        throw new Error("Supabase storage configuration is missing");
      }

      await ensurePrivateBucket();
      const storageBucket = configuredClient.storage.from(bucket);
      const savedFiles: StoredFeedbackScreenshotFile[] = [];

      for (const [index, screenshot] of screenshots.entries()) {
        const parsed = parseFeedbackScreenshotDataUrl(screenshot, index);
        const path = `feedback-submissions/${feedbackId}/${parsed.filename}`;
        const { error } = await storageBucket.upload(path, parsed.bytes, {
          contentType: parsed.mimeType,
          upsert: false,
        });

        if (error) {
          throw new Error(error.message || "Feedback screenshot upload failed");
        }

        savedFiles.push({
          bucket,
          path,
          filename: parsed.filename,
          mimeType: parsed.mimeType,
          sizeBytes: parsed.sizeBytes,
        });
      }

      return savedFiles;
    },
  };
}
