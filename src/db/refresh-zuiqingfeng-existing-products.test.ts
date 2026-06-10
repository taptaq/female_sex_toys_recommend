import assert from "node:assert/strict";
import test from "node:test";

import {
  buildZuiqingfengDetailRawDescription,
  buildZuiqingfengExistingProductPatch,
  extractTmallItemIdFromLink,
  getHumanizedDelayMs,
  isDetailLikelyForZuiqingfengTarget,
  isUnavailableTmallItemPage,
  normalizeFetchedPriceForZuiqingfeng,
  parseDelayRange,
  resolveZuiqingfengHumanWaitRanges,
  resolveZuiqingfengWarmupUrl,
  shouldRetryZuiqingfengDetailFailure,
  shouldRunZuiqingfengRefreshScript,
  type ZuiqingfengDetailFields,
  type ZuiqingfengTargetRow,
} from "./refresh-zuiqingfeng-existing-products.ts";

const BASE_ROW: ZuiqingfengTargetRow = {
  table_name: "female_recommender_toys",
  id: "toy-1",
  original_id: "product-1",
  name: "谜姬吮吸伸缩 APP远程遥控强震 女用",
  brand: "醉清风-谜姬",
  price: "199.00",
  material: "亲肤硅胶",
  gender: "female",
  physical_form: "external",
  motor_type: "gentle",
  appearance: "normal",
  image_url: null,
  raw_description: "旧描述",
  type_code: "unknown",
  subtype_code: null,
  recommendation_features: null,
  link: "https://detail.tmall.com/item.htm?id=1040659324032&pisk=abc",
  product_link: "https://detail.tmall.com/item.htm?id=1040659324032&pisk=abc",
  product_name: "旧产品名",
  product_price: "199.00",
  product_tags: ["旧标签"],
  product_image: null,
};

const DETAIL: ZuiqingfengDetailFields = {
  itemId: "1040659324032",
  finalUrl: "https://detail.tmall.com/item.htm?id=1040659324032",
  price: 188.88,
  imageUrl: "https://img.alicdn.com/example.jpg",
  rawDescription:
    "[参数信息]\n材质: 硅胶\n品牌: 谜姬\n产地: 中国大陆\n\n[图文提取]\n2. 内部构造/材质: 亲肤硅胶\n3. 动力规格: 震动、吮吸、伸缩、APP远程遥控\n4. 环境属性: IPX7防水，50分贝\n6. 技术卖点: APP远程控制、强震吮吸",
};

test("extractTmallItemIdFromLink reads ids from normal and protocol-relative links", () => {
  assert.equal(
    extractTmallItemIdFromLink("https://detail.tmall.com/item.htm?spm=x&id=123456789&pisk=y"),
    "123456789",
  );
  assert.equal(
    extractTmallItemIdFromLink("//detail.tmall.com/item.htm?id=987654321"),
    "987654321",
  );
  assert.equal(extractTmallItemIdFromLink(""), "");
});

test("buildZuiqingfengExistingProductPatch overwrites fields from fresh detail but preserves row name", () => {
  const patch = buildZuiqingfengExistingProductPatch(BASE_ROW, DETAIL);

  assert.equal(patch.tableName, "female_recommender_toys");
  assert.equal(patch.id, BASE_ROW.id);
  assert.equal(patch.name, BASE_ROW.name);
  assert.equal(patch.name, "谜姬吮吸伸缩 APP远程遥控强震 女用");
  assert.equal(patch.price, 188.88);
  assert.equal(patch.rawDescription, DETAIL.rawDescription);
  assert.equal(patch.material, "亲肤硅胶");
  assert.equal(patch.gender, "female");
  assert.equal(patch.typeCode, "suction");
  assert.equal(patch.maxDb, 50);
  assert.equal(patch.waterproof, 7);
  assert.equal(patch.link, DETAIL.finalUrl);
  assert.equal(patch.imageUrl, DETAIL.imageUrl);
  assert.equal(patch.recommendationFeatures.featureVersion, "recommendation-product-features-v1");
});

