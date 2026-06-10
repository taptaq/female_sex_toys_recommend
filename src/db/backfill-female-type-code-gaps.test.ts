import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFemaleTypeGapPatch,
  type FemaleTypeGapRow,
} from "./backfill-female-type-code-gaps.ts";

function row(overrides: Partial<FemaleTypeGapRow>): FemaleTypeGapRow {
  return {
    id: "toy-1",
    name: "Sample",
    brand: "Brand",
    gender: "female",
    physical_form: "external",
    raw_description: null,
    current_type_code: "unknown",
    current_subtype_code: null,
    product_name: null,
    product_tags: [],
    product_raw_description: null,
    ...overrides,
  };
}

test("buildFemaleTypeGapPatch skips rows whose only evidence is empty OCR", () => {
  assert.equal(
    buildFemaleTypeGapPatch(
      row({
        name: "小雪人",
        current_type_code: "dual_stimulation",
        raw_description:
          "[图文提取]\n产品名称/型号：未提及 材质/面料/成分：未提及 产品类型与使用方式：未提及 动力规格，如震动、吮吸、旋转、伸缩、加热、手动/电动：未提及 防水等级、噪音分贝、电源/充电信息：未提及 核心卖点：未提及",
      }),
    ),
    null,
  );
});

test("buildFemaleTypeGapPatch fills dual wearable remote subtype from detail text", () => {
  assert.deepEqual(
    buildFemaleTypeGapPatch(
      row({
        id: "wevibe-play-your-way",
        name: "Play Your Way",
        brand: "We-Vibe",
        gender: "unisex",
        current_type_code: "wearable_remote",
        raw_description:
          "Create unforgettable moments together with the Jive 2 & Moxie+ wearable vibrator set, designed for couples. APP support and remote control.",
      }),
    ),
    {
      id: "wevibe-play-your-way",
      name: "Play Your Way",
      brand: "We-Vibe",
      typeCode: "wearable_remote",
      subtypeCode: "dual_wearable_remote",
      fromTypeCode: "wearable_remote",
      fromSubtypeCode: null,
      reason: "fill_missing_subtype",
    },
  );
});

test("buildFemaleTypeGapPatch infers type and subtype for clear external vibrators", () => {
  assert.deepEqual(
    buildFemaleTypeGapPatch(
      row({
        id: "lelo-siri-2",
        name: "SIRI™ 2",
        brand: "LELO",
        raw_description:
          "西瑞™ 2是一款超强防水声音激活振动器，拥有8种受音乐启发的振动模式和一个声音响应模式。",
      }),
    ),
    {
      id: "lelo-siri-2",
      name: "SIRI™ 2",
      brand: "LELO",
      typeCode: "external_vibe",
      subtypeCode: "bullet_vibe",
      fromTypeCode: "unknown",
      fromSubtypeCode: null,
      reason: "infer_type_and_subtype",
    },
  );
});

test("buildFemaleTypeGapPatch ignores packaging storage bag text in product detail tails", () => {
  assert.deepEqual(
    buildFemaleTypeGapPatch(
      row({
        id: "lelo-siri-official",
        name: "SIRI™ 2",
        brand: "LELO",
        raw_description:
          "西瑞™ 2是一款超强防水声音激活振动器，拥有8种受音乐启发的振动模式和一个声音响应模式。内容 西瑞™ 2 USB充电线 缎面收纳袋 保修注册卡 详细使用说明书",
        product_tags: ["震动刺激", "可充电", "防水"],
      }),
    ),
    {
      id: "lelo-siri-official",
      name: "SIRI™ 2",
      brand: "LELO",
      typeCode: "external_vibe",
      subtypeCode: "bullet_vibe",
      fromTypeCode: "unknown",
      fromSubtypeCode: null,
      reason: "infer_type_and_subtype",
    },
  );
});

test("buildFemaleTypeGapPatch infers insertable subtype for ben wa bead products", () => {
  assert.deepEqual(
    buildFemaleTypeGapPatch(
      row({
        id: "lelo-beads-noir",
        name: "LELO Beads™ Noir",
        brand: "LELO",
        raw_description:
          "乐洛黑色珠™ 是乐洛对传统班瓦球的演绎，可随时为您带来令人愉悦的感官享受。珠子尺寸：29毫米。内容物 乐洛黑色珠™ 硅胶束带 缎面收纳袋。",
      }),
    ),
    {
      id: "lelo-beads-noir",
      name: "LELO Beads™ Noir",
      brand: "LELO",
      typeCode: "insertable",
      subtypeCode: "gspot_insertable",
      fromTypeCode: "unknown",
      fromSubtypeCode: null,
      reason: "infer_type_and_subtype",
    },
  );
});

