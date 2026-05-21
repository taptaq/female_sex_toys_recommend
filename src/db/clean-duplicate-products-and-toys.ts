import dotenv from "dotenv";
import pg from "pg";
import { pathToFileURL } from "node:url";

dotenv.config();

const { Pool } = pg;

type JsonRecord = Record<string, unknown>;

export type DuplicateProductRow = {
  id: string;
  competitor_id: string | null;
  name: string;
  price: string | number | null;
  category: string | null;
  tags: string[] | null;
  link: string | null;
  image: string | null;
  sales: string | number | null;
  launch_date: string | null;
  gender: string | null;
  specs: JsonRecord | null;
  price_history: JsonRecord | null;
  analysis: JsonRecord | null;
  reviews: JsonRecord | null;
  price_analysis: JsonRecord | null;
  use_scenario: string | null;
  persona_analysis: string | null;
  standardization_analysis: JsonRecord | null;
  toy_count: number;
  ref_count: number;
};

export type DuplicateToyRow = {
  id: string;
  original_id: string | null;
  name: string;
  price: string | number | null;
  max_db: number | null;
  waterproof: number | null;
  appearance: string | null;
  physical_form: string | null;
  motor_type: string | null;
  gender: string | null;
  brand: string | null;
  material: string | null;
  image_url: string | null;
  raw_description: string | null;
  safe_display_name: string | null;
  type_code: string | null;
  subtype_code: string | null;
  recommendation_features: JsonRecord | null;
  product_name: string | null;
};

type ProductMergeGroup = {
  key: string;
  keeper: DuplicateProductRow;
  merged: DuplicateProductRow;
  deleteIds: string[];
  rows: DuplicateProductRow[];
};

type ToyMergeGroup = {
  originalId: string;
  keeper: DuplicateToyRow;
  merged: DuplicateToyRow;
  deleteIds: string[];
  rows: DuplicateToyRow[];
};

type MergePlan<T> = {
  groups: T[];
};

const TRACKING_QUERY_PARAMS = new Set([
  "ali_refid",
  "ali_trackid",
  "mi_id",
  "mm_sceneid",
  "pisk",
  "skuId",
  "spm",
  "utm_campaign",
  "utm_content",
  "utm_medium",
  "utm_source",
  "utm_term",
  "xxc",
]);

const KNOWN_PRODUCT_ALIAS_CANONICALS = new Map<string, string>([
  ["arcwavezing男式免提振动器自慰器", "arcwavezingrechargeablevibratingmalemasturbator"],
  ["blowmotion加热振动男性自慰器", "blowmotionwarmingvibratingmalemasturbator"],
  ["spottheeggvibratorkeontheautomaticmasturbatorandfeelstrokerpale", "spotkeonfeelstroker"],
]);

