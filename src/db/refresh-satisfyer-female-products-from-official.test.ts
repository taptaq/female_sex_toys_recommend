import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSatisfyerFemaleRefreshPatch,
  normalizeSatisfyerSourceRows,
  shouldKeepSatisfyerFemaleSourceRow,
  shouldKeepSatisfyerSourceListRow,
  shouldRunSatisfyerFemaleRefreshScript,
} from "./refresh-satisfyer-female-products-from-official.ts";

const BASE_ROW = {
  sourceUrl: "https://www.satisfyer.com/int/satisfyer-pro-2-generation-3",
  name: "Satisfyer Pro 2 Generation 3",
  price: 59.95,
  priceUsd: 59.95,
  priceCurrency: "USD",
  coverImage: "https://www.satisfyer.com/media/image/pro-2.jpg",
  genderHint: "female",
  categoryHints: ["Air Pulse", "For her"],
  rawDescription:
    "[基础信息]\n商品名: Satisfyer Pro 2 Generation 3\n页面价格(USD): 59.95\n站内分类提示: Air Pulse | For her\n性别提示: female\nAPP支持: No\n[规格参数]\nMaterial: Body-safe silicone\nWaterproof: Yes\n[卖点摘要]\nAir pulse clitoral suction stimulator with waterproof silicone body.",
  specs: {
    appearance: "normal",
    physical_form: "external",
    motor_type: "gentle",
    function_tags: ["空气脉冲", "阴蒂刺激", "防水"],
    gender: "female",
    material: "亲肤硅胶",
  },
};

test("shouldKeepSatisfyerFemaleSourceRow keeps female/shared products and rejects male-only rows", () => {
  assert.equal(shouldKeepSatisfyerFemaleSourceRow(BASE_ROW), true);
  assert.equal(
    shouldKeepSatisfyerFemaleSourceRow({
      ...BASE_ROW,
      name: "Satisfyer Men Vibration",
      genderHint: "male",
      categoryHints: ["For him"],
      rawDescription: "[基础信息]\n商品名: Men Vibration\n性别提示: male\nFor him penis masturbator.",
    }),
    false,
  );
  assert.equal(
    shouldKeepSatisfyerFemaleSourceRow({
      ...BASE_ROW,
      name: "Satisfyer Men Vibration+ Connect App",
      sourceUrl: "https://us.satisfyer.com/us/satisfyer-men-vibration-plus-connect-app",
      genderHint: "unisex",
      categoryHints: ["Couple", "Connect App"],
      rawDescription:
        "[基础信息]\n商品名: Satisfyer Men Vibration+ Connect App\n性别提示: unisex\nApp controlled male masturbator and stroker.",
    }),
    false,
  );
  assert.equal(
    shouldKeepSatisfyerFemaleSourceRow({
      ...BASE_ROW,
      name: "Satisfyer Perfect Grip",
      sourceUrl: "https://www.satisfyer.com/int/satisfyer-perfect-grip",
      genderHint: "unisex",
      categoryHints: ["Men", "Partner"],
      rawDescription:
        "[基础信息]\n商品名: Satisfyer Perfect Grip\n页面标题: Male Masturbator\n性别提示: unisex\nSuitable for: Men\nGet a perfect grip on penis pleasure with a grooved masturbator.",
    }),
    false,
  );
  assert.equal(
    shouldKeepSatisfyerFemaleSourceRow({
      ...BASE_ROW,
      name: "Satisfyer Double Joy",
      genderHint: "unisex",
      categoryHints: ["Couple"],
      rawDescription: "[基础信息]\n商品名: Double Joy\n性别提示: unisex\nCouple partner suction toy.",
    }),
    true,
  );
});

test("shouldKeepSatisfyerSourceListRow narrows cleaned rows when source list is vibrators", () => {
  assert.equal(
    shouldKeepSatisfyerSourceListRow(
      {
        ...BASE_ROW,
        name: "Satisfyer Bullet Groove",
        rawDescription: "[基础信息]\n商品名: Bullet Groove\n性别提示: female\nClitoral mini vibrator.",
      },
      "https://us.satisfyer.com/us/products/vibrators",
    ),
    true,
  );
  assert.equal(
    shouldKeepSatisfyerSourceListRow(
      {
        ...BASE_ROW,
        name: "Satisfyer Gentle Classic",
        sourceUrl: "https://us.satisfyer.com/us/satisfyer-gentle-classic",
        categoryHints: ["Intimate Care"],
        rawDescription: "[基础信息]\n商品名: Gentle Classic\n性别提示: female\nWater-based lubricant for intimate care.",
      },
      "https://us.satisfyer.com/us/products/vibrators",
    ),
    false,
  );
});

