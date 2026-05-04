import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { HomePage } from "./HomePage.tsx";

const authPanel = {
  isConfigured: true,
  userLabel: null,
  statusMessage: null,
  isSubmitting: false,
  onSubmit: async () => {},
  onSignOut: async () => {},
};

test("home page prioritizes matching and demotes library and knowledge nebula entries", () => {
  const html = renderToStaticMarkup(
    <HomePage
      pageVariants={{}}
      onStart={() => {}}
      onBrowseLibrary={() => {}}
      onOpenKnowledgeNebula={() => {}}
      onOpenProfiles={() => {}}
      authPanel={authPanel}
    />,
  );

  assert.match(html, /开始匹配/);
  assert.match(html, /先随便看看装备库/);
  assert.match(html, /看看知识星云/);
  assert.match(html, /先看真实装备参数、价格区间和筛选维度/);
  assert.match(html, /了解常见误区、参数怎么读/);
  assert.ok(html.indexOf("开始匹配") < html.indexOf("先随便看看装备库"));
  assert.ok(html.indexOf("开始匹配") < html.indexOf("看看知识星云"));
  assert.doesNotMatch(html, /浏览全息装备库/);
  assert.doesNotMatch(html, /进入知识星云/);
});

test("home page consolidates privacy reassurance into the auth entry", () => {
  const html = renderToStaticMarkup(
    <HomePage
      pageVariants={{}}
      onStart={() => {}}
      onBrowseLibrary={() => {}}
      onOpenKnowledgeNebula={() => {}}
      onOpenProfiles={() => {}}
      authPanel={authPanel}
    />,
  );

  assert.match(html, /登录后可加密保存推荐档案，支持多端同步，也可随时删除/);
  assert.doesNotMatch(html, /home-privacy-status/);
  assert.doesNotMatch(html, /登录后多端同步/);
  assert.doesNotMatch(html, /敏感偏好加密保存/);
  assert.doesNotMatch(html, /可随时删除推荐记录/);
  assert.doesNotMatch(html, /无需登录/);
  assert.doesNotMatch(html, /问卷进度保存在本机/);
});

test("home page keeps authentication as a lightweight entry instead of an inline form", () => {
  const html = renderToStaticMarkup(
    <HomePage
      pageVariants={{}}
      onStart={() => {}}
      onBrowseLibrary={() => {}}
      onOpenKnowledgeNebula={() => {}}
      onOpenProfiles={() => {}}
      authPanel={authPanel}
    />,
  );

  assert.match(html, /home-auth-entry/);
  assert.match(html, /登录 \/ 注册/);
  assert.match(html, /完成匹配后可加密保存/);
  assert.doesNotMatch(html, /placeholder="用户名"/);
  assert.doesNotMatch(html, /placeholder="密码"/);
  assert.doesNotMatch(html, /登录后保存推荐档案/);
});

test("home page renders an animated inner-space entry atmosphere", () => {
  const html = renderToStaticMarkup(
    <HomePage
      pageVariants={{}}
      onStart={() => {}}
      onBrowseLibrary={() => {}}
      onOpenKnowledgeNebula={() => {}}
      onOpenProfiles={() => {}}
      authPanel={authPanel}
    />,
  );

  assert.match(html, /home-space-depth/);
  assert.match(html, /home-orbit-core/);
  assert.match(html, /home-primary-ignition/);
  assert.match(html, /home-secondary-node/);
  assert.match(html, /w-\[100vw\]/);
  assert.doesNotMatch(html, /overflow-hidden rounded-\[2rem\]/);
});
