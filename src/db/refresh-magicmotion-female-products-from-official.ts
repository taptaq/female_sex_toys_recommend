import dotenv from "dotenv";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

import pg from "pg";

import {
  buildRecommendationFeatureBackfillPayload,
  type RecommendationFeatureBackfillRow,
} from "./backfill-recommendation-product-features.ts";
import { buildSafeDisplayName } from "../lib/product-display-name.ts";
import { ensureCompetitorRecord, type CompetitorRegistryConfig } from "../scraper/shared/competitor-registry.ts";

dotenv.config();

const { Pool } = pg;

export const MAGICMOTION_BRAND_NAME = "Magic Motion";
export const MAGICMOTION_OFFICIAL_LIST_URL =
  process.env.MAGICMOTION_OFFICIAL_LIST_URL || "https://www.magicmotion.cn/";
export const MAGICMOTION_REVIEW_BUFFER_PATH = "src/data/magicmotion-cn-female-review-buffer.json";
const MAGICMOTION_REFRESH_BATCH_SIZE = Number(process.env.MAGICMOTION_REFRESH_BATCH_SIZE || "30");
const MAGICMOTION_ORIGIN = "https://www.magicmotion.cn";

const REQUEST_HEADERS: HeadersInit = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "zh-CN,zh;q=0.9,en;q=0.7",
  pragma: "no-cache",
  "cache-control": "no-cache",
};

const MAGICMOTION_COMPETITOR_CONFIG: CompetitorRegistryConfig = {
  canonicalName: MAGICMOTION_BRAND_NAME,
  matchNames: ["magic motion", "magicmotion", "魅动"],
  domain: "www.magicmotion.cn",
  country: "中国",
  description: "Magic Motion 魅动是智能情趣科技品牌，覆盖女性向、凯格尔训练、穿戴式与远程互动类玩具产品。",
  focus: "Unisex",
  philosophy: [
    "以智能互联和 APP 控制作为核心体验。",
    "覆盖女性愉悦、凯格尔训练、情侣互动与可穿戴场景。",
    "强调时尚设计、亲肤材质和更易进入日常关系的科技感。",
  ],
  majorUserGroupProfile:
    "【核心人口】20-40 岁女性用户、情侣用户和智能情趣产品尝鲜用户。\n【心理特征】关注 APP 远程控制、穿戴舒适度、私密训练和产品外观。\n【核心痛点】希望在女性愉悦、凯格尔训练、异地互动和伴侣共玩之间快速找到适合自己的产品。",
  isDomestic: true,
};

type Gender = "female" | "unisex";

type MagicMotionCnListItem = {
  sourceUrl: string;
  name: string;
  subtitle: string;
  coverImage: string;
  genderHint: Gender;
  categoryHints: string[];
  listPosition: number;
};

type MagicMotionCnSourceRow = MagicMotionCnListItem & {
  safeDisplayName?: string | null;
  rawDescription?: string | null;
  detailImageUrls?: string[] | null;
  specs?: Record<string, unknown> | null;
};

type MagicMotionFemaleRefreshPatch = {
  name: string;
  safeDisplayName: string;
  price: number;
  maxDb: number;
  waterproof: number;
  appearance: string;
  physicalForm: "external" | "internal" | "composite";
  motorType: "gentle" | "strong";
  gender: Gender;
  brand: typeof MAGICMOTION_BRAND_NAME;
  material: string;
  link: string;
  imageUrl: string;
  rawDescription: string;
  typeCode: string;
  subtypeCode: string;
  productTags: string[];
  productSpecs: Record<string, unknown>;
  recommendationFeatures: Record<string, unknown>;
};

type PgClientLike = {
  query: (sql: string, values?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
};

type PrismaLike = Parameters<typeof ensureCompetitorRecord>[0]["prisma"];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeLower(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function decodeHtml(value: unknown) {
  return normalizeText(value)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripTags(value: unknown) {
  return decodeHtml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeInline(value: unknown) {
  return stripTags(value).replace(/\s+/g, " ").trim();
}

function normalizeBlock(value: unknown) {
  return normalizeText(value)
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => stripTags(line).replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function normalizeNonEmpty(value: unknown, fallback: string) {
  const normalized = normalizeText(value);
  return normalized || fallback;
}

function uniqueStrings(values: Array<unknown>, limit = 80) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeInline(value);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= limit) break;
  }
  return result;
}

function normalizeProductUrl(href: unknown, baseUrl = MAGICMOTION_OFFICIAL_LIST_URL) {
  const trimmed = normalizeText(href);
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed, baseUrl);
    url.protocol = "https:";
    url.host = "www.magicmotion.cn";
    url.hash = "";
    url.search = "";
    return url.toString();
  } catch {
    return "";
  }
}

