# 大人糖爬虫 — 参考

## 数据流

1. `TARGET_URL` 店铺搜索列表 → 翻页至无「下一页」或上限  
2. 列表页收集商品卡片，保留 `listUrl` 和 `listPageUrl`  
3. 价格：整页列表截图 OCR 一次识别多商品 → 本地价格缓存 → 单项截图 OCR 兜底  
4. 详情：优先回到 `listPageUrl` 模拟点击商品卡片/图片，拿到可能带 `pisk` 的最终 `sourceUrl`  
5. 详情页 `response` 监听里攒 `alicdn` 图 URL，并在控制台输出详情图片地址  
6. 滚动 → `tryRevealTmallParamTabs` → 再滚动  
7. 参数提取依次尝试：
   - `scrapeParamPairsFromIceContext`
   - `scrapeParamPairsInPage`
   - `extractParamPairsFromPageHtml(全文)`
   - `extractParamPairsFromLooseJsonText(全文)`
   - `extractParamPairsFromCompactText(document.body.innerText)`
8. 白名单键：`材质、品牌、产地、生产企业、分类、品名`  
9. 图够则 `orchestrateOCR`，否则 `textFallbackWithDeepSeek`  
10. `bufferData` → `src/data/review-buffer.json` → `runCleaner()`

## 输出文件

- `src/data/review-buffer.json`：爬虫原始缓冲（路径以 `crawler.ts` 内 `BUFFER_PATH` 为准）
- `src/data/cleaned-data.json`：cleaner 输出的清洗后数据
- `src/data/darentang-list-price-cache.json`：列表价格 OCR 缓存；新品牌应改为 `<brand-slug>-list-price-cache.json`

## 入库字段来源

- `products.price` / `recommender_toys.price`：数字类型，来自 `item.price` 或 cleaner 的 `price_rmb` 兜底；不保留 `priceText`。
- `products.link`：使用 `item.sourceUrl`，用于前端跳转。
- `recommender_toys.brand`：固定写入品牌中文名。
- `recommender_toys.max_db`：玩具类可解析分贝；服饰、护理耗材、床品防护垫为 `null`。
- `recommender_toys.gender`：护理耗材如避孕套、润滑液固定 `unisex`。
- 空 `name`：直接跳过，不入库。

## 已验证可抓到的参数样例

对商品 `id=628616572066`，当前已验证能从紧凑文本参数区提取：

- `材质: 硅胶`
- `品牌: 大人糖`
- `品名: 小海豹`
- `产地: 中国大陆`
- `生产企业: 深圳市有幸科技有限公司`
- `分类: 变频跳蛋`

## 当前参数归一规则

- `材质 / 面料材质 / 材料` → `材质`
- `品名 / 商品名 / 商品名称 / 产品名称 / 医疗器械名称` → `品名`
- `生产企业 / 生产厂家 / 厂家 / 制造商 / 生产商 / 委托生产企业` → `生产企业`

## 为什么要保留 compact-text 解析

- 新版天猫参数区可能不是传统 `dl/tr/li` 结构。
- 页面正文里会出现两次以上 `参数信息`，前面的可能只是导航标签。
- `extractParamPairsFromCompactText` 会扫描所有参数区块，而不是只取第一次命中。

## 新增调试入口模板

1. 在 `src/scraper/darentang/` 添加 `debug-xxx.ts`  
2. `import 'dotenv/config'` + `chromium` + 与 crawler 一致的 Cookie/context 初始化（可抄 `debug-param-chain.ts`）  
3. 在根 `package.json` 的 `scripts` 增加 `"debug:xxx": "tsx -r dotenv/config src/scraper/darentang/debug-xxx.ts"`  
4. 在本 Skill 的「命令」表格补一行

## Playwright

- 浏览器由项目 `dependencies` 的 `playwright` 提供；首次运行若缺浏览器可执行 `npx playwright install chromium`。
