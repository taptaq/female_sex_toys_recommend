import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Target URls for LELO test crawl
const targetUrls = [
  // 仅作示范，可在运行时替换为你实际关注的具体型号页
  'https://www.lelo.com/soraya-wave',
  'https://www.lelo.com/ena-2'
];

const BUFFER_PATH = path.resolve(__dirname, '../data/review-buffer.json');

async function runCrawler() {
  console.log('--- 启动 Playwright 无头抓取引擎 [Target: LELO] ---');
  
  // 以 headless 模式启动以消除视觉干扰
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  const bufferData = [];

  for (const url of targetUrls) {
    try {
      console.log(`\n[探测] 正在潜入目标节点: ${url}`);
      
      // 设定宽容等待时长，以应对可能的网速延迟
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      
      // 容忍特定框架的延迟渲染
      await page.waitForTimeout(3000); 

      // 提取核心数据。为防止强特征选择器失效，采用相对泛用的 DOM 查找
      const scrapedData = await page.evaluate(() => {
        // 尝试抓取 H1 或其他显著题头作为名字
        const titleEl = document.querySelector('h1') || document.querySelector('.product-title');
        const title = titleEl ? titleEl.textContent?.trim() : 'UNKNOWN_TITLE';
        
        // 抓取包含 "description", "details" 等信息的区块。作为兜底方案，直接提取 main。
        const mainEl = document.querySelector('main') || document.body;
        // 剥除了大量的多余换行符
        let rawText = mainEl.innerText.replace(/\n\s*\n/g, '\n').trim();
        
        // 价格逻辑通常带有 $ 或 ¥ 符号
        const priceEls = Array.from(document.querySelectorAll('*'))
          .filter(el => el.textContent?.includes('¥') || el.textContent?.includes('$'));
        const priceText = priceEls.length > 0 ? priceEls[priceEls.length - 1].textContent?.trim() : '0';

        return { title, rawText, priceText };
      });

      console.log(`[捕获] 成功带回数据帧: ${scrapedData.title}`);
      
      bufferData.push({
        sourceUrl: url,
        name: scrapedData.title,
        priceText: scrapedData.priceText,
        // 这里截断多余的长文本，保留最精华的前 8000 个字符用于后续 LLM 审查清洗
        rawDescription: scrapedData.rawText.substring(0, 8000), 
        imagePlaceholder: 'bg-gradient-to-br from-indigo-900/40 to-blue-900/40',
        isReviewed: false,
      });

    } catch (error) {
      console.error(`[故障] 引力异常脱轨 ${url}:`, error);
    }
  }

  await browser.close();

  // 若无目录则自行创建
  const dir = path.dirname(BUFFER_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(BUFFER_PATH, JSON.stringify(bufferData, null, 2));
  
  console.log(`\n--- 抓取任务终结 ---`);
  console.log(`已将第一维度的混沌数据池密封至本地缓冲区: ${BUFFER_PATH}`);
  console.log(`请指示是否移交阶段四：通过 AI 降维清洗模块`);
}

runCrawler().catch(console.error);
