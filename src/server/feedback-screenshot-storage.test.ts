import assert from "node:assert/strict";
import test from "node:test";

import {
  createFeedbackScreenshotStorage,
  parseFeedbackScreenshotDataUrl,
} from "./feedback-screenshot-storage.ts";

test("parseFeedbackScreenshotDataUrl extracts mime type, base64 body, and attachment filename", () => {
  const parsed = parseFeedbackScreenshotDataUrl(
    "data:image/jpeg;base64,ZmFrZS1qcGVn",
    0,
  );

  assert.equal(parsed.mimeType, "image/jpeg");
  assert.equal(parsed.extension, "jpg");
  assert.equal(parsed.filename, "feedback-screenshot-1.jpg");
  assert.equal(parsed.base64Content, "ZmFrZS1qcGVn");
  assert.equal(parsed.sizeBytes, Buffer.from("ZmFrZS1qcGVn", "base64").byteLength);
});

test("feedback screenshot storage uploads screenshots to a private feedback path", async () => {
  const createdBuckets: Array<{ bucket: string; options: { public?: boolean } }> = [];
  const uploads: Array<{
    bucket: string;
    path: string;
    bytes: Buffer;
    options: { contentType?: string; upsert?: boolean };
  }> = [];
  const storage = createFeedbackScreenshotStorage({
    bucket: "feedback-screenshots",
    client: {
      storage: {
        async createBucket(bucket: string, options: { public?: boolean }) {
          createdBuckets.push({ bucket, options });
          return { data: { name: bucket }, error: null };
        },
        from(bucket: string) {
          return {
            async upload(
              path: string,
              bytes: Buffer,
              options: { contentType?: string; upsert?: boolean },
            ) {
              uploads.push({ bucket, path, bytes, options });
              return { data: { path }, error: null };
            },
          };
        },
      },
    },
  });

  const files = await storage.saveScreenshots({
    feedbackId: "11111111-1111-4111-8111-111111111111",
    screenshots: [
      "data:image/png;base64,ZmFrZS1wbmc=",
      "data:image/webp;base64,ZmFrZS13ZWJw",
    ],
  });

  assert.deepEqual(createdBuckets, [
    {
      bucket: "feedback-screenshots",
      options: { public: false },
    },
  ]);
  assert.deepEqual(
    uploads.map((upload) => ({
      bucket: upload.bucket,
      path: upload.path,
      contentType: upload.options.contentType,
      upsert: upload.options.upsert,
    })),
    [
      {
        bucket: "feedback-screenshots",
        path: "feedback-submissions/11111111-1111-4111-8111-111111111111/feedback-screenshot-1.png",
        contentType: "image/png",
        upsert: false,
      },
      {
        bucket: "feedback-screenshots",
        path: "feedback-submissions/11111111-1111-4111-8111-111111111111/feedback-screenshot-2.webp",
        contentType: "image/webp",
        upsert: false,
      },
    ],
  );
  assert.deepEqual(files, [
    {
      bucket: "feedback-screenshots",
      path: "feedback-submissions/11111111-1111-4111-8111-111111111111/feedback-screenshot-1.png",
      filename: "feedback-screenshot-1.png",
      mimeType: "image/png",
      sizeBytes: Buffer.from("ZmFrZS1wbmc=", "base64").byteLength,
    },
    {
      bucket: "feedback-screenshots",
      path: "feedback-submissions/11111111-1111-4111-8111-111111111111/feedback-screenshot-2.webp",
      filename: "feedback-screenshot-2.webp",
      mimeType: "image/webp",
      sizeBytes: Buffer.from("ZmFrZS13ZWJw", "base64").byteLength,
    },
  ]);
});

test("feedback screenshot storage continues when the private bucket already exists", async () => {
  const storage = createFeedbackScreenshotStorage({
    bucket: "feedback-screenshots",
    client: {
      storage: {
        async createBucket() {
          return {
            data: null,
            error: { message: "Bucket already exists" },
          };
        },
        from() {
          return {
            async upload(path: string) {
              return { data: { path }, error: null };
            },
          };
        },
      },
    },
  });

  await assert.doesNotReject(() =>
    storage.saveScreenshots({
      feedbackId: "11111111-1111-4111-8111-111111111111",
      screenshots: ["data:image/png;base64,ZmFrZQ=="],
    }),
  );
});

test("feedback screenshot storage requires Supabase storage configuration when screenshots exist", async () => {
  const storage = createFeedbackScreenshotStorage({});

  await assert.rejects(
    () =>
      storage.saveScreenshots({
        feedbackId: "11111111-1111-4111-8111-111111111111",
        screenshots: ["data:image/png;base64,ZmFrZQ=="],
      }),
    /Supabase storage configuration is missing/,
  );
});
