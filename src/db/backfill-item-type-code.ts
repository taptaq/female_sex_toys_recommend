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
const TYPE_CODE_UPDATE_BATCH_SIZE = 200;
const TYPE_CODE_READ_BATCH_SIZE = 100;
const TYPE_CODE_SIGNAL_TEXT_LIMIT = 1200;

type ToyBackfillBaseRow = {
  id: string;
  original_id: string | null;
  name: string;
  gender: string | null;
  physical_form: string | null;
  raw_description: string | null;
  current_type_code: string | null;
  current_subtype_code: string | null;
};

type ProductSignalRow = {
  id: string;
  product_tags: string[] | null;
  product_raw_description: string | null;
};

export type TypeCodeBackfillRow = {
  id: string;
  name: string;
  gender: string | null;
  physical_form: string | null;
  raw_description: string | null;
  product_tags: string[] | null;
  product_raw_description: string | null;
};

export function buildTypeCodeSignals(row: TypeCodeBackfillRow) {
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

export function classifyTypeCodeBackfillRow(
  row: TypeCodeBackfillRow,
): LibraryTypeCode {
  return classifyLibraryTypeCode(buildTypeCodeSignals(row));
}

export function classifySubtypeCodeBackfillRow(
  row: TypeCodeBackfillRow,
): LibrarySubtypeCode | null {
  const signals = buildTypeCodeSignals(row);
  const typeCode = classifyLibraryTypeCode(signals);

  return classifyLibrarySubtypeCode({
    ...signals,
    typeCode,
  });
}

export function shouldRunTypeCodeBackfillScript(
  importMetaUrl: string,
  argvEntry?: string,
) {
  if (!argvEntry) {
    return false;
  }

  return importMetaUrl === pathToFileURL(argvEntry).href;
}

export function chunkTypeCodeUpdates<T>(items: T[], chunkSize: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}

export function hydrateTypeCodeBackfillRows(
  toyRows: ToyBackfillBaseRow[],
  productRowsById: Map<string, ProductSignalRow>,
): Array<
  TypeCodeBackfillRow & {
    current_type_code: string | null;
    current_subtype_code: string | null;
  }
> {
  return toyRows.map((row) => {
    const productRow = row.original_id
      ? productRowsById.get(row.original_id)
      : undefined;

    return {
      id: row.id,
      name: row.name,
      gender: row.gender,
      physical_form: row.physical_form,
      raw_description: row.raw_description,
      current_type_code: row.current_type_code,
      current_subtype_code: row.current_subtype_code,
      product_tags: productRow?.product_tags ?? [],
      product_raw_description: productRow?.product_raw_description ?? null,
    };
  });
}

export function collectUniqueOriginalIds(rows: ToyBackfillBaseRow[]) {
  return [
    ...new Set(
      rows
        .map((row) => row.original_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  ];
}

async function readToyBackfillBatch(
  client: pg.PoolClient,
  lastSeenId?: string,
) {
  const params: Array<number | string> = [TYPE_CODE_SIGNAL_TEXT_LIMIT, TYPE_CODE_READ_BATCH_SIZE];
  const cursorClause =
    typeof lastSeenId === "string"
      ? `WHERE t.id > $3::uuid`
      : "";

  if (typeof lastSeenId === "string") {
    params.push(lastSeenId);
  }

  const result = await client.query<ToyBackfillBaseRow>(
    `
      SELECT
        t.id,
        t.original_id,
        t.name,
        t.gender,
        t.physical_form,
        LEFT(COALESCE(t.raw_description, ''), $1) AS raw_description,
        t.type_code AS current_type_code,
        t.subtype_code AS current_subtype_code
      FROM public.recommender_toys AS t
      ${cursorClause}
      ORDER BY t.id
      LIMIT $2
    `,
    params,
  );

  return result.rows;
}

async function backfillItemTypeCode() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });

  const client = await pool.connect();

  try {
    console.log("[backfill-item-type-code] 开始回填 recommender_toys.type_code ...");
    await client.query(`SET statement_timeout TO 0`);
    await client.query(`SET lock_timeout TO '5s'`);

    const columnExistsResult = await client.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'recommender_toys'
          AND column_name = 'type_code'
      ) AS exists
    `);

    if (!columnExistsResult.rows[0]?.exists) {
      await client.query(`
        ALTER TABLE public.recommender_toys
        ADD COLUMN type_code TEXT
      `);
    }

    const subtypeColumnExistsResult = await client.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'recommender_toys'
          AND column_name = 'subtype_code'
      ) AS exists
    `);

    if (!subtypeColumnExistsResult.rows[0]?.exists) {
      await client.query(`
        ALTER TABLE public.recommender_toys
        ADD COLUMN subtype_code TEXT
      `);
    }

    let updated = 0;
    let known = 0;
    let unknown = 0;
    let scanned = 0;
    const distribution = new Map<LibraryTypeCode, number>();
    const subtypeDistribution = new Map<string, number>();
    let lastSeenId: string | undefined;
    let batchIndex = 0;

    while (true) {
      const toyBatch = await readToyBackfillBatch(client, lastSeenId);

      if (toyBatch.length === 0) {
        break;
      }

      batchIndex += 1;
      scanned += toyBatch.length;
      lastSeenId = toyBatch[toyBatch.length - 1]?.id;

      const originalIds = collectUniqueOriginalIds(toyBatch);
      const productRowsById = new Map<string, ProductSignalRow>();

      for (const batch of chunkTypeCodeUpdates(originalIds, TYPE_CODE_UPDATE_BATCH_SIZE)) {
        const productResult = await client.query<ProductSignalRow>(
          `
            SELECT
              p.id,
              p.tags AS product_tags,
              LEFT(COALESCE(p.specs::jsonb ->> 'rawDescription', ''), $2) AS product_raw_description
            FROM public.products AS p
            WHERE p.id = ANY($1::uuid[])
          `,
          [batch, TYPE_CODE_SIGNAL_TEXT_LIMIT],
        );

        for (const row of productResult.rows) {
          productRowsById.set(row.id, row);
        }
      }

      const hydratedBatch = hydrateTypeCodeBackfillRows(toyBatch, productRowsById);
      const pendingUpdates: Array<{
        id: string;
        typeCode: LibraryTypeCode;
        subtypeCode: LibrarySubtypeCode | null;
      }> = [];

      for (const row of hydratedBatch) {
        const nextTypeCode = classifyTypeCodeBackfillRow(row);
        const nextSubtypeCode = classifySubtypeCodeBackfillRow(row);
        distribution.set(nextTypeCode, (distribution.get(nextTypeCode) ?? 0) + 1);
        subtypeDistribution.set(
          nextSubtypeCode ?? "null",
          (subtypeDistribution.get(nextSubtypeCode ?? "null") ?? 0) + 1,
        );

        if (nextTypeCode === "unknown") {
          unknown += 1;
        } else {
          known += 1;
        }

        if (
          row.current_type_code === nextTypeCode &&
          row.current_subtype_code === nextSubtypeCode
        ) {
          continue;
        }

        pendingUpdates.push({
          id: row.id,
          typeCode: nextTypeCode,
          subtypeCode: nextSubtypeCode,
        });
      }

      for (const batch of chunkTypeCodeUpdates(
        pendingUpdates,
        TYPE_CODE_UPDATE_BATCH_SIZE,
      )) {
        const placeholders = batch
          .map(
            (_, index) =>
              `($${index * 3 + 1}::uuid, $${index * 3 + 2}::text, $${index * 3 + 3}::text)`,
          )
          .join(", ");
        const values = batch.flatMap((item) => [
          item.id,
          item.typeCode,
          item.subtypeCode,
        ]);

        await client.query(
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
        updated += batch.length;
      }

      console.log(
        `[backfill-item-type-code] 已完成批次 ${batchIndex}，本批 ${toyBatch.length} 条，累计扫描 ${scanned} 条，累计更新 ${updated} 条`,
      );
    }

    console.log(
      JSON.stringify(
        {
          scanned,
          updated,
          known,
          unknown,
          distribution: Object.fromEntries([...distribution.entries()].sort()),
          subtypeDistribution: Object.fromEntries([...subtypeDistribution.entries()].sort()),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    throw error;
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}

if (shouldRunTypeCodeBackfillScript(import.meta.url, process.argv[1])) {
  backfillItemTypeCode().catch((error) => {
    console.error("[backfill-item-type-code] 执行失败:", error);
    process.exitCode = 1;
  });
}
