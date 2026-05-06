import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { buildSafeDisplayName } from '../../lib/product-display-name.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BUFFER_PATH = path.resolve(__dirname, '../../data/review-buffer.json');
const CLEANED_PATH = path.resolve(__dirname, '../../data/cleaned-data.json');

// --- Prisma 7 适配器初始化开始 ---
// 利用 pg 驱动连接数据库，并注入给 PrismaClient
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
// --- Prisma 7 适配器初始化结束 ---

// 设置可变的 OpenAI 客户端，延迟初始化以防 Key 缺失导致崩溃
let openai: OpenAI | null = null;
try {
  const primaryKey = process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY;
  if (primaryKey) {
    openai = new OpenAI({
      apiKey: primaryKey,
      baseURL: 'https://api.deepseek.com/v1',
    });
  }
} catch (e) {
  console.warn('⚠️ [Init] 初始模型客户端加载失败，将依赖兜底轨道');
}

async function callGlmFallback(prompt: string) {
  console.log('⚠️ [Fallback] 正在切换至 glm-4.6v 兜底链路...');
  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) throw new Error('GLM_API_KEY 未配置');

  const glm = new OpenAI({
    apiKey,
    baseURL: 'https://open.bigmodel.cn/api/paas/v4/',
  });

  const response = await glm.chat.completions.create({
    model: 'glm-4.6v',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
  });

  return response.choices[0]?.message?.content || '{}';
}

// --- 数据映射工具函数 (Standardizing Enums) ---

// 映射性别字段以符合数据库 Check 约束
// products 表通常要求首字母大写 ('Male', 'Female', 'Unisex')
// recommender_toys 表要求全小写 ('male', 'female', 'unisex')
const mapGender = (raw: string, format: 'lowercase' | 'capitalized' = 'lowercase'): string => {
  const val = (raw || '').toLowerCase();
  let result = 'unisex';
  if (val.includes('female') || val.includes('女性')) result = 'female';
  else if (val.includes('male') || val.includes('男性')) result = 'male';
  
  if (format === 'capitalized') {
    return result.charAt(0).toUpperCase() + result.slice(1);
  }
  return result; 
};

// 映射物理形态 (external | internal | composite)
const mapPhysicalForm = (raw: string): string => {
  const val = (raw || '').toLowerCase();
  if (val.includes('composite') || val.includes('复合')) return 'composite';
  if (val.includes('internal') || val.includes('内') || val.includes('入')) return 'internal';
  return 'external';
};

// 映射马达类型 (gentle | strong)
const mapMotorType = (raw: string): string => {
  const val = (raw || '').toLowerCase();
  if (val.includes('strong') || val.includes('强')) return 'strong';
  return 'gentle';
};

// 映射外观 (high_disguise | normal)
const mapAppearance = (raw: string): string => {
  const val = (raw || '').toLowerCase();
  if (val.includes('disguise') || val.includes('隐蔽') || val.includes('伪装')) return 'high_disguise';
  return 'normal';
};

const isPlaceholderProductName = (value: string): boolean => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return true;
  return [
    '未知产品',
    '未知商品',
    '未命名产品',
    '未命名商品',
    '无标题',
    'unknown product',
  ].includes(normalized);
};

