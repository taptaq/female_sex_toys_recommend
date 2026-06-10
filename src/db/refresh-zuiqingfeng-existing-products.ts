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
} from "../scraper/zuiqingfeng/param-extraction.ts";
import { tryRevealTmallParamTabs } from "../scraper/zuiqingfeng/tmall-param-ui.ts";

dotenv.config();

const { Pool } = pg;
const BRAND_NAME = "醉清风-谜姬";
const DEFAULT_WARMUP_URL =
  "https://mizzzeegf.tmall.com/search.htm?spm=a1z10.1-b-s.w5002-25911219286.1.303c6a96zTVEfL&search=y";
const DEFAULT_LIMIT = Number(process.env.ZUIQINGFENG_REFRESH_LIMIT || "0");
const MAX_OCR_IMAGES = Number(process.env.ZUIQINGFENG_REFRESH_MAX_OCR_IMAGES || "8");
const DETAIL_RETRY_COUNT = Math.max(1, Number(process.env.ZUIQINGFENG_REFRESH_RETRY_COUNT || "2"));
const RAW_DESCRIPTION_LIMIT = 5000;
const DEFAULT_POWERED_MAX_DB = 50;
const DEFAULT_POWERED_WATERPROOF = 7;

export function resolveZuiqingfengHumanWaitRanges(env: Record<string, string | undefined> = process.env) {
  return {
    detailWaitRange: parseDelayRange(env.ZUIQINGFENG_REFRESH_DETAIL_WAIT_MS, { minMs: 9000, maxMs: 18000 }),
    betweenItemsRange: parseDelayRange(env.ZUIQINGFENG_REFRESH_BETWEEN_ITEMS_MS, { minMs: 22000, maxMs: 52000 }),
    warmupWaitRange: parseDelayRange(env.ZUIQINGFENG_REFRESH_WARMUP_WAIT_MS, { minMs: 12000, maxMs: 26000 }),
    detailScrollPauseRange: parseDelayRange(env.ZUIQINGFENG_REFRESH_DETAIL_SCROLL_PAUSE_MS, {
      minMs: 1200,
      maxMs: 3200,
    }),
    warmupScrollPauseRange: parseDelayRange(env.ZUIQINGFENG_REFRESH_WARMUP_SCROLL_PAUSE_MS, {
      minMs: 1800,
      maxMs: 4200,
    }),
  };
}

const HUMAN_WAIT_RANGES = resolveZuiqingfengHumanWaitRanges();

export type ZuiqingfengTableName = "recommender_toys" | "female_recommender_toys";

