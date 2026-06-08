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
  assert.match(html, /问答、直说、筛选，或抽一份小幸运/);
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

test("female MVP auth modal wires a general feedback entrance into the auth panel", () => {
  const homePageSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/pages/HomePage.tsx"),
    "utf8",
  );

  assert.match(homePageSource, /function openFeedbackFromFemaleMvpAuth\(\)/);
  assert.match(homePageSource, /closeFemaleMvpAuthOverlay\(\);\s+openFeedbackModal\(\);/);
  assert.match(
    homePageSource,
    /<AuthPanel\s+\{\.{3}authPanel\}\s+surface="modal"\s+onOpenFeedback=\{openFeedbackFromFemaleMvpAuth\}/,
  );
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
  assert.match(homePageSource, /\.addLabel\("orbitScan"\)/);
  assert.match(homePageSource, /\.addLabel\("planetDiscovery"/);
  assert.match(homePageSource, /\.addLabel\("lunaArrival"/);
  assert.match(homePageSource, /\.addLabel\("labelReveal"/);
  assert.match(homePageSource, /female-mvp-starmap-scan/);
  assert.match(homePageSource, /\.to\(\s*"\.female-mvp-nav-reveal"[\s\S]*autoAlpha: 1/);
  assert.match(homePageSource, /\.to\(\s*"\.female-mvp-astronaut-image"[\s\S]*autoAlpha: 1/);
  assert.match(homePageSource, /\.to\(\s*"\.female-mvp-orbit-planet"[\s\S]*filter: "brightness\(1\.08\) saturate\(1\.06\)"/);
  assert.match(cssSource, /\.female-mvp-launch-shell \{[\s\S]*margin-top: clamp\(-0\.8rem, -1\.4svh, -0\.25rem\);/);
  assert.match(cssSource, /\.female-mvp-stage-backdrop \{/);
  assert.match(cssSource, /\.female-mvp-starmap-scan \{/);
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
  assert.doesNotMatch(homeOrbitPlanetBlock, /animation: female-mvp-planet-float/);
  assert.match(cssSource, /\.female-mvp-orbit-planet-image \{[\s\S]*translateZ\(var\(--planet-depth, 22px\)\)/);
  assert.match(cssSource, /\.female-mvp-orbit-map \{[\s\S]*rotateX\(42deg\)/);
  assert.match(cssSource, /\.female-mvp-route-spark \{[\s\S]*display: none;/);
  assert.match(privacyPlanetBlock, /--planet-float-y: -0\.22rem;/);
  assert.match(beginnerPlanetBlock, /--planet-float-x: -0\.16rem;/);
  assert.match(beginnerPlanetBlock, /opacity: 0\.62;/);
});

test("female MVP home gives Luna only low-frequency gentle idle details", () => {
  const html = renderHomePage();
  const homePageSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/pages/HomePage.tsx"),
    "utf8",
  );
  const cssSource = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");

  assert.match(html, /female-mvp-astronaut-shimmer/);
  assert.match(html, /female-mvp-astronaut-thruster/);
  assert.match(homePageSource, /startFemaleMvpIdleMotion/);
  assert.match(homePageSource, /gsap\.to\("\.female-mvp-astronaut-image"/);
  assert.match(homePageSource, /gsap\.to\("\.female-mvp-orbit-planet"/);
  assert.match(homePageSource, /gsap\.to\("\.female-mvp-planet-label"/);
  assert.match(homePageSource, /repeat: idleRepeat/);
  assert.match(homePageSource, /x: "0\.1rem"/);
  assert.match(homePageSource, /y: "-0\.46rem"/);
  assert.match(homePageSource, /rotation: 1\.6/);
  assert.match(cssSource, /@keyframes female-mvp-astronaut-shimmer/);
  assert.match(cssSource, /@keyframes female-mvp-thruster-breathe/);
  assert.doesNotMatch(cssSource, /\.female-mvp-astronaut-image \{[\s\S]*animation: female-mvp-astronaut-bob 7\.2s ease-in-out infinite;/);
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
  assert.match(missionCardBlock, /min-height: clamp\(12\.6rem, 27svh, 15\.2rem\);/);
  assert.match(missionCardBlock, /padding: 1\.55rem 1rem 1\.36rem;/);
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

test("legacy home starfield background has been removed from the home page bundle", () => {
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
  const mainSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/main.tsx"),
    "utf8",
  );

  assert.doesNotMatch(homePageSource, /home-space-/);
  assert.doesNotMatch(homePageSource, /APP_THEME_HOME_COSMOS_IMAGE_BY_ID/);
  assert.doesNotMatch(homePageSource, /useHomePhotoTransitionEffect/);
  assert.doesNotMatch(homePageSource, /bg-slate-950\/88/);
  assert.doesNotMatch(homePageSource, /shadow-\[0_24px_90px_rgba\(2,8,23,0\.42\)\]/);
  assert.doesNotMatch(cssSource, /home-space-/);
  assert.doesNotMatch(cssSource, /home-panel-scan/);
  assert.doesNotMatch(cssSource, /--app-bg: #0b101e/);
  assert.doesNotMatch(cssSource, /--app-bg: #151116/);
  assert.doesNotMatch(cssSource, /--app-bg: #07130f/);
  assert.doesNotMatch(themeSource, /home-cosmos/);
  assert.doesNotMatch(themeSource, /preloadAppThemeHomeCosmos/);
  assert.doesNotMatch(mainSource, /preloadAllAppThemeHomeCosmos/);
  assert.doesNotMatch(mainSource, /homeCosmosPreloadLink/);
});

test("home page freezes current ambient motion without legacy home-space selectors", () => {
  const cssSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/index.css"),
    "utf8",
  );
  const appSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/App.tsx"),
    "utf8",
  );

  assert.doesNotMatch(cssSource, /transition-duration: 0ms !important;/);
  assert.doesNotMatch(cssSource, /\.theme-home-route \{[\s\S]*linear-gradient\(180deg, #040713, #070b18 48%, #050816\);/);
  assert.match(cssSource, /\.theme-home-route \{[\s\S]*linear-gradient\(165deg, #fff8ea 0%, #ffe9f1 46%, #dff3ff 100%\);/);
  assert.match(appSource, /effectiveShellRoute === "\/" \? "theme-home-route" : ""/);
  assert.match(appSource, /const shouldRenderThemeCosmosLayer =[\s\S]*currentRoute !== "\/"[\s\S]*shellRoute !== "\/"[\s\S]*!isFemaleMvpQuizRoute[\s\S]*!isFemaleMvpResultsRoute;/);
  assert.match(appSource, /\{shouldRenderThemeCosmosLayer \? \(\s*<ThemeCosmosLayer variant=\{themeCosmosVariant\} \/>/);
  assert.match(appSource, /ROUTE_SHELL_EXIT_STABILIZE_MS = 480/);
  assert.match(appSource, /shellRouteStateRef\.current\.route === "\/knowledge" && currentRoute === "\/"/);
  assert.doesNotMatch(cssSource, /\.theme-switch-stabilizing \.home-space-/);
  assert.doesNotMatch(cssSource, /\.ambient-motion-paused \.home-space-/);
  assert.doesNotMatch(cssSource, /\.theme-switch-stabilizing \.theme-cosmos-motif \{[\s\S]*transition: none !important;/);
  assert.match(cssSource, /animation-play-state: paused !important;/);
});

test("returning from knowledge to home does not keep the knowledge cosmos layer mounted over the home theme switcher", () => {
  const appSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/App.tsx"),
    "utf8",
  );

  assert.match(appSource, /const shouldRenderThemeCosmosLayer =[\s\S]*currentRoute !== "\/"[\s\S]*shellRoute !== "\/"[\s\S]*!isFemaleMvpQuizRoute[\s\S]*!isFemaleMvpResultsRoute;/);
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
  const orbitBreatheKeyframe = cssSource.slice(
    cssSource.indexOf("@keyframes home-orbit-breathe"),
    cssSource.indexOf("@keyframes home-primary-pulse"),
  );
  const buttonBorderBlock = cssSource.slice(
    cssSource.indexOf(".home-primary-ignition::after"),
    cssSource.indexOf(".home-privacy-status"),
  );

  assert.doesNotMatch(cssSource, /@keyframes home-space-/);
  assert.doesNotMatch(cssSource, /@keyframes home-panel-scan/);
  assert.doesNotMatch(orbitBreatheKeyframe, /box-shadow/);
  assert.doesNotMatch(orbitBreatheKeyframe, /opacity:/);
  assert.doesNotMatch(buttonBorderBlock, /animation:/);
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
  assert.match(html, /问答、直说、筛选，或抽一份小幸运/);
  assert.match(html, /female-mvp-copy-line/);
  assert.match(html, /让 Luna 帮我看看/);
  assert.match(html, /隐私友好 · 本地体验/);
  assert.equal(countMatches(html, /class="female-mvp-mission-node"/g), 4);
  assert.equal(countMatches(html, /female-mvp-trust-strip/g), 1);
});

test("female MVP home gives the briefing panel more vertical rhythm", () => {
  const cssSource = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");
  const missionCardBlock = getExactCssBlock(cssSource, ".female-mvp-mission-card");
  const modeDockBlock = getExactCssBlock(cssSource, ".female-mvp-mode-dock");

  assert.match(missionCardBlock, /min-height: clamp\(12\.6rem, 27svh, 15\.2rem\);/);
  assert.match(missionCardBlock, /padding: 1\.55rem 1rem 1\.36rem;/);
  assert.match(cssSource, /\.female-mvp-briefing-line \{/);
  assert.match(cssSource, /\.female-mvp-mode-dock \{/);
  assert.match(modeDockBlock, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/);
  assert.match(modeDockBlock, /border-radius: 999px;/);
  assert.match(modeDockBlock, /padding: 0\.2rem;/);
  assert.match(cssSource, /\.female-mvp-copy-line \{[\s\S]*gap: 0\.2rem;/);
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
  assert.match(missionNodeBlock, /min-height: 2\.15rem;/);
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
  assert.match(
    homePageSource,
    /<AuthPanel\s+\{\.{3}authPanel\}\s+surface="modal"\s+onOpenFeedback=\{openFeedbackFromFemaleMvpAuth\}/,
  );
  assert.match(homePageSource, /onOpenProfiles/);
  assert.match(homePageSource, /onOpenFavorites/);
  assert.match(homePageSource, /openFeedbackFromFemaleMvpAuth/);
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
    reservedCount: 0,
    selectedTypes: ["image/png", "image/gif", "image/jpeg", "image/webp"],
  });

  assert.deepEqual(planned.acceptedIndexes, [0]);
  assert.equal(planned.invalidTypeCount, 1);
  assert.equal(planned.overflowCount, 2);
  assert.equal(planned.remainingCapacity, 1);
  assert.equal(planned.nextReservedCount, 1);
  assert.equal(planned.hasInvalidTypeError, true);
  assert.equal(planned.hasOverflowError, true);
});

test("home page feedback screenshot planning blocks additions when capacity is already reserved", () => {
  const planned = planHomeFeedbackScreenshotSelection({
    currentCount: 1,
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
  assert.doesNotMatch(html, /截图上传（可选，最多 2 张）/);
});

test("home page feedback modal passes optional selected page route to submission", () => {
  const homePageSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/pages/HomePage.tsx"),
    "utf8",
  );

  assert.match(homePageSource, /const \[feedbackPageRoute, setFeedbackPageRoute\] = useState\(""\)/);
  assert.match(homePageSource, /pageRoute: feedbackPageRoute \|\| "\/"/);
  assert.match(homePageSource, /setFeedbackPageRoute\(""\)/);
  assert.match(homePageSource, /pageRoute=\{feedbackPageRoute\}/);
  assert.match(homePageSource, /onPageRouteChange=\{\(pageRoute\) => \{/);
  assert.match(homePageSource, /setFeedbackPageRoute\(pageRoute\)/);
});

test("home page shows a global success toast after feedback submission", () => {
  const homePageSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/pages/HomePage.tsx"),
    "utf8",
  );
  const cssSource = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");

  assert.match(homePageSource, /const \[feedbackSuccessToast, setFeedbackSuccessToast\] = useState<string \| null>\(null\)/);
  assert.match(homePageSource, /const feedbackSuccessToastTimeoutRef = useRef<number \| null>\(null\)/);
  assert.match(homePageSource, /setFeedbackSuccessToast\("已收到反馈，谢谢你帮 Luna 变好"\)/);
  assert.match(homePageSource, /setIsFeedbackModalOpen\(false\);\s+setFeedbackSuccessToast/);
  assert.match(homePageSource, /role="status"/);
  assert.match(homePageSource, /aria-live="polite"/);
  assert.match(homePageSource, /home-feedback-success-toast/);
  assert.match(cssSource, /\.home-feedback-success-toast \{/);
});

test("theme switch stabilization also suppresses heavy shell and panel transitions without legacy photo crossfade rules", () => {
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
  assert.doesNotMatch(cssSource, /home-space-photo/);
  assert.doesNotMatch(cssSource, /home-space-photo-image/);
  assert.doesNotMatch(cssSource, /\.theme-switch-stabilizing \.home-space-/);
});
