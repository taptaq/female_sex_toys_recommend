import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCompetitorCountryPatch,
  normalizeCompetitorCountry,
} from "./clean-competitor-country-fields.ts";

test("normalizeCompetitorCountry unifies mixed Chinese and English country names", () => {
  assert.equal(normalizeCompetitorCountry("中国"), "中国");
  assert.equal(normalizeCompetitorCountry("China"), "中国");
  assert.equal(normalizeCompetitorCountry("美国"), "美国");
  assert.equal(normalizeCompetitorCountry("USA"), "美国");
  assert.equal(normalizeCompetitorCountry("德国"), "德国");
  assert.equal(normalizeCompetitorCountry("Germany"), "德国");
  assert.equal(normalizeCompetitorCountry("英国"), "英国");
  assert.equal(normalizeCompetitorCountry("United Kingdom"), "英国");
  assert.equal(normalizeCompetitorCountry("日本"), "日本");
  assert.equal(normalizeCompetitorCountry("Japan"), "日本");
  assert.equal(normalizeCompetitorCountry("加拿大"), "加拿大");
  assert.equal(normalizeCompetitorCountry("Canada"), "加拿大");
  assert.equal(normalizeCompetitorCountry("法国"), "法国");
  assert.equal(normalizeCompetitorCountry("France"), "法国");
  assert.equal(normalizeCompetitorCountry("瑞典"), "瑞典");
  assert.equal(normalizeCompetitorCountry("Sweden"), "瑞典");
  assert.equal(normalizeCompetitorCountry("荷兰"), "荷兰");
  assert.equal(normalizeCompetitorCountry("Netherlands"), "荷兰");
  assert.equal(normalizeCompetitorCountry(""), null);
});

test("buildCompetitorCountryPatch fills blanks from explicit brand overrides", () => {
  assert.deepEqual(
    buildCompetitorCountryPatch({
      id: "1",
      name: "Arcwave",
      country: null,
      is_domestic: false,
      domain: "www.arcwave.com",
    }),
    {
      id: "1",
      nextCountry: "德国",
      previousCountry: null,
    },
  );

  assert.deepEqual(
    buildCompetitorCountryPatch({
      id: "2",
      name: "醉清风-谜姬",
      country: null,
      is_domestic: true,
      domain: "https://www.zuiqingfeng.com",
    }),
    {
      id: "2",
      nextCountry: "中国",
      previousCountry: null,
    },
  );
});

test("buildCompetitorCountryPatch returns null when country is already normalized", () => {
  assert.equal(
    buildCompetitorCountryPatch({
      id: "3",
      name: "POPOCAT",
      country: "中国",
      is_domestic: true,
      domain: "popocat.tmall.com",
    }),
    null,
  );
});
