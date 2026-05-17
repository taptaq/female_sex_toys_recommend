import pg from "pg";
import dotenv from "dotenv";
import { pathToFileURL } from "node:url";

import {
  classifyLibrarySubtypeCode,
  classifyLibraryTypeCode,
} from "../lib/library-product-type-classifier.ts";
import type {
  LibrarySubtypeCode,
  LibraryTypeCode,
} from "../lib/library-product-types.ts";

dotenv.config();

const { Pool } = pg;

export type BdsmReclassifyRow = {
  id: string;
  name: string;
  gender: string | null;
  physical_form: string | null;
  current_type_code: string | null;
  current_subtype_code: string | null;
  raw_description: string | null;
  product_tags: string[] | null;
  product_raw_description: string | null;
};

export function buildBdsmReclassifyInput(row: BdsmReclassifyRow) {
  return {
    gender: row.gender,
    physicalForm: row.physical_form,
    name: row.name,
    rawDescription: [row.raw_description, row.product_raw_description]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .join("\n") || null,
    tags: Array.isArray(row.product_tags)
      ? row.product_tags.filter(
          (value): value is string => typeof value === "string" && value.trim().length > 0,
        )
      : [],
  };
}

export function classifyBdsmReclassifyRow(row: BdsmReclassifyRow) {
  const input = buildBdsmReclassifyInput(row);
  const typeCode = classifyLibraryTypeCode(input);
  const subtypeCode = classifyLibrarySubtypeCode({
    ...input,
    typeCode,
  });

  return {
    typeCode,
    subtypeCode,
  } satisfies {
    typeCode: LibraryTypeCode;
    subtypeCode: LibrarySubtypeCode | null;
  };
}

const BDSM_RECLASSIFY_NIPPLE_STRONG_PATTERNS = [
  /nipple\s*clamps?/iu,
  /nipple\s*clips?/iu,
  /乳夹按摩器/u,
  /无线乳夹/u,
  /震动乳夹/u,
  /振动乳夹/u,
  /乳头夹按摩器/u,
];

export function shouldIncludeBdsmReclassifyRow(row: BdsmReclassifyRow) {
  if (row.current_type_code === "bdsm") {
    return true;
  }

  const joinedText = [
    row.name,
    row.raw_description,
    row.product_raw_description,
    ...(Array.isArray(row.product_tags) ? row.product_tags : []),
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n");

  return BDSM_RECLASSIFY_NIPPLE_STRONG_PATTERNS.some((pattern) => pattern.test(joinedText));
}

export function shouldRunBdsmReclassifyScript(
  importMetaUrl: string,
  argvEntry?: string,
) {
  if (!argvEntry) {
    return false;
  }

  return importMetaUrl === pathToFileURL(argvEntry).href;
}

async function backfillBdsmReclassify() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });

  const client = await pool.connect();

  try {
    console.log("[backfill-bdsm-reclassify] 开始重算已标记为 BDSM 的 recommender_toys ...");
    await client.query("BEGIN");
    await client.query("SET statement_timeout TO 0");
    await client.query("SET lock_timeout TO '5s'");

    const result = await client.query<BdsmReclassifyRow>(`
      SELECT
        t.id,
        t.name,
        t.gender,
        t.physical_form,
        t.type_code AS current_type_code,
        t.subtype_code AS current_subtype_code,
        t.raw_description,
        p.tags AS product_tags,
        COALESCE(p.specs::jsonb ->> 'rawDescription', '') AS product_raw_description
      FROM public.recommender_toys t
      LEFT JOIN public.products p ON p.id = t.original_id
      WHERE t.type_code IN ('bdsm', 'couples', 'suction', 'external_vibe')
      ORDER BY t.id
    `);

    let updated = 0;
    const targetRows = result.rows.filter(shouldIncludeBdsmReclassifyRow);
    for (const row of targetRows) {
      const next = classifyBdsmReclassifyRow(row);
      if (
        row.current_type_code === next.typeCode &&
        row.current_subtype_code === next.subtypeCode
      ) {
        continue;
      }

      await client.query(
        `
          UPDATE public.recommender_toys
          SET type_code = $2,
              subtype_code = $3,
              updated_at = NOW()
          WHERE id = $1
        `,
        [row.id, next.typeCode, next.subtypeCode],
      );
      updated += 1;
      console.log(
        `[backfill-bdsm-reclassify] ${row.name}: ${row.current_type_code}/${row.current_subtype_code} -> ${next.typeCode}/${next.subtypeCode}`,
      );
    }

    await client.query("COMMIT");
    console.log(
      JSON.stringify(
        {
          scanned: targetRows.length,
          updated,
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

if (shouldRunBdsmReclassifyScript(import.meta.url, process.argv[1])) {
  backfillBdsmReclassify().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
