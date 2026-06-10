import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import pg from "pg";

dotenv.config();

const SHOULD_APPLY = process.argv.includes("--apply");
const TABLES = ["recommender_toys", "female_recommender_toys"] as const;

type TableName = (typeof TABLES)[number];

export type LinkCleanRow = {
  table_name: TableName;
  id: string;
  name: string;
  toy_link: string | null;
  product_link: string | null;
};

type LinkPatch = {
  tableName: TableName;
  id: string;
  name: string;
  currentLink: string;
  nextLink: string;
  reason: "fill_from_product" | "canonicalize_tmall" | "replace_non_url_from_product";
};

function normalizeText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function extractTmallItemIdForLinkClean(rawLink: string | null | undefined) {
  const link = normalizeText(rawLink);
  if (!link) return "";

  try {
    const parsed = new URL(link.startsWith("//") ? `https:${link}` : link);
    const itemId = parsed.searchParams.get("id")?.trim() || "";
    return /^\d+$/.test(itemId) ? itemId : "";
  } catch {
    return link.match(/[?&]id=(\d+)/)?.[1] || "";
  }
}

export function canonicalizeTmallLinkForToy(rawLink: string | null | undefined) {
  const link = normalizeText(rawLink);
  if (!link) return "";
  const itemId = extractTmallItemIdForLinkClean(link);
  if (itemId && /detail\.(?:tmall|taobao)\.com\/item\.htm/i.test(link)) {
    return `https://detail.tmall.com/item.htm?id=${itemId}`;
  }
  if (link.startsWith("//")) return `https:${link}`;
  return link;
}

function isHttpLikeUrl(value: string) {
  return /^https?:\/\//i.test(value) || value.startsWith("//");
}

export function buildToyLinkPatch(row: LinkCleanRow): LinkPatch | null {
  const currentLink = normalizeText(row.toy_link);
  const productLink = normalizeText(row.product_link);
  const toyItemId = extractTmallItemIdForLinkClean(currentLink);
  const productItemId = extractTmallItemIdForLinkClean(productLink);

  if (toyItemId && productItemId && toyItemId !== productItemId) {
    return null;
  }

  if (currentLink) {
    const canonicalLink = canonicalizeTmallLinkForToy(currentLink);
    if (canonicalLink !== currentLink) {
      return {
        tableName: row.table_name,
        id: row.id,
        name: row.name,
        currentLink,
        nextLink: canonicalLink,
        reason: "canonicalize_tmall",
      };
    }

    if (!isHttpLikeUrl(currentLink) && productLink) {
      return {
        tableName: row.table_name,
        id: row.id,
        name: row.name,
        currentLink,
        nextLink: canonicalizeTmallLinkForToy(productLink),
        reason: "replace_non_url_from_product",
      };
    }

    return null;
  }

  if (!productLink) return null;
  return {
    tableName: row.table_name,
    id: row.id,
    name: row.name,
    currentLink,
    nextLink: canonicalizeTmallLinkForToy(productLink),
    reason: "fill_from_product",
  };
}

async function readRows(client: pg.PoolClient) {
  const result = await client.query<LinkCleanRow>(`
    SELECT
      'recommender_toys'::text AS table_name,
      t.id::text,
      t.name,
      t.link AS toy_link,
      p.link AS product_link
    FROM public.recommender_toys AS t
    LEFT JOIN public.products AS p ON p.id = t.original_id

    UNION ALL

    SELECT
      'female_recommender_toys'::text AS table_name,
      t.id::text,
      t.name,
      t.link AS toy_link,
      p.link AS product_link
    FROM public.female_recommender_toys AS t
    LEFT JOIN public.products AS p ON p.id = t.original_id
  `);

  return result.rows;
}

async function applyPatches(client: pg.PoolClient, patches: LinkPatch[]) {
  const results: Record<TableName, number> = {
    recommender_toys: 0,
    female_recommender_toys: 0,
  };

  for (const tableName of TABLES) {
    const tablePatches = patches.filter((patch) => patch.tableName === tableName);
    if (tablePatches.length === 0) continue;

    const result = await client.query(
      `
        UPDATE public.${tableName} AS t
        SET link = patch.next_link,
            updated_at = NOW()
        FROM jsonb_to_recordset($1::jsonb) AS patch(id uuid, next_link text)
        WHERE t.id = patch.id
      `,
      [JSON.stringify(tablePatches.map((patch) => ({ id: patch.id, next_link: patch.nextLink })))],
    );
    results[tableName] = result.rowCount ?? 0;
  }

  return results;
}

function summarizePatches(patches: LinkPatch[]) {
  const byReason = new Map<LinkPatch["reason"], number>();
  const byTable = new Map<TableName, number>();
  for (const patch of patches) {
    byReason.set(patch.reason, (byReason.get(patch.reason) ?? 0) + 1);
    byTable.set(patch.tableName, (byTable.get(patch.tableName) ?? 0) + 1);
  }

  return {
    total: patches.length,
    by_table: Object.fromEntries(byTable.entries()),
    by_reason: Object.fromEntries(byReason.entries()),
    sample: patches.slice(0, 20).map((patch) => ({
      table: patch.tableName,
      name: patch.name,
      reason: patch.reason,
      current_link: patch.currentLink,
      next_link: patch.nextLink,
    })),
  };
}

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  const client = await pool.connect();

  try {
    const rows = await readRows(client);
    const mismatchedItemIds = rows
      .map((row) => ({
        table: row.table_name,
        id: row.id,
        name: row.name,
        toy_item_id: extractTmallItemIdForLinkClean(row.toy_link),
        product_item_id: extractTmallItemIdForLinkClean(row.product_link),
      }))
      .filter((row) => row.toy_item_id && row.product_item_id && row.toy_item_id !== row.product_item_id);
    const patches = rows.map(buildToyLinkPatch).filter((patch): patch is LinkPatch => Boolean(patch));

    console.log(
      JSON.stringify(
        {
          apply: SHOULD_APPLY,
          scanned: rows.length,
          mismatched_item_ids: mismatchedItemIds.length,
          mismatched_item_id_sample: mismatchedItemIds.slice(0, 20),
          patches: summarizePatches(patches),
        },
        null,
        2,
      ),
    );

    if (!SHOULD_APPLY || patches.length === 0) return;

    await client.query("BEGIN");
    const results = await applyPatches(client, patches);
    await client.query("COMMIT");
    console.log(JSON.stringify({ updated: results }, null, 2));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error("[clean-recommender-toy-links] failed:", error);
    process.exitCode = 1;
  });
}
