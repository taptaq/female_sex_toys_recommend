import dotenv from "dotenv";
import OpenAI from "openai";
import pg from "pg";
import { chromium, type BrowserContext, type Page } from "playwright";
import { fileURLToPath } from "node:url";

import type { Product } from "../data/mock.ts";
import { buildSafeDisplayName } from "../lib/product-display-name.ts";
import {
  classifyLibrarySubtypeCode,
  classifyLibraryTypeCode,
  resolveLibraryAudienceGender,
  type ResolvedLibraryAudienceGender,
} from "../lib/library-product-type-classifier.ts";
import { getParentLibraryTypeCodeForSubtype } from "../lib/library-product-types.ts";
import { buildRecommendationProductFeatures } from "../lib/recommendation-product-features.ts";
import {
  extractParamPairsFromCompactText,
  extractParamPairsFromLooseJsonText,
  extractParamPairsFromPageHtml,
  isPlaceholderParamValue,
  mergeWhitelistParams,
} from "../scraper/darentang/param-extraction.ts";
import { tryRevealTmallParamTabs } from "../scraper/darentang/tmall-param-ui.ts";

dotenv.config();

const { Pool } = pg;
const BRAND_NAME = "beu";
const TARGET_URL =
  "https://beucryp.tmall.com/search.htm?spm=a1z10.3-b-s.w4011-24591130310.1.3d4c33d3LORC5j";
const DEFAULT_LIMIT = Number(process.env.BEU_REFRESH_LIMIT || "0");
const DETAIL_RETRY_COUNT = Math.max(1, Number(process.env.BEU_REFRESH_RETRY_COUNT || "2"));
const MAX_OCR_IMAGES = Number(process.env.BEU_REFRESH_MAX_OCR_IMAGES || "8");
const RAW_DESCRIPTION_LIMIT = 5000;
const DEFAULT_POWERED_MAX_DB = 50;
const DEFAULT_POWERED_WATERPROOF = 7;
const DEFAULT_MANUAL_LOGIN_WAIT_MS = 120_000;

export type BeuFemaleTargetRow = {
  id: string;
  original_id: string | null;
  name: string;
  brand: string | null;
  price: string | null;
  material: string | null;
  gender: string | null;
  physical_form: string | null;
  motor_type: string | null;
  appearance: string | null;
  image_url: string | null;
  raw_description: string | null;
  type_code: string | null;
  subtype_code: string | null;
  recommendation_features: unknown;
  link: string | null;
  product_link: string | null;
  product_name: string | null;
  product_price: string | null;
  product_tags: string[] | null;
  product_image: string | null;
};

export type BeuListItem = {
  itemId: string;
  title: string;
  href: string;
  domIndex: number;
  imageUrl: string | null;
  price: number | null;
};

export type BeuDetailFields = {
  itemId: string;
  finalUrl: string;
  listTitle: string;
  price: number | null;
  imageUrl: string | null;
  rawDescription: string;
};

export type BeuFemaleProductPatch = {
  id: string;
  originalId: string | null;
  name: string;
  price: number | null;
  material: string;
  gender: ResolvedLibraryAudienceGender;
  rawDescription: string;
  typeCode: string;
  subtypeCode: string | null;
  maxDb: number | null;
  waterproof: number | null;
  appearance: "high_disguise" | "normal";
  physicalForm: "external" | "internal" | "composite";
  motorType: "gentle" | "strong";
  imageUrl: string | null;
  link: string;
  productTags: string[];
  recommendationFeatures: Record<string, unknown>;
};

type BeuInsertPatch = BeuFemaleProductPatch & {
  itemId: string;
};

type DelayRange = {
  minMs: number;
  maxMs: number;
};

type EnvLike = Record<string, string | undefined>;

