---
name: darentang-tmall-scraper
description: >-
  Run, debug, or extend the Darentang (大人糖) / Xiaoguaishou (小怪兽) /
  Wangyichunfeng (网易春风) / Zuiqingfeng (醉清风-谜姬) / Kistoy / TENGA / iroha / We-Vibe Tmall scraper pattern in
  inner_space_toy_recommender. Use when working on src/scraper/darentang,
  src/scraper/xiaoguaishou, src/scraper/wangyichunfeng, src/scraper/zuiqingfeng,
  src/scraper/kistoy, src/scraper/tenga, src/scraper/iroha, or src/scraper/wevibe, debug-param-chain.ts, TMALL_COOKIE, Playwright
  detail-page capture, ProductShelf/cardContainer shop-list pages, legacy
  .J_TItems search/category pages, image/detail OCR, local tag extraction from
  rawDescription, or Tmall parameter extraction including compact "参数信息"
  text blocks. Also use when the user asks to generate, scaffold, copy, or
  clone a brand-specific product scraping directory under src/scraper/<brand-slug>
  from the current Tmall scraper pattern.
---

# 天猫品牌抓取 Skill

用于两类任务：

1. 维护这条已跑通的“大人糖”天猫抓取链路：店铺列表抓取、详情页图文解析、参数信息解析、缓冲写入与 cleaner 清洗。
2. 以这条链路为模板，快速生成新的“品牌级爬虫目录”，用于后续新增其它品牌抓取。

## 先看哪些文件

- 主流程：[src/scraper/darentang/crawler.ts](src/scraper/darentang/crawler.ts)
- 小怪兽主流程：[src/scraper/xiaoguaishou/crawler.ts](src/scraper/xiaoguaishou/crawler.ts)
- 网易春风主流程：[src/scraper/wangyichunfeng/crawler.ts](src/scraper/wangyichunfeng/crawler.ts)
- 醉清风-谜姬主流程：[src/scraper/zuiqingfeng/crawler.ts](src/scraper/zuiqingfeng/crawler.ts)
- KISTOY 主流程：[src/scraper/kistoy/crawler.ts](src/scraper/kistoy/crawler.ts)
- TENGA 主流程：[src/scraper/tenga/crawler.ts](src/scraper/tenga/crawler.ts)
- iroha 主流程：[src/scraper/iroha/crawler.ts](src/scraper/iroha/crawler.ts)
- We-Vibe 主流程：[src/scraper/wevibe/crawler.ts](src/scraper/wevibe/crawler.ts)
- 参数调试入口：[src/scraper/darentang/debug-param-chain.ts](src/scraper/darentang/debug-param-chain.ts)
- 参数解析：[src/scraper/darentang/param-extraction.ts](src/scraper/darentang/param-extraction.ts)
- 参数区 Tab 展开：[src/scraper/darentang/tmall-param-ui.ts](src/scraper/darentang/tmall-param-ui.ts)
- 清洗与入库前整理：[src/scraper/darentang/cleaner.ts](src/scraper/darentang/cleaner.ts)

## 当前大人糖链路的关键实现点

- 详情页优先回到列表页模拟点击商品卡片，拿到带 `pisk` 的真实 `sourceUrl`，不要只信列表 `a.href`。
- 列表页同时兼容旧版 `.J_TItems dl.item` 和新版店铺首页货架流：`.product_shelf` / `[class*="ProductShelf"]` 下的 `[class*="cardContainer"]`。
- 新版货架卡片不一定有可直接跳转的 `a.href`；打开详情时优先模拟点击卡片/图片，必要时清理 `.J_MIDDLEWARE_FRAME_WIDGET` 遮罩并对货架卡片使用 `force: true`。
- `crawler.ts` 使用 `fileURLToPath(import.meta.url)`，不要再用 `new URL(...).pathname`，否则空格路径会写到 `%20` 假路径。
- `review-buffer.json` 采用“逐条写入”而不是最后一次性落盘，避免长链路中途失败后只剩旧数据。
- 价格默认以详情页实时抓取结果为准；列表页只负责收集商品卡片，不再依赖列表价格 OCR。
- 详情图 OCR 当前分四类模板：`TOY`、`APPAREL`、`CARE`、`PAD`。
- `TOY` 商品在 cleaner 里有本地 `dB/分贝` 解析器，优先回填 `max_db`；非玩具类 `max_db=null`。
- `CARE`（避孕套/润滑液/护理类）性别固定 `unisex`。
- `name` 为空的记录直接跳过，不入库。
- `products.link` / 前端跳转统一使用 `sourceUrl` 落库后的链接。
- `function_tags` 不只依赖模型：cleaner 会从 `rawDescription` 的 `技术卖点 / 核心卖点 / 使用特性 / 动力规格 / 产品类型 / 款式结构 / 套装构成 / 规格信息 / 环境属性` 本地提取标签，再与模型标签和默认标签合并去重，并过滤包含 `未提及` 的标签。
- 性别优先本地显式词判断；男用/飞机杯等关键词应覆盖模型误判，避孕套/润滑液等护理耗材固定 `unisex`。

