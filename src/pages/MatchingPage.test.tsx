import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
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

  assert.match(html, /链路解析中/);
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

  assert.match(html, /链路解析中/);
  assert.match(html, /AI 专家深度匹配中/);
  assert.match(html, /静音/);
  assert.match(html, /新手友好/);
});

test("matching page disables ornamental radar spin for small screens", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");

  assert.match(
    source,
    /@media \(max-width: 640px\) \{[\s\S]*\.radar-sweep\s*\{[\s\S]*animation:\s*none\s*!important;/,
  );
  assert.match(
    source,
    /@media \(max-width: 640px\) \{[\s\S]*\.radar-container::before\s*\{[\s\S]*display:\s*none;/,
  );
  assert.match(
    source,
    /@media \(max-width: 640px\) \{[\s\S]*\.tag-flash\s*\{[\s\S]*animation:\s*none\s*!important;/,
  );
});

test("matching page keeps the mobile loading shell tighter while leaving more room for fragments", () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), "src/pages/MatchingPage.tsx"),
    "utf8",
  );
  const cssSource = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");

  assert.match(
    source,
    /min-h-\[calc\(100vh-1\.25rem\)\] w-full flex-col items-center justify-center overflow-visible px-4 py-10 sm:min-h-\[calc\(100vh-3rem\)\] sm:py-12 md:min-h-\[calc\(100vh-4rem\)\]/,
  );
  assert.match(source, /radar-container relative z-10 mb-9 sm:mb-12/);
  assert.match(
    source,
    /relative z-10 min-h-\[11\.25rem\] w-full max-w-\[19rem\] space-y-3 text-center/,
  );
  assert.match(source, /sm:min-h-\[11rem\] sm:max-w-md sm:space-y-4/);
  assert.match(
    cssSource,
    /@media \(max-width: 640px\) \{[\s\S]*\.floating-knowledge-capsule\s*\{[\s\S]*max-width:\s*min\(158px,\s*41vw\);[\s\S]*min-width:\s*112px;[\s\S]*padding:\s*6px 8px;[\s\S]*opacity:\s*0\.52;/,
  );
  assert.match(cssSource, /@media \(max-width: 640px\) \{[\s\S]*\.floating-knowledge-slot-matching-7\s*\{/);
  assert.match(cssSource, /@media \(max-width: 640px\) \{[\s\S]*\.floating-knowledge-slot-matching-8\s*\{/);
});