function normalizeText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function hasText(value: unknown) {
  return normalizeText(value).length > 0;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseDelayRange(value: string | undefined, fallback: DelayRange): DelayRange {
  const raw = normalizeText(value);
  if (!raw) return fallback;
  const [minRaw, maxRaw] = raw.split(/[:,-]/);
  const minMs = Number(minRaw);
  const maxMs = Number(maxRaw ?? minRaw);
  if (!Number.isFinite(minMs) || !Number.isFinite(maxMs)) return fallback;
  const normalizedMin = Math.max(0, Math.floor(minMs));
  const normalizedMax = Math.max(normalizedMin, Math.floor(maxMs));
  return { minMs: normalizedMin, maxMs: normalizedMax };
}

function randomDelayMs(range: DelayRange) {
  return Math.round(range.minMs + (range.maxMs - range.minMs) * Math.random());
}

const HUMAN_WAIT_RANGES = {
  listWait: parseDelayRange(process.env.BEU_REFRESH_LIST_WAIT_MS, { minMs: 9000, maxMs: 18000 }),
  detailWait: parseDelayRange(process.env.BEU_REFRESH_DETAIL_WAIT_MS, { minMs: 9000, maxMs: 18000 }),
  betweenItems: parseDelayRange(process.env.BEU_REFRESH_BETWEEN_ITEMS_MS, { minMs: 22000, maxMs: 52000 }),
  scrollPause: parseDelayRange(process.env.BEU_REFRESH_SCROLL_PAUSE_MS, { minMs: 1200, maxMs: 3200 }),
};

async function humanizedWait(range: DelayRange, label: string) {
  const delayMs = randomDelayMs(range);
  console.log(`[refresh-beu] ${label} 等待 ${delayMs}ms`);
  await sleep(delayMs);
}

export function extractTmallItemIdForBeu(rawLink: string | null | undefined) {
  const link = normalizeText(rawLink);
  if (!link) return "";
  try {
    const parsed = new URL(link.startsWith("//") ? `https:${link}` : link);
    return parsed.searchParams.get("id")?.trim() || "";
  } catch {
    return link.match(/[?&]id=(\d+)/)?.[1] || "";
  }
}

export function canonicalizeTmallItemUrlForBeu(rawLink: string | null | undefined) {
  const link = normalizeTmallUrl(rawLink);
  if (!link) return "";
  const itemId = extractTmallItemIdForBeu(link);
  return itemId ? `https://detail.tmall.com/item.htm?id=${itemId}` : link;
}

function normalizeTmallUrl(rawLink: string | null | undefined) {
  const link = normalizeText(rawLink);
  if (!link) return "";
  return link.startsWith("//") ? `https:${link}` : link;
}

function itemUrlFromId(itemId: string) {
  return `https://detail.tmall.com/item.htm?id=${encodeURIComponent(itemId)}`;
}

function parsePrice(value: unknown) {
  const candidates = Array.from(
    normalizeText(value).replace(/[,，]/g, "").matchAll(/(?:¥|￥)?\s*([1-9]\d{0,5}(?:\.\d{1,2})?)/g),
  )
    .map((match) => Number(match[1]))
    .filter((price) => Number.isFinite(price) && price > 0 && price < 100000);
  return candidates.length ? Math.min(...candidates) : null;
}

function parseStoredPrice(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeFetchedPrice(rawPriceText: string, row: BeuFemaleTargetRow, detailPrice: number | null) {
  const parsed = detailPrice ?? parsePrice(rawPriceText);
  const referencePrice = parseStoredPrice(row.price) ?? parseStoredPrice(row.product_price);
  if (!parsed) return referencePrice ?? null;
  if (referencePrice && parsed < referencePrice * 0.25) return referencePrice;
  if (referencePrice && parsed > referencePrice * 3) return referencePrice;
  return parsed;
}

function normalizeBeuPatchPrice(row: BeuFemaleTargetRow, detail: BeuDetailFields) {
  const parsed = detail.price ?? parseStoredPrice(row.price) ?? parseStoredPrice(row.product_price);
  if (parsed != null && parsed < 10) return null;
  return parsed ?? null;
}

function parseTmallCookieHeader(cookieHeader: string) {
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
    .filter((value): value is Array<{ name: string; value: string; domain: string; path: string }> =>
      Boolean(value),
    )
    .flat();
}

async function injectTmallCookies(context: BrowserContext) {
  const cookieHeader = process.env.TMALL_COOKIE || "";
  if (!cookieHeader.trim()) {
    console.warn("[refresh-beu] TMALL_COOKIE 为空，页面可能进入登录/风控。");
    return;
  }

  const cookies = parseTmallCookieHeader(cookieHeader);
  if (!cookies.length) return;
  await context.addCookies(cookies);
  console.log(`[refresh-beu] 已注入 TMALL_COOKIE: ${cookies.length} 条`);
}

export function isBeuToyListTitle(title: string) {
  const text = normalizeText(title).toLowerCase();
  if (!text) return false;
  if (/购物金|会员|储值|充值|礼品卡|权益|润滑|水基|玻尿酸|护理液|清洁|避孕套|安全套|内衣|睡衣|蕾丝|丝袜|服饰/i.test(text)) {
    return false;
  }
  return /cc机|小白盒|小羽毛|丫丫棒|扣扣机|点点棒|跳蛋|吮吸|吸吮|震动|振动|按摩器|按摩棒|私密按摩|遥控|穿戴|女用|女性|玩具|自慰器/i.test(
    text,
  );
}

export function isBeuInsertableToyListTitle(title: string) {
  const text = normalizeText(title);
  if (!isBeuToyListTitle(text)) return false;
  if (/替换头|日抛头|囤货装|补充装|替换装|配件|收纳|充电线|保护套|单独头/i.test(text)) return false;
  return /震动|振动|跳蛋|吮吸|吸吮|按摩器|按摩棒|av棒|炮机|自慰器|推拉球|勾勾棒|夹夹机|小逗号|嗡嗡蛋|哒哒棒|入体|女用|女性|玩具/i.test(
    text,
  );
}

function normalizeAliImageUrl(rawUrl: string) {
  let url = normalizeTmallUrl(rawUrl).replace(/\\/g, "");
  if (!/alicdn|tbcdn/i.test(url)) return "";
  const sourceMatch = url.match(/^(https?:\/\/[^"'?]+\.(?:jpe?g|png|webp))/i);
  if (sourceMatch) url = sourceMatch[1];
  return url;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map(normalizeText).filter(Boolean))];
}

export function dedupeBeuListItemsByItemId(items: BeuListItem[]) {
  const seen = new Set<string>();
  const result: BeuListItem[] = [];
  for (const item of items) {
    if (seen.has(item.itemId)) continue;
    seen.add(item.itemId);
    result.push(item);
  }
  return result;
}

function filterDetailImageUrls(values: string[]) {
  return uniqueStrings(values)
    .map(normalizeAliImageUrl)
    .filter((url) => /\.(?:jpe?g|png|webp)(?:$|[?_.])/i.test(url))
    .filter((url) => !/sprite|icon|logo|avatar|loading|transparent|placeholder|\.gif/i.test(url))
    .slice(0, MAX_OCR_IMAGES);
}

function normalizeParamPairs(pairs: Array<[string, string]>) {
  const merged = new Map<string, string>();
  mergeWhitelistParams(merged, pairs);
  return Array.from(merged.entries()).filter(([, value]) => !isPlaceholderParamValue(value));
}

function extractUsefulPageFallbackText(pageText: string) {
  const lines = pageText
    .split(/\n+/)
    .map(normalizeText)
    .filter(Boolean)
    .filter((line) => line.length >= 2 && line.length <= 220)
    .filter(
      (line) =>
        !/淘宝网首页|已买到的宝贝|我的淘宝|购物车|收藏夹|免费开店|千牛卖家中心|帮助中心|本店推荐|看了又看|用户评价|查看全部评价|规则协议|平台服务协议|新手上路|天猫开店|商家服务|付款方式|快捷支付|余额宝|阿里巴巴集团|Taobao\.com|版权所有|增值电信业务/i.test(
          line,
        ),
    )
    .filter((line) =>
      /参数信息|图文详情|产地|品牌|品名|材质|厂商|生产企业|情趣用品|女用|女性|夫妻|情侣|跳蛋|吮吸|伸缩|震动|振动|遥控|穿戴|阴蒂|g点|防水|分贝|充电|按摩/i.test(
        line,
      ),
    );

  return uniqueStrings(lines).slice(0, 30).join("\n").slice(0, 1800).trim();
}

function buildRawDescription(paramPairs: Array<[string, string]>, ocrText: string, pageText = "") {
  const sections: string[] = [];
  if (paramPairs.length) {
    sections.push(`[参数信息]\n${paramPairs.map(([key, value]) => `${key}: ${value}`).join("\n")}`);
  }
  if (hasText(ocrText)) sections.push(`[图文提取]\n${ocrText}`);
  const pageFallbackText = extractUsefulPageFallbackText(pageText);
  if (hasText(pageFallbackText)) sections.push(`[页面文本]\n${pageFallbackText}`);
  return sections.join("\n\n").slice(0, RAW_DESCRIPTION_LIMIT).trim();
}

function hasUsefulRawDescription(rawDescription: string) {
  const usefulText = normalizeText(rawDescription.replace(/未提及/g, "").replace(/\[图文提取\]|\[参数信息\]|\[页面文本\]/g, ""));
  if (usefulText.length < 50) return false;
  return /产品|型号|品名|品牌|生产企业|情趣用品|用品|材质|硅胶|abs|震动|振动|吮吸|吸吮|旋转|伸缩|防水|分贝|充电|卖点|按摩|入体|跳蛋|穿戴/i.test(
    usefulText,
  );
}

function isTmallBlockedText(text: string) {
  return /unusual traffic|slide to verify|滑动验证|滑动一下|验证码|密码登录|短信登录|免费注册/i.test(text);
}

function isUnavailableTmallItemPage({ url, text }: { url: string; text: string }) {
  return (
    /error\.item\.taobao\.com\/error\/noitem|type=noitem/i.test(url) ||
    /宝贝不存在|商品不存在|已下架|被转移|查看的宝贝不存在|item has been removed/i.test(text)
  );
}

function normalizeMatchText(value: string) {
  return normalizeText(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function isDetailLikelyForBeuTarget(row: BeuFemaleTargetRow, detail: BeuDetailFields) {
  const detailText = normalizeMatchText(`${detail.listTitle}\n${detail.rawDescription}`);
  const rowText = normalizeMatchText(`${row.name}\n${row.product_name || ""}`);
  if (!detailText || !rowText) return false;
  if (/淘宝网首页|本店推荐|看了又看|用户评价/.test(detail.rawDescription) && !/\[图文提取\]/.test(detail.rawDescription)) {
    return false;
  }
  const explicitTokens = ["cc机", "小白盒", "小羽毛", "丫丫棒", "扣扣机", "点点棒"];
  const matched = explicitTokens.some((token) => rowText.includes(normalizeMatchText(token)) && detailText.includes(normalizeMatchText(token)));
  return matched || hasUsefulRawDescription(detail.rawDescription);
}

async function ocrWithGLM(imageUrls: string[], title: string) {
  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey || imageUrls.length === 0) return "";

  const client = new OpenAI({
    apiKey,
    baseURL: "https://open.bigmodel.cn/api/paas/v4/",
  });

  const content: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [
    {
      type: "text",
      text: `你是商品详情图 OCR 和字段校准助手。请只根据图片中明确出现的信息，输出中文结构化文本，不要识别价格。

商品标题参考：${title}

重点提取：
1. 产品名称/型号
2. 材质/面料/成分
3. 产品类型与使用方式
4. 动力规格，如震动、吮吸、旋转、伸缩、加热、手动/电动
5. 防水等级、噪音分贝、电源/充电信息
6. 核心卖点

要求：不要编造；没看到就写“未提及”；不要输出 markdown 代码块。`,
    },
  ];

  for (const url of imageUrls) {
    content.push({ type: "image_url", image_url: { url } });
  }

  const response = await client.chat.completions.create({
    model: "glm-4.6v",
    messages: [{ role: "user", content }],
    temperature: 0.1,
  });
  const message = response.choices[0]?.message as { content?: string | null; reasoning_content?: string | null };
  return normalizeText(message?.content || message?.reasoning_content || "");
}

async function humanizedBrowsePage(page: Page, rounds: number) {
  for (let index = 0; index < rounds; index += 1) {
    await page.mouse
      .move(240 + Math.random() * 720, 220 + Math.random() * 420, { steps: 8 + Math.floor(Math.random() * 18) })
      .catch(() => {});
    await page.evaluate(() => window.scrollBy(0, 320 + Math.floor(Math.random() * 780))).catch(() => {});
    await sleep(randomDelayMs(HUMAN_WAIT_RANGES.scrollPause));
  }
}

async function collectBeuListItems(page: Page) {
  console.log(`[refresh-beu] 打开列表页: ${TARGET_URL}`);
  await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await humanizedWait(HUMAN_WAIT_RANGES.listWait, "列表页首屏");
  await humanizedBrowsePage(page, 5);
  await page.waitForSelector(".J_TItems", { timeout: 30_000 }).catch(() => {});

  const items = await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".J_TItems dl.item")).map((card, domIndex) => {
      const anchors = Array.from(card.querySelectorAll<HTMLAnchorElement>("a[href]"));
      const href = anchors.map((anchor) => anchor.href || anchor.getAttribute("href") || "").find((value) => /detail\.tmall\.com\/item\.htm/i.test(value)) || "";
      let itemId = "";
      try {
        const parsed = new URL(href.startsWith("//") ? `https:${href}` : href);
        itemId = parsed.searchParams.get("id")?.trim() || "";
      } catch {
        itemId = href.match(/[?&]id=(\d+)/)?.[1] || "";
      }
      const title =
        String(card.querySelector(".detail a, .item-name, .title, .desc a")?.textContent ?? "").replace(/\s+/g, " ").trim() ||
        String(anchors.map((anchor) => anchor.textContent || anchor.title || "").find(Boolean) ?? "").replace(/\s+/g, " ").trim();
      const image =
        Array.from(card.querySelectorAll<HTMLImageElement>("img"))
          .map((img) => img.currentSrc || img.src || img.getAttribute("data-src") || img.getAttribute("data-ks-lazyload") || "")
          .find((url) => /alicdn|tbcdn/i.test(url)) || null;
      const priceText = String(card.querySelector(".c-price, .cprice-area, .price, .sale-price")?.textContent || card.textContent || "").replace(/\s+/g, " ").trim();
      return {
        itemId,
        title,
        href,
        domIndex,
        imageUrl: image,
        priceText,
      };
    });
  });

  const normalizedItems = items
    .map((item) => ({
      itemId: item.itemId,
      title: normalizeText(item.title),
      href: canonicalizeTmallItemUrlForBeu(item.href),
      domIndex: item.domIndex,
      imageUrl: item.imageUrl ? normalizeAliImageUrl(item.imageUrl) : null,
      price: parsePrice(item.priceText),
    }))
    .filter((item) => item.itemId && item.href);

  const toyItems = dedupeBeuListItemsByItemId(normalizedItems.filter((item) => isBeuToyListTitle(item.title)));
  console.log(
    JSON.stringify(
      {
        raw_cards: items.length,
        with_item_id: normalizedItems.length,
        filtered_non_toys: normalizedItems.length - normalizedItems.filter((item) => isBeuToyListTitle(item.title)).length,
        toy_items: toyItems.length,
        samples: toyItems.slice(0, 12).map((item) => ({ itemId: item.itemId, title: item.title, price: item.price })),
      },
      null,
      2,
    ),
  );
  return toyItems;
}