## 这条链路现在怎么工作

1. `crawler.ts` 从店铺搜索页、旧版类目页或新版店铺首页货架流收集商品卡片。
2. 进入详情页后监听 `response`，积累 `alicdn` 图片 URL。
3. 图文详情优先走 `orchestrateOCR()`；玩具类默认 `GLM-4.6V` 优先、`Qwen-VL` 兜底，服饰类、护理耗材类、床品防护垫类使用中性目录 prompt 并改为 `Qwen-VL` 优先，降低敏感词拦截和误判。
4. 参数信息按四层兜底合并：
   - `scrapeParamPairsFromIceContext`
   - `scrapeParamPairsInPage`
   - `extractParamPairsFromPageHtml`
   - `extractParamPairsFromLooseJsonText`
   - `extractParamPairsFromCompactText`
5. 命中白名单键后，拼成 `rawDescription` 里的 `[参数信息]` 区块，并与 `[图文提取]` 合并。
6. 结果写入 `src/data/review-buffer.json`，随后执行 `runCleaner()`；服饰类、护理耗材类、床品防护垫类商品 cleaner 使用中性分类 prompt，模型失败或 JSON 不合法时用本地默认规格继续入库。
7. 链接字段约定：`listUrl` 保留列表项原始 `a.href`，`listPageUrl` 保留商品所在列表页，详情阶段优先回列表页模拟点击商品图片，`sourceUrl` 记录点击后的最终落地 URL（可能带 `pisk` 等动态参数）。
8. 价格在详情页阶段提取，优先读 SSR/DOM/页面源码里的明文价格；列表页不再执行整页或局部价格 OCR。
9. cleaner 从 `rawDescription` 本地抽取特色/功能标签，再与模型输出合并；刷新历史数据标签时可直接基于现有 buffer/cleaned data 重跑 cleaner 或一次性 DB 脚本，不需要重新 OCR。

## 当用户要求“生成一个新品牌抓取目录”时怎么做

如果用户说“照大人糖这套，再做一个某某品牌的爬虫”，直接按下面流程生成目录文件；不要只给建议。缺少信息时优先合理推断，只有品牌名或店铺 URL 完全无法判断时才追问。

默认要求：

- 只要任务是“新建一个天猫品牌抓取目录”，就必须先用浏览器做一次列表结构探测。
- 这一步不需要等用户额外说“模拟一下列表结构”；应视为生成前的标准动作。
- 只有在明显无法访问站点、`TMALL_COOKIE` 失效或风控拦截时，才允许跳过探测，并在结果中说明原因。

### 需要确认或推断的输入

- `brandNameZh`: 中文品牌名，如 `大人糖`。
- `brandNameEn`: 英文/拼音品牌名，如 `Darentang`，没有就用中文。
- `brandSlug`: 目录名，小写短横线或拼音，如 `darentang`。
- `storeSearchUrl`: 店铺搜索页或店铺首页 URL。旧版天猫常见 `https://xxx.tmall.com/search.htm?search=y&orderType=coefp_desc`；新版品牌店可能是 `shop/view_shop.htm` 并用 `ProductShelf/cardContainer` 货架流。
- `maxItemsEnv`: 最大抓取数量环境变量，格式为 `<BRAND_UPPER>_MAX_ITEMS`。

### 目标目录

