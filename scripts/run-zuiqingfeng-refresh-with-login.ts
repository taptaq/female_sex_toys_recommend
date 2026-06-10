import "dotenv/config";

import { spawn } from "node:child_process";
import { chromium, type BrowserContext } from "playwright";

const WARMUP_URL =
  process.env.ZUIQINGFENG_WARMUP_URL ||
  "https://mizzzeegf.tmall.com/search.htm?spm=a1z10.1-b-s.w5002-25911219286.1.303c6a96zTVEfL&search=y";
const DETAIL_PROBE_URL = process.env.ZUIQINGFENG_LOGIN_PROBE_URL || "https://detail.tmall.com/item.htm?id=1037938878986";
const LOGIN_TIMEOUT_MS = Number(process.env.ZUIQINGFENG_LOGIN_TIMEOUT_MS || 10 * 60 * 1000);

type BrowserCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
};

function parseCookieHeader(cookieHeader: string): BrowserCookie[] {
  return cookieHeader
    .split(";")
    .map((part) => {
      const index = part.indexOf("=");
      if (index <= 0) return null;
      const name = part.slice(0, index).trim();
      const value = part.slice(index + 1).trim();
      if (!name || !value) return null;
      return [
        { name, value, domain: ".tmall.com", path: "/" },
        { name, value, domain: ".taobao.com", path: "/" },
      ];
    })
    .filter((value): value is BrowserCookie[] => Boolean(value))
    .flat();
}

function isLoginUrl(url: string) {
  return /login\.taobao\.com|login\.tmall\.com|havanaone\/login/i.test(url);
}

function isLoginText(text: string) {
  return /密码登录|短信登录|免费注册|手机扫码登录|滑动验证|验证码/i.test(text);
}

async function addInitialCookies(context: BrowserContext) {
  const cookies = parseCookieHeader(process.env.TMALL_COOKIE || "");
  if (cookies.length > 0) {
    await context.addCookies(cookies);
    console.log(`[tmall-login] 已注入现有 TMALL_COOKIE: ${cookies.length} 条`);
  }
}

async function waitForLoggedInCookie(context: BrowserContext) {
  const page = await context.newPage();
  console.log("[tmall-login] 将打开可见浏览器；请完成淘宝/天猫登录。");
  await page.goto(WARMUP_URL, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.goto(DETAIL_PROBE_URL, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {});

  const deadline = Date.now() + LOGIN_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const pageText = await page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
    const currentUrl = page.url();
    const cookies = await context.cookies(["https://tmall.com", "https://taobao.com", "https://detail.tmall.com"]);
    const cookieNames = new Set(cookies.map((cookie) => cookie.name));
    const hasLikelyAuthCookie =
      cookieNames.has("_m_h5_tk") ||
      cookieNames.has("cookie2") ||
      cookieNames.has("_tb_token_") ||
      cookieNames.has("unb") ||
      cookieNames.has("tracknick");

    if (!isLoginUrl(currentUrl) && !isLoginText(pageText) && hasLikelyAuthCookie) {
      const cookieHeader = cookies
        .filter((cookie) => cookie.name && cookie.value)
        .map((cookie) => `${cookie.name}=${cookie.value}`)
        .join("; ");
      if (cookieHeader) {
        console.log(`[tmall-login] 已获取登录 cookie: ${cookies.length} 条，开始刷新谜姬历史商品。`);
        return cookieHeader;
      }
    }

    await page.waitForTimeout(3000);
  }

  throw new Error("等待淘宝/天猫登录超时，未获取到可用 cookie。");
}

async function runRefresh(cookieHeader: string, refreshArgs: string[]) {
  const args = [
    "tsx",
    "-r",
    "dotenv/config",
    "src/db/refresh-zuiqingfeng-existing-products.ts",
    ...(refreshArgs.length ? refreshArgs : ["--apply"]),
  ];
  const child = spawn("npx", args, {
    stdio: "inherit",
    env: {
      ...process.env,
      TMALL_COOKIE: cookieHeader,
      ZUIQINGFENG_WARMUP_URL: WARMUP_URL,
    },
  });

  const code = await new Promise<number | null>((resolve) => {
    child.on("exit", resolve);
  });

  if (code !== 0) {
    throw new Error(`refresh-zuiqingfeng exited with code ${code}`);
  }
}

async function main() {
  const refreshArgs = process.argv.slice(2);
  const browser = await chromium.launch({
    headless: false,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
    ignoreDefaultArgs: ["--enable-automation"],
  });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  try {
    await addInitialCookies(context);
    const cookieHeader = await waitForLoggedInCookie(context);
    await browser.close().catch(() => {});
    await runRefresh(cookieHeader, refreshArgs);
  } finally {
    await browser.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error("[tmall-login] 执行失败:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
