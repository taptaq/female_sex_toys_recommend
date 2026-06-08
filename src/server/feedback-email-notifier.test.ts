import assert from "node:assert/strict";
import test from "node:test";

import { createFeedbackEmailNotifier } from "./feedback-email-notifier.ts";

test("feedback email notifier sends Resend email with screenshot attachments to the configured owner mailbox", async () => {
  let capturedUrl = "";
  let capturedRequest: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {};
  const notifier = createFeedbackEmailNotifier({
    apiKey: "resend-key",
    from: "Luna Feedback <feedback@example.com>",
    fetcher: async (url, init) => {
      capturedUrl = String(url);
      capturedRequest = init as typeof capturedRequest;
      return {
        ok: true,
        json: async () => ({ id: "email-1" }),
        text: async () => "",
      } as Response;
    },
  });

  const result = await notifier.notifyFeedback({
    id: "11111111-1111-4111-8111-111111111111",
    message: "截图里的上传区太高了",
    pageRoute: "/",
    userAgent: "feedback-bot/1.0",
    screenshots: [
      "data:image/png;base64,ZmFrZS1wbmc=",
      "data:image/jpeg;base64,ZmFrZS1qcGVn",
    ],
  });

  const body = JSON.parse(capturedRequest.body || "{}") as {
    from?: string;
    to?: string[];
    subject?: string;
    html?: string;
    attachments?: Array<{ filename: string; content: string }>;
  };

  assert.deepEqual(result, { status: "sent" });
  assert.equal(capturedUrl, "https://api.resend.com/emails");
  assert.equal(capturedRequest.method, "POST");
  assert.equal(capturedRequest.headers?.Authorization, "Bearer resend-key");
  assert.equal(body.from, "Luna Feedback <feedback@example.com>");
  assert.deepEqual(body.to, ["2902716634@qq.com"]);
  assert.match(body.subject || "", /Luna 新反馈/);
  assert.match(body.html || "", /截图里的上传区太高了/);
  assert.match(body.html || "", /feedback-bot\/1\.0/);
  assert.deepEqual(body.attachments, [
    {
      filename: "feedback-screenshot-1.png",
      content: "ZmFrZS1wbmc=",
    },
    {
      filename: "feedback-screenshot-2.jpg",
      content: "ZmFrZS1qcGVn",
    },
  ]);
});

test("feedback email notifier sends SMTP email with screenshot attachments when SMTP is configured", async () => {
  let capturedTransportOptions: unknown;
  let capturedMessage: unknown;
  const notifier = createFeedbackEmailNotifier({
    provider: "smtp",
    to: "owner@example.com",
    from: "Luna Feedback <feedback@example.com>",
    smtp: {
      host: "smtp.qq.com",
      port: 465,
      user: "feedback@example.com",
      pass: "smtp-auth-code",
    },
    createSmtpTransport: (options) => {
      capturedTransportOptions = options;
      return {
        async sendMail(message) {
          capturedMessage = message;
        },
      };
    },
  });

  const result = await notifier.notifyFeedback({
    id: "11111111-1111-4111-8111-111111111111",
    message: "SMTP 可以收到截图",
    pageRoute: "/library",
    userAgent: "feedback-bot/1.0",
    screenshots: ["data:image/png;base64,ZmFrZS1wbmc="],
  });

  assert.deepEqual(result, { status: "sent" });
  assert.deepEqual(capturedTransportOptions, {
    host: "smtp.qq.com",
    port: 465,
    secure: true,
    auth: {
      user: "feedback@example.com",
      pass: "smtp-auth-code",
    },
  });
  const message = capturedMessage as {
    from?: string;
    to?: string;
    subject?: string;
    html?: string;
    attachments?: Array<{
      filename: string;
      content: string;
      encoding: string;
    }>;
  };
  assert.equal(message.from, "Luna Feedback <feedback@example.com>");
  assert.equal(message.to, "owner@example.com");
  assert.equal(message.subject, "Luna 新反馈：/library");
  assert.match(message.html || "", /SMTP 可以收到截图/);
  assert.deepEqual(message.attachments, [
    {
      filename: "feedback-screenshot-1.png",
      content: "ZmFrZS1wbmc=",
      encoding: "base64",
    },
  ]);
});

test("feedback email notifier skips notification when Resend api key is missing", async () => {
  let fetchCount = 0;
  const notifier = createFeedbackEmailNotifier({
    apiKey: "",
    from: "Luna Feedback <feedback@example.com>",
    fetcher: async () => {
      fetchCount += 1;
      return {
        ok: true,
        json: async () => ({}),
        text: async () => "",
      } as Response;
    },
  });

  const result = await notifier.notifyFeedback({
    id: "11111111-1111-4111-8111-111111111111",
    message: "没有配置邮件 key",
    pageRoute: "/",
    screenshots: [],
  });

  assert.equal(fetchCount, 0);
  assert.deepEqual(result, {
    status: "skipped",
    reason: "RESEND_API_KEY is not configured",
  });
});

test("feedback email notifier returns a failed status when Resend rejects the message", async () => {
  const notifier = createFeedbackEmailNotifier({
    apiKey: "resend-key",
    from: "Luna Feedback <feedback@example.com>",
    fetcher: async () =>
      ({
        ok: false,
        json: async () => ({ message: "domain not verified" }),
        text: async () => "domain not verified",
      }) as Response,
  });

  const result = await notifier.notifyFeedback({
    id: "11111111-1111-4111-8111-111111111111",
    message: "邮件失败也不能影响提交",
    pageRoute: "/",
    screenshots: [],
  });

  assert.deepEqual(result, {
    status: "failed",
    error: "domain not verified",
  });
});

test("feedback email notifier returns a failed status when the Resend request throws", async () => {
  const notifier = createFeedbackEmailNotifier({
    apiKey: "resend-key",
    from: "Luna Feedback <feedback@example.com>",
    fetcher: async () => {
      throw new Error("network timeout");
    },
  });

  const result = await notifier.notifyFeedback({
    id: "11111111-1111-4111-8111-111111111111",
    message: "网络异常也不能影响提交",
    pageRoute: "/",
    screenshots: [],
  });

  assert.deepEqual(result, {
    status: "failed",
    error: "network timeout",
  });
});