- `src/scraper/<brand-slug>/crawler.ts`
- `src/scraper/<brand-slug>/cleaner.ts`
- `src/scraper/<brand-slug>/debug-param-chain.ts`
- `src/scraper/<brand-slug>/param-extraction.ts`
- `src/scraper/<brand-slug>/tmall-param-ui.ts`

其中：

- 如果仍然是天猫店铺，优先复制并裁剪大人糖目录结构。
- 如果不是天猫，但仍是“列表页 -> 详情页 -> 参数/图文 -> cleaner 入库”模式，也优先保留 `crawler.ts + cleaner.ts + debug` 结构，再按站点调整选择器。

### 生成步骤

1. 先用浏览器打开 `<storeSearchUrl>`，自动探测列表结构：
   - 统计 `legacyCardCount`
   - 统计 `shelfCardCount`
   - 记录页面标题、当前 URL、是否命中登录页/风控页
   - 抽样输出前 5 到 10 个商品标题
   - 如果是货架流，再额外模拟滚动并记录每轮 `cardCount`
2. 根据探测结果判断该站点是：
   - 旧版 `.J_TItems dl.item` 分页页
   - 新版 `ProductShelf/cardContainer` 货架流
3. 复制 `src/scraper/darentang` 到 `src/scraper/<brand-slug>`。
4. 在新目录内批量替换品牌相关常量：
   - `darentang` → `<brand-slug>`
   - `Darentang` → `<brandNameEn>`
   - `大人糖` → `<brandNameZh>`
   - `DARENTANG_MAX_ITEMS` → `<BRAND_UPPER>_MAX_ITEMS`
   - `TARGET_URL` → `<storeSearchUrl>`
5. 将品牌专属数据文件改为 `<brand-slug>` 前缀；如不想覆盖大人糖数据，至少把 `review-buffer` 和 `cleaned-data` 改为品牌专属路径。
6. 保留天猫详情页“从列表页模拟点击商品卡片/图片拿最终 URL”的逻辑，因为 `pisk` 可能只在点击后动态拼接。
7. 列表选择器必须同时评估旧版 `.J_TItems` 和新版 `ProductShelf/cardContainer`；如果目标店铺只展示货架流，不要回退到只查 `search.htm`。
8. 列表过滤默认至少拆成两层：先过滤 `购物金 / 会员充值 / 储值卡 / 充值卡 / 礼品卡 / 店铺权益` 这类伪商品卡片，再按品牌或业务范围过滤真正商品。
9. 列表日志不要只打印“最终候选数”，还要同时打印“原始卡片数 / 伪商品过滤数 / 品牌过滤数 / 最终保留数”，避免误判列表总量。
10. 保留 `param-extraction.ts` 和 `tmall-param-ui.ts`，除非新站点不是天猫且明确不需要参数 Tab/紧凑文本解析。
11. 在 `package.json` 增加入口脚本：
   - `scrape:<brand-slug>` → `tsx -r dotenv/config src/scraper/<brand-slug>/crawler.ts`
   - `debug:param-chain:<brand-slug>` → `tsx -r dotenv/config src/scraper/<brand-slug>/debug-param-chain.ts`
12. 跑 `npx tsc --noEmit`，只修复本次生成目录引入的类型问题。

### 生成时必须同步修改的点

1. `crawler.ts`
   - `TARGET_URL`、`MAX_ITEMS` 环境变量名、缓存路径。
   - 列表采集选择器和商品卡片点击选择器；旧版 `.J_TItems` 与新版 `ProductShelf/cardContainer` 都要保留兼容。
   - 列表过滤必须拆成至少两层：先过滤 `购物金 / 会员充值 / 储值卡 / 充值卡 / 礼品卡 / 店铺权益` 这类伪商品卡片，再按品牌或业务范围过滤真正商品。
   - 日志里要同时打印：原始卡片数、伪商品过滤数、品牌过滤数、最终保留数，避免把“最终候选数”误看成“页面总商品数”。
   - 详情图 URL 收集、详情图 URL 控制台输出。
   - 详情页价格提取逻辑，优先 SSR/DOM/源码明文价格；列表页不做价格 OCR。
   - `listUrl`、`listPageUrl`、`sourceUrl` 三个链接字段。