test("buildZuiqingfengExistingProductPatch normalizes care and apparel rows as non-powered", () => {
  const carePatch = buildZuiqingfengExistingProductPatch(
    {
      ...BASE_ROW,
      name: "谜姬鲜芦荟润滑剂液油水基 夫妻免洗",
      gender: "male",
      type_code: "masturbator",
      subtype_code: "vibrating_masturbator",
    },
    {
      ...DETAIL,
      rawDescription: "[参数信息]\n材质: 硅胶\n\n[图文提取]\n产品类型: 润滑液\n材质/成分: 水基配方、芦荟",
    },
  );

  assert.equal(carePatch.gender, "unisex");
  assert.equal(carePatch.typeCode, "care_accessory");
  assert.equal(carePatch.subtypeCode, "lube_care");
  assert.equal(carePatch.material, "水基润滑液");
  assert.equal(carePatch.maxDb, null);
  assert.equal(carePatch.waterproof, null);

  const apparelPatch = buildZuiqingfengExistingProductPatch(
    {
      ...BASE_ROW,
      name: "霏慕蕾丝钢圈连体衣 内衣2026新款性感睡衣",
      material: "硅胶",
      type_code: "suction",
      subtype_code: "suction_dual",
    },
    {
      ...DETAIL,
      rawDescription: "[参数信息]\n材质: 硅胶\n\n[图文提取]\n材质/面料: 锦纶、氨纶、蕾丝\n套装构成: 连体衣",
    },
  );

  assert.equal(apparelPatch.typeCode, "care_accessory");
  assert.equal(apparelPatch.subtypeCode, "lingerie");
  assert.equal(apparelPatch.material, "纺织面料");
  assert.equal(apparelPatch.maxDb, null);
});

test("buildZuiqingfengExistingProductPatch keeps explicit female title signals over mixed male keywords", () => {
  const patch = buildZuiqingfengExistingProductPatch(
    {
      ...BASE_ROW,
      name: "4i穿戴式 内裤四爱女攻用具女性自插 双头龙拉拉 用品",
      gender: "male",
      product_name: "男用双头龙拉拉互动玩具",
    },
    {
      ...DETAIL,
      rawDescription:
        "[参数信息]\n材质: 硅胶\n\n[图文提取]\n产品类型: 双头穿戴式玩具\n使用方式: 女性自插、四爱场景、情侣互动",
    },
  );

  assert.equal(patch.gender, "female");
});

test("buildZuiqingfengExistingProductPatch avoids male-only strong types for explicit female titles", () => {
  const patch = buildZuiqingfengExistingProductPatch(
    {
      ...BASE_ROW,
      name: "伸缩猫爪 外出穿戴远程遥控女生 玩具 用品 神器",
      gender: "female",
    },
    {
      ...DETAIL,
      rawDescription:
        "[参数信息]\n材质: 硅胶\n\n[图文提取]\n产品名称/型号: 伸缩猫爪\n产品类型与使用方式: 外出穿戴远程遥控女生玩具\n动力规格: 伸缩、遥控、震动",
    },
  );

  assert.equal(patch.gender, "female");
  assert.notEqual(patch.typeCode, "cock_ring");
  assert.notEqual(patch.typeCode, "prostate");
  assert.notEqual(patch.typeCode, "masturbator");
});

test("shouldRunZuiqingfengRefreshScript only matches direct execution", () => {
  assert.equal(
    shouldRunZuiqingfengRefreshScript(
      "file:///tmp/refresh-zuiqingfeng-existing-products.ts",
      "/tmp/refresh-zuiqingfeng-existing-products.ts",
    ),
    true,
  );
  assert.equal(
    shouldRunZuiqingfengRefreshScript(
      "file:///tmp/refresh-zuiqingfeng-existing-products.ts",
      "/tmp/other.ts",
    ),
    false,
  );
  assert.equal(shouldRunZuiqingfengRefreshScript("file:///tmp/refresh-zuiqingfeng-existing-products.ts"), false);
});

