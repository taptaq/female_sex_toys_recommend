import { parseFeedbackScreenshotDataUrl } from "./feedback-screenshot-storage.js";
import net from "node:net";
import tls from "node:tls";

type FeedbackNotificationInput = {
  id: string;
  message: string;
  pageRoute: string;
  userAgent?: string;
  screenshots: string[];
};

type FeedbackNotificationResult =
  | { status: "sent" }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

type Fetcher = typeof fetch;
type FeedbackEmailProvider = "resend" | "smtp";
type SmtpConfig = {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  secure?: boolean;
};
type SmtpTransportOptions = {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
};
type SmtpMailMessage = {
  from: string;
  to: string;
  subject: string;
  html: string;
  attachments: Array<{
    filename: string;
    content: string;
    encoding: "base64";
  }>;
};
type SmtpTransport = {
  sendMail(message: SmtpMailMessage): Promise<void>;
};
type CreateSmtpTransport = (options: SmtpTransportOptions) => SmtpTransport;

const DEFAULT_FEEDBACK_NOTIFY_TO = "2902716634@qq.com";
const DEFAULT_FEEDBACK_NOTIFY_FROM = "Luna Feedback <onboarding@resend.dev>";
const DEFAULT_SMTP_PORT = 465;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function readResendError(response: Response) {
  const payload = (await response.json().catch(() => null)) as {
    message?: unknown;
    error?: unknown;
  } | null;
  const message = payload?.message || payload?.error;
  if (typeof message === "string" && message.trim()) {
    return message;
  }

  const text = await response.text().catch(() => "");
  return text.trim() || "Resend email request failed";
}

function buildFeedbackHtml(input: FeedbackNotificationInput) {
  const screenshotCount = input.screenshots.length;

  return [
    "<h2>Luna 新反馈</h2>",
    `<p><strong>反馈 ID：</strong>${escapeHtml(input.id)}</p>`,
    `<p><strong>页面：</strong>${escapeHtml(input.pageRoute)}</p>`,
    `<p><strong>截图：</strong>${screenshotCount} 张</p>`,
    input.userAgent
      ? `<p><strong>User Agent：</strong>${escapeHtml(input.userAgent)}</p>`
      : "",
    "<hr />",
    `<p>${escapeHtml(input.message).replace(/\n/g, "<br />")}</p>`,
  ].join("\n");
}

function getEmailAddress(value: string) {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] || value).trim();
}

