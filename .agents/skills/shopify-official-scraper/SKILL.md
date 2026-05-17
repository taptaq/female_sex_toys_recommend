---
name: shopify-official-scraper
description: >-
  Use when creating, extending, or debugging an independent official-site scraper
  for a Shopify storefront in inner_space_toy_recommender, especially when the
  site has collection pages, product pages, products.json or product .js
  endpoints, collection-specific male/female/couples flows, RMB price
  conversion, or noisy product HTML that needs stable detail extraction.
---

# Shopify 独立站抓取 Skill

用于两类任务：

1. 新建一个基于 Shopify 的品牌独立站 scraper
2. 修复现有官方站 scraper 的列表、详情、价格、清洗或入库问题

这条 skill 适合像：

- Hot Octopuss
- Womanizer
- Lovecrave
- Unbound
- Kiiroo 官方站

这类“collection -> product -> cleaner -> 入库”的站点。

## 先看哪些文件

- 轻量 Shopify 独立站参考：
  [src/scraper/unbound-official/crawler.ts](src/scraper/unbound-official/crawler.ts)
  [src/scraper/unbound-official/cleaner.ts](src/scraper/unbound-official/cleaner.ts)
- 价格与 cleaner 参考：
  [src/scraper/lovehoney-official/cleaner.ts](src/scraper/lovehoney-official/cleaner.ts)
  [src/scraper/lovecrave-official/cleaner.ts](src/scraper/lovecrave-official/cleaner.ts)
- 多 collection 顺序跑参考：
  [src/scraper/kiiroo-official/crawler.ts](src/scraper/kiiroo-official/crawler.ts)
- 当前已验证的 Hot Octopuss 模式：
  [src/scraper/hotoctopuss-official/crawler.ts](src/scraper/hotoctopuss-official/crawler.ts)
  [src/scraper/hotoctopuss-official/cleaner.ts](src/scraper/hotoctopuss-official/cleaner.ts)

## 推荐目录结构

如果同一品牌要按男性 / 女性 / 夫妻三个 collection 顺序抓，优先用一个共享目录：

- `src/scraper/<brand>-official/crawler.ts`
- `src/scraper/<brand>-official/cleaner.ts`
- `src/scraper/<brand>-official/crawler.test.ts`
- `src/scraper/<brand>-official/cleaner.test.ts`

不要默认拆成三个完全独立目录，除非三个 collection 的站点结构差异非常大。

## 生成新独立站 scraper 时的默认流程

1. 先探测真实 collection 页结构
2. 再写失败测试
3. 再写 crawler
4. 再写 cleaner
5. 再接 `package.json` 脚本
6. 最后跑真实站点小范围验证

## 真实站点探测时先确认的点

至少确认这几个问题：

- collection 商品区域是不是在固定容器里，例如 `#filter-results`
- 有没有 `.pagination`
- 是否存在 `products.json?limit=250&page=N`
- product 详情是否存在 `/products/<handle>.js`
- 站点默认币种是 `USD / GBP / EUR` 哪一种

如果是 Shopify 站，优先假设这两个接口可用：

- `/collections/<handle>/products.json?limit=250&page=N`
- `/products/<handle>.js`

然后用真实请求验证，不要只猜。

## 列表抓取规则

### 首选策略

优先同时接两路：

1. collection HTML
2. Shopify `products.json`

原因：

- HTML 更接近真实卡片结构，能拿到 collection 专属文案
- `products.json` 更稳定，适合补全分页和规范标题

### 列表去重原则

按 `sourceUrl` 去重。

同一个产品如果：

- HTML 卡片标题更像营销句
- JSON 标题更像正式商品名

则优先保留 JSON 标题。

### collection 级 genderHint

如果用户给的是男性 / 女性 / 夫妻三条 collection：

- male collection -> `male`
- female collection -> `female`
- couples collection -> `unisex`

把这个 hint 带到 buffer，cleaner 再结合正文继续修正。

## 详情抓取规则

### 不要直接吃整页 stripTags(html)

这是最容易把：

- shipping
- warranty
- secure payment
- footer
- app blocks

这类页面噪音混进 `rawDescription` 的地方。

### 优先提取产品详情区块

如果页面有类似：

- `product-details__block`
- `tablist__tab`
- `role="tabpanel"`

就优先定向提取这些详情 panel 的正文。

对于 Hot Octopuss 这类结构，优先抓：

