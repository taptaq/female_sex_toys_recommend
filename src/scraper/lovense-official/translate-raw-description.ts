import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { translateRawDescriptionToZh } from '../shared/raw-description-translator.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLEANED_PATH = path.resolve(__dirname, '../../data/lovense-official-cleaned-data.json');
const CACHE_PATH = path.resolve(__dirname, '../../data/lovense-official-raw-description-zh-cache.json');

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function hasMeaningfulEnglish(input: string): boolean {
  const value = String(input || '');
  const words: string[] = value.match(/[A-Za-z][A-Za-z'-]{3,}/g) ?? [];
  if (words.length === 0) return false;
  const allowed = new Set([
    'lovense',
    'lush',
    'max',
    'edge',
    'gush',
    'diamo',
    'solace',
    'calor',
    'kraken',
    'ambi',
    'velvo',
    'spinel',
    'vulse',
    'gemini',
    'hyphy',
    'exomoon',
    'hush',
    'domi',
    'mission',
    'lapis',
    'tenera',
    'osci',
    'ridge',
    'dolce',
    'flexer',
    'webcam',
    'mini',
    'pro',
    'usb',
    'app',
    'sku',
    'usd',
  ]);

  return words.some((word) => !allowed.has(word.toLowerCase()));
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (true) {
      const current = cursor;
      cursor += 1;
      if (current >= items.length) return;
      results[current] = await mapper(items[current], current);
    }
  });

  await Promise.all(workers);
  return results;
}

async function main() {
  if (!fs.existsSync(CLEANED_PATH)) {
    throw new Error(`未找到文件: ${CLEANED_PATH}`);
  }

  const rows = JSON.parse(fs.readFileSync(CLEANED_PATH, 'utf8'));
  if (!Array.isArray(rows)) {
    throw new Error('cleaned-data 不是数组，无法处理');
  }

  await prisma.$connect();

  const lovenseCompetitor = await prisma.competitors.findFirst({
    where: { name: { contains: 'lovense', mode: 'insensitive' } },
    select: { id: true, name: true },
  });

  if (!lovenseCompetitor) {
    throw new Error('数据库未找到 Lovense competitor 记录');
  }

  let translatedCount = 0;
  let itemsUpdated = 0;
  let productsUpdated = 0;

  const translatedRows = await mapWithConcurrency(rows, 4, async (rawItem, index) => {
    const item = rawItem || {};
    const name = String(item.name || '').trim();
    if (!name) return { item, name: '', translatedRaw: '' };

    const rawDescription = String(item.rawDescription || '').trim();
    const translatedRaw = await translateRawDescriptionToZh(rawDescription, {
      cachePath: CACHE_PATH,
      logLabel: `${index + 1}/${rows.length} ${name}`,
    });

    const finalizedRaw =
      translatedRaw && hasMeaningfulEnglish(translatedRaw)
        ? await translateRawDescriptionToZh(translatedRaw, {
            cachePath: CACHE_PATH,
            logLabel: `${index + 1}/${rows.length} ${name} 二次`,
            force: true,
          })
        : translatedRaw;

    return {
      item,
      name,
      rawDescription,
      translatedRaw: finalizedRaw,
    };
  });

  for (const row of translatedRows) {
    const item = row.item;
    const name = String(row.name || '').trim();
    if (!name) continue;
    const rawDescription = String(row.rawDescription || '').trim();
    const translatedRaw = String(row.translatedRaw || '').trim();

    if (translatedRaw && translatedRaw !== rawDescription) {
      translatedCount += 1;
      item.rawDescription = translatedRaw;
    }

    const itemUpdate = await prisma.recommender_toys.updateMany({
      where: {
        name,
        brand: { equals: 'Lovense', mode: 'insensitive' },
      },
      data: {
        raw_description: translatedRaw || rawDescription || null,
        updated_at: new Date(),
      },
    });
    itemsUpdated += itemUpdate.count;

    const product = await prisma.products.findFirst({
      where: {
        name,
        competitor_id: lovenseCompetitor.id,
      },
      select: {
        id: true,
        specs: true,
      },
    });

    if (product) {
      const prevSpecs =
        product.specs && typeof product.specs === 'object' && !Array.isArray(product.specs)
          ? (product.specs as Record<string, unknown>)
          : {};

      await prisma.products.update({
        where: { id: product.id },
        data: {
          specs: {
            ...prevSpecs,
            rawDescription: translatedRaw || rawDescription || null,
          } as any,
        },
      });
      productsUpdated += 1;
    }
  }

  fs.writeFileSync(CLEANED_PATH, JSON.stringify(rows, null, 2));
  await prisma.$disconnect();
  await pool.end();

  console.log(
    JSON.stringify(
      {
        cleaned_file_total: rows.length,
        translated_count: translatedCount,
        recommender_toys_updated: itemsUpdated,
        products_updated: productsUpdated,
        cleaned_path: CLEANED_PATH,
        cache_path: CACHE_PATH,
      },
      null,
      2,
    ),
  );
}

main().catch(async (error) => {
  console.error('[translate-raw-description] failed:', error);
  await prisma.$disconnect().catch(() => {});
  await pool.end().catch(() => {});
  process.exit(1);
});