export function shouldWaitForManualBeuLogin(argv: string[], env: EnvLike = process.env) {
  const envFlag = normalizeText(env.BEU_REFRESH_WAIT_FOR_LOGIN).toLowerCase();
  return argv.includes("--wait-login") || envFlag === "true" || envFlag === "1" || envFlag === "yes";
}

export function shouldInsertMissingBeuProducts(argv: string[], env: EnvLike = process.env) {
  const envFlag = normalizeText(env.BEU_INSERT_MISSING).toLowerCase();
  return argv.includes("--insert-missing") || envFlag === "true" || envFlag === "1" || envFlag === "yes";
}

export function shouldProcessOnlyMissingBeuProducts(argv: string[], env: EnvLike = process.env) {
  const envFlag = normalizeText(env.BEU_MISSING_ONLY).toLowerCase();
  return argv.includes("--missing-only") || envFlag === "true" || envFlag === "1" || envFlag === "yes";
}

export function resolveBeuManualLoginWaitMs(env: EnvLike = process.env) {
  const value = Number(env.BEU_REFRESH_LOGIN_WAIT_MS);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_MANUAL_LOGIN_WAIT_MS;
}

async function waitForManualBeuLogin(page: Page, probeUrl: string) {
  const waitMs = resolveBeuManualLoginWaitMs();
  console.log(`[refresh-beu] 打开详情页等待人工登录/验证: ${probeUrl}`);
  if (process.env.TMALL_HEADLESS !== "false") {
    console.warn("[refresh-beu] 当前仍是 headless；如需人工登录，请用 TMALL_HEADLESS=false 运行。");
  }
  await page.bringToFront().catch(() => {});
  await page.goto(probeUrl, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch((error) => {
    console.warn(`[refresh-beu] 详情页登录探针打开失败，仍继续等待: ${error instanceof Error ? error.message : String(error)}`);
  });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  console.log(`[refresh-beu] 请在可见浏览器里完成天猫登录/滑块验证；${Math.round(waitMs / 1000)} 秒后继续清洗。`);
  await sleep(waitMs);
}

async function extractPageSignals(page: Page) {
  return page.evaluate(() => {
    const text = document.body?.innerText || "";
    const html = document.documentElement?.outerHTML || "";
    const imageUrls = Array.from(document.images)
      .map((image) => image.currentSrc || image.src || image.getAttribute("data-src") || "")
      .filter((url) => /alicdn|tbcdn/i.test(url));
    const priceText = Array.from(
      document.querySelectorAll('[class*="price"], [class*="Price"], [class*="promotion"], [class*="Promotion"]'),
    )
      .map((node) => (node.textContent || "").trim())
      .filter(Boolean)
      .slice(0, 30)
      .join(" ");
    return { text, html, imageUrls, priceText };
  });
}

async function fetchDetailFields(page: Page, row: BeuFemaleTargetRow, listItem: BeuListItem): Promise<BeuDetailFields | null> {
  await page.goto(listItem.href || itemUrlFromId(listItem.itemId), { waitUntil: "domcontentloaded", timeout: 60_000 });
  await humanizedWait(HUMAN_WAIT_RANGES.detailWait, "详情页首屏");
  await humanizedBrowsePage(page, 6);
  await tryRevealTmallParamTabs(page).catch(() => {});
  await humanizedWait({ minMs: 900, maxMs: 1800 }, "参数区");

  const signals = await extractPageSignals(page);
  if (isTmallBlockedText(signals.text)) throw new Error("详情页疑似登录/风控页面");
  if (isUnavailableTmallItemPage({ url: page.url(), text: signals.text })) throw new Error("详情页商品不存在或已下架");

  const paramPairs = normalizeParamPairs([
    ...extractParamPairsFromPageHtml(signals.html),
    ...extractParamPairsFromLooseJsonText(signals.html),
    ...extractParamPairsFromCompactText(signals.text),
  ]);
  const imageUrls = filterDetailImageUrls([...signals.imageUrls, listItem.imageUrl || ""]);

  let ocrText = "";
  try {
    ocrText = await ocrWithGLM(imageUrls, listItem.title || row.name);
  } catch (error) {
    console.warn(`[refresh-beu] OCR 失败，使用参数/页面文本兜底: ${error instanceof Error ? error.message : String(error)}`);
  }

  const rawDescription = buildRawDescription(paramPairs, ocrText, signals.text);
  if (!hasUsefulRawDescription(rawDescription)) return null;

  const detail = {
    itemId: listItem.itemId,
    finalUrl: canonicalizeTmallItemUrlForBeu(page.url()) || listItem.href,
    listTitle: listItem.title,
    price: normalizeFetchedPrice(signals.priceText, row, listItem.price),
    imageUrl: imageUrls[0] ?? row.image_url ?? row.product_image ?? null,
    rawDescription,
  };

  if (!isDetailLikelyForBeuTarget(row, detail)) throw new Error("详情内容与目标商品标题不匹配");
  return detail;
}

async function fetchDetailFieldsWithRetry(page: Page, row: BeuFemaleTargetRow, listItem: BeuListItem) {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= DETAIL_RETRY_COUNT; attempt += 1) {
    try {
      const detail = await fetchDetailFields(page, row, listItem);
      if (detail) return detail;
      lastError = new Error("no useful detail");
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
    const message = lastError?.message || "unknown detail failure";
    if (attempt >= DETAIL_RETRY_COUNT || /详情内容与目标商品标题不匹配|不存在|已下架/i.test(message)) {
      if (message === "no useful detail") return null;
      throw lastError;
    }
    console.warn(`[refresh-beu] ${row.name} 详情失败，重试 ${attempt}/${DETAIL_RETRY_COUNT}: ${message}`);
    await humanizedWait({ minMs: 2000, maxMs: 6000 }, "重试前");
  }
  return null;
}

function inferMaterial(row: BeuFemaleTargetRow, rawDescription: string, subtypeCode: string | null) {
  const candidates = [
    rawDescription.match(/(?:^|\n)\s*材质\s*[:：]\s*([^\n]+)/)?.[1],
    rawDescription.match(/(?:^|\n)\s*(?:\d+\.\s*)?材质\/面料\/成分\s*[:：]\s*([^\n]+)/)?.[1],
    rawDescription.match(/(?:^|\n)\s*(?:\d+\.\s*)?内部构造\/材质\s*[:：]\s*([^\n]+)/)?.[1],
  ]
    .map(normalizeText)
    .filter((value) => value && !/未提及|品牌|是否含润滑液/i.test(value));
  const source = `${candidates.join("\n")}\n${row.name}\n${rawDescription}`;
  if (/医用硅胶.*abs|abs.*医用硅胶/i.test(source)) return "医用硅胶+ABS";
  if (/硅胶.*abs|abs.*硅胶/i.test(source)) return "硅胶+ABS";
  if (/医用硅胶/i.test(source)) return "医用硅胶";
  if (/亲肤硅胶/i.test(source)) return "亲肤硅胶";
  if (/硅胶/i.test(source)) return "硅胶";
  if (/abs/i.test(source)) return "ABS";
  if (subtypeCode === "suction_pure" || subtypeCode === "suction_dual") return "医用硅胶+ABS";
  return hasText(row.material) ? normalizeText(row.material) : "医用硅胶+ABS";
}

function inferPhysicalForm(name: string, rawDescription: string): BeuFemaleProductPatch["physicalForm"] {
  const source = `${name}\n${rawDescription}`;
  if (/pp棒|肛塞|后庭|肛门|后庭开发/i.test(source)) {
    return "internal";
  }
  if (/小珍贝|项链跳蛋|点潮笔/i.test(source) && /跳蛋|震动|振动|点潮|c点/i.test(source)) {
    return "external";
  }
  if (/不入体|非入体|无需入体|不插入|非插入/i.test(source) && /外部|跳蛋|点触|不入体强震|external/i.test(source)) {
    return "external";
  }
  const hasInternal = /入体|插入|g点|阴道|微入体|顶翘|internal|insert/i.test(source);
  const hasExternal = /阴蒂|外部|跳蛋|按摩|吮吸|吸吮|穿戴|external|clitoral|suction/i.test(source);
  if (hasInternal && hasExternal) return "composite";
  if (hasInternal) return "internal";
  return "external";
}

function inferMotorType(name: string, rawDescription: string): BeuFemaleProductPatch["motorType"] {
  return /强劲|强力|强震|大吸力|无级变速|爆发|powerful|strong/i.test(`${name}\n${rawDescription}`) ? "strong" : "gentle";
}

function inferAppearance(name: string, rawDescription: string): BeuFemaleProductPatch["appearance"] {
  return /小巧|便携|隐形|伪装|discreet|小羽毛|小白盒/i.test(`${name}\n${rawDescription}`) ? "high_disguise" : "normal";
}

function inferMaxDb(rawDescription: string) {
  const match = rawDescription.match(/(\d{2})\s*(?:d\s*b|db|分贝)/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value >= 20 && value <= 90 ? value : null;
}

function inferWaterproof(rawDescription: string) {
  const ipxMatch = rawDescription.match(/ipx\s*([0-9])/i);
  if (ipxMatch) return Number(ipxMatch[1]);
  if (/防水|水洗|可冲洗|全身水洗|waterproof/i.test(rawDescription)) return DEFAULT_POWERED_WATERPROOF;
  return null;
}

function isPoweredToy(text: string, typeCode: string | null) {
  if (!typeCode || typeCode === "unknown" || typeCode === "care_accessory" || typeCode === "bdsm") return false;
  if (/震动|振动|强震|电动|自动|充电|遥控|远程|app|马达|vibrat/i.test(text)) return true;
  if (/手动|免电|非电动|manual|non[-\s]?powered/i.test(text)) return false;
  return /电动|自动|全自动|震动|振动|加热|伸缩|旋转|充电|遥控|远程|app|马达|吮吸|吸吮|powered|vibrat/i.test(text);
}

function inferStrongBeuType(name: string, rawDescription: string) {
  const text = `${name}\n${rawDescription}`;
  if (/pp棒|肛塞|后庭|肛门|后庭开发/i.test(text)) {
    return { typeCode: "insertable", subtypeCode: "insertable_vibe" };
  }
  if (/嗡嗡蛋|不入体|外部点触|跳蛋器/i.test(text) && /跳蛋|强震|震动|振动/i.test(text) && !/吮吸|吸吮|气脉冲|阴蒂吸|suction/i.test(text)) {
    return { typeCode: "external_vibe", subtypeCode: "bullet_vibe" };
  }
  if (/小珍贝|项链跳蛋|变频跳蛋/i.test(text) && /跳蛋|震动|振动|点潮|c点/i.test(text)) {
    return { typeCode: "external_vibe", subtypeCode: "bullet_vibe" };
  }
  if (/小羽毛|遥控|远程|穿戴/i.test(text)) return { typeCode: "wearable_remote", subtypeCode: "insertable_remote" };
  if (/点点棒/i.test(text) && !/吮吸|吸吮|气脉冲|阴蒂吸|suction/i.test(text)) {
    return { typeCode: "insertable", subtypeCode: "insertable_vibe" };
  }
  if (/cc机|扣扣机|丫丫棒|边吸边揉|微入体|双重|吮吸.{0,16}(揉|震|入体)|吸吮.{0,16}(揉|震|入体)/i.test(text)) {
    return { typeCode: "dual_stimulation", subtypeCode: "suction_dual" };
  }
  if (/小白盒|点点棒|吮吸|吸吮|气脉冲|阴蒂吸/i.test(text)) {
    return { typeCode: "suction", subtypeCode: "suction_pure" };
  }
  return null;
}

function buildProductForFeatures(row: BeuFemaleTargetRow, patch: Omit<BeuFemaleProductPatch, "recommendationFeatures" | "productTags">): Product {
  return {
    id: row.id,
    originalId: row.original_id,
    name: row.name,
    displayName: buildSafeDisplayName(row.name),
    safeDisplayName: buildSafeDisplayName(row.name),
    price: patch.price ?? (Number(row.price) || 0),
    maxDb: patch.maxDb,
    waterproof: patch.waterproof,
    appearance: patch.appearance,
    physicalForm: patch.physicalForm,
    motorType: patch.motorType,
    gender: patch.gender,
    typeCode: patch.typeCode,
    subtypeCode: patch.subtypeCode,
    brand: BRAND_NAME,
    material: patch.material,
    imagePlaceholder: patch.imageUrl ?? row.image_url ?? row.product_image ?? "",
    rawDescription: patch.rawDescription,
    tags: [row.product_tags ?? [], patch.typeCode, patch.subtypeCode, patch.material].flat().filter(Boolean) as string[],
  };
}

function buildRecommendationFeatures(row: BeuFemaleTargetRow, patch: Omit<BeuFemaleProductPatch, "recommendationFeatures" | "productTags">) {
  const features = buildRecommendationProductFeatures(buildProductForFeatures(row, patch));
  return {
    featureVersion: "recommendation-product-features-v1",
    isSuctionLike: features.isSuctionLike,
    isInsertableLike: features.isInsertableLike,
    supportsAppOrRemote: features.supportsAppOrRemote,
    isCoupleOriented: features.isCoupleOriented,
    hasManyPatterns: features.hasManyPatterns,
    hasStrongSuctionSignal: features.hasStrongSuctionSignal,
    hasGentleSignal: features.hasGentleSignal,
    hasStrongIntensitySignal: features.hasStrongIntensitySignal,
    evidence: features.evidence,
  };
}

export function buildBeuInsertCandidateRow(listItem: BeuListItem): BeuFemaleTargetRow {
  return {
    id: `beu-missing-${listItem.itemId}`,
    original_id: null,
    name: normalizeText(listItem.title),
    brand: BRAND_NAME,
    price: listItem.price == null ? null : String(listItem.price),
    material: null,
    gender: "female",
    physical_form: null,
    motor_type: null,
    appearance: null,
    image_url: listItem.imageUrl,
    raw_description: null,
    type_code: null,
    subtype_code: null,
    recommendation_features: null,
    link: listItem.href,
    product_link: listItem.href,
    product_name: normalizeText(listItem.title),
    product_price: listItem.price == null ? null : String(listItem.price),
    product_tags: [BRAND_NAME, "tmall", "female"],
    product_image: listItem.imageUrl,
  };
}

export function buildBeuFemaleProductPatch(row: BeuFemaleTargetRow, detail: BeuDetailFields): BeuFemaleProductPatch {
  const rawDescription = detail.rawDescription || row.raw_description || "";
  const physicalForm = inferPhysicalForm(row.name, rawDescription);
  const gender: ResolvedLibraryAudienceGender =
    resolveLibraryAudienceGender({
      gender: row.gender || "female",
      physicalForm,
      name: row.name,
      rawDescription,
      tags: row.product_tags ?? [],
    }) === "male"
      ? "female"
      : "female";
  const classifierInput = {
    gender,
    physicalForm,
    name: row.name,
    rawDescription,
    tags: row.product_tags ?? [],
  };
  const strongType = inferStrongBeuType(row.name, rawDescription);
  const classifiedTypeCode = classifyLibraryTypeCode(classifierInput);
  const typeCode = strongType?.typeCode ?? classifiedTypeCode;
  const classifiedSubtypeCode = classifyLibrarySubtypeCode({ ...classifierInput, typeCode });
  const subtypeCode =
    strongType?.subtypeCode ??
    (classifiedSubtypeCode && getParentLibraryTypeCodeForSubtype(classifiedSubtypeCode) === typeCode
      ? classifiedSubtypeCode
      : null);
  const material = inferMaterial(row, rawDescription, subtypeCode);
  const signalText = `${row.name}\n${detail.listTitle}\n${rawDescription}`;
  const powered = isPoweredToy(signalText, typeCode);

  const patchWithoutFeatures = {
    id: row.id,
    originalId: row.original_id,
    name: row.name,
    price: normalizeBeuPatchPrice(row, detail),
    material,
    gender,
    rawDescription,
    typeCode,
    subtypeCode,
    maxDb: powered ? inferMaxDb(rawDescription) ?? DEFAULT_POWERED_MAX_DB : null,
    waterproof: powered ? inferWaterproof(rawDescription) ?? DEFAULT_POWERED_WATERPROOF : null,
    appearance: inferAppearance(row.name, rawDescription),
    physicalForm,
    motorType: inferMotorType(row.name, rawDescription),
    imageUrl: detail.imageUrl || row.image_url || row.product_image || null,
    link: detail.finalUrl || row.link || row.product_link || itemUrlFromId(detail.itemId),
  };

  const productTags = [
    ...(row.product_tags ?? []),
    patchWithoutFeatures.typeCode,
    patchWithoutFeatures.subtypeCode,
    patchWithoutFeatures.material,
  ].filter((value): value is string => hasText(value));

  return {
    ...patchWithoutFeatures,
    productTags,
    recommendationFeatures: buildRecommendationFeatures(row, patchWithoutFeatures),
  };
}

function parseArgs(argv: string[]) {
  const itemIds = new Set<string>();
  let limit = DEFAULT_LIMIT;
  let apply = false;
  const waitLogin = shouldWaitForManualBeuLogin(argv);
  const insertMissing = shouldInsertMissingBeuProducts(argv);
  const missingOnly = shouldProcessOnlyMissingBeuProducts(argv);

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--apply") {
      apply = true;
      continue;
    }
    if (value === "--limit" && argv[index + 1]) {
      limit = Number(argv[index + 1]) || 0;
      index += 1;
      continue;
    }
    if (value === "--item-id" && argv[index + 1]) {
      itemIds.add(argv[index + 1]);
      index += 1;
      continue;
    }
    const id = value.match(/(?:^|[?&])id=(\d+)/)?.[1] || value.match(/^\d{8,}$/)?.[0];
    if (id) itemIds.add(id);
  }

  return { itemIds: [...itemIds], limit, apply, waitLogin, insertMissing, missingOnly };
}

