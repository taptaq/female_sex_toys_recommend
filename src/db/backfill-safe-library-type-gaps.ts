import dotenv from "dotenv";
import pg from "pg";
import { pathToFileURL } from "node:url";

import {
  classifySubtypeCodeBackfillRow,
  classifyTypeCodeBackfillRow,
  type TypeCodeBackfillRow,
} from "./backfill-item-type-code.ts";

dotenv.config();

const { Pool } = pg;
const READ_BATCH_SIZE = 100;
const SIGNAL_TEXT_LIMIT = 1200;

type SafeTypeGapRow = {
  id: string;
  name: string;
  gender: string | null;
  physical_form: string | null;
  raw_description: string | null;
  current_type_code: string | null;
  current_subtype_code: string | null;
  product_tags: string[] | null;
  product_raw_description: string | null;
};

export type SafeTypeGapPatch = {
  id: string;
  name: string;
  typeCode: string;
  subtypeCode: string | null;
  fromTypeCode: string | null;
  fromSubtypeCode: string | null;
};

const UNSAFE_AUTO_CLASSIFY_NAME_PATTERNS = [
  /\bbundle\b/i,
  /\bkit\b/i,
  /\bset\b/i,
  /\battachment\b/i,
  /\bharness\b/i,
  /套装/u,
  /配件/u,
  /背带/u,
  /项链/u,
  /珠宝/u,
  /\bnecklace\b/i,
  /\bjewelry\b/i,
];

const SAFE_TARGET_TYPE_CODES = new Set([
  "suction",
  "external_vibe",
  "insertable",
  "masturbator",
  "care_accessory",
  "wearable_remote",
  "bdsm",
]);

const EMPTY_OCR_DESCRIPTION_PATTERNS = [
  /产品名称\/型号：未提及/u,
  /产品类型与使用方式：未提及/u,
  /动力规格.*未提及/u,
  /核心卖点：未提及/u,
  /未执行或未识别到有效文字/u,
];

