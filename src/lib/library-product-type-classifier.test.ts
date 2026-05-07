import assert from "node:assert/strict";
import test from "node:test";
import * as libraryProductTypeClassifierModule from "./library-product-type-classifier.ts";

import {
  classifyLibrarySubtypeCode,
  classifyLibraryTypeCode,
  resolveLibraryAudienceGender,
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

test("classifyLibraryTypeCode keeps lubricant rows as care_accessory instead of device categories", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "male",
      physicalForm: "external",
      name: "Water-Based Lubricant 100ml",
      rawDescription: "人体润滑液，水基配方，亲肤易清洗",
      tags: ["润滑液", "水基"],
    }),
    "care_accessory",
  );
});

test("classifyLibraryTypeCode keeps condom rows as care_accessory instead of device categories", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "male",
      physicalForm: "external",
      name: "Super Thin Condom",
      rawDescription: "超薄安全套，独立包装",
      tags: ["避孕套", "超薄"],
    }),
    "care_accessory",
  );
});

test("classifyLibraryTypeCode keeps lingerie rows as care_accessory instead of device categories", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "female",
      physicalForm: "external",
      name: "Lace Bodysuit",
      rawDescription: "蕾丝连体内衣，贴身服饰风格",
      tags: ["内衣", "蕾丝"],
    }),
    "care_accessory",
  );
});

test("classifyLibraryTypeCode upgrades stale unisex cup rows to masturbator instead of care_accessory", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "unisex",
      physicalForm: "external",
      name: "TENGA HARD CUP一次性男用杯飞机 用品男 夹吸典雅日本进口",
      rawDescription: "是否含润滑液 是，一次性使用，强烈吸附，螺旋杯身设计",
      tags: ["护理耗材", "安全套", "润滑液", "强烈吸附"],
    }),
    "masturbator",
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

test("classifyLibraryTypeCode does not let lingerie words in noisy long descriptions pull a butt plug into care_accessory", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "female",
      physicalForm: "internal",
      name: "Lovehoney Jewelled Heart Metal Large Butt Plug 3.5 Inch",
      rawDescription:
        "英文正文摘录里混有情趣内衣、润滑液与健康用品等导航词，但商品本体是金属肛塞。",
      tags: [],
    }),
    "unknown",
  );
});

test("classifyLibraryTypeCode recognizes male cup rows as masturbator even when raw copy mentions lubricant", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "male",
      physicalForm: "external",
      name: "TENGA TOC U.S一次性男用 飞机便捷男软胶杯 用品典雅",
      rawDescription: "是否含润滑液 是，真空允吸技术，多层次刺激结构",
      tags: ["静音", "便携", "真空允吸技术"],
    }),
    "masturbator",
  );
});

test("classifyLibraryTypeCode does not let noisy lingerie tags pull generic named device rows into care_accessory", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "female",
      physicalForm: "external",
      name: "Velvo",
      rawDescription:
        "全球首款专利滚珠G点与阴蒂双刺激兔子震动棒，带来强劲的阴蒂与G点按摩。",
      tags: ["APP控制", "远程遥控", "双刺激", "滚动珠", "静音", "长距离互动", "防水", "蕾丝"],
    }),
    "dual_stimulation",
  );
});

test("classifyLibraryTypeCode does not let noisy lube tags pull suction rows into care_accessory", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "female",
      physicalForm: "internal",
      name: "主角",
      rawDescription: null,
      tags: [
        "自动喷出润滑剂（一键出液：140mA电流级蠕动泵）",
        "体外吮吸",
        "8000RPM",
        "附带防尘帽",
        "适合新手",
      ],
    }),
    "suction",
  );
});

