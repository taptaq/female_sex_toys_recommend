/**
 * 单独模拟「详情页参数抓取」链路：打开商品 URL → 滚动 → 逐 frame 执行 scrapeParamPairsInPage → 打印合并结果。
 *
 * 用法:
 *   npm run debug:param-chain:tenga
 *   npm run debug:param-chain:tenga -- "https://detail.tmall.com/item.htm?id=其它ID"
 *
 * 依赖 .env 中 TMALL_COOKIE（与 crawler 相同），否则可能进登录页。
 */
import { chromium } from 'playwright';
import dotenv from 'dotenv';
import {
  extractParamPairsFromCompactText,
  extractParamPairsFromLooseJsonText,
  extractParamPairsFromPageHtml,
  mergeWhitelistParams,
  scrapeParamPairsFromIceContext,
  scrapeParamPairsInPage,
} from './param-extraction';
import { tryRevealTmallParamTabs } from './tmall-param-ui';

dotenv.config();

/** 默认：TENGA 天猫商品详情（id=619681317502），可替换为其它店铺内详情页 URL */
const DEFAULT_URL =
  'https://detail.tmall.com/item.htm?id=619681317502&rn=9c9eafb968b55c8a94d0b95262a3fa90&abbucket=11';

async function main() {
  const targetUrl = process.argv[2] || DEFAULT_URL;

  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });

  const cookieStr = process.env.TMALL_COOKIE || '';
  if (cookieStr) {
    const parseCookies = (domain: string) =>
      cookieStr
        .split(';')
        .map((c) => {
          const [name, ...rest] = c.trim().split('=');
          return { name, value: rest.join('='), domain, path: '/' };
        })
        .filter((c) => c.name);

    await context.addCookies([...parseCookies('.tmall.com'), ...parseCookies('.taobao.com')]);
    console.log(`[debug-param] 已注入 Cookie，长度 ${cookieStr.length}`);
  } else {
    console.warn('[debug-param] TMALL_COOKIE 为空，可能无法查看详情参数');
  }

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    // @ts-ignore
    navigator.languages = ['zh-CN', 'zh'];
  });

  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'log' || msg.type() === 'info') {
      console.log(`    [Browser] ${msg.text()}`);
    }
  });

  console.log(`[debug-param] 打开: ${targetUrl}`);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);

  await page.evaluate(async () => {
    for (let j = 0; j < 5; j++) {
      window.scrollBy(0, 2000);
      await new Promise((r) => setTimeout(r, 800));
    }
  });

  await tryRevealTmallParamTabs(page);
  await page.evaluate(async () => {
    window.scrollBy(0, 2000);
    await new Promise((r) => setTimeout(r, 600));
  });

  await page
    .waitForFunction(
      () =>
        !!(window as unknown as { __ICE_APP_CONTEXT__?: { loaderData?: unknown } }).__ICE_APP_CONTEXT__
          ?.loaderData,
      { timeout: 20000 },
    )
    .catch(() => {});

  const mergedParams = new Map<string, string>();
  let paramSectionHitCount = 0;
  let rawParamPairTotal = 0;
  let fi = 0;

  const icePairs = await page.evaluate(scrapeParamPairsFromIceContext).catch(() => [] as Array<[string, string]>);
  rawParamPairTotal += icePairs.length;
  if (icePairs.length > 0) paramSectionHitCount++;
  console.log(`[debug-param] ICE loaderData 候选: ${icePairs.length}`);
  if (icePairs.length && icePairs.length <= 40) {
    console.log(' ICE sample:', JSON.stringify(icePairs.slice(0, 15), null, 0));
  }
  mergeWhitelistParams(mergedParams, icePairs);

  for (const frame of page.frames()) {
    const framePairs = await frame.evaluate(scrapeParamPairsInPage).catch(() => [] as Array<[string, string]>);
    rawParamPairTotal += framePairs.length;
    if (framePairs.length > 0) paramSectionHitCount++;

    const preview = frame.url().slice(0, 120);
    console.log(`[debug-param] frame#${fi} pairs=${framePairs.length} url=${preview}${frame.url().length > 120 ? '…' : ''}`);
    if (framePairs.length && framePairs.length <= 20) {
      console.log(' sample:', JSON.stringify(framePairs.slice(0, 8), null, 0));
    }

    mergeWhitelistParams(mergedParams, framePairs);
    fi++;
  }

  const htmlSnap = await page.content();
  const htmlPairs = extractParamPairsFromPageHtml(htmlSnap);
  rawParamPairTotal += htmlPairs.length;
  if (htmlPairs.length > 0) paramSectionHitCount++;
  console.log(`[debug-param] HTML 内嵌 name/value、properties 候选: ${htmlPairs.length}`);
  if (htmlPairs.length && htmlPairs.length <= 30) {
    console.log(' html sample:', JSON.stringify(htmlPairs.slice(0, 12), null, 0));
  }
  mergeWhitelistParams(mergedParams, htmlPairs);

  const loosePairs = extractParamPairsFromLooseJsonText(htmlSnap);
  rawParamPairTotal += loosePairs.length;
  if (loosePairs.length > 0) paramSectionHitCount++;
  console.log(`[debug-param] 宽松 JSON（propertyName 等）候选: ${loosePairs.length}`);
  if (loosePairs.length && loosePairs.length <= 30) {
    console.log(' loose sample:', JSON.stringify(loosePairs.slice(0, 12), null, 0));
  }
  mergeWhitelistParams(mergedParams, loosePairs);

  const bodyText = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
  const compactTextPairs = extractParamPairsFromCompactText(bodyText);
  rawParamPairTotal += compactTextPairs.length;
  if (compactTextPairs.length > 0) paramSectionHitCount++;
  console.log(`[debug-param] 紧凑文本参数候选: ${compactTextPairs.length}`);
  if (compactTextPairs.length && compactTextPairs.length <= 30) {
    console.log(' compact sample:', JSON.stringify(compactTextPairs.slice(0, 12), null, 0));
  }
  mergeWhitelistParams(mergedParams, compactTextPairs);

  const orderedKeys = ['材质', '品牌', '产地', '生产企业', '分类', '品名'];
  const detailParamsText = orderedKeys
    .filter((k) => mergedParams.has(k))
    .map((k) => `${k}: ${mergedParams.get(k)}`)
    .join('\n');

  console.log('\n--- 链路汇总 ---');
  console.log(`含候选键值对的 frame 数: ${paramSectionHitCount}`);
  console.log(`原始键值候选总数: ${rawParamPairTotal}`);
  console.log('白名单合并后:');
  console.log(detailParamsText || '(无)');

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
