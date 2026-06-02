import assert from "node:assert/strict";
import test from "node:test";

import { buildBrandBrief, resolveBrandBrief } from "./brand-brief.ts";

test("buildBrandBrief derives a stable brand slug and concise copy", () => {
  const brief = buildBrandBrief({
    brand: "We-Vibe",
    country: "加拿大",
    description: "We-Vibe 是加拿大情侣互动与智能情趣科技品牌，强调远程联动与设计感。",
    focus: "Unisex",
    philosophy: ["强调远程联动和稳定体验。"],
    majorUserGroupProfile:
      "【心理特征】重视互动感和连接稳定性。",
  });

  assert.ok(brief);
  assert.equal(brief?.brandName, "We-Vibe");
  assert.equal(brief?.countryLabel, "加拿大");
  assert.equal(brief?.positioning, "We-Vibe 是加拿大情侣互动与智能情趣科技品牌，强调远程联动与设计感。");
  assert.equal(brief?.styleSummary, "强调远程联动和稳定体验。");
  assert.equal(brief?.brandSlug, "we-vibe");
});

test("buildBrandBrief normalizes official website URLs", () => {
  const brief = buildBrandBrief({
    brand: "Dame",
    officialWebsiteUrl: "dame.com/products/eva",
  });

  assert.equal(brief?.officialWebsiteUrl, "https://dame.com/");
});

test("buildBrandBrief normalizes cached English country labels to Chinese", () => {
  const brief = buildBrandBrief({
    brand: "醉清风-谜姬",
    country: "China",
  });

  assert.equal(brief?.countryLabel, "中国");
});

test("resolveBrandBrief normalizes existing cached country labels", () => {
  const brief = resolveBrandBrief(
    {
      brandName: "醉清风-谜姬",
      brandSlug: "zui-qing-feng-mi-ji",
      countryLabel: "China",
      positioning: "醉清风-谜姬 是兼顾多场景体验与不同使用状态的品牌。",
      styleSummary: "整体风格更偏通用与场景适配，也更强调稳定决策成本。",
    },
    "醉清风-谜姬",
  );

  assert.equal(brief?.countryLabel, "中国");
});