- `Description`
- `Includes`
- `Specifications`

### HTML 与 JSON 详情合并规则

推荐顺序：

1. 先拿 `/products/<handle>.js` 作为稳定底座
2. 再拿 HTML 详情做补充

合并时：

- 标题、图片、描述可以让 HTML 补充
- 价格不要盲信 HTML

## 价格处理规则

### Shopify JSON 价格可能是“分”

`/products/<handle>.js` 里的 variant 价格常见两种：

- `"99.99"`
- `9999`

如果是纯整数且明显大于正常金额，优先按“分 -> 主币金额”处理：

- `9999 -> 99.99`

### 价格合并时做可信度保护

如果 HTML 抓出的价格离谱，比如：

- 极大值
- 负值
- 明显不合理

不要让它覆盖 JSON 的正常价格。

推荐策略：

- 优先保留合理区间的价格
- 不合理价格仅作为降级候选

### 价格转人民币

不要在 crawler 里直接换人民币。

在 cleaner 里做：

- 保存 `price_source_currency`
- 保存 `price_source_amount`
- 用汇率转 `price_rmb`

如果默认币种不是 USD，例如 Hot Octopuss 是 `GBP`，要按真实币种换，不要硬写 USD。

如果源价格已经是人民币：

- `price_source_currency = CNY`
- 或价格标识带 `¥ / ￥`

则不要再次换算人民币。

推荐行为：

- 直接标准化为 `CNY`
- `fx_rate_to_cny = 1`
- `price_rmb = price_source_amount`

## cleaner 规则

### 输出文件

至少这两个：

- `src/data/<brand>-official-review-buffer.json`
- `src/data/<brand>-official-cleaned-data.json`

如果有翻译缓存：

- `src/data/<brand>-official-raw-description-zh-cache.json`

### 入库路径

保持和现有官方站 cleaner 一致：

- `products`
- `recommender_toys`

并带上：

- `type_code`
- `subtype_code`
- `gender`
- `material`
- `price`
- `safe_display_name`

### 数据库写入注意事项

如果 `recommender_toys.price` 是 `Decimal(10,2)`，不要让异常大价格进库。

出现：

- `numeric field overflow`

时，先排查：

1. crawler 的源价格是否错误
2. JSON 价格是否未从“分”转换
3. HTML 价格是否覆盖了合理 JSON 价格

不要先怀疑 Prisma。

## 实时日志建议

默认加这些日志，后续调试非常有用：

- `[male] 开始抓取: <url>`
- `[male] 列表候选 N 条`
- `[male] 详情 i/N: <商品名>`
- `[male] 完成，当前累计 buffer X 条`
- `[crawler] review-buffer 已写入 X 条`
- `[clean] review-buffer 已载入 N 条`
- `[clean] 处理 i/N: <商品名>`
- `[clean] cleaned-data 已写入 X 条`

不要只在报错时打印。

## TDD 建议测试点

至少补这些测试：

1. `#filter-results` 列表提取
2. `products.json` 列表 fallback
3. collection genderHint 映射
4. Shopify 整数价格从“分”转金额
5. HTML 脏价格不会覆盖 JSON 正常价格
6. `product-details__block` / tab panel 优先提取详情正文
7. GBP/EUR/USD -> RMB 转换

## Hot Octopuss 已验证经验

- collection 区域：`#filter-results`
- 分页：`.pagination`
- 列表 fallback：`products.json`
- 详情 fallback：`/products/<handle>.js`
- 币种：`GBP`
- 详情正文不要吃整页 HTML，优先抓 `product-details__block` 下的 tab panels
- `Warranty / Shipping / Secure Payment` 这类词只能在标题/副标题级别做硬拦截，不要拿整段详情正文去判

## 常见坑

### 1. 真实列表有数据，但最终 buffer 是空

优先检查：

- `shouldKeep...Candidate` 是否被详情页噪音误杀
- 详情正文是否混入全站公共文案

### 2. 数据库 numeric overflow

优先检查：

- `.js` 价格单位
- HTML 价格污染
- RMB 换算是否乘错币种

### 3. 商品名和站点不一致

优先检查：

- 是不是用了 HTML 营销标题而不是 Shopify JSON 正式标题

### 4. couples 套装被错分成普通配件

优先检查：

- `product_type`
- JSON 标题
- `categoryHints`

不要只靠 HTML 卡片短文案。
