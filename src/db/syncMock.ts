import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MOCK_FILE_PATH = path.resolve(__dirname, '../data/mock.ts');

async function syncProductsToMock() {
  console.log('--- 启动数据同步引擎 [Supabase -> Local Mock] ---');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('[探测] 正在连接云端专属 recommender_toys 表...');
    
    // 取消 LIMIT 30，获取全量清洗后的数据
    const res = await pool.query(`
      SELECT t.*, p.link
      FROM public.recommender_toys t
      LEFT JOIN public.products p ON t.original_id = p.id
      ORDER BY t.created_at DESC
    `);
    const rows = res.rows;
    
    if (rows.length === 0) {
      console.log('[中止] 数据库中没有发现 recommender_toys 记录。');
      return;
    }

    console.log(`[捕获] 成功捕获 ${rows.length} 条已清洗的真实商品！正在同步至 Mock 层...`);

    const mappedProducts = rows.map((row) => {
      return {
        id: String(row.id),
        name: row.name,
        price: Number(row.price),
        maxDb: row.max_db,
        waterproof: row.waterproof,
        appearance: row.appearance,
        physicalForm: row.physical_form,
        motorType: row.motor_type,
        gender: row.gender,
        imagePlaceholder: row.image_url || 'bg-gradient-to-br from-indigo-900/40 to-blue-900/40',
        link: row.link || null,
        sourceUrl: row.link || null,
      };
    });

    // 读取现有 mock.ts，保留它下面的核心类型与 questions 互动定义
    const currentMock = fs.readFileSync(MOCK_FILE_PATH, 'utf-8');
    
    const typeDef = `export type Product = {
  id: string;
  name: string;
  price: number;
  maxDb: number;
  waterproof: number; // IPX level
  appearance: 'high_disguise' | 'normal';
  physicalForm: 'external' | 'internal' | 'composite';
  motorType: 'gentle' | 'strong';
  imagePlaceholder: string;
  link?: string | null;
  sourceUrl?: string | null;
};`;

    // 通过切割获取后半段（从 AnswerState 开始）
    const afterProductsParts = currentMock.split('export type AnswerState = {');
    if (afterProductsParts.length < 2) {
        throw new Error('未在 mock.ts 中找到保留的 AnswerState 定义');
    }
    const afterProductsStr = afterProductsParts[1];

    // 重新桥凑成完整的 mock.ts
    const newMockContent = `${typeDef}\n\nexport const products: Product[] = ${JSON.stringify(mappedProducts, null, 2)};\n\nexport type AnswerState = {${afterProductsStr}`;

    fs.writeFileSync(MOCK_FILE_PATH, newMockContent);
    console.log(`[组装完毕] 实体数据已成功降临至本地 ${MOCK_FILE_PATH} !`);
    console.log('>>> 现已可以直接在你的 Vite 页面上点测带有【真实数据】的推荐算法了！');

  } catch (err) {
    console.error('[数据坠毁异常]:', err);
  } finally {
    await pool.end();
  }
}

syncProductsToMock().catch(console.error);