function normalizeAssetUrl(src: unknown, baseUrl = MAGICMOTION_OFFICIAL_LIST_URL) {
  const trimmed = normalizeText(src).replace(/\?.*$/, "");
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed, baseUrl);
    url.protocol = "https:";
    url.host = "www.magicmotion.cn";
    return url.toString();
  } catch {
    return "";
  }
}

function extractClassValue(block: string) {
  return normalizeText(block.match(/class=["']([^"']+)["']/i)?.[1] || "");
}

function buildTrustedSource(row: Partial<MagicMotionCnSourceRow>) {
  const hints = Array.isArray(row.categoryHints) ? row.categoryHints.join(" ") : "";
  return `${row.name ?? ""}\n${row.subtitle ?? ""}\n${row.sourceUrl ?? ""}\n${hints}\n${row.rawDescription ?? ""}`.toLowerCase();
}

function isObviousMaleOnly(row: Partial<MagicMotionCnSourceRow>) {
  const source = buildTrustedSource(row);
  if (/后庭|肛|equinox|黑客/.test(source)) return false;
  return /男用|锁精环|前列腺|penis|prostate|cock|dante|但丁|solstice|墨月/.test(source);
}

function isObviousNonToy(row: Partial<MagicMotionCnSourceRow>) {
  const source = buildTrustedSource(row);
  return /润滑液|lube|elizabeth|猫头套|配件|accessor/.test(source);
}

export function shouldKeepMagicMotionFemaleSourceRow(row: Partial<MagicMotionCnSourceRow>) {
  if (!normalizeText(row.name) || !normalizeProductUrl(row.sourceUrl)) return false;
  if (isObviousMaleOnly(row) || isObviousNonToy(row)) return false;
  const source = buildTrustedSource(row);
  return /womenclasses|女用|女性|凯格尔|跳蛋|穿戴|按摩器|后庭|app|远程|震动|振动|火烈鸟|泡泡鱼|小v|糖果|精灵|幻唇|黑客/.test(source);
}

