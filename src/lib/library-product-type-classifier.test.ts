import assert from "node:assert/strict";
import test from "node:test";
import * as libraryProductTypeClassifierModule from "./library-product-type-classifier.ts";

import {
  classifyLibrarySubtypeCode,
  classifyLibraryTypeCode,
  resolveLibrarySubtypeCode,
  resolveLibraryTypeCode,
} from "./library-product-type-classifier.ts";

test("classifyLibraryTypeCode recognizes suction products from external female signals", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "female",
      physicalForm: "external",
      name: "Womanizer Liberty",
      rawDescription: "气脉冲吸感，外部刺激设备",
      tags: [],
    }),
    "suction",
  );
});

test("classifyLibraryTypeCode keeps composite female products in dual_stimulation even when suction appears", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "female",
      physicalForm: "composite",
      name: "兔子月",
      rawDescription: "内外刺激同时进行，吮吸口加宽，吮吸4档震动6档",
      tags: ["内外刺激（同时进行）", "吮吸4档震动6档"],
    }),
    "dual_stimulation",
  );
});

test("classifyLibraryTypeCode recognizes rabbit-style products as dual_stimulation before suction", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "female",
      physicalForm: "external",
      name: "Nora",
      rawDescription: "双重刺激，两种独特感受，最具设计感的兔子跳蛋",
      tags: ["双刺激", "旋转"],
    }),
    "dual_stimulation",
  );
});

test("classifyLibraryTypeCode recognizes paired G-spot and clitoral signals as dual_stimulation", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "female",
      physicalForm: "external",
      name: "Hyphy 双头振动器",
      rawDescription: "适用于阴蒂、G点及乳头的双头高频振动器",
      tags: ["阴蒂刺激", "G点刺激", "双头高频"],
    }),
    "dual_stimulation",
  );
});

test("classifyLibraryTypeCode keeps external wand-style products out of insertable when G-spot is only a target mention", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "female",
      physicalForm: "external",
      name: "Glow Wand",
      rawDescription: "外部按摩棒，适合阴蒂、乳头和 G-spot 周边挑逗，强力震动",
      tags: ["按摩棒", "外部刺激"],
    }),
    "external_vibe",
  );
});

test("classifyLibraryTypeCode keeps machine-like female products as unknown instead of forcing dual_stimulation", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "female",
      physicalForm: "external",
      name: "Lovense Sex Machine",
      rawDescription: "机座驱动平台，适配多种配件，可用于 G-spot、阴蒂与乳头刺激",
      tags: ["机座", "平台设备", "配件兼容"],
    }),
    "unknown",
  );
});

test("classifyLibraryTypeCode does not let noisy catalog text override a clear dual-stimulation product", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "female",
      physicalForm: "external",
      name: "Hyphy Remote control dual-ended vibrator",
      rawDescription:
        "双头振动器，适用于阴蒂、G点及乳头。页面尾部还混入了 webcam、USB adapter 和 sex machine 的目录词。",
      tags: ["双头高频", "阴蒂刺激", "G点刺激", "配件可换"],
    }),
    "dual_stimulation",
  );
});

test("classifyLibraryTypeCode recognizes prostate products from male text signals", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "male",
      physicalForm: "internal",
      name: "前列腺按摩器",
      rawDescription: "P-spot 定向刺激",
      tags: [],
    }),
    "prostate",
  );
});

test("classifyLibraryTypeCode recognizes unisex remote wearable products", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "unisex",
      physicalForm: "external",
      name: "情侣远控穿戴器",
      rawDescription: "双人共玩，app 远程控制，可穿戴",
      tags: ["情侣", "远控"],
    }),
    "wearable_remote",
  );
});

test("classifyLibraryTypeCode keeps remote wearable accessories out of wearable_remote", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "unisex",
      physicalForm: "external",
      name: "USB Bluetooth Adapter",
      rawDescription: "用于连接远控穿戴设备与 app 的蓝牙适配器",
      tags: ["远控", "蓝牙", "适配器"],
    }),
    "unknown",
  );
});

test("classifyLibraryTypeCode falls back to unknown when signals are too weak", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "unisex",
      physicalForm: null,
      name: "探索系列",
      rawDescription: null,
      tags: [],
    }),
    "unknown",
  );
});

