import assert from "node:assert/strict";
import test from "node:test";

import type { AnswerState, Product } from "../data/mock.ts";
import {
  assertRecommendationEvalPasses,
  runRecommendationEvalScenario,
  type RecommendationEvalScenario,
} from "./recommendation-eval.ts";

function makeProduct(overrides: Partial<Product> & Pick<Product, "id" | "name">): Product {
  return {
    id: overrides.id,
    name: overrides.name,
    price: overrides.price ?? 199,
    maxDb: overrides.maxDb ?? 46,
    waterproof: overrides.waterproof ?? 7,
    appearance: overrides.appearance ?? "normal",
    physicalForm: overrides.physicalForm ?? "external",
    motorType: overrides.motorType ?? "gentle",
    gender: overrides.gender ?? "unisex",
    typeCode: overrides.typeCode ?? "wearable_remote",
    subtypeCode: overrides.subtypeCode ?? "dual_wearable_remote",
    brand: overrides.brand ?? "Eval Brand",
    material: overrides.material ?? "硅胶",
    imagePlaceholder: overrides.imagePlaceholder ?? "",
    displayName: overrides.displayName,
    safeDisplayName: overrides.safeDisplayName,
    canonicalName: overrides.canonicalName,
    link: overrides.link,
    sourceUrl: overrides.sourceUrl,
    rawDescription: overrides.rawDescription ?? null,
    tags: overrides.tags ?? [],
    reason: overrides.reason,
    personaAnalysis: overrides.personaAnalysis,
    isDomestic: overrides.isDomestic,
  };
}

const evalProducts: Product[] = [
  makeProduct({
    id: "female-quiet-suction",
    name: "安静外部吮吸器",
    gender: "female",
    typeCode: "suction",
    subtypeCode: "clitoral_suction",
    physicalForm: "external",
    motorType: "gentle",
    price: 229,
    maxDb: 38,
    waterproof: 7,
    rawDescription: "新手友好，低噪静音，外部吮吸刺激，适合慢热进入。",
    tags: ["女性", "吮吸", "静音", "新手"],
  }),
  makeProduct({
    id: "female-strong-suction",
    name: "强吸吮吸器",
    gender: "female",
    typeCode: "suction",
    subtypeCode: "clitoral_suction",
    physicalForm: "external",
    motorType: "strong",
    price: 259,
    maxDb: 46,
    waterproof: 7,
    rawDescription: "外部吮吸器，强吸力，强劲反馈，大吸力路线，模式较少。",
    tags: ["女性", "吮吸", "强吸", "强劲"],
  }),
  makeProduct({
    id: "female-pattern-suction",
    name: "多模式吮吸器",
    gender: "female",
    typeCode: "suction",
    subtypeCode: "clitoral_suction",
    physicalForm: "external",
    motorType: "gentle",
    price: 249,
    maxDb: 44,
    waterproof: 7,
    rawDescription: "外部吮吸器，多模式，多档位，多频率节奏变化，模式丰富。",
    tags: ["女性", "吮吸", "模式多", "多档位", "多频率"],
  }),
  makeProduct({
    id: "female-dual-remote",
    name: "远控复合双刺激",
    gender: "female",
    typeCode: "dual_stimulation",
    subtypeCode: "dual_wearable_remote",
    physicalForm: "composite",
    motorType: "gentle",
    price: 299,
    maxDb: 42,
    waterproof: 7,
    rawDescription: "内外双刺激，APP 远控，可用于女女互动共玩。",
    tags: ["女性", "复合", "远控", "共玩"],
  }),
  makeProduct({
    id: "female-external-vibe",
    name: "外部震动棒",
    gender: "female",
    typeCode: "external_vibe",
    subtypeCode: "wand_vibe",
    physicalForm: "external",
    motorType: "strong",
    price: 239,
    maxDb: 47,
    waterproof: 7,
    rawDescription: "外部震动强劲，模式丰富，但不是吮吸类产品。",
    tags: ["女性", "震动", "强劲", "模式多"],
  }),
  makeProduct({
    id: "male-soft-daily",
    name: "日常柔软互动杯",
    gender: "male",
    typeCode: "masturbator",
    subtypeCode: "manual_masturbator",
    physicalForm: "external",
    motorType: "gentle",
    price: 189,
    maxDb: 45,
    waterproof: 7,
    rawDescription: "柔软包裹，慢玩耐用，易清洗，适合日常释放。",
    tags: ["男用", "柔软", "日常", "易清洗"],
  }),
  makeProduct({
    id: "male-prostate-remote",
    name: "远控前列腺按摩器",
    gender: "male",
    typeCode: "prostate",
    subtypeCode: "prostate_massager",
    physicalForm: "internal",
    motorType: "gentle",
    price: 269,
    maxDb: 44,
    waterproof: 7,
    rawDescription: "男性前列腺按摩，支持遥控互动，适合男男共玩。",
    tags: ["男用", "前列腺", "遥控", "共玩"],
  }),
  makeProduct({
    id: "unisex-ring",
    name: "震动环远控款",
    gender: "unisex",
    typeCode: "cock_ring",
    subtypeCode: "vibrating_cock_ring",
    physicalForm: "external",
    motorType: "gentle",
    price: 159,
    maxDb: 43,
    waterproof: 7,
    rawDescription: "震动环，远控互动，适合异性搭配或男男搭配共玩。",
    tags: ["震动环", "远控", "共玩"],
  }),
  makeProduct({
    id: "care-lube",
    name: "水基润滑液",
    gender: "unisex",
    typeCode: "care_accessory",
    subtypeCode: "lube_care",
    physicalForm: "external",
    motorType: "gentle",
    price: 59,
    maxDb: null,
    waterproof: null,
    rawDescription: "水基润滑液，护理周边，不是玩具设备。",
    tags: ["润滑液", "护理"],
  }),
  makeProduct({
    id: "care-condom",
    name: "安全套组合",
    gender: "unisex",
    typeCode: "care_accessory",
    subtypeCode: "condom_care",
    physicalForm: "external",
    motorType: "gentle",
    price: 39,
    maxDb: null,
    waterproof: null,
    rawDescription: "避孕套组合，护理周边，不是玩具设备。",
    tags: ["避孕套", "护理"],
  }),
];

