import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";

import { createSaveUserFeedbackHandler } from "./user-feedback-route.ts";

function createMockRequest({
  headers = {},
  body = {},
}: {
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
}) {
  return { headers, body } as Request;
}

function createMockResponse() {
  let statusCode = 200;
  let jsonPayload: unknown;

  const response = {
    status(code: number) {
      statusCode = code;
      return response;
    },
    json(payload: unknown) {
      jsonPayload = payload;
      return response;
    },
  } as unknown as Response;

  return {
    response,
    readStatusCode() {
      return statusCode;
    },
    readJsonPayload() {
      return jsonPayload;
    },
  };
}

test("save user feedback handler rejects an empty message", async () => {
  let saveCount = 0;
  const handler = createSaveUserFeedbackHandler({
    store: {
      saveFeedback: async () => {
        saveCount += 1;
        return { id: "feedback-1" };
      },
    },
  });

  const mockResponse = createMockResponse();
  await handler(
    createMockRequest({
      body: { message: "   ", screenshots: [] },
    }),
    mockResponse.response,
  );

  assert.equal(saveCount, 0);
  assert.equal(mockResponse.readStatusCode(), 400);
  assert.deepEqual(mockResponse.readJsonPayload(), {
    error: "Feedback message is required",
  });
});

test("save user feedback handler rejects more than 2 screenshots", async () => {
  let saveCount = 0;
  const handler = createSaveUserFeedbackHandler({
    store: {
      saveFeedback: async () => {
        saveCount += 1;
        return { id: "feedback-1" };
      },
    },
  });

  const mockResponse = createMockResponse();
  await handler(
    createMockRequest({
      body: {
        message: "这里有个细节问题",
        screenshots: [
          "data:image/png;base64,aaa",
          "data:image/png;base64,bbb",
          "data:image/png;base64,ccc",
        ],
      },
    }),
    mockResponse.response,
  );

  assert.equal(saveCount, 0);
  assert.equal(mockResponse.readStatusCode(), 400);
  assert.deepEqual(mockResponse.readJsonPayload(), {
    error: "At most 2 screenshots are allowed",
  });
});

test("save user feedback handler rejects invalid screenshot payloads", async () => {
  let saveCount = 0;
  const handler = createSaveUserFeedbackHandler({
    store: {
      saveFeedback: async () => {
        saveCount += 1;
        return { id: "feedback-1" };
      },
    },
  });

  const mockResponse = createMockResponse();
  await handler(
    createMockRequest({
      body: {
        message: "图片格式不对",
        screenshots: ["https://example.com/not-allowed.png"],
      },
    }),
    mockResponse.response,
  );

  assert.equal(saveCount, 0);
  assert.equal(mockResponse.readStatusCode(), 400);
  assert.deepEqual(mockResponse.readJsonPayload(), {
    error: "Only PNG, JPEG, or WebP base64 screenshots are allowed",
  });
});

test("save user feedback handler rejects non-array screenshots payloads", async () => {
  let saveCount = 0;
  const handler = createSaveUserFeedbackHandler({
    store: {
      saveFeedback: async () => {
        saveCount += 1;
        return { id: "feedback-1" };
      },
    },
  });

  const mockResponse = createMockResponse();
  await handler(
    createMockRequest({
      body: {
        message: "screenshots 字段类型不对",
        screenshots: "data:image/png;base64,ZmFrZQ==",
      },
    }),
    mockResponse.response,
  );

  assert.equal(saveCount, 0);
  assert.equal(mockResponse.readStatusCode(), 400);
  assert.deepEqual(mockResponse.readJsonPayload(), {
    error: "Screenshots must be an array",
  });
});

test("save user feedback handler rejects non-string screenshot entries", async () => {
  let saveCount = 0;
  const handler = createSaveUserFeedbackHandler({
    store: {
      saveFeedback: async () => {
        saveCount += 1;
        return { id: "feedback-1" };
      },
    },
  });

  const mockResponse = createMockResponse();
  await handler(
    createMockRequest({
      body: {
        message: "非字符串截图不应该被接受",
        screenshots: [123],
      },
    }),
    mockResponse.response,
  );

  assert.equal(saveCount, 0);
  assert.equal(mockResponse.readStatusCode(), 400);
  assert.deepEqual(mockResponse.readJsonPayload(), {
    error: "Only PNG, JPEG, or WebP base64 screenshots are allowed",
  });
});