test("classifyLibraryTypeCode keeps bullet-style products in external_vibe despite noisy catalog tails", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "female",
      physicalForm: "external",
      name: "Ambi",
      rawDescription:
        "应用程序控制的小巧便携子弹型震动器。后面混入 Nora rabbit vibrator、Mission 2 dildo 等目录词。",
      tags: ["APP控制", "远程遥控", "子弹", "便携", "静音"],
    }),
    "external_vibe",
  );
});

test("classifyLibraryTypeCode trims english catalog tails before classifying bullet products", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "female",
      physicalForm: "external",
      name: "ExomoonBluetooth secret lipstick bullet",
      rawDescription:
        "[基础信息]\n商品名: Exomoon蓝牙口红造型跳蛋\n副标题: 蓝牙口红造型跳蛋\n页面标题: 遥控迷你口红造型跳蛋\n[卖点摘要]\n轻巧小巧\n口红设计\n超强动力\n伪装跳蛋\n[英文正文摘录]\nNora rabbit vibrator Mission 2 dildo Osci 3 rabbit dual",
      tags: ["APP控制", "远程遥控"],
    }),
    "external_vibe",
  );
});

test("classifyLibraryTypeCode recognizes female panty vibrators as wearable_remote", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "female",
      physicalForm: "external",
      name: "Ferri",
      rawDescription:
        "磁性应用控制阴蒂内裤震动器，将你的内裤变成震动内裤，支持远程控制。",
      tags: ["APP控制", "远程遥控", "穿戴式", "磁吸", "静音"],
    }),
    "wearable_remote",
  );
});

test("classifyLibraryTypeCode recognizes dildo-style products as insertable despite noisy long descriptions", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "female",
      physicalForm: "external",
      name: "Mission 2",
      rawDescription:
        "采用先进触感技术的振动吸盘假阳具，可远程控制。后部混入其他商品目录词。",
      tags: ["APP控制", "远程遥控", "静音", "防水"],
    }),
    "insertable",
  );
});

test("classifyLibraryTypeCode keeps female anal plug rows as unknown when taxonomy has no dedicated anal bucket", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "female",
      physicalForm: "external",
      name: "Hush 2",
      rawDescription:
        "应用远程控制振动肛门塞，提供四种尺寸，比较肛门塞。后部混入其他商品目录词。",
      tags: ["APP控制", "远程遥控", "振动", "肛塞", "静音"],
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

test("classifyLibraryTypeCode corrects male-labelled female wand products from explicit product signals", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "male",
      physicalForm: "external",
      name: "AVA",
      rawDescription:
        "商品名: AVA\n副标题: 迷你棒身震动棒\n卖点: 便携棒身，高频震动，适合外部探索。",
      tags: [],
    }),
    "external_vibe",
  );
});

test("classifyLibraryTypeCode corrects male-labelled female dual products from explicit local subtitles", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "male",
      physicalForm: "external",
      name: "ARES",
      rawDescription:
        "商品名: ARES\n副标题: G点双头震动按摩器\n卖点: 双头高频，双区刺激。",
      tags: [],
    }),
    "dual_stimulation",
  );
});

test("classifyLibraryTypeCode recognizes male penis-ring products from explicit ring wording", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "male",
      physicalForm: "external",
      name: "Diamo",
      rawDescription:
        "应用程序控制的振动阴茎环，舒适佩戴，远程控制，适合伴侣互动。",
      tags: ["APP控制", "远程遥控"],
    }),
    "cock_ring",
  );
});

test("classifyLibraryTypeCode keeps male partner-marketed penis devices in male categories instead of lifting them to unisex", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "male",
      physicalForm: "external",
      name: "Gush 2",
      rawDescription:
        "免提，远程控制振动与摆动阴茎按摩器。站内分类提示: 男性性玩具 | 情侣性玩具。伴侣互动时也可使用。",
      tags: ["APP控制", "远程遥控"],
    }),
    "cock_ring",
  );
});

