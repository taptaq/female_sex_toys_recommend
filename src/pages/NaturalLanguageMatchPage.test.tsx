import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { NaturalLanguageMatchPage } from "./NaturalLanguageMatchPage.tsx";

test("natural language match page shows prompt guidance and examples", () => {
  const html = renderToStaticMarkup(
    <NaturalLanguageMatchPage
      pageVariants={{}}
      prompt=""
      isSubmitting={false}
      error={null}
      onPromptChange={() => {}}
      onSubmit={() => {}}
      onBack={() => {}}
      onBackHome={() => {}}
    />,
  );

  assert.match(html, /自然语言匹配/);
  assert.match(html, /直接描述你想要的感觉、场景或限制条件/);
  assert.match(html, /温和、强烈、外部、入体、双刺激/);
  assert.match(html, /独处、情侣、异地、宿舍、夜晚/);
  assert.match(html, /想要一个更静音、预算 300 以内、适合女生新手/);
});
