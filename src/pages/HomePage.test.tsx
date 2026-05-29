import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

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
      onOpenFavorites={() => {}}
      themeId="inner-space"
      onThemeChange={() => {}}
      authPanel={authPanel}
    />,
  );
}

function renderHomePageElement(props: Partial<Parameters<typeof HomePage>[0]> = {}) {
  return (
    <HomePage
      pageVariants={{}}
      onStart={() => {}}
      onBrowseLibrary={() => {}}
      onOpenKnowledgeNebula={() => {}}
      onOpenProfiles={() => {}}
      onOpenFavorites={() => {}}
      themeId="inner-space"
      onThemeChange={() => {}}
      authPanel={authPanel}
      {...props}
    />
  );
}

function countMatches(input: string, pattern: RegExp) {
  return input.match(pattern)?.length ?? 0;
}

function getCssBlock(input: string, selector: string) {
  const selectorIndex = input.indexOf(selector);
  if (selectorIndex === -1) return "";

  const blockStart = input.indexOf("{", selectorIndex);
  const blockEnd = input.indexOf("}", blockStart);
  if (blockStart === -1 || blockEnd === -1) return "";

  return input.slice(blockStart + 1, blockEnd);
}

function getExactCssBlock(input: string, selector: string) {
  return getCssBlock(input, `${selector} {`);
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

test("female MVP home exposes one clear mobile matching path", () => {
  const html = renderHomePage();

  assert.match(html, /女性向私密匹配/);
  assert.match(html, /找到适合你的装备/);
  assert.match(html, /按感受、场景和偏好/);
  assert.doesNotMatch(html, /让 Luna 读懂今天的你/);
  assert.doesNotMatch(html, /找到适合你的第一颗小星球/);
  assert.doesNotMatch(html, /找到适合你的第一件装备/);
  assert.match(html, /让 Luna 帮我看看/);
  assert.match(html, /问答、直说，或抽一份小幸运/);
  assert.doesNotMatch(html, /3 分钟轻问答/);
  assert.match(html, /女性向/);
  assert.doesNotMatch(html, /还没准备开始，也可以先快速看看/);
  assert.doesNotMatch(html, /装备库/);
  assert.doesNotMatch(html, /知识星云/);
  assert.doesNotMatch(html, /匹配档案/);
  assert.doesNotMatch(html, /SELECTION GUIDE/);
});

test("female MVP home uses a restrained Luna brand mark in the top nav", () => {
  const html = renderHomePage();
  const cssSource = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");
  const brandBlock = getCssBlock(cssSource, ".female-mvp-brand-mark");

  assert.match(html, /female-mvp-brand-mark/);
  assert.match(html, /<strong>Luna<\/strong>/);
  assert.match(html, /女性向私密匹配/);
  assert.match(cssSource, /\.female-mvp-brand-mark::before/);
  assert.match(brandBlock, /grid-template-columns: auto 1fr;/);
  assert.match(brandBlock, /border-radius: 999px;/);
});

test("female MVP home keeps privacy reassurance without login pressure", () => {
  const html = renderHomePage();

  assert.match(html, /隐私友好 · 本地体验/);
  assert.doesNotMatch(html, /登录后可加密保存推荐档案，支持多端同步，也可随时删除/);
  assert.doesNotMatch(html, /登录 \/ 注册/);
  assert.doesNotMatch(html, /placeholder="用户名"/);
  assert.doesNotMatch(html, /placeholder="密码"/);
});

test("female MVP home shows a lightweight login entry without inline account forms", () => {
  const html = renderHomePage();

  assert.doesNotMatch(html, /home-auth-entry/);
  assert.doesNotMatch(html, /完成匹配后可加密保存/);
  assert.doesNotMatch(html, /登录 \/ 注册/);
  assert.doesNotMatch(html, /placeholder="用户名"/);
  assert.doesNotMatch(html, /placeholder="密码"/);
  assert.doesNotMatch(html, /登录后保存推荐档案/);
  assert.match(html, /female-mvp-auth-entry/);
  assert.match(html, />登录</);
  assert.doesNotMatch(html, />收藏</);
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

test("female MVP auth overlay uses a mobile-safe lower sheet variant", () => {
  const html = renderToStaticMarkup(
    <HomeAuthOverlay onClose={() => {}} variant="femaleMvp">
      <div>auth content</div>
    </HomeAuthOverlay>,
  );

  assert.match(html, /female-mvp-auth-overlay/);
  assert.match(html, /female-mvp-auth-dialog/);
  assert.match(html, /items-end/);
  assert.doesNotMatch(html, /items-center bg-slate-950\/88/);
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

test("female MVP home renders a mobile-first astronaut atmosphere", () => {
  const html = renderHomePage();

  assert.match(html, /female-mvp-home/);
  assert.match(html, /female-mvp-stars/);
  assert.match(html, /female-mvp-astronaut/);
  assert.match(html, /female-mvp-astronaut-image/);
  assert.match(html, /\/assets\/luna-astronaut\/yeah\.png/);
  assert.match(html, /female-mvp-primary-button/);
  assert.doesNotMatch(html, /home-space-depth/);
  assert.doesNotMatch(html, /home-primary-ignition/);
  assert.doesNotMatch(html, /home-secondary-node/);
});

test("female MVP home stages the intro before revealing the hero copy", () => {
  const html = renderHomePage();
  const homePageSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/pages/HomePage.tsx"),
    "utf8",
  );
  const cssSource = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");

  assert.match(html, /female-mvp-intro-stage/);
  assert.match(html, /female-mvp-orbit-path/);
  assert.equal(countMatches(html, /class="female-mvp-orbit-planet /g), 4);
  assert.match(html, /data-intro-hidden="true"/);
  assert.match(homePageSource, /gsap\.timeline/);
  assert.match(homePageSource, /female-mvp-copy-reveal/);
  assert.match(cssSource, /\.female-mvp-copy-reveal\[data-intro-hidden="true"\]/);
});

test("female MVP home keeps only the four core Luna planet IP assets in the star-map", () => {
  const html = renderHomePage();
  const homePageSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/pages/HomePage.tsx"),
    "utf8",
  );
  const cssSource = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");

  [
    "privacy",
    "comfort",
    "beginner",
    "care",
  ].forEach((id) => {
    assert.match(html, new RegExp(`/assets/luna-planets/${id}\\.png`));
    assert.match(homePageSource, new RegExp(`female-mvp-orbit-planet-${id}`));
  });
  assert.doesNotMatch(html, /\/assets\/luna-planets\/safety\.png/);
  assert.doesNotMatch(html, /\/assets\/luna-planets\/explore\.png/);
  assert.doesNotMatch(html, /privacy-ring/);
  assert.doesNotMatch(homePageSource, /ringSrc/);
  assert.doesNotMatch(cssSource, /female-mvp-planet-ring/);
  assert.equal(
    fs.existsSync(path.resolve(process.cwd(), "public/assets/luna-planets/privacy-ring.png")),
    false,
  );
  assert.equal(countMatches(html, /female-mvp-orbit-planet-image/g), 4);
  assert.match(cssSource, /\.female-mvp-orbit-planet-image \{/);
}
);

test("female MVP home presents a simplified gentle entrance instead of a carousel launch", () => {
  const html = renderHomePage();
  const homePageSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/pages/HomePage.tsx"),
    "utf8",
  );
  const cssSource = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");

  assert.match(html, /female-mvp-starmap-shell/);
  assert.match(html, /female-mvp-mission-card/);
  assert.match(homePageSource, /female-mvp-starmap-shell/);
  assert.match(homePageSource, /FEMALE_MVP_ORBIT_PATH/);
  assert.match(homePageSource, /FEMALE_MVP_FINAL_PLANET_POSITION/);
  assert.match(cssSource, /\.female-mvp-starmap-shell \{[\s\S]*grid-template-rows: minmax\(0, 1fr\) auto;/);
  assert.match(cssSource, /\.female-mvp-mission-card \{[\s\S]*backdrop-filter: blur\(18px\);/);
});

test("female MVP home uses a gentle 3-phase entrance animation", () => {
  const html = renderHomePage();
  const homePageSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/pages/HomePage.tsx"),
    "utf8",
  );
  const cssSource = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");

  assert.match(html, /female-mvp-nav-reveal/);
  assert.match(html, /female-mvp-launch-shell/);
  assert.match(homePageSource, /\.set\("\.female-mvp-nav-reveal", \{ autoAlpha: 0, y: -10 \}\)/);
  assert.match(homePageSource, /\.set\("\.female-mvp-copy-reveal", \{ autoAlpha: 0, y: 10 \}\)/);
  assert.match(homePageSource, /\.set\("\.female-mvp-stage-backdrop", \{ autoAlpha: 0, scale: 0\.98 \}\)/);
  assert.match(homePageSource, /\.to\(\s*"\.female-mvp-stage-backdrop"[\s\S]*autoAlpha: 1/);
  assert.match(homePageSource, /\.set\("\.female-mvp-orbit-planet", \{ autoAlpha: 0, scale: 0\.92, xPercent: -50, yPercent: -50 \}\)/);
  assert.match(homePageSource, /\.set\("\.female-mvp-route-spark", \{ autoAlpha: 0 \}\)/);
  assert.match(homePageSource, /\.to\(\s*"\.female-mvp-nav-reveal"[\s\S]*autoAlpha: 1/);
  assert.match(homePageSource, /\.to\(\s*"\.female-mvp-astronaut-image"[\s\S]*autoAlpha: 1/);
  assert.match(cssSource, /\.female-mvp-launch-shell \{[\s\S]*margin-top: clamp\(-0\.8rem, -1\.4svh, -0\.25rem\);/);
  assert.match(cssSource, /\.female-mvp-stage-backdrop \{/);
});

test("female MVP home keeps the final equipment cabin from inheriting the oversized launch width", () => {
  const cssSource = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");

  assert.match(cssSource, /\.female-mvp-starmap-shell \{[\s\S]*grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(cssSource, /\.female-mvp-mission-card \{[\s\S]*width: min\(calc\(100vw - 2rem\), 27\.5rem\);/);
  assert.match(cssSource, /\.female-mvp-primary-button \{[\s\S]*width: min\(100%, calc\(100vw - 2rem\)\);/);
});

test("female MVP home positions planets at their final locations with stagger fade-in", () => {
  const homePageSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/pages/HomePage.tsx"),
    "utf8",
  );

  assert.match(homePageSource, /FEMALE_MVP_FINAL_PLANET_POSITION/);
  assert.match(homePageSource, /FEMALE_MVP_HOME_PLANETS/);
  assert.match(homePageSource, /xPercent: -50,[\s\S]*yPercent: -50/);
  assert.match(homePageSource, /id: "privacy"/);
  assert.match(homePageSource, /id: "comfort"/);
  assert.match(homePageSource, /id: "beginner"/);
  assert.match(homePageSource, /id: "care"/);
  assert.match(homePageSource, /"female-mvp-route-spark"/);
  assert.match(homePageSource, /`female-mvp-route-spark-\$\{planet\.id\}`/);
  assert.match(homePageSource, /\.to\(\s*"\.female-mvp-orbit-planet"[\s\S]*stagger/);
});

test("female MVP home uses gentle CSS layout for the intro stage", () => {
  const cssSource = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");

  assert.match(cssSource, /\.female-mvp-carousel-aperture \{/);
  assert.match(cssSource, /\.female-mvp-depth-wash \{/);
  assert.match(cssSource, /\.female-mvp-intro-stage \{[\s\S]*width: min\(90vw, 23\.5rem\);/);
  assert.match(cssSource, /\.female-mvp-intro-stage \{[\s\S]*height: clamp\(16\.2rem, 37svh, 20\.6rem\);/);
  assert.match(cssSource, /\.female-mvp-astronaut \{[\s\S]*width: clamp\(11\.4rem, 47vw, 13\.4rem\);/);
  assert.match(cssSource, /\.female-mvp-orbit-planet \{[\s\S]*width: clamp\(4\.7rem, 21vw, 5\.7rem\);/);
  assert.match(cssSource, /\.female-mvp-orbit-planet \{[\s\S]*transform-origin: 50% 60%;/);
  assert.match(cssSource, /\.female-mvp-starmap-shell \{[\s\S]*perspective: 940px;/);
});

test("female MVP home keeps decorative stage elements muted in the DOM", () => {
  const homePageSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/pages/HomePage.tsx"),
    "utf8",
  );
  const cssSource = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");

  assert.match(homePageSource, /female-mvp-game-lobby-stage/);
  assert.match(homePageSource, /female-mvp-display-plinth/);
  assert.match(homePageSource, /female-mvp-lens-ribbon/);
  assert.match(homePageSource, /female-mvp-holo-grid/);
  assert.match(homePageSource, /\.set\("\.female-mvp-game-lobby-stage"/);
  assert.match(cssSource, /\.female-mvp-game-lobby-stage \{/);
  assert.match(cssSource, /\.female-mvp-display-plinth \{/);
  assert.match(cssSource, /\.female-mvp-lens-ribbon \{/);
  assert.match(cssSource, /\.female-mvp-holo-grid \{/);
  assert.match(cssSource, /\.female-mvp-intro-stage \{[\s\S]*perspective: 980px;/);
  assert.match(cssSource, /\.female-mvp-orbit-planet \{[\s\S]*width: clamp\(4\.7rem, 21vw, 5\.7rem\);/);
  assert.match(cssSource, /\.female-mvp-astronaut \{[\s\S]*width: clamp\(11\.4rem, 47vw, 13\.4rem\);/);
  assert.match(cssSource, /\.female-mvp-holo-grid \{[\s\S]*display: none;/);
});

test("female MVP home uses sine easing for gentle motion", () => {
  const homePageSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/pages/HomePage.tsx"),
    "utf8",
  );
  const cssSource = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");

  assert.match(homePageSource, /ease: "sine\.out"/);
  assert.match(homePageSource, /ease: "sine\.inOut"/);
  assert.match(cssSource, /\.female-mvp-orbit-planet-image \{[\s\S]*filter: saturate\(0\.82\) contrast\(0\.92\) brightness\(1\.08\);/);
});

test("female MVP home labels each planet with short labels", () => {
  const html = renderHomePage();
  const homePageSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/pages/HomePage.tsx"),
    "utf8",
  );
  const cssSource = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");

  ["隐私", "舒适", "新手", "清洁"].forEach((label) => {
    assert.match(html, new RegExp(`>${label}<`));
  });
  assert.equal(countMatches(html, /class="female-mvp-planet-label /g), 4);
  assert.match(homePageSource, /shortLabel: "隐私"/);
  assert.match(homePageSource, /shortLabel: "舒适"/);
  assert.match(homePageSource, /shortLabel: "新手"/);
  assert.match(homePageSource, /shortLabel: "清洁"/);
  assert.match(cssSource, /\.female-mvp-planet-label \{[\s\S]*z-index: 2;/);
  assert.match(cssSource, /\.female-mvp-planet-label \{/);
  assert.match(cssSource, /\.female-mvp-planet-label::before \{/);
  assert.match(cssSource, /\.female-mvp-planet-label \{[\s\S]*animation: none;/);
});

test("female MVP home keeps the scattered star-map centered inside the mobile viewport", () => {
  const cssSource = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");

  assert.match(cssSource, /\.female-mvp-starmap-shell \{[\s\S]*justify-items: center;/);
  assert.match(cssSource, /\.female-mvp-starmap-shell \{[\s\S]*overflow: visible;/);
  assert.match(cssSource, /\.female-mvp-starmap-shell \{[\s\S]*perspective: 940px;/);
  assert.match(cssSource, /\.female-mvp-intro-stage \{[\s\S]*width: min\(90vw, 23\.5rem\);/);
  assert.match(cssSource, /\.female-mvp-intro-stage \{[\s\S]*height: clamp\(16\.2rem, 37svh, 20\.6rem\);/);
  assert.match(cssSource, /\.female-mvp-intro-stage \{[\s\S]*transform-style: preserve-3d;/);
  assert.doesNotMatch(cssSource, /width: min\(104vw/);
  assert.doesNotMatch(cssSource, /right: -3%;/);
}
);

test("female MVP home uses a static orbit path for the star map", () => {
  const homePageSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/pages/HomePage.tsx"),
    "utf8",
  );

  assert.match(homePageSource, /FEMALE_MVP_ORBIT_PATH/);
  assert.match(homePageSource, /d=\{FEMALE_MVP_ORBIT_PATH\}/);
});

test("female MVP home positions planets directly at their final positions", () => {
  const homePageSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/pages/HomePage.tsx"),
    "utf8",
  );

  assert.match(homePageSource, /FEMALE_MVP_FINAL_PLANET_POSITION\[planet\.id\]/);
  assert.match(homePageSource, /privacy: \{ left: 21, top: 38 \}/);
  assert.match(homePageSource, /comfort: \{ left: 79, top: 33 \}/);
  assert.match(homePageSource, /beginner: \{ left: 78, top: 63 \}/);
  assert.match(homePageSource, /care: \{ left: 21, top: 66 \}/);
  assert.match(homePageSource, /left: `\$\{pos\.left\}%`/);
  assert.match(homePageSource, /top: `\$\{pos\.top\}%`/);
});

test("female MVP home keeps astronaut and planet proportions balanced for mobile", () => {
  const cssSource = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");
  const homeOrbitPlanetBlock = getCssBlock(cssSource, ".female-mvp-orbit-planet");
  const privacyPlanetBlock = getCssBlock(cssSource, ".female-mvp-orbit-planet-privacy");
  const beginnerPlanetBlock = getCssBlock(cssSource, ".female-mvp-orbit-planet-beginner");

  assert.match(cssSource, /\.female-mvp-astronaut \{[\s\S]*width: clamp\(11\.4rem, 47vw, 13\.4rem\);/);
  assert.match(cssSource, /\.female-mvp-orbit-planet \{[\s\S]*width: clamp\(4\.7rem, 21vw, 5\.7rem\);/);
  assert.match(cssSource, /\.female-mvp-portal-flare \{/);
  assert.match(cssSource, /\.female-mvp-planet-continuity \{/);
  assert.match(cssSource, /\.female-mvp-orbit-planet::before,/);
  assert.match(cssSource, /\.female-mvp-orbit-planet::after/);
  assert.match(cssSource, /\.female-mvp-orbit-planet \{[\s\S]*transform: translate\(-50%, -50%\);/);
  assert.match(homeOrbitPlanetBlock, /will-change: transform, opacity;/);
  assert.match(homeOrbitPlanetBlock, /opacity: 0\.74;/);
  assert.match(homeOrbitPlanetBlock, /animation: female-mvp-planet-float/);
  assert.match(cssSource, /\.female-mvp-orbit-planet-image \{[\s\S]*translateZ\(var\(--planet-depth, 22px\)\)/);
  assert.match(cssSource, /\.female-mvp-orbit-map \{[\s\S]*rotateX\(42deg\)/);
  assert.match(cssSource, /\.female-mvp-route-spark \{[\s\S]*display: none;/);
  assert.match(privacyPlanetBlock, /--planet-float-y: -0\.22rem;/);
  assert.match(beginnerPlanetBlock, /--planet-float-x: -0\.16rem;/);
  assert.match(beginnerPlanetBlock, /opacity: 0\.62;/);
});

test("female MVP home gives Luna only low-frequency gentle idle details", () => {
  const html = renderHomePage();
  const cssSource = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");

  assert.match(html, /female-mvp-astronaut-shimmer/);
  assert.match(html, /female-mvp-astronaut-thruster/);
  assert.match(cssSource, /@keyframes female-mvp-astronaut-shimmer/);
  assert.match(cssSource, /@keyframes female-mvp-thruster-breathe/);
  assert.match(cssSource, /\.female-mvp-astronaut-image \{[\s\S]*animation: female-mvp-astronaut-bob 7\.2s ease-in-out infinite;/);
  assert.match(cssSource, /\.female-mvp-astronaut-shimmer \{[\s\S]*animation: female-mvp-astronaut-shimmer 6\.8s ease-in-out infinite;/);
  assert.match(cssSource, /\.female-mvp-astronaut-thruster \{[\s\S]*animation: female-mvp-thruster-breathe 8\.4s ease-in-out infinite;/);
  assert.doesNotMatch(cssSource, /female-mvp-speed-pulse 0\.52s/);
});

test("female MVP home adds a quiet backdrop behind Luna and lifts the hero composition", () => {
  const html = renderHomePage();
  const cssSource = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");

  assert.match(html, /female-mvp-luna-backdrop/);
  assert.match(cssSource, /\.female-mvp-luna-backdrop \{/);
  assert.match(cssSource, /\.female-mvp-luna-backdrop \{[\s\S]*transform: translate\(-50%, -56%\)/);
  assert.match(cssSource, /\.female-mvp-luna-backdrop::before/);
  assert.match(cssSource, /\.female-mvp-luna-backdrop::after/);
  assert.match(cssSource, /\.female-mvp-game-lobby-stage \{[\s\S]*transform: translateY\(-0\.9rem\);/);
  assert.match(cssSource, /\.female-mvp-starmap-shell \{[\s\S]*gap: clamp\(0\.32rem, 0\.9svh, 0\.72rem\);/);
  assert.match(cssSource, /\.female-mvp-starmap-shell \{[\s\S]*padding-bottom: clamp\(0\.85rem, 2\.4svh, 1\.45rem\);/);
  assert.match(html, /female-mvp-primary-button mt-2/);
});

test("female MVP home gives the lower copy cabin more breathing room", () => {
  const cssSource = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");
  const missionCardBlock = getExactCssBlock(cssSource, ".female-mvp-mission-card");

  assert.match(cssSource, /\.female-mvp-intro-stage \{[\s\S]*height: clamp\(16\.2rem, 37svh, 20\.6rem\);/);
  assert.match(cssSource, /\.female-mvp-launch-shell \{[\s\S]*margin-top: clamp\(-0\.8rem, -1\.4svh, -0\.25rem\);/);
  assert.match(missionCardBlock, /min-height: clamp\(11\.2rem, 24svh, 13\.6rem\);/);
  assert.match(missionCardBlock, /padding: 1\.2rem 1rem 1\.02rem;/);
  assert.match(missionCardBlock, /display: flex;/);
  assert.match(missionCardBlock, /align-items: center;/);
  assert.match(missionCardBlock, /justify-content: center;/);
  assert.match(cssSource, /\.female-mvp-mission-nodes \{[\s\S]*width: 100%;/);
});

test("female MVP home uses a full-screen soft gradient canvas instead of a dark card shell", () => {
  const html = renderHomePage();
  const appSource = fs.readFileSync(path.resolve(process.cwd(), "src/App.tsx"), "utf8");
  const cssSource = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");

  assert.match(html, /min-h-\[100svh\]/);
  assert.match(html, /h-\[100dvh\]/);
  assert.match(html, /max-h-\[100dvh\]/);
  assert.match(html, /overflow-hidden/);
  assert.doesNotMatch(html, /rounded-\[2rem\]/);
  assert.doesNotMatch(html, /shadow-\[0_24px_80px/);
  assert.match(appSource, /isFemaleMvpHomeRoute/);
  assert.match(appSource, /female-mvp-home-route/);
  assert.match(appSource, /isFemaleMvpHomeRoute\s*\?\s*"h-dvh min-h-dvh p-0"/);
  assert.match(cssSource, /\.female-mvp-home \{[\s\S]*height: 100svh;[\s\S]*max-height: 100svh;/);
  assert.match(cssSource, /\.female-mvp-home-route \{[\s\S]*linear-gradient\(165deg, #fff8ea 0%, #ffe9f1 46%, #dff3ff 100%\);/);
  assert.match(cssSource, /\.female-mvp-intro-stage \{[\s\S]*width: min\(90vw, 23\.5rem\);/);
}
);

test("legacy home background orbits remain available as refined trace lines", () => {
  const cssSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/index.css"),
    "utf8",
  );
  const homePageSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/pages/HomePage.tsx"),
    "utf8",
  );

  assert.match(homePageSource, /home-space-orbit-a/);
  assert.match(homePageSource, /home-space-orbit-b/);
  assert.match(cssSource, /\.home-space-orbit::before/);
  assert.match(cssSource, /mask-image: linear-gradient/);
  assert.doesNotMatch(cssSource, /inset 0 34px 80px var\(--theme-glow\)/);
});

test("legacy home background keeps the real-space photo layer available", () => {
  const cssSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/index.css"),
    "utf8",
  );
  const homePageSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/pages/HomePage.tsx"),
    "utf8",
  );
  const themeSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/lib/app-theme.ts"),
    "utf8",
  );

  assert.match(homePageSource, /home-space-photo/);
  assert.match(homePageSource, /APP_THEME_HOME_COSMOS_IMAGE_BY_ID/);
  assert.match(homePageSource, /home-space-photo-veil/);
  assert.match(cssSource, /\.home-space-photo/);
  assert.match(themeSource, /\/assets\/home-cosmos\/inner-space-spiral\.jpg/);
  assert.match(themeSource, /\/assets\/home-cosmos\/soft-signal-rosette\.jpg/);
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
  assert.match(appSource, /const shouldRenderThemeCosmosLayer =[\s\S]*currentRoute !== "\/" && shellRoute !== "\/" && !isFemaleMvpResultsRoute;/);
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

  assert.match(appSource, /const shouldRenderThemeCosmosLayer =[\s\S]*currentRoute !== "\/" && shellRoute !== "\/" && !isFemaleMvpResultsRoute;/);
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
  assert.match(cssSource, /:root\[data-theme="sync-field"\] \.home-space-depth \{[\s\S]*--home-space-photo-opacity: 0\.3;[\s\S]*--home-space-photo-size: cover;/);
  assert.match(cssSource, /:root\[data-theme="inner-space"\] \.home-space-depth \{[\s\S]*--home-space-photo-float-duration: 24s;[\s\S]*--home-space-veil-duration: 19s;/);
  assert.match(cssSource, /:root\[data-theme="soft-signal"\] \.home-space-depth \{[\s\S]*--home-space-photo-float-duration: 29s;[\s\S]*--home-space-veil-duration: 23s;/);
  assert.match(cssSource, /:root\[data-theme="sync-field"\] \.home-space-depth \{[\s\S]*--home-space-photo-float-duration: 21s;[\s\S]*--home-space-veil-duration: 17\.5s;/);
  assert.doesNotMatch(cssSource, /--home-space-star-pulse-duration/);
  assert.match(cssSource, /\.home-space-depth \{[\s\S]*rgba\(2, 6, 23, 0\.48\)\);/);
  assert.match(cssSource, /\.home-space-depth::after \{[\s\S]*radial-gradient\(ellipse at 52% 44%/);
  assert.match(cssSource, /\.home-space-photo \{[\s\S]*inset: -4% -3% -5%;[\s\S]*isolation: isolate;[\s\S]*mix-blend-mode: normal;/);
  assert.match(cssSource, /\.home-space-photo-image \{[\s\S]*object-fit: cover;[\s\S]*opacity: 0;[\s\S]*transition: opacity 560ms linear;/);
  assert.match(cssSource, /\.home-space-photo-image-exiting \{[\s\S]*transition-duration: 760ms;[\s\S]*transition-delay: 120ms;/);
  assert.match(cssSource, /\.home-space-photo-image-active \{[\s\S]*opacity: calc\(var\(--home-space-photo-layer-opacity\) \+ var\(--home-space-photo-opacity-boost, 0\)\);/);
  assert.match(cssSource, /\.home-space-photo-image-inner-space,\s*\.home-space-photo-image-soft-signal \{[\s\S]*object-position: center 42%;/);
  assert.match(cssSource, /\.home-space-photo-image-sync-field \{[\s\S]*object-position: center 46%;/);
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

  assert.equal(countMatches(html, /female-mvp-home/g), 1);
  assert.equal(countMatches(html, /female-mvp-stars/g), 1);
  assert.equal(countMatches(html, /female-mvp-primary-button/g), 1);
  assert.equal(countMatches(html, /female-mvp-astronaut-image/g), 1);
  assert.equal(countMatches(html, /cute-astronaut__figure/g), 0);
  assert.equal(countMatches(html, /home-space-photo/g), 0);
  assert.equal(countMatches(html, /home-space-comet/g), 0);
  assert.equal(countMatches(html, /home-panel-scan/g), 0);
  assert.equal(countMatches(html, /home-primary-ignition/g), 0);
});

test("female MVP home keeps a focused hero shell with a single primary action", () => {
  const html = renderHomePage();

  assert.equal(countMatches(html, /female-mvp-primary-button/g), 1);
  assert.equal(countMatches(html, />让 Luna 帮我看看</g), 1);
  assert.match(html, /女性向 · 私密匹配/);
  assert.match(html, /找到适合你的装备/);
  assert.match(html, /按感受、场景和偏好/);
  assert.match(html, /让 Luna 帮我看看/);
});

test("female MVP home frames Luna's journey as a calm guided check-in without crowding the card", () => {
  const html = renderHomePage();

  assert.match(html, /female-mvp-equipment-cabin/);
  assert.match(html, /female-mvp-cabin-orbit-rail/);
  assert.match(html, /female-mvp-mission-node/);
  assert.doesNotMatch(html, /准备探索中/);
  assert.match(html, /female-mvp-briefing-line/);
  assert.match(html, /女性向 · 私密匹配/);
  assert.match(html, /female-mvp-mode-dock/);
  assert.doesNotMatch(html, /female-mvp-mode-mark/);
  assert.doesNotMatch(html, /轻问/);
  assert.doesNotMatch(html, /随心/);
  assert.doesNotMatch(html, /今日/);
  assert.match(html, /找到适合你的装备/);
  assert.match(html, /按感受、场景和偏好/);
  assert.match(html, /问答、直说，或抽一份小幸运/);
  assert.match(html, /female-mvp-copy-line/);
  assert.match(html, /让 Luna 帮我看看/);
  assert.match(html, /隐私友好 · 本地体验/);
  assert.equal(countMatches(html, /class="female-mvp-mission-node"/g), 3);
  assert.equal(countMatches(html, /female-mvp-trust-strip/g), 1);
});

test("female MVP home gives the briefing panel more vertical rhythm", () => {
  const cssSource = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");
  const missionCardBlock = getExactCssBlock(cssSource, ".female-mvp-mission-card");
  const modeDockBlock = getExactCssBlock(cssSource, ".female-mvp-mode-dock");

  assert.match(missionCardBlock, /min-height: clamp\(11\.2rem, 24svh, 13\.6rem\);/);
  assert.match(missionCardBlock, /padding: 1\.2rem 1rem 1\.02rem;/);
  assert.match(cssSource, /\.female-mvp-briefing-line \{/);
  assert.match(cssSource, /\.female-mvp-mode-dock \{/);
  assert.match(modeDockBlock, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(modeDockBlock, /border-radius: 999px;/);
  assert.match(modeDockBlock, /padding: 0\.12rem;/);
  assert.doesNotMatch(modeDockBlock, /border-top:/);
  assert.match(cssSource, /\.female-mvp-mission-node \{[\s\S]*background: transparent;/);
  assert.match(cssSource, /\.female-mvp-mission-node::before \{/);
  assert.doesNotMatch(cssSource, /\.female-mvp-mode-mark \{/);
  assert.doesNotMatch(cssSource, /\.female-mvp-mode-dock::after \{/);
});

test("female MVP home visually centers the briefing eyebrow above the title", () => {
  const html = renderHomePage();
  const cssSource = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");
  const briefingLineBlock = getExactCssBlock(cssSource, ".female-mvp-briefing-line");

  assert.match(html, /<p class="female-mvp-briefing-line">\s*<span>女性向 · 私密匹配<\/span>\s*<\/p>/);
  assert.match(briefingLineBlock, /display: inline-grid;/);
  assert.match(briefingLineBlock, /grid-template-columns: 1\.25rem auto 1\.25rem;/);
  assert.match(briefingLineBlock, /margin-inline: auto;/);
  assert.match(cssSource, /\.female-mvp-briefing-line::before,\n\.female-mvp-briefing-line::after \{/);
  assert.match(cssSource, /\.female-mvp-briefing-line::after \{/);
}
);

test("female MVP home launches Luna to the right before opening mode selection", () => {
  const html = renderHomePage();
  const homePageSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/pages/HomePage.tsx"),
    "utf8",
  );
  const cssSource = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");

  assert.match(html, /让 Luna 帮我看看/);
  assert.match(homePageSource, /const \[isFemaleMvpLaunching, setIsFemaleMvpLaunching\] = useState\(false\);/);
  assert.match(homePageSource, /FEMALE_MVP_LAUNCH_EXIT_MS/);
  assert.match(homePageSource, /handleFemaleMvpStart/);
  assert.match(homePageSource, /setIsFemaleMvpLaunching\(true\);/);
  assert.match(homePageSource, /window\.setTimeout\(\(\) => \{\s*onStart\(\);/);
  assert.match(homePageSource, /aria-busy=\{isFemaleMvpLaunching\}/);
  assert.match(homePageSource, /female-mvp-home-launching/);
  assert.match(cssSource, /@keyframes female-mvp-luna-launch-right/);
  assert.match(cssSource, /\.female-mvp-home-launching \.female-mvp-astronaut \{/);
  assert.match(cssSource, /\.female-mvp-home-launching \.female-mvp-primary-button \{/);
}
);

test("female MVP home tightens the hero stage while lightening the lower action area", () => {
  const cssSource = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");
  const shellBlock = getExactCssBlock(cssSource, ".female-mvp-starmap-shell");
  const introStageBlock = getExactCssBlock(cssSource, ".female-mvp-intro-stage");
  const missionCardBlock = getExactCssBlock(cssSource, ".female-mvp-mission-card");
  const missionNodeBlock = getExactCssBlock(cssSource, ".female-mvp-mission-node");
  const primaryButtonBlock = getExactCssBlock(cssSource, ".female-mvp-primary-button");

  assert.match(shellBlock, /gap: clamp\(0\.32rem, 0\.9svh, 0\.72rem\);/);
  assert.match(introStageBlock, /height: clamp\(16\.2rem, 37svh, 20\.6rem\);/);
  assert.match(introStageBlock, /margin-top: -0\.55rem;/);
  assert.match(missionCardBlock, /box-shadow:[\s\S]*0 0\.55rem 1\.8rem rgba\(196, 124, 146, 0\.06\);/);
  assert.match(missionNodeBlock, /min-height: 1\.9rem;/);
  assert.match(primaryButtonBlock, /min-height: 3rem;/);
});

test("female MVP home keeps only a lightweight account action in the top nav", () => {
  const signedOutHtml = renderHomePage();
  const signedInHtml = renderToStaticMarkup(
    <HomePage
      pageVariants={{}}
      onStart={() => {}}
      onBrowseLibrary={() => {}}
      onOpenKnowledgeNebula={() => {}}
      onOpenProfiles={() => {}}
      onOpenFavorites={() => {}}
      themeId="inner-space"
      onThemeChange={() => {}}
      authPanel={{ ...authPanel, userLabel: "taptaq" }}
    />,
  );

  assert.equal(countMatches(signedOutHtml, /home-secondary-node/g), 0);
  assert.equal(countMatches(signedOutHtml, /home-auth-entry/g), 0);
  assert.doesNotMatch(signedOutHtml, /登录 \/ 注册/);
  assert.doesNotMatch(signedOutHtml, /匹配档案/);
  assert.doesNotMatch(signedOutHtml, />退出</);
  assert.match(signedOutHtml, /female-mvp-auth-entry/);
  assert.match(signedOutHtml, />登录</);
  assert.doesNotMatch(signedOutHtml, />收藏</);

  assert.equal(countMatches(signedInHtml, /home-secondary-node/g), 0);
  assert.equal(countMatches(signedInHtml, /home-auth-entry/g), 0);
  assert.doesNotMatch(signedInHtml, /匹配档案/);
  assert.doesNotMatch(signedInHtml, />退出</);
  assert.match(signedInHtml, /female-mvp-auth-entry/);
  assert.match(signedInHtml, /taptaq/);
});

test("female MVP login overlay wires auth panel actions into the modal flow", () => {
  const homePageSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/pages/HomePage.tsx"),
    "utf8",
  );
  const cssSource = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");

  assert.match(homePageSource, /function FemaleMvpAuthEntry/);
  assert.match(homePageSource, /setIsAuthPanelOpen\(true\)/);
  assert.match(homePageSource, /<AuthPanel \{\.\.\.authPanel\} surface="modal" \/>/);
  assert.match(homePageSource, /onOpenProfiles/);
  assert.match(homePageSource, /onOpenFavorites/);
  assert.match(cssSource, /\.female-mvp-auth-entry \{/);
  assert.match(cssSource, /\.female-mvp-auth-modal-shell \{/);
});

test("female MVP login modal keeps decoration CSS-only and minimal", () => {
  const homePageSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/pages/HomePage.tsx"),
    "utf8",
  );
  const cssSource = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");
  const authShellBlock = getCssBlock(cssSource, ".female-mvp-auth-modal-shell");
  const authModalSource = homePageSource.slice(
    homePageSource.indexOf('<div className="female-mvp-auth-modal-shell">'),
    homePageSource.indexOf("</HomeAuthOverlay>", homePageSource.indexOf("female-mvp-auth-modal-shell")),
  );

  assert.match(authModalSource, /female-mvp-auth-orbit-glow/);
  assert.match(cssSource, /\.female-mvp-auth-orbit-glow \{/);
  assert.match(cssSource, /\.female-mvp-auth-orbit-glow::before/);
  assert.match(cssSource, /\.female-mvp-auth-orbit-glow::after/);
  assert.doesNotMatch(authShellBlock, /url\(/);
  assert.doesNotMatch(authModalSource, /首页贴图|luna-planets|removebg-preview|<img/);
});

test("female MVP home does not expose theme switching by default", () => {
  const html = renderHomePage();

  assert.doesNotMatch(html, /主题/);
  assert.doesNotMatch(html, /home-theme-track/);
  assert.doesNotMatch(html, /home-theme-track-list/);
  assert.doesNotMatch(html, /aria-pressed="true"/);
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

test("female MVP home keeps feedback modal mounted without rendering a feedback entry button", () => {
  const html = renderHomePage();
  const homePageSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/pages/HomePage.tsx"),
    "utf8",
  );

  assert.match(homePageSource, /<HomeFeedbackModal/);
  assert.doesNotMatch(html, /意见反馈/);
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