2. `cleaner.ts`
   - competitors 表查找/创建用的品牌名、简介、是否国产。
   - `products.link = item.sourceUrl`，用于前端跳转。
   - `recommender_toys.brand = <brandNameZh>`。
   - `price` 入库为数字或 `null`，不要重新引入 `priceText`。
   - `name` 为空跳过不入库。
   - `function_tags` 合并本地 `rawDescription` 标签、模型标签和默认标签，并过滤 `未提及`。
   - 性别先用本地显式关键词修正，再落库；护理耗材固定 `unisex`。
   - 如果同一条标题/文案里同时出现女性显式词和男性强形态词，女性显式词优先，不要让 `飞机杯 / 前列腺 / 阴茎 / 男用` 这类词把 `女性 / 女用 / 跳蛋 / 阴蒂 / G点` 明显商品误判成 `male`。
   - 只有在没有命中女性显式词时，男用飞机杯等强男性形态词才判 `male`；品牌默认偏向只作为最后回落，不要覆盖显式词。
   - AI 清洗后再写库时，写入前先做 `SELECT 1` 健康检查；遇到 `Connection terminated unexpectedly` / `ECONNRESET` 等瞬断要 `$disconnect()` + `$connect()` 后最多重试 3 次，避免模型等待期间数据库空闲连接被服务端断开。
3. 商品类型规则
   - `TOY`: 可解析 `max_db`，无明确分贝时用玩具默认值。
   - `APPAREL` / `CARE` / `PAD`: `max_db = null`。
   - `CARE`: `gender = unisex`。
   - 品类判断优先看 `canonicalName` / 列表标题；如果标题命中 `训练器、飞机杯、跳蛋、按摩器、震动棒、自慰器、倒模、前列腺、龟头、阴茎、器具、玩具` 等主商品词，必须判为 `TOY`，不要被 `rawDescription` 套餐/赠品里的 `润滑液、玻尿酸、安全套` 带偏。
   - 新品牌若有其它大类，先增加分类函数和 OCR prompt，再同步 cleaner 默认规格。
4. 参数字段
   - 保留 `材质 / 面料材质 / 材料` → `材质`。
   - 保留 `品名 / 商品名 / 商品名称 / 产品名称 / 医疗器械名称` → `品名`。
   - 保留 `品牌、产地、生产企业、分类`。
5. 如果新品牌仍走当前前端/数据库链路，确认 `products.competitor_id`、`products.link`、`recommender_toys.original_id`、`recommender_toys.brand` 都正确写入。

### 当前字段来源约定

- `name`: 优先 cleaner 从参数区 `品名` 规范化，否则用列表标题；为空跳过。
- `brand`: cleaner 固定写入当前品牌名，并关联/创建 `competitors`。
- `price`: `crawler.ts` 输出数字；默认在详情页阶段提取，不依赖列表页价格 OCR。
- `sourceUrl`: 详情阶段从列表页点击商品卡片/图片后的最终 URL，可能包含 `pisk`。
- `listUrl`: 列表 DOM 原始 `a.href`，只做追踪，不作为最终跳转优先级。
- `rawDescription`: 合并 `[参数信息]` 和 `[图文提取]`，供 cleaner 分类、规格和材质解析。
- `tags/function_tags`: cleaner 从 `rawDescription` 的技术卖点、核心卖点、使用特性、动力规格等字段本地抽取，再合并模型标签和默认标签。
- `detailImageUrls`: 控制台需要输出详情图片地址，便于人工确认图文来源。

### 新品牌目录的最小验收标准

- 能从列表页收集商品卡片。
- 能进入详情页并输出最终落地 `sourceUrl`。
- 能抓到价格、详情图 URL、`rawDescription`。
- 能至少输出一类可用参数信息（如材质/品牌/品名/分类）。
- 能写入 `review-buffer` 并执行 `cleaner`。
- 能把 `sourceUrl` 写到 `products.link`。
- 能把品牌名写到 `recommender_toys.brand`。
- `npx tsc --noEmit` 通过。

### 默认复用策略

- `param-extraction.ts` 和 `tmall-param-ui.ts` 能共用时，优先复制后轻改，不要重写一套新解析器。
- 新品牌若也是天猫，优先保留：
  - 紧凑文本参数提取
  - 列表点击拿 `pisk`
  - OCR 分类模板分流
  - buffer 逐条落盘
  - cleaner 入库映射