function normalizeText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function isFilled(value: unknown) {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function stripDecorativeNameNoise(value: string) {
  return normalizeText(value)
    .replace(/^["'“”]+|["'“”,，]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeNameKey(value: unknown) {
  return stripDecorativeNameNoise(normalizeText(value))
    .toLowerCase()
    .replace(/[™®]/g, "")
    .replace(/[^\p{Script=Han}a-z0-9]+/gu, "");
}

function normalizeAliasComparableName(value: unknown) {
  return normalizeNameKey(value)
    .replace(/^(wevibe|lovehoney|satisfyer|lovense)/, "")
    .replace(/(跳蛋|震动棒|振动棒|飞机杯|自慰器|阴茎环|肛塞器|吮吸器|按摩棒|男式免提振动器|加热振动男性|男用自慰器)$/u, "");
}

function charDiceScore(a: string, b: string) {
  const aChars = new Set(Array.from(a));
  const bChars = new Set(Array.from(b));
  if (aChars.size === 0 || bChars.size === 0) return 0;
  const hits = Array.from(aChars).filter((char) => bChars.has(char)).length;
  return (2 * hits) / (aChars.size + bChars.size);
}

function areMergeableProductNames(rows: DuplicateProductRow[]) {
  const keys = rows.map((row) => normalizeNameKey(row.name)).filter(Boolean);
  const aliasKeys = rows.map((row) => normalizeAliasComparableName(row.name)).filter(Boolean);
  if (keys.length < 2) return false;
  const canonicalizedKnownKeys = keys.map((key) => KNOWN_PRODUCT_ALIAS_CANONICALS.get(key) ?? key);
  if (new Set(canonicalizedKnownKeys).size === 1) return true;

  const longest = [...keys].sort((a, b) => b.length - a.length)[0]!;
  const strictMatch = keys.every((key) => {
    if (key === longest) return true;
    if (longest.includes(key) && key.length >= Math.min(6, longest.length)) return true;
    return charDiceScore(key, longest) >= 0.72;
  });
  if (strictMatch) return true;

  if (aliasKeys.length === keys.length) {
    const longestAlias = [...aliasKeys].sort((a, b) => b.length - a.length)[0]!;
    return aliasKeys.every((key) => {
      if (key === longestAlias) return true;
      if (longestAlias.includes(key) && key.length >= Math.min(4, longestAlias.length)) return true;
      return charDiceScore(key, longestAlias) >= 0.78;
    });
  }

  return false;
}

export function normalizeDuplicateLinkKey(value: unknown) {
  const raw = normalizeText(value);
  if (!raw) return "";

  try {
    const url = new URL(raw);
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "www.");

    for (const param of [...url.searchParams.keys()]) {
      if (TRACKING_QUERY_PARAMS.has(param)) {
        url.searchParams.delete(param);
      }
    }

    if (url.hostname.endsWith("tmall.com")) {
      const itemId = url.searchParams.get("id");
      return itemId ? `https://detail.tmall.com/item.htm?id=${itemId}` : `${url.origin}${url.pathname}`;
    }

    url.hash = "";
    const normalized = url.toString();
    return normalized.endsWith("?") ? normalized.slice(0, -1) : normalized;
  } catch {
    return raw.toLowerCase();
  }
}

function chooseFilledValue<T>(currentValue: T | null, candidateValue: T | null) {
  return isFilled(currentValue) ? currentValue : candidateValue;
}

function chooseLongerText(currentValue: string | null, candidateValue: string | null) {
  const currentText = normalizeText(currentValue);
  const candidateText = normalizeText(candidateValue);
  if (!candidateText) return currentValue;
  if (!currentText || candidateText.length > currentText.length) return candidateValue;
  return currentValue;
}

function chooseLongerJson(currentValue: JsonRecord | null, candidateValue: JsonRecord | null) {
  if (!isFilled(candidateValue)) return currentValue;
  if (!isFilled(currentValue)) return candidateValue;

  const currentLength = JSON.stringify(currentValue).length;
  const candidateLength = JSON.stringify(candidateValue).length;
  return candidateLength > currentLength ? candidateValue : currentValue;
}

function mergeTags(currentTags: string[] | null, candidateTags: string[] | null) {
  const tags = new Set<string>();
  for (const tag of [...(currentTags ?? []), ...(candidateTags ?? [])]) {
    const normalized = normalizeText(tag);
    if (normalized) tags.add(normalized);
  }
  return tags.size > 0 ? [...tags] : currentTags;
}

function rowTimestampScore(_value: unknown) {
  return 0;
}

function productRowScore(row: DuplicateProductRow) {
  let score = 0;
  if (row.ref_count > 0) score += row.ref_count * 20;
  if (row.toy_count > 0) score += row.toy_count * 10;
  if (isFilled(row.specs)) score += 8;
  if (isFilled(row.analysis)) score += 4;
  if (isFilled(row.reviews)) score += 4;
  if (isFilled(row.price_history)) score += 4;
  if (isFilled(row.standardization_analysis)) score += 3;
  if (isFilled(row.image)) score += 2;
  if (isFilled(row.tags)) score += 2;
  if (isFilled(row.price)) score += 1;
  if (isFilled(row.category)) score += 1;
  if (isFilled(row.gender)) score += 1;
  score += Math.min(4, normalizeText(row.name).length / 40);
  return score + rowTimestampScore(row.id);
}

function toyRowScore(row: DuplicateToyRow) {
  let score = 0;
  if (normalizeNameKey(row.name) && normalizeNameKey(row.name) === normalizeNameKey(row.product_name)) score += 100;
  if (isFilled(row.raw_description)) score += Math.min(20, normalizeText(row.raw_description).length / 300);
  if (isFilled(row.recommendation_features)) score += 8;
  if (isFilled(row.type_code)) score += 5;
  if (isFilled(row.subtype_code)) score += 5;
  if (isFilled(row.image_url)) score += 3;
  if (isFilled(row.safe_display_name)) score += 2;
  if (isFilled(row.material)) score += 2;
  if (isFilled(row.price)) score += 1;
  if (isFilled(row.gender)) score += 1;
  score += Math.min(8, normalizeText(row.name).length / 20);
  return score;
}

function selectPreferredProductRow(rows: DuplicateProductRow[]) {
  return [...rows].sort((a, b) => productRowScore(b) - productRowScore(a) || a.id.localeCompare(b.id))[0]!;
}

function selectPreferredToyRow(rows: DuplicateToyRow[]) {
  return [...rows].sort((a, b) => toyRowScore(b) - toyRowScore(a) || a.id.localeCompare(b.id))[0]!;
}

function mergeProductRows(rows: DuplicateProductRow[]) {
  const keeper = selectPreferredProductRow(rows);
  const merged: DuplicateProductRow = { ...keeper, name: stripDecorativeNameNoise(keeper.name) };

  for (const row of rows) {
    if (row.id === keeper.id) continue;
    merged.competitor_id = chooseFilledValue(merged.competitor_id, row.competitor_id);
    merged.name = chooseLongerText(merged.name, stripDecorativeNameNoise(row.name)) ?? merged.name;
    merged.price = chooseFilledValue(merged.price, row.price);
    merged.category = chooseFilledValue(merged.category, row.category);
    merged.tags = mergeTags(merged.tags, row.tags);
    merged.link = chooseFilledValue(merged.link, row.link);
    merged.image = chooseFilledValue(merged.image, row.image);
    merged.sales = chooseFilledValue(merged.sales, row.sales);
    merged.launch_date = chooseFilledValue(merged.launch_date, row.launch_date);
    merged.gender = chooseFilledValue(merged.gender, row.gender);
    merged.specs = chooseLongerJson(merged.specs, row.specs);
    merged.price_history = chooseLongerJson(merged.price_history, row.price_history);
    merged.analysis = chooseLongerJson(merged.analysis, row.analysis);
    merged.reviews = chooseLongerJson(merged.reviews, row.reviews);
    merged.price_analysis = chooseLongerJson(merged.price_analysis, row.price_analysis);
    merged.use_scenario = chooseLongerText(merged.use_scenario, row.use_scenario);
    merged.persona_analysis = chooseLongerText(merged.persona_analysis, row.persona_analysis);
    merged.standardization_analysis = chooseLongerJson(merged.standardization_analysis, row.standardization_analysis);
  }

  return {
    keeper,
    merged,
    deleteIds: rows.filter((row) => row.id !== keeper.id).map((row) => row.id).sort(),
  };
}

function mergeToyRows(rows: DuplicateToyRow[]) {
  const keeper = selectPreferredToyRow(rows);
  const merged: DuplicateToyRow = { ...keeper };

  for (const row of rows) {
    if (row.id === keeper.id) continue;
    merged.price = chooseFilledValue(merged.price, row.price);
    merged.max_db = chooseFilledValue(merged.max_db, row.max_db);
    merged.waterproof = chooseFilledValue(merged.waterproof, row.waterproof);
    merged.appearance = chooseLongerText(merged.appearance, row.appearance);
    merged.physical_form = chooseFilledValue(merged.physical_form, row.physical_form);
    merged.motor_type = chooseFilledValue(merged.motor_type, row.motor_type);
    merged.gender = chooseFilledValue(merged.gender, row.gender);
    merged.brand = chooseFilledValue(merged.brand, row.brand);
    merged.material = chooseLongerText(merged.material, row.material);
    merged.image_url = chooseFilledValue(merged.image_url, row.image_url);
    merged.raw_description = chooseLongerText(merged.raw_description, row.raw_description);
    merged.safe_display_name = chooseFilledValue(merged.safe_display_name, row.safe_display_name);
    merged.type_code = chooseFilledValue(merged.type_code, row.type_code);
    merged.subtype_code = chooseFilledValue(merged.subtype_code, row.subtype_code);
    merged.recommendation_features = chooseLongerJson(merged.recommendation_features, row.recommendation_features);
  }

  return {
    keeper,
    merged,
    deleteIds: rows.filter((row) => row.id !== keeper.id).map((row) => row.id).sort(),
  };
}

export function buildProductLinkMergePlan(rows: DuplicateProductRow[]): MergePlan<ProductMergeGroup> {
  const buckets = new Map<string, DuplicateProductRow[]>();

  for (const row of rows) {
    const key = normalizeDuplicateLinkKey(row.link);
    if (!key) continue;
    const bucket = buckets.get(key) ?? [];
    bucket.push(row);
    buckets.set(key, bucket);
  }

  const groups: ProductMergeGroup[] = [];
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.length < 2) continue;
    if (!areMergeableProductNames(bucket)) continue;
    const result = mergeProductRows(bucket);
    groups.push({ key, rows: bucket, ...result });
  }

  return { groups };
}