async function readTargets(client: pg.PoolClient, itemIds: string[]) {
  const itemFilter =
    itemIds.length > 0
      ? `AND EXISTS (
          SELECT 1 FROM unnest($1::text[]) AS ids(item_id)
          WHERE COALESCE(t.link, p.link, '') LIKE '%' || ids.item_id || '%'
        )`
      : "";
  const queryParams = itemIds.length > 0 ? [itemIds] : [];
  const result = await client.query<BeuFemaleTargetRow>(
    `
      SELECT
        t.id::text,
        t.original_id::text,
        t.name,
        t.brand,
        t.price::text,
        t.material,
        t.gender,
        t.physical_form,
        t.motor_type,
        t.appearance,
        t.image_url,
        t.raw_description,
        t.type_code,
        t.subtype_code,
        t.recommendation_features,
        t.link,
        p.link AS product_link,
        p.name AS product_name,
        p.price::text AS product_price,
        p.tags AS product_tags,
        p.image AS product_image
      FROM public.female_recommender_toys AS t
      LEFT JOIN public.products AS p ON p.id = t.original_id
      WHERE (t.brand ILIKE 'beu' OR t.name ILIKE '%beu%' OR p.name ILIKE '%beu%')
        ${itemFilter}
      ORDER BY t.name
    `,
    queryParams,
  );
  return result.rows;
}

