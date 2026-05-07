import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTypeCodeSignals,
  chunkTypeCodeUpdates,
  classifySubtypeCodeBackfillRow,
  collectUniqueOriginalIds,
  classifyTypeCodeBackfillRow,
  hydrateTypeCodeBackfillRows,
  shouldRunTypeCodeBackfillScript,
} from "./backfill-item-type-code.ts";

test("buildTypeCodeSignals combines toy and product text sources", () => {
  const signals = buildTypeCodeSignals({
    id: "toy-1",
    name: "Quiet One",
    gender: "unisex",
    physical_form: "external",
    raw_description: null,
    product_tags: ["情侣", "远控"],
    product_raw_description: "可穿戴设计，适合双人共玩",
  });

  assert.match(signals.rawDescription ?? "", /可穿戴设计/);
  assert.deepEqual(signals.tags, ["情侣", "远控"]);
});

test("classifyTypeCodeBackfillRow uses joined product metadata to detect wearable remote", () => {
  assert.equal(
    classifyTypeCodeBackfillRow({
      id: "toy-2",
      name: "Silent Link",
      gender: "unisex",
      physical_form: "external",
      raw_description: null,
      product_tags: ["远控"],
      product_raw_description: "轻薄可穿戴，适合情侣双人互动",
    }),
    "wearable_remote",
  );
});

test("classifyTypeCodeBackfillRow uses joined product metadata to detect care accessory items", () => {
  assert.equal(
    classifyTypeCodeBackfillRow({
      id: "toy-care-1",
      name: "Water-Based Lubricant 100ml",
      gender: "male",
      physical_form: "external",
      raw_description: null,
      product_tags: ["润滑液", "水基"],
      product_raw_description: "人体润滑液，亲肤易清洗",
    }),
    "care_accessory",
  );
});

test("classifyTypeCodeBackfillRow keeps unmatched rows as unknown", () => {
  assert.equal(
    classifyTypeCodeBackfillRow({
      id: "toy-3",
      name: "Series One",
      gender: "female",
      physical_form: null,
      raw_description: null,
      product_tags: [],
      product_raw_description: null,
    }),
    "unknown",
  );
});

test("classifySubtypeCodeBackfillRow derives subtype codes from joined female product signals", () => {
  assert.equal(
    classifySubtypeCodeBackfillRow({
      id: "toy-sub-1",
      name: "Hyphy 双头振动器",
      gender: "female",
      physical_form: "external",
      raw_description: "适用于阴蒂、G点及乳头的双头高频振动器",
      product_tags: ["阴蒂刺激", "G点刺激", "双头高频"],
      product_raw_description: null,
    }),
    "multi_head_dual",
  );
});

test("classifySubtypeCodeBackfillRow derives vibrating cock ring from joined male metadata", () => {
  assert.equal(
    classifySubtypeCodeBackfillRow({
      id: "toy-sub-2",
      name: "Orbit Ring",
      gender: "male",
      physical_form: "external",
      raw_description: null,
      product_tags: ["震动环", "延时环"],
      product_raw_description: "男用震动锁精环，外部佩戴设计",
    }),
    "vibrating_cock_ring",
  );
});

test("classifySubtypeCodeBackfillRow keeps ambiguous unisex wearable rows as null", () => {
  assert.equal(
    classifySubtypeCodeBackfillRow({
      id: "toy-sub-3",
      name: "Remote Link",
      gender: "unisex",
      physical_form: "external",
      raw_description: null,
      product_tags: ["远控", "穿戴"],
      product_raw_description: "可穿戴远控设计",
    }),
    null,
  );
});

test("classifySubtypeCodeBackfillRow derives condom subtype from joined metadata", () => {
  assert.equal(
    classifySubtypeCodeBackfillRow({
      id: "toy-care-sub-1",
      name: "Super Thin Condom",
      gender: "male",
      physical_form: "external",
      raw_description: null,
      product_tags: ["避孕套", "超薄"],
      product_raw_description: "独立包装安全套",
    }),
    "condom",
  );
});