export function buildToyOriginalIdMergePlan(rows: DuplicateToyRow[]): MergePlan<ToyMergeGroup> {
  const buckets = new Map<string, DuplicateToyRow[]>();

  for (const row of rows) {
    const originalId = normalizeText(row.original_id);
    if (!originalId) continue;
    const bucket = buckets.get(originalId) ?? [];
    bucket.push(row);
    buckets.set(originalId, bucket);
  }

  const groups: ToyMergeGroup[] = [];
  for (const [originalId, bucket] of buckets.entries()) {
    if (bucket.length < 2) continue;
    const result = mergeToyRows(bucket);
    groups.push({ originalId, rows: bucket, ...result });
  }

  return { groups };
}

async function readProducts(client: pg.PoolClient) {
  const result = await client.query<DuplicateProductRow>(`
    WITH product_ref_counts AS (
      SELECT product_id AS id, count(*)::int AS ref_count FROM public.deep_reports GROUP BY product_id
      UNION ALL
      SELECT product_id AS id, count(*)::int AS ref_count FROM public.favorites GROUP BY product_id
      UNION ALL
      SELECT product_id AS id, count(*)::int AS ref_count FROM public.standardization_tests GROUP BY product_id
    ),
    ref_totals AS (
      SELECT id, sum(ref_count)::int AS ref_count
      FROM product_ref_counts
      GROUP BY id
    ),
    toy_totals AS (
      SELECT original_id AS id, count(*)::int AS toy_count
      FROM public.recommender_toys
      WHERE original_id IS NOT NULL
      GROUP BY original_id
    )
    SELECT
      p.id,
      p.competitor_id,
      p.name,
      p.price::text AS price,
      p.category,
      p.tags,
      p.link,
      p.image,
      p.sales::text AS sales,
      p.launch_date,
      p.gender,
      p.specs,
      p.price_history,
      p.analysis,
      p.reviews,
      p.price_analysis,
      p.use_scenario,
      p.persona_analysis,
      p.standardization_analysis,
      COALESCE(tt.toy_count, 0)::int AS toy_count,
      COALESCE(rt.ref_count, 0)::int AS ref_count
    FROM public.products AS p
    LEFT JOIN toy_totals AS tt ON tt.id = p.id
    LEFT JOIN ref_totals AS rt ON rt.id = p.id
  `);

  return result.rows;
}

