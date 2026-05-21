import dotenv from "dotenv";
import pg from "pg";
import { pathToFileURL } from "node:url";

dotenv.config();

const { Pool } = pg;

export type PriceImagePairRow = {
  product_id: string | null;
  toy_id: string | null;
  product_price: string | number | null;
  toy_price: string | number | null;
  product_image: string | null;
  toy_image_url: string | null;
  name?: string | null;
};

export type PriceImagePatch = {
  productPrice?: string | number | null;
  toyPrice?: string | number | null;
  productImage?: string | null;
  toyImageUrl?: string | null;
  reasons: string[];
};

function normalizeText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function hasOwn<T extends object>(value: T, key: keyof T) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export function isUsablePrice(value: unknown) {
  if (value == null || normalizeText(value) === "") return false;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 1;
}

function isLikelyCentsScaledProductPrice(productPrice: unknown, toyPrice: unknown) {
  if (!isUsablePrice(productPrice) || !isUsablePrice(toyPrice)) return false;
  const productNumber = Number(productPrice);
  const toyNumber = Number(toyPrice);
  if (productNumber <= toyNumber) return false;
  const ratio = productNumber / toyNumber;
  return ratio >= 90 && ratio <= 110;
}

export function isUsableImageUrl(value: unknown) {
  const url = normalizeText(value);
  if (!url) return false;

  const lower = url.toLowerCase();
  if (lower.includes("2-tps-2-2.png")) return false;
  if (lower.includes("-2-tps-48-48.png")) return false;
  if (lower.includes("tb1malkrxxxxxawxfxxxxxxxxxx-480-260.png")) return false;
  if (lower === "https://assets.alicdn.com/s.gif" || lower === "http://assets.alicdn.com/s.gif") return false;
  if (lower.startsWith("https://www.facebook.com/tr?") || lower.startsWith("http://www.facebook.com/tr?")) return false;
  if (lower.includes("placeholder")) return false;
  if (lower.includes("$%7bn.image%7d") || lower.includes("${n.image}")) return false;
  if (/\/countries\/[a-z]{2}\.svg(?:$|[?#])/i.test(url)) return false;

  return /^https?:\/\//i.test(url);
}

export function buildPriceImagePatch(row: PriceImagePairRow): PriceImagePatch {
  const reasons: string[] = [];
  const patch: PriceImagePatch = { reasons };

  const productPriceUsable = isUsablePrice(row.product_price);
  const toyPriceUsable = isUsablePrice(row.toy_price);
  if (row.product_id && !productPriceUsable && toyPriceUsable) {
    patch.productPrice = row.toy_price;
    reasons.push("product_price_from_toy");
  } else if (row.product_id && row.toy_id && isLikelyCentsScaledProductPrice(row.product_price, row.toy_price)) {
    patch.productPrice = row.toy_price;
    reasons.push("product_price_from_toy_scaled");
  }
  if (row.toy_id && !toyPriceUsable && productPriceUsable) {
    patch.toyPrice = row.product_price;
    reasons.push("toy_price_from_product");
  }

  const productImageUsable = isUsableImageUrl(row.product_image);
  const toyImageUsable = isUsableImageUrl(row.toy_image_url);
  const productImageFilled = normalizeText(row.product_image) !== "";
  const toyImageFilled = normalizeText(row.toy_image_url) !== "";

  if (row.product_id && !productImageUsable && toyImageUsable) {
    patch.productImage = normalizeText(row.toy_image_url);
    reasons.push("product_image_from_toy");
  } else if (row.product_id && productImageFilled && !productImageUsable) {
    patch.productImage = null;
    reasons.push("product_image_placeholder_to_null");
  }

  if (row.toy_id && !toyImageUsable && productImageUsable) {
    patch.toyImageUrl = normalizeText(row.product_image);
    reasons.push("toy_image_from_product");
  } else if (row.toy_id && toyImageFilled && !toyImageUsable) {
    patch.toyImageUrl = null;
    reasons.push("toy_image_placeholder_to_null");
  }

  return patch;
}

async function readPairs(client: pg.PoolClient) {
  const result = await client.query<PriceImagePairRow>(`
    SELECT
      p.id AS product_id,
      t.id AS toy_id,
      p.price::text AS product_price,
      t.price::text AS toy_price,
      p.image AS product_image,
      t.image_url AS toy_image_url,
      COALESCE(t.name, p.name) AS name
    FROM public.products AS p
    FULL OUTER JOIN public.recommender_toys AS t ON t.original_id = p.id
  `);

  return result.rows;
}

async function applyPatch(client: pg.PoolClient, row: PriceImagePairRow, patch: PriceImagePatch) {
  if (row.product_id && (hasOwn(patch, "productPrice") || hasOwn(patch, "productImage"))) {
    await client.query(
      `
        UPDATE public.products
        SET
          price = CASE WHEN $2::numeric IS NULL THEN price ELSE $2::numeric END,
          image = CASE WHEN $3::boolean THEN $4::text ELSE image END
        WHERE id = $1
      `,
      [
        row.product_id,
        hasOwn(patch, "productPrice") ? patch.productPrice : null,
        hasOwn(patch, "productImage"),
        hasOwn(patch, "productImage") ? patch.productImage : null,
      ],
    );
  }

  if (row.toy_id && (hasOwn(patch, "toyPrice") || hasOwn(patch, "toyImageUrl"))) {
    await client.query(
      `
        UPDATE public.recommender_toys
        SET
          price = CASE WHEN $2::numeric IS NULL THEN price ELSE $2::numeric END,
          image_url = CASE WHEN $3::boolean THEN $4::text ELSE image_url END,
          updated_at = NOW()
        WHERE id = $1
      `,
      [
        row.toy_id,
        hasOwn(patch, "toyPrice") ? patch.toyPrice : null,
        hasOwn(patch, "toyImageUrl"),
        hasOwn(patch, "toyImageUrl") ? patch.toyImageUrl : null,
      ],
    );
  }
}

export function shouldRunPriceImageCleanScript(importMetaUrl: string, argvEntry?: string) {
  return Boolean(argvEntry) && importMetaUrl === pathToFileURL(argvEntry).href;
}

async function cleanPriceImagePlaceholders() {
  const dryRun = process.argv.includes("--dry-run");
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  const client = await pool.connect();

  try {
    await client.query(`SET statement_timeout TO 0`);
    await client.query(`SET lock_timeout TO '5s'`);

    const rows = await readPairs(client);
    const patches = rows
      .map((row) => ({ row, patch: buildPriceImagePatch(row) }))
      .filter(({ patch }) => patch.reasons.length > 0);

    if (!dryRun && patches.length > 0) {
      await client.query("BEGIN");
      for (const { row, patch } of patches) {
        await applyPatch(client, row, patch);
      }
      await client.query("COMMIT");
    }

    const reasonCounts = new Map<string, number>();
    for (const { patch } of patches) {
      for (const reason of patch.reasons) {
        reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
      }
    }

    console.log(
      JSON.stringify(
        {
          dryRun,
          rows_scanned: rows.length,
          rows_with_patch: patches.length,
          reason_counts: Object.fromEntries([...reasonCounts.entries()].sort()),
          samples: patches.slice(0, 30).map(({ row, patch }) => ({
            product_id: row.product_id,
            toy_id: row.toy_id,
            name: row.name,
            reasons: patch.reasons,
            product_price: row.product_price,
            toy_price: row.toy_price,
            product_image: row.product_image,
            toy_image_url: row.toy_image_url,
            patch: {
              productPrice: patch.productPrice,
              toyPrice: patch.toyPrice,
              productImage: patch.productImage,
              toyImageUrl: patch.toyImageUrl,
            },
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

if (shouldRunPriceImageCleanScript(import.meta.url, process.argv[1])) {
  cleanPriceImagePlaceholders().catch((error) => {
    console.error("[clean-price-image-placeholders] 执行失败:", error);
    process.exitCode = 1;
  });
}