### 新品牌输出交付格式

当使用这个 skill 生成新品牌目录时，最终应至少汇报：

- 新增/修改了哪些文件
- 新品牌入口命令是什么
- 当前站点的价格来源、参数来源、图文来源分别是什么
- 是否还存在 cookie / 风控 / OCR / 选择器 风险点

## 参数抓取的当前结论

- 新版天猫这条商品页的参数不一定在传统 DOM 表格里。
- 已验证可用的补救链路是 `extractParamPairsFromCompactText()`：
  它直接解析 `document.body.innerText` 中被压成一串的 `参数信息硅胶材质品牌大人糖...` 这类文本。
- 参数归一时，`材质 / 面料材质 / 材料` 会统一输出为 `材质`。
- 参数归一时，`品名 / 商品名 / 商品名称 / 产品名称 / 医疗器械名称` 会统一输出为 `品名`。
- 当前白名单输出顺序固定为：
  `材质、品牌、产地、生产企业、分类、品名`

## 图文 OCR 分类模板

- `TOY`: 默认个人护理器具/玩具类，提取材质、动力规格、防水、电源和技术卖点。
- `APPAREL`: 内衣、内裤、网纱、蕾丝、睡裙、制服等服饰类，提取面料、套装构成、款式结构、尺码颜色。
- `CARE`: 避孕套、润滑液、护理液、清洁用品等耗材类，提取类型、材质/成分、规格、使用特性。
- `PAD`: 床事垫、房事垫、防水垫、隔水垫、护理垫、床品垫等床品防护垫类，提取材质结构、规格尺寸、防水防渗、可水洗/便携等特性。

## 列表页结构兼容

- 旧版天猫搜索页：优先识别 `.J_TItems dl.item`。
- 新版天猫店铺首页货架流：识别 `.product_shelf`、`[class*="ProductShelf"]`、`[class*="product_shelf"]` 下的 `[class*="cardContainer"]`。
- 货架流详情链接可能在点击时才动态拼接，不能只保存 DOM 里的 `a.href`；`sourceUrl` 必须以点击后的最终详情页 URL 为准。
- 小怪兽店铺首页已验证为货架流，滚动到底约 35 个商品，并出现 `没有更多商品`。

## 列表结构探测与加载策略

接入新品牌时，先按下面顺序做“结构探测”，不要一上来就只写某一种选择器。

### 第一步：判断列表结构

优先检查这 4 个信号：

- `legacyCardCount = document.querySelectorAll('.J_TItems dl.item').length`
- `shelfCardCount = document.querySelectorAll('.product_shelf [class*="cardContainer"], [class*="ProductShelf"] [class*="cardContainer"], [class*="product_shelf"] [class*="cardContainer"]').length`
- 页面标题是否像 `店内搜索页-xxx旗舰店-天猫Tmall.com` / `默认宝贝分类页-xxx旗舰店-天猫Tmall.com`
- 页面正文里是否出现 `没有更多商品`

判断规则：

- `legacyCardCount > 0`：按旧版 `.J_TItems dl.item` 处理
- `legacyCardCount = 0 && shelfCardCount > 0`：按新版货架流处理
- 两者都为 `0`：优先怀疑登录页、风控页、cookie 失效，先不要改解析器

### 第二步：判断加载方式

旧版列表通常是“分页加载”，新版货架流通常是“滚动加载”，但不要靠 URL 想当然，要实际看 DOM 行为。

优先这样判断：

- 如果页面底部存在明确的 `下一页` 链接，并且点击 / 提取 `href` 后页码递增：按分页处理
- 如果没有可靠的 `下一页`，但滚动后 `cardCount` 会继续增长：按滚动加载处理
- 如果两者都存在，先以真实增长的那一套为准，不要双开，避免重复抓取

### 第三步：分页页标准处理

分页页默认走下面这套：

- 首先抓当前页 `.J_TItems dl.item`
- 抓完原始卡片后，先过滤 `购物金 / 会员充值 / 储值卡 / 充值卡 / 礼品卡 / 店铺权益` 这类伪商品卡片
- 抓完后滚到底，等待懒加载图片稳定
- 再读取 `下一页` 按钮 / 链接
- 校验下页页码必须递增，避免回环
- 如果按钮不存在、被禁用、或页码不递增，就停止