test("buildSatisfyerFemaleRefreshPatch fills all female_recommender_toys fields for suction products", () => {
  const patch = buildSatisfyerFemaleRefreshPatch(BASE_ROW);

  assert.equal(patch.name, "Satisfyer Pro 2 Generation 3");
  assert.equal(patch.safeDisplayName.length > 0, true);
  assert.equal(patch.price, 406);
  assert.equal(patch.maxDb, 50);
  assert.equal(patch.waterproof, 7);
  assert.equal(patch.appearance, "normal");
  assert.equal(patch.physicalForm, "external");
  assert.equal(patch.motorType, "gentle");
  assert.equal(patch.gender, "female");
  assert.equal(patch.brand, "Satisfyer");
  assert.equal(patch.material, "亲肤硅胶");
  assert.equal(patch.link, BASE_ROW.sourceUrl);
  assert.equal(patch.imageUrl, BASE_ROW.coverImage);
  assert.equal(patch.rawDescription, BASE_ROW.rawDescription);
  assert.equal(patch.typeCode, "suction");
  assert.equal(patch.subtypeCode, "suction_pure");
  assert.equal(patch.recommendationFeatures.featureVersion, "recommendation-product-features-v1");
  assert.ok(
    Array.isArray(patch.recommendationFeatures.evidence) &&
      patch.recommendationFeatures.evidence.some(
        (item: any) => item.signal === "suction" && item.polarity === "positive",
      ),
  );
});

test("buildSatisfyerFemaleRefreshPatch classifies female product families and non-electric care items", () => {
  const rabbit = buildSatisfyerFemaleRefreshPatch({
    ...BASE_ROW,
    name: "Satisfyer Pearl Bunny",
    sourceUrl: "https://www.satisfyer.com/int/satisfyer-pearl-bunny",
    rawDescription:
      "[基础信息]\n商品名: Satisfyer Pearl Bunny\n性别提示: female\nRabbit dual stimulation for G-spot and clitoral pleasure.",
  });
  assert.equal(rabbit.typeCode, "dual_stimulation");
  assert.equal(rabbit.subtypeCode, "rabbit_dual");
  assert.equal(rabbit.physicalForm, "composite");

  const gspot = buildSatisfyerFemaleRefreshPatch({
    ...BASE_ROW,
    name: "Satisfyer G-Spot Wave",
    sourceUrl: "https://www.satisfyer.com/int/satisfyer-g-spot-wave",
    rawDescription:
      "[基础信息]\n商品名: Satisfyer G-Spot Wave\n性别提示: female\nWaterproof insertable G-spot vibrator.",
  });
  assert.equal(gspot.typeCode, "insertable");
  assert.equal(gspot.physicalForm, "internal");

  const menstrualCup = buildSatisfyerFemaleRefreshPatch({
    ...BASE_ROW,
    name: "Feel Secure Menstrual Cup",
    sourceUrl: "https://www.satisfyer.com/int/feel-secure-menstrual-cup",
    price: 14.95,
    priceUsd: 14.95,
    rawDescription:
      "[基础信息]\n商品名: Feel Secure Menstrual Cup\n性别提示: female\nMenstrual cup for intimate care.",
    specs: {
      function_tags: ["护理耗材"],
      gender: "female",
      material: "医用硅胶",
    },
  });
  assert.equal(menstrualCup.typeCode, "care_accessory");
  assert.equal(menstrualCup.subtypeCode, "menstrual_cup");
  assert.equal(menstrualCup.maxDb, 0);
  assert.equal(menstrualCup.waterproof, 0);

  const airPumpBunny = buildSatisfyerFemaleRefreshPatch({
    ...BASE_ROW,
    name: "Satisfyer Air Pump Bunny 1",
    sourceUrl: "https://us.satisfyer.com/us/satisfyer-air-pump-bunny-1",
    rawDescription:
      "[基础信息]\n商品名: Satisfyer Air Pump Bunny 1\n性别提示: female\nAir pump rabbit vibrator with G-spot and clitoral stimulation. Easy to clean after use.",
  });
  assert.equal(airPumpBunny.typeCode, "dual_stimulation");
  assert.equal(airPumpBunny.subtypeCode, "rabbit_dual");
});

test("normalizeSatisfyerSourceRows converts review-buffer USD rows and fills default specs", () => {
  const [row] = normalizeSatisfyerSourceRows([
    {
      sourceUrl: "https://www.satisfyer.com/int/example",
      name: "Example",
      price: 10,
      priceUsd: 10,
      priceCurrency: "USD",
      coverImage: "https://www.satisfyer.com/example.jpg",
      genderHint: "female",
      rawDescription: "Clitoral suction toy.",
    },
  ]);

  assert.equal(row.price, 68);
  assert.equal(row.image, "https://www.satisfyer.com/example.jpg");
  assert.equal(row.specs?.price_rmb, 68);
  assert.equal(row.specs?.material, "亲肤硅胶");
  assert.ok(Array.isArray(row.specs?.function_tags));
});

test("shouldRunSatisfyerFemaleRefreshScript only matches direct execution", () => {
  assert.equal(
    shouldRunSatisfyerFemaleRefreshScript(
      "file:///tmp/refresh-satisfyer-female-products-from-official.ts",
      "/tmp/refresh-satisfyer-female-products-from-official.ts",
    ),
    true,
  );
  assert.equal(
    shouldRunSatisfyerFemaleRefreshScript(
      "file:///tmp/refresh-satisfyer-female-products-from-official.ts",
      "/tmp/other.ts",
    ),
    false,
  );
  assert.equal(shouldRunSatisfyerFemaleRefreshScript("file:///tmp/refresh-satisfyer-female-products-from-official.ts"), false);
});