function scenario(
  id: string,
  answers: AnswerState,
  expectations: RecommendationEvalScenario["expectations"],
): RecommendationEvalScenario {
  return {
    id,
    answers,
    products: evalProducts,
    expectations,
  };
}

const scenarios: RecommendationEvalScenario[] = [
  scenario(
    "female beginner external quiet should pick female toy and block care accessories",
    {
      gender: "female",
      physicalForm: "external",
      experienceLevel: "sensitive",
      motorType: "gentle",
      maxDb: 40,
      waterproof: 7,
      budget: [100, 300],
      tags: ["女性向", "外部震动/吮吸", "温柔慢热", "< 40dB", "≥ IPX7 防水", "进阶级"],
    },
    {
      topCount: 3,
      top1: { gender: "female", typeCodes: ["suction"] },
      forbiddenTypeCodesInTop: ["care_accessory", "masturbator", "prostate"],
      requiredTypeCodesInTop: ["suction"],
    },
  ),
  {
    id: "natural language suction request should prefer suction and block insertable routes",
    answers: {
      gender: "female",
      maxDb: 50,
      tags: ["女性向"],
    },
    context: {
      naturalLanguageQuery: "我是女生，想找一个吮吸感更强一点的，波形更多的，噪音适中的。",
    },
    products: evalProducts,
    expectations: {
      topCount: 3,
      top1: { gender: "female", typeCodes: ["suction"] },
      forbiddenTypeCodesInTop: ["prostate", "masturbator", "external_vibe"],
      requiredTypeCodesInTop: ["suction"],
    },
  },
  {
    id: "natural language stronger suction should rank strong suction above pattern-heavy suction",
    answers: {
      gender: "female",
      maxDb: 50,
      tags: ["女性向"],
    },
    context: {
      naturalLanguageQuery: "我是女生，想要吮吸感更强一点，噪音适中。",
    },
    products: evalProducts,
    expectations: {
      topCount: 3,
      top1: { id: "female-strong-suction", gender: "female", typeCodes: ["suction"] },
      forbiddenTypeCodesInTop: ["external_vibe", "masturbator", "prostate"],
      requiredTypeCodesInTop: ["suction"],
    },
  },
  {
    id: "natural language more patterns should rank pattern-heavy suction above stronger suction",
    answers: {
      gender: "female",
      maxDb: 50,
      tags: ["女性向"],
    },
    context: {
      naturalLanguageQuery: "我是女生，想要波形更多一点的吮吸器，噪音适中。",
    },
    products: evalProducts,
    expectations: {
      topCount: 3,
      top1: { id: "female-pattern-suction", gender: "female", typeCodes: ["suction"] },
      forbiddenTypeCodesInTop: ["external_vibe", "masturbator", "prostate"],
      requiredTypeCodesInTop: ["suction"],
    },
  },
  scenario(
    "male daily soft should not surface female-only or care products",
    {
      gender: "male",
      driveMode: "manual",
      channelFeel: "soft",
      sessionGoal: "daily",
      waterproof: 7,
      budget: [100, 300],
      tags: ["男性向", "手动型", "慢玩柔软", "日常释放", "易清洁优先", "进阶级"],
    },
    {
      topCount: 3,
      top1: { gender: "male", typeCodes: ["masturbator"] },
      forbiddenGendersInTop: ["female"],
      forbiddenTypeCodesInTop: ["care_accessory"],
      requiredTypeCodesInTop: ["masturbator"],
    },
  ),
  scenario(
    "male-male couple route should favor male-compatible co-play",
    {
      gender: "unisex",
      partnerComposition: "male_male",
      interactionMode: "remote",
      fitPreference: "wearable",
      coupleScene: "bedroom",
      sharedIntensity: "gentle",
      tags: ["情侣共玩", "男男搭配", "远控氛围", "稳定贴合", "卧室常用", "温和舒适"],
    },
    {
      topCount: 3,
      top1: { typeCodes: ["prostate", "cock_ring", "wearable_remote"] },
      forbiddenTypeCodesInTop: ["care_accessory", "suction"],
      requiredTypeCodesInTop: ["prostate"],
    },
  ),
  scenario(
    "female-female couple route should favor female-compatible co-play",
    {
      gender: "unisex",
      partnerComposition: "female_female",
      interactionMode: "remote",
      fitPreference: "handheld",
      coupleScene: "playful",
      sharedIntensity: "gentle",
      tags: ["情侣共玩", "女女搭配", "远控氛围", "手持灵活", "氛围尝鲜", "温和舒适"],
    },
    {
      topCount: 3,
      top1: { gender: "female", typeCodes: ["dual_stimulation", "suction", "wearable_remote"] },
      forbiddenTypeCodesInTop: ["care_accessory", "masturbator", "prostate"],
      requiredTypeCodesInTop: ["dual_stimulation"],
    },
  ),
];

test("recommendation eval scenarios pass the current local matching contract", () => {
  const results = scenarios.map(runRecommendationEvalScenario);
  const failures = results.flatMap((result) => result.failures);

  assert.deepEqual(failures, []);
  for (const result of results) {
    assertRecommendationEvalPasses(result);
  }
});