export type ZuiqingfengTargetRow = {
  table_name: ZuiqingfengTableName;
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

export type ZuiqingfengDetailFields = {
  itemId: string;
  finalUrl: string;
  price: number | null;
  imageUrl: string | null;
  rawDescription: string;
};

export type ZuiqingfengExistingProductPatch = {
  tableName: ZuiqingfengTableName;
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

function normalizeText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function hasText(value: unknown) {
  return normalizeText(value).length > 0;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type DelayRange = {
  minMs: number;
  maxMs: number;
};

export function parseDelayRange(value: string | undefined, fallback: DelayRange): DelayRange {
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

export function getHumanizedDelayMs(range: DelayRange, random: () => number = Math.random) {
  const minMs = Math.max(0, Math.floor(range.minMs));
  const maxMs = Math.max(minMs, Math.floor(range.maxMs));
  const ratio = Math.min(1, Math.max(0, random()));
  return Math.round(minMs + (maxMs - minMs) * ratio);
}

async function humanizedWait(range: DelayRange, label: string) {
  const delayMs = getHumanizedDelayMs(range);
  console.log(`[refresh-zuiqingfeng] ${label} 等待 ${delayMs}ms`);
  await sleep(delayMs);
}

async function closeBrowserWithTimeout(browser: Awaited<ReturnType<typeof chromium.launch>>, timeoutMs = 10_000) {
  await Promise.race([
    browser.close(),
    sleep(timeoutMs).then(() => {
      console.warn(`[refresh-zuiqingfeng] browser.close 超过 ${timeoutMs}ms，继续写库收尾`);
    }),
  ]).catch(() => {});
}

async function humanizedBrowseDetail(page: Page) {
  await humanizedWait(HUMAN_WAIT_RANGES.detailWaitRange, "详情页首屏");
  const scrollRounds = 5 + Math.floor(Math.random() * 5);
  for (let index = 0; index < scrollRounds; index += 1) {
    const distance = 320 + Math.floor(Math.random() * 780);
    await page.mouse
      .move(240 + Math.random() * 720, 220 + Math.random() * 420, { steps: 8 + Math.floor(Math.random() * 18) })
      .catch(() => {});
    await page.evaluate((scrollY) => window.scrollBy(0, scrollY), distance);
    await sleep(getHumanizedDelayMs(HUMAN_WAIT_RANGES.detailScrollPauseRange));
  }
}

export function resolveZuiqingfengWarmupUrl(env: Record<string, string | undefined> = process.env) {
  return normalizeText(env.ZUIQINGFENG_WARMUP_URL) || DEFAULT_WARMUP_URL;
}

async function warmupZuiqingfengShop(page: Page) {
  const warmupUrl = resolveZuiqingfengWarmupUrl();
  console.log(`[refresh-zuiqingfeng] warm-up 店铺页: ${warmupUrl}`);
  await page.goto(warmupUrl, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch((error) => {
    console.warn(`[refresh-zuiqingfeng] warm-up 访问失败: ${error instanceof Error ? error.message : String(error)}`);
  });
  await humanizedWait(HUMAN_WAIT_RANGES.warmupWaitRange, "店铺页");
  for (let index = 0; index < 4; index += 1) {
    await page.mouse
      .move(260 + Math.random() * 700, 220 + Math.random() * 380, { steps: 10 + Math.floor(Math.random() * 16) })
      .catch(() => {});
    await page.evaluate(() => window.scrollBy(0, 360 + Math.floor(Math.random() * 720))).catch(() => {});
    await sleep(getHumanizedDelayMs(HUMAN_WAIT_RANGES.warmupScrollPauseRange));
  }
}

export function extractTmallItemIdFromLink(rawLink: string | null | undefined) {
  const link = normalizeText(rawLink);
  if (!link) return "";
  try {
    const parsed = new URL(link.startsWith("//") ? `https:${link}` : link);
    return parsed.searchParams.get("id")?.trim() || "";
  } catch {
    return link.match(/[?&]id=(\d+)/)?.[1] || "";
  }
}

function normalizeTmallUrl(rawLink: string | null | undefined) {
  const link = normalizeText(rawLink);
  if (!link) return "";
  return link.startsWith("//") ? `https:${link}` : link;
}

function itemUrlFromId(itemId: string) {
  return `https://detail.tmall.com/item.htm?id=${encodeURIComponent(itemId)}`;
}

function parseNumber(value: unknown) {
  const match = normalizeText(value).replace(/[,，]/g, "").match(/([1-9]\d{0,5}(?:\.\d{1,2})?)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePrice(value: unknown) {
  const candidates = Array.from(normalizeText(value).matchAll(/(?:¥|￥|价格|券后|到手价|售价)?\s*([1-9]\d{0,5}(?:\.\d{1,2})?)/g))
    .map((match) => Number(match[1]))
    .filter((price) => Number.isFinite(price) && price > 0 && price < 100000);
  return candidates.length ? Math.min(...candidates) : null;
}

function parseStoredPrice(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function normalizeFetchedPriceForZuiqingfeng(
  rawPriceText: string,
  {
    currentPrice,
    productPrice,
    detailPrice,
  }: { currentPrice: number | null; productPrice: number | null; detailPrice: number | null },
) {
  const parsed = detailPrice ?? parsePrice(rawPriceText);
  const referencePrice = currentPrice ?? productPrice;

  if (!parsed) return productPrice ?? currentPrice ?? null;
  if (referencePrice && parsed < referencePrice * 0.25) return referencePrice;
  if (referencePrice && parsed > referencePrice * 3) return referencePrice;
  return parsed;
}

function normalizeFetchedPrice(rawPriceText: string, row: ZuiqingfengTargetRow, detailPrice: number | null) {
  return normalizeFetchedPriceForZuiqingfeng(rawPriceText, {
    currentPrice: parseStoredPrice(row.price),
    productPrice: parseStoredPrice(row.product_price),
    detailPrice,
  });
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
    console.warn("[refresh-zuiqingfeng] TMALL_COOKIE 为空，详情页可能进入登录/风控页。");
    return;
  }

  const cookies = parseTmallCookieHeader(cookieHeader);
  if (!cookies.length) return;
  await context.addCookies(cookies);
  console.log(`[refresh-zuiqingfeng] 已注入 TMALL_COOKIE: ${cookies.length} 条`);
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
        !/淘宝网首页|已买到的宝贝|我的淘宝|购物车|收藏夹|免费开店|千牛卖家中心|帮助中心|本店推荐|看了又看|用户评价|查看全部评价|规则协议|平台服务协议|新手上路|天猫开店|商家服务|付款方式|快捷支付|余额宝|阿里巴巴集团|Taobao\.com|版权所有|增值电信业务|互联网药品信息服务|网站无障碍|网页无障碍/i.test(
          line,
        ),
    )
    .filter((line) =>
      /参数信息|图文详情|产地|品牌|品名|材质|厂商|生产企业|颜色分类|保修|质保|情趣用品|女用|女性|男用|男性|夫妻|情侣|四爱|女攻|阳具|飞机杯|跳蛋|吮吸|伸缩|震动|振动|遥控|穿戴|内衣|睡衣|蕾丝|润滑|安全套|护理|束缚|手铐|高潮|阴蒂|g点|后庭|前列腺/i.test(
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
  if (hasText(ocrText)) {
    sections.push(`[图文提取]\n${ocrText}`);
  }
  const pageFallbackText = extractUsefulPageFallbackText(pageText);
  if (hasText(pageFallbackText)) {
    sections.push(`[页面文本]\n${pageFallbackText}`);
  }
  return sections.join("\n\n").slice(0, RAW_DESCRIPTION_LIMIT).trim();
}

export function buildZuiqingfengDetailRawDescription(
  paramPairs: Array<[string, string]>,
  ocrText: string,
  pageText: string,
) {
  return buildRawDescription(paramPairs, ocrText, pageText);
}

function hasUsefulRawDescription(rawDescription: string) {
  const usefulText = normalizeText(rawDescription.replace(/未提及/g, "").replace(/\[图文提取\]|\[参数信息\]/g, ""));
  if (usefulText.length < 60) return false;
  return /产品|型号|品名|品牌|生产企业|情趣用品|用品|材质|硅胶|软胶|tpe|abs|震动|振动|吮吸|吸吮|旋转|伸缩|加热|防水|分贝|充电|卖点|按摩|入体|跳蛋|飞机杯|阳具|四爱|女攻|安全套|润滑|内衣|蕾丝|网纱|套装|皮革|束缚/i.test(
    usefulText,
  );
}

function isTmallBlockedText(text: string) {
  return /unusual traffic|slide to verify|滑动验证|滑动一下|验证码|密码登录|短信登录|免费注册/i.test(text);
}

export function shouldRetryZuiqingfengDetailFailure(errorMessage: string) {
  return /登录|风控|no useful detail|net::|timeout|Timeout|Navigation|Target closed|has been closed/i.test(errorMessage);
}

function isBrowserClosedError(errorMessage: string) {
  return /Target page, context or browser has been closed|Target closed|Browser has been closed/i.test(errorMessage);
}

export function isUnavailableTmallItemPage({ url, text }: { url: string; text: string }) {
  return (
    /error\.item\.taobao\.com\/error\/noitem|type=noitem/i.test(url) ||
    /宝贝不存在|商品不存在|已下架|被转移|查看的宝贝不存在|item has been removed/i.test(text)
  );
}

function normalizeMatchText(value: string) {
  return normalizeText(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function extractMatchTokens(value: string) {
  const normalized = normalizeMatchText(value);
  const tokens = new Set<string>();
  const strongWords = [
    "kisstoy",
    "polly",
    "tenga",
    "4i",
    "mizzzee",
    "谜姬",
    "醉清风",
    "小鲸鱼",
    "海豚",
    "双头龙",
    "女攻",
    "四爱",
    "新娘",
    "制服",
    "内衣",
    "睡衣",
    "芦荟",
    "润滑",
    "安全套",
    "飞机杯",
  ];
  for (const word of strongWords) {
    if (normalized.includes(normalizeMatchText(word))) tokens.add(normalizeMatchText(word));
  }
  for (const chunk of normalized.match(/[a-z][a-z0-9]{2,}/g) ?? []) {
    if (!/tmall|taobao|https|item|detail|com/.test(chunk)) tokens.add(chunk);
  }
  return [...tokens].filter((token) => token.length >= 2);
}

export function isDetailLikelyForZuiqingfengTarget(row: ZuiqingfengTargetRow, rawDescription: string) {
  const detailText = normalizeMatchText(rawDescription);
  if (!detailText) return false;
  if (/淘宝网首页|本店推荐|看了又看|用户评价/.test(rawDescription) && !/\[图文提取\]/.test(rawDescription)) return false;

  const titleTokens = extractMatchTokens(`${row.name}\n${row.product_name || ""}`);
  const matchedTokens = titleTokens.filter((token) => detailText.includes(token));
  if (matchedTokens.length > 0) return true;

  const rowTitle = normalizeMatchText(row.name);
  if (/霏慕|feeetmoi|6909|jk套装|连体式/.test(rawDescription) && !/霏慕|6909|jk|内衣|睡衣|制服/.test(rowTitle)) {
    return false;
  }
  if (/内衣|睡衣|制服|丝袜|蕾丝|开裆|透视/.test(rowTitle) && /智能ai|ai对话|智能对话|触摸发音|娃娃|螺钉安装/.test(detailText)) {
    return false;
  }
  if (
    /猫爪|女用|女性|女生|外出穿戴|远程遥控/.test(rowTitle) &&
    /羊眼圈|锁精环|阴茎|鸡鸡套|肉刺羊眼圈|cockring|cock_ring/.test(detailText)
  ) {
    return false;
  }
  if (/女用|女性|女生|吮吸|舌舔|g点|内衣|睡衣|制服|连体衣|霏慕/.test(rowTitle) && /马眼|尿道|龟头|男士下体|飞机杯|男用品/.test(detailText)) {
    return false;
  }
  if (/喵喜|月下兔|萌小兔/.test(rowTitle) && /悦己悦爱|限定浪漫礼盒|礼盒情趣用品套装|知趣卡牌/.test(detailText)) {
    return false;
  }

  if (/kisstoy|polly|小鲸鱼|海豚|tenga|4i/.test(rowTitle)) return false;
  return hasUsefulRawDescription(rawDescription);
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

async function fetchDetailFields(page: Page, row: ZuiqingfengTargetRow, itemId: string): Promise<ZuiqingfengDetailFields | null> {
  const url = normalizeTmallUrl(row.link) || normalizeTmallUrl(row.product_link) || itemUrlFromId(itemId);
  if (!url) return null;

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await humanizedBrowseDetail(page);
  await tryRevealTmallParamTabs(page).catch(() => {});
  await humanizedWait({ minMs: 900, maxMs: 1800 }, "参数区");

  const signals = await extractPageSignals(page);
  if (isTmallBlockedText(signals.text)) {
    throw new Error("详情页疑似登录/风控页面");
  }
  if (isUnavailableTmallItemPage({ url: page.url(), text: signals.text })) {
    throw new Error("详情页商品不存在或已下架");
  }

  const paramPairs = normalizeParamPairs([
    ...extractParamPairsFromPageHtml(signals.html),
    ...extractParamPairsFromLooseJsonText(signals.html),
    ...extractParamPairsFromCompactText(signals.text),
  ]);
  const imageUrls = filterDetailImageUrls(signals.imageUrls);

  let ocrText = "";
  try {
    ocrText = await ocrWithGLM(imageUrls, row.product_name || row.name);
  } catch (error) {
    console.warn(
      `[refresh-zuiqingfeng] OCR 失败，使用参数/页面文本兜底: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const rawDescription = buildZuiqingfengDetailRawDescription(paramPairs, ocrText, signals.text);
  if (!hasUsefulRawDescription(rawDescription)) return null;
  if (!isDetailLikelyForZuiqingfengTarget(row, rawDescription)) {
    throw new Error("详情内容与目标商品标题不匹配");
  }

  return {
    itemId,
    finalUrl: page.url() || url,
    price: normalizeFetchedPrice(signals.priceText, row, null),
    imageUrl: imageUrls[0] ?? row.image_url ?? row.product_image ?? null,
    rawDescription,
  };
}

async function fetchDetailFieldsWithRetry(
  page: Page,
  row: ZuiqingfengTargetRow,
  itemId: string,
): Promise<ZuiqingfengDetailFields | null> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= DETAIL_RETRY_COUNT; attempt += 1) {
    try {
      const detail = await fetchDetailFields(page, row, itemId);
      if (detail) return detail;
      lastError = new Error("no useful detail");
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    const message = lastError?.message || "unknown detail failure";
    if (isBrowserClosedError(message)) throw lastError;
    if (attempt >= DETAIL_RETRY_COUNT || !shouldRetryZuiqingfengDetailFailure(message)) {
      if (message === "no useful detail") return null;
      throw lastError;
    }

    console.warn(`[refresh-zuiqingfeng] ${row.name} 详情失败，重试 ${attempt}/${DETAIL_RETRY_COUNT}: ${message}`);
    await warmupZuiqingfengShop(page);
  }

  return null;
}

function inferStrongTitleGender(text: string): ResolvedLibraryAudienceGender | null {
  if (/避孕套|安全套|保险套|condom/i.test(text)) return "unisex";
  if (/润滑液|润滑剂|润滑油|水基|水溶|精油|护理液|lube/i.test(text)) {
    if (/女性|女用|女生/i.test(text)) return "female";
    if (/男性|男用|男士|男用品/i.test(text)) return "male";
    return "unisex";
  }
  if (/女用|女性|女生|女攻|女性自插|阴蒂|外阴|g点|g-spot|跳蛋|吮吸器|震动棒|自慰器|兔耳|兔子/i.test(text)) {
    return "female";
  }
  if (/飞机杯|自慰杯|男用杯|男用|男用品|男士|男性|阴茎|鸡鸡|龟头|包皮|前列腺|伪娘|gay|后庭|肛门|开肛|插屁股|名器|倒模|圣杯/i.test(text)) {
    return "male";
  }
  if (/情侣|夫妻|双人|伴侣|共用|couples?/i.test(text)) return "unisex";
  return null;
}

function hasPoweredSignal(text: string) {
  return /电动|自动|全自动|震动|振动|加热|伸缩|旋转|充电|遥控|远程|app|马达|powered|vibrat/i.test(text);
}

function inferStrongTypeFromTitle(text: string, gender: ResolvedLibraryAudienceGender) {
  if (/避孕套|安全套|保险套|condom/i.test(text)) return { typeCode: "care_accessory", subtypeCode: "condom" };
  if (
    /润滑液|润滑剂|润滑油|润滑|水基|水溶|精油|油剂|延时喷|延迟喷|喷剂|喷雾|湿巾|神油|护理液|增强液|快感膏|按摩膏|奶膏|乳膏|爽乳膏|lube/i.test(
      text,
    )
  ) {
    return { typeCode: "care_accessory", subtypeCode: "lube_care" };
  }
  if (/内衣|睡衣|连体衣|丝袜|蕾丝|网纱|制服|lingerie/i.test(text)) {
    return { typeCode: "care_accessory", subtypeCode: "lingerie" };
  }
  if (/吮吸|吸吮|气脉冲|阴蒂吸|suction/i.test(text)) {
    return { typeCode: "suction", subtypeCode: /入体|伸缩|g点|g-spot|双/i.test(text) ? "suction_dual" : "suction_pure" };
  }
  if (gender !== "male") return null;
  if (/包皮|锁精环|阻复环|阴茎环|鸡鸡套|羊眼圈|cock\s*ring/i.test(text)) {
    return { typeCode: "cock_ring", subtypeCode: hasPoweredSignal(text) ? "vibrating_cock_ring" : "classic_cock_ring" };
  }
  if (/前列腺|后庭|肛门|开肛|插屁股|肛塞|gay|伪娘|马眼棒|prostate|p-spot/i.test(text)) {
    return { typeCode: "prostate", subtypeCode: hasPoweredSignal(text) ? "prostate_vibe" : "prostate_plug" };
  }
  if (/飞机杯|自慰杯|男用杯|名器|倒模|真实阴道|臀膜|圣杯|男性玩具|男用|男用品|masturbator|stroker/i.test(text)) {
    return { typeCode: "masturbator", subtypeCode: hasPoweredSignal(text) ? "vibrating_masturbator" : "manual_masturbator" };
  }
  return null;
}

function adjustFemaleExplicitTypeFromTitle(
  name: string,
  typeCode: string,
  subtypeCode: string | null,
): { typeCode: string; subtypeCode: string | null } {
  if (!/女用|女性|女生|女攻|女士|阴蒂|外出穿戴|穿戴|遥控|远程|g点|入体|伸缩/i.test(name)) {
    return { typeCode, subtypeCode };
  }
  if (!/^(cock_ring|prostate|masturbator)$/.test(typeCode)) return { typeCode, subtypeCode };
  if (/穿戴|遥控|远程/i.test(name)) return { typeCode: "wearable_remote", subtypeCode: "insertable_remote" };
  if (/伸缩|入体|g点|双|吮吸/i.test(name)) return { typeCode: "dual_stimulation", subtypeCode: "suction_dual" };
  return { typeCode: "insertable", subtypeCode: null };
}

function extractLabeledMaterial(rawDescription: string) {
  const candidates = [
    rawDescription.match(/(?:^|\n)\s*材质\s*[:：]\s*([^\n]+)/)?.[1],
    rawDescription.match(/(?:^|\n)\s*(?:\d+\.\s*)?内部构造\/材质\s*[:：]\s*([^\n]+)/)?.[1],
    rawDescription.match(/(?:^|\n)\s*(?:\d+\.\s*)?材质\/面料\/成分\s*[:：]\s*([^\n]+)/)?.[1],
    rawDescription.match(/(?:^|\n)\s*(?:\d+\.\s*)?材质\/面料\s*[:：]\s*([^\n]+)/)?.[1],
  ];
  return candidates.map(normalizeText).find((value) => value && !/未提及|控制类型|是否含润滑液/.test(value)) || "";
}

function inferMaterial(row: ZuiqingfengTargetRow, rawDescription: string, subtypeCode: string | null) {
  const text = `${row.name}\n${rawDescription}`;
  const labeled = extractLabeledMaterial(rawDescription);
  const source = `${labeled}\n${text}`;

  if (subtypeCode === "condom") return "天然橡胶乳胶";
  if (subtypeCode === "lube_care") {
    if (/硅基/i.test(source)) return "硅基润滑液";
    if (/精油|按摩油/i.test(source)) return "精油润滑液";
    if (/喷剂|喷雾|延时|延迟|神油/i.test(source)) return "延时护理配方";
    if (/增强液|快感膏|按摩膏|奶膏|乳膏|爽乳膏/i.test(source)) return "护理膏剂";
    if (/湿巾/i.test(source)) return "湿巾护理配方";
    return "水基润滑液";
  }
  if (subtypeCode === "lingerie") return "纺织面料";
  if (/tpe|tpr|软胶|倒模|名器|飞机杯/i.test(source)) return "TPE/软胶";
  if (/abs/i.test(source) && /硅胶|silicone/i.test(source)) return "硅胶/ABS";
  if (/亲肤硅胶/i.test(source)) return "亲肤硅胶";
  if (/硅胶|silicone/i.test(source)) return "亲肤硅胶";
  if (/皮革|人造皮革|pu/i.test(source)) return "皮革/织物复合";
  if (/金属|不锈钢/i.test(source)) return "金属";
  return hasText(row.material) ? normalizeText(row.material) : "亲肤硅胶";
}

function inferPhysicalForm(name: string, rawDescription: string): ZuiqingfengExistingProductPatch["physicalForm"] {
  const source = `${name}\n${rawDescription}`;
  const hasInternal = /入体|插入|g点|阴道|飞机杯|倒模|名器|包裹|伸缩|internal|insert/i.test(source);
  const hasExternal = /阴蒂|外部|跳蛋|按摩棒|吮吸|吸吮|乳夹|束缚|项圈|手铐|external|clitoral|suction/i.test(source);
  if (hasInternal && hasExternal) return "composite";
  if (hasInternal) return "internal";
  return "external";
}

function inferMotorType(name: string, rawDescription: string): ZuiqingfengExistingProductPatch["motorType"] {
  return /强劲|强力|高频|暴风|伸缩|爆发|大吸力|强震|powerful|strong/i.test(`${name}\n${rawDescription}`)
    ? "strong"
    : "gentle";
}

function inferAppearance(name: string, rawDescription: string): ZuiqingfengExistingProductPatch["appearance"] {
  return /口红|迷你|小巧|便携|隐形|伪装|discreet|lipstick/i.test(`${name}\n${rawDescription}`)
    ? "high_disguise"
    : "normal";
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

function isNonPoweredType(typeCode: string | null) {
  return !typeCode || typeCode === "unknown" || typeCode === "care_accessory" || typeCode === "bdsm";
}

function isPoweredToy(text: string, typeCode: string | null) {
  if (isNonPoweredType(typeCode)) return false;
  if (/手动|免电|非电动|manual|non[-\s]?powered/i.test(text)) return false;
  return hasPoweredSignal(text);
}

function buildProductForFeatures(row: ZuiqingfengTargetRow, patch: Omit<ZuiqingfengExistingProductPatch, "recommendationFeatures" | "productTags">): Product {
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
    brand: row.brand ?? BRAND_NAME,
    material: patch.material,
    imagePlaceholder: patch.imageUrl ?? row.image_url ?? row.product_image ?? "",
    rawDescription: patch.rawDescription,
    tags: [row.product_tags ?? [], patch.typeCode, patch.subtypeCode, patch.material].flat().filter(Boolean) as string[],
  };
}

function buildRecommendationFeatures(row: ZuiqingfengTargetRow, patch: Omit<ZuiqingfengExistingProductPatch, "recommendationFeatures" | "productTags">) {
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

export function buildZuiqingfengExistingProductPatch(
  row: ZuiqingfengTargetRow,
  detail: ZuiqingfengDetailFields,
): ZuiqingfengExistingProductPatch {
  const rawDescription = detail.rawDescription || row.raw_description || "";
  const titleText = `${row.name}\n${row.product_name || ""}`;
  const signalText = `${titleText}\n${rawDescription}\n${(row.product_tags || []).join("\n")}`;
  const physicalForm = inferPhysicalForm(row.name, rawDescription);
  const gender =
    inferStrongTitleGender(row.name) ??
    inferStrongTitleGender(titleText) ??
    resolveLibraryAudienceGender({
      gender: row.gender,
      physicalForm,
      name: row.name,
      rawDescription,
      tags: row.product_tags ?? [],
    });
  const classifiedTypeCode = classifyLibraryTypeCode({
    gender,
    physicalForm,
    name: row.name,
    rawDescription,
    tags: row.product_tags ?? [],
  });
  const classifiedSubtypeCode = classifyLibrarySubtypeCode({
    gender,
    physicalForm,
    name: row.name,
    rawDescription,
    tags: row.product_tags ?? [],
    typeCode: classifiedTypeCode,
  });
  const titleOverride = inferStrongTypeFromTitle(titleText, gender);
  const subtypeCode = titleOverride?.subtypeCode ?? classifiedSubtypeCode;
  const typeCode =
    titleOverride?.typeCode ??
    (subtypeCode ? getParentLibraryTypeCodeForSubtype(subtypeCode) || classifiedTypeCode : classifiedTypeCode);
  const adjustedType = adjustFemaleExplicitTypeFromTitle(row.name, typeCode, subtypeCode);
  const resolvedTypeCode = adjustedType.typeCode;
  const resolvedSubtypeCode = adjustedType.subtypeCode;
  const resolvedGender = resolvedTypeCode === "care_accessory" ? "unisex" : gender;
  const powered = isPoweredToy(signalText, resolvedTypeCode);
  const material = inferMaterial(row, rawDescription, resolvedSubtypeCode);

  const patchWithoutFeatures = {
    tableName: row.table_name,
    id: row.id,
    originalId: row.original_id,
    name: row.name,
    price: detail.price ?? parseStoredPrice(row.price) ?? parseStoredPrice(row.product_price),
    material,
    gender: resolvedGender,
    rawDescription,
    typeCode: resolvedTypeCode,
    subtypeCode: resolvedSubtypeCode,
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

export function shouldRunZuiqingfengRefreshScript(importMetaUrl: string, argvEntry?: string) {
  if (!argvEntry) return false;
  return fileURLToPath(importMetaUrl) === argvEntry;
}

function parseArgs(argv: string[]) {
  const itemIds = new Set<string>();
  let limit = DEFAULT_LIMIT;
  let apply = false;

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

  return { itemIds: [...itemIds], limit, apply };
}

async function readTargets(client: pg.PoolClient, itemIds: string[], limit: number) {
  const itemFilter =
    itemIds.length > 0
      ? `AND EXISTS (
          SELECT 1 FROM unnest($1::text[]) AS ids(item_id)
          WHERE COALESCE(t.link, p.link, '') LIKE '%' || ids.item_id || '%'
        )`
      : "";
  const limitClause = limit > 0 ? `LIMIT ${Math.floor(limit)}` : "";

  const queryParams = itemIds.length > 0 ? [itemIds] : [];
  const result = await client.query<ZuiqingfengTargetRow>(
    `
      WITH targets AS (
        SELECT
          'recommender_toys'::text AS table_name,
          t.id,
          t.original_id,
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
        FROM public.recommender_toys AS t
        LEFT JOIN public.products AS p ON p.id = t.original_id
        WHERE (t.brand ILIKE '%谜姬%' OR t.brand ILIKE '%醉清风%' OR t.name ILIKE '%谜姬%' OR t.name ILIKE '%醉清风%')
          AND COALESCE(t.link, p.link, '') LIKE '%detail.tmall.com/item.htm%'
          ${itemFilter}

        UNION ALL

        SELECT
          'female_recommender_toys'::text AS table_name,
          t.id,
          t.original_id,
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
        WHERE (t.brand ILIKE '%谜姬%' OR t.brand ILIKE '%醉清风%' OR t.name ILIKE '%谜姬%' OR t.name ILIKE '%醉清风%')
          AND COALESCE(t.link, p.link, '') LIKE '%detail.tmall.com/item.htm%'
          ${itemFilter}
      )
      SELECT * FROM targets
      ORDER BY table_name, name
      ${limitClause}
    `,
    queryParams,
  );

  return result.rows.map((row) => ({
    ...row,
    table_name: row.table_name as ZuiqingfengTableName,
  }));
}

async function applyPatch(client: pg.PoolClient, patch: ZuiqingfengExistingProductPatch) {
  const tableName = patch.tableName;
  if (tableName !== "recommender_toys" && tableName !== "female_recommender_toys") {
    throw new Error(`Unsupported table: ${tableName}`);
  }

  await client.query(
    `
      UPDATE public.${tableName}
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

async function refreshZuiqingfengExistingProducts() {
  const { itemIds, limit, apply } = parseArgs(process.argv.slice(2));
  const pool = new Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
  const client = await pool.connect();
  let targets: ZuiqingfengTargetRow[] = [];
  try {
    targets = await readTargets(client, itemIds, limit);
  } finally {
    client.release();
  }

  if (targets.length === 0) {
    await pool.end();
    console.log(JSON.stringify({ apply, targets: 0, updated: 0, failures: [] }, null, 2));
    return;
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
  let page = await context.newPage();
  await warmupZuiqingfengShop(page);

  const detailCache = new Map<string, ZuiqingfengDetailFields | null>();
  const patches: ZuiqingfengExistingProductPatch[] = [];
  const failures: Array<{ table: string; name: string; itemId: string; error: string }> = [];

  try {
    for (const [index, target] of targets.entries()) {
      const link = normalizeTmallUrl(target.link) || normalizeTmallUrl(target.product_link);
      const itemId = extractTmallItemIdFromLink(link);
      console.log(`\n[refresh-zuiqingfeng] (${index + 1}/${targets.length}) ${target.table_name} | ${target.name} | item=${itemId || "missing"}`);

      if (page.isClosed()) {
        console.warn("[refresh-zuiqingfeng] 当前页面已关闭，重新打开页面并 warm-up 后继续。");
        page = await context.newPage();
        await warmupZuiqingfengShop(page);
      }

      if (!itemId) {
        failures.push({ table: target.table_name, name: target.name, itemId: "", error: "missing item id" });
        continue;
      }

      try {
        if (page.isClosed()) {
          throw new Error("Target page, context or browser has been closed");
        }
        if (!detailCache.has(itemId)) {
          detailCache.set(itemId, await fetchDetailFieldsWithRetry(page, target, itemId));
          await humanizedWait(HUMAN_WAIT_RANGES.betweenItemsRange, "商品间隔");
        }
        const detail = detailCache.get(itemId);
        if (!detail) {
          failures.push({ table: target.table_name, name: target.name, itemId, error: "no useful detail" });
          console.warn(`[refresh-zuiqingfeng] 跳过 ${target.name}: no useful detail`);
          continue;
        }
        if (!isDetailLikelyForZuiqingfengTarget(target, detail.rawDescription)) {
          failures.push({ table: target.table_name, name: target.name, itemId, error: "详情内容与目标商品标题不匹配" });
          console.warn(`[refresh-zuiqingfeng] 跳过 ${target.name}: 详情内容与目标商品标题不匹配`);
          continue;
        }

        const patch = buildZuiqingfengExistingProductPatch(target, detail);
        patches.push(patch);
        console.log(
          `[refresh-zuiqingfeng] ${apply ? "待写入" : "预演"} ${target.name}: ${patch.typeCode}/${patch.subtypeCode || "-"} | ${patch.gender} | ${patch.material}`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (isBrowserClosedError(message)) {
          console.error(`[refresh-zuiqingfeng] 浏览器已关闭，中止本轮，避免把剩余 ${targets.length - index} 条误记为失败。`);
          break;
        }
        failures.push({
          table: target.table_name,
          name: target.name,
          itemId,
          error: message,
        });
        console.warn(`[refresh-zuiqingfeng] 跳过 ${target.name}: ${message}`);
      }
    }
  } finally {
    console.log("[refresh-zuiqingfeng] 详情抓取结束，正在关闭浏览器...");
    await closeBrowserWithTimeout(browser);
  }

  if (apply && patches.length > 0) {
    console.log(`[refresh-zuiqingfeng] 开始写入数据库: ${patches.length} 条`);
    const writer = await pool.connect();
    try {
      await writer.query("BEGIN");
      await writer.query("SET statement_timeout TO 0");
      await writer.query("SET lock_timeout TO '5s'");
      for (const patch of patches) {
        await applyPatch(writer, patch);
      }
      await writer.query("COMMIT");
      console.log(`[refresh-zuiqingfeng] 数据库写入完成: ${patches.length} 条`);
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
        requested_item_ids: itemIds,
        targets: targets.length,
        unique_item_ids: new Set(
          targets.map((row) => extractTmallItemIdFromLink(row.link || row.product_link)),
        ).size,
        patched: patches.length,
        updated: apply ? patches.length : 0,
        failures,
        sample: patches.slice(0, 12).map((patch) => ({
          table: patch.tableName,
          name: patch.name,
          price: patch.price,
          gender: patch.gender,
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

if (shouldRunZuiqingfengRefreshScript(import.meta.url, process.argv[1])) {
  refreshZuiqingfengExistingProducts().catch((error) => {
    console.error("[refresh-zuiqingfeng-existing-products] 执行失败:", error);
    process.exitCode = 1;
  });
}