test("save user feedback handler rejects screenshots with an empty base64 body", async () => {
  let saveCount = 0;
  const handler = createSaveUserFeedbackHandler({
    store: {
      saveFeedback: async () => {
        saveCount += 1;
        return { id: "feedback-1" };
      },
    },
  });

  const mockResponse = createMockResponse();
  await handler(
    createMockRequest({
      body: {
        message: "base64 内容不能为空",
        screenshots: ["data:image/png;base64,"],
      },
    }),
    mockResponse.response,
  );

  assert.equal(saveCount, 0);
  assert.equal(mockResponse.readStatusCode(), 400);
  assert.deepEqual(mockResponse.readJsonPayload(), {
    error: "Only PNG, JPEG, or WebP base64 screenshots are allowed",
  });
});

test("save user feedback handler rejects blank screenshot entries", async () => {
  let saveCount = 0;
  const handler = createSaveUserFeedbackHandler({
    store: {
      saveFeedback: async () => {
        saveCount += 1;
        return { id: "feedback-1" };
      },
    },
  });

  const mockResponse = createMockResponse();
  await handler(
    createMockRequest({
      body: {
        message: "空白截图不应该被接受",
        screenshots: ["   "],
      },
    }),
    mockResponse.response,
  );

  assert.equal(saveCount, 0);
  assert.equal(mockResponse.readStatusCode(), 400);
  assert.deepEqual(mockResponse.readJsonPayload(), {
    error: "Only PNG, JPEG, or WebP base64 screenshots are allowed",
  });
});

test("save user feedback handler rejects mixed valid and invalid screenshot entries", async () => {
  let saveCount = 0;
  const handler = createSaveUserFeedbackHandler({
    store: {
      saveFeedback: async () => {
        saveCount += 1;
        return { id: "feedback-1" };
      },
    },
  });

  const mockResponse = createMockResponse();
  await handler(
    createMockRequest({
      body: {
        message: "混合无效截图不应该被偷偷过滤",
        screenshots: [
          "data:image/png;base64,ZmFrZS1pbWFnZQ==",
          "   ",
        ],
      },
    }),
    mockResponse.response,
  );

  assert.equal(saveCount, 0);
  assert.equal(mockResponse.readStatusCode(), 400);
  assert.deepEqual(mockResponse.readJsonPayload(), {
    error: "Only PNG, JPEG, or WebP base64 screenshots are allowed",
  });
});

test("save user feedback handler stores normalized anonymous feedback", async () => {
  let captured: unknown;
  let storageInput: unknown;
  let notificationInput: unknown;
  let notificationSentId = "";
  const handler = createSaveUserFeedbackHandler({
    createFeedbackId: () => "11111111-1111-4111-8111-111111111111",
    store: {
      saveFeedback: async (payload) => {
        captured = payload;
        return { id: "11111111-1111-4111-8111-111111111111" };
      },
      markNotificationSent: async (id) => {
        notificationSentId = id;
      },
      markNotificationFailed: async () => {},
      markNotificationSkipped: async () => {},
    },
    screenshotStorage: {
      saveScreenshots: async (input) => {
        storageInput = input;
        return [
          {
            bucket: "feedback-screenshots",
            path: "feedback-submissions/11111111-1111-4111-8111-111111111111/feedback-screenshot-1.jpg",
            filename: "feedback-screenshot-1.jpg",
            mimeType: "image/jpeg",
            sizeBytes: 10,
          },
        ];
      },
    },
    notifier: {
      notifyFeedback: async (input) => {
        notificationInput = input;
        return { status: "sent" };
      },
    },
  });

  const mockResponse = createMockResponse();
  await handler(
    createMockRequest({
      headers: {
        "user-agent": "Mozilla/5.0 FeedbackTest",
      },
      body: {
        message: "  结果页里有一处文案想提个建议  ",
        screenshots: ["data:image/jpeg;base64,ZmFrZS1pbWFnZQ=="],
      },
    }),
    mockResponse.response,
  );

  assert.equal(mockResponse.readStatusCode(), 201);
  assert.deepEqual(mockResponse.readJsonPayload(), {
    id: "11111111-1111-4111-8111-111111111111",
  });
  assert.deepEqual(storageInput, {
    feedbackId: "11111111-1111-4111-8111-111111111111",
    screenshots: ["data:image/jpeg;base64,ZmFrZS1pbWFnZQ=="],
  });
  assert.deepEqual(captured, {
    id: "11111111-1111-4111-8111-111111111111",
    message: "结果页里有一处文案想提个建议",
    screenshotFiles: [
      {
        bucket: "feedback-screenshots",
        path: "feedback-submissions/11111111-1111-4111-8111-111111111111/feedback-screenshot-1.jpg",
        filename: "feedback-screenshot-1.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 10,
      },
    ],
    pageRoute: "/",
    source: "home_feedback",
    userAgent: "Mozilla/5.0 FeedbackTest",
  });
  assert.deepEqual(notificationInput, {
    id: "11111111-1111-4111-8111-111111111111",
    message: "结果页里有一处文案想提个建议",
    pageRoute: "/",
    userAgent: "Mozilla/5.0 FeedbackTest",
    screenshots: ["data:image/jpeg;base64,ZmFrZS1pbWFnZQ=="],
  });
  assert.equal(notificationSentId, "11111111-1111-4111-8111-111111111111");
});

