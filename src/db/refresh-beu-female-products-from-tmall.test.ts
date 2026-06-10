import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBeuFemaleProductPatch,
  buildBeuInsertCandidateRow,
  canonicalizeTmallItemUrlForBeu,
  dedupeBeuListItemsByItemId,
  extractTmallItemIdForBeu,
  isBeuInsertableToyListTitle,
  isBeuToyListTitle,
  resolveBeuManualLoginWaitMs,
  shouldProcessOnlyMissingBeuProducts,
  shouldInsertMissingBeuProducts,
  shouldWaitForManualBeuLogin,
  type BeuDetailFields,
  type BeuFemaleTargetRow,
} from "./refresh-beu-female-products-from-tmall.ts";

const ROW: BeuFemaleTargetRow = {
  id: "toy-1",
  original_id: "product-1",
  name: "cc机吮吸",
  brand: "beu",
  price: "339.00",
  material: "旧材质",
  gender: "female",
  physical_form: "external",
  motor_type: "gentle",
  appearance: "normal",
  image_url: null,
  raw_description: "旧描述",
  type_code: "unknown",
  subtype_code: null,
  recommendation_features: null,
  link: "https://detail.tmall.com/item.htm?id=901129510090&pisk=abc",
  product_link: "https://detail.tmall.com/item.htm?id=901129510090&pisk=abc",
  product_name: "beU必遇CC机",
  product_price: "339.00",
  product_tags: ["旧标签"],
  product_image: null,
};

const DETAIL: BeuDetailFields = {
  itemId: "901129510090",
  finalUrl: "https://detail.tmall.com/item.htm?id=901129510090",
  listTitle: "beU必遇CC机吮吸私密按摩器女用玩具",
  price: 329,
  imageUrl: "https://img.alicdn.com/example.jpg",
  rawDescription:
    "[参数信息]\n材质: 医用硅胶+ABS\n品牌: beU必遇\n品名: beU必遇CC机\n\n[图文提取]\n产品名称/型号：beU必遇口爱按摩器\n材质/面料/成分：医用硅胶+ABS\n产品类型与使用方式：口爱按摩器，私密按摩，微入体顶翘\n动力规格：强力吮吸、4D柔软按摩头、震动、无级变速\n防水等级：IPX7防水\n噪音分贝：50分贝\n核心卖点：边吸边揉 私密按摩",
};

test("extractTmallItemIdForBeu reads ids from Tmall links", () => {
  assert.equal(extractTmallItemIdForBeu("https://detail.tmall.com/item.htm?spm=x&id=123456789&pisk=y"), "123456789");
  assert.equal(extractTmallItemIdForBeu("//detail.tmall.com/item.htm?id=987654321"), "987654321");
  assert.equal(extractTmallItemIdForBeu(""), "");
});

test("canonicalizeTmallItemUrlForBeu normalizes item links", () => {
  assert.equal(
    canonicalizeTmallItemUrlForBeu("https://detail.tmall.com/item.htm?abbucket=11&id=123456789&pisk=y"),
    "https://detail.tmall.com/item.htm?id=123456789",
  );
  assert.equal(canonicalizeTmallItemUrlForBeu("https://example.com/no-id"), "https://example.com/no-id");
});

test("isBeuToyListTitle keeps toy products and filters non-toy shop cards", () => {
  assert.equal(isBeuToyListTitle("beU必遇小羽毛遥控跳蛋女用穿戴玩具"), true);
  assert.equal(isBeuToyListTitle("beU必遇CC机吮吸私密按摩器"), true);
  assert.equal(isBeuToyListTitle("beU必遇小白盒日抛头囤货装 吮吸头替换头跳蛋静音女用不插入高潮"), true);
  assert.equal(isBeuToyListTitle("beU必遇水基润滑液 玻尿酸护理"), false);
  assert.equal(isBeuToyListTitle("beU必遇蕾丝情趣内衣睡衣"), false);
  assert.equal(isBeuToyListTitle("会员购物金 储值卡"), false);
});

test("isBeuInsertableToyListTitle excludes replacement heads while allowing new toy devices", () => {
  assert.equal(isBeuInsertableToyListTitle("beU必遇小白盒日抛头囤货装 吮吸头替换头跳蛋静音女用不插入高潮"), false);
  assert.equal(isBeuInsertableToyListTitle("beU必遇哒哒棒av棒震动棒按摩成人玩具女性情趣玩具女生自慰神器"), true);
  assert.equal(isBeuInsertableToyListTitle("beU必遇推拉球跳蛋遥控成人情趣用品玩具入体震动女性双人共用"), true);
});

test("shouldWaitForManualBeuLogin enables visible manual verification from cli or env", () => {
  assert.equal(shouldWaitForManualBeuLogin(["--wait-login"], {}), true);
  assert.equal(shouldWaitForManualBeuLogin([], { BEU_REFRESH_WAIT_FOR_LOGIN: "true" }), true);
  assert.equal(shouldWaitForManualBeuLogin([], { BEU_REFRESH_WAIT_FOR_LOGIN: "1" }), true);
  assert.equal(shouldWaitForManualBeuLogin([], {}), false);
});

