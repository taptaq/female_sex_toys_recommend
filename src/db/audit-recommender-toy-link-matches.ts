import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { chromium, type Page } from "playwright";

dotenv.config();

type TableName = "recommender_toys" | "female_recommender_toys";

type TargetRow = {
  table_name: TableName;
  id: string;
  name: string;
  brand: string | null;
  link: string;
  product_name: string | null;
  product_link: string | null;
};

type PageSignals = {
  finalUrl: string;
  title: string;
  heading: string;
  metaTitle: string;
  bodyText: string;
  blocked: boolean;
};

type BrowserCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
};

type AuditResult = {
  row: TargetRow;
  status: "match" | "mismatch" | "blocked" | "unavailable" | "unknown" | "error";
  score: number;
  tokens: string[];
  pageTitle: string;
  finalUrl: string;
  reason: string;
};

type CandidateScore = {
  row: TargetRow;
  productScore: number;
  matchedTokens: string[];
  tokenCount: number;
};

const GENERIC_TOKEN_PATTERN =
  /成人|情趣|用品|女用品|女性用品|性用品|女性|女用|女生|女人|女士|男用品|男用|男士|男性|专用|官方|旗舰店|正品|玩具|用具|自慰器|自慰|自卫|自尉|高潮|糕潮|秒潮|神器|强震|震动|振动|按摩|调情|私密|私处|情趣用品|日本|进口|旗舰|天猫|旗舰店|床上|夫妻|情侣|共用|成人用品|性玩具/g;
const LATIN_GENERIC = new Set([
  "app",
  "usb",
  "mini",
  "pro",
  "max",
  "plus",
  "love",
  "sex",
  "toy",
  "toys",
  "official",
  "shop",
  "store",
  "tmall",
  "taobao",
]);
const BRAND_PATTERN = /kisstoy|kistoy|iroha|tenga|lelo|谜姬|醉清风|小怪兽|网易春风|大人糖|霏慕/gi;

function normalizeText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function compactText(value: unknown) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/[^\p{Script=Han}a-z0-9]+/gu, "");
}

function stripGeneric(value: string) {
  return compactText(value)
    .replace(GENERIC_TOKEN_PATTERN, "")
    .replace(BRAND_PATTERN, "");
}

function tokenizableText(value: string) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(GENERIC_TOKEN_PATTERN, " ")
    .replace(BRAND_PATTERN, " ")
    .replace(/[^\p{Script=Han}a-z0-9]+/gu, " ")
    .trim();
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

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

export function extractDistinctiveTokensForLinkMatch(name: string) {
  const source = tokenizableText(name);
  const tokens: string[] = [];

  for (const token of source.match(/[a-z][a-z0-9]{2,}/g) ?? []) {
    if (!LATIN_GENERIC.has(token)) tokens.push(token);
  }

  const hanChunks = source.match(/[\p{Script=Han}]{2,}/gu) ?? [];
  const strongPhrases = [
    "小皇冠",
    "点潮笔",
    "青媞",
    "青提",
    "喵喜",
    "萌小兔",
    "月下兔",
    "小猫咪",
    "猫爪",
    "小白",
    "机甲战神",
    "马眼",
    "羊眼圈",
    "锁精环",
    "polly",
    "tina",
    "bobo",
    "tenga",
    "iroha",
  ];
  for (const phrase of strongPhrases) {
    if (compactText(name).includes(compactText(phrase))) tokens.push(compactText(phrase));
  }

  for (const chunk of hanChunks) {
    if (chunk.length <= 5) {
      tokens.push(chunk);
      continue;
    }
    for (let size = 2; size <= 4; size += 1) {
      for (let index = 0; index <= chunk.length - size; index += 1) {
        tokens.push(chunk.slice(index, index + size));
      }
    }
  }

  return unique(tokens).filter((token) => token.length >= 2).slice(0, 24);
}