test("classifyTypeCodeBackfillRow upgrades stale unisex cup rows to masturbator instead of care_accessory", () => {
  assert.equal(
    classifyTypeCodeBackfillRow({
      id: "toy-care-noise-1",
      name: "TENGA HARD CUP一次性男用杯飞机 用品男 夹吸典雅日本进口",
      gender: "unisex",
      physical_form: "external",
      raw_description: "是否含润滑液 是，一次性使用，强烈吸附，螺旋杯身设计",
      product_tags: ["护理耗材", "安全套", "润滑液", "强烈吸附"],
      product_raw_description: null,
    }),
    "masturbator",
  );
});

test("classifySubtypeCodeBackfillRow lets a clear lingerie name beat noisy care tags", () => {
  assert.equal(
    classifySubtypeCodeBackfillRow({
      id: "toy-care-sub-2",
      name: "大人糖「肤间游光」蕾丝镂空交叉性感 连体衣透视免脱内衣",
      gender: "female",
      physical_form: "external",
      raw_description: "分类文案里混有润滑液组合，但本体是蕾丝连体衣",
      product_tags: ["护理耗材", "安全套", "润滑液", "玻尿酸", "抑菌"],
      product_raw_description: null,
    }),
    "lingerie",
  );
});

test("classifyTypeCodeBackfillRow keeps butt plug rows out of care_accessory despite noisy long descriptions", () => {
  assert.equal(
    classifyTypeCodeBackfillRow({
      id: "toy-care-noise-2",
      name: "Lovehoney Jewelled Heart Metal Large Butt Plug 3.5 Inch",
      gender: "female",
      physical_form: "internal",
      raw_description:
        "正文里混有情趣内衣、润滑液与健康用品等导航词，但商品本体是金属肛塞。",
      product_tags: [],
      product_raw_description: null,
    }),
    "unknown",
  );
});

test("classifyTypeCodeBackfillRow recognizes male cup rows despite lubricant mentions in raw copy", () => {
  assert.equal(
    classifyTypeCodeBackfillRow({
      id: "toy-care-noise-3",
      name: "TENGA TOC U.S一次性男用 飞机便捷男软胶杯 用品典雅",
      gender: "male",
      physical_form: "external",
      raw_description: "是否含润滑液 是，真空允吸技术，多层次刺激结构",
      product_tags: ["静音", "便携", "真空允吸技术"],
      product_raw_description: null,
    }),
    "masturbator",
  );
});

test("classifyTypeCodeBackfillRow keeps generic named dual products out of care_accessory despite noisy lingerie tags", () => {
  assert.equal(
    classifyTypeCodeBackfillRow({
      id: "toy-care-noise-4",
      name: "Velvo",
      gender: "female",
      physical_form: "external",
      raw_description:
        "全球首款专利滚珠G点与阴蒂双刺激兔子震动棒，带来强劲的阴蒂与G点按摩。",
      product_tags: ["APP控制", "远程遥控", "双刺激", "滚动珠", "静音", "长距离互动", "防水", "蕾丝"],
      product_raw_description: null,
    }),
    "dual_stimulation",
  );
});

test("classifyTypeCodeBackfillRow keeps suction rows out of care_accessory despite lube-flavored tags", () => {
  assert.equal(
    classifyTypeCodeBackfillRow({
      id: "toy-care-noise-5",
      name: "主角",
      gender: "female",
      physical_form: "internal",
      raw_description: null,
      product_tags: [
        "自动喷出润滑剂（一键出液：140mA电流级蠕动泵）",
        "体外吮吸",
        "8000RPM",
        "附带防尘帽",
        "适合新手",
      ],
      product_raw_description: null,
    }),
    "suction",
  );
});

test("classifyTypeCodeBackfillRow keeps bullet-style products in external_vibe despite noisy catalog tails", () => {
  assert.equal(
    classifyTypeCodeBackfillRow({
      id: "toy-type-noise-1",
      name: "Ambi",
      gender: "female",
      physical_form: "external",
      raw_description:
        "应用程序控制的小巧便携子弹型震动器。后面混入 Nora rabbit vibrator、Mission 2 dildo 等目录词。",
      product_tags: ["APP控制", "远程遥控", "子弹", "便携", "静音"],
      product_raw_description: null,
    }),
    "external_vibe",
  );
});

