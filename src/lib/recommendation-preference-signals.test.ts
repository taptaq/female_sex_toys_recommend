import assert from "node:assert/strict";
import test from "node:test";

import type { AnswerState, Product, QuestionOption } from "../data/mock.ts";
import { questionFlows } from "../data/mock.ts";
import {
  buildRecommendationPreferenceSignals,
  getPreferenceSignalAdjustment,
  getQuestionOptionPreferenceSignals,
} from "./recommendation-preference-signals.ts";

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    name: "Test Product",
    price: 199,
    maxDb: 48,
    waterproof: 7,
    appearance: "normal",
    physicalForm: "external",
    motorType: "gentle",
    gender: "unisex",
    typeCode: "wearable_remote",
    subtypeCode: "dual_wearable_remote",
    brand: "Test Brand",
    material: "硅胶",
    imagePlaceholder: "",
    tags: [],
    rawDescription: null,
    ...overrides,
  };
}

function applyOptionToAnswers(
  field: keyof AnswerState,
  option: QuestionOption,
): AnswerState {
  return {
    tags: [option.tag],
    [field]: option.value,
    ...(option.answerPatch ?? {}),
  } as AnswerState;
}

test("every quiz option maps to at least one scoring or explanation signal", () => {
  for (const [flowName, questions] of Object.entries(questionFlows)) {
    for (const question of questions) {
      for (const option of question.options) {
        const signals = getQuestionOptionPreferenceSignals(question, option);

        assert.ok(
          signals.length > 0,
          `${flowName}/${question.id}/${option.label} should influence matching`,
        );
        assert.ok(
          signals.some((signal) => signal.impacts.includes("score")),
          `${flowName}/${question.id}/${option.label} should influence scoring`,
        );
      }
    }
  }
});

test("selected answer options produce concrete matching signals instead of display-only tags", () => {
  const femaleAnswers: AnswerState = {
    gender: "female",
    physicalForm: "composite",
    experienceLevel: "intense",
    motorType: "strong",
    temperaturePreference: "want",
    appSupportPreference: "required",
    pleasureFocus: "dual",
    maxDb: 40,
    waterproof: 7,
    budget: [300, 10000],
    appearance: "high_disguise",
    tags: [
      "女性向",
      "复合机型",
      "强刺激偏好",
      "内外双刺激",
      "想要温热",
      "需要APP支持",
      "< 40dB",
      "≥ IPX7 防水",
      "旗舰级",
      "高伪装",
    ],
  };

  const signals = buildRecommendationPreferenceSignals(femaleAnswers);

  assert.ok(signals.some((signal) => signal.id === "audience.female"));
  assert.ok(signals.some((signal) => signal.id === "stimulation.composite"));
  assert.ok(signals.some((signal) => signal.id === "intensity.strong"));
  assert.ok(signals.some((signal) => signal.id === "pleasure.dual"));
  assert.ok(signals.some((signal) => signal.id === "temperature.want"));
  assert.ok(signals.some((signal) => signal.id === "app.required"));
  assert.ok(signals.some((signal) => signal.id === "noise.strict"));
  assert.ok(signals.some((signal) => signal.id === "maintenance.easy"));
  assert.ok(signals.some((signal) => signal.id === "budget.premium"));
  assert.ok(signals.some((signal) => signal.id === "privacy.high"));
});

test("pleasure focus rewards products that target the selected body area", () => {
  const clitoralAdjustment = getPreferenceSignalAdjustment(
    makeProduct({
      gender: "female",
      physicalForm: "external",
      typeCode: "suction",
      subtypeCode: "clitoral_suction",
      rawDescription: "阴蒂吸吮刺激，外部空气脉冲反馈。",
    }),
    { pleasureFocus: "clitoral", tags: ["阴蒂刺激"] },
  );
  const gspotAdjustment = getPreferenceSignalAdjustment(
    makeProduct({
      gender: "female",
      physicalForm: "internal",
      typeCode: "insertable",
      subtypeCode: "gspot_insertable",
      rawDescription: "G 点入体震动，适合阴道内探索。",
    }),
    { pleasureFocus: "gspot", tags: ["G点刺激"] },
  );
  const nippleAdjustment = getPreferenceSignalAdjustment(
    makeProduct({
      gender: "female",
      physicalForm: "external",
      typeCode: "dual_stimulation",
      subtypeCode: "multi_head_dual",
      rawDescription: "Gemini nipple clamps for nipple play.",
    }),
    { pleasureFocus: "nipple", tags: ["乳头刺激"] },
  );

  assert.ok(clitoralAdjustment.score > 0);
  assert.match(clitoralAdjustment.summary.join(" "), /阴蒂|外部/);
  assert.ok(gspotAdjustment.score > 0);
  assert.match(gspotAdjustment.summary.join(" "), /G 点|阴道内/);
  assert.ok(nippleAdjustment.score > 0);
  assert.match(nippleAdjustment.summary.join(" "), /乳头|身体表面/);
});