test("parseDelayRange and getHumanizedDelayMs support randomized humanized waits", () => {
  assert.deepEqual(parseDelayRange("1200:3600", { minMs: 3000, maxMs: 7000 }), { minMs: 1200, maxMs: 3600 });
  assert.deepEqual(parseDelayRange("5000:1000", { minMs: 3000, maxMs: 7000 }), { minMs: 5000, maxMs: 5000 });
  assert.deepEqual(parseDelayRange("bad", { minMs: 3000, maxMs: 7000 }), { minMs: 3000, maxMs: 7000 });

  assert.equal(getHumanizedDelayMs({ minMs: 1200, maxMs: 3600 }, () => 0), 1200);
  assert.equal(getHumanizedDelayMs({ minMs: 1200, maxMs: 3600 }, () => 1), 3600);
  assert.equal(getHumanizedDelayMs({ minMs: 1200, maxMs: 3600 }, () => 0.5), 2400);
});

test("resolveZuiqingfengHumanWaitRanges uses slower human-like defaults and env overrides", () => {
  assert.deepEqual(resolveZuiqingfengHumanWaitRanges({}), {
    detailWaitRange: { minMs: 9000, maxMs: 18000 },
    betweenItemsRange: { minMs: 22000, maxMs: 52000 },
    warmupWaitRange: { minMs: 12000, maxMs: 26000 },
    detailScrollPauseRange: { minMs: 1200, maxMs: 3200 },
    warmupScrollPauseRange: { minMs: 1800, maxMs: 4200 },
  });

  assert.deepEqual(
    resolveZuiqingfengHumanWaitRanges({
      ZUIQINGFENG_REFRESH_DETAIL_WAIT_MS: "1000:2000",
      ZUIQINGFENG_REFRESH_BETWEEN_ITEMS_MS: "3000:4000",
      ZUIQINGFENG_REFRESH_WARMUP_WAIT_MS: "5000:6000",
      ZUIQINGFENG_REFRESH_DETAIL_SCROLL_PAUSE_MS: "700:800",
      ZUIQINGFENG_REFRESH_WARMUP_SCROLL_PAUSE_MS: "900:1000",
    }),
    {
      detailWaitRange: { minMs: 1000, maxMs: 2000 },
      betweenItemsRange: { minMs: 3000, maxMs: 4000 },
      warmupWaitRange: { minMs: 5000, maxMs: 6000 },
      detailScrollPauseRange: { minMs: 700, maxMs: 800 },
      warmupScrollPauseRange: { minMs: 900, maxMs: 1000 },
    },
  );
});

test("resolveZuiqingfengWarmupUrl defaults to the MizzZee shop search page", () => {
  assert.match(resolveZuiqingfengWarmupUrl({}), /^https:\/\/mizzzeegf\.tmall\.com\/search\.htm/);
  assert.equal(resolveZuiqingfengWarmupUrl({ ZUIQINGFENG_WARMUP_URL: "https://example.com/shop" }), "https://example.com/shop");
});

test("shouldRetryZuiqingfengDetailFailure only retries transient detail failures", () => {
  assert.equal(shouldRetryZuiqingfengDetailFailure("详情页疑似登录/风控页面"), true);
  assert.equal(shouldRetryZuiqingfengDetailFailure("no useful detail"), true);
  assert.equal(shouldRetryZuiqingfengDetailFailure("Timeout 60000ms exceeded"), true);
  assert.equal(shouldRetryZuiqingfengDetailFailure("page.goto: Target page, context or browser has been closed"), true);
  assert.equal(shouldRetryZuiqingfengDetailFailure("详情内容与目标商品标题不匹配"), false);
  assert.equal(shouldRetryZuiqingfengDetailFailure("详情页商品不存在或已下架"), false);
});

