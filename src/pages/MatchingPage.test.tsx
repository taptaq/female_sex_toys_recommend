import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { MatchingPage } from "./MatchingPage.tsx";

test("matching page can render the unified library loading state", () => {
  const html = renderToStaticMarkup(
    <MatchingPage
      pageVariants={{}}
      mode="loading"
      loadingStep={1}
      isAiMatching={false}
      tags={[]}
    />,
  );

  assert.match(html, /正在连接星港数据库/);
  assert.match(html, /正在统一分析环境/);
  assert.doesNotMatch(html, /全息装备库载入中/);
});

test("matching page keeps the answer-driven matching state", () => {
  const html = renderToStaticMarkup(
    <MatchingPage
      pageVariants={{}}
      mode="matching"
      isAiMatching
      tags={["静音", "新手友好", "低调"]}
    />,
  );

  assert.match(html, /AI 专家深度匹配中/);
  assert.match(html, /静音/);
  assert.match(html, /新手友好/);
});