test("shouldInsertMissingBeuProducts enables insertion only from cli or env", () => {
  assert.equal(shouldInsertMissingBeuProducts(["--insert-missing"], {}), true);
  assert.equal(shouldInsertMissingBeuProducts([], { BEU_INSERT_MISSING: "true" }), true);
  assert.equal(shouldInsertMissingBeuProducts([], { BEU_INSERT_MISSING: "1" }), true);
  assert.equal(shouldInsertMissingBeuProducts([], {}), false);
});

test("shouldProcessOnlyMissingBeuProducts enables skipping existing refreshes", () => {
  assert.equal(shouldProcessOnlyMissingBeuProducts(["--missing-only"], {}), true);
  assert.equal(shouldProcessOnlyMissingBeuProducts([], { BEU_MISSING_ONLY: "true" }), true);
  assert.equal(shouldProcessOnlyMissingBeuProducts([], {}), false);
});

test("resolveBeuManualLoginWaitMs uses positive configured value and otherwise falls back", () => {
  assert.equal(resolveBeuManualLoginWaitMs({ BEU_REFRESH_LOGIN_WAIT_MS: "45000" }), 45000);
  assert.equal(resolveBeuManualLoginWaitMs({ BEU_REFRESH_LOGIN_WAIT_MS: "0" }), 120000);
  assert.equal(resolveBeuManualLoginWaitMs({ BEU_REFRESH_LOGIN_WAIT_MS: "abc" }), 120000);
});

test("buildBeuFemaleProductPatch refreshes fields while preserving female table name", () => {
  const patch = buildBeuFemaleProductPatch(ROW, DETAIL);

  assert.equal(patch.id, ROW.id);
  assert.equal(patch.name, "cc机吮吸");
  assert.equal(patch.name, ROW.name);
  assert.equal(patch.price, 329);
  assert.equal(patch.rawDescription, DETAIL.rawDescription);
  assert.equal(patch.material, "医用硅胶+ABS");
  assert.equal(patch.gender, "female");
  assert.equal(patch.typeCode, "dual_stimulation");
  assert.equal(patch.subtypeCode, "suction_dual");
  assert.equal(patch.physicalForm, "composite");
  assert.equal(patch.maxDb, 50);
  assert.equal(patch.waterproof, 7);
  assert.equal(patch.link, DETAIL.finalUrl);
  assert.equal(patch.imageUrl, DETAIL.imageUrl);
  assert.equal(patch.recommendationFeatures.featureVersion, "recommendation-product-features-v1");
});

test("buildBeuFemaleProductPatch treats beu 点点棒 as insertable vibrator, not suction", () => {
  const row: BeuFemaleTargetRow = {
    ...ROW,
    id: "toy-2",
    name: "点点棒",
    link: "https://detail.tmall.com/item.htm?id=915109624716",
    product_link: "https://detail.tmall.com/item.htm?id=915109624716",
    product_name: "beU必遇点点棒",
  };
  const detail: BeuDetailFields = {
    itemId: "915109624716",
    finalUrl: "https://detail.tmall.com/item.htm?id=915109624716",
    listTitle: "beU必遇点点棒震动棒炮机女生玩具器具情趣用品成人女性入体玩具",
    price: 179,
    imageUrl: "https://img.alicdn.com/diandian.jpg",
    rawDescription:
      "[参数信息]\n材质: 控制类型 手动\n品牌: beU必遇\n品名: 点点棒\n\n[图文提取]\n产品类型与使用方式：女性情趣用品（震动棒）；体内使用，支持吸盘吸附使用\n动力规格：震动、电动\n防水等级：未提及\n噪音分贝：未提及\n核心卖点：直戳G点高潮更激烈、顶部可弯折灵活入体",
  };

  const patch = buildBeuFemaleProductPatch(row, detail);

  assert.equal(patch.typeCode, "insertable");
  assert.equal(patch.subtypeCode, "insertable_vibe");
  assert.equal(patch.physicalForm, "internal");
  assert.equal(patch.maxDb, 50);
  assert.equal(patch.waterproof, 7);
});

test("buildBeuFemaleProductPatch treats beu PP棒肛塞 as insertable vibe, not wearable remote", () => {
  const row: BeuFemaleTargetRow = {
    ...ROW,
    id: "toy-3",
    name: "beU必遇PP棒肛塞震动棒自慰情趣成人女性情趣用品后庭开发玩具",
    link: "https://detail.tmall.com/item.htm?id=1056215079625",
    product_link: "https://detail.tmall.com/item.htm?id=1056215079625",
    product_name: "beU必遇PP棒",
  };
  const detail: BeuDetailFields = {
    itemId: "1056215079625",
    finalUrl: "https://detail.tmall.com/item.htm?id=1056215079625",
    listTitle: row.name,
    price: 199,
    imageUrl: "https://img.alicdn.com/ppbang.jpg",
    rawDescription:
      "[参数信息]\n材质: 硅胶\n品牌: beU必遇\n品名: PP棒\n\n[图文提取]\n产品类型与使用方式：肛塞震动棒，入体使用，后庭开发\n动力规格：震动、电动\n核心卖点：小巧圆润，适合新手\n\n[页面文本]\n其它推荐：小羽毛跳蛋穿戴不入体，小白盒不插入",
  };

  const patch = buildBeuFemaleProductPatch(row, detail);

  assert.equal(patch.typeCode, "insertable");
  assert.equal(patch.subtypeCode, "insertable_vibe");
  assert.equal(patch.physicalForm, "internal");
  assert.equal(patch.maxDb, 50);
  assert.equal(patch.waterproof, 7);
});