test("normalizeFetchedPriceForZuiqingfeng ignores implausible page numbers against stored price", () => {
  assert.equal(
    normalizeFetchedPriceForZuiqingfeng("1515", { currentPrice: 49, productPrice: 49, detailPrice: null }),
    49,
  );
  assert.equal(
    normalizeFetchedPriceForZuiqingfeng("6", { currentPrice: 49, productPrice: 49, detailPrice: null }),
    49,
  );
  assert.equal(
    normalizeFetchedPriceForZuiqingfeng("券后 45.9", { currentPrice: 49, productPrice: 49, detailPrice: null }),
    45.9,
  );
});

test("isUnavailableTmallItemPage rejects removed or missing item pages", () => {
  assert.equal(
    isUnavailableTmallItemPage({
      url: "https://error.item.taobao.com/error/noitem?type=noitem&itemid=1037938878986",
      text: "很抱歉，您查看的宝贝不存在，可能已下架或者被转移 猜你喜欢",
    }),
    true,
  );
  assert.equal(
    isUnavailableTmallItemPage({
      url: "https://detail.tmall.com/item.htm?id=1040659324032",
      text: "产品参数 品牌 谜姬 材质 硅胶 详情图文",
    }),
    false,
  );
});

test("buildZuiqingfengDetailRawDescription keeps product page fallback text when OCR is empty", () => {
  const rawDescription = buildZuiqingfengDetailRawDescription(
    [
      ["产地", "中国大陆"],
      ["品名", "坠爱穿戴仿真阳具裤"],
      ["生产企业", "东莞市慕月科技有限公司"],
    ],
    "",
    [
      "淘宝网首页",
      "已买到的宝贝",
      "参数信息",
      "中国大陆",
      "产地",
      "谜姬",
      "品牌",
      "品名",
      "坠爱穿戴仿真阳具裤",
      "图文详情",
      "4i穿戴式阳具内裤四爱女攻用具女性自插假阴茎双头龙拉拉情趣用品",
      "平台加补后",
      "颜色分类",
      "【坠爱穿戴】质保一年",
      "本店推荐",
      "看了又看",
      "用户评价",
    ].join("\n"),
  );

  assert.match(rawDescription, /品名: 坠爱穿戴仿真阳具裤/);
  assert.match(rawDescription, /\[页面文本\]/);
  assert.match(rawDescription, /4i穿戴式阳具内裤四爱女攻用具女性自插假阴茎双头龙拉拉情趣用品/);
  assert.doesNotMatch(rawDescription, /淘宝网首页|本店推荐|看了又看/);
});

