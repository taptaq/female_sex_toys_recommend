import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BUFFER_PATH = path.resolve(__dirname, '../data/review-buffer.json');
const CLEANED_PATH = path.resolve(__dirname, '../data/cleaned-data.json');

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

/**
 * Minimax 兜底调用函数
 */
async function callMinimaxFallback(prompt: string) {
  console.log('⚠️ [Fallback] 正在切换至 Minimax 量子补偿轨道...');
  const apiKey = process.env.MINIMAX_API_KEY;
  const model = process.env.MINIMAX_MODEL || 'MiniMax-M2.5-highspeed';
  
  const requestData = {
    model: model,
    messages: [
      { role: "user", content: prompt }
    ],
    bot_setting: [
      {
        bot_name: "专家助手",
        content: "你是一个专注提取硬件参数的专业机器人。"
      }
    ],
    temperature: 0.1
  };

  try {
    const response = await axios.post(
      "https://api.minimax.io/v1/text/chatcompletion_v2",
      requestData,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 55000,
      }
    );

    if (response.data && response.data.choices && response.data.choices.length > 0) {
      return response.data.choices[0].message.content || '{}';
    } else {
      console.error('❌ [Fallback] Minimax 返回了非标准格式:', JSON.stringify(response.data));
      throw new Error('Invalid Minimax response format');
    }
  } catch (error: any) {
    console.error('❌ [Fallback] Minimax 补偿任务中断:', error.message || error);
    throw error;
  }
}

async function runCleaner() {
  console.log('--- 启动 AI 降维清洗模块 [LLM Pipeline] ---');
  
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

  const cleanedData = [];

  for (const item of bufferData) {
    // 根据设定的工作流，如果是已被人工审查的数据，不再污染复写
    if (item.isReviewed) {
      console.log(`[跳过] 商品 ${item.name} 已被标记为已审核。`);
      continue;
    }

    console.log(`\n[清洗] 正在降维萃取非标特征: ${item.name}`);
    
    const prompt = `
你是一个专注处理情趣硬件参数的数据剥离机器人。
现有抓取至 LELO 等品牌独立站的纯文本长描述，可能掺杂无用情感营销文案：
"""
${item.rawDescription}
"""

请你剥离其中营销成分，精准定位并提取我需要的 5 项物理抽象特征。
结果必须是一个绝对合法的 JSON 对象格式，严禁返回任何 markdown 代码块标识和对话词汇。
格式规范与提取要求如下（若没有提及则使用我提供的默认值）：
{
  "maxDb": 50, // 提取极小数字可能带分贝/db字样，若无，填写整数 50
  "waterproof": 5, // 提取防水分级（如 IPX7 则填7，若提及淋浴/全身水洗可填6或7，无则填5）
  "appearance": "normal", // 若能极其隐蔽如做成项链口红等日常物品填 'high_disguise'，否则 'normal'
  "physicalForm": "external", // 若主要为吮吸/震动豆外置填 'external'，专门插入填 'internal'，双效均有填 'composite'
  "motorType": "gentle" // 判断马达烈度：若提及强震、大马力等填 'strong'，否则填 'gentle'
}
`;

    let resultText = '{}';
    try {
      const response = await openai.chat.completions.create({
        model: 'deepseek-chat', // 若使用 千问 则改为 'qwen-turbo' 或 'qwen-max'
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1, // 选择极低温度以限制大象幻觉
      });
      resultText = response.choices[0].message.content || '{}';
    } catch (e) {
       console.error(`[警告] DeepSeek 链路超载:`, e);
       try {
         resultText = await callMinimaxFallback(prompt);
       } catch (fallbackError) {
         console.error(`[故障] 双重模型链路全部中断:`, fallbackError);
         continue; // 跳过此条数据
       }
    }

    try {
      const extractJsonText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedSpecs = JSON.parse(extractJsonText);
      console.log(`[萃取完毕]`, parsedSpecs);
      
      // 合体，基于你刚才同步的数据库策略，我们准备将数据封装至现有 products.specs
      cleanedData.push({
        sourceUrl: item.sourceUrl,
        name: item.name,
        priceText: item.priceText,
        imagePlaceholder: item.imagePlaceholder,
        specs: parsedSpecs,
        rawDescription: item.rawDescription
      });

    } catch (e) {
       console.error(`[故障] 语言模型超载或返回非标准 JSON 脱离管控:`, e);
    }
  }

  // 若无目录则自行创建
  const dir = path.dirname(CLEANED_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(CLEANED_PATH, JSON.stringify(cleanedData, null, 2));
  console.log(`\n--- 清洗任务终结 ---`);
  console.log(`被物理标签标准化的次级包装池已构建至: ${CLEANED_PATH}`);
  console.log(`我们即将接壤进入核心数据库层。`);
}

runCleaner().catch(console.error);
