import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { pathToFileURL } from "node:url";

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type CompetitorCountryRow = {
  id: string;
  name: string | null;
  country: string | null;
  is_domestic: boolean | null;
  domain: string | null;
};

type CompetitorCountryPatch = {
  id: string;
  previousCountry: string | null;
  nextCountry: string;
};

const COUNTRY_NORMALIZATION_MAP = new Map<string, string>([
  ["中国", "中国"],
  ["china", "中国"],
  ["美国", "美国"],
  ["usa", "美国"],
  ["united states", "美国"],
  ["united states of america", "美国"],
  ["germany", "德国"],
  ["德国", "德国"],
  ["united kingdom", "英国"],
  ["uk", "英国"],
  ["英国", "英国"],
  ["japan", "日本"],
  ["日本", "日本"],
  ["canada", "加拿大"],
  ["加拿大", "加拿大"],
  ["france", "法国"],
  ["法国", "法国"],
  ["sweden", "瑞典"],
  ["瑞典", "瑞典"],
  ["netherlands", "荷兰"],
  ["荷兰", "荷兰"],
]);

const EXPLICIT_BRAND_COUNTRY_MAP = new Map<string, string>([
  ["arcwave", "德国"],
  ["beu", "中国"],
  ["hello nancy", "中国"],
  ["lbdo", "美国"],
  ["醉清风-谜姬", "中国"],
]);

export function normalizeCompetitorCountry(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return null;
  }

  return COUNTRY_NORMALIZATION_MAP.get(normalized.toLowerCase()) ?? normalized;
}

export function buildCompetitorCountryPatch(
  row: CompetitorCountryRow,
): CompetitorCountryPatch | null {
  const previousCountry = row.country?.trim() || null;
  const normalizedCountry = normalizeCompetitorCountry(previousCountry);
  const explicitCountry = EXPLICIT_BRAND_COUNTRY_MAP.get(String(row.name ?? "").trim().toLowerCase());
  const nextCountry =
    normalizedCountry ??
    explicitCountry ??
    (row.is_domestic === true ? "中国" : null);

  if (!nextCountry || nextCountry === previousCountry) {
    return null;
  }

  return {
    id: row.id,
    previousCountry,
    nextCountry,
  };
}

const isTransientDbError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error || "");
  return /Connection terminated|ECONNRESET|server closed the connection|terminating connection|Can't reach database|P1001|P1017/i.test(
    message,
  );
};

async function reconnectPrisma() {
  await prisma.$disconnect().catch(() => {});
  await sleep(800);
  await prisma.$connect();
}

async function ensurePrismaConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    if (!isTransientDbError(error)) throw error;
    await reconnectPrisma();
  }
}

async function withDbRetry<T>(label: string, action: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await ensurePrismaConnection();
      return await action();
    } catch (error) {
      lastError = error;
      if (!isTransientDbError(error) || attempt === 3) break;
      await reconnectPrisma();
      await sleep(1000 * attempt);
    }
  }
  throw lastError;
}

async function cleanCompetitorCountryFields() {
  console.log("[clean-competitor-country-fields] 开始统一 competitors.country ...");

  const rows = await withDbRetry("读取 competitors 国家字段", () =>
    prisma.competitors.findMany({
      select: {
        id: true,
        name: true,
        country: true,
        is_domestic: true,
        domain: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
  );

  const patches = rows
    .map((row) => buildCompetitorCountryPatch(row))
    .filter((patch): patch is CompetitorCountryPatch => patch !== null);

  let updated = 0;
  for (const patch of patches) {
    await withDbRetry(`更新 ${patch.id} country`, () =>
      prisma.competitors.update({
        where: { id: patch.id },
        data: {
          country: patch.nextCountry,
        },
      }),
    );
    updated += 1;
  }

  console.log(
    JSON.stringify(
      {
        scanned: rows.length,
        updated,
        sample: patches.slice(0, 20),
      },
      null,
      2,
    ),
  );
}

export function shouldRunCleanCompetitorCountryFields(importMetaUrl: string, argvEntry?: string) {
  if (!argvEntry) return false;
  return importMetaUrl === pathToFileURL(argvEntry).href;
}

if (shouldRunCleanCompetitorCountryFields(import.meta.url, process.argv[1])) {
  cleanCompetitorCountryFields()
    .catch((error) => {
      console.error("[clean-competitor-country-fields] 执行失败:", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect().catch(() => {});
      await pool.end().catch(() => {});
    });
}
