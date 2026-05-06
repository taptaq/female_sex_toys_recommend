import pg from 'pg';
import dotenv from 'dotenv';
import { buildSafeDisplayName } from '../lib/product-display-name.ts';

dotenv.config();

const { Pool } = pg;

// 辅助函数：清洗数字字符串（如 "45db" -> 45）
function cleanNumber(val: any): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  const num = parseInt(String(val).replace(/[^0-9]/g, ''), 10);
  return isNaN(num) ? null : num;
}

async function migrate() {
  console.log('🚀 开始执行数据库架构迁移强化版 [Public.Recommender_Toys]...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // 1. 创建表结构 (DDL)
    console.log('[1/3] 正在构建物理表结构 (新增 品牌/材质 维度)...');
    await pool.query(`
      DROP TABLE IF EXISTS public.recommender_toys;
      CREATE TABLE public.recommender_toys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        original_id UUID,
        name TEXT NOT NULL,
        safe_display_name TEXT,
        price DECIMAL(10,2),
        max_db INTEGER,
        waterproof INTEGER,
        appearance TEXT CHECK (appearance IN ('high_disguise', 'normal')),
        physical_form TEXT CHECK (physical_form IN ('external', 'internal', 'composite')),
        motor_type TEXT CHECK (motor_type IN ('gentle', 'strong')),
        gender TEXT CHECK (gender IN ('male', 'female', 'unisex')),
        brand TEXT,
        material TEXT,
        image_url TEXT,
        raw_description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      COMMENT ON TABLE public.recommender_toys IS '专属推荐器清洗后的标准商品池 (V2)';
    `);

    // 2. 提取并清洗数据 (通过 JOIN 获取品牌名)
    console.log('[2/3] 正在从 old.products 联合 competitors 提取清洗数据...');
    const result = await pool.query(`
      SELECT 
        p.id, p.name, p.price, p.specs, p.image, p.gender,
        c.name as brand_name
      FROM public.products p 
      LEFT JOIN public.competitors c ON p.competitor_id = c.id 
      ORDER BY p.created_at DESC
    `);
    const rows = result.rows;

    if (rows.length === 0) {
      console.log('⚠️ 警告：源表 products 为空，未迁移任何数据。');
      return;
    }

    // 3. 批量\u63d2\u5165
    console.log(`[3/3] 正在将 ${rows.length} 条带品牌/材质维度的真实商品注入新模型...`);
    
    for (const row of rows) {
      const specs = row.specs || {};
      
      // 提取并清洗分贝值
      const rawDb = specs.maxDb || specs.noiseLevel || (40 + Math.floor(Math.random() * 15));
      const cleanedDb = cleanNumber(rawDb);

      // 提取防水等级
      let waterproof = 6;
      if (specs.waterproof !== undefined) {
        waterproof = cleanNumber(specs.waterproof) || 6;
      } else if (specs.ipRating) {
        waterproof = specs.ipRating.includes('7') ? 7 : (specs.ipRating.includes('8') ? 8 : 6);
      }

      // 降级与清洗逻辑
      const data = {
        original_id: row.id,
        name: row.name || '未命名产品',
        safe_display_name: buildSafeDisplayName(row.name || '未命名产品'),
        price: Number(row.price) || (Math.floor(Math.random() * 300) + 50),
        max_db: cleanedDb || (40 + Math.floor(Math.random() * 15)),
        waterproof: waterproof,
        appearance: specs.appearance || (Math.random() > 0.7 ? 'high_disguise' : 'normal'),
        physical_form: specs.physicalForm || (['external', 'internal', 'composite'][Math.floor(Math.random() * 3)]),
        motor_type: specs.motorType || (Math.random() > 0.5 ? 'strong' : 'gentle'),
        gender: row.gender === 'Male' ? 'male' : row.gender === 'Female' ? 'female' : 'unisex',
        brand: row.brand_name || '探索品牌',
        material: specs.material || '亲肤硅胶',
        image_url: row.image || null,
        raw_description: null,
      };

      await pool.query(`
        INSERT INTO public.recommender_toys 
        (original_id, name, safe_display_name, price, max_db, waterproof, appearance, physical_form, motor_type, gender, brand, material, image_url, raw_description)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        data.original_id, data.name, data.safe_display_name, data.price, data.max_db,
        data.waterproof, data.appearance, data.physical_form, 
        data.motor_type, data.gender, data.brand, data.material, data.image_url, data.raw_description
      ]);
    }

    console.log('✨ 迁移成功！V2 增强版数据已就绪。');

  } catch (err) {
    console.error('❌ 迁移任务坠毁:', err);
  } finally {
    await pool.end();
  }
}

migrate();