适用站点：

- `wangyichunfeng`
- `zuiqingfeng`
- `tenga`
- `iroha`

### 第四步：货架流标准处理

货架流默认走下面这套：

- 先统计当前 `cardContainer` 数量
- 做分段滚动，不要只 `scrollTo(bottom)`
- 每轮记录：
  - 当前卡片数
  - 当前 `scrollHeight`
  - 是否出现 `没有更多商品`
- 只有在“卡片数和页面高度连续稳定多轮”或明确出现 `没有更多商品` 时才停止
- 后续打开详情页时，如果要定位较靠后的卡片，先再次展开货架流，再按 `domIndex` 点击

适用站点：

- `xiaoguaishou`
- `kistoy`

### 第五步：浏览器模拟建议

这一步在“新品牌目录生成”任务里默认必须执行，不需要等待用户额外要求。

当用户要求“模拟一下列表结构”时，至少输出这些信息：

- `legacyCardCount`
- `shelfCardCount`
- 页面当前 URL 和标题
- 是否命中登录页 / 风控页
- 前 5 到 10 个商品标题样本
- 标题样本里如果出现 `购物金 / 储值卡 / 充值卡 / 礼品卡 / 店铺权益`，要明确标记为“伪商品项”
- 如果是货架流，再补每轮滚动后的 `cardCount`

这样就能快速回答：

- 它到底是旧版列表还是货架流
- 是下一页翻页还是滚动加载
- 为什么当前只抓到一部分商品

### 第六步：生成新品牌时的默认动作

如果是新品牌目录脚手架：

- 默认先跑一次浏览器列表结构探测，再开始复制目录和替换常量
- 先保留两套选择器，不要先删
- 用浏览器模拟确认站点结构后，再决定是否偏向某一类
- 旧版类目页：优先沿用 `tenga` / `zuiqingfeng` 模式
- 货架流首页：优先沿用 `kistoy` / `xiaoguaishou` 模式
- 无论哪一类，都保留“回到列表页点击商品卡片拿最终 `sourceUrl`”的逻辑

## 常用命令

```bash
# 全量爬取
npm run scrape:darentang
npm run scrape:iroha
npm run scrape:kistoy
npm run scrape:tenga
npm run scrape:wevibe
npm run scrape:xiaoguaishou
npm run scrape:wangyichunfeng
npm run scrape:zuiqingfeng

# 只验证某个详情页的参数链路
npm run debug:param-chain
npm run debug:param-chain:iroha -- "https://detail.tmall.com/item.htm?id=..."
npm run debug:param-chain:kistoy -- "https://detail.tmall.com/item.htm?id=..."
npm run debug:param-chain:tenga -- "https://detail.tmall.com/item.htm?id=..."
npm run debug:param-chain:wevibe -- "https://detail.tmall.com/item.htm?id=..."
npm run debug:param-chain -- "https://detail.tmall.com/item.htm?id=..."
npm run debug:param-chain:xiaoguaishou -- "https://detail.tmall.com/item.htm?id=..."
npm run debug:param-chain:wangyichunfeng -- "https://detail.tmall.com/item.htm?id=..."
npm run debug:param-chain:zuiqingfeng -- "https://detail.tmall.com/item.htm?id=..."

# 类型检查
npx tsc --noEmit
```

## 已生成品牌目录