async function readExistingBeuItemIds(client: pg.PoolClient) {
  const result = await client.query<{ item_id: string }>(
    `
      SELECT DISTINCT item_id
      FROM (
        SELECT regexp_match(COALESCE(t.link, ''), 'id=([0-9]+)') AS match
        FROM public.female_recommender_toys AS t
        WHERE t.brand ILIKE 'beu' OR t.name ILIKE '%beu%'
        UNION ALL
        SELECT regexp_match(COALESCE(p.link, ''), 'id=([0-9]+)') AS match
        FROM public.products AS p
        WHERE p.name ILIKE '%beu%' OR p.link ILIKE '%beucryp%' OR p.link ILIKE '%detail.tmall.com/item.htm?id=%'
      ) AS matches,
      LATERAL (SELECT match[1] AS item_id) AS extracted
      WHERE match IS NOT NULL
        AND item_id IS NOT NULL
    `,
  );
  return new Set(result.rows.map((row) => row.item_id));
}

async function applyPatch(client: pg.PoolClient, patch: BeuFemaleProductPatch) {
  await client.query(
    `
      UPDATE public.female_recommender_toys
      SET
        brand = $2,
        price = $3,
        max_db = $4,
        waterproof = $5,
        appearance = $6,
        physical_form = $7,
        motor_type = $8,
        gender = $9,
        material = $10,
        link = $11,
        image_url = COALESCE($12, image_url),
        raw_description = $13,
        safe_display_name = $14,
        type_code = $15,
        subtype_code = $16,
        recommendation_features = $17::jsonb,
        updated_at = NOW()
      WHERE id = $1::uuid
    `,
    [
      patch.id,
      BRAND_NAME,
      patch.price,
      patch.maxDb,
      patch.waterproof,
      patch.appearance,
      patch.physicalForm,
      patch.motorType,
      patch.gender,
      patch.material,
      patch.link,
      patch.imageUrl,
      patch.rawDescription,
      buildSafeDisplayName(patch.name),
      patch.typeCode,
      patch.subtypeCode,
      JSON.stringify(patch.recommendationFeatures),
    ],
  );

  if (!patch.originalId) return;
  await client.query(
    `
      UPDATE public.products
      SET
        price = $2,
        image = COALESCE($3, image),
        link = $4,
        gender = $5,
        tags = $6,
        specs = jsonb_strip_nulls(
          COALESCE(specs::jsonb, '{}'::jsonb)
          || jsonb_build_object(
            'rawDescription', $7::text,
            'material', $8::text,
            'max_db', $9::int,
            'waterproof', $10::int,
            'appearance', $11::text,
            'physical_form', $12::text,
            'motor_type', $13::text,
            'type_code', $14::text,
            'subtype_code', $15::text
          )
        )
      WHERE id = $1::uuid
    `,
    [
      patch.originalId,
      patch.price,
      patch.imageUrl,
      patch.link,
      patch.gender.charAt(0).toUpperCase() + patch.gender.slice(1),
      patch.productTags,
      patch.rawDescription,
      patch.material,
      patch.maxDb,
      patch.waterproof,
      patch.appearance,
      patch.physicalForm,
      patch.motorType,
      patch.typeCode,
      patch.subtypeCode,
    ],
  );
}