test("balanced options actively reward stable middle-ground products", () => {
  const balancedOption = questionFlows.female
    .find((question) => question.id === "female-experience")
    ?.options.find((option) => option.value === "balanced");
  assert.ok(balancedOption);

  const answers = applyOptionToAnswers("experienceLevel", balancedOption);
  const adjustment = getPreferenceSignalAdjustment(
    makeProduct({
      gender: "female",
      typeCode: "suction",
      subtypeCode: "clitoral_suction",
      price: 229,
      maxDb: 48,
      waterproof: 7,
      rawDescription: "平衡进阶，刺激稳定，适合日常耐玩。",
      tags: ["平衡", "耐玩"],
    }),
    answers,
  );

  assert.ok(adjustment.score > 0);
  assert.match(adjustment.summary.join(" "), /平衡|稳定|耐玩/);
});

test("female-only quiz flow does not expose audience branching", () => {
  assert.deepEqual(Object.keys(questionFlows), ["female"]);
  assert.ok(questionFlows.female.length > 0);
  assert.ok(questionFlows.female.every((question) => question.field !== "gender"));
});

test("temperature preference rewards or relaxes heating signals", () => {
  const heatedAdjustment = getPreferenceSignalAdjustment(
    makeProduct({
      gender: "female",
      rawDescription: "带恒温加热和温热放松体验。",
      tags: ["加热", "温热"],
    }),
    { temperaturePreference: "want", tags: ["想要温热"] },
  );
  const roomTempAdjustment = getPreferenceSignalAdjustment(
    makeProduct({
      gender: "female",
      rawDescription: "基础常温震动体验。",
      tags: ["常温"],
    }),
    { temperaturePreference: "avoid", tags: ["不要加热"] },
  );

  assert.ok(heatedAdjustment.score > 0);
  assert.ok(roomTempAdjustment.score > 0);
  assert.match(heatedAdjustment.summary.join(" "), /温热|放松/);
  assert.match(roomTempAdjustment.summary.join(" "), /常温/);
});

test("app support preference rewards remote products or simple non-app products", () => {
  const remoteProduct = makeProduct({
    gender: "female",
    typeCode: "wearable_remote",
    rawDescription: "支持 APP 蓝牙连接，可远控和异地互动。",
    tags: ["APP", "远控"],
  });
  const simpleProduct = makeProduct({
    gender: "female",
    typeCode: "suction",
    rawDescription: "一键启动，不需要 APP，简单直接。",
    tags: ["简单操作"],
  });

  const requiredAdjustment = getPreferenceSignalAdjustment(remoteProduct, {
    appSupportPreference: "required",
    tags: ["需要APP支持"],
  });
  const avoidRemoteAdjustment = getPreferenceSignalAdjustment(remoteProduct, {
    appSupportPreference: "avoid_app",
    tags: ["不需要APP"],
  });
  const avoidSimpleAdjustment = getPreferenceSignalAdjustment(simpleProduct, {
    appSupportPreference: "avoid_app",
    tags: ["不需要APP"],
  });

  assert.ok(requiredAdjustment.score > 0);
  assert.match(requiredAdjustment.summary.join(" "), /APP|远控|蓝牙/);
  assert.ok(avoidSimpleAdjustment.score > avoidRemoteAdjustment.score);
  assert.match(avoidSimpleAdjustment.summary.join(" "), /不依赖 APP|简单直接/);
});