- `src/scraper/darentang`: 大人糖天猫，入口 `npm run scrape:darentang`，数据文件 `src/data/review-buffer.json` / `src/data/cleaned-data.json`。
- `src/scraper/iroha`: iroha 天猫，入口 `npm run scrape:iroha`，列表地址 `https://iroha.tmall.com/category.htm?spm=a1z10.5-b.w4010-21702348873.2.4a874d3bC8PQpn&search=y`，当前是旧版 `.J_TItems dl.item` 类目页，实测首屏约 `29` 个商品、无新版货架流，列表里混有少量纯 TENGA 标题，抓取时会按标题过滤，仅保留 `iroha` 商品，数据文件 `src/data/iroha-review-buffer.json` / `src/data/iroha-cleaned-data.json`，价格默认在详情页阶段提取。
- `src/scraper/kistoy`: KISTOY 天猫，入口 `npm run scrape:kistoy`，列表地址 `https://kistoymcza.tmall.com/?ali_refid=a3_420434_1006:1678346645:H:bL%2B27NllkKafytJVcGaGdg%3D%3D:c0c3f3b80c2af2600c8c6706a30b8540&ali_trackid=282_c0c3f3b80c2af2600c8c6706a30b8540&spm=a21n57.1.2.1&pisk=ggcEhcq297ms8OKmuqVyQZ7gSEVLm7-XTbZ7r40uRkq3A44uacmWJkgkv0lzj4HBJ8tdzwhZ0_1Bvp3la7NkcnOXG2pLw7xbSjiWOMUu8_A7rubg9zwpfFs6G23L2wSklAAXaJ7ne_Xuq0VgjrUzZyX3xGYazrruZk2ljO40juVoqu2Gjz4AtgVuENYaylquZ7moSFz7juVuZ00Mr22bUnz7KeSWEq5ewkwUm2qNiVGa-oWK8lWNIfu_Lofbb_fo_y0oiZzltIridYcQsXxGD50xCD4agQ7z7xugtyoJM6FnoVDuLbJ5kuHZSxwZBwTL7XuqaryFjer-ODlzpjxf6kDZ6bPICH5b28Ds9-hBj6PmH2NIEcYlZukgrgJG2PxB7bHFqTy3WPrX7FkjV1gnIjXJATB8pMzaceDleTe3LPrX7FWReJdT7oTnE&mm_sceneid=1_0_2216650157_0`，当前首页是新版 `ProductShelf/cardContainer` 货架流，实测滚动后约 `63` 个商品，并已过滤会员充值类非商品卡片，数据文件 `src/data/kistoy-review-buffer.json` / `src/data/kistoy-cleaned-data.json`，价格缓存 `src/data/kistoy-list-price-cache.json`。
- `src/scraper/tenga`: TENGA 天猫，入口 `npm run scrape:tenga`，列表地址 `https://tenga.tmall.com/category.htm?spm=a1z10.1-b-s.w5001-25428877010.3.8dda25318B3Mvr&search=y&scene=taobao_shop`，当前是旧版 `.J_TItems dl.item` 类目页，实测首屏约 `70` 个商品、无新版货架流，支持店内列表点击回详情页拿最终 `sourceUrl`，数据文件 `src/data/tenga-review-buffer.json` / `src/data/tenga-cleaned-data.json`，价格缓存 `src/data/tenga-list-price-cache.json`。
- `src/scraper/wevibe`: We-Vibe 天猫，入口 `npm run scrape:wevibe`，列表地址 `https://wevibe.tmall.com/shop/view_shop.htm?appUid=RAzN8HWVJY3cGGRW7oQJ5Jen61ZqJNhhYB7arxnco2VeZeVeofh&spm=a21n57.1.hoverItem.1`，当前首页是新版 `ProductShelf/cardContainer` 货架流，实测首屏约 `18` 个商品，页面已直接出现 `没有更多商品`，商品池包含女性向、男性向和伴侣共用款，数据文件 `src/data/wevibe-review-buffer.json` / `src/data/wevibe-cleaned-data.json`，价格默认在详情页阶段提取。
- `src/scraper/xiaoguaishou`: 小怪兽天猫，入口 `npm run scrape:xiaoguaishou`，列表地址 `https://xiaoguaishou.tmall.com/shop/view_shop.htm?appUid=RAzN8HWNuv49Lh1ynGgZvWJQwrYsuoBnCj1DnZKDSJGqWWNt187&spm=a21n57.1.hoverItem.2`，当前是新版 `ProductShelf/cardContainer` 货架流，滚动到底约 35 个商品，数据文件 `src/data/xiaoguaishou-review-buffer.json` / `src/data/xiaoguaishou-cleaned-data.json`，价格缓存 `src/data/xiaoguaishou-list-price-cache.json`。
- `src/scraper/wangyichunfeng`: 网易春风天猫，入口 `npm run scrape:wangyichunfeng`，列表地址 `https://wangyichunfeng.tmall.com/search.htm?spm=a1z10.5-b.w5842-25615141197.2.854c33496fxx1i&search=y`，当前是旧版 `.J_TItems dl.item` 搜索页，实测首屏 8 个主商品、1 页结果，点击商品卡片后会补出带 `pisk` 的详情 URL，数据文件 `src/data/wangyichunfeng-review-buffer.json` / `src/data/wangyichunfeng-cleaned-data.json`，价格缓存 `src/data/wangyichunfeng-list-price-cache.json`。
- `src/scraper/zuiqingfeng`: 醉清风-谜姬天猫，入口 `npm run scrape:zuiqingfeng`，列表地址 `https://zuiqingfeng.tmall.com/category.htm?spm=a1z10.5-b-s.w4011-14956746985.1.52c11a13kjTwIT`，当前是旧版 `.J_TItems dl.item` 类目页，实测主列表首屏约 `68` 个商品、分页状态 `1/40`，页面下方还有“本店内推荐”，抓取时只取主列表区，数据文件 `src/data/zuiqingfeng-review-buffer.json` / `src/data/zuiqingfeng-cleaned-data.json`，价格缓存 `src/data/zuiqingfeng-list-price-cache.json`。