export function extractMagicMotionCnFemaleListItems(html: string, listUrl = MAGICMOTION_OFFICIAL_LIST_URL) {
  const starts = Array.from(html.matchAll(/<div class="grid-item\b/gi), (match) => match.index ?? -1).filter((index) => index >= 0);
  const blocks = starts.map((start, index) => html.slice(start, starts[index + 1] ?? html.length));
  const items: MagicMotionCnListItem[] = [];
  const seen = new Set<string>();

  for (const [index, block] of blocks.entries()) {
    const classValue = extractClassValue(block);
    const linkBlock = block.match(/<a\b[^>]*class=["'][^"']*overlay-link[^"']*["'][^>]*>[\s\S]*?<\/a>/i)?.[0] || block;
    const href = linkBlock.match(/href=["']([^"']+)["']/i)?.[1] || "";
    const sourceUrl = normalizeProductUrl(href, listUrl);
    const name = normalizeInline(linkBlock.match(/class=["']project-title["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] || "");
    const subtitle = normalizeInline(linkBlock.match(/class=["']project-description["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] || "");
    const coverImage = normalizeAssetUrl(linkBlock.match(/<img\b[^>]*src=["']([^"']+)["']/i)?.[1] || "", listUrl);
    const categoryHints = uniqueStrings([...classValue.split(/\s+/), subtitle, "magicmotion.cn"], 30);
    const classTokens = new Set(classValue.split(/\s+/).filter(Boolean));
    const genderHint: Gender = classTokens.has("menclasses") ? "unisex" : "female";
    const item: MagicMotionCnListItem = {
      sourceUrl,
      name,
      subtitle,
      coverImage,
      genderHint,
      categoryHints,
      listPosition: index + 1,
    };

    if (!sourceUrl || seen.has(sourceUrl) || !shouldKeepMagicMotionFemaleSourceRow(item)) continue;
    seen.add(sourceUrl);
    items.push(item);
  }

  return items;
}

function extractMetaContent(html: string, key: string) {
  const pattern = new RegExp(
    `<meta\\s+[^>]*(?:name|property)=["']${key}["'][^>]*content=["']([^"']*)["'][^>]*>|<meta\\s+[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${key}["'][^>]*>`,
    "i",
  );
  const match = html.match(pattern);
  return normalizeInline(match?.[1] || match?.[2] || "");
}

function extractDetailRow(item: MagicMotionCnListItem, html: string): MagicMotionCnSourceRow {
  const title =
    normalizeInline(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "") ||
    normalizeInline(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/\s*-\s*魅动\s*$/, "") ||
    item.name;
  const headline = normalizeInline(html.match(/<h2\b[^>]*class=["'][^"']*mb-40[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i)?.[1] || "");
  const paragraphs = uniqueStrings(
    Array.from(html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi), (match) => normalizeInline(match[1] || ""))
      .filter((line) => !/copyright|沪ICP备|保修范围|cookie|条款/i.test(line)),
    30,
  );
  const images = uniqueStrings(
    Array.from(html.matchAll(/<img\b[^>]*(?:data-src|src)=["']([^"']+)["'][^>]*>/gi), (match) =>
      normalizeAssetUrl(match[1] || "", item.sourceUrl),
    ).filter(Boolean),
    30,
  );
  const rawDescription = [
    "[基础信息]",
    `商品名: ${title}`,
    item.subtitle ? `列表卖点: ${item.subtitle}` : "",
    headline ? `详情标题: ${headline}` : "",
    item.categoryHints.length ? `站内分类提示: ${item.categoryHints.join(" | ")}` : "",
    `性别提示: ${item.genderHint}`,
    "价格: 官网未展示",
    "",
    "[详情正文]",
    ...paragraphs,
    "",
    `[来源链接] ${item.sourceUrl}`,
  ].filter(Boolean).join("\n").slice(0, 10000);

  return {
    ...item,
    name: title,
    safeDisplayName: buildSafeDisplayName(title),
    rawDescription,
    coverImage: images[0] || item.coverImage,
    detailImageUrls: images,
    specs: {
      price_source_currency: "CNY",
      price_source_amount: null,
      price_source_status: "not_listed_on_magicmotion_cn",
    },
  };
}

function resolveTypePatch(row: Partial<MagicMotionCnSourceRow>) {
  const source = buildTrustedSource(row);
  if (/火烈鸟|flamingo|情侣/.test(source)) {
    return { typeCode: "couples", subtypeCode: "external_couples", maxDb: 40, waterproof: 7 };
  }
  if (/幻唇|口红|awaken|便携/.test(source)) {
    return { typeCode: "external_vibe", subtypeCode: "bullet_vibe", maxDb: 40, waterproof: 7 };
  }
  if (/凯格尔|kegel|盆底|pelvic/.test(source)) {
    return { typeCode: "insertable", subtypeCode: "gspot_insertable", maxDb: 40, waterproof: 7 };
  }
  if (/后庭|肛|黑客|equinox/.test(source)) {
    return { typeCode: "wearable_remote", subtypeCode: "insertable_remote", maxDb: 40, waterproof: 7 };
  }
  if (/穿戴|跳蛋|小v|泡泡鱼|糖果|精灵|vini|fugu|candy|eidolon/.test(source)) {
    return { typeCode: "wearable_remote", subtypeCode: "insertable_remote", maxDb: 40, waterproof: 7 };
  }
  return { typeCode: "external_vibe", subtypeCode: "bullet_vibe", maxDb: 40, waterproof: 7 };
}

function normalizePhysicalForm(typeCode: string, source: string): "external" | "internal" | "composite" {
  if (typeCode === "couples") return "composite";
  if (typeCode === "insertable" || typeCode === "wearable_remote" || /凯格尔|穿戴|跳蛋|后庭|肛|阴道|入体/.test(source)) return "internal";
  return "external";
}

function inferTagsFromText(row: Partial<MagicMotionCnSourceRow>) {
  const source = buildTrustedSource(row);
  const tags: string[] = [];
  const push = (tag: string, pattern: RegExp) => {
    if (pattern.test(source) && !tags.includes(tag)) tags.push(tag);
  };
  push("APP支持", /app|智能|远程|遥控/);
  push("远程遥控", /远程|遥控/);
  push("情侣共玩", /情侣|互动|伴侣|火烈鸟/);
  push("可穿戴", /穿戴|跳蛋|小v|泡泡鱼|糖果|精灵/);
  push("凯格尔训练", /凯格尔|盆底|训练/);
  push("后庭探索", /后庭|肛|黑客/);
  push("阴蒂刺激", /幻唇|口红|外部|按摩器/);
  push("震动刺激", /震动|振动|按摩/);
  push("防水", /防水/);
  return tags;
}

function inferGender(row: Partial<MagicMotionCnSourceRow>): Gender {
  const source = buildTrustedSource(row);
  return /后庭|肛|情侣|伴侣|equinox|火烈鸟/.test(source) ? "unisex" : "female";
}

function placeholderImageForSubtype(subtypeCode: string) {
  const normalized = normalizeLower(subtypeCode);
  if (normalized.includes("remote")) return "/assets/product-placeholder/insertable_remote.png";
  if (normalized.includes("couples")) return "/assets/product-placeholder/external_couples.png";
  if (normalized.includes("gspot")) return "/assets/product-placeholder/gspot_insertable.png";
  return "/assets/product-placeholder/bullet_vibe.png";
}

function buildRecommendationFeaturesForPatch(patch: Omit<MagicMotionFemaleRefreshPatch, "recommendationFeatures">) {
  const payload = buildRecommendationFeatureBackfillPayload({
    id: "00000000-0000-0000-0000-000000000000",
    original_id: null,
    name: patch.name,
    safe_display_name: patch.safeDisplayName,
    price: patch.price,
    max_db: patch.maxDb,
    waterproof: patch.waterproof,
    appearance: patch.appearance,
    physical_form: patch.physicalForm,
    motor_type: patch.motorType,
    gender: patch.gender,
    brand: patch.brand,
    material: patch.material,
    image_url: patch.imageUrl,
    raw_description: patch.rawDescription,
    type_code: patch.typeCode,
    subtype_code: patch.subtypeCode,
    product_tags: patch.productTags,
    product_raw_description: patch.rawDescription,
  } satisfies RecommendationFeatureBackfillRow);

  const evidence = payload.features.evidence.length > 0
    ? payload.features.evidence
    : [
        {
          signal: "app" as const,
          polarity: "positive" as const,
          text: "Magic Motion 官网资料显示该产品强调智能 APP/远程控制或女性友好场景",
          source: "structured" as const,
        },
      ];

  return { featureVersion: payload.featureVersion, ...payload.features, evidence };
}

export function buildMagicMotionFemaleRefreshPatch(row: Partial<MagicMotionCnSourceRow>): MagicMotionFemaleRefreshPatch {
  const name = normalizeNonEmpty(row.name, "Magic Motion 未命名商品");
  const source = buildTrustedSource(row);
  const typePatch = resolveTypePatch(row);
  const rawDescription = normalizeNonEmpty(
    row.rawDescription,
    `[基础信息]\n商品名: ${name}\n站内分类提示: magicmotion.cn\n性别提示: female\n价格: 官网未展示\n[详情正文]\nMagic Motion 魅动官网女性/共享产品。\n[来源链接] ${normalizeProductUrl(row.sourceUrl) || MAGICMOTION_OFFICIAL_LIST_URL}`,
  );
  const typeCode = normalizeNonEmpty(row.specs?.type_code && row.specs.type_code !== "unknown" ? row.specs.type_code : typePatch.typeCode, "external_vibe");
  const subtypeCode = normalizeNonEmpty(row.specs?.subtype_code ?? typePatch.subtypeCode, "bullet_vibe");
  const productTags = uniqueStrings([
    ...(Array.isArray(row.specs?.function_tags) ? row.specs.function_tags : []),
    ...inferTagsFromText({ ...row, rawDescription }),
  ]);
  const imageUrl = normalizeNonEmpty(
    normalizeAssetUrl(row.coverImage ?? row.detailImageUrls?.[0], row.sourceUrl || MAGICMOTION_OFFICIAL_LIST_URL),
    placeholderImageForSubtype(subtypeCode),
  );

  const patchWithoutFeatures = {
    name,
    safeDisplayName: normalizeNonEmpty(row.safeDisplayName, buildSafeDisplayName(name)),
    price: Number(row.specs?.price_rmb) > 0 ? Number(row.specs?.price_rmb) : 1,
    maxDb: Number(row.specs?.max_db ?? typePatch.maxDb),
    waterproof: Number(row.specs?.waterproof ?? typePatch.waterproof),
    appearance: normalizeNonEmpty(row.specs?.appearance, /便携|穿戴|跳蛋|口红|小v|糖果|精灵/i.test(source) ? "high_disguise" : "normal"),
    physicalForm: normalizePhysicalForm(typeCode, source),
    motorType: /强劲|强烈|强震|powerful|strong/i.test(source) ? "strong" : "gentle",
    gender: inferGender({ ...row, rawDescription }),
    brand: MAGICMOTION_BRAND_NAME,
    material: normalizeNonEmpty(row.specs?.material, "亲肤硅胶"),
    link: normalizeNonEmpty(normalizeProductUrl(row.sourceUrl), MAGICMOTION_OFFICIAL_LIST_URL),
    imageUrl,
    rawDescription,
    typeCode,
    subtypeCode,
    productTags: productTags.length > 0 ? productTags : ["APP支持", "女性友好"],
    productSpecs: {
      ...(row.specs ?? {}),
      rawDescription,
      sourceUrl: normalizeProductUrl(row.sourceUrl),
      officialListUrl: MAGICMOTION_OFFICIAL_LIST_URL,
      price_source_status: row.specs?.price_source_status ?? "not_listed_on_magicmotion_cn",
      officialCleanedAt: new Date().toISOString(),
    },
  } satisfies Omit<MagicMotionFemaleRefreshPatch, "recommendationFeatures">;

  return { ...patchWithoutFeatures, recommendationFeatures: buildRecommendationFeaturesForPatch(patchWithoutFeatures) };
}

async function fetchText(url: string) {
  const response = await fetch(url, { headers: REQUEST_HEADERS, redirect: "follow" });
  if (!response.ok) throw new Error(`GET ${url} failed: ${response.status}`);
  return await response.text();
}

export async function fetchMagicMotionOfficialSourceRows() {
  const listHtml = await fetchText(MAGICMOTION_OFFICIAL_LIST_URL);
  const listItems = extractMagicMotionCnFemaleListItems(listHtml);
  const rows: MagicMotionCnSourceRow[] = [];
  for (const item of listItems) {
    const detailHtml = await fetchText(item.sourceUrl);
    rows.push(extractDetailRow(item, detailHtml));
    console.log(`[refresh-magicmotion-female-products-from-official] 已抓取详情 ${rows.length}/${listItems.length}`);
  }
  fs.writeFileSync(MAGICMOTION_REVIEW_BUFFER_PATH, `${JSON.stringify(rows, null, 2)}\n`);
  return rows;
}

async function ensureMagicMotionCompetitor(client: PgClientLike) {
  const prismaLike = {
    competitors: {
      findFirst: async (args: any) => {
        const names = args?.where?.OR?.flatMap((entry: any) => {
          const nameFilter = entry?.name;
          const value = typeof nameFilter === "object" ? nameFilter?.contains : nameFilter;
          return value ? [value] : [];
        }) ?? [MAGICMOTION_BRAND_NAME];
        const result = await client.query(
          `
            SELECT id, name, domain, country, founded_date, description, focus,
                   philosophy, major_user_group_profile, is_domestic
            FROM public.competitors
            WHERE lower(name) = ANY($1::text[])
               OR lower(coalesce(name, '')) LIKE ANY($2::text[])
               OR lower(coalesce(domain, '')) LIKE '%magicmotion%'
            LIMIT 1
          `,
          [
            names.map((name: unknown) => normalizeText(name).toLowerCase()),
            names.map((name: unknown) => `%${normalizeText(name).toLowerCase()}%`),
          ],
        );
        return result.rows[0] ?? null;
      },
      create: async (args: any) => {
        const data = args.data ?? {};
        const result = await client.query(
          `
            INSERT INTO public.competitors (
              name, domain, country, founded_date, description, focus, philosophy,
              major_user_group_profile, is_domestic
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7::text[], $8, $9)
            RETURNING id, name, domain, country, founded_date, description, focus,
                      philosophy, major_user_group_profile, is_domestic
          `,
          [data.name, data.domain, data.country, data.founded_date, data.description, data.focus, data.philosophy ?? [], data.major_user_group_profile, data.is_domestic],
        );
        return result.rows[0];
      },
      update: async (args: any) => {
        const data = args.data ?? {};
        const result = await client.query(
          `
            UPDATE public.competitors
            SET domain = COALESCE($2, domain),
                country = COALESCE($3, country),
                founded_date = COALESCE($4, founded_date),
                description = COALESCE($5, description),
                focus = COALESCE($6, focus),
                philosophy = CASE WHEN cardinality($7::text[]) > 0 THEN $7::text[] ELSE philosophy END,
                major_user_group_profile = COALESCE($8, major_user_group_profile),
                is_domestic = COALESCE($9, is_domestic)
            WHERE id = $1::uuid
            RETURNING id, name, domain, country, founded_date, description, focus,
                      philosophy, major_user_group_profile, is_domestic
          `,
          [args.where.id, data.domain, data.country, data.founded_date, data.description, data.focus, data.philosophy ?? [], data.major_user_group_profile, data.is_domestic],
        );
        return result.rows[0];
      },
    },
  } satisfies PrismaLike;

  return await ensureCompetitorRecord({
    prisma: prismaLike,
    withDbRetry: async (_label, action) => await action(),
    brandName: MAGICMOTION_BRAND_NAME,
    overrideConfig: MAGICMOTION_COMPETITOR_CONFIG,
  });
}

async function ensureProductForPatch(client: PgClientLike, patch: MagicMotionFemaleRefreshPatch, competitorId: string | null) {
  const existing = await client.query(
    `
      SELECT id
      FROM public.products
      WHERE lower(name) = lower($1)
        AND (competitor_id = $2::uuid OR $2::uuid IS NULL OR lower(coalesce(link, '')) = lower($3))
      ORDER BY CASE WHEN lower(coalesce(link, '')) = lower($3) THEN 0 ELSE 1 END, created_at DESC NULLS LAST
      LIMIT 1
    `,
    [patch.name, competitorId, patch.link],
  );
  const values = [competitorId, patch.name, patch.price, patch.productTags, patch.link, patch.imageUrl, patch.gender, JSON.stringify(patch.productSpecs)];
  const result = existing.rows[0]?.id
    ? await client.query(
        `
          UPDATE public.products
          SET competitor_id = $2::uuid, price = $3, category = 'female_toy', tags = $4::text[],
              link = $5, image = $6, gender = CASE WHEN $7 = 'female' THEN 'Female' ELSE 'Unisex' END,
              specs = $8::jsonb
          WHERE id = $1::uuid
          RETURNING id
        `,
        [
          existing.rows[0].id,
          competitorId,
          patch.price,
          patch.productTags,
          patch.link,
          patch.imageUrl,
          patch.gender,
          JSON.stringify(patch.productSpecs),
        ],
      )
    : await client.query(
        `
          INSERT INTO public.products (competitor_id, name, price, category, tags, link, image, gender, specs)
          VALUES ($1::uuid, $2, $3, 'female_toy', $4::text[], $5, $6,
                  CASE WHEN $7 = 'female' THEN 'Female' ELSE 'Unisex' END, $8::jsonb)
          RETURNING id
        `,
        values,
      );
  const productId = result.rows[0]?.id;
  if (!productId) throw new Error(`products upsert failed: ${patch.name}`);
  return productId as string;
}

async function upsertFemaleToy(client: PgClientLike, patch: MagicMotionFemaleRefreshPatch, competitorId: string | null) {
  const productId = await ensureProductForPatch(client, patch, competitorId);
  const existing = await client.query(
    `
      SELECT id
      FROM public.female_recommender_toys
      WHERE lower(brand) = lower($3)
        AND (original_id = $1::uuid OR lower(coalesce(link, '')) = lower($2) OR lower(name) = lower($4))
      ORDER BY CASE WHEN original_id = $1::uuid THEN 0 WHEN lower(coalesce(link, '')) = lower($2) THEN 1 ELSE 2 END,
               updated_at DESC NULLS LAST, created_at DESC NULLS LAST
      LIMIT 1
    `,
    [productId, patch.link, patch.brand, patch.name],
  );
  const values = [
    productId,
    patch.name,
    patch.safeDisplayName,
    patch.price,
    patch.maxDb,
    patch.waterproof,
    patch.appearance,
    patch.physicalForm,
    patch.motorType,
    patch.gender,
    patch.brand,
    patch.material,
    patch.link,
    patch.imageUrl,
    patch.rawDescription,
    patch.typeCode,
    patch.subtypeCode,
    JSON.stringify(patch.recommendationFeatures),
  ];
  if (existing.rows[0]?.id) {
    await client.query(
      `
        UPDATE public.female_recommender_toys
        SET original_id = $1::uuid, name = $2, safe_display_name = $3, price = $4,
            max_db = $5, waterproof = $6, appearance = $7, physical_form = $8,
            motor_type = $9, gender = $10, brand = $11, material = $12, link = $13,
            image_url = $14, raw_description = $15, type_code = $16, subtype_code = $17,
            recommendation_features = $18::jsonb, updated_at = NOW()
        WHERE id = $19::uuid
      `,
      [...values, existing.rows[0].id],
    );
    return;
  }
  await client.query(
    `
      INSERT INTO public.female_recommender_toys (
        original_id, name, safe_display_name, price, max_db, waterproof, appearance,
        physical_form, motor_type, gender, brand, material, link, image_url,
        raw_description, type_code, subtype_code, recommendation_features
      )
      VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb)
    `,
    values,
  );
}

async function backfillIncompleteMagicMotionRows(client: PgClientLike, competitorId: string | null) {
  const incomplete = await client.query(
    `
      SELECT id, original_id, name, safe_display_name, price, max_db, waterproof,
             appearance, physical_form, motor_type, gender, brand, material, link,
             image_url, raw_description, type_code, subtype_code, recommendation_features
      FROM public.female_recommender_toys
      WHERE lower(brand) = lower($1)
        AND (
          original_id IS NULL
          OR NULLIF(BTRIM(COALESCE(name, '')), '') IS NULL
          OR NULLIF(BTRIM(COALESCE(safe_display_name, '')), '') IS NULL
          OR price IS NULL
          OR max_db IS NULL
          OR waterproof IS NULL
          OR NULLIF(BTRIM(COALESCE(appearance, '')), '') IS NULL
          OR NULLIF(BTRIM(COALESCE(physical_form, '')), '') IS NULL
          OR NULLIF(BTRIM(COALESCE(motor_type, '')), '') IS NULL
          OR NULLIF(BTRIM(COALESCE(gender, '')), '') IS NULL
          OR NULLIF(BTRIM(COALESCE(material, '')), '') IS NULL
          OR NULLIF(BTRIM(COALESCE(link, '')), '') IS NULL
          OR NULLIF(BTRIM(COALESCE(image_url, '')), '') IS NULL
          OR NULLIF(BTRIM(COALESCE(raw_description, '')), '') IS NULL
          OR NULLIF(BTRIM(COALESCE(type_code, '')), '') IS NULL
          OR lower(COALESCE(type_code, '')) = 'unknown'
          OR NULLIF(BTRIM(COALESCE(subtype_code, '')), '') IS NULL
          OR recommendation_features IS NULL
          OR jsonb_array_length(coalesce(recommendation_features->'evidence', '[]'::jsonb)) = 0
        )
    `,
    [MAGICMOTION_BRAND_NAME],
  );

  if (incomplete.rows.length === 0) return 0;

  for (const row of incomplete.rows) {
    const name = normalizeNonEmpty(row.name ?? row.safe_display_name, "Magic Motion 未命名商品");
    const sourceRow: Partial<MagicMotionCnSourceRow> = {
      sourceUrl: normalizeNonEmpty(row.link, `${MAGICMOTION_OFFICIAL_LIST_URL}#${row.id}`),
      name,
      safeDisplayName: normalizeNonEmpty(row.safe_display_name, buildSafeDisplayName(name)),
      subtitle: normalizeNonEmpty(row.subtype_code, "Magic Motion official female/shared product"),
      coverImage: normalizeNonEmpty(row.image_url, placeholderImageForSubtype(row.subtype_code || "")),
      rawDescription: normalizeNonEmpty(
        row.raw_description,
        `[基础信息]\n商品名: ${name}\n站内分类提示: Magic Motion official\n性别提示: ${normalizeText(row.gender) || "female"}\n价格: 历史记录价格\n[详情正文]\nMagic Motion 官方女性/共享产品记录，字段由兜底清洗流程补齐。\n[来源链接] ${normalizeNonEmpty(row.link, MAGICMOTION_OFFICIAL_LIST_URL)}`,
      ),
      genderHint: normalizeLower(row.gender) === "unisex" ? "unisex" : "female",
      categoryHints: uniqueStrings([row.type_code, row.subtype_code, row.physical_form, row.link, "Magic Motion official"], 30),
      listPosition: 0,
      specs: {
        price_rmb: Number(row.price) || 1,
        type_code: normalizeText(row.type_code) && normalizeLower(row.type_code) !== "unknown" ? row.type_code : undefined,
        subtype_code: normalizeText(row.subtype_code) || undefined,
        max_db: Number.isFinite(Number(row.max_db)) ? Number(row.max_db) : 40,
        waterproof: Number.isFinite(Number(row.waterproof)) ? Number(row.waterproof) : 7,
        appearance: normalizeText(row.appearance) || undefined,
        physical_form: normalizeText(row.physical_form) || undefined,
        motor_type: normalizeText(row.motor_type) || undefined,
        gender: normalizeText(row.gender) || undefined,
        material: normalizeText(row.material) || undefined,
      },
    };
    const patch = buildMagicMotionFemaleRefreshPatch(sourceRow);
    const productId = row.original_id ?? (await ensureProductForPatch(client, patch, competitorId));
    await client.query(
      `
        UPDATE public.female_recommender_toys
        SET original_id = $1::uuid, name = $2, safe_display_name = $3, price = $4,
            max_db = $5, waterproof = $6, appearance = $7, physical_form = $8,
            motor_type = $9, gender = $10, brand = $11, material = $12, link = $13,
            image_url = $14, raw_description = $15, type_code = $16, subtype_code = $17,
            recommendation_features = $18::jsonb, updated_at = NOW()
        WHERE id = $19::uuid
      `,
      [
        productId,
        patch.name,
        patch.safeDisplayName,
        patch.price,
        patch.maxDb,
        patch.waterproof,
        patch.appearance,
        patch.physicalForm,
        patch.motorType,
        patch.gender,
        patch.brand,
        patch.material,
        patch.link,
        patch.imageUrl,
        patch.rawDescription,
        patch.typeCode,
        patch.subtypeCode,
        JSON.stringify(patch.recommendationFeatures),
        row.id,
      ],
    );
  }
  console.log(`[refresh-magicmotion-female-products-from-official] 已兜底修复不完整行 ${incomplete.rows.length} 条`);
  return incomplete.rows.length;
}

export function shouldRunMagicMotionFemaleRefreshScript(importMetaUrl: string, argvEntry?: string) {
  return Boolean(argvEntry && importMetaUrl === pathToFileURL(argvEntry).href);
}

async function loadMagicMotionRows() {
  const sourceMode = normalizeLower(process.env.MAGICMOTION_REFRESH_SOURCE || "live");
  if (sourceMode === "buffer") {
    return {
      sourceMode,
      rows: JSON.parse(fs.readFileSync(MAGICMOTION_REVIEW_BUFFER_PATH, "utf8")) as MagicMotionCnSourceRow[],
    };
  }
  return { sourceMode, rows: await fetchMagicMotionOfficialSourceRows() };
}

async function runMagicMotionFemaleRefreshAttempt() {
  const { sourceMode, rows } = await loadMagicMotionRows();
  const patches = rows.filter(shouldKeepMagicMotionFemaleSourceRow).map(buildMagicMotionFemaleRefreshPatch);
  const pool = new Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
  let client: pg.PoolClient | null = null;
  try {
    client = await pool.connect();
    await client.query("SET statement_timeout TO 0");
    await client.query("SET lock_timeout TO '5s'");
    const competitorId = await ensureMagicMotionCompetitor(client);
    for (let index = 0; index < patches.length; index += MAGICMOTION_REFRESH_BATCH_SIZE) {
      const batch = patches.slice(index, index + MAGICMOTION_REFRESH_BATCH_SIZE);
      await client.query("BEGIN");
      try {
        for (const patch of batch) await upsertFemaleToy(client!, patch, competitorId);
        await client.query("COMMIT");
        console.log(`[refresh-magicmotion-female-products-from-official] 已提交 ${Math.min(index + batch.length, patches.length)}/${patches.length}`);
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      }
    }

    await backfillIncompleteMagicMotionRows(client, competitorId);

    const audit = await client.query(
      `
        SELECT
          COUNT(*)::int AS rows,
          COUNT(*) FILTER (
            WHERE original_id IS NULL
               OR NULLIF(BTRIM(COALESCE(name, '')), '') IS NULL
               OR NULLIF(BTRIM(COALESCE(safe_display_name, '')), '') IS NULL
               OR price IS NULL
               OR max_db IS NULL
               OR waterproof IS NULL
               OR NULLIF(BTRIM(COALESCE(appearance, '')), '') IS NULL
               OR NULLIF(BTRIM(COALESCE(physical_form, '')), '') IS NULL
               OR NULLIF(BTRIM(COALESCE(motor_type, '')), '') IS NULL
               OR NULLIF(BTRIM(COALESCE(gender, '')), '') IS NULL
               OR NULLIF(BTRIM(COALESCE(brand, '')), '') IS NULL
               OR NULLIF(BTRIM(COALESCE(material, '')), '') IS NULL
               OR NULLIF(BTRIM(COALESCE(link, '')), '') IS NULL
               OR NULLIF(BTRIM(COALESCE(image_url, '')), '') IS NULL
               OR NULLIF(BTRIM(COALESCE(raw_description, '')), '') IS NULL
               OR NULLIF(BTRIM(COALESCE(type_code, '')), '') IS NULL
               OR lower(COALESCE(type_code, '')) = 'unknown'
               OR NULLIF(BTRIM(COALESCE(subtype_code, '')), '') IS NULL
               OR recommendation_features IS NULL
          )::int AS rows_with_missing_fields,
          COUNT(*) FILTER (WHERE jsonb_array_length(coalesce(recommendation_features->'evidence', '[]'::jsonb)) = 0)::int AS rows_with_empty_evidence,
          COUNT(*) FILTER (WHERE lower(COALESCE(type_code, '')) = 'unknown')::int AS rows_with_unknown_type,
          COUNT(*) FILTER (WHERE lower(COALESCE(subtype_code, '')) = 'unknown')::int AS rows_with_unknown_subtype
        FROM public.female_recommender_toys
        WHERE lower(brand) = lower($1)
      `,
      [MAGICMOTION_BRAND_NAME],
    );
    console.log(JSON.stringify({ brand: MAGICMOTION_BRAND_NAME, source: MAGICMOTION_OFFICIAL_LIST_URL, sourceMode, inputRows: rows.length, refreshed: patches.length, ...audit.rows[0] }, null, 2));
  } finally {
    client?.release();
    await pool.end().catch(() => {});
  }
}

async function runMagicMotionFemaleRefresh() {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await runMagicMotionFemaleRefreshAttempt();
      return;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!/Connection terminated|ECONNRESET|server closed the connection|terminating connection|Can't reach database|P1001|P1017/i.test(message) || attempt === 3) break;
      console.warn(`[refresh-magicmotion-female-products-from-official] 遇到瞬断，重试 ${attempt}/3...`, error);
      await sleep(1500 * attempt);
    }
  }
  throw lastError;
}

if (shouldRunMagicMotionFemaleRefreshScript(import.meta.url, process.argv[1])) {
  runMagicMotionFemaleRefresh().catch((error) => {
    console.error("[refresh-magicmotion-female-products-from-official] 执行失败:", error);
    process.exitCode = 1;
  });
}
