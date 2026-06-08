import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFemaleToyDeviceSpecPatch,
  extractMaxDbFromDeviceSpecText,
  extractWaterproofFromDeviceSpecText,
  shouldRunFemaleToyDeviceSpecCleanupScript,
} from "./clean-female-recommender-toy-device-specs.ts";

const BASE_ROW = {
  id: "toy-1",
  original_id: "product-1",
  name: "Quiet Bullet",
  type_code: "external_vibe",
  raw_description: null,
  max_db: null,
  waterproof: null,
  product_tags: [],
  product_raw_description: null,
};

test("extractMaxDbFromDeviceSpecText reads explicit dB values from detail text", () => {
  assert.equal(
    extractMaxDbFromDeviceSpecText("运行噪音低于 42dB，夜间也更安心。"),
    42,
  );
  assert.equal(
    extractMaxDbFromDeviceSpecText("Whisper quiet motor, less than 48 dB."),
    48,
  );
});

test("extractWaterproofFromDeviceSpecText reads explicit IPX waterproof ratings", () => {
  assert.equal(
    extractWaterproofFromDeviceSpecText("整机防水等级 IPX7，可短时浸水。"),
    7,
  );
  assert.equal(
    extractWaterproofFromDeviceSpecText("Waterproof: IPX 8."),
    8,
  );
});

test("buildFemaleToyDeviceSpecPatch fills powered rows from details before defaults", () => {
  assert.deepEqual(
    buildFemaleToyDeviceSpecPatch({
      ...BASE_ROW,
      raw_description: "可充电震动器，噪音约 43dB，IPX6 防水。",
    }),
    {
      max_db: 43,
      waterproof: 6,
      reason: "powered",
    },
  );
});

test("buildFemaleToyDeviceSpecPatch defaults missing powered values to 50 dB and IPX7", () => {
  assert.deepEqual(
    buildFemaleToyDeviceSpecPatch({
      ...BASE_ROW,
      raw_description: "可充电吮吸玩具，多档震动。",
    }),
    {
      max_db: 50,
      waterproof: 7,
      reason: "powered",
    },
  );
});

test("buildFemaleToyDeviceSpecPatch preserves existing powered values and fills only missing fields", () => {
  assert.deepEqual(
    buildFemaleToyDeviceSpecPatch({
      ...BASE_ROW,
      raw_description: "USB rechargeable vibrator with IPX8 waterproof body.",
      max_db: 44,
      waterproof: null,
    }),
    {
      max_db: null,
      waterproof: 8,
      reason: "powered",
    },
  );
});

test("buildFemaleToyDeviceSpecPatch nulls stale specs for non-powered rows", () => {
  assert.deepEqual(
    buildFemaleToyDeviceSpecPatch({
      ...BASE_ROW,
      name: "Glass Dildo",
      type_code: "insertable",
      raw_description: "手工玻璃按摩棒，无震动、无马达、无电池。",
      max_db: 50,
      waterproof: null,
    }),
    {
      max_db: null,
      waterproof: null,
      reason: "non_powered",
    },
  );
});

test("shouldRunFemaleToyDeviceSpecCleanupScript matches direct execution only", () => {
  assert.equal(
    shouldRunFemaleToyDeviceSpecCleanupScript("file:///tmp/script.ts", "/tmp/script.ts"),
    true,
  );
  assert.equal(
    shouldRunFemaleToyDeviceSpecCleanupScript("file:///tmp/script.ts", "/tmp/other.ts"),
    false,
  );
  assert.equal(shouldRunFemaleToyDeviceSpecCleanupScript("file:///tmp/script.ts"), false);
});