test("classifyLibraryTypeCode keeps remote-only unisex products out of wearable_remote", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "unisex",
      physicalForm: "external",
      name: "远控震动器",
      rawDescription: "支持 app 远程控制，但不是穿戴式",
      tags: ["远控"],
    }),
    "unknown",
  );
});

test("classifyLibraryTypeCode recognizes male cock rings without leaking from generic wearable text", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "male",
      physicalForm: "external",
      name: "延时环",
      rawDescription: "柔软环体，可穿戴贴合",
      tags: [],
    }),
    "cock_ring",
  );
});

test("classifyLibraryTypeCode does not promote pure clitoral pulse products to dual_stimulation only because vibration is present", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "female",
      physicalForm: "external",
      name: "Satisfyer Pro 1",
      rawDescription: "空气脉冲波和振动刺激阴蒂，双马达压力波振动器",
      tags: ["防水"],
    }),
    "suction",
  );
});

test("classifyLibraryTypeCode promotes clear G-spot and clitoral suction combos to dual_stimulation", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "female",
      physicalForm: "external",
      name: "Lovehoney Indulge G-Spot and Suction Stimulator",
      rawDescription: "G点与阴蒂吮吸刺激器，结合入体快感与外部吸吮体验。",
      tags: ["阴蒂刺激", "G点刺激", "吮吸", "可充电"],
    }),
    "dual_stimulation",
  );
});

test("classifyLibraryTypeCode promotes inside-out style female stimulators to dual_stimulation", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "female",
      physicalForm: "external",
      name: "InsideOut Rechargeable G-Spot and Stimulator",
      rawDescription: "专为 G 点与阴蒂双区刺激设计，兼具外部吸吮与内部探索。",
      tags: ["阴蒂刺激", "G点刺激", "可充电"],
    }),
    "dual_stimulation",
  );
});

test("classifyLibraryTypeCode promotes rabbit-mouth rabbit-ear simultaneous stimulation products to dual_stimulation", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "female",
      physicalForm: "external",
      name: "兔子月 强震 吮吸",
      rawDescription: "声波吮吸、脉冲吮吸、入体强震，兔嘴兔耳同时刺激。",
      tags: ["兔嘴兔耳同时刺激", "声波吮吸", "入体强震"],
    }),
    "dual_stimulation",
  );
});

test("resolveLibraryTypeCode preserves stored type codes when already present", () => {
  assert.equal(
    resolveLibraryTypeCode("insertable", {
      gender: "female",
      physicalForm: "external",
      name: "Womanizer Liberty",
      rawDescription: "气脉冲吸感，外部刺激设备",
      tags: [],
    }),
    "insertable",
  );
});

test("resolveLibraryTypeCode falls back to classifier when stored type code is blank", () => {
  assert.equal(
    resolveLibraryTypeCode(null, {
      gender: "female",
      physicalForm: "external",
      name: "Womanizer Liberty",
      rawDescription: "气脉冲吸感，外部刺激设备",
      tags: [],
    }),
    "suction",
  );
});

test("resolveLibraryTypeCode keeps blank stored female products as unknown when only weak form signals exist", () => {
  assert.equal(
    resolveLibraryTypeCode(null, {
      gender: "female",
      physicalForm: "external",
      name: "Mystery Item",
      rawDescription: null,
      tags: [],
    }),
    "unknown",
  );
});

test("classifyLibrarySubtypeCode recognizes rabbit dual products", () => {
  assert.equal(
    classifyLibrarySubtypeCode({
      gender: "female",
      physicalForm: "external",
      name: "Nora",
      rawDescription: "旋转兔耳双刺激，兼顾 G 点和阴蒂反馈。",
      tags: ["兔耳双刺激", "阴蒂刺激", "G点刺激"],
    }),
    "rabbit_dual",
  );
});

test("classifyLibrarySubtypeCode recognizes multi-head dual products", () => {
  assert.equal(
    classifyLibrarySubtypeCode({
      gender: "female",
      physicalForm: "external",
      name: "Hyphy Remote control dual-ended vibrator",
      rawDescription: "双头高频振动器，适用于阴蒂、G点及乳头。",
      tags: ["双头高频", "阴蒂刺激", "G点刺激"],
    }),
    "multi_head_dual",
  );
});

