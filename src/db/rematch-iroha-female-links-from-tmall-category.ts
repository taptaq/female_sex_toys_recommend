import dotenv from "dotenv";
import pg from "pg";
import { chromium, type BrowserContext, type Page } from "playwright";

dotenv.config();

const CATEGORY_URL =
  "https://iroha.tmall.com/category.htm?spm=a1z10.1-b.w5001-21702348845.3.719115dfIVRqOr&scene=taobao_shop";
const SHOULD_APPLY = process.argv.includes("--apply");
const MAX_PAGES = Number(process.env.IROHA_LINK_MATCH_MAX_PAGES || 8);
const MIN_MATCH_SCORE = Number(process.env.IROHA_LINK_MATCH_MIN_SCORE || 0.42);
const NON_PRODUCT_PATTERNS = [
  "购物金",
  "会员充值",
  "充值享折",
  "过期随时退",
  "全店通用",
  "店铺权益",
  "权益卡",
  "礼品卡",
  "储值卡",
  "充值卡",
  "即充即用",
];

const pool = new pg.Pool({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
});

export type ShopItem = {
  itemId: string;
  title: string;
  href: string;
};

export type TargetToy = {
  toy_id: string;
  original_id: string;
  name: string;
  brand: string | null;
  current_link: string | null;
};

type MatchResult = {
  target: TargetToy;
  item: ShopItem;
  score: number;
  next_link: string;
};

function uniq<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

export function canonicalizeTmallItemUrl(rawUrl: string | null | undefined) {
  const value = String(rawUrl || "").trim();
  if (!value) return "";

  try {
    const parsed = new URL(value.startsWith("//") ? `https:${value}` : value);
    const itemId = parsed.searchParams.get("id")?.trim();
    return itemId ? `https://detail.tmall.com/item.htm?id=${itemId}` : value;
  } catch {
    const itemId = value.match(/[?&]id=(\d+)/)?.[1] || "";
    return itemId ? `https://detail.tmall.com/item.htm?id=${itemId}` : value;
  }
}

function extractTmallItemId(rawUrl: string | null | undefined) {
  const value = String(rawUrl || "").trim();
  if (!value) return "";

  try {
    const parsed = new URL(value.startsWith("//") ? `https:${value}` : value);
    return parsed.searchParams.get("id")?.trim() || "";
  } catch {
    return value.match(/[?&]id=(\d+)/)?.[1] || "";
  }
}

export function normalizeProductTitle(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/iroha|tenga|日本|进口|官方|旗舰店|天猫|女用品|女性用品|女性专用|女生用具|专用/g, "")
    .replace(/[^\p{Script=Han}a-z0-9]+/gu, "")
    .trim();
}

function titleTokens(value: string) {
  const normalized = normalizeProductTitle(value);
  const latin = normalized.match(/[a-z0-9]+/g) || [];
  const aliases = latin.flatMap((token) => {
    if (token === "stick") return ["口红", "口红式"];
    if (token === "zen") return ["禅"];
    if (token === "petit") return ["果冻"];
    return [];
  });
  const han = normalized.replace(/[a-z0-9]/g, "");
  const grams: string[] = [];

  for (let size = 2; size <= 3; size += 1) {
    for (let index = 0; index <= han.length - size; index += 1) {
      grams.push(han.slice(index, index + size));
    }
  }

  return uniq([...latin, ...aliases, ...grams, normalized].filter((token) => token.length >= 2));
}

function seriesAliasScore(leftNorm: string, rightNorm: string) {
  const strongPhrases = ["小花蕾", "小雪人", "果冻", "口红", "禅"];
  for (const phrase of strongPhrases) {
    if (leftNorm.includes(phrase) && rightNorm.includes(phrase)) {
      return 0.86;
    }
  }

  const pairs = [
    ["stick", "口红"],
    ["zen", "禅"],
    ["petit", "果冻"],
  ];

  for (const [latin, han] of pairs) {
    if (
      ((leftNorm.includes(latin) && rightNorm.includes(han)) ||
        (rightNorm.includes(latin) && leftNorm.includes(han))) &&
      !leftNorm.includes("小雪人") &&
      !rightNorm.includes("小雪人")
    ) {
      return 0.72;
    }
  }

  return 0;
}

