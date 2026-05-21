import assert from "node:assert/strict";
import test from "node:test";

import { buildSafeLibraryTypeGapPatch } from "./backfill-safe-library-type-gaps.ts";

test("buildSafeLibraryTypeGapPatch skips jewelry wearables without a dedicated subtype", () => {
  assert.equal(
    buildSafeLibraryTypeGapPatch({
      id: "vesper-2",
      name: "Vesper 2",
      gender: "female",
      physical_form: "external",
      raw_description:
        "维斯珀2号振动器项链延续了亲密与自我表达的传统，愉悦珠宝。",
      current_type_code: "wearable_remote",
      current_subtype_code: null,
      product_tags: ["项链款", "震动刺激", "远控穿戴"],
      product_raw_description: null,
    }),
    null,
  );
});

test("buildSafeLibraryTypeGapPatch keeps clear non-jewelry gaps", () => {
  assert.deepEqual(
    buildSafeLibraryTypeGapPatch({
      id: "arcwave-ghost",
      name: "Arcwave Ghost",
      gender: "male",
      physical_form: "external",
      raw_description:
        "男性硅胶刺激器，配备可反转纹理套筒，无需电池，无需麻烦。",
      current_type_code: "unknown",
      current_subtype_code: null,
      product_tags: [],
      product_raw_description: null,
    }),
    {
      id: "arcwave-ghost",
      name: "Arcwave Ghost",
      typeCode: "masturbator",
      subtypeCode: "manual_masturbator",
      fromTypeCode: "unknown",
      fromSubtypeCode: null,
    },
  );
});

test("buildSafeLibraryTypeGapPatch corrects remote-controlled male strokers misfiled as wearables", () => {
  assert.deepEqual(
    buildSafeLibraryTypeGapPatch({
      id: "pulse-solo-lux",
      name: "PULSE SOLO LUX – Powerful Vibrating Masturbator with Edging Action & Wrist-Remote",
      gender: "male",
      physical_form: "external",
      raw_description:
        "Powerful vibrating masturbator with edging action and wrist-remote control.",
      current_type_code: "wearable_remote",
      current_subtype_code: null,
      product_tags: ["remote", "wearable controller", "vibrating masturbator"],
      product_raw_description: null,
    }),
    {
      id: "pulse-solo-lux",
      name: "PULSE SOLO LUX – Powerful Vibrating Masturbator with Edging Action & Wrist-Remote",
      typeCode: "masturbator",
      subtypeCode: "vibrating_masturbator",
      fromTypeCode: "wearable_remote",
      fromSubtypeCode: null,
    },
  );
});

test("buildSafeLibraryTypeGapPatch allows clear bdsm restraint rows", () => {
  assert.deepEqual(
    buildSafeLibraryTypeGapPatch({
      id: "cuffies",
      name: "Cuffies",
      gender: "female",
      physical_form: "external",
      raw_description:
        "柔性硅胶手铐。柔软、有弹性的身体安全硅胶约束手铐，适合伴侣或单人感官游戏。BDSM 束缚。",
      current_type_code: "unknown",
      current_subtype_code: null,
      product_tags: ["BDSM", "手铐", "束缚"],
      product_raw_description: null,
    }),
    {
      id: "cuffies",
      name: "Cuffies",
      typeCode: "bdsm",
      subtypeCode: "bondage_restraint",
      fromTypeCode: "unknown",
      fromSubtypeCode: null,
    },
  );
});

test("buildSafeLibraryTypeGapPatch still skips mixed bdsm kits", () => {
  assert.equal(
    buildSafeLibraryTypeGapPatch({
      id: "bdsm-kit",
      name: "sm套装道具",
      gender: "female",
      physical_form: "external",
      raw_description:
        "SM套装，包含手铐、脚铐、眼罩、捆绑绳、皮鞭、项圈等20件套。",
      current_type_code: "unknown",
      current_subtype_code: null,
      product_tags: ["BDSM", "套装"],
      product_raw_description: null,
    }),
    null,
  );
});

test("buildSafeLibraryTypeGapPatch skips rows whose only description evidence is empty OCR", () => {
  assert.equal(
    buildSafeLibraryTypeGapPatch({
      id: "hua-yu-jian",
      name: "花与剑",
      gender: "female",
      physical_form: "composite",
      raw_description:
        "[图文提取]\n产品名称/型号：未提及 材质/面料/成分：未提及 产品类型与使用方式：未提及 动力规格，如震动、吮吸、旋转、伸缩、加热、手动/电动：未提及 防水等级、噪音分贝、电源/充电信息：未提及 核心卖点：未提及",
      current_type_code: "dual_stimulation",
      current_subtype_code: null,
      product_tags: ["SM调情", "拍打", "震动", "前戏"],
      product_raw_description:
        "[图文提取]\n产品名称/型号：未提及 材质/面料/成分：未提及 产品类型与使用方式：未提及 动力规格，如震动、吮吸、旋转、伸缩、加热、手动/电动：未提及 防水等级、噪音分贝、电源/充电信息：未提及 核心卖点：未提及",
    }),
    null,
  );
});
