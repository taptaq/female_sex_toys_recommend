import express from 'express';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const app = express();
const port = 3010;

// 使用直连数据库地址，确保高稳定性
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// 监听连接错误
pool.on('error', (err) => {
  console.error('💥 [Server/DB] 数据库连接池发生灾难性错误:', err);
});

app.get('/api/recommender/toys', async (req, res) => {
  console.log('📡 [Server] 收到全息库同步指令...');
  try {
    const result = await pool.query(`
      SELECT 
        t.id, t.name, t.price, t.max_db, t.waterproof, 
        t.appearance, t.physical_form, t.motor_type, t.gender, 
        t.brand, t.material, t.image_url,
        p.link, p.tags, p.persona_analysis,
        c.is_domestic
      FROM public.recommender_toys t
      LEFT JOIN public.products p ON t.original_id = p.id
      LEFT JOIN public.competitors c ON p.competitor_id = c.id
      ORDER BY t.created_at DESC
    `);

    // 格式化输出为前端兼容的驼峰命名
    const normalized = result.rows.map(t => ({
      id: t.id,
      name: t.name,
      price: Number(t.price),
      maxDb: t.max_db,
      waterproof: t.waterproof,
      appearance: t.appearance,
      physicalForm: t.physical_form,
      motorType: t.motor_type,
      gender: t.gender,
      brand: t.brand || '探索品牌',
      material: t.material || '亲肤材质',
      imagePlaceholder: t.image_url || 'bg-gradient-to-br from-indigo-900/40 to-blue-900/40',
      link: t.link,
      sourceUrl: t.link,
      tags: t.tags || [],
      personaAnalysis: t.persona_analysis,
      isDomestic: t.is_domestic
    }));


    console.log(`✅ [Server] 已同步 ${normalized.length} 条晶体库数据`);
    res.json(normalized);
  } catch (error) {
    console.error('❌ [Server] 数据库同步中断:', error);
    res.status(500).json({ error: 'Database synchronization failed', details: String(error) });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 [Server] 稳定后端桥梁已启动: http://localhost:${port}`);
  console.log(`🔗 [Server] 前端通过 Vite Proxy (/api) 进行量子透传...`);
});