export function scoreNameAgainstPageText(name: string, pageText: string) {
  const tokens = extractDistinctiveTokensForLinkMatch(name);
  if (tokens.length === 0) return { score: 0, tokens, matched: [] as string[] };

  const page = compactText(pageText);
  const matched = tokens.filter((token) => page.includes(token));
  return {
    score: matched.length / tokens.length,
    tokens,
    matched,
  };
}

function scoreNameAgainstProductName(name: string, productName: string | null) {
  if (!productName) return 0;
  return scoreNameAgainstPageText(name, productName).score;
}

function parseArgs(argv: string[]) {
  let limit = Number(process.env.LINK_MATCH_AUDIT_LIMIT || "80");
  let offset = Number(process.env.LINK_MATCH_AUDIT_OFFSET || "0");
  let apply = false;
  let brand = "";
  let includeAll = false;
  let offline = false;

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--apply") {
      apply = true;
    } else if (value === "--all") {
      includeAll = true;
    } else if (value === "--offline") {
      offline = true;
    } else if (value === "--limit" && argv[index + 1]) {
      limit = Number(argv[index + 1]) || limit;
      index += 1;
    } else if (value === "--offset" && argv[index + 1]) {
      offset = Number(argv[index + 1]) || 0;
      index += 1;
    } else if (value === "--brand" && argv[index + 1]) {
      brand = argv[index + 1];
      index += 1;
    }
  }

  return { limit: Math.max(1, limit), offset: Math.max(0, offset), apply, brand, includeAll, offline };
}

async function readRows(client: pg.PoolClient, brand: string) {
  const params: unknown[] = [];
  const brandFilter = brand
    ? `AND (t.brand ILIKE $1 OR t.name ILIKE $1 OR p.name ILIKE $1)`
    : "";
  if (brand) params.push(`%${brand}%`);

  const result = await client.query<TargetRow>(
    `
      SELECT
        'recommender_toys'::text AS table_name,
        t.id::text,
        t.name,
        t.brand,
        t.link,
        p.name AS product_name,
        p.link AS product_link
      FROM public.recommender_toys AS t
      LEFT JOIN public.products AS p ON p.id = t.original_id
      WHERE NULLIF(BTRIM(COALESCE(t.link, '')), '') IS NOT NULL
        ${brandFilter}

      UNION ALL

      SELECT
        'female_recommender_toys'::text AS table_name,
        t.id::text,
        t.name,
        t.brand,
        t.link,
        p.name AS product_name,
        p.link AS product_link
      FROM public.female_recommender_toys AS t
      LEFT JOIN public.products AS p ON p.id = t.original_id
      WHERE NULLIF(BTRIM(COALESCE(t.link, '')), '') IS NOT NULL
        ${brandFilter}
    `,
    params,
  );

  return result.rows;
}

function scoreCandidates(rows: TargetRow[]): CandidateScore[] {
  const scored = rows.map((row) => ({
    row,
    productScore: scoreNameAgainstProductName(row.name, row.product_name),
    matchedTokens: scoreNameAgainstPageText(row.name, row.product_name || "").matched,
    tokenCount: extractDistinctiveTokensForLinkMatch(row.name).length,
  }));

  return scored;
}

function pickCandidates(rows: TargetRow[], { includeAll, limit, offset }: { includeAll: boolean; limit: number; offset: number }) {
  const scored = scoreCandidates(rows);

  const candidates = includeAll
    ? scored
    : scored.filter((item) => item.tokenCount >= 2 && item.productScore < 0.38);

  return candidates
    .sort((left, right) => left.productScore - right.productScore || right.tokenCount - left.tokenCount)
    .slice(offset, offset + limit)
    .map((item) => item.row);
}

async function humanDelay(minMs = 900, maxMs = 2200) {
  const delay = minMs + Math.floor(Math.random() * (maxMs - minMs + 1));
  await new Promise((resolve) => setTimeout(resolve, delay));
}

