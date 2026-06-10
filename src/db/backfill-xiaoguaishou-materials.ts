import dotenv from "dotenv";
import pg from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const { Pool } = pg;
const BRAND_NAME = "小怪兽";

export type XiaoguaishouMaterialRow = {
  name: string;
  raw_description: string | null;
  current_material?: string | null;
};

const INVALID_MATERIAL_HINTS = [
  "是否含润滑液",
  "不包含润滑液",
  "控制类型",
  "电动",
  "电池电源",
  "最大噪音",
  "主体尺寸",
  "遥控跳蛋",
  "参见详情",
  "见详情",
];

function normalizeText(value: string | null | undefined) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeMaterialValue(value: string | null | undefined) {
  const text = normalizeText(value)
    .replace(/™/g, "")
    .replace(/LSR（液态硅胶）/gi, "液态硅胶")
    .replace(/lsr\s*\(?液态硅胶\)?/gi, "液态硅胶")
    .replace(/°/g, "")
    .replace(/材质[:：]?/g, "")
    .trim();

  if (!text) return null;
  if (text === "否" || text === "是" || text === "未提及") return null;
  if (INVALID_MATERIAL_HINTS.some((hint) => text.includes(hint))) return null;
  return text;
}

function extractLabeledValue(text: string, label: string) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`(?:^|\\n)\\s*(?:\\d+\\.\\s*)?${escapedLabel}\\s*[:：]\\s*([^\\n]+)`));
  return normalizeMaterialValue(match?.[1]);
}

function isCareProductName(name: string) {
  return /润滑液|润滑剂|人体润滑|水基|玻尿酸|护理液/.test(name);
}

function chooseSiliconeQualifier(text: string) {
  const source = text.toLowerCase();
  if (/食品级液体硅胶|食品级硅胶/.test(text)) return "食品级液体硅胶";
  if (/液态硅胶|lsr/.test(source)) return "液态硅胶";
  if (/母婴级硅胶/.test(text)) return "母婴级硅胶";
  if (/铂金硅胶/.test(text)) return "铂金硅胶";
  if (/亲肤硅胶/.test(text)) return "亲肤硅胶";
  if (/软糯硅胶/.test(text)) return "软糯硅胶";
  if (/天然硅胶/.test(text)) return "天然硅胶";
  if (/全软胶|软胶包裹/.test(text)) return "软胶";
  if (/硅胶/.test(text)) return "硅胶";
  return null;
}

function inferMaterialFromText(text: string) {
  const silicone = chooseSiliconeQualifier(text);
  const hasSaniconcentrate = /saniconcentrate|抗菌材料|抑菌材料/i.test(text);

  if (silicone && hasSaniconcentrate) {
    return `${silicone}/Saniconcentrate抗菌材料`;
  }
  if (silicone) return silicone;
  if (hasSaniconcentrate) return "Saniconcentrate抗菌材料";
  if (/tpe/i.test(text)) return "TPE";
  if (/\babs\b/i.test(text)) return "ABS";
  if (/乳胶|天然橡胶/.test(text)) return "天然橡胶乳胶";
  return null;
}

function isMeaningfulCurrentMaterial(value: string | null | undefined) {
  return normalizeMaterialValue(value) != null;
}

function appendAntibacterialMaterial(base: string | null) {
  const normalized = normalizeMaterialValue(base);
  if (!normalized) return "Saniconcentrate抗菌材料";
  if (/saniconcentrate|抗菌材料|抑菌材料/i.test(normalized)) return normalized;
  return `${normalized}/Saniconcentrate抗菌材料`;
}

export function inferXiaoguaishouMaterialFromRow(row: XiaoguaishouMaterialRow) {
  const name = normalizeText(row.name);
  const rawDescription = String(row.raw_description ?? "");
  const fullText = `${name}\n${rawDescription}`;

  if (isCareProductName(name)) return "水基配方";

  const detailMaterial = extractLabeledValue(rawDescription, "内部构造/材质");
  const fromDetail = inferMaterialFromText(detailMaterial ?? "");
  if (fromDetail === "Saniconcentrate抗菌材料" && isMeaningfulCurrentMaterial(row.current_material)) {
    return appendAntibacterialMaterial(row.current_material ?? null);
  }
  if (fromDetail) return fromDetail;

  const fullTextMaterial = inferMaterialFromText(fullText);
  if (fullTextMaterial === "Saniconcentrate抗菌材料" && isMeaningfulCurrentMaterial(row.current_material)) {
    return appendAntibacterialMaterial(row.current_material ?? null);
  }
  if (fullTextMaterial) return fullTextMaterial;

  const paramMaterial = extractLabeledValue(rawDescription, "材质");
  const fromParam = inferMaterialFromText(paramMaterial ?? "");
  if (fromParam) return fromParam;

  if (isMeaningfulCurrentMaterial(row.current_material)) {
    return normalizeMaterialValue(row.current_material);
  }

  return null;
}

export function shouldRunXiaoguaishouMaterialBackfillScript(
  importMetaUrl: string,
  argvEntry?: string,
) {
  if (!argvEntry) return false;
  return path.resolve(argvEntry) === fileURLToPath(importMetaUrl);
}

async function backfillXiaoguaishouFemaleMaterials() {
  const shouldApply = process.argv.includes("--apply");
  const dryRun = !shouldApply;
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });

  const client = await pool.connect();

  try {
    console.log(
      `[backfill-xiaoguaishou-materials] 开始${dryRun ? "预演" : "覆盖"} female_recommender_toys.brand=${BRAND_NAME} material ...`,
    );
    if (dryRun) {
      console.log("[backfill-xiaoguaishou-materials] dry-run only. Pass --apply to update DB.");
    }

    await client.query("SET statement_timeout TO 0");
    await client.query("SET lock_timeout TO '5s'");
    if (!dryRun) await client.query("BEGIN");

    const result = await client.query<{
      id: string;
      name: string;
      raw_description: string | null;
      current_material: string | null;
    }>(
      `
        SELECT id, name, raw_description, material AS current_material
        FROM public.female_recommender_toys
        WHERE brand = $1
        ORDER BY name
      `,
      [BRAND_NAME],
    );

    const patches = result.rows
      .map((row) => ({
        row,
        next_material: inferXiaoguaishouMaterialFromRow(row),
      }))
      .filter(({ row, next_material }) => next_material && row.current_material !== next_material);

    let updated = 0;
    if (!dryRun) {
      for (const { row, next_material } of patches) {
        const updateResult = await client.query(
          `
            UPDATE public.female_recommender_toys
            SET material = $2,
                updated_at = NOW()
            WHERE id = $1::uuid
              AND material IS DISTINCT FROM $2
          `,
          [row.id, next_material],
        );
        updated += updateResult.rowCount ?? 0;
      }
      await client.query("COMMIT");
    }

    console.log(
      JSON.stringify(
        {
          dryRun,
          brand: BRAND_NAME,
          scanned: result.rows.length,
          would_update: patches.length,
          updated,
          sample: patches.slice(0, 12).map(({ row, next_material }) => ({
            name: row.name,
            current_material: row.current_material,
            next_material,
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

if (shouldRunXiaoguaishouMaterialBackfillScript(import.meta.url, process.argv[1])) {
  backfillXiaoguaishouFemaleMaterials().catch((error) => {
    console.error("[backfill-xiaoguaishou-materials] 执行失败:", error);
    process.exitCode = 1;
  });
}