function isNonProductTitle(title: string) {
  const normalized = String(title || "").replace(/\s+/g, "").trim();
  if (!normalized || ["未知产品", "未知商品", "无标题"].includes(normalized)) return true;
  return NON_PRODUCT_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export function titleMatchScore(left: string, right: string) {
  const leftNorm = normalizeProductTitle(left);
  const rightNorm = normalizeProductTitle(right);
  if (!leftNorm || !rightNorm) return 0;
  if (leftNorm === rightNorm) return 1;
  const aliasScore = seriesAliasScore(leftNorm, rightNorm);
  if (leftNorm.includes(rightNorm) || rightNorm.includes(leftNorm)) {
    return Math.max(aliasScore, Math.min(leftNorm.length, rightNorm.length) / Math.max(leftNorm.length, rightNorm.length));
  }

  const leftTokens = titleTokens(leftNorm);
  const rightTokens = titleTokens(rightNorm);
  if (leftTokens.length === 0 || rightTokens.length === 0) return 0;

  const rightSet = new Set(rightTokens);
  const leftSet = new Set(leftTokens);
  const intersection = leftTokens.filter((token) => rightSet.has(token)).length;
  const leftCoverage = intersection / leftTokens.length;
  const rightCoverage = Array.from(rightSet).filter((token) => leftSet.has(token)).length / rightTokens.length;
  const coverageOfShorter = Math.max(leftCoverage, rightCoverage);
  const jaccardLike = intersection / Math.max(leftTokens.length, rightTokens.length);
  return Math.max(aliasScore, jaccardLike, coverageOfShorter * 0.72);
}

async function addTmallCookies(context: BrowserContext) {
  const cookieStr = process.env.TMALL_COOKIE || "";
  if (!cookieStr.trim()) {
    console.warn("[rematch-iroha] TMALL_COOKIE 为空，可能会遇到登录页/风控页。");
    return;
  }

  const cookies = cookieStr
    .split(";")
    .map((cookie) => {
      const [name, ...rest] = cookie.trim().split("=");
      const value = rest.join("=");
      if (!name || !value) return null;
      return [
        { name, value, domain: ".tmall.com", path: "/" },
        { name, value, domain: ".taobao.com", path: "/" },
      ];
    })
    .filter(Boolean)
    .flat() as Array<{ name: string; value: string; domain: string; path: string }>;

  await context.addCookies(cookies);
  console.log(`[rematch-iroha] 已注入 Tmall Cookie 条目: ${cookies.length}`);
}

async function collectPageItems(page: Page) {
  return page.evaluate(`(() => {
    var normalizeHref = function(value) {
      var trimmed = String(value || "").trim();
      if (!trimmed) return "";
      return trimmed.indexOf("http") === 0 ? trimmed : "https:" + trimmed;
    };
    var getItemId = function(href) {
      try {
        return new URL(href).searchParams.get("id") || "";
      } catch (e) {
        var match = String(href || "").match(/[?&]id=(\\d+)/);
        return match ? match[1] : "";
      }
    };
    var pickTitle = function(element, anchor) {
      var nameAnchor = element.querySelector("dd.detail a.item-name, a.item-name");
      var img = element.querySelector("img");
      return (
        (nameAnchor && nameAnchor.textContent && nameAnchor.textContent.trim()) ||
        (anchor && anchor.textContent && anchor.textContent.trim()) ||
        (img && img.getAttribute("alt") && img.getAttribute("alt").trim()) ||
        ""
      );
    };
    var isRecommended = function(element) {
      return !!element.closest(".shop-recommend, .sh-results-promote, .similar-items");
    };
    var results = [];
    var seen = new Set();
    var push = function(item) {
      var key = item.itemId || item.href || item.title;
      if (!item.itemId || !item.href || !item.title || seen.has(key)) return;
      seen.add(key);
      results.push(item);
    };

    Array.from(document.querySelectorAll(".J_TItems dl.item")).forEach(function(card) {
      if (isRecommended(card)) return;
      var anchor = card.querySelector("a.J_GoldData, a.J_TGoldData, dt.photo a, dd.detail a.item-name");
      var href = normalizeHref((anchor && (anchor.href || anchor.getAttribute("href"))) || "");
      push({ itemId: getItemId(href), title: pickTitle(card, anchor), href: href });
    });

    Array.from(document.querySelectorAll('a[href*="detail.tmall.com/item.htm"], a[href*="//detail.tmall.com/item.htm"]')).forEach(function(anchor) {
      if (isRecommended(anchor)) return;
      var href = normalizeHref(anchor.href || anchor.getAttribute("href"));
      var card = anchor.closest("dl.item, li, .item, [data-id], [data-itemid], [data-item-id]") || anchor;
      push({ itemId: getItemId(href), title: pickTitle(card, anchor), href: href });
    });

    return results;
  })()`) as Promise<ShopItem[]>;
}

async function findNextPageUrl(page: Page, currentPage: number) {
  return page.evaluate(
    `((pageNo) => {
      var anchors = Array.from(document.querySelectorAll("a"));
      var next = anchors.find(function(anchor) {
        var text = (anchor.textContent || "").trim();
        return text.indexOf("下一页") >= 0 && !/\\d+/.test(text);
      });
      if (!next || !next.href || next.href.indexOf("javascript") >= 0) return "";
      if (
        next.classList.contains("disable") ||
        next.classList.contains("disabled") ||
        next.classList.contains("ui-page-s-next-disabled")
      ) {
        return "";
      }
      try {
        var parsed = new URL(next.href);
        var nextPageNo = Number(parsed.searchParams.get("pageNo") || pageNo + 1);
        return nextPageNo > pageNo ? next.href : "";
      } catch (e) {
        return next.href;
      }
    })(${currentPage})`,
  );
}

async function collectShopItems() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
    ignoreDefaultArgs: ["--enable-automation"],
  });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });

  await addTmallCookies(context);
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  const page = await context.newPage();
  const items: ShopItem[] = [];
  const seen = new Set<string>();
  let pageUrl = CATEGORY_URL;

  try {
    for (let pageNo = 1; pageNo <= MAX_PAGES && pageUrl; pageNo += 1) {
      console.log(`[rematch-iroha] 抓取类目页 ${pageNo}: ${pageUrl}`);
      await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(5000);
      await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight)).catch(() => {});
      await page.waitForTimeout(1500);

      const pageItems = await collectPageItems(page);
      const accepted = pageItems.filter((item) => !isNonProductTitle(item.title));
      console.log(`[rematch-iroha] 本页原始 ${pageItems.length}，可匹配商品 ${accepted.length}`);

      for (const item of accepted) {
        const key = item.itemId || item.href;
        if (seen.has(key)) continue;
        seen.add(key);
        items.push(item);
      }

      pageUrl = String((await findNextPageUrl(page, pageNo)) || "");
    }
  } finally {
    await browser.close().catch(() => {});
  }

  return items;
}

