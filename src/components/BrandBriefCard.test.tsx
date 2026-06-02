import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { BrandBriefCard } from "./BrandBriefCard.tsx";

test("brand brief card renders the compact brand summary content", () => {
  const html = renderToStaticMarkup(
    <BrandBriefCard
      brief={{
        brandName: "LELO",
        brandSlug: "lelo",
        countryLabel: "瑞典",
        positioning: "偏高完成度与整体质感的经典品牌。",
        styleSummary: "风格更克制、稳定，也更强调长期复用体验。",
      }}
    />,
  );

  assert.match(html, /当前品牌/);
  assert.match(html, /LELO/);
  assert.match(html, /瑞典/);
  assert.match(html, /偏高完成度与整体质感的经典品牌。/);
  assert.match(html, /风格更克制、稳定，也更强调长期复用体验。/);
  assert.match(html, /去知识星云看完整品牌介绍/);
  assert.match(html, /href=\"\/knowledge\/brand\/lelo\"/);
});