test("buildFemaleTypeGapPatch infers insertable type from fullwidth G point and thrusting details", () => {
  assert.deepEqual(
    buildFemaleTypeGapPatch(
      row({
        id: "stronic-g-punkt",
        name: "STRONIC G | G-Punkt Pulsator",
        brand: "Fun Factory",
        physical_form: "internal",
        raw_description:
          "一切为了Ｇ点。免手持的乐趣：斯特罗尼克Ｇ自行抽插，10种抽插程序，完美成形的尖端，实现理想的Ｇ点刺激。",
        product_tags: ["震动刺激", "可充电"],
      }),
    ),
    {
      id: "stronic-g-punkt",
      name: "STRONIC G | G-Punkt Pulsator",
      brand: "Fun Factory",
      typeCode: "insertable",
      subtypeCode: "insertable_vibe",
      fromTypeCode: "unknown",
      fromSubtypeCode: null,
      reason: "infer_type_and_subtype",
    },
  );
});

test("buildFemaleTypeGapPatch infers couples subtype for Tiani wearable couple vibrators", () => {
  assert.deepEqual(
    buildFemaleTypeGapPatch(
      row({
        id: "lelo-tiani-duo",
        name: "TIANI™ DUO",
        brand: "LELO",
        raw_description:
          "蒂亚尼™ 双人是一款振动情侣振动器，配备两个强力电机，专为那些希望加深身体联系的人设计。内容物 蒂亚尼™ 双人 无线遥控器 USB充电线 缎面收纳袋。",
        product_tags: ["震动刺激", "情侣共玩", "遥控", "可充电"],
      }),
    ),
    {
      id: "lelo-tiani-duo",
      name: "TIANI™ DUO",
      brand: "LELO",
      typeCode: "couples",
      subtypeCode: "insertable_couples",
      fromTypeCode: "unknown",
      fromSubtypeCode: null,
      reason: "infer_type_and_subtype",
    },
  );
});

test("buildFemaleTypeGapPatch treats oral simulator text as external stimulation when no insertable signal exists", () => {
  assert.deepEqual(
    buildFemaleTypeGapPatch(
      row({
        id: "lelo-ora-3",
        name: "ORA™ 3",
        brand: "LELO",
        raw_description:
          "随时随地享受逼真的舔舌动作，使用奥拉™ 3智能口交模拟器。材料：身体安全硅胶。内容物 奥拉™ 3 USB充电线 缎面收纳袋。",
      }),
    ),
    {
      id: "lelo-ora-3",
      name: "ORA™ 3",
      brand: "LELO",
      typeCode: "external_vibe",
      subtypeCode: "bullet_vibe",
      fromTypeCode: "unknown",
      fromSubtypeCode: null,
      reason: "infer_type_and_subtype",
    },
  );
});

test("buildFemaleTypeGapPatch infers care accessory subtype for lingerie rows", () => {
  assert.deepEqual(
    buildFemaleTypeGapPatch(
      row({
        id: "lingerie-1",
        name: "大人糖「星痕」不对称钻链镂空纯欲性感吊带袜超薄百搭哑光连裤袜",
        brand: "大人糖",
        raw_description: "锦纶材质，吊带袜，蕾丝镂空，服饰类商品。",
      }),
    ),
    {
      id: "lingerie-1",
      name: "大人糖「星痕」不对称钻链镂空纯欲性感吊带袜超薄百搭哑光连裤袜",
      brand: "大人糖",
      typeCode: "care_accessory",
      subtypeCode: "lingerie",
      fromTypeCode: "unknown",
      fromSubtypeCode: null,
      reason: "infer_type_and_subtype",
    },
  );
});

test("buildFemaleTypeGapPatch leaves anal plug rows unresolved without a female anal subtype", () => {
  assert.equal(
    buildFemaleTypeGapPatch(
      row({
        name: "Satisfyer Power Plug Connect App",
        raw_description:
          "满足者强力肛塞连接版，男女通用，可进行肛交，兼容满足者连接应用程序。",
      }),
    ),
    null,
  );
});

test("buildFemaleTypeGapPatch fills multi head subtype for clear dual stimulation rows", () => {
  assert.deepEqual(
    buildFemaleTypeGapPatch(
      row({
        id: "tongue-expert",
        name: "Satisfyer Tongue Expert",
        brand: "Satisfyer",
        current_type_code: "dual_stimulation",
        raw_description:
          "舌头专家将流畅的设计与精准的双重刺激相结合，全硅胶舌头带来口交启发动作，弯曲轴身瞄准G点，同时刺激阴蒂与阴道。",
      }),
    ),
    {
      id: "tongue-expert",
      name: "Satisfyer Tongue Expert",
      brand: "Satisfyer",
      typeCode: "dual_stimulation",
      subtypeCode: "multi_head_dual",
      fromTypeCode: "dual_stimulation",
      fromSubtypeCode: null,
      reason: "fill_missing_subtype",
    },
  );
});