test("classifyLibraryTypeCode recognizes male masturbator rows from generic male masturbator wording", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "male",
      physicalForm: "external",
      name: "Fleshlight Flight Pilot Male",
      rawDescription:
        "Fleshlight Flight Pilot 男性自慰器，轻量杯体，真实通道纹理。",
      tags: [],
    }),
    "masturbator",
  );
});

test("classifyLibraryTypeCode recognizes unisex gift sets with both female and male device signals as couples", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "unisex",
      physicalForm: "external",
      name: "Date Night Set",
      rawDescription:
        "Date Night brings blended orgasms for two with rabbit vibrator Nova 2 and vibrating penis ring Pivot.",
      tags: [],
    }),
    "couples",
  );
});

test("resolveLibraryAudienceGender corrects male-labelled female products from explicit female device signals", () => {
  assert.equal(
    resolveLibraryAudienceGender({
      gender: "male",
      physicalForm: "external",
      name: "Coco",
      rawDescription:
        "分类: 女性\n性别提示: female\n产品定位: 振动棒（FLEXIBLE HEAD VIBRATOR，灵活头部振动）",
      tags: [],
    }),
    "female",
  );
});

test("resolveLibraryAudienceGender keeps male penis-ring products as male", () => {
  assert.equal(
    resolveLibraryAudienceGender({
      gender: "male",
      physicalForm: "external",
      name: "Diamo",
      rawDescription:
        "应用程序控制的振动阴茎环，舒适佩戴，远程控制，适合伴侣互动。",
      tags: ["APP控制", "远程遥控"],
    }),
    "male",
  );
});

test("resolveLibraryAudienceGender keeps male partner-marketed penis devices as male", () => {
  assert.equal(
    resolveLibraryAudienceGender({
      gender: "male",
      physicalForm: "external",
      name: "Gush 2",
      rawDescription:
        "免提，远程控制振动与摆动阴茎按摩器。站内分类提示: 男性性玩具 | 情侣性玩具。伴侣互动时也可使用。",
      tags: ["APP控制", "远程遥控"],
    }),
    "male",
  );
});

