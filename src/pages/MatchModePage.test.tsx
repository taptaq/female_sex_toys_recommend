import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { MatchModePage } from "./MatchModePage.tsx";

function getCssBlock(source: string, selector: string) {
  return source.match(new RegExp(`^${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{[^}]*\\}`, "m"))?.[0] ?? "";
}

test("match mode page renders quiz and natural language entry options", () => {
  const html = renderToStaticMarkup(
    <MatchModePage
      pageVariants={{}}
      onSelectQuizMode={() => {}}
      onSelectNaturalLanguageMode={() => {}}
      onSelectLuckyMode={() => {}}
      onSelectLibraryMode={() => {}}
      onBackHome={() => {}}
    />,
  );

  assert.match(html, /选择探索方式/);
  assert.match(html, /按你的状态，进入一条更舒服的匹配路线/);
  assert.match(html, /female-mvp-mode-hero/);
  assert.match(html, /female-mvp-mode-title/);
  assert.match(html, /female-mvp-mode-subcopy/);
  assert.doesNotMatch(html, /选择一种探索方式/);
  assert.doesNotMatch(html, /你选方式，Luna 负责把选择变舒服/);
  assert.doesNotMatch(html, /先选一种方式/);
  assert.doesNotMatch(html, /再让 Luna 慢慢匹配/);
  assert.match(html, /轻问答/);
  assert.match(html, /用几个温柔问题校准感受/);
  assert.match(html, /直接说/);
  assert.match(html, /幸运抽取/);
  assert.match(html, /手动筛选/);
  assert.match(html, /female-mvp-mode-page/);
  assert.match(html, /female-mvp-mode-orbit-stage/);
  assert.match(html, /female-mvp-mode-orbit-ring/);
  assert.match(html, /female-mvp-mode-planet-button/);
  assert.match(html, /female-mvp-mode-planet-button-active/);
  assert.match(html, /female-mvp-mode-planet-button-back/);
  assert.match(html, /female-mvp-mode-luna-guide/);
  assert.match(html, /female-mvp-mode-luna-guide-from-home/);
  assert.match(html, /female-mvp-mode-portal/);
  assert.match(html, /female-mvp-mode-launch-warp/);
  assert.match(html, /female-mvp-mode-launch-speedline/);
  assert.match(html, /female-mvp-mode-launch-iris/);
  assert.match(html, /female-mvp-mode-selected-panel/);
  assert.match(html, /\/assets\/luna-planets\/modes\/quiz\.webp/);
  assert.match(html, /\/assets\/luna-planets\/modes\/talk\.webp/);
  assert.match(html, /\/assets\/luna-planets\/modes\/lucky\.webp/);
  assert.match(html, /\/assets\/luna-planets\/modes\/library\.webp/);
  assert.match(html, /\/assets\/luna-astronaut\/mode-guide\.webp/);
  assert.match(html, /\/assets\/luna-astronaut\/mode-dive\.webp/);
  assert.match(html, /\/assets\/luna-astronaut\/mode-portal\.webp/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /慢慢来，我会陪你校准/);
  assert.match(html, /开始轻问答/);
  assert.match(html, /新手友好 · 约 2 分钟/);
  assert.match(html, /female-mvp-mode-selected-summary/);
  assert.match(html, /female-mvp-mode-selected-meta/);
  assert.doesNotMatch(html, /<h2>轻问答<\/h2>/);
  assert.doesNotMatch(html, /female-mvp-mode-card/);
});