async function findBeuCompetitorId(client: pg.PoolClient) {
  const result = await client.query<{ id: string }>(
    `
      SELECT id::text
      FROM public.competitors
      WHERE lower(name) = lower($1)
         OR lower(name) = 'beu必遇'
         OR lower(name) = '必遇'
      ORDER BY lower(name) = lower($1) DESC
      LIMIT 1
    `,
    [BRAND_NAME],
  );
  return result.rows[0]?.id ?? null;
}

async function insertPatch(client: pg.PoolClient, patch: BeuInsertPatch) {
  const duplicate = await client.query(
    `
      SELECT 1
      FROM public.female_recommender_toys AS t
      LEFT JOIN public.products AS p ON p.id = t.original_id
      WHERE COALESCE(t.link, p.link, '') LIKE $1
      LIMIT 1
    `,
    [`%${patch.itemId}%`],
  );
  if ((duplicate.rowCount ?? 0) > 0) {
    console.log(`[refresh-beu] 已存在 item=${patch.itemId}，跳过插入 ${patch.name}`);
    return false;
  }

  const competitorId = await findBeuCompetitorId(client);
  const productResult = await client.query<{ id: string }>(
    `
      INSERT INTO public.products (
        competitor_id,
        name,
        price,
        category,
        tags,
        link,
        image,
        gender,
        specs
      )
      VALUES (
        $1::uuid,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        jsonb_strip_nulls(
          jsonb_build_object(
            'rawDescription', $9::text,
            'material', $10::text,
            'max_db', $11::int,
            'waterproof', $12::int,
            'appearance', $13::text,
            'physical_form', $14::text,
            'motor_type', $15::text,
            'type_code', $16::text,
            'subtype_code', $17::text,
            'tmallItemId', $18::text
          )
        )
      )
      RETURNING id::text
    `,
    [
      competitorId,
      patch.name,
      patch.price,
      "female_toy",
      patch.productTags,
      patch.link,
      patch.imageUrl,
      "Female",
      patch.rawDescription,
      patch.material,
      patch.maxDb,
      patch.waterproof,
      patch.appearance,
      patch.physicalForm,
      patch.motorType,
      patch.typeCode,
      patch.subtypeCode,
      patch.itemId,
    ],
  );
  const productId = productResult.rows[0]?.id;
  if (!productId) throw new Error(`products 插入失败: ${patch.name}`);

  await client.query(
    `
      INSERT INTO public.female_recommender_toys (
        original_id,
        name,
        price,
        max_db,
        waterproof,
        appearance,
        physical_form,
        motor_type,
        gender,
        brand,
        material,
        image_url,
        raw_description,
        safe_display_name,
        type_code,
        subtype_code,
        recommendation_features,
        link
      )
      VALUES (
        $1::uuid,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        $15,
        $16,
        $17::jsonb,
        $18
      )
    `,
    [
      productId,
      patch.name,
      patch.price,
      patch.maxDb,
      patch.waterproof,
      patch.appearance,
      patch.physicalForm,
      patch.motorType,
      patch.gender,
      BRAND_NAME,
      patch.material,
      patch.imageUrl,
      patch.rawDescription,
      buildSafeDisplayName(patch.name),
      patch.typeCode,
      patch.subtypeCode,
      JSON.stringify(patch.recommendationFeatures),
      patch.link,
    ],
  );
  return true;
}