test("save user feedback handler returns success when notification fails after storage", async () => {
  const failedNotifications: Array<{ id: string; error: string }> = [];
  const handler = createSaveUserFeedbackHandler({
    createFeedbackId: () => "22222222-2222-4222-8222-222222222222",
    store: {
      saveFeedback: async () => ({ id: "22222222-2222-4222-8222-222222222222" }),
      markNotificationSent: async () => {},
      markNotificationFailed: async (id, error) => {
        failedNotifications.push({ id, error });
      },
      markNotificationSkipped: async () => {},
    },
    screenshotStorage: {
      saveScreenshots: async () => [],
    },
    notifier: {
      notifyFeedback: async () => ({
        status: "failed",
        error: "domain not verified",
      }),
    },
  });

  const mockResponse = createMockResponse();
  await handler(
    createMockRequest({
      body: {
        message: "邮件失败不影响提交",
      },
    }),
    mockResponse.response,
  );

  assert.equal(mockResponse.readStatusCode(), 201);
  assert.deepEqual(mockResponse.readJsonPayload(), {
    id: "22222222-2222-4222-8222-222222222222",
  });
  assert.deepEqual(failedNotifications, [
    {
      id: "22222222-2222-4222-8222-222222222222",
      error: "domain not verified",
    },
  ]);
});

test("save user feedback handler returns success when screenshot storage fails", async () => {
  const originalConsoleError = console.error;
  const logged: unknown[] = [];
  console.error = (...args: unknown[]) => {
    logged.push(args);
  };

  try {
    let captured: unknown;
    let notificationInput: unknown;
    const handler = createSaveUserFeedbackHandler({
      createFeedbackId: () => "33333333-3333-4333-8333-333333333333",
      store: {
        saveFeedback: async (payload) => {
          captured = payload;
          return { id: "33333333-3333-4333-8333-333333333333" };
        },
        markNotificationSent: async () => {},
        markNotificationFailed: async () => {},
        markNotificationSkipped: async () => {},
      },
      screenshotStorage: {
        saveScreenshots: async () => {
          throw new Error("storage bucket creation failed");
        },
      },
      notifier: {
        notifyFeedback: async (input) => {
          notificationInput = input;
          return { status: "sent" };
        },
      },
    });

    const mockResponse = createMockResponse();
    await handler(
      createMockRequest({
        body: {
          message: "截图存储失败时也要保存反馈",
          screenshots: ["data:image/png;base64,ZmFrZS1pbWFnZQ=="],
        },
      }),
      mockResponse.response,
    );

    assert.equal(mockResponse.readStatusCode(), 201);
    assert.deepEqual(mockResponse.readJsonPayload(), {
      id: "33333333-3333-4333-8333-333333333333",
    });
    assert.deepEqual(captured, {
      id: "33333333-3333-4333-8333-333333333333",
      message: "截图存储失败时也要保存反馈",
      screenshotFiles: [],
      pageRoute: "/",
      source: "home_feedback",
      userAgent: undefined,
    });
    assert.deepEqual(notificationInput, {
      id: "33333333-3333-4333-8333-333333333333",
      message: "截图存储失败时也要保存反馈",
      pageRoute: "/",
      userAgent: undefined,
      screenshots: ["data:image/png;base64,ZmFrZS1pbWFnZQ=="],
    });
    assert.match(JSON.stringify(logged), /截图存储失败/);
  } finally {
    console.error = originalConsoleError;
  }
});

test("save user feedback handler returns store failures", async () => {
  const originalConsoleError = console.error;
  const logged: unknown[] = [];
  console.error = (...args: unknown[]) => {
    logged.push(args);
  };

  try {
    const handler = createSaveUserFeedbackHandler({
      store: {
        saveFeedback: async () => {
          throw new Error("insert failed");
        },
      },
    });

    const mockResponse = createMockResponse();
    await handler(
      createMockRequest({
        body: {
          message: "提交失败测试",
          pageRoute: "/feedback",
        },
      }),
      mockResponse.response,
    );

    assert.equal(mockResponse.readStatusCode(), 500);
    assert.deepEqual(mockResponse.readJsonPayload(), {
      error: "Feedback save failed",
      details: "insert failed",
    });
    assert.match(JSON.stringify(logged), /保存反馈失败/);
  } finally {
    console.error = originalConsoleError;
  }
});