test("resolveLibraryAudienceGender treats mixed male and female device bundles as unisex", () => {
  assert.equal(
    resolveLibraryAudienceGender({
      gender: "unisex",
      physicalForm: "external",
      name: "Date Night Set",
      rawDescription:
        "Date Night brings blended orgasms for two with rabbit vibrator Nova 2 and vibrating penis ring Pivot.",
      tags: [],
    }),
    "unisex",
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

test("classifyLibrarySubtypeCode keeps panty vibrators in panty_wearable even if couple copy appears later", () => {
  assert.equal(
    classifyLibrarySubtypeCode({
      typeCode: "wearable_remote",
      gender: "female",
      physicalForm: "external",
      name: "Ferri",
      rawDescription:
        "磁性应用控制阴蒂内裤震动器，将你的内裤变成震动内裤。你和爱人之间零距离。[英文正文摘录] couple toy rabbit vibrator",
      tags: ["APP控制", "远程遥控", "穿戴式", "磁吸", "静音"],
    }),
    "panty_wearable",
  );
});

test("classifyLibrarySubtypeCode recognizes lubricant care subtype", () => {
  assert.equal(
    classifyLibrarySubtypeCode({
      typeCode: "care_accessory",
      gender: "male",
      physicalForm: "external",
      name: "Water-Based Lubricant 100ml",
      rawDescription: "人体润滑液，水基配方，亲肤易清洗",
      tags: ["润滑液", "水基"],
    }),
    "lube_care",
  );
});

test("classifyLibrarySubtypeCode recognizes condom subtype", () => {
  assert.equal(
    classifyLibrarySubtypeCode({
      typeCode: "care_accessory",
      gender: "male",
      physicalForm: "external",
      name: "Super Thin Condom",
      rawDescription: "超薄安全套，独立包装",
      tags: ["避孕套", "超薄"],
    }),
    "condom",
  );
});

test("classifyLibrarySubtypeCode recognizes lingerie subtype", () => {
  assert.equal(
    classifyLibrarySubtypeCode({
      typeCode: "care_accessory",
      gender: "female",
      physicalForm: "external",
      name: "Lace Bodysuit",
      rawDescription: "蕾丝连体内衣，贴身服饰风格",
      tags: ["内衣", "蕾丝"],
    }),
    "lingerie",
  );
});

test("classifyLibrarySubtypeCode lets a clear lingerie name beat noisy lubricant tags", () => {
  assert.equal(
    classifyLibrarySubtypeCode({
      typeCode: "care_accessory",
      gender: "female",
      physicalForm: "external",
      name: "大人糖「肤间游光」蕾丝镂空交叉性感 连体衣透视免脱内衣",
      rawDescription: "分类里混有润滑液与抑菌剂组合，但商品本体是蕾丝连体衣",
      tags: ["护理耗材", "安全套", "润滑液", "玻尿酸", "抑菌"],
    }),
    "lingerie",
  );
});

test("classifyLibrarySubtypeCode lets a clear lubricant name beat condom mentions in long copy", () => {
  assert.equal(
    classifyLibrarySubtypeCode({
      typeCode: "care_accessory",
      gender: "unisex",
      physicalForm: "external",
      name: "Personal Lubricant Jelly/Lotion",
      rawDescription: "个人润滑啫喱/乳液，水性润滑剂。文案后部提到兼容安全套与其他设备。",
      tags: ["护理耗材", "润滑", "清洁护理", "APP控制"],
    }),
    "lube_care",
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

test("isLibraryContaminantInput flags connector-style accessory rows", () => {
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
      name: "Magnetic Connector",
      rawDescription: "用于连接主机与替换头的磁吸连接器配件",
      tags: ["连接器", "配件", "replacement"],
    }),
    true,
  );
});

test("isLibraryContaminantInput flags named accessory rows", () => {
  const classifierModule =
    libraryProductTypeClassifierModule as typeof libraryProductTypeClassifierModule & {
      isLibraryContaminantInput?: (
        input: Parameters<typeof classifyLibraryTypeCode>[0],
      ) => boolean;
    };

  assert.equal(typeof classifierModule.isLibraryContaminantInput, "function");
  assert.equal(
    classifierModule.isLibraryContaminantInput?.({
      gender: "male",
      physicalForm: "external",
      name: "TENGA FLIP 0(ZERO)异次元配件",
      rawDescription: null,
      tags: [],
    }),
    true,
  );
});

test("isLibraryContaminantInput flags compact sex-machine names without tag help", () => {
  const classifierModule =
    libraryProductTypeClassifierModule as typeof libraryProductTypeClassifierModule & {
      isLibraryContaminantInput?: (
        input: Parameters<typeof classifyLibraryTypeCode>[0],
      ) => boolean;
    };

  assert.equal(typeof classifierModule.isLibraryContaminantInput, "function");
  assert.equal(
    classifierModule.isLibraryContaminantInput?.({
      gender: "female",
      physicalForm: "external",
      name: "LovenseSex Machine",
      rawDescription: null,
      tags: [],
    }),
    true,
  );
});

test("isLibraryContaminantInput flags sex-machine rows from description even when the name is generic", () => {
  const classifierModule =
    libraryProductTypeClassifierModule as typeof libraryProductTypeClassifierModule & {
      isLibraryContaminantInput?: (
        input: Parameters<typeof classifyLibraryTypeCode>[0],
      ) => boolean;
    };

  assert.equal(typeof classifierModule.isLibraryContaminantInput, "function");
  assert.equal(
    classifierModule.isLibraryContaminantInput?.({
      gender: "female",
      physicalForm: "external",
      name: "Spinel",
      rawDescription: "应用程序控制、多附件抽插、震动与加热假阳具机器。",
      tags: ["APP控制", "远程遥控"],
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
