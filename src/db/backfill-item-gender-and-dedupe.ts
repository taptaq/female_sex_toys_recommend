import pg from "pg";
import dotenv from "dotenv";
import { pathToFileURL } from "node:url";

import { buildSafeDisplayName } from "../lib/product-display-name.ts";
import type { ResolvedLibraryAudienceGender } from "../lib/library-product-type-classifier.ts";

dotenv.config();

const { Pool } = pg;

const SAME_NAME_DELETE_BATCH_SIZE = 100;

const FEMALE_HARD_PATTERNS = [
  /女性/u,
  /女用/u,
  /女生/u,
  /女士/u,
  /阴蒂/u,
  /g点/u,
  /g-spot/u,
  /跳蛋/u,
  /兔耳/u,
  /兔嘴/u,
  /兔子/u,
  /口红/u,
  /panty/u,
];

const FEMALE_SOFT_PATTERNS = [
  /按摩棒/u,
  /震动棒/u,
  /振动棒/u,
  /av棒/u,
  /吸吮/u,
  /吮吸/u,
  /bullet/u,
  /wand/u,
];

const MALE_HARD_PATTERNS = [
  /男性/u,
  /男用/u,
  /男士/u,
  /前列腺/u,
  /飞机杯/u,
  /自慰杯/u,
  /自慰器/u,
  /阴茎/u,
  /龟头/u,
  /cock\s*ring/u,
  /penis/u,
  /fleshlight/u,
  /stroker/u,
  /masturbator/u,
  /pump/u,
  /倒模/u,
  /臀倒模/u,
  /腿模/u,
  /vagina\s*(and|&)\s*ass/u,
];

const UNISEX_HARD_PATTERNS = [
  /情侣/u,
  /夫妻/u,
  /双人/u,
  /共玩/u,
  /for\s+two/u,
  /couples?/u,
  /unisex/u,
  /男女通用/u,
];

const FEMALE_DEFAULT_BRANDS = new Set([
  "womanizer",
  "iroha",
  "kistoy",
  "绒谱",
  "romp",
]);

const MALE_DEFAULT_BRANDS = new Set([
  "arcwave",
]);

const FEMALE_LEANING_TYPES = new Set([
  "suction",
  "external_vibe",
  "insertable",
  "dual_stimulation",
]);

const MALE_ONLY_TYPES = new Set([
  "masturbator",
  "prostate",
  "cock_ring",
]);

const UNISEX_TYPES = new Set([
  "couples",
]);

export type GenderDedupeRow = {
  id: string;
  original_id: string | null;
  name: string;
  price: number | string | null;
  max_db: number | null;
  waterproof: number | null;
  appearance: string | null;
  physical_form: string | null;
  motor_type: string | null;
  gender: string | null;
  brand: string | null;
  material: string | null;
  image_url: string | null;
  created_at: string | null;
  updated_at: string | null;
  raw_description: string | null;
  safe_display_name: string | null;
  type_code: string | null;
  subtype_code: string | null;
  product_tags: string[] | null;
  product_raw_description: string | null;
};

export type DuplicateMergeResult = {
  keeper: GenderDedupeRow;
  merged: GenderDedupeRow;
  deleteIds: string[];
};

function normalizeText(value: string | null | undefined) {
  return String(value ?? "").trim();
}

function normalizeKey(value: string | null | undefined) {
  return normalizeText(value).toLowerCase();
}