function encodeMimeWord(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function encodeHeader(value: string) {
  return /[^\x20-\x7e]/.test(value) ? encodeMimeWord(value) : value;
}

function dotStuff(value: string) {
  return value.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
}

function buildMimeMessage(message: SmtpMailMessage) {
  const boundary = `luna-feedback-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
  const lines = [
    `From: ${message.from}`,
    `To: ${message.to}`,
    `Subject: ${encodeHeader(message.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    message.html,
  ];

  for (const attachment of message.attachments) {
    lines.push(
      `--${boundary}`,
      `Content-Type: application/octet-stream; name="${attachment.filename}"`,
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      "Content-Transfer-Encoding: base64",
      "",
      attachment.content.replace(/(.{76})/g, "$1\r\n"),
    );
  }

  lines.push(`--${boundary}--`, "");
  return dotStuff(lines.join("\r\n"));
}

function createBasicSmtpTransport({
  host,
  port,
  secure,
  auth,
}: SmtpTransportOptions): SmtpTransport {
  return {
    async sendMail(message) {
      const socket = await new Promise<net.Socket>((resolve, reject) => {
        const client = secure
          ? tls.connect({ host, port, servername: host }, () => resolve(client))
          : net.connect({ host, port }, () => resolve(client));
        client.once("error", reject);
      });

      const pendingLines: string[] = [];
      let buffer = "";
      const readResponse = () =>
        new Promise<string[]>((resolve, reject) => {
          const onData = (chunk: Buffer) => {
            buffer += chunk.toString("utf8");
            const rawLines = buffer.split(/\r?\n/);
            buffer = rawLines.pop() || "";
            pendingLines.push(...rawLines);

            const finalLineIndex = pendingLines.findIndex((line) =>
              /^\d{3} /.test(line),
            );
            if (finalLineIndex >= 0) {
              socket.off("data", onData);
              socket.off("error", onError);
              resolve(pendingLines.splice(0, finalLineIndex + 1));
            }
          };
          const onError = (error: Error) => {
            socket.off("data", onData);
            reject(error);
          };
          socket.on("data", onData);
          socket.once("error", onError);
        });

      const expect = async (code: number) => {
        const response = await readResponse();
        if (!response.at(-1)?.startsWith(String(code))) {
          throw new Error(`SMTP expected ${code}, got ${response.join(" ")}`);
        }
      };

      const command = async (value: string, code: number) => {
        socket.write(`${value}\r\n`);
        await expect(code);
      };

      try {
        await expect(220);
        await command("EHLO luna.local", 250);
        await command("AUTH LOGIN", 334);
        await command(Buffer.from(auth.user, "utf8").toString("base64"), 334);
        await command(Buffer.from(auth.pass, "utf8").toString("base64"), 235);
        await command(`MAIL FROM:<${getEmailAddress(message.from)}>`, 250);
        await command(`RCPT TO:<${getEmailAddress(message.to)}>`, 250);
        await command("DATA", 354);
        socket.write(`${buildMimeMessage(message)}\r\n.\r\n`);
        await expect(250);
        await command("QUIT", 221);
      } finally {
        socket.end();
      }
    },
  };
}

export function createFeedbackEmailNotifier({
  provider = "resend",
  apiKey,
  to = DEFAULT_FEEDBACK_NOTIFY_TO,
  from = DEFAULT_FEEDBACK_NOTIFY_FROM,
  fetcher = fetch,
  smtp,
  createSmtpTransport = createBasicSmtpTransport,
}: {
  provider?: FeedbackEmailProvider;
  apiKey?: string;
  to?: string;
  from?: string;
  fetcher?: Fetcher;
  smtp?: SmtpConfig;
  createSmtpTransport?: CreateSmtpTransport;
}) {
  return {
    async notifyFeedback(
      input: FeedbackNotificationInput,
    ): Promise<FeedbackNotificationResult> {
      const attachments = input.screenshots.map((screenshot, index) => {
        const parsed = parseFeedbackScreenshotDataUrl(screenshot, index);
        return {
          filename: parsed.filename,
          content: parsed.base64Content,
        };
      });

      if (provider === "smtp") {
        if (!smtp?.host?.trim() || !smtp.user?.trim() || !smtp.pass?.trim()) {
          return {
            status: "skipped",
            reason: "SMTP mail configuration is incomplete",
          };
        }

        try {
          const transport = createSmtpTransport({
            host: smtp.host,
            port: smtp.port || DEFAULT_SMTP_PORT,
            secure: smtp.secure ?? (smtp.port || DEFAULT_SMTP_PORT) === 465,
            auth: {
              user: smtp.user,
              pass: smtp.pass,
            },
          });
          await transport.sendMail({
            from,
            to,
            subject: `Luna 新反馈：${input.pageRoute}`,
            html: buildFeedbackHtml(input),
            attachments: attachments.map((attachment) => ({
              ...attachment,
              encoding: "base64",
            })),
          });
          return { status: "sent" };
        } catch (error) {
          return {
            status: "failed",
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }

      if (!apiKey?.trim()) {
        return {
          status: "skipped",
          reason: "RESEND_API_KEY is not configured",
        };
      }

      let response: Response;
      try {
        response = await fetcher("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from,
            to: [to],
            subject: `Luna 新反馈：${input.pageRoute}`,
            html: buildFeedbackHtml(input),
            attachments,
          }),
        });
      } catch (error) {
        return {
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        };
      }

      if (!response.ok) {
        return {
          status: "failed",
          error: await readResendError(response),
        };
      }

      return { status: "sent" };
    },
  };
}