test("classifyLibrarySubtypeCode ignores rabbit words from noisy catalog tails when the local product signals are clearly dual-head", () => {
  assert.equal(
    classifyLibrarySubtypeCode({
      typeCode: "dual_stimulation",
      gender: "female",
      physicalForm: "external",
      name: "Hyphy Remote control dual-ended vibrator",
      rawDescription:
        "双头高频振动器，适用于阴蒂、G点及乳头。后面混入了 Nora rabbit vibrator 等目录词。",
      tags: ["双头高频", "阴蒂刺激", "G点刺激"],
    }),
    "multi_head_dual",
  );
});

test("classifyLibrarySubtypeCode keeps suction-led dual products in suction_dual even when top-level type is dual_stimulation", () => {
  assert.equal(
    classifyLibrarySubtypeCode({
      typeCode: "dual_stimulation",
      gender: "female",
      physicalForm: "external",
      name: "Lovehoney Indulge G-Spot and Suction Stimulator",
      rawDescription: "G点与阴蒂吮吸刺激器，结合入体快感与外部吸吮体验。",
      tags: ["阴蒂刺激", "G点刺激", "吮吸", "可充电"],
    }),
    "suction_dual",
  );
});

test("classifyLibrarySubtypeCode recognizes wand-style external vibes", () => {
  assert.equal(
    classifyLibrarySubtypeCode({
      gender: "female",
      physicalForm: "external",
      name: "Domi 2",
      rawDescription: "高频魔杖按摩棒，强力外部震动。",
      tags: ["按摩棒", "外部刺激"],
    }),
    "wand_massager",
  );
});

test("classifyLibrarySubtypeCode recognizes interactive male masturbators from app-linked signals", () => {
  assert.equal(
    classifyLibrarySubtypeCode({
      typeCode: "masturbator",
      gender: "male",
      physicalForm: "external",
      name: "Sync Interactive Cup",
      rawDescription: "APP 互动同步，远控联动体验",
      tags: ["互动", "远控", "app"],
    }),
    "interactive_masturbator",
  );
});

test("classifyLibrarySubtypeCode recognizes dual wearable remote products for couples play", () => {
  assert.equal(
    classifyLibrarySubtypeCode({
      typeCode: "wearable_remote",
      gender: "unisex",
      physicalForm: "external",
      name: "Couple Link",
      rawDescription: "情侣双人共玩，远控穿戴设计",
      tags: ["情侣", "双人", "远控", "穿戴"],
    }),
    "dual_wearable_remote",
  );
});

test("classifyLibrarySubtypeCode stays conservative for weak male masturbator evidence", () => {
  assert.equal(
    classifyLibrarySubtypeCode({
      typeCode: "masturbator",
      gender: "male",
      physicalForm: "external",
      name: "Series One",
      rawDescription: null,
      tags: [],
    }),
    null,
  );
});

test("isLibraryContaminantInput flags adapter-style rows", () => {
  const classifierModule =
    libraryProductTypeClassifierModule as typeof libraryProductTypeClassifierModule & {
      isLibraryContaminantInput?: (
        input: Parameters<typeof classifyLibraryTypeCode>[0],
      ) => boolean;
    };

  assert.equal(typeof classifierModule.isLibraryContaminantInput, "function");
  assert.equal(
    classifierModule.isLibraryContaminantInput?.({
      gender: "unisex",
      physicalForm: "external",
      name: "USB Bluetooth Adapter",
      rawDescription: "用于连接远控穿戴设备与 app 的蓝牙适配器",
      tags: ["远控", "蓝牙", "适配器"],
    }),
    true,
  );
});

test("resolveLibrarySubtypeCode falls back to subtype classifier when stored subtype is blank", () => {
  assert.equal(
    resolveLibrarySubtypeCode(null, {
      gender: "female",
      physicalForm: "external",
      name: "Womanizer Liberty",
      rawDescription: "气脉冲吸感，外部刺激设备",
      tags: [],
    }),
    "suction_pure",
  );
});