async function readToys(client: pg.PoolClient) {
  const result = await client.query<DuplicateToyRow>(`
    SELECT
      t.id,
      t.original_id,
      t.name,
      t.price::text AS price,
      t.max_db,
      t.waterproof,
      t.appearance,
      t.physical_form,
      t.motor_type,
      t.gender,
      t.brand,
      t.material,
      t.image_url,
      t.raw_description,
      t.safe_display_name,
      t.type_code,
      t.subtype_code,
      t.recommendation_features,
      p.name AS product_name
    FROM public.recommender_toys AS t
    LEFT JOIN public.products AS p ON p.id = t.original_id
  `);

  return result.rows;
}

async function updateProductReferences(client: pg.PoolClient, deleteIds: string[], keeperId: string) {
  await client.query(`UPDATE public.recommender_toys SET original_id = $1 WHERE original_id = ANY($2::uuid[])`, [keeperId, deleteIds]);
  await client.query(`UPDATE public.deep_reports SET product_id = $1 WHERE product_id = ANY($2::uuid[])`, [keeperId, deleteIds]);
  await client.query(`UPDATE public.favorites SET product_id = $1 WHERE product_id = ANY($2::uuid[])`, [keeperId, deleteIds]);
  await client.query(`UPDATE public.standardization_tests SET product_id = $1 WHERE product_id = ANY($2::uuid[])`, [keeperId, deleteIds]);
}

async function applyProductGroup(client: pg.PoolClient, group: ProductMergeGroup) {
  await client.query(
    `
      UPDATE public.products
      SET
        competitor_id = $2,
        name = $3,
        price = $4,
        category = $5,
        tags = $6,
        link = $7,
        image = $8,
        sales = $9,
        launch_date = $10,
        gender = $11,
        specs = $12::jsonb,
        price_history = $13::jsonb,
        analysis = $14::jsonb,
        reviews = $15::jsonb,
        price_analysis = $16::jsonb,
        use_scenario = $17,
        persona_analysis = $18,
        standardization_analysis = $19::jsonb
      WHERE id = $1
    `,
    [
      group.keeper.id,
      group.merged.competitor_id,
      group.merged.name,
      group.merged.price,
      group.merged.category,
      group.merged.tags,
      group.merged.link,
      group.merged.image,
      group.merged.sales,
      group.merged.launch_date,
      group.merged.gender,
      JSON.stringify(group.merged.specs),
      JSON.stringify(group.merged.price_history),
      JSON.stringify(group.merged.analysis),
      JSON.stringify(group.merged.reviews),
      JSON.stringify(group.merged.price_analysis),
      group.merged.use_scenario,
      group.merged.persona_analysis,
      JSON.stringify(group.merged.standardization_analysis),
    ],
  );

  await updateProductReferences(client, group.deleteIds, group.keeper.id);
  await client.query(`DELETE FROM public.products WHERE id = ANY($1::uuid[])`, [group.deleteIds]);
}