function buildSignalText(row: GenderDedupeRow) {
  return [
    row.name,
    row.brand,
    row.raw_description,
    row.product_raw_description,
    ...(Array.isArray(row.product_tags) ? row.product_tags : []),
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n")
    .toLowerCase();
}

function hasAnyPattern(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function isMeaningfulString(value: string | null | undefined) {
  return normalizeText(value).length > 0;
}

function chooseLongerText(
  currentValue: string | null,
  candidateValue: string | null,
) {
  const currentText = normalizeText(currentValue);
  const candidateText = normalizeText(candidateValue);

  if (!candidateText) {
    return currentValue;
  }

  if (!currentText || candidateText.length > currentText.length) {
    return candidateValue;
  }

  return currentValue;
}

function chooseFilledValue<T>(
  currentValue: T | null,
  candidateValue: T | null,
) {
  if (currentValue !== null && currentValue !== undefined && currentValue !== "") {
    return currentValue;
  }

  return candidateValue;
}

function normalizeBrandForDedup(brand: string | null) {
  return normalizeKey(brand);
}

function inferBrandFallbackGender(
  brand: string | null,
  name: string,
): ResolvedLibraryAudienceGender | null {
  const brandKey = normalizeBrandForDedup(brand);
  const nameKey = normalizeKey(name);

  if (brandKey === "tenga" && nameKey.includes("iroha")) {
    return "female";
  }

  if (FEMALE_DEFAULT_BRANDS.has(brandKey)) {
    return "female";
  }

  if (brandKey === "tenga") {
    return "male";
  }

  if (MALE_DEFAULT_BRANDS.has(brandKey)) {
    return "male";
  }

  return null;
}

export function resolveRecommenderToyGender(
  row: GenderDedupeRow,
): ResolvedLibraryAudienceGender {
  const signalText = buildSignalText(row);
  const currentGender = normalizeKey(row.gender);
  const typeCode = normalizeKey(row.type_code);

  const hasFemaleHard = hasAnyPattern(signalText, FEMALE_HARD_PATTERNS);
  const hasFemaleSoft = hasAnyPattern(signalText, FEMALE_SOFT_PATTERNS);
  const hasMaleHard = hasAnyPattern(signalText, MALE_HARD_PATTERNS);
  const hasUnisexHard = hasAnyPattern(signalText, UNISEX_HARD_PATTERNS);
  const brandFallback = inferBrandFallbackGender(row.brand, row.name);

  if (hasMaleHard && !hasFemaleHard) {
    return "male";
  }

  if (hasFemaleHard && !hasMaleHard) {
    return "female";
  }

  if (hasUnisexHard && !hasMaleHard && !hasFemaleHard) {
    return "unisex";
  }

  if (MALE_ONLY_TYPES.has(typeCode) && !hasFemaleHard) {
    return "male";
  }

  if (UNISEX_TYPES.has(typeCode) && !hasMaleHard && !hasFemaleHard) {
    return "unisex";
  }

  if (
    FEMALE_LEANING_TYPES.has(typeCode) &&
    !hasMaleHard &&
    (hasFemaleSoft || brandFallback === "female")
  ) {
    return "female";
  }

  if (brandFallback === "male" && !hasFemaleHard) {
    return "male";
  }

  if (brandFallback === "female" && !hasMaleHard) {
    return "female";
  }

  if (currentGender === "female" || currentGender === "male" || currentGender === "unisex") {
    return currentGender;
  }

  return "unisex";
}

function scoreDuplicateRow(row: GenderDedupeRow) {
  let score = 0;

  if (isMeaningfulString(row.original_id)) score += 6;
  if (isMeaningfulString(row.raw_description)) score += 5;
  if (isMeaningfulString(row.product_raw_description)) score += 3;
  if (isMeaningfulString(row.type_code)) score += 3;
  if (isMeaningfulString(row.subtype_code)) score += 3;
  if (isMeaningfulString(row.image_url)) score += 2;
  if (isMeaningfulString(row.safe_display_name)) score += 1;
  if (isMeaningfulString(row.material)) score += 1;
  if (row.price !== null && row.price !== undefined) score += 1;
  if (row.max_db !== null && row.max_db !== undefined) score += 1;
  if (row.waterproof !== null && row.waterproof !== undefined) score += 1;

  return score;
}

function compareRowsForPreference(a: GenderDedupeRow, b: GenderDedupeRow) {
  const scoreDifference = scoreDuplicateRow(b) - scoreDuplicateRow(a);
  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  const updatedA = Date.parse(a.updated_at ?? "") || 0;
  const updatedB = Date.parse(b.updated_at ?? "") || 0;
  if (updatedB !== updatedA) {
    return updatedB - updatedA;
  }

  return a.id.localeCompare(b.id);
}

export function selectPrimaryDuplicateRow(rows: GenderDedupeRow[]) {
  return [...rows].sort(compareRowsForPreference)[0]!;
}

export function partitionDuplicateNameRows(rows: GenderDedupeRow[]) {
  const bucketsByBrand = new Map<string, GenderDedupeRow[]>();
  const brandlessRows: GenderDedupeRow[] = [];

  for (const row of rows) {
    const brandKey = normalizeBrandForDedup(row.brand);
    if (!brandKey) {
      brandlessRows.push(row);
      continue;
    }

    const bucket = bucketsByBrand.get(brandKey) ?? [];
    bucket.push(row);
    bucketsByBrand.set(brandKey, bucket);
  }

  if (bucketsByBrand.size === 0) {
    return brandlessRows.length > 0 ? [brandlessRows] : [];
  }

  if (bucketsByBrand.size === 1 && brandlessRows.length > 0) {
    return [[...bucketsByBrand.values()][0]!, ...[]].map((bucket, index) =>
      index === 0 ? [...bucket, ...brandlessRows] : bucket,
    );
  }

  const grouped = [...bucketsByBrand.values()];

  for (const row of brandlessRows) {
    grouped.push([row]);
  }

  return grouped;
}

export function mergeDuplicateRowGroup(
  rows: GenderDedupeRow[],
): DuplicateMergeResult {
  const keeper = selectPrimaryDuplicateRow(rows);
  const others = rows.filter((row) => row.id !== keeper.id);
  const merged: GenderDedupeRow = { ...keeper };

  for (const row of others) {
    merged.original_id = chooseFilledValue(merged.original_id, row.original_id);
    merged.price = chooseFilledValue(merged.price, row.price);
    merged.max_db = chooseFilledValue(merged.max_db, row.max_db);
    merged.waterproof = chooseFilledValue(merged.waterproof, row.waterproof);
    merged.appearance = chooseLongerText(merged.appearance, row.appearance);
    merged.physical_form = chooseFilledValue(merged.physical_form, row.physical_form);
    merged.motor_type = chooseLongerText(merged.motor_type, row.motor_type);
    merged.brand = chooseFilledValue(merged.brand, row.brand);
    merged.material = chooseLongerText(merged.material, row.material);
    merged.image_url = chooseFilledValue(merged.image_url, row.image_url);
    merged.raw_description = chooseLongerText(merged.raw_description, row.raw_description);
    merged.safe_display_name = chooseFilledValue(
      merged.safe_display_name,
      row.safe_display_name,
    );
    merged.type_code = chooseFilledValue(merged.type_code, row.type_code);
    merged.subtype_code = chooseFilledValue(merged.subtype_code, row.subtype_code);
    merged.product_raw_description = chooseLongerText(
      merged.product_raw_description,
      row.product_raw_description,
    );

    const mergedTags = new Set<string>(
      [...(merged.product_tags ?? []), ...(row.product_tags ?? [])].filter((value) =>
        isMeaningfulString(value),
      ),
    );
    merged.product_tags = [...mergedTags];
  }

  if (!isMeaningfulString(merged.safe_display_name)) {
    merged.safe_display_name = buildSafeDisplayName(merged.name);
  }

  return {
    keeper,
    merged,
    deleteIds: others.map((row) => row.id).sort(),
  };
}

export function shouldRunGenderDedupeScript(
  importMetaUrl: string,
  argvEntry?: string,
) {
  if (!argvEntry) {
    return false;
  }

  return importMetaUrl === pathToFileURL(argvEntry).href;
}

async function runGenderBackfillAndDedupe() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(`SET statement_timeout TO 0`);
    await client.query(`SET lock_timeout TO '5s'`);

    const result = await client.query<GenderDedupeRow>(`
      SELECT
        t.id,
        t.original_id,
        t.name,
        t.price,
        t.max_db,
        t.waterproof,
        t.appearance,
        t.physical_form,
        t.motor_type,
        t.gender,
        t.brand,
        t.material,
        t.image_url,
        t.created_at::text,
        t.updated_at::text,
        t.raw_description,
        t.safe_display_name,
        t.type_code,
        t.subtype_code,
        p.tags AS product_tags,
        COALESCE(p.specs::jsonb ->> 'rawDescription', NULL) AS product_raw_description
      FROM public.recommender_toys t
      LEFT JOIN public.products p
        ON t.original_id = p.id
      ORDER BY t.id
    `);

    const rows = result.rows;
    const rowsByName = new Map<string, GenderDedupeRow[]>();

    for (const row of rows) {
      const nameKey = normalizeKey(row.name);
      const bucket = rowsByName.get(nameKey) ?? [];
      bucket.push(row);
      rowsByName.set(nameKey, bucket);
    }

    const mergedRowsById = new Map<string, GenderDedupeRow>();
    const idsToDelete = new Set<string>();
    let dedupedGroups = 0;

    for (const bucket of rowsByName.values()) {
      if (bucket.length === 1) {
        const [row] = bucket;
        if (row) {
          mergedRowsById.set(row.id, row);
        }
        continue;
      }

      const partitions = partitionDuplicateNameRows(bucket);
      for (const partition of partitions) {
        if (partition.length === 1) {
          const [row] = partition;
          if (row) {
            mergedRowsById.set(row.id, row);
          }
          continue;
        }

        const mergeResult = mergeDuplicateRowGroup(partition);
        mergedRowsById.set(mergeResult.keeper.id, mergeResult.merged);
        for (const deleteId of mergeResult.deleteIds) {
          idsToDelete.add(deleteId);
        }
        dedupedGroups += 1;
      }
    }

    let mergedUpdates = 0;
    let genderUpdates = 0;

    for (const mergedRow of mergedRowsById.values()) {
      if (idsToDelete.has(mergedRow.id)) {
        continue;
      }

      const nextGender = resolveRecommenderToyGender(mergedRow);
      const normalizedCurrentGender = normalizeKey(mergedRow.gender);
      const nextSafeDisplayName =
        mergedRow.safe_display_name && isMeaningfulString(mergedRow.safe_display_name)
          ? mergedRow.safe_display_name
          : buildSafeDisplayName(mergedRow.name);

      const sourceRow = rows.find((row) => row.id === mergedRow.id);
      const rowChanged =
        mergedRow.original_id !== sourceRow?.original_id ||
        mergedRow.price !== sourceRow?.price ||
        mergedRow.max_db !== sourceRow?.max_db ||
        mergedRow.waterproof !== sourceRow?.waterproof ||
        mergedRow.appearance !== sourceRow?.appearance ||
        mergedRow.physical_form !== sourceRow?.physical_form ||
        mergedRow.motor_type !== sourceRow?.motor_type ||
        mergedRow.brand !== sourceRow?.brand ||
        mergedRow.material !== sourceRow?.material ||
        mergedRow.image_url !== sourceRow?.image_url ||
        mergedRow.raw_description !== sourceRow?.raw_description ||
        nextSafeDisplayName !== sourceRow?.safe_display_name ||
        mergedRow.type_code !== sourceRow?.type_code ||
        mergedRow.subtype_code !== sourceRow?.subtype_code;

      const genderChanged = normalizedCurrentGender !== nextGender;

      if (!rowChanged && !genderChanged) {
        continue;
      }

      await client.query(
        `
          UPDATE public.recommender_toys
          SET
            original_id = $2,
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
            updated_at = NOW()
          WHERE id = $1
        `,
        [
          mergedRow.id,
          mergedRow.original_id,
          mergedRow.price,
          mergedRow.max_db,
          mergedRow.waterproof,
          mergedRow.appearance,
          mergedRow.physical_form,
          mergedRow.motor_type,
          nextGender,
          mergedRow.brand,
          mergedRow.material,
          mergedRow.image_url,
          mergedRow.raw_description,
          nextSafeDisplayName,
          mergedRow.type_code,
          mergedRow.subtype_code,
        ],
      );

      if (rowChanged) {
        mergedUpdates += 1;
      }
      if (genderChanged) {
        genderUpdates += 1;
      }
    }

    const deleteIdList = [...idsToDelete];
    for (let index = 0; index < deleteIdList.length; index += SAME_NAME_DELETE_BATCH_SIZE) {
      const batch = deleteIdList.slice(index, index + SAME_NAME_DELETE_BATCH_SIZE);
      if (batch.length === 0) {
        continue;
      }

      await client.query(
        `
          DELETE FROM public.recommender_toys
          WHERE id = ANY($1::uuid[])
        `,
        [batch],
      );
    }

    await client.query("COMMIT");

    console.log(
      JSON.stringify(
        {
          scanned: rows.length,
          deduped_groups: dedupedGroups,
          deleted_rows: deleteIdList.length,
          merged_updates: mergedUpdates,
          gender_updates: genderUpdates,
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

if (shouldRunGenderDedupeScript(import.meta.url, process.argv[1])) {
  runGenderBackfillAndDedupe().catch((error) => {
    console.error("[backfill-item-gender-and-dedupe] 执行失败:", error);
    process.exitCode = 1;
  });
}
