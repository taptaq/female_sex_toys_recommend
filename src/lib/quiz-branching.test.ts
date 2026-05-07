import test from "node:test";
import assert from "node:assert/strict";
import type { AnswerState, Product } from "../data/mock.ts";

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    name: "Test Product",
    price: 199,
    maxDb: 42,
    waterproof: 7,
    appearance: "high_disguise",
    physicalForm: "external",
    motorType: "gentle",
    gender: "unisex",
    brand: "Test Brand",
    material: "Silicone",
    imagePlaceholder: "placeholder.png",
    tags: ["静音", "情侣"],
    ...overrides,
  };
}

test("selectScorePresetId routes female, male, and couple audiences to different presets", async () => {
  const branching = await import("./quiz-branching.ts").catch(() => null);
  assert.ok(branching, "quiz-branching.ts should exist");

  assert.equal(
    branching?.selectScorePresetId({ gender: "female", tags: [] }, []),
    "female",
  );
  assert.equal(
    branching?.selectScorePresetId({ gender: "male", tags: [] }, []),
    "male",
  );
  assert.equal(
    branching?.selectScorePresetId({ gender: "unisex", tags: [] }, []),
    "couple",
  );
});

test("selectScorePresetId still falls back to male when the pool is heavily tenga-like", async () => {
  const branching = await import("./quiz-branching.ts").catch(() => null);
  assert.ok(branching, "quiz-branching.ts should exist");

  const products = [
    makeProduct({ id: "m1", brand: "TENGA", gender: "male" }),
    makeProduct({ id: "m2", brand: "TENGA", gender: "male" }),
    makeProduct({ id: "m3", brand: "iroha", gender: "unisex" }),
  ];

  assert.equal(
    branching?.selectScorePresetId({ tags: [] }, products),
    "male",
  );
});

test("getBranchPreferenceAdjustments gives couple answers a bonus for quiet wearable unisex products", async () => {
  const branching = await import("./quiz-branching.ts").catch(() => null);
  assert.ok(branching, "quiz-branching.ts should exist");

  const answers: AnswerState = {
    gender: "unisex",
    fitPreference: "wearable",
    interactionMode: "sync",
    coupleScene: "quiet",
    sharedIntensity: "gentle",
    appearance: "high_disguise",
    maxDb: 40,
    tags: [],
  };

  const product = makeProduct({
    gender: "unisex",
    physicalForm: "external",
    motorType: "gentle",
    maxDb: 38,
    appearance: "high_disguise",
  });

  const result = branching?.getBranchPreferenceAdjustments(
    product,
    answers,
    "couple",
  );

  assert.ok(result);
  assert.ok(result.score > 0);
  assert.ok(result.summary.length > 0);
});

test("getBranchPreferenceAdjustments treats uncertain female answers as a safer default path", async () => {
  const branching = await import("./quiz-branching.ts").catch(() => null);
  assert.ok(branching, "quiz-branching.ts should exist");

  const answers: AnswerState = {
    gender: "female",
    tags: ["路线待判断", "敏感度待判断", "静音待判断", "预算待判断"],
  };

  const saferProduct = makeProduct({
    id: "safer",
    physicalForm: "external",
    motorType: "gentle",
    maxDb: 42,
    price: 199,
    gender: "female",
  });
  const intenseProduct = makeProduct({
    id: "intense",
    physicalForm: "internal",
    motorType: "strong",
    maxDb: 61,
    price: 399,
    gender: "female",
  });

  const saferResult = branching?.getBranchPreferenceAdjustments(
    saferProduct,
    answers,
    "female",
  );
  const intenseResult = branching?.getBranchPreferenceAdjustments(
    intenseProduct,
    answers,
    "female",
  );

  assert.ok(saferResult);
  assert.ok(intenseResult);
  assert.ok(
    (saferResult?.score ?? 0) > (intenseResult?.score ?? 0),
    "uncertain female answers should prefer safer defaults",
  );
  assert.ok(
    saferResult?.summary.some((line) => /先从外部|温和|静音|性价比/.test(line)),
  );
});

