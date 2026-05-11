import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { APP_THEME_OPTIONS } from "../lib/app-theme.ts";

import {
  HomeAuthOverlay,
  HomePage,
  getHomeAuthOverlayFocusTrapTarget,
  planHomeFeedbackScreenshotSelection,
  restoreHomeAuthOverlayFocus,
} from "./HomePage.tsx";

const authPanel = {
  isConfigured: true,
  userLabel: null,
  statusMessage: null,
  isSubmitting: false,
  onSubmit: async () => {},
  onSignOut: async () => {},
};

function renderHomePage() {
  return renderToStaticMarkup(
    <HomePage
      pageVariants={{}}
      onStart={() => {}}
      onBrowseLibrary={() => {}}
      onOpenKnowledgeNebula={() => {}}
      onOpenProfiles={() => {}}
      themeId="inner-space"
      onThemeChange={() => {}}
      authPanel={authPanel}
    />,
  );
}

function countMatches(input: string, pattern: RegExp) {
  return input.match(pattern)?.length ?? 0;
}

function collectElements(node: unknown): any[] {
  if (!isValidElement(node)) {
    if (Array.isArray(node)) {
      return node.flatMap((child) => collectElements(child));
    }

    return [];
  }

  const children = (node.props as { children?: unknown }).children;
  return [node, ...collectElements(children)];
}

test("home page prioritizes matching and demotes library and knowledge nebula entries", () => {
  const html = renderHomePage();

  assert.match(html, /开始匹配/);
  assert.match(html, /先随便看看装备库/);
  assert.match(html, /看看知识星云/);
  assert.match(html, /意见反馈/);
  assert.match(html, /先看真实装备参数、价格区间和筛选维度/);
  assert.match(html, /了解常见误区、参数怎么读/);
  assert.ok(html.indexOf("开始匹配") < html.indexOf("先随便看看装备库"));
  assert.ok(html.indexOf("开始匹配") < html.indexOf("看看知识星云"));
  assert.ok(html.indexOf("开始匹配") < html.indexOf("意见反馈"));
  assert.doesNotMatch(html, /浏览全息装备库/);
  assert.doesNotMatch(html, /进入知识星云/);
});

test("home page consolidates privacy reassurance into the auth entry", () => {
  const html = renderHomePage();

  assert.match(html, /登录后可加密保存推荐档案，支持多端同步，也可随时删除/);
  assert.doesNotMatch(html, /home-privacy-status/);
  assert.doesNotMatch(html, /登录后多端同步/);
  assert.doesNotMatch(html, /敏感偏好加密保存/);
  assert.doesNotMatch(html, /可随时删除推荐记录/);
  assert.doesNotMatch(html, /无需登录/);
  assert.doesNotMatch(html, /问卷进度保存在本机/);
});

test("home page keeps authentication as a lightweight entry instead of an inline form", () => {
  const html = renderHomePage();

  assert.match(html, /home-auth-entry/);
  assert.match(html, /登录 \/ 注册/);
  assert.match(html, /完成匹配后可加密保存/);
  assert.doesNotMatch(html, /placeholder="用户名"/);
  assert.doesNotMatch(html, /placeholder="密码"/);
  assert.doesNotMatch(html, /登录后保存推荐档案/);
});

test("home auth overlay exposes dialog semantics for keyboard-accessible dismissal", () => {
  const html = renderToStaticMarkup(
    <HomeAuthOverlay onClose={() => {}}>
      <div>auth content</div>
    </HomeAuthOverlay>,
  );

  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /aria-labelledby="home-auth-dialog-title"/);
  assert.match(html, /id="home-auth-dialog-title"/);
  assert.match(html, /auth content/);
});

test("home auth overlay supports escape-key dismissal through its dialog container", () => {
  let closeCount = 0;

  const elementTree = HomeAuthOverlay({
    onClose: () => {
      closeCount += 1;
    },
    onKeyDown: (event) => {
      if (event.key === "Escape") {
        closeCount += 1;
      }
    },
    children: <div>auth content</div>,
  });

  const elements = collectElements(elementTree);
  const dialog = elements.find((element) => element.props.role === "dialog");

  dialog.props.onKeyDown({ key: "Escape" });

  assert.equal(closeCount, 1);
});