async function extractPageSignals(page: Page, url: string): Promise<PageSignals> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await humanDelay();
  const signals = await page.evaluate(() => {
    const title = document.title || "";
    const heading =
      document.querySelector("h1")?.textContent ||
      document.querySelector('[class*="title"], [class*="Title"]')?.textContent ||
      "";
    const metaTitle =
      document.querySelector('meta[property="og:title"]')?.getAttribute("content") ||
      document.querySelector('meta[name="title"]')?.getAttribute("content") ||
      "";
    const bodyText = document.body?.innerText || "";
    return { title, heading, metaTitle, bodyText };
  });
  const combined = `${signals.title}\n${signals.heading}\n${signals.metaTitle}\n${signals.bodyText}`;
  return {
    finalUrl: page.url(),
    ...signals,
    bodyText: signals.bodyText.slice(0, 5000),
    blocked:
      /密码登录|短信登录|免费注册|滑动验证|验证码|unusual traffic|slide to verify|blocked request|technical difficulties/i.test(
        combined,
      ),
  };
}

function classifyAudit(row: TargetRow, signals: PageSignals): AuditResult {
  const pageText = `${signals.title}\n${signals.heading}\n${signals.metaTitle}\n${signals.bodyText}`;
  const scored = scoreNameAgainstPageText(row.name, pageText);
  const titleText = normalizeText([signals.heading, signals.metaTitle, signals.title].filter(Boolean).join(" / "));
  const tokenCount = scored.tokens.length;

  if (signals.blocked) {
    return { row, status: "blocked", score: scored.score, tokens: scored.tokens, pageTitle: titleText, finalUrl: signals.finalUrl, reason: "页面疑似登录/风控" };
  }
  if (/宝贝不存在|商品不存在|已下架|item has been removed/i.test(pageText)) {
    return { row, status: "unavailable", score: scored.score, tokens: scored.tokens, pageTitle: titleText, finalUrl: signals.finalUrl, reason: "页面显示不存在或下架" };
  }
  if (tokenCount === 0) {
    return { row, status: "unknown", score: scored.score, tokens: scored.tokens, pageTitle: titleText, finalUrl: signals.finalUrl, reason: "产品名缺少可判定关键词" };
  }
  if (scored.score >= 0.22 || scored.matched.length >= 2) {
    return { row, status: "match", score: scored.score, tokens: scored.tokens, pageTitle: titleText, finalUrl: signals.finalUrl, reason: `命中关键词: ${scored.matched.slice(0, 8).join(", ")}` };
  }
  if (tokenCount >= 2 && scored.matched.length === 0) {
    return { row, status: "mismatch", score: scored.score, tokens: scored.tokens, pageTitle: titleText, finalUrl: signals.finalUrl, reason: "页面未命中推荐表产品名关键词" };
  }
  return { row, status: "unknown", score: scored.score, tokens: scored.tokens, pageTitle: titleText, finalUrl: signals.finalUrl, reason: "命中信息不足，未自动判错" };
}

