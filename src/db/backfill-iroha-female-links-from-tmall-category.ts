import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
});

const SHOULD_APPLY = process.argv.includes("--apply");

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

type TargetRow = {
  toy_id: string;
  original_id: string;
  name: string;
  brand: string | null;
  current_link: string | null;
};

async function loadTargets() {
  const result = await pool.query<TargetRow>(`
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

async function main() {
  const targets = await loadTargets();
  const updates = targets
    .map((target) => ({
      ...target,
      cleaned_link: canonicalizeTmallItemUrl(target.current_link),
    }))
    .filter((target) => target.cleaned_link && target.cleaned_link !== target.current_link);

  console.log("[backfill-iroha-female-links-from-tmall-category] candidates:");
  console.log(
    JSON.stringify(
      {
        scanned: targets.length,
        updatable: updates.length,
        samples: updates.slice(0, 20).map((target) => ({
          name: target.name,
          brand: target.brand,
          from: target.current_link,
          to: target.cleaned_link,
        })),
      },
      null,
      2,
    ),
  );

  if (!SHOULD_APPLY) {
    console.log("[backfill-iroha-female-links-from-tmall-category] dry-run only. Pass --apply to update links.");
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const target of updates) {
      await client.query(
        `
          UPDATE public.female_recommender_toys
          SET link = $1
          WHERE id = $2
        `,
        [target.cleaned_link, target.toy_id],
      );
      await client.query(
        `
          UPDATE public.products
          SET link = $1
          WHERE id = $2
        `,
        [target.cleaned_link, target.original_id],
      );
    }

    await client.query("COMMIT");
    console.log(`[backfill-iroha-female-links-from-tmall-category] updated ${updates.length} links.`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

if (process.argv[1]?.endsWith("backfill-iroha-female-links-from-tmall-category.ts")) {
  main()
    .catch((error) => {
      console.error("[backfill-iroha-female-links-from-tmall-category] failed:", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await pool.end().catch(() => {});
    });
}