test("home auth overlay focus trap helper loops at overlay boundaries", () => {
  assert.equal(
    getHomeAuthOverlayFocusTrapTarget({
      focusableCount: 3,
      currentIndex: 2,
      isShiftKey: false,
    }),
    0,
  );
  assert.equal(
    getHomeAuthOverlayFocusTrapTarget({
      focusableCount: 3,
      currentIndex: 0,
      isShiftKey: true,
    }),
    2,
  );
  assert.equal(
    getHomeAuthOverlayFocusTrapTarget({
      focusableCount: 3,
      currentIndex: 1,
      isShiftKey: false,
    }),
    null,
  );
});

test("home auth overlay focus restore helper safely restores when possible", () => {
  let focusCount = 0;

  assert.equal(
    restoreHomeAuthOverlayFocus({
      focus() {
        focusCount += 1;
      },
    }),
    true,
  );
  assert.equal(focusCount, 1);
  assert.equal(restoreHomeAuthOverlayFocus(null), false);
  assert.equal(restoreHomeAuthOverlayFocus({}), false);
});

test("home page renders an animated inner-space entry atmosphere", () => {
  const html = renderHomePage();

  assert.match(html, /home-space-depth/);
  assert.match(html, /home-orbit-core/);
  assert.match(html, /home-primary-ignition/);
  assert.match(html, /home-secondary-node/);
  assert.match(html, /w-\[112vw\]/);
  assert.doesNotMatch(html, /overflow-hidden rounded-\[2rem\]/);
});

test("home page background orbits render as refined trace lines instead of heavy plates", () => {
  const html = renderHomePage();
  const cssSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/index.css"),
    "utf8",
  );

  assert.match(html, /home-space-orbit-a/);
  assert.match(html, /home-space-orbit-b/);
  assert.match(cssSource, /\.home-space-orbit::before/);
  assert.match(cssSource, /mask-image: linear-gradient/);
  assert.doesNotMatch(cssSource, /inset 0 34px 80px var\(--theme-glow\)/);
});

test("home page background now uses a real-space photo layer instead of only synthetic haze", () => {
  const html = renderHomePage();
  const cssSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/index.css"),
    "utf8",
  );
  const themeSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/lib/app-theme.ts"),
    "utf8",
  );

  assert.match(html, /home-space-photo/);
  assert.match(html, /src="\/assets\/home-cosmos\/inner-space-spiral\.jpg"/);
  assert.match(html, /home-space-photo-veil/);
  assert.match(cssSource, /\.home-space-photo/);
  assert.match(themeSource, /\/assets\/home-cosmos\/inner-space-spiral\.jpg/);
  assert.match(themeSource, /\/assets\/home-cosmos\/soft-signal-rosette\.jpg/);
  assert.match(themeSource, /\/assets\/home-cosmos\/vector-pulse-cats-eye\.jpg/);
  assert.match(themeSource, /\/assets\/home-cosmos\/sync-field-arp273\.jpg/);
});