async function loadTargets() {
  const result = await pool.query<TargetToy>(`
    SELECT
      t.id AS toy_id,
      t.original_id,
      t.name,
      t.brand,
      t.link AS current_link
    FROM public.female_recommender_toys t
    WHERE t.original_id IS NOT NULL
      AND (
        t.brand ILIKE 'iroha'
        OR t.name ILIKE '%iroha%'
      )
    ORDER BY t.name
  `);

  return result.rows;
}

export function matchTargetsToShopItems(targets: TargetToy[], shopItems: ShopItem[]) {
  const matches: MatchResult[] = [];
  const itemsById = new Map(shopItems.map((item) => [item.itemId, item]));

  for (const target of targets) {
    const currentItemId = extractTmallItemId(target.current_link);
    const exactCurrentItem = currentItemId ? itemsById.get(currentItemId) : null;
    const exactCurrentScore = exactCurrentItem ? titleMatchScore(target.name, exactCurrentItem.title) : 0;
    if (exactCurrentItem && exactCurrentScore >= MIN_MATCH_SCORE) {
      matches.push({
        target,
        item: exactCurrentItem,
        score: exactCurrentScore,
        next_link: canonicalizeTmallItemUrl(exactCurrentItem.href),
      });
      continue;
    }

    const ranked = shopItems
      .map((item) => ({
        item,
        score: titleMatchScore(target.name, item.title),
      }))
      .sort((left, right) => right.score - left.score);
    const best = ranked[0];

    if (!best || best.score < MIN_MATCH_SCORE) continue;

    matches.push({
      target,
      item: best.item,
      score: best.score,
      next_link: canonicalizeTmallItemUrl(best.item.href),
    });
  }

  return matches;
}

async function main() {
  const [targets, shopItems] = await Promise.all([loadTargets(), collectShopItems()]);
  const matches = matchTargetsToShopItems(targets, shopItems);
  const updates = matches.filter(
    (match) => match.next_link && match.next_link !== canonicalizeTmallItemUrl(match.target.current_link),
  );
  const unmatched = targets.filter((target) => !matches.some((match) => match.target.toy_id === target.toy_id));

  console.log("[rematch-iroha] 匹配结果:");
  console.log(
    JSON.stringify(
      {
        targets: targets.length,
        shopItems: shopItems.length,
        matched: matches.length,
        updatable: updates.length,
        unmatched: unmatched.map((target) => target.name),
        samples: matches.slice(0, 30).map((match) => ({
          local: match.target.name,
          shop: match.item.title,
          score: Number(match.score.toFixed(3)),
          from: match.target.current_link,
          to: match.next_link,
        })),
      },
      null,
      2,
    ),
  );

  if (!SHOULD_APPLY) {
    console.log("[rematch-iroha] dry-run only. Pass --apply to update links.");
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const match of updates) {
      await client.query("UPDATE public.female_recommender_toys SET link = $1 WHERE id = $2", [
        match.next_link,
        match.target.toy_id,
      ]);
      await client.query("UPDATE public.products SET link = $1 WHERE id = $2", [
        match.next_link,
        match.target.original_id,
      ]);
    }
    await client.query("COMMIT");
    console.log(`[rematch-iroha] updated ${updates.length} links.`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

if (process.argv[1]?.endsWith("rematch-iroha-female-links-from-tmall-category.ts")) {
  main()
    .catch((error) => {
      console.error("[rematch-iroha] failed:", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await pool.end().catch(() => {});
    });
}