test("isDetailLikelyForZuiqingfengTarget rejects detail params from a different product", () => {
  assert.equal(
    isDetailLikelyForZuiqingfengTarget(
      {
        ...BASE_ROW,
        name: "kisstoy小鲸鱼 海豚外出穿戴无线遥控秒潮女用品女性 性",
        product_name: "kisstoy小鲸鱼跳蛋海豚外出穿戴无线遥控秒潮女用品女性自慰器性",
      },
      "[参数信息]\n品牌: 霏慕\n材质: 梭织布 面料 连体式 款式\n品名: 6909两穿jk套装 货号 6909新",
    ),
    false,
  );

  assert.equal(
    isDetailLikelyForZuiqingfengTarget(
      {
        ...BASE_ROW,
        name: "kisstoy秒潮神器二代 女用品polly三代玩具女性",
        product_name: "kisstoy秒潮神器二代情趣女用品polly三代玩具女性成人阴蒂自慰器",
      },
      "[参数信息]\n生产企业: 东莞市汉玛塑胶模具制品有限公司\n\n[图文提取]\n产品名称/型号：KISSTOY POLLY MAX（POLLY五代、POLLY 5代）",
    ),
    true,
  );

  assert.equal(
    isDetailLikelyForZuiqingfengTarget(
      {
        ...BASE_ROW,
        name: "伸缩猫爪 外出穿戴远程遥控女生 玩具 用品 神器",
        product_name: "伸缩猫爪跳蛋外出穿戴远程遥控女生自慰成人玩具情趣用品高潮神器",
      },
      "[参数信息]\n品名: 羊眼圈\n分类: 肉刺羊眼圈3只装\n\n[图文提取]\n产品名称/型号：羊眼圈锁精环",
    ),
    false,
  );

  assert.equal(
    isDetailLikelyForZuiqingfengTarget(
      {
        ...BASE_ROW,
        name: "伸缩猫爪 外出穿戴远程遥控女生 玩具 用品 神器",
        product_name: "伸缩猫爪跳蛋外出穿戴远程遥控女生自慰成人玩具情趣用品高潮神器",
      },
      "[参数信息]\n品名: 羊眼圈\n分类: 肉刺羊眼圈3只装\n\n[图文提取]\n产品名称/型号：羊眼圈锁精环 材质：SILICA GEL 使用方式：佩戴在阴茎上",
    ),
    false,
  );

  assert.equal(
    isDetailLikelyForZuiqingfengTarget(
      {
        ...BASE_ROW,
        name: "可爱铃铛小猫咪 内衣2026新款性感睡衣纯欲诱惑激情 ny女6961",
        product_name: "可爱铃铛小猫咪 内衣2026新款性感睡衣纯欲诱惑激情 ny女6961",
      },
      "[参数信息]\n品名: 云舒 保修期 12个月\n材质: 否 是否智能操控 硅胶 头部\n\n[图文提取]\n核心卖点：五点触摸发音、智能AI对话、新一代AI技术、智能对话娃娃功能重磅升级",
    ),
    false,
  );

  const maleUrethralDetail =
    "[参数信息]\n品名: 触手锻炼按摩器\n\n[图文提取]\n产品名称/型号：尿道糕潮（锻炼器）\n核心卖点：专攻龟头、马眼按摩棒、男士下体调教、飞机杯";
  assert.equal(
    isDetailLikelyForZuiqingfengTarget(
      {
        ...BASE_ROW,
        name: "女性 女生吮吸玩具舌舔 用品共用夫妻床上助爱工",
        product_name: "女性 女生吮吸玩具舌舔 用品共用夫妻床上助爱工",
      },
      maleUrethralDetail,
    ),
    false,
  );
  assert.equal(
    isDetailLikelyForZuiqingfengTarget(
      {
        ...BASE_ROW,
        name: "霏慕开裆马甲连体衣 内衣2026新款性感睡衣纯欲诱惑 ny女Z212",
        product_name: "霏慕开裆马甲连体衣 内衣2026新款性感睡衣纯欲诱惑 ny女Z212",
      },
      maleUrethralDetail,
    ),
    false,
  );

  assert.equal(
    isDetailLikelyForZuiqingfengTarget(
      {
        ...BASE_ROW,
        name: "谜姬喵喜 萌小兔女性月下兔 女用品远程 玩具",
        product_name: "谜姬喵喜 萌小兔女性月下兔 女用品远程 玩具",
      },
      "[参数信息]\n品牌: 悦己悦爱love礼盒\n\n[图文提取]\n产品名称/型号：醉清风限定浪漫礼盒\n核心卖点：含67张知趣卡牌、礼盒情趣用品套装",
    ),
    false,
  );
});

test("buildZuiqingfengExistingProductPatch classifies enhancement cream as care accessory", () => {
  const patch = buildZuiqingfengExistingProductPatch(
    {
      ...BASE_ROW,
      name: "调情女用品乳房快感激情 增强液女性 奶油色专用欲望",
      material: "亲肤硅胶",
      type_code: "external_vibe",
      subtype_code: "wand_massager",
    },
    {
      ...DETAIL,
      rawDescription:
        "[参数信息]\n品名: 爱威康按摩膏\n分类: 膏30g+情趣跳蛋\n\n[图文提取]\n产品名称/型号：乳香快感爽乳膏\n产品类型与使用方式：乳房快感增强类爽乳膏，乳头按摩\n动力规格：未提及",
    },
  );

  assert.equal(patch.typeCode, "care_accessory");
  assert.equal(patch.subtypeCode, "lube_care");
  assert.equal(patch.material, "护理膏剂");
  assert.equal(patch.maxDb, null);
  assert.equal(patch.waterproof, null);
});