test("home page mobile layout keeps the full photo background visible without pinning it to the corner", () => {
  const cssSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/index.css"),
    "utf8",
  );

  assert.match(cssSource, /@media \(max-width: 640px\)/);
  assert.match(cssSource, /\.home-space-photo \{/);
  assert.match(cssSource, /inset: -7% -12% -5%;/);
  assert.match(cssSource, /--home-space-photo-opacity-boost: 0\.01;/);
  assert.match(cssSource, /\.home-space-photo-image \{[\s\S]*object-position: 44% 34%;/);
  assert.match(cssSource, /translate3d\(-2%, -4%, 0\)/);
});

test("home page ambient photo layers use layered motion instead of a static still background", () => {
  const cssSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/index.css"),
    "utf8",
  );

  assert.match(cssSource, /\.home-space-photo\s*\{[\s\S]*animation: home-space-photo-float/);
  assert.match(cssSource, /\.home-space-photo-veil\s*\{[\s\S]*animation: home-space-veil-breathe/);
  assert.match(cssSource, /\.home-space-nebula-flow-a\s*\{[\s\S]*animation: home-space-nebula-flow-a 34s cubic-bezier/);
  assert.match(cssSource, /\.home-space-nebula-flow-b\s*\{[\s\S]*animation: home-space-nebula-flow-b 46s cubic-bezier/);
  assert.match(cssSource, /\.home-space-galaxy-disk\s*\{[\s\S]*animation: home-space-galaxy-turn 72s linear infinite;/);
  assert.match(cssSource, /\.home-space-galaxy-stream\s*\{[\s\S]*animation: home-space-galaxy-stream 48s ease-in-out infinite alternate;/);
  assert.match(cssSource, /\.home-space-aurora\s*\{[\s\S]*animation: home-space-aurora-drift 64s ease-in-out infinite alternate;/);
  assert.match(cssSource, /\.home-space-stars-a\s*\{[\s\S]*opacity: 0\.42;/);
  assert.doesNotMatch(cssSource, /\.home-space-stars-a\s*\{[^}]*animation:/);
  assert.doesNotMatch(cssSource, /\.home-space-stars-b\s*\{[^}]*animation:/);
  assert.doesNotMatch(cssSource, /home-space-comet/);
  assert.doesNotMatch(cssSource, /home-panel-scan/);
  assert.match(cssSource, /\.home-space-depth \{[\s\S]*--home-space-stabilize-delay: 420ms;/);
  assert.match(cssSource, /\.home-space-photo,\s*\.home-space-photo-veil,\s*\.home-space-nebula-flow-a,\s*\.home-space-nebula-flow-b,\s*\.home-space-galaxy-disk,\s*\.home-space-galaxy-stream,\s*\.home-space-aurora \{[\s\S]*animation-delay: var\(--home-space-stabilize-delay\);[\s\S]*animation-fill-mode: both;/);
  assert.match(cssSource, /@keyframes home-space-veil-breathe/);
  assert.match(cssSource, /@keyframes home-space-nebula-flow-a/);
  assert.match(cssSource, /@keyframes home-space-nebula-flow-b/);
  assert.match(cssSource, /@keyframes home-space-galaxy-turn/);
  assert.match(cssSource, /@keyframes home-space-galaxy-stream/);
  assert.match(cssSource, /@keyframes home-space-aurora-drift/);
});

test("home page keeps background mounted outside the first-load route fade", () => {
  const homePageSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/pages/HomePage.tsx"),
    "utf8",
  );
  const backgroundIndex = homePageSource.indexOf("home-space-depth");
  const motionIndex = homePageSource.indexOf("<motion.div", backgroundIndex);

  assert.notEqual(backgroundIndex, -1);
  assert.notEqual(motionIndex, -1);
  assert.ok(backgroundIndex < motionIndex);
  assert.match(homePageSource, /initial=\{false\}/);
});

test("home page photo crossfade prepares theme image layers in a before-paint effect to avoid one-frame mismatches", () => {
  const homePageSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/pages/HomePage.tsx"),
    "utf8",
  );

  assert.match(homePageSource, /useLayoutEffect,/);
  assert.match(
    homePageSource,
    /const useHomePhotoTransitionEffect =[\s\S]*typeof window === "undefined" \? useEffect : useLayoutEffect;/,
  );
  assert.match(homePageSource, /useHomePhotoTransitionEffect\(\(\) => \{/);
});

test("home page freezes ambient motion while preserving theme crossfade during asset switches", () => {
  const cssSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/index.css"),
    "utf8",
  );
  const appSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/App.tsx"),
    "utf8",
  );
  const homeBackgroundBlock = cssSource.slice(
    cssSource.indexOf(".home-space-depth"),
    cssSource.indexOf(".home-orbit-core"),
  );

  assert.match(cssSource, /\.home-space-photo-image \{[\s\S]*transition: opacity 560ms linear;/);
  assert.match(cssSource, /\.home-space-photo-image-exiting \{[\s\S]*transition-duration: 760ms;[\s\S]*transition-delay: 120ms;/);
  assert.doesNotMatch(cssSource, /transition-duration: 0ms !important;/);
  assert.match(cssSource, /\.theme-home-route \{[\s\S]*linear-gradient\(180deg, #040713, #070b18 48%, #050816\);/);
  assert.match(appSource, /effectiveShellRoute === "\/" \? "theme-home-route" : ""/);
  assert.match(appSource, /const shouldRenderThemeCosmosLayer = currentRoute !== "\/" && shellRoute !== "\/";/);
  assert.match(appSource, /\{shouldRenderThemeCosmosLayer \? \(\s*<ThemeCosmosLayer variant=\{themeCosmosVariant\} \/>/);
  assert.match(appSource, /ROUTE_SHELL_EXIT_STABILIZE_MS = 480/);
  assert.match(appSource, /shellRouteStateRef\.current\.route === "\/knowledge" && currentRoute === "\/"/);
  assert.doesNotMatch(homeBackgroundBlock, /var\(--theme/);
  assert.match(cssSource, /\.theme-switch-stabilizing \.home-space-nebula-flow-a,/);
  assert.match(cssSource, /\.theme-switch-stabilizing \.home-space-nebula-flow-b,/);
  assert.doesNotMatch(cssSource, /\.theme-switch-stabilizing \.theme-cosmos-motif \{[\s\S]*transition: none !important;/);
  assert.match(cssSource, /animation-play-state: paused !important;/);
});

test("returning from knowledge to home does not keep the knowledge cosmos layer mounted over the home theme switcher", () => {
  const appSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/App.tsx"),
    "utf8",
  );

  assert.match(appSource, /const shouldRenderThemeCosmosLayer = currentRoute !== "\/" && shellRoute !== "\/";/);
  assert.match(appSource, /\{shouldRenderThemeCosmosLayer \? \(\s*<ThemeCosmosLayer variant=\{themeCosmosVariant\} \/>/);
});

test("returning from knowledge to home immediately restores the home shell classes before route stabilization finishes", () => {
  const appSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/App.tsx"),
    "utf8",
  );

  assert.match(appSource, /const effectiveShellRoute = currentRoute === "\/" \? currentRoute : shellRoute;/);
  assert.match(appSource, /const shellViewportClassName = isKnowledgeHubRoute[\s\S]*: effectiveShellRoute === "\/quiz"/);
  assert.match(appSource, /effectiveShellRoute === "\/" \? "theme-home-route" : ""/);
});

test("home page ambient animation avoids expensive filter and shadow churn on every frame", () => {
  const cssSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/index.css"),
    "utf8",
  );
  const veilKeyframe = cssSource.slice(
    cssSource.indexOf("@keyframes home-space-veil-breathe"),
    cssSource.indexOf("@keyframes home-orbit-breathe"),
  );
  const orbitBreatheKeyframe = cssSource.slice(
    cssSource.indexOf("@keyframes home-orbit-breathe"),
    cssSource.indexOf("@keyframes home-space-galaxy-turn"),
  );
  const buttonBorderBlock = cssSource.slice(
    cssSource.indexOf(".home-primary-ignition::after"),
    cssSource.indexOf(".home-privacy-status"),
  );

  assert.match(cssSource, /\.home-space-photo \{[\s\S]*will-change: transform;/);
  assert.match(cssSource, /\.home-space-photo-veil \{[\s\S]*will-change: transform;/);
  assert.match(veilKeyframe, /transform: translate3d\(-0\.35%, 0\.22%, 0\) scale\(0\.996\);[\s\S]*transform: translate3d\(0\.55%, -0\.7%, 0\) scale\(1\.01\);/);
  assert.doesNotMatch(veilKeyframe, /filter:/);
  assert.doesNotMatch(cssSource, /@keyframes home-space-star-pulse/);
  assert.doesNotMatch(cssSource, /@keyframes home-space-comet/);
  assert.doesNotMatch(cssSource, /@keyframes home-panel-scan/);
  assert.doesNotMatch(orbitBreatheKeyframe, /box-shadow/);
  assert.doesNotMatch(orbitBreatheKeyframe, /opacity:/);
  assert.doesNotMatch(buttonBorderBlock, /animation:/);
});

test("home page theme atmospheres use the selected image as a full-page background", () => {
  const cssSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/index.css"),
    "utf8",
  );
  const starsABlock = cssSource.slice(
    cssSource.indexOf(".home-space-stars-a"),
    cssSource.indexOf(".home-space-stars-b"),
  );

  assert.match(cssSource, /:root\[data-theme="inner-space"\] \.home-space-depth \{[\s\S]*--home-space-photo-opacity: 0\.34;/);
  assert.match(cssSource, /:root\[data-theme="soft-signal"\] \.home-space-depth \{[\s\S]*--home-space-photo-opacity: 0\.32;/);
  assert.match(cssSource, /:root\[data-theme="vector-pulse"\] \.home-space-depth \{[\s\S]*--home-space-photo-opacity: 0\.3;[\s\S]*--home-space-photo-size: cover;/);
  assert.match(cssSource, /:root\[data-theme="sync-field"\] \.home-space-depth \{[\s\S]*--home-space-photo-opacity: 0\.3;[\s\S]*--home-space-photo-size: cover;/);
  assert.match(cssSource, /:root\[data-theme="inner-space"\] \.home-space-depth \{[\s\S]*--home-space-photo-float-duration: 24s;[\s\S]*--home-space-veil-duration: 19s;/);
  assert.match(cssSource, /:root\[data-theme="soft-signal"\] \.home-space-depth \{[\s\S]*--home-space-photo-float-duration: 29s;[\s\S]*--home-space-veil-duration: 23s;/);
  assert.match(cssSource, /:root\[data-theme="vector-pulse"\] \.home-space-depth \{[\s\S]*--home-space-photo-float-duration: 18s;[\s\S]*--home-space-veil-duration: 15\.5s;/);
  assert.match(cssSource, /:root\[data-theme="sync-field"\] \.home-space-depth \{[\s\S]*--home-space-photo-float-duration: 21s;[\s\S]*--home-space-veil-duration: 17\.5s;/);
  assert.doesNotMatch(cssSource, /--home-space-star-pulse-duration/);
  assert.match(cssSource, /\.home-space-depth \{[\s\S]*rgba\(2, 6, 23, 0\.48\)\);/);
  assert.match(cssSource, /\.home-space-depth::after \{[\s\S]*radial-gradient\(ellipse at 52% 44%/);
  assert.match(cssSource, /\.home-space-photo \{[\s\S]*inset: -4% -3% -5%;[\s\S]*isolation: isolate;[\s\S]*mix-blend-mode: normal;/);
  assert.match(cssSource, /\.home-space-photo-image \{[\s\S]*object-fit: cover;[\s\S]*opacity: 0;[\s\S]*transition: opacity 560ms linear;/);
  assert.match(cssSource, /\.home-space-photo-image-exiting \{[\s\S]*transition-duration: 760ms;[\s\S]*transition-delay: 120ms;/);
  assert.match(cssSource, /\.home-space-photo-image-active \{[\s\S]*opacity: calc\(var\(--home-space-photo-layer-opacity\) \+ var\(--home-space-photo-opacity-boost, 0\)\);/);
  assert.match(cssSource, /\.home-space-photo-image-inner-space,\s*\.home-space-photo-image-soft-signal \{[\s\S]*object-position: center 42%;/);
  assert.match(cssSource, /\.home-space-photo-image-vector-pulse,\s*\.home-space-photo-image-sync-field \{[\s\S]*object-position: center 46%;/);
  assert.match(cssSource, /\.home-space-depth \{[\s\S]*contain: paint;/);
  assert.doesNotMatch(cssSource, /\.home-space-photo \{[^}]*mask-image:/);
  assert.doesNotMatch(cssSource, /\.home-space-photo \{[^}]*filter:/);
  assert.match(cssSource, /\.home-space-photo\s*\{[\s\S]*animation: home-space-photo-float var\(--home-space-photo-float-duration\)/);
  assert.match(cssSource, /\.home-space-photo-veil\s*\{[\s\S]*animation: home-space-veil-breathe var\(--home-space-veil-duration\)/);
  assert.doesNotMatch(starsABlock, /animation:/);
  assert.doesNotMatch(starsABlock, /home-space-star-pulse/);
});

test("home page trims decorative animation density on mid-size and coarse-pointer viewports", () => {
  const cssSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/index.css"),
    "utf8",
  );

  assert.match(cssSource, /@media \(max-width: 1024px\), \(pointer: coarse\)/);
  assert.match(cssSource, /\.home-space-stars-b \{[\s\S]*display: none;/);
  assert.match(cssSource, /\.home-space-nebula-flow-a \{[\s\S]*opacity: 0\.58;[\s\S]*animation-duration: 48s;/);
  assert.match(cssSource, /\.home-space-nebula-flow-b \{[\s\S]*opacity: 0\.42;[\s\S]*animation-duration: 64s;/);
  assert.match(cssSource, /\.home-space-galaxy-disk \{[\s\S]*animation-duration: 96s;/);
  assert.match(cssSource, /\.home-space-galaxy-stream \{[\s\S]*opacity: 0\.56;[\s\S]*animation-duration: 72s;/);
  assert.match(cssSource, /\.home-space-photo-veil \{[\s\S]*animation: none;/);
  assert.match(cssSource, /\.home-space-stars-a \{[\s\S]*opacity: 0\.34;/);
  assert.match(cssSource, /\.home-orbit-core \{[\s\S]*animation: none;/);
});

test("home page secondary entry buttons do not render oversized hover halos", () => {
  const cssSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/index.css"),
    "utf8",
  );

  assert.doesNotMatch(cssSource, /\.home-secondary-node::after/);
  assert.doesNotMatch(cssSource, /\.home-secondary-node:hover::after/);
  assert.doesNotMatch(cssSource, /\.home-secondary-node:focus-within::after/);
});

test("home page keeps ambient layers grouped behind stable semantic anchor nodes", () => {
  const html = renderHomePage();

  assert.equal(countMatches(html, /home-space-stars-a/g), 1);
  assert.equal(countMatches(html, /home-space-stars-b/g), 1);
  assert.equal(countMatches(html, /class="home-space-photo-image /g), 1);
  assert.equal(countMatches(html, /home-space-photo-image-inner-space/g), 1);
  assert.equal(countMatches(html, /home-space-photo-image-soft-signal/g), 0);
  assert.equal(countMatches(html, /home-space-photo-image-vector-pulse/g), 0);
  assert.equal(countMatches(html, /home-space-photo-image-sync-field/g), 0);
  assert.equal(countMatches(html, /home-space-nebula-flow-a/g), 1);
  assert.equal(countMatches(html, /home-space-nebula-flow-b/g), 1);
  assert.equal(countMatches(html, /home-space-galaxy-disk/g), 1);
  assert.equal(countMatches(html, /home-space-galaxy-stream/g), 1);
  assert.equal(countMatches(html, /class="home-space-photo"/g), 1);
  assert.equal(countMatches(html, /home-space-orbit-offset/g), 1);
  assert.equal(countMatches(html, /home-space-comet/g), 0);
  assert.equal(countMatches(html, /home-panel-scan/g), 0);
  assert.equal(countMatches(html, /home-primary-ignition/g), 1);
});

test("home page keeps a focused hero shell with a single primary action and compact orbit scene", () => {
  const html = renderHomePage();

  assert.equal(countMatches(html, /home-orbit-core/g), 1);
  assert.equal(countMatches(html, /home-primary-ignition/g), 1);
  assert.equal(countMatches(html, /glass-panel/g), 2);
  assert.match(html, /内太空装备智能选品向导/);
  assert.match(html, /SELECTION GUIDE/);
  assert.match(html, /开始匹配/);
  assert.ok(countMatches(html, /<button/g) >= 4);
});

test("home page keeps secondary entry navigation and auth actions structurally distinct", () => {
  const signedOutHtml = renderHomePage();
  const signedInHtml = renderToStaticMarkup(
    <HomePage
      pageVariants={{}}
      onStart={() => {}}
      onBrowseLibrary={() => {}}
      onOpenKnowledgeNebula={() => {}}
      onOpenProfiles={() => {}}
      themeId="inner-space"
      onThemeChange={() => {}}
      authPanel={{ ...authPanel, userLabel: "taptaq" }}
    />,
  );

  assert.equal(countMatches(signedOutHtml, /home-secondary-node/g), 3);
  assert.equal(countMatches(signedOutHtml, /home-auth-entry/g), 1);
  assert.match(signedOutHtml, /登录 \/ 注册/);
  assert.doesNotMatch(signedOutHtml, /匹配档案/);
  assert.doesNotMatch(signedOutHtml, />退出</);

  assert.equal(countMatches(signedInHtml, /home-secondary-node/g), 3);
  assert.equal(countMatches(signedInHtml, /home-auth-entry/g), 1);
  assert.match(signedInHtml, /匹配档案/);
  assert.match(signedInHtml, />退出</);
  assert.match(signedInHtml, /taptaq/);
});

test("home page exposes four audience-aware theme options and marks the active one", () => {
  const html = renderHomePage();

  assert.match(html, /主题/);
  assert.match(html, /home-theme-track/);
  assert.match(html, /home-theme-track-list/);
  for (const option of APP_THEME_OPTIONS) {
    assert.match(html, new RegExp(option.shortLabel));
  }
  assert.match(html, /aria-pressed="true"[^>]*>[\s\S]*深空/);
  assert.doesNotMatch(html, /mt-0\.5 block truncate text-\[10px\] opacity-70/);
});

test("home page feedback screenshot planning respects reserved capacity and reports validation issues", () => {
  const planned = planHomeFeedbackScreenshotSelection({
    currentCount: 1,
    reservedCount: 1,
    selectedTypes: ["image/png", "image/gif", "image/jpeg", "image/webp"],
  });

  assert.deepEqual(planned.acceptedIndexes, [0]);
  assert.equal(planned.invalidTypeCount, 1);
  assert.equal(planned.overflowCount, 2);
  assert.equal(planned.remainingCapacity, 1);
  assert.equal(planned.nextReservedCount, 2);
  assert.equal(planned.hasInvalidTypeError, true);
  assert.equal(planned.hasOverflowError, true);
});

test("home page feedback screenshot planning blocks additions when capacity is already reserved", () => {
  const planned = planHomeFeedbackScreenshotSelection({
    currentCount: 2,
    reservedCount: 1,
    selectedTypes: ["image/png"],
  });

  assert.deepEqual(planned.acceptedIndexes, []);
  assert.equal(planned.remainingCapacity, 0);
  assert.equal(planned.overflowCount, 1);
  assert.equal(planned.hasOverflowError, true);
});

test("home page keeps feedback entry rendered without mounting the modal content by default", () => {
  const html = renderHomePage();

  assert.match(html, /意见反馈/);
  assert.doesNotMatch(html, /反馈内容/);
  assert.doesNotMatch(html, /截图上传（可选，最多 3 张）/);
});

test("theme switch stabilization also suppresses heavy shell and panel transitions without removing photo crossfade", () => {
  const cssSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/index.css"),
    "utf8",
  );

  assert.match(cssSource, /\.theme-switch-stabilizing \.theme-synced-page,/);
  assert.match(cssSource, /\.theme-switch-stabilizing \.glass-panel,/);
  assert.match(cssSource, /\.theme-switch-stabilizing \.home-theme-track,/);
  assert.match(cssSource, /\.theme-switch-stabilizing \.home-theme-option,/);
  assert.match(cssSource, /\.theme-switch-stabilizing \.home-primary-ignition,/);
  assert.match(cssSource, /\.theme-switch-stabilizing \.floating-knowledge-capsule,/);
  assert.match(cssSource, /\.theme-switch-stabilizing \.floating-knowledge-capsule::before \{/);
  assert.match(cssSource, /transition: none !important;/);
  assert.match(cssSource, /\.home-space-photo-image \{[\s\S]*transition: opacity 560ms linear;/);
  assert.match(cssSource, /\.home-space-photo-image-exiting \{[\s\S]*transition-duration: 760ms;/);
  assert.doesNotMatch(cssSource, /\.theme-switch-stabilizing \.home-space-photo-image \{[\s\S]*transition: none !important;/);
});
