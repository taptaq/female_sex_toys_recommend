import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { MatchModePage } from "./MatchModePage.tsx";

test("match mode page renders quiz and natural language entry options", () => {
  const html = renderToStaticMarkup(
    <MatchModePage
      pageVariants={{}}
      onSelectQuizMode={() => {}}
      onSelectNaturalLanguageMode={() => {}}
      onBackHome={() => {}}
    />,
  );

  assert.match(html, /开始匹配/);
  assert.match(html, /答题匹配/);
  assert.match(html, /自然语言匹配/);
  assert.match(html, /想要的感觉/);
  assert.match(html, /预算静音、防水便携、经验状态/);
});
