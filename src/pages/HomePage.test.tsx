import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { HomePage } from "./HomePage.tsx";

test("home page prioritizes matching and demotes library and knowledge nebula entries", () => {
  const html = renderToStaticMarkup(
    <HomePage
      pageVariants={{}}
      onStart={() => {}}
      onBrowseLibrary={() => {}}
      onOpenKnowledgeNebula={() => {}}
    />,
  );

  assert.match(html, /开始匹配/);
  assert.match(html, /先随便看看装备库/);
  assert.match(html, /看看知识星云/);
  assert.ok(html.indexOf("开始匹配") < html.indexOf("先随便看看装备库"));
  assert.ok(html.indexOf("开始匹配") < html.indexOf("看看知识星云"));
  assert.doesNotMatch(html, /浏览全息装备库/);
  assert.doesNotMatch(html, /进入知识星云/);
});

test("home page makes privacy reassurance visible before matching starts", () => {
  const html = renderToStaticMarkup(
    <HomePage
      pageVariants={{}}
      onStart={() => {}}
      onBrowseLibrary={() => {}}
      onOpenKnowledgeNebula={() => {}}
    />,
  );

  assert.match(html, /登录后多端同步/);
  assert.match(html, /敏感偏好加密保存/);
  assert.match(html, /可随时删除推荐记录/);
  assert.doesNotMatch(html, /无需登录/);
  assert.doesNotMatch(html, /问卷进度保存在本机/);
});