test("getBranchPreferenceAdjustments treats uncertain couple answers as a lower-pressure co-play default", async () => {
  const branching = await import("./quiz-branching.ts").catch(() => null);
  assert.ok(branching, "quiz-branching.ts should exist");

  const answers: AnswerState = {
    gender: "unisex",
    tags: ["互动方式待判断", "使用姿态待判断", "共玩场景待判断", "双方偏好待判断", "收纳待判断"],
  };

  const softerProduct = makeProduct({
    id: "softer",
    gender: "unisex",
    physicalForm: "external",
    motorType: "gentle",
    appearance: "high_disguise",
    maxDb: 44,
  });
  const louderProduct = makeProduct({
    id: "louder",
    gender: "female",
    physicalForm: "composite",
    motorType: "strong",
    appearance: "normal",
    maxDb: 63,
  });

  const softerResult = branching?.getBranchPreferenceAdjustments(
    softerProduct,
    answers,
    "couple",
  );
  const louderResult = branching?.getBranchPreferenceAdjustments(
    louderProduct,
    answers,
    "couple",
  );

  assert.ok(softerResult);
  assert.ok(louderResult);
  assert.ok(
    (softerResult?.score ?? 0) > (louderResult?.score ?? 0),
    "uncertain couple answers should favor lower-pressure co-play defaults",
  );
  assert.ok(
    softerResult?.summary.some((line) => /共玩|贴合|温和|收纳/.test(line)),
  );
});

test("getResultLeadCopy returns branch-specific result intros", async () => {
  const branching = await import("./quiz-branching.ts").catch(() => null);
  assert.ok(branching, "quiz-branching.ts should exist");

  assert.match(
    branching?.getResultLeadCopy({ gender: "female", tags: [] }) ?? "",
    /刺激路径|敏感度/,
  );
  assert.match(
    branching?.getResultLeadCopy({ gender: "male", tags: [] }) ?? "",
    /驱动方式|通道体验/,
  );
  assert.match(
    branching?.getResultLeadCopy({ gender: "unisex", tags: [] }) ?? "",
    /互动方式|共玩/,
  );
});

test("buildBranchFallbackReason returns branch-specific local reasoning", async () => {
  const branching = await import("./quiz-branching.ts").catch(() => null);
  assert.ok(branching, "quiz-branching.ts should exist");

  const product = makeProduct({
    gender: "unisex",
    physicalForm: "external",
    motorType: "gentle",
  });

  assert.match(
    branching?.buildBranchFallbackReason(product, {
      gender: "female",
      experienceLevel: "sensitive",
      tags: [],
    }) ?? "",
    /慢热|温和/,
  );
  assert.match(
    branching?.buildBranchFallbackReason(product, {
      gender: "male",
      sessionGoal: "daily",
      tags: [],
    }) ?? "",
    /日常|顺手/,
  );
  assert.match(
    branching?.buildBranchFallbackReason(product, {
      gender: "unisex",
      interactionMode: "sync",
      tags: [],
    }) ?? "",
    /共玩|互动/,
  );
});

test("branch copy avoids rigid gender-route labels in fallback messaging", async () => {
  const branching = await import("./quiz-branching.ts").catch(() => null);
  assert.ok(branching, "quiz-branching.ts should exist");

  const femaleFallback =
    branching?.buildBranchFallbackReason(
      makeProduct({
        gender: "female",
        physicalForm: "external",
        motorType: "strong",
      }),
      {
        gender: "female",
        tags: [],
      },
    ) ?? "";
  const maleFallback =
    branching?.buildBranchFallbackReason(
      makeProduct({
        gender: "male",
        physicalForm: "internal",
        motorType: "strong",
      }),
      {
        gender: "male",
        tags: [],
      },
    ) ?? "";

  assert.doesNotMatch(femaleFallback, /女性向/);
  assert.doesNotMatch(maleFallback, /男性向/);
});

test("couple branch copy uses scene wording instead of addressing the user group directly", async () => {
  const branching = await import("./quiz-branching.ts").catch(() => null);
  assert.ok(branching, "quiz-branching.ts should exist");

  const leadCopy =
    branching?.getResultLeadCopy({ gender: "unisex", tags: [] }) ?? "";
  const guidanceLead =
    branching?.getBranchShoppingGuidanceLead({ gender: "unisex" }, 2) ?? "";
  const preferenceHints =
    branching?.getBranchShoppingPreferenceHints({
      gender: "unisex",
      maxDb: 45,
      appearance: "high_disguise",
      tags: [],
    }) ?? [];

  assert.doesNotMatch(leadCopy, /你们/);
  assert.doesNotMatch(guidanceLead, /你们/);
  assert.ok(preferenceHints.every((line) => !/你们/.test(line)));
});