async function applyToyGroup(client: pg.PoolClient, group: ToyMergeGroup) {
  await client.query(
    `
      UPDATE public.recommender_toys
      SET
        name = $2,
        price = $3,
        max_db = $4,
        waterproof = $5,
        appearance = $6,
        physical_form = $7,
        motor_type = $8,
        gender = $9,
        brand = $10,
        material = $11,
        image_url = $12,
        raw_description = $13,
        safe_display_name = $14,
        type_code = $15,
        subtype_code = $16,
        recommendation_features = $17::jsonb,
        updated_at = NOW()
      WHERE id = $1
    `,
    [
      group.keeper.id,
      group.merged.name,
      group.merged.price,
      group.merged.max_db,
      group.merged.waterproof,
      group.merged.appearance,
      group.merged.physical_form,
      group.merged.motor_type,
      group.merged.gender,
      group.merged.brand,
      group.merged.material,
      group.merged.image_url,
      group.merged.raw_description,
      group.merged.safe_display_name,
      group.merged.type_code,
      group.merged.subtype_code,
      JSON.stringify(group.merged.recommendation_features),
    ],
  );

  await client.query(`DELETE FROM public.recommender_toys WHERE id = ANY($1::uuid[])`, [group.deleteIds]);
}

export function shouldRunDuplicateCleanScript(importMetaUrl: string, argvEntry?: string) {
  return Boolean(argvEntry) && importMetaUrl === pathToFileURL(argvEntry).href;
}

async function cleanDuplicateProductsAndToys() {
  const dryRun = process.argv.includes("--dry-run");
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  const client = await pool.connect();

  try {
    await client.query(`SET statement_timeout TO 0`);
    await client.query(`SET lock_timeout TO '5s'`);

    const products = await readProducts(client);
    const productPlan = buildProductLinkMergePlan(products);

    let toyPlan: MergePlan<ToyMergeGroup>;
    if (dryRun || productPlan.groups.length === 0) {
      const toys = await readToys(client);
      toyPlan = buildToyOriginalIdMergePlan(toys);
    } else {
      await client.query("BEGIN");
      for (const group of productPlan.groups) {
        await applyProductGroup(client, group);
      }
      await client.query("COMMIT");
      const toys = await readToys(client);
      toyPlan = buildToyOriginalIdMergePlan(toys);
    }

    if (!dryRun && toyPlan.groups.length > 0) {
      await client.query("BEGIN");
      for (const group of toyPlan.groups) {
        await applyToyGroup(client, group);
      }
      await client.query("COMMIT");
    }

    const productDeleteCount = productPlan.groups.reduce((sum, group) => sum + group.deleteIds.length, 0);
    const toyDeleteCount = toyPlan.groups.reduce((sum, group) => sum + group.deleteIds.length, 0);

    console.log(
      JSON.stringify(
        {
          dryRun,
          product_groups: productPlan.groups.length,
          product_rows_to_delete: productDeleteCount,
          toy_groups: toyPlan.groups.length,
          toy_rows_to_delete: toyDeleteCount,
          product_samples: productPlan.groups.slice(0, 30).map((group) => ({
            key: group.key,
            keeper: { id: group.keeper.id, name: group.keeper.name },
            deleteIds: group.deleteIds,
            names: group.rows.map((row) => row.name),
          })),
          toy_samples: toyPlan.groups.slice(0, 30).map((group) => ({
            originalId: group.originalId,
            keeper: { id: group.keeper.id, name: group.keeper.name },
            deleteIds: group.deleteIds,
            names: group.rows.map((row) => row.name),
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
    client.release();
    await pool.end().catch(() => {});
  }
}

if (shouldRunDuplicateCleanScript(import.meta.url, process.argv[1])) {
  cleanDuplicateProductsAndToys().catch((error) => {
    console.error("[clean-duplicate-products-and-toys] 执行失败:", error);
    process.exitCode = 1;
  });
}