function buildAutoClassifyRiskText(row: SafeTypeGapRow) {
  return [
    row.name,
    row.raw_description,
    row.product_raw_description,
    ...(Array.isArray(row.product_tags) ? row.product_tags : []),
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n");
}

function hasOnlyEmptyOcrEvidence(row: SafeTypeGapRow) {
  const rawDescription = String(row.raw_description ?? "");
  const productRawDescription = String(row.product_raw_description ?? "");
  const descriptions = [rawDescription, productRawDescription]
    .filter((value) => value.trim().length > 0)
    .map((value) => value.trim());

  return (
    descriptions.length > 0 &&
    descriptions.every((text) =>
      EMPTY_OCR_DESCRIPTION_PATTERNS.some((pattern) => pattern.test(text)),
    )
  );
}

export function isSafeLibraryTypeGapPatch(
  patch: SafeTypeGapPatch,
  row?: SafeTypeGapRow,
) {
  if (!SAFE_TARGET_TYPE_CODES.has(patch.typeCode)) {
    return false;
  }

  const riskText = row ? buildAutoClassifyRiskText(row) : patch.name;
  if (UNSAFE_AUTO_CLASSIFY_NAME_PATTERNS.some((pattern) => pattern.test(riskText))) {
    return false;
  }

  if (row && hasOnlyEmptyOcrEvidence(row)) {
    return false;
  }

  return patch.typeCode !== patch.fromTypeCode || patch.subtypeCode !== patch.fromSubtypeCode;
}

export function buildSafeLibraryTypeGapPatch(
  row: SafeTypeGapRow,
): SafeTypeGapPatch | null {
  const classifierRow: TypeCodeBackfillRow = {
    id: row.id,
    name: row.name,
    gender: row.gender,
    physical_form: row.physical_form,
    raw_description: row.raw_description,
    product_tags: Array.isArray(row.product_tags) ? row.product_tags : [],
    product_raw_description: row.product_raw_description,
  };
  const typeCode = classifyTypeCodeBackfillRow(classifierRow);
  const subtypeCode = classifySubtypeCodeBackfillRow(classifierRow);
  const patch = {
    id: row.id,
    name: row.name,
    typeCode,
    subtypeCode,
    fromTypeCode: row.current_type_code,
    fromSubtypeCode: row.current_subtype_code,
  };

  return isSafeLibraryTypeGapPatch(patch, row) ? patch : null;
}

export function shouldRunSafeLibraryTypeGapsScript(
  importMetaUrl: string,
  argvEntry?: string,
) {
  if (!argvEntry) {
    return false;
  }

  return importMetaUrl === pathToFileURL(argvEntry).href;
}

async function readSafeTypeGapRows(client: pg.PoolClient) {
  const result = await client.query<SafeTypeGapRow>(
    `
      SELECT
        t.id,
        t.name,
        t.gender,
        t.physical_form,
        LEFT(COALESCE(t.raw_description, ''), $1) AS raw_description,
        t.type_code AS current_type_code,
        t.subtype_code AS current_subtype_code,
        p.tags AS product_tags,
        LEFT(COALESCE(p.specs::jsonb ->> 'rawDescription', ''), $1) AS product_raw_description
      FROM public.recommender_toys AS t
      LEFT JOIN public.products AS p ON p.id = t.original_id
      WHERE t.type_code = 'unknown'
         OR t.subtype_code IS NULL
         OR BTRIM(t.subtype_code) = ''
      ORDER BY t.type_code, t.name
      LIMIT $2
    `,
    [SIGNAL_TEXT_LIMIT, READ_BATCH_SIZE],
  );

  return result.rows;
}

async function backfillSafeLibraryTypeGaps() {
  const dryRun = process.argv.includes("--dry-run");
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  const client = await pool.connect();

  try {
    console.log(
      `[backfill-safe-library-type-gaps] 开始${dryRun ? "预演" : "回填"}可信 type/subtype 空洞 ...`,
    );
    await client.query("SET statement_timeout TO 0");
    await client.query("SET lock_timeout TO '5s'");

    const rows = await readSafeTypeGapRows(client);
    const patches = rows
      .map(buildSafeLibraryTypeGapPatch)
      .filter((patch): patch is SafeTypeGapPatch => patch !== null);

    let updated = 0;
    if (!dryRun && patches.length > 0) {
      const placeholders = patches
        .map(
          (_, index) =>
            `($${index * 3 + 1}::uuid, $${index * 3 + 2}::text, $${index * 3 + 3}::text)`,
        )
        .join(", ");
      const values = patches.flatMap((patch) => [
        patch.id,
        patch.typeCode,
        patch.subtypeCode,
      ]);
      const result = await client.query(
        `
          UPDATE public.recommender_toys AS t
          SET type_code = v.type_code,
              subtype_code = v.subtype_code,
              updated_at = NOW()
          FROM (
            VALUES ${placeholders}
          ) AS v(id, type_code, subtype_code)
          WHERE t.id = v.id
            AND (
              t.type_code IS DISTINCT FROM v.type_code OR
              t.subtype_code IS DISTINCT FROM v.subtype_code
            )
        `,
        values,
      );
      updated = result.rowCount ?? 0;
    }

    console.log(
      JSON.stringify(
        {
          scanned: rows.length,
          dryRun,
          candidates: patches.length,
          updated,
          sample_names: patches.slice(0, 30).map((patch) => ({
            name: patch.name,
            from: [patch.fromTypeCode, patch.fromSubtypeCode],
            to: [patch.typeCode, patch.subtypeCode],
          })),
        },
        null,
        2,
      ),
    );
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}

if (shouldRunSafeLibraryTypeGapsScript(import.meta.url, process.argv[1])) {
  backfillSafeLibraryTypeGaps().catch((error) => {
    console.error("[backfill-safe-library-type-gaps] 执行失败:", error);
    process.exitCode = 1;
  });
}