test("buildBeuFemaleProductPatch treats beu 嗡嗡蛋 as external bullet vibe, not suction", () => {
  const row: BeuFemaleTargetRow = {
    ...ROW,
    id: "toy-4",
    name: "beU必遇嗡嗡蛋跳蛋器成人玩具女性情趣用品自慰玩具不入体强震",
    link: "https://detail.tmall.com/item.htm?id=693294473370",
    product_link: "https://detail.tmall.com/item.htm?id=693294473370",
    product_name: "beU必遇嗡嗡蛋",
  };
  const detail: BeuDetailFields = {
    itemId: "693294473370",
    finalUrl: "https://detail.tmall.com/item.htm?id=693294473370",
    listTitle: row.name,
    price: 169,
    imageUrl: "https://img.alicdn.com/wengwengdan.jpg",
    rawDescription:
      "[参数信息]\n材质: 硅胶\n品牌: beU必遇\n品名: 嗡嗡蛋\n\n[图文提取]\n产品类型与使用方式：跳蛋器，不入体外部使用\n动力规格：强震、电动\n核心卖点：小巧静音，外部点触刺激",
  };

  const patch = buildBeuFemaleProductPatch(row, detail);

  assert.equal(patch.typeCode, "external_vibe");
  assert.equal(patch.subtypeCode, "bullet_vibe");
  assert.equal(patch.physicalForm, "external");
  assert.equal(patch.maxDb, 50);
  assert.equal(patch.waterproof, 7);
});

test("buildBeuFemaleProductPatch treats beu 小珍贝 necklace egg as external bullet vibe", () => {
  const row: BeuFemaleTargetRow = {
    ...ROW,
    id: "toy-5",
    name: "beU必遇小珍贝项链跳蛋自慰器女震动情趣点潮笔性用品玩具",
    price: null,
    link: "https://detail.tmall.com/item.htm?id=891932811581",
    product_link: "https://detail.tmall.com/item.htm?id=891932811581",
    product_name: "beU必遇小珍贝",
  };
  const detail: BeuDetailFields = {
    itemId: "891932811581",
    finalUrl: "https://detail.tmall.com/item.htm?id=891932811581",
    listTitle: row.name,
    price: 3,
    imageUrl: "https://img.alicdn.com/xiaozhenbei.jpg",
    rawDescription:
      "[参数信息]\n材质: 其他\n品牌: 变频跳蛋\n品名: 小珍贝\n\n[图文提取]\n产品类型与使用方式：项链跳蛋自慰器，C点爽感，指尖掌控\n动力规格：震动，17种模式，超猛小马达\n核心卖点：小巧如珠，震感澎湃",
  };

  const patch = buildBeuFemaleProductPatch(row, detail);

  assert.equal(patch.price, null);
  assert.equal(patch.typeCode, "external_vibe");
  assert.equal(patch.subtypeCode, "bullet_vibe");
  assert.equal(patch.physicalForm, "external");
});

test("buildBeuInsertCandidateRow creates a safe placeholder row for missing list devices", () => {
  const listItem = {
    itemId: "902854583151",
    title: "beU必遇哒哒棒av棒震动棒按摩成人玩具女性情趣玩具女生自慰神器",
    href: "https://detail.tmall.com/item.htm?id=902854583151",
    domIndex: 1,
    imageUrl: "https://img.alicdn.com/dadabang.jpg",
    price: 199,
  };

  const row = buildBeuInsertCandidateRow(listItem);

  assert.equal(row.id, "beu-missing-902854583151");
  assert.equal(row.original_id, null);
  assert.equal(row.name, listItem.title);
  assert.equal(row.brand, "beu");
  assert.equal(row.price, "199");
  assert.equal(row.link, listItem.href);
  assert.equal(row.product_link, listItem.href);
  assert.deepEqual(row.product_tags, ["beu", "tmall", "female"]);
});

test("dedupeBeuListItemsByItemId keeps the first card for repeated shop items", () => {
  const items = [
    {
      itemId: "861956841867",
      title: "推拉球 first",
      href: "https://detail.tmall.com/item.htm?id=861956841867",
      domIndex: 1,
      imageUrl: null,
      price: null,
    },
    {
      itemId: "861956841867",
      title: "推拉球 duplicate",
      href: "https://detail.tmall.com/item.htm?id=861956841867",
      domIndex: 9,
      imageUrl: null,
      price: null,
    },
  ];

  assert.deepEqual(dedupeBeuListItemsByItemId(items), [items[0]]);
});