## 环境变量

- `TMALL_COOKIE`: 高优先级必需，过期会掉登录页或风控页
- `DARENTANG_MAX_ITEMS`: 本次最多进入详情并入库的商品数，默认 `200`
- `IROHA_MAX_ITEMS`: iroha 本次最多进入详情并入库的商品数，默认 `200`
- `KISTOY_MAX_ITEMS`: KISTOY 本次最多进入详情并入库的商品数，默认 `200`
- `WEVIBE_MAX_ITEMS`: We-Vibe 本次最多进入详情并入库的商品数，默认 `200`
- `TENGA_MAX_ITEMS`: TENGA 本次最多进入详情并入库的商品数，默认 `200`
- `XIAOGUAISHOU_MAX_ITEMS`: 小怪兽本次最多进入详情并入库的商品数，默认 `200`
- `WANGYICHUNFENG_MAX_ITEMS`: 网易春风本次最多进入详情并入库的商品数，默认 `200`
- `ZUIQINGFENG_MAX_ITEMS`: 醉清风-谜姬本次最多进入详情并入库的商品数，默认 `200`
- `GLM_API_KEY`: 详情图文主识别
- `QWEN_API_KEY`: GLM 失败时兜底
- `DEEPSEEK_API_KEY`: 图片不足时的文本整理兜底

新品牌生成时，把 `DARENTANG_MAX_ITEMS` 改成 `<BRAND_UPPER>_MAX_ITEMS`，不要多个品牌共用一个最大数量变量。

## 排错顺序

1. 参数为空时，先跑 `npm run debug:param-chain`。
2. 如果 `紧凑文本参数候选` 大于 0，优先检查 `normalizeParamKey()` 或白名单顺序。
3. 如果图文失败但参数有值，优先看图片 URL 是否抓到，以及 `orchestrateOCR()` 的 API key。
4. 如果详情页直接落登录/验证码，先更新 `TMALL_COOKIE`，不要先改解析器。
5. 如果 cleaner 报 `Connection terminated unexpectedly`，通常是 AI 等待期间 Postgres/PgBouncer 关闭了空闲连接；优先给写库阶段加连接健康检查和瞬断重试，不要重新跑 OCR。

## 修改约定

- 凡是传给 `page.evaluate()` / `frame.evaluate()` 的函数，默认按“浏览器内自包含”处理，不要依赖外层 Node 作用域。
- 需要复用、且可在 Node 侧调用的逻辑，优先放在 `param-extraction.ts` 并导出纯函数。
- 新增调试入口时，复制 `debug-param-chain.ts` 的 Cookie/context 初始化方式，并把命令写回本 skill。
- 新建品牌目录时，优先复制成熟链路后做减法，不要从零开始散写到别的目录。
- 新建品牌如果仍是天猫，不要删除 `debug-param-chain.ts`，后续定位参数链路会非常依赖它。
- 新建品牌目录后，要把该品牌的入口文件、命令、站点特性同步补回这个 skill，保证下次调用 skill 时能直接复用。

## 需要更细排错时

看 [reference.md](reference.md)。