async function applyMismatches(client: pg.PoolClient, mismatches: AuditResult[]) {
  const byTable = new Map<TableName, AuditResult[]>();
  for (const mismatch of mismatches) {
    const rows = byTable.get(mismatch.row.table_name) ?? [];
    rows.push(mismatch);
    byTable.set(mismatch.row.table_name, rows);
  }

  const updated: Record<string, number> = {};
  for (const [tableName, rows] of byTable.entries()) {
    const result = await client.query(
      `
        UPDATE public.${tableName} AS t
        SET link = NULL,
            updated_at = NOW()
        FROM jsonb_to_recordset($1::jsonb) AS patch(id uuid)
        WHERE t.id = patch.id
      `,
      [JSON.stringify(rows.map((item) => ({ id: item.row.id })))],
    );
    updated[tableName] = result.rowCount ?? 0;
  }
  return updated;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
  const client = await pool.connect();
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

  try {
    const rows = await readRows(client, args.brand);
    const scored = scoreCandidates(rows);
    const candidates = pickCandidates(rows, args);
    console.log(
      JSON.stringify(
        {
          apply: args.apply,
          scanned_rows: rows.length,
          candidates: candidates.length,
          brand_filter: args.brand || null,
          include_all: args.includeAll,
        },
        null,
        2,
      ),
    );

    if (args.offline) {
      const offlineCandidates = (args.includeAll ? scored : scored.filter((item) => item.tokenCount >= 2 && item.productScore < 0.38))
        .sort((left, right) => left.productScore - right.productScore || right.tokenCount - left.tokenCount)
        .slice(args.offset, args.offset + args.limit);
      console.log(
        JSON.stringify(
          {
            offline_candidates: offlineCandidates.map((item) => ({
              table: item.row.table_name,
              brand: item.row.brand,
              product_name: item.row.name,
              linked_product_name: item.row.product_name,
              link: item.row.link,
              product_link: item.row.product_link,
              product_score: Number(item.productScore.toFixed(3)),
              matched_tokens: item.matchedTokens.slice(0, 12),
              token_count: item.tokenCount,
            })),
          },
          null,
          2,
        ),
      );
      return;
    }

    browser = await chromium.launch({
      headless: process.env.LINK_MATCH_HEADLESS !== "false",
      args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
      ignoreDefaultArgs: ["--enable-automation"],
    });
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      viewport: { width: 1365, height: 900 },
      ignoreHTTPSErrors: true,
    });
    const cookies = parseCookieHeader(process.env.TMALL_COOKIE || "");
    if (cookies.length > 0) {
      await context.addCookies(cookies);
      console.log(`[link-match] injected TMALL_COOKIE cookies=${cookies.length}`);
    }
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });
    const page = await context.newPage();
    const results: AuditResult[] = [];

    for (const [index, row] of candidates.entries()) {
      console.log(`[link-match] (${index + 1}/${candidates.length}) ${row.table_name} | ${row.brand || "-"} | ${row.name}`);
      try {
        const signals = await extractPageSignals(page, row.link);
        const result = classifyAudit(row, signals);
        results.push(result);
        console.log(`[link-match] ${result.status} score=${result.score.toFixed(2)} title=${result.pageTitle.slice(0, 100)}`);
      } catch (error) {
        results.push({
          row,
          status: "error",
          score: 0,
          tokens: extractDistinctiveTokensForLinkMatch(row.name),
          pageTitle: "",
          finalUrl: row.link,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
      await humanDelay(1200, 3200);
    }

    const mismatches = results.filter((result) => result.status === "mismatch");
    let updated: Record<string, number> = {};
    if (args.apply && mismatches.length > 0) {
      await client.query("BEGIN");
      updated = await applyMismatches(client, mismatches);
      await client.query("COMMIT");
    }

    console.log(
      JSON.stringify(
        {
          apply: args.apply,
          updated,
          summary: {
            match: results.filter((result) => result.status === "match").length,
            mismatch: mismatches.length,
            blocked: results.filter((result) => result.status === "blocked").length,
            unavailable: results.filter((result) => result.status === "unavailable").length,
            unknown: results.filter((result) => result.status === "unknown").length,
            error: results.filter((result) => result.status === "error").length,
          },
          mismatches: mismatches.map((result) => ({
            table: result.row.table_name,
            brand: result.row.brand,
            product_name: result.row.name,
            product_link: result.row.link,
            page_title: result.pageTitle,
            reason: result.reason,
          })),
          blocked_or_unknown: results
            .filter((result) => result.status === "blocked" || result.status === "unknown" || result.status === "unavailable" || result.status === "error")
            .slice(0, 30)
            .map((result) => ({
              table: result.row.table_name,
              brand: result.row.brand,
              product_name: result.row.name,
              status: result.status,
              reason: result.reason,
              page_title: result.pageTitle,
            })),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await browser?.close().catch(() => {});
    client.release();
    await pool.end().catch(() => {});
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error("[audit-recommender-toy-link-matches] failed:", error);
    process.exitCode = 1;
  });
}