test("classifyTypeCodeBackfillRow recognizes female panty vibrators as wearable_remote", () => {
  assert.equal(
    classifyTypeCodeBackfillRow({
      id: "toy-type-noise-2",
      name: "Ferri",
      gender: "female",
      physical_form: "external",
      raw_description:
        "磁性应用控制阴蒂内裤震动器，将你的内裤变成震动内裤，支持远程控制。",
      product_tags: ["APP控制", "远程遥控", "穿戴式", "磁吸", "静音"],
      product_raw_description: null,
    }),
    "wearable_remote",
  );
});

test("classifyTypeCodeBackfillRow recognizes dildo-style products as insertable despite noisy long descriptions", () => {
  assert.equal(
    classifyTypeCodeBackfillRow({
      id: "toy-type-noise-3",
      name: "Mission 2",
      gender: "female",
      physical_form: "external",
      raw_description:
        "采用先进触感技术的振动吸盘假阳具，可远程控制。后部混入其他商品目录词。",
      product_tags: ["APP控制", "远程遥控", "静音", "防水"],
      product_raw_description: null,
    }),
    "insertable",
  );
});

test("classifyTypeCodeBackfillRow keeps female anal plug rows as unknown when taxonomy has no dedicated anal bucket", () => {
  assert.equal(
    classifyTypeCodeBackfillRow({
      id: "toy-type-noise-4",
      name: "Hush 2",
      gender: "female",
      physical_form: "external",
      raw_description:
        "应用远程控制振动肛门塞，提供四种尺寸，比较肛门塞。后部混入其他商品目录词。",
      product_tags: ["APP控制", "远程遥控", "振动", "肛塞", "静音"],
      product_raw_description: null,
    }),
    "unknown",
  );
});

test("shouldRunTypeCodeBackfillScript handles tsx file URLs with spaces safely", () => {
  assert.equal(
    shouldRunTypeCodeBackfillScript(
      "file:///Users/test/My%20Project/src/db/backfill-item-type-code.ts",
      "/Users/test/My Project/src/db/backfill-item-type-code.ts",
    ),
    true,
  );
});

test("chunkTypeCodeUpdates splits large updates into stable batches", () => {
  const updates = Array.from({ length: 450 }, (_, index) => ({
    id: `toy-${index + 1}`,
    typeCode: "unknown",
  }));

  assert.deepEqual(
    chunkTypeCodeUpdates(updates, 200).map((batch) => batch.length),
    [200, 200, 50],
  );
});

test("hydrateTypeCodeBackfillRows merges product metadata by original_id", () => {
  assert.deepEqual(
    hydrateTypeCodeBackfillRows(
      [
        {
          id: "toy-1",
          original_id: "product-1",
          name: "Link One",
          gender: "unisex",
          physical_form: "external",
          raw_description: null,
          current_type_code: null,
          current_subtype_code: null,
        },
      ],
      new Map([
        [
          "product-1",
          {
            id: "product-1",
            product_tags: ["远控"],
            product_raw_description: "可穿戴设计",
          },
        ],
      ]),
    ),
    [
      {
        id: "toy-1",
        name: "Link One",
        gender: "unisex",
        physical_form: "external",
        raw_description: null,
        current_type_code: null,
        current_subtype_code: null,
        product_tags: ["远控"],
        product_raw_description: "可穿戴设计",
      },
    ],
  );
});

test("collectUniqueOriginalIds deduplicates non-empty original ids", () => {
  assert.deepEqual(
    collectUniqueOriginalIds([
      {
        id: "toy-1",
        original_id: "product-1",
        name: "A",
        gender: "female",
        physical_form: "external",
        raw_description: null,
        current_type_code: null,
        current_subtype_code: null,
      },
      {
        id: "toy-2",
        original_id: "product-1",
        name: "B",
        gender: "female",
        physical_form: "external",
        raw_description: null,
        current_type_code: null,
        current_subtype_code: null,
      },
      {
        id: "toy-3",
        original_id: null,
        name: "C",
        gender: "female",
        physical_form: "external",
        raw_description: null,
        current_type_code: null,
        current_subtype_code: null,
      },
    ]),
    ["product-1"],
  );
});
