import test from "node:test";
import assert from "node:assert/strict";

import {
  isObviousNonGearToyName,
  selectObviousNonGearToyRows,
  type ObviousNonGearToyRow,
} from "./purge-obvious-non-gear.ts";

function makeRow(name: string): ObviousNonGearToyRow {
  return {
    toy_id: crypto.randomUUID(),
    product_id: crypto.randomUUID(),
    name,
    brand: "Lovense",
    deep_reports: 0,
    favorites: 0,
    standardization_tests: 0,
    toy_refs: 1,
  };
}

test("isObviousNonGearToyName only matches clearly non-gear product names", () => {
  assert.equal(isObviousNonGearToyName("Lovense 4K Webcam 2: Upgraded Design"), true);
  assert.equal(isObviousNonGearToyName("USB Bluetooth Adapter"), true);
  assert.equal(isObviousNonGearToyName("Lovense Toys Discount Sale"), true);
  assert.equal(isObviousNonGearToyName("KISSTOY官方旗舰店品牌购物金"), true);

  assert.equal(isObviousNonGearToyName("Lovense Mini Sex Machine"), false);
  assert.equal(isObviousNonGearToyName("PowerBlow & Feel Pocket Stroker Crystal"), false);
  assert.equal(isObviousNonGearToyName("Pleasure Pouch"), false);
});

test("selectObviousNonGearToyRows requires safe product references", () => {
  const safe = makeRow("USB Bluetooth Adapter");
  const hasReport = { ...makeRow("Lovense 4K Webcam"), deep_reports: 1 };
  const sharedProduct = { ...makeRow("Lovense Toys Discount Sale"), toy_refs: 2 };

  const selected = selectObviousNonGearToyRows([safe, hasReport, sharedProduct]);

  assert.deepEqual(selected.map((row) => row.toy_id), [safe.toy_id]);
});