export async function runCleaner() {
  console.log('\n======================================================');
  console.log('--- 启动 AI 降维清洗与数据库注入模块 [Phase 4] ---');
  console.log('======================================================');
  
  if (!fs.existsSync(BUFFER_PATH)) {
    console.error('[中断] 未发现在港的数据缓冲池，请先执行爬虫动作：npx tsx src/scraper/crawler.ts');
    return;
  }

  const rawDataStr = fs.readFileSync(BUFFER_PATH, 'utf-8');
  let bufferData;
  try {
    bufferData = JSON.parse(rawDataStr);
  } catch (e) {
    console.error('[中断] JSON 解析失败，检查 review-buffer.json 是否完好。');
    return;
  }

  // --- 预搜索 LELO 在 competitors 表中的 ID ---
  let leloCompetitorId: string | null = null;
  try {
    const competitor = await prisma.competitors.findFirst({
      where: { name: { contains: 'LELO', mode: 'insensitive' } }
    });
    if (competitor) {
      leloCompetitorId = competitor.id;
      console.log(`[关联] 已定位 LELO 竞品 ID: ${leloCompetitorId}`);
    }
  } catch (err) {
    console.warn('[警告] 无法查询 competitors 表，将跳过外键关联。');
  }

  const cleanedData = [];

  for (const item of bufferData) {
    if (item.isReviewed) {
      console.log(`[跳过] 商品 ${item.name} 已被标记为已审核。`);
      continue;
    }
    if (isPlaceholderProductName(item.name)) {
      console.log(`[跳过] 商品名无效 (${item.name || 'empty'})，不执行清洗与入库。`);
      continue;
    }

    console.log(`\n[AI清洗] 正在降维萃取: ${item.name}`);
    
    // 全新高强度的 Prompt 模板
    const prompt = `
你是一个专注处理个人护理设备参数的数据拆解助手。现有抓取至 LELO 等品牌独立站的纯文本长描述，可能掺杂无用情感营销文案：

【商品名称】: ${item.name}
【原始价格抓取】: ${item.priceText}
【原始文案描述】:
"""
${item.rawDescription}
"""

请你剥离其中营销成分，精准定位并提取相关的特征。结果必须是一个绝对合法的 JSON 对象。严禁返回任何 markdown 标记或中文啰嗦。
字段和格式要求：
{
  "max_db": 50, // 提取最大分贝数，若无填写整数 50
  "waterproof": 5, // 提取防水分级（如 IPX7 填7，全身水洗填7，无则填5）
  "appearance": "normal", // 极其隐蔽(项链/口红等)填 'high_disguise'，否则 'normal'
  "physical_form": "external", // 吮吸外置填 'external'，\u63d2\u5165填 'internal'，双效填 'composite'
  "motor_type": "gentle", // 'strong'（强震双马达）或 'gentle'
  "function_tags": ["防水", "定点刺激", "双马达"], // 提取最多5个核心功能关键词数组
  "gender": "female", // 严格使用：'female'(女性向), 'male'(男性向), 'unisex'(通用/情侣)
  "material": "亲肤硅胶", // 材质提取，如果没提及就填 "未知"
  "price_rmb": 1200 // 将原始价格换算为纯数字的人民币预估值，无报价填 0
}
`;

    let resultText = '{}';
    try {
      if (!openai) throw new Error("无有效的强链路客户端");
      const response = await openai.chat.completions.create({
        model: 'deepseek-v4-flash', 
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1, 
      });
      resultText = response.choices[0].message.content || '{}';
    } catch (e) {
       console.error(`[警告] 第一链路降维通道超载:`, (e as Error).message);
       try {
         resultText = await callGlmFallback(prompt);
       } catch (fallbackError) {
         console.error(`[故障] 双重模型链路全部中断`);
         continue; 
       }
    }

    try {
      const extractJsonText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedSpecs = JSON.parse(extractJsonText);
      console.log(`[萃取完毕] 价格预估: ${parsedSpecs.price_rmb}元 | 标签: ${(parsedSpecs.function_tags || []).join(',')}`);
      
      // 合体到内存
      const processedProduct = {
        name: item.name,
        priceText: item.priceText,
        sourceUrl: item.sourceUrl,
        image: item.coverImage,
        specs: parsedSpecs,
        rawDescription: item.rawDescription
      };
      
      cleanedData.push(processedProduct);

      // --- 第一步：推入 `products` 表 (作为原始数据源) ---
      console.log(`[数据库] 1/2 正在同步 \`products\` 表...`);
      
      const productPayload = {
        name:          processedProduct.name,
        price:         parsedSpecs.price_rmb > 0 ? parsedSpecs.price_rmb : null,
        image:         processedProduct.image || null,
        link:          processedProduct.sourceUrl,
        specs:         parsedSpecs as any,
        gender:        mapGender(item.genderHint || parsedSpecs.gender || parsedSpecs.targetAudience, 'capitalized'),
        tags:          parsedSpecs.function_tags || [],
        competitor_id: leloCompetitorId
      };

      // 查找是否已存在同名产品
      const existingProduct = await prisma.products.findFirst({
        where: { name: processedProduct.name }
      });

      let originalId: string;
      if (existingProduct) {
        const updated = await prisma.products.update({
          where: { id: existingProduct.id },
          data: productPayload
        });
        originalId = updated.id;
        console.log(`  -> [products] 原始记录已更新 (ID: ${originalId})`);
      } else {
        const created = await prisma.products.create({
          data: productPayload
        });
        originalId = created.id;
        console.log(`  -> [products] 全新原始记录已创建 (ID: ${originalId})`);
      }

      // --- 第二步：推入 `recommender_toys` 表 (关联 original_id) ---
      console.log(`[数据库] 2/2 正在同步 \`recommender_toys\` 表...`);

      const itemPayload = {
         original_id:   originalId, // 绑定溯源 ID
         name:          processedProduct.name,
         safe_display_name: buildSafeDisplayName(processedProduct.name),
         brand:         'LELO',                                          
         price:         parsedSpecs.price_rmb > 0 ? parsedSpecs.price_rmb : null,                                        
         max_db:        typeof parsedSpecs.max_db === 'number' ? parsedSpecs.max_db : (parsedSpecs.maxDb || null),
         waterproof:    typeof parsedSpecs.waterproof === 'number' ? parsedSpecs.waterproof : null,
         appearance:    mapAppearance(parsedSpecs.appearance),
         physical_form: mapPhysicalForm(parsedSpecs.physical_form || parsedSpecs.physicalForm),
         motor_type:    mapMotorType(parsedSpecs.motor_type || parsedSpecs.motorType),
         gender:        mapGender(item.genderHint || parsedSpecs.gender || parsedSpecs.targetAudience || 'unisex'),
         material:      parsedSpecs.material     || '未知',
         image_url:     processedProduct.image   || null,
         raw_description: item.rawDescription || null,
         updated_at:    new Date(),
      };

      // 【去重策略】: 清除同名记录后\u63d2\u5165
      await prisma.recommender_toys.deleteMany({
         where: { name: item.name }
      });
      
      await prisma.recommender_toys.create({ data: itemPayload });
      console.log(`  -> [recommender_toys] 推荐器标准模型已就绪 (Linked to ${originalId})`);

    } catch (e) {
       console.error(`[故障] JSON解析失败或数据库推入错误:`, e);
    }
  }

  // 持久化存储清洗的备份
  const dir = path.dirname(CLEANED_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CLEANED_PATH, JSON.stringify(cleanedData, null, 2));
  
  await prisma.$disconnect();
  console.log(`\n--- 所有清洗入库任务已完美终结 ---`);
}

// 兼容原来的手动单独运行方式
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCleaner().catch(err => {
    console.error(err);
    prisma.$disconnect();
  });
}