test("match mode Luna guide docks left and dives into the active planet center", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");
  const pageSource = fs.readFileSync(path.resolve(process.cwd(), "src/pages/MatchModePage.tsx"), "utf8");

  assert.match(pageSource, /import gsap from "gsap";/);
  assert.match(pageSource, /usePagePerformanceState/);
  assert.match(pageSource, /getGsapDuration/);
  assert.match(pageSource, /shouldRunGsapMotion/);
  assert.match(pageSource, /runMatchModeEntranceMotion/);
  assert.match(pageSource, /runMatchModeActiveFocusMotion/);
  assert.match(pageSource, /runMatchModeLaunchMotion/);
  assert.match(pageSource, /gsap\.timeline\(\{[\s\S]*?defaults: \{ ease: "sine\.out" \}/);
  assert.match(pageSource, /\.addLabel\("modeOrbitWake"\)/);
  assert.match(pageSource, /\.addLabel\("modeLunaDock"/);
  assert.match(pageSource, /\.addLabel\("modeLaunchFocus"\)/);
  assert.match(pageSource, /\.addLabel\("modeLaunchWarp"/);
  assert.match(pageSource, /\.to\(\s*"\.female-mvp-mode-planet-button-active \.female-mvp-mode-planet-image"/);
  assert.match(pageSource, /\.to\(\s*"\.female-mvp-mode-selected-panel"/);
  assert.match(source, /\.female-mvp-mode-portal\s*\{[\s\S]*?top: 38%;/);
  assert.match(source, /\.female-mvp-mode-luna-guide\s*\{[\s\S]*?transform: translate3d\(-7rem, -3\.1rem, 0\);/);
  assert.match(source, /@keyframes female-mvp-mode-luna-enter-left/);
  assert.match(source, /\.female-mvp-mode-luna-guide-from-home\s*\{[\s\S]*?animation: female-mvp-mode-luna-enter-left 1880ms linear backwards;/);
  assert.match(source, /0%\s*\{[\s\S]*?transform: translate3d\(calc\(var\(--luna-guide-x, -7rem\) - 9rem\), calc\(var\(--luna-guide-y, -3\.1rem\) - 0\.38rem\), 0\) rotate\(-9deg\) scale\(0\.78\);/);
  assert.match(source, /34%\s*\{[\s\S]*?transform: translate3d\(calc\(var\(--luna-guide-x, -7rem\) - 5\.6rem\), calc\(var\(--luna-guide-y, -3\.1rem\) - 0\.28rem\), 0\) rotate\(-6deg\) scale\(0\.86\);/);
  assert.match(source, /@keyframes female-mvp-mode-luna-bubble-reveal/);
  assert.match(source, /\.female-mvp-mode-luna-image-guide\s*\{[\s\S]*?animation: female-mvp-mode-luna-float 5\.2s ease-in-out 1980ms infinite;/);
  assert.match(source, /@keyframes female-mvp-mode-luna-exit-planet/);
  assert.match(source, /\.female-mvp-mode-luna-guide-from-planet\s*\{[\s\S]*?animation: female-mvp-mode-luna-exit-planet 1280ms cubic-bezier\(0\.2, 0\.86, 0\.18, 1\) backwards;/);
  assert.match(source, /0%\s*\{[\s\S]*?transform: translate3d\(-0\.35rem, -0\.1rem, 0\) rotate\(-34deg\) scale\(0\.14\);/);
  assert.match(source, /24%\s*\{[\s\S]*?transform: translate3d\(-2\.8rem, -1\.58rem, 0\) rotate\(-26deg\) scale\(0\.52\);/);
  assert.match(source, /54%\s*\{[\s\S]*?transform: translate3d\(calc\(var\(--luna-guide-x, -7rem\) \+ 0\.72rem\), calc\(var\(--luna-guide-y, -3\.1rem\) - 0\.68rem\), 0\) rotate\(-12deg\) scale\(1\.08\);/);
  assert.match(source, /@keyframes female-mvp-mode-planet-return-burst/);
  assert.match(source, /@keyframes female-mvp-mode-luna-return-trail/);
  assert.match(source, /@keyframes female-mvp-mode-luna-return-dive-facing/);
  assert.match(source, /@keyframes female-mvp-mode-luna-return-guide-reveal/);
  assert.match(source, /\.female-mvp-mode-page-from-planet \.female-mvp-mode-planet-button-active::before\s*\{[\s\S]*?animation: female-mvp-mode-planet-return-burst 1040ms ease-out both;/);
  assert.match(source, /\.female-mvp-mode-luna-guide-from-planet::after\s*\{[\s\S]*?animation: female-mvp-mode-luna-return-trail 1180ms ease-out both;/);
  assert.match(source, /\.female-mvp-mode-luna-guide-from-planet::after\s*\{[\s\S]*?right: 72%;[\s\S]*?width: 4\.2rem;/);
  assert.match(source, /\.female-mvp-mode-luna-guide-from-planet::after\s*\{[\s\S]*?radial-gradient\(ellipse at 92% 50%/);
  assert.match(source, /\.female-mvp-mode-luna-image\s*\{[\s\S]*?position: relative;[\s\S]*?z-index: 1;/);
  assert.doesNotMatch(source, /\.female-mvp-mode-luna-guide-from-planet::before/);
  assert.doesNotMatch(source, /\.female-mvp-mode-page-from-planet \.female-mvp-mode-planet-button-active::after/);
  assert.match(source, /\.female-mvp-mode-luna-guide-from-planet \.female-mvp-mode-luna-image-guide\s*\{[\s\S]*?female-mvp-mode-luna-return-guide-reveal 1280ms ease-out both/);
  assert.match(source, /\.female-mvp-mode-luna-guide-from-planet \.female-mvp-mode-luna-image-dive\s*\{[\s\S]*?animation: female-mvp-mode-luna-return-dive-facing 1280ms ease-out both;/);
  assert.match(source, /0%,\s*42%\s*\{[\s\S]*?opacity: 1;/);
  assert.match(source, /0%,\s*76%\s*\{[\s\S]*?opacity: 0;/);
  assert.match(source, /transform: scaleX\(-1\) rotate\(10deg\) scale\(1\.02\);/);
  assert.match(source, /100%\s*\{[\s\S]*?transform: translate3d\(var\(--luna-guide-x, -7rem\), var\(--luna-guide-y, -3\.1rem\), 0\) rotate\(0deg\) scale\(1\);/);
  assert.match(source, /\.female-mvp-mode-luna-bubble\s*\{[\s\S]*?right: calc\(100% \+ 0\.08rem\);/);
  assert.match(source, /\.female-mvp-mode-luna-bubble\s*\{[\s\S]*?max-width: 5\.05rem;/);
  assert.match(source, /\.female-mvp-mode-luna-guide-from-home \.female-mvp-mode-luna-bubble\s*\{[\s\S]*?animation: female-mvp-mode-luna-bubble-reveal 520ms ease-out 1540ms both;/);
  const launchingGuideBlock = source.match(/\.female-mvp-mode-luna-guide-launching\s*\{[^}]*\}/)?.[0] ?? "";
  assert.doesNotMatch(launchingGuideBlock, /transform: translate3d/);
  assert.match(source, /\.female-mvp-mode-luna-guide-launching \.female-mvp-mode-luna-image-guide\s*\{[\s\S]*?animation: none;/);
  assert.match(source, /\.female-mvp-mode-luna-guide-launching \.female-mvp-mode-luna-image-dive\s*\{[\s\S]*?animation: none;/);
  assert.doesNotMatch(source, /female-mvp-mode-page-launching \.female-mvp-mode-planet-button-active\s*\{[\s\S]*?animation: female-mvp-mode-launch-pulse/);
  assert.match(pageSource, /window\.setTimeout\(\(\) => \{[\s\S]*?\}, 980\);/);
  assert.match(source, /@keyframes female-mvp-mode-launch-speedline-flight/);
  assert.match(source, /@keyframes female-mvp-mode-launch-iris-warp/);
  assert.match(source, /@keyframes female-mvp-mode-active-planet-warp/);
  assert.match(source, /@keyframes female-mvp-mode-quiz-calibrate/);
  assert.match(source, /@keyframes female-mvp-mode-talk-signal/);
  assert.match(source, /@keyframes female-mvp-mode-lucky-spark/);
  assert.match(source, /\.female-mvp-mode-planet-button-quiz\[aria-pressed="true"\] \.female-mvp-mode-planet-aura\s*\{[\s\S]*?animation: female-mvp-mode-quiz-calibrate/);
  assert.match(source, /\.female-mvp-mode-planet-button-natural-language\[aria-pressed="true"\] \.female-mvp-mode-planet-aura\s*\{[\s\S]*?animation: female-mvp-mode-talk-signal/);
  assert.match(source, /\.female-mvp-mode-planet-button-lucky\[aria-pressed="true"\] \.female-mvp-mode-planet-aura\s*\{[\s\S]*?animation: female-mvp-mode-lucky-spark/);
  assert.doesNotMatch(source, /\.female-mvp-mode-page-launching \.female-mvp-mode-planet-button-active \.female-mvp-mode-planet-image\s*\{[\s\S]*?animation: female-mvp-mode-active-planet-warp 960ms/);
  assert.doesNotMatch(source, /\.female-mvp-mode-launch-warp-active \.female-mvp-mode-launch-speedline\s*\{[\s\S]*?animation: female-mvp-mode-launch-speedline-flight 720ms/);
  assert.doesNotMatch(source, /\.female-mvp-mode-launch-warp-active \.female-mvp-mode-launch-iris\s*\{[\s\S]*?animation: female-mvp-mode-launch-iris-warp 960ms/);
  assert.match(source, /\.female-mvp-mode-page-launching \.female-mvp-mode-planet-button-active \.female-mvp-mode-planet-image\s*\{[\s\S]*?animation: none;/);
  assert.match(source, /\.female-mvp-mode-launch-warp-active \.female-mvp-mode-launch-speedline\s*\{[\s\S]*?animation: none;/);
  assert.match(source, /\.female-mvp-mode-launch-warp-active \.female-mvp-mode-launch-iris\s*\{[\s\S]*?animation: none;/);
  assert.match(source, /46%\s*\{[\s\S]*?transform: translate3d\(4\.5rem, -1\.4rem, 0\) rotate\(20deg\) scale\(0\.62\);/);
  assert.match(source, /72%\s*\{[\s\S]*?transform: translate3d\(6\.28rem, -0\.74rem, 0\) rotate\(26deg\) scale\(0\.3\);/);
  assert.match(source, /100%\s*\{[\s\S]*?transform: translate3d\(7\.2rem, -0\.08rem, 0\) rotate\(30deg\) scale\(0\.1\);/);
});

test("match mode Luna can enter from the active planet when returning from an inner mode", () => {
  const html = renderToStaticMarkup(
    <MatchModePage
      pageVariants={{}}
      entrance="planet"
      onSelectQuizMode={() => {}}
      onSelectNaturalLanguageMode={() => {}}
      onSelectLuckyMode={() => {}}
      onSelectLibraryMode={() => {}}
      onBackHome={() => {}}
    />,
  );

  assert.match(html, /female-mvp-mode-luna-guide-from-planet/);
  assert.match(html, /female-mvp-mode-page-from-planet/);
  assert.doesNotMatch(html, /female-mvp-mode-luna-guide-from-home/);
});

test("match mode planet switching eases between orbit slots without delaying clicks", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");
  const pageSource = fs.readFileSync(path.resolve(process.cwd(), "src/pages/MatchModePage.tsx"), "utf8");
  const planetButtonBlock = getCssBlock(source, ".female-mvp-mode-planet-button");
  const planetImageBlock = getCssBlock(source, ".female-mvp-mode-planet-image");

  assert.match(planetButtonBlock, /opacity 520ms ease/);
  assert.match(planetButtonBlock, /transform 680ms cubic-bezier\(0\.18, 0\.86, 0\.2, 1\)/);
  assert.match(planetImageBlock, /will-change: transform;/);
  assert.match(pageSource, /type OrbitSlot = "active" \| "next" \| "prev" \| "back";/);
  assert.match(pageSource, /if \(diff === total - 1\) return "prev";\s*return "back";/);
  assert.match(pageSource, /aria-hidden=\{slot === "back" \? true : undefined\}/);
  assert.match(pageSource, /tabIndex=\{slot === "back" \? -1 : 0\}/);
  assert.match(source, /\.female-mvp-mode-planet-button-back\s*\{[\s\S]*?opacity: 0;[\s\S]*?pointer-events: none;/);
  assert.match(pageSource, /\.set\("\.female-mvp-mode-planet-button", \{ autoAlpha: 0 \}\)/);
  assert.match(pageSource, /"\.female-mvp-mode-planet-button",\s*\{\s*autoAlpha: 1,\s*stagger:/);
  assert.doesNotMatch(pageSource, /\.set\("\.female-mvp-mode-planet-button", \{ autoAlpha: 0, scale:/);
  assert.doesNotMatch(pageSource, /"\.female-mvp-mode-planet-button",\s*\{\s*autoAlpha: 1,\s*scale:/);
  assert.doesNotMatch(pageSource, /setTimeout\(\(\) => \{\s*setActiveModeId/);
});

test("match mode selected panel sits lower below the active planet", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");

  assert.match(source, /\.female-mvp-mode-selected-panel\s*\{[\s\S]*?margin-top: 1\.5rem;/);
});

test("match mode keeps direct talk and lucky draw disabled until they are opened", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");
  const pageSource = fs.readFileSync(path.resolve(process.cwd(), "src/pages/MatchModePage.tsx"), "utf8");
  const naturalLanguageOptionBlock =
    pageSource.match(/\{\s*id: "natural-language"[\s\S]*?\n  \},/)?.[0] ?? "";
  const luckyOptionBlock =
    pageSource.match(/\{\s*id: "lucky"[\s\S]*?\n  \},/)?.[0] ?? "";

  assert.match(naturalLanguageOptionBlock, /isComingSoon: true/);
  assert.match(luckyOptionBlock, /isComingSoon: true/);
  assert.match(pageSource, /const isActiveModeComingSoon = Boolean/);
  assert.match(pageSource, /if \(launchingModeId \|\| isActiveModeComingSoon\) return;/);
  assert.match(pageSource, /disabled=\{Boolean\(launchingModeId\) \|\| isActiveModeComingSoon\}/);
  assert.match(pageSource, /female-mvp-mode-start-button-disabled/);
  assert.match(pageSource, /该功能后续开放，尽情期待/);
  assert.match(source, /\.female-mvp-mode-start-button-disabled,/);
  assert.match(source, /\.female-mvp-mode-coming-soon-note\s*\{/);
});

test("match mode touch tracking does not trigger extra React renders", () => {
  const pageSource = fs.readFileSync(path.resolve(process.cwd(), "src/pages/MatchModePage.tsx"), "utf8");

  assert.match(pageSource, /import \{ useEffect, useRef, useState \} from "react";/);
  assert.match(pageSource, /const touchStartXRef = useRef<number \| null>\(null\);/);
  assert.doesNotMatch(pageSource, /const \[touchStartX/);
  assert.doesNotMatch(pageSource, /setTouchStartX/);
});

test("match mode animations avoid repaint-heavy animated properties", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");
  const planetButtonBlock = getCssBlock(source, ".female-mvp-mode-planet-button");
  const quizCalibrateKeyframes = source.slice(
    source.indexOf("@keyframes female-mvp-mode-quiz-calibrate"),
    source.indexOf("@keyframes female-mvp-mode-talk-signal"),
  );
  const luckySparkKeyframes = source.slice(
    source.indexOf("@keyframes female-mvp-mode-lucky-spark"),
    source.indexOf("@keyframes female-mvp-mode-luna-float"),
  );
  const activePlanetWarpKeyframes = source.slice(
    source.indexOf("@keyframes female-mvp-mode-active-planet-warp"),
    source.indexOf("@keyframes female-mvp-speed-pulse"),
  );

  assert.doesNotMatch(quizCalibrateKeyframes, /box-shadow:/);
  assert.doesNotMatch(luckySparkKeyframes, /filter:/);
  assert.doesNotMatch(activePlanetWarpKeyframes, /filter:/);
  assert.match(planetButtonBlock, /will-change: transform, opacity;/);
  assert.doesNotMatch(planetButtonBlock, /transition:[\s\S]*filter/);
});

test("match mode does not mount a duplicate cosmos background behind its own starfield", () => {
  const appSource = fs.readFileSync(path.resolve(process.cwd(), "src/App.tsx"), "utf8");
  const matchModeRouteBlock =
    appSource.match(/if \(currentRoute === "\/match-mode"\) \{[\s\S]*?\n  \}/)?.[0] ?? "";

  assert.match(matchModeRouteBlock, /<MatchModePage/);
  assert.match(matchModeRouteBlock, /female-mvp-soft-shell/);
  assert.match(matchModeRouteBlock, /onSelectLibraryMode=\{\(\) => \{/);
  assert.match(matchModeRouteBlock, /navigateTo\("\/library"\);/);
  assert.doesNotMatch(matchModeRouteBlock, /<ThemeCosmosLayer/);
});