async function runRefreshBeuFemaleProducts() {
  const { itemIds, limit, apply, waitLogin, insertMissing, missingOnly } = parseArgs(process.argv.slice(2));
  const pool = new Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
  const client = await pool.connect();
  let targets: BeuFemaleTargetRow[] = [];
  try {
    targets = await readTargets(client, itemIds);
  } finally {
    client.release();
  }

  const browser = await chromium.launch({
    headless: process.env.TMALL_HEADLESS !== "false",
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
  await injectTmallCookies(context);
  const page = await context.newPage();

  const patches: BeuFemaleProductPatch[] = [];
  const inserts: BeuInsertPatch[] = [];
  const failures: Array<{ name: string; itemId: string; error: string }> = [];
  let toyItems: BeuListItem[] = [];
  let missingCandidates: BeuListItem[] = [];

  try {
    toyItems = await collectBeuListItems(page);
    const listByItemId = new Map(toyItems.map((item) => [item.itemId, item]));
    let existingItemIds = new Set(targets.map((target) => extractTmallItemIdForBeu(target.link || target.product_link)).filter(Boolean));
    if (insertMissing) {
      const reader = await pool.connect();
      try {
        existingItemIds = await readExistingBeuItemIds(reader);
      } finally {
        reader.release();
      }
    }

    const selectedTargets = (missingOnly ? [] : targets)
      .map((target) => {
        const itemId = extractTmallItemIdForBeu(target.link || target.product_link);
        return { target, itemId, listItem: listByItemId.get(itemId) };
      })
      .filter((entry) => entry.itemId && entry.listItem)
      .slice(0, limit > 0 ? limit : undefined);
    missingCandidates = insertMissing
      ? toyItems
          .filter((item) => !existingItemIds.has(item.itemId))
          .filter((item) => isBeuInsertableToyListTitle(item.title))
          .filter((item) => itemIds.length === 0 || itemIds.includes(item.itemId))
          .slice(0, limit > 0 ? limit : undefined)
      : [];

    console.log(
      JSON.stringify(
        {
          targets: targets.length,
          matched_existing_targets: selectedTargets.length,
          insert_missing: insertMissing,
          missing_candidates: missingCandidates.length,
          missing_candidate_samples: missingCandidates.slice(0, 20).map((item) => ({ itemId: item.itemId, title: item.title })),
          unmatched_existing_targets: targets
            .filter((target) => !listByItemId.has(extractTmallItemIdForBeu(target.link || target.product_link)))
            .map((target) => ({ name: target.name, itemId: extractTmallItemIdForBeu(target.link || target.product_link) })),
        },
        null,
        2,
      ),
    );

    const loginProbeUrl = selectedTargets[0]?.listItem?.href ?? missingCandidates[0]?.href;
    if (waitLogin && loginProbeUrl) {
      await waitForManualBeuLogin(page, loginProbeUrl);
    }

    for (const [index, entry] of selectedTargets.entries()) {
      const { target, itemId, listItem } = entry;
      if (!listItem) continue;
      console.log(`\n[refresh-beu] (${index + 1}/${selectedTargets.length}) ${target.name} | item=${itemId}`);
      try {
        const detail = await fetchDetailFieldsWithRetry(page, target, listItem);
        if (!detail) {
          failures.push({ name: target.name, itemId, error: "no useful detail" });
          continue;
        }
        const patch = buildBeuFemaleProductPatch(target, detail);
        patches.push(patch);
        console.log(`[refresh-beu] ${apply ? "待写入" : "预演"} ${target.name}: ${patch.typeCode}/${patch.subtypeCode || "-"} | ${patch.material}`);
        await humanizedWait(HUMAN_WAIT_RANGES.betweenItems, "商品间隔");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push({ name: target.name, itemId, error: message });
        console.warn(`[refresh-beu] 跳过 ${target.name}: ${message}`);
      }
    }

    for (const [index, listItem] of missingCandidates.entries()) {
      const target = buildBeuInsertCandidateRow(listItem);
      console.log(`\n[refresh-beu] 新增候选 (${index + 1}/${missingCandidates.length}) ${target.name} | item=${listItem.itemId}`);
      try {
        const detail = await fetchDetailFieldsWithRetry(page, target, listItem);
        if (!detail) {
          failures.push({ name: target.name, itemId: listItem.itemId, error: "no useful detail" });
          continue;
        }
        const patch = buildBeuFemaleProductPatch(target, detail) as BeuInsertPatch;
        patch.itemId = listItem.itemId;
        inserts.push(patch);
        console.log(`[refresh-beu] ${apply ? "待插入" : "预演插入"} ${target.name}: ${patch.typeCode}/${patch.subtypeCode || "-"} | ${patch.material}`);
        await humanizedWait(HUMAN_WAIT_RANGES.betweenItems, "商品间隔");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push({ name: target.name, itemId: listItem.itemId, error: message });
        console.warn(`[refresh-beu] 跳过新增 ${target.name}: ${message}`);
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  let inserted = 0;
  if (apply && (patches.length || inserts.length)) {
    const writer = await pool.connect();
    try {
      await writer.query("BEGIN");
      await writer.query("SET statement_timeout TO 0");
      await writer.query("SET lock_timeout TO '5s'");
      for (const patch of patches) await applyPatch(writer, patch);
      for (const patch of inserts) {
        const didInsert = await insertPatch(writer, patch);
        if (didInsert) inserted += 1;
      }
      await writer.query("COMMIT");
    } catch (error) {
      await writer.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      writer.release();
    }
  }

  await pool.end();
  console.log(
    JSON.stringify(
      {
        apply,
        target_url: TARGET_URL,
        list_toy_items: toyItems.length,
        existing_targets: targets.length,
        patched: patches.length,
        insert_missing: insertMissing,
        missing_candidates: missingCandidates.length,
        insert_patches: inserts.length,
        inserted,
        updated: apply ? patches.length : 0,
        failures,
        sample: patches.map((patch) => ({
          name: patch.name,
          price: patch.price,
          type_code: patch.typeCode,
          subtype_code: patch.subtypeCode,
          material: patch.material,
          max_db: patch.maxDb,
          waterproof: patch.waterproof,
        })),
        inserted_sample: inserts.map((patch) => ({
          name: patch.name,
          itemId: patch.itemId,
          price: patch.price,
          type_code: patch.typeCode,
          subtype_code: patch.subtypeCode,
          material: patch.material,
          max_db: patch.maxDb,
          waterproof: patch.waterproof,
        })),
      },
      null,
      2,
    ),
  );
}

export function shouldRunBeuRefreshScript(importMetaUrl: string, argvEntry?: string) {
  if (!argvEntry) return false;
  return fileURLToPath(importMetaUrl) === argvEntry;
}

if (shouldRunBeuRefreshScript(import.meta.url, process.argv[1])) {
  runRefreshBeuFemaleProducts().catch((error) => {
    console.error("[refresh-beu-female-products-from-tmall] 执行失败:", error);
    process.exitCode = 1;
  });
}
