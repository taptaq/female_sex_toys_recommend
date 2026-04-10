import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runCleaner } from './cleaner.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 目标分类页入口列表
const TARGET_URLS = [
  'https://www.lelo.com/zh-hant/sex-toys-for-women',
  'https://www.lelo.com/zh-hant/sex-toys-for-men'
];
const MAX_ITEMS = 50;
const DELAY_BETWEEN_PAGES = 2500; // 2.5s delay to avoid bot protection

const BUFFER_PATH = path.resolve(__dirname, '../../data/review-buffer.json');

async function runCrawler() {
  console.log('--- 启动 Playwright 无头抓取引擎 [Target: LELO] ---');
  
  // 以 headless 模式启动以消除视觉干扰
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  let listItems: any[] = [];

  for (const targetUrl of TARGET_URLS) {
    console.log(`\n[雷达] 正在准备潜入列表页: ${targetUrl}`);
    
    // 根据 URL 判断类别性别暗示
    const genderHint = targetUrl.includes('for-men') ? 'male' : 'female';
    
    try {
      // 访问分类页并获取原始文本以进行正则匹配 (模拟 view-source)
      const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      const rawHtml = await response?.text() || '';
      
      // 使用正则提取源码中的 views-row 内容
      const rowRegex = /<div\s+class="views-row">\s*<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/div>/gi;
      let match;
      let pageCount = 0;
      
      while ((match = rowRegex.exec(rawHtml)) !== null) {
          let href = match[1];
          let innerHtml = match[2];

          if (!href.startsWith('http')) href = 'https://www.lelo.com' + (href.startsWith('/') ? '' : '/') + href;
          
          // 进一步过滤掉非产品功能的链接
          if (href.includes('/cart') || href.includes('/checkout') || href.includes('/login') || href.includes('/account')) continue;

          // 从 a 标签内部内容中粗略提取标题
          const titleMatch = innerHtml.match(/aria-label="([^"]+)"/) || innerHtml.match(/title="([^"]+)"/);
          let title = titleMatch ? titleMatch[1].replace('Go to the', '').trim() : '';

          listItems.push({ href, title, genderHint });
          pageCount++;
      }

      console.log(`  -> 该页面源码共解析出 ${pageCount} 个产品节点`);

      // 如果正则没抓到，尝试作为兜底的前端 DOM 探测
      if (pageCount === 0) {
          console.log('  -> [兜底] 正则未命中，尝试 DOM 注入式探测...');
          const domItems = await page.evaluate(() => {
            const productAnchorTags = Array.from(document.querySelectorAll('a[aria-label^="Go to the"]'));
            return productAnchorTags.map(a => {
               const href = (a as HTMLAnchorElement).href || '';
               const imgEl = a.querySelector('img');
               let titleText = a.getAttribute('aria-label')?.replace('Go to the', '').trim() || imgEl?.alt || '';
               return { href, img: imgEl ? imgEl.src : null, title: titleText || 'UNKNOWN', priceText: '0' };
            }).filter(item => item.href.includes('lelo.com/zh-hant/'));
          });
          listItems.push(...domItems);
          console.log(`  -> [兜底] DOM 探测补全了 ${domItems.length} 个节点`);
      }
    } catch (err) {
      console.error(`  -> [故障] 无法扫描该路径: ${targetUrl}`, err);
    }
  }

  // 全局去重与性别归一化：若产品同时出现在多个性别分类中，标记为 unisex (通用)
  const uniqueItemsMap = new Map<string, any>();
  
  listItems.forEach(item => {
    if (!item.href) return;
    
    // 标准化 URL 用于 key 匹配
    const normalizedHref = item.href.replace(/\/$/, '');
    
    if (uniqueItemsMap.has(normalizedHref)) {
      const existing = uniqueItemsMap.get(normalizedHref);
      // 如果已存项的性别暗示与当前项不同，则判定为通用
      if (existing.genderHint && item.genderHint && existing.genderHint !== item.genderHint) {
        console.log(`[逻辑] 检测到跨分类产品，性别强制归一化为通用: ${item.title}`);
        existing.genderHint = 'unisex';
      }
    } else {
      uniqueItemsMap.set(normalizedHref, { ...item });
    }
  });

  const uniqueItems = Array.from(uniqueItemsMap.values());

  const targetItems = uniqueItems.slice(0, MAX_ITEMS);
  console.log(`\n[整理] 去重完毕，共取得 ${targetItems.length} 个不重复的目标商品。准备开始详情页探测...\n`);

  const bufferData = [];

  for (let i = 0; i < targetItems.length; i++) {
    const item = targetItems[i];
    try {
      console.log(`\n[探测] 正在潜入详情节点: ${item.href}`);
      
      // 设定宽容等待时长，以应对可能的网速延迟
      await page.goto(item.href, { waitUntil: 'domcontentloaded', timeout: 45000 });
      
      // 容忍特定框架的延迟渲染
      await page.waitForTimeout(3000); 

      // 提取核心全文描述数据
      const scrapedData = await page.evaluate(() => {
        // 关闭可能的底部弹窗或提示以防遮盖 DOM 节点（如订阅弹窗、Cookie 等）
        const closeBtns = document.querySelectorAll('.omni-close, .close-button, [aria-label="Close"], .accept-cookie');
        closeBtns.forEach(btn => (btn as HTMLElement).click());

        // 尝试优先抓取商品特有的介绍区块（Summary等）
        let contentEl = document.querySelector('[class*="Summary-sc"]') || 
                        document.querySelector('#summary') || 
                        document.querySelector('.product-details-content') ||
                        document.querySelector('main') || 
                        document.body;
                        
        // 尝试抓取大标题修正数据，详情页里的 H1 通常是最准确的产品名
        const titleEl = document.querySelector('h1') || document.querySelector('[class*="Title-sc"]');
        const title = titleEl ? titleEl.textContent?.trim() : '';

        // 获取精确价格文本 (增强版：基于正则的全局盲搜)
        // 1. 尝试特定的类名
        let priceText = '';
        const priceEl = document.querySelector('[class*="Price-sc"]') || 
                        document.querySelector('[data-test-id="price"]');
        
        if (priceEl && priceEl.textContent?.includes('$')) {
           priceText = priceEl.textContent.trim();
        } else {
           // 2. 如果基础选择器失效，扫描页面上所有包含 USD 的短文本块
           const allText = document.body.innerText;
           const priceMatch = allText.match(/USD\s?\d+(\.\d+)?/);
           if (priceMatch) {
             priceText = priceMatch[0];
           }
        }

        // 取正文并去除大量冗余的换行符和空行
        const rawText = contentEl ? (contentEl as HTMLElement).innerText.replace(/\n\s*\n/g, '\n').trim() : '';

        // 抓取主图 (针对 LELO 详情页常用的选择器)
        const mainImgEl = document.querySelector('[class*="ImageWrapper-sc"] img') || 
                          document.querySelector('.product-image img') || 
                          document.querySelector('main img') as HTMLImageElement;
        const mainImg = mainImgEl ? (mainImgEl as HTMLImageElement).src : '';

        return { title, rawText, priceText, mainImg };
      });

      // 结合第一轮列表页和第二轮详情页的数据（详情页优先）
      const finalTitle = scrapedData.title || item.title || 'UNKNOWN_TITLE';
      const finalPrice = scrapedData.priceText || item.priceText || '0';
      const finalImg = scrapedData.mainImg || item.img || '';

      // --- 关键过滤：排除购物车、空页面等非产品数据 ---
      if (finalTitle.includes('購物車') || finalTitle.includes('Shopping Cart') || finalTitle === 'UNKNOWN_TITLE') {
        console.log(`[过滤] 检测到非产品页面或购物车节点，已自动闭屏: ${finalTitle}`);
        continue;
      }

      console.log(`[捕获] 成功带回终局数据帧: ${finalTitle}`);
      
      bufferData.push({
        sourceUrl: item.href,
        name: finalTitle,
        priceText: finalPrice,
        coverImage: finalImg, 
        genderHint: item.genderHint,
        // 截断多余的长文本，保留最核心的部分留给 LLM 洗数据
        rawDescription: scrapedData.rawText.substring(0, 8000), 
        imagePlaceholder: 'bg-gradient-to-br from-indigo-900/40 to-blue-900/40',
        isReviewed: false,
      });

    } catch (error) {
      console.error(`[故障] 引力异常脱轨 ${item.href}:`, error);
    }
    
    // 强制加入人工呼吸般的停顿，避免触发反爬虫护盾
    if (i < targetItems.length - 1) {
      console.log(`[隐藏] 伪装静默等待 ${DELAY_BETWEEN_PAGES} 毫秒...`);
      await page.waitForTimeout(DELAY_BETWEEN_PAGES);
    }
  }

  await browser.close();

  // 若无目录则自行创建
  const dir = path.dirname(BUFFER_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(BUFFER_PATH, JSON.stringify(bufferData, null, 2));
  
  console.log(`\n--- 抓取任务终结 ---`);
  console.log(`已将第一维度的混沌数据池密封至本地缓冲区: ${BUFFER_PATH}`);
  
  // =================自动无缝管线流水线触发=================
  console.log(`[接力] 即将无缝移交至阶段四：通过 AI 降维清洗模块`);
  try {
     await runCleaner();
  } catch (cleanerError) {
     console.error(`[致命错误] 清洗模块流水线崩塌:`, cleanerError);
  }
}

runCrawler().catch(console.error);
