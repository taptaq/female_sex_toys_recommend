import assert from "node:assert/strict";
import test from "node:test";

import {
  buildXiaoguaishouDeviceSpecAndFeaturePatch,
  shouldRunXiaoguaishouDeviceSpecRefreshScript,
} from "./refresh-xiaoguaishou-device-specs-and-features.ts";

const BASE_ROW = {
  id: "toy-1",
  original_id: "product-1",
  name: "小怪兽派对魔吻吮吸跳蛋",
  safe_display_name: null,
  price: "199.00",
  max_db: 60,
  waterproof: null,
  appearance: "normal",
  physical_form: "external",
  motor_type: "gentle",
  gender: "female",
  brand: "小怪兽",
  material: "硅胶",
  image_url: null,
  raw_description: "可充电吮吸玩具，多档震动，支持 APP 远程遥控。",
  type_code: "suction",
  subtype_code: "suction_clitoral",
  product_tags: ["吮吸", "远程遥控"],
  product_raw_description: null,
};

test("buildXiaoguaishouDeviceSpecAndFeaturePatch overwrites powered specs and features", () => {
  const patch = buildXiaoguaishouDeviceSpecAndFeaturePatch(BASE_ROW);

  assert.equal(patch.reason, "powered");
  assert.equal(patch.max_db, 50);
  assert.equal(patch.waterproof, 7);
  assert.equal(patch.recommendation_features.featureVersion, "recommendation-product-features-v1");
  assert.equal(patch.recommendation_features.isSuctionLike, true);
  assert.equal(patch.recommendation_features.supportsAppOrRemote, true);
});

test("buildXiaoguaishouDeviceSpecAndFeaturePatch uses explicit dB and IPX values", () => {
  const patch = buildXiaoguaishouDeviceSpecAndFeaturePatch({
    ...BASE_ROW,
    raw_description: "可充电震动器，噪音约 42dB，IPX6 防水。",
    max_db: null,
    waterproof: 7,
  });

  assert.equal(patch.reason, "powered");
  assert.equal(patch.max_db, 42);
  assert.equal(patch.waterproof, 6);
});

test("buildXiaoguaishouDeviceSpecAndFeaturePatch nulls non-powered stale specs but still rebuilds features", () => {
  const patch = buildXiaoguaishouDeviceSpecAndFeaturePatch({
    ...BASE_ROW,
    name: "小怪兽润滑液护理套装",
    raw_description: "人体润滑液，水基配方，亲肤易清洗。",
    type_code: "care_accessory",
    subtype_code: "lubricant",
    product_tags: [],
    max_db: 50,
    waterproof: 7,
  });

  assert.equal(patch.reason, "non_powered");
  assert.equal(patch.max_db, null);
  assert.equal(patch.waterproof, null);
  assert.equal(patch.recommendation_features.featureVersion, "recommendation-product-features-v1");
  assert.equal(patch.recommendation_features.isSuctionLike, false);
  assert.equal(patch.recommendation_features.isInsertableLike, false);
});

test("shouldRunXiaoguaishouDeviceSpecRefreshScript matches direct execution only", () => {
  assert.equal(
    shouldRunXiaoguaishouDeviceSpecRefreshScript(
      "file:///tmp/script.ts",
      "/tmp/script.ts",
    ),
    true,
  );
  assert.equal(
    shouldRunXiaoguaishouDeviceSpecRefreshScript(
      "file:///tmp/script.ts",
      "/tmp/other.ts",
    ),
    false,
  );
  assert.equal(shouldRunXiaoguaishouDeviceSpecRefreshScript("file:///tmp/script.ts"), false);
});
